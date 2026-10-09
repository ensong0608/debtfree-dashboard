"use client";
import { paymentOverlaps, type PaymentLink } from "./payment-overlap";
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
  const [negativeKind, setNegativeKind] = useState<"payment" | "credit" | "adjustment">(adjustment ? adjustment.confirmedPayment ? "payment" : "adjustment" : transaction?.reductionKind === "adjustment" ? "adjustment" : transaction?.credit ? "credit" : "payment");
  const [overlapChoice, setOverlapChoice] = useState<PaymentLink | "separate" | null>(null);
  const [reviewOverlap, setReviewOverlap] = useState(false);
  const [saveError, setSaveError] = useState("");
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, [onClose]);
  const draft = signedEntryDraft(original, fields);
  if (adjustment && draft.direction === "decrease") draft.confirmAsPayment = negativeKind === "payment";
  if (!adjustment) draft.credit = draft.direction === "decrease" && negativeKind !== "payment";
  if (!adjustment && draft.credit) draft.reductionKind = negativeKind === "adjustment" ? "adjustment" : "credit";
  const matches = !original && draft.kind === "payment" && !draft.credit ? paymentOverlaps(state.transactions, state.adjustments, fields.accountId, draft.amount, fields.date) : [];
  if (overlapChoice && overlapChoice !== "separate") draft.includedIn = overlapChoice;
  const edited = { ...command, ...(command.action === "save" ? { draft } : {}) };
  let error = ""; let next = state;
  try { next = changeDebtEntry(state, edited, undefined, "preview", "preview-entry"); } catch (e) { error = e instanceof Error ? e.message : "Check the entry."; }
  const before = transactionAdjustedAccounts(state.accounts, state.transactions);
  const after = transactionAdjustedAccounts(next.accounts, next.transactions);
  const affected = [...new Set([original?.accountId, fields.accountId].filter(Boolean))];
  const dialogTitle = command.action === "save" ? original ? "Edit transaction" : "New transaction" : command.action === "delete" ? transaction?.type === "payment" ? "Delete payment?" : "Delete transaction?" : transaction?.type === "payment" ? "Restore payment?" : "Restore transaction?";
  const change = (key: keyof typeof fields, value: string) => {
    setFields(d => ({ ...d, [key]: value })); setSaveError(""); setOverlapChoice(null); setReviewOverlap(false);
  };
  const setSign = (negative: boolean) => change("amount", (negative ? "-" : "+") + fields.amount.replace(/^[+−-]/, ""));
  const suggestions = [...new Set([...state.transactions, ...state.adjustments].map(t => t.title).filter((t): t is string => Boolean(t)))].slice(0, 100);
  const isNegative = /^[−-]/.test(fields.amount);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.currentTarget === e.target) onClose(); }}><section className="modal debt-action-modal transaction-compose" role="dialog" aria-modal="true" aria-labelledby="debt-entry-title">
    <header><div><span className="compose-eyebrow">YOUR CARD ACTIVITY</span><h2 id="debt-entry-title">{dialogTitle}</h2></div><button type="button" aria-label="Close transaction" onClick={onClose}>×</button></header>
    <form onSubmit={e => { e.preventDefault(); if (readOnly || error) return; if (matches.length && !overlapChoice) { setReviewOverlap(true); return; } const result = onSave(edited, expected); if (result) setSaveError(result); else onClose(); }}><div className="debt-action-form compose-fields">
    {command.action === "save" ? <>
      <label className="compose-field"><span>What’s it for?</span><input aria-label="What’s it for?" list="transaction-title-suggestions" maxLength={160} placeholder="e.g. SFC Henderson grocery run" value={fields.title} onChange={e => change("title", e.target.value)}/></label>
      <datalist id="transaction-title-suggestions">{suggestions.map(title => <option key={title} value={title}/>)}</datalist>
      <div className="compose-row"><label className="compose-field"><span>Card used</span><select aria-label="Card used" value={fields.accountId} disabled={Boolean(transaction?.interestEstimate)} onChange={e => change("accountId", e.target.value)}>{state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label className="compose-field"><span>Date</span><input aria-label="Transaction date" type="date" value={fields.date} disabled={Boolean(transaction?.interestEstimate)} onChange={e => change("date", e.target.value)}/></label></div>
      <label className={"compose-field signed-money " + (isNegative ? "is-payment" : "is-increase")}><span>Amount</span><div className="signed-money-input"><span aria-hidden="true">$</span><input aria-label="Transaction amount" inputMode="decimal" autoComplete="off" spellCheck={false} value={fields.amount} placeholder="+66.96" aria-describedby="signed-amount-hint entry-validation" onChange={e => change("amount", e.target.value)}/></div></label>
      <div className="signed-amount-controls"><div role="group" aria-label="Amount sign"><button type="button" aria-label="Use positive amount" aria-pressed={!isNegative} onClick={() => setSign(false)}>+ Increase debt</button><button type="button" aria-label="Use negative amount" aria-pressed={isNegative} disabled={Boolean(transaction?.interestEstimate)} onClick={() => setSign(true)}>− Decrease debt</button></div><span id="signed-amount-hint" className="sr-only">Choose the balance direction</span></div>
      {isNegative && <fieldset className="decrease-classification"><legend>Report decrease as</legend><div>{([{value:"payment",label:"Payment"},{value:"credit",label:"Refund / credit"},{value:"adjustment",label:adjustment?"Reconciliation adjustment":"Balance correction"}] as const).filter(option=>!adjustment||option.value!=="credit").map(option=><label key={option.value} className={negativeKind===option.value?"is-selected":""}><input type="radio" name="decrease-classification" value={option.value} checked={negativeKind===option.value} onChange={()=>setNegativeKind(option.value)}/><span>{option.label}</span></label>)}</div></fieldset>}
      <details className="compose-notes" open={Boolean(fields.note) || undefined}><summary>Add a note <span>optional</span></summary><label className="compose-field"><span className="sr-only">Notes</span><textarea aria-label="Transaction notes" rows={2} placeholder="Anything else to remember" value={fields.note} onChange={e => change("note", e.target.value)}/></label></details>
    </> : <div className="compose-entry-summary"><strong>{fields.title}</strong><p>{money.format(draft.amount)} · {state.accounts.find(a => a.id === original?.accountId)?.name ?? "Removed debt"} · {fields.date}</p></div>}
    {transaction?.interestEstimate && <p className="compose-context">{transaction.interestEstimate.reconciledAt ? "Estimate reconciled to lender balance" : "Monthly interest · one entry per cycle. Its card and date stay fixed."}</p>}
    {!error && affected.map(id => { const account = before.find(a => a.id === id); if (!account) return null; return <div key={id} className="compose-preview"><strong>{after.find(a => a.id === id)!.balance === account.balance ? "No additional balance change" : `Debt ${after.find(a => a.id === id)!.balance > account.balance ? "increases" : "decreases"} by ${money.format(Math.abs(after.find(a => a.id === id)!.balance - account.balance))}`}</strong><div className="balance-change-preview"><div><span>Current balance</span><strong>{money.format(account.balance)}</strong></div><i aria-hidden="true">→</i><div><span>After saving</span><strong>{money.format(after.find(a => a.id === id)!.balance)}</strong></div></div></div>; })}

    {(reviewOverlap || Boolean(error)) && matches.length > 0 && <section className="payment-overlap" aria-label="Review possible overlap"><strong>This payment may already be included</strong>{matches.map(match => <div key={match.link.type+match.link.id}><p>{match.title} · {match.date} · {money.format(match.difference)} balance change</p><button type="button" className="secondary" disabled={!match.canLink} aria-pressed={overlapChoice !== null && overlapChoice !== "separate" && overlapChoice.id===match.link.id} onClick={() => setOverlapChoice(match.link)}>Already included in that update</button>{!match.canLink && <small>This update already has a payment classification.</small>}</div>)}<button type="button" className="secondary" aria-pressed={overlapChoice==="separate"} onClick={() => setOverlapChoice("separate")}>This is another payment</button></section>}
    <p id="entry-validation" className="compose-validation" role={saveError ? "alert" : "status"}>{saveError || (fields.amount || fields.title ? error : "")}</p>
    </div><footer><div><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" className={command.action === "delete" ? "danger" : "primary"} disabled={readOnly || Boolean(error)}>{command.action === "save" ? "Save transaction" : command.action === "delete" ? "Confirm delete" : "Confirm restore"}</button></div></footer></form>
  </section></div>;
}
