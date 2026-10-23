"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PayoffSchedule as Schedule } from "./payoff-schedule";
import { householdDate } from "./household-date";
import { parseMoneyInput } from "./payments";
import { createHouseholdMoneyFormatter, householdCurrencySymbol } from "./household-currency";
import { useHouseholdCurrency } from "./household-currency-context";
import ScheduleMinimumEditor, {type ScheduleMinimum} from "./schedule-minimum-editor";
import OutlineIcon from "./outline-icon";
import PayoffLandscape from "./payoff-landscape";
import styles from "./payoff-home.module.css";

export default function PayoffSchedule({ schedule, amount, date, readOnly = false, onAmount, onClose, strategy, onStrategy, types, excludedTypes, onTypes, minimums, minimumExpected, onMinimums }: {
  schedule: Schedule; amount: number; date: Date; readOnly?: boolean;
  onAmount: (amount: number) => void; onClose: () => void;
  strategy: "avalanche"|"snowball"; onStrategy:(value:"avalanche"|"snowball")=>void; types:string[]; excludedTypes:string[]; onTypes:(values:string[])=>void; minimums:ScheduleMinimum[]; minimumExpected:string; onMinimums:(values:Record<string,number>,expected:string)=>string|null;
}) {
  const currency = useHouseholdCurrency();
  const money = createHouseholdMoneyFormatter(currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [draft, setDraft] = useState(String(amount));
  const [typeDraft,setTypeDraft]=useState(excludedTypes);
  const [help,setHelp]=useState(false);
  const [editMinimums,setEditMinimums]=useState(false);
  const [inputError, setInputError] = useState("");
  useEffect(() => { const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = overflow; }; }, []);
  const currentDate = householdDate(date);
  const currentMonth = new Date(currentDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const save = () => {
    const value = parseMoneyInput(draft);
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100))) { setInputError("Enter an extra payment of 0 or more."); return; }
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
              <form onSubmit={event => { event.preventDefault(); save(); }}><label htmlFor="schedule-payment">Extra payment<button className={styles.questionButton} type="button" aria-label="Explain extra payment" onClick={()=>setHelp(true)}>?</button></label><div className={styles.paymentInput}><span>{householdCurrencySymbol(currency)}</span><input aria-label="Extra payment" id="schedule-payment" type="text" inputMode="decimal" value={draft} disabled={readOnly} aria-invalid={Boolean(inputError)} aria-describedby={inputError ? "schedule-payment-error" : undefined} onChange={event => { setDraft(event.target.value); setInputError(""); }} onBlur={save}/><button type="submit" aria-label="Save extra payment" disabled={readOnly}><OutlineIcon name="check"/></button></div>{inputError && <small id="schedule-payment-error" role="alert">{inputError}</small>}</form>
              <span className={styles.paymentSaying}>You’re<br/>on track! <b>♥</b></span>
            </div>
          </section>
          <div className={styles.scheduleOptions}><label>Method<select aria-label="Payoff method" disabled={readOnly} value={strategy} onChange={e=>onStrategy(e.target.value as "avalanche"|"snowball")}><option value="avalanche">Avalanche</option><option value="snowball">Snowball</option></select></label><details><summary>Included debt types</summary><div className={styles.includedTypes}>{types.map(type=><label key={type}><input type="checkbox" aria-label={'Include '+type} checked={!typeDraft.includes(type)} disabled={readOnly} onChange={e=>setTypeDraft(e.target.checked?typeDraft.filter(t=>t!==type):[...typeDraft,type])}/>{type}</label>)}<button type="button" aria-label="Apply included debt types" disabled={readOnly} onClick={e=>{onTypes(typeDraft);const details=e.currentTarget.closest("details");details?.removeAttribute("open");details?.querySelector("summary")?.focus();}}><OutlineIcon name="check"/></button></div></details><button type="button" disabled={readOnly||minimums.length===0} onClick={()=>setEditMinimums(true)}>Edit minimums</button></div>
          {schedule.issues.map(issue => <p key={issue} role="alert" className={styles.scheduleMessage}>{issue}</p>)}
          {schedule.rows.length > 0 ? <div className={styles.scheduleTableWrap}><table className={styles.scheduleTable}><caption className="sr-only">Projected interest, balance after payment and debts paid off each month</caption><thead><tr><th>Month</th><th>Interest</th><th>Balance after payment</th><th>Debt paid off</th></tr></thead><tbody>{schedule.rows.map(month => {
            const key = month.month;
            const value = new Date(key + "-01T12:00:00");
            return <tr key={key}><th scope="row"><div className={styles.scheduleMonth}><i><OutlineIcon name="calendar"/></i><time dateTime={key}><strong>{value.toLocaleDateString("en-US",{month:"short"})}</strong><small>{value.getFullYear()}</small></time></div></th><td>{money.format(month.interest)}</td><td><strong>{money.format(month.remaining)}</strong></td><td>{month.paidOff.length ? <span className={styles.paidOff}><OutlineIcon name="card"/><span>{month.paidOff.join(", ")}<small>paid off!</small></span></span> : <span aria-label="No debt paid off">—</span>}</td></tr>;
          })}</tbody></table></div> : <p className={styles.scheduleMessage}>Add debts and a monthly payment to build your schedule.</p>}
        </div>
      </div>
    </section>
    {help&&<div className={styles.minimumBackdrop}><section role="dialog" aria-modal="true" aria-label="Extra payment" className={styles.minimumDialog}><header><h2>Extra payment</h2><button data-dialog-close type="button" aria-label="Close explanation" className={styles.questionButton} onClick={()=>setHelp(false)}>×</button></header><p>This amount is extra, on top of the included debts’ minimum payments. The schedule adds those minimums automatically. Mortgage escrow remains separate from principal and interest.</p></section></div>}
    {editMinimums&&<ScheduleMinimumEditor items={minimums} expected={minimumExpected} onSave={onMinimums} onClose={()=>setEditMinimums(false)}/>}
  </div>, document.body);
}
