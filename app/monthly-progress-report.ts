import type {BalanceAdjustment,CashflowItem,DebtAccount,LedgerTransaction} from './dashboard-data.ts';
import {paymentActivity} from './payments.ts';
import {postedMovement} from './payment-overlap.ts';
import {effectiveMinimum,round} from './payoff-engine.ts';
import {transactionAdjustedAccounts} from './progress-balances.ts';
import {regularLoanPayment,type LoanTracker} from './loan-progress.ts';
import type {ProgressCarouselScope} from './progress-view.ts';

/** A read-only comparison of the chosen monthly plan and recorded activity.
 * Budget paid acknowledgements, deleted entries and superseded estimates are not payments. */
export function monthlyProgressReport(input:{scope:ProgressCarouselScope;today:string;accounts:DebtAccount[];loans:LoanTracker[];transactions:LedgerTransaction[];adjustments:BalanceAdjustment[];items:CashflowItem[];plannedAccountAmount:number}){
 const {scope,today,accounts,loans,items}=input;const month=today.slice(0,7);
 const inMonth=(date:string)=>date.slice(0,7)===month&&date<=today;
 const accountIds=new Set(accounts.filter(a=>scope==='accounts'?!['Auto loan','Mortgage','House loan'].includes(a.type):scope==='auto'?a.type==='Auto loan':['Mortgage','House loan'].includes(a.type)).map(a=>a.id));
 const tx=input.transactions.filter(t=>accountIds.has(t.accountId)&&inMonth(t.date)&&!t.deletedAt&&!t.replacedByTransactionId&&!t.id.startsWith('settlement:'));
 const adjustments=input.adjustments.filter(a=>accountIds.has(a.accountId)&&inMonth(a.date)&&!a.deletedAt);
 const rows=paymentActivity(tx,adjustments);
 const cardPayments=rows.filter(row=>row.kind==='payment').reduce((sum,row)=>sum+row.amount,0);
 const selectedLoans=scope==='accounts'?[]:loans.filter(loan=>!loan.removedAt&&loan.kind===(scope==='home'?'house':'car')&&!loan.id.startsWith('legacy-auto:'));
 const payments=selectedLoans.flatMap(loan=>loan.history.filter(entry=>inMonth(entry.date)&&entry.payment!==undefined));
 const recorded=round(cardPayments+payments.reduce((sum,entry)=>sum+(entry.payment??0),0));
 const accountPayments=accounts.filter(a=>accountIds.has(a.id)&&!a.removedFromDebts&&(!a.archivedAt||rows.some(row=>row.accountId===a.id&&row.kind==='payment'))).map(a=>({id:a.id,name:a.name,paid:round(rows.filter(row=>row.accountId===a.id&&row.kind==='payment').reduce((sum,row)=>sum+row.amount,0))}));
 const loanPayments=selectedLoans.map(loan=>({id:loan.id,name:loan.name,paid:round(loan.history.filter(entry=>inMonth(entry.date)&&entry.payment!==undefined).reduce((sum,entry)=>sum+(entry.payment??0),0))}));
 const feeTransactions=tx.filter(t=>t.type==='fee'||t.category==='Interest'||Boolean(t.actualInterestCycle||t.interestEstimate));
 const missingLoanInterest=payments.some(entry=>entry.interest===undefined);
 const interest=missingLoanInterest?null:round(feeTransactions.reduce((sum,t)=>sum+t.amount,0)+adjustments.filter(a=>a.reportKind==='interest'||a.reportKind==='fee').reduce((sum,a)=>sum+Math.abs(a.difference),0)+payments.reduce((sum,entry)=>sum+(entry.interest??0),0));
 const hasEstimate=feeTransactions.some(t=>Boolean(t.interestEstimate))||payments.some(entry=>entry.interest!==undefined);
 let movement=round(tx.reduce((sum,t)=>sum+postedMovement(t),0)+adjustments.reduce((sum,a)=>sum+a.difference,0));
 // A confirmed lender balance may already contain actual interest whose former
 // estimate was replaced; history alone cannot isolate that movement reliably.
 let movementKnown=!feeTransactions.some(t=>Boolean(t.actualInterestIncludedAt));
 for(const loan of selectedLoans){
  const history=loan.history.filter(entry=>entry.date<=today).slice().sort((a,b)=>a.date.localeCompare(b.date)||a.recordedAt.localeCompare(b.recordedAt));
  for(let i=0;i<history.length;i++)if(inMonth(history[i].date)){
   const previous=history[i-1];if(!previous||previous.balanceKind!==history[i].balanceKind){movementKnown=false;continue;}
   movement=round(movement+history[i].amount-previous.amount);
  }
 }
 let planned:number|null=scope==='accounts'?(input.plannedAccountAmount>0?round(input.plannedAccountAmount):null):null;
 if(scope!=='accounts'){
  const relevantLoans=selectedLoans.filter(loan=>loan.remainingAmount>0||loan.history.some(entry=>inMonth(entry.date)&&entry.payment!==undefined));
  const amounts=relevantLoans.map(loan=>regularLoanPayment(loan,items));
  const calculated=transactionAdjustedAccounts(accounts,input.transactions);
  const legacy=calculated.filter(a=>accountIds.has(a.id)&&!a.archivedAt&&a.balance>0).map(a=>effectiveMinimum(a,new Date(today+'T12:00:00Z')));
  if(!amounts.some(amount=>amount===undefined)&&[...amounts,...legacy].some(amount=>(amount??0)>0))planned=round([...amounts,...legacy].reduce<number>((sum,amount)=>sum+(amount??0),0));
 }
 return {month,planned,recorded,remaining:planned===null?null:round(Math.max(0,planned-recorded)),percentage:planned===null?null:recorded/planned*100,interest,hasEstimate,netChange:movementKnown?movement:null,accountPayments:[...accountPayments,...loanPayments]};
}
