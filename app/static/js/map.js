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
                        
                        // Remove the permanent time label markers - now using tooltips instead
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

const boundaryRectangle = L.rectangle(bounds, {
    color: "#ff7800",
    weight: 2,
    fillOpacity: 0.1,
    dashArray: '5, 10',
});

boundaryRectangle.addTo(map);

// Add validation when adding POIs
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

    // Add context menu for right-click on map
    let lastRequestTime = 0;
    const THROTTLE_TIME = 2000; // 2 seconds

    map.on('contextmenu', function(e) {
        const now = Date.now();
        if (now - lastRequestTime < THROTTLE_TIME) {
            showToast("Please wait before making another request");
            return;
        }
        
        lastRequestTime = now;
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

         // Validate coordinates before proceeding
        if (isNaN(lat) || isNaN(lng)) {
            showToast("Please select a valid location on the map first");
            return; // Stop form submission
        }

        const minutes = parseInt(document.getElementById('time-range').value);

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
                
                // Add event listener for the travel time button after the popup is opened
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

    // Add the time range listener 
    document.getElementById('time-range').addEventListener('input', function() {
        document.getElementById('time-val').textContent = this.value;
    });

    // Add context menu for right-click on map
    map.on('contextmenu', function(e) {
        clearIsochrones();
        // I don't want a second time radious on right-click

        console.log('Right-click context menu:');
        console.log('Coordinates:', e.latlng.lat, e.latlng.lng);
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

      // Add this function after your existing bounds declaration
      function updateBoundsFromPOIs() {
          if (markers.length === 0) return; // No POIs to update from

          // Get all POI coordinates
          const lats = markers.map(marker => marker.getLatLng().lat);
          const lngs = markers.map(marker => marker.getLatLng().lng);

          // Calculate new bounds with padding
          const padding = 0.02; // Approximately 2km padding
          const newBounds = [
              [Math.min(...lats) - padding, Math.min(...lngs) - padding],
              [Math.max(...lats) + padding, Math.max(...lngs) + padding]
          ];

          // Update the boundary rectangle
          if (boundaryRectangle) {
              boundaryRectangle.setBounds(newBounds);
          }

          // Update the bounds constant
          bounds[0] = newBounds[0];
          bounds[1] = newBounds[1];

          // Fit map to new bounds
          map.fitBounds(boundaryRectangle.getBounds());

          showToast("Map boundaries updated based on POIs");
      }

      // Add a button to trigger the update
      const updateBoundsButton = document.createElement('button');
      updateBoundsButton.className = 'btn btn-primary mb-3';
      updateBoundsButton.innerHTML = '<i class="bi bi-arrows-angle-expand"></i> Update Map Bounds';
      updateBoundsButton.onclick = updateBoundsFromPOIs;

      // Add the button to your controls container
      document.querySelector('.controls').prepend(updateBoundsButton);

      // Add this after your existing bounds declaration
      let currentSelectedBounds = null; // Add this at the top with other global variables

      function viewSelectedPOIs() {
          // Remove previous selection if it exists
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
          boundaryRectangle.setStyle({ opacity: 0, fillOpacity: 0 });

          // Show only selected markers and collect their coordinates
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

          // Add reset button
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
                  boundaryRectangle.setStyle({ opacity: 1, fillOpacity: 0.1 });
                  if (currentSelectedBounds) {
                      map.removeLayer(currentSelectedBounds);
                      currentSelectedBounds = null;
                  }
                  resetButton.remove();
                  map.fitBounds(bounds);
              };
              document.querySelector('#map').appendChild(resetButton);
          }
      }

      // Add this function to handle the view selected POIs button visibility
      function handleViewSelectedButton() {
          const checkedBoxes = document.querySelectorAll('.poi-checkbox:checked');
          let viewSelectedButton = document.querySelector('#view-selected-button');

          if (checkedBoxes.length > 0) {
              // Create button if it doesn't exist
              if (!viewSelectedButton) {
                  viewSelectedButton = document.createElement('button');
                  viewSelectedButton.id = 'view-selected-button';
                  viewSelectedButton.className = 'btn btn-success mb-3 ms-2';
                  viewSelectedButton.innerHTML = '<i class="bi bi-eye-fill"></i> View Selected POIs';
                  viewSelectedButton.onclick = viewSelectedPOIs;
                  document.querySelector('.controls').prepend(viewSelectedButton);
              }
          } else {
              // Remove button if no checkboxes are selected
              if (viewSelectedButton) {
                  viewSelectedButton.remove();
              }
          }
      }

      // Modify your POI item creation code to add checkbox event listener
      // Find where you create the POI item and add this after the checkbox HTML:
      // Add this to where you create the poi item in the poi-form submit handler
      // Immediately after creating the item but before adding event listeners:
      if (!item.querySelector('.poi-checkbox')) {
          // Add checkbox to the item if it doesn't exist
          const checkboxDiv = document.createElement('div');
          checkboxDiv.className = 'form-check mb-2';
          checkboxDiv.innerHTML = `
              <input class="form-check-input poi-checkbox" type="checkbox" 
                  data-lat="${lat}" data-lng="${lng}" id="poiCheck${markers.length}">
              <label class="form-check-label" for="poiCheck${markers.length}">
                  Select for group view
              </label>
          `;
          item.insertBefore(checkboxDiv, item.firstChild);
      }
      item.querySelector('.poi-checkbox').addEventListener('change', handleViewSelectedButton);

      // Add a function to safely add event listeners (from main branch)
      function addSafeEventListener(element, event, handler) {
          // First remove any existing listeners of the same type (optional)
          element.removeEventListener(event, handler);
          // Then add the new listener
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

      // Add traffic indicator badge (from main branch)
      const trafficBadge = document.createElement('div');
      trafficBadge.className = 'traffic-indicator';
      trafficBadge.innerHTML = '<i class="bi bi-car-front"></i> Real-time traffic';
      document.querySelector('.map-container').appendChild(trafficBadge);
    // Replace the existing showRateLimitError function
    function showRateLimitError(errorMessage = '') {
        // Log to console for debugging - this ensures console message is always present when error displays
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

    // Update the error handler in fetchAndDisplayIsochrones to be more precise
    function isRateLimitError(error, response) {
        // Check HTTP status code
        if (response && (response.status === 429 || response.status === 403)) {
            return true;
        }
        
        // Check error message text
        const errorText = error.toString().toLowerCase();
        const rateLimitKeywords = ['rate limit', 'too many requests', 'quota exceeded', 'throttled'];
        return rateLimitKeywords.some(keyword => errorText.includes(keyword));
    }

