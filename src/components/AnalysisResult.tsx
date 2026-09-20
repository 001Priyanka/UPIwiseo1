import type { ReactNode } from "react";
import type { MDRResult } from "../types";

interface Props {
  result:      MDRResult;
  onExplain:   () => void;
  isExplaining: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  general:        "General Merchant",
  essential:      "Essential Sector (Healthcare, Fuel, Utilities)",
  capital_market: "Capital Market & Investments",
};

function Divider() {
  return <div className="border-t border-slate-100" />;
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-xs sm:text-sm text-slate-500 font-medium">{label}</span>
      <span className="text-xs sm:text-sm font-semibold text-slate-900 text-right">{value}</span>
    </div>
  );
}

export default function AnalysisResult({ result, onExplain, isExplaining }: Props) {
  const {
    mdrApplicable, mdrRatePercent, estimatedFee,
    merchantImpact, exemptionReason, ruleApplied,
    amount, transactionType, merchantCategory, isSmallMerchant,
  } = result;

  const fmtINR = (n: number) =>
    "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  return (
    <div className="card overflow-hidden border border-slate-200 shadow-sm" role="region" aria-label="Analysis result">

      {/* ── 1. Status Bar: MDR Applicable ────────────────────────── */}
      <div className={`px-6 py-4 flex items-center justify-between gap-3 border-b ${
        mdrApplicable 
          ? "bg-amber-50/80 border-amber-200" 
          : "bg-emerald-50/80 border-emerald-200"
      }`}>
        <div className="flex items-center gap-3">
          <span
            className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
              mdrApplicable ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
            }`}
            aria-hidden="true"
          >
            {mdrApplicable ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className={`text-sm font-bold ${mdrApplicable ? "text-amber-900" : "text-emerald-900"}`}>
                {mdrApplicable ? "MDR Applicable" : "MDR Exempt"}
              </p>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
                mdrApplicable ? "bg-amber-200 text-amber-900" : "bg-emerald-200 text-emerald-900"
              }`}>
                {mdrApplicable ? `${mdrRatePercent} Fee` : "0.00% (Free)"}
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${mdrApplicable ? "text-amber-700" : "text-emerald-700"}`}>
              {mdrApplicable
                ? `Standard regulatory MDR rate of ${mdrRatePercent} applies to this transaction`
                : "Zero payment processing fee under RBI / NPCI exemption rules"}
            </p>
          </div>
        </div>
      </div>

      {/* ── 2 & 3. Key Metrics: MDR Amount & Customer Charge ─────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 bg-white">
        <div className="px-5 py-4">
          <p className="section-label">Transaction Amount</p>
          <p className="text-lg font-bold mt-1 tabular text-slate-900">{fmtINR(amount)}</p>
          <p className="text-xs text-slate-400 mt-0.5">gross invoice value</p>
        </div>

        <div className="px-5 py-4">
          <p className="section-label">MDR Amount</p>
          <p className={`text-lg font-bold mt-1 tabular ${mdrApplicable ? "text-amber-600" : "text-emerald-600"}`}>
            {mdrApplicable ? fmtINR(estimatedFee) : "₹0.00"}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {mdrApplicable ? `${mdrRatePercent} processing cost` : "no processing fee"}
          </p>
        </div>

        <div className="px-5 py-4">
          <p className="section-label">Customer Charge</p>
          <p className="text-lg font-bold mt-1 tabular text-emerald-600">₹0.00</p>
          <p className="text-xs text-slate-400 mt-0.5">zero customer surcharge</p>
        </div>

        <div className="px-5 py-4">
          <p className="section-label">Merchant Receives</p>
          <p className="text-lg font-bold mt-1 tabular text-brand-700">
            {fmtINR(amount - estimatedFee)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">net payout settled</p>
        </div>
      </div>

      <Divider />

      {/* ── 4. Merchant Impact ─────────────────────────────────── */}
      <div className="px-6 py-4.5 bg-surface-50/50">
        <div className="flex items-center justify-between mb-2">
          <p className="section-label">Merchant Impact</p>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            Settlement Breakdown
          </span>
        </div>
        
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-2 mb-2">
          <div className="flex justify-between text-xs text-slate-600">
            <span>Customer Payment:</span>
            <span className="font-semibold text-slate-900">{fmtINR(amount)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-600">
            <span>Customer Extra Surcharge:</span>
            <span className="font-medium text-emerald-600">₹0.00 (Prohibited under NPCI rules)</span>
          </div>
          <div className="flex justify-between text-xs text-slate-600">
            <span>MDR Fee Absorbed by Merchant:</span>
            <span className={`font-semibold ${mdrApplicable ? "text-amber-700" : "text-emerald-700"}`}>
              {mdrApplicable ? `-${fmtINR(estimatedFee)} (${mdrRatePercent})` : "₹0.00 (Exempt)"}
            </span>
          </div>
          <div className="border-t border-slate-100 pt-1.5 flex justify-between text-xs font-bold text-slate-900">
            <span>Net Merchant Payout:</span>
            <span className="text-brand-700 text-sm">{fmtINR(amount - estimatedFee)}</span>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          {merchantImpact}
        </p>
      </div>

      {/* Exemption Reason Callout if exempt */}
      {exemptionReason && (
        <>
          <Divider />
          <div className="px-6 py-3.5 bg-emerald-50/70 border-l-4 border-emerald-500">
            <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Exemption Justification</p>
            <p className="text-xs text-emerald-800 mt-1 leading-relaxed">{exemptionReason}</p>
          </div>
        </>
      )}

      <Divider />

      {/* ── 5. Rule Explanation ────────────────────────────────── */}
      <div className="px-6 py-4.5">
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">Rule Explanation</p>
          <span className="text-[11px] text-slate-400 font-medium">RBI / NPCI Regulatory Framework</span>
        </div>

        <div className="card-inset px-4 py-2 space-y-0 text-sm">
          <MetaRow
            label="Transaction Type"
            value={transactionType === "P2M" ? "P2M (Person to Merchant)" : "P2P (Person to Person)"}
          />
          <Divider />
          <MetaRow
            label="Merchant Category"
            value={CATEGORY_LABELS[merchantCategory] ?? merchantCategory}
          />
          {transactionType === "P2M" && merchantCategory === "general" && (
            <>
              <Divider />
              <MetaRow
                label="Small Merchant Status"
                value={isSmallMerchant ? "Eligible Small Merchant (< ₹20L annual turnover)" : "Standard Commercial Merchant"}
              />
            </>
          )}
          <Divider />
          <MetaRow label="Applicable MDR Rate" value={mdrRatePercent} />
          <Divider />
          <MetaRow
            label="Applied Regulatory Clause"
            value={<span className="text-xs font-mono text-brand-700 font-semibold">{ruleApplied}</span>}
          />
        </div>
      </div>

      <Divider />

      {/* ── Action Trigger: Explain this result ────────────────── */}
      <div className="px-6 py-4 bg-surface-50/50">
        <button
          id="btn-explain-result"
          onClick={onExplain}
          disabled={isExplaining}
          className="btn-secondary w-full py-2.5 text-sm font-semibold shadow-xs flex items-center justify-center gap-2 hover:border-brand-300 hover:text-brand-700 transition-colors"
          aria-busy={isExplaining}
        >
          {isExplaining ? (
            <>
              <svg className="spinner text-brand-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Generating plain-language explanation…</span>
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-brand-600" aria-hidden="true">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17 5.8 21.3l2.4-7.4L2 9.4h7.6L12 2z"/>
              </svg>
              <span>Explain this result</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
