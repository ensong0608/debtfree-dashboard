'use client';
import DateCalendar from './date-calendar';
import InstitutionPicker from './institution-picker';
import { useState } from 'react';
import { ExplanationDialog } from './info-tooltip';
import { AUTO_PLANNING_APR, loanForecastAssumptions, type LoanTracker } from './loan-progress';
import type { LoanEntryField } from './loan-entry';

const usd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function PaymentHelp({ label, children }: { label: string; children: string }) {
  const [open, setOpen] = useState(false);
  return <><button className="loan-help" type="button" aria-label={`Explain ${label}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>?</button>{open && <ExplanationDialog title={label} onClose={() => setOpen(false)}>{children}</ExplanationDialog>}</>;
}
function CurrencyInput({ label, name, value, onChange, invalid, describedBy }: { label: string; name: string; value?: number; onChange: (value: number | undefined) => void; invalid: boolean; describedBy?: string }) {
  const format = (amount?: number) => amount === undefined || !Number.isFinite(amount) ? '' : usd.format(amount);
  const [text, setText] = useState(() => format(value));
  return <span className="loan-currency-input"><span aria-hidden="true">$</span><input id={`loan-${name}`} name={name} aria-label={label} type="text" inputMode="decimal" required={name !== "principalBalance"} aria-invalid={invalid} aria-describedby={describedBy} value={text} onBlur={() => setText(format(value))} onChange={event => {
    const raw = event.target.value.replace(/[$,]/g, '');
    if (/^\d*(\.\d{0,2})?$/.test(raw)) { setText(raw); onChange(raw === '' || raw === '.' ? undefined : Number(raw)); }
  }}/></span>;

}

export default function LoanDetailsFields({ draft, onChange, errors, mode = "all" }: { mode?: "all" | "info" | "advanced"; draft: LoanTracker; onChange: (draft: LoanTracker) => void; errors: Partial<Record<LoanEntryField, string>> }) {
  const error = (field: LoanEntryField) => errors[field] && <small className="form-error" id={`loan-error-${field}`}>{errors[field]}</small>;
  const described = (field: LoanEntryField) => errors[field] ? `loan-error-${field}` : undefined;
  const currency = (field: 'originalAmount' | 'remainingAmount' | 'monthlyPayment' | 'escrow' | 'principalBalance', label: string, help?: string) => <div className="loan-detail-field"><div className="loan-field-label"><label htmlFor={`loan-${field}`}>{label}{field === "principalBalance" ? "" : "*"}</label>{help && <PaymentHelp label={label}>{help}</PaymentHelp>}</div><div className="loan-input-label">
    <CurrencyInput key={field === "principalBalance" ? `principal:${draft.remainingAmount}` : field} label={label} name={field} value={draft[field]} invalid={Boolean(errors[field])} describedBy={described(field)} onChange={value => onChange({ ...draft, ...(field === 'remainingAmount' ? {principalBalance: undefined} : {}), [field]: value ?? (field === 'originalAmount' || field === 'remainingAmount' ? Number.NaN : undefined) })}/>
  </div>{error(field)}</div>;
  if (mode === "advanced") return <>{currency('originalAmount', 'Original balance')}</>;
  return <>
    <label>Name*<input autoFocus name="name" aria-label="Name*" required maxLength={100} aria-invalid={Boolean(errors.name)} aria-describedby={described('name')} value={draft.name} onChange={event => onChange({ ...draft, name: event.target.value })}/>{error('name')}</label>
    <InstitutionPicker value={draft.institutionKey} onChange={institutionKey => onChange({ ...draft, institutionKey })}/>{error('institutionKey')}
    <label>Debt type*<select name="kind" aria-label="Debt type*" required aria-invalid={Boolean(errors.kind)} value={draft.kind} onChange={event => onChange({ ...draft, kind: event.target.value as LoanTracker['kind'] })}><option value="house">Mortgage</option><option value="car">Car loan</option></select>{error('kind')}</label>
    {mode === 'all' && currency('originalAmount', 'Original balance')}
    {currency('remainingAmount', 'Current balance')}
    {currency('principalBalance', 'Remaining principal (optional)', 'Enter the unpaid principal from your lender statement for the payoff forecast, excluding accrued interest and fees.')}
    <label>{draft.kind === "car" ? "APR (optional)" : "APR*"}<span className="loan-percentage-input"><input name="apr" aria-label={draft.kind === "car" ? "APR (optional)" : "APR*"} placeholder={draft.kind === "car" ? `${AUTO_PLANNING_APR}% assumed` : undefined} type="number" required={draft.kind !== "car"} min="0" max="100" step="any" aria-invalid={Boolean(errors.apr)} aria-describedby={described('apr')} value={draft.apr ?? ''} onChange={event => onChange({ ...draft, apr: event.target.value === '' ? undefined : Number(event.target.value) })}/><span aria-hidden="true">%</span></span>{error('apr')}</label>
    {loanForecastAssumptions(draft).length > 0 && <small className="field-help" role="status">{loanForecastAssumptions(draft).join(' ')}</small>}
    {currency('monthlyPayment', draft.kind === 'house' ? 'Mortgage payment' : 'Minimum payment', draft.kind === 'house' ? 'Enter the total regular monthly payment, including principal, interest, and escrow. Enter its escrow portion separately below; it is subtracted once when calculating principal.' : 'Enter the regular monthly payment required by your lender, including principal and interest. Extra principal can be recorded separately.')}
    {draft.kind === 'house' && currency('escrow', 'Escrow amount', 'Enter the escrow portion included in your mortgage payment for property taxes and homeowners insurance. Enter $0 if you pay these separately. Escrow does not reduce your loan balance.')}
    <DateCalendar label="Due date" recurring invalid={Boolean(errors.dueDate)} describedBy={described("dueDate")} value={draft.dueDate} onChange={dueDate => onChange({ ...draft, dueDate })}/>{error('dueDate')}
  </>;
}
