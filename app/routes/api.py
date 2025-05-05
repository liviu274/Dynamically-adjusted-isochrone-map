# from flask import Blueprint, jsonify, request
# from app import db
# from app.models.poi import PointOfInterest
# from app.services.travel_time_service import get_travel_times

# api_bp = Blueprint('api', __name__)

# @api_bp.route('/pois', methods=['GET'])
# def get_pois():
#     pois = PointOfInterest.query.all()
#     return jsonify([poi.to_dict() for poi in pois])

# @api_bp.route('/pois', methods=['POST'])
# def create_poi():
#     data = request.json
#     new_poi = PointOfInterest(
#         name=data['name'],
#         latitude=data['latitude'],
#         longitude=data['longitude'],
#         category=data.get('category'),
#         description=data.get('description')
#     )
#     db.session.add(new_poi)
#     db.session.commit()
#     return jsonify(new_poi.to_dict()), 201

# @api_bp.route('/travel-times', methods=['GET'])
# def travel_times():
#     origin_lat = request.args.get('origin_lat', type=float)
#     origin_lng = request.args.get('origin_lng', type=float)
    
#     if not origin_lat or not origin_lng:
#         return jsonify({'error': 'Origin coordinates required'}), 400
        
#     times = get_travel_times(origin_lat, origin_lng)
#     return jsonify(times)