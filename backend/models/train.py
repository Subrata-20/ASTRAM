"""
ASTRAM Model Training
---------------------
Trains 3 XGBoost models from the cleaned Astram event dataset:
  1. Priority classifier   (High / Low)
  2. Closure predictor      (True / False — requires_road_closure)
  3. Duration regressor     (duration_minutes, trained on subset with computable duration)

Models + label encoders are serialized to models/saved/.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    mean_absolute_error,
    r2_score,
)
from xgboost import XGBClassifier, XGBRegressor

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from data.loader import load_and_clean, compute_cause_stats

SAVED_DIR = Path(__file__).resolve().parent / "saved"
SAVED_DIR.mkdir(parents=True, exist_ok=True)

# Features used by all three models
FEATURE_COLS = [
    "event_cause",
    "corridor",
    "zone",
    "veh_type",
    "hour_of_day",
    "day_of_week",
    "event_type",
]


def _encode_features(
    df: pd.DataFrame, feature_cols: list[str], encoders: dict[str, LabelEncoder] | None = None
) -> tuple[pd.DataFrame, dict[str, LabelEncoder]]:
    """
    Label-encode categorical columns. If encoders dict is provided, use those
    (for inference); otherwise fit new encoders (for training).
    """
    if encoders is None:
        encoders = {}

    encoded = df.copy()
    categorical_cols = ["event_cause", "corridor", "zone", "veh_type", "event_type"]

    for col in categorical_cols:
        if col not in feature_cols:
            continue
        encoded[col] = encoded[col].fillna("_unknown_").astype(str)

        if col not in encoders:
            le = LabelEncoder()
            encoded[col] = le.fit_transform(encoded[col])
            encoders[col] = le
        else:
            le = encoders[col]
            # Handle unseen labels at inference time
            known = set(le.classes_)
            encoded[col] = encoded[col].apply(lambda x: x if x in known else "_unknown_")
            if "_unknown_" not in le.classes_:
                le.classes_ = np.append(le.classes_, "_unknown_")
            encoded[col] = le.transform(encoded[col])

    return encoded, encoders


def train_all() -> dict:
    """Train all 3 models and save artifacts. Returns metrics dict."""
    print("Loading and cleaning data...")
    df, report = load_and_clean()
    print(f"  Loaded {report.total_rows} rows, {report.rows_with_duration} with duration")

    # Precompute cause stats and save
    cause_stats = compute_cause_stats(df)
    cause_stats.to_csv(SAVED_DIR / "cause_stats.csv")
    print(f"  Saved cause_stats.csv ({len(cause_stats)} causes)")

    metrics = {}

    # ── 1. Priority Classifier ────────────────────────────────────────────
    print("\n[1/3] Training Priority Classifier...")
    df_pri = df[df["priority"].isin(["High", "Low"])].copy()
    print(f"  Training rows: {len(df_pri)}")

    df_pri_enc, encoders = _encode_features(df_pri, FEATURE_COLS)
    X_pri = df_pri_enc[FEATURE_COLS].copy()
    # Ensure numeric
    for col in ["hour_of_day", "day_of_week"]:
        X_pri[col] = X_pri[col].fillna(0).astype(float)

    y_pri = LabelEncoder()
    y_labels = y_pri.fit_transform(df_pri["priority"])

    X_train, X_test, y_train, y_test = train_test_split(
        X_pri, y_labels, test_size=0.2, random_state=42, stratify=y_labels
    )

    pri_model = XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        use_label_encoder=False,
        eval_metric="logloss",
        random_state=42,
    )
    pri_model.fit(X_train, y_train)

    y_pred = pri_model.predict(X_test)
    pri_acc = accuracy_score(y_test, y_pred)
    print(f"  Priority accuracy: {pri_acc:.4f}")
    print(classification_report(y_test, y_pred, target_names=y_pri.classes_))

    pri_model.save_model(str(SAVED_DIR / "priority_classifier.json"))
    joblib.dump(y_pri, SAVED_DIR / "priority_label_encoder.pkl")
    metrics["priority_accuracy"] = round(pri_acc, 4)

    # ── 2. Closure Predictor ──────────────────────────────────────────────
    print("[2/3] Training Closure Predictor...")
    df_cls = df[df["requires_road_closure"].notna()].copy()
    print(f"  Training rows: {len(df_cls)}")

    df_cls_enc, _ = _encode_features(df_cls, FEATURE_COLS, encoders={k: v for k, v in encoders.items()})
    X_cls = df_cls_enc[FEATURE_COLS].copy()
    for col in ["hour_of_day", "day_of_week"]:
        X_cls[col] = X_cls[col].fillna(0).astype(float)

    y_cls = df_cls["requires_road_closure"].astype(int).values

    X_train, X_test, y_train, y_test = train_test_split(
        X_cls, y_cls, test_size=0.2, random_state=42, stratify=y_cls
    )

    cls_model = XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        use_label_encoder=False,
        eval_metric="logloss",
        random_state=42,
    )
    cls_model.fit(X_train, y_train)

    y_pred = cls_model.predict(X_test)
    cls_acc = accuracy_score(y_test, y_pred)
    print(f"  Closure accuracy: {cls_acc:.4f}")
    print(classification_report(y_test, y_pred, target_names=["No Closure", "Closure"]))

    cls_model.save_model(str(SAVED_DIR / "closure_predictor.json"))
    metrics["closure_accuracy"] = round(cls_acc, 4)

    # ── 3. Duration Regressor ─────────────────────────────────────────────
    print("[3/3] Training Duration Regressor...")
    df_dur = df[df["duration_minutes"].notna() & (df["duration_minutes"] > 0)].copy()
    print(f"  Training rows: {len(df_dur)}")

    df_dur_enc, _ = _encode_features(df_dur, FEATURE_COLS, encoders={k: v for k, v in encoders.items()})
    X_dur = df_dur_enc[FEATURE_COLS].copy()
    for col in ["hour_of_day", "day_of_week"]:
        X_dur[col] = X_dur[col].fillna(0).astype(float)

    y_dur = df_dur["duration_minutes"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X_dur, y_dur, test_size=0.2, random_state=42
    )

    dur_model = XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.1,
        random_state=42,
    )
    dur_model.fit(X_train, y_train)

    y_pred = dur_model.predict(X_test)
    dur_mae = mean_absolute_error(y_test, y_pred)
    dur_r2 = r2_score(y_test, y_pred)
    print(f"  Duration MAE: {dur_mae:.2f} min, R²: {dur_r2:.4f}")

    dur_model.save_model(str(SAVED_DIR / "duration_regressor.json"))
    metrics["duration_mae_minutes"] = round(dur_mae, 2)
    metrics["duration_r2"] = round(dur_r2, 4)

    # ── Save shared encoders ──────────────────────────────────────────────
    joblib.dump(encoders, SAVED_DIR / "feature_encoders.pkl")

    # Save feature column order
    with open(SAVED_DIR / "feature_cols.json", "w") as f:
        json.dump(FEATURE_COLS, f)

    # Save metrics
    with open(SAVED_DIR / "training_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    print("\n" + "=" * 60)
    print("All models trained and saved to models/saved/")
    print(f"Metrics: {json.dumps(metrics, indent=2)}")
    print("=" * 60)

    return metrics


if __name__ == "__main__":
    train_all()
