// Global flag to track protocol registration
let pmtilesProtocolRegistered = false;

// Wait for pmtiles to be available, then register protocol
function initializePMTilesProtocol() {
    return new Promise((resolve, reject) => {
        // If already registered, resolve immediately
        if (pmtilesProtocolRegistered) {
            console.log('✓ PMTiles protocol already registered');
            resolve(true);
            return;
        }

        // Poll for pmtiles availability (max 5 seconds)
        let attempts = 0;
        const maxAttempts = 50;
        const pollInterval = 100; // ms

        const checkPmtiles = setInterval(() => {
            attempts++;

            if (typeof pmtiles !== 'undefined' && pmtiles.Protocol) {
                clearInterval(checkPmtiles);

                try {
                    const protocol = new pmtiles.Protocol();

                    // Bind the tile method to the protocol instance (critical for 'this' context)
                    maplibregl.addProtocol('pmtiles', (params, abortController) => {
                        return protocol.tile(params, abortController);
                    });

                    pmtilesProtocolRegistered = true;
                    console.log('✓ PMTiles protocol registered successfully');
                    resolve(true);
                } catch (e) {
                    console.error('Failed to register PMTiles protocol:', e);
                    reject(e);
                }
            } else if (attempts >= maxAttempts) {
                clearInterval(checkPmtiles);
                const error = new Error('pmtiles library failed to load after 5 seconds');
                console.error(error);
                reject(error);
            }
        }, pollInterval);
    });
}

// Initialize MapLibre GL JS map
const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {},
        layers: []
    },
    center: [-98.5795, 39.8283],  // ⚠️ [lng, lat] - REVERSED from Leaflet!
    zoom: 5
});

// Add navigation controls
map.addControl(new maplibregl.NavigationControl(), 'top-right');

// Theme management
const TILE_SOURCES = {
    dark: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    light: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
};
let isDarkTheme = localStorage.getItem('theme') !== 'light';

function setTheme(dark) {
    isDarkTheme = dark;
    const body = document.body;
    const themeBtn = document.getElementById('theme-toggle');

    if (dark) {
        body.classList.remove('light-theme');
        themeBtn.textContent = '🌙 Light Mode';
        localStorage.setItem('theme', 'dark');
    } else {
        body.classList.add('light-theme');
        themeBtn.textContent = '☀️ Dark Mode';
        localStorage.setItem('theme', 'light');
    }

    // Update map basemap (only if map is loaded)
    if (!map.loaded || !map.loaded()) return;

    if (!map.getSource('basemap')) {
        // First initialization
        map.addSource('basemap', {
            type: 'raster',
            tiles: [TILE_SOURCES[dark ? 'dark' : 'light']],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
        });
        map.addLayer({
            id: 'basemap-layer',
            type: 'raster',
            source: 'basemap'
        }, map.getLayer('emissions-unclustered') ? 'emissions-unclustered' : undefined);
    } else {
        // Update tiles by rebuilding source
        map.removeLayer('basemap-layer');
        map.removeSource('basemap');
        map.addSource('basemap', {
            type: 'raster',
            tiles: [TILE_SOURCES[dark ? 'dark' : 'light']],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
        });
        map.addLayer({
            id: 'basemap-layer',
            type: 'raster',
            source: 'basemap'
        }, map.getLayer('emissions-unclustered') ? 'emissions-unclustered' : undefined);
    }
}

// Initialize emission layers
function initializeEmissionLayers() {
    // Source for unclustered points (zoom >= 12)
    map.addSource('emissions', {
        type: 'geojson',
        data: emissionsGeoJSON
    });

    // Source for clusters (zoom < 12)
    map.addSource('emissions-clusters', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });

    // Layer: Cluster circles
    map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'emissions-clusters',
        filter: ['has', 'point_count'],
        paint: {
            'circle-color': 'rgba(128, 128, 128, 0.6)',
            'circle-radius': 20,
            'circle-stroke-width': 2,
            'circle-stroke-color': 'rgba(255, 255, 255, 0.4)'
        }
    });

    // Layer: Cluster count labels
    map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'emissions-clusters',
        filter: ['has', 'point_count'],
        layout: {
            'text-field': ['to-string', ['get', 'point_count']],
            'text-size': 14
        },
        paint: {
            'text-color': '#ffffff'
        }
    });

    // Layer: Individual emission points (with zoom-based scaling)
    map.addLayer({
        id: 'emissions-unclustered',
        type: 'circle',
        source: 'emissions',
        filter: ['!', ['has', 'point_count']],
        paint: {
            'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                5, ['*', ['get', 'baseRadius'], 0.3],
                10, ['*', ['get', 'baseRadius'], 0.6],
                15, ['*', ['get', 'baseRadius'], 1.2]
            ],
            'circle-color': ['get', 'color'],
            'circle-stroke-color': 'rgba(255, 255, 255, 0.4)',
            'circle-stroke-width': 2,
            'circle-opacity': 0.7
        }
    });
}

// Initialize PMTiles sources for census boundaries
async function initializePMTilesSources() {
    try {
        // Wait for protocol to be registered before adding sources
        console.log('Waiting for PMTiles protocol to be registered...');
        await initializePMTilesProtocol();

        if (!map.getSource('block-groups-tiles')) {
            console.log('Adding block-groups-tiles source...');
            map.addSource('block-groups-tiles', {
                type: 'vector',
                url: 'pmtiles:///api/boundaries/block_groups.pmtiles',
                promoteId: 'GEOID'
            });
            console.log('✓ Block groups PMTiles source initialized');
        }

        if (!map.getSource('census-tracts-tiles')) {
            console.log('Adding census-tracts-tiles source...');
            map.addSource('census-tracts-tiles', {
                type: 'vector',
                url: 'pmtiles:///api/boundaries/census_tracts.pmtiles',
                promoteId: 'GEOID'
            });
            console.log('✓ Census tracts PMTiles source initialized');
        }
    } catch (e) {
        console.error('✗ Failed to initialize PMTiles sources:', e);
    }
}

// Initialize theme and layers when map loads
map.on('load', () => {
    setTheme(isDarkTheme);
    initializeEmissionLayers();
    initializePMTilesSources();
});

// Update clusters on zoom/move
map.on('zoom', updateClusters);
map.on('move', updateClusters);

// State
let currentYear = null;
let emissionsData = [];
let filteredData = [];
let emissionIndex = null;  // Supercluster instance
let emissionsGeoJSON = {
    type: 'FeatureCollection',
    features: []
};

// Filter state
let filters = {
    minEmissions: 0,
    siteType: ''
};

// ADI (Socioeconomic) state
let activeTab = 'emissions';
let adiLayer = null;
let adiDataMap = {};
let boundariesCache = {};
let currentAdiYear = '2023';
let currentAdiScoreType = 'ADI_NATRANK';
const ADI_MIN_ZOOM = 9;

// Load available years on startup
loadAvailableYears();

// Event listeners
document.getElementById('year-selector').addEventListener('change', handleYearChange);
document.getElementById('load-year-btn').addEventListener('click', loadYearData);
document.getElementById('upload-new-btn').addEventListener('click', () => {
    document.getElementById('upload-modal').style.display = 'flex';
});
document.getElementById('upload-cancel').addEventListener('click', () => {
    document.getElementById('upload-modal').style.display = 'none';
});
document.getElementById('file-input').addEventListener('change', handleFileSelect);
document.getElementById('upload-submit').addEventListener('click', handleUpload);
document.getElementById('apply-filters-btn').addEventListener('click', applyFilters);
document.getElementById('theme-toggle').addEventListener('click', () => setTheme(!isDarkTheme));

// Functions
async function loadAvailableYears() {
    console.log('Loading available years...');
    try {
        const response = await fetch('/api/nei/years');
        console.log('Response:', response);
        const data = await response.json();
        console.log('Data received:', data);

        const selector = document.getElementById('year-selector');
        console.log('Selector element:', selector);
        selector.innerHTML = '<option value="">Select a year...</option>';
        
        if (data.years.length === 0) {
            selector.innerHTML += '<option value="" disabled>No NEI data available</option>';
            showToast('No NEI data found. Please upload data.', 'error');
        } else {
            data.years.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                selector.appendChild(option);
            });
            
            // Auto-select most recent year
            selector.value = data.years[0];
            handleYearChange();
        }
    } catch (error) {
        showToast('Failed to load available years', 'error');
        console.error(error);
    }
}

async function handleYearChange() {
    const year = document.getElementById('year-selector').value;
    const loadBtn = document.getElementById('load-year-btn');
    const yearInfo = document.getElementById('year-info');
    
    if (!year) {
        loadBtn.disabled = true;
        yearInfo.style.display = 'none';
        return;
    }
    
    loadBtn.disabled = false;
    
    // Fetch year info
    try {
        const response = await fetch(`/api/nei/${year}/info`);
        const info = await response.json();
        
        document.getElementById('file-size').textContent = `Size: ${info.sizeFormatted}`;
        document.getElementById('row-count').textContent = `~${info.estimatedRows.toLocaleString()} rows`;
        yearInfo.style.display = 'block';
    } catch (error) {
        console.error('Failed to load year info:', error);
    }
}

async function loadYearData() {
    const year = document.getElementById('year-selector').value;
    if (!year) return;
    
    showToast(`Loading NEI data for ${year}...`, 'success');
    
    try {
        const response = await fetch(`/api/nei/${year}`);
        const csvText = await response.text();
        
        // Parse CSV
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            chunk: (results) => {
                // Filter to NOX only
                const noxData = results.data.filter(row => {
                    const pollutant = (row['pollutant code'] || row['pollutant_code'] || '').toUpperCase();
                    return pollutant === 'NOX';
                });
                
                emissionsData.push(...noxData);
            },
            complete: () => {
                currentYear = year;
                document.getElementById('current-year').textContent = year;
                document.getElementById('total-count').textContent = emissionsData.length.toLocaleString();

                // Populate site type filter
                populateSiteTypeFilter();

                // Apply filters and plot
                applyFilters();
                showToast(`Loaded ${emissionsData.length.toLocaleString()} NOX facilities for ${year}`, 'success');
            },
            error: (error) => {
                showToast('Error parsing NEI data', 'error');
                console.error(error);
            }
        });
    } catch (error) {
        showToast('Failed to load NEI data', 'error');
        console.error(error);
    }
}

function populateSiteTypeFilter() {
    const siteTypes = new Set();

    emissionsData.forEach(site => {
        const naicsDesc = site['primary naics description'] || site['primary_naics_description'];
        if (naicsDesc && naicsDesc.trim() !== '') {
            siteTypes.add(naicsDesc.trim());
        }
    });

    const selector = document.getElementById('site-type-filter');
    selector.innerHTML = '<option value="">All Site Types</option>';

    Array.from(siteTypes).sort().forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        selector.appendChild(option);
    });
}

function applyFilters() {
    filters.minEmissions = parseFloat(document.getElementById('min-emissions').value) || 0;
    filters.siteType = document.getElementById('site-type-filter').value;

    filteredData = emissionsData.filter(site => {
        const emissions = parseFloat(site['total emissions'] || site['total_emissions']) || 0;
        const naicsDesc = (site['primary naics description'] || site['primary_naics_description'] || '').trim();

        // Apply minimum emissions filter
        if (emissions < filters.minEmissions) return false;

        // Apply site type filter
        if (filters.siteType && naicsDesc !== filters.siteType) return false;

        return true;
    });

    plotEmissions();
}

function plotEmissions() {
    if (filteredData.length === 0) {
        emissionsGeoJSON.features = [];
        if (map.getSource('emissions')) {
            updateClusters();
        }
        document.getElementById('facility-count').textContent = '0';
        return;
    }

    // Convert data to GeoJSON features
    const features = [];
    filteredData.forEach(site => {
        const lat = parseFloat(site['site latitude'] || site['site_latitude']);
        const lng = parseFloat(site['site longitude'] || site['site_longitude']);
        const reported = parseFloat(site['total emissions'] || site['total_emissions']);
        const measured = site['measured_emissions'] ? parseFloat(site['measured_emissions']) : null;

        if (isNaN(lat) || isNaN(lng) || isNaN(reported)) return;

        const color = measured ? getReportingColor(reported, measured) : '#808080';
        const radius = getCircleRadius(measured || reported);

        features.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [lng, lat]  // ⚠️ [lng, lat] for MapLibre!
            },
            properties: {
                ...site,
                color: color,
                baseRadius: radius,
                emissions: measured || reported
            }
        });
    });

    emissionsGeoJSON.features = features;

    // Initialize Supercluster
    emissionIndex = new Supercluster({
        radius: 25,        // Match current maxClusterRadius
        maxZoom: 11,       // One less than disableClusteringAtZoom (12)
        minPoints: 2
    });
    emissionIndex.load(features);

    // Update map
    if (map.getSource('emissions')) {
        updateClusters();
    }
    document.getElementById('facility-count').textContent = features.length.toLocaleString();
}

function updateClusters() {
    // Safety check: ensure sources exist
    if (!map.getSource('emissions') || !map.getSource('emissions-clusters')) {
        return;
    }

    const zoom = Math.floor(map.getZoom());
    const bounds = map.getBounds();

    if (zoom >= 12) {
        // Show all individual points
        map.getSource('emissions').setData(emissionsGeoJSON);
        map.getSource('emissions-clusters').setData({
            type: 'FeatureCollection',
            features: []
        });
    } else if (emissionIndex) {
        // Show clusters
        const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
        const clusters = emissionIndex.getClusters(bbox, zoom);

        map.getSource('emissions-clusters').setData({
            type: 'FeatureCollection',
            features: clusters
        });
        map.getSource('emissions').setData({
            type: 'FeatureCollection',
            features: []
        });
    }
}

function getReportingColor(reported, measured) {
    if (!reported || !measured || reported === 0) return '#808080';
    
    const percentDiff = Math.abs((measured - reported) / reported * 100);
    
    if (percentDiff <= 20) return '#00ff88';
    if (percentDiff <= 50) return '#ffb84d';
    return '#ff4757';
}

function getCircleRadius(emissions) {
    if (!emissions || emissions <= 0) return 5;

    const minRadius = 5;
    const maxRadius = 30;
    const minEmissions = 1;
    const maxEmissions = 100000;

    const logScale = Math.log(emissions / minEmissions) / Math.log(maxEmissions / minEmissions);
    return minRadius + (maxRadius - minRadius) * Math.max(0, Math.min(1, logScale));
}

// Popup handlers for emissions
map.on('click', 'emissions-unclustered', (e) => {
    const feature = e.features[0];
    const props = feature.properties;

    const facilityName = props['site name'] || props['site_name'] || 'Unknown Facility';
    const reported = parseFloat(props['total emissions'] || props['total_emissions']);
    const measured = props['measured_emissions'] ? parseFloat(props['measured_emissions']) : null;

    let popupContent = `
        <div style="font-family: 'IBM Plex Mono', monospace; font-size: 13px; min-width: 200px;">
            <div class="popup-facility-name">${facilityName}</div>
            <div class="popup-data-row">
                <span class="popup-label">Reported:</span> ${reported.toLocaleString()} tons/yr
            </div>
    `;

    if (measured) {
        popupContent += `
            <div class="popup-data-row" style="margin-bottom: 8px;">
                <span class="popup-label">Measured:</span> ${measured.toLocaleString()} tons/yr
            </div>
        `;
    } else {
        popupContent += `
            <div class="popup-label" style="margin-bottom: 8px; font-size: 11px;">
                Measured: Not available
            </div>
        `;
    }

    // Serialize site data for modal
    const siteData = JSON.stringify(props).replace(/"/g, '&quot;');
    popupContent += `
            <button onclick="showSiteDetails(${siteData})"
                    class="popup-more-info-btn">
                📋 More Info
            </button>
        </div>
    `;

    new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(popupContent)
        .addTo(map);
});

// Cluster expansion on click
map.on('click', 'clusters', (e) => {
    const features = map.queryRenderedFeatures(e.point, {
        layers: ['clusters']
    });

    const clusterId = features[0].properties.cluster_id;
    const zoom = emissionIndex.getClusterExpansionZoom(clusterId);

    map.easeTo({
        center: features[0].geometry.coordinates,
        zoom: zoom
    });
});

// Change cursor on hover
map.on('mouseenter', 'emissions-unclustered', () => {
    map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'emissions-unclustered', () => {
    map.getCanvas().style.cursor = '';
});
map.on('mouseenter', 'clusters', () => {
    map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'clusters', () => {
    map.getCanvas().style.cursor = '';
});

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        document.getElementById('file-name').textContent = file.name;
    }
}

async function handleUpload() {
    const year = document.getElementById('upload-year').value;
    const file = document.getElementById('file-input').files[0];
    
    if (!year || !file) {
        showToast('Please provide both year and file', 'error');
        return;
    }
    
    showToast('Validating and uploading...', 'success');
    
    const formData = new FormData();
    formData.append('year', year);
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/nei/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(`NEI data for ${year} uploaded successfully!`, 'success');
            document.getElementById('upload-modal').style.display = 'none';
            document.getElementById('upload-year').value = '';
            document.getElementById('file-input').value = '';
            document.getElementById('file-name').textContent = '';
            
            // Reload available years
            loadAvailableYears();
        } else {
            showToast(result.error || 'Upload failed', 'error');
            
            if (result.missingColumns) {
                console.error('Missing columns:', result.missingColumns);
                console.error('Required columns:', result.requiredColumns);
            }
        }
    } catch (error) {
        showToast('Upload failed', 'error');
        console.error(error);
    }
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Site details modal
function showSiteDetails(site) {
    const modal = document.getElementById('site-details-modal');
    const content = document.getElementById('site-details-content');

    const facilityName = site['site name'] || site['site_name'] || 'Unknown';
    const facilityId = site['eis facility id'] || site['eis_facility_id'] || 'N/A';
    const state = site['state'] || 'N/A';
    const county = site['county'] || 'N/A';
    const city = site['city'] || 'N/A';
    const address = site['Street Address'] || 'N/A';
    const zipcode = site['site zipcode'] || site['site_zipcode'] || 'N/A';
    const naicsCode = site['primary naics code'] || site['primary_naics_code'] || 'N/A';
    const naicsDesc = site['primary naics description'] || site['primary_naics_description'] || 'N/A';
    const lat = site['site latitude'] || site['site_latitude'] || 'N/A';
    const lng = site['site longitude'] || site['site_longitude'] || 'N/A';
    const reported = parseFloat(site['total emissions'] || site['total_emissions']) || 0;
    const measured = site['measured_emissions'] ? parseFloat(site['measured_emissions']) : null;

    let detailsHTML = `
        <div style="margin-bottom: 16px;">
            <div style="font-size: 16px; font-weight: 600; color: var(--accent-green); margin-bottom: 12px;">${facilityName}</div>
        </div>

        <div style="display: grid; grid-template-columns: 140px 1fr; gap: 8px; margin-bottom: 20px;">
            <div style="color: var(--text-secondary);">Facility ID:</div>
            <div style="color: var(--text-primary);">${facilityId}</div>

            <div style="color: var(--text-secondary);">Address:</div>
            <div style="color: var(--text-primary);">${address}</div>

            <div style="color: var(--text-secondary);">City:</div>
            <div style="color: var(--text-primary);">${city}</div>

            <div style="color: var(--text-secondary);">County:</div>
            <div style="color: var(--text-primary);">${county}</div>

            <div style="color: var(--text-secondary);">State:</div>
            <div style="color: var(--text-primary);">${state}</div>

            <div style="color: var(--text-secondary);">Zip Code:</div>
            <div style="color: var(--text-primary);">${zipcode}</div>

            <div style="color: var(--text-secondary);">Coordinates:</div>
            <div style="color: var(--text-primary);">${lat}, ${lng}</div>
        </div>

        <div style="border-top: 1px solid var(--border); padding-top: 16px; margin-bottom: 16px;">
            <div style="font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Industry Classification</div>
            <div style="color: var(--text-secondary); margin-bottom: 4px;">NAICS Code: <span style="color: var(--text-primary);">${naicsCode}</span></div>
            <div style="color: var(--text-primary);">${naicsDesc}</div>
        </div>

        <div style="border-top: 1px solid var(--border); padding-top: 16px;">
            <div style="font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">NOx Emissions</div>
            <div style="color: var(--text-secondary); margin-bottom: 4px;">Reported: <span style="color: var(--text-primary); font-weight: 600;">${reported.toLocaleString()} tons/year</span></div>
    `;

    if (measured) {
        const percentDiff = ((measured - reported) / reported * 100).toFixed(1);
        const diffColor = Math.abs(percentDiff) > 50 ? 'var(--accent-red)' : Math.abs(percentDiff) > 20 ? 'var(--accent-amber)' : 'var(--accent-green)';
        detailsHTML += `
            <div style="color: var(--text-secondary);">Measured: <span style="color: var(--text-primary); font-weight: 600;">${measured.toLocaleString()} tons/year</span></div>
            <div style="color: var(--text-secondary);">Difference: <span style="color: ${diffColor}; font-weight: 600;">${percentDiff > 0 ? '+' : ''}${percentDiff}%</span></div>
        `;
    } else {
        detailsHTML += `<div style="color: var(--text-secondary); font-size: 11px;">Measured data not available</div>`;
    }

    detailsHTML += `</div>`;

    content.innerHTML = detailsHTML;
    modal.style.display = 'flex';
}

document.getElementById('site-details-close').addEventListener('click', () => {
    document.getElementById('site-details-modal').style.display = 'none';
});

// ADI Color scale function
function getAdiColor(adiScore, scoreType = 'ADI_NATRANK') {
    if (!adiScore || isNaN(adiScore)) return '#808080';

    if (scoreType === 'ADI_NATRANK') {
        // National rank (1-100)
        if (adiScore <= 20) return '#22c55e';
        if (adiScore <= 40) return '#84cc16';
        if (adiScore <= 60) return '#fbbf24';
        if (adiScore <= 80) return '#fb923c';
        return '#ef4444';
    } else {
        // State decile (1-10)
        const colors = ['#22c55e', '#22c55e', '#84cc16', '#84cc16', '#fbbf24',
                        '#fbbf24', '#fb923c', '#fb923c', '#ef4444', '#ef4444'];
        return colors[Math.min(9, Math.max(0, adiScore - 1))];
    }
}

// Load Illinois census boundaries
// Load and display ADI layer (refactored for PMTiles)
let adiLoadRetries = 0;
const MAX_ADI_RETRIES = 10;

async function loadAdiLayer() {
    const year = document.getElementById('adi-year-selector').value;
    const scoreType = document.getElementById('adi-score-type').value;

    if (!year) {
        showToast('Please select an ADI year', 'error');
        return;
    }

    if (map.getZoom() < ADI_MIN_ZOOM) {
        showToast(`Zoom in to level ${ADI_MIN_ZOOM}+ to see ADI data`, 'error');
        return;
    }

    // Ensure PMTiles sources are loaded
    if (!map.getSource('block-groups-tiles')) {
        if (adiLoadRetries >= MAX_ADI_RETRIES) {
            showToast('Failed to load census boundaries. Please refresh the page.', 'error');
            console.error('PMTiles sources failed to initialize after 10 retries');
            adiLoadRetries = 0;
            return;
        }

        adiLoadRetries++;
        console.log(`Waiting for PMTiles sources... (attempt ${adiLoadRetries}/${MAX_ADI_RETRIES})`);

        // Try to initialize sources if not already in progress
        if (adiLoadRetries === 1) {
            console.log('Attempting to initialize PMTiles sources...');
            initializePMTilesSources().catch(e => console.error('Source init failed:', e));
        }

        showToast('Census boundaries are still loading, please wait...', 'error');
        setTimeout(() => loadAdiLayer(), 1000);
        return;
    }

    // Reset retry counter on success
    adiLoadRetries = 0;
    showToast(`Loading ADI data for ${year}...`, 'success');

    try {
        // Step 1: Fetch and parse ADI CSV
        const adiResponse = await fetch(`/api/adi/${year}`);
        if (!adiResponse.ok) throw new Error(`ADI data for ${year} not found`);
        const adiCsvText = await adiResponse.text();

        // Parse CSV into map
        adiDataMap = {};
        await new Promise((resolve) => {
            Papa.parse(adiCsvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    results.data.forEach(row => {
                        // Support "FIPS", "geoid10", or "GEOID" column names
                        const geoid = row.FIPS || row.geoid10 || row.GEOID;
                        const natRank = parseInt(row.ADI_NATRANK);
                        const stateRank = parseInt(row.ADI_STATERNK);

                        if (geoid && !isNaN(natRank)) {
                            adiDataMap[geoid] = {
                                ADI_NATRANK: natRank,
                                ADI_STATERNK: stateRank
                            };
                        }
                    });
                    resolve();
                }
            });
        });

        console.log(`Loaded ${Object.keys(adiDataMap).length} ADI records`);

        // Step 2: Apply feature-state to PMTiles features
        Object.entries(adiDataMap).forEach(([geoid, scores]) => {
            map.setFeatureState(
                { source: 'block-groups-tiles', sourceLayer: 'block_groups', id: geoid },
                {
                    adiNatRank: scores.ADI_NATRANK,
                    adiStateRank: scores.ADI_STATERNK
                }
            );
        });

        // Step 3: Create/update fill layer with data-driven styling
        if (!map.getLayer('adi-fill')) {
            map.addLayer({
                id: 'adi-fill',
                type: 'fill',
                source: 'block-groups-tiles',
                'source-layer': 'block_groups',
                paint: {
                    'fill-color': [
                        'case',
                        // No data
                        ['==', ['feature-state', scoreType === 'ADI_NATRANK' ? 'adiNatRank' : 'adiStateRank'], null],
                        '#808080',

                        // National Rank (1-100)
                        ['all', ['==', scoreType, 'ADI_NATRANK'], ['<=', ['feature-state', 'adiNatRank'], 20]], '#22c55e',
                        ['all', ['==', scoreType, 'ADI_NATRANK'], ['<=', ['feature-state', 'adiNatRank'], 40]], '#84cc16',
                        ['all', ['==', scoreType, 'ADI_NATRANK'], ['<=', ['feature-state', 'adiNatRank'], 60]], '#fbbf24',
                        ['all', ['==', scoreType, 'ADI_NATRANK'], ['<=', ['feature-state', 'adiNatRank'], 80]], '#fb923c',
                        ['==', scoreType, 'ADI_NATRANK'], '#ef4444',

                        // State Rank (1-10)
                        ['<=', ['feature-state', 'adiStateRank'], 2], '#22c55e',
                        ['<=', ['feature-state', 'adiStateRank'], 4], '#84cc16',
                        ['<=', ['feature-state', 'adiStateRank'], 6], '#fbbf24',
                        ['<=', ['feature-state', 'adiStateRank'], 8], '#fb923c',
                        '#ef4444'
                    ],
                    'fill-opacity': 0.6
                }
            }, map.getLayer('emissions-unclustered') ? 'emissions-unclustered' : undefined);

            // Add outline layer
            map.addLayer({
                id: 'adi-outline',
                type: 'line',
                source: 'block-groups-tiles',
                'source-layer': 'block_groups',
                paint: {
                    'line-color': 'white',
                    'line-width': 0.5,
                    'line-opacity': 0.5
                }
            }, map.getLayer('emissions-unclustered') ? 'emissions-unclustered' : undefined);
        }

        // Set visibility
        const visibility = document.getElementById('show-adi-layer').checked ? 'visible' : 'none';
        map.setLayoutProperty('adi-fill', 'visibility', visibility);
        map.setLayoutProperty('adi-outline', 'visibility', visibility);

        // Update count
        document.getElementById('adi-block-count').textContent =
            `~${Object.keys(adiDataMap).length.toLocaleString()} block groups`;

        currentAdiYear = year;
        currentAdiScoreType = scoreType;

        showToast(`ADI layer loaded successfully`, 'success');

    } catch (error) {
        showToast('Failed to load ADI layer', 'error');
        console.error(error);
    }
}

// ADI popup handler (updated for PMTiles vector tiles)
map.on('click', 'adi-fill', (e) => {
    if (e.features.length === 0) return;

    const feature = e.features[0];
    const geoid = feature.id;
    const adiData = adiDataMap[geoid];
    const name = feature.properties.NAME || 'Unknown';

    if (!adiData) {
        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`<div class="popup-facility-name">No ADI Data</div>
                     <div class="popup-data-row">GEOID: ${geoid}</div>`)
            .addTo(map);
        return;
    }

    new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
            <div class="popup-facility-name">${name}</div>
            <div class="popup-data-row">GEOID: ${geoid}</div>
            <div class="popup-data-row">
                <span class="popup-label">ADI National Rank:</span> ${adiData.ADI_NATRANK}/100
            </div>
            <div class="popup-data-row">
                <span class="popup-label">ADI State Rank:</span> ${adiData.ADI_STATERNK}/10
            </div>
        `)
        .addTo(map);
});

map.on('mouseenter', 'adi-fill', () => {
    map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'adi-fill', () => {
    map.getCanvas().style.cursor = '';
});

// Tab switching
function switchTab(tabName) {
    activeTab = tabName;

    // Update tab button active states
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab content visibility
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });

    // Manage layers using MapLibre visibility
    if (tabName === 'emissions') {
        // Hide ADI layers
        if (map.getLayer('adi-fill')) {
            map.setLayoutProperty('adi-fill', 'visibility', 'none');
            map.setLayoutProperty('adi-outline', 'visibility', 'none');
        }
        // Show emissions layers
        if (map.getLayer('emissions-unclustered')) {
            map.setLayoutProperty('emissions-unclustered', 'visibility', 'visible');
            map.setLayoutProperty('clusters', 'visibility', 'visible');
            map.setLayoutProperty('cluster-count', 'visibility', 'visible');
        }
    } else if (tabName === 'socioeconomic') {
        // Show/hide ADI based on zoom and checkbox
        if (map.getLayer('adi-fill')) {
            const shouldShowAdi = map.getZoom() >= ADI_MIN_ZOOM &&
                                  document.getElementById('show-adi-layer').checked;
            map.setLayoutProperty('adi-fill', 'visibility', shouldShowAdi ? 'visible' : 'none');
            map.setLayoutProperty('adi-outline', 'visibility', shouldShowAdi ? 'visible' : 'none');
        }

        // Emissions controlled by overlay checkbox
        const shouldShowEmissions = document.getElementById('show-emissions-overlay').checked;
        if (map.getLayer('emissions-unclustered')) {
            const vis = shouldShowEmissions ? 'visible' : 'none';
            map.setLayoutProperty('emissions-unclustered', 'visibility', vis);
            map.setLayoutProperty('clusters', 'visibility', vis);
            map.setLayoutProperty('cluster-count', 'visibility', vis);
        }
    }

    updateLegend(tabName);
}

// Dynamic legend update
function updateLegend(tab) {
    const legend = document.getElementById('map-legend');

    if (tab === 'emissions') {
        legend.innerHTML = `
            <div class="legend-title">Under-Reporting Status</div>
            <div class="legend-item">
                <div class="legend-circle green"></div>
                <div class="legend-text">Within ±20%</div>
            </div>
            <div class="legend-item">
                <div class="legend-circle amber"></div>
                <div class="legend-text">±20-50% difference</div>
            </div>
            <div class="legend-item">
                <div class="legend-circle red"></div>
                <div class="legend-text">>50% discrepancy</div>
            </div>
            <div class="legend-item" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border);">
                <div class="legend-circle" style="background: #808080;"></div>
                <div class="legend-text">No measured data</div>
            </div>
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
                <button id="theme-toggle" class="btn-secondary" style="width: 100%; font-size: 11px; padding: 8px;">
                    ${isDarkTheme ? '🌙 Light Mode' : '☀️ Dark Mode'}
                </button>
            </div>
        `;
    } else if (tab === 'socioeconomic') {
        const scoreType = document.getElementById('adi-score-type')?.value || 'ADI_NATRANK';

        legend.innerHTML = `
            <div class="legend-title">Area Deprivation Index</div>
            <div style="font-size: 10px; margin-bottom: 12px; color: var(--text-secondary);">
                ${scoreType === 'ADI_NATRANK' ? 'National Percentile (1-100)' : 'State Decile (1-10)'}
            </div>
            ${scoreType === 'ADI_NATRANK' ? `
                <div class="legend-item">
                    <div class="legend-circle" style="background: #22c55e;"></div>
                    <div class="legend-text">1-20 (Least deprived)</div>
                </div>
                <div class="legend-item">
                    <div class="legend-circle" style="background: #84cc16;"></div>
                    <div class="legend-text">21-40</div>
                </div>
                <div class="legend-item">
                    <div class="legend-circle" style="background: #fbbf24;"></div>
                    <div class="legend-text">41-60</div>
                </div>
                <div class="legend-item">
                    <div class="legend-circle" style="background: #fb923c;"></div>
                    <div class="legend-text">61-80</div>
                </div>
                <div class="legend-item">
                    <div class="legend-circle" style="background: #ef4444;"></div>
                    <div class="legend-text">81-100 (Most deprived)</div>
                </div>
            ` : `
                <div class="legend-item">
                    <div class="legend-circle" style="background: #22c55e;"></div>
                    <div class="legend-text">Decile 1-2 (Low)</div>
                </div>
                <div class="legend-item">
                    <div class="legend-circle" style="background: #84cc16;"></div>
                    <div class="legend-text">Decile 3-4</div>
                </div>
                <div class="legend-item">
                    <div class="legend-circle" style="background: #fbbf24;"></div>
                    <div class="legend-text">Decile 5-6</div>
                </div>
                <div class="legend-item">
                    <div class="legend-circle" style="background: #fb923c;"></div>
                    <div class="legend-text">Decile 7-8</div>
                </div>
                <div class="legend-item">
                    <div class="legend-circle" style="background: #ef4444;"></div>
                    <div class="legend-text">Decile 9-10 (High)</div>
                </div>
            `}
            <div class="legend-item" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border);">
                <div class="legend-circle" style="background: #808080;"></div>
                <div class="legend-text">No data</div>
            </div>
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
                <button id="theme-toggle" class="btn-secondary" style="width: 100%; font-size: 11px; padding: 8px;">
                    ${isDarkTheme ? '🌙 Light Mode' : '☀️ Dark Mode'}
                </button>
            </div>
        `;
    }

    // Re-attach theme toggle listener
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => setTheme(!isDarkTheme));
    }
}

// Initialize legend
updateLegend('emissions');

// Tab button event listeners
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ADI control event listeners
document.getElementById('load-adi-btn').addEventListener('click', loadAdiLayer);

document.getElementById('show-adi-layer').addEventListener('change', (e) => {
    if (!map.getLayer('adi-fill')) return;

    if (e.target.checked) {
        if (map.getZoom() >= ADI_MIN_ZOOM) {
            map.setLayoutProperty('adi-fill', 'visibility', 'visible');
            map.setLayoutProperty('adi-outline', 'visibility', 'visible');
        } else {
            showToast(`Zoom in to level ${ADI_MIN_ZOOM}+ to see ADI data`, 'error');
            e.target.checked = false;
        }
    } else {
        map.setLayoutProperty('adi-fill', 'visibility', 'none');
        map.setLayoutProperty('adi-outline', 'visibility', 'none');
    }
});

document.getElementById('show-emissions-overlay').addEventListener('change', (e) => {
    if (!map.getLayer('emissions-unclustered')) return;

    const visibility = e.target.checked ? 'visible' : 'none';
    map.setLayoutProperty('emissions-unclustered', 'visibility', visibility);
    map.setLayoutProperty('clusters', 'visibility', visibility);
    map.setLayoutProperty('cluster-count', 'visibility', visibility);
});

document.getElementById('adi-score-type').addEventListener('change', () => {
    updateLegend('socioeconomic');
    // Reload layer if already loaded
    if (map.getLayer('adi-fill') && activeTab === 'socioeconomic') {
        loadAdiLayer();
    }
});

// Zoom-based ADI layer visibility (merged into main zoom handler)
// Note: Main zoom handler at line 145 already handles cluster updates
map.on('zoom', () => {
    const zoom = map.getZoom();

    // ADI layer zoom threshold
    if (activeTab === 'socioeconomic' && map.getLayer('adi-fill')) {
        const shouldShow = zoom >= ADI_MIN_ZOOM &&
                          document.getElementById('show-adi-layer').checked;

        const currentVisibility = map.getLayoutProperty('adi-fill', 'visibility');
        const newVisibility = shouldShow ? 'visible' : 'none';

        if (currentVisibility !== newVisibility) {
            map.setLayoutProperty('adi-fill', 'visibility', newVisibility);
            map.setLayoutProperty('adi-outline', 'visibility', newVisibility);

            if (shouldShow && currentVisibility === 'none') {
                showToast('ADI layer visible', 'success');
            } else if (!shouldShow && zoom < ADI_MIN_ZOOM) {
                showToast('Zoom in to see ADI data', 'error');
            }
        }
    }
});
