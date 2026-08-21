import type { DebtAccount, PayoffStrategy } from "./dashboard-data.ts";
import { payoffPriority } from "./debts-screen.ts";
import { calculatePlan, effectiveForecastApr, forecastMonthKey, round, type LinkedCardExpenses, type PayoffPlan, type PlanMonth } from "./payoff-engine.ts";

export const DEFAULT_SCHEDULE_PREVIEW_MONTHS = 3;

export type StrategyComparison = {
  strategy: PayoffStrategy;
  plan: PayoffPlan;
  firstTarget: string;
  interestDifference: number;
  monthDifference: number | null;
};

export type PayoffScheduleRow = {
  month: PlanMonth;
  focusDebt: string;
  minimumPayments: number;
  extraPayment: number;
  totalPaid: number;
  interest: number;
  endingBalance: number;
};

export type PaymentWhatIf = {
  additionalMonthly: number;
  totalExtra: number;
  plan: PayoffPlan;
  monthsSaved: number | null;
  interestSaved: number | null;
};

function deterministicAccountOrder(a: DebtAccount, b: DebtAccount) {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

export function normalizeCustomDebtOrder(accounts: DebtAccount[], savedOrder: string[] = []) {
  const ids = new Set(accounts.map((account) => account.id));
  const seen = new Set<string>();
  const normalized = savedOrder.filter((id) => ids.has(id) && !seen.has(id) && Boolean(seen.add(id)));
  const missing = accounts.filter((account) => !seen.has(account.id)).sort(deterministicAccountOrder);
  return [...normalized, ...missing.map((account) => account.id)];
}

export function accountsWithCustomDebtOrder(accounts: DebtAccount[], savedOrder: string[] = []) {
  const order = normalizeCustomDebtOrder(accounts, savedOrder);
  const positions = new Map(order.map((id, index) => [id, index]));
  return accounts.map((account) => ({ ...account, customOrder: positions.get(account.id) ?? Number.MAX_SAFE_INTEGER }));
}

export function mergeVisibleCustomDebtOrder(accounts: DebtAccount[], savedOrder: string[], visibleOrder: string[]) {
  const normalized = normalizeCustomDebtOrder(accounts, savedOrder);
  const visible = new Set(visibleOrder);
  let nextVisible = 0;
  return normalized.map((id) => visible.has(id) ? visibleOrder[nextVisible++] : id);
}

export function visibleCustomDebtOrder(accounts: DebtAccount[], savedOrder: string[] = []) {
  return payoffPriority(accountsWithCustomDebtOrder(accounts, savedOrder), "custom");
}

export function buildStrategyComparison(
  accounts: DebtAccount[],
  extra: number,
  customDebtOrder: string[],
  linkedCardExpenses: LinkedCardExpenses = {},
  linkedCardPurchases: LinkedCardExpenses = {},
  calculationDate: Date = new Date(),
  actualizedLinkedCardExpenses: LinkedCardExpenses = {},
) {
  const orderedAccounts = accountsWithCustomDebtOrder(accounts, customDebtOrder);
  const strategies: PayoffStrategy[] = ["avalanche", "snowball"];
  if (customDebtOrder.length > 0) strategies.push("custom");
  const results = strategies.map((strategy) => {
    const plan = calculatePlan(orderedAccounts, extra, strategy, linkedCardExpenses, linkedCardPurchases, calculationDate, actualizedLinkedCardExpenses);
    const effectiveAprs = Object.fromEntries(orderedAccounts.map((account) => [account.id, effectiveForecastApr(account, 1, calculationDate)]));
    return {
      strategy,
      plan,
      firstTarget: payoffPriority(orderedAccounts, strategy, effectiveAprs)[0]?.name ?? "No priority debt",
    };
  });
  const avalanche = results.find((item) => item.strategy === "avalanche")!;
  const snowball = results.find((item) => item.strategy === "snowball")!;
  const recommended = avalanche.plan.totalInterest <= snowball.plan.totalInterest ? avalanche : snowball;
  const comparisons: StrategyComparison[] = results.map((item) => ({
    ...item,
    interestDifference: round(item.plan.totalInterest - recommended.plan.totalInterest),
    monthDifference: item.plan.stalled || recommended.plan.stalled ? null : item.plan.months.length - recommended.plan.months.length,
  }));
  const alternative = recommended.strategy === "avalanche" ? snowball : avalanche;
  return {
    comparisons,
    recommendedStrategy: recommended.strategy as Exclude<PayoffStrategy, "custom">,
    alternativeStrategy: alternative.strategy as Exclude<PayoffStrategy, "custom">,
    projectedSavings: round(Math.max(0, alternative.plan.totalInterest - recommended.plan.totalInterest)),
  };
}

export function buildPaymentWhatIf(
  accounts: DebtAccount[],
  savedExtra: number,
  additionalMonthly: number,
  strategy: PayoffStrategy,
  customDebtOrder: string[] = [],
  linkedCardExpenses: LinkedCardExpenses = {},
  linkedCardPurchases: LinkedCardExpenses = {},
  calculationDate: Date = new Date(),
  actualizedLinkedCardExpenses: LinkedCardExpenses = {},
): PaymentWhatIf {
  const ordered = strategy === "custom" ? accountsWithCustomDebtOrder(accounts, customDebtOrder) : accounts;
  const baseline = calculatePlan(ordered, savedExtra, strategy, linkedCardExpenses, linkedCardPurchases, calculationDate, actualizedLinkedCardExpenses);
  const increase = Math.max(0, round(additionalMonthly));
  const totalExtra = round(Math.max(0, savedExtra) + increase);
  const plan = calculatePlan(ordered, totalExtra, strategy, linkedCardExpenses, linkedCardPurchases, calculationDate, actualizedLinkedCardExpenses);
  return {
    additionalMonthly: increase,
    totalExtra,
    plan,
    monthsSaved: baseline.stalled || plan.stalled ? null : Math.max(0, baseline.months.length - plan.months.length),
    interestSaved: baseline.stalled || plan.stalled ? null : round(Math.max(0, baseline.totalInterest - plan.totalInterest)),
  };
}

export function buildPayoffScheduleRows(
  accounts: DebtAccount[],
  plan: PayoffPlan,
  linkedCardExpenses: LinkedCardExpenses = {},
  linkedCardPurchases: LinkedCardExpenses = {},
  actualizedLinkedCardExpenses: LinkedCardExpenses = {},
) {
  const planAccounts = accounts.filter((account) => account.balance > 0 || (linkedCardExpenses[account.id] ?? 0) > 0 || (linkedCardPurchases[account.id] ?? 0) > 0);
  return plan.months.map<PayoffScheduleRow>((month) => {
    let minimumPayments = 0;
    let extraPayment = 0;
    const focusDebts: string[] = [];
    planAccounts.forEach((account) => {
      const payment = month.payments[account.id] ?? 0;
      const cardCharges = Math.max(0, (linkedCardExpenses[account.id] ?? 0)
        + (month.month === 1 ? linkedCardPurchases[account.id] ?? 0 : 0)
        - (month.month === 1 ? actualizedLinkedCardExpenses[account.id] ?? 0 : 0));
      const minimum = month.minimums[account.id] ?? 0;
      const scheduled = minimum + cardCharges;
      minimumPayments += Math.min(payment, minimum);
      const accountExtra = Math.max(0, payment - scheduled);
      extraPayment += accountExtra;
      if (accountExtra > .005) focusDebts.push(account.name);
    });
    return {
      month,
      focusDebt: focusDebts.length ? focusDebts.join(", ") : "Minimums only",
      minimumPayments: round(minimumPayments),
      extraPayment: round(extraPayment),
      totalPaid: round(month.paid),
      interest: round(month.interest),
      endingBalance: round(month.remaining),
    };
  });
}

export function payoffCalculationWarnings(accounts: DebtAccount[], plan: PayoffPlan, calculationDate: Date = new Date()) {
  const warnings: string[] = [];
  const missingMinimums = accounts.filter((account) => !account.archivedAt && account.balance > 0 && account.minimumMode === "manual" && account.minimum <= 0).map((account) => account.name);
  const missingPostPromo = accounts.filter((account) => !account.archivedAt && account.balance > 0 && account.promoEndDate && account.postPromoApr <= 0).map((account) => account.name);
  if (missingMinimums.length) warnings.push(`Missing minimum payment: ${missingMinimums.join(", ")}.`);
  if (missingPostPromo.length) warnings.push(`Your payoff projection may be inaccurate because the APR after the promotional period is missing. Add it for: ${missingPostPromo.join(", ")}.`);
  if (plan.promoMinimumFallbackIds.length) {
    const names = accounts.filter((account) => plan.promoMinimumFallbackIds.includes(account.id)).map((account) => account.name);
    warnings.push(`Post-promotion minimum not entered; the current minimum continues for ${names.join(", ")}.`);
  }
  if (plan.stalled) warnings.push("The current payment assumptions do not produce a complete payoff date.");
  accounts.filter((account) => !account.archivedAt && account.balance > 0 && account.promoEndDate && account.postPromoApr > 0).forEach((account) => {
    const promoMonth = account.promoEndDate.slice(0, 7);
    const lastPromoMonth = plan.months.findLast((entry) => forecastMonthKey(entry.month, calculationDate) <= promoMonth);
    const remaining = lastPromoMonth?.balances[account.id] ?? account.balance;
    if (remaining > .005) warnings.push(`${account.name} is projected to have ${round(remaining).toFixed(2)} remaining when its promotional APR expires.`);
  });
  return warnings;
}
