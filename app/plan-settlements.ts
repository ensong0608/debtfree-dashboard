import type { LedgerTransaction, PlanSettlement } from "./dashboard-data.ts";
/** Reporting-only records. Never pass these to transactionAdjustedAccounts or save them in the ledger. */
export function settlementReports(entries: PlanSettlement[] = []): LedgerTransaction[] {
  return entries.map(e => ({ id: "settlement:" + e.id, accountId: e.kind === "minimum" ? e.targetId : "", payeeId: "", payeeName: e.name, type: e.kind === "minimum" ? "payment" : "charge", paymentKind: "minimum", category: e.kind === "minimum" ? "Debt payment" : "Household spending", plannedItemId: e.kind === "spending" ? e.targetId : "", amount: e.amount, date: e.date, createdAt: e.createdAt, updatedAt: e.createdAt, deletedAt: null, memo: e.source === "debit" ? "Paid from debit/checking; no debt change" : "Already included in current balances; no debt change" }));
}
