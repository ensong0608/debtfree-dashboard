"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { BalanceAdjustment, DebtAccount, LedgerTransaction } from "./dashboard-data";
import { confirmedPaymentTotal, paymentActivity } from "./payments";
import { entryHistory } from "./entry-history";
import OutlineIcon from "./outline-icon";
import DebtEntryDialog from "./debt-entry-dialog";
import type { EntryCommand } from "./debt-transactions";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function dateLabel(value: string) { return new Date(value + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

export default function PaymentsPage({ readOnly, accounts, transactions, adjustments, message, storedAccounts, onChange, onDialog }: {
  readOnly: boolean; accounts: DebtAccount[]; transactions: LedgerTransaction[]; adjustments: BalanceAdjustment[]; message: string;
  onConfirm: (id: string) => void; onUndoConfirmation: (id: string) => void; storedAccounts: DebtAccount[]; onChange: (command: EntryCommand, expected: string) => string | null; onDialog: (open: boolean) => void;
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
    <h1 className="sr-only">Transactions</h1>
    {message && <p className="debt-action-message" role="status">{message}</p>}
    <div className="payments-filters"><label><span>Month</span><input type="month" value={month} onChange={e => setMonth(e.target.value)}/></label><label><span>Account</span><select value={accountId} onChange={e => setAccountId(e.target.value)}><option value="all">All card/other accounts</option>{knownIds.map(id => <option key={id} value={id}>{names.get(id) ?? "Removed debt (" + id + ")"}</option>)}</select></label></div>
    <details className="transaction-reporting"><summary>Payment total &amp; how balances work</summary><section className="simple-total" aria-label="Confirmed payment total"><span>Payments this month</span><strong>{currency.format(confirmedPaymentTotal(transactions, adjustments, month, accountId))}</strong><p>Payments exclude refunds, credits, and unidentified reconciliation adjustments. Cards and other accounts only; house/car payments are separate. Payments recorded differ from net debt reduction because purchases, interest, credits, and lender adjustments also change balances. Budget checklists stay unchanged.</p></section></details>
    <section className="payment-activity" aria-label="Debt transaction activity">
      {rows.length ? rows.map((row, index) => {
        const history = entryHistory(row.adjustment ?? transactions.find(t => "transaction:" + t.id === row.id)!);
        const kind = row.kind === "payment" ? "Payment" : row.kind === "credit" ? "Refund / credit" : row.kind === "interest" ? (transactions.find(t => "transaction:" + t.id === row.id)?.interestEstimate ? "Estimated interest" : "Interest") : row.kind === "purchase" ? "Purchase" : row.kind === "fee" ? "Fee" : "Balance adjustment";
        return <Fragment key={row.id}>
          {(index === 0 || rows[index - 1].date !== row.date) && <h2 className="transaction-date"><time dateTime={row.date}>{dateLabel(row.date)}</time></h2>}
          <article className="clean-transaction-card" data-activity-id={row.id}>
          <button type="button" className="transaction-edit-surface" disabled={readOnly} aria-label={`Edit ${row.title} for ${names.get(row.accountId) ?? "removed debt"}`} onClick={() => open({ action: "save", id: row.id })}>
            <span className={"transaction-icon " + (row.difference < 0 ? "decrease" : "increase")}><OutlineIcon name={row.kind === "purchase" ? "cart" : row.kind === "payment" || row.kind === "credit" ? "card" : "receipt"}/></span>
            <span className="transaction-clean-name"><strong>{row.title}</strong><span>{names.get(row.accountId) ?? "Removed debt"}</span></span>
            <span className="transaction-amount"><strong className={"transaction-signed-total " + (row.difference < 0 ? "is-payment" : "is-increase")}>{row.difference === 0 ? "" : row.difference < 0 ? "−" : "+"}{currency.format(row.amount)}</strong><small>{row.difference === 0 ? "Already included" : kind}</small></span>
            <span className="transaction-chevron"><OutlineIcon name="chevron"/></span>
            {history.before !== undefined && history.after !== undefined && <small className="transaction-captured">Original balance change: {currency.format(history.before)} → {currency.format(history.after)}</small>}
          </button>
          <details className="transaction-secondary"><summary>Balance history &amp; corrections</summary><p>{history.explanation}</p>{history.original && <p>Original balance change · {history.original.date} · {names.get(history.original.accountId) ?? "Removed account"}: {currency.format(history.original.before)} → {currency.format(history.original.after)} ({currency.format(history.original.amount)})</p>}{history.events.map((event, i) => <p key={i}>{event.action === "save" ? "Saved change" : event.action === "delete" ? "Deleted entry" : "Restored entry"} · recorded {event.recordedAt} · entry date {event.effectiveDate}{event.movement.map(m => m.before === m.after ? ` · ${names.get(m.accountId) ?? m.accountId}: No additional balance change` : ` · ${names.get(m.accountId) ?? m.accountId}: ${currency.format(m.before)} → ${currency.format(m.after)} (net ${currency.format(m.after - m.before)})`).join("")}</p>)}{history.revisions.length > 0 && <ul>{history.revisions.map((revision, i) => <li key={i}>Prior version · {String(revision.date ?? "date unavailable")} · {names.get(String(revision.accountId)) ?? "Removed account"} · {String(revision.title ?? "Untitled")} · {currency.format(typeof revision.difference === "number" ? revision.difference : (revision.type === "payment" ? -1 : 1) * Number(revision.amount ?? 0))} · corrected {String(revision.correctedAt ?? "time unavailable")}</li>)}</ul>}<button type="button" className="secondary transaction-delete-x" disabled={readOnly} onClick={() => open({ action: "delete", id: row.id })} aria-label={(row.kind === "payment" && !row.adjustment ? "Delete payment of " : "Delete transaction of ") + currency.format(row.amount) + " for " + (names.get(row.accountId) ?? "removed debt")}>Delete transaction</button></details>
        </article></Fragment>;
      }) : <div className="simple-empty"><h2>No activity this month</h2><p>Use + to add a record, or update a lender balance in Debts.</p></div>}

    </section>
    {deleted.length > 0 && <details className="deleted-payments"><summary>Deleted transactions ({deleted.length})</summary><p>Retained for recovery. Deleted entries do not affect balances or payment totals.</p>{deleted.map(t => <article key={t.id}><div><strong>{names.get(t.accountId) ?? "Removed debt"} · {currency.format(t.amount)}</strong><p>{t.kind} · {dateLabel(t.date)}</p></div><button type="button" className="secondary" disabled={readOnly} onClick={() => open({ action: "restore", id: t.id })} aria-label={"Restore " + (t.kind === "payment" ? "payment" : "transaction") + " of " + currency.format(t.amount) + " for " + (names.get(t.accountId) ?? "removed debt")}>Restore</button></article>)}</details>}
    {pendingAction && <DebtEntryDialog state={{ accounts: storedAccounts, transactions, adjustments }} command={pendingAction} readOnly={readOnly} onSave={onChange} onClose={close}/>}
  </div>;
}
