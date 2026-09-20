/**
 * Mock data for independent frontend development.
 * Used when VITE_API_BASE_URL is not set or USE_MOCK=true.
 */

import type { MDRResult } from "../types";

const now = new Date();
const ts = (offsetMinutes: number) =>
  new Date(now.getTime() - offsetMinutes * 60 * 1000).toISOString();

export const MOCK_HISTORY: MDRResult[] = [
  {
    id: "mock-001",
    timestamp: ts(5),
    amount: 25000,
    transactionType: "P2M",
    merchantCategory: "general",
    isSmallMerchant: false,
    mdrApplicable: true,
    mdrRate: 0.004,
    mdrRatePercent: "0.40%",
    estimatedFee: 100,
    merchantImpact:
      "An MDR fee of ₹100.00 (0.40%) is deducted from the merchant payout. Merchant receives ₹24,900.00.",
    exemptionReason: null,
    ruleApplied: "RULE_P2M_STANDARD: Standard commercial P2M transactions exceeding ₹2,000 attract 0.40% MDR",
    savedToDB: true,
  },
  {
    id: "mock-002",
    timestamp: ts(62),
    amount: 8500,
    transactionType: "P2M",
    merchantCategory: "essential",
    isSmallMerchant: false,
    mdrApplicable: true,
    mdrRate: 0,
    mdrRatePercent: "Flat ₹5.00",
    estimatedFee: 5,
    merchantImpact: "A flat MDR of ₹5.00 is deducted from settlement. Merchant receives ₹8,495.00.",
    exemptionReason: null,
    ruleApplied: "RULE_P2M_ESSENTIAL_FLAT: Essential services attract published flat ₹5.00 MDR for transactions > ₹2,000",
    savedToDB: true,
  },
  {
    id: "mock-003",
    timestamp: ts(190),
    amount: 50000,
    transactionType: "P2M",
    merchantCategory: "capital_market",
    isSmallMerchant: false,
    mdrApplicable: true,
    mdrRate: 0.0002,
    mdrRatePercent: "0.02%",
    estimatedFee: 10,
    merchantImpact:
      "An MDR fee of ₹10.00 (0.02%) is absorbed by the merchant. Merchant receives ₹49,990.00.",
    exemptionReason: null,
    ruleApplied: "RULE_P2M_CAPITAL_MARKET: Capital market special rate of 0.02% capped at ₹300 per transaction",
    savedToDB: true,
  },
  {
    id: "mock-004",
    timestamp: ts(300),
    amount: 1200,
    transactionType: "P2P",
    merchantCategory: "general",
    isSmallMerchant: false,
    mdrApplicable: false,
    mdrRate: 0,
    mdrRatePercent: "0.00%",
    estimatedFee: 0,
    merchantImpact: "No MDR fee applies to this transaction. You keep the full amount.",
    exemptionReason:
      "P2P (person-to-person) transfers are fully exempt from MDR under the Oct 2026 framework.",
    ruleApplied: "Rule 1: P2P transactions are MDR-exempt",
    savedToDB: true,
  },
  {
    id: "mock-005",
    timestamp: ts(480),
    amount: 3750,
    transactionType: "P2M",
    merchantCategory: "general",
    isSmallMerchant: true,
    mdrApplicable: false,
    mdrRate: 0,
    mdrRatePercent: "0.00%",
    estimatedFee: 0,
    merchantImpact: "No MDR fee applies to this transaction. You keep the full amount.",
    exemptionReason:
      "Eligible small merchants (as defined by NPCI criteria) are exempt from MDR on general P2M transactions.",
    ruleApplied: "Rule 3: P2M General — Eligible small merchant exemption applies",
    savedToDB: true,
  },
];

export const MOCK_AI_EXPLANATIONS: Record<string, string> = {
  // MDR applicable — general
  mdr_applicable:
    "Good news — you now know what to expect. Since your business falls under the General Merchant category and you're not registered as a small merchant, the new UPI MDR framework applies a 0.30% fee on P2M transactions. For this ₹25,000 transaction, that works out to ₹75. This fee is collected by your payment service provider, not the government.",

  // Exempt — essential
  exempt_essential:
    "Great news! Your sector — Essential Services — is fully exempt from UPI MDR under the October 2026 framework. That means you keep every rupee your customer pays. No fee will be deducted on this transaction.",

  // Exempt — small merchant
  exempt_small:
    "You're covered by the small merchant exemption. Because your business qualifies under NPCI's eligibility criteria for small merchants, no MDR applies here. You keep the full ₹3,750.",

  // Exempt — P2P
  exempt_p2p:
    "Person-to-person transfers are completely outside the MDR framework — they've always been free and remain so. No fee applies here at all.",

  // Capital market
  mdr_capital:
    "Capital market transactions carry a 0.50% MDR rate under the new framework. On this ₹50,000 transaction, that's ₹250. This is standard for investment platforms, stock brokers, and mutual fund providers, and reflects the regulatory treatment of financial services transactions.",
};
