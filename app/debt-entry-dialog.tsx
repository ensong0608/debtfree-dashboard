"use client";
import { useEffect, useState } from "react";
import { changeDebtEntry, signedEntryDraft, type EntryCommand, type EntryState } from "./debt-transactions";
import { transactionAdjustedAccounts } from "./progress-balances";
import { householdDate } from "./interest-accrual";
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function DebtEntryDialog({ state, command, readOnly, onSave, onClose }: { state: EntryState; command: EntryCommand; readOnly: boolean; onSave: (command: EntryCommand, expected: string) => string | null; onClose: () => void }) {
  const transaction = command.id?.startsWith("transaction:") ? state.transactions.find(t => "transaction:" + t.id === command.id) : undefined;
  const adjustment = command.id?.startsWith("adjustment:") ? state.adjustments.find(a => "adjustment:" + a.id === command.id) : undefined;
  const original = transaction ?? adjustment;
  const [expected] = useState(() => JSON.stringify(state));
  const movement = transaction ? transaction.amount * (transaction.type === "payment" ? -1 : 1) : adjustment?.difference ?? 0;
  const [fields, setFields] = useState(() => ({ accountId: original?.accountId ?? state.accounts.find(a => !a.archivedAt)?.id ?? state.accounts[0]?.id ?? "", title: original?.title ?? (transaction?.interestEstimate ? "Monthly interest" : transaction?.type === "payment" || adjustment?.confirmedPayment ? "Payment" : transaction ? transaction.payeeName || "Card purchase" : adjustment ? "Balance update" : ""), date: original?.date ?? householdDate(), note: transaction?.memo ?? adjustment?.note ?? "", amount: original ? (movement >= 0 ? "+" : "") + movement.toFixed(2) : "" }));
  const [saveError, setSaveError] = useState("");
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, [onClose]);
  const draft = signedEntryDraft(original, fields);
  const edited = { ...command, ...(command.action === "save" ? { draft } : {}) };
  let error = ""; let next = state;
  try { next = changeDebtEntry(state, edited, undefined, "preview", "preview-entry"); } catch (e) { error = e instanceof Error ? e.message : "Check the entry."; }
  const before = transactionAdjustedAccounts(state.accounts, state.transactions);
  const after = transactionAdjustedAccounts(next.accounts, next.transactions);
  const affected = [...new Set([original?.accountId, fields.accountId].filter(Boolean))];
  const dialogTitle = command.action === "save" ? original ? "Edit transaction" : "New transaction" : command.action === "delete" ? transaction?.type === "payment" ? "Delete payment?" : "Delete transaction?" : transaction?.type === "payment" ? "Restore payment?" : "Restore transaction?";
  const change = (key: keyof typeof fields, value: string) => { setFields(d => ({ ...d, [key]: value })); setSaveError(""); };
  const setSign = (negative: boolean) => change("amount", (negative ? "-" : "+") + fields.amount.replace(/^[+−-]/, ""));
  const suggestions = [...new Set([...state.transactions, ...state.adjustments].map(t => t.title).filter((t): t is string => Boolean(t)))].slice(0, 100);
  const isNegative = /^[−-]/.test(fields.amount);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.currentTarget === e.target) onClose(); }}><section className="modal debt-action-modal transaction-compose" role="dialog" aria-modal="true" aria-labelledby="debt-entry-title">
    <header><div><span className="compose-eyebrow">YOUR CARD ACTIVITY</span><h2 id="debt-entry-title">{dialogTitle}</h2></div><button type="button" aria-label="Close transaction" onClick={onClose}>×</button></header>
    <form onSubmit={e => { e.preventDefault(); if (readOnly || error) return; const result = onSave(edited, expected); if (result) setSaveError(result); else onClose(); }}><div className="debt-action-form compose-fields">
    {command.action === "save" ? <>
      <label className="compose-field"><span>What’s it for?</span><input aria-label="What’s it for?" list="transaction-title-suggestions" maxLength={160} placeholder="e.g. SFC Henderson grocery run" value={fields.title} onChange={e => change("title", e.target.value)}/></label>
      <datalist id="transaction-title-suggestions">{suggestions.map(title => <option key={title} value={title}/>)}</datalist>
      <div className="compose-row"><label className="compose-field"><span>Card used</span><select aria-label="Card used" value={fields.accountId} disabled={Boolean(transaction?.interestEstimate)} onChange={e => change("accountId", e.target.value)}>{state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label className="compose-field"><span>Date</span><input aria-label="Transaction date" type="date" value={fields.date} disabled={Boolean(transaction?.interestEstimate)} onChange={e => change("date", e.target.value)}/></label></div>
      <label className={"compose-field signed-money " + (isNegative ? "is-payment" : "is-increase")}><span>Amount</span><div className="signed-money-input"><span aria-hidden="true">$</span><input aria-label="Transaction amount" inputMode="decimal" autoComplete="off" spellCheck={false} value={fields.amount} placeholder="+66.96" aria-describedby="signed-amount-hint entry-validation" onChange={e => change("amount", e.target.value)}/></div></label>
      <div className="signed-amount-controls"><div role="group" aria-label="Amount sign"><button type="button" aria-label="Use positive amount" aria-pressed={!isNegative} onClick={() => setSign(false)}>+</button><button type="button" aria-label="Use negative amount" aria-pressed={isNegative} disabled={Boolean(transaction?.interestEstimate)} onClick={() => setSign(true)}>−</button></div><span id="signed-amount-hint">+ increases debt · − is a payment</span></div>
      <details className="compose-notes" open={Boolean(fields.note) || undefined}><summary>Add a note <span>optional</span></summary><label className="compose-field"><span className="sr-only">Notes</span><textarea aria-label="Transaction notes" rows={2} placeholder="Anything else to remember" value={fields.note} onChange={e => change("note", e.target.value)}/></label></details>
    </> : <div className="compose-entry-summary"><strong>{fields.title}</strong><p>{money.format(draft.amount)} · {state.accounts.find(a => a.id === original?.accountId)?.name ?? "Removed debt"} · {fields.date}</p></div>}
    {transaction?.interestEstimate && <p className="compose-context">Monthly interest · one entry per cycle. Its card and date stay fixed.</p>}
    {!error && affected.map(id => { const account = before.find(a => a.id === id); if (!account) return null; return <div key={id} className="compose-preview"><span>{account.name}</span><div className="balance-change-preview"><div><span>Current balance</span><strong>{money.format(account.balance)}</strong></div><i aria-hidden="true">→</i><div><span>After saving</span><strong>{money.format(after.find(a => a.id === id)!.balance)}</strong></div></div></div>; })}
    {original && <details className="compose-context"><summary>Balance &amp; history</summary><p>This correction changes today’s balance by the difference only. Earlier versions stay in entry history. Deleted entries can be restored.</p></details>}
    {command.action === "save" && !original && <p className="compose-context">Already included in your saved balance? Edit that balance-update entry instead.</p>}
    <p id="entry-validation" className="compose-validation" role={saveError ? "alert" : "status"}>{saveError || (fields.amount || fields.title ? error : "")}</p>
    </div><footer><div><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" className={command.action === "delete" ? "danger" : "primary"} disabled={readOnly || Boolean(error)}>{command.action === "save" ? "Save transaction" : command.action === "delete" ? "Confirm delete" : "Confirm restore"}</button></div></footer></form>
  </section></div>;
}
