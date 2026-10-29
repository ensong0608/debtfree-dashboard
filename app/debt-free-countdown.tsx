"use client";

import type { PayoffSchedule } from './payoff-schedule';
import { householdDate } from './household-date';
import BrighterLandscape from './brighter-landscape';
import styles from './debt-free-countdown.module.css';

/** Presentation of the existing Cards & Loans forecast; never a second payoff plan. */
export default function DebtFreeCountdown({ schedule, balance, percent, onOpen }: {
  schedule: PayoffSchedule; balance: number; percent: number | null; onOpen: () => void;
}) {
  const month = schedule.complete ? schedule.debtFreeMonth : null;
  const today = householdDate();
  const months = month ? Math.max(0, (Number(month.slice(0, 4)) - Number(today.slice(0, 4))) * 12 + Number(month.slice(5, 7)) - Number(today.slice(5, 7))) : null;
  const paid = balance <= 0;
  const date = month ? new Date(month + '-01T12:00:00Z') : null;
  const label = paid ? 'Debt-free' : date ? date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).toUpperCase() : 'Review plan';
  const progress = paid ? 100 : percent === null ? 0 : Math.max(0, Math.min(100, percent));
  return <button type="button" className={styles.card} onClick={onOpen} aria-label="Debt-free countdown. Open payoff schedule">
    <span className={styles.header}><span>Your debt-free date</span><span className={styles.badge}>{paid ? 'PAID OFF' : 'ESTIMATE'}</span></span>
    <span className={styles.scope}>Cards &amp; Loans · includes auto</span>
    <span className={styles.main}>
      {date && !paid ? <time dateTime={month!} className={styles.date}>{label}</time> : <strong className={styles.date}>{label}</strong>}
      {!paid && months !== null && <span className={styles.remaining}><strong>{months}</strong><span>{months === 1 ? 'MONTH' : 'MONTHS'}<br/>TO GO</span></span>}
    </span>
    <span className={styles.track} role="img" aria-label={percent === null && !paid ? 'Progress comparison unavailable' : `${progress.toFixed(1)} percent of Cards & Loans debt reduced`}>
      {Array.from({ length: 7 }, (_, index) => <span key={index}><i style={{ width: `${Math.max(0, Math.min(100, progress * 7 - index * 100))}%` }}/></span>)}
    </span>
    <span className={styles.message}>{paid ? 'You did it. Enjoy your freedom.' : !date ? 'Open your plan to see the next step.' : <><span className={styles.standardMessage}>Keep building your freedom.</span><span className={styles.tomorrowMessage}>Small steps. A brighter tomorrow.</span></>}</span>
    <BrighterLandscape className={styles.art}/>
  </button>;
}
