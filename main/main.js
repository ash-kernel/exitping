const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, Notification, shell } = require("electron");
const path = require("path");
const https = require("https");
const { runSpeedTest } = require("./core/speedtest_engine");
const fs = require("fs");
const os = require("os");
const { spawn, exec } = require("child_process");
const net = require("net");
const dns = require("dns");

let win = null;
let tray = null;
let isQuitting = false;
let isExpandedState = false;

const SIZES = {
  small: { baseWidth: 800, baseHeight: 600, expandedWidth: 800 },
  medium: { baseWidth: 960, baseHeight: 650, expandedWidth: 960 },
  large: { baseWidth: 1160, baseHeight: 760, expandedWidth: 1160 }
};

// Disable Chromium HTTP disk cache in development to prevent index corruption/blockfile critical errors
if (!app.isPackaged) {
  app.commandLine.appendSwitch('disable-http-cache');
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Required for Windows Action Center notifications to show up
app.setAppUserModelId("com.exitping.app");

function positionWindow() {
  // Deprecated: We now center the window natively instead of placing it in the bottom-right corner.
  if (win && !win.isDestroyed()) {
    win.center();
  }
}

function createWindow() {
  const config = getConfig();
  const appSizeKey = config.appSize || "large";
  const size = SIZES[appSizeKey] || SIZES.large;
  const initialWidth = size.baseWidth;
  const initialHeight = size.baseHeight;

  win = new BrowserWindow({
    width: initialWidth, 
    height: initialHeight,
    minWidth: initialWidth,
    minHeight: initialHeight,
    frame: false,
    resizable: false,
    maximizable: false,
    center: true,
    show: false,
    backgroundColor: "#050505", 
    icon: path.join(__dirname, "../assets/icons/sample_logo.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: 'detach' });
  }

  win.once("ready-to-show", () => {
    if (!process.argv.includes('--hidden')) {
      win.show();
      win.focus();
    }
  });

  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
}

// Window Control IPC Handlers
ipcMain.on("minimize-window", () => {
  if (win) win.minimize();
});

ipcMain.on("close-window", () => {
  if (win) {
    // Hide instead of quitting to keep it running in tray
    win.hide();
  }
});

function createTray() {
  try {
    const iconPath = path.join(__dirname, "../assets/icons/tray.png");
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    
    tray = new Tray(trayIcon);
    tray.setToolTip("ExitPing");

    const menu = Menu.buildFromTemplate([
      {
        label: "OPEN",
        click: () => {
          if (win) {
            win.show();
            win.focus();
          }
        }
      },
      {
        label: "RUN TEST",
        click: () => {
          if (win) {
            win.show();
            win.focus();
            win.webContents.executeJavaScript('if (typeof runTest === "function") runTest();');
          }
        }
      },
      {
        label: "RESTART",
        click: () => {
          isQuitting = true;
          app.relaunch();
          app.quit();        
        }
      },
      { type: "separator" },
      {
        label: "QUIT",
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(menu);

    tray.on("click", () => {
      if (!win) return;
      if (win.isVisible()) {
        win.hide();
      } else {
        win.show();
        win.focus(); 
      }
    });
  } catch (err) {
    console.error("Tray error:", err);
    tray = null;
  }
}

// --- SILENT BOOT HEALTH CHECK ---
function performSilentHealthCheck() {
  const start = Date.now();
  
  // Fire a lightweight HEAD request to Cloudflare's edge
  const req = https.request({
    method: 'HEAD',
    hostname: 'cloudflare.com',
    path: '/',
    timeout: 3000
  }, (res) => {
    const latency = Date.now() - start;
    if (Notification.isSupported()) {
      let title = 'ExitPing Status';
      let message = `Network Stable: ${latency}ms`;
      
      if (latency > 100) {
        message = `Network Degraded: ${latency}ms`;
      }

      new Notification({
        title: title,
        body: message,
        icon: path.join(__dirname, "../assets/icons/tray.png"),
        silent: true // Prevents an annoying chime sound on boot
      }).show();
    }
  });

  req.on('error', () => {
    if (Notification.isSupported()) {
      new Notification({
        title: 'ExitPing Status',
        body: 'Network Offline',
        icon: path.join(__dirname, "../assets/icons/tray.png"),
        silent: true
      }).show();
    }
  });

  req.on('timeout', () => req.destroy());
  req.end();
}

app.on("second-instance", () => {
  if (win) {
    win.show();
    win.focus();
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Check if launched at startup AND if the user wants the notification
  if (process.argv.includes('--hidden')) {
    const config = getConfig();
    if (config.silentCheck) {
      performSilentHealthCheck();
    }
  }
});

// --- BACKEND IPC: NETWORK IDENTITY (CORS BYPASS) ---
ipcMain.handle("get-network-identity", async () => {
  return new Promise((resolve) => {
    const req = https.get('https://ipwho.is/', { timeout: 2000 }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          const isVpn = !!(json.security?.proxy || json.security?.vpn || json.security?.anonymous);
          resolve({ 
            ip: json.ip || "0.0.0.0", 
            isp: json.connection?.isp || json.connection?.org || "Network Active", 
            countryCode: json.country_code ? json.country_code.toLowerCase() : "un",
            asn: json.connection?.asn ? `AS${json.connection.asn}` : "Unknown ASN",
            type: json.type || "Unknown",
            isVpn: isVpn
          });
        } catch (e) { 
          resolve({ ip: "Unknown", isp: "Unknown", countryCode: "un", asn: "Unknown", type: "Unknown", isVpn: false }); 
        }
      });
    });
    
    req.on("error", () => resolve({ ip: "Unknown", isp: "Unknown", countryCode: "un", isVpn: false }));
    req.on("timeout", () => { 
      req.destroy(); 
      resolve({ ip: "Unknown", isp: "Unknown", countryCode: "un", isVpn: false }); 
    });
  });
});

// --- BACKEND IPC: WINDOW CONTROLS ---
ipcMain.on("toggle-expand", (event, isExpanded) => {
  isExpandedState = isExpanded;
  if (!win) return;
  
  const config = getConfig();
  const appSizeKey = config.appSize || "large";
  const size = SIZES[appSizeKey] || SIZES.large;
  const targetWidth = isExpanded ? size.expandedWidth : size.baseWidth; 
  const bounds = win.getBounds();

  win.setMinimumSize(size.baseWidth, size.baseHeight);
  win.setBounds({
    x: bounds.x - (targetWidth - bounds.width), 
    y: bounds.y, 
    width: targetWidth,
    height: bounds.height
  }, true); 
});

ipcMain.handle("get-app-size", () => {
  return getConfig().appSize || "large";
});

ipcMain.on("set-app-size", (event, newSizeKey) => {
  const config = getConfig();
  config.appSize = newSizeKey;
  saveConfig(config);

  if (win) {
    const size = SIZES[newSizeKey] || SIZES.large;
    const targetWidth = isExpandedState ? size.expandedWidth : size.baseWidth;
    const targetHeight = size.baseHeight;

    win.setMinimumSize(size.baseWidth, size.baseHeight);
    
    win.setBounds({
      x: win.getBounds().x,
      y: win.getBounds().y,
      width: targetWidth,
      height: targetHeight
    }, true);
    
    win.webContents.send("app-size-changed", newSizeKey);
  }
});

ipcMain.on("open-external", (event, url) => {
  shell.openExternal(url);
});

// --- BACKEND IPC: SYSTEM INFO & TOOLS ---
ipcMain.handle("get-network-interfaces", () => {
  const interfaces = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        results.push({ name, ip: iface.address });
      }
    }
  }
  return results;
});

ipcMain.handle("get-full-network-info", async () => {
  return new Promise((resolve) => {
    const interfaces = os.networkInterfaces();
    let activeIface = null;
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          activeIface = { name, ...iface };
          break;
        }
      }
      if (activeIface) break;
    }
    
    const psCmd = `powershell -Command "Get-WmiObject -Class Win32_NetworkAdapterConfiguration -Filter 'IPEnabled=TRUE' | Select-Object -ExpandProperty DNSServerSearchOrder"`;
    
    exec(psCmd, (error, stdout) => {
      let dnsServers = [];
      if (!error && stdout) {
        dnsServers = stdout.split('\n').map(l => l.trim()).filter(l => l.length > 0 && l.includes('.'));
      }
      
      // Fallback
      if (!dnsServers || dnsServers.length === 0) {
        try { dnsServers = dns.getServers(); } catch(e) {}
      }
      if (!dnsServers || dnsServers.length === 0) {
        dnsServers = ["No DNS"];
      }
      
      resolve({
        interface: activeIface,
        dnsServers: dnsServers
      });
    });
  });
});

ipcMain.handle("geolocate-ip", async (event, ip) => {
  return new Promise((resolve) => {
    const req = https.get(`https://ipwho.is/${ip}`, { timeout: 2500 }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ success: false });
        }
      });
    });
    
    req.on("error", () => resolve({ success: false }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ success: false });
    });
  });
});

ipcMain.handle("ping-host", async (event, hostname, port = 443) => {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = new net.Socket();
    
    socket.setTimeout(1200);
    
    socket.connect(port, hostname, () => {
      const latency = Math.round(performance.now() - start);
      socket.destroy();
      resolve(latency);
    });
    
    socket.on("error", () => {
      socket.destroy();
      resolve(null);
    });
    
    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);
    });
  });
});

let activeTraceroute = null;
ipcMain.on("start-traceroute", (event, targetHost) => {
  if (activeTraceroute) {
    activeTraceroute.kill();
  }

  // Use tracert on Windows. -d avoids resolving IPs to hostnames for faster results.
  // -w 1000 sets timeout to 1 second per hop.
  activeTraceroute = spawn("tracert", ["-d", "-w", "1000", targetHost]);

  activeTraceroute.stdout.on("data", (data) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("traceroute-data", data.toString());
    }
  });

  activeTraceroute.stderr.on("data", (data) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("traceroute-data", `ERROR: ${data.toString()}\n`);
    }
  });

  activeTraceroute.on("close", (code) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("traceroute-data", `\nTraceroute complete (code ${code}).\n`);
    }
    activeTraceroute = null;
  });
});


// --- BACKEND IPC: DNS OPTIMIZER ---
ipcMain.handle("test-dns-servers", async (event) => {
  const dnsServers = [
    { id: 'cloudflare', name: 'Cloudflare', primary: '1.1.1.1', secondary: '1.0.0.1' },
    { id: 'google', name: 'Google Public DNS', primary: '8.8.8.8', secondary: '8.8.4.4' },
    { id: 'quad9', name: 'Quad9', primary: '9.9.9.9', secondary: '149.112.112.112' },
    { id: 'opendns', name: 'OpenDNS', primary: '208.67.222.222', secondary: '208.67.220.220' },
    { id: 'adguard', name: 'AdGuard DNS', primary: '94.140.14.14', secondary: '94.140.15.15' }
  ];

  const { Resolver } = require('dns').promises;

  const pingDns = async (ip) => {
    return new Promise(async (resolve) => {
      const resolver = new Resolver();
      resolver.setServers([ip]);
      
      const start = performance.now();
      
      // Fallback timeout in case resolver hangs
      const timeoutId = setTimeout(() => {
        resolve(null);
      }, 1200);

      try {
        await resolver.resolve4('google.com');
        clearTimeout(timeoutId);
        const latency = Math.round(performance.now() - start);
        resolve(latency);
      } catch (e) {
        clearTimeout(timeoutId);
        resolve(null);
      }
    });
  };

  const results = await Promise.all(dnsServers.map(async (server) => {
    const pPing = await pingDns(server.primary);
    const sPing = await pingDns(server.secondary);
    let avg = null;
    if (pPing !== null && sPing !== null) avg = Math.round((pPing + sPing) / 2);
    else if (pPing !== null) avg = pPing;
    else if (sPing !== null) avg = sPing;
    
    return { ...server, ping: avg };
  }));

  return results.filter(r => r.ping !== null).sort((a, b) => a.ping - b.ping);
});

ipcMain.handle("apply-dns", async (event, primary, secondary) => {
  return new Promise((resolve) => {
    const psScript = `Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | Set-DnsClientServerAddress -ServerAddresses ${primary},${secondary}`;
    const scriptPath = path.join(os.tmpdir(), "exitping_dns.ps1");
    fs.writeFileSync(scriptPath, psScript, 'utf8');
    const cmd = `powershell -Command "Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList '-ExecutionPolicy Bypass -File \\"${scriptPath}\\"'"`;
    exec(cmd, (error) => {
      if (error) resolve({ success: false, error: error.message });
      else resolve({ success: true });
    });
  });
});

ipcMain.handle("reset-dns", async (event) => {
  return new Promise((resolve) => {
    const psScript = `Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | Set-DnsClientServerAddress -ResetServerAddresses`;
    const scriptPath = path.join(os.tmpdir(), "exitping_dns_reset.ps1");
    fs.writeFileSync(scriptPath, psScript, 'utf8');
    const cmd = `powershell -Command "Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList '-ExecutionPolicy Bypass -File \\"${scriptPath}\\"'"`;
    exec(cmd, (error) => {
      if (error) resolve({ success: false, error: error.message });
      else resolve({ success: true });
    });
  });
});

ipcMain.handle("flush-dns", async (event) => {
  return new Promise((resolve) => {
    exec("ipconfig /flushdns", (err, stdout, stderr) => {
      if (err) resolve({ success: false, error: err.message });
      else resolve({ success: true });
    });
  });
});

// --- BACKEND IPC: SPEEDTEST ---
ipcMain.on("start-speedtest", async (event, localAddress) => {
  try {
    const finalResult = await runSpeedTest(localAddress, (progressData) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("speedtest-progress", progressData);
      }
    });
    
    if (win && !win.isDestroyed()) {
      win.webContents.send("speed-result", finalResult);
    }
  } catch (err) {
    console.error("Test failed:", err);
    if (win && !win.isDestroyed()) {
      win.webContents.send("speedtest-progress", { phase: "error", status: "failed" });
    }
  }
});

// --- BACKEND IPC: SETTINGS (OS LEVEL STORAGE) ---
ipcMain.handle("get-autolaunch", () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.on("set-autolaunch", (event, enable) => {
  app.setLoginItemSettings({
    openAtLogin: enable,
    args: ["--hidden"] 
  });
});

ipcMain.on("show-notification", (event, title, body) => {
  if (Notification.isSupported()) {
    new Notification({
      title,
      body,
      icon: path.join(__dirname, "../assets/icons/tray.png"),
      silent: true
    }).show();
  }
});

// --- BACKEND IPC: CONFIG SAVING ---
const configPath = path.join(app.getPath("userData"), "exitping_config.json");

function getConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
  } catch (e) {}
  return { silentCheck: true }; // Default to ON
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config));
  } catch (e) {}
}

ipcMain.handle("get-silent-check", () => {
  return getConfig().silentCheck;
});

ipcMain.on("set-silent-check", (event, enable) => {
  const config = getConfig();
  config.silentCheck = enable;
  saveConfig(config);
});

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });