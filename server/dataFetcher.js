/**
 * Data Fetcher Module - Google Cloud Storage with Authentication
 *
 * Handles fetching large data files from private Google Cloud Storage bucket
 * with local file system caching to avoid repeated downloads.
 *
 * Files are downloaded on-demand using service account authentication
 * and cached in data_cache/ directory.
 */

const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

// Load configuration from config.json
const configPath = path.join(__dirname, '../config.json');
let config = {
    gcsStorageBucket: 'msads-team1-data',
    gcsCredentialsPath: './gcs_credentials.json'
};

if (fs.existsSync(configPath)) {
    try {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config = {
            gcsStorageBucket: configData.gcsStorageBucket || config.gcsStorageBucket,
            gcsCredentialsPath: configData.gcsCredentialsPath || config.gcsCredentialsPath
        };
        console.log(`✓ Loaded GCS config: bucket=${config.gcsStorageBucket}`);
    } catch (error) {
        console.warn('Warning: Failed to read config.json for GCS settings, using defaults');
    }
}

// Environment variables can override config.json
if (process.env.GCS_BUCKET) {
    config.gcsStorageBucket = process.env.GCS_BUCKET;
    console.log(`✓ Using GCS bucket from environment: ${config.gcsStorageBucket}`);
}
if (process.env.GCS_CREDENTIALS_PATH) {
    config.gcsCredentialsPath = process.env.GCS_CREDENTIALS_PATH;
}

// Resolve credentials path (relative to project root)
const credentialsPath = path.resolve(__dirname, '..', config.gcsCredentialsPath);

// Initialize Google Cloud Storage client
let storage;
try {
    if (fs.existsSync(credentialsPath)) {
        storage = new Storage({
            keyFilename: credentialsPath
        });
        console.log(`✓ GCS Storage client initialized with credentials: ${credentialsPath}`);
    } else {
        console.warn(`⚠️  GCS credentials not found at: ${credentialsPath}`);
        console.warn('   Files will only be served from local cache.');
        storage = null;
    }
} catch (error) {
    console.error('Failed to initialize GCS Storage client:', error.message);
    storage = null;
}

const bucket = storage ? storage.bucket(config.gcsStorageBucket) : null;

// Local cache directory
const CACHE_DIR = path.join(__dirname, '../data_cache');

// GCS bucket structure (your actual paths)
const GCS_PATHS = {
    predictions: 'Data/Predictions',           // {year}.csv
    adi: 'Data/adi_data',                     // USA_{year}_ADI_Census_Block...csv
    nei: 'Data/NEI_RS',                       // {year}_NEI_Facility_summary.csv
    boundaries: 'Data/Boundaries'              // IL_block_groups.geojson, etc.
};

// ============================================================================
// Cache Directory Setup
// ============================================================================

function ensureCacheDirectories() {
    const dirs = [
        CACHE_DIR,
        path.join(CACHE_DIR, 'predictions'),
        path.join(CACHE_DIR, 'adi'),
        path.join(CACHE_DIR, 'nei'),
        path.join(CACHE_DIR, 'boundaries')
    ];

    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✓ Created cache directory: ${dir}`);
        }
    });
}

// Initialize cache directories on module load
ensureCacheDirectories();

// ============================================================================
// Core Fetching Function (Authenticated)
// ============================================================================

/**
 * Fetch a file from GCS using authenticated access with local caching
 *
 * @param {string} gcsPath - Full GCS path (e.g., 'Data/Predictions/2021.csv')
 * @param {string} localCategory - Local cache category (predictions, adi, nei, boundaries)
 * @param {string} localFilename - Local filename to save as
 * @returns {Promise<string>} - Local file path
 */
async function fetchDataFile(gcsPath, localCategory, localFilename) {
    const localPath = path.join(CACHE_DIR, localCategory, localFilename);

    // If file exists in cache, return it immediately
    if (fs.existsSync(localPath)) {
        console.log(`✓ Using cached file: ${localCategory}/${localFilename}`);
        return localPath;
    }

    // Check if storage client is initialized
    if (!storage || !bucket) {
        throw new Error('GCS Storage client not initialized. Check credentials path in config.json');
    }

    // File not cached - download from GCS
    console.log(`⬇ Downloading from GCS: ${gcsPath}`);

    try {
        const file = bucket.file(gcsPath);

        // Check if file exists in GCS
        const [exists] = await file.exists();
        if (!exists) {
            throw new Error(`File not found in GCS: ${gcsPath}`);
        }

        // Ensure directory exists
        const dir = path.dirname(localPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Download file
        await file.download({ destination: localPath });
        console.log(`✓ Downloaded and cached: ${localCategory}/${localFilename}`);

        return localPath;
    } catch (error) {
        throw new Error(`Failed to download ${gcsPath}: ${error.message}`);
    }
}

// ============================================================================
// Helper Functions for Specific Data Types
// ============================================================================

/**
 * Get predictions data for a specific year
 * GCS path: Data/Predictions/{year}.csv
 */
async function getPredictionsData(year) {
    const gcsPath = `${GCS_PATHS.predictions}/${year}.csv`;
    const localFilename = `${year}.csv`;
    return await fetchDataFile(gcsPath, 'predictions', localFilename);
}

/**
 * Get ADI (Area Deprivation Index) data for a specific year
 * GCS path: Data/adi_data/USA_{year}_ADI_Census_Block......csv
 *
 * Note: The full filename varies by year. This searches for files matching the pattern.
 */
async function getAdiData(year) {
    const localFilename = `ADI_${year}.csv`;
    const localPath = path.join(CACHE_DIR, 'adi', localFilename);

    // If cached, return immediately
    if (fs.existsSync(localPath)) {
        console.log(`✓ Using cached file: adi/${localFilename}`);
        return localPath;
    }

    // Not cached - need to find the file in GCS
    if (!storage || !bucket) {
        throw new Error('GCS Storage client not initialized. Check credentials path in config.json');
    }

    console.log(`⬇ Searching for ADI file in GCS: Data/adi_data/USA_${year}_ADI_Census_Block*.csv`);

    try {
        // List files in adi_data directory matching pattern
        const [files] = await bucket.getFiles({
            prefix: `${GCS_PATHS.adi}/USA_${year}_ADI_Census_Block`
        });

        if (files.length === 0) {
            throw new Error(`No ADI file found for year ${year} in GCS`);
        }

        // Use the first matching file
        const file = files[0];
        const gcsPath = file.name;

        console.log(`✓ Found ADI file: ${gcsPath}`);

        // Download and cache
        await file.download({ destination: localPath });
        console.log(`✓ Downloaded and cached: adi/${localFilename}`);

        return localPath;
    } catch (error) {
        throw new Error(`Failed to fetch ADI data for ${year}: ${error.message}`);
    }
}

/**
 * Get NEI (National Emissions Inventory) data for a specific year
 * GCS path: Data/NEI_RS/{year}_NEI_Facility_summary.csv
 */
async function getNeiData(year) {
    const gcsPath = `${GCS_PATHS.nei}/${year}_NEI_Facility_summary.csv`;
    const localFilename = `${year}_NEI_Facility_summary.csv`;
    return await fetchDataFile(gcsPath, 'nei', localFilename);
}

/**
 * Get census boundary GeoJSON files
 * GCS path: Data/Boundaries/{filename}
 *
 * @param {string} type - Either 'block_groups' or 'census_tracts'
 */
async function getBoundaryData(type) {
    const filenames = {
        'block_groups': 'IL_block_groups.geojson',
        'census_tracts': 'IL_census_tracts.geojson'
    };

    const filename = filenames[type];
    if (!filename) {
        throw new Error(`Unknown boundary type: ${type}`);
    }

    const gcsPath = `${GCS_PATHS.boundaries}/${filename}`;
    return await fetchDataFile(gcsPath, 'boundaries', filename);
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Clear cached file(s) to force re-download
 * @param {string} category - Optional category to clear (clears all if not specified)
 * @param {string} filename - Optional specific file to clear
 */
function clearCache(category = null, filename = null) {
    if (category && filename) {
        // Clear specific file
        const filePath = path.join(CACHE_DIR, category, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`✓ Cleared cache: ${category}/${filename}`);
        }
    } else if (category) {
        // Clear entire category
        const categoryPath = path.join(CACHE_DIR, category);
        if (fs.existsSync(categoryPath)) {
            const files = fs.readdirSync(categoryPath);
            files.forEach(file => {
                fs.unlinkSync(path.join(categoryPath, file));
            });
            console.log(`✓ Cleared cache category: ${category} (${files.length} files)`);
        }
    } else {
        // Clear entire cache
        const categories = ['adi', 'nei', 'predictions', 'boundaries'];
        let totalFiles = 0;
        categories.forEach(cat => {
            const categoryPath = path.join(CACHE_DIR, cat);
            if (fs.existsSync(categoryPath)) {
                const files = fs.readdirSync(categoryPath);
                files.forEach(file => {
                    fs.unlinkSync(path.join(categoryPath, file));
                });
                totalFiles += files.length;
            }
        });
        console.log(`✓ Cleared entire cache (${totalFiles} files)`);
    }
}

/**
 * List available files in GCS bucket (for debugging)
 */
async function listAvailableFiles(prefix = 'Data/') {
    if (!storage || !bucket) {
        console.error('GCS Storage client not initialized');
        return [];
    }

    try {
        const [files] = await bucket.getFiles({ prefix });
        console.log(`\n📁 Files in gs://${config.gcsStorageBucket}/${prefix}:`);
        files.forEach(file => {
            console.log(`   - ${file.name}`);
        });
        return files.map(f => f.name);
    } catch (error) {
        console.error('Failed to list files:', error.message);
        return [];
    }
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
    fetchDataFile,
    getAdiData,
    getNeiData,
    getPredictionsData,
    getBoundaryData,
    clearCache,
    listAvailableFiles,
    GCS_BUCKET: config.gcsStorageBucket,
    CACHE_DIR,
    GCS_PATHS
};
