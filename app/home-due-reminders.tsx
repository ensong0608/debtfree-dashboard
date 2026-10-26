'use client';

import { useId, useState } from 'react';
import type { DueReminder } from './due-reminders';
import { createHouseholdMoneyFormatter } from './household-currency';
import { useHouseholdCurrency } from './household-currency-context';
import OutlineIcon from './outline-icon';
import styles from './home-dashboard.module.css';

export default function HomeDueReminders({ reminders, onOpen }: { reminders: DueReminder[]; onOpen: (reminder: DueReminder) => void }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const money = createHouseholdMoneyFormatter(useHouseholdCurrency(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <section className={styles.reminderCard} aria-label="Upcoming due reminders">
    <header className={styles.sectionHeader}>
      <div className={styles.reminderHeading}><span><OutlineIcon name="bell"/></span><h2>Next due</h2></div>
      {reminders.length > 3 && <button type="button" className={styles.reminderToggle} aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : `See all (${reminders.length})`}</button>}
    </header>
    {reminders.length ? <ul className={styles.reminderRows} id={listId}>{(expanded ? reminders : reminders.slice(0, 3)).map(reminder => {
      const date = new Date(reminder.date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
      const when = reminder.daysAway === 0 ? 'Due today' : reminder.daysAway === 1 ? 'Due tomorrow' : `In ${reminder.daysAway} days`;
      return <li key={reminder.id}><button type="button" className={styles.reminderRow} onClick={() => onOpen(reminder)} data-dialog-return-id={reminder.id} aria-label={`View ${reminder.name}, ${when.toLowerCase()}, ${money.format(reminder.amount)}`}>
        <span className={styles.reminderIcon} data-soon={reminder.daysAway <= 3}><OutlineIcon name={reminder.kind === 'spending' ? 'receipt' : reminder.kind === 'loan' ? 'calendar' : 'card'}/></span>
        <span className={styles.reminderCopy}><strong>{reminder.name}</strong><small><span data-soon={reminder.daysAway <= 3}>{when}</span> · <time dateTime={reminder.date}>{date}</time></small></span>
        <span className={styles.reminderAmount}><strong className="money-value">{money.format(reminder.amount)}</strong><small>{reminder.kind === 'account' ? 'Minimum' : reminder.kind === 'loan' ? 'Loan payment' : 'Recurring bill'}</small></span>
        <OutlineIcon name="chevron"/>
      </button></li>;
    })}</ul> : <p className={styles.reminderEmpty}>Add a due date to a debt or recurring bill to see reminders here.</p>}
  </section>;
}
