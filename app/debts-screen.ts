import type { DebtAccount, PayoffStrategy } from "./dashboard-data.ts";

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
    .sort((a, b) => strategy === "avalanche"
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
