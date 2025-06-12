import requests
from flask import request, jsonify, Blueprint, render_template, current_app
import os
import base64
from datetime import datetime

from app import create_app
app = create_app()

main = Blueprint('main', __name__)

@main.route('/')
def index():
    return render_template('index.html')

@main.route('/api/isochrones', methods=['POST'])
def isochrones_proxy():
    """Forward requests to OpenRouteService isochrones API"""
    try:
        # API key should ideally be in environment variables
        api_key = '5b3ce3597851110001cf6248e0fbfa8c07af43458da778a226442451'
        
        # Parse client request
        data = request.json
        
        # Forward to external API
        response = requests.post(
            'https://api.openrouteservice.org/v2/isochrones/driving-car',
            json=data,
            headers={
                'Accept': 'application/json, application/geo+json',
                'Content-Type': 'application/json',
                'Authorization': api_key
            }
        )
        
        # Return API response to client
        return response.json(), response.status_code
        
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500

