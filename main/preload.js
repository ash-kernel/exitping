const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Speed Test Engine
  runTest: () => ipcRenderer.send("start-speedtest"),
  
  onProgress: (cb) => {
    ipcRenderer.removeAllListeners("speedtest-progress");
    ipcRenderer.on("speedtest-progress", (_, data) => cb(data));
  },
  
  onResult: (cb) => {
    ipcRenderer.removeAllListeners("speed-result");
    ipcRenderer.on("speed-result", (_, data) => cb(data));
  },

  // UI Expansion
  toggleExpand: (isExpanded) => ipcRenderer.send("toggle-expand", isExpanded),

  // OS Settings (Restored!)
  getAutoLaunch: () => ipcRenderer.invoke("get-autolaunch"),
  setAutoLaunch: (enable) => ipcRenderer.send("set-autolaunch", enable)
});