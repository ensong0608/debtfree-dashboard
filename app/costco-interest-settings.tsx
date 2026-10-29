'use client';
import DateCalendar from './date-calendar';
import NumericInput from './numeric-input';
import type {InterestAutomation} from './interest-accrual';
import {coveredClose,householdDate,interestSettingsError} from './interest-accrual';
import {DetailSwitch} from './debt-detail-sections';
export default function InterestSettings({value,apr,onChange}:{value?:InterestAutomation;apr:number;onChange:(value:InterestAutomation)=>void}) {
 const config=value??{enabled:false,closingDay:2,coveredThrough:coveredClose(householdDate()),estimatedApr:Number.isFinite(apr)?apr:0};
 const error=interestSettingsError(config);
 return <fieldset className="wide costco-interest-settings">
  <DetailSwitch label="Automatic interest estimates" checked={config.enabled} onChange={enabled=>onChange({...config,enabled})}/>
  {config.enabled&&<>
   <label><span>Statement closing day</span><NumericInput aria-label="Statement closing day" currency={false} min={1} max={31} decimals={0} value={config.closingDay??2} onValueChange={closingDay=>onChange({...config,closingDay})}/></label>
   <label><span>Estimated APR</span><span className="field-input"><NumericInput currency={false} aria-label="Estimated APR" min={0} max={100} decimals={16} value={config.estimatedApr} onValueChange={estimatedApr=>onChange({...config,estimatedApr})}/><span>%</span></span></label>
   <DateCalendar label="Interest already included through" value={config.coveredThrough} max={householdDate()} onChange={coveredThrough=>onChange({...config,coveredThrough})}/>
   <small>Closing day is when your statement ends, separate from the payment due date.</small>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <details><summary>Estimate assumptions</summary><p>Recorded daily balances × APR ÷ 365, rounded once per cycle. Movements apply at the start of their recorded day; promo end dates are inclusive. No grace period or daily compounding.</p><p>Missing opening history or a balance correction within a cycle leaves it unposted. Confirm your balance; estimates resume with the next complete cycle.</p><p>Switching off pauses estimates and keeps existing entries. Re-enabling estimates later eligible cycles after the included-through date. Change that date only when interest is already in your balance.</p></details>
  </>}
 </fieldset>;
}
