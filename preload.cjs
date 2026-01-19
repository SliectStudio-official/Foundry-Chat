const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script starting...');
console.log('Current directory:', __dirname);
console.log('Module paths:', module.paths);
console.log('contextBridge available:', !!contextBridge);
console.log('ipcRenderer available:', !!ipcRenderer);

try {
    console.log('Electron modules loaded');
   
    contextBridge.exposeInMainWorld('versions', {
        node: () => process.versions.node,
        chrome: () => process.versions.chrome,
        electron: () => process.versions.electron
    })

    console.log('Versions bridge exposed');

    contextBridge.exposeInMainWorld('mainAPI', {
        sendMessage: (messages) => ipcRenderer.invoke('send-message', messages),
        abortChat: () => ipcRenderer.invoke('abort-chat'),
        onChatChunk: (callback) => ipcRenderer.on('chat-chunk', (_, chunk) => callback(chunk)),
        onChatComplete: (callback) => ipcRenderer.on('chat-complete', () => callback()),
        onChatError: (callback) => ipcRenderer.on('chat-error', (_, error) => callback(error)),
        onChatWarning: (callback) => ipcRenderer.on('chat-warning', (_, warning) => callback(warning)),
        onChatAborted: (callback) => ipcRenderer.on('chat-aborted', () => callback()),
        removeAllChatListeners: () => {
            ipcRenderer.removeAllListeners('chat-chunk');
            ipcRenderer.removeAllListeners('chat-complete');
            ipcRenderer.removeAllListeners('chat-error');
            ipcRenderer.removeAllListeners('chat-warning');
            ipcRenderer.removeAllListeners('chat-aborted');
        },
        getLocalModels: () => ipcRenderer.invoke('get-local-models'),
        switchModel: (modelId) => ipcRenderer.invoke('switch-model', modelId),
        onInitializeWithCloud: (callback) => ipcRenderer.on('initialize-with-cloud', () => callback()),
        // 云端 API 配置
        saveCloudConfig: (config) => ipcRenderer.invoke('save-cloud-config', config),
        getCloudConfig: () => ipcRenderer.invoke('get-cloud-config')
    })

    console.log('mainAPI bridge exposed');
    console.log('Preload script completed successfully');
} catch (error) {
    console.error('Error in preload script:', error);
    console.error('Error stack:', error.stack);
}