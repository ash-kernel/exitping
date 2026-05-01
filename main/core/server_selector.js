const pingServer = require("../modules/ping_server");

// Helper: Non-blocking delay to keep the network clear
const delay = (ms) => new Promise(res => setTimeout(res, ms));

/**
 * ULTRA-FAST PING PROBE
 * Wraps the ping engine in a strict timeout. If a server takes more 
 * than 400ms to respond, we instantly abandon it and move to the next.
 */
async function quickPing(server, timeoutMs = 400) {
  try {
    // 3 quick pulses is enough to gauge stable routing
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

/**
 * THE DYNAMIC SELECTOR
 * The 'servers' array passed here is already localized by the Ookla API.
 * We just need to find the absolute fastest route among them.
 */
async function selectBestServer(servers, identity) {
  if (!servers || servers.length === 0) return null;

  let bestServer = servers[0];
  let lowestPing = 9999;

  // We only probe the top 5 closest physical nodes to save time
  const testPool = servers.slice(0, 5);

  for (const server of testPool) {
    // Probe the server
    const currentPing = await quickPing(server, 400);

    // Lock in if it's the fastest we've seen
    if (currentPing < lowestPing) {
      lowestPing = currentPing;
      // Store the ping inside the server object for the UI to use later
      bestServer = { ...server, pingMs: currentPing };
    }

    // OOKLA EARLY EXIT: If we find a local node under 15ms, it's a direct fiber 
    // connection. There is no mathematical reason to keep searching. Lock it.
    if (lowestPing <= 15) {
      break; 
    }

    // 30ms "Breather" gap prevents router bufferbloat during the sweep
    await delay(30); 
  }

  return bestServer;
}

module.exports = { selectBestServer };