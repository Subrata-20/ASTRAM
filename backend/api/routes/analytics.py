"""Analytics + Hotspots endpoints — historical aggregations."""

from fastapi import APIRouter, Query

router = APIRouter()


@router.get("/analytics")
async def get_analytics(days: int = Query(None, description="Number of days to filter by")):
    """
    GET /analytics
    Pre-computed historical aggregations:
    - hourly_distribution: event counts per hour (0-23)
    - duration_by_cause: median duration in minutes per event cause
    - closure_rates: fraction of events requiring road closure per cause
    - event_type_distribution: counts of planned vs unplanned
    - priority_distribution: counts of High vs Low priority
    - status_distribution: counts by event status
    - daily_distribution: event counts per day of week
    """
    from main import app_state
    import pandas as pd

    df = app_state.get("df")
    if df is None or df.empty:
        return {"error": "Data not loaded"}
        
    if days is not None and "start_datetime" in df.columns:
        max_date = df["start_datetime"].max()
        if not pd.isna(max_date):
            cutoff_date = max_date - pd.Timedelta(days=days)
            df = df[df["start_datetime"] >= cutoff_date]

    # Hourly distribution
    hourly = (
        df["hour_of_day"]
        .dropna()
        .astype(int)
        .value_counts()
        .sort_index()
        .to_dict()
    )
    # Fill missing hours with 0
    hourly_full = {h: hourly.get(h, 0) for h in range(24)}

    # Duration by cause (median)
    duration_by_cause = (
        df.groupby("event_cause")["duration_minutes"]
        .median()
        .dropna()
        .sort_values(ascending=False)
        .round(1)
        .to_dict()
    )

    # Closure rates by cause
    closure_rates = (
        df.groupby("event_cause")["requires_road_closure"]
        .mean()
        .dropna()
        .sort_values(ascending=False)
        .round(3)
        .to_dict()
    )

    # Event type distribution
    event_type_dist = df["event_type"].value_counts().to_dict()

    # Priority distribution
    priority_dist = df["priority"].value_counts().to_dict()

    # Status distribution
    status_dist = df["status"].value_counts().to_dict()

    # Daily distribution
    daily = (
        df["day_of_week"]
        .dropna()
        .astype(int)
        .value_counts()
        .sort_index()
        .to_dict()
    )
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    daily_named = {day_names[k]: v for k, v in daily.items() if k < 7}

    # Top corridors by incident count
    top_corridors = (
        df["corridor"]
        .dropna()
        .value_counts()
        .head(15)
        .to_dict()
    )

    # Events per month
    if "start_datetime" in df.columns:
        monthly = (
            df["start_datetime"]
            .dropna()
            .dt.to_period("M")
            .astype(str)
            .value_counts()
            .sort_index()
            .to_dict()
        )
    else:
        monthly = {}

    return {
        "hourly_distribution": hourly_full,
        "duration_by_cause": duration_by_cause,
        "closure_rates": closure_rates,
        "event_type_distribution": event_type_dist,
        "priority_distribution": priority_dist,
        "status_distribution": status_dist,
        "daily_distribution": daily_named,
        "top_corridors": top_corridors,
        "monthly_distribution": monthly,
        "total_events": len(df),
        "events_with_duration": int(df["duration_minutes"].notna().sum()),
    }


@router.get("/hotspots")
async def get_hotspots():
    """
    GET /hotspots
    Top 20 junctions by incident volume, with coordinates.
    """
    from main import app_state

    df = app_state.get("df")
    if df is None or df.empty:
        return {"error": "Data not loaded"}

    # Use junction column if available
    if "junction" in df.columns:
        junction_df = df[df["junction"].notna() & (df["junction"] != "")].copy()

        if not junction_df.empty:
            # Group by junction, get count and average coordinates
            hotspots = (
                junction_df.groupby("junction")
                .agg(
                    count=("id", "count"),
                    lat=("latitude", "mean"),
                    lng=("longitude", "mean"),
                    top_cause=("event_cause", lambda x: x.mode().iloc[0] if not x.mode().empty else "unknown"),
                )
                .sort_values("count", ascending=False)
                .head(20)
                .reset_index()
            )

            return {
                "hotspots": [
                    {
                        "junction": row["junction"],
                        "incident_count": int(row["count"]),
                        "lat": round(float(row["lat"]), 6),
                        "lng": round(float(row["lng"]), 6),
                        "top_cause": row["top_cause"],
                    }
                    for _, row in hotspots.iterrows()
                ]
            }

    # Fallback: cluster by police_station
    if "police_station" in df.columns:
        ps_df = df[df["police_station"].notna()].copy()
        hotspots = (
            ps_df.groupby("police_station")
            .agg(
                count=("id", "count"),
                lat=("latitude", "mean"),
                lng=("longitude", "mean"),
                top_cause=("event_cause", lambda x: x.mode().iloc[0] if not x.mode().empty else "unknown"),
            )
            .sort_values("count", ascending=False)
            .head(20)
            .reset_index()
        )

        return {
            "hotspots": [
                {
                    "junction": row["police_station"],
                    "incident_count": int(row["count"]),
                    "lat": round(float(row["lat"]), 6),
                    "lng": round(float(row["lng"]), 6),
                    "top_cause": row["top_cause"],
                }
                for _, row in hotspots.iterrows()
            ]
        }

    return {"hotspots": []}
