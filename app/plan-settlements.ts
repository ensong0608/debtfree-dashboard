import type { LedgerTransaction, PlanSettlement, MonthlyPlanSettings } from "./dashboard-data.ts";
/** Reporting-only records. Never pass these to transactionAdjustedAccounts or save them in the ledger. */
export function settlementReports(entries: PlanSettlement[] = []): LedgerTransaction[] {
  return entries.map(e => ({ id: "settlement:" + e.id, accountId: e.kind === "minimum" ? e.targetId : "", payeeId: "", payeeName: e.name, type: e.kind === "minimum" ? "payment" : "charge", paymentKind: "minimum", category: e.kind === "minimum" ? "Debt payment" : "Household spending", plannedItemId: e.kind === "spending" ? e.targetId : "", amount: e.amount, date: e.date, createdAt: e.createdAt, updatedAt: e.createdAt, deletedAt: null, memo: e.automatic ? "Automatically marked paid from recurring budget" : e.source === "debit" ? "Paid from debit/checking; no debt change" : "Already included in current balances; no debt change" }));
}

export function editPlanSettlement(settings: MonthlyPlanSettings, entry: PlanSettlement): MonthlyPlanSettings {
  const origin=Object.entries(settings.months).find(([,plan])=>plan.settlements?.some(row=>row.id===entry.id));
  if(!origin) return settings;
  const original=origin[1].settlements!.find(row=>row.id===entry.id)!;
  const destination=entry.date.slice(0,7);
  const months={...settings.months};
  months[origin[0]]={...origin[1],settlements:origin[1].settlements?.filter(row=>row.id!==entry.id),...(original.automatic?{skippedRecurringPayments:[...new Set([...(origin[1].skippedRecurringPayments??[]),original.targetId])]}:{})};
  const plan=months[destination]??{safetyBuffer:0};
  months[destination]={...plan,settlements:[...(plan.settlements??[]),{...original,amount:entry.amount,date:entry.date}]};
  return {...settings,months};
}
