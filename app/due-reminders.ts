import type { BalanceAdjustment, CashflowItem, DebtAccount, DuePaymentAssociation, LedgerTransaction, MonthlyPlanSettings, PlanSettlement } from './dashboard-data.ts';
import { householdDate } from './household-date.ts';
import { linkedLoanPayment, regularLoanPayment, type LoanTracker } from './loan-progress.ts';
import { effectiveMinimum, estimatedMinimum, round } from './payoff-engine.ts';
import { nextDueDate, recurringDueDate } from './recurring-due-date.ts';

export type DueReminder = {
  id: string;
  name: string;
  kind: 'account' | 'loan' | 'spending';
  targetId: string;
  date: string;
  requiredAmount: number;
  paidAmount: number;
  amount: number;
  daysAway: number;
  paymentStatus: 'unpaid' | 'partially-paid';
};

export type DuePaymentSource = DuePaymentAssociation['source'];
export type DuePaymentCandidate = {
  source: DuePaymentSource;
  title: string;
  date: string;
  amount: number;
  kind: 'payment' | 'confirmed balance payment' | 'loan payment' | 'Budget transaction' | 'Budget paid record';
};

export function dueReminderUrgency(daysAway: number): 'critical' | 'upcoming' | 'overdue' | null {
  if (!Number.isInteger(daysAway)) return null;
  if (daysAway < 0) return 'overdue';
  if (daysAway > 10) return null;
  return daysAway <= 3 ? 'critical' : 'upcoming';
}

/** Historical dismissal records remain in backups but are not payment evidence. */
export function setDueReminderPaid(settings: MonthlyPlanSettings, reminder: Pick<DueReminder, 'id' | 'date'>, paid: boolean, now = new Date().toISOString()): MonthlyPlanSettings {
  if (!/^(account|loan|spending):.+$/.test(reminder.id) || !validDate(reminder.date)) throw new Error('This reminder is invalid.');
  const records = settings.dueReminderPaid ?? [];
  const exists = records.some(record => record.id === reminder.id && record.date === reminder.date);
  if (exists === paid) return settings;
  return { ...settings, dueReminderPaid: paid ? [...records, { id: reminder.id, date: reminder.date, markedAt: now }] : records.filter(record => record.id !== reminder.id || record.date !== reminder.date) };
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}
function addMonth(month: string) {
  return new Date(month + '-01T12:00:00Z').toISOString().slice(0, 7) === month
    ? (() => { const next = new Date(month + '-01T12:00:00Z'); next.setUTCMonth(next.getUTCMonth() + 1); return next.toISOString().slice(0, 7); })()
    : '';
}
function dueOccurrence(savedDate: string, today: string) {
  const current = recurringDueDate(savedDate, today.slice(0, 7));
  return current || nextDueDate(savedDate, today);
}

export function loanHistorySourceId(loanId: string, entry: LoanTracker['history'][number]) {
  return `${loanId}:${entry.date}:${entry.recordedAt}`;
}

export function associateDuePayment(settings: MonthlyPlanSettings, reminder: Pick<DueReminder, 'id' | 'date'>, source: DuePaymentSource): MonthlyPlanSettings {
  if (!/^(account|loan|spending):.+$/.test(reminder.id) || !validDate(reminder.date) || !source.id.trim()) throw new Error('This payment link is invalid.');
  const links = settings.duePaymentAssociations ?? [];
  if (links.some(link => link.source.type === source.type && link.source.id === source.id && (link.reminderId !== reminder.id || link.dueDate !== reminder.date))) throw new Error('This payment is already assigned to another due date.');
  if (links.some(link => link.reminderId === reminder.id && link.dueDate === reminder.date && link.source.type === source.type && link.source.id === source.id)) return settings;
  return { ...settings, duePaymentAssociations: [...links, { reminderId: reminder.id, dueDate: reminder.date, source }] };
}

function allSettlements(settings: Pick<MonthlyPlanSettings, 'months'>): PlanSettlement[] {
  return Object.values(settings.months).flatMap(month => month.settlements ?? []);
}

function currentTransaction(id: string, transactions: LedgerTransaction[]) {
  let row = transactions.find(item => item.id === id);
  const seen = new Set<string>();
  while (row?.replacedByTransactionId && !seen.has(row.id)) {
    seen.add(row.id);
    const replacementId = row.replacedByTransactionId;
    row = transactions.find(item => item.id === replacementId);
  }
  return row;
}

function sourceAmount(source: DuePaymentSource, reminder: Pick<DueReminder, 'id' | 'date'>, data: {
  transactions: LedgerTransaction[]; adjustments: BalanceAdjustment[]; loans: LoanTracker[]; items: CashflowItem[]; settings: Pick<MonthlyPlanSettings, 'months' | 'duePaymentAssociations'>; today?: string;
}): number {
  const [kind, targetId] = reminder.id.split(':', 2);
  if (source.type === 'transaction') {
    const row = currentTransaction(source.id, data.transactions);
    if (!row || row.deletedAt || row.replacedByTransactionId || row.date > (data.today ?? reminder.date) || row.includedIn) return 0;
    if (kind === 'account' && row.type === 'payment' && row.accountId === targetId && row.credit !== true && row.reductionKind !== 'adjustment' && row.paymentKind !== 'extra') return row.amount;
    if (kind === 'spending' && row.type === 'charge' && row.plannedItemId === targetId) return row.amount;
    if (kind === 'loan' && row.type === 'charge') {
      const loan = data.loans.find(item => item.id === targetId);
      const linkedItem = loan ? linkedLoanPayment(loan, data.items) : null;
      if (linkedItem && row.plannedItemId === linkedItem.id) return row.amount;
    }
    return 0;
  }
  if (source.type === 'adjustment') {
    const row = data.adjustments.find(item => item.id === source.id);
    if (kind !== 'account' || !row || row.deletedAt || row.accountId !== targetId || row.date > (data.today ?? reminder.date) || row.difference >= 0 || !row.confirmedPayment || row.reportKind === 'credit') return 0;
    return Math.abs(row.difference);
  }
  if (source.type === 'loan-history') {
    if (kind !== 'loan') return 0;
    const loan = data.loans.find(item => item.id === targetId);
    const entry = loan?.history.find(item => loanHistorySourceId(targetId, item) === source.id);
    if (!entry || entry.date > (data.today ?? reminder.date) || !Number.isFinite(entry.payment) || (entry.payment ?? 0) <= 0) return 0;
    return entry.payment!;
  }
  const loan = kind === 'loan' ? data.loans.find(item => item.id === targetId) : null;
  const linkedItem = loan ? linkedLoanPayment(loan, data.items) : null;
  const settlementTargetId = kind === 'spending' ? targetId : linkedItem?.id;
  if (!settlementTargetId) return 0;
  const row = allSettlements(data.settings).find(item => `settlement:${item.id}` === source.id);
  if (!row || row.targetId !== settlementTargetId || row.kind !== 'spending' || row.date > (data.today ?? reminder.date)) return 0;
  return row.amount;
}

function eligiblePaidAmount(reminder: Pick<DueReminder, 'id' | 'date'>, data: {
  transactions: LedgerTransaction[]; adjustments: BalanceAdjustment[]; loans: LoanTracker[]; items: CashflowItem[]; settings: Pick<MonthlyPlanSettings, 'months' | 'duePaymentAssociations'>; today?: string;
}): number {
  const links = data.settings.duePaymentAssociations ?? [];
  const acceptedReminderIds = new Set([reminder.id]);
  const [kind, targetId] = reminder.id.split(':', 2);
  if (kind === 'loan') {
    const loan = data.loans.find(item => item.id === targetId);
    const linkedItem = loan ? linkedLoanPayment(loan, data.items) : null;
    if (linkedItem) acceptedReminderIds.add(`spending:${linkedItem.id}`);
  }
  const seen = new Set<string>();
  return round(links.filter(link => acceptedReminderIds.has(link.reminderId) && link.dueDate === reminder.date).reduce((sum, link) => {
    const key = `${link.source.type}:${link.source.id}`;
    if (seen.has(key)) return sum;
    seen.add(key);
    return sum + sourceAmount(link.source, reminder, data);
  }, 0));
}

/** List only valid, unassigned records; matching by date/amount alone never links a payment. */
export function duePaymentCandidates(reminder: DueReminder, data: {
  transactions: LedgerTransaction[]; adjustments: BalanceAdjustment[]; loans: LoanTracker[]; items: CashflowItem[]; settings: Pick<MonthlyPlanSettings, 'months' | 'duePaymentAssociations'>; today?: string;
}): DuePaymentCandidate[] {
  const linked = new Set((data.settings.duePaymentAssociations ?? []).map(row => `${row.source.type}:${row.source.id}`));
  for (const association of data.settings.duePaymentAssociations ?? []) {
    if (association.source.type !== 'transaction') continue;
    const current = currentTransaction(association.source.id, data.transactions);
    if (current) linked.add(`transaction:${current.id}`);
  }
  const candidates: DuePaymentCandidate[] = [];
  const add = (candidate: DuePaymentCandidate) => {
    if (candidate.date <= (data.today ?? reminder.date) && candidate.amount > 0 && !linked.has(`${candidate.source.type}:${candidate.source.id}`) && sourceAmount(candidate.source, reminder, data) > 0) candidates.push(candidate);
  };
  if (reminder.kind === 'account') {
    for (const row of data.transactions) {
      if (!row.replacedByTransactionId && row.type === 'payment' && row.accountId === reminder.targetId) add({ source: { type: 'transaction', id: row.id }, title: row.title || row.payeeName || 'Recorded payment', date: row.date, amount: row.amount, kind: 'payment' });
    }
    for (const row of data.adjustments) {
      if (row.accountId === reminder.targetId && row.confirmedPayment) add({ source: { type: 'adjustment', id: row.id }, title: row.title || 'Confirmed balance payment', date: row.date, amount: Math.abs(row.difference), kind: 'confirmed balance payment' });
    }
  } else if (reminder.kind === 'loan') {
    const loan = data.loans.find(item => item.id === reminder.targetId);
    if (loan) {
      for (const entry of loan.history) if ((entry.payment ?? 0) > 0) add({ source: { type: 'loan-history', id: loanHistorySourceId(reminder.targetId, entry) }, title: `Loan payment · ${loan.name}`, date: entry.date, amount: entry.payment!, kind: 'loan payment' });
      const linkedItem = linkedLoanPayment(loan, data.items);
      if (linkedItem) {
        for (const row of data.transactions) if (!row.replacedByTransactionId && row.type === 'charge' && row.plannedItemId === linkedItem.id) add({ source: { type: 'transaction', id: row.id }, title: row.title || row.payeeName || `${linkedItem.name} Budget transaction`, date: row.date, amount: row.amount, kind: 'Budget transaction' });
        for (const row of allSettlements(data.settings)) if (row.targetId === linkedItem.id && row.kind === 'spending') add({ source: { type: 'settlement', id: `settlement:${row.id}` }, title: row.name || `${linkedItem.name} Budget paid record`, date: row.date, amount: row.amount, kind: 'Budget paid record' });
      }
    }
  } else {
    for (const row of data.transactions) {
      if (!row.replacedByTransactionId && row.type === 'charge' && row.plannedItemId === reminder.targetId) add({ source: { type: 'transaction', id: row.id }, title: row.title || row.payeeName || 'Budget transaction', date: row.date, amount: row.amount, kind: 'Budget transaction' });
    }
    for (const row of allSettlements(data.settings)) {
      if (row.targetId === reminder.targetId && row.kind === 'spending') add({ source: { type: 'settlement', id: `settlement:${row.id}` }, title: row.name || 'Budget paid record', date: row.date, amount: row.amount, kind: 'Budget paid record' });
    }
  }
  return candidates.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

/** Build current-cycle reminders from visible obligation settings and explicit payment links only.
 * Old dismissal acknowledgements and monthly payoff targets do not affect amounts or status.
 */
export function buildDueReminders({ accounts, loans, items, transactions, adjustments = [], settings, today = householdDate(), upcomingWindow = 10 }: {
  accounts: DebtAccount[];
  loans: LoanTracker[];
  items: CashflowItem[];
  transactions: LedgerTransaction[];
  adjustments?: BalanceAdjustment[];
  settings: MonthlyPlanSettings;
  today?: string;
  upcomingWindow?: number | null;
}): DueReminder[] {
  const nextMonth = addMonth(today.slice(0, 7));
  const data = { transactions, adjustments, loans, items, settings, today };
  const reminders: DueReminder[] = [];
  const add = (kind: DueReminder['kind'], targetId: string, name: string, savedDate: string, requiredAmount: number) => {
    if (!Number.isFinite(requiredAmount) || requiredAmount <= 0) return;
    let date = dueOccurrence(savedDate, today);
    if (!date) return;
    const id = `${kind}:${targetId}`;
    let paidAmount = eligiblePaidAmount({ id, date }, data);
    if (paidAmount >= requiredAmount) {
      date = recurringDueDate(savedDate, nextMonth);
      if (!date) return;
      paidAmount = eligiblePaidAmount({ id, date }, data);
    }
    const daysAway = Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
    if (upcomingWindow !== null && daysAway > upcomingWindow) return;
    const amount = round(Math.max(0, requiredAmount - paidAmount));
    if (amount <= 0) return;
    reminders.push({ id, kind, targetId, name, date, requiredAmount: round(requiredAmount), paidAmount, amount, daysAway, paymentStatus: paidAmount > 0 ? 'partially-paid' : 'unpaid' });
  };

  for (const account of accounts) {
    if (account.archivedAt || account.balance <= 0) continue;
    const visibleMinimum = Number.isFinite(account.minimum) && account.minimum > 0 ? effectiveMinimum(account) : estimatedMinimum(account.balance, account.apr);
    add('account', account.id, account.name, account.dueDate, visibleMinimum);
  }
  for (const loan of loans) {
    if (loan.remainingAmount <= 0) continue;
    const linked = linkedLoanPayment(loan, items);
    const savedDate = loan.dueDate || (linked?.dueDay ? `2000-01-${String(linked.dueDay).padStart(2, '0')}` : '');
    add('loan', loan.id, loan.name, savedDate, regularLoanPayment(loan, items) ?? 0);
  }
  for (const item of items) {
    if (item.kind === 'income' || !(item.recurring ?? item.kind !== 'purchase') || !Number.isInteger(item.dueDay) || item.dueDay! < 1 || item.dueDay! > 31) continue;
    if (loans.some(loan => loan.remainingAmount > 0 && linkedLoanPayment(loan, items)?.id === item.id)) continue;
    add('spending', item.id, item.name, `2000-01-${String(item.dueDay).padStart(2, '0')}`, item.amount);
  }
  return reminders.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
