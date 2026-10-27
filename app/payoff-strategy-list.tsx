"use client";
import InstitutionIcon from './institution-icon';
import type { PayoffStrategyRow } from './payoff-strategy';
import { useHouseholdCurrency } from './household-currency-context';
import { createHouseholdMoneyFormatter } from './household-currency';
export default function PayoffStrategyList({ rows, limit }: { rows: PayoffStrategyRow[]; limit?: number }) {
 const money=createHouseholdMoneyFormatter(useHouseholdCurrency(),{minimumFractionDigits:2,maximumFractionDigits:2});
 return rows.length ? <ol className={`payoff-strategy-list ${limit ? 'strategy-preview-rows' : 'strategy-full-rows'}`}>{rows.slice(0,limit).map((row,index)=>{
  const date=row.payoffMonth ? new Date(row.payoffMonth+'-01T12:00:00') : null;
  return <li key={row.id}><span className="strategy-rank">{index+1}</span><InstitutionIcon institutionKey={row.institutionKey} debtType={row.debtType ?? 'Debt account'} accountName={row.name}/><div className="strategy-account"><strong>{row.name}</strong><small>{row.apr===undefined ? '—' : row.apr.toFixed(2)+(row.rateEstimated?'% assumed APR':'% APR')}</small></div><div className="strategy-result">{!limit && <strong className="money-value">{money.format(row.balance)}</strong>}{date ? <time dateTime={row.payoffMonth!} aria-label={`${row.estimated?'Estimated':'Projected'} payoff ${date.toLocaleDateString('en-US',{month:'long',year:'numeric'})}`}>{row.estimated?'≈ ':''}{date.toLocaleDateString('en-US',{month:'short',year:'numeric'})}</time> : <span className="strategy-date" aria-label="Payoff date unavailable">—</span>}</div></li>
 })}</ol> : <p className="strategy-empty">No outstanding cards or loans.</p>;
}
