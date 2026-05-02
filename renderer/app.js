/**
 * EXITPING - RENDERER CORE
 */

// --- DOM Selectors ---
const centerFlagContainer = document.getElementById("serverFlag");
const mainSpeedEl = document.getElementById("mainSpeed");
const testPhaseEl = document.getElementById("testPhase");
const startBtn = document.getElementById("startBtn");
const clientIspEl = document.getElementById("clientIsp");

const sidebarServerNameEl = document.getElementById("sidebarServerName");
const sidebarServerPingEl = document.getElementById("sidebarServerPing");

const downValueEl = document.getElementById("downValue");
const upValueEl = document.getElementById("upValue");

const centerLogo = document.getElementById("centerLogo");
const speedReadout = document.getElementById("speedReadout");

// Settings Selectors
const startupToggle = document.getElementById("startupToggle");
const autoTestToggle = document.getElementById("autoTestToggle");
const dashboardSettingsBtn = document.getElementById("dashboardSettingsBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const innerSettingsPopup = document.getElementById("innerSettingsPopup");

// Dashboard Network Info Selectors
const dashIpEl = document.getElementById("dashIp");
const dashIspEl = document.getElementById("dashIsp");

// Game Ping Selectors
const refreshGamePingsBtn = document.getElementById("refreshGamePingsBtn");

// Expand Selectors
const expandTrigger = document.getElementById("expandTrigger");
const expandIcon = document.getElementById("expandIcon");

// History Selectors
const historyListEl = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const HISTORY_KEY = "exitping_history";

// --- Animation & Data State ---
let isEngineRunning = false; 
let isExpanded = false;      
let targetSpeed = 0;
let currentDisplaySpeed = 0;
let downHistory = [];
let upHistory = [];

// Global variable to store the dynamically detected country code for the flag
let clientCountryCode = "un"; 

const dialCanvas = document.getElementById("speedDial");
const ctx = dialCanvas.getContext("2d");

// --- Window Expand Logic ---
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

// --- ACCORDION LOGIC ---
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

// --- Nested Settings Popup Logic ---
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

// --- OS Settings Logic ---
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

// --- Dial Render Engine ---
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

  sCtx.beginPath();
  sCtx.strokeStyle = color;
  sCtx.lineWidth = 2;
  sCtx.lineCap = "round";
  sCtx.lineJoin = "round";

  const max = Math.max(...data, 20);
  const step = w / (data.length - 1);

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

// --- IPC Communication Logic ---
if (window.api) {
  window.api.onProgress((data) => {
    switch (data.phase) {
      case "identity":
        if (clientIspEl) clientIspEl.textContent = data.isp || "Local Network";
        break;

      case "server-selected":
        if (sidebarServerNameEl) sidebarServerNameEl.textContent = data.serverName;
        
        // Dynamic flag using the corrected Cloudflare country code
        if (centerFlagContainer && clientCountryCode !== "un") {
          centerFlagContainer.innerHTML = `<img src="https://flagcdn.com/w80/${clientCountryCode}.png" style="opacity: 0.9; border-radius: 3px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">`;
        }
        break;

      case "ping":
        if (data.status === "done") {
          testPhaseEl.textContent = `LATENCY MEASURED`;
          if (sidebarServerPingEl) sidebarServerPingEl.textContent = data.value + " ms";
        } else {
          testPhaseEl.textContent = "PINGING...";
          if (sidebarServerPingEl) sidebarServerPingEl.textContent = "Probing...";
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
        
        saveToHistory(downValueEl.textContent, upValueEl.textContent);
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

// --- DYNAMIC GAME SERVER PING ENGINE ---
let isNetworkWarmedUp = false;

const gameServerRegistry = [
  { id: 'pingValMumbai', url: 'https://dynamodb.ap-south-1.amazonaws.com/?x=', offset: 0 },
  { id: 'pingValSingapore', url: 'https://dynamodb.ap-southeast-1.amazonaws.com/?x=', offset: 2 },
  { id: 'pingValTokyo', url: 'https://dynamodb.ap-northeast-1.amazonaws.com/?x=', offset: 5 },
  { id: 'pingCsChennai', url: 'https://dynamodb.ap-south-1.amazonaws.com/?x=', offset: 4 },
  { id: 'pingCsDubai', url: 'https://dynamodb.me-south-1.amazonaws.com/?x=', offset: 8 },
  { id: 'pingCsFrankfurt', url: 'https://dynamodb.eu-central-1.amazonaws.com/?x=', offset: 12 },
  { id: 'pingLolVietnam', url: 'https://dynamodb.ap-southeast-1.amazonaws.com/?x=', offset: 5 },
  { id: 'pingLolPh', url: 'https://dynamodb.ap-southeast-1.amazonaws.com/?x=', offset: 10 },
  { id: 'pingLolSingapore', url: 'https://dynamodb.ap-southeast-1.amazonaws.com/?x=', offset: 1 }
];

async function pingGameEndpoint(url, needsWarmup = false) {
  if (needsWarmup) {
    try { 
      await fetch(url + Math.random(), { mode: 'no-cors', cache: 'no-store' }); 
    } catch (e) {}
  }

  const start = performance.now();
  try {
    await fetch(url + Math.random(), { mode: 'no-cors', cache: 'no-store' });
    return Math.round(performance.now() - start);
  } catch (e) {
    return null;
  }
}

async function refreshGamePings() {
  if (!refreshGamePingsBtn) return;
  refreshGamePingsBtn.classList.add("spinning");

  const runWarmup = !isNetworkWarmedUp;
  isNetworkWarmedUp = true; 

  gameServerRegistry.forEach(server => {
    const el = document.getElementById(server.id);
    if(el) {
      el.textContent = "Pinging...";
      el.className = "game-ping pinging-animation";
    }
  });

  gameServerRegistry.forEach((server, index) => {
    setTimeout(async () => {
      const latency = await pingGameEndpoint(server.url, runWarmup);
      const el = document.getElementById(server.id);
      if (!el) return;

      el.classList.remove("pinging-animation");
      
      if (latency === null) {
        el.textContent = "ERR";
        el.classList.add("bad");
      } else {
        const finalVal = latency + server.offset;
        el.textContent = finalVal + " ms";
        
        if (finalVal < 60) el.classList.add("good");
        else if (finalVal < 110) el.classList.add("okay");
        else el.classList.add("bad");
      }
    }, index * 150); 
  });

  setTimeout(() => {
    refreshGamePingsBtn.classList.remove("spinning");
  }, runWarmup ? 4000 : 2500);
}

if (refreshGamePingsBtn) {
  refreshGamePingsBtn.addEventListener("click", refreshGamePings);
}

// --- BOOT SEQUENCE & ISP DETECTION ---
async function fetchIdentityOnBoot() {
  try {
    const res = await fetch("https://speed.cloudflare.com/meta");
    const data = await res.json();
    
    // THE FIX: Cloudflare returns "country", not "loc"
    if (data.country) {
      clientCountryCode = data.country.toLowerCase();
    }
    
    if (clientIspEl && data.asOrganization) {
      clientIspEl.textContent = data.asOrganization;
    }
    
    if (dashIspEl && data.asOrganization) {
      dashIspEl.textContent = data.asOrganization;
    }
    if (dashIpEl && data.clientIp) {
      dashIpEl.textContent = data.clientIp;
    }

  } catch (err) {
    console.error("Boot ISP fetch failed", err);
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