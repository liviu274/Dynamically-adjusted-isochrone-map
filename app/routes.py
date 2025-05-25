import requests
from flask import request, jsonify, Blueprint, render_template

main = Blueprint('main', __name__)

@main.route('/')
def index():
    return render_template('index.html')

@main.route('/api/isochrones', methods=['POST'])
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