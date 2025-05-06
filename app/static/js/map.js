let map;
let markers = [];
let selectedMarker = null;
let currentPopup = null;
let editMode = false;
let markersVisible = true;
let isochroneLayers = []; // To store isochrone layers

// Initialize the map
function initMap() {
    // Default center (London)
    const center = [51.5074, -0.1278];
    
    // Create Leaflet map
    map = L.map('map').setView(center, 13);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Add click listener to map for setting POI location
    map.on('click', function(e) {
        const position = e.latlng;
        
        // Update form with selected coordinates
        document.getElementById("poi-latitude").value = position.lat;
        document.getElementById("poi-longitude").value = position.lng;
        
        // If not in edit mode, clear the form except coordinates
        if (!editMode) {
            document.getElementById("poi-id").value = "";
            document.getElementById("poi-name").value = "";
            document.getElementById("poi-category").value = "Other";
            document.getElementById("poi-description").value = "";
        }
        
        // Show temporary marker at selected location
        if (selectedMarker) {
            map.removeLayer(selectedMarker);
        }
        
        const blueIcon = new L.Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });
        
        selectedMarker = L.marker([position.lat, position.lng], {icon: blueIcon}).addTo(map);
    });
    
    // Set up form submission
    document.getElementById("poi-form").addEventListener("submit", savePOI);
    
    // Set up cancel edit button
    document.getElementById("cancel-edit-btn").addEventListener("click", cancelEdit);
    
    // Set up search functionality
    document.getElementById("poi-search").addEventListener("input", filterPOIs);
    
    // Load existing POIs
    loadPOIs();
    
    // Add this inside the initMap function after other event listeners
    document.getElementById("poi-visibility-toggle").addEventListener("change", function(e) {
        const isVisible = e.target.checked;
        toggleMarkersVisibility(isVisible);
        
        // Update all individual toggle switches to match
        document.querySelectorAll('.poi-visibility-toggle').forEach(toggle => {
            toggle.checked = isVisible;
        });
    });
}

// Load points of interest from the API
function loadPOIs() {
    fetch('/api/pois')
        .then(response => response.json())
        .then(data => {
            // Clear existing markers
            clearMarkers();
            
            // Add markers for each POI
            data.forEach(poi => {
                const marker = addMarkerForPOI(poi);
                
                // If markers should be hidden, remove from map
                if (!markersVisible && marker) {
                    map.removeLayer(marker);
                }
            });
            
            // Update the POI list in the sidebar
            updatePOIList(data);
        })
        .catch(error => console.error('Error loading POIs:', error));
}

// Add a marker for a point of interest
function addMarkerForPOI(poi) {
    const position = [poi.latitude, poi.longitude];
    
    // Create the marker
    const marker = L.marker(position);
    
    // Only add to map if markers are visible
    if (markersVisible) {
        marker.addTo(map);
    }
    
    // Create popup content
    const popupContent = `
        <div class="info-window" data-poi-id="${poi.id}">
            <h5>${poi.name}</h5>
            <p>${poi.description || 'No description'}</p>
            <p><strong>Category:</strong> ${poi.category || 'Uncategorized'}</p>
            <div class="mt-2">
                <button class="btn btn-sm btn-primary edit-poi-btn" data-poi-id="${poi.id}">Edit</button>
                <button class="btn btn-sm btn-danger delete-poi-btn" data-poi-id="${poi.id}">Delete</button>
            </div>
        </div>
    `;
    
    const popup = L.popup().setContent(popupContent);
    marker.bindPopup(popup);
    
    // Add click listener to marker
    marker.on('click', function() {
        currentPopup = popup;
        
        // Add event listeners after popup is opened
        setTimeout(() => {
            document.querySelector(`.edit-poi-btn[data-poi-id="${poi.id}"]`).addEventListener('click', () => {
                editPOI(poi.id);
                marker.closePopup();
            });
            
            document.querySelector(`.delete-poi-btn[data-poi-id="${poi.id}"]`).addEventListener('click', () => {
                deletePOI(poi.id);
                marker.closePopup();
            });
            
            // Add a new button to show isochrones from this POI
            const showIsochronesBtn = document.createElement('button');
            showIsochronesBtn.className = 'btn btn-sm btn-info mt-2';
            showIsochronesBtn.textContent = 'Show Travel Times';
            showIsochronesBtn.addEventListener('click', () => {
                fetchAndDisplayIsochrones(poi.latitude, poi.longitude);
            });
            
            const infoWindow = document.querySelector(`.info-window[data-poi-id="${poi.id}"]`);
            if (infoWindow) {
                infoWindow.appendChild(showIsochronesBtn);
            }
        }, 100);
    });
    
    // Store marker with POI ID
    marker.poi_id = poi.id;
    markers.push(marker);
    
    return marker;
}

// Clear all markers from the map
function clearMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
}

// Update the POI list in the sidebar
function updatePOIList(pois) {
    const poiList = document.getElementById("poi-list");
    poiList.innerHTML = '';
    
    if (pois.length === 0) {
        poiList.innerHTML = '<p class="text-muted">No points of interest found.</p>';
        return;
    }
    
    pois.forEach(poi => {
        // Find the marker for this POI to check its visibility state
        const marker = markers.find(m => m.poi_id === poi.id);
        const isVisible = marker ? map.hasLayer(marker) : true;
        
        const poiItem = document.createElement('div');
        poiItem.className = 'poi-item card mb-2';
        poiItem.innerHTML = `
            <div class="card-body py-2">
                <div class="d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">${poi.name}</h6>
                    <div class="d-flex align-items-center">
                        <div class="form-check form-switch me-2">
                            <input class="form-check-input poi-visibility-toggle" type="checkbox" data-poi-id="${poi.id}" ${isVisible ? 'checked' : ''}>
                        </div>
                        <span class="badge bg-secondary">${poi.category || 'Other'}</span>
                    </div>
                </div>
                <div class="mt-2 d-flex justify-content-between">
                    <button class="btn btn-sm btn-outline-primary view-poi-btn" data-poi-id="${poi.id}">View</button>
                    <div>
                        <button class="btn btn-sm btn-outline-secondary edit-list-poi-btn" data-poi-id="${poi.id}">Edit</button>
                        <button class="btn btn-sm btn-outline-danger delete-list-poi-btn" data-poi-id="${poi.id}">Delete</button>
                    </div>
                </div>
            </div>
        `;
        
        poiList.appendChild(poiItem);
        
        // Add event listeners
        poiItem.querySelector(`.view-poi-btn[data-poi-id="${poi.id}"]`).addEventListener('click', () => {
            viewPOI(poi.id);
        });
        
        poiItem.querySelector(`.edit-list-poi-btn[data-poi-id="${poi.id}"]`).addEventListener('click', () => {
            editPOI(poi.id);
        });
        
        poiItem.querySelector(`.delete-list-poi-btn[data-poi-id="${poi.id}"]`).addEventListener('click', () => {
            deletePOI(poi.id);
        });
        
        // Add event listener for individual visibility toggle
        poiItem.querySelector(`.poi-visibility-toggle[data-poi-id="${poi.id}"]`).addEventListener('change', (e) => {
            toggleSingleMarkerVisibility(poi.id, e.target.checked);
        });
    });
}

// Save (create or update) a POI
function savePOI(event) {
    event.preventDefault();
    
    const poiId = document.getElementById("poi-id").value;
    const name = document.getElementById("poi-name").value;
    const latitude = parseFloat(document.getElementById("poi-latitude").value);
    const longitude = parseFloat(document.getElementById("poi-longitude").value);
    const category = document.getElementById("poi-category").value;
    const description = document.getElementById("poi-description").value;
    
    if (!name || !latitude || !longitude) {
        alert("Please provide a name and select a location on the map.");
        return;
    }
    
    const poiData = {
        name: name,
        latitude: latitude,
        longitude: longitude,
        category: category,
        description: description
    };
    
    let url = '/api/pois';
    let method = 'POST';
    
    // If POI ID exists, update instead of create
    if (poiId) {
        url += `/${poiId}`;
        method = 'PUT';
    }
    
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(poiData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Clear form and temporary marker
        document.getElementById("poi-form").reset();
        document.getElementById("poi-id").value = "";
        
        if (selectedMarker) {
            map.removeLayer(selectedMarker);
            selectedMarker = null;
        }
        
        // Exit edit mode
        editMode = false;
        document.getElementById("save-poi-btn").textContent = "Save POI";
        document.getElementById("cancel-edit-btn").style.display = "none";
        
        // Reload POIs to refresh the map and list
        loadPOIs();
    })
    .catch(error => {
        console.error('Error saving POI:', error);
        alert('Failed to save the point of interest. Please try again.');
    });
}

// View a POI (center map and open popup)
function viewPOI(poiId) {
    const marker = markers.find(m => m.poi_id === poiId);
    
    if (marker) {
        // Center map on the POI
        map.setView(marker.getLatLng(), 16);
        
        // Open the popup
        marker.openPopup();
        
        // Add travel times functionality
        setTimeout(() => {
            // Get the POI data to access properties
            fetch(`/api/pois/${poiId}`)
                .then(response => response.json())
                .then(poi => {
                    // Show isochrones
                    clearIsochrones();
                    fetchAndDisplayIsochrones(poi.latitude, poi.longitude);
                    
                    // Add travel time button if not already present
                    const popupContent = document.querySelector('.leaflet-popup-content');
                    if (popupContent && !popupContent.querySelector('.travel-time-btn')) {
                        const travelTimeBtn = document.createElement('button');
                        travelTimeBtn.className = 'btn btn-sm btn-info mt-2 travel-time-btn';
                        travelTimeBtn.innerHTML = 'Show Travel Times';
                        travelTimeBtn.addEventListener('click', () => {
                            fetchAndDisplayIsochrones(poi.latitude, poi.longitude);
                        });
                        popupContent.appendChild(travelTimeBtn);
                    }
                })
                .catch(error => console.error('Error fetching POI:', error));
        }, 300);
    }
}

// Edit a POI
function editPOI(poiId) {
    editMode = true;
    
    // Get POI details
    fetch(`/api/pois/${poiId}`)
        .then(response => response.json())
        .then(poi => {
            // Populate form with POI data
            document.getElementById("poi-id").value = poi.id;
            document.getElementById("poi-name").value = poi.name;
            document.getElementById("poi-latitude").value = poi.latitude;
            document.getElementById("poi-longitude").value = poi.longitude;
            document.getElementById("poi-category").value = poi.category || 'Other';
            document.getElementById("poi-description").value = poi.description || '';
            
            // Show temporary marker at POI location
            if (selectedMarker) {
                map.removeLayer(selectedMarker);
            }
            
            const blueIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });
            
            selectedMarker = L.marker([poi.latitude, poi.longitude], {icon: blueIcon}).addTo(map);
            
            // Center map on the POI
            map.setView([poi.latitude, poi.longitude], 16);
            
            // Update UI for edit mode
            document.getElementById("save-poi-btn").textContent = "Update POI";
            document.getElementById("cancel-edit-btn").style.display = "inline-block";
        })
        .catch(error => {
            console.error('Error fetching POI details:', error);
            alert('Failed to load POI details for editing.');
        });
}

// Cancel editing
function cancelEdit() {
    editMode = false;
    
    // Clear form
    document.getElementById("poi-form").reset();
    document.getElementById("poi-id").value = "";
    
    // Remove temporary marker
    if (selectedMarker) {
        map.removeLayer(selectedMarker);
        selectedMarker = null;
    }
    
    // Update UI
    document.getElementById("save-poi-btn").textContent = "Save POI";
    document.getElementById("cancel-edit-btn").style.display = "none";
}

// Delete a POI
function deletePOI(poiId) {
    if (!confirm("Are you sure you want to delete this point of interest?")) {
        return;
    }
    
    fetch(`/api/pois/${poiId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // If we were editing this POI, cancel edit mode
        if (editMode && document.getElementById("poi-id").value == poiId) {
            cancelEdit();
        }
        
        // Reload POIs to refresh the map and list
        loadPOIs();
    })
    .catch(error => {
        console.error('Error deleting POI:', error);
        alert('Failed to delete the point of interest. Please try again.');
    });
}

// Filter POIs based on search input
function filterPOIs() {
    const searchText = document.getElementById("poi-search").value.toLowerCase();
    
    fetch('/api/pois')
        .then(response => response.json())
        .then(pois => {
            const filteredPOIs = pois.filter(poi => {
                return poi.name.toLowerCase().includes(searchText) || 
                       (poi.category && poi.category.toLowerCase().includes(searchText)) ||
                       (poi.description && poi.description.toLowerCase().includes(searchText));
            });
            
            updatePOIList(filteredPOIs);
        })
        .catch(error => console.error('Error filtering POIs:', error));
}

// Clear all isochrone layers
function clearIsochrones() {
    isochroneLayers.forEach(layer => map.removeLayer(layer));
    isochroneLayers = [];
}

// Fetch and display isochrones
function fetchAndDisplayIsochrones(lat, lng) {
    // Show loading message
    console.log("Fetching isochrones for", lat, lng);
    
    // Fetch isochrones from API
    fetch(`/api/isochrones?origin_lat=${lat}&origin_lng=${lng}`)
        .then(response => response.json())
        .then(data => {
            // Check if we got valid GeoJSON
            if (data.type === 'FeatureCollection' && data.features) {
                // Clear existing isochrones
                clearIsochrones();
                
                // Add temporary marker at isochrone center
                const centerMarker = L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: 'isochrone-center-marker',
                        html: '<div style="background-color: red; width: 10px; height: 10px; border-radius: 50%;"></div>',
                        iconSize: [10, 10],
                        iconAnchor: [5, 5]
                    })
                }).addTo(map);
                isochroneLayers.push(centerMarker);
                
                // Add each isochrone to the map
                data.features.forEach(feature => {
                    // Create and style the layer
                    const color = feature.properties.color || '#2c7bb6';
                    const isoLayer = L.geoJSON(feature, {
                        style: function() {
                            return {
                                color: color,
                                fillColor: color,
                                fillOpacity: 0.2,
                                weight: 2,
                                opacity: 0.7
                            };
                        }
                    }).addTo(map);
                    
                    // Add tooltip with time information
                    const timeMinutes = feature.properties.time_minutes || Math.round(feature.properties.value / 60);
                    isoLayer.bindTooltip(`${timeMinutes} minutes`, {
                        permanent: false,
                        direction: 'center',
                        className: 'isochrone-tooltip'
                    });
                    
                    // Store for later removal
                    isochroneLayers.push(isoLayer);
                });
                
                // Fit map to the isochrones
                if (isochroneLayers.length > 0) {
                    const group = L.featureGroup(isochroneLayers);
                    map.fitBounds(group.getBounds());
                }
            } else {
                console.error('Invalid isochrone data:', data);
                
                if (data.message) {
                    alert('Error getting isochrones: ' + data.message);
                }
            }
        })
        .catch(error => {
            console.error('Error fetching isochrones:', error);
            alert('Failed to load isochrones. Please check your API key and try again.');
        });
}

// Show/hide loading indicator
function showLoading(show) {
    let loader = document.getElementById('map-loader');
    
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'map-loader';
        loader.className = 'map-loader';
        loader.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
        loader.style.position = 'absolute';
        loader.style.top = '50%';
        loader.style.left = '50%';
        loader.style.transform = 'translate(-50%, -50%)';
        loader.style.zIndex = '1000';
        loader.style.display = 'none';
        
        document.querySelector('.map-container').appendChild(loader);
    }
    
    loader.style.display = show ? 'block' : 'none';
}

// Add legend for isochrones
function addIsochroneLegend(features) {
    // Remove existing legend
    const existingLegend = document.querySelector('.isochrone-legend');
    if (existingLegend) {
        existingLegend.remove();
    }
    
    // Create new legend
    const legend = document.createElement('div');
    legend.className = 'isochrone-legend';
    legend.style.position = 'absolute';
    legend.style.bottom = '20px';
    legend.style.right = '20px';
    legend.style.backgroundColor = 'white';
    legend.style.padding = '10px';
    legend.style.borderRadius = '5px';
    legend.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
    legend.style.zIndex = '1000';
    
    // Add title
    const title = document.createElement('div');
    title.textContent = 'Travel Time';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '5px';
    legend.appendChild(title);
    
    // Sort features by time (ascending)
    features.sort((a, b) => {
        const timeA = a.properties.time_minutes || Math.round(a.properties.value / 60);
        const timeB = b.properties.time_minutes || Math.round(b.properties.value / 60);
        return timeA - timeB;
    });
    
    // Add items
    features.forEach(feature => {
        const timeMinutes = feature.properties.time_minutes || Math.round(feature.properties.value / 60);
        const color = feature.properties.color || '#2c7bb6';
        
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.marginBottom = '5px';
        
        const colorBox = document.createElement('div');
        colorBox.style.width = '15px';
        colorBox.style.height = '15px';
        colorBox.style.backgroundColor = color;
        colorBox.style.marginRight = '5px';
        
        const label = document.createElement('span');
        label.textContent = `${timeMinutes} minutes`;
        
        item.appendChild(colorBox);
        item.appendChild(label);
        legend.appendChild(item);
    });
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'btn btn-sm btn-outline-secondary mt-2';
    closeButton.textContent = 'Close';
    closeButton.style.display = 'block';
    closeButton.style.marginLeft = 'auto';
    closeButton.addEventListener('click', function() {
        legend.remove();
        clearIsochrones();
    });
    legend.appendChild(closeButton);
    
    // Add to map
    document.querySelector('.map-container').appendChild(legend);
}

// Call init when page loads
document.addEventListener('DOMContentLoaded', initMap);

function searchFoursquareLocations(query, lat, lng) {
    const options = {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Authorization: FOURSQUARE_API_KEY
        }
    };
    
    const radius = 1000; // Search radius in meters
    const url = `https://api.foursquare.com/v3/places/search?query=${query}&ll=${lat},${lng}&radius=${radius}&limit=10`;
    
    fetch(url, options)
        .then(response => response.json())
        .then(data => {
            console.log('Foursquare results:', data);
            // Process and display the results
            if (data.results && data.results.length > 0) {
                data.results.forEach(place => {
                    // You could create markers or add to a suggestions list
                    console.log(place.name, place.location);
                });
            }
        })
        .catch(err => console.error('Error fetching from Foursquare:', err));
}

// Add this function after the initMap function
function toggleMarkersVisibility(visible) {
    markersVisible = visible;
    
    markers.forEach(marker => {
        if (visible) {
            marker.addTo(map);
        } else {
            map.removeLayer(marker);
        }
    });
}

function toggleSingleMarkerVisibility(poiId, visible) {
    const marker = markers.find(m => m.poi_id === poiId);
    if (marker) {
        if (visible) {
            marker.addTo(map);
        } else {
            map.removeLayer(marker);
        }
    }
}

// Add this function to clear the temporary marker
function clearSelectedMarker() {
    if (selectedMarker && !editMode) {
        map.removeLayer(selectedMarker);
        selectedMarker = null;
        
        // Clear coordinates from form
        document.getElementById("poi-latitude").value = "";
        document.getElementById("poi-longitude").value = "";
    }
}