"use client";
import type { LoanTracker } from "./loan-progress";
import { recentDebtMonths } from "./debt-activity";
import { activityMonthLabel } from "./debt-activity-panel";
const money = new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"});
export default function LoanActivityPanel({loan,expanded=false}:{loan:LoanTracker;expanded?:boolean}) {
 const history=[...loan.history].sort((a,b)=>a.date.localeCompare(b.date)||a.recordedAt.localeCompare(b.recordedAt));
 const months=recentDebtMonths().map(month=>({month,entries:history.map((entry,index)=>({entry,prior:history[index-1]})).filter(row=>row.entry.date.slice(0,7)===month).reverse()})).filter(month=>month.entries.length);
 if(!months.length)return expanded?<div className="debt-history compact-activity"><p>No activity yet.</p></div>:null;
 const content=<>{months.map(({month,entries})=>{
 const payments=entries.filter(row=>row.entry.payment!==undefined);
 return <section className="debt-history-month" key={month}><header><strong>{activityMonthLabel(month)}</strong><span>{payments.length?`${payments.length} payment${payments.length===1?'':'s'} recorded`:`${entries.length} balance check${entries.length===1?'':'s'}`}</span></header><ol className="compact-entry-list">{entries.map(({entry,prior},i)=><li className="inline-activity-entry" key={entry.recordedAt+'-'+i}><time dateTime={entry.date}>{entry.date.slice(5).replace('-','/')}</time><span className="inline-activity-title">{entry.payment!==undefined?`Payment ${money.format(entry.payment)}`:'Balance check'}</span><small className="inline-captured-balance">{prior?`${money.format(prior.amount)} → ${money.format(entry.amount)}`:money.format(entry.amount)}</small><b className={prior?(entry.amount<=prior.amount?'balance-down':'balance-up'):''}>{prior?(entry.amount<=prior.amount?'−':'+'):''}{money.format(prior?Math.abs(entry.amount-prior.amount):entry.amount)}</b></li>)}</ol></section>;
 })}</>;
 return expanded?<div className="debt-history compact-activity" aria-label={`Recent activity for ${loan.name}`}>{content}</div>:<details className="debt-history compact-activity" aria-label={`Recent activity for ${loan.name}`}><summary><span>Activity</span><i className="activity-chevron" aria-hidden="true">›</i></summary>{content}</details>;
}
