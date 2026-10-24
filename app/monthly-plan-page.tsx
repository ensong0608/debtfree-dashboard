"use client";

import { useState } from "react";
import { householdMonthOffset } from "./household-date";
import { createHouseholdMoneyFormatter } from "./household-currency";
import { useHouseholdCurrency } from "./household-currency-context";
import OutlineIcon from "./outline-icon";
import type { BudgetView } from "./budget-view";
import type { CashflowItem, CashflowKind, DebtAccount, LedgerTransaction, MonthlyPlanMonth } from "./dashboard-data";
import { isPlannedIncome } from "./monthly-plan";
import { round } from "./payoff-engine";
import type { ActivePayoffCommitment } from "./payoff-commitment";
import styles from "./monthly-plan-page.module.css";

function currentMonthKey() { return householdMonthOffset(0); }
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
  const isCurrent = month === currentMonthKey();
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
      <h1>Monthly budget</h1>
      <section className={styles.monthPicker} aria-label="Select plan month">
        <button type="button" onClick={() => props.onMonth(shiftMonth(month, -1))} aria-label="Previous month">&lsaquo;</button>
        <strong>{monthLabel(month)}</strong>
        <button type="button" onClick={() => props.onMonth(shiftMonth(month, 1))} aria-label="Next month">&rsaquo;</button>
        <button className={styles.today} type="button" disabled={isCurrent} onClick={() => props.onMonth(currentMonthKey())}>This month</button>
      </section>
    </header>

    {hasMonth && <section className={styles.summary} aria-label="Monthly budget summary">
      <div className={styles.summaryTop}>
        <div><span>Income</span><strong>{currency.format(income)}</strong></div>
        <button type="button" className={styles.editButton} disabled={props.readOnly} aria-expanded={incomeEditorOpen} onClick={() => setIncomeEditorOpen(open => !open)}>{incomeEditorOpen ? "Done" : "Edit"}</button>
      </div>
      <div className={styles.allocationTrack} aria-label={`${(allocatedPercent?.toFixed(0) ?? "—")}% of income allocated`}>
        <i className={styles.spendingSegment} style={{ width: `${allocatedShare}%` }} />
        <i className={styles.remainingSegment} style={{ width: `${Math.max(0, 100 - allocatedShare)}%` }} />
      </div>
      <div className={styles.summaryStats}>
        <div><span className={styles.dotSpending} /><strong>{currency.format(allocated)}</strong><small>Planned spending</small></div>
        <div><span className={styles.dotRemaining} /><strong>{currency.format(remaining)}</strong><small>Remaining</small></div>
        <div><strong>{(allocatedPercent?.toFixed(0) ?? "—")}%</strong><small>of income allocated</small></div>
      </div>
      {debtPayments > 0 && <p className={styles.debtNote}>Includes {currency.format(debtPayments)} planned for debt payments.</p>}
      {incomeEditorOpen && <div className={styles.incomeEditor}>
        <div className={styles.editorHeading}><strong>Income sources</strong><button type="button" disabled={props.readOnly} onClick={() => props.onAdd("income")}>＋ Add income</button></div>
        {incomeItems.length ? incomeItems.map(item => <button type="button" className={styles.incomeItem} key={item.id} disabled={props.readOnly} onClick={() => props.onEdit(item)}><span><strong>{item.name}</strong><small>{item.category}</small></span><b>{currency.format(item.amount)}</b><OutlineIcon name="chevron" /></button>) : <p>No planned income sources yet.</p>}
      </div>}
    </section>}

    {props.view.actual && <section className={styles.recorded} aria-label="Recorded spending"><span>Recorded spending</span><strong>{currency.format(props.view.actual.recordedSpending)}</strong><small>Recorded activity for {monthLabel(month)}.</small></section>}

    <section className={styles.categorySection} aria-label="Planned spending by category">
      <header className={styles.sectionHeading}><h2>Spending by Category</h2><button type="button" onClick={props.onViewTransactions}>See all <OutlineIcon name="chevron" /></button></header>
      {!hasMonth ? <section className={styles.monthStart}>
        <span>New month</span><h2>Set up {monthLabel(month)}</h2><p>Copy recurring items from last month or start clean. One-time adjustments are never copied.</p>
        <div>{previousHasItems && <button className="primary" type="button" disabled={props.readOnly} onClick={props.onCopyPrevious}>Copy recurring items</button>}<button className="secondary" type="button" disabled={props.readOnly} onClick={props.onStartBlank}>Start with no entries</button></div>
      </section> : <>
        <div className={styles.categories}>
          {groupedSpending.map(([category, categoryItems]) => {
            const total = round(categoryItems.reduce((sum, item) => sum + item.amount, 0));
            const shareOfIncome = income > 0 ? total / income * 100 : 0;
            return <details className={styles.category} key={category}>
              <summary>
                <span className={styles.categoryIcon}><OutlineIcon name={categoryIcon(category)} /></span>
                <span className={styles.categoryName}><strong>{category}</strong><i><b style={{ width: `${Math.min(100,shareOfIncome)}%` }} /></i></span>
                <strong className={styles.categoryAmount}>{currency.format(total)}</strong>
                <small className={styles.categoryShare}>{shareOfIncome.toFixed(0)}%</small>
                <button type="button" className={styles.categoryPlus} disabled={props.readOnly} aria-label={`Add to ${category}`} onClick={event => { event.preventDefault(); event.stopPropagation(); props.onAdd("expense", category); }}><OutlineIcon name="plus" /></button>
              </summary>
              <div className={styles.categoryItems}>
                {categoryItems.map(item => {
                  const recordedPaid = props.view.allocations.find(row => row.item.id === item.id)?.recordedPaid ?? 0;
                  return <button type="button" key={item.id} className={styles.entry} disabled={props.readOnly} onClick={() => props.onEdit(item)}>
                    <span className={styles.entryText}><strong>{item.name}</strong><small>{item.paymentMethod === "credit" ? accountNames.get(item.creditAccountId) ?? "Credit card" : item.category}{item.dueDay ? ` · Due day ${item.dueDay}` : ""}</small>{recordedPaid > 0 && <small>{recordedPaid >= item.amount ? "Paid" : "Part paid"} {currency.format(recordedPaid)}</small>}</span>
                    <b>{currency.format(item.amount)}</b><OutlineIcon name="chevron" />
                  </button>;
                })}
                <button type="button" className={styles.addEntry} disabled={props.readOnly} onClick={() => props.onAdd("expense", category)}><OutlineIcon name="plus" /> Add to {category}</button>
              </div>
            </details>;
          })}
          {debtPayments > 0 && <details className={`${styles.category} ${styles.debtCategory}`}>
            <summary><span className={styles.categoryIcon}><OutlineIcon name="card" /></span><span className={styles.categoryName}><strong>Debt payments</strong><i><b style={{ width: `${income > 0 ? debtShare / 100 * income / income * 100 : 0}%` }} /></i></span><strong className={styles.categoryAmount}>{currency.format(debtPayments)}</strong><small className={styles.categoryShare}>{income > 0 ? (debtPayments / income * 100).toFixed(0) : 0}%</small><span className={styles.categoryChevron}><OutlineIcon name="chevron" /></span></summary>
            <div className={styles.categoryItems}><p className={styles.debtDetail}>{props.commitment ? <>Household payment {currency.format(props.commitment.householdPayment)} · Schedule {currency.format(props.commitment.schedule.monthly)}{props.commitment.missingLoanPayments > 0 && " · Add missing loan payment amounts"}</> : "Saved debt payment commitment for this month."}</p></div>
          </details>}
          {!groupedSpending.length && debtPayments <= 0 && <p className={styles.empty}>No spending categories for this month yet.</p>}
        </div>
        <button type="button" className={styles.addCategory} disabled={props.readOnly} onClick={() => props.onAdd("expense")}><OutlineIcon name="plus" /> Add planned spending</button>
      </>}
    </section>
  </div>;
}
