"use client";

import { useState } from "react";
import { createHouseholdMoneyFormatter } from "./household-currency";
import { useHouseholdCurrency } from "./household-currency-context";
import OutlineIcon from "./outline-icon";
import type { BudgetView } from "./budget-view";
import type { CashflowItem, CashflowKind, DebtAccount, LedgerTransaction, MonthlyPlanMonth } from "./dashboard-data";
import { isPlannedIncome } from "./monthly-plan";
import { round } from "./payoff-engine";
import type { ActivePayoffCommitment } from "./payoff-commitment";
import styles from "./monthly-plan-page.module.css";

function shiftMonth(month: string, offset: number) {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(year, index - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(month: string) {
  const [year, index] = month.split("-").map(Number);
  return new Date(year, index - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function categoryIcon(category: string) {
  if (/insurance/i.test(category)) return "insurance" as const;
  if (/housing|mortgage|home|rent/i.test(category)) return "home" as const;
  if (/transport|car|auto|travel/i.test(category)) return "car" as const;
  if (/food|grocery|dining/i.test(category)) return "cart" as const;
  if (/debt|loan|payment/i.test(category)) return "card" as const;
  if (/bill|utilit/i.test(category)) return "calendar" as const;
  return "receipt" as const;
}

type Props = {
  view: BudgetView;
  readOnly: boolean;
  payoffAmount: number;
  commitment?: ActivePayoffCommitment;
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
  onAdd: (kind: CashflowKind, category?: string) => void;
  onEdit: (item: CashflowItem) => void;
  onSettings: (settings: MonthlyPlanMonth) => void;
  onTracking: (enabled: boolean) => void;
  onViewTransactions: () => void;
};

export default function MonthlyPlanPage(props: Props) {
  const householdCurrency = useHouseholdCurrency();
  const currency = createHouseholdMoneyFormatter(householdCurrency, { style: "currency", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { month, hasMonth, previousHasItems, items } = props;
  const [incomeEditorOpen, setIncomeEditorOpen] = useState(false);
  const incomeItems = items.filter(isPlannedIncome);
  const spendingItems = items.filter(item => !isPlannedIncome(item));
  const groupedSpending = [...spendingItems.reduce((groups, item) => {
    const category = item.category.trim() || "Other";
    groups.set(category, [...(groups.get(category) ?? []), item]);
    return groups;
  }, new Map<string, CashflowItem[]>())].sort(([a], [b]) => a.localeCompare(b));
  const income = props.view.planned.income;
  const plannedSpending = props.view.planned.spending;
  const debtPayments = Math.max(0, props.payoffAmount);
  const allocated = plannedSpending + debtPayments;
  const remaining = round(income - allocated);
  const allocatedPercent = income > 0 ? allocated / income * 100 : null;
  const allocatedShare = Math.min(100, allocatedPercent ?? 0);
  const spendingShare = income > 0 ? Math.min(100, plannedSpending / income * 100) : 0;
  const debtShare = income > 0 ? Math.min(Math.max(0, 100 - spendingShare), debtPayments / income * 100) : 0;
  const accountNames = new Map(props.accounts.map(account => [account.id, account.name]));

  return <div className={`screen ${styles.page}`}>
    <h1 className="sr-only">Budget</h1>
    <header className={styles.header}>
      <section className={styles.monthPicker} aria-label="Select plan month">
        <button type="button" onClick={() => props.onMonth(shiftMonth(month, -1))} aria-label="Previous month">&lsaquo;</button>
        <strong>{monthLabel(month)}</strong>
        <button type="button" onClick={() => props.onMonth(shiftMonth(month, 1))} aria-label="Next month">&rsaquo;</button>
      </section>
    </header>

    {hasMonth && <section className={styles.summary} aria-label="Monthly budget summary">
      <div className={styles.summaryTop}>
        <div><span>Income</span><strong><span className="money-value">{currency.format(income)}</span></strong></div>
        <button type="button" className={styles.editButton} disabled={props.readOnly} aria-expanded={incomeEditorOpen} onClick={() => setIncomeEditorOpen(open => !open)}>{incomeEditorOpen ? "Done" : "Edit"}</button>
      </div>
      <div className="budget-allocation-row"><div className={styles.allocationTrack} role="progressbar" aria-label="Income allocated" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.max(0,allocatedPercent??0))}><i className={styles.spendingSegment} style={{width:`${allocatedShare}%`}}/></div><strong>{allocatedPercent?.toFixed(0)??'—'}%</strong></div>
      <div className={styles.summaryStats}>
        <div><span className={styles.dotSpending} /><strong><span className="money-value">{currency.format(allocated)}</span></strong><small>Planned</small></div>
        <div><span className={styles.dotRemaining} /><strong><span className="money-value">{currency.format(remaining)}</span></strong><small>Remaining</small></div>
        
      </div>
      {debtPayments > 0 && <p className={styles.debtNote}>Includes <span className="money-value">{currency.format(debtPayments)}</span> planned for debt payments.</p>}
      {incomeEditorOpen && <div className={styles.incomeEditor}>
        <div className={styles.editorHeading}><strong>Income sources</strong><button type="button" disabled={props.readOnly} onClick={() => props.onAdd("income")}>＋ Add income</button></div>
        {incomeItems.length ? incomeItems.map(item => <button type="button" className={styles.incomeItem} key={item.id} disabled={props.readOnly} onClick={() => props.onEdit(item)}><span><strong>{item.name}</strong><small>{item.category}</small></span><b><span className="money-value">{currency.format(item.amount)}</span></b><OutlineIcon name="chevron" /></button>) : <p>No planned income sources yet.</p>}
      </div>}
    </section>}


    <section className={styles.categorySection} aria-label="Planned spending by category">
      <header className={styles.sectionHeading}><h2>Spending by category</h2><button type="button" onClick={props.onViewTransactions}>See all <OutlineIcon name="chevron" /></button></header>
      {!hasMonth ? <section className={styles.monthStart}>
        <span>New month</span><h2>Set up {monthLabel(month)}</h2><p>Copy recurring items from last month or start clean. One-time adjustments are never copied.</p>
        <div>{previousHasItems && <button className="primary" type="button" disabled={props.readOnly} onClick={props.onCopyPrevious}>Copy recurring items</button>}<button className="secondary" type="button" disabled={props.readOnly} onClick={props.onStartBlank}>Start with no entries</button></div>
      </section> : <>
        <div className={styles.categories}>
          {groupedSpending.map(([category, categoryItems]) => {
            const total = round(categoryItems.reduce((sum, item) => sum + item.amount, 0));
            const shareOfIncome = income > 0 ? total / income * 100 : 0;
            return <details className={styles.category} data-category-tone={categoryIcon(category)} key={category}>
              <summary>
                <span className={styles.categoryIcon}><OutlineIcon name={categoryIcon(category)} /></span>
                <span className={styles.categoryName}><strong>{category}</strong><i><b style={{ width: `${Math.min(100,shareOfIncome)}%` }} /></i></span>
                <strong className={styles.categoryAmount}><span className="money-value">{currency.format(total)}</span></strong>
                <small className={styles.categoryShare}>{shareOfIncome.toFixed(0)}%</small>
                <button type="button" className={styles.categoryPlus} disabled={props.readOnly} aria-label={`Add to ${category}`} onClick={event => { event.preventDefault(); event.stopPropagation(); props.onAdd("expense", category); }}><OutlineIcon name="plus" /></button>
              </summary>
              <div className={styles.categoryItems}>
                {categoryItems.map(item => {
                  const recordedPaid = props.view.allocations.find(row => row.item.id === item.id)?.recordedPaid ?? 0;
                  return <button type="button" key={item.id} className={styles.entry} disabled={props.readOnly} onClick={() => props.onEdit(item)}>
                    <span className={styles.entryText}><strong>{item.name}</strong><small>{item.paymentMethod === "credit" ? accountNames.get(item.creditAccountId) ?? "Credit card" : item.category}{item.dueDay ? ` · Due day ${item.dueDay}` : ""}</small>{recordedPaid > 0 && <small>{recordedPaid >= item.amount ? "Paid" : "Part paid"} <span className="money-value">{currency.format(recordedPaid)}</span></small>}</span>
                    <b><span className="money-value">{currency.format(item.amount)}</span></b><OutlineIcon name="chevron" />
                  </button>;
                })}
                <button type="button" className={styles.addEntry} disabled={props.readOnly} onClick={() => props.onAdd("expense", category)}><OutlineIcon name="plus" /> Add to {category}</button>
              </div>
            </details>;
          })}
          {debtPayments > 0 && <details className={`${styles.category} ${styles.debtCategory}`} data-category-tone="card">
            <summary><span className={styles.categoryIcon}><OutlineIcon name="card" /></span><span className={styles.categoryName}><strong>Debt payments</strong><i><b style={{ width: `${income > 0 ? debtShare / 100 * income / income * 100 : 0}%` }} /></i></span><strong className={styles.categoryAmount}><span className="money-value">{currency.format(debtPayments)}</span></strong><small className={styles.categoryShare}>{income > 0 ? (debtPayments / income * 100).toFixed(0) : 0}%</small><span className={styles.categoryChevron}><OutlineIcon name="chevron" /></span></summary>
            <div className={styles.categoryItems}><p className={styles.debtDetail}>{props.commitment ? <>Household payment <span className="money-value">{currency.format(props.commitment.householdPayment)}</span> · Schedule <span className="money-value">{currency.format(props.commitment.schedule.monthly)}</span>{props.commitment.missingLoanPayments > 0 && " · Add missing loan payment amounts"}</> : "Saved debt payment commitment for this month."}</p></div>
          </details>}
          {!groupedSpending.length && debtPayments <= 0 && <p className={styles.empty}>No spending categories for this month yet.</p>}
        </div>
      </>}
    </section>
  </div>;
}
