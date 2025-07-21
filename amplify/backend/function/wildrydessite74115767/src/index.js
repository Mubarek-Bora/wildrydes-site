const { randomBytes } = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

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
exports.handler = async (event, context) => {
  const processingStartTime = new Date().toISOString();

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
    await saveRide(rideId, username, driver, processingStartTime);

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
        RequestedAt: processingStartTime,
        Status: "REQUESTED",
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
async function saveRide(rideId, username, driver, requestTime) {
  const now = new Date().toISOString();
  const ttlTimestamp = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days TTL

  const params = {
    TableName: "Rides",
    Item: {
      RideId: rideId,
      User: username,
      Driver: driver,
      RequestTime: requestTime,
      ProcessedTime: now,
      CreatedAt: now,
      UpdatedAt: now,
      Status: "REQUESTED",
      Version: 1,
      ExpiresAt: ttlTimestamp,
      LambdaRequestId: process.env.AWS_REQUEST_ID || "unknown",
      Region: process.env.AWS_REGION || "unknown",
    },
  };

  console.log(`Saving ride ${rideId} to DynamoDB at ${now}`);
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
      Timestamp: new Date().toISOString(),
    }),
  };
}

// Optional: Helper function for updating ride status
exports.updateRideStatus = async function (
  rideId,
  newStatus,
  additionalData = {}
) {
  const now = new Date().toISOString();

  let updateExpression =
    "SET #status = :status, UpdatedAt = :updatedAt, Version = Version + :inc";
  const expressionAttributeNames = { "#status": "Status" };
  const expressionAttributeValues = {
    ":status": newStatus,
    ":updatedAt": now,
    ":inc": 1,
  };

  if (newStatus === "COMPLETED") {
    updateExpression += ", CompletedTime = :completedTime";
    expressionAttributeValues[":completedTime"] = now;
  }

  if (newStatus === "CANCELLED") {
    updateExpression += ", CancelledTime = :cancelledTime";
    expressionAttributeValues[":cancelledTime"] = now;
    if (additionalData.reason) {
      updateExpression += ", CancellationReason = :reason";
      expressionAttributeValues[":reason"] = additionalData.reason;
    }
  }

  if (newStatus === "ASSIGNED" && additionalData.assignedAt) {
    updateExpression += ", AssignedTime = :assignedTime";
    expressionAttributeValues[":assignedTime"] =
      additionalData.assignedAt || now;
  }

  const params = {
    TableName: "Rides",
    Key: { RideId: rideId },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW",
  };

  try {
    const result = await ddb.send(new UpdateCommand(params));
    console.log(`Updated ride ${rideId} to status ${newStatus} at ${now}`);
    return result.Attributes;
  } catch (error) {
    console.error(`Failed to update ride ${rideId}:`, error);
    throw error;
  }
};
