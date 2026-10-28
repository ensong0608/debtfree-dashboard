import type { InstitutionKey } from './institutions.ts';
import type { CashflowItem } from './dashboard-data.ts';

export type LoanTracker = {
  removedAt?: string;
  paidOffRestoredAt?: string;
  institutionKey?: InstitutionKey;
  id: string;
  name: string;
  kind: 'house' | 'car';
  originalAmount: number;
  remainingAmount: number;
  balanceKind: 'principal' | 'payoff';
  principalBalance?: number; // Separate forecast principal when remainingAmount is a payoff quote.
  asOf: string;
  budgetItemId: string;
  budgetItemName: string;
  apr?: number;
  escrow?: number;
  principalAndInterest?: number;
  monthlyPayment?: number; // Total regular payment, including mortgage escrow.
  dueDate?: string;
  history: { date: string; amount: number; balanceKind: 'principal' | 'payoff'; recordedAt: string; payment?: number; principal?: number; interest?: number; escrow?: number; extraPrincipal?: number; estimated?: boolean }[];
};

/** Planning fallback only: never persists an assumed rate or reclassifies a balance. */
export const AUTO_PLANNING_APR = 6;
export function forecastLoanApr(loan: LoanTracker) {
  return loan.apr ?? (loan.kind === 'car' ? AUTO_PLANNING_APR : undefined);
}
export function forecastLoanPrincipal(loan: LoanTracker) {
  const value = loan.principalBalance ?? loan.remainingAmount;
  return Number.isFinite(value) && value >= 0 && value <= loan.remainingAmount ? value : undefined;
}
export function loanForecastAssumptions(loan: LoanTracker) {
  return [
    ...(loan.balanceKind === 'payoff' && loan.principalBalance === undefined ? ['Current balance used as estimated principal.'] : []),
    ...(loan.kind === 'car' && loan.apr === undefined ? [`Assumed ${AUTO_PLANNING_APR}% APR for planning.`] : []),
  ];
}

export function loanProgress(loan: LoanTracker) {
  const reduction = loan.originalAmount - loan.remainingAmount;
  return { reduction, percent: loan.originalAmount > 0 ? Math.max(0, Math.min(100, reduction / loan.originalAmount * 100)) : 0 };
}

// Copied monthly budgets get new IDs. Fall back only to an unambiguous exact name.
export function linkedLoanPayment(loan: LoanTracker, items: CashflowItem[]) {
  const expenses = items.filter(item => item.kind !== 'income');
  const byId = expenses.find(item => item.id === loan.budgetItemId);
  if (byId) return byId;
  const matches = expenses.filter(item => item.name === loan.budgetItemName);
  return matches.length === 1 ? matches[0] : null;
}

// Explicit form values take precedence; legacy Budget links remain intact.
export function regularLoanPayment(loan: LoanTracker, items: CashflowItem[]) {
  return loan.monthlyPayment ?? linkedLoanPayment(loan, items)?.amount ?? (loan.principalAndInterest === undefined ? undefined : loan.principalAndInterest + (loan.kind === 'house' ? loan.escrow ?? 0 : 0));
}

const cents = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

export function loanPaymentSplit(loan: LoanTracker, payment: number, extraPrincipal = 0) {
  const escrow = loan.kind === 'car' ? 0 : loan.escrow;
  const balance = forecastLoanPrincipal(loan), apr = forecastLoanApr(loan);
  if ((loan.kind !== 'car' && loan.balanceKind !== 'principal') || balance === undefined || apr === undefined || escrow === undefined) throw new Error('Set a principal balance, APR, and escrow before recording a payment.');
  if (![loan.remainingAmount, apr, escrow, payment, extraPrincipal].every(Number.isFinite) || apr < 0 || escrow < 0 || payment <= 0 || extraPrincipal < 0) throw new Error('Enter valid payment amounts and loan terms.');
  const interest = cents(balance * apr / 1200);
  const principal = cents(payment - escrow - interest);
  if (principal <= 0) throw new Error('Payment must cover escrow, interest, and some principal.');
  if (cents(principal + extraPrincipal) > balance) throw new Error('Principal payment exceeds the remaining loan balance.');
  return { interest, principal, escrow, extraPrincipal: cents(extraPrincipal), total: cents(payment + extraPrincipal), remainingAmount: cents(loan.remainingAmount - principal - extraPrincipal) };
}

export function recordLoanPayment(loan: LoanTracker, payment: number, date: string, extraPrincipal = 0, recordedAt = new Date().toISOString()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date || date < loan.asOf) throw new Error('Payment date must be on or after the current balance date.');
  const split = loanPaymentSplit(loan, payment, extraPrincipal);
  if (loan.history.some(entry => entry.payment !== undefined && entry.date.slice(0, 7) === date.slice(0, 7))) throw new Error('A regular payment is already recorded for this month. Update the lender balance to reconcile a correction.');
  return { ...loan, ...(loan.principalBalance === undefined ? {} : {principalBalance: cents(Math.max(0, loan.principalBalance - split.principal - split.extraPrincipal))}), remainingAmount: split.remainingAmount, asOf: date, history: [...loan.history, { date, amount: split.remainingAmount, balanceKind: loan.balanceKind, recordedAt, ...(loan.kind === 'car' && loanForecastAssumptions(loan).length ? {estimated:true} : {}), payment: split.total, principal: cents(split.principal + split.extraPrincipal), interest: split.interest, escrow: split.escrow, extraPrincipal: split.extraPrincipal }] };
}
