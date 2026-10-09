import type { DebtAccount, LedgerTransaction, PayoffSnapshot } from "./dashboard-data.ts";
import { postedMovement } from "./payment-overlap.ts";
import { round } from "./payoff-engine.ts";

export function transactionAdjustedAccounts(openingAccounts: DebtAccount[], transactions: LedgerTransaction[], _detailedSpendingTracking = true) {
  void _detailedSpendingTracking; // Kept for existing callers; visibility never changes posted balances.
  const movementByAccount = new Map<string, number>();
  transactions.filter((transaction) => !transaction.deletedAt).forEach((transaction) => {
    const movement = postedMovement(transaction);
    movementByAccount.set(transaction.accountId, (movementByAccount.get(transaction.accountId) ?? 0) + movement);
  });
  return openingAccounts.map((account) => ({
    ...account,
    balance: Math.max(0, round(account.balance + (account.balanceOffset ?? 0) + (movementByAccount.get(account.id) ?? 0))),
  }));
}

export function buildProgressBalanceView(openingAccounts: DebtAccount[], transactions: LedgerTransaction[], snapshots: PayoffSnapshot[], detailedSpendingTracking = true) {
  const activeTransactions = transactions.filter((transaction) => !transaction.deletedAt);
  const currentAccounts = transactionAdjustedAccounts(openingAccounts, activeTransactions, detailedSpendingTracking);
  const startingTotal = round([...snapshots].sort((a, b) => a.month.localeCompare(b.month))[0]?.totalBalance ?? openingAccounts.reduce((sum, account) => sum + (account.baselineBalance ?? account.balance), 0));
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
