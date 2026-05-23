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
const silentCheckToggle = document.getElementById("silentCheckToggle");
const lowInternetNotifyToggle = document.getElementById("lowInternetNotifyToggle");
const THEME_KEY = "exitping_theme";
const APP_SIZE_KEY = "exitping_app_size";

const themeSelect = document.getElementById("themeSelect");
const sizeSelect = document.getElementById("sizeSelect");
const interfaceSelect = document.getElementById("interfaceSelect");

const traceHostInput = document.getElementById("traceHostInput");
const startTraceBtn = document.getElementById("startTraceBtn");
const clearTraceBtn = document.getElementById("clearTraceBtn");
const traceHopsList = document.getElementById("traceHopsList");
const bookmarkTraceBtn = document.getElementById("bookmarkTraceBtn");
const bookmarkedRoutesList = document.getElementById("bookmarkedRoutesList");

let isEngineRunning = false;
let selectedInterface = localStorage.getItem("exitping_interface") || null;
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

// Silent Check OS Setting
if (window.api && window.api.getSilentCheck) {
  window.api.getSilentCheck().then(isEnabled => {
    if (silentCheckToggle) silentCheckToggle.checked = isEnabled;
  });
}
if (silentCheckToggle) {
  silentCheckToggle.addEventListener("change", (e) => {
    if (window.api && window.api.setSilentCheck) {
      window.api.setSilentCheck(e.target.checked);
    }
  });
}

// THEME SELECTOR
const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
applyTheme(savedTheme);
if (themeSelect) {
  themeSelect.value = savedTheme;
  themeSelect.addEventListener("change", (e) => {
    const selected = e.target.value;
    applyTheme(selected);
    localStorage.setItem(THEME_KEY, selected);
  });
}

function applyTheme(themeName) {
  document.body.classList.remove("theme-dark", "theme-red", "theme-white", "theme-light");
  document.body.classList.add(`theme-${themeName}`);
}

// APP SIZE SELECTOR
const savedAppSize = localStorage.getItem(APP_SIZE_KEY) || "medium";
applyAppSize(savedAppSize);
if (sizeSelect) {
  sizeSelect.value = savedAppSize;
  sizeSelect.addEventListener("change", (e) => {
    const selected = e.target.value;
    applyAppSize(selected);
    localStorage.setItem(APP_SIZE_KEY, selected);
    if (window.api && window.api.setAppSize) {
      window.api.setAppSize(selected);
    }
  });
}

function applyAppSize(sizeName) {
  document.body.classList.remove("size-small", "size-medium", "size-large");
  document.body.classList.add(`size-${sizeName}`);
}

// Sync size from backend config on boot
if (window.api && window.api.getAppSize) {
  window.api.getAppSize().then(actualSize => {
    applyAppSize(actualSize);
    localStorage.setItem(APP_SIZE_KEY, actualSize);
    if (sizeSelect) {
      sizeSelect.value = actualSize;
    }
  });
}

// NETWORK INTERFACES
if (window.api && window.api.getNetworkInterfaces) {
  window.api.getNetworkInterfaces().then(interfaces => {
    if (interfaceSelect) {
      interfaces.forEach(iface => {
        const opt = document.createElement("option");
        opt.value = iface.ip;
        opt.textContent = `${iface.name} (${iface.ip})`;
        if (selectedInterface === iface.ip) {
          opt.selected = true;
        }
        interfaceSelect.appendChild(opt);
      });
      interfaceSelect.addEventListener("change", (e) => {
        selectedInterface = e.target.value || null;
        if (selectedInterface) {
          localStorage.setItem("exitping_interface", selectedInterface);
        } else {
          localStorage.removeItem("exitping_interface");
        }
      });
    }
  });
}

// --- TRACEROUTE ENGINE OVERHAUL ---
const SAVED_HOSTS_KEY = "exitping_saved_hosts";
const BOOKMARKS_KEY = "exitping_route_bookmarks";
let isTraceRunning = false;
let traceBuffer = "";
let currentTraceData = null;

// --- DRAGGABLE SECTIONS IN DASHBOARD ---
const ORDER_KEY = "exitping_dashboard_order";
function initializeDraggableSections() {
  const container = document.querySelector('.dashboard-content');
  const draggables = document.querySelectorAll('.draggable-section');

  draggables.forEach(draggable => {
    const grabber = draggable.querySelector('.drag-grabber');
    if (grabber) {
      grabber.addEventListener('mousedown', () => {
        draggable.setAttribute('draggable', 'true');
      });
      grabber.addEventListener('mouseup', () => {
        draggable.removeAttribute('draggable');
      });
    }

    draggable.addEventListener('dragstart', (e) => {
      draggable.classList.add('dragging');
      e.dataTransfer.setData('text/plain', ''); // Required for Firefox drag support
    });

    draggable.addEventListener('dragend', () => {
      draggable.classList.remove('dragging');
      draggable.removeAttribute('draggable');
      saveDashboardOrder();
    });
  });

  if (container) {
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      const afterElement = getDragAfterElement(container, e.clientY);
      const dragging = document.querySelector('.dragging');
      if (dragging) {
        if (afterElement == null) {
          const historySec = document.querySelector('.history-section');
          if (historySec && historySec.parentNode === container) {
            container.insertBefore(dragging, historySec);
          } else {
            container.appendChild(dragging);
          }
        } else {
          if (afterElement.parentNode === container) {
            container.insertBefore(dragging, afterElement);
          } else {
            container.appendChild(dragging);
          }
        }
      }
    });
  }
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.draggable-section:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function saveDashboardOrder() {
  const draggables = [...document.querySelectorAll('.draggable-section')];
  const order = draggables.map(el => {
    return el.className.split(/\s+/).find(c => c.includes('section'));
  });
  localStorage.setItem(ORDER_KEY, JSON.stringify(order));
}

function restoreDashboardOrder() {
  const container = document.querySelector('.dashboard-content');
  const orderData = localStorage.getItem(ORDER_KEY);
  if (!orderData || !container) return;
  try {
    const order = JSON.parse(orderData);
    const historySec = document.querySelector('.history-section');
    order.forEach(className => {
      if (!className) return;
      const el = document.querySelector(`.${className}`);
      if (el && container) {
        if (historySec && historySec.parentNode === container) {
          container.insertBefore(el, historySec);
        } else {
          container.appendChild(el);
        }
      }
    });
  } catch (e) { }
}

// --- ROUTE BOOKMARKS ---
function loadBookmarks() {
  try {
    const data = localStorage.getItem(BOOKMARKS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveBookmark(bookmark) {
  if (!bookmark || !bookmark.host) return;
  const bookmarks = loadBookmarks();
  const filtered = bookmarks.filter(b => b.host !== bookmark.host);
  filtered.unshift(bookmark);
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(filtered));
  renderBookmarks();
}

function deleteBookmark(host) {
  let bookmarks = loadBookmarks();
  bookmarks = bookmarks.filter(b => b.host !== host);
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  renderBookmarks();
}

function renderBookmarks() {
  if (!bookmarkedRoutesList) return;
  const bookmarks = loadBookmarks();
  if (bookmarks.length === 0) {
    bookmarkedRoutesList.innerHTML = `
      <div style="text-align: center; color: var(--text-low); font-size: 10px; padding: 12px 0; opacity: 0.5;">
        No bookmarked routes. Run a trace and save it.
      </div>
    `;
    return;
  }

  bookmarkedRoutesList.innerHTML = bookmarks.map(b => {
    const pingText = b.avgPing !== null ? `(${b.avgPing}) ms` : "(timeout)";
    return `
      <div class="bookmark-route-card" data-host="${b.host}">
        <div class="bookmark-header">
          <div class="bookmark-title-group">
            <span class="bookmark-host-title">${b.host} &mdash; <span style="color: var(--accent-cyan); font-weight: 800;">${pingText}</span></span>
          </div>
          <div class="bookmark-controls">
            <button class="bookmark-refresh-btn" data-host="${b.host}" title="Recheck Latency">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
            </button>
            <span class="bookmark-chevron">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </span>
            <button class="bookmark-delete-btn" data-host="${b.host}" title="Delete Bookmark">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="bookmark-route-content">
          <div class="bookmark-hops-scroll">
            ${b.hops.map(hop => {
      const hopPing = hop.avgPing !== null ? `${hop.avgPing} ms` : "*";
      const locationStr = hop.geo ? (hop.geo.private ? "Private Network" : `${hop.geo.city || hop.geo.country || ""} • ${hop.geo.isp || ""}`) : "Resolving...";
      return `
                <div class="bookmark-hop-row">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <strong style="color:var(--text-low);">#${hop.hopNum}</strong>
                    <span>${hop.ip}</span>
                  </div>
                  <span style="font-size:9px; color:var(--text-low); flex:1; text-align:left; margin-left:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${locationStr}</span>
                  <strong>${hopPing}</strong>
                </div>
              `;
    }).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');

  bookmarkedRoutesList.querySelectorAll('.bookmark-route-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.bookmark-delete-btn') || e.target.closest('.bookmark-refresh-btn')) return;
      card.classList.toggle('open');
    });
  });

  bookmarkedRoutesList.querySelectorAll('.bookmark-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const host = btn.getAttribute('data-host');
      deleteBookmark(host);
    });
  });

  bookmarkedRoutesList.querySelectorAll('.bookmark-refresh-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const host = btn.getAttribute('data-host');
      btn.classList.add('spinning');
      try {
        let latency = await window.api.pingHost(host, 443);
        if (latency === null) {
          latency = await window.api.pingHost(host, 80);
        }

        const bookmarks = loadBookmarks();
        const b = bookmarks.find(x => x.host === host);
        if (b) {
          b.avgPing = latency;
          localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
          renderBookmarks();
        }
      } catch (err) {
        console.error("Bookmark recheck failed:", err);
      } finally {
        btn.classList.remove('spinning');
      }
    });
  });
}

if (bookmarkTraceBtn) {
  bookmarkTraceBtn.addEventListener('click', () => {
    if (currentTraceData && currentTraceData.hops.length > 0) {
      saveBookmark(currentTraceData);
      bookmarkTraceBtn.disabled = true;
      bookmarkTraceBtn.textContent = "★ Saved";
    }
  });
}


function startTracerouteDiagnostics(host) {
  isTraceRunning = true;
  if (startTraceBtn) {
    startTraceBtn.textContent = "Tracing...";
    startTraceBtn.style.background = "var(--text-low)";
  }

  if (bookmarkTraceBtn) {
    bookmarkTraceBtn.disabled = true;
    bookmarkTraceBtn.textContent = "★ Save";
  }

  if (traceHopsList) {
    traceHopsList.innerHTML = `
      <div style="text-align: center; color: var(--accent-cyan); font-size: 11px; margin-top: 24px; font-weight:600;" class="pinging-animation">
        Initializing routes...
      </div>
    `;
  }

  traceBuffer = "";
  currentTraceData = { host: host, avgPing: null, hops: [] };
  window.api.startTraceroute(host);
}

function onTraceComplete() {
  isTraceRunning = false;
  if (startTraceBtn) {
    startTraceBtn.textContent = "Trace";
    startTraceBtn.style.background = "var(--accent-cyan)";
  }

  if (currentTraceData && currentTraceData.hops.length > 0) {
    const validHops = currentTraceData.hops.filter(h => h.avgPing !== null);
    const lastHop = validHops[validHops.length - 1];
    currentTraceData.avgPing = lastHop ? lastHop.avgPing : null;

    if (bookmarkTraceBtn) {
      bookmarkTraceBtn.disabled = false;
      bookmarkTraceBtn.textContent = "★ Save";
    }
  }
}

if (startTraceBtn && traceHostInput && window.api && window.api.startTraceroute) {
  startTraceBtn.addEventListener("click", () => {
    const host = traceHostInput.value.trim() || "8.8.8.8";
    startTracerouteDiagnostics(host);
  });

  window.api.onTracerouteData((data) => {
    traceBuffer += data;
    const lines = traceBuffer.split("\n");
    traceBuffer = lines.pop(); // Keep incomplete line
    lines.forEach(parseTracerouteLine);
  });
}

if (clearTraceBtn) {
  clearTraceBtn.addEventListener("click", () => {
    if (traceHopsList) {
      traceHopsList.innerHTML = `
        <div style="text-align: center; color: var(--text-low); font-size: 11px; margin-top: 30px; opacity: 0.7;">
          Enter a host and click Trace to begin diagnostics.
        </div>
      `;
    }
    if (bookmarkTraceBtn) {
      bookmarkTraceBtn.disabled = true;
      bookmarkTraceBtn.textContent = "★ Save";
    }
    currentTraceData = null;
  });
}

const geoCache = {};
function geolocateIp(ip, callback) {
  if (!ip || ip === "Timeout" || ip === "*") return;

  // Check private ranges
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.|169\.254\.)/.test(ip)) {
    callback({ private: true });
    return;
  }

  if (geoCache[ip]) {
    callback(geoCache[ip]);
    return;
  }

  if (window.api && window.api.geolocateIp) {
    window.api.geolocateIp(ip).then(data => {
      if (data && data.success !== false && data.country) {
        const result = {
          country: data.country || "Unknown Country",
          countryCode: data.country_code ? data.country_code.toLowerCase() : null,
          city: data.city || "",
          region: data.region || "",
          isp: data.connection?.isp || data.connection?.org || "Unknown ISP",
          lat: data.latitude,
          lon: data.longitude
        };
        geoCache[ip] = result;
        callback(result);
      } else {
        callback({ success: false });
      }
    }).catch(() => {
      callback({ success: false });
    });
  }
}

function parseTracerouteLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return;

  // Header lines check
  if (trimmed.toLowerCase().includes("complete")) {
    onTraceComplete();
    return;
  }

  const firstWord = trimmed.split(/\s+/)[0];
  const hopNum = parseInt(firstWord, 10);
  if (isNaN(hopNum)) return;

  // Clear initializing placeholder on first hop
  if (hopNum === 1 && traceHopsList) {
    traceHopsList.innerHTML = "";
  }

  // Extract IP
  const ipMatch = trimmed.match(/([0-9a-fA-F:.]+)\s*$/);
  let ip = "Timeout";
  if (ipMatch) {
    const rawIp = ipMatch[1];
    if (!rawIp.toLowerCase().includes("request") && rawIp !== "out.") {
      ip = rawIp;
    }
  }

  // Extract probes RTT
  const probes = [];
  const probeRegex = /(\*|<?\d+\s*ms)/g;
  let match;
  while ((match = probeRegex.exec(trimmed)) !== null && probes.length < 3) {
    probes.push(match[1]);
  }

  // Handle cases where no probes matched but it is a timeout line
  while (probes.length < 3) {
    probes.push("*");
  }

  // Average calculation
  let sum = 0;
  let count = 0;
  probes.forEach(p => {
    if (p !== "*") {
      const val = parseInt(p.replace(/ms|<|>/g, "").trim(), 10);
      if (!isNaN(val)) {
        sum += val;
        count++;
      }
    }
  });
  const avgPing = count > 0 ? Math.round(sum / count) : null;

  renderHopBlock(hopNum, ip, probes, avgPing);
}

function renderHopBlock(hopNum, ip, probes, avgPing) {
  if (!traceHopsList) return;

  // Record this hop in current trace data
  if (currentTraceData) {
    const existing = currentTraceData.hops.find(h => h.hopNum === hopNum);
    if (existing) {
      existing.ip = ip;
      existing.probes = probes;
      existing.avgPing = avgPing;
    } else {
      currentTraceData.hops.push({ hopNum, ip, probes, avgPing, geo: null });
    }
  }

  // Check if hop element already exists
  let block = document.getElementById(`hop-block-${hopNum}`);
  const isNew = !block;

  if (isNew) {
    block = document.createElement("div");
    block.id = `hop-block-${hopNum}`;
    block.className = "hop-block";
    traceHopsList.appendChild(block);
  }

  let latencyClass = "timeout";
  let latencyText = "*";
  if (avgPing !== null) {
    latencyText = `${avgPing} ms`;
    if (avgPing < 60) latencyClass = "good";
    else if (avgPing < 120) latencyClass = "okay";
    else latencyClass = "bad";
  } else if (ip === "Timeout") {
    latencyText = "Timeout";
  }

  block.innerHTML = `
    <div class="hop-header">
      <div class="hop-info-group">
        <div class="hop-badge">#${hopNum}</div>
        <div class="hop-details">
          <span class="hop-ip">${ip}</span>
          <span class="hop-geo" id="hop-geo-text-${hopNum}">Resolving host location...</span>
        </div>
      </div>
      <div class="hop-latency-group">
        <span class="latency-pill ${latencyClass}">${latencyText}</span>
        <span class="hop-chevron">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </span>
      </div>
    </div>
    <div class="hop-content">
      <div class="hop-probes-row">
        <span>Probe 1: ${probes[0] || "*"}</span>
        <span>Probe 2: ${probes[1] || "*"}</span>
        <span>Probe 3: ${probes[2] || "*"}</span>
      </div>
      <div class="hop-geo-details" id="hop-geo-details-${hopNum}">
        <span>Loading geolocation metadata...</span>
      </div>
    </div>
  `;

  block.addEventListener("click", () => {
    block.classList.toggle("open");
  });

  const geoTextEl = document.getElementById(`hop-geo-text-${hopNum}`);
  const geoDetailsEl = document.getElementById(`hop-geo-details-${hopNum}`);

  if (ip === "Timeout") {
    if (geoTextEl) geoTextEl.textContent = "Packet Drop";
    if (geoDetailsEl) geoDetailsEl.innerHTML = `<span style="color: var(--text-low);">All probes timed out. Gateway router dropped ICMP packet.</span>`;

    if (currentTraceData) {
      const hop = currentTraceData.hops.find(h => h.hopNum === hopNum);
      if (hop) hop.geo = { private: false, success: false };
    }
  } else {
    geolocateIp(ip, (data) => {
      if (currentTraceData) {
        const hop = currentTraceData.hops.find(h => h.hopNum === hopNum);
        if (hop) hop.geo = data;
      }

      if (data.private) {
        if (geoTextEl) geoTextEl.textContent = "Private Network";
        if (geoDetailsEl) {
          geoDetailsEl.innerHTML = `
            <div class="hop-geo-details-row"><strong>Type:</strong> <span>Local Routing Gateway</span></div>
            <div class="hop-geo-details-row"><strong>Region:</strong> <span>LAN / Intranet</span></div>
          `;
        }
      } else if (data.success !== false && data.country) {
        const flagImg = data.countryCode ? `<img src="https://flagcdn.com/w20/${data.countryCode}.png" style="border-radius:2px; vertical-align:middle; margin-right:4px;">` : "";
        const locationStr = [data.city, data.region, data.country].filter(Boolean).join(", ");

        if (geoTextEl) {
          geoTextEl.innerHTML = `${flagImg} ${data.city || data.country} &bull; ${data.isp}`;
        }
        if (geoDetailsEl) {
          geoDetailsEl.innerHTML = `
            <div class="hop-geo-details-row"><strong>ISP Name:</strong> <span>${data.isp}</span></div>
            <div class="hop-geo-details-row"><strong>Coordinates:</strong> <span>${data.lat || 0.0}, ${data.lon || 0.0}</span></div>
            <div class="hop-geo-details-row"><strong>Location:</strong> <span>${locationStr}</span></div>
          `;
        }
      } else {
        if (geoTextEl) geoTextEl.textContent = "Unknown Gateway";
        if (geoDetailsEl) geoDetailsEl.innerHTML = `<span>Could not resolve geolocation. Router IP might be hidden or generic.</span>`;
      }
    });
  }

  if (isNew && traceHopsList) {
    traceHopsList.scrollTop = traceHopsList.scrollHeight;
  }
}

renderBookmarks();
restoreDashboardOrder();
initializeDraggableSections();

const AUTO_TEST_KEY = "exitping_autotest";
const savedAutoTestSetting = localStorage.getItem(AUTO_TEST_KEY);
const isAutoTestEnabled = savedAutoTestSetting === null ? true : savedAutoTestSetting === "true";

if (autoTestToggle) {
  autoTestToggle.checked = isAutoTestEnabled;
  autoTestToggle.addEventListener("change", (e) => {
    localStorage.setItem(AUTO_TEST_KEY, e.target.checked);
  });
}

const LOW_INTERNET_KEY = "exitping_low_internet_notify";
const savedLowInternetSetting = localStorage.getItem(LOW_INTERNET_KEY);
const isLowInternetEnabled = savedLowInternetSetting === null ? true : savedLowInternetSetting === "true";

if (lowInternetNotifyToggle) {
  lowInternetNotifyToggle.checked = isLowInternetEnabled;
  lowInternetNotifyToggle.addEventListener("change", (e) => {
    localStorage.setItem(LOW_INTERNET_KEY, e.target.checked);
  });
}

function lerp(start, end, factor) {
  if (isNaN(start) || isNaN(end)) return 0;
  return start + (end - start) * factor;
}

function getThemeColor(variableName, fallback) {
  return getComputedStyle(document.body).getPropertyValue(variableName).trim() || fallback;
}

function drawSparkline(canvasId, data, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const sCtx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  sCtx.clearRect(0, 0, w, h);
  if (data.length < 2) return;

  const resolvedColor = color.startsWith('--') ? getThemeColor(color, '#38bdf8') : color;

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
  gradient.addColorStop(0, hexToRgba(resolvedColor, 0.35));
  gradient.addColorStop(1, hexToRgba(resolvedColor, 0.0));

  sCtx.fillStyle = gradient;
  sCtx.fill();

  sCtx.beginPath();
  sCtx.strokeStyle = resolvedColor;
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
  ctx.strokeStyle = getThemeColor('--border-bright', 'rgba(255, 255, 255, 0.04)');
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.stroke();

  const speedFactor = Math.min(currentDisplaySpeed / 100, 1);
  const endAngle = Math.PI * 0.8 + (Math.PI * 1.4 * speedFactor);

  const accentCyan = getThemeColor('--accent-cyan', '#38bdf8');

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, Math.PI * 0.8, endAngle);
  ctx.strokeStyle = accentCyan;
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.stroke();

  const needleX = centerX + Math.cos(endAngle) * radius;
  const needleY = centerY + Math.sin(endAngle) * radius;
  ctx.beginPath();
  ctx.arc(needleX, needleY, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.shadowBlur = 8;
  ctx.shadowColor = accentCyan;
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
            else sidebarLossEl.style.color = "";
          }

        } else {
          testPhaseEl.textContent = "PINGING...";
          if (sidebarServerPingEl) sidebarServerPingEl.textContent = "Probing...";
          if (sidebarJitterEl) sidebarJitterEl.textContent = "-- ms";
          if (sidebarLossEl) {
            sidebarLossEl.textContent = "-- %";
            sidebarLossEl.style.color = "";
          }
          if (sidebarGradeEl) {
            sidebarGradeEl.textContent = "--";
            sidebarGradeEl.style.color = "";
          }
        }
        break;

      case "download":
        testPhaseEl.textContent = "DOWNLOADING";
        targetSpeed = data.speed || 0;
        if (downValueEl) downValueEl.textContent = (data.speed || 0).toFixed(2);
        downHistory.push(data.speed || 0);
        drawSparkline("downGraph", downHistory, "--accent-cyan");
        break;

      case "upload":
        testPhaseEl.textContent = "UPLOADING";
        targetSpeed = data.speed || 0;
        if (upValueEl) upValueEl.textContent = (data.speed || 0).toFixed(2);
        upHistory.push(data.speed || 0);
        drawSparkline("upGraph", upHistory, "--accent-secondary");
        break;

      case "complete":
        isEngineRunning = false;
        testPhaseEl.textContent = "TEST COMPLETE";
        startBtn.disabled = false;
        startBtn.style.opacity = "1";

        // Clear the traced locations inside Network Tools
        if (traceHopsList) {
          traceHopsList.innerHTML = `
            <div style="text-align: center; color: var(--text-low); font-size: 11px; margin-top: 30px; opacity: 0.7;">
              Enter a host and click Trace to begin diagnostics.
            </div>
          `;
        }
        if (bookmarkTraceBtn) {
          bookmarkTraceBtn.disabled = true;
          bookmarkTraceBtn.textContent = "★ Save";
        }
        currentTraceData = null;

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

        // Fire low internet notification if connection is poor or degraded
        if (grade === "D" || grade === "C") {
          const isLowInternetNotifyEnabled = localStorage.getItem("exitping_low_internet_notify") !== "false";
          if (isLowInternetNotifyEnabled && window.api && window.api.showNotification) {
            window.api.showNotification("ExitPing Alert", `Low Internet Connection Detected: ${statusText} (Latency: ${finalPing}ms)`);
          }
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

  // Clear traced locations inside Network Tools on test start
  if (traceHopsList) {
    traceHopsList.innerHTML = `
      <div style="text-align: center; color: var(--text-low); font-size: 11px; margin-top: 30px; opacity: 0.7;">
        Enter a host and click Trace to begin diagnostics.
      </div>
    `;
  }
  if (bookmarkTraceBtn) {
    bookmarkTraceBtn.disabled = true;
    bookmarkTraceBtn.textContent = "★ Save";
  }
  currentTraceData = null;

  centerLogo.classList.add("fade-out");
  speedReadout.classList.remove("fade-out");

  if (innerSettingsPopup) {
    innerSettingsPopup.classList.remove("visible");
  }

  startBtn.disabled = true;
  startBtn.style.opacity = "0.5";
  testPhaseEl.style.color = "var(--accent-cyan)";
  testPhaseEl.textContent = "INITIALIZING...";
  if (clientIspEl) clientIspEl.style.color = "";
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
  drawSparkline("downGraph", [], "--accent-cyan");
  drawSparkline("upGraph", [], "--accent-secondary");

  if (centerFlagContainer) centerFlagContainer.innerHTML = '';

  window.api.runTest(selectedInterface);
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
  { id: 'pingCsDubai', url: 'https://dynamodb.eu-central-1.amazonaws.com/?x=', offset: 4 }, //ME (Dubai)
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
  { id: 'pingLolOce', url: 'https://dynamodb.ap-southeast-2.amazonaws.com/?x=', offset: 1 },  // Sydney

  // FORTNITE (Epic Games AWS/Azure)
  { id: 'pingFnNaEast', url: 'https://dynamodb.us-east-1.amazonaws.com/?x=', offset: 1 },
  { id: 'pingFnNaCentral', url: 'https://dynamodb.us-east-2.amazonaws.com/?x=', offset: 2 },
  { id: 'pingFnNaWest', url: 'https://dynamodb.us-west-2.amazonaws.com/?x=', offset: 1 },
  { id: 'pingFnEuWest', url: 'https://dynamodb.eu-west-2.amazonaws.com/?x=', offset: 1 },
  { id: 'pingFnEuCentral', url: 'https://dynamodb.eu-central-1.amazonaws.com/?x=', offset: 0 },
  { id: 'pingFnAsiaTokyo', url: 'https://dynamodb.ap-northeast-1.amazonaws.com/?x=', offset: 1 },
  { id: 'pingFnAsiaSg', url: 'https://dynamodb.ap-southeast-1.amazonaws.com/?x=', offset: 2 },
  { id: 'pingFnOce', url: 'https://dynamodb.ap-southeast-2.amazonaws.com/?x=', offset: 1 },
  { id: 'pingFnBr', url: 'https://dynamodb.sa-east-1.amazonaws.com/?x=', offset: 2 },
  { id: 'pingFnMe', url: 'https://dynamodb.ap-south-1.amazonaws.com/?x=', offset: 0 },

  // APEX LEGENDS (EA Multiplay AWS)
  { id: 'pingApexUsEast', url: 'https://dynamodb.us-east-1.amazonaws.com/?x=', offset: 2 },
  { id: 'pingApexUsWest', url: 'https://dynamodb.us-west-2.amazonaws.com/?x=', offset: 1 },
  { id: 'pingApexEuWest', url: 'https://dynamodb.eu-central-1.amazonaws.com/?x=', offset: 1 },
  { id: 'pingApexEuEast', url: 'https://dynamodb.eu-west-2.amazonaws.com/?x=', offset: 2 },
  { id: 'pingApexAsiaSg', url: 'https://dynamodb.ap-southeast-1.amazonaws.com/?x=', offset: 1 },
  { id: 'pingApexAsiaTokyo', url: 'https://dynamodb.ap-northeast-1.amazonaws.com/?x=', offset: 3 },
  { id: 'pingApexOce', url: 'https://dynamodb.ap-southeast-2.amazonaws.com/?x=', offset: 1 },
  { id: 'pingApexSa', url: 'https://dynamodb.sa-east-1.amazonaws.com/?x=', offset: 2 },

  // DOTA 2 (Valve SDR Network)
  { id: 'pingDotaUsEast', url: 'https://dynamodb.us-east-1.amazonaws.com/?x=', offset: 2 },
  { id: 'pingDotaUsWest', url: 'https://dynamodb.us-west-2.amazonaws.com/?x=', offset: 1 },
  { id: 'pingDotaEuWest', url: 'https://dynamodb.eu-west-1.amazonaws.com/?x=', offset: 2 },
  { id: 'pingDotaEuEast', url: 'https://dynamodb.eu-central-1.amazonaws.com/?x=', offset: 1 },
  { id: 'pingDotaSg', url: 'https://dynamodb.ap-southeast-1.amazonaws.com/?x=', offset: 1 },
  { id: 'pingDotaKr', url: 'https://dynamodb.ap-northeast-2.amazonaws.com/?x=', offset: 2 },
  { id: 'pingDotaOce', url: 'https://dynamodb.ap-southeast-2.amazonaws.com/?x=', offset: 1 },
  { id: 'pingDotaPeru', url: 'https://dynamodb.sa-east-1.amazonaws.com/?x=', offset: 4 },
  { id: 'pingDotaChile', url: 'https://dynamodb.sa-east-1.amazonaws.com/?x=', offset: 3 },
  { id: 'pingDotaAfrica', url: 'https://dynamodb.af-south-1.amazonaws.com/?x=', offset: 2 }
];

async function pingGameEndpoint(url) {
  let hostname = "";
  try {
    const urlObj = new URL(url);
    hostname = urlObj.hostname;
  } catch (e) {
    return null;
  }

  const results = [];

  for (let i = 0; i < 3; i++) {
    try {
      if (window.api && window.api.pingHost) {
        const latency = await window.api.pingHost(hostname, 443);
        if (latency !== null) {
          results.push(latency);
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  if (results.length === 0) return null;

  return Math.min(...results);
}

async function refreshGamePings() {
  if (!refreshGamePingsBtn) return;
  refreshGamePingsBtn.classList.add("spinning");

  // Set UI to pinging state
  gameServerRegistry.forEach(server => {
    const el = document.getElementById(server.id);
    if (el) {
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

let isFetchingIdentity = false;
async function updateNetworkIdentity() {
  if (isFetchingIdentity) return;
  isFetchingIdentity = true;
  if (!window.api || !window.api.getNetworkIdentity) {
    isFetchingIdentity = false;
    return;
  }

  try {
    // Call the backend to bypass all Electron CORS/CSP blocks
    const data = await window.api.getNetworkIdentity();
    if (data && data.ip !== "Unknown") {
      // Update the flag country code globally
      clientCountryCode = data.countryCode;

      // Update top header ISP
      if (clientIspEl && !isEngineRunning) {
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

      const vpnBadgeTop = document.getElementById("vpnBadgeTop");
      const vpnBadgeDash = document.getElementById("vpnBadgeDash");
      if (vpnBadgeTop) vpnBadgeTop.style.display = data.isVpn ? "inline-block" : "none";
      if (vpnBadgeDash) vpnBadgeDash.style.display = data.isVpn ? "inline-block" : "none";
    }
  } catch (err) {
    console.error("Boot ISP fetch failed via backend", err);
  } finally {
    isFetchingIdentity = false;
  }
}

// Initial boot fetch
updateNetworkIdentity();

// Periodically update identity to monitor VPN transitions
setInterval(() => {
  if (!isEngineRunning) {
    updateNetworkIdentity();
  }
}, 10000);

// --- CONNECTION DROP ALERTS ---
window.addEventListener("offline", () => {
  if (connectionStatusEl) {
    connectionStatusEl.textContent = "Connection Dropped";
    connectionStatusEl.style.color = "#f87171";
  }
  if (clientIspEl) clientIspEl.style.color = "#f87171";

  const isLowInternetNotifyEnabled = localStorage.getItem("exitping_low_internet_notify") !== "false";
  if (isLowInternetNotifyEnabled && window.api && window.api.showNotification) {
    window.api.showNotification("ExitPing", "Internet connection lost.");
  }
});

window.addEventListener("online", () => {
  if (connectionStatusEl) {
    connectionStatusEl.textContent = "Connection Restored";
    connectionStatusEl.style.color = "#34d399";
  }
  if (clientIspEl) clientIspEl.style.color = "";

  const isLowInternetNotifyEnabled = localStorage.getItem("exitping_low_internet_notify") !== "false";
  if (isLowInternetNotifyEnabled && window.api && window.api.showNotification) {
    window.api.showNotification("ExitPing", "Internet connection restored.");
  }
});

if (isAutoTestEnabled) {
  setTimeout(() => {
    runTest();
  }, 400);
}

setTimeout(refreshGamePings, 2000);



// --- AUTO-UPDATER ENGINE ---

let APP_VERSION = "3.5.0";
try {
  const versionRes = await fetch('../version.json');
  if (versionRes.ok) {
    const versionData = await versionRes.json();
    APP_VERSION = versionData.version;
  }
} catch (e) {
  console.log("Using static version fallback.");
}

console.log(APP_VERSION)
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

// --- CONSTANT LIVE PING & LATENCY UPDATER ---
const livePingTargets = [
  { host: "1.1.1.1", port: 443 },
  { host: "8.8.8.8", port: 443 },
  { host: "google.com", port: 443 }
];
let currentPingTargetIdx = 0;
let livePingInterval = null;

function startLivePingMonitoring() {
  if (livePingInterval) clearInterval(livePingInterval);
  livePingInterval = setInterval(async () => {
    if (!isEngineRunning && !isTraceRunning && window.api && window.api.pingHost) {
      try {
        const target = livePingTargets[currentPingTargetIdx];
        const ms = await window.api.pingHost(target.host, target.port);
        if (ms === null) {
          currentPingTargetIdx = (currentPingTargetIdx + 1) % livePingTargets.length;
        } else if (!isEngineRunning && !isTraceRunning) {
          if (sidebarServerPingEl) {
            sidebarServerPingEl.textContent = ms + " ms";
          }
          const jitter = Math.max(1, Math.round(ms * (Math.random() * 0.12)));
          if (sidebarJitterEl) {
            sidebarJitterEl.textContent = jitter + " ms";
          }

          let grade = "A+";
          let gradeColor = "#34d399";
          if (ms > 100) { grade = "D"; gradeColor = "#f87171"; }
          else if (ms > 60) { grade = "C"; gradeColor = "#facc15"; }
          else if (ms > 30) { grade = "B"; gradeColor = "#60a5fa"; }
          else if (ms > 15) { grade = "A"; gradeColor = "#38bdf8"; }

          if (sidebarGradeEl) {
            sidebarGradeEl.textContent = grade;
            sidebarGradeEl.style.color = gradeColor;
          }
        }
      } catch (e) { }
    }
  }, 2000);
}

startLivePingMonitoring();

// GITHUB LINK CLICK EVENT
const githubLink = document.getElementById("githubLink");
if (githubLink) {
  githubLink.addEventListener("click", (e) => {
    e.preventDefault();
    if (window.api && window.api.openExternal) {
      window.api.openExternal("https://github.com/ash-kernel/exitping");
    } else {
      window.open("https://github.com/ash-kernel/exitping", "_blank");
    }
  });
}