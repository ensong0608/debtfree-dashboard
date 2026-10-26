import type { CashflowItem, DebtAccount, LedgerTransaction, MonthlyPlanSettings } from './dashboard-data.ts';
import { householdDate } from './household-date.ts';
import { linkedLoanPayment, regularLoanPayment, type LoanTracker } from './loan-progress.ts';
import { debtPaymentProgress, isRecurringPlannedItem } from './monthly-plan.ts';
import { effectiveMinimum, round } from './payoff-engine.ts';
import { settlementReports } from './plan-settlements.ts';
import { nextDueDate, recurringDueDate } from './recurring-due-date.ts';

export type DueReminder = {
  id: string;
  name: string;
  kind: 'account' | 'loan' | 'spending';
  targetId: string;
  date: string;
  amount: number;
  daysAway: number;
};

/** Read-only reminders from saved monthly obligations, independent of payoff scope.
 * Past dates roll forward without declaring a lender payment overdue. Canonical
 * recurring days, balances and paid records are never rewritten by this view.
 */
export function buildDueReminders({ accounts, loans, items, transactions, settings, today = householdDate() }: {
  accounts: DebtAccount[];
  loans: LoanTracker[];
  items: CashflowItem[];
  transactions: LedgerTransaction[];
  settings: MonthlyPlanSettings;
  today?: string;
}): DueReminder[] {
  const month = today.slice(0, 7);
  const nextMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1)).toISOString().slice(0, 7);
  const plan = settings.months[month];
  const recorded = transactions.filter(row => !row.deletedAt && !row.replacedByTransactionId && row.date <= today);
  const settlements = (plan?.settlements ?? []).filter(row => row.date <= today && row.date.startsWith(month));
  const payments = recorded.filter(row => row.reductionKind !== 'adjustment');
  const minimums = Object.fromEntries(accounts.map(account => [account.id, plan?.minimums?.[account.id] ?? effectiveMinimum(account)]));
  const progress = debtPaymentProgress(accounts, {}, [...payments, ...settlementReports(settlements)], month, minimums);
  const reminders: DueReminder[] = [];
  const add = (kind: DueReminder['kind'], targetId: string, name: string, savedDate: string, amount: number, paid: number, maximum = Infinity) => {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    let date = nextDueDate(savedDate, today);
    if (!date) return false;
    let remaining = Math.min(amount, maximum);
    if (date.startsWith(month)) {
      remaining = round(Math.min(maximum, Math.max(0, amount - paid)));
      if (remaining <= 0) {
        date = recurringDueDate(savedDate, nextMonth);
        remaining = Math.min(amount, maximum);
      }
    }
    reminders.push({ id: `${kind}:${targetId}`, kind, targetId, name, date, amount: round(remaining), daysAway: Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000) });
    return true;
  };

  for (const account of accounts) {
    if (account.archivedAt || account.balance <= 0) continue;
    const paid = progress.find(row => row.accountId === account.id)?.minimumPaid ?? 0;
    // Apply recorded payments before capping the remainder to today's balance.
    // Capping first could falsely clear a partly paid final minimum.
    add('account', account.id, account.name, account.dueDate, minimums[account.id], paid, account.balance);
  }

  const spendingPaid = (item: CashflowItem) => {
    const actual = recorded.filter(row => row.type === 'charge' && row.plannedItemId === item.id && row.date.startsWith(month)).reduce((sum, row) => sum + row.amount, 0);
    const reports = settlements.filter(row => row.kind === 'spending' && row.targetId === item.id);
    const manual = reports.filter(row => !row.automatic).reduce((sum, row) => sum + row.amount, 0);
    const automatic = reports.filter(row => row.automatic).reduce((sum, row) => sum + row.amount, 0);
    // Manual acknowledgements may overlap purchases. Automatic records already
    // cover only a remainder; they don't represent another balance movement.
    return round(Math.max(actual, manual) + automatic);
  };
  const linkedIds = new Set<string>();
  const activeLoans = loans.filter(loan => loan.remainingAmount > 0);
  for (const loan of activeLoans) {
    const linked = linkedLoanPayment(loan, items);
    const fallbackDate = linked?.dueDay ? `2000-01-${String(linked.dueDay).padStart(2, '0')}` : '';
    const loanPaid = loan.history.filter(row => row.date.startsWith(month) && row.date <= today).reduce((sum, row) => sum + (row.payment ?? 0), 0);
    const singleLink = linked && activeLoans.filter(other => linkedLoanPayment(other, items)?.id === linked.id).length === 1;
    const paid = Math.max(loanPaid, singleLink ? spendingPaid(linked) : 0);
    if (add('loan', loan.id, loan.name, loan.dueDate || fallbackDate, regularLoanPayment(loan, items) ?? 0, paid) && linked) linkedIds.add(linked.id);
  }
  for (const item of items) {
    if (item.kind === 'income' || !isRecurringPlannedItem(item) || linkedIds.has(item.id) || !Number.isInteger(item.dueDay) || item.dueDay! < 1 || item.dueDay! > 31) continue;
    add('spending', item.id, item.name, `2000-01-${String(item.dueDay).padStart(2, '0')}`, item.amount, spendingPaid(item));
  }
  return reminders.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
