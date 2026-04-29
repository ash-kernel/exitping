const fs = require("fs");
const path = require("path");
const https = require("https");
const { selectBestServer } = require("./server_selector");
const { pingServer } = require("../modules/ping_server");
const { downloadTest } = require("../modules/download_test");
const { uploadTest } = require("../modules/upload_test");

const serversPath = path.resolve(__dirname, "..", "config", "servers.json");

/**
 * ULTRA-FAST IDENTITY LOOKUP
 * (Updated to ipwho.is to bypass strict bot-blocks)
 */
async function getNetworkIdentity() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'ipwho.is',
      path: '/',
      headers: { 'User-Agent': 'ExitPing-Dev/1.0' },
      timeout: 1500 
    };

    const req = https.get(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          resolve({ 
            ip: json.ip || "0.0.0.0", 
            isp: (json.connection && json.connection.isp) ? json.connection.isp : "Local Fiber", 
            city: json.city || "India" 
          });
        } catch (e) { resolve(null); }
      });
    });

    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

/**
 * THE ENGINE
 */
async function runSpeedTest(onProgress = () => {}) {
  try {
    onProgress({ phase: "setup", status: "WAKING UP..." });

    const [identity, bestServer] = await Promise.all([
      getNetworkIdentity(),
      (async () => {
        const servers = JSON.parse(fs.readFileSync(serversPath, "utf8"));
        return await selectBestServer(servers);
      })()
    ]);

    // Send the correctly parsed identity to the UI
    onProgress({ 
      phase: "identity", 
      ip: identity?.ip || "Scanning...", 
      isp: identity?.isp || "Local Network", 
      city: identity?.city || "India" 
    });
    
    onProgress({ phase: "server-selected", id: bestServer.id, serverName: bestServer.name, city: "Global Node" });

    // Latency
    onProgress({ phase: "ping", status: "CHECKING PING..." });
    const pingResult = await pingServer(bestServer.pingHost);
    const pingMs = pingResult.value;
    onProgress({ phase: "ping", status: "done", value: pingMs });

    // DOWNLOAD
    await new Promise(r => setTimeout(r, 400));
    onProgress({ phase: "download", status: "progress", speed: 0 });
    const downloadSpeed = await downloadTest(bestServer, (speed) => {
      onProgress({ phase: "download", status: "progress", speed });
    });

    // UPLOAD
    await new Promise(r => setTimeout(r, 800));
    onProgress({ phase: "upload", status: "progress", speed: 0 });
    const uploadSpeed = await uploadTest(bestServer, (speed) => {
      onProgress({ phase: "upload", status: "progress", speed });
    });

    onProgress({ phase: "complete" });

    return { ping: pingMs, download: downloadSpeed, upload: uploadSpeed };

  } catch (error) {
    console.error("Critical Engine Failure:", error);
    onProgress({ phase: "error", message: "Engine Error" });
    onProgress({ phase: "complete" });
    return { ping: 999, download: 0, upload: 0 };
  }
}

module.exports = { runSpeedTest };