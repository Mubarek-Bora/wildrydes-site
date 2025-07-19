import { randomBytes } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

// Fleet of available drivers
const fleet = [
  { Name: "John Mendez", Vehicle: "Toyota Prius", Gender: "Male" },
  { Name: "Sarah Lee", Vehicle: "Honda Civic", Gender: "Female" },
  { Name: "Dave Kim", Vehicle: "Tesla Model 3", Gender: "Male" },
];

// Lambda handler
export const handler = async (event, context) => {
  if (!event.requestContext?.authorizer) {
    return errorResponse("Authorization not configured", context.awsRequestId);
  }

  const rideId = generateRideId();
  console.log(`Received event (${rideId}):`, JSON.stringify(event));

  const username = event.requestContext.authorizer.claims["cognito:username"];
  const requestBody = JSON.parse(event.body);
  const pickupLocation = requestBody.PickupLocation;

  const driver = assignDriver(pickupLocation);

  try {
    await saveRide(rideId, username, driver);
    return {
      statusCode: 201,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        RideId: rideId,
        Driver: driver,
        Eta: "3 mins",
        Rider: username,
      }),
    };
  } catch (err) {
    console.error("Failed to record ride:", err);
    return errorResponse(err.message, context.awsRequestId);
  }
};

// Assigns a random driver from the fleet
function assignDriver(pickupLocation) {
  console.log(
    "Assigning driver near:",
    pickupLocation.Latitude,
    pickupLocation.Longitude
  );
  return fleet[Math.floor(Math.random() * fleet.length)];
}

// Saves ride details to DynamoDB
async function saveRide(rideId, username, driver) {
  const params = {
    TableName: "Rides",
    Item: {
      RideId: rideId,
      User: username,
      Driver: driver,
      RequestTime: new Date().toISOString(),
    },
  };
  await ddb.send(new PutCommand(params));
}

// Generates a base64-safe string from random bytes
function generateRideId() {
  return randomBytes(16)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// Returns a standardized error response
function errorResponse(message, requestId) {
  return {
    statusCode: 500,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      Error: message,
      Reference: requestId,
    }),
  };
}
