// Serverless function for Vercel
const HUBS = [
  { name: 'SEA', lat: 47.4502, lon: -122.3088, max: 150 },
  { name: 'ATL', lat: 33.6407, lon: -84.4277, max: 150 },
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

async function fetchAircraft() {
  const promises = HUBS.map(async hub => {
    try {
      const r = await fetch(`https://api.adsb.lol/v2/point/${hub.lat}/${hub.lon}/250`);
      if (r.ok) {
        const d = await r.json();
        return (d.ac || []).slice(0, hub.max);
      }
    } catch (e) {
      console.error(`Error fetching ${hub.name}:`, e);
    }
    return [];
  });

  const results = await Promise.all(promises);
  const seen = new Set();

  return results
    .flat()
    .filter(ac => {
      if (!ac.hex || seen.has(ac.hex)) return false;
      seen.add(ac.hex);
      const airborne = ac.alt_baro !== 'ground' && (ac.alt_geom || ac.alt_baro || 0) > 1500;
      const moving = (ac.gs || 0) > 50;
      return ac.lat != null && ac.lon != null && airborne && moving;
    })
    .map(ac => ({
      callsign: (ac.flight || '').trim() || ac.r || ac.hex,
      latitude: ac.lat,
      longitude: ac.lon,
      geo_altitude: (ac.alt_geom || ac.alt_baro || 0) * 0.3048,
      velocity: (ac.gs || 0) * 0.5144,
      heading: ac.track ?? ac.true_heading ?? 0,
      vertical_rate: (ac.baro_rate || 0) * 0.00508,
      on_ground: false
    }));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const aircraft = await fetchAircraft();
    res.status(200).json(aircraft);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch aircraft data' });
  }
}
