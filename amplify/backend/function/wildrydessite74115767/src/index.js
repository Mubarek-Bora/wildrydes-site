

"use strict";

const { randomUUID, randomBytes } = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");

// ---------- Configuration ----------
const TABLE =
  process.env.RIDES_TABLE || process.env.STORAGE_RIDES_NAME || "Rides";

const TTL_DAYS = 90;

const FLEET = [
  { name: "John Mendez", vehicle: "Toyota Prius", gender: "Male", rating: 4.8 },
  { name: "Sarah Lee", vehicle: "Honda Civic", gender: "Female", rating: 4.9 },
  { name: "Dave Kim", vehicle: "Tesla Model 3", gender: "Male", rating: 4.7 },
];

// ---------- AWS SDK Setup ----------
const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  maxAttempts: 3,
});
const ddb = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

// ---------- Lambda Handler ----------
exports.handler = async (event, context) => {
  const startedAt = new Date().toISOString();
  log("Incoming event", {
    httpMethod: event.httpMethod,
    path: event.path,
    headers: event.headers,
  });

  // Handle CORS preflight requests
  if (event.httpMethod === "OPTIONS") {
    return corsResponse(200, { message: "OK" });
  }

  try {
    // Extract username with better fallback logic
    const username = extractUsername(event);
    log("Processing request for user", { username });

    // Parse and validate request body
    const body = parseRequestBody(event.body);
    if (!body) {
      return errorResponse(
        400,
        "Request body is required",
        context.awsRequestId
      );
    }

    // Validate pickup location
    const pickup = validatePickupLocation(body.PickupLocation);
    if (!pickup.isValid) {
      return errorResponse(400, pickup.error, context.awsRequestId);
    }

    // Generate ride ID and assign driver
    const rideId = genRideId();
    const driver = pickDriver(pickup.location);

    // Save ride to DynamoDB
    const rideData = {
      rideId,
      username,
      driver,
      pickup: pickup.location,
      requestTime: startedAt,
      lambdaRequestId: context.awsRequestId,
    };

    await saveRide(rideData);

    // Return successful response
    const response = {
      RideId: rideId,
      Driver: driver,
      Eta: calculateEta(pickup.location),
      Rider: username,
      RequestedAt: startedAt,
      Status: "REQUESTED",
      PickupLocation: pickup.location,
    };

    log("Ride request created successfully", { rideId, username });
    return corsResponse(201, response);
  } catch (err) {
    log("Error processing ride request", err, "error");

    // Handle specific DynamoDB errors
    if (err.name === "ConditionalCheckFailedException") {
      return errorResponse(409, "Duplicate ride request", context.awsRequestId);
    }
    if (err.name === "ProvisionedThroughputExceededException") {
      return errorResponse(
        429,
        "Service temporarily unavailable",
        context.awsRequestId
      );
    }
    if (err.name === "ResourceNotFoundException") {
      return errorResponse(
        500,
        "Database configuration error",
        context.awsRequestId
      );
    }

    return errorResponse(
      500,
      "Failed to process ride request",
      context.awsRequestId
    );
  }
};

// ---------- Core Functions ----------
function extractUsername(event) {
  return (
    event.requestContext?.authorizer?.claims?.["cognito:username"] ||
    event.requestContext?.identity?.cognitoIdentityId ||
    event.requestContext?.identity?.userArn?.split("/").pop() ||
    `guest-${Date.now()}`
  );
}

function parseRequestBody(bodyString) {
  if (!bodyString) return null;

  try {
    return typeof bodyString === "string" ? JSON.parse(bodyString) : bodyString;
  } catch (err) {
    log(
      "Failed to parse request body",
      { bodyString, error: err.message },
      "error"
    );
    return null;
  }
}

function validatePickupLocation(pickupLocation) {
  if (!pickupLocation) {
    return { isValid: false, error: "PickupLocation is required" };
  }

  const { Latitude, Longitude, Address } = pickupLocation;

  if (typeof Latitude !== "number" || typeof Longitude !== "number") {
    return {
      isValid: false,
      error: "PickupLocation must include valid Latitude and Longitude numbers",
    };
  }

  if (Latitude < -90 || Latitude > 90) {
    return { isValid: false, error: "Latitude must be between -90 and 90" };
  }

  if (Longitude < -180 || Longitude > 180) {
    return { isValid: false, error: "Longitude must be between -180 and 180" };
  }

  return {
    isValid: true,
    location: {
      Latitude,
      Longitude,
      Address: Address || `${Latitude}, ${Longitude}`,
    },
  };
}

function pickDriver(location) {
  log("Assigning driver for location", location);

  // Simple random assignment - in production, you'd use actual location-based logic
  const availableDrivers = FLEET.filter((driver) => driver.rating >= 4.5);
  const selectedDriver =
    availableDrivers[Math.floor(Math.random() * availableDrivers.length)];

  return {
    ...selectedDriver,
    DriverId: `driver-${selectedDriver.name
      .replace(/\s+/g, "-")
      .toLowerCase()}`,
    EstimatedArrival: new Date(Date.now() + 3 * 60 * 1000).toISOString(), // 3 minutes from now
  };
}

function calculateEta(location) {
  // Simple ETA calculation - in production, use actual distance/traffic APIs
  const baseEta = 3 + Math.floor(Math.random() * 5); // 3-7 minutes
  return `${baseEta} mins`;
}

async function saveRide({
  rideId,
  username,
  driver,
  pickup,
  requestTime,
  lambdaRequestId,
}) {
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + TTL_DAYS * 24 * 60 * 60;

  const item = {
    RideId: rideId,
    User: username,
    Driver: driver,
    PickupLocation: pickup,
    RequestTime: requestTime,
    ProcessedTime: now,
    CreatedAt: now,
    UpdatedAt: now,
    Status: "REQUESTED",
    Version: 1,
    ExpiresAt: ttl,
    LambdaRequestId: lambdaRequestId,
    Region: process.env.AWS_REGION || "unknown",
  };

  const params = {
    TableName: TABLE,
    Item: item,
    // Add condition to prevent duplicate rides
    ConditionExpression: "attribute_not_exists(RideId)",
  };

  log("Saving ride to DynamoDB", {
    rideId,
    params: JSON.stringify(params, null, 2),
  });

  const result = await ddb.send(new PutCommand(params));
  log("Ride saved successfully", { rideId });

  return result;
}

// ---------- Update Ride Status Function ----------
exports.updateRideStatus = async (rideId, newStatus, extra = {}) => {
  if (!rideId || !newStatus) {
    throw new Error("RideId and newStatus are required");
  }

  const validStatuses = [
    "REQUESTED",
    "ASSIGNED",
    "PICKED_UP",
    "COMPLETED",
    "CANCELLED",
  ];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(
      `Invalid status: ${newStatus}. Valid statuses: ${validStatuses.join(
        ", "
      )}`
    );
  }

  const now = new Date().toISOString();

  let UpdateExpression =
    "SET #status = :status, UpdatedAt = :updatedAt, Version = Version + :inc";
  const ExpressionAttributeNames = { "#status": "Status" };
  const ExpressionAttributeValues = {
    ":status": newStatus,
    ":updatedAt": now,
    ":inc": 1,
  };

  // Add status-specific fields
  switch (newStatus) {
    case "COMPLETED":
      UpdateExpression += ", CompletedTime = :completedTime";
      ExpressionAttributeValues[":completedTime"] = now;
      break;

    case "CANCELLED":
      UpdateExpression += ", CancelledTime = :cancelledTime";
      ExpressionAttributeValues[":cancelledTime"] = now;
      if (extra.reason) {
        UpdateExpression += ", CancellationReason = :reason";
        ExpressionAttributeValues[":reason"] = extra.reason;
      }
      break;

    case "ASSIGNED":
      const assignedAt = extra.assignedAt || now;
      UpdateExpression += ", AssignedTime = :assignedTime";
      ExpressionAttributeValues[":assignedTime"] = assignedAt;
      if (extra.driverId) {
        UpdateExpression += ", AssignedDriverId = :driverId";
        ExpressionAttributeValues[":driverId"] = extra.driverId;
      }
      break;

    case "PICKED_UP":
      UpdateExpression += ", PickedUpTime = :pickedUpTime";
      ExpressionAttributeValues[":pickedUpTime"] = now;
      break;
  }

  const params = {
    TableName: TABLE,
    Key: { RideId: rideId },
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
    ConditionExpression: "attribute_exists(RideId)", // Ensure ride exists
    ReturnValues: "ALL_NEW",
  };

  log("Updating ride status", {
    rideId,
    newStatus,
    params: JSON.stringify(params, null, 2),
  });

  try {
    const result = await ddb.send(new UpdateCommand(params));
    log(`Successfully updated ride ${rideId} to status ${newStatus}`);
    return result.Attributes;
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      log(`Ride ${rideId} not found`, err, "error");
      throw new Error(`Ride ${rideId} not found`);
    }
    log(`Failed to update ride ${rideId}`, err, "error");
    throw err;
  }
};

// ---------- Get Ride Function ----------
exports.getRide = async (rideId) => {
  if (!rideId) {
    throw new Error("RideId is required");
  }

  const params = {
    TableName: TABLE,
    Key: { RideId: rideId },
  };

  try {
    const result = await ddb.send(new GetCommand(params));
    if (!result.Item) {
      throw new Error(`Ride ${rideId} not found`);
    }
    return result.Item;
  } catch (err) {
    log(`Failed to get ride ${rideId}`, err, "error");
    throw err;
  }
};

// ---------- Utility Functions ----------
function genRideId() {
  const uuid =
    typeof randomUUID === "function"
      ? randomUUID().replace(/-/g, "")
      : randomBytes(16).toString("hex");

  // Add timestamp prefix for better DynamoDB distribution
  const timestamp = Date.now().toString(36);
  return `${timestamp}-${uuid}`;
}

function corsResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS,POST,PUT,DELETE",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

function errorResponse(statusCode, message, reqId) {
  const errorBody = {
    Error: message,
    Reference: reqId,
    Timestamp: new Date().toISOString(),
  };

  log("Returning error response", { statusCode, message, reqId }, "error");
  return corsResponse(statusCode, errorBody);
}

function log(message, obj = {}, level = "info") {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...(obj && typeof obj === "object" ? obj : { data: obj }),
  };

  console[level](JSON.stringify(logEntry));
}