"""
ASTRAM Maps Client
------------------
Wrappers for OpenRouteService (geocoding + routing) and Overpass API (nearby POI search).
Replaces the original MapmyIndia/Mappls integration with a free, open-source stack.
"""

from __future__ import annotations

import os
from typing import Any, Optional

import httpx

ORS_BASE = "https://api.openrouteservice.org"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Default Bengaluru center
BENGALURU_CENTER = {"lat": 12.9716, "lng": 77.5946}


def _get_ors_key() -> str:
    return os.getenv("ORS_API_KEY", "")


# ── Map Config ────────────────────────────────────────────────────────────

def get_map_config() -> dict[str, Any]:
    """Return tile URL and default center for the frontend map."""
    return {
        "tile_url": "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "tile_attribution": '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        "center": BENGALURU_CENTER,
        "default_zoom": 12,
    }


# ── Geocoding ─────────────────────────────────────────────────────────────

async def geocode(query: str, limit: int = 5) -> dict[str, Any]:
    """
    Forward geocode using OpenRouteService Pelias geocoder.
    Falls back to Nominatim if ORS key is not configured.
    """
    ors_key = _get_ors_key()

    if ors_key and ors_key != "your_openrouteservice_api_key_here":
        return await _ors_geocode(query, limit, ors_key)
    else:
        return await _nominatim_geocode(query, limit)


async def _ors_geocode(query: str, limit: int, api_key: str) -> dict[str, Any]:
    """Geocode via OpenRouteService."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{ORS_BASE}/geocode/search",
            params={
                "api_key": api_key,
                "text": query,
                "size": limit,
                "boundary.country": "IND",
            },
        )
        if resp.status_code != 200:
            return {"error": f"ORS geocode failed: {resp.status_code}", "results": []}

        data = resp.json()
        results = []
        for feat in data.get("features", []):
            coords = feat.get("geometry", {}).get("coordinates", [0, 0])
            props = feat.get("properties", {})
            results.append({
                "lat": coords[1],
                "lng": coords[0],
                "label": props.get("label", ""),
                "confidence": props.get("confidence", 0),
            })
        return {"results": results}


async def _nominatim_geocode(query: str, limit: int) -> dict[str, Any]:
    """Fallback geocode via OpenStreetMap Nominatim (no key required)."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": query,
                "format": "json",
                "limit": limit,
                "countrycodes": "in",
            },
            headers={"User-Agent": "ASTRAM-Backend/1.0"},
        )
        if resp.status_code != 200:
            return {"error": f"Nominatim geocode failed: {resp.status_code}", "results": []}

        data = resp.json()
        results = []
        for item in data:
            results.append({
                "lat": float(item.get("lat", 0)),
                "lng": float(item.get("lon", 0)),
                "label": item.get("display_name", ""),
                "confidence": 1.0,
            })
        return {"results": results}


# ── Routing ───────────────────────────────────────────────────────────────

async def get_route(
    start_lat: float, start_lng: float,
    end_lat: float, end_lng: float,
) -> dict[str, Any]:
    """
    Get driving route via OpenRouteService Directions API.
    Returns GeoJSON route geometry.
    """
    ors_key = _get_ors_key()

    if not ors_key or ors_key == "your_openrouteservice_api_key_here":
        return {
            "error": "ORS_API_KEY not configured. Set it in .env for routing.",
            "route": None,
        }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{ORS_BASE}/v2/directions/driving-car/geojson",
            headers={
                "Authorization": ors_key,
                "Content-Type": "application/json",
            },
            json={
                "coordinates": [
                    [start_lng, start_lat],
                    [end_lng, end_lat],
                ],
            },
        )

        if resp.status_code != 200:
            return {"error": f"ORS routing failed: {resp.status_code}", "route": None}

        data = resp.json()
        features = data.get("features", [])
        if not features:
            return {"error": "No route found", "route": None}

        route = features[0]
        props = route.get("properties", {}).get("summary", {})
        return {
            "route": route.get("geometry"),
            "distance_km": round(props.get("distance", 0) / 1000, 2),
            "duration_minutes": round(props.get("duration", 0) / 60, 1),
        }


# ── Nearby Police Stations ──────────────────────────────────────────────

async def find_nearby_police(
    lat: float, lng: float, radius_m: int = 3000
) -> dict[str, Any]:
    """
    Query Overpass API for police stations near the given coordinates.
    No API key required.
    """
    query = f"""
    [out:json][timeout:10];
    (
      node["amenity"="police"](around:{radius_m},{lat},{lng});
      way["amenity"="police"](around:{radius_m},{lat},{lng});
    );
    out center;
    """

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            OVERPASS_URL,
            data={"data": query},
        )

        if resp.status_code != 200:
            return {"error": f"Overpass query failed: {resp.status_code}", "stations": []}

        data = resp.json()
        stations = []
        for elem in data.get("elements", []):
            tags = elem.get("tags", {})
            station_lat = elem.get("lat") or elem.get("center", {}).get("lat")
            station_lng = elem.get("lon") or elem.get("center", {}).get("lon")

            if station_lat and station_lng:
                stations.append({
                    "name": tags.get("name", "Police Station"),
                    "lat": station_lat,
                    "lng": station_lng,
                    "phone": tags.get("phone", tags.get("contact:phone", "")),
                    "address": tags.get("addr:full", tags.get("addr:street", "")),
                })

        return {"stations": stations, "count": len(stations)}
