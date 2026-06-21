"""
ASTRAM Backend — FastAPI Application Entrypoint
================================================
Traffic incident management system for Bengaluru.
Provides ML-powered priority/closure/duration prediction with burden scoring,
historical analytics, geospatial mapping, and real-time WebSocket updates.
"""

from __future__ import annotations

import os
# Limit OpenBLAS threads to prevent memory allocation failures on Windows
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

import sys
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).resolve().parent))

load_dotenv()

# ── Shared application state ─────────────────────────────────────────────
# Accessed by route modules via `from main import app_state`
app_state: dict = {
    "df": None,
    "load_report": None,
    "data_loaded": False,
    "predictor": None,
    "ws_manager": None,
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: load data + attempt to load trained models."""
    print("=" * 60)
    print("ASTRAM Backend — Starting up")
    print("=" * 60)

    # ── Load data ─────────────────────────────────────────────────────
    from data.loader import load_and_clean

    print("\n[1/3] Loading and cleaning dataset...")
    try:
        df, report = load_and_clean()
        app_state["df"] = df
        app_state["load_report"] = report
        app_state["data_loaded"] = True
        print(f"  [OK] Loaded {report.total_rows} rows ({report.rows_with_duration} with duration)")
        print(f"  [OK] {report.distinct_causes} causes, {report.distinct_corridors} corridors")
    except Exception as e:
        print(f"  [FAIL] Data loading failed: {e}")

    # ── Load models (if trained) ──────────────────────────────────────
    from models.predictor import Predictor

    print("\n[2/3] Loading ML models...")
    predictor = Predictor()
    if predictor.load():
        app_state["predictor"] = predictor
        print(f"  [OK] All models loaded. Predictor ready.")
    else:
        app_state["predictor"] = predictor
        print("  [WARN] Models not found. Run `python models/train.py` to train.")
        print("    Server will start but POST /predict will return 503.")

    # ── WebSocket manager ─────────────────────────────────────────────
    from api.routes.websocket import manager

    print("\n[3/3] Initializing WebSocket manager...")
    app_state["ws_manager"] = manager
    print("  [OK] WebSocket ready at /ws/live-events")

    print("\n" + "=" * 60)
    print("ASTRAM Backend ready!")
    print(f"  Data: {'[OK]' if app_state['data_loaded'] else '[FAIL]'}")
    print(f"  Models: {'[OK]' if predictor.ready else '[FAIL] (run models/train.py)'}")
    print("=" * 60 + "\n")

    yield

    # Cleanup
    print("ASTRAM Backend shutting down.")


# ── Create app ────────────────────────────────────────────────────────────
app = FastAPI(
    title="ASTRAM Backend",
    description=(
        "Traffic incident management system for Bengaluru. "
        "ML-powered priority, closure, and duration prediction with burden scoring."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS — allow all origins for local development ────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routes ──────────────────────────────────────────────────────
from api.routes.health import router as health_router
from api.routes.predict import router as predict_router
from api.routes.analytics import router as analytics_router
from api.routes.events import router as events_router
from api.routes.routing import router as routing_router
from api.routes.maps import router as maps_router
from api.routes.websocket import router as ws_router

app.include_router(health_router, tags=["Health"])
app.include_router(predict_router, tags=["Prediction"])
app.include_router(analytics_router, tags=["Analytics"])
app.include_router(events_router, tags=["Events"])
app.include_router(routing_router, tags=["Routing"])
app.include_router(maps_router, tags=["Maps"])
app.include_router(ws_router, tags=["WebSocket"])


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint — basic info."""
    return {
        "name": "ASTRAM Backend",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


# ── Run directly ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True)
