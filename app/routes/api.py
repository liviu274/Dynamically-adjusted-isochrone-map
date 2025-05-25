from flask import Blueprint, jsonify, request
from app import db
from app.models.poi import PointOfInterest
from app.services.travel_time_service import get_travel_times
import json

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

@api_bp.route('/travel-times', methods=['GET'])
def travel_times():
    origin_lat = request.args.get('origin_lat', type=float)
    origin_lng = request.args.get('origin_lng', type=float)
    
    if not origin_lat or not origin_lng:
        return jsonify({'error': 'Origin coordinates required'}), 400
    
    # Optional: Get destinations from query params or use all POIs
    destinations_param = request.args.get('destinations')
    
    if destinations_param:
        try:
            destinations = json.loads(destinations_param)
        except:
            return jsonify({'error': 'Invalid destinations format'}), 400
    else:
        # If no destinations specified, get all POIs from database
        pois = PointOfInterest.query.all()
        destinations = [{'id': poi.id, 'name': poi.name, 'lat': poi.latitude, 'lng': poi.longitude} for poi in pois]
    
    # Get isochrones or travel times
    use_isochrones = request.args.get('isochrones', 'false').lower() == 'true'
    
    if use_isochrones:
        # Get isochrones (time-based polygons)
        times = get_travel_times(origin_lat, origin_lng)
    else:
        # Get specific travel times to destinations
        times = get_travel_times(origin_lat, origin_lng, destinations)
    
    return jsonify(times)

# Add route for specifically requesting isochrones
@api_bp.route('/isochrones', methods=['GET'])
def isochrones():
    origin_lat = request.args.get('origin_lat', type=float)
    origin_lng = request.args.get('origin_lng', type=float)
    
    if not origin_lat or not origin_lng:
        return jsonify({'error': 'Origin coordinates required'}), 400
    
    # Get optional parameters with defaults
    travel_mode = request.args.get('mode', 'driving-car')
    
    # Parse travel times array if provided
    time_ranges = request.args.get('times', '5,10,15')
    try:
        travel_times = [int(t) for t in time_ranges.split(',')]
    except:
        travel_times = [5, 10, 15]  # Default times
    
    from app.services.travel_time_service import get_isochrones
    isochrone_data = get_isochrones(origin_lat, origin_lng, travel_times, travel_mode)
    
    return jsonify(isochrone_data)