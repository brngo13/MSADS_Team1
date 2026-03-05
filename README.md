# Multimodal Industrial Emissions Verification & Environmental Justice

<!-- Status badges -->

[![Stars](https://img.shields.io/github/stars/brngo13/MSADS_Team1?style=social)](https://github.com/brngo13/MSADS_Team1/stargazers)
[![Forks](https://img.shields.io/github/forks/brngo13/MSADS_Team1?style=social)](https://github.com/brngo13/MSADS_Team1/network)
[![Open Issues](https://img.shields.io/github/issues/brngo13/MSADS_Team1?color=blue)](https://github.com/brngo13/MSADS_Team1/issues)

<!-- Call‑to‑action badges -->

[![Launch Dashboard](https://img.shields.io/badge/Launch%20Dashboard-1877F2?logo=google-chrome&logoColor=white&style=for-the-badge)](public/)
[![Explore Notebooks](https://img.shields.io/badge/Explore%20Notebooks-28A745?logo=jupyter&logoColor=white&style=for-the-badge)](notebooks/)

> *Independent verification for cleaner air and fairer communities.*

## Project Motivation

Industrial facilities in the United States self‑report their emissions.  While mandatory reporting promotes transparency, it can miss under‑reporting, and oversight resources are limited.  At the same time, satellites now offer continuous observations of atmospheric NO₂【990910291927967†L30-L74】.  Our capstone project leverages these new data streams to independently estimate facility‑level emissions and examine who is most at risk when reporting fails.

## Objectives & Features

- **Independent Verification:** Use a multimodal model to predict ground‑level NO₂ from satellite imagery, ground sensors and facility characteristics, providing an independent benchmark for reported emissions【990910291927967†L406-L413】.
- **Anomaly Detection:** Identify facilities with potential under‑reporting using residual anomalies (difference between predicted and reported emissions), peer comparisons and atmospheric anomalies【990910291927967†L142-L155】.
- **Environmental Justice:** Combine facility risk scores with census tract deprivation data (Area Deprivation Index) to see whether disadvantaged communities face higher under‑reporting risk【990910291927967†L383-L399】.
- **Interactive Insights:** Deliver a dashboard and notebooks that regulators and community members can use to explore facility risks, compare industries and examine equity patterns.

## Data Sources

| Source | Description |
|-------|-----------|
| **NEI Facility Data** | Annual NO₂ emissions self‑reported to the EPA’s National Emissions Inventory (NEI). Baseline for comparison. |
| **Microsoft Eclipse Sensors** | Ground‑level NO₂ measurements used as training labels for the multimodal model. |
| **Sentinel‑5P TROPOMI** | Daily satellite observations of tropospheric NO₂ columns used for context and prediction. |
| **Sentinel‑2 Imagery** | Multispectral images providing land‑cover context around each facility. |
| **Area Deprivation Index (ADI)** | Socioeconomic index summarizing income, education, employment and housing factors. |
| **Auxiliary Data** | Facility attributes (NAICS codes), census demographics and weather variables. |

## Methodology

Our analysis follows a five‑stage pipeline:

1. **Ingestion & Alignment:** Align NEI, Sentinel‑5P, Sentinel‑2, ground sensors and socioeconomic data onto a common spatial grid and time frame.
2. **Fusion Model Training:** Train a late‑fusion neural network that combines Sentinel‑2 features, Sentinel‑5P columns and facility attributes to predict ground‑level NO₂.  The model explains about 60 % of the variation in observed concentrations【990910291927967†L406-L413】.
3. **Facility Estimation:** Apply the trained model to satellite snapshots around each facility to generate independent NO₂ estimates.
4. **Risk Scoring:** Compute residual, peer and atmospheric anomalies and combine them into a hybrid risk score (60 % residual, 20 % peer, 20 % atmospheric) to flag potential under‑reporters【990910291927967†L142-L155】.
5. **Socioeconomic Overlay:** Merge risk scores with ADI scores to identify whether high‑risk facilities are located in disadvantaged communities【990910291927967†L383-L399】.

An overview of the data pipeline is shown below:

![Data pipeline overview](pipeline.png)

## Key Results

- **Top Risk Facilities:** Facilities with the highest absolute risk scores include AT&T Illinois, North Shore Water Reclamation District, Airgas USA LLC, AkzoNobel Aerospace Coatings and the Rehabilitation Institute of Chicago【990910291927967†L332-L374】.  Many rely on distributed generators or estimation‑based reporting.
- **Under‑Reporting Patterns:** Under‑reporting risk peaks among mid‑scale emitters; the largest emitters generally show lower risk, indicating that risk is not solely tied to volume【990910291927967†L383-L404】.
- **Environmental Justice:** High‑risk facilities are disproportionately located in areas with high ADI scores【990910291927967†L383-L399】, suggesting disadvantaged communities may be more exposed to under‑reporting.
- **Actionable Insights:** Satellite models cannot confirm non‑compliance, but they highlight facilities where reported emissions diverge from expectations【990910291927967†L419-L427】.  Regulators can prioritize inspections and deploy additional monitors based on our risk rankings.

![Top risk facilities](top_risk.png)

## Getting Started

To reproduce our analysis or build upon it:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/brngo13/MSADS_Team1.git
   ```
2. **Install dependencies:** Use `conda` or `npm` as specified in `package.json` and our notebooks.
3. **Explore notebooks:** The `notebooks/` directory contains notebooks for data preprocessing, model training, anomaly detection and socioeconomic analysis.  These notebooks follow the workflow described above.
4. **Run scripts:** Use scripts in `scripts/` to export Sentinel‑2 and Sentinel‑5P data, train the fusion model and compute risk scores.
5. **Launch the dashboard:** The `public/` directory hosts an interactive dashboard.  From the repository root, run the web server and navigate to the dashboard to explore facility risk scores and ADI overlays.

## Team & Acknowledgements

This project was developed by **Lauren Adolphe**, **Aneesha Dasari**, **Rinad Salkham** and **Brianna Ngo**, with guidance from **Nick Kadochnikov**.  We thank the Data Science Capstone instructors and collaborators who provided data and feedback.  Sentinel‑2 and Sentinel‑5P data are provided by the European Space Agency; ADI data by the University of Wisconsin; NEI data by the U.S. EPA.