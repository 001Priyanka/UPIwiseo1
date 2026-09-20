import { useEffect, useState, useCallback } from "react";
import { fetchHistory } from "../services/mdrService";
import type { MDRResult } from "../types";

const CAT_LABELS: Record<string, string> = {
  general:        "General",
  essential:      "Essential",
  capital_market: "Capital Mkt",
};

interface Props {
  refreshTrigger?: string;
  onSelectResult?: (result: MDRResult) => void;
  selectedId?: string;
}

// ── Small reusable pieces ────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading history">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-14 flex flex-col items-center text-center">
      <span className="text-3xl mb-3" aria-hidden="true">📋</span>
      <p className="text-sm font-medium text-slate-600">No calculations yet</p>
      <p className="text-xs text-slate-400 mt-1">
        Run your first analysis to see results here.
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card-inset p-4 flex items-start gap-3" role="alert">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 mt-0.5 flex-shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-700">Could not load history</p>
        <p className="text-xs text-slate-500 mt-0.5">{message}</p>
        <button onClick={onRetry} className="btn-ghost mt-2 px-0 text-brand-600 hover:text-brand-700 hover:bg-transparent">
          Try again →
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RecentCalculations({ refreshTrigger, onSelectResult, selectedId }: Props) {
  const [items,   setItems]   = useState<MDRResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchHistory(10);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error. Check your API config.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshTrigger]);

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Recent Calculations</h2>
          {!loading && !error && items.length > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">
              {items.length} calculation{items.length !== 1 && "s"}, newest first {onSelectResult && "• Click any row to inspect"}
            </p>
          )}
        </div>
        <button onClick={load} disabled={loading} className="btn-ghost text-xs" aria-label="Refresh history">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"
            className={loading ? "animate-spin" : ""}>
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {loading && <Skeleton />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && items.length === 0 && <EmptyState />}

      {!loading && !error && items.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden border border-slate-200 shadow-xs">
            <table className="w-full text-sm" aria-label="Recent MDR calculations">
              <thead>
                <tr className="border-b border-slate-100 bg-surface-50">
                  {["Date & Time", "Amount", "Type", "Category", "MDR Status", "MDR Fee", ""].map((h, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 section-label whitespace-nowrap ${
                        i === 4 ? "text-center" : i === 5 ? "text-right" : i === 6 ? "text-right w-16" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const isSelected = selectedId === item.id;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => onSelectResult?.(item)}
                      className={`transition-colors cursor-pointer ${
                        isSelected 
                          ? "bg-brand-50/70 hover:bg-brand-50" 
                          : "hover:bg-surface-50"
                      }`}
                    >
                      <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(item.timestamp).toLocaleString("en-IN", {
                          dateStyle: "short", timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900 tabular whitespace-nowrap">
                        ₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="badge badge-neutral">{item.transactionType}</span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        {CAT_LABELS[item.merchantCategory] ?? item.merchantCategory}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`badge ${item.mdrApplicable ? "badge-mdr" : "badge-exempt"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${item.mdrApplicable ? "bg-amber-600" : "bg-emerald-600"}`} aria-hidden="true" />
                          {item.mdrApplicable ? item.mdrRatePercent : "Exempt"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular whitespace-nowrap">
                        <span className={item.mdrApplicable ? "text-amber-700" : "text-emerald-700"}>
                          {item.mdrApplicable
                            ? `₹${item.estimatedFee.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                            : "₹0.00"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-xs font-semibold text-brand-600 hover:text-brand-800">
                          {isSelected ? "Active" : "Inspect →"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-2.5">
            {items.map((item) => {
              const isSelected = selectedId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectResult?.(item)}
                  className={`card p-4 border transition-all cursor-pointer ${
                    isSelected
                      ? "ring-2 ring-brand-500 border-brand-500 bg-brand-50/30"
                      : item.mdrApplicable ? "border-amber-200" : "border-emerald-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 tabular">
                        ₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="badge badge-neutral">{item.transactionType}</span>
                        <span className="text-xs text-slate-500">
                          {CAT_LABELS[item.merchantCategory] ?? item.merchantCategory}
                        </span>
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-xs text-slate-400">
                          {new Date(item.timestamp).toLocaleDateString("en-IN")}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={`badge ${item.mdrApplicable ? "badge-mdr" : "badge-exempt"}`}>
                        {item.mdrApplicable ? item.mdrRatePercent : "Exempt"}
                      </span>
                      {item.mdrApplicable ? (
                        <p className="text-xs font-semibold text-amber-700 mt-1.5 tabular">
                          ₹{item.estimatedFee.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </p>
                      ) : (
                        <p className="text-xs font-medium text-emerald-600 mt-1.5">₹0.00</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
