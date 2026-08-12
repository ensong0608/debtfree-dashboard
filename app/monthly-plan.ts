import type { CashflowItem, DebtAccount, LedgerTransaction, MonthlyPlanMonth } from "./dashboard-data.ts";
import { effectiveMinimum, round } from "./payoff-engine.ts";

export type MonthlyPlanTotals = {
  plannedIncome: number;
  plannedSpending: number;
  spent: number;
  remaining: number;
  safetyBuffer: number;
  debtPaymentTarget: number;
  availableDebtPayment: number;
};

export function isRecurringPlannedItem(item: CashflowItem) {
  return item.recurring ?? item.kind !== "purchase";
}

export function isPlannedIncome(item: CashflowItem) {
  return item.kind === "income";
}

export function plannedSpending(items: CashflowItem[]) {
  return round(items.filter((item) => !isPlannedIncome(item)).reduce((sum, item) => sum + item.amount, 0));
}

export function actualHouseholdSpending(transactions: LedgerTransaction[], month: string, trackingEnabled: boolean) {
  if (!trackingEnabled) return 0;
  return round(transactions
    .filter((transaction) => !transaction.deletedAt && transaction.date.slice(0, 7) === month && transaction.type !== "payment")
    .reduce((sum, transaction) => sum + transaction.amount, 0));
}

export function calculateMonthlyPlan(items: CashflowItem[], transactions: LedgerTransaction[], month: string, settings: MonthlyPlanMonth, trackingEnabled: boolean): MonthlyPlanTotals {
  const plannedIncome = round(items.filter(isPlannedIncome).reduce((sum, item) => sum + item.amount, 0));
  const essentialPlannedExpenses = plannedSpending(items);
  const spent = actualHouseholdSpending(transactions, month, trackingEnabled);
  return {
    plannedIncome,
    plannedSpending: essentialPlannedExpenses,
    spent,
    remaining: round(Math.max(0, essentialPlannedExpenses - spent)),
    safetyBuffer: round(settings.safetyBuffer),
    debtPaymentTarget: round(settings.debtPaymentTarget),
    availableDebtPayment: round(Math.max(0, plannedIncome - essentialPlannedExpenses - settings.safetyBuffer)),
  };
}

export function copyRecurringPlannedItems(items: CashflowItem[], createdAt: string, makeId: (item: CashflowItem, index: number) => string) {
  return items.filter(isRecurringPlannedItem).map((item, index) => ({ ...item, id: makeId(item, index), createdAt }));
}

export function spentForPlannedItem(itemId: string, transactions: LedgerTransaction[], month: string, trackingEnabled: boolean) {
  if (!trackingEnabled) return 0;
  return round(transactions.filter((transaction) => !transaction.deletedAt && transaction.type !== "payment" && transaction.date.slice(0, 7) === month && transaction.plannedItemId === itemId).reduce((sum, transaction) => sum + transaction.amount, 0));
}

export function actualizedPlannedIds(transactions: LedgerTransaction[], month: string, trackingEnabled: boolean) {
  if (!trackingEnabled) return new Set<string>();
  return new Set(transactions.filter((transaction) => !transaction.deletedAt && transaction.type !== "payment" && transaction.date.slice(0, 7) === month && transaction.plannedItemId).map((transaction) => transaction.plannedItemId as string));
}

export type DebtPaymentProgress = {
  accountId: string;
  accountName: string;
  target: number;
  minimumTarget: number;
  extraTarget: number;
  paid: number;
  minimumPaid: number;
  extraPaid: number;
  remainingMinimum: number;
  remainingExtra: number;
  remaining: number;
};

function inferredPaymentKind(transaction: LedgerTransaction) {
  if (transaction.paymentKind) return transaction.paymentKind;
  const note = transaction.memo.toLowerCase();
  if (note.includes("minimum") && note.includes("extra")) return "combined" as const;
  if (note.includes("extra")) return "extra" as const;
  if (note.includes("minimum") || note.includes("min payment") || note.includes("min pymt")) return "minimum" as const;
  return null;
}

export function debtPaymentProgress(accounts: DebtAccount[], plannedPayments: Record<string, number>, transactions: LedgerTransaction[], month: string): DebtPaymentProgress[] {
  return accounts.filter((account) => !account.archivedAt && account.balance > 0).map((account) => {
    const minimumTarget = round(Math.min(account.balance, effectiveMinimum(account)));
    const target = round(Math.max(minimumTarget, plannedPayments[account.id] ?? minimumTarget));
    const extraTarget = round(Math.max(0, target - minimumTarget));
    let minimumPaid = 0, extraPaid = 0, unclassified = 0;
    const payments = transactions.filter((transaction) => !transaction.deletedAt && transaction.type === "payment" && transaction.accountId === account.id && transaction.date.slice(0, 7) === month);
    for (const payment of payments) {
      const kind = inferredPaymentKind(payment);
      if (kind === "minimum") minimumPaid += payment.amount;
      else if (kind === "extra") extraPaid += payment.amount;
      else if (kind === "combined") {
        const toMinimum = Math.min(payment.amount, Math.max(0, minimumTarget - minimumPaid));
        minimumPaid += toMinimum;
        extraPaid += payment.amount - toMinimum;
      } else unclassified += payment.amount;
    }
    const unclassifiedToMinimum = Math.min(unclassified, Math.max(0, minimumTarget - minimumPaid));
    minimumPaid += unclassifiedToMinimum;
    extraPaid += unclassified - unclassifiedToMinimum;
    const paid = round(payments.reduce((sum, payment) => sum + payment.amount, 0));
    const remainingMinimum = round(Math.max(0, minimumTarget - minimumPaid));
    const remainingExtra = round(Math.max(0, extraTarget - extraPaid));
    return { accountId: account.id, accountName: account.name, target, minimumTarget, extraTarget, paid, minimumPaid: round(minimumPaid), extraPaid: round(extraPaid), remainingMinimum, remainingExtra, remaining: round(remainingMinimum + remainingExtra) };
  });
}
