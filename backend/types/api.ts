/**
 * Types for AWS API Gateway, Lambda, and DynamoDB integration.
 */

import type { TransactionType, MerchantCategory } from "../rules/types";

/**
 * Incoming request payload for POST /analyze
 */
export interface AnalyzeRequestBody {
  amount: number;
  transactionType: TransactionType | string;
  merchantCategory: MerchantCategory | string;
  eligibleSmallMerchant?: boolean;
  // Aliases supported for backwards compatibility
  isSmallMerchant?: boolean;
}

/**
 * DynamoDB record schema for table: upi-costguard-calculations
 * Partition Key: calculationId (String)
 */
export interface StoredCalculation {
  calculationId: string;
  timestamp: string; // ISO 8601 string
  amount: number;
  transactionType: string;
  merchantCategory: string;
  eligibleSmallMerchant: boolean;
  mdrApplicable: boolean;
  calculatedMdr: number;
  customerCharge: number;
  merchantImpact: string;
  ruleCode: string;

  // Additional metadata for high fidelity
  rate?: number;
  fixedCharge?: number;
  capApplied?: boolean;
  explanation?: string;
  netMerchantPayout?: number;
}

/**
 * Response payload for POST /analyze
 */
export interface AnalyzeResponse {
  success: boolean;
  data: StoredCalculation;
  // Frontend convenience fields
  id?: string;
  mdrRate?: number;
  mdrRatePercent?: string;
  estimatedFee?: number;
  ruleApplied?: string;
  exemptionReason?: string | null;
  savedToDB?: boolean;
}

/**
 * Response payload for GET /history
 */
export interface HistoryResponse {
  items: StoredCalculation[];
  count: number;
}

/**
 * Standard API Gateway proxy result
 */
export interface APIGatewayResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
