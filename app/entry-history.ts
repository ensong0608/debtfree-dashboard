import type { BalanceAdjustment, LedgerTransaction } from "./dashboard-data.ts";
import { postedMovement } from "./payment-overlap.ts";
import { round } from "./payoff-engine.ts";
type Event = { action: string; recordedAt: string; effectiveDate: string; movement: { accountId: string; before: number; after: number }[] };
export function entryHistory(entry: LedgerTransaction | BalanceAdjustment) {
  const events = Array.isArray(entry.balanceEvents) ? entry.balanceEvents as Event[] : [];
  const movement = "difference" in entry ? entry.difference : postedMovement({...entry,deletedAt:null} as LedgerTransaction);
  const revisions = Array.isArray(entry.revisions) ? entry.revisions : [];
  // The first retained version is the original record, not the latest edit's
  // balance delta. Only use its captured pair when the record establishes it.
  const first = (revisions[0] ?? entry) as LedgerTransaction | BalanceAdjustment;
  const originalMovement = "difference" in first ? first.difference : postedMovement({...first,deletedAt:null} as LedgerTransaction);
  const captured = Number.isFinite(first.balanceBefore) && Number.isFinite(first.balanceAfter) && Number.isFinite(originalMovement) && round(first.balanceAfter! - first.balanceBefore!) === originalMovement;
  const original = captured ? { accountId: first.accountId, date: first.date, amount: originalMovement, before: first.balanceBefore!, after: first.balanceAfter! } : undefined;
  // A corrected amount, account, or date must not borrow the original pair in
  // its current activity row. The original remains accessible in the history.
  const sameEntry = original && !entry.deletedAt && original.accountId === entry.accountId && original.date === entry.date && original.amount === movement;
  return { events, revisions, original, before: sameEntry ? original.before : undefined, after: sameEntry ? original.after : undefined, explanation: original ? "Original captured balance; later edits are listed below." : "Original captured balances unavailable; retained versions are listed below." };
}
