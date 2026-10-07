import type { CashflowItem } from './dashboard-data.ts';

export type LoanTracker = {
  id: string;
  name: string;
  kind: 'house' | 'car';
  originalAmount: number;
  remainingAmount: number;
  balanceKind: 'principal' | 'payoff';
  asOf: string;
  budgetItemId: string;
  budgetItemName: string;
  apr?: number;
  escrow?: number;
  principalAndInterest?: number;
  history: { date: string; amount: number; balanceKind: 'principal' | 'payoff'; recordedAt: string; payment?: number; principal?: number; interest?: number; escrow?: number; extraPrincipal?: number }[];
};

export function loanProgress(loan: LoanTracker) {
  const reduction = Math.max(0, loan.originalAmount - loan.remainingAmount);
  return { reduction, percent: loan.originalAmount > 0 ? Math.min(100, reduction / loan.originalAmount * 100) : 0 };
}

// Copied monthly budgets get new IDs. Fall back only to an unambiguous exact name.
export function linkedLoanPayment(loan: LoanTracker, items: CashflowItem[]) {
  const expenses = items.filter(item => item.kind !== 'income');
  const byId = expenses.find(item => item.id === loan.budgetItemId);
  if (byId) return byId;
  const matches = expenses.filter(item => item.name === loan.budgetItemName);
  return matches.length === 1 ? matches[0] : null;
}

const cents = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

export function loanPaymentSplit(loan: LoanTracker, payment: number, extraPrincipal = 0) {
  if (loan.balanceKind !== 'principal' || loan.apr === undefined || loan.escrow === undefined) throw new Error('Set a principal balance, APR, and escrow before recording a payment.');
  if (![loan.remainingAmount, loan.apr, loan.escrow, payment, extraPrincipal].every(Number.isFinite) || loan.apr < 0 || loan.escrow < 0 || payment <= 0 || extraPrincipal < 0) throw new Error('Enter valid payment amounts and loan terms.');
  const interest = cents(loan.remainingAmount * loan.apr / 1200);
  const principal = cents(payment - loan.escrow - interest);
  if (principal <= 0) throw new Error('Payment must cover escrow, interest, and some principal.');
  if (cents(principal + extraPrincipal) > loan.remainingAmount) throw new Error('Principal payment exceeds the remaining loan balance.');
  return { interest, principal, escrow: loan.escrow, extraPrincipal: cents(extraPrincipal), total: cents(payment + extraPrincipal), remainingAmount: cents(loan.remainingAmount - principal - extraPrincipal) };
}

export function recordLoanPayment(loan: LoanTracker, payment: number, date: string, extraPrincipal = 0, recordedAt = new Date().toISOString()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date || date < loan.asOf) throw new Error('Payment date must be on or after the current balance date.');
  const split = loanPaymentSplit(loan, payment, extraPrincipal);
  if (loan.history.some(entry => entry.payment !== undefined && entry.date.slice(0, 7) === date.slice(0, 7))) throw new Error('A regular payment is already recorded for this month. Update the lender balance to reconcile a correction.');
  return { ...loan, remainingAmount: split.remainingAmount, asOf: date, history: [...loan.history, { date, amount: split.remainingAmount, balanceKind: loan.balanceKind, recordedAt, payment: split.total, principal: cents(split.principal + split.extraPrincipal), interest: split.interest, escrow: split.escrow, extraPrincipal: split.extraPrincipal }] };
}
