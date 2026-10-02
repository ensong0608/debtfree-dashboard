"use client";
import { useMemo, useState } from "react";
import type { BalanceAdjustment, DebtAccount, LedgerTransaction } from "./dashboard-data";
import { confirmedPaymentTotal, paymentActivity } from "./payments";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function dateLabel(value: string) { return new Date(value + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

export default function PaymentsPage({ readOnly, accounts, transactions, adjustments, message, onRecord, onConfirm, onUndoConfirmation }: {
  readOnly: boolean; accounts: DebtAccount[]; transactions: LedgerTransaction[]; adjustments: BalanceAdjustment[]; message: string;
  onRecord: () => void; onConfirm: (id: string) => void; onUndoConfirmation: (id: string) => void;
}) {
  const [month, setMonth] = useState(currentMonth);
  const [accountId, setAccountId] = useState("all");
  const activity = useMemo(() => paymentActivity(transactions, adjustments), [transactions, adjustments]);
  const names = new Map(accounts.map(a => [a.id, a.name]));
  const knownIds = [...new Set([...accounts.map(a => a.id), ...activity.map(a => a.accountId)])];
  const rows = activity.filter(row => row.date.slice(0, 7) === month && (accountId === "all" || row.accountId === accountId));
  return <div className="screen payments-screen">
    <div className="screen-title"><div><span className="eyebrow">Household activity</span><h1>Payments</h1><p>Recorded payments and lender balance updates, together.</p></div><button type="button" className="primary" disabled={readOnly || !accounts.some(a => a.balance > 0 && !a.archivedAt)} onClick={onRecord}>Record payment</button></div>
    {message && <p className="debt-action-message" role="status">{message}</p>}
    <div className="payments-filters"><label><span>Month</span><input type="month" value={month} onChange={e => setMonth(e.target.value)}/></label><label><span>Debt</span><select value={accountId} onChange={e => setAccountId(e.target.value)}><option value="all">All debts</option>{knownIds.map(id => <option key={id} value={id}>{names.get(id) ?? "Removed debt (" + id + ")"}</option>)}</select></label></div>
    <section className="simple-total" aria-label="Confirmed payment total"><span>Confirmed payments this month</span><strong>{currency.format(confirmedPaymentTotal(transactions, adjustments, month, accountId))}</strong><p>Balance adjustments are excluded until you identify them as payments. Confirmations do not change monthly paid checklists.</p></section>
    <section className="payment-activity" aria-label="Payment and balance activity">
      {rows.length ? rows.map(row => <article key={row.id} data-activity-id={row.id}>
        <div className="activity-heading"><span>{row.kind === "payment" ? "Payment" : "Balance adjustment"} · {dateLabel(row.date)}</span><strong>{row.kind === "adjustment" ? row.difference < 0 ? "−" : "+" : ""}{currency.format(row.amount)}</strong></div>
        <h2>{names.get(row.accountId) ?? "Removed debt"}</h2><p>{row.source}{row.kind === "adjustment" ? " · Not counted as a payment" : ""}</p>
        {row.adjustment && row.difference < 0 && !row.adjustment.confirmedPayment && <details className="payment-confirmation"><summary>This was a payment</summary><p>Confirm only if this entire decrease was a payment. If interest, fees, or spending contributed, keep it as an adjustment. Your balance will not decrease again.</p><button type="button" className="primary" disabled={readOnly} onClick={() => onConfirm(row.adjustment!.id)}>Confirm as payment</button></details>}
        {row.adjustment?.confirmedPayment && <button type="button" className="secondary" disabled={readOnly} onClick={() => onUndoConfirmation(row.adjustment!.id)}>Keep as adjustment</button>}
        <details className="activity-details"><summary>Entry details</summary>{row.before !== undefined && row.after !== undefined && <p>Balance: {currency.format(row.before)} → {currency.format(row.after)}</p>}{row.note && <p>{row.note}</p>}<p>{row.creator?.displayName || row.creator?.email || "Household entry"}</p></details>
      </article>) : <div className="simple-empty"><h2>No activity this month</h2><p>Record a payment here, or update a lender balance in Debts. You do not need to enter every transaction.</p></div>}
    </section>
  </div>;
}
