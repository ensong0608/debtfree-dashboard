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
