/* global WildRydes _config */
import { Auth } from "https://cdn.jsdelivr.net/npm/aws-amplify/+esm";

var WildRydes = window.WildRydes || {};
WildRydes.map = WildRydes.map || {};

(function rideScopeWrapper($) {
  var authToken;

  Auth.currentSession()
    .then((session) => {
      authToken = session.getIdToken().getJwtToken();
    })
    .catch((error) => {
      alert("Not signed in. Redirecting to signin.");
      window.location.href = "/signin.html";
    });

  function requestDriver(pickupLocation) {
    $.ajax({
      method: "POST",
      url: _config.api.invokeUrl + "/ride",
      headers: {
        Authorization: authToken,
      },
      data: JSON.stringify({
        PickupLocation: {
          Latitude: pickupLocation.latitude,
          Longitude: pickupLocation.longitude,
        },
      }),
      contentType: "application/json",
      success: completeRequest,
      error: function ajaxError(jqXHR, textStatus, errorThrown) {
        console.error(
          "Error requesting ride: ",
          textStatus,
          ", Details: ",
          errorThrown
        );
        console.error("Response: ", jqXHR.responseText);
        alert(
          "An error occurred when requesting your driver:\n" +
            jqXHR.responseText
        );
      },
    });
  }

  function completeRequest(result) {
    var driver = result.Driver;
    var pronoun = driver.Gender === "Male" ? "his" : "her";
    displayUpdate(
      driver.Name + ", your " + driver.Vehicle + ", is on " + pronoun + " way."
    );
    animateArrival(function () {
      displayUpdate(driver.Name + " has arrived. Buckle up!");
      WildRydes.map.unsetLocation();
      $("#request").prop("disabled", "disabled").text("Set Pickup");
    });
  }

  $(function onDocReady() {
    $("#request").click(handleRequestClick);
    $(WildRydes.map).on("pickupChange", handlePickupChanged);

    if (!_config.api.invokeUrl) {
      $("#noApiMessage").show();
    }
  });

  function handlePickupChanged() {
    $("#request").text("Request Driver").prop("disabled", false);
  }

  function handleRequestClick(event) {
    event.preventDefault();
    var pickupLocation = WildRydes.map.selectedPoint;
    requestDriver(pickupLocation);
  }

  function animateArrival(callback) {
    var dest = WildRydes.map.selectedPoint;
    var origin = {};

    origin.latitude =
      dest.latitude > WildRydes.map.center.latitude
        ? WildRydes.map.extent.minLat
        : WildRydes.map.extent.maxLat;

    origin.longitude =
      dest.longitude > WildRydes.map.center.longitude
        ? WildRydes.map.extent.minLng
        : WildRydes.map.extent.maxLng;

    WildRydes.map.animate(origin, dest, callback);
  }

  function displayUpdate(text) {
    $("#updates").append($("<li>" + text + "</li>"));
  }
})(jQuery);
