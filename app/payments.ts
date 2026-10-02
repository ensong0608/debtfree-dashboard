import type { BalanceAdjustment, DebtAuditCreator, LedgerTransaction } from "./dashboard-data.ts";
import { round } from "./payoff-engine.ts";

/** A confirmation is reporting metadata; it must never become another ledger movement. */
export function confirmAdjustmentPayment(adjustment: BalanceAdjustment, creator?: DebtAuditCreator, confirmedAt = new Date().toISOString()): BalanceAdjustment {
  if (!Number.isFinite(adjustment.difference) || adjustment.difference >= 0) throw new Error("Only a balance decrease can be identified as a payment.");
  if (adjustment.confirmedPayment) return adjustment;
  return { ...adjustment, confirmedPayment: { confirmedAt, ...(creator ? { creator } : {}) } };
}

export function paymentActivity(transactions: LedgerTransaction[], adjustments: BalanceAdjustment[]) {
  return [
    ...transactions.filter(t => !t.deletedAt && t.type === "payment").map(t => ({
      id: "transaction:" + t.id, accountId: t.accountId, date: t.date, createdAt: t.createdAt,
      amount: t.amount, difference: -t.amount, kind: "payment" as const,
      source: "Recorded payment", note: t.memo, creator: t.creator,
      before: t.balanceBefore, after: t.balanceAfter, adjustment: null,
    })),
    ...adjustments.map(a => ({
      id: "adjustment:" + a.id, accountId: a.accountId, date: a.date, createdAt: a.createdAt,
      amount: Math.abs(a.difference), difference: a.difference,
      kind: a.confirmedPayment ? "payment" as const : "adjustment" as const,
      source: a.confirmedPayment ? "Confirmed from balance update" : "Balance updated",
      note: a.note ?? "", creator: a.creator, before: a.balanceBefore, after: a.balanceAfter, adjustment: a,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

export function confirmedPaymentTotal(transactions: LedgerTransaction[], adjustments: BalanceAdjustment[], month: string, accountId = "all") {
  return round(paymentActivity(transactions, adjustments).filter(row => row.kind === "payment" && row.date.slice(0, 7) === month && (accountId === "all" || row.accountId === accountId)).reduce((sum, row) => sum + row.amount, 0));
}

export function parseMoneyInput(value: string) {
  return /^\d+(\.\d{1,2})?$/.test(value.trim()) ? round(Number(value.trim())) : NaN;
}
