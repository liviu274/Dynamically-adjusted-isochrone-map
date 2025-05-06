from typing import Dict
import unittest
from app.services.travel_time_service import TravelTimeProcessor

class TestTravelTimeProcessor(unittest.TestCase):
    def setUp(self):
        self.processor = TravelTimeProcessor()
        self.sample_data = {
            "status": "success",
            "origin": {"lat": 44.4268, "lng": 26.1025},  # Bucharest
            "results": [
                {
                    "destination": {"lat": 45.7489, "lng": 21.2087},  # Timisoara
                    "duration_seconds": 3600,  # 1 hour
                    "duration_minutes": 60.0
                },
                {
                    "destination": {"lat": 46.7712, "lng": 23.6236},  # Cluj
                    "duration_seconds": 5400,  # 1.5 hours
                    "duration_minutes": 90.0
                }
            ]
        }

    def test_normalize_valid_data(self):
        """Test normalization of valid travel time data"""
        result = self.processor.normalize_travel_times(self.sample_data)
        
        self.assertEqual(result['status'], 'success')
        self.assertEqual(len(result['results']), 2)
        self.assertTrue('metadata' in result)
        self.assertTrue('statistics' in result)

    def _validate_coordinates(self, coords: Dict) -> Dict:
        """
        Validate and format coordinates
        
        Args:
            coords: Dictionary containing lat and lng keys
        Returns:
            Dictionary with validated coordinates and validity flag
        """
        if not coords or 'lat' not in coords or 'lng' not in coords:
            return {'lat': None, 'lng': None, 'valid': False}

        try:
            lat = float(coords['lat'])
            lng = float(coords['lng'])
            
            # Check if coordinates are in valid ranges
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                return {
                    'lat': lat,
                    'lng': lng,
                    'valid': True
                }
        except (ValueError, TypeError):
            pass
            
        return {'lat': None, 'lng': None, 'valid': False}

    def test_format_duration(self):
        """Test duration formatting"""
        one_hour = 3600
        thirty_mins = 1800
        
        self.assertEqual(self.processor._format_duration(one_hour), "1h 0m")
        self.assertEqual(self.processor._format_duration(thirty_mins), "30m")

    def test_calculate_statistics(self):
        """Test statistics calculation"""
        normalized = self.processor.normalize_travel_times(self.sample_data)
        stats = normalized['statistics']
        
        self.assertEqual(stats['count'], 2)
        self.assertEqual(stats['average_duration_minutes'], 75.0)  # (60 + 90) / 2
        self.assertEqual(stats['min_duration_minutes'], 60.0)
        self.assertEqual(stats['max_duration_minutes'], 90.0)
        
    def test_handle_invalid_data(self):
        """Test handling of invalid travel time data"""
        invalid_data = {
            "status": "success",
            "origin": {"lat": 44.4268, "lng": 26.1025},
            "results": [
                {
                    "destination": {"lat": 45.7489, "lng": 21.2087},
                    "duration_seconds": -100,  # Invalid negative duration
                    "duration_minutes": -1.67
                }
            ]
        }
        result = self.processor.normalize_travel_times(invalid_data)
        self.assertEqual(len(result['results']), 0)  # Should ignore invalid data
    

if __name__ == '__main__':
    unittest.main()