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
    FOURSQUARE_API_KEY = os.environ.get('FOURSQUARE_API_KEY') or 'fsq3UNI6ZxxsJMSZPXlqzK+mq9kMJPpR/HWocd0Ot9XpkbM='
    TRAVEL_TIME_API_KEY = os.environ.get('TRAVEL_TIME_API_KEY')