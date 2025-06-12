from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from .config import Config
import os

# Initialize extensions before creating app instance
db = SQLAlchemy()
migrate = Migrate()

def create_app(config_class=Config):
    # Create and configure Flask application
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize extensions with app instance
    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app)
    
    # Ensure required directories exist
    os.makedirs(os.path.join(app.root_path, 'static', 'map_screenshots'), exist_ok=True)
    os.makedirs(os.path.join(app.root_path, 'locals', 'map_screenshots'), exist_ok=True)
    
    # Register blueprints
    from app.routes.main import main_bp
    from app.routes.api import api_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp, url_prefix='/api')
    
    return app