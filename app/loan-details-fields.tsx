'use client';
const DEBT_TYPES = ["Credit card", "Personal loan", "Auto loan", "Student loan", "Medical debt", "Other"];
import NumericInput from "./numeric-input";
import DateCalendar from './date-calendar';
import { householdCurrencySymbol } from './household-currency';
import { useHouseholdCurrency } from './household-currency-context';
import { useState } from 'react';
import { ExplanationDialog } from './info-tooltip';
import { type LoanTracker } from './loan-progress';
import type { LoanEntryField } from './loan-entry';

function PaymentHelp({ label, children }: { label: string; children: string }) {
  const [open, setOpen] = useState(false);
  return <><button className="loan-help" type="button" aria-label={`Explain ${label}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>?</button>{open && <ExplanationDialog title={label} onClose={() => setOpen(false)}>{children}</ExplanationDialog>}</>;
}
function CurrencyInput({ label, name, value, onChange, invalid, describedBy }: { label: string; name: string; value?: number; onChange: (value: number | undefined) => void; invalid: boolean; describedBy?: string }) {
  const symbol = householdCurrencySymbol(useHouseholdCurrency());
  return <span className="loan-currency-input"><span aria-hidden="true">{symbol}</span><NumericInput id={`loan-${name}`} name={name} aria-label={label} aria-invalid={invalid} aria-describedby={describedBy} value={value} emptyValue={name === 'principalBalance' ? 0 : NaN} onValueChange={(amount, text) => onChange(name === 'principalBalance' && text.trim() === '' ? undefined : amount)}/></span>;
}

export default function LoanDetailsFields({ draft, onChange, errors, mode = "all", onDebtType }: { onDebtType?: (type: string) => void; mode?: "all" | "info" | "advanced" | "principal"; draft: LoanTracker; onChange: (draft: LoanTracker) => void; errors: Partial<Record<LoanEntryField, string>> }) {
  const error = (field: LoanEntryField) => errors[field] && <small className="form-error" id={`loan-error-${field}`}>{errors[field]}</small>;
  const described = (field: LoanEntryField) => errors[field] ? `loan-error-${field}` : undefined;
  const currency = (field: 'originalAmount' | 'remainingAmount' | 'monthlyPayment' | 'escrow' | 'principalBalance', label: string, help?: string) => <div className="loan-detail-field"><div className="loan-field-label"><label htmlFor={`loan-${field}`}>{label}{field === "principalBalance" ? "" : "*"}</label>{help && <PaymentHelp label={label}>{help}</PaymentHelp>}</div><div className="loan-input-label">
    <CurrencyInput key={field} label={label} name={field} value={draft[field]} invalid={Boolean(errors[field])} describedBy={described(field)} onChange={value => onChange({ ...draft, ...(field === 'remainingAmount' ? {principalBalance: undefined} : {}), [field]: value ?? (field === 'originalAmount' || field === 'remainingAmount' ? Number.NaN : undefined) })}/>
  </div>{error(field)}</div>;
  if (mode === "principal") return <>{currency('principalBalance', 'Remaining principal (optional)')}</>;
  if (mode === "advanced") return <>{currency('originalAmount', 'Original balance')}{currency('principalBalance', 'Remaining principal (optional)')}</>;
  return <>
    <label><span>Account</span><input placeholder="Name" autoFocus name="name" aria-label="Account" required maxLength={100} aria-invalid={Boolean(errors.name)} aria-describedby={described('name')} value={draft.name} onChange={event => onChange({ ...draft, name: event.target.value })}/>{error('name')}</label>
    {error('institutionKey')}
    <label><span>Debt type</span><select name="kind" aria-label="Debt type*" required aria-invalid={Boolean(errors.kind)} value={onDebtType ? draft.kind === "house" ? "House loan" : "Auto loan" : draft.kind} onChange={event => onDebtType ? onDebtType(event.target.value) : onChange({ ...draft, kind: event.target.value as LoanTracker['kind'] })}>{onDebtType ? <><option value="House loan">Mortgage</option>{DEBT_TYPES.map(type=><option key={type} value={type}>{type}</option>)}</> : <><option value="house">Mortgage</option><option value="car">Auto loan</option></>}</select>{error('kind')}</label>
    {mode === 'all' && currency('originalAmount', 'Original balance')}
    {currency('remainingAmount', 'Current balance')}
    <label><span>APR*</span><span className="loan-percentage-input"><NumericInput name="apr" aria-label="APR*" required placeholder="0.00" max={100} decimals={16} emptyValue={NaN} aria-invalid={Boolean(errors.apr)} aria-describedby={described('apr')} value={draft.apr} onValueChange={apr => onChange({ ...draft, apr })}/><span aria-hidden="true">%</span></span>{error('apr')}</label>
    {currency('monthlyPayment', draft.kind === 'house' ? 'Mortgage payment' : 'Minimum payment', draft.kind === 'house' ? 'Enter the total regular monthly payment, including principal, interest, and escrow. Enter its escrow portion separately below; it is subtracted once when calculating principal.' : 'Enter the regular monthly payment required by your lender, including principal and interest. Extra principal can be recorded separately.')}
    {draft.kind === 'house' && currency('escrow', 'Escrow amount', 'Enter the escrow portion included in your mortgage payment for property taxes and homeowners insurance. Enter $0 if you pay these separately. Escrow does not reduce your loan balance.')}
    <DateCalendar label="Due date" recurring invalid={Boolean(errors.dueDate)} describedBy={described("dueDate")} value={draft.dueDate} onChange={dueDate => onChange({ ...draft, dueDate })}/>{error('dueDate')}
  </>;
}
