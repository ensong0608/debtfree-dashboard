'use client';

import { useId, useState } from 'react';
import { duePaymentCandidates, dueReminderUrgency, type DuePaymentCandidate, type DueReminder } from './due-reminders';
import type { BalanceAdjustment, CashflowItem, LedgerTransaction, MonthlyPlanSettings } from './dashboard-data';
import type { LoanTracker } from './loan-progress';
import { householdDate } from './household-date';
import { createHouseholdMoneyFormatter } from './household-currency';
import { useHouseholdCurrency } from './household-currency-context';
import OutlineIcon from './outline-icon';
import styles from './home-dashboard.module.css';

export type ReminderPaymentActions = {
  readOnly: boolean;
  transactions: LedgerTransaction[];
  adjustments: BalanceAdjustment[];
  loans: LoanTracker[];
  items: CashflowItem[];
  months: MonthlyPlanSettings['months'];
  duePaymentAssociations?: MonthlyPlanSettings['duePaymentAssociations'];
  onLink: (reminder: DueReminder, candidate: DuePaymentCandidate) => string | null;
  onRecordNew: (reminder: DueReminder) => void;
  onOpen: (reminder: DueReminder) => void;
};

export default function HomeDueReminders({ reminders, readOnly, transactions, adjustments, loans, items, months, duePaymentAssociations, onLink, onRecordNew, onOpen, fullPage = false, onSeeAll }: ReminderPaymentActions & { reminders: DueReminder[]; fullPage?: boolean; onSeeAll?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState<DueReminder | null>(null);
  const [error, setError] = useState('');
  const listId = useId();
  const money = createHouseholdMoneyFormatter(useHouseholdCurrency(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const candidates = pending ? duePaymentCandidates(pending, { transactions, adjustments, loans, items, settings: { months, duePaymentAssociations }, today: householdDate() }) : [];
  return <>{Boolean(reminders.length) && <section className={fullPage ? "next-due-list " + styles.reminderCard : styles.reminderCard} aria-label="Upcoming due reminders">
    <header className={styles.sectionHeader}>
      <div className={styles.reminderHeading}><span><OutlineIcon name="bell"/></span><h2>Next Due</h2></div>
      {!fullPage && (onSeeAll || reminders.length > 3) && <button type="button" className={styles.reminderToggle} aria-expanded={onSeeAll ? undefined : expanded} aria-controls={onSeeAll ? undefined : listId} onClick={() => onSeeAll ? onSeeAll() : setExpanded(value => !value)}>{!onSeeAll && expanded ? 'Show less' : `See all (${reminders.length})`}</button>}
    </header>
    <ul className={styles.reminderRows} id={listId}>{(fullPage || expanded ? reminders : reminders.slice(0, 3)).map(reminder => {
      const date = new Date(reminder.date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
      const urgency = dueReminderUrgency(reminder.daysAway);
      const when = urgency === 'overdue' ? `Overdue · ${Math.abs(reminder.daysAway)} ${Math.abs(reminder.daysAway) === 1 ? 'day' : 'days'}` : reminder.daysAway === 0 ? 'Due today' : reminder.daysAway === 1 ? 'Due tomorrow' : `In ${reminder.daysAway} days`;
      return <li key={reminder.id}><button type="button" className={styles.reminderRow} onClick={() => onOpen(reminder)} data-dialog-return-id={reminder.id} aria-label={`View ${reminder.name}, ${when.toLowerCase()}, ${money.format(reminder.amount)} remaining`}>
        <span className={styles.reminderIcon} data-soon={urgency === 'critical' || urgency === 'overdue'}><OutlineIcon name={reminder.kind === 'spending' ? 'receipt' : reminder.kind === 'loan' ? 'calendar' : 'card'}/></span>
        <span className={styles.reminderCopy}><strong>{reminder.name}</strong><small>{(urgency === 'critical' || urgency === 'overdue') && <b className={styles.reminderCritical}>{urgency === 'overdue' ? 'Overdue · ' : 'Critical · '}</b>}<span data-soon={urgency === 'critical' || urgency === 'overdue'}>{urgency === 'overdue' ? `${Math.abs(reminder.daysAway)} ${Math.abs(reminder.daysAway) === 1 ? 'day' : 'days'} past due` : when}</span> · <time dateTime={reminder.date}>{date}</time></small>{reminder.paidAmount > 0 && <small>Paid {money.format(reminder.paidAmount)} · Remaining {money.format(reminder.amount)}</small>}</span>
        <span className={styles.reminderAmount}><strong className="money-value">{money.format(reminder.amount)}</strong><small>{reminder.kind === 'account' ? 'Remaining minimum' : reminder.kind === 'loan' ? 'Remaining payment' : 'Remaining bill'}</small></span>
        <OutlineIcon name="chevron"/>
      </button>{!readOnly && <button type="button" className={styles.reminderPaid} data-dialog-return-id={reminder.id} aria-label={`Record or link payment for ${reminder.name}`} onClick={() => { setPending(reminder); setError(''); }}><OutlineIcon name="check"/>{reminder.kind === 'spending' ? 'Pair transaction' : 'Record payment'}</button>}</li>;
    })}</ul>
  </section>}
  {pending && !readOnly && <div className={styles.duePaymentBackdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPending(null); }}>
    <section className={styles.duePaymentDialog} role="dialog" aria-modal="true" aria-labelledby="due-payment-title">
      <header><h2 id="due-payment-title">{pending.kind === 'spending' ? 'Pair bill transaction' : 'Payment for ' + pending.name}</h2><button type="button" aria-label="Close" onClick={() => setPending(null)}>×</button></header>
      <dl><div><dt>{pending.kind === 'account' ? 'Required minimum' : 'Required amount'}</dt><dd>{money.format(pending.requiredAmount)}</dd></div><div><dt>Paid this cycle</dt><dd>{money.format(pending.paidAmount)}</dd></div><div><dt>Remaining</dt><dd>{money.format(pending.amount)}</dd></div><div><dt>Due date</dt><dd>{new Date(pending.date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}</dd></div></dl>
      {error && <p role="alert">{error}</p>}
      <div className={styles.duePaymentCandidates}>
        <h3>Use an existing record</h3>
        {candidates.length ? candidates.map(candidate => <button type="button" key={candidate.source.type + ':' + candidate.source.id} onClick={() => { const issue = onLink(pending, candidate); if (issue) setError(issue); else setPending(null); }}><span><strong>{candidate.title}</strong><small>{candidate.kind} · {new Date(candidate.date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}</small></span><b className="money-value">{money.format(candidate.amount)}</b></button>) : <p>No eligible unlinked records are available for this due date.</p>}
      </div>
      {pending.kind === 'account' && <button className="primary" type="button" onClick={() => { const reminder = pending; setPending(null); onRecordNew(reminder); }}>Record a new payment</button>}
      {pending.kind === 'loan' && <><p className={styles.duePaymentHint}>Record a new loan payment in the loan details, then pair it with this due date.</p><button className="primary" type="button" onClick={() => { const reminder = pending; setPending(null); onRecordNew(reminder); }}>Open loan details</button></>}
      {pending.kind === 'spending' && <><p className={styles.duePaymentHint}>Record a bill payment, then pair it here.</p><button className="primary" type="button" onClick={() => { const reminder = pending; setPending(null); onRecordNew(reminder); }}>Record bill payment</button></>}
      <footer><button type="button" className="secondary" onClick={() => setPending(null)}>Close</button></footer>
    </section>
  </div>}
  </>;
}
