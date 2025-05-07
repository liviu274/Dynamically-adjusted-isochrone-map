const map = L.map('map').setView([45.76, 21.23], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

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
    const fetchAndDisplayIsochrones = (lat, lng) => {
        fetch(`/api/isochrones?origin_lat=${lat}&origin_lng=${lng}`)
            .then(response => response.json())
            .then(data => {
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
                    });
                    isochronesShowing = true; // Set flag when isochrones are displayed
                }
            })
            .catch(error => {
                console.error('Error fetching isochrones:', error);
                showToast('Failed to load travel times. Please try again.');
            });
    };
    
    // sterge izocronii
    const isochroneLayers = [];
    const clearIsochrones = () => {
        isochroneLayers.forEach(layer => map.removeLayer(layer));
        isochroneLayers.length = 0;
        isochronesShowing = false; 
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

        const minutes = parseInt(document.getElementById('time-range').value);
        const radius = minutes * 100;

        isochroneCircle = L.circle([lat, lng], {
            radius,
            color: '#00ffa3',
            fillColor: '#00ffa3',
            fillOpacity: 0.1,
            weight: 2
        }).addTo(map);

        selectedMarker = L.marker([lat, lng]).addTo(map).bindPopup("Selected location").openPopup();
    });


    map.on('contextmenu', function(e) {
        clearIsochrones();
        fetchAndDisplayIsochrones(e.latlng.lat, e.latlng.lng);
    });

    document.getElementById('time-range').addEventListener('input', function () {
        document.getElementById('time-val').textContent = this.value;
    });


    document.getElementById('poi-form').addEventListener('submit', async function (e) {
        e.preventDefault();
    
        const formData = {
            name: document.getElementById('poi-name').value,
            latitude: parseFloat(document.getElementById('poi-latitude').value),
            longitude: parseFloat(document.getElementById('poi-longitude').value),
            category: document.getElementById('poi-category').value,
            description: document.getElementById('poi-description').value
        };
    
        try {
            const url = editingItem ? `/api/pois/${editingItem}` : '/api/pois';
            const method = editingItem ? 'PUT' : 'POST';
            
            // le pune in bd ul meu
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
    
            if (!response.ok) throw new Error('Network response was not ok');
            
            const savedPOI = await response.json();
            
            if (editingItem) {
                // da update la marker
                const existingMarker = markers.find(m => m.poi_id === editingItem);
                if (existingMarker) {
                    map.removeLayer(existingMarker);
                    markers = markers.filter(m => m.poi_id !== editingItem);
                }
                
                // update la elem din side bar
                const sidebarItem = document.querySelector(`.poi-item button[data-id="${editingItem}"]`).closest('.poi-item');
                if (sidebarItem) {
                    sidebarItem.remove();
                }
            }
    
            const marker = createMarker(savedPOI);
            marker.poi_id = savedPOI.id_poi;
            markers.push(marker);
            addToSidebar(savedPOI);
            
            
            // reset
            document.getElementById('poi-form').reset();
            if (selectedMarker) {
                map.removeLayer(selectedMarker);
                selectedMarker = null;
            }
            if (isochroneCircle) {
                map.removeLayer(isochroneCircle);
                isochroneCircle = null;
            }

            // reset buton
            document.getElementById('poi-latitude').value = '';
            document.getElementById('poi-longitude').value = '';
            const submitBtn = document.querySelector('#poi-form button[type="submit"]');
            submitBtn.innerHTML = '<i class="bi bi-plus-lg me-2"></i>Save Location';
            
            // reset mod de editare
            editingItem = null;

            // reactiveaza click pe harta
            map.off('click');
            map.on('click', (e) => {
                const { lat, lng } = e.latlng;
                document.getElementById('poi-latitude').value = lat.toFixed(6);
                document.getElementById('poi-longitude').value = lng.toFixed(6);
                
                if (selectedMarker) {
                    map.removeLayer(selectedMarker);
                }
                selectedMarker = L.marker([lat, lng])
                    .addTo(map)
                    .bindPopup("Selected location")
                    .openPopup();
            });
            // this.reset();
            // clearSelectedMarker();
            // editingItem = null;
            // const submitBtn = document.querySelector('#poi-form button[type="submit"]');
            // submitBtn.innerHTML = '<i class="bi bi-plus-lg me-2"></i>Save Location';
            
            showToast(editingItem ? "Location updated successfully!" : "Location saved successfully!");
            
        } catch (error) {
            console.error('Error:', error);
            showToast(editingItem ? "Error updating location!" : "Error saving location!");
        }
    });
    
    function createMarker(poi) {
        const popupContent = `
            <div>
                <strong>${poi.name}</strong><br>
                <small>${poi.category}</small><br>
                ${poi.description}
                <div class="mt-2">
                    <button class="btn-travel-time travel-time-btn" 
                            data-lat="${poi.latitude}" 
                            data-lng="${poi.longitude}">
                        <i class="bi bi-clock-fill me-1"></i>Show Travel Times
                    </button>
                </div>
            </div>
        `;
    
        const marker = L.marker([poi.latitude, poi.longitude]).addTo(map).bindPopup(popupContent);
        marker.poi_id = poi.id_poi;
        
        return marker;
    }
    
    function addToSidebar(poi) {
        const item = document.createElement('div');
        item.className = 'poi-item';
        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <strong>${poi.name}</strong><br>
                    <small><i class="bi bi-tag-fill me-1"></i>${poi.category}</small>
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-light btn-edit" data-id="${poi.id_poi}">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${poi.id_poi}">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </div>
            </div>
        `;
    
        document.getElementById('poi-list').appendChild(item);
    }


    async function loadSavedLocations() {
        try {
            const response = await fetch('/api/pois');
            const pois = await response.json();
            
            pois.forEach(poi => {
                const marker = createMarker(poi);
                markers.push(marker);
                addToSidebar(poi);
            });
        } catch (error) {
            console.error('Error loading saved locations:', error);
            showToast("Error loading saved locations!");
        }
    }
    
    document.getElementById('poi-list').addEventListener('click', async function(e) {
        // butonul de delete
        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn) {
            const id = parseInt(deleteBtn.dataset.id);
            try {
                const response = await fetch(`/api/pois/${id}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    // sterge markerul din side bar si de pe harta
                    const marker = markers.find(m => m.poi_id === id);
                    if (marker) {
                        map.removeLayer(marker);
                        markers = markers.filter(m => m.poi_id !== id);
                    }
                    // deleteBtn.closest('.poi-item').remove();
                    const poiItem = deleteBtn.closest('.poi-item');
                    if (poiItem) {
                        poiItem.remove();
                    }

                    showToast("Location deleted successfully!");
                }
            } catch (error) {
                console.error('Error:', error);
                showToast("Error deleting location!");
            }
        }

        // butonul de edit
        const editBtn = e.target.closest('.btn-edit');
        if (editBtn) {
            const id = parseInt(editBtn.dataset.id);
            try {
                
                const response = await fetch(`/api/pois/${id}`);
                const poi = await response.json();
                
                // pune datele deja existente in formualr
                document.getElementById('poi-name').value = poi.name;
                document.getElementById('poi-latitude').value = poi.latitude;
                document.getElementById('poi-longitude').value = poi.longitude;
                document.getElementById('poi-category').value = poi.category;
                document.getElementById('poi-description').value = poi.description;
                
                // suntem in mod de editare
                editingItem = id;
                
                if (selectedMarker) {
                    map.removeLayer(selectedMarker);
                }
                selectedMarker = L.marker([poi.latitude, poi.longitude])
                    .addTo(map)
                    .bindPopup("Editing location")
                    .openPopup();
                
                // modif textul butonului de submit
                const submitBtn = document.querySelector('#poi-form button[type="submit"]');
                submitBtn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Update Location';
                
                document.querySelector('.controls').scrollIntoView({ behavior: 'smooth' });
                
            } catch (error) {
                console.error('Error:', error);
                showToast("Error loading location for edit!");
            }
        }
    });


    // time range listnere
    document.getElementById('time-range').addEventListener('input', function() {
        document.getElementById('time-val').textContent = this.value;
    });

    // meniu de click dreapta pt izocronii
    map.on('contextmenu', function(e) {
        clearIsochrones();
        fetchAndDisplayIsochrones(e.latlng.lat, e.latlng.lng);
    });

    // face cercul cand dai click pe harta
    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        
        document.getElementById('poi-latitude').value = lat.toFixed(6);
        document.getElementById('poi-longitude').value = lng.toFixed(6);
    
        // sterge marker temporar anterior
        if (selectedMarker) {
            map.removeLayer(selectedMarker);
        }
        if (isochroneCircle) {
            map.removeLayer(isochroneCircle);
        }
    
        // pune marker nou temporar
        selectedMarker = L.marker([lat, lng])
            .addTo(map)
            .bindPopup("Selected location")
            .openPopup();
    
        // cerc in jurul ounctului
        const minutes = parseInt(document.getElementById('time-range').value);
        const radius = minutes * 100;
        isochroneCircle = L.circle([lat, lng], {
            radius,
            color: '#00ffa3',
            fillColor: '#00ffa3',
            fillOpacity: 0.1,
            weight: 2
        }).addTo(map);
    });


    function clearSelectedMarker() {
        if (selectedMarker) {
            map.removeLayer(selectedMarker);
            selectedMarker = null;
        }
        
        if (isochroneCircle) {
            map.removeLayer(isochroneCircle);
            isochroneCircle = null;
        }
        
        if (window.isochroneCircle) {
            map.removeLayer(window.isochroneCircle);
            window.isochroneCircle = null;
        }
        
        // Clear form coordinates only if we're not editing
        if (!editingItem) {
            document.getElementById('poi-latitude').value = '';
            document.getElementById('poi-longitude').value = '';
        }
    }

    // function resetForm() {
    //     document.getElementById('poi-form').reset();
    //     clearSelectedMarker();
    //     editingItem = null;
    // }

    // function clearSelectedMarker() {
    //     if (selectedMarker && !editingItem) {
    //         console.log('Clearing temporary marker');
            
    //         // Remove the marker
    //         map.removeLayer(selectedMarker);
    //         selectedMarker = null;
            
    //         // Also remove the circle
    //         if (isochroneCircle) {
    //             console.log('Clearing temporary circle');
    //             map.removeLayer(isochroneCircle);
    //             isochroneCircle = null;
    //         }
            
    //         // Also clear any window.isochroneCircle (from the second click handler)
    //         if (window.isochroneCircle) {
    //             console.log('Clearing window circle');
    //             map.removeLayer(window.isochroneCircle);
    //             window.isochroneCircle = null;
    //         }
            
    //         // Also clear isochrones created by right-click
    //         clearIsochrones();
            
    //         // Clear coordinates from form
    //         document.getElementById('poi-latitude').value = '';
    //         document.getElementById('poi-longitude').value = '';
    //     }
    // }

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

        loadSavedLocations();
    });