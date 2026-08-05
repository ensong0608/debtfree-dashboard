import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createDashboardBackup,
  parseDashboardContract,
  parseDashboardJson,
  serializeDashboardBackup,
} from "../app/dashboard-data.ts";
import {
  buildOnboardingPlan,
  capacityToExtra,
  createIncomeSource,
  createOnboardingPlanning,
  createPlannedDebt,
  debtTotals,
  hasOnboardingProgress,
  onboardingStepIssues,
  recommendedDebtCapacity,
  shouldShowOnboarding,
  totalPlannedIncome,
} from "../app/onboarding-plan.ts";
import { calculatePlan } from "../app/payoff-engine.ts";

const fixture = JSON.parse(await readFile(new URL("./fixtures/legacy-v0.json", import.meta.url), "utf8"));
const calculationDate = new Date(2026, 7, 15, 12);
const completedAt = "2026-08-15T19:00:00.000Z";

function representativePlanning() {
  const planning = createOnboardingPlanning();
  planning.onboarding.currentStep = 5;
  planning.incomeSources = [
    { id: "income-1", name: "Primary salary", monthlyTakeHome: 5200, assignment: "partner-1" },
    { id: "income-2", name: "Benefits", monthlyTakeHome: 800, assignment: "household" },
  ];
  planning.debts = [
    { ...createPlannedDebt("debt-a"), name: "Alpha Card", balance: 5000, apr: 24, minimum: 150, assignment: "partner-1" },
    { ...createPlannedDebt("debt-b"), name: "Beta Card", balance: 2000, apr: 18, minimum: 75, assignment: "partner-2" },
    { ...createPlannedDebt("debt-c"), name: "Family Loan", balance: 8000, apr: 8, minimum: 200, type: "Personal loan", assignment: "household" },
  ];
  planning.essentialExpenses = {
    housing: 2000,
    utilities: 300,
    food: 700,
    transportation: 400,
    insurance: 250,
    subscriptions: 100,
    otherObligations: 300,
    safetyBuffer: 500,
  };
  planning.capacity = { method: "known", monthlyAmount: 900 };
  return planning;
}

test("a new user can complete all five onboarding steps", () => {
  const planning = representativePlanning();
  assert.deepEqual(onboardingStepIssues(1, planning), []);
  assert.deepEqual(onboardingStepIssues(2, planning), []);
  assert.deepEqual(onboardingStepIssues(3, planning), []);
  assert.deepEqual(onboardingStepIssues(4, planning), []);
  const result = buildOnboardingPlan(planning, calculationDate, completedAt);
  assert.equal(result.planning.onboarding.completed, true);
  assert.equal(result.planning.onboarding.currentStep, 5);
  assert.equal(result.accounts.length, 3);
  assert.equal(result.accounts[0].minimumMode, "manual");
  assert.equal(result.accounts[0].householdMember, "partner-1");
});

test("supports multiple income sources without partner names", () => {
  const planning = representativePlanning();
  assert.equal(planning.incomeSources.length, 2);
  assert.equal(totalPlannedIncome(planning.incomeSources), 6000);
  assert.deepEqual(planning.incomeSources.map((source) => source.assignment), ["partner-1", "household"]);
});

test("supports adding three debts on one screen and computes running totals", () => {
  const planning = representativePlanning();
  const totals = debtTotals(planning.debts);
  assert.equal(planning.debts.length, 3);
  assert.deepEqual(totals, { debt: 15000, minimums: 425, weightedApr: 14.67 });
});

test("known-payment path converts total capacity into engine extra", () => {
  const result = buildOnboardingPlan(representativePlanning(), calculationDate, completedAt);
  assert.equal(result.planning.capacity.method, "known");
  assert.equal(result.extra, 475);
  assert.equal(result.plan.monthly, 900);
});

test("help-me-calculate path subtracts essential expenses and safety buffer", () => {
  const planning = representativePlanning();
  const recommended = recommendedDebtCapacity(totalPlannedIncome(planning.incomeSources), planning.essentialExpenses);
  planning.capacity = { method: "calculated", monthlyAmount: recommended };
  const result = buildOnboardingPlan(planning, calculationDate, completedAt);
  assert.equal(recommended, 1450);
  assert.equal(result.extra, 1025);
  assert.equal(result.plan.monthly, 1450);
});

test("safety buffer reduces recommended capacity dollar for dollar", () => {
  const planning = representativePlanning();
  const withBuffer = recommendedDebtCapacity(6000, planning.essentialExpenses);
  const withoutBuffer = recommendedDebtCapacity(6000, { ...planning.essentialExpenses, safetyBuffer: 0 });
  assert.equal(withoutBuffer - withBuffer, 500);
});

test("capacity lower than minimums never creates negative extra", () => {
  const planning = representativePlanning();
  planning.capacity.monthlyAmount = 300;
  const result = buildOnboardingPlan(planning, calculationDate, completedAt);
  assert.equal(capacityToExtra(300, result.accounts), 0);
  assert.equal(result.extra, 0);
  assert.equal(result.plan.monthly, 425);
});

test("generated onboarding result exactly matches the Phase 2 engine", () => {
  const result = buildOnboardingPlan(representativePlanning(), calculationDate, completedAt);
  const direct = calculatePlan(result.accounts, result.extra, result.strategy, {}, {}, calculationDate);
  assert.deepEqual(result.plan, direct);
  assert.equal(result.strategy, "avalanche");
  assert.equal(result.firstTarget, "Alpha Card");
});

test("existing users bypass onboarding", () => {
  const existing = parseDashboardContract(fixture);
  assert.equal(shouldShowOnboarding(existing.payload), false);
});

test("legacy import bypasses onboarding without data loss", () => {
  const imported = parseDashboardContract(fixture);
  const { planning, ...legacyPayload } = imported.payload;
  assert.deepEqual(legacyPayload, fixture);
  assert.equal(planning.onboarding.completed, false);
  assert.equal(shouldShowOnboarding(imported.payload), false);
});

test("refresh resumes a partial onboarding draft from the versioned payload", () => {
  const empty = parseDashboardContract({
    accounts: [],
    monthlyBudgets: {},
    payees: [],
    transactions: [],
    snapshots: [],
    extra: 0,
    strategy: "avalanche",
  });
  const planning = representativePlanning();
  planning.onboarding = { completed: false, currentStep: 4, completedAt: null };
  const backup = createDashboardBackup({ ...empty.payload, planning }, empty, completedAt);
  const resumed = parseDashboardJson(serializeDashboardBackup(backup));
  assert.equal(resumed.payload.planning.onboarding.currentStep, 4);
  assert.equal(resumed.payload.planning.debts.length, 3);
  assert.equal(hasOnboardingProgress(resumed.payload.planning), true);
  assert.equal(shouldShowOnboarding(resumed.payload), true);
});

test("step validation reports accessible, field-specific guidance", () => {
  const planning = createOnboardingPlanning();
  const incomeIssues = onboardingStepIssues(2, planning);
  const debtIssues = onboardingStepIssues(3, planning);
  assert.ok(incomeIssues.some((issue) => issue.includes("Income source 1 needs a name")));
  assert.ok(incomeIssues.some((issue) => issue.includes("monthly take-home amount")));
  assert.ok(debtIssues.some((issue) => issue.includes("Debt 1 needs a name")));
  assert.ok(debtIssues.some((issue) => issue.includes("minimum monthly payment")));
});

test("onboarding UI exposes all required screens and semantic keyboard controls", async () => {
  const source = await readFile(new URL("../app/onboarding-flow.tsx", import.meta.url), "utf8");
  assert.match(source, /Build your household debt-payoff plan./);
  assert.match(source, /Start my payoff plan/);
  assert.match(source, /Import existing data/);
  assert.match(source, />Household income</);
  assert.match(source, />Add debts</);
  assert.match(source, />Monthly debt-payment capacity</);
  assert.match(source, />Your payoff plan is ready</);
  assert.match(source, /onSubmit={nextStep}/);
  assert.match(source, /type="submit"/);
  assert.match(source, /type="button"/);
  assert.match(source, /<details className="onboarding-advanced">/);
  assert.match(source, /role="alert"/);
  assert.match(source, /aria-live="assertive"/);
  assert.match(source, /errorRef\.current\?\.focus\(\)/);
});

test("phone onboarding prevents horizontal scrolling and stacks form grids", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /.onboarding-shell{[^}]*overflow-x:hidden/);
  assert.match(styles, /@media\s*\(max-width:560px\)/);
  assert.match(styles, /.onboarding-result-grid{grid-template-columns:minmax\(0,1fr\)}/);
  assert.match(styles, /.onboarding-row input,[^{]*{[^}]*font-size:16px/);
});

test("new planning starts with one income source and one debt row", () => {
  const planning = createOnboardingPlanning();
  assert.deepEqual(planning.incomeSources, [createIncomeSource("income-1")]);
  assert.deepEqual(planning.debts, [createPlannedDebt("debt-1")]);
  assert.equal(shouldShowOnboarding({
    accounts: [],
    monthlyBudgets: {},
    payees: [],
    transactions: [],
    snapshots: [],
    extra: 0,
    strategy: "avalanche",
    planning,
  }), true);
});
