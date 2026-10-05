"use client";
import { useEffect, useState } from "react";
import { changeDebtEntry, type EntryCommand, type EntryDraft, type EntryKind, type EntryState } from "./debt-transactions";
import { parseMoneyInput } from "./payments";
import { transactionAdjustedAccounts } from "./progress-balances";
import { householdDate } from "./interest-accrual";
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function DebtEntryDialog({ state, command, readOnly, onSave, onClose }: { state: EntryState; command: EntryCommand; readOnly: boolean; onSave: (command: EntryCommand, expected: string) => string | null; onClose: () => void }) {
  const original = command.id?.startsWith("transaction:") ? state.transactions.find(t => "transaction:" + t.id === command.id) : state.adjustments.find(a => "adjustment:" + a.id === command.id);
  const transaction = command.id?.startsWith("transaction:") ? state.transactions.find(t => "transaction:" + t.id === command.id) : undefined;
  const adjustment = command.id?.startsWith("adjustment:") ? state.adjustments.find(a => "adjustment:" + a.id === command.id) : undefined;
  const [expected] = useState(() => JSON.stringify(state));
  const [draft, setDraft] = useState<EntryDraft>(() => ({ accountId: original?.accountId ?? state.accounts.find(a => !a.archivedAt)?.id ?? "", kind: adjustment ? "adjustment" : transaction?.type === "payment" ? "payment" : transaction?.type === "charge" ? "purchase" : transaction?.interestEstimate || transaction?.category === "Interest" ? "interest" : transaction ? "fee" : "payment", amount: transaction?.amount ?? Math.abs(adjustment?.difference ?? 0), date: original?.date ?? householdDate(), note: transaction?.memo ?? adjustment?.note ?? "", paymentKind: transaction?.paymentKind ?? "combined", direction: adjustment && adjustment.difference < 0 ? "decrease" : "increase" }));
  const [amount, setAmount] = useState(original ? String(draft.amount) : "");
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const edited = { ...command, ...(command.action === "save" ? { draft: { ...draft, amount: parseMoneyInput(amount) } } : {}) };
  let error = ""; let next = state;
  try { next = changeDebtEntry(state, edited, undefined, "preview", "preview-entry"); } catch (e) { error = e instanceof Error ? e.message : "Check the entry."; }
  const before = transactionAdjustedAccounts(state.accounts, state.transactions);
  const after = transactionAdjustedAccounts(next.accounts, next.transactions);
  const affected = [...new Set([original?.accountId, draft.accountId].filter(Boolean))];
  const title = command.action === "save" ? original ? "Edit transaction" : "Add transaction" : command.action === "delete" ? transaction?.type === "payment" ? "Delete payment?" : "Delete transaction?" : transaction?.type === "payment" ? "Restore payment?" : "Restore transaction?";
  const change = <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) => { setDraft(d => ({ ...d, [key]: value })); setSaveError(""); };
  return <div className="modal-backdrop" onMouseDown={e => { if (e.currentTarget === e.target) onClose(); }}><section className="modal debt-action-modal" role="dialog" aria-modal="true" aria-labelledby="debt-entry-title"><header><div><span>Debt activity</span><h2 id="debt-entry-title">{title}</h2><p>{command.action === "save" ? "Enter only activity not yet included in your saved balance. Review the balance below before saving." : "This reverses or reapplies the entry’s effect on today’s balance."}</p></div><button type="button" aria-label="Close transaction" onClick={onClose}>×</button></header><form onSubmit={e => { e.preventDefault(); if (readOnly || error) return; const result = onSave(edited, expected); if (result) setSaveError(result); else onClose(); }}><div className="debt-action-form">
    {command.action === "save" ? <>
      <label className="field"><span>Transaction debt</span><select aria-label="Transaction debt" value={draft.accountId} disabled={Boolean(transaction?.interestEstimate)} onChange={e => change("accountId", e.target.value)}>{state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label className="field"><span>Transaction type</span><select aria-label="Transaction type" value={draft.kind} disabled={Boolean(transaction?.interestEstimate || adjustment)} onChange={e => change("kind", e.target.value as EntryKind)}><option value="payment">Payment · decreases debt</option><option value="purchase">Purchase · increases debt</option><option value="interest">Interest · increases debt</option><option value="fee">Fee · increases debt</option>{(!transaction || adjustment) && <option value="adjustment">Balance adjustment</option>}</select></label>
      {draft.kind === "payment" && <label className="field"><span>Payment category</span><select aria-label="Payment category" value={draft.paymentKind} onChange={e => change("paymentKind", e.target.value as EntryDraft["paymentKind"])}><option value="minimum">Minimum payment</option><option value="extra">Extra payment</option><option value="combined">Minimum and extra</option></select></label>}
      {draft.kind === "adjustment" && <label className="field"><span>Adjustment direction</span><select aria-label="Adjustment direction" value={draft.direction} onChange={e => change("direction", e.target.value as EntryDraft["direction"])}><option value="increase">Increase debt</option><option value="decrease">Decrease debt</option></select></label>}
      <label className="field debt-money-field"><span>Transaction amount</span><div className="field-input"><span>$</span><input aria-label="Transaction amount" inputMode="decimal" autoComplete="off" value={amount} placeholder="0.00" aria-describedby="entry-validation" onChange={e => { setAmount(e.target.value); setSaveError(""); }}/></div></label>
      <label className="field"><span>Transaction date</span><input aria-label="Transaction date" type="date" value={draft.date} disabled={Boolean(transaction?.interestEstimate)} onChange={e => change("date", e.target.value)}/></label>
      <label className="field"><span>Transaction notes</span><textarea aria-label="Transaction notes" rows={3} value={draft.note} onChange={e => change("note", e.target.value)}/></label>
    </> : <p>{money.format(draft.amount)} · {state.accounts.find(a => a.id === original?.accountId)?.name ?? "Removed debt"} · {draft.date}</p>}
    {transaction?.interestEstimate && <p>Automatic interest stays in its original monthly cycle. Correct the amount to match your statement. Deleting it will not schedule the same month again.</p>}
    {original && <p>Changing earlier activity also changes today’s balance, even after a later lender update. The earlier version remains in the entry history.</p>}
    {command.action === "delete" && <p>The entry will be retained in Deleted transactions for recovery.</p>}
    {!error && affected.map(id => { const account = before.find(a => a.id === id); if (!account) return null; return <div key={id}><strong>{account.name}</strong><div className="balance-change-preview"><div><span>Current balance</span><strong>{money.format(account.balance)}</strong></div><i aria-hidden="true">→</i><div><span>Balance after</span><strong>{money.format(after.find(a => a.id === id)!.balance)}</strong></div></div></div>; })}
    <p id="entry-validation" role={saveError ? "alert" : "status"}>{saveError || error}</p>
  </div><footer><div><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" className={command.action === "delete" ? "danger" : "primary"} disabled={readOnly || Boolean(error)}>{command.action === "save" ? "Save transaction" : command.action === "delete" ? "Confirm delete" : "Confirm restore"}</button></div></footer></form></section></div>;
}
