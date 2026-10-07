import type { DebtAccount, PayoffStrategy } from "./dashboard-data.ts";
import { calculatePlan, round } from "./payoff-engine.ts";
import { accountsWithCustomDebtOrder } from "./payoff-plan.ts";

/** A standalone forecast: the entered amount is the entire monthly payment pool. */
export function calculatePayoffCalculator(accounts: DebtAccount[], amount: number, strategy: PayoffStrategy, customOrder: string[] = [], date = new Date()) {
  const inputs = accountsWithCustomDebtOrder(accounts.filter(account => !account.archivedAt && account.balance > 0), customOrder).map(account => ({
    ...account,
    minimum: 0,
    minimumMode: "manual" as const,
    postPromoMinimum: 0,
    payoffMode: "priority" as const,
  }));
  return calculatePlan(inputs, Number.isFinite(amount) ? Math.max(0, round(amount)) : 0, strategy, {}, {}, date);
}
