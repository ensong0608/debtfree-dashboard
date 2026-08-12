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

export type LinkedCardExpenses = Record<string, number>;

export type PayoffPlan = {
  months: PlanMonth[];
  totalInterest: number;
  monthly: number;
  peakMonthly: number;
  stalled: boolean;
  nonAmortizingAccountIds: string[];
  promoMinimumFallbackIds: string[];
};

export const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function estimatedMinimum(balance: number, apr: number) {
  if (balance <= 0) return 0;
  const monthlyInterest = balance * apr / 1200;
  return Math.min(round(balance + monthlyInterest), Math.max(25, round(balance * 0.01 + monthlyInterest)));
}

export function effectiveMinimum(account: DebtAccount) {
  return account.balance <= 0 ? 0 : account.minimumMode === "auto" ? estimatedMinimum(account.balance, account.apr) : account.minimum;
}

export function projectedMonthlyRate(account: DebtAccount) {
  return account.interestFee > 0 && account.balance > 0 ? account.interestFee / account.balance : account.apr / 1200;
}

export function monthlyInterest(account: DebtAccount) {
  return round(account.balance * projectedMonthlyRate(account));
}

export function forecastMonthKey(month: number, calculationDate: Date = new Date()) {
  const date = new Date(calculationDate);
  date.setDate(1);
  date.setMonth(date.getMonth() + month - 1);
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

export function hasPromoTerms(account: DebtAccount) {
  return account.type === "Credit card" && Boolean(account.promoEndDate) && account.postPromoApr > 0;
}

export function promoIsActive(account: DebtAccount, month: number, calculationDate: Date = new Date()) {
  return hasPromoTerms(account) && forecastMonthKey(month, calculationDate) <= account.promoEndDate.slice(0, 7);
}

export function forecastApr(account: DebtAccount, month: number, calculationDate: Date = new Date()) {
  return hasPromoTerms(account) && !promoIsActive(account, month, calculationDate) ? account.postPromoApr : account.apr;
}

export function forecastMinimum(account: DebtAccount, balance: number, month: number, calculationDate: Date = new Date()) {
  if (balance <= 0) return 0;
  const currentMinimum = effectiveMinimum(account);
  const amount = hasPromoTerms(account) && !promoIsActive(account, month, calculationDate) && account.postPromoMinimum > 0
    ? account.postPromoMinimum
    : currentMinimum;
  return Math.min(balance, amount);
}

export function forecastMonthlyRate(account: DebtAccount, month: number, calculationDate: Date = new Date()) {
  if (hasPromoTerms(account) && !promoIsActive(account, month, calculationDate)) return account.postPromoApr / 1200;
  return projectedMonthlyRate(account);
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
): PayoffPlan {
  const active = accounts.filter((account) => account.balance > 0 || (linkedCardExpenses[account.id] ?? 0) > 0 || (linkedCardPurchases[account.id] ?? 0) > 0);
  const balances = new Map(active.map((account) => [account.id, account.balance]));
  const monthly = active.reduce((sum, account) => sum + effectiveMinimum(account) + (linkedCardExpenses[account.id] ?? 0), 0) + extra;
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
  if (monthly <= 0 && oneTimePurchaseTotal <= 0) return { ...emptyResult, stalled: true, nonAmortizingAccountIds: active.map((account) => account.id) };

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
      const charge = balance * forecastMonthlyRate(account, month, calculationDate);
      aprs[account.id] = apr;
      interestByAccount[account.id] = charge;
      balances.set(account.id, balance + charge);
      interest += charge;
    });
    totalInterest += interest;

    active.forEach((account) => {
      const cardCharge = cardChargeForMonth(account.id, month);
      if (cardCharge <= 0) return;
      balances.set(account.id, (balances.get(account.id) ?? 0) + cardCharge);
    });

    let requiredMinimumTotal = 0;
    active.forEach((account) => {
      const balance = balances.get(account.id) ?? 0;
      if (balance <= 0) return;
      const minimum = forecastMinimum(account, balance, month, calculationDate);
      minimums[account.id] = minimum;
      requiredMinimumTotal += minimum + cardChargeForMonth(account.id, month);
    });
    const plannedMonthly = monthly + (month === 1 ? oneTimePurchaseTotal : 0);
    const requiredMonthly = Math.max(plannedMonthly, round(requiredMinimumTotal));
    const minimumIncrease = round(Math.max(0, requiredMonthly - monthly));
    peakMonthly = Math.max(peakMonthly, requiredMonthly);
    let available = requiredMonthly;

    active.forEach((account) => {
      const balance = balances.get(account.id) ?? 0;
      const scheduledPayment = (minimums[account.id] ?? 0) + cardChargeForMonth(account.id, month);
      const payment = Math.min(scheduledPayment, balance, available);
      if (payment > 0) {
        balances.set(account.id, balance - payment);
        payments[account.id] = payment;
        available -= payment;
      }
    });

    const priority = [...active]
      .filter((account) => account.payoffMode !== "minimum-only" && (balances.get(account.id) ?? 0) > PAYOFF_BALANCE_EPSILON)
      .sort((a, b) => strategy === "custom"
        ? (a.customOrder ?? Number.MAX_SAFE_INTEGER) - (b.customOrder ?? Number.MAX_SAFE_INTEGER)
        : strategy === "avalanche"
          ? forecastApr(b, month, calculationDate) - forecastApr(a, month, calculationDate) || (balances.get(a.id) ?? 0) - (balances.get(b.id) ?? 0)
          : (balances.get(a.id) ?? 0) - (balances.get(b.id) ?? 0) || forecastApr(b, month, calculationDate) - forecastApr(a, month, calculationDate));
    priority.forEach((account) => {
      const balance = balances.get(account.id) ?? 0;
      const payment = Math.min(balance, available);
      if (payment > 0) {
        balances.set(account.id, balance - payment);
        payments[account.id] = (payments[account.id] ?? 0) + payment;
        available -= payment;
      }
    });

    const nonAmortizingAccountIds = active.filter((account) => {
      const starting = before.get(account.id) ?? 0;
      const ending = balances.get(account.id) ?? 0;
      if (starting <= 0 || ending <= PAYOFF_BALANCE_EPSILON) return false;
      const cost = (interestByAccount[account.id] ?? 0) + cardChargeForMonth(account.id, month);
      return (payments[account.id] ?? 0) <= cost + PAYOFF_BALANCE_EPSILON && ending >= starting - PAYOFF_BALANCE_EPSILON;
    }).map((account) => account.id);
    const remaining = [...balances.values()].reduce((sum, balance) => sum + balance, 0);
    const paidOff = active.filter((account) => (before.get(account.id) ?? 0) > 0 && (balances.get(account.id) ?? 0) <= PAYOFF_BALANCE_EPSILON).map((account) => account.name);
    months.push({
      month,
      interest,
      paid: Object.values(payments).reduce((sum, payment) => sum + payment, 0),
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
    if (remaining <= PAYOFF_BALANCE_EPSILON) return { months, totalInterest, monthly, peakMonthly, stalled: false, nonAmortizingAccountIds: [], promoMinimumFallbackIds };
    const previousRemaining = [...before.values()].reduce((sum, balance) => sum + balance, 0);
    const hasPendingPromoChange = active.some((account) => promoIsActive(account, month, calculationDate));
    if (!paidOff.length && remaining >= previousRemaining - PAYOFF_BALANCE_EPSILON && !hasPendingPromoChange) {
      return { months, totalInterest, monthly, peakMonthly, stalled: true, nonAmortizingAccountIds, promoMinimumFallbackIds };
    }
  }
  const nonAmortizingAccountIds = active.filter((account) => (balances.get(account.id) ?? 0) > PAYOFF_BALANCE_EPSILON).map((account) => account.id);
  return { months, totalInterest, monthly, peakMonthly, stalled: true, nonAmortizingAccountIds, promoMinimumFallbackIds };
}
