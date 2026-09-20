import { useState } from "react";

interface Props {
  explanation: string | null;
  isFallback?: boolean;
  isLoading?: boolean;
  onExplain?: () => void;
  hasResult?: boolean;
}

export default function AIExplanation({
  explanation,
  isFallback = false,
  isLoading = false,
  onExplain,
  hasResult = true,
}: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!explanation) return;
    navigator.clipboard.writeText(explanation).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // If no result is available yet, don't show or show placeholder
  if (!hasResult && !explanation && !isLoading) {
    return null;
  }

  return (
    <div
      id="ai-explanation-section"
      className="card border border-brand-200/90 overflow-hidden shadow-xs bg-white"
      role="region"
      aria-label="AI explanation"
      aria-live="polite"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-brand-50/90 to-indigo-50/50 border-b border-brand-100">
        <div className="flex items-center gap-2.5">
          {/* Sparkle / AI icon */}
          <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center shadow-xs">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-white" aria-hidden="true">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17 5.8 21.3l2.4-7.4L2 9.4h7.6L12 2z"/>
            </svg>
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-brand-900">
                {isFallback ? "Regulatory Summary" : "Conversational AI Explanation"}
              </p>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-100/80 text-brand-700">
                Bedrock Claude 3
              </span>
            </div>
            <p className="text-[11px] text-brand-600 mt-0.5">
              Plain-language breakdown of MDR logic & merchant implications
            </p>
          </div>
        </div>

        {explanation && (
          <button
            onClick={handleCopy}
            className="text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-brand-100/50"
            title="Copy explanation"
          >
            {copied ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span>Copied</span>
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-5">
        {isLoading ? (
          <div className="space-y-3 py-2" aria-busy="true">
            <div className="flex items-center gap-2 text-xs font-medium text-brand-600 animate-pulse">
              <svg className="spinner text-brand-600 w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Generating conversational explanation based on regulatory rules...</span>
            </div>
            <div className="h-4 bg-slate-100 rounded w-5/6 animate-pulse" />
            <div className="h-4 bg-slate-100 rounded w-full animate-pulse" />
            <div className="h-4 bg-slate-100 rounded w-4/6 animate-pulse" />
          </div>
        ) : explanation ? (
          <div className="space-y-3.5">
            {/* Conversational callout quote */}
            <div className="border-l-3 border-brand-500 bg-brand-50/40 rounded-r-xl p-4">
              <p className="text-sm text-slate-800 leading-relaxed font-normal">
                "{explanation}"
              </p>
            </div>

            {/* Quick takeaways */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Customer Surcharge: <strong>₹0.00 (Free for payer)</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                <span>Regulatory Grounding: <strong>NPCI / RBI Guidelines</strong></span>
              </div>
            </div>
          </div>
        ) : onExplain ? (
          <div className="text-center py-2">
            <p className="text-xs text-slate-500 mb-3">
              Need a clear, non-technical explanation to share with your finance team or customers?
            </p>
            <button
              id="btn-trigger-ai-explain"
              onClick={onExplain}
              className="btn-primary py-2 px-4 text-xs font-semibold inline-flex items-center gap-2"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17 5.8 21.3l2.4-7.4L2 9.4h7.6L12 2z"/>
              </svg>
              Explain this result
            </button>
          </div>
        ) : null}
      </div>

      {/* Regulatory transparency note */}
      <div className="px-5 py-2.5 bg-surface-50 border-t border-slate-100 text-[11px] text-slate-400">
        <span>
          Deterministic computation by UPI rule engine. AI translates compliance rules into plain English.
        </span>
      </div>
    </div>
  );
}
