import type { DebtAccount, MonthlyPlanSettings } from './dashboard-data.ts';
import type { LoanTracker } from './loan-progress.ts';
import type { PayoffSchedule } from './payoff-schedule.ts';

/** Strategy always covers cards and loans, including auto. Mortgage stays outside. */
export function fixedStrategySettings(settings: MonthlyPlanSettings): MonthlyPlanSettings {
  return { ...settings, payoffExcludedTypes: ['Mortgage', 'House loan'] };
}
export type PayoffStrategyRow = { id: string; name: string; balance: number; apr?: number; payoffMonth: string | null };
export function buildPayoffStrategyRows(accounts: DebtAccount[], loans: LoanTracker[], schedule: PayoffSchedule, strategy: 'avalanche' | 'snowball'): PayoffStrategyRow[] {
  const rows = [
    ...accounts.filter(a => !a.archivedAt && a.balance > 0 && !new Set<string>(['Mortgage', 'House loan']).has(a.type)).map(a => ({ id: 'account:' + a.id, name: a.name, balance: a.balance, apr: a.apr })),
    ...loans.filter(l => l.kind === 'car' && l.remainingAmount > 0).map(l => ({ id: 'loan:' + l.id, name: l.name, balance: l.remainingAmount, apr: l.apr })),
  ];
  rows.sort((a, b) => strategy === 'snowball'
    ? a.balance - b.balance || (b.apr ?? -1) - (a.apr ?? -1)
    : (b.apr ?? -1) - (a.apr ?? -1) || a.balance - b.balance);
  return rows.map(row => ({ ...row, payoffMonth: schedule.payoffMonths[row.id] ?? null }));
}
