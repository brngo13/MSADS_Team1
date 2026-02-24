# Area Deprivation Index (ADI) Data

This directory contains ADI socioeconomic indicator data at the census block group level.

## Required Files

Place the following CSV files here (not committed to git due to size):

- `ADI_2015.csv` (~9MB)
- `ADI_2020.csv` (~10MB)
- `ADI_2023.csv` (~12MB)

## Data Source

Download from: [Neighborhood Atlas - University of Wisconsin](https://www.neighborhoodatlas.medicine.wisc.edu/)

## CSV Structure

Expected columns:
- `FIPS` or `GEOID10` - 12-digit census block group identifier
- `ADI_NATRANK` - National rank (1-100, higher = more disadvantaged)
- `ADI_STATERNK` - State rank (1-10, higher = more disadvantaged)
- `GISJOIN` - Alternative geographic identifier
