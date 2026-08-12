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
        ? (effectiveAprs[b.id] ?? b.apr) - (effectiveAprs[a.id] ?? a.apr) || a.balance - b.balance || a.name.localeCompare(b.name)
        : a.balance - b.balance || (effectiveAprs[b.id] ?? b.apr) - (effectiveAprs[a.id] ?? a.apr) || a.name.localeCompare(b.name));
}

export function openingBalanceForCurrentBalance(openingBalance: number, currentBalance: number, nextCurrentBalance: number) {
  const ledgerMovement = currentBalance - openingBalance;
  const reconciled = Math.max(0, nextCurrentBalance - ledgerMovement);
  return Math.round((reconciled + Number.EPSILON) * 100) / 100;
}

export function promoNotice(account: DebtAccount, today = new Date()): PromoNotice {
  if (!account.promoEndDate) return null;
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const formatted = new Date(`${account.promoEndDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (account.postPromoApr <= 0) return { label: `Promo ends ${formatted}; add the post-promo APR`, tone: "danger" };
  if (account.promoEndDate < localToday) return { label: `Promo ended ${formatted}; now ${account.postPromoApr.toFixed(2)}% APR`, tone: "warning" };
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
  if (balanceBefore <= 0) throw new DebtPaymentError(input.account.name + " is already paid off.");
  if (amount <= 0) throw new DebtPaymentError("Enter a payment greater than $0.00.");
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
  date: string;
  note?: string;
  createdAt?: string;
  id?: string;
  creator?: DebtAuditCreator;
};

export function createBalanceAdjustment(input: BalanceAdjustmentInput) {
  if (!Number.isFinite(input.nextBalance) || input.nextBalance < 0) {
    throw new DebtBalanceError("Current balance must be $0.00 or greater.");
  }
  const balanceBefore = cents(input.currentBalance);
  const balanceAfter = cents(input.nextBalance);
  if (balanceBefore === balanceAfter) {
    throw new DebtBalanceError("Enter a balance different from the current balance.");
  }
  const createdAt = input.createdAt ?? new Date().toISOString();
  const account = {
    ...input.storedAccount,
    balance: openingBalanceForCurrentBalance(input.storedAccount.balance, balanceBefore, balanceAfter),
  };
  const adjustment: BalanceAdjustment = {
    id: input.id ?? crypto.randomUUID(),
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
