# Google Maps + GEE Integration Setup

This guide explains how to use the Google Maps JavaScript API version of the Facility Risk Mapper with Google Earth Engine census tract boundaries.

## Architecture Overview

The refactored app uses:
- **Google Maps JavaScript API** for the base map and marker rendering
- **Google Earth Engine (GEE)** for US census tract boundaries from TIGER/2010/TRACT
- **Local CSV file** for facility data (easily replaceable with API call later)
- **Python script** to generate GEE tile URLs using service account authentication

## Prerequisites

1. **Google Maps API Key**
   - Get one from [Google Cloud Console](https://console.cloud.google.com/google/maps-apis)
   - Enable "Maps JavaScript API"

2. **Google Earth Engine Service Account**
   - Email: `882446104421-compute@developer.gserviceaccount.com`
   - Project ID: `msads-mba-autumn-2025-team-1`
   - Download service account JSON credentials

3. **Python 3** with Earth Engine Python API
   ```bash
   pip install earthengine-api
   ```

4. **Node.js** (already installed for the server)

## Setup Steps

### 1. Configure API Keys

Create your configuration file from the template:

```bash
cp config.json.example config.json
```

Edit `config.json` and add your Google Maps API key:

```json
{
  "googleMapsApiKey": "YOUR_ACTUAL_GOOGLE_MAPS_API_KEY",
  "geeProjectId": "msads-mba-autumn-2025-team-1",
  "geeServiceAccountEmail": "882446104421-compute@developer.gserviceaccount.com",
  "mapDefaults": {
    "center": { "lat": 39.8283, "lng": -98.5795 },
    "zoom": 5
  },
  "dataSource": {
    "type": "csv",
    "path": "../data/predictions/Data_Predictions_annual_risk_with_socioeconomic_2021.csv"
  }
}
```

**⚠️ Important:** `config.json` is in `.gitignore` - never commit it!

See [CONFIG_SETUP.md](CONFIG_SETUP.md) for detailed configuration options.

### 2. Add GEE Credentials

Copy your service account credentials to `gee_creds.json`:

```bash
cp gee_creds.json.example gee_creds.json
# Edit gee_creds.json with your actual service account private key
```

**⚠️ Important:** `gee_creds.json` is already in `.gitignore` - never commit it!

### 3. Generate GEE Tile URL

Run the setup script to authenticate with GEE and generate the census tract tile URL:

```bash
node scripts/setup_gee_layer.js
```

This will:
- Call `scripts/generate_gee_tiles.py` to authenticate with GEE
- Request a tile URL for TIGER/2010/TRACT census boundaries
- Automatically inject the URL into `public/app_gmaps.js`

### 4. Start the Server

```bash
npm start
```

### 5. Open the App

Navigate to: `http://localhost:3000/index_gmaps.html`

## File Structure

```
MSADS_Team1/
├── gee_creds.json              # GEE service account credentials (NOT in git)
├── gee_creds.json.example      # Template for credentials
├── public/
│   ├── index_gmaps.html        # Google Maps version (NEW)
│   ├── app_gmaps.js            # Google Maps JavaScript (NEW)
│   ├── styles.css              # Shared styles (reused)
│   ├── index.html              # Original MapLibre version
│   └── app.js                  # Original MapLibre JavaScript
├── scripts/
│   ├── generate_gee_tiles.py   # Python script to get GEE tile URLs (NEW)
│   └── setup_gee_layer.js      # Node script to run Python and update JS (NEW)
└── data/
    └── predictions/
        └── Data_Predictions_annual_risk_with_socioeconomic_2021.csv
```

## Facility Data Source

The app loads facility data from:
```
data/predictions/Data_Predictions_annual_risk_with_socioeconomic_2021.csv
```

### Easy API Replacement

To replace the CSV with an API call, modify `loadFacilityData()` in `app_gmaps.js`:

```javascript
// Current CSV approach:
const response = await fetch('../data/predictions/Data_Predictions_annual_risk_with_socioeconomic_2021.csv');

// Replace with API call:
const response = await fetch('/api/facilities');  // Your API endpoint
```

The data structure remains the same - just ensure your API returns the same fields.

## Features

### Map Markers
- **Color-coded by risk level:**
  - 🔴 High Risk
  - 🟡 Medium Risk
  - 🟢 Low Risk
- **Size proportional to risk index**
- **Clickable to show detailed facility information**

### Census Tract Boundaries
- Rendered as overlay from Google Earth Engine
- TIGER/2010/TRACT dataset
- Toggle visibility with checkbox
- Currently shows boundaries only (no choropleth)

### Filtering
- Filter facilities by risk level (High/Medium/Low)
- Facility count updates dynamically

### Theme Toggle
- Dark/Light mode
- Persists to localStorage
- Custom dark map style for Google Maps

## GEE Tile URL Regeneration

GEE tile URLs may expire after some time. To regenerate:

```bash
node scripts/setup_gee_layer.js
```

This will create a fresh tile URL and update `app_gmaps.js` automatically.

## Development Notes

### Why Local Python Script?

The Python script runs locally (not on a server) to generate the GEE tile URL. This is because:
- No hosted backend is set up yet
- GEE credentials are sensitive (service account key)
- Tile URLs are relatively stable and don't need frequent regeneration

### Future Enhancements

To host this properly, consider:
1. **Backend API endpoint** to generate GEE tiles server-side
2. **Token-based auth** instead of exposing service account credentials
3. **Caching** of tile URLs to reduce GEE API calls
4. **Database** for facility data instead of CSV

## Troubleshooting

### "pmtiles is not defined" or MapLibre errors
You're loading the wrong HTML file. Use `index_gmaps.html`, not `index.html`.

### "Failed to authenticate with GEE"
- Check that `gee_creds.json` exists and is valid
- Ensure Python Earth Engine API is installed: `pip install earthengine-api`
- Verify service account has Earth Engine access

### "Google Maps API key is invalid"
- Check the API key in `index_gmaps.html`
- Ensure "Maps JavaScript API" is enabled in Google Cloud Console
- Check API key restrictions (HTTP referrers, API restrictions)

### No census tracts visible
- Run `node scripts/setup_gee_layer.js` to generate tile URL
- Check browser console for GEE tile loading errors
- Ensure the "Show Census Tracts" checkbox is checked

### Facility markers not showing
- Check browser console for errors
- Verify CSV file exists at `data/predictions/Data_Predictions_annual_risk_with_socioeconomic_2021.csv`
- Check that CSV has `site latitude` and `site longitude` columns

## Side-by-Side Comparison

| Feature | Original (MapLibre) | New (Google Maps + GEE) |
|---------|-------------------|----------------------|
| **Base Map** | MapLibre GL JS | Google Maps JavaScript API |
| **Census Boundaries** | PMTiles (static files) | GEE TIGER/2010/TRACT (dynamic) |
| **Data Source** | NEI CSVs (multiple years) | Predictions CSV (2021) |
| **Markers** | Supercluster + GeoJSON | Native Google Maps Markers |
| **Styling** | MapLibre expressions | Google Maps styling |
| **Dependencies** | pmtiles.js, supercluster.js | Google Maps API only |

## Next Steps

1. **Add choropleth styling** to census tracts based on ADI data
2. **Host GEE tile generation** on a backend server
3. **Replace CSV** with database + API endpoint
4. **Add more GEE layers** (e.g., land use, demographics)
5. **Implement marker clustering** for better performance at low zoom

---

**Questions or Issues?** Check the browser console and server logs for detailed error messages.
