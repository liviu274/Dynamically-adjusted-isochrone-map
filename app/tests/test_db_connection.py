from app import create_app, db
from sqlalchemy import text

def test_db_connection():
    app = create_app()
    with app.app_context():
        try:
            # Test database connection
            print("Testing database connection...")
            
            # Check database type
            result = db.session.execute(text('SELECT version()')).scalar()
            print(f"Database type: PostgreSQL version {result}")
            
            # Test point_of_interest table
            result = db.session.execute(text('SELECT COUNT(*) FROM point_of_interest')).scalar()
            print(f"Number of POIs in database: {result}")
            
            print("Database connection successful!")
        except Exception as e:
            print("Failed to connect to the database.")
            print(f"Error: {e}")

if __name__ == "__main__":
    test_db_connection()