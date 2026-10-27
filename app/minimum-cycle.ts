import type {DebtAccount} from './dashboard-data.ts';
import {householdDate} from './household-date.ts';
import {recurringDueDate} from './recurring-due-date.ts';
import {effectiveMinimum} from './payoff-engine.ts';
/** Keep the elapsed cycle's obligation when a new statement minimum is entered. */
export function minimumCycleEdit(account:DebtAccount,minimum:number,today=householdDate()) {
 if(minimum===account.minimum)return {};
 const month=today.slice(0,7),due=recurringDueDate(account.dueDate,month);
 return due && due<today ? {minimumPriorCycle:account.minimumPriorCycle?.month===month?account.minimumPriorCycle:{month,amount:effectiveMinimum(account)}} : {};
}
