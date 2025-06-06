// Rate limit error function - must be defined before fetchAndDisplayIsochrones
function showRateLimitError(errorMessage = '') {
    // Log to console for debugging
    console.error(`API Rate limit exceeded: ${errorMessage}`);
    
    const errorElement = document.getElementById('rate-limit-error');
    if (!errorElement) {
        console.error('Rate limit error element not found');
        showToast('API rate limit exceeded. Please wait before making more requests.');
        return;
    }
    
    // Create countdown timer element
    let secondsLeft = 60;
    
    // Update error message with countdown and actual error if available
    const messageSpan = errorElement.querySelector('.alert-content span');
    if (messageSpan) {
        let message = `API rate limit exceeded. Please wait <span class="countdown-timer">${secondsLeft}</span> seconds before making more requests.`;
        
        // Add API-specific message if available
        if (errorMessage && errorMessage.length > 0) {
            message += `<br><small class="text-muted">${errorMessage}</small>`;
        }
        
        messageSpan.innerHTML = message;
    }
    
    // Apply fade-in animation
    errorElement.style.opacity = '0';
    errorElement.classList.remove('d-none');
    void errorElement.offsetWidth;
    errorElement.style.transition = 'opacity 0.5s ease-in-out';
    errorElement.style.opacity = '1';
    
    // Clear existing interval if there is one
    if (errorElement.dataset.intervalId) {
        clearInterval(parseInt(errorElement.dataset.intervalId));
    }
    
    // Start countdown
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
    
    // Add event listener to dismiss button
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
    let markers = []; // Array to track all POI markers
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

    // Function to fetch and display isochrones
    const fetchAndDisplayIsochrones = (lat, lng, customTimeMinutes = null) => {
        // Show loading indicator
        showToast("Loading isochrones...");
        
        // Initialize time ranges based on context
        let timeRanges = [5]; // Default for right-click: just one 5-min isochrone (changed from 10)
        let isCustomRequest = false;
        
        if (customTimeMinutes) {
            // This is a request from "Show Travel Times" button
            const requestedTime = parseInt(customTimeMinutes);
            // Show two isochrones - half the time and full time
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
                    
                    // Directly check for any rate limiting or quota errors - more comprehensive
                    if (response.status === 429 || response.status === 403) {
                        showRateLimitError();
                        throw new Error(`Rate limit exceeded (${response.status})`);
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Check if the response contains an error message about rate limiting
                if (data.status === 'error' && data.message && 
                    (data.message.toLowerCase().includes('rate') || 
                     data.message.toLowerCase().includes('limit') || 
                     data.message.toLowerCase().includes('quota'))) {
                    showRateLimitError();
                    throw new Error('API rate limit detected in response');
                }
                
                clearIsochrones();
                
                if (data.features) {
                    // For custom requests (Show Travel Times button), process features in reverse order
                    // so that smaller isochrone appears on top
                    let processFeatures = [...data.features];
                    
                    if (isCustomRequest && processFeatures.length > 1) {
                        // Process in reverse order (outer first, inner last)
                        processFeatures.reverse();
                    }
                    
                    // Process each isochrone feature
                    processFeatures.forEach((feature, index) => {
                        // Customize colors based on context
                        let color;
                        
                        if (isCustomRequest) {
                            // For "Show Travel Times": Purple for inner, Red for outer
                            // Since we reversed the array, we need to flip the index check
                            const originalIndex = isCustomRequest ? (processFeatures.length - 1 - index) : index;
                            color = originalIndex === 0 ? "#8a2be2" : "#ff0000"; // Purple for first, Red for second
                        } else {
                            // For right-click: Just one purple isochrone
                            color = "#8a2be2"; // Purple
                        }
                        
                        // Get time in minutes for tooltip
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
                        
                        // Add mouseover/mouseout events for better UX
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
                    
                    // Make sure the inner isochrone is displayed on top
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
                
                // Expanded error message detection - make this more comprehensive
                const errorMsg = error.message ? error.message.toLowerCase() : '';
                if (errorMsg.includes('rate') || 
                    errorMsg.includes('limit') || 
                    errorMsg.includes('429') || 
                    errorMsg.includes('quota') ||
                    errorMsg.includes('exceeded')) {
                    console.log('Rate limit error detected - showing error message');
                    showRateLimitError(); // Always call this for any rate-related error
                } else {
                    showToast('Failed to load isochrones. Please try again.');
                }
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

    // Add this after the map initialization code
const bounds = [
    [45.70, 21.15], // Southwest corner
    [45.82, 21.31]  // Northeast corner
];


async function refreshSavedLocations() {
    try {
        // Clear existing sidebar items
        const poiList = document.getElementById('poi-list');
        poiList.innerHTML = '';
        
        // Clear existing markers
        markers.forEach(marker => map.removeLayer(marker));
        markers.length = 0;
        
        // Fetch and re-add all locations
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

// Update the createMarker function to add the marker to the map
function createMarker(location) {
    // Get travel time (default to 10 if not provided)
    const minutes = location.travel_time || 10;
    
    // Create popup content with travel time button
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
    
    // Create the marker
    const marker = L.marker([location.latitude, location.longitude], {
        title: location.name
    }).addTo(map);
    
    // Add the popup with the enhanced content
    marker.bindPopup(popupContent);
    
    // Add event listener to the popup for when it opens
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

// validation when adding POIs
map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    
    // Check if click is within bounds
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
            
        // Add event listener to the popup content after it's opened
        marker.on('popupopen', function() {
            setTimeout(() => {
                const travelTimeBtn = document.querySelector('.travel-time-btn');
                if (travelTimeBtn) {
                    travelTimeBtn.addEventListener('click', function() {
                        const btnLat = parseFloat(this.getAttribute('data-lat'));
                        const btnLng = parseFloat(this.getAttribute('data-lng'));
                        
                        // Get a fresh value from the slider each time
                        const timeSlider = document.getElementById('time-range');
                        const minutes = parseInt(document.getElementById('time-val').textContent, 10);
                        
                        console.log('Travel time button clicked:');
                        console.log('Button lat/lng:', btnLat, btnLng);
                        console.log('Current slider value:', minutes);
                        
                        // Force refresh of the UI before proceeding
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
            // Remove or fix the following line which is incorrect
            // document.getElementById('poi-longitude').value = timeMinutes;

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
                
                // event listener for the travel time button after the popup is opened
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

    // the time range listener 
    document.getElementById('time-range').addEventListener('input', function() {
        document.getElementById('time-val').textContent = this.value;
    });

    // context menu for right-click on map
    map.on('contextmenu', function(e) {
        clearIsochrones();
        // I don't want a second time radious on right-click

        console.log('Right-click context menu:');
        console.log('Coordinates:', e.latlng.lat, e.latlng.lng);
        fetchAndDisplayIsochrones(e.latlng.lat, e.latlng.lng);
    });

document.getElementById('poi-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    const formData = {
        name: document.getElementById('poi-name').value,
        latitude: parseFloat(document.getElementById('poi-latitude').value),
        longitude: parseFloat(document.getElementById('poi-longitude').value),
        category: document.getElementById('poi-category').value,
        description: document.getElementById('poi-description').value,
        // Add travel time from the slider
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
        
        // Refresh locations from server - this will handle both adding new and updating
        await refreshSavedLocations();
        
        // Reset form and UI
        this.reset();
        if (selectedMarker) {
            map.removeLayer(selectedMarker);
            selectedMarker = null;
        }
        if (isochroneCircle) {
            map.removeLayer(isochroneCircle);
            isochroneCircle = null;
        }

        // Reset coordinates and button
        document.getElementById('poi-latitude').value = '';
        document.getElementById('poi-longitude').value = '';
        const submitBtn = document.querySelector('#poi-form button[type="submit"]');
        submitBtn.innerHTML = '<i class="bi bi-plus-lg me-2"></i>Save Location';
        
        // Reset edit mode
        editingItem = null;

        showToast(editingItem ? "Location updated successfully!" : "Location saved successfully!");
        
    } catch (error) {
        console.error('Error:', error);
        showToast(editingItem ? "Error updating location!" : "Error saving location!");
    }
});
    
    function clearSelectedMarker() {
        if (selectedMarker && !editingItem) {
            console.log('Clearing temporary marker');
            
            // remove the marker
            map.removeLayer(selectedMarker);
            selectedMarker = null;
            
            // remove the circle
            if (isochroneCircle) {
                console.log('Clearing temporary circle');
                map.removeLayer(isochroneCircle);
                isochroneCircle = null;
            }
            
            // clear any window.isochroneCircle (from the second click handler)
            if (window.isochroneCircle) {
                console.log('Clearing window circle');
                map.removeLayer(window.isochroneCircle);
                window.isochroneCircle = null;
            }
            
            // clear isochrones created by right-click
            clearIsochrones();
            
            // clear coordinates from form
            document.getElementById('poi-latitude').value = '';
            document.getElementById('poi-longitude').value = '';
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        // escape key handler
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                console.log('Escape key pressed');
                clearSelectedMarker();
                clearJustIsochrones(); 
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
                
                clearJustIsochrones(); // always try to clear isochrones
            }
            
            // handle marker clearing as before
            if (!selectedMarker || editingItem) return;
            
            if (!mapElement.contains(event.target) && 
                !formContainer.contains(event.target) && 
                !sidebar.contains(event.target)) {
                
                console.log('Click outside detected');
                clearSelectedMarker();
            }
        });
        
        
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

    const trafficBadge = document.createElement('div');
    trafficBadge.className = 'traffic-indicator';
    trafficBadge.innerHTML = '<i class="bi bi-car-front"></i> Real-time traffic';
    document.querySelector('.map-container').appendChild(trafficBadge);




function updateBoundsFromPOIs() {
    if (markers.length === 0) return; // no POIs to update from
    
    // all POI coordinates
    const lats = markers.map(marker => marker.getLatLng().lat);
    const lngs = markers.map(marker => marker.getLatLng().lng);
    
    // new bounds with padding
    const padding = 0.02; // aprox 2km padding
    const newBounds = [
        [Math.min(...lats) - padding, Math.min(...lngs) - padding],
        [Math.max(...lats) + padding, Math.max(...lngs) + padding]
    ];
    
    // update the bounds constant
    bounds[0] = newBounds[0];
    bounds[1] = newBounds[1];
    
    // Fit map to new bounds
    // map.fitBounds(boundaryRectangle.getBounds());
    
    showToast("Map boundaries updated based on POIs");
}

let currentSelectedBounds = null; 

function viewSelectedPOIs() {
    // remove previous selection if it exists
    if (currentSelectedBounds) {
        map.removeLayer(currentSelectedBounds);
        currentSelectedBounds = null;
    }

    const checkedBoxes = document.querySelectorAll('.poi-checkbox:checked');
    
    if (checkedBoxes.length === 0) {
        showToast("Please select at least one location");
        return;
    }

    // Hide all markers first
    markers.forEach(marker => {
        marker.setOpacity(0.2);
    });

    // Hide the original orange boundary
    // boundaryRectangle.setStyle({ opacity: 0, fillOpacity: 0 });

    // show only selected markers and collect their coordinates
    const selectedCoords = [];
    checkedBoxes.forEach(checkbox => {
        const lat = parseFloat(checkbox.dataset.lat);
        const lng = parseFloat(checkbox.dataset.lng);
        selectedCoords.push({ lat, lng });
        
        // Find and highlight the corresponding marker
        const marker = markers.find(m => {
            const pos = m.getLatLng();
            return pos.lat === lat && pos.lng === lng;
        });
        if (marker) {
            marker.setOpacity(1);
        }
    });

    // Calculate the center point
    const lats = selectedCoords.map(coord => coord.lat);
    const lngs = selectedCoords.map(coord => coord.lng);
    const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
    const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;

    // Calculate the spread of selected POIs
    const latSpread = Math.max(...lats) - Math.min(...lats);
    const lngSpread = Math.max(...lngs) - Math.min(...lngs);

    // Reduce padding for tighter zoom (changed from 0.5 to 0.2)
    const padding = 0.2;
    const adjustedLatSpread = latSpread * (1 + padding);
    const adjustedLngSpread = lngSpread * (1 + padding);

    // Create new bounds based on the POI spread
    const newBounds = [
        [centerLat - adjustedLatSpread/2, centerLng - adjustedLngSpread/2],
        [centerLat + adjustedLatSpread/2, centerLng + adjustedLngSpread/2]
    ];

    // Create and add the green boundary
    currentSelectedBounds = L.rectangle(newBounds, {
        color: "#4CAF50",
        weight: 3,
        fillOpacity: 0.15,
        dashArray: '10, 15'
    }).addTo(map);

    // Fit map to the new bounds with tighter zoom
    map.flyToBounds(newBounds, {
        margin: [10, 10], // Reduced padding from 30 to 10
        duration: 1.5,
        animate: true,
        maxZoom: 20 // Increased max zoom from 17 to 18
    });

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
            // boundaryRectangle.setStyle({ opacity: 1, fillOpacity: 0.1 });
            if (currentSelectedBounds) {
                map.removeLayer(currentSelectedBounds);
                currentSelectedBounds = null;
            }
            resetButton.remove();
            map.fitBounds(bounds);
        };
        document.querySelector('#map').appendChild(resetButton);
    }

    let captureButton = document.createElement('button');
    captureButton.className = 'btn btn-info position-absolute m-2';
    captureButton.style.zIndex = '1000';
    captureButton.style.right = '150px'; // Increase from 120px to 150px for better spacing
    captureButton.style.top = '10px';
    captureButton.innerHTML = '<i class="bi bi-camera"></i> Capture Map';
    captureButton.onclick = function(e) {
        // Prevent the click event from reaching the map
        e.stopPropagation();
        e.preventDefault();
        
        // Call the capture function
        captureSelectedArea();
    };
    document.querySelector('#map').appendChild(captureButton);
}

// handle the view selected POIs button visibility
function handleViewSelectedButton() {
    const checkedBoxes = document.querySelectorAll('.poi-checkbox:checked');
    let viewSelectedButton = document.querySelector('#view-selected-button');
    
    if (checkedBoxes.length > 0) {
        // create button if it doesn't exist
        if (!viewSelectedButton) {
            viewSelectedButton = document.createElement('button');
            viewSelectedButton.id = 'view-selected-button';
            viewSelectedButton.className = 'btn btn-success mb-3 ms-2';
            viewSelectedButton.innerHTML = '<i class="bi bi-eye-fill"></i> View Selected POIs';
            viewSelectedButton.onclick = viewSelectedPOIs;
            document.querySelector('.controls').prepend(viewSelectedButton);
        }
    } else {
        // remove button if no checkboxes are selected
        if (viewSelectedButton) {
            viewSelectedButton.remove();
        }
    }
}

// capture a screenshot of view selected POIs rectangle
function captureSelectedArea() {
    if (!currentSelectedBounds) {
        showToast("Please select POIs first");
        return;
    }
    
    // create overlay to block map interactions during capture
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
    
    // collect selected POIs coordinates
    const checkedBoxes = document.querySelectorAll('.poi-checkbox:checked');
    const selectedPOIs = Array.from(checkedBoxes).map(checkbox => ({
        lat: parseFloat(checkbox.dataset.lat),
        lng: parseFloat(checkbox.dataset.lng)
    }));
    
    // bounds corners
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
    
    // First, ensure map is properly positioned to the selected area
    map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 15,
        duration: 0.5
    });
    
    // Wait for map rendering to complete
    setTimeout(() => {
        showToast("Capturing map...");
        
        // Close any open popups (like pressing ESC key)
        map.closePopup();
        
        // temporarily hide the green rectangle before capture
        const originalStyle = currentSelectedBounds.options;
        currentSelectedBounds.setStyle({
            opacity: 0,
            fillOpacity: 0
        });
        
        // Hide UI controls that shouldn't be in the screenshot
        const resetButton = document.querySelector('#reset-bounds-button');
        const captureButton = document.querySelector('.btn-info'); // Capture button
        const mapControls = document.querySelector('.leaflet-control-container');
        
        // Hide all Leaflet popups and tooltip elements
        const popups = document.querySelectorAll('.leaflet-popup, .leaflet-tooltip');
        popups.forEach(popup => {
            popup.style.display = 'none';
        });
        
        // Hide UI elements properly
        if (resetButton) resetButton.style.display = 'none';
        if (captureButton) captureButton.style.display = 'none';
        if (mapControls) mapControls.style.display = 'none';
        
        // capture the map
        html2canvas(document.getElementById('map'), {
            useCORS: true,
            allowTaint: true,
            logging: false,
            scale: window.devicePixelRatio || 2,
            backgroundColor: null
        }).then(function(canvas) {
            // get the image data URL
            const imageData = canvas.toDataURL('image/png');
            
            // Send to server with POI coordinates and bounds
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
                // Restore the green rectangle's visibility
                currentSelectedBounds.setStyle(originalStyle);
                
                // Restore UI controls
                if (resetButton) resetButton.style.display = '';
                if (captureButton) captureButton.style.display = '';
                if (mapControls) mapControls.style.display = '';
                
                // Restore popup visibility
                popups.forEach(popup => {
                    popup.style.display = '';
                });
                
                // Remove the interaction blocker
                if (mapOverlay && mapOverlay.parentNode) {
                    mapOverlay.parentNode.removeChild(mapOverlay);
                }
            });
        }).catch(function(error) {
            console.error("Screenshot error:", error);
            showToast("Failed to capture screenshot");
            
            // Restore the green rectangle's visibility
            currentSelectedBounds.setStyle(originalStyle);
            
            // Restore UI controls
            if (resetButton) resetButton.style.display = '';
            if (captureButton) captureButton.style.display = '';
            if (mapControls) mapControls.style.display = '';
            
            // Restore popup visibility
            popups.forEach(popup => {
                popup.style.display = '';
            });
            
            // Remove the interaction blocker
            if (mapOverlay && mapOverlay.parentNode) {
                mapOverlay.parentNode.removeChild(mapOverlay);
            }
        });
    }, 1000); // wait 1 second for map rendering to complete
}



// Make items clickable to focus on map
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


// search bar
function initializeSearch() {
    const searchInput = document.getElementById('location-search');
    const filterBtn = document.getElementById('filterButton');
    const dropdown = document.getElementById('categoryDropdown');
    let currentCategory = 'all';
    let currentTime = 'all';

    // Toggle dropdown
    filterBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!dropdown.contains(e.target) && !filterBtn.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    // Category selection
    document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            
            // Update active state
            document.querySelectorAll('.category-item').forEach(i => 
                i.classList.remove('active'));
            this.classList.add('active');
            
            // Update current category
            currentCategory = this.dataset.category;
            
            // Trigger search with current filters
            filterItems(searchInput.value.toLowerCase().trim(), currentCategory, currentTime);
        });
    });

    // Time selection
    document.querySelectorAll('.time-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            
            // Update active state
            document.querySelectorAll('.time-item').forEach(i => 
                i.classList.remove('active'));
            this.classList.add('active');
            
            // Update current time filter
            currentTime = this.dataset.time;
            
            // Trigger search with current filters
            filterItems(searchInput.value.toLowerCase().trim(), currentCategory, currentTime);
        });
    });

    // Search input handler
    searchInput.addEventListener('input', function(e) {
        filterItems(e.target.value.toLowerCase().trim(), currentCategory, currentTime);
    });
}

function filterItems(searchTerm, category, time) {
    const poiItems = document.querySelectorAll('#poi-list .poi-item');

    poiItems.forEach(item => {
        const nameElement = item.querySelector('strong');
        const categoryElement = item.querySelector('small');
        
        // Find the corresponding marker for this POI
        const marker = markers.find(m => {
            const itemName = nameElement?.textContent;
            return m.getPopup().getContent().includes(itemName);
        });

        if (nameElement && categoryElement && marker) {
            const name = nameElement.textContent.toLowerCase();
            const itemCategory = categoryElement.textContent.toLowerCase();
            
            // Extract the actual travel time from the marker's popup content
            const popupContent = marker.getPopup().getContent();
            const parser = new DOMParser();
            const doc = parser.parseFromString(popupContent, 'text/html');
            const travelTimeBtn = doc.querySelector('.travel-time-btn');
            
            // Extract time from the button text which contains "(X min)"
            const timeMatch = travelTimeBtn.textContent.match(/\((\d+) min\)/);
            const actualTravelTime = timeMatch ? parseInt(timeMatch[1]) : 0;

            const matchesSearch = name.includes(searchTerm);
            const matchesCategory = category === 'all' || 
                                  itemCategory.includes(category.toLowerCase());
            
            // Time range matching using actual travel time from the POI
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

            // Apply filtering and visual effects
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

// Add this function before refreshSavedLocations
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

    // Add event listeners to the new item
    const checkbox = item.querySelector('.poi-checkbox');
    checkbox.addEventListener('change', handleViewSelectedButton);

    // Delete button
    item.querySelector('.btn-delete').addEventListener('click', async () => {
        try {
            const response = await fetch(`/api/pois/${poi.id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                // Remove from UI
                item.remove();
                
                // Remove marker from map
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

    // Edit button
    item.querySelector('.btn-edit').addEventListener('click', () => {
        document.getElementById('poi-name').value = poi.name;
        document.getElementById('poi-category').value = poi.category || 'Restaurant';
        document.getElementById('poi-description').value = poi.description || '';
        document.getElementById('poi-latitude').value = poi.latitude;
        document.getElementById('poi-longitude').value = poi.longitude;

        // Mark as editing
        editingItem = poi.id;

        // Show on map
        const editMarker = L.marker([poi.latitude, poi.longitude]).addTo(map)
            .bindPopup("Editing location").openPopup();
            
        if (selectedMarker) map.removeLayer(selectedMarker);
        selectedMarker = editMarker;
        
        // Update submit button to indicate editing
        const submitBtn = document.querySelector('#poi-form button[type="submit"]');
        submitBtn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Update Location';
    });

    // Click to view on map
    item.addEventListener('click', (e) => {
        if (!e.target.closest('button') && !e.target.closest('input')) {
            map.setView([poi.latitude, poi.longitude], 16);
            
            // Find the marker for this POI
            const marker = markers.find(m => 
                m.getLatLng().lat === poi.latitude && 
                m.getLatLng().lng === poi.longitude
            );
            
            if (marker) marker.openPopup();
        }
    });

    document.getElementById('poi-list').appendChild(item);
}




