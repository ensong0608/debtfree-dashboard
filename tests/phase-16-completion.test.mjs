import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createDashboardBackup,
  createDashboardPayload,
  createEmptyPlannedPayoff,
  serializeDashboardBackup,
} from "../app/dashboard-data.ts";
import {
  createBrowserDataRepository,
  DASHBOARD_BACKUP_STORAGE_KEY,
  DASHBOARD_STORAGE_KEY,
} from "../app/data-repository.ts";
import { previewDashboardImport, resolveDashboardImport } from "../app/data-transfer.ts";
import { createPayoffSnapshot } from "../app/progress-balances.ts";

function account(id, overrides = {}) {
  return {
    id, name: id, type: "Credit card", balance: 1000, apr: 18, interestFee: 0, minimum: 50, minimumMode: "manual", payoffMode: "priority",
    creditLimit: 5000, dueDate: "", promoEndDate: "", postPromoApr: 0, postPromoMinimum: 0, createdAt: "2026-08-01T00:00:00.000Z", ...overrides,
  };
}

function payload(overrides = {}) {
  return createDashboardPayload(null, {
    accounts: [], monthlyBudgets: {}, payees: [], transactions: [], snapshots: [], extra: 0, strategy: "avalanche",
    planning: createEmptyPlannedPayoff(), balanceAdjustments: [], monthlyPlan: { detailedSpendingTracking: false, months: {} }, customDebtOrder: [], ...overrides,
  });
}

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const meaningful = (value) => value.accounts.length > 0 || value.transactions.length > 0 || value.snapshots.length > 0;

test("Phase 12 repository abstracts local household persistence and recovers the automatic backup", async () => {
  const storage = memoryStorage();
  const repository = createBrowserDataRepository(meaningful, () => storage);
  const first = createDashboardBackup(payload({ accounts: [account("first")] }), null, "2026-08-01T00:00:00.000Z");
  const second = createDashboardBackup(payload({ accounts: [account("second")] }), first, "2026-08-02T00:00:00.000Z");

  await repository.saveHousehold(first);
  await repository.saveHousehold(second);
  assert.ok(storage.values.has(DASHBOARD_STORAGE_KEY));
  assert.match(storage.values.get(DASHBOARD_BACKUP_STORAGE_KEY), /"first"/);

  storage.setItem(DASHBOARD_STORAGE_KEY, "damaged json");
  const recovered = await repository.loadHousehold();
  assert.equal(recovered.recoveredFromBackup, true);
  assert.equal(recovered.contract.payload.accounts[0].id, "first");

  const exported = await repository.exportData(second);
  assert.equal((await repository.importData(exported)).payload.accounts[0].id, "second");
  await repository.resetHousehold();
  assert.equal(storage.values.size, 0);
});

test("Phase 13 import preview reports every required count before replace or merge", () => {
  const backup = createDashboardBackup(payload({
    accounts: [account("one"), account("two")],
    monthlyBudgets: { "2026-08": [], "2026-09": [] },
    monthlyPlan: { detailedSpendingTracking: false, months: { "2026-10": { safetyBuffer: 100, debtPaymentTarget: 500 } } },
    transactions: [{ id: "txn", date: "2026-08-10", accountId: "one", payeeId: "issuer", payeeName: "Issuer", type: "payment", category: "Debt payment", memo: "", amount: 100, createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z", deletedAt: null }],
    snapshots: [{ id: "snap", month: "2026-08", capturedAt: "2026-08-31T00:00:00.000Z", totalBalance: 1900, monthlyInterest: 20, activeAccountCount: 2, projectedDebtFreeMonth: "2027-08", note: "", accounts: [] }],
  }), null, "2026-08-21T00:00:00.000Z");
  const preview = previewDashboardImport(serializeDashboardBackup(backup));
  assert.deepEqual({ debts: preview.debtCount, months: preview.monthlyRecordCount, transactions: preview.transactionCount, snapshots: preview.snapshotCount, version: preview.sourceVersion }, {
    debts: 2, months: 3, transactions: 1, snapshots: 1, version: 5,
  });
});

test("Phase 13 merge keeps current records and updates matching imported IDs", () => {
  const current = createDashboardBackup(payload({ accounts: [account("shared"), account("current")], extra: 50 }));
  const incoming = createDashboardBackup(payload({ accounts: [account("shared", { balance: 750 }), account("incoming")], extra: 125, strategy: "snowball" }));
  const merged = resolveDashboardImport(current, incoming, "merge", "2026-08-21T12:00:00.000Z");
  assert.deepEqual(merged.payload.accounts.map((item) => item.id), ["shared", "current", "incoming"]);
  assert.equal(merged.payload.accounts.find((item) => item.id === "shared").balance, 750);
  assert.equal(merged.payload.extra, 125);
  assert.equal(merged.payload.strategy, "snowball");
  assert.equal(resolveDashboardImport(current, incoming, "replace"), incoming);
});

test("Phase 16 snapshot creation is deterministic, update-safe, and preserves future fields", () => {
  const existing = { id: "saved", month: "2026-07", capturedAt: "2026-07-31T00:00:00.000Z", totalBalance: 1000, monthlyInterest: 15, activeAccountCount: 1, projectedDebtFreeMonth: "2027-01", note: "old", futureSnapshotField: true, accounts: [{ accountId: "card", name: "card", type: "Credit card", balance: 1000, apr: 18, futureAccountField: 9 }] };
  const snapshot = createPayoffSnapshot({ existing, accounts: [account("card", { balance: 800 })], month: "2026-07", capturedAt: "2026-07-31T12:00:00.000Z", totalBalance: 800, monthlyInterest: 12, activeAccountCount: 1, projectedDebtFreeMonth: "2026-12", note: "  updated  ", id: "ignored" });
  assert.equal(snapshot.id, "saved");
  assert.equal(snapshot.note, "updated");
  assert.equal(snapshot.futureSnapshotField, true);
  assert.equal(snapshot.accounts[0].futureAccountField, 9);
  assert.equal(snapshot.accounts[0].balance, 800);
});

test("Phases 11 through 16 remain explicit in the source and responsive UI", async () => {
  const [client, contract, repository, safety, styles] = await Promise.all([
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data-safety-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  ["householdId?: string", "memberId?: string", "createdBy?: string", "updatedBy?: string"].forEach((field) => assert.ok(contract.includes(field), `Missing ownership field: ${field}`));
  ["loadHousehold", "saveHousehold", "exportData", "importData", "resetHousehold"].forEach((method) => assert.ok(repository.includes(method), `Missing repository method: ${method}`));
  assert.match(client, /createBrowserDataRepository\(hasMeaningfulData\)/);
  assert.doesNotMatch(client, /localStorage\.(getItem|setItem)\(STORAGE_/);
  ["Debts", "Monthly records", "Transactions", "Snapshots", "Import version", "Replace current data", "Merge with current data", "Clearing browser data may remove", "Type RESET to confirm"].forEach((label) => assert.ok(safety.includes(label), `Missing data-safety UI: ${label}`));
  assert.match(client, /const plan = useMemo\(\(\) => calculatePlan/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(styles, /min-height:44px/);
  assert.match(styles, /@media\(max-width:700px\)/);
});
