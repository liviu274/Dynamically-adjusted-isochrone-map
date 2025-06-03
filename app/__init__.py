from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from .config import Config
import os
import shutil

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize extensions with app
    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app)
    
    # Create necessary directories
    os.makedirs(os.path.join(app.root_path, 'static', 'map_screenshots'), exist_ok=True)
    os.makedirs(os.path.join(app.root_path, 'locals', 'map_screenshots'), exist_ok=True)
    
    # Copy screenshots from locals to static directory if they don't exist
    locals_dir = os.path.join(app.root_path, 'locals', 'map_screenshots')
    static_dir = os.path.join(app.root_path, 'static', 'map_screenshots')
    
    # Copy files if they don't exist in static directory
    for file in os.listdir(locals_dir):
        if file.endswith('.png') and not os.path.exists(os.path.join(static_dir, file)):
            shutil.copy2(os.path.join(locals_dir, file), os.path.join(static_dir, file))
    
    # Register blueprints
    from app.routes.main import main_bp
    from app.routes.api import api_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp, url_prefix='/api')
    
    return app