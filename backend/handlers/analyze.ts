/**
 * POST /analyze handler
 * 
 * Responsibilities:
 * - Validate input
 * - Invoke deterministic MDR rule engine
 * - Save calculation to DynamoDB (upi-costguard-calculations)
 * - Return calculation result
 */

import { randomUUID } from "node:crypto";
import { calculateMdr } from "../rules/calculateMdr";
import type { MdrCalculationOutput } from "../rules/types";
import { saveCalculation } from "../db/dynamoClient";
import type {
  AnalyzeRequestBody,
  StoredCalculation,
  AnalyzeResponse,
} from "../types/api";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: {
    amount: number;
    transactionType: "P2P" | "P2M";
    merchantCategory: string;
    eligibleSmallMerchant: boolean;
  };
}

/**
 * Validate incoming request payload for /analyze
 */
export function validateAnalyzeInput(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request body must be a valid JSON object."] };
  }

  const payload = body as Partial<AnalyzeRequestBody>;

  // Validate amount
  if (payload.amount === undefined || payload.amount === null) {
    errors.push("Field 'amount' is required.");
  } else if (typeof payload.amount !== "number" || isNaN(payload.amount)) {
    errors.push("Field 'amount' must be a numeric value.");
  } else if (payload.amount <= 0) {
    errors.push("Field 'amount' must be greater than zero.");
  }

  // Validate transactionType
  const validTypes = ["P2P", "P2M"];
  const txType = (payload.transactionType || "").toString().trim().toUpperCase();
  if (!txType) {
    errors.push("Field 'transactionType' is required (must be 'P2P' or 'P2M').");
  } else if (!validTypes.includes(txType)) {
    errors.push(`Field 'transactionType' must be one of: ${validTypes.join(", ")}.`);
  }

  // Validate merchantCategory (for P2M)
  const category = (payload.merchantCategory || "").toString().trim().toLowerCase();
  if (txType === "P2M" && !category) {
    errors.push("Field 'merchantCategory' is required for P2M transactions.");
  }

  // Small merchant flag (support eligibleSmallMerchant and isSmallMerchant alias)
  const isSmallMerchant = Boolean(
    payload.eligibleSmallMerchant ?? payload.isSmallMerchant ?? false
  );

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sanitized: {
      amount: Number(payload.amount),
      transactionType: txType as "P2P" | "P2M",
      merchantCategory: category || "general",
      eligibleSmallMerchant: isSmallMerchant,
    },
  };
}

/**
 * Handle POST /analyze
 */
export async function handleAnalyze(
  body: unknown
): Promise<{ status: number; body: AnalyzeResponse | { error: string; errors?: string[] } }> {
  // 1. Validate input
  const validation = validateAnalyzeInput(body);
  if (!validation.valid || !validation.sanitized) {
    return {
      status: 400,
      body: {
        error: "Validation failed",
        errors: validation.errors,
      },
    };
  }

  const { amount, transactionType, merchantCategory, eligibleSmallMerchant } =
    validation.sanitized;

  // 2. Invoke deterministic MDR rule engine
  const calculationResult = calculateMdr({
    amount,
    transactionType,
    merchantCategory,
    eligibleSmallMerchant,
  });

  if (calculationResult === "MANUAL_REVIEW_REQUIRED") {
    return {
      status: 422,
      body: {
        error: "MANUAL_REVIEW_REQUIRED",
        errors: [
          "Transaction parameters cannot be classified automatically under published NPCI rules and require manual compliance review.",
        ],
      },
    };
  }

  const out = calculationResult as MdrCalculationOutput;
  const calculationId = randomUUID();
  const timestamp = new Date().toISOString();

  // 3. Prepare DynamoDB record
  const storedRecord: StoredCalculation = {
    calculationId,
    timestamp,
    amount: out.amount,
    transactionType: out.transactionType,
    merchantCategory: out.merchantCategory,
    eligibleSmallMerchant,
    mdrApplicable: out.mdrApplicable,
    calculatedMdr: out.calculatedMdr,
    customerCharge: out.customerCharge,
    merchantImpact: out.merchantImpact,
    ruleCode: out.ruleCode,
    rate: out.rate,
    fixedCharge: out.fixedCharge,
    capApplied: out.capApplied,
    explanation: out.explanation,
    netMerchantPayout: Math.round((out.amount - out.calculatedMdr) * 100) / 100,
  };

  // 4. Save to DynamoDB
  await saveCalculation(storedRecord);

  // 5. Return calculation result
  const rateLabel =
    out.fixedCharge > 0
      ? `Flat ₹${out.fixedCharge.toFixed(2)}`
      : `${(out.rate * 100).toFixed(2)}%`;

  const response: AnalyzeResponse = {
    success: true,
    data: storedRecord,
    id: calculationId,
    mdrRate: out.rate,
    mdrRatePercent: rateLabel,
    estimatedFee: out.calculatedMdr,
    ruleApplied: `${out.ruleCode}: ${out.explanation}`,
    exemptionReason: out.mdrApplicable ? null : out.explanation,
    savedToDB: true,
  };

  return {
    status: 201,
    body: response,
  };
}
