// ── Domain types — mirror Lambda types exactly ─────────────────────────────

export type TransactionType    = "P2P" | "P2M";
export type MerchantCategory   = "general" | "essential" | "capital_market";

export interface MDRInput {
  amount:            number;
  transactionType:   TransactionType;
  merchantCategory:  MerchantCategory;
  isSmallMerchant:   boolean;
}

export interface MDRResult {
  id:               string;
  calculationId?:   string;          // DynamoDB Partition Key
  timestamp:        string;          // ISO 8601
  amount:           number;
  transactionType:  TransactionType;
  merchantCategory: MerchantCategory;
  isSmallMerchant:  boolean;
  eligibleSmallMerchant?: boolean;
  mdrApplicable:    boolean;
  mdrRate:          number;          // e.g. 0.004
  mdrRatePercent:   string;          // e.g. "0.40%"
  calculatedMdr?:   number;
  customerCharge?:  number;
  estimatedFee:     number;
  merchantImpact:   string;
  exemptionReason:  string | null;
  ruleCode?:        string;
  ruleApplied:      string;
  savedToDB?:       boolean;
}

export interface ExplainResponse {
  explanation: string;
  fallback?:   boolean;
  note?:       string;
}

export interface HistoryResponse {
  items: MDRResult[];
  count: number;
}

// ── UI summary stats ────────────────────────────────────────────────────────

export interface SummaryStats {
  totalAnalyzed:      number;
  estimatedMDRMonth:  number;   // total MDR fees in current month
  lastAnalysis:       string | null;  // ISO timestamp or null
}
