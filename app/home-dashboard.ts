import type { DebtAccount, PayoffSnapshot, PayoffStrategy, PlannedPayoffData } from "./dashboard-data.ts";
import { effectiveMinimum, forecastMonthKey, round, type PayoffPlan } from "./payoff-engine.ts";

export type HomeActionKind = "due" | "promo" | "warning" | "review";

export type HomeAction = {
  id: string;
  kind: HomeActionKind;
  title: string;
  detail: string;
  date?: string;
};

export type HomePayoffItem = {
  accountId: string;
  name: string;
  balance: number;
  apr: number;
  payment: number;
  projectedPayoffMonth: string | null;
};

export type HomePayment = HomePayoffItem & {
  minimum: number;
  aboveMinimum: number;
  dueDate: string | null;
};

export type HomeDashboardModel = {
  totalDebt: number;
  startingDebt: number;
  amountPaid: number;
  progressPercent: number;
  progressLabel: string;
  monthlyTarget: number;
  extraPayment: number;
  debtFreeMonth: string | null;
  estimatedInterest: number;
  activeDebtCount: number;
  stalled: boolean;
  strategy: PayoffStrategy;
  nextPayment: HomePayment | null;
  payoffOrder: HomePayoffItem[];
  actions: HomeAction[];
};

type HomeDashboardInput = {
  accounts: DebtAccount[];
  openingAccounts: DebtAccount[];
  plan: PayoffPlan;
  extra: number;
  strategy: PayoffStrategy;
  planning: PlannedPayoffData;
  snapshots: PayoffSnapshot[];
  calculationDate?: Date;
};

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function currentMonthKey(date: Date) {
  return localDateKey(date).slice(0, 7);
}

function nextMonthlyDate(value: string, calculationDate: Date) {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  const day = Math.max(1, Math.min(31, parts[2]));
  let year = calculationDate.getFullYear();
  let month = calculationDate.getMonth();
  const occurrence = () => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(day, lastDay), 12);
  };
  let next = occurrence();
  if (localDateKey(next) < localDateKey(calculationDate)) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
    next = occurrence();
  }
  return localDateKey(next);
}

function projectedPayoffMonth(plan: PayoffPlan, accountId: string, calculationDate: Date) {
  const month = plan.months.find((entry) => (entry.balances[accountId] ?? 0) <= 0.005)?.month;
  return month ? forecastMonthKey(month, calculationDate) : null;
}

function startingDebt(input: HomeDashboardInput, currentDebt: number) {
  const planned = input.planning.onboarding.completed
    ? input.planning.debts.reduce((sum, debt) => sum + debt.balance, 0)
    : 0;
  if (planned > 0) return { amount: round(planned), label: "Since your payoff plan began" };
  const firstSnapshot = [...input.snapshots].sort((a, b) => a.month.localeCompare(b.month))[0];
  if (firstSnapshot?.totalBalance > 0) return { amount: round(firstSnapshot.totalBalance), label: "Since your first saved snapshot" };
  const opening = input.openingAccounts.reduce((sum, account) => sum + account.balance, 0);
  return { amount: round(opening > 0 ? opening : currentDebt), label: "Since these balances were added" };
}

function payoffPriority(accounts: DebtAccount[], plan: PayoffPlan, strategy: PayoffStrategy) {
  const firstMonth = plan.months[0];
  return accounts
    .filter((account) => account.balance > 0 && account.payoffMode !== "minimum-only")
    .sort((a, b) => strategy === "avalanche"
      ? (firstMonth?.aprs[b.id] ?? b.apr) - (firstMonth?.aprs[a.id] ?? a.apr) || a.balance - b.balance || a.name.localeCompare(b.name)
      : a.balance - b.balance || (firstMonth?.aprs[b.id] ?? b.apr) - (firstMonth?.aprs[a.id] ?? a.apr) || a.name.localeCompare(b.name));
}

function upcomingActions(accounts: DebtAccount[], snapshots: PayoffSnapshot[], calculationDate: Date) {
  const actions: HomeAction[] = [];
  const currentMonth = currentMonthKey(calculationDate);
  const dueDates = accounts
    .filter((account) => account.balance > 0 && account.dueDate)
    .map((account) => ({ account, date: nextMonthlyDate(account.dueDate, calculationDate) }))
    .filter((entry): entry is { account: DebtAccount; date: string } => Boolean(entry.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 2);
  dueDates.forEach(({ account, date }) => actions.push({
    id: `due-${account.id}`,
    kind: "due",
    title: `${account.name} payment is coming up`,
    detail: `${effectiveMinimum(account).toFixed(2)} minimum payment`,
    date,
  }));

  accounts
    .filter((account) => account.balance > 0 && account.promoEndDate && account.promoEndDate >= localDateKey(calculationDate))
    .sort((a, b) => a.promoEndDate.localeCompare(b.promoEndDate))
    .slice(0, 2)
    .forEach((account) => actions.push({
      id: `promo-${account.id}`,
      kind: "promo",
      title: `${account.name} promotional rate expires`,
      detail: account.postPromoApr > 0 ? `APR changes to ${account.postPromoApr.toFixed(2)}%` : "Add the post-promotional APR for an accurate projection",
      date: account.promoEndDate,
    }));

  const missingDueDates = accounts.filter((account) => account.balance > 0 && !account.dueDate);
  if (missingDueDates.length) actions.push({
    id: "missing-due-dates",
    kind: "warning",
    title: `${missingDueDates.length} ${missingDueDates.length === 1 ? "debt is" : "debts are"} missing a due date`,
    detail: "Add due dates to make the next-payment guidance more useful.",
  });
  const missingPromoApr = accounts.filter((account) => account.balance > 0 && account.promoEndDate && account.postPromoApr <= 0);
  if (missingPromoApr.length) actions.push({
    id: "missing-promo-apr",
    kind: "warning",
    title: "A post-promotional APR is missing",
    detail: "Your payoff projection may be inaccurate after the promotional period ends.",
  });
  if (!snapshots.some((snapshot) => snapshot.month === currentMonth)) actions.push({
    id: "monthly-review",
    kind: "review",
    title: "Save this month’s progress review",
    detail: "Capture a snapshot after balances and payments are up to date.",
  });
  return actions.slice(0, 6);
}

export function buildHomeDashboard(input: HomeDashboardInput): HomeDashboardModel {
  const calculationDate = input.calculationDate ?? new Date();
  const active = input.accounts.filter((account) => account.balance > 0);
  const totalDebt = round(active.reduce((sum, account) => sum + account.balance, 0));
  const baseline = startingDebt(input, totalDebt);
  const amountPaid = round(Math.max(0, baseline.amount - totalDebt));
  const progressPercent = baseline.amount > 0 ? Math.min(100, round(amountPaid / baseline.amount * 100)) : 0;
  const firstMonth = input.plan.months[0];
  const priority = payoffPriority(active, input.plan, input.strategy);
  const payoffOrder = priority.slice(0, 3).map<HomePayoffItem>((account) => ({
    accountId: account.id,
    name: account.name,
    balance: account.balance,
    apr: firstMonth?.aprs[account.id] ?? account.apr,
    payment: round(firstMonth?.payments[account.id] ?? effectiveMinimum(account)),
    projectedPayoffMonth: projectedPayoffMonth(input.plan, account.id, calculationDate),
  }));
  const focus = priority[0];
  const minimum = focus ? round(firstMonth?.minimums[focus.id] ?? effectiveMinimum(focus)) : 0;
  const payment = focus ? round(firstMonth?.payments[focus.id] ?? minimum) : 0;
  const nextPayment = focus ? {
    ...payoffOrder.find((item) => item.accountId === focus.id) ?? {
      accountId: focus.id,
      name: focus.name,
      balance: focus.balance,
      apr: firstMonth?.aprs[focus.id] ?? focus.apr,
      payment,
      projectedPayoffMonth: projectedPayoffMonth(input.plan, focus.id, calculationDate),
    },
    payment,
    minimum,
    aboveMinimum: round(Math.max(0, payment - minimum)),
    dueDate: nextMonthlyDate(focus.dueDate, calculationDate),
  } satisfies HomePayment : null;

  return {
    totalDebt,
    startingDebt: baseline.amount,
    amountPaid,
    progressPercent,
    progressLabel: baseline.label,
    monthlyTarget: round(input.plan.monthly),
    extraPayment: round(input.extra),
    debtFreeMonth: input.plan.months.length && !input.plan.stalled ? forecastMonthKey(input.plan.months.length, calculationDate) : null,
    estimatedInterest: round(input.plan.totalInterest),
    activeDebtCount: active.length,
    stalled: input.plan.stalled,
    strategy: input.strategy,
    nextPayment,
    payoffOrder,
    actions: upcomingActions(active, input.snapshots, calculationDate),
  };
}
