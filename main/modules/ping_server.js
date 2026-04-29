const https = require("https");
const { performance } = require("perf_hooks");

function pingOnce(host) {
  return new Promise((resolve, reject) => {
    // Auto-fix missing protocols
    const urlString = host.startsWith('http') ? host : `https://${host}`;
    
    try {
      const url = new URL(urlString);
      const start = performance.now();

      const req = https.get(url, (res) => {
        // Consume data to free up memory
        res.on('data', () => {});
        res.on('end', () => {
          resolve(performance.now() - start);
        });
      });

      req.on("error", (err) => reject(err));
      
      // Set a 3-second timeout so it never hangs forever
      req.setTimeout(3000, () => {
        req.destroy();
        reject(new Error("Timeout"));
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function pingServer(host, count = 3) {
  let totalPing = 0;
  let successfulPings = 0;

  // Ping a few times for an accurate average
  for (let i = 0; i < count; i++) {
    try {
      const pingTime = await pingOnce(host);
      totalPing += pingTime;
      successfulPings++;
    } catch (err) {
      // Silently catch failures to keep the app running
    }
  }

  if (successfulPings === 0) {
    return { value: 999 }; // Return a high ping if it completely fails
  }

  const averagePing = totalPing / successfulPings;
  return { value: Math.round(averagePing) };
}

module.exports = { pingServer };