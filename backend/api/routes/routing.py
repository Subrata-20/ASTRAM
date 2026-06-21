import os
import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

@router.get("/route/diversion")
async def get_diversion_route(
    incident_lat: float = Query(..., description="Latitude of the incident"),
    incident_lng: float = Query(..., description="Longitude of the incident"),
):
    """
    Generate diversion routes around an incident using OpenRouteService.
    Returns a main route and an alternate route with extracted road names.
    """
    api_key = os.getenv("ORS_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ORS_API_KEY not configured")

    # Synthetic start and end points (approx 2km away from the incident)
    start_lng = incident_lng - 0.02
    start_lat = incident_lat - 0.02
    end_lng = incident_lng + 0.02
    end_lat = incident_lat + 0.02

    # Avoidance polygon around the incident (approx 500m radius box)
    offset = 0.005
    avoid_polygon = [
        [
            [incident_lng - offset, incident_lat - offset],
            [incident_lng + offset, incident_lat - offset],
            [incident_lng + offset, incident_lat + offset],
            [incident_lng - offset, incident_lat + offset],
            [incident_lng - offset, incident_lat - offset]
        ]
    ]

    payload = {
        "coordinates": [
            [start_lng, start_lat],
            [end_lng, end_lat]
        ],
        "alternative_routes": {
            "target_count": 2,
            "weight_factor": 1.5,
            "share_factor": 0.5
        },
        "options": {
            "avoid_polygons": {
                "type": "Polygon",
                "coordinates": avoid_polygon
            }
        }
    }

    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json"
    }

    url = "https://api.openrouteservice.org/v2/directions/driving-car/geojson"

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"ORS API Error: {response.text}")
            
        data = response.json()
        
        def extract_route_info(feature):
            coords = feature.get("geometry", {}).get("coordinates", [])
            # Convert [lng, lat] to [lat, lng] for frontend
            lat_lngs = [[c[1], c[0]] for c in coords]
            
            try:
                steps = feature["properties"]["segments"][0]["steps"]
                valid_steps = [s for s in steps if s.get("name") and s.get("name") not in ["-", ""]]
                sorted_steps = sorted(valid_steps, key=lambda x: x.get("distance", 0), reverse=True)
                if len(sorted_steps) >= 2:
                    text = f"Via {sorted_steps[0]['name']} & {sorted_steps[1]['name']}"
                elif len(sorted_steps) == 1:
                    text = f"Via {sorted_steps[0]['name']}"
                else:
                    text = "Via Local Roads"
            except Exception:
                text = "Alternative Route"
                
            return {"coordinates": lat_lngs, "text": text}

        features = data.get("features", [])
        if not features:
            return {"main_route": None, "alt_route": None}
            
        main_route = extract_route_info(features[0])
        alt_route = extract_route_info(features[1]) if len(features) > 1 else main_route
        
        return {
            "main_route": main_route,
            "alt_route": alt_route
        }
