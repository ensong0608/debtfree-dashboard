"use client";
import NumericInput from './numeric-input';
import BackButton from './back-button';
import {useFormExit} from './use-form-exit';
import {useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {parseMoneyInput} from './payments';
import {createHouseholdMoneyFormatter,householdCurrencySymbol} from './household-currency';
import {useHouseholdCurrency} from './household-currency-context';
import ActionConfirmation from './action-confirmation';
import styles from './payoff-home.module.css';
export type ScheduleMinimum = {id:string;name:string;amount?:number;estimate?:number};
export default function ScheduleMinimumEditor({items,expected,onSave,onClose}:{items:ScheduleMinimum[];expected:string;onSave:(values:Record<string,number>,expected:string,preserveCommitment?:boolean)=>string|null;onClose:()=>void}) {
 const [draft,setDraft]=useState(()=>Object.fromEntries(items.map(i=>[i.id,i.amount===undefined?'':String(i.amount)])));
 const [baseline]=useState(expected);const [confirm,setConfirm]=useState(false);const [estimated,setEstimated]=useState(false);const [error,setError]=useState('');
 const form=useRef<HTMLFormElement>(null);
 const exit=useFormExit('minimum payments',draft,onClose,()=>form.current?.requestSubmit());
 const currency=useHouseholdCurrency();
 const money=createHouseholdMoneyFormatter(currency);
 const changed=items.filter(item=>draft[item.id] !== (item.amount===undefined?'':String(item.amount)));
 const values=Object.fromEntries(changed.map(item=>[item.id,parseMoneyInput(draft[item.id])]));
 return createPortal(<><div className={styles.minimumBackdrop}><section role="dialog" aria-modal="true" aria-label="Edit minimum payments" className={styles.minimumDialog}><header className="back-form-header"><BackButton aria-label="Back from minimum payments" onClick={exit.requestClose}/><h2>Edit minimum payments</h2></header><form ref={form} onSubmit={event=>{event.preventDefault();if(Object.values(values).some(v=>!Number.isFinite(v)||v<=0||!Number.isSafeInteger(Math.round(v*100)))){setError('Enter minimums greater than 0.');return;}if(!changed.length){onClose();return;}setConfirm(true);}}><div className={styles.minimumEstimate}><button type="button" className="secondary" disabled={!items.some(item=>item.estimate!==undefined)} onClick={()=>{setDraft(current=>({...current,...Object.fromEntries(items.filter(item=>item.estimate!==undefined).map(item=>[item.id,String(item.estimate)]))}));setEstimated(true);setError('');}}>Auto calculate all</button><small>Estimates for credit cards. Loan payments stay fixed.</small></div><div className={styles.minimumFields}>{items.map(item=><label key={item.id}><span>{item.name}</span><div className={styles.minimumInput}><NumericInput aria-label={'Minimum for '+item.name} min={0.01} value={parseMoneyInput(draft[item.id])} text={draft[item.id]} placeholder={money.format(0)} onValueChange={(_,text)=>{setDraft(current=>({...current,[item.id]:text}));setError('');}}/></div></label>)}</div>{error&&<p role="alert">{error}</p>}<footer><button data-dialog-close className="secondary" type="button" onClick={exit.requestClose}>Back</button><button className="primary" type="submit">Save</button></footer></form></section>{confirm&&<ActionConfirmation title="Change saved minimums?" message={estimated?"Save these estimated card amounts as fixed payments? Your monthly total stays the same.":"Saving updates the minimum payment on each edited debt and recalculates your schedule. Balances and transactions stay unchanged."} confirmLabel="Save minimums" onCancel={()=>setConfirm(false)} onConfirm={()=>{const problem=onSave(values,baseline,estimated);if(problem){setError(problem);setConfirm(false);}else onClose();}}/>}</div>{exit.prompt}</>,document.body);
}
