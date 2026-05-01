const https = require("https");
const http = require("http");
const { performance } = require("perf_hooks");

/**
 * ENTERPRISE UPLOAD ENGINE
 * Dynamically parses Ookla upload endpoints.
 * Features: 256KB Static Buffer, Sustained Peak Tracking, and Cache-Busting.
 */

// Memory Optimization: 256KB static buffer prevents CPU bottlenecks
const dummyChunk = Buffer.alloc(262144, '0'); 

function uploadTest(server, progressCallback, duration = 8000) {
  return new Promise((resolve) => {
    const activeThreads = 8; 
    let totalBytesUploaded = 0;
    const startTime = performance.now();
    let isFinished = false;
    
    // SUSTAINED PEAK TRACKING
    let warmedUp = false;
    let bytesAtWarmup = 0;
    let timeAtWarmup = 0;

    // The Ookla API gives us a full URL in server.uploadUrl
    const urlObj = new URL(server.uploadUrl);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const reportInterval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      
      // 1.5s Warm-up: Wait for TCP Slow-Start to finish before measuring
      if (elapsed > 1.5 && !warmedUp) {
        warmedUp = true;
        bytesAtWarmup = totalBytesUploaded;
        timeAtWarmup = elapsed;
      }

      if (warmedUp) {
        const sustainedBytes = totalBytesUploaded - bytesAtWarmup;
        const sustainedTime = elapsed - timeAtWarmup;
        const speedMbps = (sustainedBytes * 8) / (sustainedTime * 1000000);
        progressCallback(speedMbps);
      } else {
        const rawSpeed = (totalBytesUploaded * 8) / (elapsed * 1000000);
        progressCallback(rawSpeed * 0.5); // Dampen early chaotic spikes
      }
    }, 100);

    const startThread = (id) => {
      if (isFinished) return;

      // Ensure every stream bypasses ISP caching
      const separator = urlObj.search ? '&' : '?';
      const pathWithCacheBuster = `${urlObj.pathname}${urlObj.search}${separator}nocache=${Date.now()}_${id}`;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: pathWithCacheBuster,
        method: 'POST',
        headers: { 
          'Content-Type': 'application/octet-stream', 
          'Connection': 'keep-alive',
          'User-Agent': 'ExitPing-Pro/3.0',
          'Content-Length': 100000000000 // Faking 100GB forces the server's high-speed intake
        }
      };

      const req = protocol.request(options, (res) => {
        res.on('data', () => {}); 
        res.on('end', () => {
          if (!isFinished) setImmediate(() => startThread(id));
        });
      });

      req.on('socket', (socket) => {
        socket.setNoDelay(true);
        socket.setKeepAlive(true, 1000);
      });

      const pushData = () => {
        while (!isFinished) {
          const canContinue = req.write(dummyChunk);
          totalBytesUploaded += dummyChunk.length;
          if (!canContinue) break; 
        }
      };

      req.on('drain', pushData);
      
      req.on('error', () => {
        if (!isFinished) setTimeout(() => startThread(id), 250);
      });

      pushData();
    };

    // Launch saturation attack
    for (let i = 0; i < activeThreads; i++) {
      startThread(i);
    }

    // Hard Stop
    setTimeout(() => {
      isFinished = true;
      clearInterval(reportInterval);
      
      const finalElapsed = (performance.now() - startTime) / 1000;
      
      const finalSpeed = warmedUp 
        ? ((totalBytesUploaded - bytesAtWarmup) * 8) / ((finalElapsed - timeAtWarmup) * 1000000)
        : (totalBytesUploaded * 8) / (finalElapsed * 1000000);
      
      resolve(finalSpeed > 0 ? finalSpeed : 0);
    }, duration);
  });
}

module.exports = uploadTest;