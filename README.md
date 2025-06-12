# Dynamically-adjusted Isochrone Map

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.8+-green.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.0+-lightgrey.svg)](https://flask.palletsprojects.com/)

A web application that visualizes travel times from different locations using interactive, dynamically-adjusted isochrone maps.

## 📋 Project Overview

This application helps users understand travel time patterns by visualizing isochrones - areas that can be reached within a specific time from a starting point. Unlike traditional maps that show physical distance, our isochrones represent travel time, providing a more practical view for urban planning, real estate decisions, and everyday travel planning.

## ✨ Key Features

- **Interactive Map Interface** - Pan, zoom, and navigate a fully responsive map
- **POI Management** - Add, edit, and delete points of interest with custom categories
- **Dynamic Travel Time Visualization** - See color-coded areas showing locations reachable within specified timeframes
- **Real-time Updates** - Travel times adjust based on current traffic conditions
- **Location Search** - Find places quickly with integrated search functionality
- **Time-Deformed Maps** - Generate alternative map views where distance represents travel time instead of physical distance
- **Filtering System** - Filter locations by category, travel time, or other attributes

## 🛠️ Technology Stack

- **Frontend:** HTML5, CSS3, JavaScript, Leaflet.js
- **Backend:** Python, Flask
- **Database:** PostgreSQL
- **APIs:** OpenRouteService for isochrone generation
- **Data Processing:** Scikit-learn for map deformation algorithms

## 📱 Implementation Phases

### 1. Foundation

- Built core application structure with Flask backend and Leaflet map integration
- Implemented basic POI creation, editing and deletion functionality
- Set up database models for data persistence
- Created responsive UI with dark mode support

### 2. Isochrone Visualization

- Integrated with OpenRouteService API for isochrone generation
- Implemented color-coded travel time zones on the map
- Added controls for adjusting travel time parameters
- Developed error handling for API limits and connection issues

### 3. Enhanced User Experience

- Added location search functionality
- Implemented category filtering system
- Created interactive sidebars for saved locations
- Developed toast notification system for user feedback

### 4. Advanced Features

- Time-deformed map generation showing travel time distortion
- Historical data comparison for analyzing travel time changes
- Optimization for mobile devices
- Batch processing for multiple points of interest

## 🔧 Project Architecture

### Project Configuration

- **Project Initialization** – Creating the basic structure and setting up the development environment
- **Loading and Displaying the Map** – Integrating and displaying an interactive map
- **Managing Points of Interest** – Adding, editing, and deleting locations on the map
- **Data Persistence** – Storing points of interest and routes in a database

### Data Handling

- **Collecting Travel Times** – Retrieving data on the time required between locations
- **Preprocessing and Normalizing Travel Times** – Transforming raw data into a usable format
- **Automatic Time Updates** – Implementing a periodic update mechanism
- **Error Handling and Fallback** – Managing cases where data is missing or inaccessible

### Data Visualization on the Map

- **Dynamic Map Coloring** – Changing the appearance based on travel times
- **Adding a Visual Scale** – A legend explaining time differences
- **Displaying Information on Hover/Click** – Showing location details and travel times upon interaction
- **Implementing a Filtering System** – Allowing users to view only specific types of locations

### Interactive Features

- **Location Search** – A search system for points of interest
- **Fastest Route Calculation** – An algorithm to determine the optimal path between two points
- **Dynamic Route Updates** – Adjusting routes based on traffic conditions
- **Historical View Mode** – Comparing current travel times with past data

### Optimization and Testing

- **Reducing Map Loading Time** – Optimizing API requests
- **Improving Interaction Performance** – Ensuring a smooth and responsive UI
- **Unit Testing** – Verifying individual functionalities separately
- **System Integration Testing** – Ensuring compatibility between all modules

## 🌐 API Integration

This application uses [OpenRouteService](https://openrouteservice.org/) for isochrone generation, which provides powerful geospatial analysis capabilities.

## 🤖 Prompt Engineering Credits

We would like to acknowledge the support provided by Clause Sonnet 3.7 prompt engineering in resolving several critical development challenges:

### Bug Fixing Examples

1. **Authentication Token Expiration Bug**:  
   When users experienced sudden disconnections, Clause Sonnet 3.7 helped identify that the JWT refresh mechanism was failing silently. It guided us in implementing a proper token refresh pattern with appropriate error handling.

2. **Isochrone Rendering Glitch**:  
   We encountered inconsistent polygon rendering for isochrones that crossed the 180° meridian. Through prompt engineering, we were able to understand the geodata normalization issue and implement the correct polygon splitting technique.

3. **Database Connection Pool Saturation**:  
   Users reported random 500 errors during peak usage. Clause Sonnet 3.7 helped diagnose the connection pooling configuration issues and guided us in implementing a more efficient connection management strategy with proper timeout handling.

### Known Bugs / Documentation Backlog

- **Important reminders**:  
  In practice, it was mostly used for important reminders, sush as files that should not be pushed to remote or
  api credentials updating for every local instance

### Load-Order Refactoring

1. **JavaScript Dependency Circular Reference**:  
   Our map initialization was failing intermittently due to complex module interdependencies. Prompt engineering helped us visualize the dependency graph and restructure our code with a proper initialization sequence pattern.

2. **API Service Initialization Sequence**:  
   The application sometimes failed to properly initialize the geolocation services. Clause Sonnet 3.7 guided us in implementing a promise-based service initialization chain that ensured proper loading order regardless of network response timing.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
