import { createDashboardBackup, createEmptyPlannedPayoff, type DebtAccount } from '../app/dashboard-data.ts';

// Hand-authored sample; never derived from a household export or database.
export function createDemoFixture() {
  const createdAt = '2026-10-01T12:00:00.000Z';
  const account = (id: string, name: string, balance: number, displayGroup: string): DebtAccount => ({
    id, name, balance, baselineBalance: balance, displayGroup, type: 'Credit card', apr: 0,
    interestFee: 0, minimum: 25, minimumMode: 'manual', payoffMode: 'priority', creditLimit: 5000,
    dueDate: '2026-10-25', promoEndDate: '', postPromoApr: 0, postPromoMinimum: 0, createdAt,
  });
  return createDashboardBackup({
    accounts: [account('demo-card', 'Sample card', 1000, 'Other'), account('demo-travel', 'Sample travel', 500, 'group-travel')],
    monthlyBudgets: {}, payees: [], balanceAdjustments: [], extra: 0, strategy: 'avalanche',
    planning: createEmptyPlannedPayoff(), customDebtOrder: ['demo-card', 'demo-travel'],
    monthlyPlan: { months: {}, detailedSpendingTracking: false, progressStartingBalance: 1500,
      debtGroups: [{ id: 'Other', name: 'Everyday' }, { id: 'group-travel', name: 'Travel' }] },
    transactions: [{ id: 'demo-payment', accountId: 'demo-card', date: '2026-10-02', payeeId: '',
      payeeName: 'Sample card', type: 'payment', category: 'Debt payment', memo: 'Sample payment', amount: 100,
      createdAt, updatedAt: createdAt, deletedAt: null }],
    snapshots: [{ id: 'demo-snapshot', month: '2026-09', capturedAt: '2026-09-30T12:00:00.000Z',
      totalBalance: 1500, monthlyInterest: 0, activeAccountCount: 2, projectedDebtFreeMonth: null, note: 'Sample starting point',
      accounts: [{ accountId: 'demo-card', name: 'Sample card', balance: 1000, type: 'Credit card', apr: 0 }, { accountId: 'demo-travel', name: 'Sample travel', balance: 500, type: 'Credit card', apr: 0 }] }],
  }, null, createdAt);
}
