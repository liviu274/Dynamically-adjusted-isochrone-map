### Project Configuration  

- **Project Initialization** – Creating the basic structure and setting up the development environment.  
- **Loading and Displaying the Map** – Integrating and displaying an interactive map.  
- **Managing Points of Interest** – Adding, editing, and deleting locations on the map.  
- **Data Persistence** – Storing points of interest and routes in a database.  

### Data Handling  

- **Collecting Travel Times** – Retrieving data on the time required between locations.  
- **Preprocessing and Normalizing Travel Times** – Transforming raw data into a usable format.  
- **Automatic Time Updates** – Implementing a periodic update mechanism.  
- **Error Handling and Fallback** – Managing cases where data is missing or inaccessible.  

### Data Visualization on the Map  

- **Dynamic Map Coloring** – Changing the appearance based on travel times.  
- **Adding a Visual Scale** – A legend explaining time differences.  
- **Displaying Information on Hover/Click** – Showing location details and travel times upon interaction.  
- **Implementing a Filtering System** – Allowing users to view only specific types of locations.  

### Interactive Features  

- **Location Search** – A search system for points of interest.  
- **Fastest Route Calculation** – An algorithm to determine the optimal path between two points.  
- **Dynamic Route Updates** – Adjusting routes based on traffic conditions.  
- **Historical View Mode** – Comparing current travel times with past data.  

### Optimization and Testing  

- **Reducing Map Loading Time** – Optimizing API requests.  
- **Improving Interaction Performance** – Ensuring a smooth and responsive UI.  
- **Unit Testing** – Verifying individual functionalities separately.  
- **System Integration Testing** – Ensuring compatibility between all modules.

## API used for isochrome generation:|
  https://openrouteservice.org/


## 🔧 Database Setup Instructions

To ensure the application works correctly with data persistence, follow these steps to set up the PostgreSQL database:

1. **Run the SQL Script**  
   Execute the `bd.sql` file in your local PostgreSQL instance to create and initialize the required database schema.

2. **Install PostgreSQL Package for Python**  
   Use `pip` to install the PostgreSQL adapter for Python:
   ```bash
   pip install psycopg2-binary

**Update Database Credentials**  
   Open the `app/config.py` file and update the `SQLALCHEMY_DATABASE_URI` with your PostgreSQL username and password:
   ```python
   SQLALCHEMY_DATABASE_URI = 'postgresql://<your_username>:<your_password>@localhost:5432/mds'
   ```
   Replace `<your_username>` and `<your_password>` with your actual PostgreSQL credentials.

