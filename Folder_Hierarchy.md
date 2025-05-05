
Dynamically-adjusted-isochrone-map/
│
├── app/                              # Main application package
│   ├── __init__.py                   # Flask app initialization
│   ├── config.py                     # Configuration settings
│   ├── models/                       # Database models
│   │   ├── __init__.py
│   │   └── poi.py                    # Points of Interest model
│   ├── routes/                       # API routes and views
│   │   ├── __init__.py
│   │   ├── main.py                   # Main routes
│   │   └── api.py                    # API endpoints
│   ├── services/                     # Business logic
│   │   ├── __init__.py
│   │   ├── map_service.py            # Map API integration
│   │   └── travel_time_service.py    # Travel time calculations
│   ├── static/                       # Static files
│   │   ├── css/
│   │   ├── js/
│   │   │   └── map.js                # Interactive map JavaScript
│   │   └── images/
│   └── templates/                    # HTML templates
│       ├── base.html                 # Base template
│       ├── index.html                # Main map page
│       └── components/               # Reusable components
│
├── migrations/                       # Database migrations
├── tests/                            # Test cases
│   ├── __init__.py
│   ├── test_models.py
│   └── test_api.py
│
├── .env                              # Environment variables (gitignored)
├── .gitignore                        # Git ignore file
├── requirements.txt                  # Project dependencies
├── config.py                         # Configuration settings
├── run.py                            # Application entry point
├── LICENSE                           # MIT License
└── README.md                         # Project documentation