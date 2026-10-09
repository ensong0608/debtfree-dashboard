"use client";
import type { BalanceAdjustment, LedgerTransaction } from "./dashboard-data";
import { buildDebtActivity } from "./debt-activity";
const money = new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"});
export function activityMonthLabel(month: string) { return new Date(month + "-01T12:00:00").toLocaleDateString("en-US", {month:"long",year:"numeric"}); }
export default function DebtActivityPanel({accountId, name, transactions, adjustments, expanded=false}: {expanded?:boolean;accountId:string; name:string; transactions:LedgerTransaction[]; adjustments:BalanceAdjustment[]}) {
  const months = buildDebtActivity(accountId, transactions, adjustments).filter(month => month.rows.length > 0);
  if (!months.length) return expanded ? <div className="debt-history compact-activity"><p>No activity yet.</p></div> : null;
  const content = <>
    {months.map(month => <section className="debt-history-month" key={month.month}><header><strong>{activityMonthLabel(month.month)}</strong><span>{month.paymentCount ? `${month.paymentCount} payment${month.paymentCount === 1 ? "" : "s"} recorded · ${money.format(month.payments)}` : `${month.rows.length} balance change${month.rows.length === 1 ? "" : "s"}`}</span></header>
      <ol className="compact-entry-list">{month.rows.map(row => <li className="inline-activity-entry" key={row.id}><time dateTime={row.date}>{row.date.slice(5).replace("-", "/")}</time><span className="inline-activity-title" title={row.title}>{row.title}</span><small className="inline-captured-balance">{row.before !== undefined && row.after !== undefined ? "Captured balances: " + `${money.format(row.before)} → ${money.format(row.after)}` : ""}</small><b className={row.difference <= 0 ? "balance-down" : "balance-up"}>{row.difference === 0 ? "Included · " : row.difference < 0 ? "−" : "+"}{money.format(row.amount)}</b></li>)}</ol>
    </section>)}
  </>;
  return expanded ? <div className="debt-history compact-activity" aria-label={`Recent activity for ${name}`}>{content}</div> : <details className="debt-history compact-activity" aria-label={`Recent activity for ${name}`}><summary><span>Activity</span><i className="activity-chevron" aria-hidden="true">›</i></summary>{content}</details>;
}
