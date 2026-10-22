'use client';
import { useState } from 'react';
import { householdDate } from './household-date';
import { ExplanationDialog } from './info-tooltip';
import type { LoanTracker } from './loan-progress';
import type { LoanEntryField } from './loan-entry';

const usd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function PaymentHelp({ label, children }: { label: string; children: string }) {
  const [open, setOpen] = useState(false);
  return <><button className="loan-help" type="button" aria-label={`Explain ${label}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>?</button>{open && <ExplanationDialog title={label} onClose={() => setOpen(false)}>{children}</ExplanationDialog>}</>;
}
function CurrencyInput({ label, name, value, onChange, invalid, describedBy }: { label: string; name: string; value?: number; onChange: (value: number | undefined) => void; invalid: boolean; describedBy?: string }) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  return <span className="loan-currency-input"><span aria-hidden="true">$</span><input id={`loan-${name}`} name={name} aria-label={label} type="text" inputMode="decimal" required aria-invalid={invalid} aria-describedby={describedBy} value={focused ? text : value === undefined || !Number.isFinite(value) ? '' : usd.format(value)} onFocus={() => { setText(value === undefined || !Number.isFinite(value) ? '' : String(value)); setFocused(true); }} onBlur={() => setFocused(false)} onChange={event => {
    const raw = event.target.value.replace(/[$,]/g, '');
    if (/^\d*(\.\d{0,2})?$/.test(raw)) { setText(raw); onChange(raw === '' || raw === '.' ? undefined : Number(raw)); }
  }}/></span>;
}

function PaymentCalendar({ value, onChange, invalid }: { invalid?: boolean; value?: string; onChange: (date: string | undefined) => void }) {
  const [month, setMonth] = useState(() => householdDate().slice(0, 7));
  const [open, setOpen] = useState(false);
  const [year, index] = month.split('-').map(Number);
  const first = new Date(year, index - 1, 1).getDay(), count = new Date(year, index, 0).getDate();
  const move = (offset: number) => { const date = new Date(year, index - 1 + offset, 1); setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`); };
  return <div className="loan-date-field"><label htmlFor="loan-due-date">Next payment DueDate</label><input id="loan-due-date" name="dueDate" type="date" aria-invalid={Boolean(invalid)} aria-describedby={invalid ? 'loan-error-dueDate' : undefined} value={value ?? ''} onChange={event => onChange(event.target.value || undefined)}/>
    <button className="secondary" type="button" aria-expanded={open} onClick={() => { setMonth(householdDate().slice(0, 7)); setOpen(!open); }}>Choose payment date</button>
    {open && <div className="loan-calendar" role="group" aria-label="Payment calendar">
      <div className="loan-calendar-heading"><button type="button" className="secondary" aria-label="Previous month" onClick={() => move(-1)}>‹</button><strong aria-live="polite">{new Date(year, index - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong><button type="button" className="secondary" aria-label="Next month" onClick={() => move(1)}>›</button></div>
      <div className="loan-calendar-grid">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(day => <span key={day}>{day}</span>)}{Array.from({ length: first }, (_, i) => <span key={`empty-${i}`}/>)}{Array.from({ length: count }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, '0')}`;
        return <button type="button" key={date} aria-label={date} aria-pressed={date === value} onClick={() => { onChange(date); setOpen(false); }}>{i + 1}</button>;
      })}</div>
    </div>}
  </div>;
}

export default function LoanDetailsFields({ draft, onChange, errors }: { draft: LoanTracker; onChange: (draft: LoanTracker) => void; errors: Partial<Record<LoanEntryField, string>> }) {
  const error = (field: LoanEntryField) => errors[field] && <small className="form-error" id={`loan-error-${field}`}>{errors[field]}</small>;
  const described = (field: LoanEntryField) => errors[field] ? `loan-error-${field}` : undefined;
  const currency = (field: 'originalAmount' | 'remainingAmount' | 'monthlyPayment' | 'escrow', label: string, help?: string) => <div className="loan-detail-field"><div className="loan-field-label"><label htmlFor={`loan-${field}`}>{label}*</label>{help && <PaymentHelp label={label}>{help}</PaymentHelp>}</div><div className="loan-input-label">
    <CurrencyInput label={label} name={field} value={draft[field]} invalid={Boolean(errors[field])} describedBy={described(field)} onChange={value => onChange({ ...draft, [field]: value ?? (field === 'originalAmount' || field === 'remainingAmount' ? Number.NaN : undefined) })}/>
  </div>{error(field)}</div>;
  return <>
    <label>Name*<input autoFocus name="name" required maxLength={100} aria-invalid={Boolean(errors.name)} aria-describedby={described('name')} value={draft.name} onChange={event => onChange({ ...draft, name: event.target.value })}/>{error('name')}</label>
    <label>Category*<select name="kind" required aria-invalid={Boolean(errors.kind)} value={draft.kind} onChange={event => onChange({ ...draft, kind: event.target.value as LoanTracker['kind'] })}><option value="house">House</option><option value="car">Car</option></select>{error('kind')}</label>
    {currency('originalAmount', 'Original balance')}
    {currency('remainingAmount', 'Current balance')}
    <label>APR*<span className="loan-percentage-input"><input name="apr" type="number" required min="0" max="100" step="any" aria-invalid={Boolean(errors.apr)} aria-describedby={described('apr')} value={draft.apr ?? ''} onChange={event => onChange({ ...draft, apr: event.target.value === '' ? undefined : Number(event.target.value) })}/><span aria-hidden="true">%</span></span>{error('apr')}</label>
    {currency('monthlyPayment', draft.kind === 'house' ? 'Mortgage payment' : 'Minimum payment', draft.kind === 'house' ? 'Enter the total regular monthly payment, including principal, interest, and escrow. Enter its escrow portion separately below; it is subtracted once when calculating principal.' : 'Enter the regular monthly payment required by your lender, including principal and interest. Extra principal can be recorded separately.')}
    {draft.kind === 'house' && currency('escrow', 'Escrow amount', 'Enter the escrow portion included in your mortgage payment for property taxes and homeowners insurance. Enter $0 if you pay these separately. Escrow does not reduce your loan balance.')}
    <PaymentCalendar invalid={Boolean(errors.dueDate)} value={draft.dueDate} onChange={dueDate => onChange({ ...draft, dueDate })}/>{error('dueDate')}
  </>;
}
