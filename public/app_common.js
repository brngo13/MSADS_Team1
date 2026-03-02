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
                facilityData = results.data.filter(row => {
                    return row['site latitude'] && row['site longitude'] &&
                           !isNaN(parseFloat(row['site latitude'])) &&
                           !isNaN(parseFloat(row['site longitude']));
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
 * Apply filters and update filtered data
 * Note: This calls map-specific plotEmissions() which must be defined in app_gmaps.js or app_maplibre.js
 */
function applyFilters() {
    // Get filter values from unified HTML elements
    const slider = document.getElementById('emissions-slider');
    const sliderIndex = parseInt(slider.value) || 0;

    // Use discrete emission threshold
    const minEmissions = EMISSION_THRESHOLDS[sliderIndex];
    const riskLevel = document.getElementById('risk-filter').value;
    const sectorFilter = document.getElementById('sector-filter')?.value || '';

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

    // Update position
    updateSliderValuePosition();

    // Filter facilityData
    filteredData = facilityData.filter(site => {
        const emissions = parseFloat(site['total emissions'] || site['total_emissions']) || 0;
        const risk = site['Risk Level'] || site['risk_level'] || '';
        const naicsCode = site['primary naics code'] || site['primary_naics_code'] || '';
        const sector = getNaicsSector(naicsCode);

        // Apply minimum emissions filter
        if (emissions < minEmissions) return false;

        // Apply risk level filter
        if (riskLevel && risk !== riskLevel) return false;

        // Apply sector filter
        if (sectorFilter && sector !== sectorFilter) return false;

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
 * Get color based on risk level
 */
function getRiskColor(riskLevel) {
    if (riskLevel === 'High') return '#ef4444'; // Red
    if (riskLevel === 'Medium') return '#f59e0b'; // Amber
    if (riskLevel === 'Low') return '#10b981'; // Green
    return '#808080'; // Gray for unknown
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
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
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
    // Risk level filter - apply in real-time
    const riskFilter = document.getElementById('risk-filter');
    if (riskFilter) {
        riskFilter.addEventListener('change', applyFilters);
    }

    // Sector filter - apply in real-time
    const sectorFilter = document.getElementById('sector-filter');
    if (sectorFilter) {
        sectorFilter.addEventListener('change', applyFilters);
    }

    // Emissions slider - update display and apply filter in real-time
    const slider = document.getElementById('emissions-slider');
    if (slider) {
        slider.addEventListener('input', () => {
            applyFilters(); // This will update display and position
        });

        // Initialize position on load
        setTimeout(updateSliderValuePosition, 100); // Small delay to ensure layout is complete
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

    // Social indicator selection - show/hide ADI rank type
    const indicatorSelector = document.getElementById('social-indicator-selector');
    if (indicatorSelector) {
        indicatorSelector.addEventListener('change', (e) => {
            const adiSection = document.getElementById('adi-rank-type-section');
            if (adiSection) {
                adiSection.style.display = e.target.value === 'adi' ? 'block' : 'none';
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

    // Initialize theme
    setTheme(isDarkTheme);
});

// ============================================================================
// Utility Functions
// ============================================================================

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

console.log('✓ app_common.js loaded - shared utilities ready');
