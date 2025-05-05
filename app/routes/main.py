from flask import Blueprint, render_template
from app.config import Config

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    return render_template('index.html', map_api_key=Config.MAP_API_KEY)