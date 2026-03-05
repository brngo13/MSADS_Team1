"""
fusionmodels.py
=========

About This Python Module
------------------------

This module defines all PyTorch datasets and model architectures used in the
EPA Emissions Verification Capstone project.

It includes:

1. Sentinel-2 dataset and model (optical imagery branch)
2. Sentinel-5P dataset and model (atmospheric NO₂ branch)
3. Fusion dataset and model (multimodal late-fusion architecture)

The models are designed for regression on log-transformed NO₂ values
(`no2_log`) at the sensor or facility level.

Design Principles
-----------------
- All datasets load imagery directly from GCS using gcsfs.
- All satellite data is percentile-normalized to [0,1].
- Sentinel-2 uses a pretrained ResNet50 backbone adapted for 12 channels.
- Sentinel-5 uses a lightweight CNN feature extractor.
- FusionModel concatenates learned feature embeddings from both branches.
- Output is always a single regression value (log NO₂).

Expected Input Shapes
---------------------
S2: (12, 120, 120)
S5: (1, 120, 120)
Fusion: ((12,120,120), (1,120,120))

Target
------
Scalar log-transformed NO₂ value (no2_log).

This module contains no training logic.
Training loops, optimizers, and evaluation live in separate notebooks/scripts.
"""

# ============================================================
# Sentinel-2 Dataset
# ============================================================
import torch
from torch.utils.data import Dataset
import numpy as np
import rasterio
import gcsfs

class S2Dataset(Dataset):
    """
    Dataset for Sentinel-2 image regression.

    Returns:
        s2_tensor: (12, 120, 120)
        label:     scalar log(NO2)
    """
    def __init__(self, df, s2_path, s2_percentiles):
        self.df = df.reset_index(drop=True)
        self.s2_path = s2_path
        self.percentiles = s2_percentiles
        self.fs = gcsfs.GCSFileSystem()

    def __len__(self):
        return len(self.df)

    # -----------------------------------------
    # Percentile normalization for 12 bands
    # -----------------------------------------
    def normalize_s2(self, s2):
        for b in range(12):
            p1, p99 = self.percentiles[b]
            s2[b] = (s2[b] - p1) / (p99 - p1 + 1e-8)
            s2[b] = np.clip(s2[b], 0, 1)
        return s2

    def __getitem__(self, idx):
        row = self.df.iloc[idx]

        device_id = row["DeviceId"]
        quarter = row["quarter"]
        label = row["no2_log"]

        s2_file = f"{self.s2_path}/S2_Device{device_id}_{quarter}.tif"

        with self.fs.open(s2_file, 'rb') as f:
            with rasterio.open(f) as src:
                s2 = src.read().astype(np.float32)

        s2 = self.normalize_s2(s2)

        return (
            torch.tensor(s2, dtype=torch.float32),
            torch.tensor(label, dtype=torch.float32)
        )

# ============================================================
# Sentinel-2 Model (ResNet50 backbone, 12-channel input)
# ============================================================
import torch
import torch.nn as nn
import torchvision.models as models

class S2Model(nn.Module):
    """
    Sentinel-2 regression model using pretrained ResNet50.

    - First convolution modified for 12 input channels.
    - Backbone outputs 2048-d feature vector.
    - Final linear layer produces scalar regression output.
    """
    def __init__(self):
        super().__init__()
        
        pretrained = models.resnet50(
            weights=models.ResNet50_Weights.IMAGENET1K_V1
        )
        
        # Save original conv weights
        old_conv = pretrained.conv1
        
        # Create new 12-channel conv
        new_conv = nn.Conv2d(
            12, 64,
            kernel_size=7,
            stride=2,
            padding=3,
            bias=False
        )
        
        # Initialize new conv using pretrained RGB weights
        with torch.no_grad():
            new_conv.weight[:, :3, :, :] = old_conv.weight
            for i in range(3, 12):
                new_conv.weight[:, i:i+1, :, :] = old_conv.weight[:, i % 3:i % 3+1, :, :]
        
        pretrained.conv1 = new_conv
        pretrained.fc = nn.Identity()
        
        self.backbone = pretrained
        self.regressor = nn.Linear(2048, 1)

    def forward(self, x):
        features = self.backbone(x)
        return self.regressor(features)

# ============================================================
# Sentinel-5 Dataset
# ============================================================
import torch
from torch.utils.data import Dataset
import rasterio
import gcsfs
import numpy as np

class S5OnlyDataset(Dataset):
    """
    Dataset for Sentinel-5P only regression.
    Returns:
        s5_tensor: (1, 120, 120)
        label:     scalar log(NO2)
    """
    
    def __init__(self, df, s5_path, s5_percentiles):
        self.df = df.reset_index(drop=True)
        self.s5_path = s5_path
        self.fs = gcsfs.GCSFileSystem()
        self.p1, self.p99 = s5_percentiles
    
    def __len__(self):
        return len(self.df)
        
    # -----------------------------------------
    # Percentile normalization for single band
    # -----------------------------------------    
    def normalize_s5(self, s5):
        s5 = (s5 - self.p1) / (self.p99 - self.p1)
        s5 = np.clip(s5, 0, 1)
        return s5
    
    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        
        device_id = row["DeviceId"]
        quarter = row["quarter"]
        label = row["no2_log"]   # ← IMPORTANT: log target
        
        s5_file = f"{self.s5_path}/S5_Device{device_id}_{quarter}.tif"
        
        with self.fs.open(s5_file, "rb") as f:
            with rasterio.open(f) as src:
                s5 = src.read(1).astype(np.float32)  # single band
        
        s5 = self.normalize_s5(s5)
        s5 = np.expand_dims(s5, axis=0)  # shape (1,120,120)
        
        return (
            torch.tensor(s5, dtype=torch.float32),
            torch.tensor(label, dtype=torch.float32)
        )


# ============================================================
# Sentinel-5 Model
# ============================================================
import torch.nn as nn

class S5Model(nn.Module):
    """
    Lightweight CNN for Sentinel-5 regression.

    - Two convolution layers
    - Adaptive pooling
    - Projection to 2048-d feature space
    - Linear regression head
    """
    def __init__(self):
        super().__init__()
        
        # Feature extractor
        self.features = nn.Sequential(
            nn.Conv2d(1, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(),
            
            nn.AdaptiveAvgPool2d((4, 4))
        )
        
        self.flatten = nn.Flatten()
        
        # Project to 2048 feature vector
        self.feature_projection = nn.Linear(128 * 4 * 4, 2048)
        
        # Regression head
        self.regressor = nn.Linear(2048, 1)
    
    def forward(self, x):
        x = self.features(x)
        x = self.flatten(x)
        x = self.feature_projection(x)
        x = self.regressor(x)
        return x

# ============================================================
# Sentinel-5 Feature Extractor (for Fusion)
# ============================================================
# Extract backbone
class S5FeatureExtractor(nn.Module):
    """
    Extracts 2048-d feature embeddings from a trained S5Model.
    Used in FusionModel.
    """
    def __init__(self, trained_model):
        super().__init__()
        self.features = trained_model.features
        self.flatten = trained_model.flatten
        self.projection = trained_model.feature_projection

    def forward(self, x):
        x = self.features(x)
        x = self.flatten(x)
        x = self.projection(x)
        return x

# ============================================================
# Fusion Model (Late Fusion)
# ============================================================
class FusionModel(nn.Module):
    """
    Multimodal late-fusion model.

    - Accepts S2 backbone (2048-d output)
    - Accepts S5 backbone (2048-d output)
    - Concatenates features (4096-d)
    - Predicts scalar log(NO2)
    """
    def __init__(self, s2_backbone, s5_backbone):
        super().__init__()
        self.s2 = s2_backbone
        self.s5 = s5_backbone
        
        self.estimation = nn.Sequential(
            nn.Linear(4096, 512),
            nn.ReLU(),
            nn.Linear(512, 1)
        )

    def forward(self, s2, s5):
        s2_feat = self.s2(s2)
        s5_feat = self.s5(s5)
        fused = torch.cat([s2_feat, s5_feat], dim=1)
        return self.estimation(fused)

# ============================================================
# Fusion Dataset
# ============================================================
import torch
from torch.utils.data import Dataset
import numpy as np
import rasterio
import gcsfs


class FusionDataset(Dataset):
    """
    Dataset for Fusion model training.

    Returns:
        s2_tensor: (12, 120, 120)
        s5_tensor: (1, 120, 120)
        label: scalar (no2_log)
    """

    def __init__(self, df, s2_path, s5_path, s2_percentiles, s5_percentiles):
        self.df = df.reset_index(drop=True)
        self.s2_path = s2_path
        self.s5_path = s5_path
        self.s2_percentiles = s2_percentiles
        self.s5_p1 = s5_percentiles[0]
        self.s5_p99 = s5_percentiles[1]
        self.fs = gcsfs.GCSFileSystem()

    def __len__(self):
        return len(self.df)

    # -----------------------------
    # S2 Normalization (12 bands)
    # -----------------------------
    def normalize_s2(self, s2):
        for b in range(12):
            p1, p99 = self.s2_percentiles[b]
            s2[b] = (s2[b] - p1) / (p99 - p1 + 1e-8)
            s2[b] = np.clip(s2[b], 0, 1)
        return s2

    # -----------------------------
    # S5 Normalization (1 band)
    # -----------------------------
    def normalize_s5(self, s5):
        s5 = (s5 - self.s5_p1) / (self.s5_p99 - self.s5_p1 + 1e-8)
        s5 = np.clip(s5, 0, 1)
        return s5

    def __getitem__(self, idx):
        row = self.df.iloc[idx]

        device_id = row["DeviceId"]
        quarter = row["quarter"]
        label = row["no2_log"]

        s2_file = f"{self.s2_path}/S2_Device{device_id}_{quarter}.tif"
        s5_file = f"{self.s5_path}/S5_Device{device_id}_{quarter}.tif"

        # ---- Load S2 ----
        with self.fs.open(s2_file, "rb") as f:
            with rasterio.open(f) as src:
                s2 = src.read().astype(np.float32)

        # ---- Load S5 ----
        with self.fs.open(s5_file, "rb") as f:
            with rasterio.open(f) as src:
                s5 = src.read().astype(np.float32)

        # Normalize
        s2 = self.normalize_s2(s2)
        s5 = self.normalize_s5(s5)

        return (
            torch.tensor(s2, dtype=torch.float32),
            torch.tensor(s5, dtype=torch.float32),
            torch.tensor(label, dtype=torch.float32)
        )