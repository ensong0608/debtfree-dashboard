import type {CashflowItem,DebtAccount,MonthlyPlanSettings} from './dashboard-data.ts';
import type {LoanTracker} from './loan-progress.ts';
import {loanForecastAssumptions} from './loan-progress.ts';
import {buildConfiguredPayoffSchedule,type PayoffSchedule} from './payoff-schedule.ts';
import {buildPayoffStrategyRows,type PayoffStrategyRow} from './payoff-strategy.ts';
import type {ProgressCarouselScope} from './progress-view.ts';
export type NextPayoffViews=Record<ProgressCarouselScope,PayoffStrategyRow[]>;
/** Use forecast dates, never payment totals, to identify the next debt to clear. */
export function buildNextPayoffs(accounts:DebtAccount[],loans:LoanTracker[],items:CashflowItem[],settings:MonthlyPlanSettings,schedule:PayoffSchedule,date=new Date()):NextPayoffViews{
 const strategy=settings.payoffPlanStrategy==='snowball'?'snowball':'avalanche';
 const rows=buildPayoffStrategyRows(accounts,loans.filter(loan=>!loan.removedAt),schedule,strategy);
 const homes=loans.filter(loan=>loan.kind==='house'&&!loan.removedAt&&loan.remainingAmount>0);
 const homeSchedule=buildConfiguredPayoffSchedule([],homes,items,0,strategy,date);
 const homeRows:PayoffStrategyRow[]=homes.map(loan=>({id:'loan:'+loan.id,name:loan.name,balance:loan.remainingAmount,apr:loan.apr,debtType:'Mortgage',institutionKey:loan.institutionKey,estimated:loanForecastAssumptions(loan).length>0,payoffMonth:homeSchedule.payoffMonths['loan:'+loan.id]??null}));
 const ordered=(values:PayoffStrategyRow[])=>values.map((row,index)=>({row,index})).sort((a,b)=>(a.row.payoffMonth??'9999-12').localeCompare(b.row.payoffMonth??'9999-12')||a.index-b.index).map(value=>value.row);
 return {accounts:ordered(rows.filter(row=>row.debtType!=='Auto loan')),home:ordered(homeRows),auto:ordered(rows.filter(row=>row.debtType==='Auto loan'))};
}
