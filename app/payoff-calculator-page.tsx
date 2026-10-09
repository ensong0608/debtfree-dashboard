"use client";
import { useMemo, useState } from "react";
import type { BalanceAdjustment, LedgerTransaction, DebtAccount, PayoffStrategy } from "./dashboard-data";
import { calculatePayoffCalculator, calculateMinimumPayoffPlan } from "./payoff-calculator";
import { confirmedPaymentTotal } from "./payments";
import { parseMoneyInput } from "./payments";
import { exportPayoffCsv, exportPayoffExcel, exportPayoffPdf, type PayoffReportData } from "./payoff-export";
import { forecastMinimum, forecastMonthlyRate, forecastMonthKey, round } from "./payoff-engine";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const label = (strategy: PayoffStrategy) => strategy === "avalanche" ? "Avalanche" : strategy === "snowball" ? "Snowball" : "Custom";
export default function PayoffCalculatorPage({ accounts, amount, strategy, customDebtOrder, onAmount, onStrategy, onMinimum, onAccounts, onUsePlan, onPayment, savedAmount=0, transactions=[], adjustments=[], minimumsIncluded = false, readOnly = false }: {
  savedAmount?: number; onUsePlan?: () => void; onPayment?: (id: string, amount: number) => void; transactions?: LedgerTransaction[]; adjustments?: BalanceAdjustment[]; minimumsIncluded?: boolean; readOnly?: boolean; accounts: DebtAccount[]; amount: number; strategy: PayoffStrategy; customDebtOrder: string[];
  onAmount: (amount: number) => void; onStrategy: (strategy: PayoffStrategy) => void; onMinimum?: (id: string, minimum: number) => void; onAccounts: () => void;
}) {
  const [calculationDate] = useState(() => new Date());
  const selectedStrategy = strategy === "snowball" ? "snowball" : "avalanche";
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const active = accounts.filter(a => !a.archivedAt && a.balance > 0);
  const minimumResult = useMemo(() => calculateMinimumPayoffPlan(accounts, amount, selectedStrategy, customDebtOrder, calculationDate), [accounts, amount, selectedStrategy, customDebtOrder, calculationDate]);
  const plan = useMemo(() => minimumResult?.plan ?? { monthly: amount, months: [], totalInterest: 0, stalled: true, peakMonthly: amount, nonAmortizingAccountIds: [], promoMinimumFallbackIds: [] } as ReturnType<typeof calculatePayoffCalculator>, [minimumResult, amount]);
  const minimumPaid = (month: typeof plan.months[number]) => round(active.reduce((sum,a) => sum + Math.min(month.payments[a.id] ?? 0, month.minimums[a.id] ?? 0), 0));
  const firstMinimums = plan.months[0] ? minimumPaid(plan.months[0]) : 0;
  const monthLabel = (month: number) => new Date(forecastMonthKey(month, calculationDate) + "-01T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const startingDebt = round(active.reduce((sum, a) => sum + a.balance, 0));
  const exportReport = async (format: "csv" | "excel" | "pdf") => {
    setExporting(true); setExportError("");
    const report: PayoffReportData = {
      generatedAt: calculationDate.toISOString(), budgetMonth: monthLabel(1), strategy: label(selectedStrategy), projectedDebtFree: plan.stalled ? "No payoff at this amount" : monthLabel(plan.months.length), monthsToPayoff: plan.months.length, stalled: plan.stalled,
      startingDebt, monthlyPlan: amount, estimatedInterest: round(plan.totalInterest), extraPayment: minimumsIncluded ? Math.max(0, round(amount - firstMinimums)) : amount,
      totalIncome: 0, totalExpenses: 0, totalBudget: 0, monthlySurplus: 0, totalMinimums: firstMinimums, availableExtra: minimumsIncluded ? Math.max(0, round(amount - firstMinimums)) : amount, cashflow: [],
      accounts: active.map(a => ({ name: a.name, type: a.type, balance: a.balance, apr: a.apr, monthlyInterest: round(a.balance * a.apr / 1200), minimumPayment: round(plan.months[0]?.minimums[a.id] ?? 0), linkedCardExpenses: 0, plannedMonthlyPayment: round(plan.months[0]?.payments[a.id] ?? 0), payoffMode: minimumsIncluded ? a.payoffMode : "Calculator", creditLimit: a.creditLimit, utilization: a.creditLimit > 0 ? a.balance / a.creditLimit * 100 : null, dueDate: a.dueDate, projectedPayoff: plan.stalled ? "No payoff at this amount" : monthLabel(plan.months.find(m => (m.balances[a.id] ?? 0) <= 0)?.month ?? plan.months.length) })),
      schedule: plan.months.map(month => ({ month: monthLabel(month.month), focusDebt: active.filter(a => (month.payments[a.id] ?? 0) > 0).map(a => a.name).join(", "), minimumPayments: minimumPaid(month), extraPayment: round(month.paid - minimumPaid(month)), totalPaid: round(month.paid), interest: round(month.interest), remaining: round(month.remaining), milestone: month.paidOff.join(", "), accounts: active.map(a => ({ name: a.name, payment: round(month.payments[a.id] ?? 0), endingBalance: month.balances[a.id] ?? 0 })) })), transactions: [], snapshots: [],
    };
    try { if (format === "csv") exportPayoffCsv(report); else if (format === "excel") await exportPayoffExcel(report); else await exportPayoffPdf(report); }
    catch { setExportError("Could not export the calculation. Please try again."); }
    finally { setExporting(false); }
  };
  return <div className={`screen plan-screen ${minimumsIncluded ? "payment-plan-screen" : "payoff-forecast-screen"}`}>
    <div className="plan-purpose"><h1>{minimumsIncluded ? "Payoff Plan" : "Payoff Calculator"}</h1><span>{minimumsIncluded ? "Saved plan" : "What-if"}</span></div>
    <section className="plan-controls calculator-controls">
      <div className="extra-control"><label htmlFor="extra-monthly">Total monthly debt payment</label><small>Includes minimum payments</small><div><b aria-hidden="true">$</b><input id="extra-monthly" type="number" min="0" step="0.01" inputMode="decimal" value={amount || ""} placeholder="7000" disabled={minimumsIncluded && readOnly} onChange={event => onAmount(Math.max(0, Number(event.target.value) || 0))}/></div></div>
      <div className="strategy-control"><span>Payoff order</span><div>{(["avalanche", "snowball"] as const).map(value => <button type="button" key={value} className={selectedStrategy === value ? "active" : ""} aria-pressed={selectedStrategy === value} disabled={minimumsIncluded && readOnly} onClick={() => onStrategy(value)}>{label(value)}</button>)}</div><small>{selectedStrategy === "avalanche" ? "Highest interest rate first." : "Smallest balance first."}</small></div>
    </section>
    {!minimumsIncluded && <section className="scenario-comparison"><article><span>Saved plan</span><strong>{money.format(savedAmount)} / month</strong></article><article><span>This scenario</span><strong>{money.format(amount)} / month</strong></article></section>}
    {minimumsIncluded && active.length > 0 && <section className="payment-allocation" aria-label="Monthly payment allocation">
      <header><div><h2>{monthLabel(1)} payment plan</h2><span>First projected month</span></div>{!minimumResult?.error && plan.months[0] && <strong>Minimums {money.format(firstMinimums)} · Extra {money.format(Math.max(0, round(plan.months[0].paid - firstMinimums)))}</strong>}</header>
      <p className="allocation-help">Planned allocations · Recorded payments shown separately</p>
      <div className="allocation-cards">{active.map(account => {
        const payment = minimumResult?.plan?.months[0]?.payments[account.id];
        const projectedMinimum = minimumResult?.plan?.months[0]?.minimums[account.id] ?? forecastMinimum(account, account.balance * (1 + forecastMonthlyRate(account, 1, calculationDate)), 1, calculationDate);
        const savedMinimum = account.minimumMode === "auto" ? round(projectedMinimum) : account.minimum;
        const allocatedMinimum = Math.min(payment ?? 0, projectedMinimum);
        return <article className={`allocation-card ${payment !== undefined && payment > allocatedMinimum ? "allocation-priority" : ""}`} key={account.id} aria-label={`Payment plan for ${account.name}`}>
          <h3>{account.name}</h3><div className="allocation-values">
            <MinimumEditor key={`${account.id}:${savedMinimum}:${account.minimumMode}`} account={account} value={savedMinimum} disabled={readOnly || !onMinimum} onSave={minimum => onMinimum?.(account.id, minimum)}/>
            <div><span>Extra</span><strong>{payment === undefined ? "—" : money.format(Math.max(0, round(payment - allocatedMinimum)))}</strong></div>
            <div><span>Total payment</span><strong>{payment === undefined ? "—" : money.format(payment)}</strong></div>
          </div><div className="allocation-recorded"><span>Recorded in {monthLabel(1)}: {money.format(confirmedPaymentTotal(transactions, adjustments, forecastMonthKey(1, calculationDate), account.id))}</span><button type="button" className="secondary" disabled={readOnly || account.balance <= 0} onClick={() => onPayment?.(account.id, payment ?? 0)}>Record Payment</button></div>{account.postPromoMinimum > 0 && account.promoEndDate && <small>Promotion minimum: {money.format(account.postPromoMinimum)} after {account.promoEndDate}.</small>}
        </article>;
      })}</div>
    </section>}
    {!active.length ? <section className="large-empty"><h2>Add debts to calculate a payoff</h2><button className="primary" onClick={onAccounts}>Review debt accounts</button></section> : amount <= 0 ? <section className="large-empty"><h2>Enter a monthly amount</h2><p>Enter the total you want to pay each month.</p></section> : minimumResult?.error ? <section className="large-empty"><p role="alert">{minimumResult.error}</p><button className="secondary" onClick={onAccounts}>Review debt accounts</button></section> : <>
      <section className="plan-hero" aria-live="polite"><div><span>Time to pay off</span><strong>{plan.stalled ? "No payoff at this amount" : `${plan.months.length} months`}</strong><small>{plan.stalled ? "Increase the amount to outpace interest." : monthLabel(plan.months.length)}</small></div><div><span>Monthly amount</span><strong>{money.format(amount)}</strong></div><div><span>Estimated interest</span><strong>{money.format(plan.totalInterest)}</strong></div></section>
      {!minimumsIncluded && <button type="button" className="primary use-plan" disabled={readOnly} onClick={onUsePlan}>Use this in my plan</button>}
      <section className="plan-table-card"><header className="plan-table-summary"><strong>Monthly payoff calculation</strong></header><div className="plan-table-wrap"><table className="plan-table"><caption>Calculated monthly payments and remaining debt</caption><thead><tr><th>Month</th><th>Payment</th><th>Interest</th><th>Ending balance</th><th>Paid off</th></tr></thead><tbody>{plan.months.map(month => <tr key={month.month}><td>{monthLabel(month.month)}</td><td>{money.format(month.paid)}</td><td>{money.format(month.interest)}</td><td>{money.format(month.remaining)}</td><td>{month.paidOff.join(", ") || "—"}</td></tr>)}</tbody></table></div></section>
      <details className="calculation-details"><summary>How this plan was calculated</summary><div className="calculation-details-body"><p>Starting debt: {money.format(startingDebt)}. Uses current balances, which already reflect recorded transactions. Payments already made are never deducted again.</p><p>Your {money.format(amount)} total reserves saved or estimated minimums first, then allocates extra by {label(selectedStrategy).toLowerCase()}. Cards &amp; other only; House &amp; car and future purchases are excluded. Minimum-only flags do not restrict this total-budget projection. Trying a scenario does not change the saved plan.</p><p>Interest is estimated monthly from each remaining balance, using the saved rate or interest calibration and promotional rate changes. This projection does not record payments or change Budget.</p></div></details>
      <div className="export-control"><span>Export calculation</span><div>{(["csv", "excel", "pdf"] as const).map(format => <button key={format} type="button" disabled={exporting} onClick={() => void exportReport(format)}>{format.toUpperCase()}</button>)}</div>{exportError && <p role="alert">{exportError}</p>}</div>
    </>}
  </div>;
}

function MinimumEditor({ account, value, disabled, onSave }: { account: DebtAccount; value: number; disabled: boolean; onSave: (minimum: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState("");
  const changed = Number(draft) !== value;
  return <form className="allocation-minimum" onSubmit={event => {
    event.preventDefault();
    const minimum = parseMoneyInput(draft);
    if (!Number.isFinite(minimum) || minimum <= 0) { setError("Enter a minimum greater than $0."); return; }
    if (disabled) return;
    onSave(minimum);
  }}>
    <label htmlFor={`plan-minimum-${account.id}`}>{account.minimumMode === "auto" ? "Estimated minimum" : "Saved minimum"}</label>
    <div className="allocation-input"><b aria-hidden="true">$</b><input id={`plan-minimum-${account.id}`} aria-label={`Minimum payment for ${account.name}`} type="text" inputMode="decimal" value={draft} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={error ? `plan-minimum-error-${account.id}` : undefined} onChange={event => { setDraft(event.target.value); setError(""); }}/></div>
    {changed && <button className="secondary" type="submit" disabled={disabled} aria-label={`Save minimum for ${account.name}`}>Save</button>}
    {error && <small id={`plan-minimum-error-${account.id}`} role="alert">{error}</small>}
  </form>;
}
