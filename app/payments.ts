import type { BalanceAdjustment, DebtAuditCreator, LedgerTransaction } from "./dashboard-data.ts";
import { entryHistory } from "./entry-history.ts";
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
      amount: t.amount, difference: t.includedIn ? 0 : -t.amount, kind: t.includedIn?.type === "transaction" || t.reductionKind === "adjustment" ? "adjustment" as const : t.credit === true ? "credit" as const : "payment" as const,
      title: t.title || (t.reductionKind === "adjustment" ? "Balance correction" : t.credit === true ? "Refund / credit" : "Payment"), source: t.includedIn ? "Already included · linked record" : t.credit === true ? "Refund / credit" : "Recorded payment", note: t.memo, creator: t.creator,
      before: entryHistory(t).before, after: entryHistory(t).after, adjustment: null,
    })),
    ...transactions.filter(t => t.type !== "payment" && !t.deletedAt).map(t => ({
      id: "transaction:" + t.id, accountId: t.accountId, date: t.date, createdAt: t.createdAt,
      amount: t.amount, difference: t.amount,
      kind: t.interestEstimate || t.category === "Interest" ? "interest" as const : t.type === "charge" ? "purchase" as const : "fee" as const,
      title: t.title || (t.interestEstimate ? "Estimated interest" : t.type === "charge" ? (t.payeeName || "Card purchase") : t.category === "Interest" ? "Interest" : "Fee"),
      source: t.interestEstimate ? (t.interestEstimate.reconciledAt ? "Estimate reconciled to lender balance" : "Automatic interest estimate · Not counted as a payment") : t.type === "charge" ? "Card purchase" : "Interest or fee",
      note: t.memo, creator: t.creator, before: entryHistory(t).before, after: entryHistory(t).after, adjustment: null,
    })),
    ...adjustments.filter(a => !a.deletedAt).map(a => ({
      id: "adjustment:" + a.id, accountId: a.accountId, date: a.date, createdAt: a.createdAt,
      amount: Math.abs(a.difference), difference: a.difference,
      kind: a.confirmedPayment ? "payment" as const : "adjustment" as const,
      title: a.title || (a.confirmedPayment ? "Payment" : "Balance update"),
      source: a.confirmedPayment ? "Confirmed from balance update" : "Balance updated",
      note: a.note ?? "", creator: a.creator, before: entryHistory(a).before, after: entryHistory(a).after, adjustment: a,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

export function confirmedPaymentTotal(transactions: LedgerTransaction[], adjustments: BalanceAdjustment[], month: string, accountId = "all") {
  return round(paymentActivity(transactions, adjustments).filter(row => row.kind === "payment" && row.date.slice(0, 7) === month && (accountId === "all" || row.accountId === accountId)).reduce((sum, row) => sum + row.amount, 0));
}

export function parseMoneyInput(value: string) {
  return /^\d+(\.\d{1,2})?$/.test(value.trim()) ? round(Number(value.trim())) : NaN;
}

/** Retain the audit entry; the existing ledger excludes deleted movements. */
export function setRecordedPaymentDeleted(transaction: LedgerTransaction, deleted: boolean, now = new Date().toISOString()): LedgerTransaction {
  if (transaction.type !== "payment" || transaction.replacedByTransactionId) throw new Error("Only an unreplaced payment can be deleted or restored.");
  if (Boolean(transaction.deletedAt) === deleted) return transaction;
  return { ...transaction, deletedAt: deleted ? now : null, updatedAt: now };
}
