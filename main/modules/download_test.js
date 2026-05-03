const https = require("https");
const http = require("http");
const { performance } = require("perf_hooks");

/**
 * Download speed test with multi-threaded requests
 */
function downloadTest(server, progressCallback, duration = 8000) {
  return new Promise((resolve) => {
    const activeThreads = 8; 
    let totalBytes = 0;
    const startTime = performance.now();
    let isFinished = false;
    const threadPool = [];
    
    let smoothedSpeed = 0;
    const smoothingFactor = 0.2; 
    let lastBytes = 0;
    let lastTime = 0;
    let tickBuffer = [];
    
    const protocol = server.downloadUrl.startsWith('https') ? https : http;
    
    const reportInterval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      
      if (elapsed < 1.0) {
        lastBytes = totalBytes;
        lastTime = elapsed;
        return;
      }
      
      const intervalBytes = totalBytes - lastBytes;
      const intervalTime = elapsed - lastTime;
      
      if (intervalTime > 0) {
        const instantSpeed = (intervalBytes * 8) / (intervalTime * 1000000);
        tickBuffer.push(instantSpeed);
        if (tickBuffer.length > 3) tickBuffer.shift();
        
        if (tickBuffer.length === 3) {
          const sorted = [...tickBuffer].sort((a, b) => a - b);
          const stableSpeed = sorted[1]; 
          
          if (smoothedSpeed === 0) {
            smoothedSpeed = stableSpeed * 0.85;
          } else {
            smoothedSpeed = smoothedSpeed * (1 - smoothingFactor) + stableSpeed * smoothingFactor;
          }
          progressCallback(smoothedSpeed);
        }
      }

      lastBytes = totalBytes;
      lastTime = elapsed;
    }, 150);

    const startThread = (id) => {
      if (isFinished) return;

      const url = `${server.downloadUrl}?nocache=${Date.now()}_${id}_${Math.random().toString(36).substring(2, 6)}`;
      
      const options = {
        headers: {
          'User-Agent': 'ExitPing-Pro/3.0',
          'Accept-Encoding': 'identity',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-store'
        },
        timeout: 5000
      };
      
      const req = protocol.get(url, options, (res) => {
        if (res.socket) res.socket.setNoDelay(true);
        
        res.on("data", (chunk) => {
          if (!isFinished) totalBytes += chunk.length;
        });
        
        res.on("end", () => {
          if (!isFinished) setImmediate(() => startThread(id));
        });
      });
      
      req.on("error", () => {
        if (!isFinished) setTimeout(() => startThread(id), 200);
      });
      
      threadPool[id] = req;
    };
    
    for (let i = 0; i < activeThreads; i++) {
      startThread(i);
    }
    
    setTimeout(() => {
      isFinished = true;
      clearInterval(reportInterval);
      
      threadPool.forEach(req => { if (req) req.destroy(); });
      
      const finalElapsed = (performance.now() - startTime) / 1000;
      const finalSpeed = (totalBytes * 8) / (finalElapsed * 1000000);
      
      resolve(finalSpeed > 0 ? finalSpeed : 0);
    }, duration);
  });
}

module.exports = downloadTest;