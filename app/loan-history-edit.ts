import type {LoanTracker} from './loan-progress.ts';
import {round} from './payoff-engine.ts';
import {validDate} from './interest-accrual.ts';
/** Correct one observation; later confirmed balances remain reconciliation anchors. */
export function editLoanHistory(loan:LoanTracker,index:number,amount:number,date:string,now=new Date().toISOString()):LoanTracker{
 const original=loan.history[index];if(!original)throw new Error('This transaction is no longer available.');
 if(!Number.isFinite(amount)||amount<0||round(amount)!==amount||original.payment!==undefined&&amount===0)throw new Error('Enter a valid amount.');
 if(!validDate(date)||date<(loan.history[index-1]?.date??'2000-01-01')||date>(loan.history[index+1]?.date??'9999-12-31'))throw new Error('Keep the date between adjacent balance records.');
 if(original.payment!==undefined&&loan.history.some((h,i)=>i!==index&&h.payment!==undefined&&h.date.slice(0,7)===date.slice(0,7)))throw new Error('A payment is already recorded for this month.');
 const delta=original.payment!==undefined?round(amount-original.payment):round(original.amount-amount);
 if(original.payment!==undefined&&(original.principal===undefined||original.interest===undefined||original.escrow===undefined)){
  if(delta!==0)throw new Error('Confirm the payment breakdown before changing this amount.');
 }
 if(original.principal!==undefined&&original.principal+delta<0)throw new Error('Payment must cover recorded interest and escrow.');
 let covered=false;
 const history=loan.history.map((entry,i)=>{
  if(i<index)return entry;
  if(i>index&&entry.payment===undefined){covered=true;return entry;}
  if(covered)return entry;
  const balance=round(entry.amount-delta);if(balance<0)throw new Error('This payment exceeds the remaining principal.');
  if(i!==index)return {...entry,amount:balance};
  const {corrections,...previous}=entry;
  return {...entry,date,amount:balance,...(entry.payment===undefined?{}:{payment:amount,...(entry.principal===undefined?{}:{principal:round(entry.principal+delta)})}),corrections:[...(corrections??[]),{recordedAt:now,previous}]};
 });
 const latest=loan.history.at(-1);
 const confirmedLater=covered||Boolean(latest&&loan.asOf>latest.date);
 const current=confirmedLater?loan.remainingAmount:round(loan.remainingAmount-delta);
 if(!confirmedLater&&loan.principalBalance!==undefined&&round(loan.principalBalance-delta)<0)throw new Error('This payment exceeds the remaining principal.');
 if(current<0)throw new Error('This payment exceeds the remaining principal.');
 return {...loan,history,remainingAmount:current,...(!confirmedLater&&loan.principalBalance!==undefined?{principalBalance:round(loan.principalBalance-delta)}:{}),...(!confirmedLater&&index===history.length-1?{asOf:date}:{})};
}
