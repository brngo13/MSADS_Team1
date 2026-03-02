#!/bin/bash
set -e

# Download and convert Illinois census boundaries from TIGER/2010
# State FIPS code for Illinois: 17

YEAR=2010
STATE=17
BASE_URL="https://www2.census.gov/geo/tiger/TIGER${YEAR}"
TEMP_DIR="./temp_illinois_boundaries"
OUTPUT_DIR="../data/boundaries"

echo "🗺️  Downloading Illinois census boundaries from TIGER/${YEAR}..."
echo ""

# Create directories
mkdir -p "${TEMP_DIR}"
mkdir -p "${OUTPUT_DIR}"

# Download Census Tracts
echo "📥 Downloading census tracts..."
TRACT_FILE="tl_${YEAR}_${STATE}_tract10"
curl -o "${TEMP_DIR}/${TRACT_FILE}.zip" \
  "${BASE_URL}/TRACT/${YEAR}/${TRACT_FILE}.zip"

# Download Block Groups
echo "📥 Downloading block groups..."
BG_FILE="tl_${YEAR}_${STATE}_bg10"
curl -o "${TEMP_DIR}/${BG_FILE}.zip" \
  "${BASE_URL}/BG/${YEAR}/${BG_FILE}.zip"

# Unzip files
echo ""
echo "📦 Extracting shapefiles..."
unzip -q -o "${TEMP_DIR}/${TRACT_FILE}.zip" -d "${TEMP_DIR}/tracts/"
unzip -q -o "${TEMP_DIR}/${BG_FILE}.zip" -d "${TEMP_DIR}/block_groups/"

# Convert to GeoJSON
echo ""
echo "🔄 Converting to GeoJSON..."

# Census Tracts
echo "  → Converting census tracts..."
ogr2ogr -f GeoJSON \
  -t_srs EPSG:4326 \
  -select GEOID10,NAME10,ALAND10,AWATER10 \
  "${OUTPUT_DIR}/IL_census_tracts.geojson" \
  "${TEMP_DIR}/tracts/${TRACT_FILE}.shp"

# Block Groups
echo "  → Converting block groups..."
ogr2ogr -f GeoJSON \
  -t_srs EPSG:4326 \
  -select GEOID10,NAMELSAD10,ALAND10,AWATER10 \
  "${OUTPUT_DIR}/IL_block_groups.geojson" \
  "${TEMP_DIR}/block_groups/${BG_FILE}.shp"

# Clean up
echo ""
echo "🧹 Cleaning up temporary files..."
rm -rf "${TEMP_DIR}"

# Show results
echo ""
echo "✅ Success! Created:"
ls -lh "${OUTPUT_DIR}"/IL_*.geojson | awk '{print "   " $9 " (" $5 ")"}'

echo ""
echo "📊 Feature counts:"
echo "   Census Tracts: $(grep -o '"type":"Feature"' ${OUTPUT_DIR}/IL_census_tracts.geojson | wc -l | tr -d ' ')"
echo "   Block Groups: $(grep -o '"type":"Feature"' ${OUTPUT_DIR}/IL_block_groups.geojson | wc -l | tr -d ' ')"

echo ""
echo "🎉 Illinois boundaries ready for use!"
