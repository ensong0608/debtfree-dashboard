import type {CashflowItem, DebtAccount, PlanSettlement} from './dashboard-data.ts';
import {linkedLoanPayment, type LoanTracker} from './loan-progress.ts';

/** Resolve by identity only. The saved name remains the fallback for removed items. */
export function settlementItem(entry:PlanSettlement,budgets:Record<string,CashflowItem[]>) {
  const dated=Object.entries(budgets).sort(([a],[b])=>b.localeCompare(a));
  const original=budgets[entry.date.slice(0,7)]?.find(item=>item.id===entry.targetId)
    ??dated.flatMap(([,items])=>items).find(item=>item.id===entry.targetId||(item.recurringSourceId??item.id)===entry.targetId);
  if(!original)return undefined;
  const identity=original.recurringSourceId??original.id;
  return dated.flatMap(([,items])=>items).find(item=>(item.recurringSourceId??item.id)===identity)??original;
}
export function settlementName(entry:PlanSettlement,budgets:Record<string,CashflowItem[]>,accounts:DebtAccount[]=[]) {
  return entry.kind==='minimum'?accounts.find(account=>account.id===entry.targetId)?.name??entry.name:settlementItem(entry,budgets)?.name??entry.name;
}
export function settlementFilter(entry:PlanSettlement,budgets:Record<string,CashflowItem[]>,loans:LoanTracker[]) {
  if(entry.kind==='minimum')return entry.targetId;
  const item=settlementItem(entry,budgets);
  if(!item)return `budget:${entry.targetId}`;
  const identity=item.recurringSourceId??item.id;
  const items=Object.values(budgets).find(items=>items.includes(item))??[];
  const loan=loans.find(loan=>{const linked=linkedLoanPayment(loan,items);return linked&&(linked.recurringSourceId??linked.id)===identity;});
  return loan?`loan:${loan.id}`:`budget:${identity}`;
}
export function transactionAccountOptions(accounts:DebtAccount[],activity:{accountId:string}[],loans:LoanTracker[],settlements:PlanSettlement[],budgets:Record<string,CashflowItem[]>) {
  const options=new Map<string,{name:string;paidOff:boolean}>();
  for(const account of accounts)options.set(account.id,{name:account.name,paidOff:account.balance<=.005});
  for(const row of activity)if(!options.has(row.accountId))options.set(row.accountId,{name:`Removed debt (${row.accountId})`,paidOff:false});
  for(const loan of loans)options.set(`loan:${loan.id}`,{name:loan.name,paidOff:loan.remainingAmount<=.005&&loan.originalAmount>0});
  for(const entry of settlements){const key=settlementFilter(entry,budgets,loans);if(!options.has(key))options.set(key,{name:settlementName(entry,budgets,accounts),paidOff:false});}
  return [...options].map(([id,option])=>({id,...option})).sort((a,b)=>Number(a.paidOff)-Number(b.paidOff));
}
