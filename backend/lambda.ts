/**
 * AWS Lambda Unified Entry Point for UPIwise Backend API
 * 
 * Integrated with:
 * - AWS API Gateway (REST API v1 or HTTP API v2)
 * - AWS DynamoDB (table: upi-costguard-calculations)
 * 
 * Routes:
 * - POST /analyze    - Validate input, invoke MDR engine, save to DynamoDB, return result
 * - GET  /history    - Retrieve recent calculations from DynamoDB ordered by timestamp
 * - OPTIONS *        - CORS preflight response
 * - GET  /health     - Liveness / Readiness health check
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";
import { handleAnalyze } from "./handlers/analyze";
import { handleHistory } from "./handlers/history";

const CORS_ORIGIN = process.env.CORS_ALLOW_ORIGIN || "*";

/**
 * Standard CORS response headers
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token, X-Requested-With",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

/**
 * Normalized HTTP request representation extracted from either API Gateway v1 or v2 events.
 */
interface NormalizedRequest {
  method: string;
  path: string;
  body: unknown;
  queryStringParameters: Record<string, string | undefined>;
}

/**
 * Normalize event from API Gateway REST API (v1) or HTTP API (v2)
 */
export function normalizeEvent(
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2
): NormalizedRequest {
  let method = "GET";
  let path = "/";
  let queryStringParameters: Record<string, string | undefined> = {};
  let rawBody: string | null = null;

  // HTTP API (v2) payload check
  if ("requestContext" in event && "http" in event.requestContext) {
    const v2 = event as APIGatewayProxyEventV2;
    method = v2.requestContext.http.method.toUpperCase();
    path = v2.rawPath || "/";
    queryStringParameters = v2.queryStringParameters || {};
    rawBody = v2.body || null;
  } else {
    // REST API (v1) payload
    const v1 = event as APIGatewayProxyEvent;
    method = (v1.httpMethod || "GET").toUpperCase();
    path = v1.path || "/";
    queryStringParameters = (v1.queryStringParameters as Record<string, string | undefined>) || {};
    rawBody = v1.body || null;
  }

  // Parse JSON body if present
  let body: unknown = null;
  if (rawBody) {
    try {
      body = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    } catch {
      body = rawBody;
    }
  }

  // Normalize path (strip trailing slashes and handle stage prefixes like /dev/analyze)
  const cleanPath = path.replace(/\/+$/, "") || "/";
  const strippedPath = cleanPath.replace(/^\/(?:dev|prod|v1|api)/, "") || "/";

  return {
    method,
    path: strippedPath,
    body,
    queryStringParameters,
  };
}

/**
 * Main AWS Lambda Handler
 */
export async function handler(
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
  _context?: Context
): Promise<APIGatewayProxyResult | APIGatewayProxyResultV2> {
  const req = normalizeEvent(event);

  // 1. Handle CORS OPTIONS Preflight
  if (req.method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  try {
    // 2. Health check route
    if (req.method === "GET" && (req.path === "/health" || req.path === "/")) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          status: "healthy",
          service: "UPIwise AWS Backend",
          version: "1.0.0",
          tableName: process.env.DYNAMODB_TABLE_NAME || "upi-costguard-calculations",
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // 3. POST /analyze (and /calculate alias)
    if (req.method === "POST" && (req.path === "/analyze" || req.path === "/calculate")) {
      const result = await handleAnalyze(req.body);
      return {
        statusCode: result.status,
        headers: CORS_HEADERS,
        body: JSON.stringify(result.body),
      };
    }

    // 4. GET /history
    if (req.method === "GET" && req.path === "/history") {
      const result = await handleHistory(req.queryStringParameters);
      return {
        statusCode: result.status,
        headers: CORS_HEADERS,
        body: JSON.stringify(result.body),
      };
    }

    // 5. Unmatched route
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Route not found",
        method: req.method,
        path: req.path,
        availableRoutes: [
          "POST /analyze",
          "GET /history",
          "GET /health",
          "OPTIONS (CORS)",
        ],
      }),
    };
  } catch (error) {
    const err = error as Error;
    console.error("[Unhandled Lambda Error]", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Internal Server Error",
        message: err.message || "An unexpected error occurred while processing the request.",
      }),
    };
  }
}
