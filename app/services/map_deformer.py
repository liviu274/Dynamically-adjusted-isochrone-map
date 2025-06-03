import os
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import requests
import traceback
try:
    from sklearn.manifold import MDS
except ImportError:
    print("Warning: Some advanced modules not found. Installing required packages...")
    import subprocess
    subprocess.check_call(["pip", "install", "scikit-learn", "scipy"])
    from sklearn.manifold import MDS
from datetime import datetime

class MapDeformer:
    """Creates time-deformed maps where distance represents travel time rather than physical distance"""
    
    def __init__(self, api_key=None):
        """Initialize with API key for OpenRouteService"""
        self.api_key = api_key
        self.font_path = os.path.join(os.path.dirname(__file__), '..', 'static', 'fonts', 'arial.ttf')
        if not os.path.exists(self.font_path):
            # Use default system font if custom font not available
            self.font_path = None
    
    def get_travel_times_matrix(self, pois):
        """Get matrix of travel times between POIs using OpenRouteService API"""
        url = "https://api.openrouteservice.org/v2/matrix/driving-car"
        
        # Since we're not sure how the API key is stored, handle both formats
        if not self.api_key:
            raise ValueError("API key is required for travel time matrix calculation")
            
        # Format the API key consistently - use Bearer prefix
        auth_header = self.api_key
        if not self.api_key.startswith('Bearer '):
            auth_header = f'Bearer {self.api_key}'
        
        headers = {
            'Authorization': auth_header,
            'Accept': 'application/json, application/geo+json',
            'Content-Type': 'application/json; charset=utf-8'
        }
        
        # Debug logging
        print(f"Making API request to {url}")
        print(f"Headers: {headers}")
        
        # Convert POIs to the format required by ORS (lng, lat)
        locations = [[poi['lng'], poi['lat']] for poi in pois]
        
        body = {
            "locations": locations,
            "metrics": ["duration"],
            "sources": list(range(len(locations))),
            "destinations": list(range(len(locations)))
        }
        
        print(f"Request body: {json.dumps(body)}")
        
        # Make request with more detailed error handling
        try:
            response = requests.post(url, json=body, headers=headers, timeout=30)
            response_text = response.text
            response_code = response.status_code
            
            print(f"API Response: {response_code}")
            
            if response_code == 200:
                data = response.json()
                time_matrix = np.array(data['durations'])
                return time_matrix
            else:
                print(f"API Error: {response_code} - {response_text}")
                
                # Check for specific error conditions
                if response_code == 403:
                    print("Authentication error - check your API key")
                elif response_code == 429:
                    print("Rate limit exceeded")
                    
                raise Exception(f"API Error {response_code}: {response_text}")
                
        except Exception as e:
            print(f"Exception during API call: {e}")
            raise
    
    def create_time_deformed_coordinates(self, time_matrix):
        """Create coordinates where distances represent travel times using MDS"""
        num_points = len(time_matrix)
        if num_points < 2:
            return np.zeros((num_points, 2))
        
        try:
            # Use MDS (Multidimensional Scaling) to create 2D coordinates from time distances
            # This properly preserves the relative time distances between all points
            mds = MDS(n_components=2, dissimilarity='precomputed', random_state=42)
            
            # MDS expects a symmetric distance matrix
            symmetric_matrix = (time_matrix + time_matrix.T) / 2
            
            # Apply MDS to get 2D coordinates that preserve time distances
            coords = mds.fit_transform(symmetric_matrix)
            
            print(f"MDS stress (lower is better): {mds.stress_}")
            
            # Normalize coordinates to [0,1] range with padding
            padding = 0.15
            min_x, min_y = np.min(coords, axis=0)
            max_x, max_y = np.max(coords, axis=0)
            
            # Ensure width and height are positive
            width = max(max_x - min_x, 0.01)
            height = max(max_y - min_y, 0.01)
            
            # Scale to fit in [0,1] with padding
            scale_x = (1 - 2 * padding) / width
            scale_y = (1 - 2 * padding) / height
            
            # Apply scaling and center the coordinates
            center_x = (min_x + max_x) / 2
            center_y = (min_y + max_y) / 2
            
            normalized_coords = np.zeros_like(coords)
            for i in range(num_points):
                normalized_coords[i, 0] = 0.5 + (coords[i, 0] - center_x) * scale_x
                normalized_coords[i, 1] = 0.5 + (coords[i, 1] - center_y) * scale_y
                
                # Safety clamp to ensure points stay within bounds
                normalized_coords[i, 0] = max(padding, min(1-padding, normalized_coords[i, 0]))
                normalized_coords[i, 1] = max(padding, min(1-padding, normalized_coords[i, 1]))
            
            # Debug output
            print("Time-deformed coordinates:")
            for i, (x, y) in enumerate(normalized_coords):
                print(f"POI {i+1}: ({x:.3f}, {y:.3f})")
                
            return normalized_coords
            
        except Exception as e:
            print(f"MDS failed: {e}, falling back to simple spiral layout")
            # Fallback to the old spiral method if MDS fails
            return self._create_spiral_coordinates(time_matrix)

    def _create_spiral_coordinates(self, time_matrix):
        """Fallback method using spiral layout based on sequential travel times"""
        num_points = len(time_matrix)
        coords = np.zeros((num_points, 2))
        
        # Start at center
        coords[0] = [0.5, 0.5]
        
        # Position subsequent points based on travel time from previous point
        angle = 0
        angle_increment = 2.0  # Radians to turn between points
        
        for i in range(1, num_points):
            prev_i = i - 1
            travel_time = time_matrix[prev_i, i]
            
            # Convert travel time to distance (smaller ratio = more spread out)
            distance = min(travel_time / 300.0, 0.3)  # Max 0.3 normalized units
            
            # Calculate position
            dx = distance * np.cos(angle)
            dy = distance * np.sin(angle)
            
            coords[i, 0] = coords[prev_i, 0] + dx
            coords[i, 1] = coords[prev_i, 1] + dy
            
            angle += angle_increment
            
            print(f"POI {prev_i+1} -> {i+1}: Time={travel_time}s, Distance={distance:.3f}")
        
        # Normalize to [0,1] with padding
        padding = 0.15
        min_x, min_y = np.min(coords, axis=0)
        max_x, max_y = np.max(coords, axis=0)
        
        width = max(max_x - min_x, 0.01)
        height = max(max_y - min_y, 0.01)
        
        scale = min((1 - 2 * padding) / width, (1 - 2 * padding) / height)
        center_x = (min_x + max_x) / 2
        center_y = (min_y + max_y) / 2
        
        for i in range(num_points):
            coords[i, 0] = 0.5 + (coords[i, 0] - center_x) * scale
            coords[i, 1] = 0.5 + (coords[i, 1] - center_y) * scale
            
            # Safety clamp
            coords[i, 0] = max(padding, min(1-padding, coords[i, 0]))
            coords[i, 1] = max(padding, min(1-padding, coords[i, 1]))
        
        return coords
    
    def draw_gradient_line(self, draw, p1, p2, color1, color2, width=1, segments=10):
        """Draw a gradient line between two points"""
        # Draw segments with color gradients
        for i in range(segments):
            t1 = i / segments
            t2 = (i + 1) / segments
            
            x1 = int(p1[0] * (1 - t1) + p2[0] * t1)
            y1 = int(p1[1] * (1 - t1) + p2[1] * t1)
            x2 = int(p1[0] * (1 - t2) + p2[0] * t2)
            y2 = int(p1[1] * (1 - t2) + p2[1] * t2)
            
            # Interpolate color
            r = int(color1[0] * (1 - t1) + color2[0] * t1)
            g = int(color1[1] * (1 - t1) + color2[1] * t1)
            b = int(color1[2] * (1 - t1) + color2[2] * t1)
            a = int(color1[3] * (1 - t1) + color2[3] * t1) if len(color1) > 3 and len(color2) > 3 else 255
            
            draw.line([(x1, y1), (x2, y2)], fill=(r, g, b, a), width=width)

    def create_time_deformed_map(self, json_path, output_dir=None):
        """Create a time-deformed map based on travel times between POIs"""
        # Load the JSON data
        with open(json_path, 'r') as f:
            data = json.load(f)
        
        pois = data.get('pois', [])
        bounds = data.get('bounds', {})
        
        # Verify we have enough POIs
        if len(pois) < 2:
            raise ValueError("Need at least 2 POIs to create a time-deformed map")
        
        # Set output directory and find image path
        if output_dir is None:
            output_dir = os.path.dirname(json_path)
        
        # Get base filename
        base_name = os.path.splitext(os.path.basename(json_path))[0]
        
        # Find image path - try multiple locations
        potential_paths = [
            os.path.join(os.path.dirname(json_path), f"{base_name}.png"),
            os.path.join(os.path.dirname(__file__), '..', 'static', 'map_screenshots', f"{base_name}.png"),
            os.path.join(os.path.dirname(__file__), '..', 'locals', 'map_screenshots', f"{base_name}.png")
        ]
        
        image_path = None
        for path in potential_paths:
            if os.path.exists(path):
                image_path = path
                break
        
        if not image_path:
            raise FileNotFoundError(f"Could not find image file for {base_name}")
        
        output_path = os.path.join(output_dir, f"{base_name}-timedeformed.png")
        
        # Get the time matrix - try API first, then fallback to Euclidean
        try:
            time_matrix = self.get_travel_times_matrix(pois)
            print("Successfully retrieved time matrix from API")
            # Save the time matrix for future use
            self.save_time_matrix(time_matrix, json_path)
        except Exception as e:
            print(f"Failed to get time matrix from API: {str(e)}")
            print("Using fallback Euclidean distance calculation")
            time_matrix = self.create_fallback_time_matrix(pois)
            # Still save the fallback matrix
            self.save_time_matrix(time_matrix, json_path)
    
        # Create time-based coordinates using MDS
        time_coords = self.create_time_deformed_coordinates(time_matrix)
        
        # Load the original map image
        original_img = Image.open(image_path)
        width, height = original_img.size
        
        # Convert original lat/lng to pixel coordinates
        ne_lat = bounds.get('northEast', {}).get('lat', 0)
        ne_lng = bounds.get('northEast', {}).get('lng', 0)
        sw_lat = bounds.get('southWest', {}).get('lat', 0)
        sw_lng = bounds.get('southWest', {}).get('lng', 0)

        print(f"Bounds: NE({ne_lat}, {ne_lng}), SW({sw_lat}, {sw_lng})")

        original_pixel_coords = []
        for poi in pois:
            # Convert lat/lng to normalized [0,1] coordinates within the image
            # X coordinate: West to East (left to right)
            norm_x = (poi['lng'] - sw_lng) / (ne_lng - sw_lng) if ne_lng != sw_lng else 0.5
            
            # Y coordinate: North to South (top to bottom) - FIXED: removed the flip
            # In screen coordinates, Y=0 is at the top, Y=1 is at the bottom
            # Higher latitude should map to smaller Y values (closer to top)
            norm_y = (ne_lat - poi['lat']) / (ne_lat - sw_lat) if ne_lat != sw_lat else 0.5
            
            original_pixel_coords.append([norm_x, norm_y])
            print(f"POI: ({poi['lat']}, {poi['lng']}) -> normalized: ({norm_x}, {norm_y})")
        
        # The time_coords are already normalized by create_time_deformed_coordinates
        # No need for additional normalization - just use them directly
        print("Using time coordinates directly from MDS")
        
        # Create the deformed map image
        deformed_image = self.warp_image(original_img, original_pixel_coords, time_coords)
        
        # Save the deformed map
        deformed_image.save(output_path)
        print(f"Saved time-deformed map to: {output_path}")
        
        return output_path

    def create_fallback_time_matrix(self, pois):
        """Create a fallback time matrix if the API fails"""
        print("Creating fallback time matrix based on Euclidean distance")
        
        coords = np.array([[p['lat'], p['lng']] for p in pois])
        dist_matrix = np.zeros((len(pois), len(pois)))
        
        for i in range(len(pois)):
            for j in range(len(pois)):
                # Simple Haversine-like distance calculation
                lat1, lon1 = coords[i]
                lat2, lon2 = coords[j]
                dx = (lon2 - lon1) * np.cos((lat1 + lat2) / 2)
                dy = lat2 - lat1
                dist = 111.3 * np.sqrt(dx*dx + dy*dy)  # km
                # Convert to seconds (assuming 50 km/h)
                dist_matrix[i, j] = dist * 72  # seconds
        
        return dist_matrix
        
    def warp_image(self, image, src_points, dst_points):
        """Create side-by-side visualization of geographic vs time distances"""
        width, height = image.size
        
        # Create a wider canvas to hold both visualizations side by side
        combined_width = width * 2 + 50  # Add 50px spacing between the views
        result_image = Image.new("RGB", (combined_width, height), (20, 22, 30))
        draw = ImageDraw.Draw(result_image)
        
        try:
            # Add borders around each panel FIRST so they appear behind everything
            # Left panel border
            draw.rectangle([(0, 0), (width, height)], fill=None, outline=(80, 80, 100), width=3)
            # Right panel border
            draw.rectangle([(width + 50, 0), (width + 50 + width, height)], fill=None, outline=(80, 80, 100), width=3)
            
            # DO NOT paste original map image (as per user request)
            
            # Convert normalized coordinates [0,1] to pixel coordinates
            src_pixel_coords = np.array([(x * width, y * height) for x, y in src_points])
            
            # Ensure all time-based points stay within bounds of right panel
            fixed_dst_points = []
            for x, y in dst_points:
                # Clamp values to padding distance from edge
                padding = 0.1  # 10% padding from edges
                x = max(padding, min(1-padding, x))
                y = max(padding, min(1-padding, y))
                fixed_dst_points.append([x, y])
            
            dst_pixel_coords = np.array([(x * width, y * height) for x, y in fixed_dst_points])
            
            # Try to load font
            try:
                font = ImageFont.truetype(self.font_path, 14) if self.font_path else ImageFont.load_default()
                small_font = ImageFont.truetype(self.font_path, 12) if self.font_path else ImageFont.load_default()
                title_font = ImageFont.truetype(self.font_path, 18, stroke_width=1) if self.font_path else ImageFont.load_default()
            except Exception as font_error:
                print(f"Font error: {font_error}")
                font = ImageFont.load_default()
                small_font = ImageFont.load_default()
                title_font = ImageFont.load_default()
        
            # Get travel times
            num_pois = len(src_points)
            travel_times = []
            time_matrix_path = os.path.join(os.path.dirname(__file__), '..', 'locals', 'map_screenshots', 'last_time_matrix.json')
            
            if os.path.exists(time_matrix_path):
                try:
                    with open(time_matrix_path, 'r') as f:
                        time_data = json.load(f)
                        if 'matrix' in time_data:
                            matrix = time_data['matrix']
                            for i in range(num_pois):
                                next_i = (i + 1) % num_pois
                                if i < len(matrix) and next_i < len(matrix[i]):
                                    travel_times.append(matrix[i][next_i])
                                else:
                                    travel_times.append(60)  # Default 1 minute
                except Exception as e:
                    print(f"Error reading time matrix: {e}")
                    travel_times = [60] * num_pois
            else:
                travel_times = [60] * num_pois
                
            # Draw subtle grid for both sides (since we removed the map background)
            for panel_offset in [0, width + 50]:  # Left and right panel positions
                grid_step = min(width, height) // 20
                for x in range(0, width, grid_step):
                    draw.line([(panel_offset + x, 0), (panel_offset + x, height)], fill=(40, 42, 50), width=1)
                for y in range(0, height, grid_step):
                    draw.line([(panel_offset, y), (panel_offset + width, y)], fill=(40, 42, 50), width=1)
            
            # Add titles for each visualization
            # Geographic title
            title_text = "GEOGRAPHIC DISTANCES"
            text_bbox = draw.textbbox((0, 0), title_text, font=title_font)
            text_width = text_bbox[2] - text_bbox[0]
            draw.rectangle((width//2 - text_width//2 - 10, 10, width//2 + text_width//2 + 10, 40), fill=(0, 0, 0, 180))
            draw.text((width//2 - text_width//2, 15), title_text, fill=(100, 149, 237), font=title_font)
            
            # Time-based title
            title_text = "TIME-BASED DISTANCES"
            text_bbox = draw.textbbox((0, 0), title_text, font=title_font)
            text_width = text_bbox[2] - text_bbox[0]
            draw.rectangle((width + 50 + width//2 - text_width//2 - 10, 10, width + 50 + width//2 + text_width//2 + 10, 40), 
                          fill=(0, 0, 0, 180))
            draw.text((width + 50 + width//2 - text_width//2, 15), title_text, fill=(220, 53, 69), font=title_font)
            
            # Draw geographic connections (blue lines on the left panel)
            for i in range(num_pois):
                next_i = (i + 1) % num_pois
                src_p1 = tuple(map(int, src_pixel_coords[i]))
                src_p2 = tuple(map(int, src_pixel_coords[next_i]))
                
                try:
                    self.draw_gradient_line(draw, src_p1, src_p2, 
                                          (130, 190, 255, 150), (70, 130, 230, 150), 
                                          width=3)
                except Exception as gradient_error:
                    print(f"Gradient error (geo): {gradient_error}")
                    draw.line([src_p1, src_p2], fill=(100, 149, 237), width=3)
            
            # Draw geographic POIs on the left panel
            for i in range(num_pois):
                src_x, src_y = map(int, src_pixel_coords[i])
                
                # Draw circle with blue outline
                draw.ellipse((src_x-12, src_y-12, src_x+12, src_y+12), outline=(100, 149, 237), width=2)
                # Fill with slightly darker blue
                draw.ellipse((src_x-10, src_y-10, src_x+10, src_y+10), fill=(60, 100, 200))
                
                # Add POI number in the circle
                num_text = f"{i+1}"
                text_bbox = draw.textbbox((0, 0), num_text, font=small_font)
                text_width = text_bbox[2] - text_bbox[0]
                text_height = text_bbox[3] - text_bbox[1]
                draw.text((src_x - text_width/2, src_y - text_height/2), 
                         num_text, fill=(255, 255, 255), font=small_font)
                
                # NO POI labels (as per user request)
        
            # TIME-BASED VISUALIZATION (RIGHT PANEL)
            # -------------------------------------
            time_panel_offset = width + 50  # Starting X position for time panel
                
            # Draw time-based connections with proper deformation
            for i in range(num_pois):
                next_i = (i + 1) % num_pois
                
                try:
                    # Offset the coordinates to the right panel
                    dst_p1 = tuple(map(int, [dst_pixel_coords[i][0] + time_panel_offset, dst_pixel_coords[i][1]]))
                    dst_p2 = tuple(map(int, [dst_pixel_coords[next_i][0] + time_panel_offset, dst_pixel_coords[next_i][1]]))
                    
                    # Draw the red line with gradient
                    try:
                        self.draw_gradient_line(draw, dst_p1, dst_p2, 
                                          (255, 100, 100, 200), (200, 30, 60, 200),
                                          width=4)
                    except Exception as gradient_error:
                        print(f"Gradient error (time): {gradient_error}")
                        draw.line([dst_p1, dst_p2], fill=(220, 53, 69), width=4)
                    
                    # Add travel time label
                    if i < len(travel_times):
                        time_seconds = travel_times[i]
                        
                        # Calculate midpoint for the label
                        mid_x = int((dst_p1[0] + dst_p2[0]) / 2)
                        mid_y = int((dst_p1[1] + dst_p2[1]) / 2)
                        
                        # Calculate perpendicular vector for offset
                        dx = dst_p2[0] - dst_p1[0]
                        dy = dst_p2[1] - dst_p1[1]
                        line_length = max(1, np.sqrt(dx*dx + dy*dy))
                        
                        # Format time nicely
                        if isinstance(time_seconds, (int, float)):
                            if time_seconds < 60:
                                time_str = f"{int(time_seconds)}s"
                            else:
                                minutes = int(time_seconds // 60)
                                seconds = int(time_seconds % 60)
                                time_str = f"{minutes}m {seconds}s"
                        else:
                            time_str = "?"
                        
                        # Offset perpendicular to the line
                        offset = 15
                        if abs(dx) > 0 or abs(dy) > 0:
                            nx = -dy / line_length * offset
                            ny = dx / line_length * offset
                            mid_x += int(nx)
                            mid_y += int(ny)
                        
                        # Draw the time label with background
                        try:
                            text_bbox = draw.textbbox((0, 0), time_str, font=small_font)
                            text_width = text_bbox[2] - text_bbox[0]
                            text_height = text_bbox[3] - text_bbox[1]
                            
                            # Background for better visibility
                            draw.rectangle((mid_x - text_width/2 - 4, 
                                          mid_y - text_height/2 - 4,
                                          mid_x + text_width/2 + 4,
                                          mid_y + text_height/2 + 4),
                                        fill=(0, 0, 0, 200),
                                        outline=(255, 255, 255, 150),
                                        width=1)
                            
                            # Draw the time text
                            draw.text((mid_x - text_width/2, mid_y - text_height/2),
                                    time_str, fill=(255, 255, 255), font=small_font)
                        except Exception as text_error:
                            print(f"Text drawing error: {text_error}")
                    
                except Exception as coord_error:
                    print(f"Time coordinate error: {coord_error}")
                    
            # Draw time-based POIs with numbers only (no labels)
            for i in range(num_pois):
                try:
                    # Offset X coordinate to right panel
                    dst_x = int(dst_pixel_coords[i][0]) + time_panel_offset
                    dst_y = int(dst_pixel_coords[i][1])
                    
                    # Draw circle with red outline
                    draw.ellipse((dst_x-12, dst_y-12, dst_x+12, dst_y+12), outline=(220, 53, 69), width=2)
                    # Fill with slightly darker red
                    draw.ellipse((dst_x-10, dst_y-10, dst_x+10, dst_y+10), fill=(180, 30, 45))
                    
                    # Add POI number in the circle
                    num_text = f"{i+1}"
                    text_bbox = draw.textbbox((0, 0), num_text, font=small_font)
                    text_width = text_bbox[2] - text_bbox[0]
                    text_height = text_bbox[3] - text_bbox[1]
                    draw.text((dst_x - text_width/2, dst_y - text_height/2), 
                             num_text, fill=(255, 255, 255), font=small_font)
                    
                except Exception as poi_error:
                    print(f"Time POI error: {poi_error}")
        
        except Exception as e:
            print("===== VISUALIZATION ERROR =====")
            print(f"Error during visualization creation: {e}")
            traceback.print_exc()
            draw.text((20, 20), f"Visualization error: {str(e)}", fill=(255, 50, 50))
        
        return result_image

    def _estimate_travel_time(self, p1, p2):
        """Fallback method to estimate travel time based on pixel distance"""
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        distance_px = np.sqrt(dx*dx + dy*dy)
        # Rough estimate: 100 pixels ≈ 5 minutes (300 seconds)
        return distance_px * 3

    def save_time_matrix(self, time_matrix, json_path):
        """Save the time matrix for use in visualization"""
        # Get directory from json_path
        directory = os.path.dirname(json_path)
        output_path = os.path.join(directory, 'last_time_matrix.json')
        
        # Save the matrix
        with open(output_path, 'w') as f:
            json.dump({
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'matrix': time_matrix.tolist()
            }, f, indent=2)
    
def generate_time_deformed_map(screenshot_id, api_key=None):
    """Generate a time-deformed map for a given screenshot ID"""
    try:
        # CHANGE THIS: Use correct path to 'locals' directory
        base_dir = os.path.join(os.path.dirname(__file__), '..', 'locals', 'map_screenshots')
        json_path = os.path.join(base_dir, f"{screenshot_id}.json")
        
        # Add debug output
        print(f"Looking for JSON at: {json_path}")
        
        if not os.path.exists(json_path):
            raise FileNotFoundError(f"Screenshot JSON not found: {json_path}")
        
        # Also verify PNG exists
        image_path = os.path.join(os.path.dirname(json_path), f"{screenshot_id}.png")
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Screenshot image not found: {image_path}")
        
        # Create static output directory if it doesn't exist
        static_dir = os.path.join(os.path.dirname(__file__), '..', 'static', 'map_screenshots')
        os.makedirs(static_dir, exist_ok=True)
        
        # Set output to static directory
        output_path = os.path.join(static_dir, f"{screenshot_id}-timedeformed.png")
        
        deformer = MapDeformer(api_key)
        result_path = deformer.create_time_deformed_map(json_path, output_dir=static_dir)
        
        # Check if output file was actually created
        if os.path.exists(result_path):
            return result_path
        else:
            raise FileNotFoundError(f"Failed to create output file: {result_path}")
    
    except Exception as e:
        print(f"ERROR generating time-deformed map: {str(e)}")
        traceback.print_exc()
        raise # Re-raise to let caller handle it