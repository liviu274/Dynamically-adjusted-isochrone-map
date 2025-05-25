import os
# from dotenv import load_dotenv

# load_dotenv()

class Config:
    # Flask configuration
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key'
    
    # Database configuration
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///app.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Third-party API keys
    MAP_API_KEY = os.environ.get('MAP_API_KEY')
    # Foursquare API - used for venue discovery and POI data
    FOURSQUARE_API_KEY = os.environ.get('FOURSQUARE_API_KEY') or 'fsq3UNI6ZxxsJMSZPXlqzK+mq9kMJPpR/HWocd0Ot9XpkbM='
    # Travel time API - for calculating times between locations (OpenRouteService or similar)
    TRAVEL_TIME_API_KEY = os.environ.get('TRAVEL_TIME_API_KEY') or '5b3ce3597851110001cf62486a6d1b849e89437d83cfe2b38453d03f'
    # Optional: Google Maps API for more precise distance calculations
    GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY') or ''
    
    # Real-time traffic data
    USE_REAL_TIME_TRAFFIC = os.environ.get('USE_REAL_TIME_TRAFFIC', 'true').lower() == 'true'