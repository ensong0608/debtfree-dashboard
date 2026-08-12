import type { DebtAccount, LedgerTransaction, PayoffSnapshot } from "./dashboard-data.ts";
import { round } from "./payoff-engine.ts";

export function transactionAdjustedAccounts(openingAccounts: DebtAccount[], transactions: LedgerTransaction[], detailedSpendingTracking = true) {
  const movementByAccount = new Map<string, number>();
  transactions.filter((transaction) => !transaction.deletedAt && (detailedSpendingTracking || transaction.type === "payment")).forEach((transaction) => {
    const movement = transaction.type === "payment" ? -transaction.amount : transaction.amount;
    movementByAccount.set(transaction.accountId, (movementByAccount.get(transaction.accountId) ?? 0) + movement);
  });
  return openingAccounts.map((account) => ({
    ...account,
    balance: Math.max(0, round(account.balance + (movementByAccount.get(account.id) ?? 0))),
  }));
}

export function buildProgressBalanceView(openingAccounts: DebtAccount[], transactions: LedgerTransaction[], snapshots: PayoffSnapshot[], detailedSpendingTracking = true) {
  const activeTransactions = transactions.filter((transaction) => !transaction.deletedAt);
  const currentAccounts = transactionAdjustedAccounts(openingAccounts, activeTransactions, detailedSpendingTracking);
  const startingTotal = round(openingAccounts.reduce((sum, account) => sum + account.balance, 0));
  const currentTotal = round(currentAccounts.reduce((sum, account) => sum + account.balance, 0));
  const orderedSnapshots = [...snapshots].sort((a, b) => a.month.localeCompare(b.month) || a.capturedAt.localeCompare(b.capturedAt));
  const earliestTransactionMonth = activeTransactions.map((transaction) => transaction.date.slice(0, 7)).sort()[0] ?? null;
  const baselineMonth = orderedSnapshots[0]?.month ?? earliestTransactionMonth;
  const correctedSnapshots = orderedSnapshots.map((snapshot, index) => index !== 0 ? snapshot : {
    ...snapshot,
    totalBalance: startingTotal,
    activeAccountCount: openingAccounts.filter((account) => account.balance > 0).length,
    accounts: openingAccounts.map((account) => ({
      ...(snapshot.accounts.find((saved) => saved.accountId === account.id) ?? {}),
      accountId: account.id,
      name: account.name,
      type: account.type,
      balance: account.balance,
      apr: account.apr,
    })),
  });

  return {
    baselineMonth,
    startingTotal,
    currentTotal,
    currentAccounts,
    snapshots: correctedSnapshots,
  };
}
