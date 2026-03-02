const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { createReadStream } = require('fs');
const dataFetcher = require('./dataFetcher');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'data/nei/');
    },
    filename: (req, file, cb) => {
        const year = req.body.year;
        cb(null, `${year}_NEI_Facility_summary.csv`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// Required NEI columns
const REQUIRED_COLUMNS = [
    'state',
    'eis facility id',
    'pollutant code',
    'total emissions',
    'site latitude',
    'site longitude',
    'primary naics code',
    'primary naics description'
];

// Column name variations
const COLUMN_VARIATIONS = {
    'state': ['state'],
    'eis facility id': ['eis facility id', 'eis_facility_id', 'facility_id'],
    'pollutant code': ['pollutant code', 'pollutant_code'],
    'total emissions': ['total emissions', 'total_emissions', 'emissions'],
    'site latitude': ['site latitude', 'site_latitude', 'latitude', 'lat'],
    'site longitude': ['site longitude', 'site_longitude', 'longitude', 'lon', 'lng'],
    'primary naics code': ['primary naics code', 'primary_naics_code', 'naics_code', 'naics code'],
    'primary naics description': ['primary naics description', 'primary_naics_description', 'naics_description', 'naics description']
};

// Validate CSV columns
function validateColumns(headers) {
    const headersLower = headers.map(h => h.toLowerCase());
    const foundColumns = {};
    const missingColumns = [];
    
    for (const [displayName, variations] of Object.entries(COLUMN_VARIATIONS)) {
        let found = false;
        for (const variant of variations) {
            if (headersLower.includes(variant.toLowerCase())) {
                foundColumns[displayName] = headers[headersLower.indexOf(variant.toLowerCase())];
                found = true;
                break;
            }
        }
        if (!found) {
            missingColumns.push(displayName);
        }
    }
    
    return {
        valid: missingColumns.length === 0,
        foundColumns,
        missingColumns
    };
}

// API Routes

// Get available years
app.get('/api/nei/years', (req, res) => {
    const neiDir = path.join(__dirname, '../data/nei');
    
    fs.readdir(neiDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read NEI directory' });
        }
        
        const years = files
            .filter(f => f.endsWith('_NEI_Facility_summary.csv'))
            .map(f => parseInt(f.split('_')[0]))
            .filter(y => !isNaN(y))
            .sort((a, b) => b - a); // Most recent first
        
        res.json({ years });
    });
});

// Get NEI data for a specific year
app.get('/api/nei/:year', (req, res) => {
    const year = req.params.year;
    const filePath = path.join(__dirname, `../data/nei/${year}_NEI_Facility_summary.csv`);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `NEI data for year ${year} not found` });
    }
    
    // Stream the CSV file
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${year}_NEI_Facility_summary.csv"`);
    
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
});

// Validate uploaded NEI file
app.post('/api/nei/validate', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const year = req.body.year;
    if (!year || isNaN(parseInt(year))) {
        fs.unlinkSync(req.file.path); // Delete uploaded file
        return res.status(400).json({ error: 'Invalid year provided' });
    }
    
    // Read first row to validate columns
    const headers = [];
    let firstRow = true;
    
    const stream = createReadStream(req.file.path)
        .pipe(csv())
        .on('headers', (headerList) => {
            headers.push(...headerList);
        })
        .on('data', (data) => {
            if (firstRow) {
                stream.destroy(); // Stop after first row
                firstRow = false;
            }
        })
        .on('end', () => {
            const validation = validateColumns(headers);
            
            if (!validation.valid) {
                // Delete invalid file
                fs.unlinkSync(req.file.path);
                return res.status(400).json({
                    valid: false,
                    error: 'Missing required columns',
                    missingColumns: validation.missingColumns,
                    foundColumns: Object.keys(validation.foundColumns),
                    requiredColumns: REQUIRED_COLUMNS
                });
            }
            
            // File is valid
            res.json({
                valid: true,
                year: year,
                filename: req.file.filename,
                size: req.file.size,
                foundColumns: validation.foundColumns
            });
        })
        .on('error', (error) => {
            fs.unlinkSync(req.file.path);
            res.status(500).json({ error: 'Failed to parse CSV file' });
        });
});

// Upload NEI data (after validation)
app.post('/api/nei/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const year = req.body.year;
    const expectedPath = path.join(__dirname, `../data/nei/${year}_NEI_Facility_summary.csv`);
    
    // Check if file for this year already exists
    if (fs.existsSync(expectedPath) && req.file.path !== expectedPath) {
        // Delete uploaded file if it's a duplicate
        fs.unlinkSync(req.file.path);
        return res.status(409).json({ 
            error: `NEI data for year ${year} already exists`,
            year: year
        });
    }
    
    res.json({
        success: true,
        year: year,
        filename: req.file.filename,
        message: `NEI data for ${year} uploaded successfully`
    });
});

// Delete NEI data for a specific year
app.delete('/api/nei/:year', (req, res) => {
    const year = req.params.year;
    const filePath = path.join(__dirname, `../data/nei/${year}_NEI_Facility_summary.csv`);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `NEI data for year ${year} not found` });
    }
    
    fs.unlink(filePath, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete file' });
        }
        res.json({ success: true, message: `Deleted NEI data for year ${year}` });
    });
});

// Get file info (size, row count estimate)
app.get('/api/nei/:year/info', (req, res) => {
    const year = req.params.year;
    const filePath = path.join(__dirname, `../data/nei/${year}_NEI_Facility_summary.csv`);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `NEI data for year ${year} not found` });
    }
    
    fs.stat(filePath, (err, stats) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read file info' });
        }
        
        // Count rows (approximate)
        let lineCount = 0;
        const readStream = createReadStream(filePath);
        readStream
            .on('data', (chunk) => {
                lineCount += chunk.toString().split('\n').length;
            })
            .on('end', () => {
                res.json({
                    year: year,
                    size: stats.size,
                    sizeFormatted: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
                    estimatedRows: lineCount - 1, // Subtract header
                    lastModified: stats.mtime
                });
            })
            .on('error', (error) => {
                res.status(500).json({ error: 'Failed to count rows' });
            });
    });
});

// ADI (Area Deprivation Index) API Routes

// Get available ADI years
app.get('/api/adi/years', (req, res) => {
    const adiDir = path.join(__dirname, '../data/adi');

    fs.readdir(adiDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read ADI directory' });
        }

        const years = files
            .filter(f => f.match(/US_(\d{4})_ADI_Census_Block_Group/))
            .map(f => parseInt(f.match(/US_(\d{4})_ADI/)[1]))
            .filter(y => !isNaN(y))
            .sort((a, b) => b - a); // Most recent first

        res.json({ years });
    });
});

// ============================================================================
// Configuration API - Serve public config (API key, etc.)
// ============================================================================

app.get('/api/config', (req, res) => {
    const configPath = path.join(__dirname, '../config.json');

    if (!fs.existsSync(configPath)) {
        return res.status(404).json({
            error: 'Configuration file not found',
            message: 'Please create config.json from config.json.example'
        });
    }

    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        // Only send public configuration to client
        res.json({
            googleMapsApiKey: config.googleMapsApiKey,
            mapDefaults: config.mapDefaults || {
                center: { lat: 39.8283, lng: -98.5795 },
                zoom: 5
            },
            dataSource: config.dataSource || {
                type: 'csv',
                path: '../data/predictions/Data_Predictions_annual_risk_with_socioeconomic_2021.csv'
            }
        });
    } catch (error) {
        console.error('Error reading config.json:', error);
        res.status(500).json({
            error: 'Failed to read configuration',
            message: error.message
        });
    }
});

// ============================================================================
// Predictions API - Serve facility predictions data
// ============================================================================

app.get('/api/predictions/:year', async (req, res) => {
    const year = req.params.year;

    try {
        // Fetch from GCS with local caching
        const filePath = await dataFetcher.getPredictionsData(year);

        res.setHeader('Content-Type', 'text/csv');
        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
    } catch (error) {
        console.error(`Error fetching predictions data for ${year}:`, error);
        return res.status(404).json({
            error: 'Predictions data not found',
            message: `No predictions data available for year ${year}. ${error.message}`
        });
    }
});

// ============================================================================
// ADI API - Serve Area Deprivation Index data by year
// ============================================================================

app.get('/api/adi/:year', async (req, res) => {
    const year = req.params.year;

    try {
        // Fetch from GCS with local caching
        const filePath = await dataFetcher.getAdiData(year);

        res.setHeader('Content-Type', 'text/csv');
        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
    } catch (error) {
        console.error(`Error fetching ADI data for ${year}:`, error);
        return res.status(404).json({
            error: 'ADI data not found',
            message: `No ADI data available for year ${year}. ${error.message}`
        });
    }
});

// ============================================================================
// Boundaries API - Serve census block groups GeoJSON
// ============================================================================

app.get('/api/boundaries/block_groups', async (req, res) => {
    try {
        // Fetch from GCS with local caching
        const filePath = await dataFetcher.getBoundaryData('block_groups');

        res.setHeader('Content-Type', 'application/json');
        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
    } catch (error) {
        console.error('Error fetching block groups data:', error);
        return res.status(404).json({
            error: 'Block groups data not found',
            message: `Failed to load block groups boundary data. ${error.message}`
        });
    }
});

// ============================================================================
// PMTiles API Routes - Serve census boundary vector tiles
// ============================================================================

// Serve block groups PMTiles
app.get('/api/boundaries/block_groups.pmtiles', (req, res) => {
    const filePath = path.join(__dirname, '../data/boundaries/block_groups.pmtiles');

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Block groups PMTiles not found' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        // Handle range request (critical for PMTiles tile loading)
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        const file = fs.createReadStream(filePath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'application/x-protobuf',
            'Cache-Control': 'public, max-age=86400'
        };

        res.writeHead(206, head);
        file.pipe(res);
    } else {
        // Full file request
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'application/x-protobuf',
            'Cache-Control': 'public, max-age=86400'
        };

        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
    }
});

// Serve census tracts PMTiles
app.get('/api/boundaries/census_tracts.pmtiles', (req, res) => {
    const filePath = path.join(__dirname, '../data/boundaries/census_tracts.pmtiles');

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Census tracts PMTiles not found' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        const file = fs.createReadStream(filePath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'application/x-protobuf',
            'Cache-Control': 'public, max-age=86400'
        };

        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'application/x-protobuf',
            'Cache-Control': 'public, max-age=86400'
        };

        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
    }
});

// // Get available social data years
// app.get('/api/social/years', (req, res) => {
//     const socialDir = path.join(__dirname, '../data/social');

//     fs.readdir(socialDir, (err, files) => {
//         if (err) {
//             return res.status(500).json({ error: 'Failed to read social directory' });
//         }

//         const years = files
//             .filter(f => f.endsWith('_social_data.csv'))
//             .map(f => parseInt(f.split('_')[0]))
//             .filter(y => !isNaN(y))
//             .sort((a, b) => b - a);

//         res.json({ years });
//     });
// });

// // Get social data for specific year
// app.get('/api/social/:year', (req, res) => {
//     const year = req.params.year;
//     const filePath = path.join(socialDir, `${year}_social_data.csv`);
    
//     if (!fs.existsSync(filePath)) {
//         return res.status(404).json({ error: `Social data for year ${year} not found` });
//     }
    
//     res.setHeader('Content-Type', 'text/csv');
//     fs.createReadStream(filePath).pipe(res);
// });

// // Upload social data
// const socialUpload = multer({
//     storage: multer.diskStorage({
//         destination: socialDir,
//         filename: (req, file, cb) => {
//             cb(null, `${req.body.year}_social_data.csv`);
//         }
//     }),
//     limits: { fileSize: 100 * 1024 * 1024 } // 100MB
// });

// app.post('/api/social/upload', socialUpload.single('file'), (req, res) => {
//     if (!req.file) {
//         return res.status(400).json({ error: 'No file uploaded' });
//     }
    
//     const year = req.body.year;
    
//     // Read first row to detect columns
//     fs.createReadStream(req.file.path)
//         .pipe(csv())
//         .once('headers', (headers) => {
//             // Filter to useful indicators (exclude identifiers)
//             const indicators = headers.filter(h => 
//                 !['geoid', 'geoid10', 'name', 'tract_name', 'state', 'county'].includes(h.toLowerCase())
//             );
            
//             res.json({
//                 success: true,
//                 year: year,
//                 indicators: indicators,
//                 message: `Social data for ${year} uploaded with ${indicators.length} indicators`
//             });
//         })
//         .on('error', (err) => {
//             res.status(500).json({ error: 'Failed to parse CSV' });
//         });
// });

// Start server
app.listen(PORT, () => {
    console.log(`NEI Emissions Mapper Server running on http://localhost:${PORT}`);
    console.log(`Data directory: ${path.join(__dirname, '../data/nei')}`);
});

module.exports = app;
