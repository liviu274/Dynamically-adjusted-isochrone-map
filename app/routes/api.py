from flask import Blueprint, jsonify, request
from app import db
from app.models.poi import PointOfInterest
# Commented - we'll implement it later
# from app.services.travel_time_service import get_travel_times

api_bp = Blueprint('api', __name__)

@api_bp.route('/pois', methods=['GET'])
def get_pois():
    pois = PointOfInterest.query.all()
    return jsonify([poi.to_dict() for poi in pois])

@api_bp.route('/pois', methods=['POST'])
def create_poi():
    data = request.json
    new_poi = PointOfInterest(
        name=data['name'],
        latitude=data['latitude'],
        longitude=data['longitude'],
        category=data.get('category'),
        description=data.get('description')
    )
    db.session.add(new_poi)
    db.session.commit()
    return jsonify(new_poi.to_dict()), 201

@api_bp.route('/pois/<int:poi_id>', methods=['GET'])
def get_poi(poi_id):
    poi = PointOfInterest.query.get_or_404(poi_id)
    return jsonify(poi.to_dict())

@api_bp.route('/pois/<int:poi_id>', methods=['PUT'])
def update_poi(poi_id):
    poi = PointOfInterest.query.get_or_404(poi_id)
    data = request.json
    
    poi.name = data.get('name', poi.name)
    poi.latitude = data.get('latitude', poi.latitude)
    poi.longitude = data.get('longitude', poi.longitude)
    poi.category = data.get('category', poi.category)
    poi.description = data.get('description', poi.description)
    
    db.session.commit()
    return jsonify(poi.to_dict())

@api_bp.route('/pois/<int:poi_id>', methods=['DELETE'])
def delete_poi(poi_id):
    poi = PointOfInterest.query.get_or_404(poi_id)
    db.session.delete(poi)
    db.session.commit()
    return jsonify({'result': 'success'}), 200

# Comment out this route for now - we'll implement it later
"""
@api_bp.route('/travel-times', methods=['GET'])
def travel_times():
    origin_lat = request.args.get('origin_lat', type=float)
    origin_lng = request.args.get('origin_lng', type=float)
    
    if not origin_lat or not origin_lng:
        return jsonify({'error': 'Origin coordinates required'}), 400
        
    times = get_travel_times(origin_lat, origin_lng)
    return jsonify(times)
"""