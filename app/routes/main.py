import requests
from flask import request, jsonify, Blueprint, render_template, current_app
from app.config import Config
import os
import base64
from datetime import datetime


main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    return render_template('index.html', foursquare_api_key=Config.FOURSQUARE_API_KEY)

@main_bp.route('/api/isochrones', methods=['POST'])
def isochrones_proxy():
    """Proxy endpoint for OpenRouteService isochrones API to avoid CORS issues"""
    try:
        # Get the API key from environment or config (more secure)
        api_key = '5b3ce3597851110001cf6248e0fbfa8c07af43458da778a226442451'
        
        # Forward the request body from the client
        data = request.json
        
        # Make the request to OpenRouteService API
        response = requests.post(
            'https://api.openrouteservice.org/v2/isochrones/driving-car',
            json=data,
            headers={
                'Accept': 'application/json, application/geo+json',
                'Content-Type': 'application/json',
                'Authorization': api_key
            }
        )
        
        # Return the API response to the client
        return response.json(), response.status_code
        
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500
    
@main_bp.route('/save-screenshot', methods=['POST'])
def save_screenshot():
    try:
        # Get the image data and coordinates from the request
        data = request.json
        image_data = data['imageData'].split(',')[1]  # Remove the data:image/png;base64 part
        
        # Extract POI coordinates and bounds
        poi_coords = data.get('pois', [])
        bounds_coords = data.get('bounds', {})
        
        # Create directory if it doesn't exist
        screenshot_dir = os.path.join(current_app.root_path, 'locals', 'map_screenshots')
        os.makedirs(screenshot_dir, exist_ok=True)
        
        # Create a unique filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        filename = f'map-screenshot-{timestamp}.png'
        filepath = os.path.join(screenshot_dir, filename)
        
        # Save the image
        with open(filepath, 'wb') as f:
            f.write(base64.b64decode(image_data))
        
        # Save metadata in a JSON file with the same name
        metadata_filename = f'map-screenshot-{timestamp}.json'
        metadata_filepath = os.path.join(screenshot_dir, metadata_filename)
        
        with open(metadata_filepath, 'w') as f:
            import json
            json.dump({
                'timestamp': timestamp,
                'pois': poi_coords,
                'bounds': bounds_coords
            }, f, indent=2)
        
        return jsonify({
            'success': True, 
            'message': f'Screenshot saved as {filename}',
            'filename': filename,
            'metadata': metadata_filename
        })
        
    except Exception as e:
        print(f"Screenshot error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Add this route to your main blueprint

@main_bp.route('/time-deformed')
def time_deformed():
    """Time-deformed maps page"""
    return render_template('timedeformed.html')