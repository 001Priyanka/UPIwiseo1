/**
 * DynamoDB client and data access layer for table: upi-costguard-calculations
 * 
 * Target Table: upi-costguard-calculations
 * Partition Key: calculationId (String)
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { StoredCalculation } from "../types/api";

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "upi-costguard-calculations";
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-south-1";
const ENDPOINT = process.env.DYNAMODB_ENDPOINT; // Optional local endpoint (e.g., http://localhost:8000)

// In-memory fallback cache for local testing without live AWS credentials
const localMemoryStore: Map<string, StoredCalculation> = new Map();

let docClientInstance: DynamoDBDocumentClient | null = null;

export function getTableName(): string {
  return process.env.DYNAMODB_TABLE_NAME || TABLE_NAME;
}

export function getDynamoDocClient(): DynamoDBDocumentClient {
  if (!docClientInstance) {
    const client = new DynamoDBClient({
      region: REGION,
      ...(ENDPOINT ? { endpoint: ENDPOINT } : {}),
    });

    docClientInstance = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });
  }
  return docClientInstance;
}

/**
 * Reset DynamoDB document client instance (useful for unit testing with custom env/mocks)
 */
export function resetDynamoClient(): void {
  docClientInstance = null;
}

/**
 * Save an MDR calculation record to DynamoDB.
 *
 * Stored attributes:
 * - calculationId (Partition Key)
 * - timestamp
 * - amount
 * - transactionType
 * - merchantCategory
 * - eligibleSmallMerchant
 * - mdrApplicable
 * - calculatedMdr
 * - customerCharge
 * - merchantImpact
 * - ruleCode
 */
export async function saveCalculation(
  calculation: StoredCalculation
): Promise<StoredCalculation> {
  const tableName = getTableName();

  // If running in local mock mode without AWS credentials configured
  if (process.env.USE_LOCAL_MOCK_DB === "true") {
    localMemoryStore.set(calculation.calculationId, calculation);
    return calculation;
  }

  try {
    const docClient = getDynamoDocClient();
    const command = new PutCommand({
      TableName: tableName,
      Item: calculation,
    });

    await docClient.send(command);
    return calculation;
  } catch (error) {
    // If AWS credentials or table is not reachable in local dev, fall back gracefully
    const err = error as { name?: string; code?: string; message?: string };
    if (
      process.env.NODE_ENV !== "production" &&
      (err.name === "CredentialsProviderError" ||
        err.name === "UnrecognizedClientException" ||
        err.code === "ResourceNotFoundException" ||
        err.message?.includes("credentials") ||
        err.message?.includes("Cannot find table"))
    ) {
      console.warn(
        `[DynamoDB Warning] Could not persist to ${tableName} (${err.name || err.message}). Storing in local memory fallback.`
      );
      localMemoryStore.set(calculation.calculationId, calculation);
      return calculation;
    }
    throw error;
  }
}

/**
 * Retrieve recent calculations from DynamoDB ordered by timestamp descending.
 */
export async function getRecentCalculations(limit = 20): Promise<StoredCalculation[]> {
  const tableName = getTableName();

  if (process.env.USE_LOCAL_MOCK_DB === "true") {
    const items = Array.from(localMemoryStore.values());
    items.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return items.slice(0, limit);
  }

  try {
    const docClient = getDynamoDocClient();
    const command = new ScanCommand({
      TableName: tableName,
      Limit: Math.min(limit * 2, 100), // scan enough items to allow reliable sort
    });

    const response = await docClient.send(command);
    const items = (response.Items || []) as StoredCalculation[];

    // Sort by timestamp descending
    items.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return items.slice(0, limit);
  } catch (error) {
    const err = error as { name?: string; code?: string; message?: string };
    if (
      process.env.NODE_ENV !== "production" &&
      (err.name === "CredentialsProviderError" ||
        err.name === "UnrecognizedClientException" ||
        err.code === "ResourceNotFoundException" ||
        err.message?.includes("credentials") ||
        err.message?.includes("Cannot find table"))
    ) {
      console.warn(
        `[DynamoDB Warning] Could not read from ${tableName} (${err.name || err.message}). Reading from local memory fallback.`
      );
      const items = Array.from(localMemoryStore.values());
      items.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      return items.slice(0, limit);
    }
    throw error;
  }
}

/**
 * Clear in-memory store (used for test isolation)
 */
export function clearLocalMemoryStore(): void {
  localMemoryStore.clear();
}
