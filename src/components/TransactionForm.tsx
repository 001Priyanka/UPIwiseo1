import { useState, type FormEvent } from "react";
import type { MDRInput, MerchantCategory, TransactionType } from "../types";

interface Props {
  onSubmit:  (input: MDRInput) => void;
  isLoading: boolean;
}

const TX_OPTIONS = [
  { value: "P2M" as const, label: "P2M", sub: "Person to Merchant" },
  { value: "P2P" as const, label: "P2P", sub: "Person to Person"   },
];

const CATEGORY_OPTIONS = [
  {
    value: "general"       as const,
    label: "General",
    sub:   "Retail, restaurants, e-commerce, most businesses",
    icon:  "🏪",
  },
  {
    value: "essential"     as const,
    label: "Essential Sector",
    sub:   "Fuel, utilities, healthcare, agriculture",
    icon:  "🏥",
  },
  {
    value: "capital_market" as const,
    label: "Capital Market",
    sub:   "Stock brokers, mutual funds, investment platforms",
    icon:  "📈",
  },
];

function validate(raw: string): string {
  if (!raw.trim())              return "Amount is required";
  const n = parseFloat(raw);
  if (isNaN(n) || n <= 0)       return "Enter a positive amount";
  if (n > 100_000_000)          return "Amount exceeds ₹10,00,00,000";
  return "";
}

export default function TransactionForm({ onSubmit, isLoading }: Props) {
  const [amount,           setAmount]           = useState("");
  const [transactionType,  setTransactionType]  = useState<TransactionType>("P2M");
  const [merchantCategory, setMerchantCategory] = useState<MerchantCategory>("general");
  const [isSmallMerchant,  setIsSmallMerchant]  = useState(false);
  const [amountError,      setAmountError]      = useState("");

  const isP2P = transactionType === "P2P";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const err = validate(amount);
    if (err) { setAmountError(err); return; }
    onSubmit({ amount: parseFloat(amount), transactionType, merchantCategory, isSmallMerchant });
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Transaction analysis form">
      <div className="space-y-6">

        {/* Amount */}
        <div>
          <label htmlFor="amount" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Transaction Amount
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold pointer-events-none">
              ₹
            </span>
            <input
              id="amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (amountError) setAmountError(validate(e.target.value));
              }}
              onBlur={() => setAmountError(validate(amount))}
              className={`input-field pl-8 font-mono text-base ${amountError ? "input-field-error" : ""}`}
              aria-describedby={amountError ? "amount-error" : "amount-hint"}
              aria-invalid={!!amountError}
              disabled={isLoading}
              required
            />
          </div>
          {amountError ? (
            <p id="amount-error" className="mt-1.5 text-xs text-red-600" role="alert">{amountError}</p>
          ) : (
            <p id="amount-hint" className="mt-1.5 text-xs text-slate-400">Enter the full transaction value in Indian Rupees</p>
          )}

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            <span className="text-[11px] text-slate-400 font-medium mr-0.5">Presets:</span>
            {[
              { label: "₹500", val: "500" },
              { label: "₹2,500", val: "2500" },
              { label: "₹10,000", val: "10000" },
              { label: "₹25,000", val: "25000" },
              { label: "₹50,000", val: "50000" },
            ].map((preset) => (
              <button
                key={preset.val}
                type="button"
                onClick={() => {
                  setAmount(preset.val);
                  setAmountError("");
                }}
                disabled={isLoading}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-surface-100 hover:bg-surface-200 text-slate-700 transition-colors border border-slate-200"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transaction type */}
        <fieldset>
          <legend className="block text-sm font-semibold text-slate-700 mb-2">
            Transaction Type
          </legend>
          <div className="grid grid-cols-2 gap-2.5">
            {TX_OPTIONS.map(({ value, label, sub }) => {
              const selected = transactionType === value;
              return (
                <label
                  key={value}
                  className={`option-tile ${selected ? "option-tile-selected" : ""} ${isLoading ? "option-tile-disabled" : ""}`}
                >
                  <input
                    type="radio"
                    name="transactionType"
                    value={value}
                    checked={selected}
                    onChange={() => { setTransactionType(value); setIsSmallMerchant(false); }}
                    disabled={isLoading}
                    className="sr-only"
                  />
                  {/* Custom radio dot */}
                  <span
                    className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selected ? "border-brand-600" : "border-slate-300"
                    }`}
                    aria-hidden="true"
                  >
                    {selected && <span className="w-2 h-2 rounded-full bg-brand-600" />}
                  </span>
                  <div>
                    <span className="block text-sm font-semibold text-slate-900">{label}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{sub}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Merchant category */}
        <fieldset>
          <legend className={`block text-sm font-semibold mb-2 ${isP2P ? "text-slate-400" : "text-slate-700"}`}>
            Merchant Category
            {isP2P && <span className="ml-2 text-xs font-normal text-slate-400">(not applicable for P2P)</span>}
          </legend>
          <div className="space-y-2">
            {CATEGORY_OPTIONS.map(({ value, label, sub, icon }) => {
              const selected  = merchantCategory === value;
              const disabled  = isP2P || isLoading;
              return (
                <label
                  key={value}
                  className={`option-tile ${selected && !isP2P ? "option-tile-selected" : ""} ${disabled ? "option-tile-disabled" : ""}`}
                >
                  <input
                    type="radio"
                    name="merchantCategory"
                    value={value}
                    checked={selected}
                    onChange={() => setMerchantCategory(value)}
                    disabled={disabled}
                    className="sr-only"
                  />
                  <span
                    className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selected && !isP2P ? "border-brand-600" : "border-slate-300"
                    }`}
                    aria-hidden="true"
                  >
                    {selected && !isP2P && <span className="w-2 h-2 rounded-full bg-brand-600" />}
                  </span>
                  <span className="text-base leading-none mt-0.5 flex-shrink-0" aria-hidden="true">{icon}</span>
                  <div>
                    <span className="block text-sm font-medium text-slate-900">{label}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{sub}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Small merchant eligibility — only for P2M General */}
        {!isP2P && merchantCategory === "general" && (
          <div className="card-inset p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <span className="flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={isSmallMerchant}
                  onChange={(e) => setIsSmallMerchant(e.target.checked)}
                  disabled={isLoading}
                  className="sr-only peer"
                  id="small-merchant"
                  aria-describedby="small-merchant-desc"
                />
                {/* Custom checkbox */}
                <span
                  className={`flex w-4 h-4 rounded border-2 items-center justify-center transition-colors ${
                    isSmallMerchant ? "bg-brand-600 border-brand-600" : "bg-white border-slate-300"
                  }`}
                  aria-hidden="true"
                >
                  {isSmallMerchant && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              </span>
              <div>
                <span className="block text-sm font-semibold text-slate-900">
                  Eligible Small Merchant
                </span>
                <p id="small-merchant-desc" className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Check this if your business qualifies under NPCI's small merchant criteria
                  (annual turnover below the prescribed threshold). Eligible small merchants
                  are MDR-exempt on general P2M transactions.
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Submit */}
        <button id="btn-analyze" type="submit" disabled={isLoading} className="btn-primary w-full py-3 text-sm font-semibold shadow-sm" aria-busy={isLoading}>
          {isLoading ? (
            <>
              <svg className="spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyzing…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              Analyze Transaction
            </>
          )}
        </button>
      </div>
    </form>
  );
}
