'use client';
import DateCalendar from './date-calendar';
import InfoTooltip from './info-tooltip';
import NumericInput from './numeric-input';
import type {InterestAutomation} from './interest-accrual';
import {coveredClose,householdDate,interestSettingsError} from './interest-accrual';
import {DetailSwitch} from './debt-detail-sections';
export default function InterestSettings({value,apr,onChange}:{value?:InterestAutomation;apr:number;onChange:(value:InterestAutomation)=>void}) {
 const config=value??{enabled:false,closingDay:31,customClosingDay:false,coveredThrough:coveredClose(householdDate(),31),estimatedApr:Number.isFinite(apr)?apr:0};
 const error=interestSettingsError(config);
 return <fieldset className="wide costco-interest-settings">
  <DetailSwitch labelContent={<InfoTooltip label="Automatic interest estimates">Estimates use recorded daily balances and APR, rounded once per cycle. Month-end is used unless you choose a statement closing day. Missing opening history leaves a cycle unposted. No grace period or daily compounding. Enter statement interest to replace an estimate.</InfoTooltip>} label="Automatic interest estimates" checked={config.enabled} onChange={enabled=>onChange({...config,enabled})}/>
  {config.enabled&&<>
   <DetailSwitch label="Custom closing day" checked={config.customClosingDay??true} onChange={customClosingDay=>onChange({...config,customClosingDay,...(!customClosingDay&&!Number.isInteger(config.closingDay)?{closingDay:31}:{})})}/>
   {(config.customClosingDay??true)&&<label><span>Statement closing day</span><NumericInput aria-label="Statement closing day" currency={false} min={1} max={31} decimals={0} value={config.closingDay??2} onValueChange={closingDay=>onChange({...config,closingDay})}/></label>}
   <label><span>Estimated APR</span><span className="field-input"><NumericInput currency={false} aria-label="Estimated APR" min={0} max={100} decimals={16} value={config.estimatedApr} onValueChange={estimatedApr=>onChange({...config,estimatedApr})}/><span>%</span></span></label>
   <DateCalendar label="Interest included" value={config.coveredThrough} max={householdDate()} onChange={coveredThrough=>onChange({...config,coveredThrough})}/>
   {error&&<p className="form-error" role="alert">{error}</p>}
  </>}
 </fieldset>;
}
