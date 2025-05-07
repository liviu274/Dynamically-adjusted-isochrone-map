const map = L.map('map').setView([45.76, 21.23], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Complete replacement of the default icon settings
    L.Icon.Default.mergeOptions({
        iconUrl: '/static/images/pin.png',
        iconRetinaUrl: '/static/images/pin.png',  // Same image for retina displays
        iconSize: [32, 32],  // Adjust size to match your pin image dimensions
        iconAnchor: [16, 32], // Bottom center of the icon
        popupAnchor: [0, -32], // Popup appears above the icon
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        shadowSize: [41, 41],
        shadowAnchor: [12, 41]
    });

    // Force Leaflet to reload the icon defaults
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.imagePath = '';
    L.Icon.Default._getIconUrl = L.Icon.Default.prototype._getIconUrl;

    let isochroneCircle = null;
    let selectedMarker = null;
    const markers = [];
    let editingItem = null;
    let isochronesShowing = false;

    const showToast = (msg) => {
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = "toast";
        toast.innerHTML = `<i class="bi bi-check-circle-fill me-2"></i>${msg}`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };

<<<<<<< HEAD
    // Function to fetch and display isochrones
    const fetchAndDisplayIsochrones = (lat, lng) => {
        fetch(`/api/isochrones?origin_lat=${lat}&origin_lng=${lng}`)
            .then(response => response.json())
            .then(data => {
=======
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
                            // Get current custom time value
                            const currentCustomTime = parseInt(document.getElementById('time-range').value);
                            fetchAndDisplayIsochrones(poi.latitude, poi.longitude, currentCustomTime);
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
function fetchAndDisplayIsochrones(lat, lng, customTimeMinutes = null) {
    // Show loading message
    console.log("Fetching isochrones for", lat, lng, customTimeMinutes ? `with custom time: ${customTimeMinutes} min` : '');
    
    let request = new XMLHttpRequest();

    request.open('POST', "https://api.openrouteservice.org/v2/isochrones/driving-car");

    request.setRequestHeader('Accept', 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8');
    request.setRequestHeader('Content-Type', 'application/json');
    request.setRequestHeader('Authorization', '5b3ce3597851110001cf6248e0fbfa8c07af43458da778a226442451');

    request.onreadystatechange = function () {
    if (this.readyState === 4) {
        console.log('Status:', this.status);
        console.log('Headers:', this.getAllResponseHeaders());
        console.log('Body:', this.responseText);
    }
    };

    const body = '{"locations":[[8.681495,49.41461]],"range":[300,600,900,2700],"range_type":"time"}';

    request.send(body);
    
    // Fetch isochrones from API
    fetch(request)
        .then(response => response.json())
        .then(data => {
            // Check if we got valid GeoJSON
            if (data.type === 'FeatureCollection' && data.features) {
>>>>>>> 5e4fdd0 (commit for rebase)
                // Clear existing isochrones
                clearIsochrones();
                
                // Add isochrones to map
                if (data.type === 'FeatureCollection' && data.features) {
                    data.features.forEach(feature => {
                        const color = feature.properties.color || '#0088ff';
                        const isoLayer = L.geoJSON(feature, {
                            style: {
                                color: color,
                                fillColor: color,
                                fillOpacity: 0.2,
                                weight: 2,
                                opacity: 0.7
<<<<<<< HEAD
                            }
                        }).addTo(map);
                        
                        // Add tooltip with time information
                        const timeMinutes = feature.properties.time_minutes || Math.round(feature.properties.value / 60);
                        isoLayer.bindTooltip(`${timeMinutes} minutes`, {
                            permanent: false,
                            direction: 'center'
                        });
                        
                        // Store for later removal
                        isochroneLayers.push(isoLayer);
=======
                            };
                        }
                    }).addTo(map);
                    
                    // Add tooltip with time information
                    const timeMinutes = feature.properties.time_minutes || Math.round(feature.properties.value * 60);
                    isoLayer.bindTooltip(`${timeMinutes} minutes`, {
                        permanent: false,
                        direction: 'center',
                        className: 'isochrone-tooltip'
>>>>>>> 5e4fdd0 (commit for rebase)
                    });
                    isochronesShowing = true; // Set flag when isochrones are displayed
                }
            })
            .catch(error => {
                console.error('Error fetching isochrones:', error);
                showToast('Failed to load travel times. Please try again.');
            });
    };
    
    // Clear isochrones
    const isochroneLayers = [];
    const clearIsochrones = () => {
        isochroneLayers.forEach(layer => map.removeLayer(layer));
        isochroneLayers.length = 0;
        isochronesShowing = false; // Reset flag when cleared
    };

    function clearJustIsochrones() {
        if (isochronesShowing) {
            console.log('Clearing only isochrones');
            clearIsochrones();
        }
    }

    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        document.getElementById('poi-latitude').value = lat;
        document.getElementById('poi-longitude').value = lng;

        if (isochroneCircle) map.removeLayer(isochroneCircle);
        if (selectedMarker) map.removeLayer(selectedMarker);

        selectedMarker = L.marker([lat, lng]).addTo(map).bindPopup("Selected location").openPopup();
    });

    // Add context menu for right-click on map
    map.on('contextmenu', function(e) {
        clearIsochrones();
        fetchAndDisplayIsochrones(e.latlng.lat, e.latlng.lng);
    });

    document.getElementById('time-range').addEventListener('input', function () {
        document.getElementById('time-val').textContent = this.value;
    });

    document.getElementById('poi-form').addEventListener('submit', function (e) {
        e.preventDefault();

        const name = document.getElementById('poi-name').value;
        const category = document.getElementById('poi-category').value;
        const desc = document.getElementById('poi-description').value;
        const lat = parseFloat(document.getElementById('poi-latitude').value);
        const lng = parseFloat(document.getElementById('poi-longitude').value);

        const minutes = parseInt(document.getElementById('time-range').value);
        const radius = minutes * 100;

        // Create popup content with travel time button
        const popupContent = `
            <div>
                <strong>${name}</strong><br>
                <small>${category}</small><br>
                ${desc}
                <div class="mt-2">
                    <button class="btn-travel-time travel-time-btn" data-lat="${lat}" data-lng="${lng}">
                        <i class="bi bi-clock-fill me-1"></i>Show Travel Times
                    </button>
                </div>
            </div>
        `;

        const marker = L.marker([lat, lng]).addTo(map)
            .bindPopup(popupContent);
            
        // Add event listener to the popup content after it's opened
        marker.on('popupopen', function() {
            setTimeout(() => {
                const travelTimeBtn = document.querySelector('.travel-time-btn');
                if (travelTimeBtn) {
                    travelTimeBtn.addEventListener('click', function() {
                        const btnLat = parseFloat(this.getAttribute('data-lat'));
                        const btnLng = parseFloat(this.getAttribute('data-lng'));
                        fetchAndDisplayIsochrones(btnLat, btnLng);
                    });
                }
            }, 100);
        });
            
        markers.push(marker);

        if (isochroneCircle) map.removeLayer(isochroneCircle);
        isochroneCircle = L.circle([lat, lng], {
            radius,
            color: '#00ffa3',
            fillColor: '#00ffa3',
            fillOpacity: 0.1,
            weight: 2
        }).addTo(map);

        if (editingItem) {
            editingItem.marker.remove();
            editingItem.element.remove();
        }

        const item = document.createElement('div');
        item.className = 'poi-item';
        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <strong>${name}</strong><br>
                    <small><i class="bi bi-tag-fill me-1"></i>${category}</small>
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-light btn-edit"><i class="bi bi-pencil-fill"></i></button>
                    <button class="btn btn-sm btn-outline-danger btn-delete"><i class="bi bi-trash-fill"></i></button>
                </div>
            </div>
        `;

        item.querySelector('.btn-delete').addEventListener('click', () => {
            marker.remove();
            item.remove();
            if (isochroneCircle) map.removeLayer(isochroneCircle);
            if (selectedMarker) map.removeLayer(selectedMarker);
            showToast("Location deleted");
        });

        item.querySelector('.btn-edit').addEventListener('click', () => {
            document.getElementById('poi-name').value = name;
            document.getElementById('poi-category').value = category;
            document.getElementById('poi-description').value = desc;
            document.getElementById('poi-latitude').value = lat;
            document.getElementById('poi-longitude').value = lng;

            if (isochroneCircle) map.removeLayer(isochroneCircle);
            if (selectedMarker) map.removeLayer(selectedMarker);

            isochroneCircle = L.circle([lat, lng], {
                radius,
                color: '#00ffa3',
                fillColor: '#00ffa3',
                fillOpacity: 0.1,
                weight: 2
            }).addTo(map);

            selectedMarker = L.marker([lat, lng]).addTo(map)
                .bindPopup("Editing location").openPopup();

            editingItem = { marker, element: item };
        });

        item.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                map.setView([lat, lng], 16);
                marker.openPopup();
                
                // Add event listener for the travel time button after the popup is opened
                setTimeout(() => {
                    const travelTimeBtn = document.querySelector('.travel-time-btn');
                    if (travelTimeBtn) {
                        travelTimeBtn.addEventListener('click', function() {
                            const btnLat = parseFloat(this.getAttribute('data-lat'));
                            const btnLng = parseFloat(this.getAttribute('data-lng'));
                            fetchAndDisplayIsochrones(btnLat, btnLng);
                        });
                    }
                }, 100);
            }
        });

        document.getElementById('poi-list').appendChild(item);
        this.reset();
        editingItem = null;

        if (selectedMarker) {
            map.removeLayer(selectedMarker);
            selectedMarker = null;
        }

        showToast("Location saved successfully!");
    });

    // Add the time range listener 
    document.getElementById('time-range').addEventListener('input', function() {
        document.getElementById('time-val').textContent = this.value;
    });

    // Add context menu for right-click on map
    map.on('contextmenu', function(e) {
        clearIsochrones();
        fetchAndDisplayIsochrones(e.latlng.lat, e.latlng.lng);
    });


    function clearSelectedMarker() {
        if (selectedMarker && !editingItem) {
            console.log('Clearing temporary marker');
            
            // Remove the marker
            map.removeLayer(selectedMarker);
            selectedMarker = null;
            
            // Also remove the circle
            if (isochroneCircle) {
                console.log('Clearing temporary circle');
                map.removeLayer(isochroneCircle);
                isochroneCircle = null;
            }
            
            // Also clear any window.isochroneCircle (from the second click handler)
            if (window.isochroneCircle) {
                console.log('Clearing window circle');
                map.removeLayer(window.isochroneCircle);
                window.isochroneCircle = null;
            }
            
            // Also clear isochrones created by right-click
            clearIsochrones();
            
            // Clear coordinates from form
            document.getElementById('poi-latitude').value = '';
            document.getElementById('poi-longitude').value = '';
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        // Escape key handler
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                console.log('Escape key pressed');
                clearSelectedMarker();
                clearJustIsochrones(); // Always try to clear isochrones
            }
        });
    
        // Click outside handler - use mousedown for better detection
        document.addEventListener('mousedown', function(event) {
            // First check if we need to clear isochrones (regardless of marker)
            const mapElement = document.getElementById('map');
            const formContainer = document.querySelector('.controls');
            const sidebar = document.querySelector('.sidebar');
            
            if (!mapElement.contains(event.target) && 
                !formContainer.contains(event.target) && 
                !sidebar.contains(event.target)) {
                
                clearJustIsochrones(); // Always try to clear isochrones
            }
            
            // Then handle marker clearing as before
            if (!selectedMarker || editingItem) return;
            
            if (!mapElement.contains(event.target) && 
                !formContainer.contains(event.target) && 
                !sidebar.contains(event.target)) {
                
                console.log('Click outside detected');
                clearSelectedMarker();
            }
        });
    });