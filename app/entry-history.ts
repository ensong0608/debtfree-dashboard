import type { BalanceAdjustment, LedgerTransaction } from "./dashboard-data.ts";
import { round } from "./payoff-engine.ts";
type Event = { action: string; recordedAt: string; effectiveDate: string; movement: { accountId: string; before: number; after: number }[] };
export function entryHistory(entry: LedgerTransaction | BalanceAdjustment) {
  const events = Array.isArray(entry.balanceEvents) ? entry.balanceEvents as Event[] : [];
  const movement = "difference" in entry ? entry.difference : entry.type === "payment" ? -entry.amount : entry.amount;
  const corrected = Array.isArray(entry.revisions) && entry.revisions.length > 0;
  const legacyValid = !corrected && entry.balanceBefore !== undefined && entry.balanceAfter !== undefined && round(entry.balanceAfter - entry.balanceBefore) === movement;
  return { events, revisions: Array.isArray(entry.revisions) ? entry.revisions : [], before: legacyValid ? entry.balanceBefore : undefined, after: legacyValid ? entry.balanceAfter : undefined, explanation: events.length ? "Recorded application events below; dates do not reconstruct a lender's historical balance." : corrected ? "Corrected entry. Historical balances are unavailable; prior versions are retained below." : legacyValid ? "Balances captured when saved; not a lender balance for the entry date." : "Historical balances unavailable." };
}
