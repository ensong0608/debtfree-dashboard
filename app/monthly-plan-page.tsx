"use client";

import { useState } from "react";
import { settlementReports } from "./plan-settlements";
import PlanSettlementDialog, { type SettlementRequest } from "./plan-settlement-dialog";
import type { CashflowItem, CashflowKind, DebtAccount, LedgerTransaction, MonthlyPlanMonth } from "./dashboard-data";
import { calculateMonthlyPlan, debtPaymentProgress, isPlannedIncome, isRecurringPlannedItem, spentForPlannedItem } from "./monthly-plan";
import { round } from "./payoff-engine";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function currentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function shiftMonth(month: string, offset: number) {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(year, index - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(month: string) {
  const [year, index] = month.split("-").map(Number);
  return new Date(year, index - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

type Props = {
  month: string;
  hasMonth: boolean;
  previousHasItems: boolean;
  items: CashflowItem[];
  accounts: DebtAccount[];
  transactions: LedgerTransaction[];
  settings: MonthlyPlanMonth;
  trackingEnabled: boolean;
  plannedPayments: Record<string, number>;
  plannedMinimums?: Record<string, number>;
  onMonth: (month: string) => void;
  onCopyPrevious: () => void;
  onStartBlank: () => void;
  onAdd: (kind: CashflowKind) => void;
  onEdit: (item: CashflowItem) => void;
  onSettings: (settings: MonthlyPlanMonth) => void;
  onTracking: (enabled: boolean) => void;
  onViewTransactions: () => void;
};

export default function MonthlyPlanPage(props: Props) {
  const { month, hasMonth, previousHasItems, items, accounts, transactions, settings, trackingEnabled, plannedPayments } = props;
  const [settlementRequest, setSettlementRequest] = useState<SettlementRequest | null>(null);
  const reports = [...transactions, ...settlementReports(settings.settlements)];
  const totals = calculateMonthlyPlan(items, transactions, month, settings, true);
  const payments = debtPaymentProgress(accounts, plannedPayments, reports, month, props.plannedMinimums);
  const totalDebtPaid = round(payments.reduce((sum, item) => sum + item.paid, 0));
  const totalDebtRemaining = round(payments.reduce((sum, item) => sum + item.remaining, 0));
  const isCurrent = month === currentMonthKey();
  const groups = [
    { id: "income", title: "Recurring income", items: items.filter((item) => isPlannedIncome(item) && isRecurringPlannedItem(item)), kind: "income" as CashflowKind, empty: "Add take-home income you expect each month." },
    { id: "spending", title: "Recurring planned spending", items: items.filter((item) => !isPlannedIncome(item) && isRecurringPlannedItem(item)), kind: "expense" as CashflowKind, empty: "Add essential bills and regular household spending." },
    { id: "adjustments", title: "One-time adjustments", items: items.filter((item) => !isRecurringPlannedItem(item)), kind: "purchase" as CashflowKind, empty: "Add income or spending that applies only to this month." },
  ];
  const payoffTarget = round(Object.values(plannedPayments).reduce((sum, amount) => sum + amount, 0));
  const targetGap = round(totals.availableDebtPayment - payoffTarget);
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));

  return <div className="screen monthly-plan-screen">
    <div className="screen-title monthly-title"><div><span className="eyebrow">{isCurrent ? "Current monthly plan" : "Monthly plan archive"}</span><h1>Budget</h1><p>Your Monthly Plan: itemize income, expenses, and monthly bills. Planned entries never change a debt balance.</p></div><div className="cashflow-quick-actions"><button className="income-action" type="button" onClick={() => props.onAdd("income")}>+ Recurring income</button><button className="expense-action" type="button" onClick={() => props.onAdd("expense")}>+ Recurring spending</button><button className="purchase-action" type="button" onClick={() => props.onAdd("purchase")}>+ One-time adjustment</button></div></div>



    <section className="month-switcher" aria-label="Select plan month"><button type="button" onClick={() => props.onMonth(shiftMonth(month, -1))} aria-label="Previous month">&lsaquo;</button><div><span>{isCurrent ? "Current month" : "Plan month"}</span><strong>{monthLabel(month)}</strong></div><button type="button" onClick={() => props.onMonth(shiftMonth(month, 1))} aria-label="Next month">&rsaquo;</button><button className="today-month" type="button" disabled={isCurrent} onClick={() => props.onMonth(currentMonthKey())}>This month</button></section>

    {!hasMonth ? <section className="month-start-card"><span>New month</span><h2>Set up {monthLabel(month)}</h2><p>Copy recurring items from last month or start clean. One-time adjustments are never copied.</p><div>{previousHasItems && <button className="primary" type="button" onClick={props.onCopyPrevious}>Copy recurring items</button>}<button className="secondary" type="button" onClick={props.onStartBlank}>Start with no entries</button></div></section> : <>
      <section className="monthly-plan-groups" aria-label="Planned entries">{groups.map((group) => <article key={group.id}><header><div><span>{group.title}</span><small>{group.items.length} {group.items.length === 1 ? "item" : "items"}</small></div><button type="button" onClick={() => props.onAdd(group.kind)}>+ Add</button></header>{group.items.length ? <div className="monthly-plan-items">{group.items.map((item) => { const spent = spentForPlannedItem(item.id, reports, month, true); const remaining = item.amount - spent; return <div className="planned-entry-row" key={item.id}><button type="button" onClick={() => props.onEdit(item)} aria-label={`Edit ${item.name}`}><div><strong>{item.name}</strong><small>{item.category}{item.paymentMethod === "credit" ? ` / ${accountNames.get(item.creditAccountId) ?? "Credit card"}` : ""}</small></div><dl><div><dt>Planned</dt><dd>{currency.format(item.amount)}</dd></div>{!isPlannedIncome(item) && <><div><dt>Spent</dt><dd>{currency.format(spent)}</dd></div><div><dt>Remaining</dt><dd>{currency.format(remaining)}</dd></div></>}</dl></button>{!isPlannedIncome(item) && <button className="secondary paid-entry-action" aria-label={`Record paid for ${item.name}`} onClick={() => setSettlementRequest({targetId:item.id,name:item.name,kind:"spending",amount:Math.max(0,round(remaining)),source:item.paymentMethod === "credit" ? "included" : "debit"})}>Record paid</button>}</div>; })}</div> : <p className="monthly-plan-empty">{group.empty}</p>}</article>)}</section>

      <section className="plan-truth-summary" aria-label="Planned, spent, and remaining"><div><span>Planned</span><strong>{currency.format(totals.plannedSpending)}</strong><small>Expected household spending</small></div><div><span>Spent</span><strong>{currency.format(calculateMonthlyPlan(items, transactions, month, settings, true).spent)}</strong><small>{"Linked transactions and paid expense records"}</small></div><div><span>Remaining</span><strong>{currency.format(calculateMonthlyPlan(items, transactions, month, settings, true).remaining)}</strong><small>{totals.remaining < 0 ? "Over the planned spending amount" : "Planned spending still available"}</small></div></section>

      <section className="debt-capacity-card" aria-labelledby="debt-capacity-title">
        <div><span>Supports your payoff plan</span><h2 id="debt-capacity-title">Available debt payment</h2><p>This is the most your plan says can go to debt after expected household spending and the cash you choose to keep untouched.</p></div>
        <div className="capacity-fields"><label><span>Cash cushion to keep</span><div><b>$</b><input aria-label="Cash cushion (monthly safety buffer)" aria-describedby="cash-cushion-help" type="number" min="0" step="0.01" inputMode="decimal" value={settings.safetyBuffer || ""} placeholder="0.00" onChange={(event) => props.onSettings({ ...settings, safetyBuffer: Math.max(0, Number(event.target.value) || 0) })}/></div><small id="cash-cushion-help" className="field-help">Optional money left in checking for surprises. It reduces the amount available for debt; it is not a charge or payment.</small></label></div>
        <dl><div><dt>Take-home income</dt><dd>{currency.format(totals.plannedIncome)}</dd></div><div><dt>Essential planned spending</dt><dd>-{currency.format(totals.plannedSpending)}</dd></div><div><dt>Cash cushion</dt><dd>-{currency.format(totals.safetyBuffer)}</dd></div><div className="available"><dt>Available for debt</dt><dd>{currency.format(totals.availableDebtPayment)}</dd></div><div><dt>Payoff Plan calls for</dt><dd>{currency.format(payoffTarget)}</dd></div><div><dt>{targetGap >= 0 ? "Left after planned payments" : "Plan shortfall"}</dt><dd>{currency.format(Math.abs(targetGap))}</dd></div></dl>
        {targetGap < 0 && <p className="form-error" role="alert">The current Payoff Plan calls for {currency.format(Math.abs(targetGap))} more than this Monthly Plan makes available. Lower planned spending or the cash cushion, or adjust the payoff amount.</p>}
      </section>



      <section className="monthly-debt-progress" aria-labelledby="monthly-debt-progress-title"><header><div><span>Recorded debt payments</span><h2 id="monthly-debt-progress-title">Debt payments this month</h2><p>Use Minimum already paid when your current balance already includes that payment. To record a new payment that reduces debt, use Record payment in Payments.</p></div><dl><div><dt>Paid so far</dt><dd>{currency.format(totalDebtPaid)}</dd></div><div><dt>Still planned</dt><dd>{currency.format(totalDebtRemaining)}</dd></div></dl></header><div>{payments.map((payment) => <article key={payment.accountId}><div><strong>{payment.accountName}</strong><span className={payment.remaining === 0 ? "payment-status complete" : "payment-status pending"}>{payment.remaining === 0 ? "Target met" : `${currency.format(payment.remaining)} still planned`}</span></div><dl><div><dt>Minimum</dt><dd>{currency.format(payment.minimumPaid)} paid / {currency.format(payment.minimumTarget)} planned</dd></div><div><dt>Extra</dt><dd>{currency.format(payment.extraPaid)} paid / {currency.format(payment.extraTarget)} planned</dd></div></dl>{payment.remainingMinimum > 0 && <button className="secondary" aria-label={`Minimum already paid for ${payment.accountName}`} onClick={() => setSettlementRequest({targetId:payment.accountId,name:payment.accountName,kind:"minimum",amount:payment.remainingMinimum,source:"included"})}>Minimum already paid</button>}{payment.remainingMinimum > 0 && payment.extraPaid > 0 && <small>Extra payment recorded; {currency.format(payment.remainingMinimum)} statement minimum is still planned.</small>}</article>)}</div></section>
    </>}
    <details className="budget-optional"><summary>Detailed spending tracking (optional)</summary>
    <section className="tracking-preference" aria-labelledby="tracking-title"><div><span>Optional detail</span><h2 id="tracking-title">Detailed spending tracking</h2><p>Turn this on for charges, fees, categories, receipts, batch entry, payees, and planned-versus-actual comparisons. Turning it off hides those tools without deleting data.</p></div><label className="tracking-toggle"><input type="checkbox" checked={trackingEnabled} onChange={(event) => props.onTracking(event.target.checked)}/><span>Enable detailed spending tracking</span></label>{trackingEnabled && <button className="secondary" type="button" onClick={props.onViewTransactions}>Open transactions</button>}</section>
    </details>
    {!!settings.settlements?.length && <section className="monthly-debt-progress"><h2>Paid records without balance changes</h2><p>These records apply only to {monthLabel(month)}. Undo removes the record without changing debt balances.</p>{settings.settlements.map(entry => <div key={entry.id}><span>{entry.name} — {currency.format(entry.amount)} — {entry.date} — {entry.kind === "minimum" ? "Minimum already paid" : entry.source === "debit" ? "Debit / checking" : "Already in card balance"}</span><button className="secondary" aria-label={`Undo paid record for ${entry.name}`} onClick={() => props.onSettings({...settings,settlements:settings.settlements?.filter(e=>e.id!==entry.id)})}>Undo</button></div>)}</section>}
    {settlementRequest && <PlanSettlementDialog request={settlementRequest} month={month} onClose={() => setSettlementRequest(null)} onSave={entry => { props.onSettings({...settings,settlements:[...(settings.settlements??[]),entry]}); setSettlementRequest(null); }}/>}
  </div>;
}
