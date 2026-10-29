"use client";
import TitleSelect from './title-select';
import {useState} from "react";
import type {CashflowItem,PlanSettlement} from "./dashboard-data";
import {householdDate} from "./household-date";
import {householdCurrencySymbol} from "./household-currency";
import {useHouseholdCurrency} from "./household-currency-context";
import NumericInput from "./numeric-input";
import DateCalendar from "./date-calendar";
import BackButton from "./back-button";
import {useFormExit} from "./use-form-exit";

/** Uses the existing reporting-only settlement path; never changes lender balances. */
export default function BudgetBillPayment({items,initialItemId,readOnly,onSave,onClose}:{items:CashflowItem[];initialItemId?:string;readOnly:boolean;onSave:(entry:PlanSettlement)=>void;onClose:()=>void}) {
  const symbol=householdCurrencySymbol(useHouseholdCurrency());
  const bills=items.filter(item=>item.kind!=="income");
  const initial=bills.find(item=>item.id===initialItemId)??bills[0];
  const [itemId,setItemId]=useState(initial?.id??"");
  const [amount,setAmount]=useState(initial?.amount??NaN);
  const [date,setDate]=useState(householdDate());
  const [error,setError]=useState("");
  const item=bills.find(item=>item.id===itemId);
  const save=()=>{if(readOnly)return;if(!item||!Number.isFinite(amount)||amount<=0||Math.round(amount*100)/100!==amount||!date||date>householdDate()){setError("Choose a bill, payment date, and amount greater than 0.");return;}onSave({id:crypto.randomUUID(),targetId:item.id,name:item.name,kind:"spending",amount,date,createdAt:new Date().toISOString(),source:item.paymentMethod==="credit"?"included":"debit"});};
  const exit=useFormExit("bill payment",{itemId,amount,date},onClose,save);
  return <><div className="modal-backdrop"><section className="modal cashflow-modal budget-entry-sheet" role="dialog" aria-modal="true" aria-labelledby="bill-payment-title"><header className="back-form-header"><BackButton aria-label="Back from bill payment" onClick={exit.requestClose}/><h2 id="bill-payment-title">Record bill payment</h2></header><div className="sheet-fields"><label className="sheet-field"><span>Budget item</span><TitleSelect aria-label="Budget item" value={itemId} onChange={event=>{setItemId(event.target.value);setAmount(bills.find(item=>item.id===event.target.value)?.amount??NaN);}}>{bills.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</TitleSelect></label><label className="sheet-field"><span>Amount *</span><span className="sheet-money"><NumericInput aria-label="Bill payment amount" value={amount} onValueChange={setAmount}/></span></label><DateCalendar label="Payment date" value={date} onChange={setDate}/><p className="wide field-help">{item?.paymentMethod==="credit"?"Already included in the card balance. Pair the existing card transaction instead if one is recorded.":"Paid from checking. This records spending without changing a debt balance."}</p>{!bills.length&&<p>Add a spending item first.</p>}{error&&<p className="form-error" role="alert">{error}</p>}</div><footer className="form-action-footer"><div className="sheet-footer-actions"><button type="button" className="secondary" onClick={exit.requestClose}>Back</button><button type="button" className="primary" disabled={readOnly||!item} onClick={save}>Save</button></div></footer></section></div>{exit.prompt}</>;
}
