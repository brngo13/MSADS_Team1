# Census Boundaries Data

This directory contains US Census geographic boundary files.

## Required Files

Place the following files here (not committed to git due to size):

### GeoJSON Files (for Google Maps Data Layer)
- `IL_block_groups.geojson` (~84MB) - Illinois census block groups (2010)
- `IL_census_tracts.geojson` (~45MB) - Illinois census tracts (2010)

### PMTiles Files (optional, for MapLibre)
- `block_groups.pmtiles` (~12MB) - US-wide block groups vector tiles
- `census_tracts.pmtiles` (~12MB) - US-wide census tracts vector tiles

## Data Sources

### Census Bureau TIGER/Line Shapefiles
- Block Groups: https://www2.census.gov/geo/tiger/TIGER2010/BG/2010/
- Census Tracts: https://www2.census.gov/geo/tiger/TIGER2010/TRACT/2010/

### Illinois-specific files
- Block Groups: `tl_2010_17_bg10.zip`
- Census Tracts: `tl_2010_17_tract10.zip`

## Note

Using 2010 census geographies to match ADI data which uses GEOID10 identifiers.
