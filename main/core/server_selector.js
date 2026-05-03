const pingServer = require("../modules/ping_server");

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function quickPing(server, timeoutMs = 400) {
  try {
    const pingPromise = pingServer(server.pingHost, 3); 
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    );
    const result = await Promise.race([pingPromise, timeoutPromise]);
    return result.value;
  } catch (err) { 
    return 9999; 
  }
}

async function selectBestServer(servers, identity) {
  if (!servers || servers.length === 0) return null;

  let bestServer = servers[0];
  let lowestPing = 9999;
  const testPool = servers.slice(0, 5);

  for (const server of testPool) {
    const currentPing = await quickPing(server, 400);
    if (currentPing < lowestPing) {
      lowestPing = currentPing;
      bestServer = { ...server, pingMs: currentPing };
    }
    if (lowestPing <= 15) break;
    await delay(30); 
  }

  return bestServer;
}

module.exports = { selectBestServer };