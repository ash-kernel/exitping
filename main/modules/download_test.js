const https = require("https");
const { performance } = require("perf_hooks");

/**
 * EXTREME POLITE DOWNLOAD ENGINE
 * Strategy: Single-thread saturation with URI-Randomization.
 */
function downloadTest(server, progressCallback, duration = 8000) {
  return new Promise((resolve) => {
    // We drop to 1 thread. It's better to have 1 working stream 
    // than 5 blocked ones. Modern fiber can often max out on 1 socket anyway.
    const numThreads = 1; 
    let totalBytes = 0;
    const startTime = performance.now();
    let isFinished = false;

    const reportInterval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed < 0.5) return progressCallback(0);

      const speedMbps = (totalBytes * 8) / (elapsed * 1000000);
      progressCallback(speedMbps);
    }, 100);

    const startThread = (threadId) => {
      if (isFinished) return;

      // We add a random 't' parameter to the end of the URL.
      // This bypasses many server-side caches and rate-limiters.
      const separator = server.downloadUrl.includes('?') ? '&' : '?';
      const cacheBusterUrl = `${server.downloadUrl}${separator}t=${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const options = {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://www.google.com/', // Mimic coming from a search engine
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      };

      const req = https.get(cacheBusterUrl, options, (res) => {
        // ULTIMATE BACKOFF
        if (res.statusCode === 429) {
          console.warn(`[Thread ${threadId}] Server is really mad. Waiting 3 seconds...`);
          res.resume();
          // Wait 3 seconds to let the server's cooldown timer reset
          if (!isFinished) setTimeout(() => startThread(threadId), 3000);
          return;
        }

        if (res.statusCode !== 200) {
          console.error(`[Thread ${threadId}] Failed (Code: ${res.statusCode}). Retrying...`);
          res.resume();
          if (!isFinished) setTimeout(() => startThread(threadId), 1000);
          return;
        }

        res.on("data", (chunk) => {
          if (!isFinished) totalBytes += chunk.length;
          else res.destroy();
        });

        res.on("end", () => {
          if (!isFinished) startThread(threadId); 
        });
      });

      req.on("error", (err) => {
        if (!isFinished) setTimeout(() => startThread(threadId), 1000);
      });
    };

    // Start our single polite thread
    startThread(0);

    setTimeout(() => {
      isFinished = true;
      clearInterval(reportInterval);
      const finalElapsed = (performance.now() - startTime) / 1000;
      const finalSpeed = (totalBytes * 8) / (finalElapsed * 1000000);
      resolve(finalSpeed);
    }, duration);
  });
}

module.exports = { downloadTest };