// gm-map.js
window.WildRydes = window.WildRydes || {};
WildRydes.map = WildRydes.map || {};

(function () {
  const wrMap = WildRydes.map;
  let map;
  let pinMarker;
  let movingMarker;

  wrMap.center = {};
  wrMap.extent = {};
  wrMap.selectedPoint = null;

  // Call this after google script loads
  wrMap.init = function initGM(containerId = "map") {
    const defaultCenter = { lat: 47.6, lng: -122.31 }; // Seattle
    map = new google.maps.Map(document.getElementById(containerId), {
      zoom: 12,
      center: defaultCenter,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
    });

    // Track center/extent (approx)
    map.addListener("idle", () => {
      const c = map.getCenter();
      wrMap.center = { latitude: c.lat(), longitude: c.lng() };

      const b = map.getBounds();
      if (b) {
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        wrMap.extent = {
          minLng: sw.lng(),
          minLat: sw.lat(),
          maxLng: ne.lng(),
          maxLat: ne.lat(),
        };
      }
    });

    // Click to set pickup pin
    map.addListener("click", (e) => {
      wrMap.selectedPoint = e.latLng;
      if (pinMarker) pinMarker.setMap(null);
      pinMarker = new google.maps.Marker({
        position: e.latLng,
        map,
        icon: "https://maps.google.com/mapfiles/ms/icons/pink-dot.png",
        title: "Pickup",
      });
      // Trigger the same jQuery event the old code did
      if (window.jQuery) jQuery(wrMap).trigger("pickupChange");
    });
  };

  wrMap.unsetLocation = function () {
    if (pinMarker) pinMarker.setMap(null);
    pinMarker = null;
  };

  wrMap.animate = function (origin, dest, callback) {
    // origin/dest like { latitude, longitude }
    const start = new google.maps.LatLng(origin.latitude, origin.longitude);
    const end = new google.maps.LatLng(dest.latitude, dest.longitude);

    if (movingMarker) movingMarker.setMap(null);
    movingMarker = new google.maps.Marker({
      position: start,
      map,
      icon: "/images/unicorn-icon.png", // or car icon
    });

    const duration = 2000;
    const startTime = performance.now();

    function step(now) {
      const pct = Math.min((now - startTime) / duration, 1);
      const lat = start.lat() + (end.lat() - start.lat()) * pct;
      const lng = start.lng() + (end.lng() - start.lng()) * pct;
      movingMarker.setPosition(new google.maps.LatLng(lat, lng));
      if (pct < 1) {
        requestAnimationFrame(step);
      } else {
        if (callback) callback();
      }
    }
    requestAnimationFrame(step);
  };
})();
