"use client";
import type { BalanceAdjustment, LedgerTransaction } from "./dashboard-data";
import { buildDebtActivity } from "./debt-activity";
const money = new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"});
export function activityMonthLabel(month: string) { return new Date(month + "-01T12:00:00").toLocaleDateString("en-US", {month:"long",year:"numeric"}); }
export default function DebtActivityPanel({accountId, name, transactions, adjustments}: {accountId:string; name:string; transactions:LedgerTransaction[]; adjustments:BalanceAdjustment[]}) {
  const months = buildDebtActivity(accountId, transactions, adjustments).filter(month => month.rows.length > 0);
  if (!months.length) return null;
  return <details className="debt-history compact-activity" aria-label={`Recent activity for ${name}`}><summary>Activity</summary>
    {months.map((month, index) => <details className="debt-history-month" key={month.month} open={index === 0}><summary><strong>{activityMonthLabel(month.month)}</strong><span>{month.paymentCount ? `${month.paymentCount} payment${month.paymentCount === 1 ? "" : "s"} recorded · ${money.format(month.payments)}` : `${month.rows.length} balance change${month.rows.length === 1 ? "" : "s"}`}</span></summary>
      <ol className="compact-entry-list">{month.rows.map(row => <li key={row.id}><details className="compact-activity-entry"><summary><time dateTime={row.date}>{row.date.slice(5).replace("-", "/")}</time><span>{row.title}</span><b className={row.difference <= 0 ? "balance-down" : "balance-up"}>{row.difference <= 0 ? "−" : "+"}{money.format(row.amount)}</b></summary><div className="activity-record-details"><p>{row.difference <= 0 ? "Balance down" : "Balance up"} · {row.date}</p><p>{row.source}{row.creator?.displayName ? ` · ${row.creator.displayName}` : ""}</p>{row.before !== undefined && row.after !== undefined && <p>Balance captured: {money.format(row.before)} → {money.format(row.after)}</p>}{row.note && <p>{row.note}</p>}</div></details></li>)}</ol>
    </details>)}
  </details>;
}
