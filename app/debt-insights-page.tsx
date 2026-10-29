"use client";
import InstitutionIcon from './institution-icon';
import InfoTooltip from "./info-tooltip";
import { createHouseholdMoneyFormatter, } from "./household-currency";
import { useHouseholdCurrency } from "./household-currency-context";
import type { DebtAccount } from "./dashboard-data";
import { monthlyInterest, forecastApr, round } from "./payoff-engine";

export default function DebtInsightsPage({accounts,onPlan,onProgress}:{accounts:DebtAccount[];onPlan:()=>void;onProgress:()=>void}){
  const householdCurrency = useHouseholdCurrency();
  const money = createHouseholdMoneyFormatter(householdCurrency, {style:"currency",});
 const active=accounts.filter(account=>!account.archivedAt&&account.balance>0);
 const total=round(active.reduce((sum,account)=>sum+account.balance,0));
 const costs=active.map(account=>({account,cost:monthlyInterest(account)})).sort((a,b)=>b.cost-a.cost||a.account.name.localeCompare(b.account.name));
 const interest=round(costs.reduce((sum,item)=>sum+item.cost,0));
 return <div className="screen stats-screen debt-insights-screen"><div className="screen-title"><div><h1>Stats & projections</h1><p>See where your card and other account debt sits, and which accounts cost the most. House and car trackers are separate.</p></div></div>{!active.length?<section className="simple-empty"><h2>No outstanding account balances</h2><p>These insights update when you add or update debt accounts.</p></section>:<>
 <section className="insights-summary"><span><InfoTooltip label="Estimated interest each month">{"The sum of monthly interest estimates for active card and other debt accounts. Estimates use the balance, APR and promotional terms. This does not add a transaction."}</InfoTooltip></span><strong><span className="money-value">{money.format(interest)}</span></strong><p>{interest>0?`At today’s balances, roughly ${money.format(interest)} could go to interest before reducing what you owe.`:"Your saved APRs currently estimate no monthly interest."}</p><small>Uses APR and promotional terms. Statement interest may differ; this estimate does not add a transaction.</small></section>
 <section className="insights-list"><h2>Where interest is coming from</h2>{costs.map(({account,cost})=><article key={account.id}><InstitutionIcon institutionKey={account.institutionKey} debtType={account.type} accountName={account.name}/><div><strong>{account.name}</strong><small><span className="money-value">{money.format(account.balance)}</span> balance · {forecastApr(account,1).toFixed(2)}% APR</small></div><b><span className="money-value">{money.format(cost)}</span><small>/ month estimated</small></b></article>)}</section>
 <details className="insights-breakdown"><summary>Where your debt sits · <span className="money-value">{money.format(total)}</span></summary>{[...active].sort((a,b)=>b.balance-a.balance).map(account=><article key={account.id}><InstitutionIcon institutionKey={account.institutionKey} debtType={account.type} accountName={account.name}/><div><strong>{account.name}</strong><b><span className="money-value">{money.format(account.balance)}</span></b></div><div className="insights-share"><i style={{width:`${account.balance/total*100}%`}}/></div><small>{(account.balance/total*100).toFixed(1)}% of tracked account debt</small></article>)}</details>
 </>}
 <section className="insights-next"><h2>Want to see when you could finish?</h2><p>Payoff Schedule shows your projected payments, interest and remaining balances.</p><button type="button" className="secondary" onClick={onPlan}>Open Payoff Schedule ›</button><p>To see what has already changed, use Progress.</p><button type="button" className="secondary" onClick={onProgress}>View actual progress ›</button></section></div>;
}
