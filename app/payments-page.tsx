"use client";
import { useEffect, useMemo, useState } from "react";
import type { BalanceAdjustment, DebtAccount, LedgerTransaction } from "./dashboard-data";
import { confirmedPaymentTotal, paymentActivity } from "./payments";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function dateLabel(value: string) { return new Date(value + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

export default function PaymentsPage({ readOnly, accounts, transactions, adjustments, message, onRecord, onConfirm, onUndoConfirmation, onDelete, onRestore }: {
  readOnly: boolean; accounts: DebtAccount[]; transactions: LedgerTransaction[]; adjustments: BalanceAdjustment[]; message: string;
  onRecord: () => void; onConfirm: (id: string) => void; onUndoConfirmation: (id: string) => void; onDelete: (id: string) => void; onRestore: (id: string) => void;
}) {
  const [pendingAction, setPendingAction] = useState<{ id: string; restore: boolean } | null>(null);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") setPendingAction(null); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, []);
  const [month, setMonth] = useState(currentMonth);
  const [accountId, setAccountId] = useState("all");
  const activity = useMemo(() => paymentActivity(transactions, adjustments), [transactions, adjustments]);
  const names = new Map(accounts.map(a => [a.id, a.name]));
  const knownIds = [...new Set([...accounts.map(a => a.id), ...activity.map(a => a.accountId)])];
  const rows = activity.filter(row => row.date.slice(0, 7) === month && (accountId === "all" || row.accountId === accountId));
  const deleted = transactions.filter(t => t.type === "payment" && t.deletedAt && !t.replacedByTransactionId && t.date.slice(0, 7) === month && (accountId === "all" || t.accountId === accountId));
  const pending = transactions.find(t => t.id === pendingAction?.id && t.type === "payment" && !t.replacedByTransactionId && Boolean(t.deletedAt) === pendingAction?.restore);
  const pendingAccount = accounts.find(a => a.id === pending?.accountId);
  const nextBalance = pending && pendingAccount ? Math.max(0, Math.round((pendingAccount.balance + (pendingAction?.restore ? -pending.amount : pending.amount)) * 100) / 100) : null;
  return <div className="screen payments-screen">
    <div className="screen-title"><div><span className="eyebrow">Household activity</span><h1>Payments</h1><p>Recorded payments and lender balance updates, together.</p></div><button type="button" className="primary" disabled={readOnly || !accounts.some(a => a.balance > 0 && !a.archivedAt)} onClick={onRecord}>Record payment</button></div>
    {message && <p className="debt-action-message" role="status">{message}</p>}
    <div className="payments-filters"><label><span>Month</span><input type="month" value={month} onChange={e => setMonth(e.target.value)}/></label><label><span>Debt</span><select value={accountId} onChange={e => setAccountId(e.target.value)}><option value="all">All debts</option>{knownIds.map(id => <option key={id} value={id}>{names.get(id) ?? "Removed debt (" + id + ")"}</option>)}</select></label></div>
    <section className="simple-total" aria-label="Confirmed payment total"><span>Confirmed payments this month</span><strong>{currency.format(confirmedPaymentTotal(transactions, adjustments, month, accountId))}</strong><p>Balance adjustments are excluded until you identify them as payments. Confirmations do not change monthly paid checklists.</p></section>
    <section className="payment-activity" aria-label="Payment and balance activity">
      {rows.length ? rows.map(row => <article key={row.id} data-activity-id={row.id}>
        <div className="activity-heading"><span>{row.kind === "payment" ? "Payment" : row.kind === "interest" ? "Estimated interest" : "Balance adjustment"} · {dateLabel(row.date)}</span><strong>{row.kind !== "payment" ? row.difference < 0 ? "−" : "+" : ""}{currency.format(row.amount)}</strong></div>
        <h2>{names.get(row.accountId) ?? "Removed debt"}</h2><p>{row.source}{row.kind === "adjustment" ? " · Not counted as a payment" : ""}</p>
        {row.adjustment && row.difference < 0 && !row.adjustment.confirmedPayment && <details className="payment-confirmation"><summary>This was a payment</summary><p>Confirm only if this entire decrease was a payment. If interest, fees, or spending contributed, keep it as an adjustment. Your balance will not decrease again.</p><button type="button" className="primary" disabled={readOnly} onClick={() => onConfirm(row.adjustment!.id)}>Confirm as payment</button></details>}
        {row.adjustment?.confirmedPayment && <button type="button" className="secondary" disabled={readOnly} onClick={() => onUndoConfirmation(row.adjustment!.id)}>Keep as adjustment</button>}
        {row.kind === "payment" && !row.adjustment && <button type="button" className="danger payment-delete" disabled={readOnly} onClick={() => setPendingAction({ id: row.id.slice("transaction:".length), restore: false })} aria-label={"Delete payment of " + currency.format(row.amount) + " for " + (names.get(row.accountId) ?? "removed debt")}>Delete payment</button>}
        <details className="activity-details"><summary>Entry details</summary>{row.before !== undefined && row.after !== undefined && <p>Balance: {currency.format(row.before)} → {currency.format(row.after)}</p>}{row.note && <p>{row.note}</p>}<p>{row.creator?.displayName || row.creator?.email || "Household entry"}</p></details>
      </article>) : <div className="simple-empty"><h2>No activity this month</h2><p>Record a payment here, or update a lender balance in Debts. You do not need to enter every transaction.</p></div>}
    </section>
    {deleted.length > 0 && <details className="deleted-payments"><summary>Deleted payments ({deleted.length})</summary><p>Retained for recovery. These payments do not reduce balances or count toward payments.</p>{deleted.map(t => <article key={t.id}><div><strong>{names.get(t.accountId) ?? "Removed debt"} · {currency.format(t.amount)}</strong><p>{dateLabel(t.date)}</p></div><button type="button" className="secondary" disabled={readOnly} onClick={() => setPendingAction({ id: t.id, restore: true })} aria-label={"Restore payment of " + currency.format(t.amount) + " for " + (names.get(t.accountId) ?? "removed debt")}>Restore</button></article>)}</details>}
    {pending && pendingAction && <div className="modal-backdrop" onMouseDown={event => { if (event.currentTarget === event.target) setPendingAction(null); }}><section className="modal debt-action-modal" role="dialog" aria-modal="true" aria-labelledby="payment-delete-title"><header><div><span>Payment correction</span><h2 id="payment-delete-title">{pendingAction.restore ? "Restore payment?" : "Delete payment?"}</h2></div><button type="button" aria-label="Close payment confirmation" onClick={() => setPendingAction(null)}>×</button></header><div className="debt-action-form"><p>{currency.format(pending.amount)} for {names.get(pending.accountId) ?? "removed debt"} · {dateLabel(pending.date)}</p><p>{pendingAction.restore ? "Restoring applies this payment’s balance reduction again." : "Deleting undoes this payment’s balance reduction. Use this for duplicates or mistakes."}</p>{pendingAccount && nextBalance !== null && <div className="balance-change-preview"><div><span>Current balance</span><strong>{currency.format(pendingAccount.balance)}</strong></div><i aria-hidden="true">→</i><div><span>Balance after</span><strong>{currency.format(nextBalance)}</strong></div></div>}<p>{pendingAction.restore ? "The entry will count toward payments again." : "The original entry stays in Deleted payments so you can restore it. Existing balance-update history and paid checklists are retained."}</p></div><footer><div><button type="button" className="secondary" onClick={() => setPendingAction(null)}>Cancel</button><button type="button" className={pendingAction.restore ? "primary" : "danger"} disabled={readOnly} onClick={() => { (pendingAction.restore ? onRestore : onDelete)(pending.id); setPendingAction(null); }}>{pendingAction.restore ? "Confirm restore" : "Confirm delete"}</button></div></footer></section></div>}
  </div>;
}
