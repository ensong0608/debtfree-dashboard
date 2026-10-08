"use client";

import { settlementReports } from "./plan-settlements";
import type { CashflowItem, CashflowKind, DebtAccount, LedgerTransaction, MonthlyPlanMonth } from "./dashboard-data";
import { isPlannedIncome, isRecurringPlannedItem, spentForPlannedItem } from "./monthly-plan";
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

function BudgetIcon({ kind }: { kind: string }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {kind === "income" ? <><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M5 16v4h14v-4"/></> : kind === "spending" ? <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/></> : <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></>}
  </svg>;
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
  const { month, hasMonth, previousHasItems, items, accounts, transactions, settings } = props;
  const reports = [...transactions, ...settlementReports(settings.settlements)];
  const isCurrent = month === currentMonthKey();
  const groups = [
    { id: "income", title: "Income", items: items.filter((item) => isPlannedIncome(item) && isRecurringPlannedItem(item)), kind: "income" as CashflowKind, empty: "Add take-home income you expect each month." },
    { id: "spending", title: "Spending", items: items.filter((item) => !isPlannedIncome(item) && isRecurringPlannedItem(item)), kind: "expense" as CashflowKind, empty: "Add essential bills and regular household spending." },
    { id: "adjustments", title: "Oneoff", items: items.filter((item) => !isRecurringPlannedItem(item)), kind: "purchase" as CashflowKind, empty: "Add income or spending that applies only to this month." },
  ];
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));

  return <div className="screen monthly-plan-screen">
    <h1 className="sr-only">Budget</h1>

    <section className="month-switcher" aria-label="Select plan month"><button type="button" onClick={() => props.onMonth(shiftMonth(month, -1))} aria-label="Previous month">&lsaquo;</button><div><span>{isCurrent ? "Current month" : "Plan month"}</span><strong>{monthLabel(month)}</strong></div><button type="button" onClick={() => props.onMonth(shiftMonth(month, 1))} aria-label="Next month">&rsaquo;</button><button className="today-month" type="button" disabled={isCurrent} onClick={() => props.onMonth(currentMonthKey())}>This month</button></section>

    {!hasMonth ? <section className="month-start-card"><span>New month</span><h2>Set up {monthLabel(month)}</h2><p>Copy recurring items from last month or start clean. One-time adjustments are never copied.</p><div>{previousHasItems && <button className="primary" type="button" onClick={props.onCopyPrevious}>Copy recurring items</button>}<button className="secondary" type="button" onClick={props.onStartBlank}>Start with no entries</button></div></section> : <>
      <section className="monthly-plan-groups budget-section-cards" aria-label="Planned entries">{groups.map(group => <details className="budget-section-card" key={group.id} open={group.id === "spending"}><summary><div className="budget-category-heading"><span className={`budget-category-icon ${group.id}`}><BudgetIcon kind={group.id}/></span><div><strong>{group.title}</strong><small>{group.items.length} {group.items.length === 1 ? "entry" : "entries"}{group.id === "adjustments" ? " · This month only" : ""}</small></div></div><b>{currency.format(round(group.items.reduce((sum,item) => sum + (group.id === "adjustments" && isPlannedIncome(item) ? -item.amount : item.amount),0)))} <i aria-hidden="true">›</i></b></summary>{group.items.length ? <div className="monthly-plan-items">{group.items.map(item => { const spent=spentForPlannedItem(item.id,reports,month,true);const remaining=round(item.amount-spent);return <div className="planned-entry-row clean-budget-row" key={item.id}><button type="button" aria-label={`Edit ${item.name}`} onClick={()=>props.onEdit(item)}><span><strong>{item.name}</strong><small>{item.category}{item.paymentMethod === "credit" ? ` · ${accountNames.get(item.creditAccountId) ?? "Credit card"}` : ""}</small>{!isPlannedIncome(item) && spent > 0 && <small>Paid {currency.format(spent)} · Remaining {currency.format(remaining)}</small>}</span><b>{group.id === "adjustments" && isPlannedIncome(item) ? "+" : ""}{currency.format(item.amount)}</b></button></div>;})}</div> : <p className="monthly-plan-empty">{group.empty}</p>}</details>)}</section>
    </>}
  </div>;
}
