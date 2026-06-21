"""
ASTRAM Data Loader
------------------
CSV loading, cleaning, validation for the Astram event dataset.
Produces a cleaned DataFrame and a LoadReport with data-quality metrics.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

# Bengaluru bounding box (generous)
_BLR_LAT_MIN, _BLR_LAT_MAX = 12.70, 13.50
_BLR_LON_MIN, _BLR_LON_MAX = 77.30, 77.90

# Default path to raw CSV
_DEFAULT_CSV = Path(__file__).resolve().parent / "raw" / "astram_events.csv"


@dataclass
class LoadReport:
    """Data-quality summary exposed via GET /health."""
    total_rows: int = 0
    usable_rows: int = 0
    rows_with_duration: int = 0
    distinct_causes: int = 0
    distinct_corridors: int = 0
    distinct_zones: int = 0
    rows_invalid_coordinates: int = 0
    rows_negative_duration: int = 0
    null_counts: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "total_rows": self.total_rows,
            "usable_rows": self.usable_rows,
            "rows_with_duration": self.rows_with_duration,
            "distinct_causes": self.distinct_causes,
            "distinct_corridors": self.distinct_corridors,
            "distinct_zones": self.distinct_zones,
            "rows_invalid_coordinates": self.rows_invalid_coordinates,
            "rows_negative_duration": self.rows_negative_duration,
            "null_counts": self.null_counts,
        }


def load_and_clean(csv_path: Optional[str] = None) -> tuple[pd.DataFrame, LoadReport]:
    """
    Load the raw Astram CSV, apply cleaning rules, return (DataFrame, LoadReport).

    Cleaning rules (from the implementation plan):
    1. Normalize event_cause: lowercase + strip
    2. Parse datetime columns
    3. Compute duration_minutes; null it when closed < start (3 rows)
    4. Validate coordinates against Bengaluru bounding box
    5. No rows dropped — all 8,173 are usable
    """
    path = csv_path or str(_DEFAULT_CSV)
    df = pd.read_csv(path, low_memory=False)

    report = LoadReport()
    report.total_rows = len(df)

    # ── 1. Normalize event_cause ──────────────────────────────────────────
    if "event_cause" in df.columns:
        df["event_cause"] = (
            df["event_cause"]
            .astype(str)
            .str.lower()
            .str.strip()
            .replace("nan", np.nan)
        )

    # ── 2. Parse datetimes ────────────────────────────────────────────────
    for col in ["start_datetime", "end_datetime", "closed_datetime",
                "created_date", "modified_datetime", "resolved_datetime"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce", utc=True)

    # ── 3. Compute duration_minutes ───────────────────────────────────────
    df["duration_minutes"] = np.nan
    if "start_datetime" in df.columns and "closed_datetime" in df.columns:
        mask_both = df["start_datetime"].notna() & df["closed_datetime"].notna()
        delta = (df.loc[mask_both, "closed_datetime"] - df.loc[mask_both, "start_datetime"])
        minutes = delta.dt.total_seconds() / 60.0

        # Null out rows where closed < start (negative duration)
        negative_mask = minutes < 0
        report.rows_negative_duration = int(negative_mask.sum())
        minutes[negative_mask] = np.nan

        df.loc[mask_both, "duration_minutes"] = minutes

    report.rows_with_duration = int(df["duration_minutes"].notna().sum())

    # ── 4. Coordinate validation ──────────────────────────────────────────
    df["has_valid_coordinates"] = (
        df["latitude"].between(_BLR_LAT_MIN, _BLR_LAT_MAX) &
        df["longitude"].between(_BLR_LON_MIN, _BLR_LON_MAX)
    )
    report.rows_invalid_coordinates = int((~df["has_valid_coordinates"]).sum())

    # ── 5. Normalize other text columns ───────────────────────────────────
    for col in ["status", "priority", "event_type", "corridor", "zone"]:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().replace({"nan": np.nan, "NULL": np.nan, "None": np.nan})

    if "requires_road_closure" in df.columns:
        df["requires_road_closure"] = (
            df["requires_road_closure"]
            .astype(str)
            .str.upper()
            .str.strip()
            .map({"TRUE": True, "FALSE": False})
        )

    # ── 6. Extract time features ──────────────────────────────────────────
    if "start_datetime" in df.columns:
        df["hour_of_day"] = df["start_datetime"].dt.hour
        df["day_of_week"] = df["start_datetime"].dt.dayofweek  # 0=Monday

    # ── 7. Normalize veh_type ─────────────────────────────────────────────
    if "veh_type" in df.columns:
        df["veh_type"] = (
            df["veh_type"]
            .astype(str)
            .str.lower()
            .str.strip()
            .replace("nan", np.nan)
        )

    # ── Report ────────────────────────────────────────────────────────────
    report.usable_rows = len(df)  # no rows dropped
    report.distinct_causes = int(df["event_cause"].dropna().nunique()) if "event_cause" in df.columns else 0
    report.distinct_corridors = int(df["corridor"].dropna().nunique()) if "corridor" in df.columns else 0
    report.distinct_zones = int(df["zone"].dropna().nunique()) if "zone" in df.columns else 0

    key_cols = ["event_cause", "corridor", "zone", "priority", "address",
                "latitude", "longitude", "status", "veh_type"]
    report.null_counts = {
        col: int(df[col].isna().sum()) for col in key_cols if col in df.columns
    }

    return df, report


# ── Historical aggregations (precomputed once for burden score) ───────────
def compute_cause_stats(df: pd.DataFrame) -> pd.DataFrame:
    """
    Per-cause historical statistics used in burden score computation.
    Returns DataFrame indexed by event_cause with columns:
      - median_duration_minutes
      - closure_rate (fraction of events requiring road closure)
      - event_count
      - duration_percentile (0-1 rank among causes by median duration)
    """
    cause_groups = df.groupby("event_cause")

    stats = pd.DataFrame({
        "median_duration_minutes": cause_groups["duration_minutes"].median(),
        "closure_rate": cause_groups["requires_road_closure"].mean(),
        "event_count": cause_groups["event_cause"].count(),
    })

    # Duration percentile: rank among causes (not events)
    stats["duration_percentile"] = stats["median_duration_minutes"].rank(pct=True)

    # Fill NaN median durations with overall median
    overall_median = df["duration_minutes"].median()
    stats["median_duration_minutes"] = stats["median_duration_minutes"].fillna(overall_median)
    stats["duration_percentile"] = stats["duration_percentile"].fillna(0.5)
    stats["closure_rate"] = stats["closure_rate"].fillna(0.0)

    return stats


# ── Standalone test ───────────────────────────────────────────────────────
if __name__ == "__main__":
    df, report = load_and_clean()
    print("=" * 60)
    print("ASTRAM Data Loader — Verification Report")
    print("=" * 60)
    for k, v in report.to_dict().items():
        print(f"  {k}: {v}")
    print(f"\nColumns: {list(df.columns)}")
    print(f"Sample event_causes: {sorted(df['event_cause'].dropna().unique().tolist())}")

    cause_stats = compute_cause_stats(df)
    print(f"\nCause statistics:\n{cause_stats.to_string()}")
