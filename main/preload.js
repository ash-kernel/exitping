const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  runTest: () => ipcRenderer.send("start-speedtest"),
  
  // Real-time streaming listener
  onProgress: (cb) => {
    ipcRenderer.removeAllListeners("speedtest-progress");
    ipcRenderer.on("speedtest-progress", (_, data) => cb(data));
  },
  
  // Final result listener
  onResult: (cb) => {
    ipcRenderer.removeAllListeners("speed-result");
    ipcRenderer.on("speed-result", (_, data) => cb(data));
  }
});