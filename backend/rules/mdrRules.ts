/**
 * Explicit Configuration and Rule Definitions for 2026 UPI MDR Framework.
 * 
 * Rules are represented as explicit data definitions with matching predicates
 * and pricing metadata, rather than a giant procedural if/else block.
 * 
 * Regulatory Sources:
 * - NPCI (National Payments Corporation of India) Framework on Merchant Discount Rate (MDR) for UPI (Oct 2026).
 * - Reserve Bank of India (RBI) Payment and Settlement Systems Act Directives on Zero-Surcharge for Customers.
 * - Ministry of Finance Digital Payment Incentive & Small Merchant Exemption Scheme.
 * - SEBI-NPCI Directives on UPI Charges for Capital Market Transactions.
 */

import type { MdrRule, ValidatedMdrInput, CalculatedDetails } from "./types";

// ── Category Normalizers & Helpers ──────────────────────────────────────────

const ESSENTIAL_CATEGORIES = new Set([
  "essential",
  "essential_services",
  "essential_sector",
  "railways",
  "telecom",
  "telecommunications",
  "insurance",
  "fuel",
  "utilities",
  "utility_bills",
  "agriculture",
]);

const CAPITAL_MARKET_CATEGORIES = new Set([
  "capital_market",
  "capital_markets",
  "securities",
  "mutual_funds",
  "stockbroker",
  "stockbrokers",
  "investments",
]);

const STANDARD_CATEGORIES = new Set([
  "standard",
  "general",
  "retail",
  "commercial",
  "e-commerce",
  "ecommerce",
]);

export function isEssentialCategory(cat: string): boolean {
  return ESSENTIAL_CATEGORIES.has(cat.toLowerCase().trim());
}

export function isCapitalMarketCategory(cat: string): boolean {
  return CAPITAL_MARKET_CATEGORIES.has(cat.toLowerCase().trim());
}

export function isStandardCategory(cat: string): boolean {
  return STANDARD_CATEGORIES.has(cat.toLowerCase().trim());
}

export function isRecognizedMerchantCategory(cat: string): boolean {
  const norm = cat.toLowerCase().trim();
  return (
    ESSENTIAL_CATEGORIES.has(norm) ||
    CAPITAL_MARKET_CATEGORIES.has(norm) ||
    STANDARD_CATEGORIES.has(norm)
  );
}

// ── Currency Formatting Helper ──────────────────────────────────────────────

function fmtINR(val: number): string {
  return "₹" + val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Explicit MDR Rules Configuration Table ──────────────────────────────────
// Ordered by priority:
// 1. P2P transfers (always zero MDR)
// 2. Small merchant exemption (zero MDR)
// 3. P2M transactions up to ₹2,000 (zero MDR threshold)
// 4. Essential sectors > ₹2,000 (flat ₹5)
// 5. Capital market transactions > ₹2,000 (0.02% capped at ₹300)
// 6. Standard P2M transactions > ₹2,000 (0.40% capped at ₹300)

export const MDR_RULES_CONFIG: readonly MdrRule[] = [
  /**
   * Rule 1: P2P Zero-MDR
   * Source: RBI / NPCI Guidelines on Unified Payments Interface (UPI) P2P Architecture.
   * Clause: Person-to-person (P2P) transfers are non-commercial remittances and are strictly exempt
   * from Merchant Discount Rate (MDR) without any value ceiling.
   */
  {
    ruleCode: "RULE_P2P_ZERO_MDR",
    name: "Person-to-Person (P2P) Transfer Zero-MDR Exemption",
    sourceReference: "NPCI UPI Operating Guidelines — Section: P2P Remittance MDR Exemption",
    pricingType: "ZERO_MDR",
    rate: 0,
    fixedCharge: 0,
    cap: null,
    applies: (input: ValidatedMdrInput) => input.transactionType === "P2P",
    explanation: (input: ValidatedMdrInput) =>
      `Person-to-Person (P2P) transfers of ${fmtINR(input.amount)} are completely exempt from MDR under RBI and NPCI guidelines. Peer transfers remain 100% free with zero convenience surcharge.`,
    merchantImpact: (input: ValidatedMdrInput) =>
      `No MDR fee applies to this transaction. Recipient receives the full ${fmtINR(input.amount)}.`,
  },

  /**
   * Rule 2: Small Merchant Exemption (Zero-MDR)
   * Source: Ministry of Finance & NPCI Zero-MDR Incentive Framework for Eligible Small Merchants.
   * Clause: Small merchants (turnover below the statutory threshold) are exempt from MDR on all
   * P2M transactions to encourage digital adoption at the grassroots level.
   */
  {
    ruleCode: "RULE_P2M_SMALL_MERCHANT_ZERO_MDR",
    name: "Eligible Small Merchant Zero-MDR Framework",
    sourceReference: "Ministry of Finance & NPCI 2026 Small Merchant Zero-MDR Directive",
    pricingType: "ZERO_MDR",
    rate: 0,
    fixedCharge: 0,
    cap: null,
    applies: (input: ValidatedMdrInput) =>
      input.transactionType === "P2M" && input.eligibleSmallMerchant === true,
    explanation: (input: ValidatedMdrInput) =>
      `The merchant qualifies under the statutory Small Merchant Exemption. Under the applicable zero-MDR framework, no MDR is levied on this ${fmtINR(input.amount)} payment.`,
    merchantImpact: (input: ValidatedMdrInput) =>
      `Zero MDR is deducted under the Small Merchant Exemption. Merchant receives the full ${fmtINR(input.amount)}.`,
  },

  /**
   * Rule 3: P2M Micro-Transactions (Up to ₹2,000)
   * Source: Gazette of India / NPCI Circular on Rationalization of MDR for Micro-Payments.
   * Clause: P2M transactions with ticket value up to ₹2,000 (inclusive) attract zero MDR across
   * all merchant categories.
   */
  {
    ruleCode: "RULE_P2M_SUB_2000_ZERO_MDR",
    name: "P2M Micro-Transaction Threshold Exemption (Up to ₹2,000)",
    sourceReference: "NPCI Circular / Gazette Notification — UPI P2M Threshold Exemption (<= ₹2,000)",
    pricingType: "ZERO_MDR",
    rate: 0,
    fixedCharge: 0,
    cap: null,
    applies: (input: ValidatedMdrInput) =>
      input.transactionType === "P2M" && input.amount <= 2000,
    explanation: (input: ValidatedMdrInput) =>
      `Under the 2026 UPI MDR framework, P2M transactions up to ₹2,000 are zero-rated for MDR. For this ${fmtINR(input.amount)} payment, no fee applies.`,
    merchantImpact: (input: ValidatedMdrInput) =>
      `No MDR fee applies for transactions up to ₹2,000. Merchant receives the full ${fmtINR(input.amount)}.`,
  },

  /**
   * Rule 4: Essential Sectors (Amount > ₹2,000)
   * Source: NPCI 2026 MDR Framework for Essential & Utility Services.
   * Clause: Low-margin and essential sectors (including railways, telecommunications, insurance, fuel,
   * utilities, and agricultural inputs) carry a published flat MDR of ₹5 per transaction for amounts exceeding ₹2,000.
   */
  {
    ruleCode: "RULE_P2M_ESSENTIAL_FLAT",
    name: "Essential Services Flat MDR Framework (> ₹2,000)",
    sourceReference: "NPCI Special Schedule for Essential Services & Utilities (Effective Oct 2026)",
    pricingType: "FLAT_FEE",
    rate: 0,
    fixedCharge: 5,
    cap: null,
    applies: (input: ValidatedMdrInput) =>
      input.transactionType === "P2M" &&
      isEssentialCategory(input.merchantCategory) &&
      input.amount > 2000,
    explanation: (input: ValidatedMdrInput, details: CalculatedDetails) =>
      `Because this transaction belongs to the Essential Sector (${input.merchantCategory}) and exceeds ₹2,000, it attracts the published flat MDR of ${fmtINR(details.fixedCharge)}. Surcharging the customer is strictly prohibited.`,
    merchantImpact: (_input: ValidatedMdrInput, details: CalculatedDetails) =>
      `A flat MDR of ${fmtINR(details.calculatedMdr)} is deducted from settlement. Merchant receives ${fmtINR(details.netMerchantPayout)}.`,
  },

  /**
   * Rule 5: Capital Market Transactions (Amount > ₹2,000)
   * Source: SEBI & NPCI Unified Directives on Capital Market UPI Payments.
   * Clause: Transactions for mutual funds, stockbrokers, securities, and investments exceeding ₹2,000
   * are subject to a published special rate of 0.02% of the transaction value, capped at ₹300 per transaction.
   */
  {
    ruleCode: "RULE_P2M_CAPITAL_MARKET",
    name: "Capital Market Special Rate & Cap Framework (> ₹2,000)",
    sourceReference: "SEBI-NPCI Regulatory Circular on Capital Market UPI Settlements (Effective Oct 2026)",
    pricingType: "PERCENTAGE_WITH_CAP",
    rate: 0.0002, // 0.02%
    fixedCharge: 0,
    cap: 300,
    applies: (input: ValidatedMdrInput) =>
      input.transactionType === "P2M" &&
      isCapitalMarketCategory(input.merchantCategory) &&
      input.amount > 2000,
    explanation: (input: ValidatedMdrInput, details: CalculatedDetails) =>
      `Capital market payments exceeding ₹2,000 carry the published special rate of 0.02% (0.0002), capped at ₹300.00. For this ${fmtINR(input.amount)} transaction, the calculated MDR is ${fmtINR(details.calculatedMdr)}${details.capApplied ? " (maximum ₹300 cap applied)" : ""}. Zero surcharge is passed to the investor.`,
    merchantImpact: (_input: ValidatedMdrInput, details: CalculatedDetails) =>
      `An MDR fee of ${fmtINR(details.calculatedMdr)} (0.02%${details.capApplied ? ", capped at ₹300" : ""}) is absorbed by the merchant. Merchant receives ${fmtINR(details.netMerchantPayout)}.`,
  },

  /**
   * Rule 6: Standard Commercial P2M Transactions (Amount > ₹2,000)
   * Source: Ministry of Finance & NPCI Published 2026 UPI MDR Framework.
   * Clause: Standard eligible P2M transactions exceeding ₹2,000 attract a standard rate of 0.40% (0.004),
   * with a hard cap of ₹300 per transaction applicable at ₹75,000 and above (₹75,000 × 0.40% = ₹300.00).
   */
  {
    ruleCode: "RULE_P2M_STANDARD",
    name: "Standard Commercial P2M Rate & Cap Framework (> ₹2,000)",
    sourceReference: "NPCI & MoF Official 2026 UPI MDR Framework — Standard P2M Commercial Schedule",
    pricingType: "PERCENTAGE_WITH_CAP",
    rate: 0.004, // 0.40%
    fixedCharge: 0,
    cap: 300,
    applies: (input: ValidatedMdrInput) =>
      input.transactionType === "P2M" &&
      (isStandardCategory(input.merchantCategory) || input.merchantCategory === "") &&
      input.amount > 2000,
    explanation: (input: ValidatedMdrInput, details: CalculatedDetails) =>
      `Standard commercial P2M transactions exceeding ₹2,000 are subject to a 0.40% MDR rate, capped at ₹300.00 per transaction (reached at ₹75,000). For ${fmtINR(input.amount)}, the MDR is ${fmtINR(details.calculatedMdr)}${details.capApplied ? " (maximum ₹300.00 cap applied)" : ""}. The customer cannot be surcharged under NPCI rules.`,
    merchantImpact: (_input: ValidatedMdrInput, details: CalculatedDetails) =>
      `An MDR fee of ${fmtINR(details.calculatedMdr)} (${(details.rate * 100).toFixed(2)}%${details.capApplied ? ", capped at ₹300" : ""}) is deducted from the merchant payout. Merchant receives ${fmtINR(details.netMerchantPayout)}.`,
  },
];
