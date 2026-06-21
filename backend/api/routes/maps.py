"""Maps endpoints — geocoding, routing, nearby police stations."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()


@router.get("/maps/config")
async def maps_config():
    """GET /maps/config — OSM tile URL + default Bengaluru center coordinates."""
    from maps.client import get_map_config
    return get_map_config()


class GeocodeRequest(BaseModel):
    query: str = Field(..., description="Address or place name to geocode")
    limit: int = Field(5, ge=1, le=20)


@router.post("/maps/geocode")
async def geocode(req: GeocodeRequest):
    """POST /maps/geocode — OpenRouteService / Nominatim geocoding wrapper."""
    from maps.client import geocode as do_geocode

    try:
        result = await do_geocode(req.query, req.limit)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Geocoding failed: {str(e)}")


class RouteRequest(BaseModel):
    start_lat: float = Field(..., description="Start latitude")
    start_lng: float = Field(..., description="Start longitude")
    end_lat: float = Field(..., description="End latitude")
    end_lng: float = Field(..., description="End longitude")


@router.post("/maps/route")
async def route(req: RouteRequest):
    """POST /maps/route — OpenRouteService directions wrapper, returns GeoJSON route."""
    from maps.client import get_route

    try:
        result = await get_route(req.start_lat, req.start_lng, req.end_lat, req.end_lng)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Routing failed: {str(e)}")


class NearbyPoliceRequest(BaseModel):
    lat: float = Field(..., description="Latitude of incident")
    lng: float = Field(..., description="Longitude of incident")
    radius_m: int = Field(3000, ge=100, le=10000, description="Search radius in meters")


@router.post("/maps/nearby-police")
async def nearby_police(req: NearbyPoliceRequest):
    """POST /maps/nearby-police — Overpass API query for nearby police stations."""
    from maps.client import find_nearby_police

    try:
        result = await find_nearby_police(req.lat, req.lng, req.radius_m)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Police station search failed: {str(e)}")
