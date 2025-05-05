// let map;
// let markers = [];
// let currentInfoWindow = null;

// // Initialize the map
// function initMap() {
//     // Default center (adjust as needed)
//     const center = { lat: 51.5074, lng: 0.1278 }; // London
    
//     map = new google.maps.Map(document.getElementById("map"), {
//         zoom: 13,
//         center: center,
//     });
    
//     // Add click listener to map for adding new POIs
//     map.addListener("click", (event) => {
//         const position = event.latLng;
//         document.getElementById("add-poi-form").dataset.lat = position.lat();
//         document.getElementById("add-poi-form").dataset.lng = position.lng();
//     });
    
//     // Load points of interest
//     loadPOIs();
    
//     // Set up form submission
//     document.getElementById("add-poi-form").addEventListener("submit", addNewPOI);
// }

// // Load points of interest from the API
// function loadPOIs() {
//     fetch('/api/pois')
//         .then(response => response.json())
//         .then(data => {
//             // Clear existing markers
//             clearMarkers();
            
//             // Add markers for each POI
//             data.forEach(poi => {
//                 addMarker(poi);
//             });
            
//             // Update the POI list in the sidebar
//             updatePOIList(data);
//         })
//         .catch(error => console.error('Error loading POIs:', error));
// }

// // Add a marker for a point of interest
// function addMarker(poi) {
//     const marker = new google.maps.Marker({
//         position: { lat: poi.latitude, lng: poi.longitude },
//         map: map,
//         title: poi.name
//     });
    
//     // Create info window
//     const infoWindow = new google.maps.InfoWindow({
//         content: `
//             <div>
//                 <h5>${poi.name}</h5>
//                 <p>${poi.description || 'No description'}</p>
//                 <p>Category: ${poi.category || 'Uncategorized'}</p>
//             </div>
//         `
//     });
    
//     // Add click listener
//     marker.addListener("click", () => {
//         if (currentInfoWindow) {
//             currentInfoWindow.close();
//         }
//         infoWindow.open(map, marker);
//         currentInfoWindow = infoWindow;
        
//         // Get travel times from this POI
//         getTravelTimes(poi.latitude, poi.longitude);
//     });
    
//     markers.push(marker);
// }

// // Clear all markers from the map
// function clearMarkers() {
//     markers.forEach(marker => marker.setMap(null));
//     markers = [];
// }

// // Update the POI list in the sidebar
// function updatePOIList(pois) {
//     const poiList = document.getElementById("poi-list");
//     poiList.innerHTML = '';
    
//     pois.forEach(poi => {
//         const poiItem = document.createElement('div');
//         poiItem.className = 'poi-item mb-2';
//         poiItem.innerHTML = `
//             <div class="card">
//                 <div class="card-body">
//                     <h6>${poi.name}</h6>
//                     <span class="badge bg-secondary">${poi.category || 'Uncategorized'}</span>
//                 </div>
//             </div>
//         `;
        
//         poiItem.addEventListener('click', () => {
//             map.setCenter({ lat: poi.latitude, lng: poi.longitude });
//         });
        
//         poiList.appendChild(poiItem);
//     });
// }

// // Add a new POI
// function addNewPOI(event) {
//     event.preventDefault();
    
//     const formData = {
//         name: document.getElementById("name").value,
//         latitude: parseFloat(event.target.dataset.lat),
//         longitude: parseFloat(event.target.dataset.lng),
//         category: document.getElementById("category").value,
//         description: document.getElementById("description").value
//     };
    
//     fetch('/api/pois', {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json'
//         },
//         body: JSON.stringify(formData)
//     })
//     .then(response => response.json())
//     .then(data => {
//         // Clear form
//         event.target.reset();
        
//         // Reload POIs
//         loadPOIs();
//     })
//     .catch(error => console.error('Error adding POI:', error));
// }

// // Get travel times from a point
// function getTravelTimes(lat, lng) {
//     fetch(`/api/travel-times?origin_lat=${lat}&origin_lng=${lng}`)
//         .then(response => response.json())
//         .then(data => {
//             // Visualize travel times (isochrones)
//             visualizeTravelTimes(data);
//         })
//         .catch(error => console.error('Error getting travel times:', error));
// }

// // Visualize travel times on the map
// function visualizeTravelTimes(data) {
//     // This is a placeholder for the isochrone visualization
//     // The actual implementation will depend on the specific API you use
//     console.log("Visualizing travel times", data);
// }

// // Initialize the map when the page loads
// document.addEventListener("DOMContentLoaded", initMap);