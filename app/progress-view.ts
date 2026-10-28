import type { BalanceAdjustment, CashflowItem, DebtAccount, LedgerTransaction, MonthlyPlanSettings, PayoffSnapshot, RemovedProgressAccount } from './dashboard-data.ts';
import type { LoanTracker } from './loan-progress.ts';
import { buildActualProgress } from './debt-activity.ts';
import { householdDate } from './household-date.ts';
import { buildActivePayoffCommitment } from './payoff-commitment.ts';
import { paymentActivity } from './payments.ts';
import { round } from './payoff-engine.ts';
import { loanScheduleType } from './schedule-view.ts';

export type ProgressScope = 'accounts' | 'loans' | 'household';
export type ProgressCarouselScope = 'accounts' | 'home' | 'auto';
export type ProgressViews = Record<ProgressScope | 'home' | 'auto', ReturnType<typeof buildProgressView>>;
export type ProgressObservation = {
  id: string; month: string; balance: number; source: 'snapshot' | 'loan-history' | 'combined';
  observedOn: string | null; recordedAt: string | null; comparable: boolean;
};
export type ProgressMilestoneView = {
  id: 'first-payment' | 'first-1000' | 'first-debt' | 'quarter' | 'half' | 'three-quarter' | 'debt-free';
  label: string; status: 'achieved' | 'projected' | 'pending';
  // Threshold observations prove attainment, never an exact historical crossing.
  achievedOn: string | null; firstObservedMonth: string | null; projectedMonth: string | null;
  evidence: 'recorded-event' | 'saved-observation' | 'live-balance' | 'forecast' | null;
};
type Input = {
  accounts: DebtAccount[]; transactions: LedgerTransaction[]; adjustments: BalanceAdjustment[];
  snapshots: PayoffSnapshot[]; loans: LoanTracker[]; startingBalance?: number;
  removedAccounts?: RemovedProgressAccount[]; date?: Date;
  // Rebuild the canonical forecast from the same live inputs, never accept a detached plan.
  forecast?: { settings: MonthlyPlanSettings; items: CashflowItem[] };
};
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
const timestamp = (value: string) => value && Number.isFinite(Date.parse(value)) ? value : null;
const monthNumber = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7));
const sum = (values: number[]) => round(values.reduce((a, b) => a + b, 0));

/** Read-only adapter for Overview, Trends and Milestones. No inferred historical balances. */
export function buildProgressView(input: Input, scope: ProgressScope = 'accounts') {
  const date = input.date ?? new Date(), today = householdDate(date), month = today.slice(0, 7);
  const actual = buildActualProgress(input.accounts, input.transactions, input.adjustments, input.snapshots, date, input.startingBalance, input.removedAccounts);
  const accounts = actual.groups.flatMap(group => group.accounts);
  const accountIds = new Set(accounts.map(account => account.id));
  const includeAccounts = scope !== 'loans', includeLoans = scope !== 'accounts';
  const hasAccounts = includeAccounts && accounts.length > 0, hasLoans = includeLoans && input.loans.length > 0;
  const loanBaselineAvailable = input.loans.every(loan => Number.isFinite(loan.originalAmount) && loan.originalAmount > 0);
  const available = (hasAccounts || hasLoans) && (!hasAccounts || actual.comparisonAvailable) && (!hasLoans || loanBaselineAvailable);
  const starting = available ? sum([hasAccounts ? actual.starting : 0, hasLoans ? sum(input.loans.map(loan => loan.originalAmount)) : 0]) : null;
  const current = sum([hasAccounts ? actual.current : 0, hasLoans ? sum(input.loans.map(loan => loan.remainingAmount)) : 0]);
  const reduction = starting === null ? null : round(starting - current);

  const accountObservations: ProgressObservation[] = actual.snapshots.filter(snapshot => /^\d{4}-\d{2}$/.test(snapshot.month) && Number(snapshot.month.slice(5)) >= 1 && Number(snapshot.month.slice(5)) <= 12 && snapshot.month <= month).map(snapshot => {
    const recordedAt = timestamp(snapshot.capturedAt), capturedDay = recordedAt ? householdDate(new Date(recordedAt)) : null;
    const ids = new Set(snapshot.accounts.map(account => account.accountId));
    return { id: snapshot.id, month: snapshot.month, balance: snapshot.totalBalance, source: 'snapshot', recordedAt,
      observedOn: capturedDay?.startsWith(snapshot.month) && capturedDay <= today ? capturedDay : null,
      comparable: ids.size === accountIds.size && snapshot.accounts.length === ids.size && [...accountIds].every(id => ids.has(id)) };
  });
  // Aggregate loans only on dates where every loan has a saved balance of its current kind.
  // Same-day corrections use the latest recorded version; original history is returned intact below.
  const loanDays = new Map<string, Map<string, LoanTracker['history'][number]>>();
  const ambiguousLoanDays = new Set<string>();
  for (const loan of input.loans) for (const entry of loan.history) {
    if (!validDay(entry.date) || entry.date > today || entry.balanceKind !== loan.balanceKind) continue;
    const day = loanDays.get(entry.date) ?? new Map();
    const key = loan.id + ':' + entry.date;
    if (ambiguousLoanDays.has(key)) continue;
    const prior = day.get(loan.id);
    const savedAt = timestamp(entry.recordedAt), priorAt = prior ? timestamp(prior.recordedAt) : null;
    if (prior && prior.amount !== entry.amount && (!savedAt || !priorAt || Date.parse(savedAt) === Date.parse(priorAt))) {
      ambiguousLoanDays.add(key); day.delete(loan.id);
    } else if (!prior || (savedAt && priorAt && Date.parse(savedAt) > Date.parse(priorAt))) day.set(loan.id, entry);
    loanDays.set(entry.date, day);
  }
  const loanObservations: ProgressObservation[] = [...loanDays].filter(([, entries]) => entries.size === input.loans.length).map(([day, entries]) => ({
    id: 'loans:' + day, month: day.slice(0, 7), balance: sum([...entries.values()].map(entry => entry.amount)), source: 'loan-history',
    observedOn: day, recordedAt: null, comparable: true,
  }));
  // Automatic observations capture stored loan balances at the actual opening
  // date, independently of the lender balance date retained in loan history.
  for (const snapshot of input.snapshots) {
    const entries = snapshot.loanBalances;
    const recordedAt = timestamp(snapshot.capturedAt);
    const day = recordedAt ? householdDate(new Date(recordedAt)) : null;
    if (!snapshot.autoCheckpoint || !entries || !day || day > today || !input.loans.length || entries.length !== input.loans.length || new Set(entries.map(entry => entry.loanId)).size !== input.loans.length || !input.loans.every(loan => entries.some(entry => entry.loanId === loan.id && entry.balanceKind === loan.balanceKind))) continue;
    loanObservations.push({ id: 'loans:' + snapshot.id, month: snapshot.month, balance: sum(entries.map(entry => entry.amount)), source: 'loan-history', observedOn: day, recordedAt, comparable: true });
  }
  let observations = hasAccounts ? accountObservations : loanObservations;
  if (hasAccounts && hasLoans) observations = accountObservations.flatMap(account => {
    const loan = loanObservations.find(loan => account.observedOn && loan.observedOn === account.observedOn);
    return loan ? [{ ...account, id: account.id + '+' + loan.id, balance: sum([account.balance, loan.balance]), source: 'combined' as const }] : [];
  });
  if (!hasAccounts && !hasLoans) observations = [];
  observations = [...observations].sort((a, b) => a.month.localeCompare(b.month) || (a.observedOn ?? '').localeCompare(b.observedOn ?? '') || (a.recordedAt ?? '').localeCompare(b.recordedAt ?? ''));
  const byMonth = new Map(observations.filter(point => point.comparable).map(point => [point.month, point]));
  const activity = paymentActivity(input.transactions, input.adjustments).filter(row => accountIds.has(row.accountId) && row.date <= today);
  const firstMonth = [...byMonth.keys(), ...(includeAccounts ? activity.map(row => row.date.slice(0, 7)) : []), month].sort()[0];
  const monthlyTrend = Array.from({ length: monthNumber(month) - monthNumber(firstMonth) + 1 }, (_, index) => {
    const key = new Date(Date.UTC(Number(firstMonth.slice(0, 4)), Number(firstMonth.slice(5, 7)) - 1 + index, 1)).toISOString().slice(0, 7);
    const point = byMonth.get(key) ?? null;
    const previousKey = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
    const previous = byMonth.get(previousKey);
    const rows = activity.filter(row => row.date.startsWith(key));
    return { month: key, savedBalance: point?.balance ?? null, observation: point,
      // Interval between saved observations, not a claim of complete calendar-month tracking.
      observedNetChange: point && previous ? round(point.balance - previous.balance) : null,
      recordedAccountChange: includeAccounts && rows.length ? sum(rows.map(row => row.difference)) : null };
  });

  const hasAutomatic = input.snapshots.some(snapshot => snapshot.autoCheckpoint);
  const trend: (typeof monthlyTrend[number] & { date?: string; id?: string })[] = hasAutomatic ? monthlyTrend.flatMap(period => {
    const points = observations.filter(point => point.comparable && point.month === period.month);
    return points.length ? points.map(point => ({ ...period, id: point.id, date: point.observedOn ?? undefined, savedBalance: point.balance, observation: point })) : [period];
  }) : monthlyTrend;

  let forecast: ReturnType<typeof buildActivePayoffCommitment> | null = null;
  if (input.forecast) {
    const candidate = buildActivePayoffCommitment(accounts.filter(account => !account.removedFromDebts), input.loans, input.forecast.items, input.forecast.settings, date);
    const excluded = new Set(input.forecast.settings.payoffExcludedTypes ?? []);
    const selectedAccounts = accounts.filter(account => !account.removedFromDebts && !('archivedAt' in account && account.archivedAt) && account.balance > 0 && !excluded.has(account.type));
    const selectedLoans = input.loans.filter(loan => loan.remainingAmount > 0 && !excluded.has(loanScheduleType(loan)));
    // The active schedule's type scope must match this view. Retained/archived balances cannot disappear.
    const sameScope = (!hasAccounts ? !selectedAccounts.length : accounts.filter(account => account.balance > 0).every(account => selectedAccounts.some(selected => selected.id === account.id))) &&
      (!hasLoans ? !selectedLoans.length : input.loans.filter(loan => loan.remainingAmount > 0).every(loan => selectedLoans.some(selected => selected.id === loan.id)));
    if (sameScope && Math.abs(candidate.scopeBalance - current) < .005 && candidate.schedule.complete && candidate.schedule.rows.length) forecast = candidate;
  }
  const events = [
    ...(includeAccounts ? activity.filter(row => row.kind === 'payment' && row.amount > 0 && row.difference < 0).map(row => ({ date: row.date, paidOff: row.before !== undefined && row.before > .005 && row.after !== undefined && row.after <= .005 })) : []),
    ...(includeLoans ? input.loans.flatMap(loan => loan.history.filter(entry => validDay(entry.date) && entry.date <= today && (entry.payment ?? 0) > 0).map(entry => ({ date: entry.date, paidOff: false }))) : []),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const debtObservedMonth = [
    ...(includeAccounts ? accountObservations.flatMap(point => {
      const snapshot = actual.snapshots.find(snapshot => snapshot.id === point.id);
      return snapshot?.accounts.some(saved => saved.balance <= .005 && accounts.some(account => account.id === saved.accountId && !account.removedFromDebts && (account.baselineBalance ?? 0) > 0)) ? [point.month] : [];
    }) : []),
    ...(includeLoans ? [...loanDays].flatMap(([day, entries]) => [...entries].some(([id, entry]) => entry.amount <= .005 && input.loans.some(loan => loan.id === id && loan.originalAmount > 0)) ? [day.slice(0, 7)] : []) : []),
  ].sort()[0] ?? null;
  const milestone = (id: ProgressMilestoneView['id'], label: string, threshold?: number): ProgressMilestoneView => {
    const event = id === 'first-payment' ? events[0] : id === 'first-debt' ? events.find(event => event.paidOff) : undefined;
    const observed = threshold === undefined ? undefined : observations.find(point => point.comparable && point.balance <= threshold + .005);
    const paidOffLive = id === 'first-debt' && ((includeAccounts && accounts.some(account => !account.removedFromDebts && (account.baselineBalance ?? 0) > 0 && account.balance <= .005)) || (includeLoans && input.loans.some(loan => loan.originalAmount > 0 && loan.remainingAmount <= .005)));
    const paidOffObserved = id === 'first-debt' ? debtObservedMonth : null;
    const live = paidOffLive || (threshold !== undefined && current <= threshold + .005 && (hasAccounts || hasLoans));
    const projectedMonth = threshold !== undefined ? forecast?.schedule.rows.find(row => row.remaining <= threshold + .005)?.month ?? null : id === 'first-debt' ? Object.values(forecast?.schedule.payoffMonths ?? {}).sort()[0] ?? null : null;
    return { id, label, status: event || observed || paidOffObserved || live ? 'achieved' : projectedMonth ? 'projected' : 'pending',
      achievedOn: event?.date ?? null, firstObservedMonth: event?.date.slice(0, 7) ?? observed?.month ?? paidOffObserved ?? null,
      projectedMonth: event || observed || paidOffObserved || live ? null : projectedMonth,
      evidence: event ? 'recorded-event' : observed || paidOffObserved ? 'saved-observation' : live ? 'live-balance' : projectedMonth ? 'forecast' : null };
  };
  const milestones = [milestone('first-payment', 'First payment recorded'), milestone('first-1000', 'First $1,000 eliminated', starting !== null && starting >= 1000 ? starting - 1000 : undefined), milestone('first-debt', 'First debt paid off'),
    milestone('quarter', '25% complete', starting !== null && starting > 0 ? starting * .75 : undefined), milestone('half', '50% complete', starting !== null && starting > 0 ? starting * .5 : undefined), milestone('three-quarter', '75% complete', starting !== null && starting > 0 ? starting * .25 : undefined), milestone('debt-free', 'Debt-free', 0)];
  return {
    scope, baselineKind: hasAccounts && hasLoans ? 'mixed' as const : hasLoans ? 'original-loan-amounts' as const : 'account-progress-baseline' as const, accountIds: includeAccounts ? [...accountIds] : [], loanIds: includeLoans ? input.loans.map(loan => loan.id) : [],
    summary: { starting, current, reduction, percent: starting !== null && starting > 0 && reduction !== null ? reduction / starting * 100 : null, comparisonAvailable: available, startingDate: null },
    live: { balance: current, asOf: today, source: 'live' as const }, observations, trend, milestones,
    // Account-only authority retained for snapshot controls; scoped UI reads summary/trend/milestones.
    actual, loanHistory: includeLoans ? input.loans.map(loan => ({ id: loan.id, balanceKind: loan.balanceKind, asOf: loan.asOf, history: loan.history })) : [],
    forecast: forecast?.schedule ?? null,
    // Saved forecast dates do not preserve comparable scope/origin/assumptions.
    fasterPayoffComparison: null,
  };
}

/** Fixed presentation groups retain the canonical whole-household authority.
 * Legacy Auto loan accounts stay persisted as accounts; only their view moves. */
function buildLegacyScopedProgressViews(input: Input) {
  const legacyAutos = input.accounts.filter(account => account.type === 'Auto loan');
  const household = buildProgressView(input, 'household');
  if (!legacyAutos.length) return { accounts: buildProgressView(input, 'accounts'), loans: buildProgressView(input, 'loans'), household, presentationLoans: input.loans };
  const all = household.actual.groups.flatMap(group => group.accounts);
  const baseline = (id: string) => all.find(account => account.id === id)?.baselineBalance;
  const virtual: LoanTracker[] = legacyAutos.map(account => ({ id: 'legacy-auto:' + account.id, name: account.name, kind: 'car', originalAmount: baseline(account.id) ?? 0, remainingAmount: all.find(item => item.id === account.id)?.balance ?? account.balance, balanceKind: 'principal', asOf: household.live.asOf, budgetItemId: '', budgetItemName: '', history: input.snapshots.flatMap(snapshot => {
    const saved = snapshot.accounts.find(item => item.accountId === account.id);
    const date = timestamp(snapshot.capturedAt) ? householdDate(new Date(snapshot.capturedAt)) : null;
    return saved && date?.startsWith(snapshot.month) ? [{date, amount:saved.balance, balanceKind:'principal' as const, recordedAt:snapshot.capturedAt}] : [];
  }) }));
  const ids = new Set(legacyAutos.map(account => account.id));
  const snapshots = input.snapshots.map(snapshot => { const accounts = snapshot.accounts.filter(account => !ids.has(account.accountId));return {...snapshot,accounts,totalBalance:sum(accounts.map(account=>account.balance))}; });
  const autoStart = virtual.every(loan => loan.originalAmount > 0) ? sum(virtual.map(loan => loan.originalAmount)) : null;
  const startingBalance = input.startingBalance !== undefined && autoStart !== null && input.startingBalance >= autoStart ? round(input.startingBalance-autoStart) : undefined;
  return { accounts: buildProgressView({...input,accounts:input.accounts.filter(account=>!ids.has(account.id)),snapshots,startingBalance},'accounts'), loans:buildProgressView({...input,accounts:[],removedAccounts:[],snapshots:input.snapshots.map(snapshot=>({...snapshot,loanBalances:[...(snapshot.loanBalances??[]),...snapshot.accounts.filter(account=>ids.has(account.accountId)).map(account=>({loanId:'legacy-auto:'+account.accountId,amount:account.balance,balanceKind:'principal' as const}))]})),loans:[...input.loans,...virtual],startingBalance:undefined,forecast:undefined},'loans'),household,presentationLoans:[...input.loans,...virtual] };
}

/** The carousel partitions existing debt records; it never changes their stored kind or balances. */
export function buildScopedProgressViews(input: Input) {
  const base=buildLegacyScopedProgressViews(input);
  const category=(kind:LoanTracker['kind'])=>{
    const loans=base.presentationLoans.filter(loan=>loan.kind===kind);
    const ids=new Set(loans.map(loan=>loan.id));
    const snapshots=input.snapshots.map(snapshot=>({...snapshot,loanBalances:[...(snapshot.loanBalances??[]).filter(entry=>ids.has(entry.loanId)),...snapshot.accounts.filter(entry=>ids.has('legacy-auto:'+entry.accountId)).map(entry=>({loanId:'legacy-auto:'+entry.accountId,amount:entry.balance,balanceKind:'principal' as const}))]}));
    return buildProgressView({...input,accounts:[],removedAccounts:[],loans,snapshots,startingBalance:undefined,forecast:undefined},'loans');
  };
  return {...base,home:category('house'),auto:category('car')};
}
