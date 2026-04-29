const { pingServer } = require("../modules/ping_server");

async function selectBestServer(servers) {
  // Race all servers at the same time to find the lowest ping
  const pingPromises = servers.map(async (server) => {
    try {
      const pingResult = await pingServer(server.pingHost);
      return { ...server, pingMs: pingResult.value };
    } catch (err) {
      return { ...server, pingMs: 9999 }; // Penalize failed servers
    }
  });

  const results = await Promise.all(pingPromises);
  
  // Sort by lowest ping
  results.sort((a, b) => a.pingMs - b.pingMs);
  
  // Return the undisputed champion
  return results[0];
}

module.exports = { selectBestServer };