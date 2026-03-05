# Multimodal Industrial Emissions Verification & Environmental Justice

<!-- Hero banner -->
![Project hero banner](hero.png)

<!-- Badges: call-to-action and repository stats -->
<p align="center">
  <!-- Call‑to‑action badges -->
  <a href="https://github.com/brngo13/MSADS_Team1/blob/main/public/index.html"><img alt="Launch Dashboard" src="https://img.shields.io/badge/Launch-Dashboard-blue?style=for-the-badge"></a>
  <a href="https://github.com/brngo13/MSADS_Team1/tree/main/notebooks"><img alt="Explore Notebooks" src="https://img.shields.io/badge/Explore-Notebooks-green?style=for-the-badge"></a>
  <!-- Repository badges -->
  <a href="https://github.com/brngo13/MSADS_Team1/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/brngo13/MSADS_Team1?style=for-the-badge&logo=github"></a>
  <a href="https://github.com/brngo13/MSADS_Team1/forks"><img alt="GitHub Forks" src="https://img.shields.io/github/forks/brngo13/MSADS_Team1?style=for-the-badge&logo=github"></a>
  <a href="https://github.com/brngo13/MSADS_Team1/issues"><img alt="Open Issues" src="https://img.shields.io/github/issues/brngo13/MSADS_Team1?style=for-the-badge"></a>
</p>

> *Independent verification for cleaner air and fairer communities.*

## Transforming Emissions Transparency

Industrial facilities in the U.S. self‑report their pollution, but self‑reporting can mask under‑reporting and leave vulnerable communities in the dark. Advances in satellite remote sensing give us the tools to observe atmospheric NO₂ directly【990910291927967†L30-L74】. Our capstone project brings together satellite imagery, ground sensors and socioeconomic data to build a comprehensive emissions verification platform and shine a light on environmental justice.

---

## What We Built

Our platform integrates multiple data sources and analytics layers to independently estimate facility‑level NO₂ emissions and identify potential under‑reporting:

- **Multimodal Data Fusion:** Combining Sentinel‑2 land cover images, Sentinel‑5P atmospheric NO₂ columns and Microsoft Eclipse ground sensors to predict ground‑level NO₂ using a late‑fusion neural network【990910291927967†L406-L413】.
- **Anomaly Detection:** Comparing predicted emissions to self‑reported values and peer facilities; deriving hybrid risk scores that flag potential under‑reporters【990910291927967†L142-L155】.
- **Environmental Justice Analysis:** Linking facilities to census tracts and the Area Deprivation Index (ADI) to uncover whether high‑risk facilities are concentrated in disadvantaged communities【990910291927967†L383-L399】.
- **Interactive Insights:** Delivering a dashboard and visualizations that regulators and communities can use to explore facility‑level risks and socioeconomic patterns.

---

## Data Pipeline at a Glance

Our workflow stitches together numerous datasets and processing steps:

![Data pipeline overview](pipeline.png)

1. **Ingestion & Alignment:** Align NEI emissions, Sentinel‑5P pixels, Sentinel‑2 rasters, ground sensors and socioeconomic data onto a common spatial grid and time frame.
2. **Model Training:** Train a late‑fusion neural network to predict ground‑level NO₂ from multimodal inputs. The model explains about 60 % of the variation in observed concentrations【990910291927967†L406-L413】.
3. **Facility Estimation:** Use satellite snapshots around each facility to generate independent NO₂ estimates.
4. **Risk Scoring:** Combine residual, peer and atmospheric anomalies into a hybrid risk score (60 % residual, 20 % peer, 20 % atmospheric)【990910291927967†L142-L155】.
5. **Socioeconomic Overlay:** Merge risk scores with ADI to assess inequities.

---

## Results & Impact

Our analysis reveals critical insights:

- **High‑Risk Facilities:** The top risk facilities include AT&T Illinois, North Shore Water Reclamation District, Airgas USA LLC, AkzoNobel Aerospace Coatings and the Rehabilitation Institute of Chicago【990910291927967†L332-L374】. These facilities often have distributed generators, intermittent fuel use or rely on estimation‑based reporting.
- **Patterns of Under‑Reporting:** Under‑reporting risk peaks among mid‑scale emitters; the largest emitters generally have lower risk, indicating that under‑reporting is not solely tied to volume【990910291927967†L383-L404】.
- **Environmental Justice:** High‑risk facilities disproportionately occur in communities with higher deprivation scores, despite similar reported emission levels across ADI deciles【990910291927967†L383-L399】. This suggests that disadvantaged neighborhoods may face greater under‑reporting risk.
- **Actionable Insights:** Satellite models cannot confirm non‑compliance, but they can highlight facilities where reported emissions diverge from expectations【990910291927967†L419-L427】. Regulators can prioritize inspections and deploy additional ground monitors based on our risk rankings.

![Top risk facilities](top_risk.png)

---

## Get Involved

Want to explore the data or build on this work? You can:

- **Run the Code:** Clone this repository and follow the notebooks and scripts in the `notebooks/` and `scripts/` folders to reproduce our analysis.
- **Visualize the Results:** Use the dashboard in the `public/` directory to interactively explore facility risk scores and socioeconomic overlays.
- **Contribute:** Open issues or pull requests to suggest improvements, add new datasets or extend the analysis to other pollutants or regions.

## Acknowledgements

This capstone project was developed by Lauren Adolphe, Aneesha Dasari, Rinad Salkham and Brianna Ngo, with guidance from Nick Kadochnikov. We thank the Data Science Capstone instructors and collaborators who provided insight and data. Sentinel‑2 and Sentinel‑5P data are provided by the European Space Agency; ADI data by the University of Wisconsin; NEI data by the U.S. EPA.
