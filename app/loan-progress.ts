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
  history: { date: string; amount: number; balanceKind: 'principal' | 'payoff'; recordedAt: string }[];
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
