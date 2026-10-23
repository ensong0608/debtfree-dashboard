"use client";
import InstitutionPicker from './institution-picker';
import {useId,useState} from 'react';
import type {CreditCardDraft} from './credit-card-editor';
import {ExperienceOverlay} from './debt-experience';
import {householdCurrencySymbol} from './household-currency';
import {useHouseholdCurrency} from './household-currency-context';
import {estimatedMinimum} from './payoff-engine';
import {recurringDueDate} from './recurring-due-date';
import styles from './debt-experience.module.css';
import type { DebtGroup } from './debt-groups';
import type { DebtAccount } from './dashboard-data';

export default function CreditCardInfo({accountId, draft, interestAutomated, readOnly, groups = [], accounts = [], onChange, onPaidOff, onDelete}: {accountId: string; draft: CreditCardDraft; interestAutomated: boolean; readOnly: boolean; groups?: DebtGroup[]; accounts?: DebtAccount[]; onChange: (draft: CreditCardDraft) => void; onPaidOff: () => void; onDelete: () => void}) {
 const [advanced,setAdvanced]=useState(false);
 const dueDayHelpId=useId();
 const symbol=householdCurrencySymbol(useHouseholdCurrency());
 const numeric=(key: 'balance'|'apr'|'minimum'|'creditLimit'|'interestFee'|'postPromoApr'|'postPromoMinimum',label:string,affix=symbol,disabled=false)=><label className={styles.cardField}><span>{label}</span><div className="field-input">{affix!== '%' && <b>{affix}</b>}<input aria-label={label} type="number" inputMode="decimal" min="0" step="0.01" disabled={disabled} value={key==='minimum' && draft.minimumMode==='auto'?estimatedMinimum(draft.balance,draft.apr):['balance','apr','minimum'].includes(key)?draft[key]:draft[key] || ''} onChange={event=>onChange({...draft,[key]:event.target.value===''?0:Number(event.target.value)})}/>{affix==='%'&&<b>%</b>}</div></label>;
 return <fieldset className={styles.cardInfo} disabled={readOnly}>
  <label className={styles.cardField}><span>Account name</span><input value={draft.name} onChange={event=>onChange({...draft,name:event.target.value})}/></label>
  <InstitutionPicker value={draft.institutionKey} onChange={institutionKey=>onChange({...draft,institutionKey})}/>
  <label className={styles.cardField}><span>Household group</span><select aria-label="Household group" value={draft.displayGroup??'Other'} onChange={event=>onChange({...draft,displayGroup:event.target.value,displayPosition:1})}>{groups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
  <label className={styles.cardField}><span>Position in group</span><select aria-label="Position in group" value={draft.displayPosition??1} onChange={event=>onChange({...draft,displayPosition:Number(event.target.value)})}>{Array.from({length:Math.max(1,accounts.filter(account=>!account.archivedAt&&account.id!==accountId&&(account.displayGroup??'Other')===(draft.displayGroup??'Other')).length+1)},(_,index)=><option key={index+1} value={index+1}>{index+1}</option>)}</select></label>
  {numeric('balance','Current balance')}{numeric('apr','APR','%')}
  <div>{numeric('minimum','Minimum payment',symbol,draft.minimumMode==='auto')}<label className={styles.autoMinimum}><input type="checkbox" checked={draft.minimumMode==='auto'} onChange={event=>onChange({...draft,minimumMode:event.target.checked?'auto':'manual'})}/>Auto estimate</label></div>
  <label className={styles.cardField}><span>Due day</span><input aria-label="Due day" aria-describedby={dueDayHelpId} type="date" value={recurringDueDate(draft.dueDate)} onChange={event=>onChange({...draft,dueDate:event.target.value})}/><small id={dueDayHelpId}>Repeats monthly; shorter months use the last day.</small></label>
  <button className="secondary" type="button" onClick={()=>setAdvanced(true)}>Advanced</button>
  {advanced&&<ExperienceOverlay title="Advanced" onBack={()=>setAdvanced(false)}><fieldset className={styles.cardAdvanced} disabled={readOnly}>
   {numeric('creditLimit','Credit limit (optional)')}
   {numeric('interestFee','Actual interest fee (optional)',symbol,interestAutomated)}
   <section className="promo-editor"><h3>Promotional period</h3><div className="promo-fields"><label className={styles.cardField}><span>Promotion ends</span><input type="date" value={draft.promoEndDate} onChange={event=>onChange({...draft,promoEndDate:event.target.value})}/></label>{numeric('postPromoApr','APR after promotion','%')}{numeric('postPromoMinimum','Actual minimum after promotion')}</div></section>
   <div className={styles.cardAdvancedActions}><button className="secondary" type="button" onClick={onPaidOff}>Mark paid off</button><button className="danger" type="button" onClick={onDelete}>Delete debt</button></div>
  </fieldset></ExperienceOverlay>}
 </fieldset>;
}
