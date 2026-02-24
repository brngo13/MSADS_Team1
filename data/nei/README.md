# NEI Emissions Data

This directory contains EPA National Emissions Inventory (NEI) facility data.

## Required Files

Place the following CSV files here (not committed to git due to size):

- `2020_NEI_Facility_summary.csv` (~500MB)
- `2021_NEI_Facility_summary.csv` (~525MB)

## Data Source

Download from: [EPA NEI Data Portal](https://www.epa.gov/air-emissions-inventories/national-emissions-inventory-nei)

## CSV Structure

Expected columns:
- `facility id`
- `site name`
- `latitude`
- `longitude`
- `total emissions`
- `naics code`
- `naics description`
