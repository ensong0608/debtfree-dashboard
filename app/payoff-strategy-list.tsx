"use client";
import type { PayoffStrategyRow } from './payoff-strategy';
import { useHouseholdCurrency } from './household-currency-context';
import { createHouseholdMoneyFormatter } from './household-currency';
export default function PayoffStrategyList({ rows, limit }: { rows: PayoffStrategyRow[]; limit?: number }) {
  const money = createHouseholdMoneyFormatter(useHouseholdCurrency(), {minimumFractionDigits:2, maximumFractionDigits:2});
  return rows.length ? <ol className="payoff-strategy-list">{rows.slice(0,limit).map((row,index) => <li key={row.id}><span className="strategy-rank">{index+1}</span><div><strong>{row.name}</strong><small>{row.apr === undefined ? '—' : `${row.apr.toFixed(2)}% APR`} · {money.format(row.balance)}</small></div>{row.payoffMonth ? <time dateTime={row.payoffMonth} aria-label={`Projected payoff ${new Date(row.payoffMonth+'-01T12:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'})}`}>{new Date(row.payoffMonth+'-01T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'})}</time> : <span className="strategy-date" aria-label="Payoff date unavailable">—</span>}</li>)}</ol> : <p className="strategy-empty">No outstanding cards or loans.</p>;
}
