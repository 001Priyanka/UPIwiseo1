/**
 * Types for the 2026 Deterministic UPI MDR Calculation Engine.
 * 
 * Rules reference:
 * - NPCI (National Payments Corporation of India) UPI MDR Framework (effective October 2026)
 * - Ministry of Finance / Reserve Bank of India Zero-MDR & Rationalized MDR Guidelines
 */

export type TransactionType = "P2P" | "P2M";

export type MerchantCategory =
  | "standard"
  | "general"
  | "essential"
  | "essential_services"
  | "capital_market"
  | "capital_markets";

/**
 * Raw input payload received by the calculator.
 */
export interface MdrCalculationInput {
  amount: number;
  transactionType: TransactionType | string;
  merchantCategory: MerchantCategory | string;
  eligibleSmallMerchant: boolean;
}

/**
 * Validated, canonicalized representation of the input.
 */
export interface ValidatedMdrInput {
  amount: number;
  transactionType: TransactionType;
  merchantCategory: string;
  eligibleSmallMerchant: boolean;
}

/**
 * Pricing structure classification for an MDR rule.
 */
export type RulePricingType = "ZERO_MDR" | "PERCENTAGE_WITH_CAP" | "FLAT_FEE";

/**
 * Intermediate calculated financial details.
 */
export interface CalculatedDetails {
  mdrApplicable: boolean;
  rate: number;
  fixedCharge: number;
  calculatedMdr: number;
  capApplied: boolean;
  customerCharge: number;
  netMerchantPayout: number;
}

/**
 * Declarative rule definition configuration.
 */
export interface MdrRule {
  /** Unique regulatory rule code */
  ruleCode: string;
  /** Human-readable rule title */
  name: string;
  /** Official circular / gazette / regulatory reference */
  sourceReference: string;
  /** Pricing strategy */
  pricingType: RulePricingType;
  /** Applicable rate (e.g., 0.004 for 0.40%, 0.0002 for 0.02%, 0 for zero-MDR) */
  rate: number;
  /** Fixed fee in INR (e.g., 5 for essential sectors, 0 otherwise) */
  fixedCharge: number;
  /** Maximum MDR cap in INR (e.g., 300 for standard and capital market, null if no cap) */
  cap: number | null;
  /** Explicit predicate determining whether this rule matches the input */
  applies: (input: ValidatedMdrInput) => boolean;
  /** Plain-language explanation generator */
  explanation: (input: ValidatedMdrInput, details: CalculatedDetails) => string;
  /** Settlement impact description generator */
  merchantImpact: (input: ValidatedMdrInput, details: CalculatedDetails) => string;
}

/**
 * Deterministic calculation output structure.
 */
export interface MdrCalculationOutput {
  amount: number;
  transactionType: string;
  merchantCategory: string;
  mdrApplicable: boolean;
  rate: number;
  fixedCharge: number;
  calculatedMdr: number;
  capApplied: boolean;
  customerCharge: number;
  merchantImpact: string;
  ruleCode: string;
  explanation: string;
}

/**
 * Return type: either a compliant output object, or "MANUAL_REVIEW_REQUIRED"
 * if the transaction cannot be classified with complete deterministic certainty.
 */
export type MdrCalculationResult = MdrCalculationOutput | "MANUAL_REVIEW_REQUIRED";
