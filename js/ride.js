import { Amplify, Auth, API } from 'aws-amplify';
import awsmobile from './aws-exports.js';

Amplify.configure(awsmobile);

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("rideRequest");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const pickup = document.getElementById("pickup").value.trim();
    const dropoff = document.getElementById("dropoff").value.trim();

    if (!pickup || !dropoff) {
      alert("Please enter both pickup and dropoff locations.");
      return;
    }

    const requestBody = {
      PickupLocation: {
        Latitude: 47.6062, // dummy for now
        Longitude: -122.3321,
      },
    };

    try {
      const response = await fetch(
        "https://fjvnmxo4z9.execute-api.us-west-2.amazonaws.com/dev/ride",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `${(await Auth.currentSession())
              .getIdToken()
              .getJwtToken()}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      const result = await response.json();

      console.log("✅ Ride booked:", result);

      document.getElementById("confirmedPickup").textContent = pickup;
      document.getElementById("confirmedDropoff").textContent = dropoff;
      document.getElementById("estimatedTime").textContent = result.Eta;
      document.getElementById("driverName").textContent = result.Driver?.Name;
      document.getElementById("rideInfo").style.display = "block";
    } catch (err) {
      console.error("❌ Error booking ride:", err);
      alert("Something went wrong while booking the ride.");
    }
  });
});
