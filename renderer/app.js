/**
 * EXITPING - RENDERER CORE
 */

// --- DOM Selectors ---
const centerFlagContainer = document.getElementById("serverFlag");
const mainSpeedEl = document.getElementById("mainSpeed");
const testPhaseEl = document.getElementById("testPhase");
const startBtn = document.getElementById("startBtn");
const clientIspEl = document.getElementById("clientIsp");
const clientIpEl = document.getElementById("clientIp");
const serverNameEl = document.getElementById("serverName");
const downValueEl = document.getElementById("downValue");
const upValueEl = document.getElementById("upValue");

const centerLogo = document.getElementById("centerLogo");
const speedReadout = document.getElementById("speedReadout");

// Settings Selectors
const settingsTrigger = document.getElementById("settingsTrigger");
const settingsPanel = document.getElementById("settingsPanel");
const startupToggle = document.getElementById("startupToggle");
const autoTestToggle = document.getElementById("autoTestToggle");

// --- Animation & Data State ---
let isEngineRunning = false; // <-- THE MASTER LOCK
let targetSpeed = 0;
let currentDisplaySpeed = 0;
let downHistory = [];
let upHistory = [];

const dialCanvas = document.getElementById("speedDial");
const ctx = dialCanvas.getContext("2d");

// --- Settings Overlay Logic ---
settingsTrigger.addEventListener("click", (e) => {
  e.stopPropagation(); 
  settingsPanel.classList.toggle("visible");
});

document.addEventListener("click", (event) => {
  if (!settingsTrigger.contains(event.target) && !settingsPanel.contains(event.target)) {
    settingsPanel.classList.remove("visible");
  }
});

// 1. OS Startup Toggle 
if (window.api && window.api.getAutoLaunch) {
  window.api.getAutoLaunch().then(isAutoLaunch => {
    startupToggle.checked = isAutoLaunch;
  });
}
startupToggle.addEventListener("change", (e) => {
  if (window.api && window.api.setAutoLaunch) {
    window.api.setAutoLaunch(e.target.checked);
  }
});

// 2. Auto-Test Toggle
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
        if (clientIpEl) clientIpEl.textContent = data.ip || "0.0.0.0";
        break;

      case "server-selected":
        if (serverNameEl) serverNameEl.textContent = data.serverName;
        const codeMap = { "maa": "in", "sin": "sg", "fra": "de" };
        const code = codeMap[data.id] || "un";
        if (centerFlagContainer) {
          centerFlagContainer.innerHTML = `<img src="https://flagcdn.com/w80/${code}.png">`;
        }
        break;

      case "ping":
        testPhaseEl.textContent = data.status === "done" ? `Latency: ${data.value}ms` : "Pinging...";
        break;

      case "download":
        testPhaseEl.textContent = "Downloading";
        targetSpeed = data.speed || 0;
        if (downValueEl) downValueEl.textContent = (data.speed || 0).toFixed(2);
        downHistory.push(data.speed || 0);
        drawSparkline("downGraph", downHistory, "#38bdf8");
        break;

      case "upload":
        testPhaseEl.textContent = "Uploading";
        targetSpeed = data.speed || 0;
        if (upValueEl) upValueEl.textContent = (data.speed || 0).toFixed(2);
        upHistory.push(data.speed || 0);
        drawSparkline("upGraph", upHistory, "#34d399");
        break;

      case "complete":
        isEngineRunning = false; // RELEASE THE LOCK
        testPhaseEl.textContent = "TEST COMPLETE";
        startBtn.disabled = false;
        startBtn.style.opacity = "1";
        break;

      case "error":
        isEngineRunning = false; // RELEASE THE LOCK
        testPhaseEl.textContent = "Engine Timed Out";
        testPhaseEl.style.color = "#f87171";
        startBtn.disabled = false;
        startBtn.style.opacity = "1";
        break;
    }
  });
}

function runTest() {
  if (isEngineRunning) return; // SILENTLY ABORT IF ALREADY RUNNING
  isEngineRunning = true;      // ENGAGE THE LOCK

  centerLogo.classList.add("fade-out");
  speedReadout.classList.remove("fade-out");
  settingsPanel.classList.remove("visible"); 

  startBtn.disabled = true;
  startBtn.style.opacity = "0.5";
  testPhaseEl.style.color = "var(--accent-cyan)";
  testPhaseEl.textContent = "INITIALIZING...";
  
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

startBtn.addEventListener("click", runTest);
updateDial();

// --- BOOT SEQUENCE & ISP DETECTION ---

async function fetchIdentityOnBoot() {
  try {
    // Switching to ipwho.is - it is much friendlier to Electron and won't block the request
    const res = await fetch("https://ipwho.is/");
    const data = await res.json();
    
    // Updates UI instantly without waiting for the speed test engine
    if (clientIspEl && data.connection && data.connection.isp) {
      clientIspEl.textContent = data.connection.isp;
    }
    if (clientIpEl && data.ip) {
      clientIpEl.textContent = data.ip;
    }
  } catch (err) {
    console.error("Boot ISP fetch failed", err);
    if (clientIspEl) clientIspEl.textContent = "Network Active";
    if (clientIpEl) clientIpEl.textContent = "Ready";
  }
}

// Fire the fetch immediately
fetchIdentityOnBoot();

// Run the auto-test if enabled
if (isAutoTestEnabled) {
  setTimeout(() => {
    runTest();
  }, 400);
}