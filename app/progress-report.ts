import type { DebtAccount, LedgerTransaction, PayoffSnapshot } from "./dashboard-data.ts";
import { forecastMonthKey, round, type PayoffPlan } from "./payoff-engine.ts";
import { buildProgressBalanceView } from "./progress-balances.ts";

export type ProgressChartPoint = {
  label: string;
  month: string;
  actual: number | null;
  projected: number | null;
};

export type ProgressMilestone = {
  id: "first-payment" | "first-1000" | "first-debt" | "quarter" | "half" | "three-quarter" | "debt-free";
  label: string;
  status: "achieved" | "projected" | "pending";
  month: string | null;
};

type ProgressReportInput = {
  openingAccounts: DebtAccount[];
  transactions: LedgerTransaction[];
  snapshots: PayoffSnapshot[];
  currentPlan: PayoffPlan;
  minimumOnlyPlan: PayoffPlan;
  detailedSpendingTracking?: boolean;
  calculationDate?: Date;
};

function localMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthIndex(month: string) {
  const [year, value] = month.split("-").map(Number);
  return year * 12 + value - 1;
}

function monthDifference(previous: string | null, current: string | null) {
  if (!previous || !current) return null;
  return monthIndex(previous) - monthIndex(current);
}

function firstActualMonth(history: { month: string; total: number }[], threshold: number) {
  return history.find((entry) => entry.total <= threshold + .005)?.month ?? null;
}

function firstProjectedMonth(plan: PayoffPlan, threshold: number, calculationDate: Date) {
  const month = plan.months.find((entry) => entry.remaining <= threshold + .005)?.month;
  return month ? forecastMonthKey(month, calculationDate) : null;
}

function milestone(
  id: ProgressMilestone["id"],
  label: string,
  actualMonth: string | null,
  projectedMonth: string | null,
): ProgressMilestone {
  if (actualMonth) return { id, label, status: "achieved", month: actualMonth };
  if (projectedMonth) return { id, label, status: "projected", month: projectedMonth };
  return { id, label, status: "pending", month: null };
}

function chartSeries(
  history: { month: string; total: number }[],
  currentTotal: number,
  plan: PayoffPlan,
  calculationDate: Date,
) {
  const currentMonth = localMonthKey(calculationDate);
  const actual = history.filter((entry) => entry.month < currentMonth);
  actual.push({ month: currentMonth, total: currentTotal });
  const points: ProgressChartPoint[] = actual.map((entry) => ({
    label: entry.month === currentMonth ? "Now" : entry.month,
    month: entry.month,
    actual: entry.total,
    projected: entry.month === currentMonth ? currentTotal : null,
  }));
  const projection = plan.months.length <= 24
    ? plan.months
    : plan.months.filter((entry, index) => index === 0 || index === plan.months.length - 1 || index % Math.ceil(plan.months.length / 23) === 0);
  projection.forEach((entry) => {
    const month = forecastMonthKey(entry.month, calculationDate);
    points.push({ label: month, month, actual: null, projected: round(entry.remaining) });
  });
  return points;
}

export function buildProgressReport(input: ProgressReportInput) {
  const calculationDate = input.calculationDate ?? new Date();
  const currentMonth = localMonthKey(calculationDate);
  const activeTransactions = input.transactions.filter((transaction) => !transaction.deletedAt);
  const balanceView = buildProgressBalanceView(
    input.openingAccounts,
    activeTransactions,
    input.snapshots,
    input.detailedSpendingTracking ?? true,
  );
  const startingDebt = balanceView.startingTotal;
  const currentDebt = balanceView.currentTotal;
  const principalEliminated = round(Math.max(0, startingDebt - currentDebt));
  const progressPercent = startingDebt > 0 ? round(Math.min(100, principalEliminated / startingDebt * 100)) : 0;
  const history = balanceView.snapshots.map((snapshot) => ({ month: snapshot.month, total: snapshot.totalBalance }));
  const previousSnapshot = [...balanceView.snapshots].reverse().find((snapshot) => snapshot.month < currentMonth) ?? null;
  const currentMonthTransactions = activeTransactions.filter((transaction) => transaction.date.slice(0, 7) === currentMonth && (input.detailedSpendingTracking !== false || transaction.type === "payment"));
  const ledgerChangeThisMonth = round(currentMonthTransactions.reduce((sum, transaction) => sum + (transaction.type === "payment" ? transaction.amount : -transaction.amount), 0));
  const changeThisMonth = previousSnapshot ? round(previousSnapshot.totalBalance - currentDebt) : ledgerChangeThisMonth;
  const estimatedInterestPaid = round(activeTransactions.filter((transaction) => transaction.type === "fee").reduce((sum, transaction) => sum + transaction.amount, 0));
  const estimatedInterestAvoided = !input.currentPlan.stalled && !input.minimumOnlyPlan.stalled
    ? round(Math.max(0, input.minimumOnlyPlan.totalInterest - input.currentPlan.totalInterest))
    : null;
  const currentDebtFreeMonth = input.currentPlan.months.length && !input.currentPlan.stalled
    ? forecastMonthKey(input.currentPlan.months.length, calculationDate)
    : null;
  const previousDebtFreeMonth = previousSnapshot?.projectedDebtFreeMonth ?? null;
  const timeGainedMonths = monthDifference(previousDebtFreeMonth, currentDebtFreeMonth);
  const paymentMonth = activeTransactions
    .filter((transaction) => transaction.type === "payment")
    .map((transaction) => transaction.date.slice(0, 7))
    .sort()[0] ?? null;
  const firstDebtMonth = activeTransactions
    .filter((transaction) => transaction.type === "payment" && (transaction.balanceAfter ?? Number.POSITIVE_INFINITY) <= .005)
    .map((transaction) => transaction.date.slice(0, 7))
    .sort()[0] ?? null;
  const currentHistory = [...history.filter((entry) => entry.month < currentMonth), { month: currentMonth, total: currentDebt }];
  const projectedFor = (remainingShare: number) => firstProjectedMonth(input.currentPlan, startingDebt * remainingShare, calculationDate);
  const actualFor = (remainingShare: number) => firstActualMonth(currentHistory, startingDebt * remainingShare);
  const thousandActual = startingDebt >= 1000 ? firstActualMonth(currentHistory, startingDebt - 1000) : null;
  const thousandProjected = startingDebt >= 1000 ? firstProjectedMonth(input.currentPlan, startingDebt - 1000, calculationDate) : null;
  const milestones: ProgressMilestone[] = [
    milestone("first-payment", "First payment recorded", paymentMonth, null),
    milestone("first-1000", "First $1,000 eliminated", thousandActual, thousandProjected),
    milestone("first-debt", "First debt paid off", firstDebtMonth, input.currentPlan.months.find((entry) => entry.paidOff.length)?.month ? forecastMonthKey(input.currentPlan.months.find((entry) => entry.paidOff.length)!.month, calculationDate) : null),
    milestone("quarter", "25% complete", actualFor(.75), projectedFor(.75)),
    milestone("half", "50% complete", actualFor(.5), projectedFor(.5)),
    milestone("three-quarter", "75% complete", actualFor(.25), projectedFor(.25)),
    milestone("debt-free", "Debt-free", currentDebt <= .005 ? currentMonth : null, currentDebtFreeMonth),
  ];

  return {
    balanceView,
    startingDebt,
    currentDebt,
    principalEliminated,
    progressPercent,
    changeThisMonth,
    estimatedInterestPaid,
    estimatedInterestAvoided,
    currentDebtFreeMonth,
    previousDebtFreeMonth,
    timeGainedMonths,
    chart: chartSeries(history, currentDebt, input.currentPlan, calculationDate),
    milestones,
  };
}
