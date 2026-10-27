import type {DebtAccount} from './dashboard-data.ts';
import {householdDate} from './household-date.ts';
import {recurringDueDate} from './recurring-due-date.ts';
import {effectiveMinimum,estimatedMinimum} from './payoff-engine.ts';
export function currentMinimumCycle(account:DebtAccount,today=householdDate()) {
 const date=recurringDueDate(account.dueDate,today.slice(0,7));
 if(!date)return null;
 return account.minimumCycles?.find(cycle=>cycle.date===date) ?? {date,amount:account.minimumPriorCycle?.month===date.slice(0,7)&&account.minimumPriorCycle.amount>0?account.minimumPriorCycle.amount:account.minimum>0?effectiveMinimum(account):estimatedMinimum(account.balance,account.apr)};
}
/** Capture actual observed cycles; never invent missed months or payments. */
export function captureMinimumCycles(accounts:DebtAccount[],today=householdDate()) {
 let changed=false;
 const next=accounts.map(account=>{
  if(account.archivedAt||account.balance<=0)return account;
  const cycle=currentMinimumCycle(account,today);
  if(!cycle||account.minimumCycles?.some(saved=>saved.date===cycle.date))return account;
  changed=true;return {...account,minimumCycles:[...(account.minimumCycles??[]),cycle]};
 });
 return changed?next:accounts;
}
/** Pending minimums change today; elapsed obligations retain their original amount. */
export function minimumCycleEdit(account:DebtAccount,minimum:number,today=householdDate()) {
 if(minimum===account.minimum)return {};
 const cycle=currentMinimumCycle(account,today);
 if(!cycle)return {};
 const cycles=[...(account.minimumCycles??[])];
 if(!cycles.some(saved=>saved.date===cycle.date))cycles.push(cycle);
 const amount=minimum>0?minimum:estimatedMinimum(account.balance,account.apr);
 const minimumCycles=cycles.map(saved=>saved.date>=today?{...saved,amount}:saved);
 const month=today.slice(0,7);
 return {minimumCycles,...(cycle.date<today?{minimumPriorCycle:account.minimumPriorCycle?.month===month?account.minimumPriorCycle:{month,amount:cycle.amount}}:{})};
}
