import type { BalanceAdjustment, CashflowItem, LedgerTransaction, MonthlyPlanSettings } from './dashboard-data.ts';
import { linkedLoanPayment, type LoanTracker } from './loan-progress.ts';
import { spentForPlannedItem } from './monthly-plan.ts';
import { monthlyBudgetCommitment, type ActivePayoffCommitment } from './payoff-commitment.ts';
import { paymentActivity } from './payments.ts';
import { settlementReports } from './plan-settlements.ts';
import { round } from './payoff-engine.ts';

export type BudgetTab = 'Overview' | 'Next Due' | 'Schedule';
export type BudgetPeriod = 'month' | 'year' | 'lifetime';
export function inBudgetPeriod(date: string, month: string, period: BudgetPeriod) {
  return period === 'lifetime' || date.slice(0, period === 'year' ? 4 : 7) === month.slice(0, period === 'year' ? 4 : 7);
}

/** IDs identify records. Equal dates/amounts alone never prove a duplicate purchase. */
function uniqueRecords<T extends { id: string }>(records: T[]) {
  return [...new Map(records.map(record => [record.id, record])).values()];
}
export function budgetReports(transactions: LedgerTransaction[], settings: MonthlyPlanSettings) {
  return uniqueRecords([...uniqueRecords(transactions).filter(row => !row.deletedAt && !row.replacedByTransactionId),
    ...settlementReports(uniqueRecords(Object.values(settings.months).flatMap(month => month.settlements ?? [])))]);
}

/** Debt activity retains the existing classification and overlap rules. Settlement reports
 * remain separate: they are paid checklists, never extra ledger/balance movements. */
export function buildBudgetActivity(transactions: LedgerTransaction[], adjustments: BalanceAdjustment[], settings: MonthlyPlanSettings, month: string, period: BudgetPeriod = 'month') {
  const reports = budgetReports(transactions, settings);
  const rows = paymentActivity(reports.filter(row => !row.id.startsWith('settlement:')), uniqueRecords(adjustments)).filter(row => inBudgetPeriod(row.date, month, period));
  const settlements = reports.filter(row => row.id.startsWith('settlement:') && inBudgetPeriod(row.date, month, period));
  return { rows, settlements, totals: {
    payments: round(rows.filter(row => row.kind === 'payment').reduce((sum, row) => sum + row.amount, 0)),
    credits: round(rows.filter(row => row.kind === 'credit').reduce((sum, row) => sum + row.amount, 0)),
    netDebtChange: round(rows.reduce((sum, row) => sum + row.difference, 0)),
    settledSpending: round(settlements.filter(row => row.type === 'charge').reduce((sum, row) => sum + row.amount, 0)),
    settledMinimums: round(settlements.filter(row => row.type === 'payment').reduce((sum, row) => sum + row.amount, 0)),
  } };
}

export function buildBudgetView(input: { items: CashflowItem[]; transactions: LedgerTransaction[]; settings: MonthlyPlanSettings; loans: LoanTracker[]; month: string; currentMonth: string; commitment: ActivePayoffCommitment }) {
  const { items, settings, month, currentMonth, commitment, loans } = input;
  const reports = budgetReports(input.transactions, settings);
  // Interest/fees and payments are debt activity, not household purchases. Linked
  // loan obligations stay in planned cashflow but outside household-spending actuals.
  const purchases = reports.filter(row => row.type === 'charge' && row.category !== 'Interest' && !row.interestEstimate && !row.actualInterestCycle);
  const linkedIds = new Set(loans.map(loan => linkedLoanPayment(loan, items)?.id).filter(Boolean));
  const ambiguousIds = new Set(purchases.filter(row => row.id.startsWith('settlement:') && row.date.slice(0, 7) === month && row.plannedItemId && purchases.some(other => !other.id.startsWith('settlement:') && other.plannedItemId === row.plannedItemId && other.date.slice(0, 7) === month)).map(row => row.plannedItemId));
  const allocations = items.map(item => {
    const matched = purchases.filter(row => row.plannedItemId === item.id && row.date.slice(0, 7) === month);
    let recordedPaid = item.kind === 'income' || !matched.length || ambiguousIds.has(item.id) ? null : spentForPlannedItem(item.id, matched, month, true);
    const loanPayments=loans.filter(loan=>linkedLoanPayment(loan,items)?.id===item.id).flatMap(loan=>loan.history).filter(entry=>entry.payment!==undefined&&entry.date.slice(0,7)===month);
    if(loanPayments.length)recordedPaid=Math.max(recordedPaid??0,round(loanPayments.reduce((sum,entry)=>sum+(entry.payment??0),0)));
    return { item, planned: item.amount, linkedLoan: linkedIds.has(item.id), recordedPaid, coverage: ambiguousIds.has(item.id) ? 'overlap-unresolved' as const : matched.length ? 'recorded-only' as const : 'unrecorded' as const, householdSpending: item.kind !== 'income' && !linkedIds.has(item.id) };
  });
  const income = round(items.filter(item => item.kind === 'income').reduce((sum, item) => sum + item.amount, 0));
  const spending = round(items.filter(item => item.kind !== 'income').reduce((sum, item) => sum + item.amount, 0));
  const payoff = monthlyBudgetCommitment(settings, month, currentMonth, commitment.budgetCommitment);
  const recorded = purchases.filter(row => row.date.slice(0, 7) === month && (!row.plannedItemId || !linkedIds.has(row.plannedItemId)));
  return { month, allocations, planned: { income, spending, payoff, afterSpending: round(income - spending), remaining: round(income - spending - payoff), safetyBuffer: settings.months[month]?.safetyBuffer ?? 0 },
    actual: settings.detailedSpendingTracking && recorded.length && !recorded.some(row => ambiguousIds.has(row.plannedItemId)) ? { recordedSpending: round(recorded.reduce((sum, row) => sum + row.amount, 0)), records: recorded.map(row => ({id: row.id, title: row.title || row.payeeName || row.category, date: row.date, amount: row.amount, markedPaid: row.id.startsWith('settlement:')})), coverage: 'recorded-only' as const } : null,
    // No persisted coverage attestation or actual-income ledger exists. Recording
    // some purchases cannot establish comparable full-month or prior-month coverage.
    spendingComparison: null,
    unresolvedSpendingOverlap: ambiguousIds.size > 0,
    commitment: month === currentMonth ? commitment : null,
  };
}
export type BudgetView = ReturnType<typeof buildBudgetView>;

/** Loan observations are separate from account ledger movement and checklist
 * settlements. Preserve principal/interest/escrow, without summing overlapping feeds. */
export function budgetLoanActivity(loans: LoanTracker[], month: string, period: BudgetPeriod = 'month') {
  return loans.flatMap(loan => loan.history.flatMap((entry, index) => entry.payment === undefined || !inBudgetPeriod(entry.date, month, period) ? [] : [{ id: `loan:${loan.id}:${index}`, loanId: loan.id, name: loan.name, ...entry }])).sort((a, b) => b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt));
}
