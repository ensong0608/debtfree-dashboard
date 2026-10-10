"use client";
import type { DebtAccount } from "./dashboard-data";
import { monthlyInterest, round } from "./payoff-engine";
const money=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"});
export default function DebtInsightsPage({accounts,onPlan,onProgress}:{accounts:DebtAccount[];onPlan:()=>void;onProgress:()=>void}){
 const active=accounts.filter(account=>!account.archivedAt&&account.balance>0);
 const total=round(active.reduce((sum,account)=>sum+account.balance,0));
 const costs=active.map(account=>({account,cost:monthlyInterest(account)})).sort((a,b)=>b.cost-a.cost||a.account.name.localeCompare(b.account.name));
 const interest=round(costs.reduce((sum,item)=>sum+item.cost,0));
 return <div className="screen stats-screen debt-insights-screen"><div className="screen-title"><div><h1>Stats & projections</h1><p>See where your card and other account debt sits, and which accounts cost the most. House and car trackers are separate.</p></div></div>{!active.length?<section className="simple-empty"><h2>No outstanding account balances</h2><p>These insights update when you add or update debt accounts.</p></section>:<>
 <section className="insights-summary"><span>Estimated interest each month</span><strong>{money.format(interest)}</strong><p>{interest>0?`At today’s balances, roughly ${money.format(interest)} could go to interest before reducing what you owe.`:"Your saved rates and interest amounts currently estimate no monthly interest."}</p><small>Uses saved APRs or monthly interest amounts. Statement interest may differ; this estimate does not add a transaction.</small></section>
 <section className="insights-list"><h2>Where interest is coming from</h2>{costs.map(({account,cost})=><article key={account.id}><div><strong>{account.name}</strong><small>{money.format(account.balance)} balance · {account.apr.toFixed(2)}% APR{account.interestFee>0?" · Uses saved monthly interest":""}</small></div><b>{money.format(cost)}<small>/ month estimated</small></b></article>)}</section>
 <details className="insights-breakdown"><summary>Where your debt sits · {money.format(total)}</summary>{[...active].sort((a,b)=>b.balance-a.balance).map(account=><article key={account.id}><div><strong>{account.name}</strong><b>{money.format(account.balance)}</b></div><div className="insights-share"><i style={{width:`${account.balance/total*100}%`}}/></div><small>{(account.balance/total*100).toFixed(1)}% of tracked account debt</small></article>)}</details>
 </>}
 <section className="insights-next"><h2>Want to see when you could finish?</h2><p>Payoff Calculator calculates how long the monthly amount you enter could take. It uses that amount alone, without adding minimum payments or past transactions.</p><button type="button" className="secondary" onClick={onPlan}>Open payoff calculator ›</button><p>To see what has already changed, use Progress.</p><button type="button" className="secondary" onClick={onProgress}>View actual progress ›</button></section></div>;
}
