'use client';

import { useId, useState } from 'react';
import { duePaymentCandidates, dueReminderUrgency, type DuePaymentCandidate, type DueReminder } from './due-reminders';
import type { BalanceAdjustment, CashflowItem, LedgerTransaction, MonthlyPlanSettings } from './dashboard-data';
import type { LoanTracker } from './loan-progress';
import { householdDate } from './household-date';
import { createHouseholdMoneyFormatter } from './household-currency';
import { useHouseholdCurrency } from './household-currency-context';
import NumericInput from './numeric-input';
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
  onCorrectCycle?: (reminder:DueReminder,amount:number)=>string|null;
};

export default function HomeDueReminders({ reminders, readOnly, transactions, adjustments, loans, items, months, duePaymentAssociations, onLink, onRecordNew, onOpen, fullPage = false, onSeeAll, onCorrectCycle }: ReminderPaymentActions & { reminders: DueReminder[]; fullPage?: boolean; onSeeAll?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState<DueReminder | null>(null);
  const [error, setError] = useState('');
  const [cycleAmount,setCycleAmount]=useState(NaN);
  const legacy=(reminder:DueReminder)=>reminder.kind==='account' && duePaymentAssociations?.some(link=>link.reminderId===reminder.id&&link.dueDate===reminder.date&&link.requiredAmount===undefined);
  const listId = useId();
  const money = createHouseholdMoneyFormatter(useHouseholdCurrency(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const candidates = pending ? duePaymentCandidates(pending, { transactions, adjustments, loans, items, settings: { months, duePaymentAssociations }, today: householdDate() }) : [];
  return <>{Boolean(reminders.length) && <section className={fullPage ? "next-due-list " + styles.reminderCard : styles.reminderCard} aria-label="Upcoming due reminders">
    <header className={styles.sectionHeader}>
      <div className={styles.reminderHeading}><span><OutlineIcon name="bell"/></span><h2>Upcoming</h2></div>
      {!fullPage && (onSeeAll || reminders.length > 3) && <button type="button" className={styles.reminderToggle} aria-expanded={onSeeAll ? undefined : expanded} aria-controls={onSeeAll ? undefined : listId} onClick={() => onSeeAll ? onSeeAll() : setExpanded(value => !value)}>{!onSeeAll && expanded ? 'Show less' : `See all (${reminders.length})`}</button>}
    </header>
    <ul className={styles.reminderRows} id={listId}>{(fullPage || expanded ? reminders : reminders.slice(0, 3)).map(reminder => {
      const date = new Date(reminder.date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
      const urgency = dueReminderUrgency(reminder.daysAway);
      return <li key={reminder.id+":"+reminder.date}><button type="button" className={styles.reminderRow} onClick={() => { if(readOnly){onOpen(reminder);return;} const available=duePaymentCandidates(reminder,{transactions,adjustments,loans,items,settings:{months,duePaymentAssociations},today:householdDate()});if(available.length||legacy(reminder)){setPending(reminder);setCycleAmount(reminder.requiredAmount);setError('');}else onRecordNew(reminder); }} data-dialog-return-id={reminder.id+":"+reminder.date} aria-label={`${readOnly ? 'View' : 'Pay Now for'} ${reminder.name}, ${urgency === 'overdue' ? 'overdue, ' : ''}due ${date}, ${money.format(reminder.amount)} remaining`}>
        <span className={styles.reminderIcon} data-soon={urgency === 'critical' || urgency === 'overdue'}><OutlineIcon name={reminder.kind === 'spending' ? 'receipt' : reminder.kind === 'loan' ? 'calendar' : 'card'}/></span>
        <span className={styles.reminderCopy}><strong>{reminder.name}</strong><small>Due <time dateTime={reminder.date}>{date}</time>{urgency === 'overdue' && <b className={styles.reminderCritical}> · Overdue</b>}{urgency === 'critical' && <b className={styles.reminderCritical}> · Critical</b>}</small>{reminder.paidAmount > 0 && <small>Paid {money.format(reminder.paidAmount)} this cycle</small>}</span>
        <span className={styles.reminderAmount}><strong className="money-value">{money.format(reminder.amount)}</strong><span className={styles.payNow}>{readOnly ? 'View' : 'Pay Now'}</span></span>
      </button></li>;
    })}</ul>
  </section>}
  {pending && !readOnly && <div className={styles.duePaymentBackdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPending(null); }}>
    <section className={styles.duePaymentDialog} role="dialog" aria-modal="true" aria-labelledby="due-payment-title">
      <header><h2 id="due-payment-title">{pending.kind === 'spending' ? 'Pair bill transaction' : 'Payment for ' + pending.name}</h2><button type="button" aria-label="Close" onClick={() => setPending(null)}>×</button></header>
      <dl><div><dt>{pending.kind === 'account' ? 'Required minimum' : 'Required amount'}</dt><dd>{money.format(pending.requiredAmount)}</dd></div><div><dt>Paid this cycle</dt><dd>{money.format(pending.paidAmount)}</dd></div><div><dt>Remaining</dt><dd>{money.format(pending.amount)}</dd></div><div><dt>Due date</dt><dd>{new Date(pending.date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}</dd></div></dl>
      {legacy(pending) && onCorrectCycle && <div className="legacy-cycle-correction"><label><span>Original minimum for this due date</span><NumericInput aria-label="Original minimum for this due date" value={cycleAmount} onValueChange={setCycleAmount}/></label><button type="button" className="secondary" onClick={()=>{if(!Number.isFinite(cycleAmount)||cycleAmount<=0||Math.round(cycleAmount*100)/100!==cycleAmount){setError('Enter an amount greater than 0.');return;}const issue=onCorrectCycle(pending,cycleAmount);if(issue)setError(issue);else setPending(null);}}>Save original minimum</button></div>}
      {error && <p role="alert">{error}</p>}
      <div className={styles.duePaymentCandidates}>
        <h3>Match a recorded payment</h3>
        {candidates.length > 0 && <p>These payments are recorded but not assigned to this due date. Select one to match it to this cycle.</p>}
        {candidates.length ? candidates.map(candidate => <button type="button" key={candidate.source.type + ':' + candidate.source.id} onClick={() => { const issue = onLink(pending, candidate); if (issue) setError(issue); else setPending(null); }}><span><strong>{candidate.title}</strong><small>{candidate.kind} · {new Date(candidate.date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}</small></span><b className="money-value">{money.format(candidate.amount)}</b></button>) : <p>No eligible unlinked records are available for this due date.</p>}
      </div>
      <footer><button type="button" className="secondary" onClick={() => setPending(null)}>Close</button><button type="button" className="primary" onClick={() => { const reminder=pending;setPending(null);onRecordNew(reminder); }}>Record new payment</button></footer>
    </section>
  </div>}
  </>;
}
