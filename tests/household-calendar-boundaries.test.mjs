import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { householdDate, householdMonthOffset } from '../app/household-date.ts';
import { forecastMonthKey, buildOnboardingPlan, createOnboardingPlanning, createPlannedDebt } from '../app/onboarding-plan.ts';
import { promoNotice } from '../app/debts-screen.ts';
import { parseDashboardContract, serializeDashboardBackup } from '../app/dashboard-data.ts';

const legacy = () => JSON.parse(readFileSync(new URL('./fixtures/legacy-v0.json', import.meta.url), 'utf8'));

// Run this file under different TZ values: every expectation is a Pacific household date.
for (const [instant, day] of [
  ['2027-01-01T07:59:59Z', '2026-12-31'], ['2027-01-01T08:00:00Z', '2027-01-01'],
  ['2028-03-01T07:59:59Z', '2028-02-29'], ['2028-03-01T08:00:00Z', '2028-03-01'],
  ['2026-11-01T06:59:59Z', '2026-10-31'], ['2026-11-01T07:00:00Z', '2026-11-01'],
  ['2026-11-01T08:59:59Z', '2026-11-01'], ['2026-11-01T09:00:00Z', '2026-11-01'],
  ['2026-03-08T09:59:59Z', '2026-03-08'], ['2026-03-08T10:00:00Z', '2026-03-08'],
]) {
  test(`onboarding and promo status share the household calendar at ${instant}`, () => {
    const now = new Date(instant);
    assert.equal(householdDate(now), day);
    assert.equal(forecastMonthKey(1, now), day.slice(0, 7));
    assert.equal(forecastMonthKey(2, now), householdMonthOffset(1, now));
    const account = { ...legacy().accounts[0], promoEndDate: day, postPromoApr: 24 };
    assert.equal(promoNotice(account, now).tone, 'neutral');
    const tomorrow = new Date(now.valueOf() + 48 * 60 * 60 * 1000);
    assert.equal(promoNotice(account, tomorrow).tone, 'warning');
  });
}

test('onboarding finish month uses the same start month as its forecast', () => {
  const now = new Date('2027-01-01T00:30:00Z');
  const planning = createOnboardingPlanning();
  planning.debts = [{ ...createPlannedDebt('card'), name: 'Boundary card', balance: 100, minimum: 100, apr: 0 }];
  planning.capacity.monthlyAmount = 100;
  const result = buildOnboardingPlan(planning, now, now.toISOString());
  assert.equal(result.plan.months.length, 1);
  assert.equal(result.debtFreeMonth, '2026-12');
  assert.equal(result.accounts[0].createdAt, now.toISOString());
  assert.equal(result.planning.onboarding.completedAt, now.toISOString());
});

test('only undated legacy cashflow gets the household month; dated history round-trips unchanged', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-01T00:30:00Z') });
  const undated = legacy();
  delete undated.monthlyBudgets;
  undated.cashflowItems = [];
  assert.deepEqual(Object.keys(parseDashboardContract(undated).payload.monthlyBudgets), ['2026-10']);
  const dated = legacy();
  dated.monthlyBudgets = { '2026-11': [] };
  const first = parseDashboardContract(dated);
  const restored = parseDashboardContract(JSON.parse(serializeDashboardBackup(first)));
  for (const key of ['accounts', 'transactions', 'snapshots', 'balanceAdjustments', 'monthlyBudgets']) {
    assert.deepEqual(restored.payload[key], first.payload[key]);
  }
  assert.deepEqual(Object.keys(restored.payload.monthlyBudgets), ['2026-11']);
});
