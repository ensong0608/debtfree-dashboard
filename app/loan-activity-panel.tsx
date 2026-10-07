"use client";
import type { LoanTracker } from "./loan-progress";
import { recentDebtMonths } from "./debt-activity";
import { activityMonthLabel } from "./debt-activity-panel";
const money = new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"});
export default function LoanActivityPanel({loan}:{loan:LoanTracker}) {
 const history=[...loan.history].sort((a,b)=>a.date.localeCompare(b.date)||a.recordedAt.localeCompare(b.recordedAt));
 return <details className="debt-history" aria-label={`Six-month activity for ${loan.name}`}><summary>Activity · last 6 months</summary><p className="activity-explanation">Payments are counted only when recorded. Lender balance checks do not confirm a payment. Older records remain saved.</p>{recentDebtMonths().map(month=>{
 const entries=history.map((entry,index)=>({entry,prior:history[index-1]})).filter(row=>row.entry.date.slice(0,7)===month).reverse();
 const payments=entries.filter(row=>row.entry.payment!==undefined);
 return <details className="debt-history-month" key={month}><summary><strong>{activityMonthLabel(month)}</strong><span>{payments.length?`${payments.length} payment${payments.length===1?'':'s'} recorded · ${money.format(payments.reduce((sum,row)=>sum+(row.entry.payment??0),0))}`:'No payments recorded'}</span></summary>{entries.length?<ol className="activity-entry-list">{entries.map(({entry,prior},i)=><li key={entry.recordedAt+'-'+i}><div><strong>{entry.payment!==undefined?'Payment recorded':'Balance check'}</strong><time>{entry.date}</time></div><p>Remaining balance {money.format(entry.amount)}</p>{prior&&<b className={entry.amount<=prior.amount?'balance-down':'balance-up'}>{entry.amount<=prior.amount?'Balance down −':'Balance up +'}{money.format(Math.abs(entry.amount-prior.amount))}</b>}{entry.payment!==undefined&&<p>Payment {money.format(entry.payment)} · Principal {money.format(entry.principal??0)} · Interest {money.format(entry.interest??0)} · Escrow {money.format(entry.escrow??0)}</p>}</li>)}</ol>:<p>No activity recorded for this month.</p>}</details>;
 })}</details>;
}
