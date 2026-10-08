import type { BalanceAdjustment, DebtAccount, LedgerTransaction, PayoffSnapshot } from "./dashboard-data.ts";
import { paymentActivity } from "./payments.ts";
import { transactionAdjustedAccounts } from "./progress-balances.ts";
import { debtDisplayPlacement } from "./debts-screen.ts";
import { round } from "./payoff-engine.ts";

export function recentDebtMonths(date = new Date()) {
  return Array.from({ length: 6 }, (_, index) => {
    const month = new Date(date.getFullYear(), date.getMonth() - index, 1);
    return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  });
}
export function buildDebtActivity(accountId: string, transactions: LedgerTransaction[], adjustments: BalanceAdjustment[], date = new Date()) {
  const entries = paymentActivity(transactions, adjustments).filter(entry => entry.accountId === accountId);
  return recentDebtMonths(date).map(month => {
    const rows = entries.filter(entry => entry.date.slice(0, 7) === month);
    const payments = rows.filter(entry => entry.kind === "payment");
    return { month, rows, paymentCount: payments.length, payments: round(payments.reduce((sum, row) => sum + row.amount, 0)), increases: round(rows.reduce((sum, row) => sum + Math.max(0, row.difference), 0)), decreases: round(rows.reduce((sum, row) => sum + Math.max(0, -row.difference), 0)), netChange: round(rows.reduce((sum, row) => sum + row.difference, 0)) };
  });
}
export function buildActualProgress(accounts: DebtAccount[], transactions: LedgerTransaction[], adjustments: BalanceAdjustment[], snapshots: PayoffSnapshot[], date = new Date(), fixedStartingBalance?: number) {
  const savedVersions = snapshots.flatMap(s => [...(Array.isArray(s.revisions) ? s.revisions as PayoffSnapshot[] : []), s]);
  const baseline = savedVersions.sort((a,b) => a.capturedAt.localeCompare(b.capturedAt)).find(s => s.accounts?.length > 0);
  const baselineIds = new Set(baseline?.accounts.map(a => a.accountId) ?? accounts.map(a => a.id));
  const hasFixedStart = typeof fixedStartingBalance === "number" && Number.isFinite(fixedStartingBalance) && fixedStartingBalance > 0;
  const comparisonAvailable = hasFixedStart || (baseline ? baseline.accounts.every(saved => accounts.some(a => a.id === saved.accountId)) : accounts.length > 0 && accounts.every(a => typeof a.baselineBalance === "number") && [...transactions, ...adjustments].every(entry => accounts.some(a => a.id === entry.accountId)));
  const currentAccounts = transactionAdjustedAccounts(accounts, transactions).map(account => ({ ...account, baselineBalance: baseline ? baselineIds.has(account.id) ? account.baselineBalance ?? baseline.accounts.find(a => a.accountId === account.id)?.balance : undefined : account.baselineBalance }));
  const comparisonAccounts = currentAccounts.filter(a => hasFixedStart || baselineIds.has(a.id));
  const starting = hasFixedStart ? round(fixedStartingBalance) : round(baseline ? baseline.accounts.reduce((sum,a) => sum + (accounts.find(account => account.id === a.accountId)?.baselineBalance ?? a.balance), 0) : accounts.reduce((sum,a) => sum + (a.baselineBalance ?? 0), 0));
  const current = round(comparisonAccounts.reduce((sum,a) => sum + a.balance, 0));
  const reduction = comparisonAvailable ? round(starting - current) : 0;
  const entries = paymentActivity(transactions, adjustments);
  const month = recentDebtMonths(date)[0];
  const accountIds = new Set(accounts.map(a => a.id));
  const monthEntries = entries.filter(row => accountIds.has(row.accountId) && row.date.slice(0, 7) === month);
  const monthlyChange = round(monthEntries.reduce((sum, row) => sum + row.difference, 0));
  const groups = (["Mama", "Papi", "Other"] as const).map(group => {
    const items = comparisonAccounts.filter(a => debtDisplayPlacement(a).group === group).sort((a,b) => debtDisplayPlacement(a).order - debtDisplayPlacement(b).order || a.name.localeCompare(b.name));
    const starting = round(items.reduce((sum,a) => sum + (a.baselineBalance ?? a.balance), 0));
    const current = round(items.reduce((sum,a) => sum + a.balance, 0));
    return { group, accounts: items, starting, current, reduction: round(starting - current) };
  });
  return { comparisonAvailable, baseline, excludedCount: currentAccounts.length - comparisonAccounts.length, fixedStartingBalance: hasFixedStart, starting, current, reduction, percent: starting > 0 ? Math.min(100, Math.max(0, reduction / starting * 100)) : 0, groups, monthlyChange, monthEntries, paymentCount: monthEntries.filter(row => row.kind === "payment").length, baselineDate: baseline?.capturedAt.slice(0,10) ?? null, snapshots: [...snapshots].sort((a,b) => a.month.localeCompare(b.month)) };
}
