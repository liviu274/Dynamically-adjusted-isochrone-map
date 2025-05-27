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
        # Debugging output
        print("Screenshot route accessed")
        
        # Get the image data from the request
        data = request.json
        if not data or 'imageData' not in data:
            print("Missing imageData in request")
            return jsonify({'success': False, 'error': 'Missing imageData'}), 400
            
        image_data = data['imageData'].split(',')[1]  # Remove the data:image/png;base64 part
        
        # Create directory if it doesn't exist
        screenshot_dir = os.path.join(current_app.root_path, 'locals', 'map_screenshots')
        os.makedirs(screenshot_dir, exist_ok=True)
        print(f"Saving to directory: {screenshot_dir}")
        
        # Create a unique filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        filename = f'map-screenshot-{timestamp}.png'
        filepath = os.path.join(screenshot_dir, filename)
        
        # Save the image
        with open(filepath, 'wb') as f:
            f.write(base64.b64decode(image_data))
        
        print(f"Screenshot saved: {filename}")
        return jsonify({
            'success': True, 
            'message': f'Screenshot saved as {filename}',
            'filename': filename
        })
        
    except Exception as e:
        print(f"Screenshot error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500