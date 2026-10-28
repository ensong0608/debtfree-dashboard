"use client";
import BackButton from "./back-button";
import NumericInput from "./numeric-input";
import { parseFinancialInput } from "./financial-input";
import DateCalendar from './date-calendar';
import { paymentOverlaps, type PaymentLink } from "./payment-overlap";
import { useState } from "react";
import { changeDebtEntry, signedEntryDraft, type EntryCommand, type EntryState, type EntryKind } from "./debt-transactions";
import { transactionAdjustedAccounts } from "./progress-balances";
import { householdDate } from "./interest-accrual";
import { useHouseholdCurrency } from "./household-currency-context";
import { createHouseholdMoneyFormatter, householdCurrencySymbol } from "./household-currency";
import styles from "./payments-mobile.module.css";
import UnsavedChangesDialog from "./unsaved-changes-dialog";

export default function DebtEntryDialog({ state, command, readOnly, onSave, onClose, mobile = false, onRequestDelete, expectedState, accountScope, flexibleScope = false }: { accountScope?: string; flexibleScope?: boolean; mobile?: boolean; onRequestDelete?: (expected: string) => void; expectedState?: string; state: EntryState; command: EntryCommand; readOnly: boolean; onSave: (command: EntryCommand, expected: string) => string | null; onClose: () => void }) {
  const householdCurrency = useHouseholdCurrency();
  const money = createHouseholdMoneyFormatter(householdCurrency);
  const transaction = command.id?.startsWith("transaction:") ? state.transactions.find(t => "transaction:" + t.id === command.id) : undefined;
  const adjustment = command.id?.startsWith("adjustment:") ? state.adjustments.find(a => "adjustment:" + a.id === command.id) : undefined;
  const original = transaction ?? adjustment;
  const [expected] = useState(() => expectedState ?? JSON.stringify(state));
  const movement = transaction ? transaction.amount * (transaction.type === "payment" ? -1 : 1) : adjustment?.difference ?? 0;
  const [fields, setFields] = useState(() => ({ accountId: original?.accountId ?? accountScope ?? state.accounts.find(a => !a.archivedAt)?.id ?? state.accounts[0]?.id ?? "", title: original?.title ?? (transaction?.interestEstimate ? "Monthly interest" : transaction?.type === "payment" || adjustment?.confirmedPayment ? "Payment" : transaction ? transaction.payeeName || "Card purchase" : adjustment ? "Balance update" : ""), date: original?.date ?? householdDate(), note: transaction?.memo ?? adjustment?.note ?? "", amount: original ? Math.abs(movement).toFixed(2) : "" }));
  const [initialFields] = useState(fields);
  const [category, setCategory] = useState(() => adjustment ? adjustment.confirmedPayment ? "payment" : adjustment.reportKind === "credit" ? "credit" : adjustment.reportKind ?? (movement < 0 ? "correction-down" : "correction-up") : transaction?.type === "payment" ? transaction.reductionKind === "adjustment" ? "correction-down" : transaction.credit ? "credit" : "payment" : transaction?.interestEstimate || transaction?.actualInterestCycle || transaction?.category === "Interest" ? "interest" : transaction?.type === "fee" ? "fee" : "purchase");
  const [initialCategory] = useState(category);
  const [overlapChoice, setOverlapChoice] = useState<PaymentLink | "separate" | null>(null);
  const [initialOverlapChoice] = useState<PaymentLink | "separate" | null>(null);
  const [reviewOverlap, setReviewOverlap] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirmExit, setConfirmExit] = useState(false);
  const reducing = ["payment", "credit", "correction-down"].includes(category);
  const categoryLabels: Record<string,string> = {payment:"Payment",credit:"Refund/Credit",purchase:"Purchase",interest:"Interest",fee:"Annual fee"};
  const draft = signedEntryDraft(original, {...fields, title: original?.title || categoryLabels[category] || "Balance update", amount: (reducing ? "-" : "") + fields.amount.replace(/^[+−-]/, "")});
  draft.kind = adjustment || category.startsWith("correction-") && !transaction ? "adjustment" : reducing ? "payment" : category as EntryKind;
  if (adjustment) {
    draft.confirmAsPayment = category === "payment";
    if (category === "credit") draft.reportKind = "credit";
    else if (["purchase", "interest", "fee"].includes(category)) draft.reportKind = category as "purchase" | "interest" | "fee";
  } else {
    draft.credit = reducing && category !== "payment";
    if (draft.credit) draft.reductionKind = category === "correction-down" ? "adjustment" : "credit";
  }
  const matches = !original && draft.kind === "payment" && !draft.credit ? paymentOverlaps(state.transactions, state.adjustments, fields.accountId, draft.amount, fields.date) : [];
  if (overlapChoice && overlapChoice !== "separate") draft.includedIn = overlapChoice;
  const edited = { ...command, ...(command.action === "save" ? { draft } : {}) };
  let error = ""; let next = state;
  try { next = changeDebtEntry(state, edited, undefined, "preview", "preview-entry"); } catch (e) { error = e instanceof Error ? e.message : "Check the entry."; }
  const before = transactionAdjustedAccounts(state.accounts, state.transactions);
  const after = transactionAdjustedAccounts(next.accounts, next.transactions);
  const affected = [...new Set([original?.accountId, fields.accountId].filter(Boolean))];
  const dialogTitle = command.action === "save" ? original ? "Edit transaction" : "New transaction" : command.action === "delete" ? transaction?.type === "payment" ? "Delete payment?" : "Delete transaction?" : transaction?.type === "payment" ? "Restore payment?" : "Restore transaction?";
  const hasUnsavedChanges = command.action === "save" && (JSON.stringify(fields) !== JSON.stringify(initialFields) || category !== initialCategory || JSON.stringify(overlapChoice) !== JSON.stringify(initialOverlapChoice));
  const requestClose = () => { if (hasUnsavedChanges) setConfirmExit(true); else onClose(); };
  const saveEntry = () => {
    if (adjustment && command.action === "save") { setSaveError("Update the balance in the debt Detail tab."); return; }
    if (readOnly) return;
    if (error) { setSaveError(error); setConfirmExit(false); return; }
    if (matches.length && !overlapChoice) { setReviewOverlap(true); return; }
    const result = onSave(edited, expected);
    if (result) setSaveError(result);
    else { setConfirmExit(false); onClose(); }
  };

  const change = (key: keyof typeof fields, value: string) => {
    setFields(d => ({ ...d, [key]: value })); setSaveError(""); setOverlapChoice(null); setReviewOverlap(false);
  };
  return <><div className="modal-backdrop" onMouseDown={e => { if (e.currentTarget === e.target) requestClose(); }}><section className="modal debt-action-modal transaction-compose" role="dialog" aria-modal="true" aria-labelledby="debt-entry-title">
    <header className="back-form-header"><div><h2 id="debt-entry-title">{dialogTitle}</h2></div><BackButton type="button" data-dialog-close aria-label="Back from transaction" onClick={requestClose}/></header>
    <form onSubmit={e => { e.preventDefault(); saveEntry(); }}><div className="debt-action-form compose-fields">
    {command.action === "save" ? <>
      <label className="compose-field"><span>Transaction category</span><select aria-label="Transaction category" value={category} disabled={Boolean(transaction?.interestEstimate || transaction?.actualInterestCycle)} onChange={event=>{setCategory(event.target.value);setSaveError("");setOverlapChoice(null);setReviewOverlap(false);}}>{Object.entries(categoryLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <div className="compose-row"><label className="compose-field"><span>Debt account</span><select aria-label="Debt account" value={fields.accountId} disabled={Boolean(accountScope || transaction?.interestEstimate)} onChange={e => change("accountId", e.target.value)}>{state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><DateCalendar label="Transaction date" value={fields.date} disabled={Boolean((accountScope && !flexibleScope) || transaction?.interestEstimate)} onChange={date => change("date", date)}/></div>
      <label className={"compose-field signed-money " + (reducing ? "is-payment" : "is-increase")}><span>Amount</span><div className="signed-money-input"><span aria-hidden="true">{householdCurrencySymbol(householdCurrency)}</span><NumericInput aria-label="Transaction amount" min={0} text={fields.amount.replace(/^[+−-]/, "")} value={parseFinancialInput(fields.amount, {min: -Number.MAX_SAFE_INTEGER / 100}).value} placeholder="0.00" aria-describedby="entry-validation" onValueChange={(_, text) => change("amount", text)}/></div></label>
      <details className="compose-notes" open={Boolean(fields.note) || undefined}><summary>Add a note <span>optional</span></summary><label className="compose-field"><span className="sr-only">Notes</span><textarea aria-label="Transaction notes" rows={2} placeholder="Anything else to remember" value={fields.note} onChange={e => change("note", e.target.value)}/></label></details>
    </> : <div className="compose-entry-summary"><strong>{fields.title}</strong><p>{money.format(draft.amount)} · {state.accounts.find(a => a.id === original?.accountId)?.name ?? "Removed debt"} · {fields.date}</p></div>}
    {transaction?.interestEstimate && <p className="compose-context">{transaction.interestEstimate.reconciledAt ? "Estimate reconciled to lender balance" : "Monthly interest · one entry per cycle. Its card and date stay fixed."}</p>}
    {!error && affected.map(id => { const account = before.find(a => a.id === id); if (!account) return null; return <div key={id} className="compose-preview"><strong>{after.find(a => a.id === id)!.balance === account.balance ? "No additional balance change" : `Debt ${after.find(a => a.id === id)!.balance > account.balance ? "increases" : "decreases"} by ${money.format(Math.abs(after.find(a => a.id === id)!.balance - account.balance))}`}</strong><div className="balance-change-preview"><div><span>Current balance</span><strong>{money.format(account.balance)}</strong></div><i aria-hidden="true">→</i><div><span>After saving</span><strong>{money.format(after.find(a => a.id === id)!.balance)}</strong></div></div></div>; })}

    {(reviewOverlap || Boolean(error)) && matches.length > 0 && <section className="payment-overlap" aria-label="Review possible overlap"><strong>This payment may already be included</strong>{matches.map(match => <div key={match.link.type+match.link.id}><p>{match.title} · {match.date} · {money.format(match.difference)} balance change</p><button type="button" className="secondary" disabled={!match.canLink} aria-pressed={overlapChoice !== null && overlapChoice !== "separate" && overlapChoice.id===match.link.id} onClick={() => setOverlapChoice(match.link)}>Already included in that update</button>{!match.canLink && <small>This update already has a payment classification.</small>}</div>)}<button type="button" className="secondary" aria-pressed={overlapChoice==="separate"} onClick={() => setOverlapChoice("separate")}>This is another payment</button></section>}
    <p id="entry-validation" className="compose-validation" role={saveError ? "alert" : "status"}>{saveError || (/\d/.test(fields.amount) ? error : "")}</p>
    </div><footer className={"form-action-footer " + (mobile ? styles.entryFooter : "")}><div><button type="button" className="secondary" onClick={requestClose}>Back</button><button type="submit" className={command.action === "delete" ? "danger" : "primary"} disabled={readOnly || Boolean(error)}>{command.action === "save" ? "Save" : command.action === "delete" ? "Confirm delete" : "Confirm restore"}</button></div>{mobile && command.action === "save" && original && !original.deletedAt && !transaction?.replacedByTransactionId && onRequestDelete && !readOnly && <button type="button" className={styles.deleteEntry} onClick={() => onRequestDelete(expected)}>Delete transaction</button>}</footer></form>
  </section></div>{confirmExit && <UnsavedChangesDialog subject="transaction" onSave={saveEntry} onDiscard={onClose} onCancel={() => setConfirmExit(false)}/>}</>;
}
