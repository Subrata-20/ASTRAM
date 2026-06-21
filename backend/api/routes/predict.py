"""Prediction endpoint — runs 3 models + burden score."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter()


class PredictRequest(BaseModel):
    """Input for POST /predict."""
    event_type: str = Field(..., description="planned or unplanned")
    event_cause: str = Field(..., description="e.g. vehicle_breakdown, accident, tree_fall")
    corridor: Optional[str] = Field(None, description="e.g. Tumkur Road, ORR East 1")
    zone: Optional[str] = Field(None, description="e.g. North Zone 1")
    veh_type: Optional[str] = Field(None, description="e.g. heavy_vehicle, bmtc_bus, private_car")
    hour_of_day: int = Field(12, ge=0, le=23, description="Hour (0-23)")
    day_of_week: int = Field(0, ge=0, le=6, description="Day of week (0=Monday)")

    model_config = {"json_schema_extra": {
        "examples": [{
            "event_type": "unplanned",
            "event_cause": "vehicle_breakdown",
            "corridor": "Tumkur Road",
            "zone": "North Zone 1",
            "veh_type": "heavy_vehicle",
            "hour_of_day": 9,
            "day_of_week": 2,
        }]
    }}


@router.post("/predict")
async def predict(req: PredictRequest):
    """
    POST /predict
    Runs the 3 models + burden score.
    Returns priority, closure, duration, manpower/barricading/diversion recommendation.
    HTTP 503 if models not yet trained.
    """
    from main import app_state

    predictor = app_state.get("predictor")
    if not predictor or not predictor.ready:
        raise HTTPException(
            status_code=503,
            detail="Models not yet trained. Run `python models/train.py` first, then restart the server.",
        )

    event = req.model_dump()
    result = predictor.predict(event)

    # Broadcast to WebSocket clients
    ws_manager = app_state.get("ws_manager")
    if ws_manager:
        import asyncio
        asyncio.create_task(ws_manager.broadcast({
            "type": "new_prediction",
            "data": {
                "event": event,
                "prediction": result,
            },
        }))

    return result
