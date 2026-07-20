const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // LLM Chat
  chatComplete: (params) => ipcRenderer.invoke("chat:complete", params),
  chatStream: (params) => ipcRenderer.invoke("chat:stream", params),
  onStreamChunk: (callback) => {
    const handler = (_event, chunk) => callback(chunk);
    ipcRenderer.on("stream:chunk", handler);
    return () => ipcRenderer.removeListener("stream:chunk", handler);
  },
  onStreamDone: (callback) => {
    const handler = (_event, result) => callback(result);
    ipcRenderer.on("stream:done", handler);
    return () => ipcRenderer.removeListener("stream:done", handler);
  },
  onStreamError: (callback) => {
    const handler = (_event, error) => callback(error);
    ipcRenderer.on("stream:error", handler);
    return () => ipcRenderer.removeListener("stream:error", handler);
  },
  onMenuNewConversation: (callback) => {
    ipcRenderer.on("menu:new-conversation", () => callback());
  },

  // Store
  storeGet: (key) => ipcRenderer.invoke("store:get", key),
  storeSet: (key, value) => ipcRenderer.invoke("store:set", { key, value }),

  // Directory
  selectDirectory: () => ipcRenderer.invoke("dialog:selectDirectory"),

  // File operations (with security validation)
  checkDangerous: (command) => ipcRenderer.invoke("file:checkDangerous", { command }),
  fileList: (baseDir, subPath) => ipcRenderer.invoke("file:list", { baseDir, subPath }),
  fileRead: (baseDir, filePath) => ipcRenderer.invoke("file:read", { baseDir, filePath }),
  fileWrite: (baseDir, filePath, content) => ipcRenderer.invoke("file:write", { baseDir, filePath, content }),
  fileDelete: (baseDir, filePath) => ipcRenderer.invoke("file:delete", { baseDir, filePath }),

  // Notification
  sendNotification: (title, body) => ipcRenderer.invoke("notification:send", { title, body }),
});
