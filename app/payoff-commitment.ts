import type { CashflowItem, DebtAccount, MonthlyPlanSettings } from './dashboard-data.ts';
import { linkedLoanPayment, regularLoanPayment, type LoanTracker } from './loan-progress.ts';
import { effectiveMinimum, forecastMonthKey, round } from './payoff-engine.ts';
import { buildConfiguredPayoffSchedule } from './payoff-schedule.ts';
import { loanScheduleType, scheduleExtra, scheduleMinimums, scheduleTypeLabel } from './schedule-view.ts';

/** Exclusions change the forecast, not the household's minimum obligations. */
export function buildActivePayoffCommitment(accounts: DebtAccount[], loans: LoanTracker[], items: CashflowItem[], settings: MonthlyPlanSettings, date = new Date()) {
  const excluded = new Set(settings.payoffExcludedTypes ?? []);
  const includedAccounts = accounts.filter(account => !excluded.has(account.type));
  const includedLoans = loans.filter(loan => !excluded.has(loanScheduleType(loan)));
  const extra = scheduleExtra(settings, includedAccounts);
  const hasIncludedDebt = includedAccounts.some(account => !account.archivedAt && account.balance > 0) || includedLoans.some(loan => loan.remainingAmount > 0);
  const schedule = buildConfiguredPayoffSchedule(includedAccounts, includedLoans, items, hasIncludedDebt ? extra : 0, settings.payoffPlanStrategy ?? 'avalanche', date);
  const forecastDate = new Date(forecastMonthKey(2, date) + '-01T12:00:00Z');
  const activeAccounts = accounts.filter(account => !account.archivedAt && account.balance > 0);
  const activeLoans = loans.filter(loan => loan.remainingAmount > 0);
  const accountMinimums = Object.fromEntries(activeAccounts.map(account => [account.id, scheduleMinimums([account], forecastDate)]));
  const accountSuggestions = Object.fromEntries(activeAccounts.map(account => [account.id, schedule.firstPayments['account:' + account.id] ?? accountMinimums[account.id]]));
  const outsideAccountMinimums = round(activeAccounts.filter(account => excluded.has(account.type)).reduce((sum, account) => sum + accountMinimums[account.id], 0));
  const loanSuggestions: Record<string, number> = {};
  const coverageByItem = new Map<string, { amount: number; payments: number }>();
  let outsideLoanPayments = 0;
  let knownLoanPayments = 0;
  let missingLoanPayments = 0;
  for (const loan of activeLoans) {
    const regular = regularLoanPayment(loan, items);
    if (regular === undefined) missingLoanPayments++;
    const minimum = Math.max(0, round(regular ?? 0));
    const suggested = schedule.firstPayments['loan:' + loan.id] ?? minimum;
    loanSuggestions[loan.id] = suggested;
    const committed = suggested;
    knownLoanPayments = round(knownLoanPayments + committed);
    if (excluded.has(loanScheduleType(loan))) outsideLoanPayments = round(outsideLoanPayments + minimum);
    const item = linkedLoanPayment(loan, items);
    if (!item) continue;
    const coverage = coverageByItem.get(item.id) ?? { amount: Math.max(0, item.amount), payments: 0 };
    coverage.payments = round(coverage.payments + committed);
    coverageByItem.set(item.id, coverage);
  }
  const outsideSchedulePayments = round(outsideAccountMinimums + outsideLoanPayments);
  const householdPayment = round(schedule.monthly + outsideSchedulePayments);
  const loanPaymentsInSpending = round([...coverageByItem.values()].reduce((sum, coverage) => sum + Math.min(coverage.amount, coverage.payments), 0));
  const plannedDebtMinimums = activeAccounts.filter(account => !['Mortgage', 'Auto loan'].includes(account.type)).map(account => ({ id: account.id, name: account.name, amount: effectiveMinimum(account) }));
  const plannedDebtExtra = plannedDebtMinimums.length ? extra : 0;
  return {
    plannedDebtMinimums, plannedDebtExtra,
    schedule, extra, accountSuggestions, loanSuggestions,
    scopeLabel: excluded.size ? ([...new Set([...includedAccounts.filter(account => !account.archivedAt).map(account => account.type), ...includedLoans.map(loanScheduleType)])].map(scheduleTypeLabel).join(', ') || 'No debt types selected') : 'Whole household',
    scopeBalance: round(includedAccounts.filter(account => !account.archivedAt).reduce((sum, account) => sum + account.balance, 0) + includedLoans.reduce((sum, loan) => sum + loan.remainingAmount, 0)),
    householdPayment,
    outsideSchedulePayments,
    minimumPayments: round(Object.values(accountMinimums).reduce((sum, amount) => sum + amount, 0)),
    knownLoanPayments,
    missingLoanPayments,
    loanPaymentsInSpending,
    budgetCommitment: round(plannedDebtMinimums.reduce((sum, row) => sum + row.amount, 0) + plannedDebtExtra),
  };
}

export type ActivePayoffCommitment = ReturnType<typeof buildActivePayoffCommitment>;

export function monthlyBudgetCommitment(settings: MonthlyPlanSettings, month: string, currentMonth: string, currentCommitment: number) {
  return month === currentMonth ? currentCommitment : settings.months[month]?.debtPaymentTarget ?? 0;
}

/** Capture only the current month's displayed amount; retain every other saved field. */
export function capturePayoffCommitment(settings: MonthlyPlanSettings, month: string, currentMonth: string, amount: number): MonthlyPlanSettings {
  if (month !== currentMonth || settings.months[month]?.debtPaymentTarget === amount) return settings;
  return {
    ...settings,
    months: {
      ...settings.months,
      [month]: { ...(settings.months[month] ?? { safetyBuffer: 0 }), debtPaymentTarget: amount },
    },
  };
}
