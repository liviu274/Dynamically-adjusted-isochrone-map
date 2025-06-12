from flask import Blueprint, jsonify, request, current_app, send_file
from app import db
from app.models.poi import PointOfInterest
from app.services.travel_time_service import get_travel_times
import json
import os
import requests
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)

api_bp = Blueprint('api', __name__)

@api_bp.route('/pois', methods=['GET'])
def get_pois():
    # Retrieve all POIs from database
    pois = PointOfInterest.query.all()
    return jsonify([poi.to_dict() for poi in pois])

@api_bp.route('/pois', methods=['POST'])
def create_poi():
    # Create new POI from request data
    data = request.json
    new_poi = PointOfInterest(
        name=data['name'],
        latitude=data['latitude'],
        longitude=data['longitude'],
        category=data.get('category'),
        description=data.get('description'),
        travel_time=data.get('travel_time', 10)
    )
    db.session.add(new_poi)
    db.session.commit()
    return jsonify(new_poi.to_dict()), 201

@api_bp.route('/pois/<int:poi_id>', methods=['GET'])
def get_poi(poi_id):
    # Retrieve specific POI by ID
    poi = PointOfInterest.query.get_or_404(poi_id)
    return jsonify(poi.to_dict())

@api_bp.route('/pois/<int:poi_id>', methods=['PUT'])
def update_poi(poi_id):
    # Update existing POI
    poi = PointOfInterest.query.get_or_404(poi_id)
    data = request.json
    
    poi.name = data.get('name', poi.name)
    poi.latitude = data.get('latitude', poi.latitude)
    poi.longitude = data.get('longitude', poi.longitude)
    poi.category = data.get('category', poi.category)
    poi.description = data.get('description', poi.description)
    poi.travel_time = data.get('travel_time', poi.travel_time)
    
    db.session.commit()
    return jsonify(poi.to_dict())

@api_bp.route('/pois/<int:poi_id>', methods=['DELETE'])
def delete_poi(poi_id):
    # Remove POI from database
    poi = PointOfInterest.query.get_or_404(poi_id)
    db.session.delete(poi)
    db.session.commit()
    return jsonify({'result': 'success'}), 200

@api_bp.route('/travel-times', methods=['GET'])
def travel_times():
    # Get origin coordinates from request
    origin_lat = request.args.get('origin_lat', type=float)
    origin_lng = request.args.get('origin_lng', type=float)
    
    if not origin_lat or not origin_lng:
        return jsonify({'error': 'Origin coordinates required'}), 400
    
    # Parse destinations from query parameters
    destinations_param = request.args.get('destinations')
    
    if destinations_param:
        try:
            destinations = json.loads(destinations_param)
        except:
            return jsonify({'error': 'Invalid destinations format'}), 400
    else:
        # Use all POIs as destinations if none specified
        pois = PointOfInterest.query.all()
        destinations = [{'id': poi.id, 'name': poi.name, 'lat': poi.latitude, 'lng': poi.longitude} for poi in pois]
    
    # Determine whether to return isochrones or point-to-point times
    use_isochrones = request.args.get('isochrones', 'false').lower() == 'true'
    
    if use_isochrones:
        # Get isochrones (time-based polygons)
        times = get_travel_times(origin_lat, origin_lng)
    else:
        # Get specific travel times to destinations
        times = get_travel_times(origin_lat, origin_lng, destinations)
    
    return jsonify(times)

@api_bp.route('/isochrones', methods=['GET'])
def isochrones():
    # Get origin coordinates
    origin_lat = request.args.get('origin_lat', type=float)
    origin_lng = request.args.get('origin_lng', type=float)
    
    if not origin_lat or not origin_lng:
        return jsonify({'error': 'Origin coordinates required'}), 400
    
    # Parse optional parameters
    travel_mode = request.args.get('mode', 'driving-car')
    
    # Parse travel times array
    time_ranges = request.args.get('times', '5,10,15')
    try:
        travel_times = [int(t) for t in time_ranges.split(',')]
    except:
        travel_times = [5, 10, 15]
    
    from app.services.travel_time_service import get_isochrones
    isochrone_data = get_isochrones(origin_lat, origin_lng, travel_times, travel_mode)
    
    return jsonify(isochrone_data)

@api_bp.route('/deform-map/<screenshot_id>', methods=['GET'])
def deform_map(screenshot_id):
    """Generate a time-deformed map for a given screenshot ID"""
    try:
        print(f"\n=== Starting time-deformed map generation for {screenshot_id} ===\n")
        
        # Import map deformer service
        from app.services.map_deformer import generate_time_deformed_map
        
        # Get API key from configuration
        api_key = current_app.config.get('TRAVEL_TIME_API_KEY')
        if not api_key:
            return jsonify({'success': False, 'error': 'No API key configured'}), 500
            
        # Find screenshot files in locals directory
        locals_dir = os.path.join(current_app.root_path, 'locals', 'map_screenshots')
        os.makedirs(locals_dir, exist_ok=True)
        
        json_path = os.path.join(locals_dir, f"{screenshot_id}.json")
        png_path = os.path.join(locals_dir, f"{screenshot_id}.png")
        if not os.path.exists(json_path) or not os.path.exists(png_path):
            return jsonify({'success': False, 'error': 'Screenshot files not found'}), 404
        
        # Verify POI data exists
        with open(json_path, 'r') as f:
            data = json.load(f)
        if len(data.get('pois', [])) < 2:
            return jsonify({
                'success': False,
                'error': 'Need at least 2 POIs to create a time-deformed map'
            }), 400

        # Generate the time-deformed map
        try:
            # Try API-based approach first
            output_path = generate_time_deformed_map(screenshot_id, api_key)
        except Exception as api_error:
            print(f"API approach failed: {str(api_error)}")
            print("Falling back to distance-based calculation...")
            
            # Use fallback method
            from app.services.map_deformer import MapDeformer
            deformer = MapDeformer(None)
            output_path = deformer.create_time_deformed_map(json_path, output_dir=locals_dir)
        
        # Get filename for response
        filename = os.path.basename(output_path)
        
        return jsonify({
            'success': True,
            'filename': filename,
            'url': f"/api/map-image/{filename}"
        })
        
    except Exception as e:
        import traceback
        print(f"Error generating time-deformed map: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/screenshots', methods=['GET'])
def get_screenshots():
    """Get all available map screenshots"""
    try:
        # Find screenshots directory
        screenshots_dir = os.path.join(os.path.dirname(__file__), '..', 'locals', 'map_screenshots')
        screenshots = []
        
        # Find all JSON metadata files
        for filename in os.listdir(screenshots_dir):
            if filename.endswith('.json'):
                screenshot_id = os.path.splitext(filename)[0]
                json_path = os.path.join(screenshots_dir, filename)
                png_path = os.path.join(screenshots_dir, f"{screenshot_id}.png")
                timedeformed_path = os.path.join(screenshots_dir, f"{screenshot_id}-timedeformed.png")
                
                if os.path.exists(png_path):
                    # Load metadata from JSON
                    with open(json_path, 'r') as f:
                        data = json.load(f)
                    
                    screenshots.append({
                        'id': screenshot_id,
                        'name': f"Map {screenshot_id[-6:]}",
                        'filename': f"{screenshot_id}.png",
                        'timestamp': data.get('timestamp', ''),
                        'poiCount': len(data.get('pois', [])),
                        'timeDeformed': os.path.exists(timedeformed_path)
                    })
        
        # Sort by timestamp (newest first)
        screenshots.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return jsonify({
            'success': True,
            'screenshots': screenshots
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api_bp.route('/map-image/<filename>', methods=['GET'])
def serve_map_image(filename):
    """Serve image files from either static or locals directories"""
    try:
        # Check static directory first
        static_dir = os.path.join(current_app.root_path, 'static', 'map_screenshots')
        static_path = os.path.join(static_dir, filename)
        
        if os.path.exists(static_path):
            return send_file(static_path)
            
        # If not found, check locals directory
        locals_dir = os.path.join(current_app.root_path, 'locals', 'map_screenshots')
        locals_path = os.path.join(locals_dir, filename)
        
        if os.path.exists(locals_path):
            # Copy to static for caching
            os.makedirs(static_dir, exist_ok=True)
            import shutil
            shutil.copy2(locals_path, static_path)
            print(f"Copied {locals_path} to {static_path}")
            return send_file(locals_path)
            
        return "Image not found", 404
        
    except Exception as e:
        print(f"Error serving image: {str(e)}")
        return str(e), 500