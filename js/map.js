// map.js

function loadGoogleMapsScript() {
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${window.GOOGLE_MAPS_API_KEY}&callback=initMap&libraries=places`;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

function initMap() {
  const seattle = { lat: 47.6062, lng: -122.3321 };

  const map = new google.maps.Map(document.getElementById("map"), {
    zoom: 12,
    center: seattle,
    mapId: "4c7179f2bacde60e8ffff06a",
  });

  const MarkerClass =
    (google.maps.marker && google.maps.marker.AdvancedMarkerElement) ||
    google.maps.Marker;

  new MarkerClass({
    map,
    position: seattle,
    title: "Seattle",
  });
}

// Make it global for Google Maps callback
window.initMap = initMap;

// Load the Google Maps API
loadGoogleMapsScript();
