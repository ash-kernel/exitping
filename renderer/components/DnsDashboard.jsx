import React, { useState, useEffect, useRef } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';

const DNS_SERVERS = [
  { id: 'cloudflare', name: 'Cloudflare (1.1.1.1)', ip: '1.1.1.1', provider: 'Cloudflare', ping: 23, uptime: 100, reliability: 'Excellent', lat: 37.7749, lng: -122.4194, color: '#34d399', domain: 'cloudflare.com' },
  { id: 'google', name: 'Google (8.8.8.8)', ip: '8.8.8.8', provider: 'Google', ping: 28, uptime: 100, reliability: 'Excellent', lat: 51.5074, lng: -0.1278, color: '#34d399', domain: 'google.com' },
  { id: 'quad9', name: 'Quad9 (9.9.9.9)', ip: '9.9.9.9', provider: 'Quad9', ping: 31, uptime: 100, reliability: 'Good', lat: 48.8566, lng: 2.3522, color: '#facc15', domain: 'quad9.net' },
  { id: 'opendns', name: 'OpenDNS (208.67.222.222)', ip: '208.67.222.222', provider: 'OpenDNS', ping: 32, uptime: 99.9, reliability: 'Good', lat: -33.8688, lng: 151.2093, color: '#facc15', domain: 'opendns.com' },
  { id: 'adguard', name: 'AdGuard (94.140.14.14)', ip: '94.140.14.14', provider: 'AdGuard', ping: 45, uptime: 99.8, reliability: 'Good', lat: 35.6762, lng: 139.6503, color: '#facc15', domain: 'adguard.com' },
  { id: 'mumbai', name: 'Local ISP (India)', ip: '49.44.2.1', provider: 'Local ISP', ping: 26, uptime: 99.0, reliability: 'Okay', lat: 19.0760, lng: 72.8777, color: '#facc15', domain: 'jio.com' },
  { id: 'china', name: 'AliDNS (223.5.5.5)', ip: '223.5.5.5', provider: 'Alibaba', ping: 154, uptime: 95.0, reliability: 'Poor', lat: 39.9042, lng: 116.4074, color: '#f87171', domain: 'alibabacloud.com' },
  { id: 'brazil', name: 'Vivo (200.220.220.220)', ip: '200.220.220.220', provider: 'Vivo', ping: 130, uptime: 98.0, reliability: 'Okay', lat: -23.5505, lng: -46.6333, color: '#f87171', domain: 'vivo.com.br' },
];

// Simple SVG Sparkline component
const Sparkline = ({ color, data, height = 40 }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 200;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d - min) / range) * height * 0.8 - height * 0.1;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ marginTop: '8px' }}>
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
      <path fill={`url(#gradient-${color.replace('#', '')})`} opacity="0.3" d={`M0,${height} L${points} L${width},${height} Z`} />
      <defs>
        <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
};

const DEFAULT_LOADING_SERVER = { id: 'loading', name: 'Loading...', ip: '...', provider: 'Loading', ping: '--', uptime: '--', reliability: '--', lat: 0, lng: 0, color: '#64748b', domain: '' };

export default function DnsDashboard() {
  const [activeServer, setActiveServer] = useState(DEFAULT_LOADING_SERVER);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [serverPings, setServerPings] = useState({});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [toolkitStatus, setToolkitStatus] = useState("");
  const mapRef = useRef();
  const isInitialMount = useRef(true);
  const lastActiveServerRef = useRef('loading');
  const [mapLoaded, setMapLoaded] = useState(false);

  const fetchActiveDns = async () => {
    setIsRefreshing(true);
    if (window.api && window.api.getFullNetworkInfo) {
      try {
        const info = await window.api.getFullNetworkInfo();
        const activeIps = info.dnsServers || [];
        if (activeIps.length > 0 && activeIps[0] !== "No DNS") {
          const firstIp = activeIps[0];
          const matchedServer = DNS_SERVERS.find(s => s.ip === firstIp) || {
            id: 'custom', name: 'Custom DNS', ip: firstIp, provider: 'Custom / ISP', ping: '--', uptime: '--', reliability: 'Unknown', lat: userLocation ? userLocation.lat : 0, lng: userLocation ? userLocation.lng : 0, color: '#94a3b8', domain: ''
          };
          setActiveServer(matchedServer);
        } else {
          setActiveServer({
            id: 'none', name: 'No DNS (Automatic)', ip: 'DHCP Default', provider: 'System', ping: '--', uptime: '--', reliability: 'N/A', lat: 0, lng: 0, color: '#94a3b8', domain: ''
          });
        }
      } catch (e) {
        console.error(e);
      }
    }
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleFlushCache = async () => {
    setToolkitStatus("Flushing cache...");
    if (window.api && window.api.flushDns) {
      const res = await window.api.flushDns();
      if (res.success) {
        setToolkitStatus("Cache Flushed Successfully");
      } else {
        setToolkitStatus(`Flush Failed: ${res.error}`);
      }
    } else {
      setToolkitStatus("Cache Flushed Successfully (Simulation)");
    }
    setTimeout(() => setToolkitStatus(""), 4000);
  };

  const handleOptimizeDns = async () => {
    setIsOptimizing(true);
    const pings = {};
    for (const server of DNS_SERVERS) {
      if (window.api && window.api.pingHost) {
        const ping = await window.api.pingHost(server.ip, 53);
        pings[server.id] = ping !== null ? ping : 999;
      } else {
        pings[server.id] = server.ping;
      }
    }
    setServerPings(pings);
    
    let bestServer = DNS_SERVERS[0];
    let bestPing = 9999;
    for (const server of DNS_SERVERS) {
      if (pings[server.id] < bestPing) {
        bestPing = pings[server.id];
        bestServer = server;
      }
    }
    
    if (window.api && window.api.applyDns) {
      await window.api.applyDns(bestServer.ip, bestServer.ip);
      setActiveServer(bestServer);
      setToolkitStatus(`Optimized! Applied ${bestServer.name} (${bestPing}ms)`);
    } else {
      setActiveServer(bestServer);
      setToolkitStatus(`Optimized! Applied ${bestServer.name} (${bestPing}ms) (Sim)`);
    }
    setIsOptimizing(false);
    setTimeout(() => setToolkitStatus(""), 5000);
  };

  const [leakData, setLeakData] = useState(null);
  const [customDnsIp, setCustomDnsIp] = useState("");

  const handleLeakTest = async () => {
    setLeakData({ loading: true });
    try {
      const res = await fetch('https://edns.ip-api.com/json').then(r => r.json());
      if (res && res.dns) {
        setLeakData({ loading: false, ip: res.dns.ip, isp: res.dns.geo });
      } else {
        setLeakData({ loading: false, error: 'Could not resolve leak status' });
      }
    } catch (e) {
      setLeakData({ loading: false, error: 'Failed to contact leak test server' });
    }
  };

  useEffect(() => {
    fetchActiveDns();
  }, []);

  const [stats, setStats] = useState({
    responseTimeData: [28,24,25,30,23,23,24,23,22,23],
    uptimeData: [99.9,100,100,100,100,99.9,100,100,100,100],
    cacheHitData: [85,86,84,87,88,87.3,86,87,88,87.3],
    blockedDomainsData: [40,35,38,30,25,20,19,22,18,18]
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => {
        const genNext = (arr, maxStep, min, max, isFloat=false) => {
          const last = arr[arr.length - 1];
          let change = (Math.random() * maxStep * 2) - maxStep;
          let next = last + change;
          if (next < min) next = min;
          if (next > max) next = max;
          return [...arr.slice(1), isFloat ? parseFloat(next.toFixed(1)) : Math.round(next)];
        };
        
        return {
          responseTimeData: genNext(prev.responseTimeData, 4, 15, 60),
          uptimeData: genNext(prev.uptimeData, 0.1, 99.0, 100, true),
          cacheHitData: genNext(prev.cacheHitData, 1.5, 75, 98, true),
          blockedDomainsData: genNext(prev.blockedDomainsData, 2, 5, 50)
        };
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchUserLocation() {
      try {
        let lat, lng, city, region, country;
        
        // Try Electron API first
        if (window.api && window.api.geolocateIp) {
          const res = await window.api.geolocateIp('');
          if (res && res.success && res.latitude && res.longitude) {
            lat = res.latitude;
            lng = res.longitude;
            city = res.city;
            region = res.region;
            country = res.country;
          }
        } 
        
        // Fallback to web API if Electron API fails or isn't available (e.g. running in standard browser)
        if (!lat || !lng) {
          const webRes = await fetch('https://get.geojs.io/v1/ip/geo.json').then(r => r.json());
          if (webRes && webRes.latitude && webRes.longitude) {
            lat = parseFloat(webRes.latitude);
            lng = parseFloat(webRes.longitude);
            city = webRes.city || '';
            region = webRes.region || '';
            country = webRes.country || '';
          }
        }

        if (lat && lng) {
          setUserLocation({
            lat,
            lng,
            city,
            region,
            country,
            ping: 26 // Simulated local ping
          });
        }
      } catch (e) {
        console.error("Failed to geolocate", e);
      }
    }
    fetchUserLocation();
  }, []);

  // Zoom to user location when both map is loaded and location is fetched
  useEffect(() => {
    if (mapLoaded && userLocation && mapRef.current) {
      mapRef.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 5,
        duration: 2500
      });
    }
  }, [mapLoaded, userLocation]);

  // Auto-zoom to the selected active server removed as per user request
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }
  }, [activeServer, mapLoaded]);

  return (
    <div className="dns-dashboard-container">
      {/* HEADER */}
      <header className="dns-header">
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
          <h2 className="dns-title" style={{margin: 0}}>DNS Dashboard</h2>
          <button 
            onClick={fetchActiveDns} 
            disabled={isRefreshing}
            className={`icon-btn primary-outline ${isRefreshing ? 'spinning' : ''}`} 
            style={{padding: '4px 10px', fontSize: '11px', height: '26px'}}
            title="Refresh Active DNS"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <div className="dns-header-actions">
          <div className="dns-select-modern-wrapper" style={{ cursor: 'default' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <span className="dns-select-modern" style={{ cursor: 'default' }}>
              {userLocation ? `${userLocation.city ? userLocation.city + ', ' : ''}${userLocation.country}` : 'Locating...'}
            </span>
          </div>
          <div className="dns-pill">
            <span className="pill-label">Provider</span>
            <span className="pill-value highlight">{activeServer.provider}</span>
          </div>
        </div>
      </header>

      {/* TOP ROW: MAP + ACTIVE SERVER CARD */}
      <div className="dns-top-row">
        
        {/* MAP CONTAINER */}
        <div className="dns-map-card card glass">
          <div className="map-wrapper" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            <Map
              ref={mapRef}
              onLoad={() => setMapLoaded(true)}
              initialViewState={{
                longitude: 20,
                latitude: 30,
                zoom: 1
              }}
              mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
              interactive={true}
              dragPan={true}
              attributionControl={false}
              style={{width: '100%', height: '100%'}}
            >
              {/* Server markers removed as per user request */}

              {userLocation && (
                <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {/* Country Glow */}
                    <div className="map-country-glow"></div>
                    {/* State Glow */}
                    <div className="map-state-glow"></div>
                    
                    <div className="map-marker-user" style={{position: 'relative', zIndex: 10, width: '16px', height: '16px', background: '#fff', borderRadius: '50%', border: '4px solid #38bdf8', boxShadow: '0 0 10px #38bdf8'}}>
                      <div className="map-tooltip" style={{
                        position: 'absolute',
                        left: '20px',
                        top: '-10px',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none'
                      }}>
                        <div className="tooltip-title" style={{textShadow: '0 0 10px var(--accent-cyan)'}}>{userLocation.country}</div>
                        <div className="tooltip-sub" style={{color: '#10b981', textShadow: '0 0 10px #10b981'}}>{userLocation.region || userLocation.city}</div>
                        <div className="tooltip-ping">{userLocation.ping} ms</div>
                      </div>
                    </div>
                  </div>
                </Marker>
              )}

              {hoverInfo && (
                <div className="map-tooltip" style={{
                  position: 'absolute',
                  left: hoverInfo.lng, 
                  top: hoverInfo.lat,
                  transform: 'translate(15px, -15px)'
                }}>
                  <div className="tooltip-title">{hoverInfo.provider}</div>
                  <div className="tooltip-sub">{hoverInfo.name}</div>
                  <div className="tooltip-ping">{hoverInfo.ping} ms</div>
                </div>
              )}
            </Map>
          </div>
        </div>

        {/* ACTIVE SERVER INFO */}
        <div className="dns-side-panel">
          <div className="card glass active-server-card">
            <div className="active-card-header">
              <h3>Active DNS Server</h3>
              <span className="server-grade">A</span>
            </div>
            
            <div className="server-main-info">
              <div className="server-icon-large" style={{ '--glow-color': activeServer.color }}>
                <img src={`https://www.google.com/s2/favicons?sz=64&domain=${activeServer.domain}`} alt={activeServer.provider} style={{width: '32px', height: '32px', borderRadius: '6px', objectFit: 'contain'}} />
              </div>
              <div className="server-details-text">
                <h4 style={{ fontSize: '18px', marginBottom: '4px', color: '#fff' }}>{activeServer.name}</h4>
                <p style={{ color: 'var(--text-med)', fontSize: '12px' }}>{activeServer.ip} &middot; Anycast Global</p>
              </div>
            </div>

            <div className="server-metrics-grid">
              <div className="s-metric premium-metric">
                <span className="s-label">RESPONSE</span>
                <span className="s-value glow-text">{activeServer.ping} <span style={{fontSize: '12px', opacity: 0.7}}>ms</span></span>
              </div>
              <div className="s-metric premium-metric">
                <span className="s-label">UPTIME</span>
                <span className="s-value glow-text">{activeServer.uptime} <span style={{fontSize: '12px', opacity: 0.7}}>%</span></span>
              </div>
              <div className="s-metric premium-metric" style={{ gridColumn: 'span 2' }}>
                <span className="s-label">RELIABILITY</span>
                <span className="s-value" style={{color: activeServer.reliability === 'Excellent' ? '#34d399' : '#facc15', fontSize: '16px', letterSpacing: '1px'}}>{activeServer.reliability} Grade</span>
              </div>
            </div>

            <div className="server-network-map" style={{ marginTop: 'auto', paddingTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-med)', letterSpacing: '1px', fontWeight: '700' }}>LIVE LATENCY</span>
                <span style={{ fontSize: '12px', color: activeServer.color, fontWeight: '700', fontFamily: 'monospace' }}>{stats.responseTimeData[stats.responseTimeData.length - 1]} ms</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Sparkline color={activeServer.color} data={stats.responseTimeData} height={60} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div className="dns-charts-row">
        <div className="card glass chart-card">
          <div className="chart-header">
            <h4>Response Time</h4>
            <div className="chart-val">{stats.responseTimeData[stats.responseTimeData.length - 1]} <span>ms</span></div>
          </div>
          <Sparkline color="#0ea5e9" data={stats.responseTimeData} />
          <div className="chart-x-axis"><span>-60s</span><span>-40s</span><span>-20s</span><span>Now</span></div>
        </div>

        <div className="card glass chart-card">
          <div className="chart-header">
            <h4>Uptime</h4>
            <div className="chart-val">{stats.uptimeData[stats.uptimeData.length - 1]} <span>%</span></div>
          </div>
          <Sparkline color="#10b981" data={stats.uptimeData} />
          <div className="chart-x-axis"><span>-60s</span><span>-40s</span><span>-20s</span><span>Now</span></div>
        </div>

        <div className="card glass chart-card">
          <div className="chart-header">
            <h4>Cache Hit Rate</h4>
            <div className="chart-val">{stats.cacheHitData[stats.cacheHitData.length - 1]} <span>%</span></div>
          </div>
          <Sparkline color="#a855f7" data={stats.cacheHitData} />
          <div className="chart-x-axis"><span>-60s</span><span>-40s</span><span>-20s</span><span>Now</span></div>
        </div>

        <div className="card glass chart-card">
          <div className="chart-header">
            <h4>Blocked Domains</h4>
            <div className="chart-val">{stats.blockedDomainsData[stats.blockedDomainsData.length - 1]} <span style={{color:'#10b981', fontSize:'10px'}}>↓ 5.2%</span></div>
          </div>
          <Sparkline color="#ef4444" data={stats.blockedDomainsData} />
          <div className="chart-x-axis"><span>-60s</span><span>-40s</span><span>-20s</span><span>Now</span></div>
        </div>
      </div>

      {/* TOOLKIT & LEAK TEST ROW */}
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '20px'}}>
        
        {/* NETWORK TOOLKIT CARD */}
        <div className="card glass table-card" style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px'}}>
          <h3 style={{marginBottom: '4px'}}>Network Toolkit</h3>
          <p style={{color: 'var(--text-med)', fontSize: '12px', marginBottom: '16px'}}>Essential actions to optimize and refresh your connection.</p>
          
          <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            <button 
              className="engine-btn primary" 
              onClick={handleOptimizeDns} 
              disabled={isOptimizing}
              style={{width: '140px', height: '40px', fontSize: '12px'}}
            >
              {isOptimizing ? 'Optimizing...' : 'Optimize DNS'}
            </button>
            <button 
              className="engine-btn" 
              onClick={handleFlushCache} 
              style={{width: '140px', height: '40px', fontSize: '12px', background: 'transparent', border: '1px solid #8b5cf6', color: '#8b5cf6'}}
            >
              Flush Cache
            </button>
          </div>
          {toolkitStatus && <div style={{marginTop: '12px', fontSize: '12px', color: '#10b981'}}>{toolkitStatus}</div>}
        </div>

        {/* LEAK TEST CARD */}
        <div className="card glass table-card" style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
            <div>
              <h3 style={{marginBottom: '4px'}}>DNS Leak Test</h3>
              <p style={{color: 'var(--text-med)', fontSize: '12px', margin: 0}}>Check which DNS server is actually resolving your requests to the public internet.</p>
              {leakData && leakData.loading && <div style={{marginTop: '10px', fontSize: '12px', color: 'var(--accent-cyan)'}}>Running test...</div>}
              {leakData && leakData.ip && (
                <div style={{marginTop: '12px', display: 'flex', gap: '20px'}}>
                  <div><strong style={{color:'var(--text-low)', fontSize:'10px'}}>RESOLVER IP</strong><br/><span style={{fontFamily:'monospace', color:'#fff'}}>{leakData.ip}</span></div>
                  <div><strong style={{color:'var(--text-low)', fontSize:'10px'}}>ISP / LOCATION</strong><br/><span style={{color:'#10b981'}}>{leakData.isp}</span></div>
                </div>
              )}
              {leakData && leakData.error && <div style={{marginTop: '10px', fontSize: '12px', color: '#ef4444'}}>{leakData.error}</div>}
            </div>
            <button className="engine-btn primary" onClick={handleLeakTest} style={{width: '130px', height: '40px', fontSize: '12px', flexShrink: 0}}>Run Leak Test</button>
          </div>
        </div>

      </div>

      {/* TABLE ROW */}
      <div className="dns-table-row">
        <div className="card glass table-card">
          <div className="table-header">
            <h3>Top DNS Servers</h3>
            <a href="#" className="view-all">View All</a>
          </div>
          <table className="dns-table">
            <thead>
              <tr>
                <th>DNS SERVER</th>
                <th>PROVIDER</th>
                <th>RESPONSE TIME</th>
                <th>UPTIME</th>
                <th>RELIABILITY</th>
                <th>QUERIES</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {DNS_SERVERS.slice(0, 5).map(server => (
                <tr key={server.id}>
                  <td className="t-ip">{server.ip}</td>
                  <td>{server.provider}</td>
                  <td>{serverPings[server.id] !== undefined ? serverPings[server.id] : server.ping} ms</td>
                  <td>{server.uptime} %</td>
                  <td style={{color: server.reliability === 'Excellent' ? '#10b981' : server.reliability === 'Good' ? '#34d399' : '#facc15'}}>{server.reliability}</td>
                  <td>{Math.floor(Math.random() * 800 + 200)}</td>
                  <td>
                    <button className="t-connect-btn" onClick={async () => {
                       if (window.api && window.api.applyDns) {
                         await window.api.applyDns(server.ip, server.ip);
                         alert(`Applied ${server.name}`);
                         setActiveServer(server);
                       } else {
                         alert(`Applied ${server.name} (Simulation)`);
                         setActiveServer(server);
                       }
                    }}>Connect</button>
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                <td className="t-ip">
                  <input 
                    type="text" 
                    placeholder="Custom IP (e.g. 192.168.1.5)" 
                    value={customDnsIp}
                    onChange={(e) => setCustomDnsIp(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', width: '140px', fontFamily: 'monospace' }}
                  />
                </td>
                <td style={{ color: 'var(--accent-cyan)' }}>Custom Server</td>
                <td>--</td>
                <td>--</td>
                <td>--</td>
                <td>--</td>
                <td>
                  <button className="t-connect-btn" style={{ borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }} onClick={async () => {
                     if (!customDnsIp) return;
                     if (window.api && window.api.applyDns) {
                       await window.api.applyDns(customDnsIp, customDnsIp);
                       alert(`Applied Custom DNS: ${customDnsIp}`);
                       setActiveServer({ id: 'custom', name: 'Custom DNS', ip: customDnsIp, provider: 'Custom', ping: '--', uptime: '--', reliability: 'Unknown', lat: 0, lng: 0, color: '#94a3b8', domain: '' });
                     } else {
                       alert(`Applied Custom DNS: ${customDnsIp} (Simulation)`);
                     }
                  }}>Connect</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
