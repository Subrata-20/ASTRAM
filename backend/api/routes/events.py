"""Events endpoints — dropdown values, sample events, filtered search."""

from fastapi import APIRouter, Query
from typing import Optional

router = APIRouter()


@router.get("/events/causes")
async def get_causes():
    """GET /events/causes — distinct sorted event causes for form dropdowns."""
    from main import app_state

    df = app_state.get("df")
    if df is None:
        return {"causes": []}

    causes = sorted(df["event_cause"].dropna().unique().tolist())
    return {"causes": causes}


@router.get("/events/corridors")
async def get_corridors():
    """GET /events/corridors — distinct sorted corridors."""
    from main import app_state

    df = app_state.get("df")
    if df is None:
        return {"corridors": []}

    corridors = sorted(df["corridor"].dropna().unique().tolist())
    return {"corridors": corridors}


@router.get("/events/zones")
async def get_zones():
    """GET /events/zones — distinct sorted zones."""
    from main import app_state

    df = app_state.get("df")
    if df is None:
        return {"zones": []}

    zones = sorted(df["zone"].dropna().unique().tolist())
    return {"zones": zones}


@router.get("/events/vehicle-types")
async def get_vehicle_types():
    """GET /events/vehicle-types — distinct sorted vehicle types."""
    from main import app_state

    df = app_state.get("df")
    if df is None:
        return {"vehicle_types": []}

    if "veh_type" in df.columns:
        types = sorted(df["veh_type"].dropna().unique().tolist())
    else:
        types = []
    return {"vehicle_types": types}


@router.get("/events/sample")
async def get_sample_events(count: int = Query(20, ge=1, le=100)):
    """
    GET /events/sample
    Returns random sample of events (safe columns only) for the dashboard feed.
    """
    from main import app_state

    df = app_state.get("df")
    if df is None or df.empty:
        return {"events": []}

    safe_columns = [
        "id", "event_type", "event_cause", "latitude", "longitude",
        "address", "status", "priority", "corridor", "zone",
        "police_station", "veh_type", "description",
        "start_datetime", "duration_minutes", "requires_road_closure",
        "hour_of_day", "day_of_week", "junction",
    ]
    cols = [c for c in safe_columns if c in df.columns]

    sample = df[cols].sample(n=min(count, len(df)), random_state=None)

    # Convert datetimes to strings for JSON serialization
    for col in sample.columns:
        if sample[col].dtype == "datetime64[ns, UTC]":
            sample[col] = sample[col].astype(str)

    events = sample.astype(object).where(sample.notna(), None).to_dict(orient="records")
    return {"events": events, "count": len(events)}


@router.get("/events/search")
async def search_events(
    cause: Optional[str] = Query(None),
    corridor: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    zone: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """
    GET /events/search
    Filtered event search. All filters are optional; combine as needed.
    """
    from main import app_state

    df = app_state.get("df")
    if df is None or df.empty:
        return {"events": [], "total": 0}

    filtered = df.copy()

    if cause:
        filtered = filtered[filtered["event_cause"] == cause.lower().strip()]
    if corridor:
        filtered = filtered[filtered["corridor"] == corridor]
    if priority:
        filtered = filtered[filtered["priority"] == priority]
    if status:
        filtered = filtered[filtered["status"] == status.lower().strip()]
    if zone:
        filtered = filtered[filtered["zone"] == zone]

    total = len(filtered)

    safe_columns = [
        "id", "event_type", "event_cause", "latitude", "longitude",
        "address", "status", "priority", "corridor", "zone",
        "police_station", "veh_type", "description",
        "start_datetime", "duration_minutes", "requires_road_closure",
        "hour_of_day", "day_of_week", "junction",
    ]
    cols = [c for c in safe_columns if c in filtered.columns]

    page = filtered[cols].iloc[offset:offset + limit]

    for col in page.columns:
        if page[col].dtype == "datetime64[ns, UTC]":
            page[col] = page[col].astype(str)

    events = page.astype(object).where(page.notna(), None).to_dict(orient="records")
    return {"events": events, "total": total, "limit": limit, "offset": offset}
