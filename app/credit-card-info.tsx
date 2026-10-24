"use client";
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

export default function CreditCardInfo({draft, interestAutomated, readOnly, onChange, onPaidOff, onDelete}: {accountId: string; draft: CreditCardDraft; interestAutomated: boolean; readOnly: boolean; groups?: DebtGroup[]; accounts?: DebtAccount[]; onChange: (draft: CreditCardDraft) => void; onPaidOff: () => void; onDelete: () => void}) {
 const [advanced,setAdvanced]=useState(false);
 const symbol=householdCurrencySymbol(useHouseholdCurrency());
 const numeric=(key: 'balance'|'apr'|'minimum'|'creditLimit'|'interestFee'|'postPromoApr'|'postPromoMinimum',label:string,affix=symbol,disabled=false)=><label className={styles.cardField}><span>{label}</span><div className="field-input">{affix!== '%' && <b>{affix}</b>}<input aria-label={label} type="number" inputMode="decimal" min="0" step="0.01" disabled={disabled} value={key==='minimum' && draft.minimumMode==='auto'?estimatedMinimum(draft.balance,draft.apr):['balance','apr','minimum'].includes(key)?draft[key]:draft[key] || ''} onChange={event=>onChange({...draft,[key]:event.target.value===''?0:Number(event.target.value)})}/>{affix==='%'&&<b>%</b>}</div></label>;
 return <fieldset className={styles.cardInfo} disabled={readOnly}>
  <label className={styles.cardField}><span>Account name</span><input value={draft.name} onChange={event=>onChange({...draft,name:event.target.value})}/></label>

  {numeric('balance','Current balance')}{numeric('apr','APR','%')}
  <div>{numeric('minimum','Minimum payment',symbol,draft.minimumMode==='auto')}<label className={styles.autoMinimum}><input type="checkbox" checked={draft.minimumMode==='auto'} onChange={event=>onChange({...draft,minimumMode:event.target.checked?'auto':'manual'})}/>Auto estimate</label></div>
  <DateCalendar label="Due date" recurring value={draft.dueDate} onChange={date => onChange({...draft,dueDate:date})}/>
  <button className="secondary" type="button" onClick={()=>setAdvanced(true)}>Advanced</button>
  {advanced&&<ExperienceOverlay title="Advanced" onBack={()=>setAdvanced(false)}><fieldset className={styles.cardAdvanced} disabled={readOnly}>
   {numeric('creditLimit','Credit limit (optional)')}
   {numeric('interestFee','Actual interest fee (optional)',symbol,interestAutomated)}
   <section className="promo-editor"><h3>Promotional period</h3><div className="promo-fields"><DateCalendar label="Promotion ends" value={draft.promoEndDate} onChange={date => onChange({...draft,promoEndDate:date})}/>{numeric('postPromoApr','APR after promotion','%')}{numeric('postPromoMinimum','Actual minimum after promotion')}</div></section>
   <div className={styles.cardAdvancedActions}><button className="secondary" type="button" onClick={onPaidOff}>Mark paid off</button><button className="danger" type="button" onClick={onDelete}>Delete debt</button></div>
  </fieldset></ExperienceOverlay>}
 </fieldset>;
}
