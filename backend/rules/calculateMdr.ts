/**
 * Deterministic UPI MDR Calculation Engine.
 * 
 * CRITICAL DIRECTIVE:
 * The LLM must NEVER calculate MDR. All calculations are executed deterministically
 * via explicit regulatory configuration and mathematical constraints.
 * 
 * Sources:
 * - NPCI (National Payments Corporation of India) UPI MDR Framework (October 2026).
 * - RBI Zero-Customer-Surcharge Mandate under the Payment & Settlement Systems Act.
 * - Ministry of Finance 2026 Small Merchant & Essential Services Directives.
 */

import type {
  MdrCalculationInput,
  MdrCalculationResult,
  ValidatedMdrInput,
  CalculatedDetails,
} from "./types";
import {
  MDR_RULES_CONFIG,
  isRecognizedMerchantCategory,
} from "./mdrRules";

/**
 * Validates and normalizes raw input parameters.
 * If the input cannot be confidently validated according to regulatory standards,
 * returns null.
 */
function validateAndNormalizeInput(input: unknown): ValidatedMdrInput | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const raw = input as Partial<MdrCalculationInput>;

  // 1. Amount validation: must be a finite positive number (> 0)
  if (
    typeof raw.amount !== "number" ||
    !Number.isFinite(raw.amount) ||
    raw.amount <= 0
  ) {
    return null;
  }

  // 2. Transaction Type validation: must be "P2P" or "P2M" (case-insensitive normalization)
  if (typeof raw.transactionType !== "string") {
    return null;
  }
  const normType = raw.transactionType.trim().toUpperCase();
  if (normType !== "P2P" && normType !== "P2M") {
    return null;
  }

  // 3. Merchant Category validation:
  // For P2P, merchant category can be "n/a", "p2p", or empty, but if provided it should not be invalid
  let normCategory = "";
  if (typeof raw.merchantCategory === "string") {
    normCategory = raw.merchantCategory.trim().toLowerCase();
  } else if (normType === "P2M") {
    // Missing category on P2M cannot be confidently classified
    return null;
  }

  if (normType === "P2M") {
    if (!normCategory || !isRecognizedMerchantCategory(normCategory)) {
      return null;
    }
  }

  // 4. Eligible Small Merchant validation: must be a boolean or coercible boolean
  const eligibleSmallMerchant = Boolean(raw.eligibleSmallMerchant);

  return {
    amount: raw.amount,
    transactionType: normType as "P2P" | "P2M",
    merchantCategory: normCategory,
    eligibleSmallMerchant,
  };
}

/**
 * Executes deterministic MDR calculation for a given transaction.
 * 
 * If the input is invalid or cannot be confidently classified,
 * returns "MANUAL_REVIEW_REQUIRED".
 * 
 * @param input Raw transaction parameters
 * @returns Compliant MdrCalculationOutput object or "MANUAL_REVIEW_REQUIRED"
 */
export function calculateMdr(input: MdrCalculationInput): MdrCalculationResult {
  // Step 1: Deterministic validation and normalization
  const validated = validateAndNormalizeInput(input);
  if (!validated) {
    return "MANUAL_REVIEW_REQUIRED";
  }

  // Step 2: Iterate through declarative rules configuration
  const matchedRule = MDR_RULES_CONFIG.find((rule) => rule.applies(validated));

  // If no published rule confidently matches, route to manual review
  if (!matchedRule) {
    return "MANUAL_REVIEW_REQUIRED";
  }

  // Step 3: Compute MDR according to matched rule pricing type
  let calculatedMdr = 0;
  let capApplied = false;

  switch (matchedRule.pricingType) {
    case "ZERO_MDR": {
      calculatedMdr = 0;
      capApplied = false;
      break;
    }

    case "FLAT_FEE": {
      calculatedMdr = matchedRule.fixedCharge;
      capApplied = false;
      break;
    }

    case "PERCENTAGE_WITH_CAP": {
      const rawFee = validated.amount * matchedRule.rate;
      if (matchedRule.cap !== null && rawFee >= matchedRule.cap) {
        calculatedMdr = matchedRule.cap;
        capApplied = true;
      } else {
        // Round to 2 decimal places (paise precision)
        calculatedMdr = Math.round(rawFee * 100) / 100;
        capApplied = false;
      }
      break;
    }

    default: {
      return "MANUAL_REVIEW_REQUIRED";
    }
  }

  // Step 4: Customer charge is ALWAYS ₹0.00 under NPCI zero-surcharge rule
  const customerCharge = 0;

  // Step 5: Net merchant settlement
  const netMerchantPayout = Math.max(0, Math.round((validated.amount - calculatedMdr) * 100) / 100);

  const details: CalculatedDetails = {
    mdrApplicable: calculatedMdr > 0,
    rate: matchedRule.rate,
    fixedCharge: matchedRule.fixedCharge,
    calculatedMdr,
    capApplied,
    customerCharge,
    netMerchantPayout,
  };

  // Step 6: Construct and return final deterministic output
  return {
    amount: validated.amount,
    transactionType: validated.transactionType,
    merchantCategory: validated.merchantCategory,
    mdrApplicable: details.mdrApplicable,
    rate: details.rate,
    fixedCharge: details.fixedCharge,
    calculatedMdr: details.calculatedMdr,
    capApplied: details.capApplied,
    customerCharge: details.customerCharge,
    merchantImpact: matchedRule.merchantImpact(validated, details),
    ruleCode: matchedRule.ruleCode,
    explanation: matchedRule.explanation(validated, details),
  };
}

export default calculateMdr;
