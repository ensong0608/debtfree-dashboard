"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PayoffSchedule as Schedule } from "./payoff-schedule";
import type { PayoffStrategyRow } from "./payoff-strategy";
import { householdDate } from "./household-date";
import { parseMoneyInput } from "./payments";
import { householdCurrencySymbol } from "./household-currency";
import { useHouseholdCurrency } from "./household-currency-context";
import ScheduleMinimumEditor, {type ScheduleMinimum} from "./schedule-minimum-editor";
import OutlineIcon from "./outline-icon";
import PayoffStrategyList from "./payoff-strategy-list";
import styles from "./payoff-home.module.css";

export default function PayoffSchedule({ schedule, rows, amount, date, readOnly = false, onAmount, onClose, strategy, onStrategy, minimums, minimumExpected, onMinimums, onReviewTerms, inline = false }: {
  inline?: boolean;
  onReviewTerms?: (issue: string) => void;
  schedule: Schedule; rows: PayoffStrategyRow[]; amount: number; date: Date; readOnly?: boolean;
  onAmount: (amount: number) => void; onClose: () => void;
  strategy: "avalanche"|"snowball"; onStrategy:(value:"avalanche"|"snowball")=>void;
  minimums:ScheduleMinimum[]; minimumExpected:string; onMinimums:(values:Record<string,number>,expected:string)=>string|null;
}) {
  const currency = useHouseholdCurrency();
  const [draft, setDraft] = useState(String(amount));
  const [editMinimums,setEditMinimums]=useState(false);
  const [inputError, setInputError] = useState("");
  useEffect(() => { if (inline) return; const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = overflow; }; }, [inline]);
  const currentDate = householdDate(date);
  const save = () => {
    const value = parseMoneyInput(draft);
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100))) { setInputError("Enter an extra payment of 0 or more."); return; }
    setInputError("");
    if (!readOnly && value !== amount) onAmount(value);
  };
  const experience = <section className={`${styles.scheduleDialog} strategy-dialog ${inline ? "strategy-inline" : ""}`} role={inline ? "region" : "dialog"} aria-modal={inline ? undefined : true} aria-label="Payoff Strategy">
      {!inline && <header className="strategy-header"><div><button type="button" data-dialog-close aria-label="Close payoff strategy and go back" onClick={onClose}>‹</button><h2 id="payoff-schedule-title">Payoff strategy</h2></div></header>}
      <div className={styles.scheduleScroll}>
        <div className="strategy-content">
          <section className="strategy-payment" aria-label="Forecast settings">
            <time dateTime={currentDate}>{new Date(currentDate + "T12:00:00").toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric"})}</time>
            <div><form onSubmit={event => { event.preventDefault(); save(); }}><label htmlFor="schedule-payment">Extra payment</label><div className="strategy-money"><span>{householdCurrencySymbol(currency)}</span><input aria-label="Extra payment" id="schedule-payment" type="text" inputMode="decimal" value={draft} disabled={readOnly} aria-invalid={Boolean(inputError)} aria-describedby={inputError ? "schedule-payment-error" : undefined} onChange={event => { setDraft(event.target.value); setInputError(""); }} onBlur={save}/><button type="submit" aria-label="Save extra payment" disabled={readOnly}><OutlineIcon name="check"/></button></div></form>{inputError && <small id="schedule-payment-error" role="alert">{inputError}</small>}<button className="strategy-minimums secondary" type="button" disabled={readOnly||minimums.length===0} onClick={()=>setEditMinimums(true)}>Edit minimums</button></div>
          </section>
          <div className="strategy-choices" role="group" aria-label="Payoff method">{(['avalanche','snowball'] as const).map(method => <button key={method} type="button" aria-pressed={method===strategy} disabled={readOnly} onClick={()=>onStrategy(method)}><strong>{method==='avalanche'?'Avalanche':'Snowball'}<span aria-hidden="true">{method===strategy?'◉':'○'}</span></strong><small>{method==='avalanche'?'Highest interest first. Usually saves the most money.':'Smallest balance first. Builds momentum faster.'}</small></button>)}</div>
          {schedule.issues.map(issue => <div key={issue} role="alert" className={styles.scheduleMessage}><p>{issue}</p><button type="button" className="secondary" onClick={() => { if (issue.includes(': ') && onReviewTerms) onReviewTerms(issue); else if (issue.toLowerCase().includes('minimum')) setEditMinimums(true); else document.getElementById('schedule-payment')?.focus(); }}>{issue.includes(': ') ? 'Review loan details' : issue.toLowerCase().includes('minimum') ? 'Edit minimums' : 'Adjust extra payment'}</button></div>)}
          <div className="strategy-list-heading"><h3>Pay in this order</h3><span>{strategy}</span></div>
          <PayoffStrategyList rows={rows}/>
        </div>
      </div>
    {editMinimums&&<ScheduleMinimumEditor items={minimums} expected={minimumExpected} onSave={onMinimums} onClose={()=>setEditMinimums(false)}/>}
  </section>;
  return inline ? experience : createPortal(<div className={styles.scheduleOverlay}>{experience}</div>, document.body);
}
