import type { DebtAccount, LedgerTransaction } from "./dashboard-data.ts";
import { transactionAdjustedAccounts } from "./progress-balances.ts";
import { round } from "./payoff-engine.ts";

// Statement interest bases are average balances, not today's APR buckets.
// Preserve their proportions only as an explicitly approximate blended rate.
export const COSTCO_ESTIMATED_APR = (3040 * 18.99 + 7438.18 * 22.99) / (3040 + 7438.18);
export type InterestAutomation = { enabled: boolean; coveredThrough: string; estimatedApr: number };
export type InterestEstimate = { cycle: string; periodStart: string; days: number; estimatedApr: number; reconciledAt?: string };
export function householdDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "2000-01-01" && Number.isFinite(Date.parse(value + "T12:00:00Z")) && new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
}
function nextClose(date: string) {
  const d = new Date(date + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}
export function coveredCostcoClose(date: string) {
  if (!validDate(date)) throw new Error("Enter a valid balance date.");
  const close = date.slice(0, 7) + "-02";
  if (date >= close) return close;
  const d = new Date(close + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
}

/** Runs on opening/refresh. IDs reserve deleted and reconciled cycles;
 * household revision checks arbitrate concurrent saves from two phones. */
export function accrueCostcoInterest(accounts: DebtAccount[], transactions: LedgerTransaction[], today = householdDate(), now?: string) {
  let result = transactions;
  const ids = new Set(transactions.map(t => t.id));
  for (const account of accounts) {
    const config = account.interestAutomation;
    if (!config?.enabled || account.archivedAt || !validDate(config.coveredThrough) || !config.coveredThrough.endsWith("-02") || !Number.isFinite(config.estimatedApr) || config.estimatedApr <= 0 || config.estimatedApr > 100) continue;
    let start = config.coveredThrough;
    for (let cycle = nextClose(start); cycle <= today; start = cycle, cycle = nextClose(cycle)) {
      const id = "interest:" + account.id + ":" + cycle.slice(0, 7);
      if (ids.has(id)) continue;
      const balance = transactionAdjustedAccounts([account], result.filter(t => t.date <= cycle))[0].balance;
      const days = Math.round((Date.parse(cycle + "T12:00:00Z") - Date.parse(start + "T12:00:00Z")) / 86400000);
      const amount = round(balance * config.estimatedApr / 100 * days / 365);
      // Identical automatic records let the second phone recognize the first
      // phone's accepted save, without discarding any different user edits.
      const entryTime = now ?? cycle + "T12:00:00.000Z";
      const entry: LedgerTransaction = { id, date: cycle, accountId: account.id, payeeId: "", payeeName: account.name,
        type: "fee", category: "Interest & fees", memo: "Estimated interest using the saved balance and blended statement APR; payment allocation and daily balances may differ from Citi.",
        amount, createdAt: entryTime, updatedAt: entryTime, deletedAt: null, balanceBefore: balance, balanceAfter: round(balance + amount),
        interestEstimate: { cycle, periodStart: start, days, estimatedApr: config.estimatedApr } };
      if (result === transactions) result = [...transactions];
      result.push(entry); ids.add(id);
    }
  }
  return result;
}

/** Existing balance offsets reconcile the entire balance, including interest.
 * Keep the estimate as audit history without another monetary movement. */
export function reconcileInterest(account: DebtAccount, transactions: LedgerTransaction[], date: string, now = new Date().toISOString()) {
  if (!account.interestAutomation) return { account, transactions };
  if (!validDate(date) || date > householdDate(new Date(now))) throw new Error("Use today's date or an earlier valid balance date.");
  if (date < account.interestAutomation.coveredThrough || transactions.some(t => t.accountId === account.id && t.interestEstimate && t.date > date)) throw new Error("Use a balance date on or after the latest interest entry. Older balances cannot replace today's balance.");
  return {
    account: { ...account, interestAutomation: { ...account.interestAutomation, coveredThrough: coveredCostcoClose(date) } },
    transactions: transactions.map(t => t.accountId === account.id && t.interestEstimate && t.date <= date && !t.interestEstimate.reconciledAt
      ? { ...t, updatedAt: now, interestEstimate: { ...t.interestEstimate, reconciledAt: now } } : t),
  };
}
