"""Health endpoint — system status, data quality, predictor readiness."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    GET /health
    Returns system status, row counts, predictor readiness, data-quality summary.
    """
    from main import app_state

    result = {
        "status": "ok",
        "predictor_ready": app_state["predictor"].ready if app_state.get("predictor") else False,
        "data_loaded": app_state.get("data_loaded", False),
    }

    if app_state.get("load_report"):
        result["data_quality"] = app_state["load_report"].to_dict()

    if app_state.get("predictor") and app_state["predictor"].ready:
        result["training_metrics"] = app_state["predictor"].training_metrics

    return result
