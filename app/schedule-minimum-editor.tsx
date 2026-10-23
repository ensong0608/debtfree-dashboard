"use client";
import {useState} from 'react';
import {createPortal} from 'react-dom';
import {parseMoneyInput} from './payments';
import {createHouseholdMoneyFormatter,householdCurrencySymbol} from './household-currency';
import {useHouseholdCurrency} from './household-currency-context';
import ActionConfirmation from './action-confirmation';
import styles from './payoff-home.module.css';
export type ScheduleMinimum = {id:string;name:string;amount?:number};
export default function ScheduleMinimumEditor({items,expected,onSave,onClose}:{items:ScheduleMinimum[];expected:string;onSave:(values:Record<string,number>,expected:string)=>string|null;onClose:()=>void}) {
 const [draft,setDraft]=useState(()=>Object.fromEntries(items.map(i=>[i.id,i.amount===undefined?'':String(i.amount)])));
 const [baseline]=useState(expected);const [confirm,setConfirm]=useState(false);const [error,setError]=useState('');
 const currency=useHouseholdCurrency();
 const money=createHouseholdMoneyFormatter(currency);
 const changed=items.filter(item=>draft[item.id] !== (item.amount===undefined?'':String(item.amount)));
 const values=Object.fromEntries(changed.map(item=>[item.id,parseMoneyInput(draft[item.id])]));
 return createPortal(<div className={styles.minimumBackdrop}><section role="dialog" aria-modal="true" aria-label="Edit minimum payments" className={styles.minimumDialog}><h2>Edit minimum payments</h2><form onSubmit={event=>{event.preventDefault();if(Object.values(values).some(v=>!Number.isFinite(v)||v<=0||!Number.isSafeInteger(Math.round(v*100)))){setError('Enter minimums greater than 0.');return;}if(!changed.length){onClose();return;}setConfirm(true);}}><div className={styles.minimumFields}>{items.map(item=><label key={item.id}><span>{item.name}</span><div className={styles.minimumInput}><span>{householdCurrencySymbol(currency)}</span><input aria-label={'Minimum for '+item.name} inputMode="decimal" value={draft[item.id]} placeholder={money.format(0)} onChange={e=>{setDraft(current=>({...current,[item.id]:e.target.value}));setError('');}}/></div></label>)}</div>{error&&<p role="alert">{error}</p>}<footer><button data-dialog-close className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit">Save</button></footer></form></section>{confirm&&<ActionConfirmation title="Change saved minimums?" message="Saving updates the minimum payment on each edited debt and recalculates your schedule. Balances and transactions stay unchanged." confirmLabel="Save minimums" onCancel={()=>setConfirm(false)} onConfirm={()=>{const problem=onSave(values,baseline);if(problem){setError(problem);setConfirm(false);}else onClose();}}/>}</div>,document.body);
}
