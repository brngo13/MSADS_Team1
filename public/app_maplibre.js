/**
 * Facility Risk Mapper - MapLibre Implementation
 * Uses GeoJSON for census boundaries and ADI choropleth
 *
 * NOTE: Common utilities (data loading, filters, colors) are in app_common.js
 * This file contains only MapLibre-specific implementations
 */

// Initialize MapLibre GL JS map
const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {},
        layers: []
    },
    center: [-89.3985, 40.6331],  // Illinois center (lng, lat - REVERSED order!)
    zoom: 7
});

// Add navigation controls
map.addControl(new maplibregl.NavigationControl(), 'top-right');

// MapLibre-specific: Basemap tile sources
const TILE_SOURCES = {
    dark: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    light: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
};

/**
 * Update map theme (called by app_common.js setTheme)
 * MapLibre-specific theme update
 */
function updateMapTheme(dark) {
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

// Initialize theme and layers when map loads
map.on('load', () => {
    setTheme(isDarkTheme); // From app_common.js
    initializeEmissionLayers();
    loadFacilityData(); // From app_common.js - loads 2021 predictions data
});

// Update clusters on zoom/move
map.on('zoom', updateClusters);
map.on('move', updateClusters);

// MapLibre-specific state (emissions are in app_common.js)
let emissionIndex = null;  // Supercluster instance
let emissionsGeoJSON = {
    type: 'FeatureCollection',
    features: []
};

// MapLibre-specific event listeners
// (Common listeners are in app_common.js)
document.getElementById('load-social-data').addEventListener('click', loadAdiLayer);

// Data loading functions are in app_common.js
// loadAvailableYears, loadFacilityData, handleYearChange, loadYearData removed

// loadYearData_unused, populateSiteTypeFilter, and applyFilters removed (in app_common.js)

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
        const emissions = parseFloat(site['total emissions'] || site['total_emissions']);
        const riskLevel = site['Risk Level'] || site['risk_level'] || 'Unknown';

        if (isNaN(lat) || isNaN(lng) || isNaN(emissions)) return;

        // Use color functions from app_common.js
        const color = getRiskColor(riskLevel);
        const radius = getCircleRadius(emissions);

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
                emissions: emissions,
                riskLevel: riskLevel
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

// Color and radius functions are in app_common.js

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

// handleFileSelect, handleUpload, and showToast removed (old UI not in unified index.html)
// showToast is in app_common.js

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

// Site details modal event listener removed (using unified index.html facility modal now)

// ADI color functions are in app_common.js

// Load and display ADI layer using GeoJSON
async function loadAdiLayer() {
    const year = document.getElementById('social-year-selector').value;
    const rankType = document.getElementById('adi-rank-type-selector').value;

    if (!year) {
        showToast('Please select a year', 'error');
        return;
    }

    showToast(`Loading ADI data for ${year}...`, 'success');

    try {
        // Step 1: Fetch and parse ADI CSV
        const adiResponse = await fetch(`/api/adi/${year}`);
        if (!adiResponse.ok) throw new Error(`ADI data for ${year} not found`);
        const adiCsvText = await adiResponse.text();

        // Parse CSV into map
        adiData = {};
        await new Promise((resolve) => {
            Papa.parse(adiCsvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    results.data.forEach(row => {
                        // Support FIPS, geoid10, or GEOID column names
                        const geoid = row.FIPS || row.geoid10 || row.GEOID;
                        const natRank = parseInt(row.ADI_NATRANK);

                        if (geoid && !isNaN(natRank)) {
                            adiData[geoid] = {
                                natRank: natRank,
                                stateRank: parseInt(row.ADI_STATERNK) || 0
                            };
                        }
                    });
                    resolve();
                }
            });
        });

        console.log(`Loaded ${Object.keys(adiData).length} ADI records`);

        // Step 2: Load block groups GeoJSON
        const blockGroupsResponse = await fetch('/api/boundaries/block_groups');
        if (!blockGroupsResponse.ok) {
            throw new Error('Block groups GeoJSON not found');
        }
        const blockGroupsGeoJson = await blockGroupsResponse.json();

        // Remove existing ADI layers
        if (map.getLayer('adi-fill')) map.removeLayer('adi-fill');
        if (map.getLayer('adi-outline')) map.removeLayer('adi-outline');
        if (map.getSource('block-groups-geojson')) map.removeSource('block-groups-geojson');

        // Step 3: Add GeoJSON source
        map.addSource('block-groups-geojson', {
            type: 'geojson',
            data: blockGroupsGeoJson
        });

        // Step 4: Create fill layer with expression-based styling
        map.addLayer({
            id: 'adi-fill',
            type: 'fill',
            source: 'block-groups-geojson',
            paint: {
                'fill-color': [
                    'let',
                    'geoid', ['get', 'GEOID10'],
                    'rankValue', rankType === 'national' ?
                        ['case',
                            ['has', ['get', 'GEOID10'], ['literal', adiData]],
                            ['get', ['get', 'GEOID10'], ['literal', Object.fromEntries(Object.entries(adiData).map(([k, v]) => [k, v.natRank]))]],
                            null
                        ] :
                        ['case',
                            ['has', ['get', 'GEOID10'], ['literal', adiData]],
                            ['get', ['get', 'GEOID10'], ['literal', Object.fromEntries(Object.entries(adiData).map(([k, v]) => [k, v.stateRank]))]],
                            null
                        ],
                    ['case',
                        ['==', ['var', 'rankValue'], null], '#808080',
                        rankType === 'national' ?
                            ['case',
                                ['<=', ['var', 'rankValue'], 20], '#e5e7eb',
                                ['<=', ['var', 'rankValue'], 40], '#cbd5e1',
                                ['<=', ['var', 'rankValue'], 60], '#94a3b8',
                                ['<=', ['var', 'rankValue'], 80], '#64748b',
                                '#475569'
                            ] :
                            ['case',
                                ['<=', ['var', 'rankValue'], 2], '#e5e7eb',
                                ['<=', ['var', 'rankValue'], 4], '#cbd5e1',
                                ['<=', ['var', 'rankValue'], 6], '#94a3b8',
                                ['<=', ['var', 'rankValue'], 8], '#64748b',
                                '#475569'
                            ]
                    ]
                ],
                'fill-opacity': 0.6,
                'fill-antialias': true  // Enable anti-aliasing for smoother edges
            }
        }, map.getLayer('emissions-unclustered') ? 'emissions-unclustered' : undefined);

        // Add outline layer with improved rendering
        map.addLayer({
            id: 'adi-outline',
            type: 'line',
            source: 'block-groups-geojson',
            paint: {
                'line-color': '#ffffff',
                'line-width': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    8, 0.3,    // Thinner at lower zoom
                    12, 0.8,   // Thicker at higher zoom
                    16, 1.2
                ],
                'line-opacity': 0.6,
                'line-blur': 0.5  // Slight blur for smoother appearance
            }
        }, map.getLayer('emissions-unclustered') ? 'emissions-unclustered' : undefined);

        // Update status display
        document.getElementById('social-data-status').innerHTML =
            `<p><strong>Loaded:</strong> ADI ${year}</p>
             <p><strong>Features:</strong> ${Object.keys(adiData).length.toLocaleString()} block groups</p>`;

        // Show ADI legend and update text based on rank type (keep facility legend visible)
        const adiLegend = document.getElementById('adi-legend');
        adiLegend.style.display = 'block';

        // Update legend title and labels
        const legendItems = adiLegend.querySelectorAll('.legend-text');
        if (rankType === 'national') {
            adiLegend.querySelector('.legend-title').textContent = 'ADI National Rank';
            if (legendItems.length >= 5) {
                legendItems[0].textContent = 'Low Disadvantage (1-20)';
                legendItems[1].textContent = 'Below Average (21-40)';
                legendItems[2].textContent = 'Average (41-60)';
                legendItems[3].textContent = 'Above Average (61-80)';
                legendItems[4].textContent = 'High Disadvantage (81-100)';
            }
        } else {
            adiLegend.querySelector('.legend-title').textContent = 'ADI State Rank';
            if (legendItems.length >= 5) {
                legendItems[0].textContent = 'Low Disadvantage (1-2)';
                legendItems[1].textContent = 'Below Average (3-4)';
                legendItems[2].textContent = 'Average (5-6)';
                legendItems[3].textContent = 'Above Average (7-8)';
                legendItems[4].textContent = 'High Disadvantage (9-10)';
            }
        }

        showToast(`ADI layer loaded for ${year}`, 'success');

    } catch (error) {
        console.error('Error loading ADI layer:', error);
        showToast('Failed to load ADI data', 'error');
        document.getElementById('social-data-status').innerHTML =
            `<p style="color: var(--error);">Failed to load data</p>`;
    }
}

// ADI popup handler
map.on('click', 'adi-fill', (e) => {
    if (e.features.length === 0) return;

    const feature = e.features[0];
    const geoid = feature.properties.GEOID10;
    const adi = adiData[geoid];
    const name = feature.properties.NAMELSAD10 || 'Unknown';

    if (!adi) {
        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`<div style="padding: 8px;">
                <strong>${name}</strong><br>
                GEOID: ${geoid}<br>
                No ADI data available
            </div>`)
            .addTo(map);
        return;
    }

    new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`<div style="padding: 8px;">
            <strong>${name}</strong><br>
            GEOID: ${geoid}<br>
            ADI National Rank: ${adi.natRank}/100<br>
            ADI State Rank: ${adi.stateRank}/10
        </div>`)
        .addTo(map);
});

map.on('mouseenter', 'adi-fill', () => {
    map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'adi-fill', () => {
    map.getCanvas().style.cursor = '';
});

// Tab switching, updateLegend, and old event listeners removed (not in unified index.html)

console.log('✓ app_maplibre.js loaded - MapLibre implementation ready');
