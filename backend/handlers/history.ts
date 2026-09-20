/**
 * GET /history handler
 * 
 * Responsibilities:
 * - Retrieve recent calculations from DynamoDB (upi-costguard-calculations)
 * - Return them ordered by timestamp descending
 */

import { getRecentCalculations } from "../db/dynamoClient";
import type { HistoryResponse } from "../types/api";

export interface HistoryQueryParams {
  limit?: string | number;
}

/**
 * Handle GET /history
 */
export async function handleHistory(
  queryParams?: Record<string, string | undefined> | null
): Promise<{ status: number; body: HistoryResponse | { error: string } }> {
  try {
    let limit = 20;
    if (queryParams?.limit) {
      const parsedLimit = parseInt(String(queryParams.limit), 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, 100);
      }
    }

    const items = await getRecentCalculations(limit);

    return {
      status: 200,
      body: {
        items,
        count: items.length,
      },
    };
  } catch (error) {
    const err = error as Error;
    console.error("[History Handler Error]", err);
    return {
      status: 500,
      body: {
        error: "Failed to retrieve calculation history from DynamoDB.",
      },
    };
  }
}
