"use client";
import type { InterestAutomation } from "./interest-accrual";
import { COSTCO_ESTIMATED_APR, coveredCostcoClose, householdDate } from "./interest-accrual";

export default function CostcoInterestSettings({ value, onChange }: { value?: InterestAutomation; onChange: (value: InterestAutomation) => void }) {
  const config = value ?? { enabled: false, coveredThrough: coveredCostcoClose(householdDate()), estimatedApr: COSTCO_ESTIMATED_APR };
  return <fieldset className="wide costco-interest-settings">
    <legend>Costco monthly interest</legend>
    <p>Optional estimate using the October statement rates: 18.99% and 22.99%, blended to {COSTCO_ESTIMATED_APR.toFixed(2)}%. Separate current balances at each rate are unknown.</p>
    <label className="interest-toggle"><input type="checkbox" checked={config.enabled} onChange={event => onChange({ ...config, enabled: event.target.checked })}/><span>Automatically add estimated interest</span></label>
    <label><span>Latest closing date already included in my balance</span><input type="date" value={config.coveredThrough} max={householdDate()} onChange={event => onChange({ ...config, coveredThrough: event.target.value })}/></label>
    <p>Costco closes on day 2. Enabling confirms your saved balance already includes interest through this date. The first new estimate is the next month; October&apos;s $188.01 is not added again.</p>
    <p>Updates run when an editor opens or refreshes the dashboard after closing, once per debt per month. Estimates use the saved balance × blended APR × days ÷ 365, not Citi&apos;s exact daily calculation. Enter the lender&apos;s balance to reconcile. Pause this if statement rates change.</p>
  </fieldset>;
}
