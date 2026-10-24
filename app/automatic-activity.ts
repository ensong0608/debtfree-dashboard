import type { CashflowItem, DebtAccount, LedgerTransaction, MonthlyPlanSettings, PayoffSnapshot } from './dashboard-data.ts';
import type { LoanTracker } from './loan-progress.ts';
import { linkedLoanPayment } from './loan-progress.ts';
import { householdDate } from './household-date.ts';
import { isRecurringPlannedItem } from './monthly-plan.ts';
import { round } from './payoff-engine.ts';

export function recurringDate(month: string, day: number) {
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  return `${month}-${String(Math.min(last, day)).padStart(2, '0')}`;
}

/** Paid Budget acknowledgements use the existing reporting-only settlement path.
 * They never guess lender principal/interest or post another debt-balance movement. */
export function recordDueBudgetItems(settings: MonthlyPlanSettings, items: CashflowItem[], transactions: LedgerTransaction[], loans: LoanTracker[], now = new Date()) {
  const today = householdDate(now), month = today.slice(0, 7);
  const prior = settings.months[month] ?? { safetyBuffer: 0, debtPaymentTarget: 0 };
  const settlements = [...(prior.settlements ?? [])];
  const skipped = new Set(prior.skippedRecurringPayments ?? []);
  for (const item of items) {
    if (item.kind === 'income' || !isRecurringPlannedItem(item) || !Number.isInteger(item.dueDay) || item.dueDay! < 1 || item.dueDay! > 31 || item.amount <= 0 || skipped.has(item.id)) continue;
    const date = recurringDate(month, item.dueDay!);
    if (date > today) continue;
    const id = `recurring:${month}:${item.id}`;
    const recorded = transactions.filter(row => !row.deletedAt && !row.replacedByTransactionId && row.type === 'charge' && row.plannedItemId === item.id && row.date.startsWith(month) && row.date <= today).reduce((sum, row) => sum + row.amount, 0);
    const paid = settlements.filter(row => row.id !== id && row.kind === 'spending' && row.targetId === item.id).reduce((sum, row) => sum + row.amount, 0);
    const loanPaid = loans.filter(loan => linkedLoanPayment(loan, items)?.id === item.id).flatMap(loan => loan.history).filter(entry => entry.date.startsWith(month) && entry.date <= today).reduce((sum, entry) => sum + (entry.payment ?? 0), 0);
    const remaining = round(Math.max(0, item.amount - recorded - paid - loanPaid));
    const existingIndex = settlements.findIndex(record => record.id === id);
    if (existingIndex >= 0) {
      if (remaining <= 0) settlements.splice(existingIndex, 1);
      else if (remaining < settlements[existingIndex].amount) settlements[existingIndex] = { ...settlements[existingIndex], amount: remaining };
      continue;
    }
    if (remaining <= 0) continue;
    settlements.push({ id, targetId: item.id, name: item.name, kind: 'spending', amount: remaining, date, createdAt: now.toISOString(), source: item.paymentMethod === 'credit' ? 'included' : 'debit', automatic: true });
  }
  return JSON.stringify(settlements) === JSON.stringify(prior.settlements ?? []) ? settings : { ...settings, months: { ...settings.months, [month]: { ...prior, settlements } } };
}

/** Capture the latest elapsed checkpoint only, on the actual observation date.
 * Missing earlier checkpoints are never backfilled with today's balance. */
export function captureAutomaticSnapshot(snapshots: PayoffSnapshot[], accounts: DebtAccount[], loans: LoanTracker[], now = new Date()) {
  if (!accounts.length && !loans.length) return snapshots;
  const today = householdDate(now), month = today.slice(0, 7), day = Number(today.slice(8));
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  const checkpoint = `${month}-${String(day === last ? last : day >= 15 ? 15 : 1).padStart(2, '0')}`;
  if (snapshots.some(snapshot => snapshot.autoCheckpoint === checkpoint)) return snapshots;
  const savedAccounts = accounts.map(account => ({ accountId: account.id, name: account.name, type: account.type, balance: account.balance, apr: account.apr }));
  const next: PayoffSnapshot = { id: `observation:${checkpoint}`, month, autoCheckpoint: checkpoint, capturedAt: now.toISOString(), totalBalance: round(accounts.reduce((sum, account) => sum + account.balance, 0)), monthlyInterest: round(accounts.reduce((sum, account) => sum + account.balance * account.apr / 1200, 0)), activeAccountCount: accounts.filter(account => account.balance > 0).length, projectedDebtFreeMonth: null, note: '', accounts: savedAccounts, loanBalances: loans.map(loan => ({ loanId: loan.id, amount: loan.remainingAmount, balanceKind: loan.balanceKind })) };
  return [...snapshots, next];
}
