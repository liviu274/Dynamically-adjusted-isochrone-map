// Display error message when API rate limit is exceeded
function showRateLimitError(errorMessage = '') {
    console.error(`API Rate limit exceeded: ${errorMessage}`);
    
    const errorElement = document.getElementById('rate-limit-error');
    if (!errorElement) {
        console.error('Rate limit error element not found');
        showToast('API rate limit exceeded. Please wait before making more requests.');
        return;
    }
    
    // Initialize countdown timer
    let secondsLeft = 60;
    
    // Update error message content
    const messageSpan = errorElement.querySelector('.alert-content span');
    if (messageSpan) {
        let message = `API rate limit exceeded. Please wait <span class="countdown-timer">${secondsLeft}</span> seconds before making more requests.`;
        
        if (errorMessage && errorMessage.length > 0) {
            message += `<br><small class="text-muted">${errorMessage}</small>`;
        }
        
        messageSpan.innerHTML = message;
    }
    
    // Show error with fade-in animation
    errorElement.style.opacity = '0';
    errorElement.classList.remove('d-none');
    void errorElement.offsetWidth;
    errorElement.style.transition = 'opacity 0.5s ease-in-out';
    errorElement.style.opacity = '1';
    
    // Clear existing interval if present
    if (errorElement.dataset.intervalId) {
        clearInterval(parseInt(errorElement.dataset.intervalId));
    }
    
    // Start countdown timer
    const countdownInterval = setInterval(() => {
        secondsLeft--;
        const countdownElement = errorElement.querySelector('.countdown-timer');
        if (countdownElement) countdownElement.textContent = secondsLeft;
        
        if (secondsLeft <= 0) {
            clearInterval(countdownInterval);
            errorElement.style.opacity = '0';
            setTimeout(() => {
                errorElement.classList.add('d-none');
                errorElement.style.opacity = '1';
            }, 500);
        }
    }, 1000);
    
    errorElement.dataset.intervalId = countdownInterval;
    
    // Setup dismiss button handler
    const dismissBtn = errorElement.querySelector('#dismiss-rate-limit');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', function() {
            if (errorElement.dataset.intervalId) {
                clearInterval(parseInt(errorElement.dataset.intervalId));
            }
            errorElement.style.opacity = '0';
            setTimeout(() => {
                errorElement.classList.add('d-none');
                errorElement.style.opacity = '1';
            }, 500);
        });
    }
}

// Initialize map centered on Timișoara
const map = L.map('map').setView([45.76, 21.23], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Configure custom marker icon
    L.Icon.Default.mergeOptions({
        iconUrl: '/static/images/pin.png',
        iconRetinaUrl: '/static/images/pin.png',  
        iconSize: [32, 32],  
        iconAnchor: [16, 32],
        popupAnchor: [0, -32], 
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        shadowSize: [41, 41],
        shadowAnchor: [12, 41]
    });

    // Reset Leaflet icon defaults
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.imagePath = '';
    L.Icon.Default._getIconUrl = L.Icon.Default.prototype._getIconUrl;

    // Global state variables
    let isochroneCircle = null;
    let selectedMarker = null;
    let markers = []; 
    let editingItem = null;
    let isochronesShowing = false;

    // Display toast notification
    const showToast = (msg) => {
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = "toast";
        toast.innerHTML = `<i class="bi bi-check-circle-fill me-2"></i>${msg}`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };

    // Fetch and render isochrones on the map
    const fetchAndDisplayIsochrones = (lat, lng, customTimeMinutes = null) => {
        showToast("Loading isochrones...");
        
        // Configure time parameters
        let timeRanges = [5]; // Default: 5-minute isochrone
        let isCustomRequest = false;
        
        if (customTimeMinutes) {
            const requestedTime = parseInt(customTimeMinutes);
            timeRanges = [Math.ceil(requestedTime/2), requestedTime];
            isCustomRequest = true;
        }
        
        const params = new URLSearchParams({
            origin_lat: lat,
            origin_lng: lng,
            times: timeRanges.join(','),
            mode: 'driving-car'
        });
        
        fetch(`/api/isochrones?${params}`)
            .then(response => {
                if (!response.ok) {
                    console.error(`API error: ${response.status} - ${response.statusText}`);
                    
                    if (response.status === 429 || response.status === 403) {
                        showRateLimitError();
                        throw new Error(`Rate limit exceeded (${response.status})`);
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Check for rate limit errors in response
                if (data.status === 'error' && data.message && 
                    (data.message.toLowerCase().includes('rate') || 
                     data.message.toLowerCase().includes('limit') || 
                     data.message.toLowerCase().includes('quota'))) {
                    showRateLimitError();
                    throw new Error('API rate limit detected in response');
                }
                
                clearIsochrones();
                
                if (data.features) {
                    let processFeatures = [...data.features];
                    
                    if (isCustomRequest && processFeatures.length > 1) {
                        // Reverse order for custom requests
                        processFeatures.reverse();
                    }
                    
                    // Create layers for each isochrone
                    processFeatures.forEach((feature, index) => {
                        let color;
                        
                        if (isCustomRequest) {
                            const originalIndex = isCustomRequest ? (processFeatures.length - 1 - index) : index;
                            color = originalIndex === 0 ? "#8a2be2" : "#ff0000";
                        } else {
                            color = "#8a2be2";
                        }
                        
                        const minutes = feature.properties.value / 60;
                        
                        const layer = L.geoJSON(feature, {
                            style: {
                                color: color,
                                weight: 2,
                                opacity: 0.8,
                                fillColor: color,
                                fillOpacity: 0.2
                            }
                        })
                        .bindTooltip(`<div class="time-tooltip"><span class="neon-text">${minutes} mins</span></div>`, {
                            permanent: false,
                            direction: 'center',
                            className: 'isochrone-tooltip',
                            opacity: 0.95
                        })
                        .addTo(map);
                        
                        // Add hover effects
                        layer.on('mouseover', function(e) {
                            this.setStyle({
                                fillOpacity: 0.4,
                                weight: 3
                            });
                            this.openTooltip(e.latlng);
                        });
                        
                        layer.on('mouseout', function() {
                            this.setStyle({
                                fillOpacity: 0.2,
                                weight: 2
                            });
                            this.closeTooltip();
                        });
                        
                        isochroneLayers.push(layer);
                    });
                    
                    // Ensure inner isochrone appears on top
                    if (isCustomRequest && isochroneLayers.length > 1) {
                        isochroneLayers[isochroneLayers.length - 1].bringToFront();
                    }
                    
                    isochronesShowing = true;
                    showToast(`Displaying travel time isochrones`);
                } else {
                    showToast("No isochrone data available");
                }
            })
            .catch(error => {
                console.error('Error fetching isochrones:', error);
                
                // Detect rate limit errors in error message
                const errorMsg = error.message ? error.message.toLowerCase() : '';
                if (errorMsg.includes('rate') || 
                    errorMsg.includes('limit') || 
                    errorMsg.includes('429') || 
                    errorMsg.includes('quota') ||
                    errorMsg.includes('exceeded')) {
                    console.log('Rate limit error detected - showing error message');
                    showRateLimitError();
                } else {
                    showToast('Failed to load isochrones. Please try again.');
                }
            });
    };
    
    // Storage and removal of isochrone layers
    const isochroneLayers = [];
    const clearIsochrones = () => {
        isochroneLayers.forEach(layer => map.removeLayer(layer));
        isochroneLayers.length = 0;
        isochronesShowing = false;
    };

    // Clear isochrones only if they exist
    function clearJustIsochrones() {
        if (isochronesShowing) {
            console.log('Clearing only isochrones');
            clearIsochrones();
        }
    }

    // Map boundaries for Timișoara
    const bounds = [
        [45.70, 21.15], // Southwest corner
        [45.82, 21.31]  // Northeast corner
    ];


// Refresh all saved locations from the server
async function refreshSavedLocations() {
    try {
        // Clear existing UI elements
        const poiList = document.getElementById('poi-list');
        poiList.innerHTML = '';
        
        markers.forEach(marker => map.removeLayer(marker));
        markers.length = 0;
        
        // Fetch and display locations
        const response = await fetch('/api/pois');
        const pois = await response.json();
        
        pois.forEach(poi => {
            const marker = createMarker(poi);
            markers.push(marker);
            addToSidebar(poi);
        });
    } catch (error) {
        console.error('Error refreshing locations:', error);
        showToast("Error refreshing locations!");
    }
}

// Create map marker from location data
function createMarker(location) {
    const minutes = location.travel_time || 10;
    
    // Create marker popup content
    const popupContent = `
        <div>
            <strong>${location.name}</strong><br>
            <small>${location.category}</small><br>
            ${location.description || ''}
            <div class="mt-2">
                <button class="btn-travel-time travel-time-btn" 
                        data-lat="${location.latitude}" 
                        data-lng="${location.longitude}"
                        data-time="${minutes}">
                    <i class="bi bi-clock-fill me-1"></i>Show Travel Times (${minutes} min)
                </button>
            </div>
        </div>
    `;
    
    const marker = L.marker([location.latitude, location.longitude], {
        title: location.name
    }).addTo(map);
    
    marker.bindPopup(popupContent);
    
    // Setup event handlers for popup
    marker.on('popupopen', function() {
        setTimeout(() => {
            const travelTimeBtn = document.querySelector('.travel-time-btn');
            if (travelTimeBtn) {
                travelTimeBtn.addEventListener('click', function() {
                    const btnLat = parseFloat(this.getAttribute('data-lat'));
                    const btnLng = parseFloat(this.getAttribute('data-lng'));
                    const minutes = parseInt(this.getAttribute('data-time'), 10);
                    
                    console.log('Travel time button clicked:');
                    console.log('Button lat/lng:', btnLat, btnLng);
                    console.log('Minutes value:', minutes);
                    
                    fetchAndDisplayIsochrones(btnLat, btnLng, minutes);
                });
            } else {
                console.error('Travel time button not found in popup');
            }
        }, 100);
    });
    
    return marker;
}

// Handle map clicks for POI placement
map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    
    // Validate click location against boundaries
    if (lat < bounds[0][0] || lat > bounds[1][0] || 
        lng < bounds[0][1] || lng > bounds[1][1]) {
        showToast("Please select a location within Timișoara city limits");
        return;
    }
    
    document.getElementById('poi-latitude').value = lat;
    document.getElementById('poi-longitude').value = lng;

    if (isochroneCircle) map.removeLayer(isochroneCircle);
    if (selectedMarker) map.removeLayer(selectedMarker);

    selectedMarker = L.marker([lat, lng]).addTo(map).bindPopup("Selected location").openPopup();
});

    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        document.getElementById('poi-latitude').value = lat;
        document.getElementById('poi-longitude').value = lng;

        if (isochroneCircle) map.removeLayer(isochroneCircle);
        if (selectedMarker) map.removeLayer(selectedMarker);

        selectedMarker = L.marker([lat, lng]).addTo(map).bindPopup("Selected location").openPopup();
    });

    // Update time range display when slider changes
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

        
        if (isNaN(lat) || isNaN(lng)) {
            showToast("Please select a valid location on the map first");
            return; // Stop form submission
        }

        const minutes = parseInt(document.getElementById('time-range').value);

        const popupContent = `
            <div>
                <strong>${name}</strong><br>
                <small>${category}</small><br>
                ${desc}
                <div class="mt-2">
                    <button class="btn-travel-time travel-time-btn" 
                            data-lat="${lat}" 
                            data-lng="${lng}"
                            data-time="${minutes}">
                        <i class="bi bi-clock-fill me-1"></i>Show Travel Times (${minutes} min)
                    </button>
                </div>
            </div>
        `;

        const marker = L.marker([lat, lng]).addTo(map)
            .bindPopup(popupContent);
            
        // Setup travel time button in popup
        marker.on('popupopen', function() {
            setTimeout(() => {
                const travelTimeBtn = document.querySelector('.travel-time-btn');
                if (travelTimeBtn) {
                    travelTimeBtn.addEventListener('click', function() {
                        const btnLat = parseFloat(this.getAttribute('data-lat'));
                        const btnLng = parseFloat(this.getAttribute('data-lng'));
                        
                        const timeSlider = document.getElementById('time-range');
                        const minutes = parseInt(document.getElementById('time-val').textContent, 10);
                        
                        console.log('Travel time button clicked:');
                        console.log('Button lat/lng:', btnLat, btnLng);
                        console.log('Current slider value:', minutes);
                        
                        document.getElementById('time-val').textContent = minutes;
                        
                        fetchAndDisplayIsochrones(btnLat, btnLng, minutes);
                    });
                } else {
                    console.error('Travel time button not found in popup');
                }
            }, 100);
        });
            
        markers.push(marker);

        if (isochroneCircle) map.removeLayer(isochroneCircle);

        if (editingItem) {
            editingItem.marker.remove();
            editingItem.element.remove();
        }

        const item = document.createElement('div');
item.className = 'poi-item';
item.innerHTML = `
    <div class="d-flex justify-content-between align-items-start">
        <div class="d-flex align-items-center">
            <input type="checkbox" class="poi-checkbox me-2" data-lat="${lat}" data-lng="${lng}">
            <div>
                <strong>${name}</strong><br>
                <small><i class="bi bi-tag-fill me-1"></i>${category}</small>
            </div>
        </div>
        <div>
            <button class="btn btn-sm btn-outline-light btn-edit"><i class="bi bi-pencil-fill"></i></button>
            <button class="btn btn-sm btn-outline-danger btn-delete"><i class="bi bi-trash-fill"></i></button>
        </div>
    </div>
`;

        const checkbox = item.querySelector('.poi-checkbox');
        checkbox.addEventListener('change', handleViewSelectedButton);

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

            selectedMarker = L.marker([lat, lng]).addTo(map)
                .bindPopup("Editing location").openPopup();

            editingItem = { marker, element: item };
        });

        item.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                map.setView([lat, lng], 16);
                marker.openPopup();
                
                // Setup travel time button
                setTimeout(() => {
                    const travelTimeBtn = document.querySelector('.travel-time-btn');
                    if (travelTimeBtn) {
                        travelTimeBtn.addEventListener('click', function() {
                            const btnLat = parseFloat(this.getAttribute('data-lat'));
                            const btnLng = parseFloat(this.getAttribute('data-lng'));
                            const minutes = parseInt(document.getElementById('time-range').value);
                            fetchAndDisplayIsochrones(btnLat, btnLng, minutes);
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

    // Update time range display when slider changes
    document.getElementById('time-range').addEventListener('input', function() {
        document.getElementById('time-val').textContent = this.value;
    });

    // Handle right-click on map to show isochrones
    map.on('contextmenu', function(e) {
        clearIsochrones();

        console.log('Right-click context menu:');
        console.log('Coordinates:', e.latlng.lat, e.latlng.lng);
        fetchAndDisplayIsochrones(e.latlng.lat, e.latlng.lng);
    });

// Handle POI form submission
document.getElementById('poi-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    const formData = {
        name: document.getElementById('poi-name').value,
        latitude: parseFloat(document.getElementById('poi-latitude').value),
        longitude: parseFloat(document.getElementById('poi-longitude').value),
        category: document.getElementById('poi-category').value,
        description: document.getElementById('poi-description').value,
        travel_time: parseInt(document.getElementById('time-range').value)
    };

    try {
        const url = editingItem ? `/api/pois/${editingItem}` : '/api/pois';
        const method = editingItem ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) throw new Error('Network response was not ok');
        
        // Refresh data from server
        await refreshSavedLocations();
        
        // Reset UI state
        this.reset();
        if (selectedMarker) {
            map.removeLayer(selectedMarker);
            selectedMarker = null;
        }
        if (isochroneCircle) {
            map.removeLayer(isochroneCircle);
            isochroneCircle = null;
        }

        // Reset form fields
        document.getElementById('poi-latitude').value = '';
        document.getElementById('poi-longitude').value = '';
        const submitBtn = document.querySelector('#poi-form button[type="submit"]');
        submitBtn.innerHTML = '<i class="bi bi-plus-lg me-2"></i>Save Location';
        
        editingItem = null;

        showToast(editingItem ? "Location updated successfully!" : "Location saved successfully!");
        
    } catch (error) {
        console.error('Error:', error);
        showToast(editingItem ? "Error updating location!" : "Error saving location!");
    }
});
    
    // Remove selected marker and related elements
    function clearSelectedMarker() {
        if (selectedMarker && !editingItem) {
            console.log('Clearing temporary marker');
            
            map.removeLayer(selectedMarker);
            selectedMarker = null;
            
            if (isochroneCircle) {
                console.log('Clearing temporary circle');
                map.removeLayer(isochroneCircle);
                isochroneCircle = null;
            }
            
            if (window.isochroneCircle) {
                console.log('Clearing window circle');
                map.removeLayer(window.isochroneCircle);
                window.isochroneCircle = null;
            }
            
            clearIsochrones();
            
            document.getElementById('poi-latitude').value = '';
            document.getElementById('poi-longitude').value = '';
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        // Handle Escape key press
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                console.log('Escape key pressed');
                clearSelectedMarker();
                clearJustIsochrones(); 
            }
        });
    
        // Handle clicks outside the map area
        document.addEventListener('mousedown', function(event) {
            const mapElement = document.getElementById('map');
            const formContainer = document.querySelector('.controls');
            const sidebar = document.querySelector('.sidebar');
            
            // Clear isochrones when clicking outside map and controls
            if (!mapElement.contains(event.target) && 
                !formContainer.contains(event.target) && 
                !sidebar.contains(event.target)) {
                
                clearJustIsochrones();
            }
            
            // Skip if no marker selected or if editing
            if (!selectedMarker || editingItem) return;
            
            if (!mapElement.contains(event.target) && 
                !formContainer.contains(event.target) && 
                !sidebar.contains(event.target)) {
                
                console.log('Click outside detected');
                clearSelectedMarker();
            }
        });
        
        
        // Add event listener with cleanup
        function addSafeEventListener(element, event, handler) {
            element.removeEventListener(event, handler);
            element.addEventListener(event, handler);
            console.log(`Event listener '${event}' added to:`, element);
        }

        const timeRangeSlider = document.getElementById('time-range');
        if (timeRangeSlider) {
            const sliderHandler = function() {
                const currentValue = parseInt(this.value);
                console.log('Slider changed to:', currentValue);
                document.getElementById('time-val').textContent = currentValue;
            };
            
            addSafeEventListener(timeRangeSlider, 'input', sliderHandler);
        }

        initializeSearch();
    });

    // Add traffic indicator badge
    const trafficBadge = document.createElement('div');
    trafficBadge.className = 'traffic-indicator';
    trafficBadge.innerHTML = '<i class="bi bi-car-front"></i> Real-time traffic';
    document.querySelector('.map-container').appendChild(trafficBadge);




// Update map boundaries based on POI locations
function updateBoundsFromPOIs() {
    if (markers.length === 0) return;
    
    // Calculate new bounds from marker positions
    const lats = markers.map(marker => marker.getLatLng().lat);
    const lngs = markers.map(marker => marker.getLatLng().lng);
    
    const padding = 0.02; // ~2km padding
    const newBounds = [
        [Math.min(...lats) - padding, Math.min(...lngs) - padding],
        [Math.max(...lats) + padding, Math.max(...lngs) + padding]
    ];
    
    bounds[0] = newBounds[0];
    bounds[1] = newBounds[1];
    
    showToast("Map boundaries updated based on POIs");
}

let currentSelectedBounds = null; 

// View selected POIs with adjusted map bounds
function viewSelectedPOIs() {
    if (currentSelectedBounds) {
        map.removeLayer(currentSelectedBounds);
        currentSelectedBounds = null;
    }

    const checkedBoxes = document.querySelectorAll('.poi-checkbox:checked');
    
    if (checkedBoxes.length === 0) {
        showToast("Please select at least one location");
        return;
    }

    // Dim all markers
    markers.forEach(marker => {
        marker.setOpacity(0.2);
    });

    // Collect and highlight selected POIs
    const selectedCoords = [];
    checkedBoxes.forEach(checkbox => {
        const lat = parseFloat(checkbox.dataset.lat);
        const lng = parseFloat(checkbox.dataset.lng);
        selectedCoords.push({ lat, lng });
        
        const marker = markers.find(m => {
            const pos = m.getLatLng();
            return pos.lat === lat && pos.lng === lng;
        });
        if (marker) {
            marker.setOpacity(1);
        }
    });

    // Calculate view center and bounds
    const lats = selectedCoords.map(coord => coord.lat);
    const lngs = selectedCoords.map(coord => coord.lng);
    const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
    const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;

    const latSpread = Math.max(...lats) - Math.min(...lats);
    const lngSpread = Math.max(...lngs) - Math.min(...lngs);

    const padding = 0.2;
    const adjustedLatSpread = latSpread * (1 + padding);
    const adjustedLngSpread = lngSpread * (1 + padding);

    const newBounds = [
        [centerLat - adjustedLatSpread/2, centerLng - adjustedLngSpread/2],
        [centerLat + adjustedLatSpread/2, centerLng + adjustedLngSpread/2]
    ];

    // Create highlighted area rectangle
    currentSelectedBounds = L.rectangle(newBounds, {
        color: "#4CAF50",
        weight: 3,
        fillOpacity: 0.15,
        dashArray: '10, 15'
    }).addTo(map);

    // Adjust map view
    map.flyToBounds(newBounds, {
        margin: [10, 10],
        duration: 1.5,
        animate: true,
        maxZoom: 20
    });

    // Add reset button if needed
    let resetButton = document.querySelector('#reset-bounds-button');
    if (!resetButton) {
        resetButton = document.createElement('button');
        resetButton.id = 'reset-bounds-button';
        resetButton.className = 'btn btn-warning position-absolute m-2';
        resetButton.style.zIndex = '1000';
        resetButton.style.right = '10px';
        resetButton.style.top = '10px';
        resetButton.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i> Reset View';
        resetButton.onclick = () => {
            markers.forEach(marker => marker.setOpacity(1));
            if (currentSelectedBounds) {
                map.removeLayer(currentSelectedBounds);
                currentSelectedBounds = null;
            }
            resetButton.remove();
            map.fitBounds(bounds);
        };
        document.querySelector('#map').appendChild(resetButton);
    }

    // Add screenshot button
    let captureButton = document.createElement('button');
    captureButton.className = 'btn btn-info position-absolute m-2';
    captureButton.style.zIndex = '1000';
    captureButton.style.right = '150px';
    captureButton.style.top = '10px';
    captureButton.innerHTML = '<i class="bi bi-camera"></i> Capture Map';
    captureButton.onclick = function(e) {
        e.stopPropagation();
        e.preventDefault();
        captureSelectedArea();
    };
    document.querySelector('#map').appendChild(captureButton);
}

// Toggle view selected button based on checkbox state
function handleViewSelectedButton() {
    const checkedBoxes = document.querySelectorAll('.poi-checkbox:checked');
    let viewSelectedButton = document.querySelector('#view-selected-button');
    
    if (checkedBoxes.length > 0) {
        if (!viewSelectedButton) {
            viewSelectedButton = document.createElement('button');
            viewSelectedButton.id = 'view-selected-button';
            viewSelectedButton.className = 'btn btn-success mb-3 ms-2';
            viewSelectedButton.innerHTML = '<i class="bi bi-eye-fill"></i> View Selected POIs';
            viewSelectedButton.onclick = viewSelectedPOIs;
            document.querySelector('.controls').prepend(viewSelectedButton);
        }
    } else {
        if (viewSelectedButton) {
            viewSelectedButton.remove();
        }
    }
}

// Capture screenshot of selected area
function captureSelectedArea() {
    if (!currentSelectedBounds) {
        showToast("Please select POIs first");
        return;
    }
    
    // Create overlay to prevent interactions during capture
    const mapOverlay = document.createElement('div');
    mapOverlay.style.position = 'absolute';
    mapOverlay.style.top = '0';
    mapOverlay.style.left = '0';
    mapOverlay.style.width = '100%';
    mapOverlay.style.height = '100%';
    mapOverlay.style.zIndex = '999';
    mapOverlay.style.cursor = 'wait';
    document.querySelector('#map').appendChild(mapOverlay);
    
    showToast("Preparing map for screenshot...");
    
    // Collect POI data
    const checkedBoxes = document.querySelectorAll('.poi-checkbox:checked');
    const selectedPOIs = Array.from(checkedBoxes).map(checkbox => ({
        lat: parseFloat(checkbox.dataset.lat),
        lng: parseFloat(checkbox.dataset.lng)
    }));
    
    // Get bounds information
    const bounds = currentSelectedBounds.getBounds();
    const corners = {
        northEast: {
            lat: bounds.getNorthEast().lat,
            lng: bounds.getNorthEast().lng
        },
        southWest: {
            lat: bounds.getSouthWest().lat,
            lng: bounds.getSouthWest().lng
        }
    };
    
    // Position map for screenshot
    map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 15,
        duration: 0.5
    });
    
    // Wait for rendering to complete
    setTimeout(() => {
        showToast("Capturing map...");
        
        map.closePopup();
        
        // Hide UI elements during capture
        const originalStyle = currentSelectedBounds.options;
        currentSelectedBounds.setStyle({
            opacity: 0,
            fillOpacity: 0
        });
        
        const resetButton = document.querySelector('#reset-bounds-button');
        const captureButton = document.querySelector('.btn-info');
        const mapControls = document.querySelector('.leaflet-control-container');
        
        const popups = document.querySelectorAll('.leaflet-popup, .leaflet-tooltip');
        popups.forEach(popup => {
            popup.style.display = 'none';
        });
        
        if (resetButton) resetButton.style.display = 'none';
        if (captureButton) captureButton.style.display = 'none';
        if (mapControls) mapControls.style.display = 'none';
        
        // Generate screenshot
        html2canvas(document.getElementById('map'), {
            useCORS: true,
            allowTaint: true,
            logging: false,
            scale: window.devicePixelRatio || 2,
            backgroundColor: null
        }).then(function(canvas) {
            const imageData = canvas.toDataURL('image/png');
            
            // Send to server
            fetch("/save-screenshot", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    imageData: imageData,
                    pois: selectedPOIs,
                    bounds: corners
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    showToast("Screenshot saved on server: " + data.filename);
                } else {
                    showToast("Failed to save screenshot: " + data.error);
                }
            })
            .catch(error => {
                console.error('Error saving screenshot:', error);
                showToast("Failed to save screenshot on server");
            })
            .finally(() => {
                // Restore UI elements
                currentSelectedBounds.setStyle(originalStyle);
                
                if (resetButton) resetButton.style.display = '';
                if (captureButton) captureButton.style.display = '';
                if (mapControls) mapControls.style.display = '';
                
                popups.forEach(popup => {
                    popup.style.display = '';
                });
                
                if (mapOverlay && mapOverlay.parentNode) {
                    mapOverlay.parentNode.removeChild(mapOverlay);
                }
            });
        }).catch(function(error) {
            console.error("Screenshot error:", error);
            showToast("Failed to capture screenshot");
            
            // Restore UI elements
            currentSelectedBounds.setStyle(originalStyle);
            
            if (resetButton) resetButton.style.display = '';
            if (captureButton) captureButton.style.display = '';
            if (mapControls) mapControls.style.display = '';
            
            popups.forEach(popup => {
                popup.style.display = '';
            });
            
            if (mapOverlay && mapOverlay.parentNode) {
                mapOverlay.parentNode.removeChild(mapOverlay);
            }
        });
    }, 1000);
}



// Enable POI list item clicks to focus map
document.getElementById('poi-list').addEventListener('click', function(e) {
    const poiItem = e.target.closest('.poi-item');
    if (poiItem && !e.target.closest('button')) {
        const marker = markers.find(m => {
            const itemName = poiItem.querySelector('strong').textContent;
            const popupContent = m.getPopup().getContent();
            return popupContent.includes(itemName);
        });

        if (marker) {
            map.setView(marker.getLatLng(), 16);
            marker.openPopup();
        }
    }
});


// Initialize search and filtering functionality
function initializeSearch() {
    const searchInput = document.getElementById('location-search');
    const filterBtn = document.getElementById('filterButton');
    const dropdown = document.getElementById('categoryDropdown');
    let currentCategory = 'all';
    let currentTime = 'all';

    // Toggle filter dropdown
    filterBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });

    // Close dropdown on outside click
    document.addEventListener('click', function(e) {
        if (!dropdown.contains(e.target) && !filterBtn.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    // Handle category selection
    document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            
            document.querySelectorAll('.category-item').forEach(i => 
                i.classList.remove('active'));
            this.classList.add('active');
            
            currentCategory = this.dataset.category;
            filterItems(searchInput.value.toLowerCase().trim(), currentCategory, currentTime);
        });
    });

    // Handle time range selection
    document.querySelectorAll('.time-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            
            document.querySelectorAll('.time-item').forEach(i => 
                i.classList.remove('active'));
            this.classList.add('active');
            
            currentTime = this.dataset.time;
            filterItems(searchInput.value.toLowerCase().trim(), currentCategory, currentTime);
        });
    });

    // Search input handler
    searchInput.addEventListener('input', function(e) {
        filterItems(e.target.value.toLowerCase().trim(), currentCategory, currentTime);
    });
}

// Filter POI items based on search criteria
function filterItems(searchTerm, category, time) {
    const poiItems = document.querySelectorAll('#poi-list .poi-item');

    poiItems.forEach(item => {
        const nameElement = item.querySelector('strong');
        const categoryElement = item.querySelector('small');
        
        const marker = markers.find(m => {
            const itemName = nameElement?.textContent;
            return m.getPopup().getContent().includes(itemName);
        });

        if (nameElement && categoryElement && marker) {
            const name = nameElement.textContent.toLowerCase();
            const itemCategory = categoryElement.textContent.toLowerCase();
            
            // Extract travel time from popup
            const popupContent = marker.getPopup().getContent();
            const parser = new DOMParser();
            const doc = parser.parseFromString(popupContent, 'text/html');
            const travelTimeBtn = doc.querySelector('.travel-time-btn');
            
            const timeMatch = travelTimeBtn.textContent.match(/\((\d+) min\)/);
            const actualTravelTime = timeMatch ? parseInt(timeMatch[1]) : 0;

            const matchesSearch = name.includes(searchTerm);
            const matchesCategory = category === 'all' || 
                                  itemCategory.includes(category.toLowerCase());
            
            // Match time range criteria
            let matchesTime = time === 'all';
            if (!matchesTime && actualTravelTime > 0) {
                switch(time) {
                    case '15':
                        matchesTime = actualTravelTime <= 15;
                        console.log(`${name}: ${actualTravelTime} <= 15 = ${matchesTime}`);
                        break;
                    case '30':
                        matchesTime = actualTravelTime > 15 && actualTravelTime <= 30;
                        console.log(`${name}: 15 < ${actualTravelTime} <= 30 = ${matchesTime}`);
                        break;
                    case '45':
                        matchesTime = actualTravelTime > 30 && actualTravelTime <= 45;
                        console.log(`${name}: 30 < ${actualTravelTime} <= 45 = ${matchesTime}`);
                        break;
                    case '60':
                        matchesTime = actualTravelTime > 45 && actualTravelTime <= 60;
                        console.log(`${name}: 45 < ${actualTravelTime} <= 60 = ${matchesTime}`);
                        break;
                }
            }

            // Apply visual filtering effects
            item.style.transition = 'all 0.3s ease';

            const shouldShow = (searchTerm === '' || matchesSearch) && 
                             matchesCategory && 
                             (time === 'all' || matchesTime);

            if (shouldShow) {
                item.style.display = '';
                const isFiltered = searchTerm !== '' || category !== 'all' || time !== 'all';
                item.style.backgroundColor = isFiltered ? 'rgba(0, 255, 163, 0.1)' : '';
                item.style.transform = isFiltered ? 'translateX(5px)' : 'none';
            } else {
                item.style.display = 'none';
                item.style.backgroundColor = '';
                item.style.transform = 'none';
            }
        }
    });
}

// Add POI to sidebar list
function addToSidebar(poi) {
    const item = document.createElement('div');
    item.className = 'poi-item';
    item.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <div class="d-flex align-items-center">
                <input type="checkbox" class="poi-checkbox me-2" data-lat="${poi.latitude}" data-lng="${poi.longitude}">
                <div>
                    <strong>${poi.name}</strong><br>
                    <small><i class="bi bi-tag-fill me-1"></i>${poi.category}</small>
                </div>
            </div>
            <div>
                <button class="btn btn-sm btn-outline-light btn-edit" data-id="${poi.id}"><i class="bi bi-pencil-fill"></i></button>
                <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${poi.id}"><i class="bi bi-trash-fill"></i></button>
            </div>
        </div>
    `;

    // Set up event handlers
    const checkbox = item.querySelector('.poi-checkbox');
    checkbox.addEventListener('change', handleViewSelectedButton);

    // Delete button handler
    item.querySelector('.btn-delete').addEventListener('click', async () => {
        try {
            const response = await fetch(`/api/pois/${poi.id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                item.remove();
                
                const marker = markers.find(m => m.getLatLng().lat === poi.latitude && m.getLatLng().lng === poi.longitude);
                if (marker) map.removeLayer(marker);
                
                showToast("Location deleted");
            } else {
                showToast("Failed to delete location");
            }
        } catch (error) {
            console.error('Error deleting location:', error);
            showToast("Error deleting location");
        }
    });

    // Edit button handler
    item.querySelector('.btn-edit').addEventListener('click', () => {
        document.getElementById('poi-name').value = poi.name;
        document.getElementById('poi-category').value = poi.category || 'Restaurant';
        document.getElementById('poi-description').value = poi.description || '';
        document.getElementById('poi-latitude').value = poi.latitude;
        document.getElementById('poi-longitude').value = poi.longitude;

        editingItem = poi.id;

        const editMarker = L.marker([poi.latitude, poi.longitude]).addTo(map)
            .bindPopup("Editing location").openPopup();
            
        if (selectedMarker) map.removeLayer(selectedMarker);
        selectedMarker = editMarker;
        
        const submitBtn = document.querySelector('#poi-form button[type="submit"]');
        submitBtn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Update Location';
    });

    // Item click handler for map focus
    item.addEventListener('click', (e) => {
        if (!e.target.closest('button') && !e.target.closest('input')) {
            map.setView([poi.latitude, poi.longitude], 16);
            
            const marker = markers.find(m => 
                m.getLatLng().lat === poi.latitude && 
                m.getLatLng().lng === poi.longitude
            );
            
            if (marker) marker.openPopup();
        }
    });

    document.getElementById('poi-list').appendChild(item);
}




