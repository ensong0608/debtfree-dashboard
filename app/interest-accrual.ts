import { householdDate } from "./household-date.ts";
export { householdDate } from "./household-date.ts";
import type { DebtAccount, LedgerTransaction } from "./dashboard-data.ts";
import { transactionAdjustedAccounts } from "./progress-balances.ts";
import { round } from "./payoff-engine.ts";
import { postedMovement } from "./payment-overlap.ts";

// Statement interest bases are average balances, not today's APR buckets.
// Preserve their proportions only as an explicitly approximate blended rate.
export const COSTCO_ESTIMATED_APR = (3040 * 18.99 + 7438.18 * 22.99) / (3040 + 7438.18);
export type InterestAutomation = { enabled: boolean; coveredThrough: string; estimatedApr: number; closingDay?: number; rateHistory?: { effectiveDate: string; apr: number }[] };
export type InterestEstimate = { cycle: string; periodStart: string; days: number; estimatedApr: number; reconciledAt?: string; method?: 'dated-balances' };

/** Preserve the old rate for elapsed days. New settings take effect on the household day. */
export function datedInterestSettings(previous: InterestAutomation | undefined, next: InterestAutomation, today = householdDate()): InterestAutomation {
  if (!previous || previous.estimatedApr === next.estimatedApr) return { ...next, ...(previous?.rateHistory ? { rateHistory: previous.rateHistory } : {}) };
  const history = previous.rateHistory ?? [{ effectiveDate: previous.coveredThrough, apr: previous.estimatedApr }];
  return { ...next, rateHistory: [...history.filter(rate => rate.effectiveDate !== today), { effectiveDate: today, apr: next.estimatedApr }].sort((a,b) => a.effectiveDate.localeCompare(b.effectiveDate)) };
}

function dateOfCreation(value: string) {
  return validDate(value) ? value : Number.isFinite(Date.parse(value)) ? householdDate(new Date(value)) : '';
}

/** Close-to-close uses (start, close], in Pacific calendar days. A confirmed
 * balance is an end-of-day anchor; movements on later days apply before accrual.
 * Missing opening history/undated offsets or an in-cycle reconciliation defer
 * posting until a complete cycle after a dated balance is available. No backfill. */
export function estimateCycleInterest(account: DebtAccount, transactions: LedgerTransaction[], start: string, close: string) {
  const config = account.interestAutomation;
  if (!config || !validDate(start) || !validDate(close) || close <= start) return null;
  const anchor = account.reconciliation;
  const openingDate = anchor?.date ?? dateOfCreation(account.createdAt);
  if (!openingDate || openingDate > start || (anchor ? (account.balanceOffset ?? 0) !== anchor.offset : (account.balanceOffset ?? 0) !== 0)) return null;
  const covered = new Set(anchor?.coveredTransactionIds);
  const movements = transactions.filter(t => t.accountId === account.id && !t.deletedAt && !t.replacedByTransactionId && t.id !== `interest:${account.id}:${close.slice(0,7)}` && t.date <= close && (!anchor || (
    !covered.has(t.id) && t.date >= anchor.date && (anchor.coveredTransactionIds !== undefined || t.date > anchor.date || t.createdAt > anchor.createdAt)
  )));
  let balance = Math.round((anchor?.balance ?? account.balance) * 100);
  const changes = new Map<string, number>();
  for (const entry of movements) {
    const movement = Math.round(postedMovement(entry) * 100);
    if (entry.date <= start) balance += movement;
    else changes.set(entry.date, (changes.get(entry.date) ?? 0) + movement);
  }
  let interest = 0, rateDays = 0;
  const days = Math.round((Date.parse(close + 'T12:00:00Z') - Date.parse(start + 'T12:00:00Z')) / 86400000);
  const rates = [...(config.rateHistory ?? [])].sort((a,b) => a.effectiveDate.localeCompare(b.effectiveDate));
  for (let day = 1; day <= days; day++) {
    const date = new Date(Date.parse(start + 'T12:00:00Z') + day * 86400000).toISOString().slice(0,10);
    balance += changes.get(date) ?? 0; // Same-day net movement, then interest; no intraday ordering guesses.
    const baseApr = rates.findLast(rate => rate.effectiveDate <= date)?.apr ?? rates[0]?.apr ?? config.estimatedApr;
    const apr = account.promoEndDate && account.postPromoApr > 0
      ? date > account.promoEndDate ? account.postPromoApr : account.apr === 0 ? 0 : baseApr
      : baseApr;
    interest += Math.max(0, balance) / 100 * apr / 100 / 365;
    rateDays += apr;
  }
  return { amount: round(interest), days, estimatedApr: rateDays / days };
}
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
  if (!Number.isFinite(config.estimatedApr) || config.estimatedApr < 0 || config.estimatedApr > 100) return 'Enter an estimated APR from 0 to 100%.';
  return '';
}
export function validInterestConfig(config: InterestAutomation) {
  const day = config.closingDay ?? 2;
  return Number.isInteger(day) && day >= 1 && day <= 31 && validDate(config.coveredThrough) && config.coveredThrough === closingDate(config.coveredThrough.slice(0, 7), day) && Number.isFinite(config.estimatedApr) && config.estimatedApr >= 0 && config.estimatedApr <= 100;
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
      if (ids.has(id) || result.some(t => t.accountId === account.id && !t.deletedAt && !t.replacedByTransactionId && !t.interestEstimate && t.type === "fee" && (t.actualInterestCycle === cycle.slice(0, 7) || t.category === "Interest" && t.date.slice(0, 7) === cycle.slice(0, 7)))) continue;
      const estimate = estimateCycleInterest(account, result, start, cycle);
      if (!estimate) continue;
      const balance = transactionAdjustedAccounts([account], result.filter(t => t.date <= cycle))[0].balance;
      const { amount, days, estimatedApr } = estimate;
      // Identical automatic records let the second phone recognize the first
      // phone's accepted save, without discarding any different user edits.
      const entryTime = now ?? cycle + "T12:00:00.000Z";
      const entry: LedgerTransaction = { id, date: cycle, accountId: account.id, payeeId: "", payeeName: account.name,
        type: "fee", category: "Interest & fees", memo: "Estimated interest",
        amount, createdAt: entryTime, updatedAt: entryTime, deletedAt: null, balanceBefore: balance, balanceAfter: round(balance + amount),
        interestEstimate: { cycle, periodStart: start, days, estimatedApr, method: 'dated-balances' } };
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
  if (!validDate(cycle) || cycle > householdDate(new Date(now)) || !Number.isFinite(amount) || amount < 0 || Math.round(amount * 100) !== amount * 100 && Math.abs(Math.round(amount * 100) - amount * 100) > 1e-7) throw new Error("Enter a valid interest amount and date.");
  if (account.interestAutomation && cycle !== closingDate(cycle.slice(0,7), account.interestAutomation.closingDay)) throw new Error("Choose the statement closing date.");
  if (transactions.some(t => t.accountId === account.id && !t.deletedAt && !t.replacedByTransactionId && t.actualInterestCycle === cycle.slice(0, 7))) throw new Error("Actual interest already exists for this cycle. Edit it in Transactions.");
  const estimates = transactions.filter(t => t.accountId === account.id && t.interestEstimate?.cycle.slice(0, 7) === cycle.slice(0, 7) && !t.deletedAt);
  const included = estimates.some(t => t.interestEstimate?.reconciledAt) || Boolean(account.reconciliation && cycle <= account.reconciliation.date) || Boolean(account.interestAutomation && cycle <= account.interestAutomation.coveredThrough);
  const originals = estimates.map(t => t.id);
  const result = transactions.map(t => originals.includes(t.id) ? { ...t, deletedAt: now, updatedAt: now, replacedByTransactionId: id } : t);
  result.push({ id, accountId: account.id, date: cycle, type: "fee", payeeId: "", payeeName: account.name, category: "Interest & fees", memo: "Actual interest", amount, actualInterestCycle: cycle.slice(0, 7), ...(included ? { actualInterestIncludedAt: now } : {}), replacesEstimateIds: originals, createdAt: now, updatedAt: now, deletedAt: null });
  // Reserve a future catch-up cycle even when no estimate was present yet.
  const reservedId = `interest:${account.id}:${cycle.slice(0, 7)}`;
  if (!result.some(t => t.id === reservedId)) result.push({ id: reservedId, accountId: account.id, date: cycle, type: "fee", payeeId: "", payeeName: account.name, category: "Interest & fees", memo: "Estimate replaced by actual interest", amount: 0, createdAt: now, updatedAt: now, deletedAt: now, replacedByTransactionId: id });
  return result;
}
