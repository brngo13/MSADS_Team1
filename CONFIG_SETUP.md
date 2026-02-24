# Configuration Setup Guide

The app now uses a JSON configuration file instead of hardcoded values in HTML/JavaScript.

## Quick Setup

```bash
# 1. Copy the example config
cp config.json.example config.json

# 2. Edit config.json with your API keys
{
  "googleMapsApiKey": "YOUR_ACTUAL_GOOGLE_MAPS_API_KEY",
  "geeProjectId": "msads-mba-autumn-2025-team-1",
  "geeServiceAccountEmail": "882446104421-compute@developer.gserviceaccount.com",
  "mapDefaults": {
    "center": {
      "lat": 39.8283,
      "lng": -98.5795
    },
    "zoom": 5
  },
  "dataSource": {
    "type": "csv",
    "path": "../data/predictions/Data_Predictions_annual_risk_with_socioeconomic_2021.csv"
  }
}

# 3. Start the server
npm start

# 4. Open the app
# http://localhost:3000/index_gmaps.html
```

## Configuration Reference

### `googleMapsApiKey` (required)
Your Google Maps JavaScript API key from [Google Cloud Console](https://console.cloud.google.com/google/maps-apis).

```json
"googleMapsApiKey": "AIzaSyB..."
```

### `geeProjectId` (for GEE tiles)
Your Google Earth Engine project ID.

```json
"geeProjectId": "msads-mba-autumn-2025-team-1"
```

### `geeServiceAccountEmail` (for GEE tiles)
Your GEE service account email (used by Python script only, not exposed to client).

```json
"geeServiceAccountEmail": "882446104421-compute@developer.gserviceaccount.com"
```

### `mapDefaults`
Default map center and zoom level.

```json
"mapDefaults": {
  "center": {
    "lat": 39.8283,   // Latitude (US center)
    "lng": -98.5795   // Longitude (US center)
  },
  "zoom": 5           // Initial zoom level (1-20)
}
```

### `dataSource`
Configure where facility data comes from.

**Option 1: CSV file** (current default)
```json
"dataSource": {
  "type": "csv",
  "path": "../data/predictions/Data_Predictions_annual_risk_with_socioeconomic_2021.csv"
}
```

**Option 2: API endpoint** (for future backend)
```json
"dataSource": {
  "type": "api",
  "apiEndpoint": "/api/facilities?year=2021"
}
```

## How It Works

### 1. Config Loading (HTML)
When the page loads, it fetches `/api/config`:

```javascript
fetch('/api/config')
    .then(response => response.json())
    .then(config => {
        window.APP_CONFIG = config;
        // Load Google Maps API with key from config
    });
```

### 2. Server Endpoint
`server/server.js` serves the config at `/api/config`:

```javascript
app.get('/api/config', (req, res) => {
    const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    res.json({
        googleMapsApiKey: config.googleMapsApiKey,
        mapDefaults: config.mapDefaults,
        dataSource: config.dataSource
        // Note: GEE credentials NOT sent to client
    });
});
```

### 3. App Usage (JavaScript)
`app_gmaps.js` uses the config:

```javascript
// Map initialization
const config = window.APP_CONFIG || {};
const mapDefaults = config.mapDefaults;
map = new google.maps.Map(document.getElementById('map'), {
    center: mapDefaults.center,
    zoom: mapDefaults.zoom
});

// Data loading
const dataSource = config.dataSource;
const dataUrl = dataSource.type === 'api'
    ? dataSource.apiEndpoint
    : dataSource.path;
```

## Security Notes

✅ **`config.json` is in `.gitignore`** - Your API keys won't be committed to Git

✅ **GEE credentials are separate** - Service account private keys stay in `gee_creds.json` (also in .gitignore)

⚠️ **Google Maps API key is public** - This is normal for client-side web apps. Restrict your key in Google Cloud Console:
- HTTP referrers: `localhost:3000`, `yourdomain.com`
- API restrictions: Only "Maps JavaScript API"

## Switching to API Data Source

When you build a backend API for facility data:

1. Update `config.json`:
```json
"dataSource": {
  "type": "api",
  "apiEndpoint": "/api/facilities"
}
```

2. Create the endpoint in `server/server.js`:
```javascript
app.get('/api/facilities', (req, res) => {
    // Query database
    // Return same JSON structure as CSV
    res.json(facilities);
});
```

3. No changes needed in `app_gmaps.js` - it automatically uses the API!

## Environment-Specific Configs

You can maintain different configs for different environments:

```bash
# Development
config.json

# Production
config.production.json

# Staging
config.staging.json
```

Then modify the server to load based on `NODE_ENV`:

```javascript
const configFile = process.env.NODE_ENV === 'production'
    ? 'config.production.json'
    : 'config.json';
```

## Troubleshooting

### "Configuration file not found"
```
Error: Please create config.json from config.json.example
```

**Solution:** Copy the example file and add your API key:
```bash
cp config.json.example config.json
```

### "Failed to load app configuration"
Check browser console for details. Common issues:
- Server not running (`npm start`)
- Malformed JSON in `config.json` (use a JSON validator)
- Server port mismatch (default: 3000)

### "This page can't load Google Maps correctly"
Your API key is invalid or not configured. Check:
1. `config.json` has correct `googleMapsApiKey`
2. API key is enabled in Google Cloud Console
3. "Maps JavaScript API" is enabled
4. Billing is enabled (Google requires it even for free tier)

### Map doesn't center correctly
Check `mapDefaults.center` coordinates:
- `lat`: -90 to 90 (North/South)
- `lng`: -180 to 180 (East/West)

Example (Chicago):
```json
"center": { "lat": 41.8781, "lng": -87.6298 }
```

## Comparison: Old vs New

| Before | After |
|--------|-------|
| Edit HTML file | Edit config.json |
| Hardcoded API key in code | API key in config |
| Hardcoded center/zoom | Configurable defaults |
| CSV path in JavaScript | Configurable data source |
| API replacement requires code edit | API switch via config |

## Next Steps

1. ✅ Create `config.json` from example
2. ✅ Add Google Maps API key
3. ✅ Start server and test
4. Later: Switch `dataSource.type` to `"api"` when ready
5. Later: Create environment-specific configs

---

**Questions?** See [GOOGLE_MAPS_SETUP.md](GOOGLE_MAPS_SETUP.md) for full Google Maps + GEE setup guide.
