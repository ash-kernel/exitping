const https = require("https");
const { selectBestServer } = require("./server_selector");

// Direct module imports
const pingServer = require("../modules/ping_server");
const downloadTest = require("../modules/download_test");
const uploadTest = require("../modules/upload_test");

/**
 * DYNAMIC IDENTITY DISCOVERY
 */
async function getNetworkIdentity() {
  return new Promise((resolve) => {
    const req = https.get('https://ipwho.is/', { timeout: 2000 }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          resolve({ 
            ip: json.ip || "0.0.0.0", 
            isp: json.connection?.isp || "Local Network", 
            city: json.city || "Unknown",
            countryCode: json.country_code || "US",
            lat: json.latitude || 0,
            lon: json.longitude || 0
          });
        } catch (e) { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

/**
 * THE OOKLA-STYLE DYNAMIC FETCH (STEALTH MODE)
 */
async function fetchDynamicServers() {
  return new Promise((resolve) => {
    // We must mimic a real browser to bypass Ookla's bot-protection
    const options = {
      hostname: 'www.speedtest.net',
      path: '/api/js/servers?engine=js&limit=10',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Referer': 'https://www.speedtest.net/',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 3500
    };

    const req = https.get(options, (res) => {
      // If Ookla blocks us (403 Forbidden), resolve empty to trigger the fallback gracefully
      if (res.statusCode !== 200) {
        resolve([]);
        return;
      }

      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const rawServers = JSON.parse(body);
          
          const formattedServers = rawServers.map(s => {
            const baseUrl = s.url.replace('/upload.php', '').replace('/speedtest/upload.php', '');
            return {
              id: s.id,
              name: `${s.sponsor} - ${s.name}`,
              lat: parseFloat(s.lat),
              lon: parseFloat(s.lon),
              pingHost: s.host,
              downloadUrl: `${baseUrl}/random3500x3500.jpg`, 
              uploadUrl: s.url
            };
          });
          
          resolve(formattedServers);
        } catch (e) { resolve([]); }
      });
    });
    
    req.on("error", () => resolve([]));
    req.on("timeout", () => { req.destroy(); resolve([]); });
  });
}

/**
 * MASTER ORCHESTRATOR
 */
async function runSpeedTest(onProgress = () => {}) {
  try {
    onProgress({ phase: "setup", status: "INITIALIZING..." });

    // Step 1: Detect Network
    const identity = await getNetworkIdentity();
    onProgress({ 
      phase: "identity", 
      ip: identity?.ip || "Scanning...", 
      isp: identity?.isp || "Local Network", 
      city: identity?.city || "Unknown" 
    });

    // Step 2: Dynamically Fetch Closest Nodes
    onProgress({ phase: "setup", status: "LOCATING LIVE NODES..." });
    let servers = await fetchDynamicServers();

    // EMERGENCY FALLBACK: If the API fails or blocks us, use high-speed reliable nodes
    if (!servers || servers.length === 0) {
      console.warn("Dynamic API blocked. Engaging fallback nodes.");
      servers = [
        { 
            id: "bom-fallback", 
            name: "Linode - Mumbai (Fallback)", 
            pingHost: "speedtest.mumbai1.linode.com:8080", 
            downloadUrl: "https://speedtest.mumbai1.linode.com/100MB-mumbai.bin", 
            uploadUrl: "http://speedtest.mumbai1.linode.com/upload" 
        },
        { 
            id: "fra-fallback", 
            name: "Linode - Frankfurt (Fallback)", 
            pingHost: "speedtest.frankfurt.linode.com:8080", 
            downloadUrl: "https://speedtest.frankfurt.linode.com/100MB-frankfurt.bin", 
            uploadUrl: "http://speedtest.frankfurt.linode.com/upload" 
        }
      ];
    }
    
    // Step 3: Probe nodes to find the absolute fastest one
    onProgress({ phase: "setup", status: "PROBING FOR BEST ROUTE..." });
    const bestServer = await selectBestServer(servers, identity);

    onProgress({ 
      phase: "server-selected", 
      id: bestServer.id, 
      serverName: bestServer.name, 
      city: bestServer.name.split(',')[0] 
    });

    // Step 4: Latency Test
    onProgress({ phase: "ping", status: "MEASURING PING..." });
    const pingResult = await pingServer(bestServer.pingHost);
    onProgress({ phase: "ping", status: "done", value: pingResult.value });

    // Step 5: Download Test (8s Window)
    await new Promise(r => setTimeout(r, 400));
    onProgress({ phase: "download", status: "progress", speed: 0 });
    const downloadSpeed = await downloadTest(bestServer, (speed) => {
      onProgress({ phase: "download", status: "progress", speed });
    });

    // Step 6: Upload Test (8s Window)
    await new Promise(r => setTimeout(r, 800));
    onProgress({ phase: "upload", status: "progress", speed: 0 });
    const uploadSpeed = await uploadTest(bestServer, (speed) => {
      onProgress({ phase: "upload", status: "progress", speed });
    });

    onProgress({ phase: "complete" });

    return { ping: pingResult.value, download: downloadSpeed, upload: uploadSpeed };

  } catch (error) {
    console.error("Engine failure:", error);
    onProgress({ phase: "error", message: "Network Error" });
    onProgress({ phase: "complete" });
    return { ping: 999, download: 0, upload: 0 };
  }
}

module.exports = { runSpeedTest };