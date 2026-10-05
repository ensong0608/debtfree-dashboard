"use client";
import { useEffect, useMemo, useState } from "react";
import type { BalanceAdjustment, DebtAccount, LedgerTransaction } from "./dashboard-data";
import { confirmedPaymentTotal, paymentActivity } from "./payments";
import DebtEntryDialog from "./debt-entry-dialog";
import type { EntryCommand } from "./debt-transactions";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function dateLabel(value: string) { return new Date(value + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

export default function PaymentsPage({ readOnly, accounts, transactions, adjustments, message, onRecord, onConfirm, onUndoConfirmation, storedAccounts, onChange, onDialog }: {
  readOnly: boolean; accounts: DebtAccount[]; transactions: LedgerTransaction[]; adjustments: BalanceAdjustment[]; message: string;
  onRecord: () => void; onConfirm: (id: string) => void; onUndoConfirmation: (id: string) => void; storedAccounts: DebtAccount[]; onChange: (command: EntryCommand, expected: string) => string | null; onDialog: (open: boolean) => void;
}) {
  useEffect(() => () => onDialog(false), [onDialog]);
  const [pendingAction, setPendingAction] = useState<EntryCommand | null>(null);
  const open = (command: EntryCommand) => { setPendingAction(command); onDialog(true); };
  const close = () => { setPendingAction(null); onDialog(false); };
  const [month, setMonth] = useState(currentMonth);
  const [accountId, setAccountId] = useState("all");
  const activity = useMemo(() => paymentActivity(transactions, adjustments), [transactions, adjustments]);
  const names = new Map(accounts.map(a => [a.id, a.name]));
  const knownIds = [...new Set([...accounts.map(a => a.id), ...activity.map(a => a.accountId)])];
  const rows = activity.filter(row => row.date.slice(0, 7) === month && (accountId === "all" || row.accountId === accountId));
  const deleted = [
    ...transactions.filter(t => t.deletedAt && !t.replacedByTransactionId).map(t => ({ id: "transaction:" + t.id, accountId: t.accountId, amount: t.amount, date: t.date, kind: t.type })),
    ...adjustments.filter(a => a.deletedAt).map(a => ({ id: "adjustment:" + a.id, accountId: a.accountId, amount: Math.abs(a.difference), date: a.date, kind: "adjustment" })),
  ].filter(t => t.date.slice(0, 7) === month && (accountId === "all" || t.accountId === accountId));
  return <div className="screen payments-screen transactions-screen">
    <div className="screen-title"><div><span className="eyebrow">Household activity</span><h1>Transactions</h1><p>Your card activity, in one place.</p></div><div className="screen-actions"><button type="button" className="primary" disabled={readOnly || !accounts.length} onClick={() => open({ action: "save" })}>Add transaction</button><button type="button" className="secondary" disabled={readOnly || !accounts.some(a => a.balance > 0 && !a.archivedAt)} onClick={onRecord}>Record payment</button></div></div>
    {message && <p className="debt-action-message" role="status">{message}</p>}
    <div className="payments-filters"><label><span>Month</span><input type="month" value={month} onChange={e => setMonth(e.target.value)}/></label><label><span>Debt</span><select value={accountId} onChange={e => setAccountId(e.target.value)}><option value="all">All debts</option>{knownIds.map(id => <option key={id} value={id}>{names.get(id) ?? "Removed debt (" + id + ")"}</option>)}</select></label></div>
    <section className="simple-total" aria-label="Confirmed payment total"><span>Payments this month</span><strong>{currency.format(confirmedPaymentTotal(transactions, adjustments, month, accountId))}</strong><details><summary>How totals work</summary><p>Negative entries saved here count as payments. Older balance decreases stay separate until you identify them as payments. Your budget checklists stay unchanged.</p></details></section>
    <section className="payment-activity" aria-label="Debt transaction activity">
      {rows.length ? rows.map(row => <article key={row.id} data-activity-id={row.id}>
        <div className="transaction-card-top"><div className={"transaction-direction " + (row.difference < 0 ? "is-payment" : "is-increase")} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={row.difference < 0 ? "M12 4v16m-6-6 6 6 6-6" : "M12 20V4m-6 6 6-6 6 6"}/></svg></div><div className="transaction-card-name"><h2>{row.title}</h2><p>{names.get(row.accountId) ?? "Removed debt"}</p></div><strong className={"transaction-signed-total " + (row.difference < 0 ? "is-payment" : "is-increase")}>{row.difference < 0 ? "−" : "+"}{currency.format(row.amount)}</strong></div>
        <div className="transaction-card-meta"><span>{dateLabel(row.date)}</span><span>{row.kind === "payment" ? "Payment" : row.kind === "interest" ? (transactions.find(t => "transaction:" + t.id === row.id)?.interestEstimate ? "Estimated interest" : "Interest") : row.kind === "purchase" ? "Purchase" : row.kind === "fee" ? "Fee" : "Balance adjustment"}</span></div>
        {row.adjustment && row.difference < 0 && !row.adjustment.confirmedPayment && <details className="payment-confirmation"><summary>This was a payment</summary><p>Confirm only if this entire decrease was a payment. If interest, fees, or spending contributed, keep it as an adjustment. Your balance will not decrease again.</p><button type="button" className="primary" disabled={readOnly} onClick={() => onConfirm(row.adjustment!.id)}>Confirm as payment</button></details>}
        {row.adjustment?.confirmedPayment && <button type="button" className="secondary" disabled={readOnly} onClick={() => onUndoConfirmation(row.adjustment!.id)}>Keep as adjustment</button>}
        <div className="transaction-entry-actions"><button type="button" className="secondary" disabled={readOnly} onClick={() => open({ action: "save", id: row.id })}>Edit transaction</button><button type="button" className="danger payment-delete" disabled={readOnly} onClick={() => open({ action: "delete", id: row.id })} aria-label={(row.kind === "payment" && !row.adjustment ? "Delete payment of " : "Delete transaction of ") + currency.format(row.amount) + " for " + (names.get(row.accountId) ?? "removed debt")}>{row.kind === "payment" && !row.adjustment ? "Delete payment" : "Delete transaction"}</button></div>
        <details className="activity-details"><summary>Entry details</summary><p>{row.source}</p>{row.before !== undefined && row.after !== undefined && <p>Balance: {currency.format(row.before)} → {currency.format(row.after)}</p>}{row.note && <p>{row.note}</p>}<p>{row.creator?.displayName || row.creator?.email || "Household entry"}</p>{(() => { const entry = row.adjustment ?? transactions.find(t => "transaction:" + t.id === row.id); const revisions = Array.isArray(entry?.revisions) ? entry.revisions : []; return revisions.length ? <details><summary>Earlier versions ({revisions.length})</summary>{revisions.map((version, index) => { const v = version as { title?: string; correctedAt?: string; amount?: number; difference?: number; date?: string; memo?: string; note?: string }; return <p key={index}>{v.title && v.title + " · "}{v.date} · {currency.format(v.amount ?? Math.abs(v.difference ?? 0))} · {v.memo ?? v.note ?? ""} · Corrected {v.correctedAt}</p>; })}</details> : null; })()}</details>
      </article>) : <div className="simple-empty"><h2>No activity this month</h2><p>Add a transaction here, or update a lender balance in Debts. You do not need to enter every transaction.</p></div>}
    </section>
    {deleted.length > 0 && <details className="deleted-payments"><summary>Deleted transactions ({deleted.length})</summary><p>Retained for recovery. Deleted entries do not affect balances or payment totals.</p>{deleted.map(t => <article key={t.id}><div><strong>{names.get(t.accountId) ?? "Removed debt"} · {currency.format(t.amount)}</strong><p>{t.kind} · {dateLabel(t.date)}</p></div><button type="button" className="secondary" disabled={readOnly} onClick={() => open({ action: "restore", id: t.id })} aria-label={"Restore " + (t.kind === "payment" ? "payment" : "transaction") + " of " + currency.format(t.amount) + " for " + (names.get(t.accountId) ?? "removed debt")}>Restore</button></article>)}</details>}
    {pendingAction && <DebtEntryDialog state={{ accounts: storedAccounts, transactions, adjustments }} command={pendingAction} readOnly={readOnly} onSave={onChange} onClose={close}/>}
  </div>;
}
