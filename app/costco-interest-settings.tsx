"use client";
import TitleSelect from './title-select';
import DateCalendar from './date-calendar';
import NumericInput from './numeric-input';
import InfoTooltip from './info-tooltip';
import type { InterestAutomation } from "./interest-accrual";
import { coveredClose, householdDate, interestSettingsError } from "./interest-accrual";
export default function InterestSettings({ value, apr, onChange }: { value?: InterestAutomation; apr: number; onChange: (value: InterestAutomation) => void }) {
  const config = value ?? { enabled: false, closingDay: 2, coveredThrough: coveredClose(householdDate()), estimatedApr: Number.isFinite(apr) ? apr : 0 };
  const error = interestSettingsError(config);
  return <fieldset className="wide costco-interest-settings"><legend>Interest entry</legend>
    <label>Interest method<TitleSelect aria-label="Interest method" value={config.enabled ? "estimate" : "manual"} onChange={event => onChange({ ...config, enabled: event.target.value === "estimate" })}><option value="manual">Manual</option><option value="estimate">Automatic estimates</option></TitleSelect></label>
    {(config.enabled || value) && <>
      <div><InfoTooltip label="Statement closing day">The day each month your credit card statement closes. This is different from your payment due date.</InfoTooltip><NumericInput aria-label="Statement closing day" min={1} max={31} decimals={0} value={config.closingDay ?? 2} onValueChange={closingDay => onChange({ ...config, closingDay })}/></div>
      <div><InfoTooltip label="Estimated APR">The annual interest rate used for estimates. You can update it when your lender provides the actual rate.</InfoTooltip><NumericInput aria-label="Estimated APR" min={0} max={100} decimals={16} value={config.estimatedApr} onValueChange={estimatedApr => onChange({ ...config, estimatedApr })}/></div>
      <div className="interest-date-field"><InfoTooltip label="Interest already included through">The latest closing date whose interest is already included in your recorded balance. Interest is estimated only for later cycles.</InfoTooltip><DateCalendar label="Interest already included through" value={config.coveredThrough} max={householdDate()} onChange={coveredThrough => onChange({ ...config, coveredThrough })}/></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <details><summary>Estimate assumptions</summary><p>Recorded daily balances × APR ÷ 365, rounded once per cycle. Movements apply at the start of their recorded day; promo end dates are inclusive. No grace period or daily compounding.</p><p>Missing opening history or a balance correction within a cycle leaves it unposted. Confirm your balance; estimates resume with the next complete cycle.</p><p>Disabling pauses estimates. Re-enabling estimates later cycles after the included-through date, including paused cycles. Existing entries are kept. Change the included-through date only when those cycles are already in your balance.</p></details>
    </>}
  </fieldset>;
}
