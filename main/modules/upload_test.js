const https = require("https");
const { performance } = require("perf_hooks");

/**
 * PRODUCTION-GRADE UPLOAD ENGINE
 * Features: Backpressure handling, Warm-up Guard, and Socket-Safety.
 */
function uploadTest(server, progressCallback, duration = 8000) {
  return new Promise((resolve) => {
    const numThreads = 4; // Upload is more resource-heavy; 4 is the sweet spot
    let totalBytesUploaded = 0;
    const startTime = performance.now();
    let isFinished = false;
    
    // 32KB chunk: Standard for high-speed network streaming without RAM bloat
    const dummyChunk = Buffer.alloc(32768, "a"); 

    const reportInterval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      
      // 0.5s Warm-up Guard: Prevents "Impossible" speed spikes 
      // caused by the OS filling local network buffers at the start.
      if (elapsed < 0.5) {
        progressCallback(0);
        return;
      }

      if (elapsed > 0) {
        const speedMbps = (totalBytesUploaded * 8) / (elapsed * 1000000);
        progressCallback(speedMbps);
      }
    }, 100);

    const startUploadThread = () => {
      if (isFinished) return;

      const options = {
        hostname: server.uploadHost,
        path: server.uploadPath,
        method: "POST",
        headers: { 
          "Content-Type": "application/octet-stream",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Connection": "keep-alive"
        }
      };

      const req = https.request(options, (res) => {
        // Consume response to keep the socket moving
        res.on("data", () => {}); 
        res.on("end", () => {
          if (!isFinished) startUploadThread();
        });
      });

      const pushData = () => {
        while (!isFinished) {
          // req.write returns false if the buffer is full (Backpressure)
          const canContinue = req.write(dummyChunk);
          totalBytesUploaded += dummyChunk.length;
          
          if (!canContinue) break; 
        }
      };

      // When the network buffer is empty, resume pushing data
      req.on("drain", pushData);
      
      req.on("error", () => {
        if (!isFinished) setTimeout(startUploadThread, 100);
      });

      pushData();
    };

    // Launch parallel streams
    for (let i = 0; i < numThreads; i++) {
      startUploadThread();
    }

    // Master Kill Switch
    setTimeout(() => {
      isFinished = true;
      clearInterval(reportInterval);
      
      const finalElapsed = (performance.now() - startTime) / 1000;
      const finalSpeed = (totalBytesUploaded * 8) / (finalElapsed * 1000000);
      
      resolve(finalSpeed);
    }, duration);
  });
}

module.exports = { uploadTest };