import type { BalanceAdjustment, DebtAccount, DebtAuditCreator, LedgerTransaction, PaymentKind } from "./dashboard-data.ts";
import { transactionAdjustedAccounts } from "./progress-balances.ts";
import { validDate } from "./interest-accrual.ts";
import { round } from "./payoff-engine.ts";

export type EntryKind = "payment" | "purchase" | "interest" | "fee" | "adjustment";
export type EntryDraft = { accountId: string; kind: EntryKind; amount: number; date: string; note: string; direction: "increase" | "decrease"; paymentKind?: PaymentKind; title?: string; confirmAsPayment?: boolean };
export type EntryCommand = { action: "save" | "delete" | "restore"; id?: string; draft?: EntryDraft };
export type EntryState = { accounts: DebtAccount[]; transactions: LedgerTransaction[]; adjustments: BalanceAdjustment[] };
export const entryMovement = (draft: EntryDraft) => round(draft.amount * (draft.kind === "payment" || draft.kind === "adjustment" && draft.direction === "decrease" ? -1 : 1));

/** Accept explicit signs without changing the existing magnitude-based ledger schema. */
export function parseSignedAmount(value: string) {
  const text = value.trim().replace(/^−/, "-");
  return /^[+-]?\d+(\.\d{1,2})?$/.test(text) ? round(Number(text)) : NaN;
}

export function signedEntryDraft(original: LedgerTransaction | BalanceAdjustment | undefined, input: { accountId: string; title: string; amount: string; date: string; note: string }): EntryDraft {
  const signed = parseSignedAmount(input.amount);
  const adjustment = original && "difference" in original;
  const transaction = original && !adjustment ? original as LedgerTransaction : undefined;
  const kind: EntryKind = adjustment ? "adjustment" : signed < 0 ? "payment" : transaction?.interestEstimate || transaction?.category === "Interest" && transaction.type === "fee" ? "interest" : transaction?.type === "fee" ? "fee" : "purchase";
  return { accountId: input.accountId, title: input.title.trim(), amount: Math.abs(signed), date: input.date, note: input.note, kind, direction: signed < 0 ? "decrease" : "increase", ...(adjustment ? { confirmAsPayment: signed < 0 } : {}), ...(transaction?.paymentKind && signed < 0 ? { paymentKind: transaction.paymentKind } : {}) };
}

/** One mutation path for both previews and commits. Adjustment offsets remain separate from ledger movements. */
export function changeDebtEntry(state: EntryState, command: EntryCommand, creator?: DebtAuditCreator, now = new Date().toISOString(), newId = crypto.randomUUID()): EntryState {
  const transaction = command.id?.startsWith("transaction:") ? state.transactions.find(t => "transaction:" + t.id === command.id) : undefined;
  const adjustment = command.id?.startsWith("adjustment:") ? state.adjustments.find(a => "adjustment:" + a.id === command.id) : undefined;
  const original = transaction ?? adjustment;
  if (command.id && !original) throw new Error("This entry no longer exists. Reopen Transactions.");
  if (transaction?.replacedByTransactionId) throw new Error("This entry was replaced by a correction. Edit the current entry instead.");
  if (command.action !== "save" && !original) throw new Error("Choose an entry first.");
  if (command.action === "save" && original?.deletedAt) throw new Error("Restore this entry before editing it.");
  if (command.action !== "save" && Boolean(original?.deletedAt) === (command.action === "delete")) return state;
  const draft = command.draft;
  if (command.action === "save") {
    if (!draft || !Number.isFinite(draft.amount) || draft.amount <= 0 || round(draft.amount) !== draft.amount) throw new Error("Enter an amount greater than $0 with at most two decimal places.");
    if (draft.title !== undefined && (!draft.title.trim() || draft.title.length > 160)) throw new Error("Add a title of up to 160 characters.");
    if (!validDate(draft.date)) throw new Error("Enter a valid transaction date.");
    if (!state.accounts.some(a => a.id === draft.accountId)) throw new Error("Choose an existing debt.");
    if (transaction?.interestEstimate && (draft.direction === "decrease" || draft.kind !== "interest" || draft.date !== transaction.date || draft.accountId !== transaction.accountId)) throw new Error("Automatic interest stays attached to its original debt and monthly cycle. You can correct its amount or notes.");
    if (original && Boolean(adjustment) !== (draft.kind === "adjustment")) throw new Error("Keep a balance update as an adjustment. You can change its amount, direction, debt, date, and notes.");
  }
  const accountId = command.action === "save" ? draft!.accountId : original!.accountId;
  if (!state.accounts.some(a => a.id === accountId) || original && !state.accounts.some(a => a.id === original.accountId)) throw new Error("This debt was removed. Restore the debt from a backup before changing its balance history.");
  const before = transactionAdjustedAccounts(state.accounts, state.transactions);
  const current = before.find(a => a.id === accountId)!;
  const oldMovement = transaction && !transaction.deletedAt ? (transaction.type === "payment" ? -transaction.amount : transaction.amount) : adjustment && !adjustment.deletedAt ? adjustment.difference : 0;
  if (command.action === "save" && (draft!.kind === "payment" || draft!.confirmAsPayment) && draft!.amount > current.balance - (original?.accountId === accountId ? oldMovement : 0)) throw new Error("Payment cannot exceed the available debt balance.");
  // Keep prior versions as audit metadata. None are applied as additional movements.
  const revision = original ? { ...original, revisions: undefined } : undefined;
  if (revision) delete revision.revisions;
  const audit = original ? { revisions: [...(Array.isArray(original.revisions) ? original.revisions : []), { ...revision, correctedAt: now, ...(creator ? { correctedBy: creator } : {}) }] } : {};
  let accounts = state.accounts;
  let transactions = state.transactions;
  let adjustments = state.adjustments;
  if (adjustment || command.action === "save" && draft!.kind === "adjustment") {
    const previous = adjustment && !adjustment.deletedAt ? adjustment.difference : 0;
    const difference = command.action === "save" ? entryMovement(draft!) : adjustment!.difference;
    const applied = command.action === "delete" ? 0 : difference;
    accounts = state.accounts.map(a => ({ ...a, balanceOffset: round((a.balanceOffset ?? 0) - (adjustment?.accountId === a.id ? previous : 0) + (a.id === accountId ? applied : 0)) }));
    const after = transactionAdjustedAccounts(accounts, transactions).find(a => a.id === accountId)!;
    const updated: BalanceAdjustment = command.action === "save" ? { ...adjustment, ...audit, id: adjustment?.id ?? newId, accountId, date: draft!.date, difference, balanceBefore: current.balance, balanceAfter: after.balance, note: draft!.note.trim(), ...(draft!.title !== undefined ? { title: draft!.title.trim() } : {}), createdAt: adjustment?.createdAt ?? now, updatedAt: now, deletedAt: null, ...(creator && !adjustment ? { creator } : {}) } : { ...adjustment!, ...audit, deletedAt: command.action === "delete" ? now : null, updatedAt: now };
    if (command.action === "save" && draft!.confirmAsPayment === true && difference < 0) updated.confirmedPayment ??= { confirmedAt: now, ...(creator ? { creator } : {}) };
    if (difference >= 0 || command.action === "save" && draft!.confirmAsPayment === false) delete updated.confirmedPayment;
    adjustments = adjustment ? state.adjustments.map(a => a.id === adjustment.id ? updated : a) : [...state.adjustments, updated];
  } else {
    const type = draft?.kind === "payment" ? "payment" : draft?.kind === "purchase" ? "charge" : "fee";
    const updated: LedgerTransaction = command.action === "save" ? { ...transaction, ...audit, id: transaction?.id ?? newId, accountId, date: draft!.date, amount: draft!.amount, type, category: draft!.kind === "interest" ? "Interest" : draft!.kind === "fee" ? "Fees" : transaction?.type === type && transaction.category !== "Interest" && transaction.category !== "Fees" ? transaction.category || (type === "payment" ? "Debt payment" : "Purchases") : type === "payment" ? "Debt payment" : "Purchases", memo: draft!.note.trim(), ...(draft!.title !== undefined ? { title: draft!.title.trim() } : {}), payeeId: transaction?.payeeId ?? "", payeeName: transaction?.payeeName ?? current.name, createdAt: transaction?.createdAt ?? now, updatedAt: now, deletedAt: null, ...(creator && !transaction ? { creator } : {}) } : { ...transaction!, ...audit, deletedAt: command.action === "delete" ? now : null, updatedAt: now };
    if (command.action === "save") {
      if (type === "payment") { updated.debtAction = "payment"; updated.paymentKind = draft!.paymentKind ?? transaction?.paymentKind ?? "combined"; }
      else { delete updated.debtAction; delete updated.paymentKind; delete updated.plannedItemId; }
    }
    transactions = transaction ? state.transactions.map(t => t.id === transaction.id ? updated : t) : [...state.transactions, updated];
    if (command.action === "save") { updated.balanceBefore = current.balance; updated.balanceAfter = transactionAdjustedAccounts(accounts, transactions).find(a => a.id === accountId)!.balance; }
  }
  return { accounts, transactions, adjustments };
}
