#!/usr/bin/env arch -arm64 python3
"""
Generate Google Earth Engine tile URLs for census tract boundaries.
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
    Get US census tract boundaries from TIGER/2010/TRACT dataset.
    Returns a FeatureCollection styled with boundary outlines only.
    """
    # Load TIGER census tracts
    tracts = ee.FeatureCollection('TIGER/2010/Tracts_DP1')

    # Style: just boundaries, no fill (for now)
    # Use outlined polygons for visibility
    styled = tracts.style(**{
        'color': '1f77b4',  # Blue outline
        'width': 1,
        'fillColor': '00000000'  # Transparent fill
    })

    return styled

def generate_tile_url():
    """Generate the tile URL for census tracts visualization."""
    try:
        # Get styled layer
        layer = get_census_tracts_layer()

        # Get map ID (tile URL)
        map_id_dict = layer.getMapId()
        tile_url = map_id_dict['tile_fetcher'].url_format

        return {
            'success': True,
            'tile_url': tile_url,
            'map_id': map_id_dict.get('mapid', 'unknown')
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def main():
    """Main execution: authenticate and generate tile URL."""
    if not authenticate_gee():
        sys.exit(1)

    print("Generating GEE tile URL for census tract boundaries...", file=sys.stderr)
    result = generate_tile_url()

    if result['success']:
        print("✓ Tile URL generated successfully", file=sys.stderr)
        # Output JSON to stdout for consumption by Node.js
        print(json.dumps(result, indent=2))
    else:
        print(f"✗ Failed to generate tile URL: {result['error']}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
