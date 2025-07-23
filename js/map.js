function initMap() {
  const seattle = { lat: 47.6062, lng: -122.3321 };

  const map = new google.maps.Map(document.getElementById("map"), {
    zoom: 12,
    center: seattle,
    mapId: "4c7179f2bacde60e8ffff06a", // your custom Map ID
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

window.initMap = initMap;
