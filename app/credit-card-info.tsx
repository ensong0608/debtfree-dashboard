"use client";
import NumericInput from "./numeric-input";
import InterestSettings from './costco-interest-settings';
import { interestSettingsError, householdDate } from './interest-accrual';
import DateCalendar from './date-calendar';
import {useState} from 'react';
import type {CreditCardDraft} from './credit-card-editor';
import {ExperienceOverlay} from './debt-experience';
import {householdCurrencySymbol} from './household-currency';
import {useHouseholdCurrency} from './household-currency-context';
import {estimatedMinimum} from './payoff-engine';
import styles from './debt-experience.module.css';
import type { DebtGroup } from './debt-groups';
import type { DebtAccount } from './dashboard-data';

export default function CreditCardInfo({draft, readOnly, onChange, onPaidOff, onDelete}: {accountId: string; draft: CreditCardDraft; interestAutomated: boolean; readOnly: boolean; groups?: DebtGroup[]; accounts?: DebtAccount[]; onChange: (draft: CreditCardDraft) => void; onPaidOff: () => void; onDelete: () => void}) {
 const [advanced,setAdvanced]=useState(false);
 const symbol=householdCurrencySymbol(useHouseholdCurrency());
 const numeric=(key: 'balance'|'baselineBalance'|'apr'|'minimum'|'creditLimit'|'interestFee'|'postPromoApr'|'postPromoMinimum',label:string,affix=symbol,disabled=false)=><label className={styles.cardField}><span>{label}</span><div className="field-input">{affix!== '%' && <b>{affix}</b>}<NumericInput aria-label={label} disabled={disabled} value={key==='minimum' && draft.minimumMode==='auto'?estimatedMinimum(draft.balance,draft.apr):draft[key]} max={affix==='%'?100:undefined} emptyValue={['balance','baselineBalance'].includes(key)?NaN:0} onValueChange={value=>onChange({...draft,[key]:value})}/>{affix==='%'&&<b>%</b>}</div></label>;
 return <fieldset className={styles.cardInfo} disabled={readOnly}>
  <label className={styles.cardField}><span>Account</span><input placeholder="Name" value={draft.name} onChange={event=>onChange({...draft,name:event.target.value})}/></label>

  {numeric('balance','Current balance')}{numeric('baselineBalance','Starting balance')}{numeric('apr','APR','%')}
  <div>{numeric('minimum','Minimum payment',symbol,draft.minimumMode==='auto')}<label className={styles.autoMinimum}><input type="checkbox" checked={draft.minimumMode==='auto'} onChange={event=>onChange({...draft,minimumMode:event.target.checked?'auto':'manual'})}/>Auto estimate</label></div>
  <DateCalendar label="Due date" recurring value={draft.dueDate} onChange={date => onChange({...draft,dueDate:date})}/>
  <button className="secondary" type="button" onClick={()=>setAdvanced(true)}>Advanced</button>
  {draft.interestAutomation && interestSettingsError(draft.interestAutomation) && <p className="form-error" role="alert">{interestSettingsError(draft.interestAutomation)}</p>}
  <div hidden={!advanced}><ExperienceOverlay title="Advanced" onBack={()=>setAdvanced(false)}><fieldset className={styles.cardAdvanced} disabled={readOnly}>
   {numeric('creditLimit','Credit limit (optional)')}
   {draft.interestFee > 0 && <p>Saved undated interest: {symbol}{draft.interestFee.toFixed(2)}. Reference only; forecasts use APR.</p>}
   <fieldset><legend>Record actual interest</legend><label>Amount<NumericInput aria-label="Actual interest amount" value={draft.actualInterest?.amount} emptyValue={0} onValueChange={(amount,text)=>onChange({...draft,actualInterest:text.trim()===''?undefined:{amount,date:draft.actualInterest?.date??householdDate()}})}/></label>{draft.actualInterest && <DateCalendar label="Statement closing date" value={draft.actualInterest.date} max={householdDate()} onChange={date=>onChange({...draft,actualInterest:{amount:draft.actualInterest!.amount,date}})}/>}<small>Replaces this cycle’s estimate. Interest already in a confirmed balance is recorded without adding it again.</small></fieldset>
   <InterestSettings apr={draft.apr} value={draft.interestAutomation} onChange={interestAutomation=>onChange({...draft,interestAutomation})}/>
   <section className="promo-editor"><h3>Promotional period</h3><div className="promo-fields"><DateCalendar label="Promotion ends" value={draft.promoEndDate} onChange={date => onChange({...draft,promoEndDate:date})}/>{numeric('postPromoApr','APR after promotion','%')}{numeric('postPromoMinimum','Actual minimum after promotion')}</div></section>
   <div className={styles.cardAdvancedActions}><button className="secondary" type="button" onClick={onPaidOff}>Mark paid off</button><button className="danger" type="button" onClick={onDelete}>Delete debt</button></div>
  </fieldset></ExperienceOverlay></div>
 </fieldset>;
}
