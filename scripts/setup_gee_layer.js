#!/usr/bin/env node
/**
 * Setup script to generate GEE tile URL and inject it into app_gmaps.js
 * Run this script after setting up gee_creds.json
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PYTHON_SCRIPT = path.join(__dirname, 'generate_gee_tiles.py');
const APP_JS_PATH = path.join(__dirname, '..', 'public', 'app_gmaps.js');

console.log('🚀 Setting up Google Earth Engine layer...\n');

// Check if Python script exists
if (!fs.existsSync(PYTHON_SCRIPT)) {
    console.error('✗ Python script not found:', PYTHON_SCRIPT);
    process.exit(1);
}

// Check if credentials exist
const credsPath = path.join(__dirname, '..', 'gee_creds.json');
if (!fs.existsSync(credsPath)) {
    console.error('✗ GEE credentials not found at:', credsPath);
    console.error('\n📝 Please create gee_creds.json with your service account credentials');
    console.error('   See gee_creds.json.example for template\n');
    process.exit(1);
}

// Run Python script to generate tile URL (force arm64 architecture on Apple Silicon)
console.log('📡 Calling Google Earth Engine API...');
const python = spawn('arch', ['-arm64', 'python3', PYTHON_SCRIPT]);

let stdout = '';
let stderr = '';

python.stdout.on('data', (data) => {
    stdout += data.toString();
});

python.stderr.on('data', (data) => {
    stderr += data.toString();
    // Print stderr in real-time for progress updates
    process.stderr.write(data);
});

python.on('close', (code) => {
    if (code !== 0) {
        console.error('\n✗ Python script failed with exit code:', code);
        process.exit(1);
    }

    try {
        // Parse JSON output from Python script
        const result = JSON.parse(stdout);

        if (!result.success) {
            console.error('\n✗ Failed to generate tile URL:', result.error);
            process.exit(1);
        }

        const tileUrl = result.tile_url;
        console.log('\n✓ Tile URL generated successfully');
        console.log('📍 Map ID:', result.map_id);

        // Update app_gmaps.js with the tile URL
        let appJsContent = fs.readFileSync(APP_JS_PATH, 'utf8');

        // Replace placeholder with actual URL
        const updatedContent = appJsContent.replace(
            /const GEE_TILE_URL = ['"]PLACEHOLDER_GEE_TILE_URL['"];/,
            `const GEE_TILE_URL = '${tileUrl}';`
        );

        if (updatedContent === appJsContent) {
            console.warn('⚠️  Warning: Placeholder not found in app_gmaps.js');
            console.log('   Manual update may be required');
        } else {
            fs.writeFileSync(APP_JS_PATH, updatedContent, 'utf8');
            console.log('✓ Updated app_gmaps.js with GEE tile URL');
        }

        console.log('\n✅ Setup complete! You can now use the Google Maps version of the app');
        console.log('   Open public/index_gmaps.html in your browser\n');

    } catch (error) {
        console.error('\n✗ Error processing Python script output:', error.message);
        console.error('   Raw output:', stdout);
        process.exit(1);
    }
});

python.on('error', (error) => {
    console.error('\n✗ Failed to spawn Python process:', error.message);
    console.error('   Make sure Python 3 is installed and in your PATH');
    process.exit(1);
});
