import type {DebtAccount, MonthlyPlanSettings, PayoffSnapshot, RemovedProgressAccount} from './dashboard-data.ts';
import type {LoanTracker} from './loan-progress.ts';
import {forecastMinimum, forecastMonthlyRate, round} from './payoff-engine.ts';
export const SCHEDULE_TYPES = ['Credit card','Mortgage','Auto loan','Personal loan','Student loan','Medical debt','Other'] as const;
export function scheduleTypeLabel(type:string) {return type==='Auto loan'?'Car loan':type;}
export function loanScheduleType(loan:LoanTracker) {return loan.kind==='house'?'Mortgage':'Auto loan';}
export function scheduleMinimums(accounts:DebtAccount[],date=new Date()) {
 return round(accounts.filter(a=>!a.archivedAt&&a.balance>0).reduce((sum,a)=>sum+forecastMinimum(a,round(a.balance*(1+forecastMonthlyRate(a,1,date))),1,date),0));
}
export function scheduleView(accounts:DebtAccount[], loans:LoanTracker[], snapshots:PayoffSnapshot[], removed:RemovedProgressAccount[], settings:MonthlyPlanSettings) {
 const excluded=new Set(settings.payoffExcludedTypes??[]);
 const includedAccounts=accounts.filter(a=>!excluded.has(a.type));
 const includedLoans=loans.filter(l=>!excluded.has(loanScheduleType(l)));
 const versions=snapshots.flatMap(s=>[...(s.revisions as PayoffSnapshot[]??[]),s]);
 const includedRemoved=removed.filter(a=>!excluded.has(versions.flatMap(s=>s.accounts).find(saved=>saved.accountId===a.id)?.type??'Other'));
 const filterSnapshot=(s:PayoffSnapshot):PayoffSnapshot=>{const items=s.accounts.filter(a=>!excluded.has(a.type));return {...s,accounts:items,totalBalance:round(items.reduce((n,a)=>n+a.balance,0)),activeAccountCount:items.filter(a=>a.balance>0).length,...(s.revisions?{revisions:(s.revisions as PayoffSnapshot[]).map(filterSnapshot)}:{})};};
 const accountTypesFiltered=includedRemoved.length!==removed.length||accounts.some(a=>excluded.has(a.type))||versions.some(s=>s.accounts.some(a=>excluded.has(a.type)));
 return {accounts:includedAccounts,loans:includedLoans,removed:includedRemoved,snapshots:accountTypesFiltered?snapshots.map(filterSnapshot).filter(s=>s.accounts.length>0):snapshots,startingBalance:accountTypesFiltered?undefined:settings.progressStartingBalance};
}
/** The legacy total remains unchanged; missing new settings derive an equivalent extra. */
export function scheduleExtra(settings:MonthlyPlanSettings, accounts:DebtAccount[]) {
 return settings.payoffExtraPayment??Math.max(0,round((settings.payoffPlanAmount??0)-scheduleMinimums(accounts)));
}
