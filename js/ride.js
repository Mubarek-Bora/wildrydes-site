import { Amplify, Auth, API } from "aws-amplify";
import awsmobile from "./aws-exports.js";

// Initialize AWS Amplify before any API/Auth usage
Amplify.configure(awsmobile);

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("rideRequest");
  const pickupInput = document.getElementById("pickup");
  const dropoffInput = document.getElementById("dropoff");

  if (!form || !pickupInput || !dropoffInput) {
    console.error("❌ Missing form or input elements in HTML.");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const pickup = pickupInput.value.trim();
    const dropoff = dropoffInput.value.trim();

    if (!pickup || !dropoff) {
      alert("Please enter both pickup and dropoff locations.");
      return;
    }

    // TODO: Replace with actual coordinates from a geocoding API or map selection
    const requestBody = {
      PickupLocation: {
        Latitude: 47.6062, // Placeholder (Seattle)
        Longitude: -122.3321,
      },
      // Optionally add: DropoffLocation, UserId, etc.
    };

    try {
      // Retrieve user's JWT token for API authorization
      const session = await Auth.currentSession();
      const jwtToken = session.getIdToken().getJwtToken();

      const response = await fetch(
        "https://fjvnmxo4z9.execute-api.us-west-2.amazonaws.com/dev/ride",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtToken,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Ride booked:", result);

      // Display ride details to user
      document.getElementById("confirmedPickup").textContent = pickup;
      document.getElementById("confirmedDropoff").textContent = dropoff;
      document.getElementById("estimatedTime").textContent =
        result.Eta || "N/A";
      document.getElementById("driverName").textContent =
        result.Driver?.Name || "N/A";
      document.getElementById("rideInfo").style.display = "block";
    } catch (err) {
      console.error("❌ Error booking ride:", err);
      alert(
        "Something went wrong while booking the ride. Please try again later."
      );
    }
  });
});
