const https = require("https");
const http = require("http");
const { performance } = require("perf_hooks");

/**
 * ENTERPRISE DOWNLOAD ENGINE
 * Dynamically streams the Ookla 'random' image payloads.
 * Bypasses TCP slow-start with instant parallelism.
 */
function downloadTest(server, progressCallback, duration = 8000) {
  return new Promise((resolve) => {
    const activeThreads = 8; 
    let totalBytes = 0;
    const startTime = performance.now();
    let isFinished = false;
    const threadPool = [];
    
    // Auto-detect the dynamic protocol given by the API
    const protocol = server.downloadUrl.startsWith('https') ? https : http;
    
    const reportInterval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      
      // 0.5s Warm-up: Skips the initial HTTP handshake delay for UI accuracy
      if (elapsed > 0.5) {
        const speedMbps = (totalBytes * 8) / (elapsed * 1000000);
        progressCallback(speedMbps);
      }
    }, 100);

    const startThread = (id) => {
      if (isFinished) return;

      // EXTREME CACHE BUSTING: ISPs love to cache the Ookla random JPGs to fake 
      // your internet speed. This ensures every request bypasses the ISP cache.
      const url = `${server.downloadUrl}?nocache=${Date.now()}_${id}_${Math.random().toString(36).substring(2, 6)}`;
      
      const options = {
        headers: {
          'User-Agent': 'ExitPing-Pro/3.0',
          'Accept-Encoding': 'identity', // Forces raw byte transfer (No CPU decompression)
          'Connection': 'keep-alive',
          'Cache-Control': 'no-store'
        },
        timeout: 5000
      };
      
      const req = protocol.get(url, options, (res) => {
        // Direct to Network Interface (Bypass Node.js buffering delays)
        if (res.socket) res.socket.setNoDelay(true);
        
        res.on("data", (chunk) => {
          if (!isFinished) totalBytes += chunk.length;
        });
        
        res.on("end", () => {
          // If the file finishes downloading before 8s, restart the thread instantly
          if (!isFinished) setImmediate(() => startThread(id));
        });
      });
      
      req.on("error", () => {
        if (!isFinished) setTimeout(() => startThread(id), 200);
      });
      
      threadPool[id] = req;
    };
    
    // Launch the saturation attack
    for (let i = 0; i < activeThreads; i++) {
      startThread(i);
    }
    
    // Strict kill switch
    setTimeout(() => {
      isFinished = true;
      clearInterval(reportInterval);
      
      // Nuke the connections
      threadPool.forEach(req => { if (req) req.destroy(); });
      
      const finalElapsed = (performance.now() - startTime) / 1000;
      const finalSpeed = (totalBytes * 8) / (finalElapsed * 1000000);
      
      resolve(finalSpeed > 0 ? finalSpeed : 0);
    }, duration);
  });
}

module.exports = downloadTest;