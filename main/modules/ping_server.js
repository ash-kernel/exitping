const net = require("net");
const { performance } = require("perf_hooks");

/**
 * TCP ping using socket connection timing
 */
async function tcpPingOnce(hostString, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    let host = hostString;
    let port = 8080;
    if (hostString.includes(':')) {
      const parts = hostString.split(':');
      host = parts[0];
      port = parseInt(parts[1], 10);
    } else {
      host = host.replace('http://', '').replace('https://', '').split('/')[0];
    }

    const start = performance.now();
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

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

    socket.connect(port, host);
  });
}

/**
 * Measure latency and jitter
 */
async function pingServer(host, count = 10) {
  const samples = [];
  let successful = 0;

  for (let i = 0; i < count; i++) {
    try {
      const latency = await tcpPingOnce(host, 1500);
      samples.push(latency);
      successful++;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 20)); 
  }

  if (successful === 0) {
    return { value: 999, jitter: 999 };
  }

  samples.sort((a, b) => a - b);
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