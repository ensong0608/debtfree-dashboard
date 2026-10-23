"use client";
import type { ActivePayoffCommitment } from './payoff-commitment';
import { createHouseholdMoneyFormatter } from './household-currency';
import { useHouseholdCurrency } from './household-currency-context';

/** Uses the same live commitment and popup as Home, independent of reporting month. */
export default function BudgetScheduleEntry({ commitment, onOpen }: { commitment: ActivePayoffCommitment; onOpen: () => void }) {
  const money = createHouseholdMoneyFormatter(useHouseholdCurrency());
  const schedule = commitment.schedule;
  const payoffDate = schedule.debtFreeMonth ? new Date(schedule.debtFreeMonth + "-01T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" }) : null;
  return <section className="screen budget-schedule-summary" aria-label="Budget Schedule">
    <header><div><span>PAYOFF SCHEDULE</span><h1>Debt payoff</h1></div><small>{commitment.scopeLabel}</small></header>
    <section className="budget-schedule-card" aria-label="Payoff schedule summary">
      <div className="budget-schedule-primary"><span>Monthly schedule payment</span><strong>{money.format(schedule.monthly)}</strong></div>
      <div className="budget-schedule-stats"><div><span>Outside schedule minimums</span><strong>{money.format(commitment.outsideSchedulePayments)}</strong></div><div><span>Projected interest</span><strong>{money.format(schedule.totalInterest)}</strong></div><div><span>Projected payoff</span><strong>{payoffDate ?? "Date unavailable"}</strong></div></div>
      <p>Schedule payments are separate from recorded transactions. Minimum obligations outside the schedule remain included in your household commitment.</p>
    </section>
    <section className="budget-schedule-settings"><div><h2>Strategy &amp; settings</h2><p>Review payment strategy, included debt types and minimums in the full schedule.</p></div><button className="primary" type="button" onClick={onOpen}>View full Payoff Schedule <span aria-hidden="true">›</span></button></section>
  </section>;
}
