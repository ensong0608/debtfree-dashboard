import {effectiveForecastApr} from "./payoff-engine.ts";
import { householdDate } from "./household-date.ts";
import type { BalanceAdjustment, DebtAccount, DebtAuditCreator, LedgerTransaction, PaymentKind, PayoffStrategy } from "./dashboard-data.ts";

export type DebtStatus = "Payoff priority" | "Minimum only" | "Paid off" | "Archived";
export type PromoNotice = { label: string; tone: "neutral" | "warning" | "danger" } | null;

export function isArchivedDebt(account: DebtAccount) {
  return Boolean(account.archivedAt);
}

export function canArchiveDebt(account: DebtAccount) {
  return account.balance <= 0 && !isArchivedDebt(account);
}

export function debtStatus(account: DebtAccount): DebtStatus {
  if (isArchivedDebt(account)) return "Archived";
  if (account.balance <= 0) return "Paid off";
  return account.payoffMode === "minimum-only" ? "Minimum only" : "Payoff priority";
}

export function splitDebtAccounts(accounts: DebtAccount[]) {
  return {
    current: accounts.filter((account) => !isArchivedDebt(account)),
    archived: accounts.filter(isArchivedDebt),
  };
}

export function payoffPriority(
  accounts: DebtAccount[],
  strategy: PayoffStrategy,
  effectiveAprs: Record<string, number> = {},
) {
  return accounts
    .filter((account) => !isArchivedDebt(account) && account.balance > 0 && account.payoffMode !== "minimum-only")
    .sort((a, b) => strategy === "custom"
      ? (a.customOrder ?? Number.MAX_SAFE_INTEGER) - (b.customOrder ?? Number.MAX_SAFE_INTEGER)
      : strategy === "avalanche"
        ? (effectiveAprs[b.id] ?? effectiveForecastApr(b,1)) - (effectiveAprs[a.id] ?? effectiveForecastApr(a,1)) || a.balance - b.balance || a.name.localeCompare(b.name)
        : a.balance - b.balance || (effectiveAprs[b.id] ?? effectiveForecastApr(b,1)) - (effectiveAprs[a.id] ?? effectiveForecastApr(a,1)) || a.name.localeCompare(b.name));
}

export function openingBalanceForCurrentBalance(openingBalance: number, currentBalance: number, nextCurrentBalance: number) {
  const ledgerMovement = currentBalance - openingBalance;
  const reconciled = nextCurrentBalance - ledgerMovement;
  return Math.round((reconciled + Number.EPSILON) * 100) / 100;
}

export function promoNotice(account: DebtAccount, today = new Date()): PromoNotice {
  if (!account.promoEndDate) return null;
  const currentDay = householdDate(today);
  const formatted = new Date(`${account.promoEndDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (account.postPromoApr <= 0) return { label: `Promo ends ${formatted}; add the post-promo APR`, tone: "danger" };
  if (account.promoEndDate < currentDay) return { label: `Promo ended ${formatted}; now ${account.postPromoApr.toFixed(2)}% APR`, tone: "warning" };
  return { label: `Promo ends ${formatted}; then ${account.postPromoApr.toFixed(2)}% APR`, tone: "neutral" };
}

function cents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export class DebtPaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DebtPaymentError";
  }
}

export class DebtBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DebtBalanceError";
  }
}

export type DebtPaymentInput = {
  account: DebtAccount;
  amount: number;
  date: string;
  note?: string;
  createdAt?: string;
  id?: string;
  payeeId?: string;
  creator?: DebtAuditCreator;
  action?: "payment" | "mark-paid-off";
  paymentKind?: PaymentKind;
};

export function createDebtPayment(input: DebtPaymentInput): LedgerTransaction {
  const balanceBefore = cents(input.account.balance);
  const amount = cents(input.amount);
  if (!Number.isFinite(amount)) throw new DebtPaymentError("Enter a valid payment amount.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date + "T12:00:00Z")) || new Date(input.date + "T12:00:00Z").toISOString().slice(0, 10) !== input.date) {
    throw new DebtPaymentError("Enter a valid payment date.");
  }
  if (balanceBefore <= 0) throw new DebtPaymentError(input.account.name + " is already paid off.");
  if (amount <= 0) throw new DebtPaymentError("Enter a payment greater than zero.");
  if (amount > balanceBefore) {
    throw new DebtPaymentError("Payment cannot exceed the current balance of $" + balanceBefore.toFixed(2) + ".");
  }
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    id: input.id ?? crypto.randomUUID(),
    date: input.date,
    accountId: input.account.id,
    payeeId: input.payeeId ?? "",
    payeeName: input.account.name,
    type: "payment",
    category: "Debt payment",
    memo: input.note?.trim() ?? "",
    amount,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    debtAction: input.action ?? "payment",
    ...(input.paymentKind ? { paymentKind: input.paymentKind } : {}),
    balanceBefore,
    balanceAfter: cents(balanceBefore - amount),
    ...(input.creator ? { creator: input.creator } : {}),
  };
}


export type DebtPaymentCorrectionInput = {
  original: LedgerTransaction;
  accountWithoutOriginal: DebtAccount;
  amount: number;
  date: string;
  note?: string;
  paymentKind: PaymentKind;
  createdAt?: string;
  id?: string;
  creator?: DebtAuditCreator;
};

export function replaceDebtPayment(input: DebtPaymentCorrectionInput) {
  if (input.original.debtAction !== "payment" || input.original.deletedAt) {
    throw new DebtPaymentError("Only an active recorded payment can be corrected.");
  }
  const createdAt = input.createdAt ?? new Date().toISOString();
  const replacement = {
    ...createDebtPayment({
      account: input.accountWithoutOriginal,
      amount: input.amount,
      date: input.date,
      note: input.note,
      paymentKind: input.paymentKind,
      createdAt,
      id: input.id,
      payeeId: input.original.payeeId,
      creator: input.creator,
    }),
    replacesTransactionId: input.original.id,
  };
  const original = {
    ...input.original,
    deletedAt: createdAt,
    updatedAt: createdAt,
    replacedByTransactionId: replacement.id,
  };
  return { original, replacement };
}

export type BalanceAdjustmentInput = {
  storedAccount: DebtAccount;
  currentBalance: number;
  nextBalance: number;
  transactions?: LedgerTransaction[];
  date: string;
  note?: string;
  createdAt?: string;
  id?: string;
  creator?: DebtAuditCreator;
};

export function createBalanceAdjustment(input: BalanceAdjustmentInput) {
  if (!Number.isFinite(input.nextBalance) || input.nextBalance < 0) {
    throw new DebtBalanceError("Current balance must be zero or greater.");
  }
  if (!Number.isFinite(input.currentBalance) || input.currentBalance < 0) throw new DebtBalanceError("Enter a valid current balance.");
  if (cents(input.nextBalance) !== input.nextBalance || !Number.isSafeInteger(Math.round(input.nextBalance * 100))) throw new DebtBalanceError("Enter a balance with at most two decimal places.");
  const balanceBefore = cents(input.currentBalance);
  const balanceAfter = cents(input.nextBalance);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || new Date(input.date + "T12:00:00Z").toISOString().slice(0, 10) !== input.date) throw new DebtBalanceError("Enter a valid balance effective date.");
  if (input.storedAccount.reconciliation && input.date < input.storedAccount.reconciliation.date) throw new DebtBalanceError("Use a date on or after the latest lender balance.");
  const createdAt = input.createdAt ?? new Date().toISOString();
  const adjustmentId = input.id ?? crypto.randomUUID();
  const offset = cents((input.storedAccount.balanceOffset ?? 0) + balanceAfter - balanceBefore);
  const account = {
    ...input.storedAccount,
    reconciliation: { adjustmentId, accountId: input.storedAccount.id, balance: balanceAfter, date: input.date, createdAt, offset, ...(input.transactions ? { coveredTransactionIds: input.transactions.filter(t => t.accountId === input.storedAccount.id && t.date <= input.date).map(t => t.id) } : {}), ...(input.storedAccount.reconciliation ? { previousAdjustmentId: input.storedAccount.reconciliation.adjustmentId } : {}) },
    baselineBalance: input.storedAccount.baselineBalance ?? input.storedAccount.balance,
    balanceOffset: cents((input.storedAccount.balanceOffset ?? 0) + balanceAfter - balanceBefore),
  };
  const adjustment: BalanceAdjustment = {
    id: adjustmentId,
    reconciliationAnchor: account.reconciliation,
    accountId: input.storedAccount.id,
    date: input.date,
    balanceBefore,
    balanceAfter,
    difference: cents(balanceAfter - balanceBefore),
    createdAt,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    ...(input.creator ? { creator: input.creator } : {}),
  };
  return { account, adjustment };
}

export function setDebtArchived(account: DebtAccount, archived: boolean, createdAt = new Date().toISOString(), creator?: DebtAuditCreator, id = crypto.randomUUID()) {
  return {
    ...account,
    archivedAt: archived ? createdAt : null,
    archiveHistory: [
      ...(account.archiveHistory ?? []),
      {
        id,
        action: archived ? "archived" as const : "restored" as const,
        createdAt,
        ...(creator ? { creator } : {}),
      },
    ],
  };
}

export type DebtDisplayGroup = string;
export function debtDisplayPlacement(account: DebtAccount) {
  return { group: account.displayGroup ?? "Other", order: account.displayOrder ?? Number.MAX_SAFE_INTEGER };
}
export function groupedDisplayDebts(accounts: DebtAccount[]) {
  return [...new Set(["Mama", "Papi", "Other", ...accounts.map(account => debtDisplayPlacement(account).group)])].map(group => ({ group, accounts: accounts.filter(account => !isArchivedDebt(account) && debtDisplayPlacement(account).group === group).sort((a, b) => debtDisplayPlacement(a).order - debtDisplayPlacement(b).order || a.name.localeCompare(b.name)) }));
}
export function arrangeDebt(accounts: DebtAccount[], id: string, destination: DebtDisplayGroup, direction: -1 | 0 | 1 = 0) {
  const groups = groupedDisplayDebts(accounts);
  const moving = accounts.find(account => account.id === id);
  if (!moving || isArchivedDebt(moving)) return accounts;
  const source = debtDisplayPlacement(moving).group;
  if (!groups.some(group => group.group === destination)) groups.push({ group: destination, accounts: [] });
  const target = groups.find(group => group.group === destination)!.accounts;
  if (source !== destination) {
    groups.find(group => group.group === source)!.accounts = groups.find(group => group.group === source)!.accounts.filter(account => account.id !== id);
    target.push(moving);
  } else {
    const index = target.findIndex(account => account.id === id);
    const next = index + direction;
    if (next >= 0 && next < target.length) [target[index], target[next]] = [target[next], target[index]];
  }
  const placement = new Map(groups.flatMap(({ group, accounts: items }) => items.map((account, displayOrder) => [account.id, { displayGroup: group, displayOrder }] as const)));
  return accounts.map(account => ({ ...account, ...placement.get(account.id) }));
}
