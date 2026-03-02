#!/usr/bin/env node
/**
 * Extract Illinois features from US-wide PMTiles and save as GeoJSON
 * Illinois state FIPS code: 17
 */

const fs = require('fs');
const path = require('path');
const { PMTiles } = require('pmtiles');

const PMTILES_DIR = path.join(__dirname, '../data/boundaries');
const OUTPUT_DIR = PMTILES_DIR;

async function extractIllinois(pmtilesFile, outputFile, layerName) {
    console.log(`📂 Reading ${path.basename(pmtilesFile)}...`);

    const pmtiles = new PMTiles(pmtilesFile);
    const header = await pmtiles.getHeader();

    console.log(`   Zoom range: ${header.minZoom} - ${header.maxZoom}`);
    console.log(`   Center: ${header.centerLon}, ${header.centerLat}`);

    // For now, create a placeholder since full extraction is complex
    // We'll use the server endpoint approach instead
    console.log(`⚠️  Note: PMTiles → GeoJSON extraction requires additional tools`);
    console.log(`   Recommended: Download directly from Census Bureau`);
}

async function main() {
    const blockGroupsPmtiles = path.join(PMTILES_DIR, 'block_groups.pmtiles');
    const tractsPmtiles = path.join(PMTILES_DIR, 'census_tracts.pmtiles');

    if (!fs.existsSync(blockGroupsPmtiles)) {
        console.error('❌ block_groups.pmtiles not found');
        process.exit(1);
    }

    console.log('🗺️  Extracting Illinois from PMTiles...\n');

    await extractIllinois(
        blockGroupsPmtiles,
        path.join(OUTPUT_DIR, 'IL_block_groups.geojson'),
        'block_groups'
    );

    console.log('\n✅ Use direct Census download instead - PMTiles extraction is complex');
    console.log('   Try: https://www2.census.gov/geo/tiger/TIGER2010/BG/2010/tl_2010_17_bg10.zip');
}

main().catch(console.error);
