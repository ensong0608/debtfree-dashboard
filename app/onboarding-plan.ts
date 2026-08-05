import {
  createEmptyPlannedPayoff,
  type DashboardPayload,
  type DebtAccount,
  type PlannedDebt,
  type PlannedEssentialExpenses,
  type PlannedIncomeSource,
  type PlannedPayoffData,
  type PayoffStrategy,
} from "./dashboard-data.ts";
import { calculatePlan, effectiveMinimum, round, type PayoffPlan } from "./payoff-engine.ts";

export const ONBOARDING_STEP_COUNT = 5;
export const RECOMMENDED_ONBOARDING_STRATEGY: PayoffStrategy = "avalanche";

export type OnboardingTotals = {
  income: number;
  debt: number;
  minimums: number;
  weightedApr: number;
  essentialExpenses: number;
  recommendedCapacity: number;
};

export type GeneratedOnboardingPlan = {
  accounts: DebtAccount[];
  planning: PlannedPayoffData;
  strategy: PayoffStrategy;
  extra: number;
  plan: PayoffPlan;
  totals: OnboardingTotals;
  firstTarget: string | null;
  debtFreeMonth: string | null;
};

export function createIncomeSource(id: string): PlannedIncomeSource {
  return { id, name: "", monthlyTakeHome: 0, assignment: "household" };
}

export function createPlannedDebt(id: string): PlannedDebt {
  return {
    id,
    name: "",
    balance: 0,
    apr: 0,
    minimum: 0,
    dueDate: "",
    creditLimit: 0,
    promoEndDate: "",
    postPromoApr: 0,
    postPromoMinimum: 0,
    type: "Credit card",
    assignment: "household",
    payoffMode: "priority",
  };
}

export function createOnboardingPlanning(): PlannedPayoffData {
  return {
    ...createEmptyPlannedPayoff(),
    incomeSources: [createIncomeSource("income-1")],
    debts: [createPlannedDebt("debt-1")],
  };
}

export function totalPlannedIncome(sources: PlannedIncomeSource[]) {
  return round(sources.reduce((sum, source) => sum + source.monthlyTakeHome, 0));
}

export function totalPlannedExpenses(expenses: PlannedEssentialExpenses) {
  return round(
    expenses.housing
    + expenses.utilities
    + expenses.food
    + expenses.transportation
    + expenses.insurance
    + expenses.subscriptions
    + expenses.otherObligations,
  );
}

export function debtTotals(debts: PlannedDebt[]) {
  const debt = round(debts.reduce((sum, item) => sum + item.balance, 0));
  const minimums = round(debts.reduce((sum, item) => sum + item.minimum, 0));
  const weightedApr = debt > 0
    ? round(debts.reduce((sum, item) => sum + item.balance * item.apr, 0) / debt)
    : 0;
  return { debt, minimums, weightedApr };
}

export function recommendedDebtCapacity(income: number, expenses: PlannedEssentialExpenses) {
  return Math.max(0, round(income - totalPlannedExpenses(expenses) - expenses.safetyBuffer));
}

export function capacityToExtra(capacity: number, accounts: DebtAccount[]) {
  const minimums = accounts.reduce((sum, account) => sum + effectiveMinimum(account), 0);
  return Math.max(0, round(capacity - minimums));
}

export function plannedDebtsToAccounts(debts: PlannedDebt[], createdAt: string): DebtAccount[] {
  return debts.map((debt) => ({
    id: debt.id,
    name: debt.name.trim(),
    type: debt.type,
    balance: debt.balance,
    apr: debt.apr,
    interestFee: 0,
    minimum: debt.minimum,
    minimumMode: "manual",
    payoffMode: debt.payoffMode,
    creditLimit: debt.creditLimit,
    dueDate: debt.dueDate,
    promoEndDate: debt.promoEndDate,
    postPromoApr: debt.postPromoApr,
    postPromoMinimum: debt.postPromoMinimum,
    householdMember: debt.assignment,
    createdAt,
  }));
}

export function forecastMonthKey(month: number, calculationDate: Date) {
  const date = new Date(calculationDate);
  date.setDate(1);
  date.setMonth(date.getMonth() + month - 1);
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

export function buildOnboardingPlan(
  planning: PlannedPayoffData,
  calculationDate: Date = new Date(),
  completedAt = new Date().toISOString(),
): GeneratedOnboardingPlan {
  const accounts = plannedDebtsToAccounts(planning.debts, completedAt);
  const extra = capacityToExtra(planning.capacity.monthlyAmount, accounts);
  const strategy = RECOMMENDED_ONBOARDING_STRATEGY;
  const plan = calculatePlan(accounts, extra, strategy, {}, {}, calculationDate);
  const debtSummary = debtTotals(planning.debts);
  const income = totalPlannedIncome(planning.incomeSources);
  const essentialExpenses = totalPlannedExpenses(planning.essentialExpenses);
  const firstTarget = [...accounts]
    .filter((account) => account.balance > 0 && account.payoffMode !== "minimum-only")
    .sort((a, b) => b.apr - a.apr || a.balance - b.balance)[0]?.name ?? null;
  return {
    accounts,
    planning: {
      ...planning,
      onboarding: { ...planning.onboarding, completed: true, currentStep: 5, completedAt },
    },
    strategy,
    extra,
    plan,
    totals: {
      ...debtSummary,
      income,
      essentialExpenses,
      recommendedCapacity: recommendedDebtCapacity(income, planning.essentialExpenses),
    },
    firstTarget,
    debtFreeMonth: plan.stalled || !plan.months.length ? null : forecastMonthKey(plan.months.length, calculationDate),
  };
}

export function onboardingStepIssues(step: number, planning: PlannedPayoffData) {
  const issues: string[] = [];
  if (step === 2) {
    if (!planning.incomeSources.length) issues.push("Add at least one monthly income source.");
    planning.incomeSources.forEach((source, index) => {
      if (!source.name.trim()) issues.push("Income source " + (index + 1) + " needs a name.");
      if (source.monthlyTakeHome <= 0) issues.push("Income source " + (index + 1) + " needs a monthly take-home amount greater than zero.");
    });
  }
  if (step === 3) {
    if (!planning.debts.length) issues.push("Add at least one debt.");
    planning.debts.forEach((debt, index) => {
      if (!debt.name.trim()) issues.push("Debt " + (index + 1) + " needs a name.");
      if (debt.balance <= 0) issues.push("Debt " + (index + 1) + " needs a current balance greater than zero.");
      if (debt.minimum <= 0) issues.push("Debt " + (index + 1) + " needs a minimum monthly payment greater than zero.");
    });
  }
  if (step === 4 && planning.capacity.monthlyAmount <= 0) issues.push("Enter a monthly debt-payment amount greater than zero.");
  return issues;
}

export function hasEstablishedDashboardData(payload: DashboardPayload) {
  return payload.accounts.length > 0
    || Object.values(payload.monthlyBudgets).some((items) => items.length > 0)
    || payload.payees.length > 0
    || payload.transactions.length > 0
    || payload.snapshots.length > 0
    || payload.extra > 0;
}

export function hasOnboardingProgress(planning: PlannedPayoffData) {
  return planning.onboarding.currentStep > 1
    || planning.incomeSources.some((source) => Boolean(source.name.trim()) || source.monthlyTakeHome > 0)
    || planning.debts.some((debt) => Boolean(debt.name.trim()) || debt.balance > 0 || debt.minimum > 0)
    || planning.capacity.monthlyAmount > 0;
}

export function shouldShowOnboarding(payload: DashboardPayload) {
  return !payload.planning.onboarding.completed && !hasEstablishedDashboardData(payload);
}
