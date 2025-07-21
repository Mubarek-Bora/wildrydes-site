document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("rideRequest");

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const pickup = document.getElementById("pickup").value.trim();
    const dropoff = document.getElementById("dropoff").value.trim();

    if (!pickup || !dropoff) {
      alert("Please enter both pickup and dropoff locations.");
      return;
    }

    // Simulate sending request
    console.log("Ride requested!");
    console.log("Pickup:", pickup);
    console.log("Dropoff:", dropoff);

    alert(`Ride requested from ${pickup} to ${dropoff}!`);
  });
});
