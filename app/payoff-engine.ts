import { householdDate, householdMonthOffset } from "./household-date.ts";
import type { DebtAccount, PayoffStrategy } from "./dashboard-data";

export const PAYOFF_PLAN_MONTH_LIMIT = 1200;
export const PAYOFF_BALANCE_EPSILON = 0.005;

export type PlanMonth = {
  month: number;
  interest: number;
  paid: number;
  remaining: number;
  requiredMonthly: number;
  minimumIncrease: number;
  payments: Record<string, number>;
  minimums: Record<string, number>;
  aprs: Record<string, number>;
  balances: Record<string, number>;
  paidOff: string[];
  nonAmortizingAccountIds: string[];
};

export type PlanContext = { monthlyCommitment?: number; paymentCap?: number; paid?: Record<string, number>; minimumPaid?: Record<string, number>; minimumTargets?: Record<string, number>; reserveMinimums?: boolean };

export type LinkedCardExpenses = Record<string, number>;

export type PayoffPlan = {
  monthLimitReached?: boolean;
  paymentsAlreadyApplied?: boolean;
  months: PlanMonth[];
  totalInterest: number;
  monthly: number;
  peakMonthly: number;
  stalled: boolean;
  nonAmortizingAccountIds: string[];
  promoMinimumFallbackIds: string[];
};

export const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Generic credit-card estimate. balance excludes this cycle's new interest. */
export function estimatedMinimum(balance: number, apr: number, monthlyInterest = round(balance * apr / 1200)) {
  if (balance <= 0) return 0;
  return Math.min(round(balance + monthlyInterest), Math.max(25, round(balance * 0.01 + monthlyInterest)));
}

export function effectiveMinimum(account: DebtAccount, calculationDate = new Date()) {
  return account.balance <= 0 ? 0 : account.minimumMode === "auto" && account.type === "Credit card" ? estimatedMinimum(account.balance, forecastApr(account, 1, calculationDate)) : account.minimum;
}

export function projectedMonthlyRate(account: DebtAccount) {
  return account.apr / 1200;
}

export function monthlyInterest(account: DebtAccount, calculationDate = new Date()) {
  return round(account.balance * forecastMonthlyRate(account, 1, calculationDate));
}

export function forecastMonthKey(month: number, calculationDate: Date = new Date()) {
  return householdMonthOffset(month - 1, calculationDate);
}

export function hasPromoTerms(account: DebtAccount) {
  return account.type === "Credit card" && Boolean(account.promoEndDate) && account.postPromoApr > 0;
}

export function promoIsActive(account: DebtAccount, month: number, calculationDate: Date = new Date()) {
  const day = Number(householdDate(calculationDate).slice(8));
  const monthKey = forecastMonthKey(month, calculationDate);
  const [year, value] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, value, 0)).getUTCDate();
  const dateKey = monthKey + "-" + String(Math.min(day, lastDay)).padStart(2, "0");
  return hasPromoTerms(account) && dateKey <= account.promoEndDate;
}

export function forecastApr(account: DebtAccount, month: number, calculationDate: Date = new Date()) {
  return hasPromoTerms(account) && !promoIsActive(account, month, calculationDate) ? account.postPromoApr : account.apr;
}

/** balance is BEFORE new interest; callers may supply that cycle's already computed charge. */
export function forecastMinimum(account: DebtAccount, balance: number, month: number, calculationDate: Date = new Date(), interest = round(balance * forecastMonthlyRate(account, month, calculationDate))) {
  if (balance + interest <= 0) return 0;
  const established = month === 1 ? account.minimumCycles?.find(cycle => cycle.date.slice(0, 7) === forecastMonthKey(month, calculationDate))?.amount : undefined;
  const amount = established ?? (hasPromoTerms(account) && !promoIsActive(account, month, calculationDate) && account.postPromoMinimum > 0
    ? account.postPromoMinimum
    : account.minimumMode === "auto" && account.type === "Credit card"
      ? estimatedMinimum(balance, forecastApr(account, month, calculationDate), interest)
      : account.minimum);
  return Math.min(round(balance + interest), amount);
}

export function forecastMonthlyRate(account: DebtAccount, month: number, calculationDate: Date = new Date()) {
  if (hasPromoTerms(account) && !promoIsActive(account, month, calculationDate)) return account.postPromoApr / 1200;
  return projectedMonthlyRate(account);
}

export function effectiveForecastApr(account: DebtAccount, month: number, calculationDate: Date = new Date()) {
  return forecastMonthlyRate(account, month, calculationDate) * 1200;
}

export function individualPayoffMonths(account: DebtAccount, calculationDate: Date = new Date()) {
  if (account.balance <= 0) return 0;
  const result = calculatePlan([account], 0, "avalanche", {}, {}, calculationDate);
  return result.stalled ? null : result.months.length;
}

export function calculatePlan(
  accounts: DebtAccount[],
  extra: number,
  strategy: PayoffStrategy,
  linkedCardExpenses: LinkedCardExpenses = {},
  linkedCardPurchases: LinkedCardExpenses = {},
  calculationDate: Date = new Date(),
  actualizedLinkedCardExpenses: LinkedCardExpenses = {},
  context: PlanContext = {},
): PayoffPlan {
  // Legacy saved custom settings remain readable; current forecasts use avalanche.
  if (strategy === "custom") strategy = "avalanche";
  if (strategy !== "avalanche" && strategy !== "snowball") throw new Error("Choose avalanche or snowball.");
  if (!Number.isFinite(extra) || extra < 0 || (context.monthlyCommitment !== undefined && (!Number.isFinite(context.monthlyCommitment) || context.monthlyCommitment < 0))) throw new Error("Enter a valid monthly amount.");
  const reserveMinimums = context.reserveMinimums !== false;
  const active = accounts.filter((account) => !account.archivedAt && (account.balance > 0 || (linkedCardExpenses[account.id] ?? 0) > 0 || (linkedCardPurchases[account.id] ?? 0) > 0));
  const balances = new Map(active.map((account) => [account.id, round(account.balance)]));
  const monthly = round(context.monthlyCommitment ?? active.reduce((sum, account) => sum + effectiveMinimum(account, calculationDate) + (linkedCardExpenses[account.id] ?? 0), 0) + extra);
  const paidThisMonth = Object.values(context.paid ?? {}).reduce((sum, value) => sum + value, 0);
  const oneTimePurchaseTotal = active.reduce((sum, account) => sum + (linkedCardPurchases[account.id] ?? 0), 0);
  const cardChargeForMonth = (accountId: string, month: number) => (
    Math.max(0, (linkedCardExpenses[accountId] ?? 0)
      + (month === 1 ? (linkedCardPurchases[accountId] ?? 0) : 0)
      - (month === 1 ? (actualizedLinkedCardExpenses[accountId] ?? 0) : 0))
  );
  const months: PlanMonth[] = [];
  let totalInterest = 0;
  let peakMonthly = monthly;
  const promoMinimumFallbackIds = active.filter((account) => hasPromoTerms(account) && account.postPromoMinimum <= 0).map((account) => account.id);
  const emptyResult = { months, totalInterest, monthly, peakMonthly, stalled: false, nonAmortizingAccountIds: [] as string[], promoMinimumFallbackIds };
  if (!active.length) return emptyResult;
  if (monthly <= 0 && oneTimePurchaseTotal <= 0 && (!reserveMinimums || context.paymentCap === undefined)) return { ...emptyResult, stalled: true, nonAmortizingAccountIds: active.map((account) => account.id) };

  for (let month = 1; month <= PAYOFF_PLAN_MONTH_LIMIT; month++) {
    const before = new Map(balances);
    const payments: Record<string, number> = {};
    const minimums: Record<string, number> = {};
    const aprs: Record<string, number> = {};
    const interestByAccount: Record<string, number> = {};
    let interest = 0;

    active.forEach((account) => {
      const balance = balances.get(account.id) ?? 0;
      if (balance <= 0) return;
      const apr = forecastApr(account, month, calculationDate);
      const charge = round(balance * forecastMonthlyRate(account, month, calculationDate));
      aprs[account.id] = apr;
      interestByAccount[account.id] = charge;
      balances.set(account.id, round(balance + charge));
      interest = round(interest + charge);
    });
    totalInterest = round(totalInterest + interest);

    active.forEach((account) => {
      const cardCharge = cardChargeForMonth(account.id, month);
      if (cardCharge <= 0) return;
      balances.set(account.id, round((balances.get(account.id) ?? 0) + cardCharge));
    });

    let requiredMinimumTotal = 0;
    active.forEach((account) => {
      const balance = balances.get(account.id) ?? 0;
      if (balance <= 0) return;
      const established = month === 1 ? context.minimumTargets?.[account.id] ?? account.minimumCycles?.find(cycle => cycle.date.slice(0,7) === forecastMonthKey(1,calculationDate))?.amount : undefined;
      const target = established ?? forecastMinimum(account, before.get(account.id) ?? 0, month, calculationDate, interestByAccount[account.id] ?? 0);
      // Subtract paid amounts from the original obligation before capping the actual payment to debt owed.
      const minimum = reserveMinimums ? round(Math.max(0, target - (month === 1 ? context.minimumPaid?.[account.id] ?? 0 : 0))) : 0;
      minimums[account.id] = minimum;
      requiredMinimumTotal += (context.paymentCap === undefined ? minimum : Math.min(minimum, balance)) + cardChargeForMonth(account.id, month);
    });
    const plannedMonthly = round(Math.max(0, monthly + (month === 1 ? oneTimePurchaseTotal - paidThisMonth : 0)));
    if (context.paymentCap !== undefined && round(requiredMinimumTotal) > round(context.paymentCap)) throw new Error(`Enter at least $${round(requiredMinimumTotal).toFixed(2)} to cover minimums in ${forecastMonthKey(month, calculationDate)}.`);
    const requiredMonthly = context.paymentCap === undefined ? Math.max(plannedMonthly, round(requiredMinimumTotal)) : plannedMonthly;
    const minimumIncrease = round(Math.max(0, requiredMonthly - monthly));
    peakMonthly = Math.max(peakMonthly, requiredMonthly);
    let available = requiredMonthly;

    active.forEach((account) => {
      const balance = balances.get(account.id) ?? 0;
      const scheduledPayment = (minimums[account.id] ?? 0) + cardChargeForMonth(account.id, month);
      const payment = round(Math.min(scheduledPayment, balance, available));
      if (payment > 0) {
        balances.set(account.id, round(balance - payment));
        payments[account.id] = payment;
        available = round(available - payment);
      }
    });

    const priority = [...active]
      .filter((account) => account.payoffMode !== "minimum-only" && (balances.get(account.id) ?? 0) > PAYOFF_BALANCE_EPSILON)
      .sort((a, b) => strategy === "avalanche"
          ? effectiveForecastApr(b, month, calculationDate) - effectiveForecastApr(a, month, calculationDate) || (balances.get(a.id) ?? 0) - (balances.get(b.id) ?? 0)
          : (balances.get(a.id) ?? 0) - (balances.get(b.id) ?? 0) || effectiveForecastApr(b, month, calculationDate) - effectiveForecastApr(a, month, calculationDate));
    priority.forEach((account) => {
      const balance = balances.get(account.id) ?? 0;
      const payment = round(Math.min(balance, available));
      if (payment > 0) {
        balances.set(account.id, round(balance - payment));
        payments[account.id] = round((payments[account.id] ?? 0) + payment);
        available = round(available - payment);
      }
    });

    const nonAmortizingAccountIds = active.filter((account) => {
      const starting = before.get(account.id) ?? 0;
      const ending = balances.get(account.id) ?? 0;
      if (starting <= 0 || ending <= PAYOFF_BALANCE_EPSILON) return false;
      const cost = (interestByAccount[account.id] ?? 0) + cardChargeForMonth(account.id, month);
      return (payments[account.id] ?? 0) <= cost + PAYOFF_BALANCE_EPSILON && ending >= starting - PAYOFF_BALANCE_EPSILON;
    }).map((account) => account.id);
    const remaining = round([...balances.values()].reduce((sum, balance) => sum + balance, 0));
    const paidOff = active.filter((account) => (before.get(account.id) ?? 0) > 0 && (balances.get(account.id) ?? 0) <= PAYOFF_BALANCE_EPSILON).map((account) => account.name);
    months.push({
      month,
      interest,
      paid: round(Object.values(payments).reduce((sum, payment) => sum + payment, 0)),
      remaining,
      requiredMonthly,
      minimumIncrease,
      payments,
      minimums,
      aprs,
      balances: Object.fromEntries([...balances].map(([id, balance]) => [id, Math.max(0, round(balance))])),
      paidOff,
      nonAmortizingAccountIds,
    });
    if (remaining <= PAYOFF_BALANCE_EPSILON) return { paymentsAlreadyApplied: Boolean(context.paid), months, totalInterest, monthly, peakMonthly, stalled: false, nonAmortizingAccountIds: [], promoMinimumFallbackIds };
    const previousRemaining = [...before.values()].reduce((sum, balance) => sum + balance, 0);
    const hasPendingPromoChange = active.some((account) => promoIsActive(account, month, calculationDate));
    if (!(month === 1 && paidThisMonth > 0) && !paidOff.length && remaining >= previousRemaining - PAYOFF_BALANCE_EPSILON && !hasPendingPromoChange) {
      return { paymentsAlreadyApplied: Boolean(context.paid), months, totalInterest, monthly, peakMonthly, stalled: true, nonAmortizingAccountIds, promoMinimumFallbackIds };
    }
  }
  const nonAmortizingAccountIds = active.filter((account) => (balances.get(account.id) ?? 0) > PAYOFF_BALANCE_EPSILON).map((account) => account.id);
  return { monthLimitReached: true, paymentsAlreadyApplied: Boolean(context.paid), months, totalInterest, monthly, peakMonthly, stalled: true, nonAmortizingAccountIds, promoMinimumFallbackIds };
}

export function payoffOutcome(plan: Pick<PayoffPlan, "stalled" | "monthLimitReached" | "months">) {
  if (plan.monthLimitReached) return { title: `Beyond ${PAYOFF_PLAN_MONTH_LIMIT.toLocaleString("en-US")} months`, detail: "Payoff exceeds the projection limit." };
  if (plan.stalled) return { title: "No payoff at this amount", detail: "Increase the amount to outpace interest." };
  return { title: `${plan.months.length} months`, detail: "" };
}
