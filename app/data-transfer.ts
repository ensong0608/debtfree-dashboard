import {
  createDashboardBackup,
  createDashboardPayload,
  parseDashboardJson,
  type DashboardBackup,
  type DashboardPayload,
} from "./dashboard-data.ts";

export type ImportMode = "replace" | "merge";

export type DashboardImportPreview = {
  contract: DashboardBackup;
  sourceVersion: number | "Legacy";
  debtCount: number;
  monthlyRecordCount: number;
  transactionCount: number;
  snapshotCount: number;
  warnings: string[];
};

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const merged = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => merged.set(item.id, item));
  return [...merged.values()];
}

function mergeMonthlyRecords(current: DashboardPayload["monthlyBudgets"], incoming: DashboardPayload["monthlyBudgets"]) {
  return [...new Set([...Object.keys(current), ...Object.keys(incoming)])].reduce<DashboardPayload["monthlyBudgets"]>((months, month) => {
    months[month] = mergeById(current[month] ?? [], incoming[month] ?? []);
    return months;
  }, {});
}

export function previewDashboardImport(text: string): DashboardImportPreview {
  const contract = parseDashboardJson(text);
  const raw = JSON.parse(text) as { version?: unknown };
  const months = new Set([
    ...Object.keys(contract.payload.monthlyBudgets),
    ...Object.keys(contract.payload.monthlyPlan?.months ?? {}),
  ]);
  return {
    contract,
    sourceVersion: typeof raw?.version === "number" ? raw.version : "Legacy",
    debtCount: contract.payload.accounts.length,
    monthlyRecordCount: months.size,
    transactionCount: contract.payload.transactions.length,
    snapshotCount: contract.payload.snapshots.length,
    warnings: importReferenceWarnings(contract.payload),
  };
}

export function mergeDashboardPayload(current: DashboardPayload, incoming: DashboardPayload): DashboardPayload {
  const balanceAdjustments = mergeById(current.balanceAdjustments ?? [], incoming.balanceAdjustments ?? []);
  const customDebtOrder = [...new Set([...(current.customDebtOrder ?? []), ...(incoming.customDebtOrder ?? [])])];
  return createDashboardPayload({ ...current, ...incoming }, {
    accounts: mergeById(current.accounts, incoming.accounts),
    monthlyBudgets: mergeMonthlyRecords(current.monthlyBudgets, incoming.monthlyBudgets),
    payees: mergeById(current.payees, incoming.payees),
    transactions: mergeById(current.transactions, incoming.transactions),
    snapshots: mergeById(current.snapshots, incoming.snapshots),
    extra: incoming.extra,
    strategy: incoming.strategy,
    planning: incoming.planning,
    balanceAdjustments,
    monthlyPlan: {
      ...current.monthlyPlan,
      ...incoming.monthlyPlan,
      detailedSpendingTracking: Boolean(current.monthlyPlan?.detailedSpendingTracking || incoming.monthlyPlan?.detailedSpendingTracking),
      months: { ...(current.monthlyPlan?.months ?? {}), ...(incoming.monthlyPlan?.months ?? {}) },
    },
    customDebtOrder,
  });
}

export function resolveDashboardImport(
  current: DashboardBackup,
  incoming: DashboardBackup,
  mode: ImportMode,
  exportedAt = new Date().toISOString(),
) {
  if (mode === "replace") return incoming;
  const payload = mergeDashboardPayload(current.payload, incoming.payload);
  return createDashboardBackup(payload, { ...current, ...incoming }, exportedAt);
}

/** Historical records are retained even when their original account was removed. */
export function importReferenceWarnings(payload: DashboardPayload) {
  const accounts = new Set(payload.accounts.map(a => a.id));
  const warnings: string[] = [];
  const missing = new Set([...payload.transactions, ...(payload.balanceAdjustments ?? [])].filter(t => !accounts.has(t.accountId)).map(t => t.accountId));
  if (missing.size) warnings.push(missing.size + " removed or missing debt references are retained in history. Review them after import; no records will be discarded.");
  const planned = new Set(Object.values(payload.monthlyBudgets).flat().map(item => item.id));
  if (payload.transactions.some(t => t.plannedItemId && !planned.has(t.plannedItemId))) warnings.push("Some transactions refer to removed planned items. Their posted amounts are preserved.");
  return warnings;
}
