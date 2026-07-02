const AIRPORTS = {
    SEA: { name: 'Seattle-Tacoma Intl', lat: 47.4502, lon: -122.3088, color: '#4ade80' },
    ATL: { name: 'Hartsfield-Jackson Intl', lat: 33.6407, lon: -84.4277, color: '#f87171' }
};

let world;
let aircraft = [];

// Great-circle bearing from point 1 to point 2, in degrees 0-360
function bearing(lat1, lon1, lat2, lon2) {
    const toRad = Math.PI / 180;
    const dLon = (lon2 - lon1) * toRad;
    const y = Math.sin(dLon) * Math.cos(lat2 * toRad);
    const x = Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) -
        Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Smallest angle between two headings
function headingDiff(a, b) {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
}

// Classify each aircraft: arriving at SEA/ATL, or departing from one of them.
// Returns { mode: 'arriving'|'departing', airport: 'SEA'|'ATL' }
function classify(ac) {
    const h = ac.heading ?? 0;
    const toATL = bearing(ac.latitude, ac.longitude, AIRPORTS.ATL.lat, AIRPORTS.ATL.lon);
    const toSEA = bearing(ac.latitude, ac.longitude, AIRPORTS.SEA.lat, AIRPORTS.SEA.lon);
    const diffATL = headingDiff(h, toATL);
    const diffSEA = headingDiff(h, toSEA);

    // Pointing reasonably toward one of the airports -> arriving there
    if (Math.min(diffATL, diffSEA) < 90) {
        return { mode: 'arriving', airport: diffATL < diffSEA ? 'ATL' : 'SEA' };
    }
    // Otherwise it's flying away -> departing from whichever airport is closer
    const dSEA = Math.hypot(ac.latitude - AIRPORTS.SEA.lat, ac.longitude - AIRPORTS.SEA.lon);
    const dATL = Math.hypot(ac.latitude - AIRPORTS.ATL.lat, ac.longitude - AIRPORTS.ATL.lon);
    return { mode: 'departing', airport: dSEA < dATL ? 'SEA' : 'ATL' };
}

function init() {
    world = Globe()(document.getElementById('globe'))
        .globeImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg')
        .bumpImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png')
        .backgroundImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png')
        .atmosphereColor('#88bbff')
        .atmosphereAltitude(0.18);

    // World traffic (away from SEA/ATL) as cheap WebGL dots — hundreds of
    // these render fine where HTML icons would not
    world
        .pointsData([])
        .pointColor(() => '#e8e8e8')
        .pointAltitude(0.002)
        .pointRadius(0.18)
        .pointsMerge(true);

    // Route line for the hovered plane only — one clear line at a time,
    // animated dashes flowing in the direction of travel
    world
        .arcsData([])
        .arcColor('color')
        .arcAltitude(0.04)
        .arcStroke(0.6)
        .arcDashLength(0.15)
        .arcDashGap(0.05)
        .arcDashAnimateTime(1200)
        .arcsTransitionDuration(0);

    // HTML markers: airports + aircraft icons
    world
        .htmlElementsData(buildMarkers([]))
        .htmlLat('lat')
        .htmlLng('lng')
        .htmlAltitude(d => d.type === 'airport' ? 0.01 : 0.02)
        .htmlTransitionDuration(0)
        .htmlElement(d => {
            const el = document.createElement('div');
            if (d.type === 'airport') {
                el.className = 'airport-label';
                el.innerHTML =
                    `<div class="dot" style="background:${d.color}"></div>` +
                    `<div class="code" style="color:${d.color}">${d.code}</div>`;
            } else {
                el.className = 'plane-icon';
                // globe.gl positions the outer element with its own transform,
                // so the heading rotation must live on an inner element
                const icon = document.createElement('span');
                icon.style.display = 'inline-block';
                icon.style.color = d.color;
                // ✈ glyph points right (east = 90°), so offset the rotation
                icon.style.transform = `rotate(${(d.heading ?? 0) - 90}deg)`;
                icon.textContent = '✈';
                el.appendChild(icon);
                const routeInfo = !d.airport ? '' :
                    (d.mode === 'arriving'
                        ? `Arriving at ${d.airport} (${AIRPORTS[d.airport].name})\n`
                        : `Departed ${d.airport} (${AIRPORTS[d.airport].name})\n`);
                el.title =
                    `${d.callsign}\n` + routeInfo +
                    `Altitude: ${d.altitude ? Math.round(d.altitude * 3.281).toLocaleString() + ' ft' : 'n/a'}\n` +
                    `Speed: ${d.velocity ? Math.round(d.velocity * 1.944) + ' kts' : 'n/a'}`;
                el.style.pointerEvents = 'auto';
                el.addEventListener('mouseenter', () => {
                    icon.style.fontSize = '22px';
                    if (d.airport) world.arcsData([routeLineFor(d)]);
                });
                el.addEventListener('mouseleave', () => {
                    icon.style.fontSize = '';
                    world.arcsData([]);
                });
            }
            return el;
        });

    // Start looking at the middle of the SEA-ATL corridor
    world.pointOfView({ lat: 40, lng: -103, altitude: 1.6 }, 0);

    startAircraftUpdates();
}

function buildMarkers(aircraftList) {
    const airportMarkers = Object.entries(AIRPORTS).map(([code, a]) => ({
        type: 'airport',
        code,
        lat: a.lat,
        lng: a.lon,
        color: a.color
    }));

    const planeMarkers = aircraftList.map(ac => ({
        type: 'plane',
        lat: ac.latitude,
        lng: ac.longitude,
        heading: ac.heading,
        callsign: (ac.callsign || '').trim() || 'Unknown',
        altitude: ac.geo_altitude,
        velocity: ac.velocity,
        mode: ac.mode,
        airport: ac.airport,
        color: ac.airport ? AIRPORTS[ac.airport].color : '#d0d0d0'
    }));

    return [...airportMarkers, ...planeMarkers];
}

// Route line for a single plane: airport -> plane for departures,
// plane -> airport for arrivals (dash animation flows toward the end point)
function routeLineFor(d) {
    const ap = AIRPORTS[d.airport];
    if (d.mode === 'arriving') {
        return {
            startLat: d.lat, startLng: d.lng,
            endLat: ap.lat, endLng: ap.lon,
            color: ap.color
        };
    }
    return {
        startLat: ap.lat, startLng: ap.lon,
        endLat: d.lat, endLng: d.lng,
        color: ap.color
    };
}

async function startAircraftUpdates() {
    await fetchAircraft();
    document.getElementById('loading').style.display = 'none';
    setInterval(fetchAircraft, 30000);
}

async function fetchAircraft() {
    try {
        const response = await fetch('/api/aircraft');
        const data = await response.json();
        if (!Array.isArray(data)) return;

        // Planes near SEA/ATL get classified (colors, route lines, counts);
        // everything else shows as neutral worldwide traffic
        const NEAR = 6;
        const dist = (ac, ap) => Math.hypot(ac.latitude - ap.lat, ac.longitude - ap.lon);

        aircraft = [];
        const worldTraffic = [];
        data.forEach(ac => {
            if (dist(ac, AIRPORTS.SEA) < NEAR || dist(ac, AIRPORTS.ATL) < NEAR) {
                aircraft.push({ ...ac, ...classify(ac) });
            } else {
                // Show all worldwide traffic as plane icons too, not just dots
                aircraft.push({ ...ac, mode: null, airport: null });
            }
        });
        world.pointsData([]);

        const nearSeaAtl = aircraft.filter(ac => ac.airport).length;
        const toSEA = aircraft.filter(ac => ac.mode === 'arriving' && ac.airport === 'SEA').length;
        const toATL = aircraft.filter(ac => ac.mode === 'arriving' && ac.airport === 'ATL').length;
        const fromSEA = aircraft.filter(ac => ac.mode === 'departing' && ac.airport === 'SEA').length;
        const fromATL = aircraft.filter(ac => ac.mode === 'departing' && ac.airport === 'ATL').length;

        // Update globe markers (route lines appear on plane hover)
        world.htmlElementsData(buildMarkers(aircraft));
        world.arcsData([]);

        // Update panels
        document.getElementById('toSeaCount').textContent = toSEA;
        document.getElementById('toAtlCount').textContent = toATL;
        document.getElementById('fromSeaCount').textContent = fromSEA;
        document.getElementById('fromAtlCount').textContent = fromATL;
        document.getElementById('flightCount').textContent = nearSeaAtl;
        document.getElementById('worldCount').textContent = aircraft.length;
        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
    } catch (err) {
        console.error('Aircraft fetch error:', err);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
