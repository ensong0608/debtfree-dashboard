'use client';
import {useFormExit} from './use-form-exit';
import {useState} from 'react';
import type {LoanTracker} from './loan-progress';
import {linkedLoanPayment} from './loan-progress';
import type {CashflowItem} from './dashboard-data';
import {editLoanHistory} from './loan-history-edit';
import {ExperienceOverlay} from './debt-experience';
import {detailStyles} from './debt-detail-sections';
import NumericInput from './numeric-input';
import DateCalendar from './date-calendar';
import TitleSelect from './title-select';
import {householdDate} from './household-date';
export default function LoanHistoryEditor({loan,index,items,readOnly,onSave,onClose}:{loan:LoanTracker;index:number;items:CashflowItem[];readOnly:boolean;onSave:(next:LoanTracker,expected:string)=>string|null;onClose:()=>void}){
 const [original]=useState(loan),[expected]=useState(JSON.stringify(loan));const entry=original.history[index];
 const [amount,setAmount]=useState(entry.payment??entry.amount),[date,setDate]=useState(entry.date),[error,setError]=useState('');
 const expenses=items.filter(item=>item.kind!=='income');
 const [itemId,setItemId]=useState(linkedLoanPayment(original,items)?.id??original.budgetItemId);
 const save=()=>{if(readOnly)return;try{let next=editLoanHistory(original,index,amount,date);const linked=expenses.find(item=>item.id===itemId);if(linked)next={...next,budgetItemId:linked.recurringSourceId??linked.id,budgetItemName:linked.name};else if(!itemId)next={...next,budgetItemId:'',budgetItemName:''};const issue=onSave(next,expected);if(issue)setError(issue);else onClose();}catch(e){setError(e instanceof Error?e.message:'Could not save this transaction.');}};
 const exit=useFormExit('loan transaction',{amount,date,itemId},onClose,save);
 return <><ExperienceOverlay title="Edit loan transaction" onBack={exit.requestClose}><fieldset disabled={readOnly} className={detailStyles.fields}><label><span>{entry.payment===undefined?'Recorded balance':'Payment amount'}</span><NumericInput aria-label={entry.payment===undefined?'Recorded balance':'Payment amount'} value={amount} onValueChange={setAmount}/></label><DateCalendar label="Transaction date" value={date} max={householdDate()} onChange={setDate}/>{entry.payment!==undefined&&<><label><span>Budget item</span><TitleSelect aria-label="Linked budget item" value={itemId} onChange={e=>setItemId(e.target.value)}><option value="">None</option>{itemId&&!expenses.some(item=>item.id===itemId)&&<option value={itemId}>{original.budgetItemName}</option>}{expenses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</TitleSelect></label><small>Amount changes adjust principal. Recorded interest and escrow stay fixed. Linking marks the budget item paid without another payment.</small></>}{error&&<p role="alert" className="form-error">{error}</p>}</fieldset><footer className={detailStyles.footer}><button type="button" className="primary" disabled={readOnly} onClick={save}>Save</button></footer></ExperienceOverlay>{exit.prompt}</>;
}
