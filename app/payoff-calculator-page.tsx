"use client";
import { useMemo, useState } from "react";
import type { DebtAccount, PayoffStrategy } from "./dashboard-data";
import { calculatePayoffCalculator } from "./payoff-calculator";
import { accountsWithCustomDebtOrder, DEFAULT_SCHEDULE_PREVIEW_MONTHS, visibleCustomDebtOrder } from "./payoff-plan";
import { exportPayoffCsv, exportPayoffExcel, exportPayoffPdf, type PayoffReportData } from "./payoff-export";
import { forecastMonthKey, round } from "./payoff-engine";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const label = (strategy: PayoffStrategy) => strategy === "avalanche" ? "Avalanche" : strategy === "snowball" ? "Snowball" : "Custom";
export default function PayoffCalculatorPage({ accounts, amount, strategy, customDebtOrder, onAmount, onStrategy, onCustomOrder, onAccounts }: {
  accounts: DebtAccount[]; amount: number; strategy: PayoffStrategy; customDebtOrder: string[];
  onAmount: (amount: number) => void; onStrategy: (strategy: PayoffStrategy) => void; onCustomOrder: (ids: string[]) => void; onAccounts: () => void;
}) {
  const [calculationDate] = useState(() => new Date());
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const active = accounts.filter(a => !a.archivedAt && a.balance > 0);
  const plan = useMemo(() => calculatePayoffCalculator(accounts, amount, strategy, customDebtOrder, calculationDate), [accounts, amount, strategy, customDebtOrder, calculationDate]);
  const monthLabel = (month: number) => new Date(forecastMonthKey(month, calculationDate) + "-01T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const order = visibleCustomDebtOrder(accountsWithCustomDebtOrder(active, customDebtOrder).map(a => ({ ...a, payoffMode: "priority" as const })), customDebtOrder);
  const scheduleRows = plan.months;
  const displayedScheduleRows = scheduleExpanded ? scheduleRows : scheduleRows.slice(0, DEFAULT_SCHEDULE_PREVIEW_MONTHS);
  const startingDebt = round(active.reduce((sum, a) => sum + a.balance, 0));
  const move = (index: number, direction: number) => {
    const ids = order.map(a => a.id);
    const next = index + direction;
    if (next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    onCustomOrder(ids);
    setAnnouncement(`${order[index].name} moved to position ${next + 1} of ${ids.length}.`);
  };
  const exportReport = async (format: "csv" | "excel" | "pdf") => {
    setExporting(true); setExportError("");
    const report: PayoffReportData = {
      generatedAt: calculationDate.toISOString(), budgetMonth: monthLabel(1), strategy: label(strategy), projectedDebtFree: plan.stalled ? "No payoff at this amount" : monthLabel(plan.months.length), monthsToPayoff: plan.months.length, stalled: plan.stalled,
      startingDebt, monthlyPlan: amount, estimatedInterest: round(plan.totalInterest), extraPayment: amount,
      totalIncome: 0, totalExpenses: 0, totalBudget: 0, monthlySurplus: 0, totalMinimums: 0, availableExtra: 0, cashflow: [],
      accounts: active.map(a => ({ name: a.name, type: a.type, balance: a.balance, apr: a.apr, monthlyInterest: round(a.balance * a.apr / 1200), minimumPayment: 0, linkedCardExpenses: 0, plannedMonthlyPayment: round(plan.months[0]?.payments[a.id] ?? 0), payoffMode: "Calculator", creditLimit: a.creditLimit, utilization: a.creditLimit > 0 ? a.balance / a.creditLimit * 100 : null, dueDate: a.dueDate, projectedPayoff: plan.stalled ? "No payoff at this amount" : monthLabel(plan.months.find(m => (m.balances[a.id] ?? 0) <= 0)?.month ?? plan.months.length) })),
      schedule: plan.months.map(month => ({ month: monthLabel(month.month), focusDebt: active.filter(a => (month.payments[a.id] ?? 0) > 0).map(a => a.name).join(", "), minimumPayments: 0, extraPayment: round(month.paid), totalPaid: round(month.paid), interest: round(month.interest), remaining: round(month.remaining), milestone: month.paidOff.join(", "), accounts: active.map(a => ({ name: a.name, payment: round(month.payments[a.id] ?? 0), endingBalance: month.balances[a.id] ?? 0 })) })), transactions: [], snapshots: [],
    };
    try { if (format === "csv") exportPayoffCsv(report); else if (format === "excel") await exportPayoffExcel(report); else await exportPayoffPdf(report); }
    catch { setExportError("Could not export the calculation. Please try again."); }
    finally { setExporting(false); }
  };
  return <div className="screen plan-screen">
    <div className="screen-title"><div><span className="eyebrow">Payoff calculator</span><h1>Payoff plan</h1><p>Enter a monthly amount to see how long it could take to pay off your current debts.</p></div></div>
    <section className="plan-controls calculator-controls">
      <div className="extra-control"><label htmlFor="extra-monthly">Total monthly debt payment</label><div><b aria-hidden="true">$</b><input id="extra-monthly" type="number" min="0" step="0.01" inputMode="decimal" value={amount || ""} placeholder="7000" onChange={event => onAmount(Math.max(0, Number(event.target.value) || 0))}/></div><small>This is the entire monthly amount used by this calculator. Minimums and recorded payments are not added or subtracted.</small></div>
      <div className="strategy-control"><span>Payoff order</span><div>{(["avalanche", "snowball", "custom"] as const).map(value => <button type="button" key={value} className={strategy === value ? "active" : ""} aria-pressed={strategy === value} onClick={() => onStrategy(value)}>{label(value)}</button>)}</div><small>{strategy === "avalanche" ? "Highest interest rate first." : strategy === "snowball" ? "Smallest balance first." : "Your chosen order."}</small></div>
    </section>
    {strategy === "custom" && <details className="custom-order-card"><summary>Custom payoff order</summary><ol>{order.map((account, index) => <li key={account.id}><strong>{account.name}</strong><div className="custom-order-actions"><button type="button" disabled={index === 0} aria-label={`Move ${account.name} up`} onClick={() => move(index, -1)}>Move up</button><button type="button" disabled={index === order.length - 1} aria-label={`Move ${account.name} down`} onClick={() => move(index, 1)}>Move down</button></div></li>)}</ol><p role="status" aria-live="polite">{announcement}</p></details>}
    {!active.length ? <section className="large-empty"><h2>Add debts to calculate a payoff</h2><button className="primary" onClick={onAccounts}>Review debt accounts</button></section> : amount <= 0 ? <section className="large-empty"><h2>Enter a monthly amount</h2><p>Try $7,000 to calculate using $7,000 each month.</p></section> : <>
      <section className="plan-hero" aria-live="polite"><div><span>Time to pay off</span><strong>{plan.stalled ? "No payoff at this amount" : `${plan.months.length} months`}</strong><small>{plan.stalled ? "Increase the amount to outpace interest." : monthLabel(plan.months.length)}</small></div><div><span>Monthly calculator amount</span><strong>{money.format(amount)}</strong><small>Final month uses only the amount needed.</small></div><div><span>Estimated interest</span><strong>{money.format(plan.totalInterest)}</strong><small>Based on current balances and rates.</small></div></section>
      <section className="plan-table-card"><header className="plan-table-summary"><strong>Monthly payoff calculation</strong><button className="secondary" type="button" aria-expanded={scheduleExpanded} onClick={() => setScheduleExpanded(current => !current)}>{scheduleExpanded ? "Show fewer months" : `Show all ${scheduleRows.length} months`}</button></header><div className="plan-table-wrap"><table className="plan-table"><caption>Calculated monthly payments and remaining debt</caption><thead><tr><th>Month</th><th>Payment</th><th>Interest</th><th>Ending balance</th><th>Paid off</th></tr></thead><tbody>{displayedScheduleRows.map(month => <tr key={month.month}><td>{monthLabel(month.month)}</td><td>{money.format(month.paid)}</td><td>{money.format(month.interest)}</td><td>{money.format(month.remaining)}</td><td>{month.paidOff.join(", ") || "—"}</td></tr>)}</tbody></table></div></section>
      <details className="calculation-details"><summary>How this plan was calculated</summary><div className="calculation-details-body"><p>Starting debt: {money.format(startingDebt)}. Uses current balances, which already reflect recorded transactions. Payments already made are never deducted again.</p><p>Only your entered {money.format(amount)} is allocated each month in the selected order. No minimums, Budget expenses, or future purchases are added. All unarchived cards and other accounts listed in Debts are included, even if marked minimum only. Separate house/car loan trackers are excluded. This prioritization scenario does not reserve statement minimums for each account and may not satisfy lender payment requirements.</p><p>Interest is estimated monthly from each remaining balance, using the saved rate or interest calibration and promotional rate changes. This is a hypothetical calculator; it does not record payments or change Budget.</p></div></details>
      <div className="export-control"><span>Export calculation</span><div>{(["csv", "excel", "pdf"] as const).map(format => <button key={format} type="button" disabled={exporting} onClick={() => void exportReport(format)}>{format.toUpperCase()}</button>)}</div>{exportError && <p role="alert">{exportError}</p>}</div>
    </>}
  </div>;
}
