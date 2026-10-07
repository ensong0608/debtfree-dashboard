"use client";
import type { BalanceAdjustment, LedgerTransaction } from "./dashboard-data";
import { buildDebtActivity } from "./debt-activity";
const money = new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"});
export function activityMonthLabel(month: string) { return new Date(month + "-01T12:00:00").toLocaleDateString("en-US", {month:"long",year:"numeric"}); }
export default function DebtActivityPanel({accountId, name, transactions, adjustments}: {accountId:string; name:string; transactions:LedgerTransaction[]; adjustments:BalanceAdjustment[]}) {
  const months = buildDebtActivity(accountId, transactions, adjustments);
  return <details className="debt-history" aria-label={`Six-month activity for ${name}`}><summary>Activity · last 6 months</summary>
    <p className="activity-explanation">Recorded payments, purchases, interest, and balance updates. A balance decrease counts as a payment only when confirmed. Older records remain saved.</p>
    {months.map(month => <details className="debt-history-month" key={month.month} open={month.month === months[0].month}><summary><strong>{activityMonthLabel(month.month)}</strong><span>{month.paymentCount ? `${month.paymentCount} payment${month.paymentCount === 1 ? "" : "s"} recorded · ${money.format(month.payments)}` : "No payments recorded"}</span></summary>
      {month.rows.length ? <><dl className="activity-month-totals"><div><dt>Balance increases</dt><dd>+{money.format(month.increases)}</dd></div><div><dt>Balance decreases</dt><dd>−{money.format(month.decreases)}</dd></div><div><dt>Recorded net change</dt><dd>{month.netChange < 0 ? "−" : "+"}{money.format(Math.abs(month.netChange))}</dd></div></dl><ol className="activity-entry-list">{month.rows.map(row => <li key={row.id}><div><strong>{row.title}</strong><time>{row.date}</time></div><b className={row.difference <= 0 ? "balance-down" : "balance-up"}>{row.difference <= 0 ? "Balance down −" : "Balance up +"}{money.format(row.amount)}</b><small>{row.source}{row.creator?.displayName ? ` · ${row.creator.displayName}` : ""}</small>{row.before !== undefined && row.after !== undefined && <small>Balance captured: {money.format(row.before)} → {money.format(row.after)}</small>}{row.note && <p>{row.note}</p>}</li>)}</ol></> : <p>No activity recorded for this month.</p>}
    </details>)}
  </details>;
}
