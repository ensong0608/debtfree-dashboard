"use client";
import type { LoanTracker } from "./loan-progress";
import { recentDebtMonths } from "./debt-activity";
import { activityMonthLabel } from "./debt-activity-panel";
const money = new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"});
export default function LoanActivityPanel({loan}:{loan:LoanTracker}) {
 const history=[...loan.history].sort((a,b)=>a.date.localeCompare(b.date)||a.recordedAt.localeCompare(b.recordedAt));
 const months=recentDebtMonths().map(month=>({month,entries:history.map((entry,index)=>({entry,prior:history[index-1]})).filter(row=>row.entry.date.slice(0,7)===month).reverse()})).filter(month=>month.entries.length);
 if(!months.length)return null;
 return <details className="debt-history compact-activity" aria-label={`Recent activity for ${loan.name}`}><summary>Activity</summary>{months.map(({month,entries},index)=>{
 const payments=entries.filter(row=>row.entry.payment!==undefined);
 return <details className="debt-history-month" key={month} open={index===0}><summary><strong>{activityMonthLabel(month)}</strong><span>{payments.length?`${payments.length} payment${payments.length===1?'':'s'} recorded`:`${entries.length} balance check${entries.length===1?'':'s'}`}</span></summary><ol className="compact-entry-list">{entries.map(({entry,prior},i)=><li key={entry.recordedAt+'-'+i}><details className="compact-activity-entry"><summary><time dateTime={entry.date}>{entry.date.slice(5).replace('-','/')}</time><span>{entry.payment!==undefined?'Payment':'Balance check'}</span><b className={prior?(entry.amount<=prior.amount?'balance-down':'balance-up'):''}>{prior?(entry.amount<=prior.amount?'−':'+'):''}{money.format(prior?Math.abs(entry.amount-prior.amount):entry.amount)}</b></summary><div className="activity-record-details"><p>Remaining balance {money.format(entry.amount)} · {entry.date}</p>{prior&&<p>Balance captured: {money.format(prior.amount)} → {money.format(entry.amount)}</p>}{entry.payment!==undefined&&<p>Payment {money.format(entry.payment)} · Principal {money.format(entry.principal??0)} · Interest {money.format(entry.interest??0)} · Escrow {money.format(entry.escrow??0)}</p>}</div></details></li>)}</ol></details>;
 })}</details>;
}
