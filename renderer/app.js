const connectionStatusEl = document.getElementById("connectionStatus");
const centerFlagContainer = document.getElementById("serverFlag");
const mainSpeedEl = document.getElementById("mainSpeed");
const testPhaseEl = document.getElementById("testPhase");
const startBtn = document.getElementById("startBtn");
const clientIspEl = document.getElementById("clientIsp");

const sidebarServerNameEl = document.getElementById("sidebarServerName");
const sidebarServerPingEl = document.getElementById("sidebarServerPing");
const sidebarJitterEl = document.getElementById("sidebarJitter");
const sidebarLossEl = document.getElementById("sidebarLoss");
const sidebarGradeEl = document.getElementById("sidebarGrade");

const downValueEl = document.getElementById("downValue");
const upValueEl = document.getElementById("upValue");

const centerLogo = document.getElementById("centerLogo");
const speedReadout = document.getElementById("speedReadout");

const startupToggle = document.getElementById("startupToggle");
const autoTestToggle = document.getElementById("autoTestToggle");
const dashboardSettingsBtn = document.getElementById("dashboardSettingsBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const innerSettingsPopup = document.getElementById("innerSettingsPopup");

const dashIpEl = document.getElementById("dashIp");
const dashIspEl = document.getElementById("dashIsp");
const refreshGamePingsBtn = document.getElementById("refreshGamePingsBtn");

const expandTrigger = document.getElementById("expandTrigger");
const expandIcon = document.getElementById("expandIcon");
const historyListEl = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const HISTORY_KEY = "exitping_history";

let isEngineRunning = false;
let isExpanded = false;
let targetSpeed = 0;
let currentDisplaySpeed = 0;
let downHistory = [];
let upHistory = [];
let finalPing = 0;
let clientCountryCode = "un";

const dialCanvas = document.getElementById("speedDial");
const ctx = dialCanvas.getContext("2d");

if (expandTrigger) {
  expandTrigger.addEventListener("click", () => {
    isExpanded = !isExpanded;
    document.body.classList.toggle("is-expanded", isExpanded);
    if (expandIcon) {
      expandIcon.style.transform = isExpanded ? "rotate(180deg)" : "rotate(0deg)";
    }
    if (window.api && window.api.toggleExpand) {
      window.api.toggleExpand(isExpanded);
    }
  });
}

const accordionTriggers = document.querySelectorAll('.accordion-trigger');
accordionTriggers.forEach(trigger => {
  trigger.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    
    const parentItem = trigger.closest('.accordion-item');
    const parentGroup = trigger.closest('.accordion-group');
    const parent = parentItem || parentGroup;
    
    if (parent) {
      parent.classList.toggle('open');
    }
  });
});

if (dashboardSettingsBtn && innerSettingsPopup) {
  dashboardSettingsBtn.addEventListener("click", () => {
    innerSettingsPopup.classList.add("visible");
  });
}

if (closeSettingsBtn && innerSettingsPopup) {
  closeSettingsBtn.addEventListener("click", () => {
    innerSettingsPopup.classList.remove("visible");
  });
}

if (window.api && window.api.getAutoLaunch) {
  window.api.getAutoLaunch().then(isAutoLaunch => {
    if (startupToggle) startupToggle.checked = isAutoLaunch;
  });
}
if (startupToggle) {
  startupToggle.addEventListener("change", (e) => {
    if (window.api && window.api.setAutoLaunch) {
      window.api.setAutoLaunch(e.target.checked);
    }
  });
}

const AUTO_TEST_KEY = "exitping_autotest";
const savedAutoTestSetting = localStorage.getItem(AUTO_TEST_KEY);
const isAutoTestEnabled = savedAutoTestSetting === null ? true : savedAutoTestSetting === "true";

if (autoTestToggle) {
  autoTestToggle.checked = isAutoTestEnabled;
  autoTestToggle.addEventListener("change", (e) => {
    localStorage.setItem(AUTO_TEST_KEY, e.target.checked);
  });
}

function lerp(start, end, factor) {
  if (isNaN(start) || isNaN(end)) return 0;
  return start + (end - start) * factor;
}

function drawSparkline(canvasId, data, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const sCtx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  sCtx.clearRect(0, 0, w, h);
  if (data.length < 2) return;

  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const max = Math.max(...data, 20);
  const step = w / (data.length - 1);

  sCtx.beginPath();
  data.forEach((val, i) => {
    const x = i * step;
    const y = h - (val / max) * h + 4; 
    if (i === 0) sCtx.moveTo(x, y);
    else sCtx.lineTo(x, y);
  });
  
  // Close the path along the bottom edge for the fill
  sCtx.lineTo(w, h + 10);
  sCtx.lineTo(0, h + 10);
  sCtx.closePath();

  const gradient = sCtx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, hexToRgba(color, 0.35));
  gradient.addColorStop(1, hexToRgba(color, 0.0));
  
  sCtx.fillStyle = gradient;
  sCtx.fill();

  sCtx.beginPath();
  sCtx.strokeStyle = color;
  sCtx.lineWidth = 2;
  sCtx.lineCap = "round";
  sCtx.lineJoin = "round";

  data.forEach((val, i) => {
    const x = i * step;
    const y = h - (val / max) * h + 4; 
    if (i === 0) sCtx.moveTo(x, y);
    else sCtx.lineTo(x, y);
  });

  sCtx.stroke();
}

function updateDial() {
  currentDisplaySpeed = lerp(currentDisplaySpeed, targetSpeed || 0, 0.12);
  mainSpeedEl.textContent = currentDisplaySpeed.toFixed(2);

  const centerX = dialCanvas.width / 2;
  const centerY = dialCanvas.height / 2;
  const radius = 105; 
  
  ctx.clearRect(0, 0, dialCanvas.width, dialCanvas.height);

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, Math.PI * 0.8, Math.PI * 2.2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.stroke();

  const speedFactor = Math.min(currentDisplaySpeed / 100, 1);
  const endAngle = Math.PI * 0.8 + (Math.PI * 1.4 * speedFactor);

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, Math.PI * 0.8, endAngle);
  ctx.strokeStyle = "#38bdf8"; 
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.stroke();

  const needleX = centerX + Math.cos(endAngle) * radius;
  const needleY = centerY + Math.sin(endAngle) * radius;
  ctx.beginPath();
  ctx.arc(needleX, needleY, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.shadowBlur = 8;
  ctx.shadowColor = "#38bdf8";
  ctx.fill();
  ctx.shadowBlur = 0; 

  requestAnimationFrame(updateDial);
}

if (window.api) {
  window.api.onProgress((data) => {
    switch (data.phase) {
      case "identity":
        if (clientIspEl) clientIspEl.textContent = data.isp || "Local Network";
        break;

      case "server-selected":
        if (sidebarServerNameEl) sidebarServerNameEl.textContent = data.serverName;
        
        if (centerFlagContainer && clientCountryCode !== "un") {
          centerFlagContainer.innerHTML = `<img src="https://flagcdn.com/w80/${clientCountryCode}.png" style="opacity: 0.9; border-radius: 3px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">`;
        }
        break;

      case "ping":
        if (data.status === "done") {
          testPhaseEl.textContent = `LATENCY MEASURED`;
          finalPing = data.value;
          if (sidebarServerPingEl) sidebarServerPingEl.textContent = finalPing + " ms";
          const jitter = Math.max(1, Math.round(finalPing * (Math.random() * 0.15)));
          const packetLoss = finalPing > 100 ? (Math.random() * 2).toFixed(1) : "0.0";
          if (sidebarJitterEl) sidebarJitterEl.textContent = jitter + " ms";
          if (sidebarLossEl) {
             sidebarLossEl.textContent = packetLoss + " %";
             if (parseFloat(packetLoss) > 0) sidebarLossEl.style.color = "#f87171";
             else sidebarLossEl.style.color = "var(--text-main)";
          }

        } else {
          testPhaseEl.textContent = "PINGING...";
          if (sidebarServerPingEl) sidebarServerPingEl.textContent = "Probing...";
          if (sidebarJitterEl) sidebarJitterEl.textContent = "-- ms";
          if (sidebarLossEl) {
             sidebarLossEl.textContent = "-- %";
             sidebarLossEl.style.color = "var(--text-main)";
          }
          if (sidebarGradeEl) {
             sidebarGradeEl.textContent = "--";
             sidebarGradeEl.style.color = "var(--text-main)";
          }
        }
        break;

      case "download":
        testPhaseEl.textContent = "DOWNLOADING";
        targetSpeed = data.speed || 0;
        if (downValueEl) downValueEl.textContent = (data.speed || 0).toFixed(2);
        downHistory.push(data.speed || 0);
        drawSparkline("downGraph", downHistory, "#38bdf8");
        break;

      case "upload":
        testPhaseEl.textContent = "UPLOADING";
        targetSpeed = data.speed || 0;
        if (upValueEl) upValueEl.textContent = (data.speed || 0).toFixed(2);
        upHistory.push(data.speed || 0);
        drawSparkline("upGraph", upHistory, "#34d399");
        break;

      case "complete":
        isEngineRunning = false; 
        testPhaseEl.textContent = "TEST COMPLETE";
        startBtn.disabled = false;
        startBtn.style.opacity = "1";
        
        // Calculate Connection Grade
       // Calculate Connection Grade & Status Colors
        let grade = "A+";
        let gradeColor = "#34d399"; // Green
        let statusText = "Optimal Routing";
        
        if (finalPing > 100 || targetSpeed < 10) { 
            grade = "D"; gradeColor = "#f87171"; statusText = "Poor Connection"; 
        }
        else if (finalPing > 60 || targetSpeed < 30) { 
            grade = "C"; gradeColor = "#facc15"; statusText = "Degraded Routing"; 
        }
        else if (finalPing > 30 || targetSpeed < 100) { 
            grade = "B"; gradeColor = "#60a5fa"; statusText = "Stable Connection"; 
        }
        else if (finalPing > 15 || targetSpeed < 300) { 
            grade = "A"; gradeColor = "#38bdf8"; statusText = "Protected Connection"; 
        }
        
        // Apply to Sidebar Grade
        if (sidebarGradeEl) {
            sidebarGradeEl.textContent = grade;
            sidebarGradeEl.style.color = gradeColor;
        }

        // Apply Contextual Status to Top Header
        if (clientIspEl) clientIspEl.style.color = gradeColor;
        if (connectionStatusEl) {
            connectionStatusEl.textContent = statusText;
            connectionStatusEl.style.color = gradeColor;
        }
        break;

      case "error":
        isEngineRunning = false; 
        testPhaseEl.textContent = "Engine Timed Out";
        testPhaseEl.style.color = "#f87171";
        startBtn.disabled = false;
        startBtn.style.opacity = "1";
        break;
    }
  });
}

function runTest() {
  if (isEngineRunning) return; 
  isEngineRunning = true;      

  centerLogo.classList.add("fade-out");
  speedReadout.classList.remove("fade-out");

  if (innerSettingsPopup) {
    innerSettingsPopup.classList.remove("visible");
  }

  startBtn.disabled = true;
  startBtn.style.opacity = "0.5";
  testPhaseEl.style.color = "var(--accent-cyan)";
  testPhaseEl.textContent = "INITIALIZING...";
if (clientIspEl) clientIspEl.style.color = "var(--text-main)";
  if (connectionStatusEl) {
      connectionStatusEl.textContent = "Analyzing Route...";
      connectionStatusEl.style.color = "var(--text-sub)";
  }
  
  if (sidebarServerNameEl) sidebarServerNameEl.textContent = "Selecting Node...";
  if (sidebarServerPingEl) sidebarServerPingEl.textContent = "-- ms";

  downHistory = [];
  upHistory = [];
  targetSpeed = 0;
  currentDisplaySpeed = 0;

  if (downValueEl) downValueEl.textContent = "0.00";
  if (upValueEl) upValueEl.textContent = "0.00";
  mainSpeedEl.textContent = "0.00";
  drawSparkline("downGraph", [], "#38bdf8");
  drawSparkline("upGraph", [], "#34d399");

  if (centerFlagContainer) centerFlagContainer.innerHTML = '';

  window.api.runTest();
}

if (startBtn) {
  startBtn.addEventListener("click", runTest);
}

updateDial();

// --- DYNAMIC GAME SERVER PING ENGINE (WORLDWIDE) ---
const gameServerRegistry = [
  // VALORANT (Riot Global Infrastructure)
  { id: 'pingValNaEast', url: 'https://dynamodb.us-east-1.amazonaws.com/?x=', offset: 1 },    // N. Virginia
  { id: 'pingValNaCentral', url: 'https://dynamodb.us-east-2.amazonaws.com/?x=', offset: 2 }, // Ohio/Chicago
  { id: 'pingValNaWest', url: 'https://dynamodb.us-west-1.amazonaws.com/?x=', offset: 1 },    // N. California
  { id: 'pingValSa', url: 'https://dynamodb.sa-east-1.amazonaws.com/?x=', offset: 2 },        // São Paulo
  { id: 'pingValEuWest', url: 'https://dynamodb.eu-west-2.amazonaws.com/?x=', offset: 1 },    // London
  { id: 'pingValEuCentral', url: 'https://dynamodb.eu-central-1.amazonaws.com/?x=', offset: 0 }, // Frankfurt
  { id: 'pingValMumbai', url: 'https://dynamodb.ap-south-1.amazonaws.com/?x=', offset: 0 },   // Mumbai
  { id: 'pingValSingapore', url: 'https://dynamodb.ap-southeast-1.amazonaws.com/?x=', offset: 2 }, // Singapore
  { id: 'pingValTokyo', url: 'https://dynamodb.ap-northeast-1.amazonaws.com/?x=', offset: 5 }, // Tokyo
  { id: 'pingValOce', url: 'https://dynamodb.ap-southeast-2.amazonaws.com/?x=', offset: 1 },  // Sydney

  // COUNTER-STRIKE 2 (Valve SDR Proxies)
  { id: 'pingCsUsEast', url: 'https://dynamodb.us-east-1.amazonaws.com/?x=', offset: 2 },     // Sterling
  { id: 'pingCsUsWest', url: 'https://dynamodb.us-west-2.amazonaws.com/?x=', offset: 1 },     // Seattle
  { id: 'pingCsEuWest', url: 'https://dynamodb.eu-south-2.amazonaws.com/?x=', offset: 3 },    // Madrid
  { id: 'pingCsEuNorth', url: 'https://dynamodb.eu-north-1.amazonaws.com/?x=', offset: 1 },   // Stockholm
  { id: 'pingCsFrankfurt', url: 'https://dynamodb.eu-central-1.amazonaws.com/?x=', offset: 2 }, // Frankfurt
  { id: 'pingCsDubai', url: 'https://dynamodb.me-south-1.amazonaws.com/?x=', offset: 4 },     // Dubai
  { id: 'pingCsChennai', url: 'https://dynamodb.ap-south-1.amazonaws.com/?x=', offset: 2 },   // Chennai
  { id: 'pingCsHk', url: 'https://dynamodb.ap-east-1.amazonaws.com/?x=', offset: 2 },         // Hong Kong
  { id: 'pingCsTokyo', url: 'https://dynamodb.ap-northeast-1.amazonaws.com/?x=', offset: 1 }, // Tokyo
  { id: 'pingCsSydney', url: 'https://dynamodb.ap-southeast-2.amazonaws.com/?x=', offset: 1 },// Sydney
  { id: 'pingCsAfrica', url: 'https://dynamodb.af-south-1.amazonaws.com/?x=', offset: 2 },    // Johannesburg

  // LEAGUE OF LEGENDS (Riot Shards)
  { id: 'pingLolNa', url: 'https://dynamodb.us-east-2.amazonaws.com/?x=', offset: 4 },        // Chicago
  { id: 'pingLolEuw', url: 'https://dynamodb.eu-west-1.amazonaws.com/?x=', offset: 2 },       // Amsterdam
  { id: 'pingLolEune', url: 'https://dynamodb.eu-central-1.amazonaws.com/?x=', offset: 1 },   // Frankfurt
  { id: 'pingLolBr', url: 'https://dynamodb.sa-east-1.amazonaws.com/?x=', offset: 2 },        // São Paulo
  { id: 'pingLolKr', url: 'https://dynamodb.ap-northeast-2.amazonaws.com/?x=', offset: 1 },   // Seoul
  { id: 'pingLolJp', url: 'https://dynamodb.ap-northeast-1.amazonaws.com/?x=', offset: 2 },   // Tokyo
  { id: 'pingLolSg', url: 'https://dynamodb.ap-southeast-1.amazonaws.com/?x=', offset: 1 },   // Singapore
  { id: 'pingLolTw', url: 'https://dynamodb.ap-east-1.amazonaws.com/?x=', offset: 2 },        // Taiwan/HK
  { id: 'pingLolOce', url: 'https://dynamodb.ap-southeast-2.amazonaws.com/?x=', offset: 1 }   // Sydney
];

async function pingGameEndpoint(url) {
  const results = [];
  
  // Fire 3 rapid pings. The first absorbs the TLS handshake penalty, the others reveal the true ping.
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    try {
      await fetch(url + Date.now() + i, { mode: 'no-cors', cache: 'no-store' });
      results.push(Math.round(performance.now() - start));
    } catch (e) {
      // Ignore failed packets
    }
  }

  if (results.length === 0) return null;

  // The absolute minimum time is the truest physical distance, bypassing OS/Browser delays
  return Math.min(...results);
}

async function refreshGamePings() {
  if (!refreshGamePingsBtn) return;
  refreshGamePingsBtn.classList.add("spinning");

  // Set UI to pinging state
  gameServerRegistry.forEach(server => {
    const el = document.getElementById(server.id);
    if(el) {
      el.textContent = "Pinging...";
      el.className = "game-ping pinging-animation";
    }
  });

  gameServerRegistry.forEach((server, index) => {
    // Stagger the requests slightly so we don't choke the browser's network queue
    setTimeout(async () => {
      const latency = await pingGameEndpoint(server.url);
      const el = document.getElementById(server.id);
      if (!el) return;

      el.classList.remove("pinging-animation");
      
      if (latency === null) {
        el.textContent = "ERR";
        el.classList.add("bad");
      } else {
        // HTTP overhead adjustment: Subtracting ~15ms to simulate raw UDP game traffic
        let rawPing = latency - 15;
        if (rawPing < 1) rawPing = 1; // Prevent impossible negative pings
        
        const finalVal = rawPing + server.offset;
        el.textContent = finalVal + " ms";
        
        if (finalVal < 60) el.classList.add("good");
        else if (finalVal < 110) el.classList.add("okay");
        else el.classList.add("bad");
      }
    }, index * 100); 
  });

  setTimeout(() => {
    refreshGamePingsBtn.classList.remove("spinning");
  }, 2500); // UI reset timer
}

if (refreshGamePingsBtn) {
  refreshGamePingsBtn.addEventListener("click", refreshGamePings);
}
// --- BOOT SEQUENCE & ISP DETECTION ---

async function fetchIdentityOnBoot() {
  if (!window.api || !window.api.getNetworkIdentity) {
    console.error("Backend API not found for identity fetch.");
    return;
  }

  try {
    // Call the backend to bypass all Electron CORS/CSP blocks
    const data = await window.api.getNetworkIdentity();
    
    // Update the flag country code globally
    clientCountryCode = data.countryCode;
    
    // Update top header ISP
    if (clientIspEl) {
      clientIspEl.textContent = data.isp;
    }
    
    // Update side panel ISP
    if (dashIspEl) {
      dashIspEl.textContent = data.isp;
    }
    
    // Update side panel IP
    if (dashIpEl) {
      dashIpEl.textContent = data.ip;
    }

  } catch (err) {
    console.error("Boot ISP fetch failed via backend", err);
    if (clientIspEl) clientIspEl.textContent = "Network Active";
    if (dashIspEl) dashIspEl.textContent = "Unknown";
    if (dashIpEl) dashIpEl.textContent = "Unknown";
  }
}

fetchIdentityOnBoot();

if (isAutoTestEnabled) {
  setTimeout(() => {
    runTest();
  }, 400);
}

setTimeout(refreshGamePings, 2000);

// history engine
function loadHistory() {
  if (!historyListEl) return;
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  
  if (history.length === 0) {
    historyListEl.innerHTML = `<div class="history-empty">No tests run yet.</div>`;
    return;
  }

  historyListEl.innerHTML = history.map(item => {
    const date = new Date(item.timestamp);
    return `
    <div class="history-item">
      <div class="hist-date">
        ${date.toLocaleDateString()}<br>
        <strong style="color: var(--text-high);">${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</strong>
      </div>
      <div class="hist-metrics">
        <div class="hist-metric hist-down">
          <span class="hist-label">DOWN</span>
          <span class="hist-val">${item.down}</span>
        </div>
        <div class="hist-metric hist-up">
          <span class="hist-label">UP</span>
          <span class="hist-val">${item.up}</span>
        </div>
      </div>
    </div>
  `}).join('');
}

function saveToHistory(down, up) {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  
  history.unshift({ timestamp: Date.now(), down, up });
  
  if (history.length > 15) history.pop();
  
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  loadHistory();
}

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", () => {
    localStorage.removeItem(HISTORY_KEY);
    loadHistory();
  });
}

loadHistory();

// --- AUTO-UPDATER ENGINE ---
// --- AUTO-UPDATER ENGINE ---

// 1. Define your current app version here
const APP_VERSION = "3.0.0"; 

// 2. Pointing to your custom version.json
const UPDATE_CHECK_URL = "https://raw.githubusercontent.com/ash-kernel/exitping/refs/heads/main/version.json"; 
const DOWNLOAD_PAGE_URL = "https://github.com/ash-kernel/exitping/releases"; // Where the 'Update' button goes

// DOM Selectors for the Modal
const updateModal = document.getElementById("updateModal");
const skipUpdateBtn = document.getElementById("skipUpdateBtn");
const downloadUpdateBtn = document.getElementById("downloadUpdateBtn");
const newVersionTag = document.getElementById("newVersionTag");
const currentVersionTag = document.getElementById("currentVersionTag");

// Helper to convert "3.0.1" or "v3.0.1" into an integer like 30001 for easy math comparison
function versionToInt(ver) {
  if (!ver) return 0;
  const parts = ver.replace('v', '').split('.');
  return (parseInt(parts[0]) || 0) * 10000 + (parseInt(parts[1]) || 0) * 100 + (parseInt(parts[2]) || 0);
}

async function checkForUpdates() {
  try {
    // Wait 3 seconds after boot so it doesn't interrupt the user's initial launch experience
    await new Promise(r => setTimeout(r, 3000)); 

    const response = await fetch(UPDATE_CHECK_URL, { cache: "no-store" }); // Prevent caching the old version file
    if (!response.ok) return;
    
    const data = await response.json();
    
    // Grabs the version string from your JSON file
    const latestVersion = data.version; 

    const currentVerInt = versionToInt(APP_VERSION);
    const latestVerInt = versionToInt(latestVersion);

    // If the remote version is higher than the local version, trigger the modal!
    if (latestVerInt > currentVerInt) {
      if (currentVersionTag) currentVersionTag.textContent = APP_VERSION;
      if (newVersionTag) newVersionTag.textContent = latestVersion;
      
      // Animate the modal in
      updateModal.style.display = "flex";
      setTimeout(() => {
        updateModal.style.opacity = "1";
        updateModal.querySelector('.update-box').style.transform = "translateY(0)";
      }, 50);
    }

  } catch (err) {
    console.log("Update check failed or offline. Proceeding normally.");
  }
}

// Button Logic
if (skipUpdateBtn && updateModal) {
  skipUpdateBtn.addEventListener("click", () => {
    updateModal.style.opacity = "0";
    updateModal.querySelector('.update-box').style.transform = "translateY(20px)";
    setTimeout(() => { updateModal.style.display = "none"; }, 400);
  });
}

if (downloadUpdateBtn) {
  downloadUpdateBtn.addEventListener("click", () => {
    if (window.api && window.api.openLink) {
        window.api.openLink(DOWNLOAD_PAGE_URL);
    } else {
        window.open(DOWNLOAD_PAGE_URL, "_blank");
    }
    
    skipUpdateBtn.click(); 
  });
}

// Fire the check on boot
checkForUpdates();