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
export function buildActualProgress(accounts: DebtAccount[], transactions: LedgerTransaction[], adjustments: BalanceAdjustment[], snapshots: PayoffSnapshot[], date = new Date()) {
  const currentAccounts = transactionAdjustedAccounts(accounts, transactions).map((account, index) => ({ ...account, baselineBalance: accounts[index].baselineBalance ?? accounts[index].balance }));
  const starting = round(accounts.reduce((sum, account) => sum + (account.baselineBalance ?? account.balance), 0));
  const current = round(currentAccounts.reduce((sum, account) => sum + account.balance, 0));
  const reduction = round(starting - current);
  const entries = paymentActivity(transactions, adjustments);
  const month = recentDebtMonths(date)[0];
  const accountIds = new Set(accounts.map(a => a.id));
  const monthEntries = entries.filter(row => accountIds.has(row.accountId) && row.date.slice(0, 7) === month);
  const monthlyChange = round(monthEntries.reduce((sum, row) => sum + row.difference, 0));
  const groups = (["Mama", "Papi", "Other"] as const).map(group => {
    const items = currentAccounts.filter(a => debtDisplayPlacement(a).group === group).sort((a,b) => debtDisplayPlacement(a).order - debtDisplayPlacement(b).order || a.name.localeCompare(b.name));
    const starting = round(items.reduce((sum,a) => sum + (a.baselineBalance ?? a.balance), 0));
    const current = round(items.reduce((sum,a) => sum + a.balance, 0));
    return { group, accounts: items, starting, current, reduction: round(starting - current) };
  });
  return { starting, current, reduction, percent: starting > 0 ? Math.min(100, Math.max(0, reduction / starting * 100)) : 0, groups, monthlyChange, monthEntries, paymentCount: monthEntries.filter(row => row.kind === "payment").length, baselineDate: accounts.map(a => a.createdAt.slice(0,10)).sort()[0] ?? null, snapshots: [...snapshots].sort((a,b) => a.month.localeCompare(b.month)) };
}
