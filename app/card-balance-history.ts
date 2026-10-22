import type {BalanceAdjustment,LedgerTransaction} from './dashboard-data.ts';
import {paymentActivity} from './payments.ts';
import {round} from './payoff-engine.ts';
/** Display recorded activity in effective-date order, anchored to captured balances and today's balance. */
export function cardBalanceHistory(id:string,current:number,transactions:LedgerTransaction[],adjustments:BalanceAdjustment[],today:string) {
 const rows=paymentActivity(transactions,adjustments).filter(row=>row.accountId===id);
 let cursor=current;
 const points=rows.map(row=>{const balance=Number.isFinite(row.after)?row.after!:cursor;cursor=Number.isFinite(row.before)?row.before!:round(balance-row.difference);return {id:row.id,date:row.date,balance,label:row.title};}).filter(p=>p.balance>=0&&Number.isFinite(p.balance)).reverse();
 if(points.length&&Number.isFinite(cursor)&&cursor>=0)points.unshift({id:'before-first',date:points[0].date,balance:cursor,label:'Before first recorded activity'});
 points.push({id:'current',date:today,balance:current,label:'Current balance'});
 return points;
}
