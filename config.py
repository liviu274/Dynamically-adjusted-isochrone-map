import os
# from dotenv import load_dotenv

# load_dotenv()

class Config:
    # Flask configuration
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key'
    
    # Database configuration
    # Database configuration !important: replace mariarebecca and rebecuta with your actual PostgreSQL username and password
    # If DATABASE_URL is set in the environment, use it; otherwise, use the default PostgreSQL URI
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'postgresql://mariarebecca:rebecuta@localhost:5432/mds'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Third-party API keys
    FOURSQUARE_API_KEY = os.environ.get('FOURSQUARE_API_KEY') or 'fsq3UNI6ZxxsJMSZPXlqzK+mq9kMJPpR/HWocd0Ot9XpkbM='
    TRAVEL_TIME_API_KEY = os.environ.get('TRAVEL_TIME_API_KEY')