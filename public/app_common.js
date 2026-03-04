/**
 * Common utilities and shared functionality between Google Maps and MapLibre implementations
 * This file contains all non-map-specific code (data loading, filtering, UI handlers, etc.)
 */

// ============================================================================
// Global State (shared between both map implementations)
// ============================================================================

let facilityData = []; // All facility data from predictions CSV
let filteredData = []; // Filtered facility data based on user selections
let adiData = {}; // ADI data keyed by GEOID
let isDarkTheme = localStorage.getItem('theme') !== 'light';
let currentRiskMetric = 'absolute'; // 'absolute' or 'equity'

// NAICS sector mapping (2-digit codes to simplified sectors)
const NAICS_SECTORS = {
    '11': 'Agriculture, Forestry, Fishing',
    '21': 'Mining, Oil & Gas Extraction',
    '22': 'Utilities',
    '23': 'Construction',
    '31': 'Manufacturing',
    '32': 'Manufacturing',
    '33': 'Manufacturing',
    '42': 'Wholesale Trade',
    '44': 'Retail Trade',
    '45': 'Retail Trade',
    '48': 'Transportation & Warehousing',
    '49': 'Transportation & Warehousing',
    '51': 'Information',
    '52': 'Finance & Insurance',
    '53': 'Real Estate',
    '54': 'Professional Services',
    '55': 'Management',
    '56': 'Administrative & Support',
    '61': 'Educational Services',
    '62': 'Health Care',
    '71': 'Arts & Entertainment',
    '72': 'Accommodation & Food',
    '81': 'Other Services',
    '92': 'Public Administration'
};

// County FIPS to name mapping (state FIPS + county FIPS -> county name)
// Format: 'SSCCC' where SS = state FIPS, CCC = county FIPS
const COUNTY_NAMES = {
    // Illinois (17) - All 102 counties
    '17001': 'Adams', '17003': 'Alexander', '17005': 'Bond', '17007': 'Boone',
    '17009': 'Brown', '17011': 'Bureau', '17013': 'Calhoun', '17015': 'Carroll',
    '17017': 'Cass', '17019': 'Champaign', '17021': 'Christian', '17023': 'Clark',
    '17025': 'Clay', '17027': 'Clinton', '17029': 'Coles', '17031': 'Cook',
    '17033': 'Crawford', '17035': 'Cumberland', '17037': 'DeKalb', '17039': 'De Witt',
    '17041': 'Douglas', '17043': 'DuPage', '17045': 'Edgar', '17047': 'Edwards',
    '17049': 'Effingham', '17051': 'Fayette', '17053': 'Ford', '17055': 'Franklin',
    '17057': 'Fulton', '17059': 'Gallatin', '17061': 'Greene', '17063': 'Grundy',
    '17065': 'Hamilton', '17067': 'Hancock', '17069': 'Hardin', '17071': 'Henderson',
    '17073': 'Henry', '17075': 'Iroquois', '17077': 'Jackson', '17079': 'Jasper',
    '17081': 'Jefferson', '17083': 'Jersey', '17085': 'Jo Daviess', '17087': 'Johnson',
    '17089': 'Kane', '17091': 'Kankakee', '17093': 'Kendall', '17095': 'Knox',
    '17097': 'Lake', '17099': 'LaSalle', '17101': 'Lawrence', '17103': 'Lee',
    '17105': 'Livingston', '17107': 'Logan', '17109': 'McDonough', '17111': 'McHenry',
    '17113': 'McLean', '17115': 'Macon', '17117': 'Macoupin', '17119': 'Madison',
    '17121': 'Marion', '17123': 'Marshall', '17125': 'Mason', '17127': 'Massac',
    '17129': 'Menard', '17131': 'Mercer', '17133': 'Monroe', '17135': 'Montgomery',
    '17137': 'Morgan', '17139': 'Moultrie', '17141': 'Ogle', '17143': 'Peoria',
    '17145': 'Perry', '17147': 'Piatt', '17149': 'Pike', '17151': 'Pope',
    '17153': 'Pulaski', '17155': 'Putnam', '17157': 'Randolph', '17159': 'Richland',
    '17161': 'Rock Island', '17163': 'St. Clair', '17165': 'Saline', '17167': 'Sangamon',
    '17169': 'Schuyler', '17171': 'Scott', '17173': 'Shelby', '17175': 'Stark',
    '17177': 'Stephenson', '17179': 'Tazewell', '17181': 'Union', '17183': 'Vermilion',
    '17185': 'Wabash', '17187': 'Warren', '17189': 'Washington', '17191': 'Wayne',
    '17193': 'White', '17195': 'Whiteside', '17197': 'Will', '17199': 'Williamson',
    '17201': 'Winnebago', '17203': 'Woodford'
};

// Get sector from NAICS code
function getNaicsSector(naicsCode) {
    if (!naicsCode) return 'Unknown';
    const code = String(naicsCode).substring(0, 2);
    return NAICS_SECTORS[code] || 'Other';
}

// Discrete emission thresholds (1-2-5 log-like scale)
const EMISSION_THRESHOLDS = [
    0,        // 0: No filter (all facilities)
    1,        // 1: 1 ton
    2,        // 2: 2 tons
    5,        // 3: 5 tons
    10,       // 4: 10 tons
    20,       // 5: 20 tons
    50,       // 6: 50 tons
    100,      // 7: 100 tons
    200,      // 8: 200 tons
    500,      // 9: 500 tons
    1000,     // 10: 1k tons
    2000,     // 11: 2k tons
    5000,     // 12: 5k tons
    10000     // 13: 10k tons
];

// Filter state
const filters = {
    minEmissions: 1000,
    riskLevel: '',
    sector: ''
};

// ============================================================================
// Data Loading Functions
// ============================================================================

/**
 * Load facility data from predictions CSV (2021)
 */
async function loadFacilityData() {
    console.log('Loading facility data from predictions CSV...');
    try {
        const response = await fetch('/api/predictions/2021');
        if (!response.ok) throw new Error('Failed to load facility data');

        const csvText = await response.text();

        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                // Debug: log first row to see available columns
                if (results.data.length > 0) {
                    console.log('CSV columns:', Object.keys(results.data[0]));
                    console.log('First facility:', results.data[0]);
                }

                // Convert GEOID10 to integer for efficient matching
                results.data.forEach(row => {
                    if (row.GEOID10) {
                        row.GEOID10 = parseInt(row.GEOID10);
                    }
                });

                facilityData = results.data.filter(row => {
                    return row['site_latitude'] && row['site_longitude'] &&
                           !isNaN(parseFloat(row['site_latitude'])) &&
                           !isNaN(parseFloat(row['site_longitude']));
                });

                applyFilters();
                console.log(`Loaded ${facilityData.length} facilities`);
            },
            error: (error) => {
                console.error('Error parsing CSV:', error);
                showToast('Failed to parse facility data', 'error');
            }
        });
    } catch (error) {
        console.error('Error loading facility data:', error);
        showToast('Failed to load facility data', 'error');
    }
}

/**
 * Load ADI data for a specific year
 */
async function loadAdiData(year) {
    console.log(`Loading ADI data for ${year}...`);
    try {
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
        return adiData;
    } catch (error) {
        console.error('Error loading ADI data:', error);
        throw error;
    }
}

// ============================================================================
// Filter Functions
// ============================================================================

/**
 * Update slider value display position
 */
function updateSliderValuePosition() {
    const slider = document.getElementById('emissions-slider');
    const valueContainer = document.getElementById('emissions-value-container');

    if (!slider || !valueContainer) return;

    const sliderIndex = parseInt(slider.value) || 0;
    const min = parseInt(slider.min);
    const max = parseInt(slider.max);
    const percentage = (sliderIndex - min) / (max - min);

    // Get slider width and calculate position
    const sliderWidth = slider.offsetWidth;
    const containerWidth = valueContainer.offsetWidth;

    // Position at percentage, centered on thumb
    let leftPosition = percentage * sliderWidth - (containerWidth / 2);

    // Constrain to bounds
    leftPosition = Math.max(0, Math.min(leftPosition, sliderWidth - containerWidth));

    valueContainer.style.left = `${leftPosition}px`;
}

/**
 * Update risk percentile slider value display position
 */
function updateRiskPercentileValuePosition() {
    const slider = document.getElementById('risk-percentile-slider');
    const valueContainer = document.getElementById('risk-percentile-value-container');

    if (!slider || !valueContainer) return;

    const sliderValue = parseInt(slider.value) || 0;
    const min = parseInt(slider.min);
    const max = parseInt(slider.max);
    const percentage = (sliderValue - min) / (max - min);

    // Get slider width and calculate position
    const sliderWidth = slider.offsetWidth;
    const containerWidth = valueContainer.offsetWidth;

    // Position at percentage, centered on thumb
    let leftPosition = percentage * sliderWidth - (containerWidth / 2);

    // Constrain to bounds
    leftPosition = Math.max(0, Math.min(leftPosition, sliderWidth - containerWidth));

    valueContainer.style.left = `${leftPosition}px`;
}

/**
 * Apply filters and update filtered data
 * Note: This calls map-specific plotEmissions() which must be defined in app_gmaps.js or app_maplibre.js
 */
function applyFilters() {
    // Get filter values from unified HTML elements
    const slider = document.getElementById('emissions-slider');
    const sliderIndex = parseInt(slider.value) || 0;

    // Use discrete emission threshold
    const minEmissions = EMISSION_THRESHOLDS[sliderIndex];
    const sectorFilter = document.getElementById('sector-filter')?.value || '';

    // Get risk percentile filter
    const riskPercentileSlider = document.getElementById('risk-percentile-slider');
    const minRiskPercentile = riskPercentileSlider ? parseInt(riskPercentileSlider.value) : 0;

    // Update emissions value display
    let displayValue;
    if (minEmissions === 0) {
        displayValue = '0';
    } else if (minEmissions < 1000) {
        displayValue = Math.round(minEmissions) + '';
    } else if (minEmissions < 1000000) {
        displayValue = (minEmissions / 1000).toFixed(0) + 'k';
    } else {
        displayValue = (minEmissions / 1000000).toFixed(1) + 'M';
    }
    document.getElementById('emissions-value').textContent = displayValue;

    // Update risk percentile value display
    if (riskPercentileSlider) {
        const valueDisplay = document.getElementById('risk-percentile-value');
        if (valueDisplay) {
            valueDisplay.textContent = minRiskPercentile;
        }
        updateRiskPercentileValuePosition();
    }

    // Update position
    updateSliderValuePosition();

    // Filter facilityData
    filteredData = facilityData.filter(site => {
        const emissions = parseFloat(site['total_emissions']) || 0;
        const naicsCode = site['naics_code'] || '';
        const sector = getNaicsSector(naicsCode);
        const riskPercentile = parseFloat(site['risk_percentile']) || 0;

        // Apply minimum emissions filter
        if (emissions < minEmissions) return false;

        // Apply sector filter
        if (sectorFilter && sector !== sectorFilter) return false;

        // Apply risk percentile filter
        if (riskPercentile < minRiskPercentile) return false;

        return true;
    });

    // Call map-specific plot function (must be defined in map implementation)
    if (typeof plotEmissions === 'function') {
        plotEmissions();
    }
}

// ============================================================================
// Color Mapping Functions
// ============================================================================

/**
 * Get the risk value based on the currently selected metric
 * Uses _norm columns for color gradients (0-1 scale)
 */
function getRiskValue(facility) {
    if (currentRiskMetric === 'equity') {
        // Use equity_weighted_risk_norm (already 0-1 scale)
        return parseFloat(facility['equity_weighted_risk_norm']);
    } else {
        // Use risk_norm (already 0-1 scale)
        return parseFloat(facility['risk_norm']);
    }
}

/**
 * Get color based on continuous risk score
 * 0-0.4: green
 * 0.4-0.6: green to yellow gradient
 * 0.6-0.8: yellow to red gradient
 * 0.8+: solid red
 */
function getRiskColor(riskScore) {
    // Handle invalid/missing values
    if (riskScore === null || riskScore === undefined || isNaN(riskScore)) {
        return '#808080'; // Gray
    }

    const risk = parseFloat(riskScore);

    // 0-0.4: solid green
    if (risk <= 0.4) {
        return '#10b981'; // Green
    }

    // 0.4-0.6: green to yellow gradient
    if (risk <= 0.6) {
        const t = (risk - 0.4) / 0.2; // normalize to 0-1
        return interpolateColor('#10b981', '#fbbf24', t);
    }

    // 0.6-0.8: yellow to red gradient
    if (risk <= 0.8) {
        const t = (risk - 0.6) / 0.2; // normalize to 0-1
        return interpolateColor('#fbbf24', '#ef4444', t);
    }

    // 0.8+: solid red
    return '#ef4444'; // Red
}

/**
 * Interpolate between two hex colors
 */
function interpolateColor(color1, color2, t) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);

    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);

    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

/**
 * Get ADI color based on rank and type
 */
function getAdiColor(rankValue, rankType) {
    if (!rankValue) return '#808080'; // Gray for no data

    if (rankType === 'national') {
        // National Rank: 1-100 scale (grey to slate gradient)
        if (rankValue <= 20) return '#e5e7eb';
        if (rankValue <= 40) return '#cbd5e1';
        if (rankValue <= 60) return '#94a3b8';
        if (rankValue <= 80) return '#64748b';
        return '#475569';
    } else {
        // State Rank: 1-10 scale (grey to slate gradient)
        if (rankValue <= 2) return '#e5e7eb';
        if (rankValue <= 4) return '#cbd5e1';
        if (rankValue <= 6) return '#94a3b8';
        if (rankValue <= 8) return '#64748b';
        return '#475569';
    }
}

/**
 * Calculate circle radius based on emissions (logarithmic scale)
 */
function getCircleRadius(emissions) {
    if (!emissions || emissions <= 0) return 4;

    // Logarithmic scale: radius = 4 + log10(emissions) * 2
    const logValue = Math.log10(emissions);
    const radius = 4 + (logValue * 2);

    // Clamp between 4 and 20
    return Math.max(4, Math.min(20, radius));
}

// ============================================================================
// UI Functions
// ============================================================================

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    // Simple console log for now - can be enhanced with actual toast UI
    const prefix = type === 'error' ? '[ERROR]' : type === 'success' ? '[SUCCESS]' : '[INFO]';
    console.log(`${prefix} ${message}`);

    // You can add actual toast UI here if desired
}

/**
 * Set theme (light/dark mode)
 */
function setTheme(dark) {
    isDarkTheme = dark;
    localStorage.setItem('theme', dark ? 'dark' : 'light');

    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.checked = dark;
    }

    const label = document.getElementById('theme-label');
    if (label) {
        label.textContent = dark ? 'Dark Mode' : 'Light Mode';
    }

    if (dark) {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
    }

    // Call map-specific theme update if available
    if (typeof updateMapTheme === 'function') {
        updateMapTheme(dark);
    }
}

// ============================================================================
// Event Listeners (Common UI elements)
// ============================================================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Sector filter - apply in real-time
    const sectorFilter = document.getElementById('sector-filter');
    if (sectorFilter) {
        sectorFilter.addEventListener('change', applyFilters);
    }

    // Emissions slider - update display and apply filter in real-time
    const slider = document.getElementById('emissions-slider');
    if (slider) {
        const updateSliderGradient = () => {
            const percent = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
            slider.style.setProperty('--slider-percent', `${percent}%`);
        };

        slider.addEventListener('input', () => {
            updateSliderGradient();
            applyFilters(); // This will update display and position
        });

        // Initialize position and gradient on load
        setTimeout(() => {
            updateSliderValuePosition();
            updateSliderGradient();
        }, 100);
    }

    // Risk percentile slider - update display and apply filter in real-time
    const riskPercentileSlider = document.getElementById('risk-percentile-slider');
    if (riskPercentileSlider) {
        const updateRiskSliderGradient = () => {
            const percent = ((riskPercentileSlider.value - riskPercentileSlider.min) /
                           (riskPercentileSlider.max - riskPercentileSlider.min)) * 100;
            riskPercentileSlider.style.setProperty('--slider-percent', `${percent}%`);
        };

        riskPercentileSlider.addEventListener('input', () => {
            updateRiskSliderGradient();
            applyFilters(); // This will update display and position
        });

        // Initialize position and gradient on load
        setTimeout(() => {
            updateRiskPercentileValuePosition();
            updateRiskSliderGradient();
        }, 100);
    }

    // Risk metric toggle buttons - setup the event listeners
    // The actual update function will be set by the map implementation
    window.onRiskMetricChange = null; // Callback to be set by map implementations

    const riskMetricAbsolute = document.getElementById('risk-metric-absolute');
    const riskMetricEquity = document.getElementById('risk-metric-equity');

    if (riskMetricAbsolute && riskMetricEquity) {
        riskMetricAbsolute.addEventListener('click', () => {
            if (currentRiskMetric !== 'absolute') {
                currentRiskMetric = 'absolute';
                riskMetricAbsolute.classList.add('active');
                riskMetricEquity.classList.remove('active');
                console.log('Switched to absolute risk metric');
                // Call the callback if it exists
                if (window.onRiskMetricChange) {
                    window.onRiskMetricChange();
                }
            }
        });

        riskMetricEquity.addEventListener('click', () => {
            if (currentRiskMetric !== 'equity') {
                currentRiskMetric = 'equity';
                riskMetricEquity.classList.add('active');
                riskMetricAbsolute.classList.remove('active');
                console.log('Switched to equity-weighted risk metric');
                // Call the callback if it exists
                if (window.onRiskMetricChange) {
                    window.onRiskMetricChange();
                }
            }
        });
    }

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', (e) => setTheme(e.target.checked));
    }

    // Panel tabs
    const tabButtons = document.querySelectorAll('.panel-tab');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Update active tab panel
            tabPanels.forEach(panel => panel.classList.remove('active'));
            const targetPanel = document.getElementById(`${targetTab}-tab`);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });

    // Info modal
    const infoButton = document.getElementById('info-button');
    const infoModal = document.getElementById('info-modal');
    const infoModalClose = document.getElementById('info-modal-close');

    if (infoButton && infoModal) {
        infoButton.addEventListener('click', () => {
            infoModal.classList.add('active');
        });

        infoModalClose.addEventListener('click', () => {
            infoModal.classList.remove('active');
        });

        // Close modal when clicking outside
        infoModal.addEventListener('click', (e) => {
            if (e.target === infoModal) {
                infoModal.classList.remove('active');
            }
        });
    }

    // Facility modal close
    const modalClose = document.getElementById('facility-modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            document.getElementById('facility-modal').style.display = 'none';
        });
    }

    // Mobile toggle buttons
    const menuToggle = document.getElementById('menu-toggle');
    const legendToggle = document.getElementById('legend-toggle');
    const controlPanel = document.querySelector('.control-panel');
    const legend = document.querySelector('.legend');

    // On load: show control panel, hide legend on mobile
    if (window.innerWidth <= 768) {
        controlPanel.classList.add('mobile-visible');
        legend.classList.remove('mobile-visible');
    }

    // Toggle control panel (menu)
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            const isVisible = controlPanel.classList.toggle('mobile-visible');

            // Update button icon based on state
            const icon = menuToggle.querySelector('.hamburger-icon');
            if (icon) {
                icon.textContent = isVisible ? '<' : '☰';
            }

            // On mobile, hide legend when menu opens
            if (window.innerWidth <= 768 && isVisible) {
                legend.classList.remove('mobile-visible');
                // Reset legend button icon
                const legendIcon = legendToggle.querySelector('.legend-icon');
                if (legendIcon) legendIcon.textContent = '◐';
            }
        });
    }

    // Toggle legend
    if (legendToggle) {
        legendToggle.addEventListener('click', () => {
            const isVisible = legend.classList.toggle('mobile-visible');

            // Update button icon based on state
            const icon = legendToggle.querySelector('.legend-icon');
            if (icon) {
                icon.textContent = isVisible ? '>' : '◐';
            }

            // On mobile, hide control panel when legend opens
            if (window.innerWidth <= 768 && isVisible) {
                controlPanel.classList.remove('mobile-visible');
                // Reset menu button icon
                const menuIcon = menuToggle.querySelector('.hamburger-icon');
                if (menuIcon) menuIcon.textContent = '☰';
            }
        });
    }

    // Facility search autocomplete
    const facilitySearch = document.getElementById('facility-search');
    const facilitySuggestions = document.getElementById('facility-suggestions');

    if (facilitySearch && facilitySuggestions) {
        facilitySearch.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();

            if (query.length < 2) {
                facilitySuggestions.classList.remove('active');
                facilitySuggestions.innerHTML = '';
                return;
            }

            // Search facilities (use facilityData from global state)
            const matches = facilityData
                .filter(facility => {
                    const siteName = (facility['site name'] || facility['site_name'] || '').toLowerCase();
                    return siteName.includes(query);
                })
                .slice(0, 10); // Limit to 10 suggestions

            if (matches.length === 0) {
                facilitySuggestions.classList.remove('active');
                facilitySuggestions.innerHTML = '';
                return;
            }

            // Build suggestions HTML
            const suggestionsHTML = matches.map(facility => {
                const siteName = facility['site_name'] || 'Unknown';

                // Note: city/state columns available in this dataset
                const emissions = parseFloat(facility['total_emissions']) || 0;
                const lat = parseFloat(facility['site_latitude']);
                const lng = parseFloat(facility['site_longitude']);

                return `
                    <div class="autocomplete-item" data-lat="${lat}" data-lng="${lng}" data-name="${siteName}">
                        <div class="autocomplete-item-name">${siteName}</div>
                        <div class="autocomplete-item-details">
                            ${formatEmissions(emissions)}
                        </div>
                    </div>
                `;
            }).join('');

            facilitySuggestions.innerHTML = suggestionsHTML;
            facilitySuggestions.classList.add('active');

            // Add click handlers to suggestions
            facilitySuggestions.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    const lat = parseFloat(item.dataset.lat);
                    const lng = parseFloat(item.dataset.lng);
                    const name = item.dataset.name;

                    // Call map-specific zoom function (must be defined in app_gmaps.js or app_maplibre.js)
                    if (typeof zoomToFacility === 'function') {
                        zoomToFacility(lat, lng, name);
                    }

                    // Clear search
                    facilitySearch.value = '';
                    facilitySuggestions.classList.remove('active');
                    facilitySuggestions.innerHTML = '';
                });
            });
        });

        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!facilitySearch.contains(e.target) && !facilitySuggestions.contains(e.target)) {
                facilitySuggestions.classList.remove('active');
            }
        });
    }

    // Initialize theme
    setTheme(isDarkTheme);
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format GEOID in readable format
 * Example: "170310839001" -> "IL / County 031 / Tract 083900 / Block 1"
 */
function formatGeoid(geoid) {
    if (!geoid || geoid.length !== 12) return geoid || 'Unknown';

    const state = geoid.substring(0, 2);
    const county = geoid.substring(2, 5);
    const tract = geoid.substring(5, 11);
    const blockGroup = geoid.substring(11, 12);

    // State FIPS to abbreviation (add more as needed)
    const stateMap = {
        '17': 'IL',
        '06': 'CA',
        '36': 'NY',
        '48': 'TX',
        '12': 'FL'
    };

    const stateAbbr = stateMap[state] || `State ${state}`;

    return `${stateAbbr} / County ${county} / Tract ${tract} / Block ${blockGroup}`;
}

/**
 * Format GEOID in two-line format for compact display
 * Returns object with line1 and line2
 * Example: "170310839001" -> { line1: "Cook County, IL", line2: "Tract 083900 / Block 1" }
 */
function formatGeoidTwoLine(geoid) {
    if (!geoid || geoid.length !== 12) {
        return { line1: geoid || 'Unknown', line2: '' };
    }

    const state = geoid.substring(0, 2);
    const county = geoid.substring(2, 5);
    const tract = geoid.substring(5, 11);
    const blockGroup = geoid.substring(11, 12);

    // State FIPS to abbreviation (add more as needed)
    const stateMap = {
        '17': 'IL',
        '06': 'CA',
        '36': 'NY',
        '48': 'TX',
        '12': 'FL'
    };

    const stateAbbr = stateMap[state] || `State ${state}`;

    // Look up county name
    const countyFips = state + county; // e.g., "17031"
    const countyName = COUNTY_NAMES[countyFips];

    return {
        line1: countyName ? `${countyName} County, ${stateAbbr}` : `${stateAbbr} / County ${county}`,
        line2: `Tract ${tract} / Block ${blockGroup}`
    };
}

/**
 * Aggregate facility data by census GEOID
 * Returns { totalEmissions, totalFacilities, highRisk, avgRiskScore }
 */
function aggregateFacilitiesByGeoid(geoid) {
    // Convert GEOID to integer for efficient matching
    const geoidInt = parseInt(geoid);
    console.log('Aggregating facilities for GEOID:', geoidInt);
    console.log('Total facilityData length:', facilityData.length);

    const facilities = facilityData.filter(facility => {
        const facilityGeoid = facility.GEOID10 || facility.geoid10 || facility.GEOID;
        return facilityGeoid === geoidInt;
    });

    console.log('Matching facilities found:', facilities.length);
    if (facilityData.length > 0 && facilities.length === 0) {
        // Debug: show sample facility GEOID
        const sampleGeoid = facilityData[0].GEOID10 || facilityData[0].geoid10 || facilityData[0].GEOID;
        console.log('Sample facility GEOID:', sampleGeoid, 'vs requested:', geoidInt);
        console.log('Sample facility:', facilityData[0]);
    }

    const stats = {
        totalEmissions: 0,
        totalFacilities: facilities.length,
        highRisk: 0,
        avgRiskScore: 0
    };

    let totalRiskScore = 0;
    let riskScoreCount = 0;

    facilities.forEach(facility => {
        // Sum emissions
        const emissions = parseFloat(facility['total_emissions']) || 0;
        stats.totalEmissions += emissions;

        // Count high risk facilities (risk_norm > 0.6)
        const riskScore = parseFloat(facility['risk_norm']);
        if (!isNaN(riskScore)) {
            totalRiskScore += riskScore;
            riskScoreCount++;
            if (riskScore > 0.6) {
                stats.highRisk++;
            }
        }
    });

    // Calculate average risk score
    if (riskScoreCount > 0) {
        stats.avgRiskScore = totalRiskScore / riskScoreCount;
    }

    return stats;
}

/**
 * Format number with commas
 */
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '—';
    return num.toLocaleString();
}

/**
 * Format emissions value with units
 */
function formatEmissions(emissions) {
    if (!emissions || isNaN(emissions)) return '—';

    if (emissions < 1000) {
        return `${Math.round(emissions)} tons/year`;
    } else if (emissions < 1000000) {
        return `${(emissions / 1000).toFixed(1)}k tons/year`;
    } else {
        return `${(emissions / 1000000).toFixed(2)}M tons/year`;
    }
}

console.log('app_common.js loaded - shared utilities ready');
