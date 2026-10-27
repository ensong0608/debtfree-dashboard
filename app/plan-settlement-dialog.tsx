"use client";
import DateCalendar from './date-calendar';
import NumericInput from './numeric-input';
import BackButton from './back-button';
import { useFormExit } from './use-form-exit';
import { householdDate } from './household-date';
import { useState } from 'react';
import type { PlanSettlement } from './dashboard-data';
export type SettlementRequest = { targetId: string; name: string; kind: 'spending' | 'minimum'; amount: number; source: 'debit' | 'included' };
export default function PlanSettlementDialog({ request, month, onClose, onSave }: { request: SettlementRequest; month: string; onClose: () => void; onSave: (entry: PlanSettlement) => void }) {
  const [amount, setAmount] = useState(request.amount);
  const [source, setSource] = useState(request.source);
  const today = householdDate();
  const [date, setDate] = useState(today.startsWith(month) ? today : month + '-01');
  const [error, setError] = useState('');
  const save = () => {
    if (!Number.isFinite(amount) || amount <= 0 || !date.startsWith(month + '-')) { setError('Enter a valid amount and a date in this month.'); return; }
    onSave({ ...request, source, amount, date, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
  };
  const exit = useFormExit('paid record', { amount, source, date }, onClose, save);
  return <><div className="modal-backdrop" onMouseDown={event => { if (event.currentTarget === event.target) exit.requestClose(); }}><section className="modal debt-action-modal" role="dialog" aria-modal="true" aria-labelledby="settlement-title">
    <header className="back-form-header"><BackButton aria-label="Back from paid record" onClick={exit.requestClose}/><div><h2 id="settlement-title">{request.kind === 'minimum' ? 'Minimum already paid' : 'Record paid expense'}</h2><p>{request.name}</p></div></header>
    <form onSubmit={event => { event.preventDefault(); save(); }}><div className="debt-action-form"><p><strong>Current debt balances will stay unchanged.</strong> {request.kind === 'minimum' ? "Use this only when the payment has already cleared and is included in your current balance. It counts toward this month's minimum and payment target." : 'Use this for spending paid from checking, or a card charge already included in your current balance. Do not record the same expense again in Transactions.'}</p>
      <div className="form-grid"><label><span>Amount already paid</span><NumericInput aria-label="Amount already paid" min={0.01} autoFocus value={amount} onValueChange={setAmount}/></label><DateCalendar label="Date paid" value={date} min={month+'-01'} max={month+'-'+new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate()} onChange={setDate}/>
      {request.kind === 'spending' && <label className="wide"><span>Paid using</span><select value={source} onChange={event => setSource(event.target.value as 'debit' | 'included')}><option value="debit">Debit / checking — no debt change</option><option value="included">Credit card — already included in current balance</option></select></label>}</div>{error && <p className="form-error" role="alert">{error}</p>}
    </div><footer className="form-action-footer"><div><button type="button" className="secondary" onClick={exit.requestClose}>Back</button><button type="submit" className="primary">Save</button></div></footer></form>
  </section></div>{exit.prompt}</>;
}
