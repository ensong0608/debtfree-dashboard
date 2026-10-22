"use client";
import type {BalanceAdjustment,LedgerTransaction} from './dashboard-data';
import {cardBalanceHistory} from './card-balance-history';
import {householdDate} from './household-date';
import {createHouseholdMoneyFormatter} from './household-currency';
import {useHouseholdCurrency} from './household-currency-context';
import styles from './debt-experience.module.css';
export default function CardProgressChart({id,current,transactions,adjustments}:{id:string;current:number;transactions:LedgerTransaction[];adjustments:BalanceAdjustment[]}) {
 const money=createHouseholdMoneyFormatter(useHouseholdCurrency(),{minimumFractionDigits:2,maximumFractionDigits:2});
 const points=cardBalanceHistory(id,current,transactions,adjustments,householdDate());
 const max=Math.max(1,...points.map(p=>p.balance));
 const x=(i:number)=>points.length===1?250:30+i/(points.length-1)*440;
 const y=(amount:number)=>145-amount/max*115;
 return <figure className={styles.cardTrend}><figcaption>Balance history</figcaption><svg viewBox="0 0 500 180" role="img" aria-label="Card balance after recorded payments, purchases, fees and adjustments"><polyline points={points.map((p,i)=>x(i)+','+y(p.balance)).join(' ')} fill="none" stroke="#12877f" strokeWidth="3"/>{points.map((p,i)=><circle key={p.id} cx={x(i)} cy={y(p.balance)} r="4" fill="#12877f"><title>{p.date} · {p.label}: {money.format(p.balance)}</title></circle>)}<text x="30" y="174">{points[0]?.date}</text><text x="470" y="174" textAnchor="end">{points.at(-1)?.date}</text></svg><div className="sr-only"><table><caption>Recorded balance history</caption><tbody>{points.map(p=><tr key={p.id}><th>{p.date} · {p.label}</th><td>{money.format(p.balance)}</td></tr>)}</tbody></table></div></figure>;
}
