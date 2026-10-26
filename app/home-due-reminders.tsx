'use client';

import { useId, useState } from 'react';
import { dueReminderUrgency, type DueReminder } from './due-reminders';
import { createHouseholdMoneyFormatter } from './household-currency';
import { useHouseholdCurrency } from './household-currency-context';
import OutlineIcon from './outline-icon';
import ActionConfirmation from './action-confirmation';
import styles from './home-dashboard.module.css';

export type ReminderPaidActions = { readOnly: boolean; paidReminder?: Pick<DueReminder, 'id' | 'name' | 'date'>; onPaid: (reminder: DueReminder) => string | null; onUndoPaid: (reminder: Pick<DueReminder, 'id' | 'date'>) => void };

export default function HomeDueReminders({ reminders, onOpen, readOnly, paidReminder, onPaid, onUndoPaid }: ReminderPaidActions & { reminders: DueReminder[]; onOpen: (reminder: DueReminder) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState<DueReminder | null>(null);
  const [error, setError] = useState('');
  const listId = useId();
  const money = createHouseholdMoneyFormatter(useHouseholdCurrency(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <>{Boolean(reminders.length) && <section className={styles.reminderCard} aria-label="Upcoming due reminders">
    <header className={styles.sectionHeader}>
      <div className={styles.reminderHeading}><span><OutlineIcon name="bell"/></span><h2>Next due</h2></div>
      {reminders.length > 3 && <button type="button" className={styles.reminderToggle} aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : `See all (${reminders.length})`}</button>}
    </header>
    <ul className={styles.reminderRows} id={listId}>{(expanded ? reminders : reminders.slice(0, 3)).map(reminder => {
      const date = new Date(reminder.date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
      const critical = dueReminderUrgency(reminder.daysAway) === 'critical';
      const when = reminder.daysAway === 0 ? 'Due today' : reminder.daysAway === 1 ? 'Due tomorrow' : `In ${reminder.daysAway} days`;
      return <li key={reminder.id}><button type="button" className={styles.reminderRow} onClick={() => onOpen(reminder)} data-dialog-return-id={reminder.id} aria-label={`View ${reminder.name}, ${when.toLowerCase()}, ${money.format(reminder.amount)}`}>
        <span className={styles.reminderIcon} data-soon={critical}><OutlineIcon name={reminder.kind === 'spending' ? 'receipt' : reminder.kind === 'loan' ? 'calendar' : 'card'}/></span>
        <span className={styles.reminderCopy}><strong>{reminder.name}</strong><small>{critical && <b className={styles.reminderCritical}>Critical · </b>}<span data-soon={critical}>{when}</span> · <time dateTime={reminder.date}>{date}</time></small></span>
        <span className={styles.reminderAmount}><strong className="money-value">{money.format(reminder.amount)}</strong><small>{reminder.kind === 'account' ? 'Minimum' : reminder.kind === 'loan' ? 'Loan payment' : 'Recurring bill'}</small></span>
        <OutlineIcon name="chevron"/>
      </button>{!readOnly && <button type="button" className={styles.reminderPaid} data-dialog-return-id={reminder.id} aria-label={`Mark ${reminder.name} as paid`} onClick={() => { setPending(reminder); setError(''); }}><OutlineIcon name="check"/>Mark as paid</button>}</li>;
    })}</ul>
  </section>}
    {paidReminder && <div className={styles.reminderNotice} role="status"><span>{paidReminder.name} marked paid for {new Date(paidReminder.date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}.</span>{!readOnly && <button type="button" data-dialog-return-id={paidReminder.id} aria-label={`Undo marking ${paidReminder.name} paid`} onClick={() => onUndoPaid(paidReminder)}>Undo</button>}</div>}
    {pending && !readOnly && <ActionConfirmation tone="primary" title="Mark reminder as paid?" message={error || `${pending.name} · ${new Date(pending.date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}. This clears this reminder. Balances stay unchanged.`} confirmLabel="Mark as paid" onCancel={() => setPending(null)} onConfirm={() => { const error = onPaid(pending); if (error) setError(error); else setPending(null); }}/>}</>;
}
