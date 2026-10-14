import { parseDashboardContract, type DashboardBackup } from "./dashboard-data.ts";
import type { HouseholdSessionScope } from "./household-session-scope.ts";

export type PendingHouseholdDraft = { revision: number; contract: DashboardBackup };
export type HouseholdRecoveryDraft = PendingHouseholdDraft & { key: string };
export function householdOutboxPrefix(scope: HouseholdSessionScope) {
  return "debtfree-outbox:" + scope.identity + ":" + scope.householdId + ":";
}
export function parsePendingHouseholdDraft(raw: string): PendingHouseholdDraft {
  const saved = JSON.parse(raw);
  if (!Number.isSafeInteger(saved.revision) || saved.revision < 0) throw new Error("Recovery revision is invalid. Export your device backup before continuing.");
  return { revision: saved.revision, contract: parseDashboardContract(saved.contract) };
}
/** Closed tabs retain their own outboxes. Discovery never adopts or deletes them. */
export function householdRecoveryDrafts(storage: Pick<Storage, "length" | "key" | "getItem">, scope: HouseholdSessionScope, currentKey: string, saved?: DashboardBackup | null) {
  const drafts: HouseholdRecoveryDraft[] = [];
  const prefix = householdOutboxPrefix(scope);
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key || key === currentKey || !key.startsWith(prefix)) continue;
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const draft = parsePendingHouseholdDraft(raw);
      if (saved && JSON.stringify(draft.contract.payload) === JSON.stringify(saved.payload)) continue;
      drafts.push({ key, ...draft });
    } catch { /* Leave damaged drafts intact for explicit recovery. */ }
  }
  return drafts.sort((a, b) => b.contract.exportedAt.localeCompare(a.contract.exportedAt));
}
