# DCG EPA Capstone: Independent Emissions Verification and Environmental Justice

## Project Motivation & Background

Industrial facilities in the United States self-report emissions data to the Environmental Protection Agency (EPA). Regulators and communities are increasingly concerned about the accuracy of these self-reported inventories and the disproportionate pollution burdens faced by marginalized neighborhoods. Recent advances in satellite remote sensing provide independent observations of atmospheric NO₂ that can be used to verify self-reported emissions and identify hotspots. Our capstone project aims to build a data pipeline and fusion model that integrate satellite imagery, facility attributes, and socioeconomic metrics to provide more transparent emissions estimates and uncover environmental justice implications.

## Goals & Objectives

- **Independent Verification:** Combine EPA National Emissions Inventory (NEI) data with Sentinel-5P satellite observations to estimate facility-level NO₂ emissions and validate self-reported values.
- **Multi-Modal Data Fusion:** Develop a fusion model that leverages Sentinel-2 land cover images, Sentinel-5P atmospheric NO₂ measurements, and ground sensor readings to predict log(NO₂) at the census-tract level.
- **Environmental Justice:** Analyze correlations between emissions anomalies and socioeconomic indicators, such as the Area Deprivation Index (ADI), to assess disparities across communities.
- **Data Analysis & Visualization:** Create an interactive pipeline that aligns and aggregates disparate datasets, conducts correlation/hotspot analysis, and presents results in a user-friendly dashboard.
- **Deliverables:** Provide a report summarizing findings, a prototype predictive model, visualizations, and documentation to support regulatory and community decision-making.

## Data Sources

1. **EPA NEI Facility Data:** Annual estimates of NO₂ emissions for industrial facilities in the United States.
2. **Sentinel-5P TROPOMI:** Daily satellite observations of atmospheric NO₂ used to derive tropospheric columns.
3. **Sentinel-2 Imagery:** Multispectral land cover images (12 bands) providing spatial context around each facility; 10–20 m resolution.
4. **Ground Sensors:** Monitor NO₂ concentrations at the census-tract level. These measurements serve as ground truth for model training.
5. **Area Deprivation Index (ADI):** Socioeconomic indicator summarizing factors such as income, education and housing; used to assess environmental justice.
6. **Additional Socioeconomic Data:** [placeholder] – e.g., population demographics, health outcomes.

All datasets are aligned to census tracts to ensure spatial consistency.

## Methodology & Approach

Our methodology combines descriptive analysis, anomaly detection, and supervised learning:

- **Correlation & Hotspot Analysis:** We calculate correlations between satellite-derived NO₂ columns and facility emissions to identify tracts where observed concentrations deviate from expected values. Isolation forest and threshold-based approaches will flag anomalous locations.
- **Predictive Modeling:** A late-fusion neural network integrates multiple modalities. The architecture uses a ResNet-50-based encoder to extract features from Sentinel-2 images, a CNN to process Sentinel-5P NO₂ maps, and sinusoidal encoding for month features. A gating module adaptively fuses these embeddings to predict log(NO₂).
- **Environmental Justice Analysis:** Using ADI and other socioeconomic indices, we compare NO₂ anomalies across communities to evaluate disparities and examine how facility types and demographics influence exposure.
- **Evaluation Metrics:** [placeholder] – metrics such as mean absolute error, R² for regression, and precision/recall for anomaly detection will be reported.

## Pipeline & Implementation

The workflow follows a structured pipeline:

1. **Data Alignment:** Align NEI, Sentinel-5P, Sentinel-2, ADI, and ground sensor data to census-tract polygons.
2. **Aggregation & Preprocessing:** Aggregate industrial facilities and emissions to tracts; compute tract-level satellite NO₂ averages; process land cover imagery; normalize and merge datasets.
3. **Multimodal Model Training:** Train the fusion model on historical data to predict log(NO₂) from multi-modal inputs.
4. **Anomaly Detection:** Apply unsupervised methods (e.g., isolation forest) and thresholding to classify tracts as normal or anomalous.
5. **Discrepancy Metric Calculation:** Model expected NO₂ levels based on self-reported emissions and baseline factors; compute residuals between modeled and observed NO₂ to identify anomalies.
6. **Environmental Justice Assessment:** Compare anomaly scores with ADI and demographic metrics to assess disproportionate impacts.
7. **Visualization & Reporting:** Generate maps, charts, and interactive dashboards summarizing findings; compile report and technical documentation.

A detailed technical write-up and code will be provided in this repository. Where sections are not yet complete, we denote them as **[placeholder]**.

## Challenges & Limitations

- **Data Quality & Coverage:** Satellite NO₂ retrievals can be influenced by clouds and aerosol interference, leading to missing data or measurement noise. NEI emissions reporting may be incomplete or aggregated.
- **Spatial Resolution Mismatch:** Aligning coarse TROPOMI pixels (~7 km) with census tracts and facility locations requires careful spatial interpolation.
- **Model Interpretability:** The fusion model combines deep learning and statistical methods; interpreting feature importance and ensuring transparency are active areas of work.
- **Time Constraints & Scalability:** Training complex models and processing large volumes of satellite imagery is computationally intensive; we will explore transfer learning and selective sampling to manage resources.
- **Ethical Considerations:** Environmental justice analyses must account for confounding factors and avoid misinterpretation of causal relationships.

## Timeline

| Week | Task | Status |
| --- | --- | --- |
| 1 | Data collection & preliminary exploration | [placeholder] |
| 2 | Alignment of datasets to census tracts | [placeholder] |
| 3 | Model baseline & discrepancy computation | [placeholder] |
| 4 | Multimodal fusion model development | [placeholder] |
| 5 | Anomaly detection & environmental justice analysis | [placeholder] |
| 6 | Visualization dashboard & user interface | [placeholder] |
| 7 | Evaluation & iterative refinement | [placeholder] |
| 8 | Final report drafting & documentation | [placeholder] |
| 9 | Presentation & submission | [placeholder] |

The timeline above is adapted from our project’s general documentation and will be updated as milestones are achieved.

## Expected Deliverables

- **Data Analysis Report:** Summarizes correlations, discrepancies, and initial findings.
- **Predictive Fusion Model Prototype:** Demonstrates late-fusion modeling on multi-modal data.
- **Environmental Justice Assessment:** Provides maps and metrics highlighting communities with disproportionate NO₂ burdens.
- **Interactive Visualization Tool:** [placeholder] – potential dashboard for exploring emissions anomalies and socioeconomic context.
- **Documentation & Notebook:** Detailed methodology, code, and user guide.

## Team

- **Members:** Aneesha Dasari, Lauren Adolphe, Rinad Salkham, Brianna Ngo
- **Advisors:** Nick Kadochnikov

## Acknowledgements

We acknowledge the Data Science Capstone instructors and any collaborators who provided data and guidance. Sentinels satellite data are provided by the European Space Agency; ADI data sourced from the University of Wisconsin; NEI data from the U.S. EPA.

## Usage & Getting Started

This repository will include Jupyter notebooks and scripts to reproduce our analysis. To get started:

1. Clone the repository:  
   ```bash
   git clone https://github.com/brngo13/MSADS_Team1.git
   ```
2. Install dependencies using `conda` or `pip`: **[placeholder]**.
3. Follow the notebook instructions in `notebooks/` to preprocess data and train the model.  
4. Run scripts in `scripts/` to perform anomaly detection and generate visualizations.

Additional instructions will be provided as the project progresses.

---

Please note that this README is a living document. Sections marked with **[placeholder]** will be updated as our project evolves and more results become available.
