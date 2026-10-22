"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PayoffSchedule as Schedule } from "./payoff-schedule";
import { householdDate } from "./household-date";
import { parseMoneyInput } from "./payments";
import { createHouseholdMoneyFormatter, householdCurrencySymbol } from "./household-currency";
import { useHouseholdCurrency } from "./household-currency-context";
import OutlineIcon from "./outline-icon";
import PayoffLandscape from "./payoff-landscape";
import styles from "./payoff-home.module.css";

export default function PayoffSchedule({ schedule, amount, date, readOnly = false, onAmount, onClose }: {
  schedule: Schedule; amount: number; date: Date; readOnly?: boolean;
  onAmount: (amount: number) => void; onClose: () => void;
}) {
  const currency = useHouseholdCurrency();
  const money = createHouseholdMoneyFormatter(currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [draft, setDraft] = useState(String(amount));
  const [inputError, setInputError] = useState("");
  useEffect(() => { const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = overflow; }; }, []);
  const currentDate = householdDate(date);
  const currentMonth = new Date(currentDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const save = () => {
    const value = parseMoneyInput(draft);
    if (!Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(Math.round(value * 100))) { setInputError("Enter a payment greater than 0."); return; }
    setInputError("");
    if (!readOnly && value !== amount) onAmount(value);
  };
  return createPortal(<div className={styles.scheduleOverlay}>
    <section className={styles.scheduleDialog} role="dialog" aria-modal="true" aria-label="Payoff Schedule" aria-labelledby="payoff-schedule-title">
      <header className={styles.scheduleHeader}><button type="button" data-dialog-close aria-label="Close payoff schedule and go back" onClick={onClose}>〈</button><h2 id="payoff-schedule-title">Payoff Schedule</h2></header>
      <div className={styles.scheduleScroll}>
        <section className={styles.scheduleHero}><PayoffLandscape/><div><h3>Your month-by-month<br/>path to a debt-free future.</h3><p>See how each payment reduces your balance<br/>and gets you closer to your goals.</p></div><span className={styles.heroSaying}>Keep<br/>going! <b>♥</b></span></section>
        <div className={styles.scheduleContent}>
          <section className={styles.currentPayment} aria-label="Current record">
            <header><span>Current payment</span><time dateTime={currentDate}>{currentMonth}</time></header>
            <div className={styles.currentPaymentBody}><div className={styles.currentDate}><i><OutlineIcon name="calendar"/></i><div><strong>{currentMonth}</strong><time dateTime={currentDate}>{new Date(currentDate + "T12:00:00").toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric"})}</time></div></div>
              <form onSubmit={event => { event.preventDefault(); save(); }}><label htmlFor="schedule-payment">Payment</label><div className={styles.paymentInput}><span>{householdCurrencySymbol(currency)}</span><input id="schedule-payment" type="text" inputMode="decimal" value={draft} disabled={readOnly} aria-invalid={Boolean(inputError)} aria-describedby={inputError ? "schedule-payment-error" : undefined} onChange={event => { setDraft(event.target.value); setInputError(""); }} onBlur={save}/><button type="submit" aria-label="Save monthly payment" disabled={readOnly}><OutlineIcon name="check"/></button></div>{inputError && <small id="schedule-payment-error" role="alert">{inputError}</small>}</form>
              <span className={styles.paymentSaying}>You’re<br/>on track! <b>♥</b></span>
            </div>
          </section>
          {schedule.issues.map(issue => <p key={issue} role="alert" className={styles.scheduleMessage}>{issue}</p>)}
          {schedule.rows.length > 0 ? <div className={styles.scheduleTableWrap}><table className={styles.scheduleTable}><caption className="sr-only">Projected interest, balance after payment and debts paid off each month</caption><thead><tr><th>Month</th><th>Interest</th><th>Balance after payment</th><th>Debt paid off</th></tr></thead><tbody>{schedule.rows.map(month => {
            const key = month.month;
            const value = new Date(key + "-01T12:00:00");
            return <tr key={key}><th scope="row"><div className={styles.scheduleMonth}><i><OutlineIcon name="calendar"/></i><time dateTime={key}><strong>{value.toLocaleDateString("en-US",{month:"short"})}</strong><small>{value.getFullYear()}</small></time></div></th><td>{money.format(month.interest)}</td><td><strong>{money.format(month.remaining)}</strong></td><td>{month.paidOff.length ? <span className={styles.paidOff}><OutlineIcon name="card"/><span>{month.paidOff.join(", ")}<small>paid off!</small></span></span> : <span aria-label="No debt paid off">—</span>}</td></tr>;
          })}</tbody></table></div> : <p className={styles.scheduleMessage}>Add debts and a monthly payment to build your schedule.</p>}
        </div>
      </div>
    </section>
  </div>, document.body);
}
