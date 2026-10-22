import type { CashflowItem, DebtAccount, PayoffStrategy } from './dashboard-data.ts';
import { calculateMinimumPayoffPlan } from './payoff-calculator.ts';
import { forecastMonthKey, round, PAYOFF_PLAN_MONTH_LIMIT } from './payoff-engine.ts';
import { regularLoanPayment, type LoanTracker } from './loan-progress.ts';

export type ScheduleMonth = { month: string; paid: number; interest: number; remaining: number; paidOff: string[] };
/** Presentation only: minimums consume the existing account commitment. Fixed loan
 * payments stay separate; escrow is cash paid, never principal reduction or interest. */
export function buildPayoffSchedule(accounts: DebtAccount[], loans: LoanTracker[], items: CashflowItem[], amount: number, strategy: PayoffStrategy, date = new Date()) {
  const cards = calculateMinimumPayoffPlan(accounts, amount, strategy, [], date);
  const issues: string[] = cards.error ? [cards.error] : [];
  if (cards.plan?.stalled) issues.push('Increase the debt payment budget to reach a payoff date.');
  const activeLoans = loans.filter(loan => loan.remainingAmount > 0);
  const validLoans = activeLoans.flatMap(loan => {
    const payment = regularLoanPayment(loan, items), escrow = loan.kind === 'car' ? 0 : loan.escrow;
    if (loan.balanceKind !== 'principal' || loan.apr === undefined || escrow === undefined || payment === undefined || !Number.isFinite(payment) || payment <= 0 || loan.apr < 0 || payment - escrow <= round(loan.remainingAmount * loan.apr / 1200)) {
      issues.push(`Review payment and principal terms for ${loan.name}.`); return [];
    }
    return [{ ...loan, balance: loan.remainingAmount, payment, escrow }];
  });
  const rows: ScheduleMonth[] = [];
  const payoffMonths: Record<string, string> = {};
  const cardMonths = cards.plan?.months ?? [];
  for (let cycle = 1; cycle <= PAYOFF_PLAN_MONTH_LIMIT; cycle++) {
    const card = cardMonths[cycle - 1];
    if (!card && !validLoans.some(loan => loan.balance > 0)) break;
    let paid = card?.paid ?? 0, interest = card?.interest ?? 0;
    const paidOff = [...(card?.paidOff ?? [])];
    if (card) for (const account of accounts) {
      if ((card.payments[account.id] ?? 0) > 0 && (card.balances[account.id] ?? Infinity) <= 0) payoffMonths[`account:${account.id}`] = forecastMonthKey(cycle, date);
    }
    for (const loan of validLoans) {
      if (loan.balance <= 0) continue;
      const charge = round(loan.balance * loan.apr! / 1200);
      const principal = Math.min(loan.balance, round(loan.payment - loan.escrow - charge));
      loan.balance = round(loan.balance - principal);
      paid = round(paid + principal + charge + loan.escrow);
      interest = round(interest + charge);
      if (loan.balance === 0) { paidOff.push(loan.name); payoffMonths[`loan:${loan.id}`] = forecastMonthKey(cycle, date); }
    }
    const cardRemaining = card?.remaining ?? cardMonths.at(-1)?.remaining ?? accounts.filter(a => !a.archivedAt).reduce((sum, a) => sum + a.balance, 0);
    rows.push({ month: forecastMonthKey(cycle, date), paid: round(paid), interest: round(interest), remaining: round(cardRemaining + validLoans.reduce((sum, loan) => sum + loan.balance, 0)), paidOff });
  }
  if (validLoans.some(loan => loan.balance > 0)) issues.push('A loan exceeds the forecast limit.');
  const complete = !issues.length && (rows.at(-1)?.remaining ?? 0) === 0;
  return { rows, issues, complete, payoffMonths, debtFreeMonth: complete ? rows.at(-1)?.month ?? null : null, monthly: round(amount + activeLoans.reduce((sum, loan) => sum + (regularLoanPayment(loan, items) ?? 0), 0)), totalInterest: round(rows.reduce((sum, row) => sum + row.interest, 0)) };
}
export type PayoffSchedule = ReturnType<typeof buildPayoffSchedule>;
