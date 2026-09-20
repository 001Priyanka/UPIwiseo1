/**
 * Comprehensive Unit Tests for the Deterministic UPI MDR Calculation Engine.
 * 
 * Verifies all boundary cases specified by the 2026 UPI MDR Framework:
 * - ₹1,999 (sub-2000 zero MDR threshold)
 * - ₹2,000 (exact 2000 threshold boundary)
 * - ₹2,001 (above 2000 threshold, standard 0.40% begins)
 * - ₹75,000 (cap threshold: 75,000 * 0.40% = ₹300.00 cap reached)
 * - ₹75,001 (above cap threshold: 75,001 * 0.40% = 300.004 -> capped at ₹300.00)
 * - P2P high-value transaction (always zero MDR regardless of amount)
 * - Small merchant (eligible small merchant exemption -> zero MDR)
 * - Essential sector (flat ₹5 MDR for > ₹2,000)
 * - Capital-market transaction (0.02% capped at ₹300)
 * - Unclassifiable / invalid cases ("MANUAL_REVIEW_REQUIRED")
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateMdr } from "./calculateMdr";
import { MDR_RULES_CONFIG } from "./mdrRules";
import type { MdrCalculationOutput } from "./types";

describe("Deterministic 2026 UPI MDR Calculation Engine", () => {
  // ── Architecture & Rules Configuration Tests ──────────────────────────────
  it("represents rules as explicit data configuration rather than procedural if/else", () => {
    assert.strictEqual(Array.isArray(MDR_RULES_CONFIG), true);
    assert.strictEqual(MDR_RULES_CONFIG.length >= 6, true);

    for (const rule of MDR_RULES_CONFIG) {
      assert.strictEqual(typeof rule.ruleCode, "string");
      assert.strictEqual(typeof rule.sourceReference, "string");
      assert.strictEqual(typeof rule.pricingType, "string");
      assert.strictEqual(typeof rule.applies, "function");
      assert.strictEqual(typeof rule.explanation, "function");
      assert.strictEqual(typeof rule.merchantImpact, "function");
    }
  });

  // ── Boundary Case 1: ₹1,999 (Micro-payment threshold) ─────────────────────
  it("evaluates boundary case ₹1,999: zero MDR for standard P2M <= ₹2,000", () => {
    const result = calculateMdr({
      amount: 1999,
      transactionType: "P2M",
      merchantCategory: "standard",
      eligibleSmallMerchant: false,
    });

    assert.notStrictEqual(result, "MANUAL_REVIEW_REQUIRED");
    const out = result as MdrCalculationOutput;
    assert.strictEqual(out.amount, 1999);
    assert.strictEqual(out.mdrApplicable, false);
    assert.strictEqual(out.rate, 0);
    assert.strictEqual(out.fixedCharge, 0);
    assert.strictEqual(out.calculatedMdr, 0);
    assert.strictEqual(out.capApplied, false);
    assert.strictEqual(out.customerCharge, 0);
    assert.strictEqual(out.ruleCode, "RULE_P2M_SUB_2000_ZERO_MDR");
    assert.strictEqual(out.explanation.includes("zero-rated"), true);
  });

  // ── Boundary Case 2: ₹2,000 (Exact threshold boundary) ────────────────────
  it("evaluates boundary case ₹2,000: zero MDR for standard P2M exactly at ₹2,000", () => {
    const result = calculateMdr({
      amount: 2000,
      transactionType: "P2M",
      merchantCategory: "general",
      eligibleSmallMerchant: false,
    });

    assert.notStrictEqual(result, "MANUAL_REVIEW_REQUIRED");
    const out = result as MdrCalculationOutput;
    assert.strictEqual(out.amount, 2000);
    assert.strictEqual(out.mdrApplicable, false);
    assert.strictEqual(out.rate, 0);
    assert.strictEqual(out.fixedCharge, 0);
    assert.strictEqual(out.calculatedMdr, 0);
    assert.strictEqual(out.capApplied, false);
    assert.strictEqual(out.customerCharge, 0);
    assert.strictEqual(out.ruleCode, "RULE_P2M_SUB_2000_ZERO_MDR");
  });

  // ── Boundary Case 3: ₹2,001 (First rupee above threshold) ──────────────────
  it("evaluates boundary case ₹2,001: standard 0.40% MDR applies above ₹2,000", () => {
    const result = calculateMdr({
      amount: 2001,
      transactionType: "P2M",
      merchantCategory: "standard",
      eligibleSmallMerchant: false,
    });

    assert.notStrictEqual(result, "MANUAL_REVIEW_REQUIRED");
    const out = result as MdrCalculationOutput;
    assert.strictEqual(out.amount, 2001);
    assert.strictEqual(out.mdrApplicable, true);
    assert.strictEqual(out.rate, 0.004); // 0.40%
    assert.strictEqual(out.fixedCharge, 0);
    // 2001 * 0.004 = 8.004 -> rounded to 8.00
    assert.strictEqual(out.calculatedMdr, 8.00);
    assert.strictEqual(out.capApplied, false);
    assert.strictEqual(out.customerCharge, 0);
    assert.strictEqual(out.ruleCode, "RULE_P2M_STANDARD");
  });

  // ── Boundary Case 4: ₹75,000 (Exact Cap Boundary) ─────────────────────────
  it("evaluates boundary case ₹75,000: reaches the ₹300.00 cap threshold exactly", () => {
    const result = calculateMdr({
      amount: 75000,
      transactionType: "P2M",
      merchantCategory: "standard",
      eligibleSmallMerchant: false,
    });

    assert.notStrictEqual(result, "MANUAL_REVIEW_REQUIRED");
    const out = result as MdrCalculationOutput;
    assert.strictEqual(out.amount, 75000);
    assert.strictEqual(out.mdrApplicable, true);
    assert.strictEqual(out.rate, 0.004);
    // 75000 * 0.004 = 300.00
    assert.strictEqual(out.calculatedMdr, 300.00);
    assert.strictEqual(out.capApplied, true);
    assert.strictEqual(out.customerCharge, 0);
    assert.strictEqual(out.ruleCode, "RULE_P2M_STANDARD");
  });

  // ── Boundary Case 5: ₹75,001 (Exceeding the Cap Boundary) ──────────────────
  it("evaluates boundary case ₹75,001: capped at maximum ₹300.00 per transaction", () => {
    const result = calculateMdr({
      amount: 75001,
      transactionType: "P2M",
      merchantCategory: "standard",
      eligibleSmallMerchant: false,
    });

    assert.notStrictEqual(result, "MANUAL_REVIEW_REQUIRED");
    const out = result as MdrCalculationOutput;
    assert.strictEqual(out.amount, 75001);
    assert.strictEqual(out.mdrApplicable, true);
    assert.strictEqual(out.rate, 0.004);
    // 75001 * 0.004 = 300.004 -> clamped to ₹300.00 cap
    assert.strictEqual(out.calculatedMdr, 300.00);
    assert.strictEqual(out.capApplied, true);
    assert.strictEqual(out.customerCharge, 0);
    assert.strictEqual(out.ruleCode, "RULE_P2M_STANDARD");
  });

  // ── Case 6: P2P High-Value Transaction ────────────────────────────────────
  it("evaluates P2P high-value transaction (₹1,00,000): always zero MDR without ceiling", () => {
    const result = calculateMdr({
      amount: 100000,
      transactionType: "P2P",
      merchantCategory: "standard",
      eligibleSmallMerchant: false,
    });

    assert.notStrictEqual(result, "MANUAL_REVIEW_REQUIRED");
    const out = result as MdrCalculationOutput;
    assert.strictEqual(out.amount, 100000);
    assert.strictEqual(out.transactionType, "P2P");
    assert.strictEqual(out.mdrApplicable, false);
    assert.strictEqual(out.rate, 0);
    assert.strictEqual(out.fixedCharge, 0);
    assert.strictEqual(out.calculatedMdr, 0);
    assert.strictEqual(out.capApplied, false);
    assert.strictEqual(out.customerCharge, 0);
    assert.strictEqual(out.ruleCode, "RULE_P2P_ZERO_MDR");
    assert.strictEqual(out.merchantImpact.includes("No MDR fee applies"), true);
  });

  // ── Case 7: Small Merchant Exemption ──────────────────────────────────────
  it("evaluates eligible small merchant: exempt from MDR on P2M > ₹2,000", () => {
    const result = calculateMdr({
      amount: 50000,
      transactionType: "P2M",
      merchantCategory: "general",
      eligibleSmallMerchant: true,
    });

    assert.notStrictEqual(result, "MANUAL_REVIEW_REQUIRED");
    const out = result as MdrCalculationOutput;
    assert.strictEqual(out.amount, 50000);
    assert.strictEqual(out.mdrApplicable, false);
    assert.strictEqual(out.rate, 0);
    assert.strictEqual(out.fixedCharge, 0);
    assert.strictEqual(out.calculatedMdr, 0);
    assert.strictEqual(out.capApplied, false);
    assert.strictEqual(out.customerCharge, 0);
    assert.strictEqual(out.ruleCode, "RULE_P2M_SMALL_MERCHANT_ZERO_MDR");
  });

  // ── Case 8: Essential Sector ──────────────────────────────────────────────
  it("evaluates essential sector > ₹2,000 (₹15,000 in fuel/utilities): published flat ₹5 MDR", () => {
    const result = calculateMdr({
      amount: 15000,
      transactionType: "P2M",
      merchantCategory: "essential",
      eligibleSmallMerchant: false,
    });

    assert.notStrictEqual(result, "MANUAL_REVIEW_REQUIRED");
    const out = result as MdrCalculationOutput;
    assert.strictEqual(out.amount, 15000);
    assert.strictEqual(out.mdrApplicable, true);
    assert.strictEqual(out.rate, 0);
    assert.strictEqual(out.fixedCharge, 5);
    assert.strictEqual(out.calculatedMdr, 5.00);
    assert.strictEqual(out.capApplied, false);
    assert.strictEqual(out.customerCharge, 0);
    assert.strictEqual(out.ruleCode, "RULE_P2M_ESSENTIAL_FLAT");
    assert.strictEqual(out.merchantImpact.toLowerCase().includes("flat mdr of ₹5.00"), true);
  });

  it("evaluates essential sector <= ₹2,000 (₹1,500): zero MDR under micro-payment threshold", () => {
    const result = calculateMdr({
      amount: 1500,
      transactionType: "P2M",
      merchantCategory: "essential",
      eligibleSmallMerchant: false,
    });

    assert.notStrictEqual(result, "MANUAL_REVIEW_REQUIRED");
    const out = result as MdrCalculationOutput;
    assert.strictEqual(out.calculatedMdr, 0);
    assert.strictEqual(out.mdrApplicable, false);
    assert.strictEqual(out.ruleCode, "RULE_P2M_SUB_2000_ZERO_MDR");
  });

  // ── Case 9: Capital-Market Transaction ────────────────────────────────────
  it("evaluates capital-market transaction > ₹2,000 (₹1,00,000 mutual fund): special 0.02% rate", () => {
    const result = calculateMdr({
      amount: 100000,
      transactionType: "P2M",
      merchantCategory: "capital_market",
      eligibleSmallMerchant: false,
    });

    assert.notStrictEqual(result, "MANUAL_REVIEW_REQUIRED");
    const out = result as MdrCalculationOutput;
    assert.strictEqual(out.amount, 100000);
    assert.strictEqual(out.mdrApplicable, true);
    assert.strictEqual(out.rate, 0.0002); // 0.02%
    assert.strictEqual(out.fixedCharge, 0);
    // 100000 * 0.0002 = 20.00
    assert.strictEqual(out.calculatedMdr, 20.00);
    assert.strictEqual(out.capApplied, false);
    assert.strictEqual(out.customerCharge, 0);
    assert.strictEqual(out.ruleCode, "RULE_P2M_CAPITAL_MARKET");
  });

  it("evaluates capital-market transaction hitting the ₹300 cap (₹20,00,000)", () => {
    const result = calculateMdr({
      amount: 2000000,
      transactionType: "P2M",
      merchantCategory: "capital_market",
      eligibleSmallMerchant: false,
    });

    assert.notStrictEqual(result, "MANUAL_REVIEW_REQUIRED");
    const out = result as MdrCalculationOutput;
    // 2,000,000 * 0.0002 = 400.00 -> capped at ₹300.00
    assert.strictEqual(out.calculatedMdr, 300.00);
    assert.strictEqual(out.capApplied, true);
    assert.strictEqual(out.ruleCode, "RULE_P2M_CAPITAL_MARKET");
  });

  // ── Case 10: Manual Review Required for Unclassifiable Cases ──────────────
  it("returns 'MANUAL_REVIEW_REQUIRED' for invalid or ambiguous cases", () => {
    // Negative amount
    assert.strictEqual(
      calculateMdr({
        amount: -500,
        transactionType: "P2M",
        merchantCategory: "standard",
        eligibleSmallMerchant: false,
      }),
      "MANUAL_REVIEW_REQUIRED"
    );

    // Zero amount
    assert.strictEqual(
      calculateMdr({
        amount: 0,
        transactionType: "P2M",
        merchantCategory: "standard",
        eligibleSmallMerchant: false,
      }),
      "MANUAL_REVIEW_REQUIRED"
    );

    // Invalid transaction type
    assert.strictEqual(
      calculateMdr({
        amount: 5000,
        transactionType: "B2B",
        merchantCategory: "standard",
        eligibleSmallMerchant: false,
      }),
      "MANUAL_REVIEW_REQUIRED"
    );

    // Unrecognized merchant category on P2M
    assert.strictEqual(
      calculateMdr({
        amount: 5000,
        transactionType: "P2M",
        merchantCategory: "unrecognized_crypto_derivatives",
        eligibleSmallMerchant: false,
      }),
      "MANUAL_REVIEW_REQUIRED"
    );

    // Missing merchant category on P2M
    assert.strictEqual(
      calculateMdr({
        amount: 5000,
        transactionType: "P2M",
        merchantCategory: "",
        eligibleSmallMerchant: false,
      }),
      "MANUAL_REVIEW_REQUIRED"
    );

    // NaN amount
    assert.strictEqual(
      calculateMdr({
        amount: Number.NaN,
        transactionType: "P2M",
        merchantCategory: "standard",
        eligibleSmallMerchant: false,
      }),
      "MANUAL_REVIEW_REQUIRED"
    );
  });

  // ── Verification: Determinism & Zero Customer Surcharge ────────────────────
  it("strictly enforces zero customer surcharge across all transaction types", () => {
    const testCases = [
      { amount: 1500, type: "P2M", cat: "standard", small: false },
      { amount: 5000, type: "P2M", cat: "standard", small: false },
      { amount: 80000, type: "P2M", cat: "standard", small: false },
      { amount: 10000, type: "P2M", cat: "essential", small: false },
      { amount: 50000, type: "P2M", cat: "capital_market", small: false },
      { amount: 25000, type: "P2P", cat: "n/a", small: false },
    ];

    for (const tc of testCases) {
      const res = calculateMdr({
        amount: tc.amount,
        transactionType: tc.type,
        merchantCategory: tc.cat,
        eligibleSmallMerchant: tc.small,
      });
      assert.notStrictEqual(res, "MANUAL_REVIEW_REQUIRED");
      const out = res as MdrCalculationOutput;
      assert.strictEqual(out.customerCharge, 0);
    }
  });
});
