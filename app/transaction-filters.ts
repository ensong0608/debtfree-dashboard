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
  const options=new Map<string,string>();
  for(const account of accounts)options.set(account.id,account.name+(account.balance<=.005&&(account.baselineBalance??0)>0?' · Paid off':''));
  for(const row of activity)if(!options.has(row.accountId))options.set(row.accountId,`Removed debt (${row.accountId})`);
  for(const loan of loans)options.set(`loan:${loan.id}`,loan.name+(loan.remainingAmount<=.005&&loan.originalAmount>0?' · Paid off':''));
  for(const entry of settlements){const key=settlementFilter(entry,budgets,loans);if(!options.has(key))options.set(key,settlementName(entry,budgets,accounts));}
  return [...options].map(([id,name])=>({id,name}));
}
