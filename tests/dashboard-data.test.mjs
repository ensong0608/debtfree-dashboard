import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DASHBOARD_BACKUP_FORMAT,
  DASHBOARD_DATA_VERSION,
  LEGACY_DASHBOARD_DATA_VERSION,
  PLANNING_DASHBOARD_DATA_VERSION,
  DashboardDataError,
  createDashboardBackup,
  createEmptyPlannedPayoff,
  createDashboardPayload,
  migrateV0ToV1,
  migrateV1ToV2,
  parseDashboardContract,
  parseDashboardJson,
  parseHouseholdWriteJson,
  serializeDashboardBackup,
} from "../app/dashboard-data.ts";

const fixture = JSON.parse(await readFile(new URL("./fixtures/legacy-v0.json", import.meta.url), "utf8"));
const fixedExportedAt = "2026-08-04T20:00:00.000Z";

function copy(value) {
  return structuredClone(value);
}

function expectFieldError(value, path) {
  assert.throws(
    () => parseDashboardContract(value),
    (error) => error instanceof DashboardDataError && error.message.includes(path),
    `Expected a validation error containing ${path}`,
  );
}

test("imports the anonymized unwrapped legacy v0 shape without loss", () => {
  const contract = parseDashboardContract(fixture);
  assert.equal(contract.format, DASHBOARD_BACKUP_FORMAT);
  assert.equal(contract.version, DASHBOARD_DATA_VERSION);
  const { planning, balanceAdjustments, ...legacyPayload } = contract.payload;
  assert.deepEqual(legacyPayload, fixture);
  assert.deepEqual(planning, createEmptyPlannedPayoff());
  assert.deepEqual(balanceAdjustments, []);
});

test("imports the existing wrapped version-1 backup", () => {
  const wrapped = {
    format: DASHBOARD_BACKUP_FORMAT,
    version: LEGACY_DASHBOARD_DATA_VERSION,
    exportedAt: fixedExportedAt,
    payload: fixture,
    legacyWrapperField: { retained: true },
  };
  const migrated = parseDashboardContract(wrapped);
  assert.equal(migrated.version, DASHBOARD_DATA_VERSION);
  assert.deepEqual(migrated.legacyWrapperField, wrapped.legacyWrapperField);
  assert.deepEqual(migrated.payload.planning, createEmptyPlannedPayoff());
});

test("migrates legacy v0 defaults to v1 while retaining every supplied field", () => {
  const legacy = copy(fixture);
  delete legacy.accounts[0].interestFee;
  delete legacy.accounts[0].payoffMode;
  delete legacy.accounts[0].promoEndDate;
  delete legacy.accounts[0].postPromoApr;
  delete legacy.accounts[0].postPromoMinimum;
  delete legacy.monthlyBudgets["2026-07"][0].paymentMethod;
  delete legacy.monthlyBudgets["2026-07"][0].creditAccountId;
  delete legacy.transactions[0].updatedAt;
  delete legacy.transactions[0].deletedAt;
  delete legacy.snapshots[0].monthlyInterest;
  delete legacy.snapshots[0].projectedDebtFreeMonth;
  delete legacy.snapshots[0].note;
  legacy.futureTopLevel = { retained: true };

  const migrated = migrateV0ToV1(legacy, fixedExportedAt);
  assert.equal(migrated.exportedAt, fixedExportedAt);
  assert.equal(migrated.payload.accounts[0].interestFee, 0);
  assert.equal(migrated.payload.accounts[0].payoffMode, "priority");
  assert.equal(migrated.payload.accounts[0].promoEndDate, "");
  assert.equal(migrated.payload.accounts[0].postPromoApr, 0);
  assert.equal(migrated.payload.accounts[0].postPromoMinimum, 0);
  assert.equal(migrated.payload.monthlyBudgets["2026-07"][0].paymentMethod, "debit");
  assert.equal(migrated.payload.monthlyBudgets["2026-07"][0].creditAccountId, "");
  assert.equal(migrated.payload.transactions[0].updatedAt, migrated.payload.transactions[0].createdAt);
  assert.equal(migrated.payload.transactions[0].deletedAt, null);
  assert.equal(migrated.payload.snapshots[0].monthlyInterest, 0);
  assert.equal(migrated.payload.snapshots[0].projectedDebtFreeMonth, null);
  assert.equal(migrated.payload.snapshots[0].note, "");
  assert.deepEqual(migrated.payload.futureTopLevel, { retained: true });
});

test("migrates wrapped v1 to v2 with explicit planned-data defaults", () => {
  const v1 = migrateV0ToV1(fixture, fixedExportedAt);
  const migrated = migrateV1ToV2(v1);
  assert.equal(v1.version, LEGACY_DASHBOARD_DATA_VERSION);
  assert.equal(migrated.version, PLANNING_DASHBOARD_DATA_VERSION);
  assert.deepEqual(migrated.payload.planning, createEmptyPlannedPayoff());
  const legacyPayload = Object.fromEntries(Object.entries(migrated.payload).filter(([key]) => key !== "planning"));
  assert.deepEqual(legacyPayload, fixture);
});

test("round-trips versioned imports and exports", () => {
  const initial = parseDashboardContract({
    format: DASHBOARD_BACKUP_FORMAT,
    version: LEGACY_DASHBOARD_DATA_VERSION,
    exportedAt: fixedExportedAt,
    payload: fixture,
  });
  const serialized = serializeDashboardBackup(initial, true);
  const reparsed = parseDashboardJson(serialized);
  assert.deepEqual(reparsed, initial);
});

test("preserves unknown wrapper, payload, and nested fields through application saves and re-export", () => {
  const extended = copy(fixture);
  extended.futureTopLevel = { enabled: true, label: "preserve me" };
  extended.accounts[0].futureAccountField = { issuerCode: "example" };
  extended.monthlyBudgets["2026-07"][0].futureBudgetField = ["one", "two"];
  extended.payees[0].futurePayeeField = 17;
  extended.transactions[0].futureTransactionField = { reconciled: false };
  extended.snapshots[0].futureSnapshotField = "retained";
  extended.snapshots[0].accounts[0].futureSnapshotAccountField = 9;
  const imported = parseDashboardContract({
    format: DASHBOARD_BACKUP_FORMAT,
    version: LEGACY_DASHBOARD_DATA_VERSION,
    exportedAt: fixedExportedAt,
    vendorMetadata: { source: "future-version" },
    payload: extended,
  });

  const savedPayload = createDashboardPayload(imported.payload, {
    accounts: imported.payload.accounts,
    monthlyBudgets: imported.payload.monthlyBudgets,
    payees: imported.payload.payees,
    transactions: imported.payload.transactions,
    snapshots: imported.payload.snapshots,
    extra: imported.payload.extra + 25,
    strategy: imported.payload.strategy,
    planning: imported.payload.planning,
  });
  const exported = parseDashboardJson(serializeDashboardBackup(createDashboardBackup(savedPayload, imported, fixedExportedAt)));

  assert.deepEqual(exported.vendorMetadata, { source: "future-version" });
  assert.deepEqual(exported.payload.futureTopLevel, extended.futureTopLevel);
  assert.deepEqual(exported.payload.accounts[0].futureAccountField, extended.accounts[0].futureAccountField);
  assert.deepEqual(exported.payload.monthlyBudgets["2026-07"][0].futureBudgetField, extended.monthlyBudgets["2026-07"][0].futureBudgetField);
  assert.equal(exported.payload.payees[0].futurePayeeField, 17);
  assert.deepEqual(exported.payload.transactions[0].futureTransactionField, { reconciled: false });
  assert.equal(exported.payload.snapshots[0].futureSnapshotField, "retained");
  assert.equal(exported.payload.snapshots[0].accounts[0].futureSnapshotAccountField, 9);
  assert.equal(exported.payload.extra, fixture.extra + 25);
});

test("round-trips planned income, broad expenses, capacity, and unknown planning fields", () => {
  const imported = parseDashboardContract(fixture);
  const planning = {
    ...createEmptyPlannedPayoff(),
    onboarding: { completed: false, currentStep: 4, completedAt: null },
    incomeSources: [
      { id: "income-a", name: "Primary salary", monthlyTakeHome: 5200, assignment: "partner-1", futureIncomeField: "keep" },
      { id: "income-b", name: "Benefits", monthlyTakeHome: 450, assignment: "household" },
    ],
    essentialExpenses: {
      ...createEmptyPlannedPayoff().essentialExpenses,
      housing: 1800,
      utilities: 275,
      food: 650,
      safetyBuffer: 500,
      futureExpenseField: { keep: true },
    },
    capacity: { method: "calculated", monthlyAmount: 2025, futureCapacityField: 9 },
    futurePlanningField: ["preserve"],
  };
  const payload = createDashboardPayload(imported.payload, {
    accounts: imported.payload.accounts,
    monthlyBudgets: imported.payload.monthlyBudgets,
    payees: imported.payload.payees,
    transactions: imported.payload.transactions,
    snapshots: imported.payload.snapshots,
    extra: imported.payload.extra,
    strategy: imported.payload.strategy,
    planning,
  });
  const reparsed = parseDashboardJson(serializeDashboardBackup(createDashboardBackup(payload, imported, fixedExportedAt)));
  assert.deepEqual(reparsed.payload.planning, planning);
});

test("rejects invalid JSON with a useful location", () => {
  assert.throws(
    () => parseDashboardJson('{\n  "accounts": [}\n'),
    (error) => error instanceof DashboardDataError
      && error.message.includes("invalid JSON")
      && /line \d+, column \d+/.test(error.message),
  );
});

test("rejects invalid account fields with their array path", () => {
  const invalid = copy(fixture);
  invalid.accounts[0].balance = "2450.75";
  expectFieldError(invalid, "payload.accounts[0].balance");
});

test("rejects invalid monthly budget fields with their month and item path", () => {
  const invalid = copy(fixture);
  invalid.monthlyBudgets["2026-07"][1].kind = "wish";
  expectFieldError(invalid, 'payload.monthlyBudgets["2026-07"][1].kind');
});

test("rejects invalid transaction fields with their array path", () => {
  const invalid = copy(fixture);
  invalid.transactions[0].amount = { dollars: 64.25 };
  expectFieldError(invalid, "payload.transactions[0].amount");
});

test("rejects invalid snapshot and nested snapshot account fields", () => {
  const invalidSnapshot = copy(fixture);
  invalidSnapshot.snapshots[0].activeAccountCount = 1.5;
  expectFieldError(invalidSnapshot, "payload.snapshots[0].activeAccountCount");

  const invalidAccount = copy(fixture);
  invalidAccount.snapshots[0].accounts[0].apr = null;
  expectFieldError(invalidAccount, "payload.snapshots[0].accounts[0].apr");
});

test("rejects invalid strategies and unsupported wrapper versions", () => {
  const customStrategy = copy(fixture);
  customStrategy.strategy = "custom";
  customStrategy.accounts[0].customOrder = 1;
  assert.equal(parseDashboardContract(customStrategy).payload.strategy, "custom");
  assert.equal(parseDashboardContract(customStrategy).payload.accounts[0].customOrder, 1);

  const invalidStrategy = copy(fixture);
  invalidStrategy.strategy = "random";
  expectFieldError(invalidStrategy, "payload.strategy");

  const invalidVersion = {
    format: DASHBOARD_BACKUP_FORMAT,
    version: 4,
    exportedAt: fixedExportedAt,
    payload: fixture,
  };
  expectFieldError(invalidVersion, "backup.version must be 1, 2, or 3");
});

test("rejects invalid planned-data fields with useful paths", () => {
  const invalid = parseDashboardContract(fixture);
  invalid.payload.planning.essentialExpenses.safetyBuffer = "a lot";
  expectFieldError(invalid, "backup.payload.planning.essentialExpenses.safetyBuffer");
});

test("does not accept arbitrary objects as valid dashboard data", () => {
  expectFieldError({ accounts: [{}] }, "payload.accounts[0].id");
});

test("reports multiple useful field errors while leading with the first field", () => {
  const invalid = copy(fixture);
  invalid.accounts[0].name = "";
  invalid.accounts[0].apr = "high";
  assert.throws(
    () => parseDashboardContract(invalid),
    (error) => error instanceof DashboardDataError
      && error.issues.some((issue) => issue.includes("payload.accounts[0].name"))
      && error.issues.some((issue) => issue.includes("payload.accounts[0].apr"))
      && error.message.includes("more validation error"),
  );
});

test("validates and migrates household API write payloads with the shared contract", () => {
  const unwrapped = parseHouseholdWriteJson(JSON.stringify({ payload: fixture }));
  assert.equal(unwrapped.version, DASHBOARD_DATA_VERSION);
  const { planning, balanceAdjustments, ...legacyPayload } = unwrapped.payload;
  assert.deepEqual(legacyPayload, fixture);
  assert.deepEqual(planning, createEmptyPlannedPayoff());
  assert.deepEqual(balanceAdjustments, []);

  const wrapped = migrateV0ToV1(fixture, fixedExportedAt);
  assert.deepEqual(
    parseHouseholdWriteJson(JSON.stringify({ payload: wrapped })),
    parseDashboardContract(wrapped),
  );

  const invalid = copy(fixture);
  invalid.transactions[0].date = 20260710;
  assert.throws(
    () => parseHouseholdWriteJson(JSON.stringify({ payload: invalid })),
    (error) => error instanceof DashboardDataError && error.message.includes("payload.transactions[0].date"),
  );
  assert.throws(
    () => parseHouseholdWriteJson("{not-json"),
    (error) => error instanceof DashboardDataError && error.message.includes("Household request contains invalid JSON"),
  );
});
