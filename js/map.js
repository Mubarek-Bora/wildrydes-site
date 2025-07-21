function initMap() {
  const seattle = { lat: 47.6062, lng: -122.3321 };
  const map = new google.maps.Map(document.getElementById("map"), {
    zoom: 12,
    center: seattle,
  });

  new google.maps.Marker({
    position: seattle,
    map: map,
    title: "Seattle",
  });
}

// Expose initMap to global
window.initMap = initMap;
