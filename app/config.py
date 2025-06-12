import os
# from dotenv import load_dotenv

# load_dotenv()

class Config:
    # Core application settings
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key'
    
    # Database configuration
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///app.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # External API credentials
    MAP_API_KEY = os.environ.get('MAP_API_KEY')
    FOURSQUARE_API_KEY = os.environ.get('FOURSQUARE_API_KEY') or 'fsq3UNI6ZxxsJMSZPXlqzK+mq9kMJPpR/HWocd0Ot9XpkbM='
    TRAVEL_TIME_API_KEY = os.environ.get('TRAVEL_TIME_API_KEY') or '5b3ce3597851110001cf62486a6d1b849e89437d83cfe2b38453d03f'
    GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY') or ''
    
    # Feature flags
    USE_REAL_TIME_TRAFFIC = os.environ.get('USE_REAL_TIME_TRAFFIC', 'true').lower() == 'true'