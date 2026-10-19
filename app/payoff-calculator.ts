import type { DebtAccount, PayoffStrategy } from "./dashboard-data.ts";
import { calculatePlan, round } from "./payoff-engine.ts";
import { accountsWithCustomDebtOrder } from "./payoff-plan.ts";

/** Save one shared minimum without changing any posted balance or ledger entry. */
export function updatePayoffMinimum(accounts: DebtAccount[], id: string, minimum: number): DebtAccount[] {
  if (!Number.isFinite(minimum) || round(minimum) <= 0) throw new Error("Enter a minimum greater than zero.");
  return accounts.map(account => account.id === id && !account.archivedAt
    ? { ...account, minimum: round(minimum), minimumMode: "manual" }
    : account);
}

/** A standalone forecast: the entered amount is the entire monthly payment pool. */
export function calculatePayoffCalculator(accounts: DebtAccount[], amount: number, strategy: PayoffStrategy, customOrder: string[] = [], date = new Date()) {
  void customOrder;
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(Math.round(amount * 100))) throw new Error("Enter a valid monthly amount.");
  const inputs = accounts.filter(account => !account.archivedAt && account.balance > 0).map(account => ({...account, payoffMode: "priority" as const}));
  return calculatePlan(inputs, 0, strategy === "snowball" ? "snowball" : "avalanche", {}, {}, date, {}, { monthlyCommitment: Math.max(0, round(amount)), paymentCap: Math.max(0, round(amount)), reserveMinimums: false });
}

/** A separate total-payment plan; minimums consume this pool, never add to it. */
export function calculateMinimumPayoffPlan(accounts: DebtAccount[], amount: number, strategy: PayoffStrategy, customOrder: string[] = [], date = new Date()) {
  const inputs = accountsWithCustomDebtOrder(accounts.filter(account => !account.archivedAt && account.balance > 0).map(account => ({...account, payoffMode: "priority" as const})), customOrder);
  const missing = inputs.filter(account => account.minimumMode === "manual" && account.minimum <= 0);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(Math.round(amount * 100))) return { error: "Enter a valid monthly amount.", plan: null };
  const monthly = round(amount);
  if (missing.length) return { error: `Set a minimum payment for ${missing.map(a => a.name).join(", ")}.`, plan: null };
  try {
    return { error: "", plan: calculatePlan(inputs, 0, strategy === "snowball" ? "snowball" : "avalanche", {}, {}, date, {}, { monthlyCommitment: monthly, paymentCap: monthly }) };
  } catch (error) { return { error: error instanceof Error ? error.message : "Check the monthly payment amount.", plan: null }; }
}
