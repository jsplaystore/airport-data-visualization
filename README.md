# Airport Data Visualization

Real-time flight tracking visualization displaying live aircraft positions from major airports worldwide.

## Live Demo

https://airport-data-visualization.vercel.app

## Features

- Live aircraft tracking from 14 major global airports
- Real-time position updates from adsb.lol API
- Interactive 3D globe visualization
- Displays aircraft callsigns, altitude, velocity, and heading
- Filters for airborne aircraft only (altitude > 1500ft, speed > 50kts)
- Updates aircraft data every 2 seconds per hub
- No API key required - uses free adsb.lol service

## Airports Tracked

**Featured (150 aircraft each):**
- SEA - Seattle-Tacoma International
- ATL - Hartsfield-Jackson Atlanta International

**Major Hubs (80 aircraft each):**
- JFK - John F. Kennedy International (New York)
- LAX - Los Angeles International
- ORD - O'Hare International (Chicago)
- DFW - Dallas/Fort Worth International
- DEN - Denver International
- LHR - London Heathrow
- FRA - Frankfurt Airport
- DXB - Dubai International
- HND - Tokyo Haneda
- SIN - Singapore Changi
- SYD - Sydney Kingsford Smith
- GRU - São Paulo/Guarulhos International

## How It Works

1. **Data Collection**: Serverless function polls adsb.lol API for aircraft within 250nm of each hub
2. **Filtering**: Removes ground aircraft, duplicates, and slow-moving planes
3. **Normalization**: Converts units (feet→meters, knots→m/s) for consistent display
4. **Visualization**: Frontend renders aircraft positions on interactive globe

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Node.js serverless functions (Vercel)
- **Deployment**: Vercel
- **Data Source**: adsb.lol API (free, no authentication)

## Local Development

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone https://github.com/jsplaystore/airport-data-visualization.git
cd airport-data-visualization
```

2. Install dependencies:
```bash
npm install
```

3. Run the local server:
```bash
npm start
```

4. Open browser to:
```
http://localhost:8000
```

## API Endpoint

### GET /api/aircraft

Returns array of currently tracked aircraft.

**Response Format:**
```json
[
  {
    "callsign": "UAL123",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "geo_altitude": 10668.0,
    "velocity": 257.22,
    "heading": 315.5,
    "vertical_rate": 0,
    "on_ground": false
  }
]
```

**Fields:**
- `callsign`: Flight number or aircraft identifier
- `latitude`: Decimal degrees
- `longitude`: Decimal degrees
- `geo_altitude`: Geometric altitude in meters
- `velocity`: Ground speed in meters/second
- `heading`: True heading in degrees (0-360)
- `vertical_rate`: Vertical speed in meters/second
- `on_ground`: Always false (filtered out)

## Deployment

### Deploy to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel --prod
```

### Environment Variables
None required - uses public API.

## Project Structure

```
airport-data-visualization/
├── api/
│   └── aircraft.js          # Serverless function for aircraft data
├── index.html               # Main HTML page
├── flight-viz.js            # Visualization logic
├── server.js                # Local development server
├── package.json             # Dependencies
├── vercel.json              # Vercel configuration
└── README.md                # This file
```

## Data Source

This project uses the free adsb.lol API:
- No API key required
- Rate limit: ~1 request per hub every 2 seconds
- Data freshness: Real-time ADS-B aircraft transponder data
- Coverage: Global (varies by receiver density)

**API Documentation**: https://api.adsb.lol/

## Performance

- **Update Frequency**: One hub refreshed every 2 seconds (full cycle ~28 seconds)
- **Aircraft Count**: Up to 1,280 aircraft simultaneously tracked
- **Latency**: Sub-second API response times
- **Caching**: 10-second edge cache with stale-while-revalidate

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Requires JavaScript enabled

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details

## Author

Jayesh Singhal

## Acknowledgments

- adsb.lol for providing free ADS-B data API
- ADS-B Exchange community for aircraft tracking infrastructure
- Vercel for serverless hosting platform
