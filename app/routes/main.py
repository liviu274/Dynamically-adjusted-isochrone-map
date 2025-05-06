from flask import Blueprint, render_template, jsonify
from app.config import Config
from app.services.travel_time_service import TravelTimeService

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    return render_template('index.html', foursquare_api_key=Config.FOURSQUARE_API_KEY)

# Add this to your existing Blueprint
@main_bp.route('/api/travel-times', methods=['POST'])
def get_travel_times():
    # Example test data
    test_locations = [
        {'lat': 44.4268, 'lng': 26.1025},  # Bucharest
        {'lat': 45.7489, 'lng': 21.2087},  # Timisoara
        {'lat': 46.7712, 'lng': 23.6236}   # Cluj
    ]
    
    service = TravelTimeService()
    times = service.collect_times(test_locations)
    return jsonify(times)

@main_bp.route('/test-travel-times')
def test_travel_times():
    test_locations = [
        {'lat': 44.4268, 'lng': 26.1025},  # Bucharest
        {'lat': 45.7489, 'lng': 21.2087},  # Timisoara
        {'lat': 46.7712, 'lng': 23.6236}   # Cluj
    ]
    
    service = TravelTimeService()
    times = service.collect_times(test_locations)
    return jsonify(times)