import { householdDate } from "./household-date.ts";
export { householdDate } from "./household-date.ts";
import type { DebtAccount, LedgerTransaction } from "./dashboard-data.ts";
import { transactionAdjustedAccounts } from "./progress-balances.ts";
import { round } from "./payoff-engine.ts";

// Statement interest bases are average balances, not today's APR buckets.
// Preserve their proportions only as an explicitly approximate blended rate.
export const COSTCO_ESTIMATED_APR = (3040 * 18.99 + 7438.18 * 22.99) / (3040 + 7438.18);
export type InterestAutomation = { enabled: boolean; coveredThrough: string; estimatedApr: number; closingDay?: number };
export type InterestEstimate = { cycle: string; periodStart: string; days: number; estimatedApr: number; reconciledAt?: string };
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "2000-01-01" && Number.isFinite(Date.parse(value + "T12:00:00Z")) && new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
}
export function closingDate(month: string, day = 2) {
  const [year, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, "0")}`;
}
function nextClose(date: string, day = 2) {
  const d = new Date(date.slice(0, 7) + "-01T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 1);
  return closingDate(d.toISOString().slice(0, 7), day);
}
export function coveredClose(date: string, day = 2) {
  if (!validDate(date)) throw new Error("Enter a valid balance date.");
  const close = closingDate(date.slice(0, 7), day);
  if (date >= close) return close;
  const d = new Date(date.slice(0, 7) + "-01T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 1);
  return closingDate(d.toISOString().slice(0, 7), day);
}
export const coveredCostcoClose = (date: string) => coveredClose(date, 2);
/** Editing metadata must never silently move the user's reconciliation boundary. */
export function interestSettingsError(config: InterestAutomation, today = householdDate()) {
  const day = config.closingDay ?? 2;
  if (!Number.isInteger(day) || day < 1 || day > 31) return 'Enter a statement closing day from 1 to 31.';
  if (!validDate(config.coveredThrough) || config.coveredThrough > today) return 'Choose an included-through date no later than today.';
  if (config.coveredThrough !== closingDate(config.coveredThrough.slice(0, 7), day)) return 'Closing day changed. Choose the closing date already included in your balance.';
  if (!Number.isFinite(config.estimatedApr) || config.estimatedApr < 0 || config.estimatedApr > 100 || config.enabled && config.estimatedApr === 0) return config.enabled ? 'Enter an estimated APR greater than 0 and up to 100%.' : 'Enter an estimated APR from 0 to 100%.';
  return '';
}
export function validInterestConfig(config: InterestAutomation) {
  const day = config.closingDay ?? 2;
  return Number.isInteger(day) && day >= 1 && day <= 31 && validDate(config.coveredThrough) && config.coveredThrough === closingDate(config.coveredThrough.slice(0, 7), day) && Number.isFinite(config.estimatedApr) && config.estimatedApr > 0 && config.estimatedApr <= 100;
}

/** Runs on opening/refresh. IDs reserve deleted and reconciled cycles;
 * household revision checks arbitrate concurrent saves from two phones. */
export function accrueCostcoInterest(accounts: DebtAccount[], transactions: LedgerTransaction[], today = householdDate(), now?: string) {
  let result = transactions;
  const ids = new Set(transactions.map(t => t.id));
  for (const account of accounts) {
    const config = account.interestAutomation;
    if (!config?.enabled || account.archivedAt || !validInterestConfig(config) || account.type !== "Credit card") continue;
    let start = config.coveredThrough;
    for (let cycle = nextClose(start, config.closingDay); cycle <= today; start = cycle, cycle = nextClose(cycle, config.closingDay)) {
      const id = "interest:" + account.id + ":" + cycle.slice(0, 7);
      if (ids.has(id) || result.some(t => t.accountId === account.id && !t.interestEstimate && t.type === "fee" && (t.actualInterestCycle === cycle.slice(0, 7) || t.category === "Interest" && t.date.slice(0, 7) === cycle.slice(0, 7)))) continue;
      const balance = transactionAdjustedAccounts([account], result.filter(t => t.date <= cycle))[0].balance;
      const days = Math.round((Date.parse(cycle + "T12:00:00Z") - Date.parse(start + "T12:00:00Z")) / 86400000);
      const amount = round(balance * config.estimatedApr / 100 * days / 365);
      // Identical automatic records let the second phone recognize the first
      // phone's accepted save, without discarding any different user edits.
      const entryTime = now ?? cycle + "T12:00:00.000Z";
      const entry: LedgerTransaction = { id, date: cycle, accountId: account.id, payeeId: "", payeeName: account.name,
        type: "fee", category: "Interest & fees", memo: "Estimated interest",
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
    account: { ...account, interestAutomation: { ...account.interestAutomation, coveredThrough: coveredClose(date, account.interestAutomation.closingDay) } },
    transactions: transactions.map(t => t.accountId === account.id && t.interestEstimate && t.date <= date && !t.interestEstimate.reconciledAt
      ? { ...t, updatedAt: now, interestEstimate: { ...t.interestEstimate, reconciledAt: now } } : t),
  };
}

/** Replace only active, unreconciled estimates in the explicitly selected cycle.
 * Tombstones reserve the automatic ID; replacements retain their audit links. */
export function recordActualInterest(account: DebtAccount, transactions: LedgerTransaction[], amount: number, cycle: string, now = new Date().toISOString(), id = crypto.randomUUID()) {
  if (!validDate(cycle) || !Number.isFinite(amount) || amount < 0 || Math.round(amount * 100) !== amount * 100 && Math.abs(Math.round(amount * 100) - amount * 100) > 1e-7) throw new Error("Enter a valid interest amount and date.");
  if (transactions.some(t => t.accountId === account.id && !t.deletedAt && t.actualInterestCycle === cycle.slice(0, 7))) throw new Error("Actual interest already exists for this cycle. Edit it in Transactions.");
  const estimates = transactions.filter(t => t.accountId === account.id && t.interestEstimate?.cycle.slice(0, 7) === cycle.slice(0, 7) && !t.deletedAt);
  if (estimates.some(t => t.interestEstimate?.reconciledAt) || account.reconciliation && cycle <= account.reconciliation.date) throw new Error("This cycle is already included in the lender balance. Update the lender balance instead.");
  const originals = estimates.map(t => t.id);
  const result = transactions.map(t => originals.includes(t.id) ? { ...t, deletedAt: now, updatedAt: now, replacedByTransactionId: id } : t);
  result.push({ id, accountId: account.id, date: cycle, type: "fee", payeeId: "", payeeName: account.name, category: "Interest & fees", memo: "Actual interest", amount, actualInterestCycle: cycle.slice(0, 7), replacesEstimateIds: originals, createdAt: now, updatedAt: now, deletedAt: null });
  // Reserve a future catch-up cycle even when no estimate was present yet.
  const reservedId = `interest:${account.id}:${cycle.slice(0, 7)}`;
  if (!result.some(t => t.id === reservedId)) result.push({ id: reservedId, accountId: account.id, date: cycle, type: "fee", payeeId: "", payeeName: account.name, category: "Interest & fees", memo: "Estimate replaced by actual interest", amount: 0, createdAt: now, updatedAt: now, deletedAt: now, replacedByTransactionId: id });
  return result;
}
