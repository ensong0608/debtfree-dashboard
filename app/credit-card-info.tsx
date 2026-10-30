'use client';
import NumericInput from './numeric-input';
import InterestSettings from './costco-interest-settings';
import {householdDate} from './interest-accrual';
import DateCalendar from './date-calendar';
import type {CreditCardDraft} from './credit-card-editor';
import {useHouseholdCurrency} from './household-currency-context';
import {createHouseholdMoneyFormatter} from './household-currency';
import {estimatedMinimum} from './payoff-engine';
import {DetailSection,DetailSwitch,DetailSummary,detailStyles as styles} from './debt-detail-sections';
import type {ReactNode} from 'react';
import type {DebtType} from './dashboard-data';
import {regularApr,promotionalApr,promoEnabled} from './debt-terms';

type Draft=CreditCardDraft & {type?:DebtType};
export default function CreditCardInfo({draft,readOnly,onChange,onDelete,creating=false,debtTypeControl}:{draft:Draft;readOnly:boolean;onChange:(draft:Draft)=>void;onDelete?:()=>void;creating?:boolean;debtTypeControl?:ReactNode}) {
 const money=createHouseholdMoneyFormatter(useHouseholdCurrency(),{minimumFractionDigits:2,maximumFractionDigits:2});
 const card=!draft.type || draft.type==='Credit card';
 const normalApr=regularApr(draft), promoApr=promotionalApr(draft);
 const promo=promoEnabled(draft);
 const apply=(changes:Partial<Draft>)=>onChange({...draft,...changes});
 const numeric=(key:'balance'|'baselineBalance'|'minimum'|'creditLimit',label:string,disabled=false)=><label><span>{label}</span><NumericInput aria-label={label} disabled={disabled} value={key==='minimum'&&draft.minimumMode==='auto'?estimatedMinimum(draft.balance,promo&&draft.promoEndDate>=householdDate()?promoApr:normalApr):draft[key]} emptyValue={['balance','baselineBalance'].includes(key)?NaN:0} onValueChange={value=>apply({[key]:value,...(key==='creditLimit'?{creditLimitEnabled:true}:{})})}/></label>;
 const rate=(label:string,value:number,change:(value:number)=>void)=><label><span>{label}</span><span className="field-input"><NumericInput currency={false} aria-label={label} max={100} value={value} onValueChange={change}/><span>%</span></span></label>;
 return <fieldset className={styles.stack} disabled={readOnly}>
  <DetailSection title="Debt details" summary={<><DetailSummary label="Account name" value={draft.name||'Add a name'}/>{draft.customNoteEnabled&&draft.customNote&&<DetailSummary label="Custom note" value={draft.customNote}/>}</>}>
   <label><span>Account name</span><input aria-label="Account name" placeholder="Name" maxLength={100} value={draft.name} onChange={event=>apply({name:event.target.value})}/></label>
   {debtTypeControl}
   <DetailSwitch label="Custom note" checked={Boolean(draft.customNoteEnabled)} onChange={customNoteEnabled=>apply({customNoteEnabled})}/>
   {draft.customNoteEnabled&&<textarea aria-label="Custom note" maxLength={1000} placeholder="Anything to remember about this debt" value={draft.customNote??''} onChange={event=>apply({customNote:event.target.value})}/>}
  </DetailSection>
  <DetailSection title="Payment & Terms" summary={<><DetailSummary label="Current balance" value={money.format(draft.balance||0)}/><DetailSummary label="APR" value={`${normalApr.toFixed(2)}%`}/><DetailSummary label={draft.minimumMode==='auto'?'Estimated minimum':'Minimum payment'} value={money.format(draft.minimumMode==='auto'?estimatedMinimum(draft.balance,promo&&draft.promoEndDate>=householdDate()?promoApr:normalApr):draft.minimum||0)}/>{promo&&<DetailSummary label="Promo APR" value={`${promoApr.toFixed(2)}%`}/>}</>}>
   {numeric('balance','Current balance',!creating)}
   {!creating&&numeric('baselineBalance','Starting balance')}
   {rate('APR',normalApr,apr=>apply({apr,promoApr:promoApr, ...(draft.interestAutomation?{interestAutomation:{...draft.interestAutomation,estimatedApr:apr}}:{})}))}
   <DetailSwitch label="Auto estimate minimum" checked={draft.minimumMode==='auto'} onChange={enabled=>apply({minimumMode:enabled?'auto':'manual'})}/>
   {numeric('minimum',draft.minimumMode==='auto'?'Estimated minimum':'Minimum payment',draft.minimumMode==='auto')}
   <DateCalendar label="Due date" recurring value={draft.dueDate} onChange={dueDate=>apply({dueDate})}/>
   {card&&<>
    <DetailSwitch label="Credit limit" checked={draft.creditLimitEnabled??draft.creditLimit>0} onChange={creditLimitEnabled=>apply({creditLimitEnabled})}/>
    {(draft.creditLimitEnabled??draft.creditLimit>0)&&numeric('creditLimit','Credit limit amount')}
    <DetailSwitch label="Promotional period" checked={promo} onChange={enabled=>apply({promoEnabled:enabled,promoApr,apr:normalApr})}/>
    {promo&&<>{rate('Promo APR',promoApr,promoApr=>apply({apr:normalApr,promoApr}))}<DateCalendar label="Promo end date" value={draft.promoEndDate} onChange={promoEndDate=>apply({promoEndDate,promoEnabled:true,apr:normalApr,promoApr})}/></>}
    {!creating&&<><DetailSwitch label="Interest fee" checked={Boolean(draft.actualInterest)} onChange={enabled=>apply({actualInterest:enabled?{amount:NaN,date:householdDate()}:undefined})}/>{draft.actualInterest&&<><label><span>Interest fee amount</span><NumericInput aria-label="Interest fee amount" value={draft.actualInterest.amount} onValueChange={amount=>apply({actualInterest:{amount,date:draft.actualInterest!.date}})}/></label><DateCalendar label="Statement closing date" value={draft.actualInterest.date} max={householdDate()} onChange={date=>apply({actualInterest:{amount:draft.actualInterest!.amount,date}})}/><small>Replaces this cycle’s estimate. Interest already in a confirmed balance is not added again.</small></>}</>}
    <InterestSettings apr={normalApr} value={draft.interestAutomation} onChange={interestAutomation=>apply({interestAutomation})}/>
   </>}
  </DetailSection>
  {onDelete&&<button className={styles.delete} type="button" onClick={onDelete}>Delete debt</button>}
 </fieldset>;
}
