import { householdMonthOffset } from "./household-date.ts";
import type { BalanceAdjustment, DebtAccount, LedgerTransaction, PayoffSnapshot, RemovedProgressAccount } from "./dashboard-data.ts";
import { paymentActivity } from "./payments.ts";
import { transactionAdjustedAccounts } from "./progress-balances.ts";
import { debtDisplayPlacement } from "./debts-screen.ts";
import { displayedStartingBalance } from "./debt-starting-balance.ts";
import { round } from "./payoff-engine.ts";

export function recentDebtMonths(date = new Date()) {
  return Array.from({ length: 6 }, (_, index) => householdMonthOffset(-index, date));
}
export function buildDebtActivity(accountId: string, transactions: LedgerTransaction[], adjustments: BalanceAdjustment[], date = new Date()) {
  const entries = paymentActivity(transactions, adjustments).filter(entry => entry.accountId === accountId);
  return recentDebtMonths(date).map(month => {
    const rows = entries.filter(entry => entry.date.slice(0, 7) === month);
    const payments = rows.filter(entry => entry.kind === "payment");
    return { month, rows, paymentCount: payments.length, payments: round(payments.reduce((sum, row) => sum + row.amount, 0)), increases: round(rows.reduce((sum, row) => sum + Math.max(0, row.difference), 0)), decreases: round(rows.reduce((sum, row) => sum + Math.max(0, -row.difference), 0)), netChange: round(rows.reduce((sum, row) => sum + row.difference, 0)) };
  });
}
export function buildActualProgress(accounts: DebtAccount[], transactions: LedgerTransaction[], adjustments: BalanceAdjustment[], snapshots: PayoffSnapshot[], date = new Date(), fixedStartingBalance?: number, removedAccounts: RemovedProgressAccount[] = []) {
  const retained = removedAccounts.filter(saved => !accounts.some(a => a.id === saved.id)).map(saved => ({ ...saved, removedFromDebts: true, type: "Other" as const, apr: 0, minimum: 0, minimumMode: "manual" as const, payoffMode: "minimum-only" as const, interestFee: 0, creditLimit: 0, dueDate: "", promoEndDate: "", postPromoApr: 0, postPromoMinimum: 0, createdAt: saved.removedAt }));
  const trackedAccounts = [...accounts, ...retained];
  const savedVersions = snapshots.flatMap(s => [...(Array.isArray(s.revisions) ? s.revisions as PayoffSnapshot[] : []), s]);
  const baseline = savedVersions.sort((a,b) => a.capturedAt.localeCompare(b.capturedAt)).find(s => s.accounts?.length > 0);
  void fixedStartingBalance; // Retained legacy data is not the per-debt display authority.
  const hasFixedStart = false;
  const currentAccounts = [...transactionAdjustedAccounts(accounts, transactions).map(account => ({ ...account, removedFromDebts: false })), ...retained].map(account => ({ ...account, baselineBalance: displayedStartingBalance(account, savedVersions) }));
  const comparisonAvailable = currentAccounts.length > 0 && currentAccounts.every(account => typeof account.baselineBalance === 'number' && Number.isFinite(account.baselineBalance));
  const comparisonAccounts = currentAccounts;
  const starting = round(currentAccounts.reduce((sum, account) => sum + (account.baselineBalance ?? 0), 0));
  const current = round(comparisonAccounts.reduce((sum,a) => sum + a.balance, 0));
  const reduction = comparisonAvailable ? round(starting - current) : 0;
  const entries = paymentActivity(transactions, adjustments);
  const month = recentDebtMonths(date)[0];
  const accountIds = new Set(trackedAccounts.map(a => a.id));
  const monthEntries = entries.filter(row => accountIds.has(row.accountId) && row.date.slice(0, 7) === month);
  const monthlyChange = round(monthEntries.reduce((sum, row) => sum + row.difference, 0));
  const groups = [...new Set(comparisonAccounts.map(account => debtDisplayPlacement(account).group))].map(group => {
    const items = comparisonAccounts.filter(a => debtDisplayPlacement(a).group === group).sort((a,b) => debtDisplayPlacement(a).order - debtDisplayPlacement(b).order || a.name.localeCompare(b.name));
    const starting = round(items.reduce((sum,a) => sum + (a.baselineBalance ?? a.balance), 0));
    const current = round(items.reduce((sum,a) => sum + a.balance, 0));
    return { group, accounts: items, starting, current, reduction: round(starting - current) };
  });
  return { comparisonAvailable, baseline, excludedCount: currentAccounts.length - comparisonAccounts.length, fixedStartingBalance: hasFixedStart, starting, current, reduction, percent: comparisonAvailable && starting > 0 ? reduction / starting * 100 : null, groups, monthlyChange, monthEntries, paymentCount: monthEntries.filter(row => row.kind === "payment").length, reductionCount: monthEntries.filter(row => row.difference < 0).length, monthlyReductions: round(monthEntries.reduce((sum,row) => sum + Math.max(0, -row.difference), 0)), monthlyIncreases: round(monthEntries.reduce((sum,row) => sum + Math.max(0, row.difference), 0)), retainedCount: retained.length, baselineDate: baseline?.capturedAt.slice(0,10) ?? null, snapshots: [...snapshots].sort((a,b) => a.month.localeCompare(b.month)) };
}

export function retainRemovedProgressAccount(existing: RemovedProgressAccount[], account: DebtAccount, currentBalance: number, removedAt = new Date().toISOString()): RemovedProgressAccount[] {
  return [...existing.filter(saved => saved.id !== account.id), { id: account.id, name: account.name, balance: round(currentBalance), baselineBalance: account.baselineBalance, displayGroup: account.displayGroup, displayOrder: account.displayOrder, removedAt }];
}
