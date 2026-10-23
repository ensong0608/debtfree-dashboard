"use client";
import { householdMonthOffset } from "./household-date";
import InfoTooltip from "./info-tooltip";
import { createHouseholdMoneyFormatter, } from "./household-currency";
import { useHouseholdCurrency } from "./household-currency-context";

import OutlineIcon from "./outline-icon";
import { settlementReports } from "./plan-settlements";
import type { CashflowItem, CashflowKind, DebtAccount, LedgerTransaction, MonthlyPlanMonth } from "./dashboard-data";
import { isPlannedIncome, isRecurringPlannedItem, spentForPlannedItem } from "./monthly-plan";
import { round } from "./payoff-engine";
import type { ActivePayoffCommitment } from "./payoff-commitment";



function currentMonthKey() {
  return householdMonthOffset(0);
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
  onAdd: (kind: CashflowKind) => void;
  onEdit: (item: CashflowItem) => void;
  onSettings: (settings: MonthlyPlanMonth) => void;
  onTracking: (enabled: boolean) => void;
  onViewTransactions: () => void;
};

export default function MonthlyPlanPage(props: Props) {
  const householdCurrency = useHouseholdCurrency();
  const currency = createHouseholdMoneyFormatter(householdCurrency, { style: "currency", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { month, hasMonth, previousHasItems, items, accounts, transactions, settings } = props;
  const reports = [...transactions, ...settlementReports(settings.settlements)];
  const isCurrent = month === currentMonthKey();
  const groups = [
    { id: "income", title: "Income", items: items.filter((item) => isPlannedIncome(item) && isRecurringPlannedItem(item)), kind: "income" as CashflowKind, empty: "Add take-home income you expect each month." },
    { id: "spending", title: "Spending", items: items.filter((item) => !isPlannedIncome(item) && isRecurringPlannedItem(item)), kind: "expense" as CashflowKind, empty: "Add essential bills and regular household spending." },
    { id: "adjustments", title: "One-time", items: items.filter((item) => !isRecurringPlannedItem(item)), kind: "purchase" as CashflowKind, empty: "Add income or spending that applies only to this month." },
  ];
  const income = round(items.filter(isPlannedIncome).reduce((sum, item) => sum + item.amount, 0));
  const spending = round(items.filter(item => !isPlannedIncome(item)).reduce((sum, item) => sum + item.amount, 0));
  const left = round(income - spending);
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));

  const allocationBase = Math.max(income, spending + props.payoffAmount, 1);
  const spendingShare = Math.max(0, spending) / allocationBase * 100;
  const payoffShare = Math.max(0, props.payoffAmount) / allocationBase * 100;

  return <div className="screen monthly-plan-screen">
    <h1 className="sr-only">Budget</h1>

    <section className="month-switcher" aria-label="Select plan month"><button type="button" onClick={() => props.onMonth(shiftMonth(month, -1))} aria-label="Previous month">&lsaquo;</button><div><strong>{monthLabel(month)}</strong></div><button type="button" onClick={() => props.onMonth(shiftMonth(month, 1))} aria-label="Next month">&rsaquo;</button><button className="today-month" type="button" disabled={isCurrent} onClick={() => props.onMonth(currentMonthKey())}>This month</button></section>

    {hasMonth && <section className="budget-summary" aria-label="Monthly budget summary"><div className="budget-overview"><span><InfoTooltip label="Left after planned spending">{"Planned income minus planned spending for the selected month. Your payoff commitment is subtracted separately below."}</InfoTooltip></span><strong>{currency.format(left)}</strong></div><dl><div><dt><InfoTooltip label="Income">{"The total of the selected month’s planned income entries."}</InfoTooltip></dt><dd>{currency.format(income)}</dd></div><div><dt><InfoTooltip label="Planned spending">{"The total of this month’s entries that are not planned income. These are planned amounts, not a count of recorded bank transactions."}</InfoTooltip></dt><dd>{currency.format(spending)}</dd></div><div className="budget-commitment"><dt><InfoTooltip label="Payoff commitment">{"Household debt payments minus loan payments already in planned spending. Excluded debt types still require minimum payments. Other months retain their saved commitment."}</InfoTooltip></dt><dd>{currency.format(props.payoffAmount)}</dd></div></dl><div className="budget-after"><span><OutlineIcon name="trend"/><InfoTooltip label="After payoff commitment">{"Planned income minus planned spending minus the payoff commitment. A negative value means the current plan allocates more than the planned income."}</InfoTooltip></span><strong>{currency.format(round(left - props.payoffAmount))}</strong></div><small className="budget-commitment-detail">{props.commitment ? <>Household payments {currency.format(props.commitment.householdPayment)} · Schedule {currency.format(props.commitment.schedule.monthly)} · Outside schedule {currency.format(props.commitment.outsideSchedulePayments)} · Loans in Spending {currency.format(props.commitment.loanPaymentsInSpending)}{props.commitment.missingLoanPayments > 0 && " · Add missing loan payment amounts"}</> : "Saved payoff commitment for this month."}</small><div className="budget-allocation" aria-label="Income allocation"><div className="budget-allocation-track"><i style={{width: `${spendingShare}%`}}/><i style={{width: `${payoffShare}%`}}/><i style={{width: `${Math.max(0, 100-spendingShare-payoffShare)}%`}}/></div><div className="budget-allocation-legend"><span>Spending</span><span>Debt</span><span>Remaining</span></div></div></section>}

    {!hasMonth ? <section className="month-start-card"><span>New month</span><h2>Set up {monthLabel(month)}</h2><p>Copy recurring items from last month or start clean. One-time adjustments are never copied.</p><div>{previousHasItems && <button className="primary" type="button" onClick={props.onCopyPrevious}>Copy recurring items</button>}<button className="secondary" type="button" onClick={props.onStartBlank}>Start with no entries</button></div></section> : <>
      <section className="monthly-plan-groups budget-section-cards" aria-label="Planned entries">{groups.map(group => <details className="budget-section-card" key={group.id} open={group.id === "spending"}><summary><div className="budget-category-heading"><span className={`budget-category-icon ${group.id}`}><OutlineIcon name={group.id === "income" ? "money" : group.id === "spending" ? "cart" : "calendar"}/></span><div><strong>{group.title}</strong><b>{currency.format(round(group.items.reduce((sum,item) => sum + (group.id === "adjustments" && isPlannedIncome(item) ? -item.amount : item.amount),0)))}</b></div></div><i className="budget-collapse" aria-hidden="true"><OutlineIcon name="chevron"/></i></summary>{group.items.length ? <div className="monthly-plan-items">{group.items.map(item => { const spent=spentForPlannedItem(item.id,reports,month,true);const remaining=round(item.amount-spent);return <div className="planned-entry-row clean-budget-row" key={item.id}><button type="button" aria-label={`Edit ${item.name}`} onClick={()=>props.onEdit(item)}><i className="budget-row-icon"><OutlineIcon name={group.id === "income" ? "money" : /housing|mortgage|hoa/i.test(item.category + " " + item.name) ? "home" : /transport|car|honda|auto/i.test(item.category + " " + item.name) ? "car" : "receipt"}/></i><span><strong>{item.name}</strong><small>{item.category}{item.paymentMethod === "credit" ? ` · ${accountNames.get(item.creditAccountId) ?? "Credit card"}` : ""}</small>{!isPlannedIncome(item) && spent > 0 && <small>Paid {currency.format(spent)} · Remaining {currency.format(remaining)}</small>}</span><span className="budget-row-value">{!isPlannedIncome(item) && spent >= item.amount && item.amount > 0 && <small className="budget-paid"><OutlineIcon name="check"/>Paid</small>}<b>{group.id === "adjustments" && isPlannedIncome(item) ? "+" : ""}{currency.format(item.amount)}</b></span><OutlineIcon name="chevron"/></button></div>;})}</div> : <p className="monthly-plan-empty">{group.empty}</p>}</details>)}</section>
    </>}
  </div>;
}
