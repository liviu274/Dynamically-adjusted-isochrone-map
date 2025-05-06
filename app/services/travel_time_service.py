import requests
import json
from flask import current_app

def get_isochrones(origin_lat, origin_lng, travel_times=[5, 10, 15], travel_mode='driving-car'):
    """
    Get isochrones (areas reachable within specific time intervals) from a given origin point.
    
    Args:
        origin_lat (float): Latitude of the origin point
        origin_lng (float): Longitude of the origin point
        travel_times (list): List of travel times in minutes for isochrone calculation
        travel_mode (str): Mode of transport (driving-car, cycling-regular, foot-walking)
    
    Returns:
        dict: GeoJSON formatted isochrones or error message
    """
    api_key = current_app.config.get('TRAVEL_TIME_API_KEY')
    
    if not api_key:
        return {
            "status": "error",
            "message": "No travel time API key configured"
        }
    
    # Convert minutes to seconds for the API
    ranges = [t * 60 for t in travel_times]
    
    # OpenRouteService API endpoint for isochrones
    url = "https://api.openrouteservice.org/v2/isochrones/" + travel_mode
    
    headers = {
        'Authorization': f'Bearer {api_key}',  # OpenRouteService requires the "Bearer " prefix
        'Content-Type': 'application/json; charset=utf-8'
    }
    
    body = {
        "locations": [[origin_lng, origin_lat]],  # Note: ORS uses [lng, lat] format
        "range": ranges,
        "attributes": ["total_pop"],
        "location_type": "start",
        "range_type": "time"
    }
    
    try:
        response = requests.post(url, json=body, headers=headers)
        
        if response.status_code == 200:
            isochrones = response.json()
            # Add colors for visualization
            colors = ['#2c7bb6', '#abd9e9', '#fee090', '#fdae61', '#f46d43', '#d73027']
            
            for i, feature in enumerate(isochrones.get('features', [])):
                if i < len(colors):
                    feature['properties']['color'] = colors[i]
                    # Add the time in minutes for display
                    feature['properties']['time_minutes'] = travel_times[i]
                    
            return isochrones
        else:
            return {
                "status": "error",
                "message": f"API Error: {response.status_code} - {response.text}"
            }
    
    except Exception as e:
        return {
            "status": "error",
            "message": f"Exception: {str(e)}"
        }

def get_travel_times(origin_lat, origin_lng, destinations=None):
    """
    Get travel times from origin to multiple destinations.
    
    Args:
        origin_lat (float): Latitude of origin point
        origin_lng (float): Longitude of origin point
        destinations (list): List of dictionaries with lat, lng for destinations
                    If None, will return isochrones instead
    
    Returns:
        dict: Travel times or isochrones
    """
    # If no destinations provided, return isochrones instead
    if not destinations:
        return get_isochrones(origin_lat, origin_lng)
    
    api_key = current_app.config.get('TRAVEL_TIME_API_KEY')
    
    if not api_key:
        return {
            "status": "error",
            "message": "No travel time API key configured"
        }
    
    # For specific point-to-point travel times, use ORS matrix API
    url = "https://api.openrouteservice.org/v2/matrix/driving-car"
    
    headers = {
        'Authorization': f'Bearer {api_key}',  # OpenRouteService requires the "Bearer " prefix
        'Content-Type': 'application/json; charset=utf-8'
    }
    
    # Prepare locations array starting with origin
    locations = [[origin_lng, origin_lat]]  # Note: ORS uses [lng, lat] format
    
    # Add destination coordinates
    for dest in destinations:
        locations.append([dest['lng'], dest['lat']])
    
    body = {
        "locations": locations,
        "metrics": ["duration"],
        "sources": [0],  # Index of the origin point
        "destinations": list(range(1, len(locations)))  # Indices of destination points
    }
    
    try:
        response = requests.post(url, json=body, headers=headers)
        
        if response.status_code == 200:
            matrix_data = response.json()
            
            # Format the response to include destination info
            results = []
            durations = matrix_data.get('durations', [[]])[0]
            
            for i, duration in enumerate(durations):
                if i < len(destinations):
                    results.append({
                        "destination": destinations[i],
                        "duration_seconds": duration,
                        "duration_minutes": round(duration / 60, 1)
                    })
            
            return {
                "status": "success",
                "origin": {"lat": origin_lat, "lng": origin_lng},
                "results": results
            }
        else:
            return {
                "status": "error",
                "message": f"API Error: {response.status_code} - {response.text}"
            }
            
    except Exception as e:
        return {
            "status": "error",
            "message": f"Exception: {str(e)}"
        }