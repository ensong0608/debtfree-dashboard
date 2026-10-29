import type {DebtAccount,LedgerTransaction} from './dashboard-data.ts';
import {debtPaymentProgress} from './monthly-plan.ts';
import {currentMinimumCycle} from './minimum-cycle.ts';
import {effectiveMinimum,round} from './payoff-engine.ts';
export function automaticPaymentAllocation(account:DebtAccount,transactions:LedgerTransaction[],amount:number,date:string){
 const target=currentMinimumCycle(account,date)?.amount??effectiveMinimum(account,new Date(date+'T12:00:00Z'));
 const progress=debtPaymentProgress([account],{},transactions.filter(t=>!t.replacedByTransactionId),date.slice(0,7),{[account.id]:target})[0];
 const minimum=round(Math.min(Math.max(0,amount||0),progress?.remainingMinimum??target));
 const extra=round(Math.max(0,(amount||0)-minimum));
 return {minimum,extra,paymentKind:minimum===0?'extra' as const:extra>0?'combined' as const:'minimum' as const};
}
