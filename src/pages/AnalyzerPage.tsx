import { useState } from "react";
import type { MDRInput, MDRResult } from "../types";
import { calculateMDR, explainMDR } from "../services/mdrService";
import { MOCK_HISTORY } from "../services/mockData";
import TransactionForm from "../components/TransactionForm";
import AnalysisResult from "../components/AnalysisResult";
import AIExplanation from "../components/AIExplanation";
import StatCard from "../components/StatCard";
import RecentCalculations from "../components/RecentCalculations";

interface Props {
  onNewResult?: (result: MDRResult) => void;
}

// ── Stat card icons ──────────────────────────────────────────────────────────

function IconAnalyzed() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconMDR() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyzerPage({ onNewResult }: Props) {
  const initialResult = MOCK_HISTORY[0] ?? null;
  const [result,      setResult]      = useState<MDRResult | null>(initialResult);
  const [explanation, setExplanation] = useState<string | null>(
    "Under the standard P2M General category, commercial merchants are subject to a 0.30% MDR rate. For this ₹25,000.00 payment, the estimated processing cost is ₹75.00. Crucially, Indian payment regulations strictly prohibit passing this charge as a surcharge to your customer (customer pays ₹25,000.00 with ₹0.00 extra charge). Your settled bank account will receive ₹24,925.00."
  );
  const [isFallback,  setIsFallback]  = useState(false);
  const [isCalc,      setIsCalc]      = useState(false);
  const [isExplain,   setIsExplain]   = useState(false);
  const [calcError,   setCalcError]   = useState<string | null>(null);
  const [explainErr,  setExplainErr]  = useState<string | null>(null);

  // Running session stats
  const baseCount = MOCK_HISTORY.length;
  const baseFees = MOCK_HISTORY.reduce((sum, item) => sum + item.estimatedFee, 0);

  const [sessionCount, setSessionCount] = useState(baseCount);
  const [sessionFees,  setSessionFees]  = useState(baseFees);

  async function handleCalculate(input: MDRInput) {
    setIsCalc(true);
    setCalcError(null);
    setExplanation(null);
    setExplainErr(null);

    try {
      const r = await calculateMDR(input);
      setResult(r);
      setSessionCount((c) => c + 1);
      setSessionFees((f) => f + r.estimatedFee);
      onNewResult?.(r);

      // Auto-trigger explanation for immediate rich feedback
      try {
        const expl = await explainMDR(r);
        setExplanation(expl.explanation);
        setIsFallback(!!expl.fallback);
      } catch {
        // Silently continue; user can click "Explain this result" manually
      }
    } catch (err) {
      setCalcError(err instanceof Error ? err.message : "Unexpected error. Please try again.");
    } finally {
      setIsCalc(false);
    }
  }

  async function handleExplain() {
    if (!result) return;
    setIsExplain(true);
    setExplainErr(null);

    try {
      const res = await explainMDR(result);
      setExplanation(res.explanation);
      setIsFallback(!!res.fallback);
    } catch (err) {
      setExplainErr(err instanceof Error ? err.message : "Unable to generate explanation. Please try again.");
    } finally {
      setIsExplain(false);
    }
  }

  async function handleSelectRow(selected: MDRResult) {
    setResult(selected);
    setCalcError(null);
    setExplainErr(null);
    setIsExplain(true);
    try {
      const expl = await explainMDR(selected);
      setExplanation(expl.explanation);
      setIsFallback(!!expl.fallback);
    } catch {
      setExplanation(null);
    } finally {
      setIsExplain(false);
    }
  }

  const fmtINR = (n: number) =>
    "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  const lastAnalysisLabel = result
    ? new Date(result.timestamp).toLocaleTimeString("en-IN", { timeStyle: "short" })
    : "—";

  return (
    <div className="space-y-8">

      {/* ── 2. Summary cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Transactions analyzed"
          value={String(sessionCount)}
          sub="verified across all categories"
          icon={<IconAnalyzed />}
          variant="default"
        />
        <StatCard
          label="Estimated MDR this month"
          value={fmtINR(sessionFees)}
          sub="cumulative calculated MDR fees"
          icon={<IconMDR />}
          variant={sessionFees > 0 ? "warn" : "default"}
        />
        <StatCard
          label="Last analysis"
          value={lastAnalysisLabel}
          sub={result ? (result.mdrApplicable ? `MDR: ${result.mdrRatePercent}` : "Exempt (0.00%)") : "ready"}
          icon={<IconClock />}
          variant={result ? (result.mdrApplicable ? "warn" : "success") : "default"}
        />
      </div>

      {/* ── Main two-column layout ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

        {/* Left column — 3. Transaction analysis form */}
        <div className="lg:col-span-2">
          <div className="card p-6 border border-slate-200/90 shadow-sm bg-white">
            <div className="mb-5 pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Transaction Analysis Form</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Calculate merchant discount rates under the RBI/NPCI framework.
              </p>
            </div>
            <TransactionForm onSubmit={handleCalculate} isLoading={isCalc} />
          </div>
        </div>

        {/* Right column — 4. Result card & 5. AI explanation section */}
        <div className="lg:col-span-3 space-y-5">

          {/* Calculation error */}
          {calcError && (
            <div className="card border-red-200 p-4 flex items-start gap-3 bg-red-50/50" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 mt-0.5 flex-shrink-0" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-slate-800">Analysis failed</p>
                <p className="text-xs text-slate-500 mt-0.5">{calcError}</p>
              </div>
            </div>
          )}

          {/* 4. Result card */}
          {result && (
            <AnalysisResult
              result={result}
              onExplain={handleExplain}
              isExplaining={isExplain}
            />
          )}

          {/* Explain error */}
          {explainErr && (
            <div className="card border-amber-200 p-4 flex items-start gap-3 bg-amber-50/50" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 mt-0.5 flex-shrink-0" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-slate-800">Explanation notice</p>
                <p className="text-xs text-slate-500 mt-0.5">{explainErr}</p>
              </div>
            </div>
          )}

          {/* 5. AI explanation section */}
          {(explanation || isExplain) && (
            <AIExplanation
              explanation={explanation}
              isFallback={isFallback}
              isLoading={isExplain}
              onExplain={handleExplain}
              hasResult={!!result}
            />
          )}
        </div>
      </div>

      {/* ── 6. Recent calculations table ──────────────────────── */}
      <div className="card p-6 border border-slate-200/90 shadow-sm bg-white">
        <RecentCalculations
          refreshTrigger={result?.id}
          onSelectResult={handleSelectRow}
          selectedId={result?.id}
        />
      </div>
    </div>
  );
}
