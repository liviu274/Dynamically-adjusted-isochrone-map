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
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json; charset=utf-8'
    }
    
    body = {
        "locations": [[origin_lng, origin_lat]],  # Note: ORS uses [lng, lat] format
        "range": ranges,
        "attributes": ["total_pop"],
        "location_type": "start",
        "range_type": "time"
        # Removed "options": {"traffic": "true"} as it's not supported
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
        
        
from datetime import datetime
from typing import Dict, List, Optional

class TravelTimeProcessor:
    """Process and normalize travel time data"""
    
    def __init__(self):
        self.valid_modes = ['driving-car', 'cycling-regular', 'foot-walking']
        self.min_valid_duration = 0
        self.max_valid_duration = 24 * 60 * 60  # 24 hours in seconds

    def normalize_travel_times(self, raw_data: Dict) -> Dict:
        """
        Normalize and validate travel time data
        Args:
            raw_data: Raw response from travel time service
        Returns:
            Normalized and validated data
        """
        if raw_data.get('status') != 'success':
            return self._handle_error_response(raw_data)

        normalized_data = {
            'status': 'success',
            'metadata': self._create_metadata(),
            'origin': self._validate_coordinates(raw_data.get('origin')),
            'results': []
        }

        for result in raw_data.get('results', []):
            processed_result = self._process_single_result(result)
            if processed_result:
                normalized_data['results'].append(processed_result)

        normalized_data['statistics'] = self._calculate_statistics(normalized_data['results'])
        return normalized_data

    def _process_single_result(self, result: Dict) -> Optional[Dict]:
        """Process and validate a single travel time result"""
        if not self._is_valid_result(result):
            return None

        return {
            'destination': self._validate_coordinates(result.get('destination')),
            'duration': {
                'seconds': result.get('duration_seconds'),
                'minutes': round(result.get('duration_seconds', 0) / 60, 2),
                'formatted': self._format_duration(result.get('duration_seconds', 0))
            },
            'reliability_score': self._calculate_reliability(result)
        }

    def _is_valid_result(self, result: Dict) -> bool:
        """Check if a result is valid"""
        duration = result.get('duration_seconds')
        return (
            isinstance(duration, (int, float)) and
            self.min_valid_duration <= duration <= self.max_valid_duration and
            result.get('destination') is not None
        )

    def _validate_coordinates(self, coords: Dict) -> Dict:
        """Validate and format coordinates"""
        if not coords or 'lat' not in coords or 'lng' not in coords:
            return {'lat': None, 'lng': None, 'valid': False}

        return {
            'lat': float(coords['lat']),
            'lng': float(coords['lng']),
            'valid': True
        }

    def _format_duration(self, seconds: int) -> str:
        """Format duration into human-readable string"""
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        if hours > 0:
            return f"{hours}h {minutes}m"
        return f"{minutes}m"

    def _calculate_reliability(self, result: Dict) -> float:
        """Calculate reliability score for a result"""
        score = 1.0
        if not result.get('duration_seconds'):
            score *= 0.5
        if not self._validate_coordinates(result.get('destination', {}))['valid']:
            score *= 0.7
        return round(score, 2)

    def _create_metadata(self) -> Dict:
        """Create metadata for the response"""
        return {
            'timestamp': datetime.now().isoformat(),
            'version': '1.0',
            'processor': 'TravelTimeProcessor'
        }

    def _calculate_statistics(self, results: List[Dict]) -> Dict:
        """Calculate statistics for all results"""
        durations = [r['duration']['seconds'] for r in results if r['duration']['seconds']]
        if not durations:
            return {'count': 0}

        return {
            'count': len(durations),
            'average_duration_minutes': round(sum(durations) / len(durations) / 60, 2),
            'min_duration_minutes': round(min(durations) / 60, 2),
            'max_duration_minutes': round(max(durations) / 60, 2)
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
            
            # Format the basic response
            raw_results = {
                "status": "success",
                "origin": {"lat": origin_lat, "lng": origin_lng},
                "results": []
            }
            durations = matrix_data.get('durations', [[]])[0]
            
            for i, duration in enumerate(durations):
                if i < len(destinations):
                    raw_results["results"].append({
                        "destination": destinations[i],
                        "duration_seconds": duration,
                        "duration_minutes": round(duration / 60, 1)
                    })
            
             # Use the processor to normalize data
            processor = TravelTimeProcessor()
            return processor.normalize_travel_times(raw_results)
        
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

def get_travel_times_matrix(self, pois):
    """Get matrix of travel times between POIs using OpenRouteService API"""
    url = "https://api.openrouteservice.org/v2/matrix/driving-car"
    
    headers = {
        'Authorization': self.api_key,  # REMOVED 'Bearer ' prefix
        'Content-Type': 'application/json; charset=utf-8'
    }
    
    # Convert POIs to the format required by ORS (lng, lat)
    locations = [[poi['lng'], poi['lat']] for poi in pois]
