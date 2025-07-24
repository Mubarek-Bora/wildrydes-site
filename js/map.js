/**
 * Dynamically loads the Google Maps JS API.
 * Note: For Place Autocomplete Element, you may eventually want to use the new
 * 'maps/javascript/places#placeautocompleteelement' guide and add a <gmpx-place-autocomplete> in your HTML.
 */
function loadGoogleMapsScript() {
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${window.GOOGLE_MAPS_API_KEY}&callback=initMap&libraries=places`;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

/**
 * Initializes the map centered on Seattle and places a marker.
 * Uses AdvancedMarkerElement if available (recommended by Google),
 * otherwise falls back to the legacy Marker class.
 */
function initMap() {
  const seattle = { lat: 47.6062, lng: -122.3321 };

  // Create map
  const map = new google.maps.Map(document.getElementById("map"), {
    zoom: 12,
    center: seattle,
    mapId: "4c7179f2bacde60e8ffff06a",
  });

  // Use AdvancedMarkerElement if available, else fallback to legacy Marker
  const MarkerClass =
    google.maps.marker && google.maps.marker.AdvancedMarkerElement
      ? google.maps.marker.AdvancedMarkerElement
      : google.maps.Marker;

  // Place marker
  new MarkerClass({
    map,
    position: seattle,
    title: "Seattle",
  });
}

// Expose initMap to the global scope for the Google Maps callback
window.initMap = initMap;

// Load the Google Maps API script
loadGoogleMapsScript();
