import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import OpenAI from 'openai'
import { FoundryLocalManager } from 'foundry-local-sdk'

// 禁用 GPU 缓存，避免启动时的缓存错误日志
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-software-rasterizer')


// Global variables
let mainWindow
let aiClient = null
let currentModelType = 'cloud' // Add this to track current model type, default to cloud
let modelName = null
let endpoint = null
let apiKey = ""
let currentAbortController = null  // 用于中断输出

// 自定义云端 API 配置
let customCloudConfig = {
  apiKey: process.env.YOUR_API_KEY || '',
  endpoint: process.env.YOUR_ENDPOINT || '',
  modelName: process.env.YOUR_MODEL_NAME || ''
}
// Check if all required environment variables are set
if (!customCloudConfig.apiKey || !customCloudConfig.endpoint || !customCloudConfig.modelName) {
  console.log('云端 API 未配置，请在设置中配置或设置环境变量')
}

// Create and initialize the FoundryLocalManager and start the service
const foundryManager = new FoundryLocalManager()
if (!foundryManager.isServiceRunning()) {
    console.error('Foundry Local service is not running')
    app.quit()
}

// Simplified IPC handlers
ipcMain.handle('send-message', (_, messages) => {
  return sendMessage(messages)
})

// 中断输出
ipcMain.handle('abort-chat', () => {
  if (currentAbortController) {
    currentAbortController.abort()
    currentAbortController = null
    return { success: true }
  }
  return { success: false, error: '没有正在进行的输出' }
})

// Add new IPC handler for getting local models
ipcMain.handle('get-local-models', async () => {
  if (!foundryManager) {
    return { success: false, error: 'Local manager not initialized' }
  }
  try {
    const models = await foundryManager.listCachedModels()
    return { success: true, models }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Add new IPC handler for switching models
ipcMain.handle('switch-model', async (_, modelId) => {
  try {
    if (modelId === 'cloud') {
      console.log("Switching to cloud model")
      currentModelType = 'cloud'
      endpoint = customCloudConfig.endpoint
      apiKey = customCloudConfig.apiKey
      modelName = customCloudConfig.modelName
      
      if (!endpoint || !apiKey || !modelName) {
        throw new Error('云端 API 未配置，请先在设置中配置 API')
      }
    } else {
      console.log("Switching to local model")
      currentModelType = 'local'
      modelName = (await foundryManager.init(modelId)).id
      endpoint = foundryManager.endpoint
      apiKey = foundryManager.apiKey
    }

    aiClient = new OpenAI({
      apiKey: apiKey,
      baseURL: endpoint
    })

    return { 
      success: true,
      endpoint: endpoint,
      modelName: modelName
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 保存云端 API 配置
ipcMain.handle('save-cloud-config', (_, config) => {
  try {
    customCloudConfig = {
      apiKey: config.apiKey,
      endpoint: config.endpoint,
      modelName: config.modelName
    }
    console.log('云端 API 配置已保存:', { endpoint: config.endpoint, modelName: config.modelName })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 获取云端 API 配置
ipcMain.handle('get-cloud-config', () => {
  return {
    success: true,
    config: {
      apiKey: customCloudConfig.apiKey ? '***' + customCloudConfig.apiKey.slice(-4) : '',
      endpoint: customCloudConfig.endpoint,
      modelName: customCloudConfig.modelName,
      isConfigured: !!(customCloudConfig.apiKey && customCloudConfig.endpoint && customCloudConfig.modelName)
    }
  }
})

export async function sendMessage(messages) {
  // 创建新的 AbortController
  currentAbortController = new AbortController()
  
  try {
      if (!aiClient) {
          throw new Error('客户端未初始化，请先选择模型')
      }

      // 根据模型类型调整参数
      // 小模型（如 DeepSeek-R1-1.5B）需要更低的 temperature 以避免乱码和重复
      const isSmallModel = modelName?.toLowerCase().includes('1.5b') || 
                           modelName?.toLowerCase().includes('1b') ||
                           modelName?.toLowerCase().includes('3b')
      
      const chatParams = {
        model: modelName,
        messages: messages,
        stream: true,
        max_tokens: 2048,  // 小模型限制输出长度
        temperature: isSmallModel ? 0.01 : 0.7,  // 小模型用极低 temperature
        top_p: isSmallModel ? 0.3 : 0.95         // 小模型用极低 top_p
      }
      
      // 对于本地模型添加重复惩罚参数
      if (currentModelType === 'local') {
        chatParams.repetition_penalty = isSmallModel ? 2.0 : 1.1  // 小模型用极高的重复惩罚
        chatParams.frequency_penalty = isSmallModel ? 1.0 : 0.5   // 频率惩罚
        chatParams.presence_penalty = isSmallModel ? 1.0 : 0      // 存在惩罚
      }
      
      console.log('Chat params:', { model: modelName, temperature: chatParams.temperature, top_p: chatParams.top_p })

      const stream = await aiClient.chat.completions.create(chatParams, {
        signal: currentAbortController.signal
      })

      let hasContent = false
      for await (const chunk of stream) {
        // 检查是否被中断
        if (currentAbortController?.signal?.aborted) {
          mainWindow.webContents.send('chat-aborted')
          return { success: true, aborted: true }
        }
        
        const content = chunk.choices[0]?.delta?.content
        if (content) {
          hasContent = true
          mainWindow.webContents.send('chat-chunk', content)
        }
        
        const finishReason = chunk.choices[0]?.finish_reason
        if (finishReason && finishReason !== 'stop') {
          console.warn('模型输出终止原因:', finishReason)
          if (finishReason === 'length') {
            mainWindow.webContents.send('chat-warning', '输出达到最大长度限制')
          }
        }
      }
      
      currentAbortController = null
      mainWindow.webContents.send('chat-complete')
      return { success: true }
  } catch (error) {
      currentAbortController = null
      
      // 检查是否是中断错误
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        mainWindow.webContents.send('chat-aborted')
        return { success: true, aborted: true }
      }
      
      console.error('sendMessage error:', error)
      
      let errorMsg = error.message
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
          errorMsg = '连接超时，请检查模型服务是否正常运行'
      } else if (error.message.includes('ECONNREFUSED')) {
          errorMsg = '连接被拒绝，模型服务可能未启动'
      } else if (error.message.includes('ECONNRESET')) {
          errorMsg = '连接被重置，可能是模型负载过高'
      } else if (error.message.includes('context') || error.message.includes('token')) {
          errorMsg = '上下文过长，请尝试清空对话后重试'
      } else if (error.message.includes('rate limit')) {
          errorMsg = '请求频率过高，请稍后重试'
      }
      
      mainWindow.webContents.send('chat-error', errorMsg)
      return { success: false, error: errorMsg }
  }
} 

// Window management
async function createWindow() {
  // Dynamically import the preload script
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const preloadPath = path.join(__dirname, 'preload.cjs')
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,  // 先隐藏，避免白屏
    autoHideMenuBar: true,
    backgroundColor: '#0f0f23',  // 背景色与应用一致
    webPreferences: {
      allowRunningInsecureContent: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      enableRemoteModule: false,
      sandbox: false
    }
  })

  // 窗口准备好后再显示，避免白屏
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  Menu.setApplicationMenu(null)

  console.log("Creating chat window")
  mainWindow.loadFile('chat.html')
 
  // Send initial config to renderer
  mainWindow.webContents.on('did-finish-load', () => {
    // Initialize with cloud model after page loads
    mainWindow.webContents.send('initialize-with-cloud')
  })

  return mainWindow
}

// App lifecycle handlers
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
