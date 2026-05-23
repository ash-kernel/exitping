const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Speed Test Engine
  runTest: (localAddress) => ipcRenderer.send("start-speedtest", localAddress),
  
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

  // OS Settings / Autolaunch
  getAutoLaunch: () => ipcRenderer.invoke("get-autolaunch"),
  setAutoLaunch: (enable) => ipcRenderer.send("set-autolaunch", enable),

  // Silent health check settings
  getSilentCheck: () => ipcRenderer.invoke("get-silent-check"),
  setSilentCheck: (enable) => ipcRenderer.send("set-silent-check", enable),

  // Network Identity & Interface Utilities
  getNetworkIdentity: () => ipcRenderer.invoke("get-network-identity"),
  getNetworkInterfaces: () => ipcRenderer.invoke("get-network-interfaces"),

  // Geolocation & Latency Socket Engines
  geolocateIp: (ip) => ipcRenderer.invoke("geolocate-ip", ip),
  pingHost: (hostname, port) => ipcRenderer.invoke("ping-host", hostname, port),

  // Traceroute Diagnostics
  startTraceroute: (targetHost) => ipcRenderer.send("start-traceroute", targetHost),
  onTracerouteData: (cb) => {
    ipcRenderer.removeAllListeners("traceroute-data");
    ipcRenderer.on("traceroute-data", (_, data) => cb(data));
  },

  // Sizing Preferences
  setAppSize: (size) => ipcRenderer.send("set-app-size", size),
  getAppSize: () => ipcRenderer.invoke("get-app-size"),

  // External Links
  openExternal: (url) => ipcRenderer.send("open-external", url),
  openLink: (url) => ipcRenderer.send("open-external", url),

  // Native Notifications
  showNotification: (title, body) => ipcRenderer.send("show-notification", title, body)
});