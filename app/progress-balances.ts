import type { DebtAccount, LedgerTransaction, PayoffSnapshot } from "./dashboard-data.ts";
import { postedMovement } from "./payment-overlap.ts";
import { displayedStartingBalance } from "./debt-starting-balance.ts";
import { round } from "./payoff-engine.ts";

export function moneyCents(value: number) {
  const cents = Math.round(value * 100);
  if (!Number.isFinite(value) || !Number.isSafeInteger(cents)) throw new Error("Amount exceeds the supported range.");
  return cents;
}

export function accountLedgerBalance(account: DebtAccount, transactions: LedgerTransaction[]) {
  const anchor = account.reconciliation;
  const covered = new Set(anchor?.coveredTransactionIds);
  const movements = transactions.filter(t => t.accountId === account.id && !t.deletedAt && (!anchor || (
      !covered.has(t.id) && t.date >= anchor.date && (anchor.coveredTransactionIds !== undefined || t.date > anchor.date || t.createdAt > anchor.createdAt)
    ))).reduce((sum, t) => sum + moneyCents(postedMovement(t)), 0);
  const base = anchor ? moneyCents(anchor.balance) + moneyCents(account.balanceOffset ?? 0) - moneyCents(anchor.offset) : moneyCents(account.balance) + moneyCents(account.balanceOffset ?? 0);
  if (!Number.isSafeInteger(base + movements)) throw new Error("Balance exceeds the supported range.");
  return (base + movements) / 100;
}

export function transactionAdjustedAccounts(openingAccounts: DebtAccount[], transactions: LedgerTransaction[], _detailedSpendingTracking = true) {
  void _detailedSpendingTracking; // Kept for existing callers; visibility never changes posted balances.
  return openingAccounts.map((account) => {
    return { ...account, balance: Math.max(0, accountLedgerBalance(account, transactions)) };
  });
}

export function buildProgressBalanceView(openingAccounts: DebtAccount[], transactions: LedgerTransaction[], snapshots: PayoffSnapshot[], detailedSpendingTracking = true) {
  const activeTransactions = transactions.filter((transaction) => !transaction.deletedAt);
  const currentAccounts = transactionAdjustedAccounts(openingAccounts, activeTransactions, detailedSpendingTracking);
  const startingTotal = round(openingAccounts.reduce((sum, account) => sum + (displayedStartingBalance(account, snapshots) ?? 0), 0));
  const currentTotal = round(currentAccounts.reduce((sum, account) => sum + account.balance, 0));
  const orderedSnapshots = [...snapshots].sort((a, b) => a.month.localeCompare(b.month) || a.capturedAt.localeCompare(b.capturedAt));
  const earliestTransactionMonth = activeTransactions.map((transaction) => transaction.date.slice(0, 7)).sort()[0] ?? null;
  const baselineMonth = orderedSnapshots[0]?.month ?? earliestTransactionMonth;
  const correctedSnapshots = orderedSnapshots;

  return {
    baselineMonth,
    startingTotal,
    currentTotal,
    currentAccounts,
    snapshots: correctedSnapshots,
  };
}

export function createPayoffSnapshot(input: {
  existing?: PayoffSnapshot | null;
  accounts: DebtAccount[];
  month: string;
  capturedAt: string;
  totalBalance: number;
  monthlyInterest: number;
  activeAccountCount: number;
  projectedDebtFreeMonth: string | null;
  note: string;
  id?: string;
}): PayoffSnapshot {
  const existing = input.existing ?? null;
  return {
    ...(existing ?? {}),
    ...(existing ? { revisions: [...(Array.isArray(existing.revisions) ? existing.revisions : []), { ...existing, revisions: undefined }] } : {}),
    id: existing?.id ?? input.id ?? `snapshot-${input.capturedAt}`,
    month: input.month,
    capturedAt: input.capturedAt,
    totalBalance: input.totalBalance,
    monthlyInterest: input.monthlyInterest,
    activeAccountCount: input.activeAccountCount,
    projectedDebtFreeMonth: input.projectedDebtFreeMonth,
    note: input.note.trim(),
    accounts: input.accounts.map((account) => ({
      ...(existing?.accounts.find((saved) => saved.accountId === account.id) ?? {}),
      accountId: account.id,
      name: account.name,
      type: account.type,
      balance: account.balance,
      apr: account.apr,
    })),
  };
}
