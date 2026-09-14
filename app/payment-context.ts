import type { DebtAccount, LedgerTransaction, MonthlyPlanSettings, CashflowItem } from "./dashboard-data.ts";
import { effectiveMinimum, round, type PlanContext } from "./payoff-engine.ts";

export function paymentContext(transactions: LedgerTransaction[], month: string, monthlyCommitment?: number): PlanContext {
  const paid: Record<string, number> = {};
  const minimumPaid: Record<string, number> = {};
  for (const t of transactions) {
    if (t.deletedAt || t.type !== "payment" || t.date.slice(0, 7) !== month) continue;
    paid[t.accountId] = round((paid[t.accountId] ?? 0) + t.amount);
    if (t.paymentKind !== "extra") minimumPaid[t.accountId] = round((minimumPaid[t.accountId] ?? 0) + t.amount);
  }
  return { paid, minimumPaid, monthlyCommitment };
}

export function initialCommitment(accounts: DebtAccount[], extra: number, items: CashflowItem[], settings?: MonthlyPlanSettings) {
  return settings?.monthlyCommitment ?? round(accounts.reduce((sum, a) => sum + effectiveMinimum(a), 0) + extra
    + items.filter((i) => i.kind === "expense" && i.paymentMethod === "credit" && accounts.some((a) => a.id === i.creditAccountId)).reduce((sum, i) => sum + i.amount, 0));
}
