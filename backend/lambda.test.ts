/**
 * Automated Local Tests for AWS API Gateway + Lambda + DynamoDB Integration
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { handler } from "./lambda";
import { clearLocalMemoryStore } from "./db/dynamoClient";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { AnalyzeResponse, HistoryResponse } from "./types/api";

// Ensure local mock storage is active during tests
process.env.USE_LOCAL_MOCK_DB = "true";
process.env.DYNAMODB_TABLE_NAME = "upi-costguard-calculations";
process.env.CORS_ALLOW_ORIGIN = "*";

function createMockEvent(options: {
  method: string;
  path: string;
  body?: unknown;
  queryParams?: Record<string, string>;
}): APIGatewayProxyEvent {
  return {
    httpMethod: options.method,
    path: options.path,
    body: options.body !== undefined ? JSON.stringify(options.body) : null,
    queryStringParameters: options.queryParams || null,
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    multiValueHeaders: {},
    isBase64Encoded: false,
    pathParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: "123456789012",
      apiId: "test-api",
      authorizer: null,
      protocol: "HTTP/1.1",
      httpMethod: options.method,
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: "127.0.0.1",
        user: null,
        userAgent: "test-agent",
        userArn: null,
      },
      path: options.path,
      stage: "test",
      requestId: "test-req-123",
      requestTimeEpoch: Date.now(),
      resourceId: "test-res",
      resourcePath: options.path,
    },
    resource: options.path,
  };
}

describe("AWS API Gateway + Lambda + DynamoDB Integration", () => {
  beforeEach(() => {
    clearLocalMemoryStore();
  });

  test("OPTIONS /analyze returns CORS preflight headers", async () => {
    const event = createMockEvent({ method: "OPTIONS", path: "/analyze" });
    const res = (await handler(event)) as APIGatewayProxyResult;

    assert.equal(res.statusCode, 204);
    assert.equal(res.headers?.["Access-Control-Allow-Origin"], "*");
    assert.ok(res.headers?.["Access-Control-Allow-Methods"]?.includes("POST"));
    assert.ok(res.headers?.["Access-Control-Allow-Headers"]?.includes("Content-Type"));
  });

  test("GET /health returns 200 and healthy status", async () => {
    const event = createMockEvent({ method: "GET", path: "/health" });
    const res = (await handler(event)) as APIGatewayProxyResult;

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, "healthy");
    assert.equal(body.tableName, "upi-costguard-calculations");
  });

  test("POST /analyze rejects invalid or missing input with 400", async () => {
    // Missing amount
    const event1 = createMockEvent({
      method: "POST",
      path: "/analyze",
      body: { transactionType: "P2M", merchantCategory: "general" },
    });
    const res1 = (await handler(event1)) as APIGatewayProxyResult;
    assert.equal(res1.statusCode, 400);
    const body1 = JSON.parse(res1.body);
    assert.ok(body1.errors.some((e: string) => e.includes("amount")));

    // Negative amount
    const event2 = createMockEvent({
      method: "POST",
      path: "/analyze",
      body: { amount: -500, transactionType: "P2P", merchantCategory: "general" },
    });
    const res2 = (await handler(event2)) as APIGatewayProxyResult;
    assert.equal(res2.statusCode, 400);

    // Invalid transaction type
    const event3 = createMockEvent({
      method: "POST",
      path: "/analyze",
      body: { amount: 1000, transactionType: "UNKNOWN", merchantCategory: "general" },
    });
    const res3 = (await handler(event3)) as APIGatewayProxyResult;
    assert.equal(res3.statusCode, 400);
  });

  test("POST /analyze processes P2P transaction and saves to DynamoDB", async () => {
    const event = createMockEvent({
      method: "POST",
      path: "/analyze",
      body: {
        amount: 5000,
        transactionType: "P2P",
        merchantCategory: "general",
        eligibleSmallMerchant: false,
      },
    });

    const res = (await handler(event)) as APIGatewayProxyResult;
    assert.equal(res.statusCode, 201);
    assert.equal(res.headers?.["Access-Control-Allow-Origin"], "*");

    const payload: AnalyzeResponse = JSON.parse(res.body);
    assert.equal(payload.success, true);
    assert.ok(payload.data.calculationId);
    assert.ok(payload.data.timestamp);
    assert.equal(payload.data.amount, 5000);
    assert.equal(payload.data.transactionType, "P2P");
    assert.equal(payload.data.mdrApplicable, false);
    assert.equal(payload.data.calculatedMdr, 0);
    assert.equal(payload.data.customerCharge, 0);
    assert.equal(payload.data.ruleCode, "RULE_P2P_ZERO_MDR");
    assert.ok(payload.data.merchantImpact);
  });

  test("POST /analyze processes Standard P2M > ₹2,000 (0.40% MDR) and persists required DynamoDB fields", async () => {
    const event = createMockEvent({
      method: "POST",
      path: "/analyze",
      body: {
        amount: 10000,
        transactionType: "P2M",
        merchantCategory: "general",
        eligibleSmallMerchant: false,
      },
    });

    const res = (await handler(event)) as APIGatewayProxyResult;
    assert.equal(res.statusCode, 201);

    const payload: AnalyzeResponse = JSON.parse(res.body);
    const d = payload.data;

    // Verify all DynamoDB fields requested:
    assert.ok(typeof d.calculationId === "string" && d.calculationId.length > 0);
    assert.ok(typeof d.timestamp === "string");
    assert.equal(d.amount, 10000);
    assert.equal(d.transactionType, "P2M");
    assert.equal(d.merchantCategory, "general");
    assert.equal(d.eligibleSmallMerchant, false);
    assert.equal(d.mdrApplicable, true);
    assert.equal(d.calculatedMdr, 40); // 10000 * 0.40%
    assert.equal(d.customerCharge, 0); // Zero surcharge rule
    assert.ok(d.merchantImpact.includes("40.00"));
    assert.equal(d.ruleCode, "RULE_P2M_STANDARD");
  });

  test("POST /analyze processes Essential Services Flat ₹5 fee", async () => {
    const event = createMockEvent({
      method: "POST",
      path: "/analyze",
      body: {
        amount: 8500,
        transactionType: "P2M",
        merchantCategory: "essential",
        eligibleSmallMerchant: false,
      },
    });

    const res = (await handler(event)) as APIGatewayProxyResult;
    assert.equal(res.statusCode, 201);

    const payload: AnalyzeResponse = JSON.parse(res.body);
    assert.equal(payload.data.calculatedMdr, 5);
    assert.equal(payload.data.fixedCharge, 5);
    assert.equal(payload.data.ruleCode, "RULE_P2M_ESSENTIAL_FLAT");
    assert.equal(payload.data.customerCharge, 0);
  });

  test("POST /analyze applies Small Merchant exemption", async () => {
    const event = createMockEvent({
      method: "POST",
      path: "/analyze",
      body: {
        amount: 25000,
        transactionType: "P2M",
        merchantCategory: "general",
        eligibleSmallMerchant: true,
      },
    });

    const res = (await handler(event)) as APIGatewayProxyResult;
    assert.equal(res.statusCode, 201);

    const payload: AnalyzeResponse = JSON.parse(res.body);
    assert.equal(payload.data.mdrApplicable, false);
    assert.equal(payload.data.calculatedMdr, 0);
    assert.equal(payload.data.ruleCode, "RULE_P2M_SMALL_MERCHANT_ZERO_MDR");
  });

  test("GET /history retrieves saved calculations ordered by timestamp descending", async () => {
    // 1. Insert 3 calculations with staggered timestamps
    const amounts = [1500, 5000, 20000];
    for (const amt of amounts) {
      const event = createMockEvent({
        method: "POST",
        path: "/analyze",
        body: {
          amount: amt,
          transactionType: "P2M",
          merchantCategory: "general",
          eligibleSmallMerchant: false,
        },
      });
      await handler(event);
    }

    // 2. Query GET /history
    const historyEvent = createMockEvent({
      method: "GET",
      path: "/history",
      queryParams: { limit: "10" },
    });

    const historyRes = (await handler(historyEvent)) as APIGatewayProxyResult;
    assert.equal(historyRes.statusCode, 200);
    assert.equal(historyRes.headers?.["Access-Control-Allow-Origin"], "*");

    const historyPayload: HistoryResponse = JSON.parse(historyRes.body);
    assert.equal(historyPayload.count, 3);
    assert.equal(historyPayload.items.length, 3);

    // Verify ordering: newest timestamp first
    const timestamps = historyPayload.items.map((i) => new Date(i.timestamp).getTime());
    for (let i = 0; i < timestamps.length - 1; i++) {
      assert.ok(
        timestamps[i] >= timestamps[i + 1],
        `Item at index ${i} should be newer than index ${i + 1}`
      );
    }

    // Verify partition key calculationId is present on every item
    historyPayload.items.forEach((item) => {
      assert.ok(item.calculationId, "Missing calculationId on history item");
      assert.ok(item.ruleCode, "Missing ruleCode on history item");
    });
  });
});
