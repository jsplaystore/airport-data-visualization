const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const BASE_DIR = __dirname;

// Airport coordinates
const AIRPORTS = {
  KSEA: { lat: 47.4502, lon: -122.3088, name: 'Seattle' },
  KATL: { lat: 33.6407, lon: -84.4277, name: 'Atlanta' }
};

// Aircraft data comes from adsb.lol (free, no key).
// /v2/point/{lat}/{lon}/{radius}, radius in nautical miles, max 250.
// max = per-hub aircraft cap (adsb.lol returns closest-first).
const HUBS = [
  { name: 'SEA', ...AIRPORTS.KSEA, max: 150 },       // featured airports
  { name: 'ATL', ...AIRPORTS.KATL, max: 150 },
  { name: 'JFK', lat: 40.6413, lon: -73.7781, max: 80 },
  { name: 'LAX', lat: 33.9416, lon: -118.4085, max: 80 },
  { name: 'ORD', lat: 41.9742, lon: -87.9073, max: 80 },
  { name: 'DFW', lat: 32.8998, lon: -97.0403, max: 80 },
  { name: 'DEN', lat: 39.8561, lon: -104.6737, max: 80 },
  { name: 'LHR', lat: 51.4700, lon: -0.4543, max: 80 },
  { name: 'FRA', lat: 50.0379, lon: 8.5622, max: 80 },
  { name: 'DXB', lat: 25.2532, lon: 55.3657, max: 80 },
  { name: 'HND', lat: 35.5494, lon: 139.7798, max: 80 },
  { name: 'SIN', lat: 1.3644, lon: 103.9915, max: 80 },
  { name: 'SYD', lat: -33.9399, lon: 151.1753, max: 80 },
  { name: 'GRU', lat: -23.4356, lon: -46.4731, max: 80 }
];

// Rolling per-hub store: the poller below refreshes one hub at a time,
// so a throttled request just means that hub keeps its previous data
// instead of the whole response coming back empty.
const hubStore = new Map(); // hub name -> aircraft array
let pollIndex = 0;

async function pollNextHub() {
  const hub = HUBS[pollIndex];
  pollIndex = (pollIndex + 1) % HUBS.length;

  try {
    const r = await fetch(`https://api.adsb.lol/v2/point/${hub.lat}/${hub.lon}/250`);
    if (r.ok) {
      const d = await r.json();
      hubStore.set(hub.name, (d.ac || []).slice(0, hub.max));
    }
  } catch { /* keep previous data for this hub */ }
}

// One hub every 2s -> full world refresh every ~28s, no bursts
setInterval(pollNextHub, 2000);
pollNextHub();

function currentAircraft() {
  const seen = new Set();
  return [...hubStore.values()]
    .flat()
    .filter(ac => {
      if (!ac.hex || seen.has(ac.hex)) return false;
      seen.add(ac.hex);
      const airborne = ac.alt_baro !== 'ground' && (ac.alt_geom || ac.alt_baro || 0) > 1500; // ft
      const moving = (ac.gs || 0) > 50; // kts
      return ac.lat != null && ac.lon != null && airborne && moving;
    })
    .map(ac => ({
      callsign: (ac.flight || '').trim() || ac.r || ac.hex,
      latitude: ac.lat,
      longitude: ac.lon,
      geo_altitude: (ac.alt_geom || ac.alt_baro || 0) * 0.3048, // ft -> m
      velocity: (ac.gs || 0) * 0.5144,                          // kts -> m/s
      heading: ac.track ?? ac.true_heading ?? 0,
      vertical_rate: (ac.baro_rate || 0) * 0.00508,             // ft/min -> m/s
      on_ground: false
    }));
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Get live aircraft positions (served instantly from the rolling store)
  if (req.url === '/api/aircraft') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(currentAircraft()));
    return;
  }

  // Serve static files
  let filePath = path.join(BASE_DIR, req.url === '/' ? 'index.html' : req.url);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.json': 'application/json'
    };

    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Flight visualization server running at http://localhost:${PORT}`);
});
