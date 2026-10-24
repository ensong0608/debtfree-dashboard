"use client";
import DateCalendar from './date-calendar';
import type { InterestAutomation } from "./interest-accrual";
import { coveredClose, householdDate } from "./interest-accrual";
export default function InterestSettings({ value, apr, onChange }: { value?: InterestAutomation; apr: number; onChange: (value: InterestAutomation) => void }) {
  const config = value ?? { enabled: false, closingDay: 2, coveredThrough: coveredClose(householdDate()), estimatedApr: apr };
  return <fieldset className="wide costco-interest-settings"><legend>Interest entry</legend>
    <label>Interest method<select aria-label="Interest method" value={config.enabled ? "estimate" : "manual"} onChange={event => onChange({ ...config, enabled: event.target.value === "estimate", coveredThrough: coveredClose(householdDate(), config.closingDay) })}><option value="manual">Manual interest entry</option><option value="estimate">Automatic estimated interest</option></select></label>
    {config.enabled && <><label>Closing day<input type="number" min={1} max={31} value={config.closingDay ?? 2} onChange={event => { const closingDay = Number(event.target.value); if (closingDay >= 1 && closingDay <= 31) onChange({ ...config, closingDay, coveredThrough: coveredClose(householdDate(), closingDay) }); }}/></label><label>Estimate APR (%)<input type="number" min="0.01" max="100" step="0.01" value={config.estimatedApr} onChange={event => onChange({ ...config, estimatedApr: Number(event.target.value) })}/></label><DateCalendar label="Latest closing date included" value={config.coveredThrough} max={householdDate()} onChange={date => onChange({ ...config, coveredThrough: date })}/><details><summary>Estimate assumptions</summary><p>Catch-up runs when an editor opens or returns to the app. It does not run while closed. Balance at closing × APR × cycle days ÷ 365, rounded to cents. Short months use the last day. The first estimate is the next closing date after the included date.</p><p>Disabling stops future catch-up. Re-enabling skips paused cycles and keeps existing entries. Enter actual interest below to replace an estimate, or update the lender balance to reconcile it.</p></details></>}
  </fieldset>;
}
