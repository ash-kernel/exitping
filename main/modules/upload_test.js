const https = require("https");
const http = require("http");
const { performance } = require("perf_hooks");

/**
 * Upload speed test with multi-threaded requests
 */
const dummyChunk = Buffer.alloc(262144, '0');

function uploadTest(server, progressCallback, duration = 8000) {
  return new Promise((resolve) => {
    const activeThreads = 8;
    const startTime = performance.now();
    let isFinished = false;
    
    const activeSockets = new Set();
    let smoothedSpeed = 0;
    const smoothingFactor = 0.08;
    let lastBytes = 0;
    let lastTime = 0;
    let tickBuffer = []; 

    const urlObj = new URL(server.uploadUrl);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const getTotalBytesWritten = () => {
      let total = 0;
      for (const socket of activeSockets) {
        total += socket.bytesWritten || 0;
      }
      return total;
    };

    const reportInterval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      const actualBytesUploaded = getTotalBytesWritten();
      if (elapsed < 1.5) {
        lastBytes = actualBytesUploaded;
        lastTime = elapsed;
        return;
      }
      
      const intervalBytes = actualBytesUploaded - lastBytes;
      const intervalTime = elapsed - lastTime;
      
      if (intervalTime > 0) {
        const instantSpeed = (intervalBytes * 8) / (intervalTime * 1000000);
        tickBuffer.push(instantSpeed);
        if (tickBuffer.length > 5) tickBuffer.shift();
        
        if (tickBuffer.length >= 3) {
          const sorted = [...tickBuffer].sort((a, b) => a - b);
          const stableSpeed = sorted[Math.floor(sorted.length / 2)]; 
          
          if (smoothedSpeed === 0) {
            smoothedSpeed = stableSpeed * 0.75;
          } else {
            smoothedSpeed = smoothedSpeed * (1 - smoothingFactor) + stableSpeed * smoothingFactor;
          }
          
          progressCallback(smoothedSpeed);
        }
      }

      lastBytes = actualBytesUploaded;
      lastTime = elapsed;
    }, 150);

    const startThread = (id) => {
      if (isFinished) return;

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
          'Content-Length': 100000000000 
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
        activeSockets.add(socket);
        socket.on('close', () => activeSockets.delete(socket));
      });

      const pushData = () => {
        while (!isFinished) {
          const canContinue = req.write(dummyChunk);
          if (!canContinue) break; 
        }
      };

      req.on('drain', pushData);
      req.on('error', () => {
        if (!isFinished) setTimeout(() => startThread(id), 250);
      });

      pushData();
    };

    for (let i = 0; i < activeThreads; i++) {
      startThread(i);
    }

    setTimeout(() => {
      isFinished = true;
      clearInterval(reportInterval);
      
      const finalElapsed = (performance.now() - startTime) / 1000;
      const finalBytesUploaded = getTotalBytesWritten();
      const finalSpeed = (finalBytesUploaded * 8) / (finalElapsed * 1000000);
      
      for (const socket of activeSockets) {
        socket.destroy();
      }

      resolve(finalSpeed > 0 ? finalSpeed : 0);
    }, duration);
  });
}

module.exports = uploadTest;