import requests
from datetime import datetime
from typing import List, Dict

class TravelTimeService:
    def __init__(self):
        self.api_key = "5b3ce3597851110001cf62483a3c52174c2c44fdbed973b8aae46447"
        self.base_url = "https://api.openrouteservice.org/v2/matrix/driving-car"
        self.headers = {
            'Authorization': self.api_key,
            'Content-Type': 'application/json'
        }
        
    def collect_times(self, locations: List[Dict]) -> Dict:
        """
        Collect travel times between locations using OpenRoute Service
        locations: List of dicts with 'lat' and 'lng' keys
        """
        try:
            # OpenRoute Service expects coordinates as [longitude, latitude]
            coordinates = [[loc['lng'], loc['lat']] for loc in locations]
            
            payload = {
                "locations": coordinates,
                "metrics": ["duration", "distance"]
            }

            response = requests.post(
                self.base_url,
                json=payload,
                headers=self.headers
            )

            if response.status_code == 200:
                data = response.json()
                return self._process_api_response(data, locations)
            else:
                print(f"API Error: {response.status_code} - {response.text}")
                return self._get_fallback_results(locations)

        except Exception as e:
            print(f"Error collecting travel times: {str(e)}")
            return self._get_fallback_results(locations)

    def _process_api_response(self, data: Dict, locations: List[Dict]) -> Dict:
        """Process the API response and format results"""
        results = {}
        durations = data['durations']
        distances = data['distances']
        
        for i, origin in enumerate(locations):
            for j, dest in enumerate(locations[i+1:], start=i+1):
                key = f"{origin['lat']},{origin['lng']}-{dest['lat']},{dest['lng']}"
                results[key] = {
                    'duration_minutes': round(durations[i][j] / 60, 2),
                    'distance_km': round(distances[i][j] / 1000, 2),
                    'timestamp': str(datetime.now()),
                    'origin': origin,
                    'destination': dest
                }
        return results

    def _get_fallback_results(self, locations: List[Dict]) -> Dict:
        """Fallback method when API calls fail"""
        results = {}
        for i, origin in enumerate(locations):
            for dest in locations[i+1:]:
                key = f"{origin['lat']},{origin['lng']}-{dest['lat']},{dest['lng']}"
                results[key] = {
                    'duration_minutes': round(self._mock_travel_time() / 60, 2),
                    'distance_km': 0,
                    'timestamp': str(datetime.now()),
                    'origin': origin,
                    'destination': dest,
                    'is_estimate': True
                }
        return results

    def _mock_travel_time(self) -> int:
        """Temporary mock method for fallback"""
        import random
        return random.randint(300, 3600)

def get_travel_times(origin_lat, origin_lng):
    """
    Placeholder function for travel time calculation.
    Will be implemented in future iterations.
    """
    return {
        "status": "not_implemented",
        "message": "Travel time calculation not yet implemented"
    }