(function () {
  const key = window.ENV?.GOOGLE_MAPS_KEY;
  if (!key) return console.error("Missing GOOGLE_MAPS_KEY in env.js");

  // Load Maps + Places + Marker libs, then call initMap()
  const url = `https://maps.googleapis.com/maps/api/js?key=${key}&v=weekly&libraries=places,marker&callback=__gmInit`;

  const s = document.createElement("script");
  s.src = url;
  s.async = true;
  s.defer = true;
  s.onerror = () => {
    const div = document.getElementById("map");
    if (div)
      div.innerHTML =
        "<p style='color:red;text-align:center'>Failed to load Google Maps</p>";
  };
  document.head.appendChild(s);

  window.__gmInit = () => {
    // call your initMap after the libs are ready
    if (typeof window.initMap === "function") window.initMap();
  };
})();
