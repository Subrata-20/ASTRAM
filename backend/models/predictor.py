"""
ASTRAM Predictor
----------------
Loads trained XGBoost models, runs inference, computes burden score,
and generates manpower/barricading/diversion recommendations.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

import joblib
import os
from google import genai
import numpy as np
import pandas as pd
from xgboost import XGBClassifier, XGBRegressor

SAVED_DIR = Path(__file__).resolve().parent / "saved"


class Predictor:
    """Loads trained models and provides prediction + burden score."""

    def __init__(self) -> None:
        self.ready = False
        self.priority_model: Optional[XGBClassifier] = None
        self.closure_model: Optional[XGBClassifier] = None
        self.duration_model: Optional[XGBRegressor] = None
        self.feature_encoders: dict = {}
        self.priority_label_encoder = None
        self.feature_cols: list[str] = []
        self.cause_stats: Optional[pd.DataFrame] = None
        self.training_metrics: dict = {}

    def load(self) -> bool:
        """Attempt to load all model artifacts. Returns True if successful."""
        try:
            # Check all required files exist
            required = [
                "priority_classifier.json",
                "closure_predictor.json",
                "duration_regressor.json",
                "feature_encoders.pkl",
                "priority_label_encoder.pkl",
                "feature_cols.json",
                "cause_stats.csv",
            ]
            for fname in required:
                if not (SAVED_DIR / fname).exists():
                    print(f"  [Predictor] Missing: {fname}")
                    return False

            # Load models
            self.priority_model = XGBClassifier()
            self.priority_model.load_model(str(SAVED_DIR / "priority_classifier.json"))

            self.closure_model = XGBClassifier()
            self.closure_model.load_model(str(SAVED_DIR / "closure_predictor.json"))

            self.duration_model = XGBRegressor()
            self.duration_model.load_model(str(SAVED_DIR / "duration_regressor.json"))

            # Load encoders
            self.feature_encoders = joblib.load(SAVED_DIR / "feature_encoders.pkl")
            self.priority_label_encoder = joblib.load(SAVED_DIR / "priority_label_encoder.pkl")

            # Load feature column order
            with open(SAVED_DIR / "feature_cols.json") as f:
                self.feature_cols = json.load(f)

            # Load cause stats for burden score
            self.cause_stats = pd.read_csv(SAVED_DIR / "cause_stats.csv", index_col=0)

            # Load training metrics
            metrics_path = SAVED_DIR / "training_metrics.json"
            if metrics_path.exists():
                with open(metrics_path) as f:
                    self.training_metrics = json.load(f)

            self.ready = True
            print("  [Predictor] All models loaded successfully")
            return True

        except Exception as e:
            print(f"  [Predictor] Failed to load models: {e}")
            self.ready = False
            return False

    def _encode_input(self, event: dict) -> pd.DataFrame:
        """Encode a single event dict into model-ready features."""
        row = {}
        categorical_cols = ["event_cause", "corridor", "zone", "veh_type", "event_type"]

        for col in self.feature_cols:
            val = event.get(col, None)

            if col in categorical_cols:
                val = str(val).lower().strip() if val else "_unknown_"
                le = self.feature_encoders.get(col)
                if le is not None:
                    known = set(le.classes_)
                    if val not in known:
                        val = "_unknown_"
                        if "_unknown_" not in le.classes_:
                            le.classes_ = np.append(le.classes_, "_unknown_")
                    val = le.transform([val])[0]
                else:
                    val = 0
            else:
                val = float(val) if val is not None else 0.0

            row[col] = val

        return pd.DataFrame([row])

    def predict(self, event: dict) -> dict[str, Any]:
        """
        Run all 3 models + burden score on a single event.

        Args:
            event: dict with keys matching FEATURE_COLS
                   (event_cause, corridor, zone, veh_type, hour_of_day, day_of_week, event_type)

        Returns:
            dict with prediction results and recommendations
        """
        if not self.ready:
            raise RuntimeError("Models not loaded. Run models/train.py first.")

        X = self._encode_input(event)

        # ── Priority prediction ───────────────────────────────────────────
        pri_proba = self.priority_model.predict_proba(X)[0]
        pri_idx = int(np.argmax(pri_proba))
        priority = self.priority_label_encoder.inverse_transform([pri_idx])[0]
        priority_confidence = float(pri_proba[pri_idx])

        # ── Closure prediction ────────────────────────────────────────────
        cls_proba = self.closure_model.predict_proba(X)[0]
        cls_idx = int(np.argmax(cls_proba))
        requires_closure = bool(cls_idx == 1)
        closure_confidence = float(cls_proba[cls_idx])

        # ── Duration prediction ───────────────────────────────────────────
        duration_minutes = float(self.duration_model.predict(X)[0])
        duration_minutes = max(0, duration_minutes)  # no negative durations

        # ── Burden score ──────────────────────────────────────────────────
        burden_score = self._compute_burden_score(
            event.get("event_cause", ""),
            priority,
            priority_confidence,
            duration_minutes,
        )

        # ── Recommendations ──────────────────────────────────────────────
        recommendations = self._generate_recommendations(
            priority, requires_closure, duration_minutes, burden_score,
            event.get("event_cause", "")
        )

        return {
            "priority": {
                "predicted": priority,
                "confidence": round(priority_confidence, 3),
            },
            "closure": {
                "required": requires_closure,
                "confidence": round(closure_confidence, 3),
            },
            "duration": {
                "predicted_minutes": round(duration_minutes, 1),
                "predicted_display": self._format_duration(duration_minutes),
            },
            "burden_score": round(burden_score, 1),
            "recommendations": recommendations,
        }

    def _compute_burden_score(
        self,
        cause: str,
        predicted_priority: str,
        priority_confidence: float,
        predicted_duration: float,
    ) -> float:
        """
        Calculates a burden score (0-100) using an additive model:
        - 50 points max from Priority (severity)
        - 30 points max from Duration (historical + predicted)
        - 20 points max from Historical Closure Rate
        """
        # 1. Base Severity (Up to 50 points)
        severity_weight = 0.8 if predicted_priority in ["High", "CRITICAL"] else 0.4
        severity_weight *= priority_confidence
        base_severity = (severity_weight / 0.8) * 50.0

        # 2. Historical stats
        cause_clean = str(cause).lower().strip()
        if self.cause_stats is not None and cause_clean in self.cause_stats.index:
            stats = self.cause_stats.loc[cause_clean]
            duration_percentile = float(stats.get("duration_percentile", 0.5))
            closure_rate = float(stats.get("closure_rate", 0.1))
        else:
            duration_percentile = 0.5
            closure_rate = 0.1

        # 3. Duration Factor (Up to 30 points)
        # Cap predicted duration against a 2-hour reasonable impact max (120 mins)
        predicted_duration_factor = min(predicted_duration / 120.0, 1.0)
        duration_points = 30.0 * ((duration_percentile + predicted_duration_factor) / 2.0)

        # 4. Closure Rate Factor (Up to 20 points)
        closure_points = 20.0 * closure_rate

        # Total Burden
        burden = base_severity + duration_points + closure_points
        return min(100.0, max(0.0, burden))

    def _generate_recommendations(
        self,
        priority: str,
        requires_closure: bool,
        duration_minutes: float,
        burden_score: float,
        cause: str,
    ) -> dict[str, Any]:
        """Generate manpower, barricading, and diversion recommendations."""

        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            try:
                client = genai.Client(api_key=api_key)
                prompt = f"""
You are an expert traffic incident commander for Bengaluru traffic police.
An incident has occurred with the following details:
- Cause: {cause}
- Priority: {priority}
- Estimated Duration: {self._format_duration(duration_minutes)}
- Grid Burden Score: {burden_score}/100
- Requires Road Closure: {requires_closure}

Provide intelligent, highly specific recommendations for manpower, barricading, and diversion based on Bengaluru road infrastructure.
Output strictly as a valid JSON object matching exactly this structure (no markdown tags):
{{
  "manpower": {{
    "level": "Low" | "Medium" | "High",
    "personnel_count": <number>,
    "includes_traffic_police": <boolean>,
    "includes_emergency_services": <boolean>,
    "estimated_hours": <number>
  }},
  "barricading": {{
    "type": "<Specific barricade name like 'Concrete Jersey Barriers' or 'Reflective Cones'>",
    "description": "<Specific reasoning for this type of barricade. Keep it very concise, strictly 1 or 2 short sentences max.>",
    "requires_diversion": <boolean>
  }},
  "diversion": {{
    "recommended": <boolean>,
    "reason": "<Detailed reasoning for why diversion is or isn't required>",
    "suggestion": "Use the map routing feature to find alternative routes around the incident location"
  }}
}}
"""
                response = client.models.generate_content(
                    model='gemini-3.5-flash',
                    contents=prompt,
                )
                text = response.text.strip()
                if text.startswith("```json"):
                    text = text.split("```json")[1].split("```")[0].strip()
                elif text.startswith("```"):
                    text = text.split("```")[1].split("```")[0].strip()
                
                result = json.loads(text)
                return result
            except Exception as e:
                print("Gemini API failed, falling back to static logic:", e)

        # ── Fallback Manpower ──────────────────────────────────────────────
        if burden_score >= 70:
            personnel = 8
            manpower_level = "High"
        elif burden_score >= 40:
            personnel = 5
            manpower_level = "Medium"
        elif priority == "High" or priority == "CRITICAL":
            personnel = 4
            manpower_level = "Medium"
        else:
            personnel = 2
            manpower_level = "Low"

        if requires_closure:
            personnel += 3

        manpower = {
            "level": manpower_level,
            "personnel_count": personnel,
            "includes_traffic_police": priority == "High" or burden_score >= 50,
            "includes_emergency_services": cause in ["accident", "fire", "tree_fall"],
            "estimated_hours": round(duration_minutes / 60, 1),
        }

        # ── Barricading ──────────────────────────────────────────────────
        if requires_closure:
            barricading_type = "Full Road Closure"
            barricading_desc = "Complete road closure with barriers on all approach roads"
        elif burden_score >= 60:
            barricading_type = "Partial Lane Closure"
            barricading_desc = "Lane reduction with traffic cones and signage"
        elif burden_score >= 30:
            barricading_type = "Warning Signs Only"
            barricading_desc = "Hazard warning signs and speed reduction boards"
        else:
            barricading_type = "Minimal"
            barricading_desc = "Standard caution cones at incident location"

        barricading = {
            "type": barricading_type,
            "description": barricading_desc,
            "requires_diversion": requires_closure or burden_score >= 60,
        }

        # ── Diversion ────────────────────────────────────────────────────
        if barricading["requires_diversion"]:
            diversion = {
                "recommended": True,
                "reason": f"{'Road closure required' if requires_closure else 'High burden score'} — "
                         f"estimated duration: {self._format_duration(duration_minutes)}",
                "suggestion": "Use the map routing feature to find alternative routes around the incident location",
            }
        else:
            diversion = {
                "recommended": False,
                "reason": "Incident can be managed without traffic diversion",
            }

        return {
            "manpower": manpower,
            "barricading": barricading,
            "diversion": diversion,
        }

    @staticmethod
    def _format_duration(minutes: float) -> str:
        """Format minutes into human-readable string."""
        if minutes < 60:
            return f"{int(minutes)} min"
        hours = int(minutes // 60)
        mins = int(minutes % 60)
        if hours < 24:
            return f"{hours}h {mins}m"
        days = hours // 24
        remaining_hours = hours % 24
        return f"{days}d {remaining_hours}h"
