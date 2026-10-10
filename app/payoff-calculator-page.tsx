"use client";
import { useMemo, useRef, useState } from "react";
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
  const [calculationDate, setCalculationDate] = useState(() => new Date());
  const selectedStrategy = strategy === "snowball" ? "snowball" : "avalanche";
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [editingPlan,setEditingPlan]=useState(minimumsIncluded&&amount<=0);
  const [allocationView,setAllocationView]=useState<"planned"|"recorded">("planned");
  const resultRef=useRef<HTMLElement>(null);
  const scheduleRef=useRef<HTMLElement>(null);
  const active = accounts.filter(a => !a.archivedAt && a.balance > 0);
  const minimumResult = useMemo(() => calculateMinimumPayoffPlan(accounts, amount, selectedStrategy, customDebtOrder, calculationDate), [accounts, amount, selectedStrategy, customDebtOrder, calculationDate]);
  const plan = useMemo(() => minimumResult?.plan ?? { monthly: amount, months: [], totalInterest: 0, stalled: true, peakMonthly: amount, nonAmortizingAccountIds: [], promoMinimumFallbackIds: [] } as ReturnType<typeof calculatePayoffCalculator>, [minimumResult, amount]);
  const minimumPaid = (month: typeof plan.months[number]) => round(active.reduce((sum,a) => sum + Math.min(month.payments[a.id] ?? 0, month.minimums[a.id] ?? 0), 0));
  const firstMinimums = plan.months[0] ? minimumPaid(plan.months[0]) : round(active.reduce((sum,a)=>sum+forecastMinimum(a,a.balance*(1+forecastMonthlyRate(a,1,calculationDate)),1,calculationDate),0));
  const monthLabel = (month: number) => new Date(forecastMonthKey(month, calculationDate) + "-01T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const allocationAccounts = accounts.filter(a => !a.archivedAt && (a.balance > 0 || confirmedPaymentTotal(transactions, adjustments, forecastMonthKey(1, calculationDate), a.id) > 0));
  const remainingPayments = round(allocationAccounts.reduce((sum, a) => sum + Math.max(0, round((plan.months[0]?.payments[a.id] ?? 0) - confirmedPaymentTotal(transactions, adjustments, forecastMonthKey(1, calculationDate), a.id))), 0));
  const recordedPayments = confirmedPaymentTotal(transactions, adjustments, forecastMonthKey(1, calculationDate));
  const startingDebt = round(active.reduce((sum, a) => sum + a.balance, 0));
  const exportReport = async (format: "csv" | "excel" | "pdf") => {
    setExporting(true); setExportError("");
    const report: PayoffReportData = {
      generatedAt: calculationDate.toISOString(), budgetMonth: monthLabel(1), strategy: label(selectedStrategy), projectedDebtFree: plan.stalled ? "No payoff at this amount" : monthLabel(plan.months.length), monthsToPayoff: plan.months.length, stalled: plan.stalled,
      startingDebt, monthlyPlan: amount, estimatedInterest: round(plan.totalInterest), extraPayment: Math.max(0, round(amount - firstMinimums)),
      totalIncome: 0, totalExpenses: 0, totalBudget: 0, monthlySurplus: 0, totalMinimums: firstMinimums, availableExtra: Math.max(0, round(amount - firstMinimums)), cashflow: [],
      accounts: active.map(a => ({ name: a.name, type: a.type, balance: a.balance, apr: a.apr, monthlyInterest: round(a.balance * a.apr / 1200), minimumPayment: round(plan.months[0]?.minimums[a.id] ?? 0), linkedCardExpenses: 0, plannedMonthlyPayment: round(plan.months[0]?.payments[a.id] ?? 0), payoffMode: minimumsIncluded ? a.payoffMode : "Calculator", creditLimit: a.creditLimit, utilization: a.creditLimit > 0 ? a.balance / a.creditLimit * 100 : null, dueDate: a.dueDate, projectedPayoff: plan.stalled ? "No payoff at this amount" : monthLabel(plan.months.find(m => (m.balances[a.id] ?? 0) <= 0)?.month ?? plan.months.length) })),
      schedule: plan.months.map(month => ({ month: monthLabel(month.month), focusDebt: active.filter(a => (month.payments[a.id] ?? 0) > 0).map(a => a.name).join(", "), minimumPayments: minimumPaid(month), extraPayment: round(month.paid - minimumPaid(month)), totalPaid: round(month.paid), interest: round(month.interest), remaining: round(month.remaining), milestone: month.paidOff.join(", "), accounts: active.map(a => ({ name: a.name, payment: round(month.payments[a.id] ?? 0), endingBalance: month.balances[a.id] ?? 0 })) })), transactions: [], snapshots: [],
    };
    try { if (format === "csv") exportPayoffCsv(report); else if (format === "excel") await exportPayoffExcel(report); else await exportPayoffPdf(report); }
    catch { setExportError("Could not export the calculation. Please try again."); }
    finally { setExporting(false); }
  };
  return <div className={`screen plan-screen ${minimumsIncluded ? "payment-plan-screen" : "payoff-forecast-screen"}`}>
    <div className="plan-purpose"><h1>{minimumsIncluded ? "Payoff Plan" : "Payoff Calculator"}</h1><span>{minimumsIncluded ? "Saved plan" : "What-if"}</span></div>
    {!minimumsIncluded&&<p className="calculator-intro">Compare monthly payment amounts.</p>}
    {minimumsIncluded&&<section className="plan-commitment" aria-label="Saved monthly commitment"><span>Monthly commitment</span><button type="button" className="secondary edit-saved-plan" disabled={readOnly} aria-expanded={editingPlan} onClick={()=>setEditingPlan(!editingPlan)}>Edit plan</button><strong>{money.format(amount)}</strong><p>Minimums {money.format(firstMinimums)} · Extra {money.format(Math.max(0,round(amount-firstMinimums)))}</p></section>}
    <section className="plan-controls calculator-controls" hidden={minimumsIncluded&&!editingPlan}>
      <div className="extra-control"><label htmlFor="extra-monthly">Total monthly debt payment</label><small className="minimum-budget-hint">Includes minimum payments</small><div><b aria-hidden="true">$</b><input id="extra-monthly" type="number" min="0" step="0.01" inputMode="decimal" value={amount || ""} placeholder="7000" disabled={minimumsIncluded && readOnly} onChange={event => onAmount(Math.max(0, Number(event.target.value) || 0))}/></div></div>
      <div className="strategy-control"><span>Payoff order</span><div>{(["avalanche", "snowball"] as const).map(value => <button type="button" key={value} className={selectedStrategy === value ? "active" : ""} aria-pressed={selectedStrategy === value} disabled={minimumsIncluded && readOnly} onClick={() => onStrategy(value)}>{label(value)}</button>)}</div></div>
      {minimumsIncluded&&<button className="secondary finish-plan-edit" type="button" onClick={()=>setEditingPlan(false)}>Done editing</button>}
    </section>
    {!minimumsIncluded && <section className="scenario-comparison"><article><span>Current plan</span><strong>{money.format(savedAmount)}<small>/ month</small></strong></article><article><span>This scenario</span><strong>{money.format(amount)}<small>/ month</small></strong></article></section>}
    {!minimumsIncluded&&<div className="scenario-actions"><button className="primary calculate-scenario" type="button" onClick={()=>{setCalculationDate(new Date());resultRef.current?.scrollIntoView({behavior:"smooth",block:"start"});}}>Calculate scenario</button><button type="button" className="secondary use-plan" disabled={readOnly||!active.length||amount<=0||Boolean(minimumResult?.error)||plan.stalled} onClick={onUsePlan}>Use this in my plan</button><small>Trying a scenario does not change your saved plan.</small></div>}
    {minimumsIncluded && allocationAccounts.length > 0 && <section className="payment-allocation" aria-label="Monthly payment allocation">
      <header><h2>{monthLabel(1)}</h2></header>
      <div className="allocation-tabs" role="tablist" aria-label="Plan payment view"><button type="button" id="planned-tab" role="tab" aria-selected={allocationView==="planned"} aria-controls="allocation-panel" onClick={()=>setAllocationView("planned")}>Planned</button><button type="button" id="recorded-tab" role="tab" aria-selected={allocationView==="recorded"} aria-controls="allocation-panel" onClick={()=>setAllocationView("recorded")}>Recorded</button></div>
      {allocationView === "recorded" && <dl className="recorded-summary"><div><dt>Recorded</dt><dd>{money.format(recordedPayments)}</dd></div><div><dt>Remaining planned</dt><dd>{minimumResult?.error ? "—" : money.format(remainingPayments)}</dd></div></dl>}
      <div className="allocation-cards" id="allocation-panel" role="tabpanel" aria-labelledby={allocationView==="planned"?"planned-tab":"recorded-tab"}>{allocationAccounts.map(account => {
        const payment = minimumResult?.plan?.months[0]?.payments[account.id];
        const projectedMinimum = minimumResult?.plan?.months[0]?.minimums[account.id] ?? forecastMinimum(account, account.balance * (1 + forecastMonthlyRate(account, 1, calculationDate)), 1, calculationDate);
        const savedMinimum = account.minimumMode === "auto" ? round(projectedMinimum) : account.minimum;
        const allocatedMinimum = Math.min(payment ?? 0, projectedMinimum);
        return <article className={`allocation-card ${payment !== undefined && payment > allocatedMinimum ? "allocation-priority" : ""}`} key={account.id} aria-label={`Payment plan for ${account.name}`}>
          <header><h3>{account.name}</h3><strong className="allocation-total">{allocationView==="recorded"?money.format(confirmedPaymentTotal(transactions,adjustments,forecastMonthKey(1,calculationDate),account.id)):payment===undefined?"—":money.format(payment)}</strong></header>{allocationView==="planned"?<div className="allocation-values">
            <MinimumEditor key={`${account.id}:${savedMinimum}:${account.minimumMode}`} account={account} value={savedMinimum} disabled={readOnly || !onMinimum} onSave={minimum => onMinimum?.(account.id, minimum)}/>
            <div><span>Extra</span><strong>{payment === undefined ? "—" : money.format(Math.max(0, round(payment - allocatedMinimum)))}</strong></div>
          </div>:<dl className="recorded-account-values"><div><dt>Planned</dt><dd>{payment === undefined ? "—" : money.format(payment)}</dd></div><div><dt>Recorded</dt><dd>{money.format(confirmedPaymentTotal(transactions,adjustments,forecastMonthKey(1,calculationDate),account.id))}</dd></div><div><dt>Remaining</dt><dd>{payment === undefined ? "—" : money.format(Math.max(0,round(payment-confirmedPaymentTotal(transactions,adjustments,forecastMonthKey(1,calculationDate),account.id))))}</dd></div></dl>}<div className="allocation-recorded"><button type="button" className="secondary" disabled={readOnly || account.balance <= 0} onClick={() => onPayment?.(account.id, payment ?? 0)}>Record Payment</button></div>{account.postPromoMinimum > 0 && account.promoEndDate && <small>Promotion minimum: {money.format(account.postPromoMinimum)} after {account.promoEndDate}.</small>}
        </article>;
      })}</div>
    </section>}

    {minimumsIncluded&&<button className="plan-schedule-link" type="button" onClick={()=>scheduleRef.current?.scrollIntoView({behavior:"smooth",block:"start"})}>Full payoff schedule →</button>}
    <details className="calculation-details"><summary>Assumptions</summary><div className="calculation-details-body"><p>Starting debt: {money.format(startingDebt)}. Current balances already include recorded transactions.</p><p>The total reserves saved or estimated minimums first, then allocates extra by {label(selectedStrategy).toLowerCase()}. Cards &amp; other only; House &amp; car and future purchases are excluded. Minimum-only flags do not restrict this total-budget projection.</p><p>Interest is estimated monthly using saved rates, interest calibration, and promotional changes. Projections do not record payments or change Budget.</p></div></details>
    {!active.length ? <section className="large-empty"><h2>Add debts to calculate a payoff</h2><button className="primary" onClick={onAccounts}>Review debt accounts</button></section> : amount <= 0 ? <section ref={resultRef} className="large-empty"><h2>Enter a monthly amount</h2><p>Enter the total you want to pay each month.</p></section> : minimumResult?.error ? <section ref={resultRef} className="large-empty"><p role="alert">{minimumResult.error}</p><button className="secondary" onClick={onAccounts}>Review debt accounts</button></section> : <>
      <section ref={resultRef} className="plan-hero" aria-live="polite"><div><span>Time to pay off</span><strong>{plan.stalled ? "No payoff at this amount" : `${plan.months.length} months`}</strong><small>{plan.stalled ? "Increase the amount to outpace interest." : monthLabel(plan.months.length)}</small></div><div><span>Monthly amount</span><strong>{money.format(amount)}</strong></div><div><span>Estimated interest</span><strong>{money.format(plan.totalInterest)}</strong></div></section>
      <section ref={scheduleRef} className="plan-table-card"><header className="plan-table-summary"><strong>Full payoff schedule</strong></header><div className="mobile-payoff-schedule">{plan.months.map(month => <article className="schedule-month" key={month.month}><h3>{monthLabel(month.month)}</h3><dl><div><dt>Payment</dt><dd>{money.format(month.paid)}</dd></div><div><dt>Interest</dt><dd>{money.format(month.interest)}</dd></div><div><dt>Ending balance</dt><dd>{money.format(month.remaining)}</dd></div></dl>{month.paidOff.length > 0 && <p className="schedule-milestone">Paid off · {month.paidOff.join(", ")}</p>}</article>)}</div><div className="plan-table-wrap"><table className="plan-table"><caption>Calculated monthly payments and remaining debt</caption><thead><tr><th>Month</th><th>Payment</th><th>Interest</th><th>Ending balance</th><th>Paid off</th></tr></thead><tbody>{plan.months.map(month => <tr key={month.month}><td>{monthLabel(month.month)}</td><td>{money.format(month.paid)}</td><td>{money.format(month.interest)}</td><td>{money.format(month.remaining)}</td><td>{month.paidOff.join(", ") || "—"}</td></tr>)}</tbody></table></div></section>
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
