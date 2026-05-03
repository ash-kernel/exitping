const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require("electron");
const path = require("path");
const { runSpeedTest } = require("./core/speedtest_engine");

let win = null;
let tray = null;
let isQuitting = false;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

function positionWindow() {
  if (!win) return;
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  const bounds = win.getBounds();

  let x = workArea.x + workArea.width - bounds.width - 12;
  let y = workArea.y + workArea.height - bounds.height - 12;

  if (x < workArea.x) x = workArea.x;
  if (y < workArea.y) y = workArea.y;

  win.setPosition(x, y);
}

function createWindow() {
  win = new BrowserWindow({
    width: 380, 
    height: 600,
    minWidth: 380,
    minHeight: 600,
    frame: false,
    resizable: false,
    alwaysOnTop: true, 
    show: false,
    backgroundColor: "#050505", 
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
    positionWindow();
    if (!process.argv.includes('--hidden')) {
      win.show();
      win.focus();
    }
  });

  win.on("blur", () => {
    if (win) win.hide();
  });

  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
}

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
            positionWindow();
            win.show();
            win.focus();
          }
        }
      },
      {
        label: "RUN TEST",
        click: () => {
          if (win) {
            positionWindow();
            win.show();
            win.focus();
            // This safely triggers the renderer's test function, respecting the UI lock!
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
        positionWindow();
        win.show();
        win.focus(); 
      }
    });
  } catch (err) {
    console.error("Tray error:", err);
    tray = null;
  }
}

app.on("second-instance", () => {
  if (win) {
    positionWindow();
    win.show();
    win.focus();
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
});

// --- BACKEND IPC: NETWORK IDENTITY (CORS BYPASS) ---
const https = require("https");

ipcMain.handle("get-network-identity", async () => {
  return new Promise((resolve) => {
    const req = https.get('https://ipwho.is/', { timeout: 2000 }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          resolve({ 
            ip: json.ip || "0.0.0.0", 
            isp: json.connection?.isp || json.connection?.org || "Network Active", 
            countryCode: json.country_code ? json.country_code.toLowerCase() : "un"
          });
        } catch (e) { 
          resolve({ ip: "Unknown", isp: "Unknown", countryCode: "un" }); 
        }
      });
    });
    
    req.on("error", () => resolve({ ip: "Unknown", isp: "Unknown", countryCode: "un" }));
    req.on("timeout", () => { 
      req.destroy(); 
      resolve({ ip: "Unknown", isp: "Unknown", countryCode: "un" }); 
    });
  });
});

// --- BACKEND IPC: WINDOW CONTROLS (NEW) ---
ipcMain.on("toggle-expand", (event, isExpanded) => {
  if (!win) return;
  const targetWidth = isExpanded ? 760 : 380; // Expand to double width, or collapse to original
  const bounds = win.getBounds();

  // Set the new size, shifting X so it stays anchored to the right side of the screen
  win.setBounds({
    x: bounds.x - (targetWidth - bounds.width), 
    y: bounds.y, 
    width: targetWidth,
    height: bounds.height
  }, true); // The 'true' enables a smooth resize animation where supported
});

// --- BACKEND IPC: SPEEDTEST ---
ipcMain.on("start-speedtest", async (event) => {
  try {
    const finalResult = await runSpeedTest((progressData) => {
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

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});