import test from 'node:test';
import assert from 'node:assert/strict';
import { recurringDueDate } from '../app/recurring-due-date.ts';
import { householdDate } from '../app/household-date.ts';
import { forecastMonthKey, promoIsActive, payoffOutcome } from '../app/payoff-engine.ts';
import { calculatePayoffCalculator } from '../app/payoff-calculator.ts';
import { recentDebtMonths, buildActualProgress } from '../app/debt-activity.ts';
import { buildPayoffCsv } from '../app/payoff-export.ts';

const account = { id:'boundary', name:'Synthetic boundary card', type:'Credit card', balance:2000, baselineBalance:2000, apr:0, interestFee:0, minimum:1, minimumMode:'manual', payoffMode:'priority', creditLimit:5000, dueDate:'', promoEndDate:'', postPromoApr:0, postPromoMinimum:0, createdAt:'2026-10-01' };

test('shrinking long scenarios report a limit without inventing a payoff time', () => {
  const plan = calculatePayoffCalculator([account], 1, 'avalanche');
  assert.equal(plan.monthLimitReached, true);
  assert.equal(plan.months.length, 1200);
  assert.equal(plan.months.at(-1).remaining, 800);
  assert.deepEqual(payoffOutcome(plan), { title:'Beyond 1,200 months', detail:'Payoff exceeds the projection limit.' });
  const stalled = calculatePayoffCalculator([{...account, apr:24}], 1, 'avalanche');
  assert.equal(stalled.monthLimitReached, undefined);
  assert.equal(payoffOutcome(stalled).title, 'No payoff at this amount');
});

test('stopped exports retain their schedule but leave months to payoff blank', () => {
  for (const monthLimitReached of [true, false]) {
    const csv = buildPayoffCsv({ calculationMode:'calculator', generatedAt:'2026-10-14', budgetMonth:'October 2026', strategy:'Avalanche', projectedDebtFree:monthLimitReached?'Beyond 1,200 months':'No payoff at this amount', monthsToPayoff:1200, stalled:true, monthLimitReached, startingDebt:2000, monthlyPlan:1, estimatedInterest:0, extraPayment:1, totalIncome:0, totalExpenses:0, totalBudget:0, monthlySurplus:0, totalMinimums:0, availableExtra:1, cashflow:[], accounts:[], transactions:[], snapshots:[], schedule:[{month:'September 2126',focusDebt:account.name,minimumPayments:0,extraPayment:1,totalPaid:1,interest:0,remaining:800,milestone:'',accounts:[]}] });
    assert.match(csv, /Months to payoff,\r?\n/);
    assert.doesNotMatch(csv, /Months to payoff,1200/);
    assert.match(csv, /September 2126/);
    assert.match(csv, monthLimitReached ? /Projection limit reached/ : /Needs adjustment/);
  }
});

test('Progress, payment allocation months and promotions use the household day', () => {
  const instant = new Date('2026-11-01T00:30:00Z');
  assert.equal(householdDate(instant), '2026-10-31');
  assert.equal(forecastMonthKey(1, instant), '2026-10');
  assert.equal(forecastMonthKey(4, instant), '2027-01');
  assert.deepEqual(recentDebtMonths(instant), ['2026-10','2026-09','2026-08','2026-07','2026-06','2026-05']);
  const promo = {...account,promoEndDate:'2026-10-31',postPromoApr:24};
  assert.equal(promoIsActive(promo,1,instant),true);
  assert.equal(promoIsActive(promo,2,instant),false);
  const tx = {id:'october-payment',accountId:account.id,date:'2026-10-31',createdAt:instant.toISOString(),type:'payment',amount:50,payeeName:'',category:'',memo:''};
  const report = buildActualProgress([account],[tx],[],[],instant,2000);
  assert.equal(report.current,1950);
  assert.equal(report.paymentCount,1);
  assert.equal(report.monthlyReductions,50);
  assert.equal(report.starting,2000);
});

test('promotion dates clamp to February and follow Pacific midnight across DST', () => {
  const january = new Date('2028-02-01T03:00:00Z'); // January 31 in Pacific time.
  assert.equal(promoIsActive({...account,promoEndDate:'2028-02-29',postPromoApr:24},2,january),true);
  assert.equal(promoIsActive({...account,promoEndDate:'2028-02-28',postPromoApr:24},2,january),false);
  for (const [instant, expected] of [['2026-11-01T06:59:00Z','2026-10'],['2026-11-01T07:00:00Z','2026-11'],['2026-03-01T07:59:00Z','2026-02'],['2026-03-01T08:00:00Z','2026-03']]) {
    assert.equal(forecastMonthKey(1,new Date(instant)),expected);
    assert.equal(recentDebtMonths(new Date(instant))[0],expected);
  }
});


test('default due month shares the calendar without changing the saved recurring day', t => {
  t.mock.timers.enable({ apis:['Date'], now:new Date('2026-11-01T00:30:00Z') });
  const saved = '2026-01-31';
  assert.equal(recurringDueDate(saved), '2026-10-31');
  assert.equal(recurringDueDate(saved, '2026-11'), '2026-11-30');
  assert.equal(recurringDueDate(saved, '2026-12'), '2026-12-31');
});
