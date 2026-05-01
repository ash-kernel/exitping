const net = require("net");
const { performance } = require("perf_hooks");

/**
 * PURE TCP PING PROBE
 * This connects directly to the server's socket. 
 * By measuring exactly how long it takes to complete a TCP handshake (SYN/ACK), 
 * we get true physical line latency without HTTP overhead.
 */
async function tcpPingOnce(hostString, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    // Ookla API provides hosts in "hostname:port" format (e.g., speedtest.jio.com:8080)
    let host = hostString;
    let port = 8080; // Ookla's default TCP port

    if (hostString.includes(':')) {
      const parts = hostString.split(':');
      host = parts[0];
      port = parseInt(parts[1], 10);
    } else {
        // Fallback: Strip http/https if accidentally passed
        host = host.replace('http://', '').replace('https://', '').split('/')[0];
    }

    const start = performance.now();
    const socket = new net.Socket();
    
    socket.setTimeout(timeoutMs);

    // The millisecond the connection opens, we record the time and instantly kill the socket
    socket.on('connect', () => {
      const latency = performance.now() - start;
      socket.destroy(); 
      resolve(latency);
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Timeout'));
    });

    socket.on('error', (err) => {
      socket.destroy();
      reject(err);
    });

    // Initiate the raw TCP handshake
    socket.connect(port, host);
  });
}

/**
 * SEQUENTIAL LATENCY & JITTER ANALYZER
 */
async function pingServer(host, count = 10) {
  const samples = [];
  let successful = 0;

  // We sequentially pulse the TCP requests to prevent local router packet storms
  for (let i = 0; i < count; i++) {
    try {
      const latency = await tcpPingOnce(host, 1500);
      samples.push(latency);
      successful++;
    } catch (e) {
      // Packet dropped or timeout
    }
    
    // 20ms breather to let the network hardware reset for the next pulse
    await new Promise(r => setTimeout(r, 20)); 
  }

  // If the node is dead, return max values
  if (successful === 0) {
    return { value: 999, jitter: 999 };
  }

  // Sort samples from fastest to slowest
  samples.sort((a, b) => a - b);
  
  // STATISTICAL CLEANING: Drop the absolute worst outlier (usually a random OS spike)
  const validSamples = samples.length > 4 ? samples.slice(0, samples.length - 1) : samples;
  
  // Calculate true average
  const avg = validSamples.reduce((a, b) => a + b, 0) / validSamples.length;
  
  // Jitter is the gap between your best possible connection and your worst connection
  const jitter = samples[samples.length - 1] - samples[0];

  return {
    value: Math.round(avg),
    jitter: Math.round(jitter)
  };
}

module.exports = pingServer;