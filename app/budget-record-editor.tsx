"use client";
import {useState} from 'react';
import type {PlanSettlement} from './dashboard-data';
import {householdDate} from './household-date';
import NumericInput from './numeric-input';
import DateCalendar from './date-calendar';
import BackButton from './back-button';
import {useFormExit} from './use-form-exit';
export default function BudgetRecordEditor({entry,readOnly,onSave,onUndo,onClose}:{entry:PlanSettlement;readOnly:boolean;onSave:(entry:PlanSettlement)=>void;onUndo:()=>void;onClose:()=>void}){
 const [name,setName]=useState(entry.name),[amount,setAmount]=useState(entry.amount),[date,setDate]=useState(entry.date),[error,setError]=useState('');
 const save=()=>{if(readOnly)return;if(!name.trim()||!Number.isFinite(amount)||amount<=0||Math.abs(Math.round(amount*100)-amount*100)>0.000001||!date||date>householdDate()){setError('Enter a name, valid date, and amount greater than 0.');return;}onSave({...entry,name:name.trim(),amount,date});};
 const exit=useFormExit('paid record',{name,amount,date},onClose,save);
 return <><div className="modal-backdrop"><section className="modal budget-entry-sheet" role="dialog" aria-modal="true" aria-labelledby="budget-record-title"><header className="back-form-header"><BackButton onClick={exit.requestClose} aria-label="Back from paid record"/><h2 id="budget-record-title">Edit paid record</h2></header><div className="sheet-fields"><label className="sheet-field"><span>Name</span><input aria-label="Paid record name" value={name} onChange={e=>setName(e.target.value)} readOnly={readOnly}/></label><label className="sheet-field"><span>Amount</span><NumericInput aria-label="Paid record amount" value={amount} onValueChange={setAmount} disabled={readOnly}/></label><DateCalendar label="Payment date" value={date} onChange={setDate}/>{error&&<p role="alert" className="form-error">{error}</p>}</div><footer className="form-action-footer"><button type="button" className="danger" disabled={readOnly} onClick={onUndo}>Undo paid</button><div className="sheet-footer-actions"><button type="button" className="secondary" onClick={exit.requestClose}>Back</button><button type="button" className="primary" disabled={readOnly} onClick={save}>Save</button></div></footer></section></div>{exit.prompt}</>;
}
