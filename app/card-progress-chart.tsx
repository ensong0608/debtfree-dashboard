"use client";
import type {BalanceAdjustment,LedgerTransaction} from './dashboard-data';
import {cardBalanceHistory} from './card-balance-history';
import {householdDate} from './household-date';
import {createHouseholdMoneyFormatter} from './household-currency';
import {useHouseholdCurrency} from './household-currency-context';
import styles from './debt-experience.module.css';
export default function CardProgressChart({id,current,transactions,adjustments}:{id:string;current:number;transactions:LedgerTransaction[];adjustments:BalanceAdjustment[]}) {
 const unit=useHouseholdCurrency();
 const money=createHouseholdMoneyFormatter(unit,{minimumFractionDigits:2,maximumFractionDigits:2});
 const axisMoney=createHouseholdMoneyFormatter(unit,{notation:'compact',maximumFractionDigits:1});
 const today=householdDate();
 const points=cardBalanceHistory(id,current,transactions,adjustments,today).filter(point=>point.date<=today);
 const day=(date:string)=>Date.parse(date+'T12:00:00Z');
 const start=day(points[0]?.date??today),end=Math.max(start+86400000,day(today));
 const low=Math.min(current,...points.map(p=>p.balance)),high=Math.max(current,...points.map(p=>p.balance));
 const padding=Math.max(1,(high-low)*.2,high===low?high*.05:0);
 const min=Math.max(0,low-padding),max=Math.max(min+1,high+padding);
 const x=(date:string)=>70+(day(date)-start)/(end-start)*266;
 const y=(balance:number)=>154-(balance-min)/(max-min)*120;
 const dateLabel=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
 const path=points.map((point,index)=>(index===0?'M':'H')+x(point.date)+(index===0?' '+y(point.balance):' V'+y(point.balance))).join(' ');
 const change=current-(points[0]?.balance??current);
 return <figure className={styles.cardTrend}>
  <figcaption><div><strong>Balance history</strong><span>{dateLabel(points[0]?.date??today)} – {dateLabel(today)}</span></div><div><strong className="money-value">{money.format(current)}</strong><span>{change===0?'No net change':`${money.format(Math.abs(change))} ${change<0?'lower':'higher'}`}</span></div></figcaption>
  {points.length>1?<svg viewBox="0 0 360 190" role="img" aria-label="Recorded balance history, with calendar dates along the bottom and balance amounts on the left">
   {[min,(min+max)/2,max].map(value=><g key={value}><line x1="70" x2="336" y1={y(value)} y2={y(value)} stroke="var(--theme-chart-grid)" strokeDasharray="3 5"/><text x="60" y={y(value)+4} textAnchor="end">{axisMoney.format(value)}</text></g>)}
   <path d={path} fill="none" stroke="var(--theme-chart-1)" strokeWidth="3" strokeLinejoin="round"/>
   {points.map(point=><circle key={point.id} cx={x(point.date)} cy={y(point.balance)} r={point.id==='current'?5:3} fill="var(--theme-chart-1)"><title>{dateLabel(point.date)} · {point.label}: {money.format(point.balance)}</title></circle>)}
   <text x="70" y="183">{dateLabel(points[0].date)}</text><text x="336" y="183" textAnchor="end">{dateLabel(today)}</text>
  </svg>:<p className={styles.historyEmpty}>Your balance trend will appear as you record transactions.</p>}
  <details className={styles.balanceRecords}><summary>View balance records ({points.length})</summary><ol>{[...points].reverse().map(point=><li key={point.id}><span><time dateTime={point.date}>{dateLabel(point.date)}</time><small>{point.label}</small></span><strong className="money-value">{money.format(point.balance)}</strong></li>)}</ol></details>
 </figure>;
}
