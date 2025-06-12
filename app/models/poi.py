from app import db
from datetime import datetime

class PointOfInterest(db.Model):
    # Database columns
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50))
    description = db.Column(db.Text)
    travel_time = db.Column(db.Integer, default=10)
    
    def __repr__(self):
        return f'<PointOfInterest {self.name}>'
    
    def to_dict(self):
        # Convert model to dictionary for JSON serialization
        return {
            'id': self.id,
            'name': self.name,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'category': self.category,
            'description': self.description,
            'travel_time': self.travel_time
        }