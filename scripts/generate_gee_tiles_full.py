#!/usr/bin/env arch -arm64 python3
"""
Generate Google Earth Engine tile URLs for census boundaries.
Generates both census tracts and block groups from TIGER/2010.
Uses service account authentication to access GEE datasets.
"""

import ee
import json
import sys
import os

# GEE service account configuration
SERVICE_ACCOUNT = '882446104421-compute@developer.gserviceaccount.com'
CREDENTIALS_PATH = os.path.join(os.path.dirname(__file__), '..', 'gee_creds.json')
PROJECT_ID = 'msads-mba-autumn-2025-team-1'

def authenticate_gee():
    """Authenticate with Google Earth Engine using service account."""
    try:
        credentials = ee.ServiceAccountCredentials(SERVICE_ACCOUNT, CREDENTIALS_PATH)
        ee.Initialize(credentials, project=PROJECT_ID)
        print("✓ Successfully authenticated with Google Earth Engine", file=sys.stderr)
        return True
    except Exception as e:
        print(f"✗ Failed to authenticate with GEE: {e}", file=sys.stderr)
        return False

def get_census_tracts_layer():
    """
    Get US census tract boundaries from TIGER/2010.
    Returns a styled FeatureCollection with boundary outlines only.
    """
    # Load TIGER 2010 census tracts
    tracts = ee.FeatureCollection('TIGER/2010/Tracts_DP1')

    # Style: blue boundaries, transparent fill
    styled = tracts.style(**{
        'color': '1f77b4',  # Blue outline
        'width': 1,
        'fillColor': '00000000'  # Transparent fill
    })

    return styled

def get_block_groups_layer():
    """
    Get US census block group boundaries from TIGER/2010.
    Returns a styled FeatureCollection with boundary outlines only.
    """
    # Load TIGER 2010 block groups
    # Note: Using TIGER/2010/Blocks_DP1 and aggregating by block group
    # Or if available, use TIGER/2010/BG directly

    # Try the standard block groups dataset
    try:
        block_groups = ee.FeatureCollection('TIGER/2010/BG')
        print("✓ Using TIGER/2010/BG dataset", file=sys.stderr)
    except:
        # Fallback to alternative naming
        try:
            block_groups = ee.FeatureCollection('TIGER/2010/BlockGroups')
            print("✓ Using TIGER/2010/BlockGroups dataset", file=sys.stderr)
        except:
            # Last resort: use blocks and note limitation
            print("⚠ Block groups dataset not found, using blocks", file=sys.stderr)
            block_groups = ee.FeatureCollection('TIGER/2010/Blocks_DP1')

    # Style: purple/magenta boundaries, transparent fill
    styled = block_groups.style(**{
        'color': '9333ea',  # Purple outline
        'width': 1,
        'fillColor': '00000000'  # Transparent fill
    })

    return styled

def generate_tile_urls():
    """Generate tile URLs for both census tracts and block groups."""
    try:
        results = {}

        # Generate tract tile URL
        print("Generating tile URL for census tracts...", file=sys.stderr)
        tracts_layer = get_census_tracts_layer()
        tracts_map = tracts_layer.getMapId()
        results['tracts'] = {
            'tile_url': tracts_map['tile_fetcher'].url_format,
            'map_id': tracts_map.get('mapid', 'unknown')
        }
        print("✓ Census tracts tile URL generated", file=sys.stderr)

        # Generate block groups tile URL
        print("Generating tile URL for block groups...", file=sys.stderr)
        bg_layer = get_block_groups_layer()
        bg_map = bg_layer.getMapId()
        results['block_groups'] = {
            'tile_url': bg_map['tile_fetcher'].url_format,
            'map_id': bg_map.get('mapid', 'unknown')
        }
        print("✓ Block groups tile URL generated", file=sys.stderr)

        return {
            'success': True,
            'data': results
        }

    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def main():
    """Main execution: authenticate and generate tile URLs."""
    if not authenticate_gee():
        sys.exit(1)

    print("\n🌍 Generating GEE tile URLs for TIGER/2010 boundaries...\n", file=sys.stderr)
    result = generate_tile_urls()

    if result['success']:
        print("\n✅ All tile URLs generated successfully\n", file=sys.stderr)

        # Output JSON to stdout for consumption by Node.js
        output = {
            'success': True,
            'tracts_tile_url': result['data']['tracts']['tile_url'],
            'tracts_map_id': result['data']['tracts']['map_id'],
            'block_groups_tile_url': result['data']['block_groups']['tile_url'],
            'block_groups_map_id': result['data']['block_groups']['map_id']
        }
        print(json.dumps(output, indent=2))
    else:
        print(f"\n✗ Failed to generate tile URLs: {result['error']}\n", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
