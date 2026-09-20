/**
 * UPIwise API client.
 *
 * Mock mode is used when VITE_API_BASE_URL is not set.
 * Set VITE_API_BASE_URL in .env to switch to live AWS backend.
 */

import type {
  MDRInput,
  MDRResult,
  ExplainResponse,
  HistoryResponse,
} from "../types";
import { MOCK_HISTORY } from "./mockData";
import { calculateMdr } from "../../backend/rules/calculateMdr";
import type { MdrCalculationOutput } from "../../backend/rules/types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const USE_MOCK  = !BASE_URL;
const DEBUG     = import.meta.env.VITE_DEBUG === "true";

function log(...args: unknown[]) {
  if (DEBUG) console.log("[mdrService]", ...args);
}

// ── Deterministic MDR engine wrapper (mirrors backend/rules/calculateMdr) ────

function mockCalculateMDR(input: MDRInput): MDRResult {
  const { amount, transactionType, merchantCategory, isSmallMerchant } = input;
  const id        = `mock-${Date.now()}`;
  const timestamp = new Date().toISOString();

  // Call the deterministic 2026 UPI MDR calculation engine
  const calc = calculateMdr({
    amount,
    transactionType,
    merchantCategory,
    eligibleSmallMerchant: isSmallMerchant,
  });

  if (calc === "MANUAL_REVIEW_REQUIRED") {
    const fallback: MDRResult = {
      id,
      timestamp,
      amount,
      transactionType,
      merchantCategory,
      isSmallMerchant,
      mdrApplicable: false,
      mdrRate: 0,
      mdrRatePercent: "0.00%",
      estimatedFee: 0,
      merchantImpact: "Transaction cannot be classified automatically. Manual review required under NPCI compliance guidelines.",
      exemptionReason: "MANUAL_REVIEW_REQUIRED",
      ruleApplied: "MANUAL_REVIEW_REQUIRED: Unrecognized or non-standard transaction parameters",
      savedToDB: true,
    };
    MOCK_HISTORY.unshift(fallback);
    return fallback;
  }

  const out = calc as MdrCalculationOutput;
  const rateLabel = out.fixedCharge > 0 
    ? `Flat ₹${out.fixedCharge.toFixed(2)}` 
    : `${(out.rate * 100).toFixed(2)}%`;

  const res: MDRResult = {
    id,
    timestamp,
    amount: out.amount,
    transactionType,
    merchantCategory,
    isSmallMerchant,
    mdrApplicable: out.mdrApplicable,
    mdrRate: out.rate,
    mdrRatePercent: rateLabel,
    estimatedFee: out.calculatedMdr,
    merchantImpact: out.merchantImpact,
    exemptionReason: out.mdrApplicable ? null : out.explanation,
    ruleApplied: `${out.ruleCode}: ${out.explanation}`,
    savedToDB: true,
  };

  // Prepend to mock history for interactive state persistence
  MOCK_HISTORY.unshift(res);
  return res;
}

function mockExplain(result: MDRResult): ExplainResponse {
  const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const amt = fmt(result.amount);
  const fee = fmt(result.estimatedFee);
  const net = fmt(result.amount - result.estimatedFee);

  let explanation: string;

  if (result.transactionType === "P2P") {
    explanation = `Here is what this means for you: Person-to-Person (P2P) transfers are completely outside the UPI MDR framework. Under RBI/NPCI guidelines, peer payments are always 100% free with zero convenience surcharge. The recipient receives the full ${amt} without any deductions.`;
  } else if (result.merchantCategory === "essential") {
    explanation = `Great news for your business! Because your business operates in the Essential Sector (such as healthcare, fuel, government utilities, or agricultural retail), this transaction is completely exempt from MDR under the October 2026 framework. Your customer pays ${amt}, you receive the full ${net}, and no processing fee will be deducted by your payment service provider.`;
  } else if (result.isSmallMerchant) {
    explanation = `You are covered by the Small Merchant Exemption. Because your enterprise qualifies under NPCI's annual turnover threshold for small merchants, you are exempt from MDR on general retail payments. You keep the full ticket amount of ${amt} with zero payment processing fees, protecting your margins.`;
  } else if (result.merchantCategory === "capital_market") {
    explanation = `For financial institutions, brokerage platforms, and mutual fund houses, the regulatory framework applies a 0.50% MDR on UPI payments. On this ${amt} transaction, an MDR fee of ${fee} applies. Per NPCI regulations, this fee cannot be surcharged to the customer (customer charge remains ₹0.00 extra), meaning the fee is absorbed by your settlement, netting your account ${net}.`;
  } else {
    explanation = `Under the standard P2M General category, commercial merchants are subject to a 0.30% MDR rate. For this ${amt} payment, the estimated processing cost is ${fee}. Crucially, Indian payment regulations strictly prohibit passing this charge as a surcharge to your customer (customer pays ${amt} with ₹0.00 extra charge). Your settled bank account will receive ${net}.`;
  }

  return { explanation };
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const url = `${BASE_URL}${path}`;
  log("POST", url, body);
  const res  = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  log("Response", res.status, data);
  if (!res.ok) {
    const msg = (data as { error?: string; errors?: string[] }).error ||
                (data as { errors?: string[] }).errors?.join(", ") ||
                `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  log("GET", url.toString());
  const res  = await fetch(url.toString(), { headers: { "Content-Type": "application/json" } });
  const data = await res.json();
  log("Response", res.status, data);
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

// Fake delay to simulate real API latency in mock mode
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Public API ───────────────────────────────────────────────────────────────

/** Submit transaction to MDR rule engine. */
export async function calculateMDR(input: MDRInput): Promise<MDRResult> {
  if (USE_MOCK) { await delay(600); return mockCalculateMDR(input); }
  
  // Call AWS POST /analyze
  const payload = {
    amount: input.amount,
    transactionType: input.transactionType,
    merchantCategory: input.merchantCategory,
    eligibleSmallMerchant: input.isSmallMerchant,
    isSmallMerchant: input.isSmallMerchant,
  };

  const res = await post<Record<string, unknown>>("/analyze", payload);
  const data = (res.data || res) as Record<string, unknown>;
  const calcId = (data.calculationId || res.id || `calc-${Date.now()}`) as string;

  return {
    id: calcId,
    calculationId: calcId,
    timestamp: (data.timestamp || new Date().toISOString()) as string,
    amount: Number(data.amount || input.amount),
    transactionType: (data.transactionType || input.transactionType) as "P2P" | "P2M",
    merchantCategory: (data.merchantCategory || input.merchantCategory) as "general" | "essential" | "capital_market",
    isSmallMerchant: Boolean(data.eligibleSmallMerchant ?? input.isSmallMerchant),
    eligibleSmallMerchant: Boolean(data.eligibleSmallMerchant ?? input.isSmallMerchant),
    mdrApplicable: Boolean(data.mdrApplicable),
    mdrRate: typeof data.rate === "number" ? data.rate : (typeof res.mdrRate === "number" ? res.mdrRate : 0),
    mdrRatePercent: (res.mdrRatePercent || (data.fixedCharge ? `Flat ₹${data.fixedCharge}` : `${((data.rate as number || 0) * 100).toFixed(2)}%`)) as string,
    calculatedMdr: Number(data.calculatedMdr ?? res.estimatedFee ?? 0),
    customerCharge: Number(data.customerCharge ?? 0),
    estimatedFee: Number(data.calculatedMdr ?? res.estimatedFee ?? 0),
    merchantImpact: (data.merchantImpact || res.merchantImpact || "") as string,
    ruleCode: (data.ruleCode || "") as string,
    exemptionReason: (res.exemptionReason || (data.mdrApplicable ? null : data.explanation)) as string | null,
    ruleApplied: (res.ruleApplied || `${data.ruleCode || ""}: ${data.explanation || ""}`) as string,
    savedToDB: true,
  };
}

/** Request AI explanation of a pre-calculated MDR result. */
export async function explainMDR(result: MDRResult): Promise<ExplainResponse> {
  if (USE_MOCK) { await delay(1200); return mockExplain(result); }
  return post<ExplainResponse>("/explain", result);
}

/** Fetch recent calculations. */
export async function fetchHistory(limit = 10): Promise<HistoryResponse> {
  if (USE_MOCK) {
    await delay(400);
    return { items: MOCK_HISTORY.slice(0, limit), count: Math.min(MOCK_HISTORY.length, limit) };
  }
  
  const raw = await get<{ items: Array<Record<string, unknown>>; count: number }>("/history", { limit: String(limit) });
  const items: MDRResult[] = (raw.items || []).map((item) => {
    const id = (item.calculationId || item.id || `hist-${Date.now()}`) as string;
    const fee = Number(item.calculatedMdr ?? item.estimatedFee ?? 0);
    const rate = Number(item.rate ?? item.mdrRate ?? 0);
    const rateLabel = item.fixedCharge
      ? `Flat ₹${Number(item.fixedCharge).toFixed(2)}`
      : `${(rate * 100).toFixed(2)}%`;

    return {
      id,
      calculationId: id,
      timestamp: String(item.timestamp || new Date().toISOString()),
      amount: Number(item.amount || 0),
      transactionType: (item.transactionType || "P2M") as "P2P" | "P2M",
      merchantCategory: (item.merchantCategory || "general") as "general" | "essential" | "capital_market",
      isSmallMerchant: Boolean(item.eligibleSmallMerchant ?? item.isSmallMerchant),
      eligibleSmallMerchant: Boolean(item.eligibleSmallMerchant ?? item.isSmallMerchant),
      mdrApplicable: Boolean(item.mdrApplicable),
      mdrRate: rate,
      mdrRatePercent: String(item.mdrRatePercent || rateLabel),
      calculatedMdr: fee,
      customerCharge: Number(item.customerCharge ?? 0),
      estimatedFee: fee,
      merchantImpact: String(item.merchantImpact || ""),
      ruleCode: String(item.ruleCode || ""),
      exemptionReason: (item.exemptionReason || (item.mdrApplicable ? null : item.explanation)) as string | null,
      ruleApplied: String(item.ruleApplied || `${item.ruleCode || ""}: ${item.explanation || ""}`),
      savedToDB: true,
    };
  });

  return { items, count: items.length };
}

/** Whether mock mode is active (for UI indicator). */
export const isMockMode = USE_MOCK;
