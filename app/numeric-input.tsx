"use client";
import { useId, useState, type InputHTMLAttributes } from 'react';
import { financialPaste, parseFinancialInput, currencyDigits } from './financial-input';
import {useHouseholdCurrency} from './household-currency-context';
import {householdCurrencySymbol} from './household-currency';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & {
  value?: number; onValueChange: (value: number, text: string) => void;
  text?: string;
  min?: number; max?: number; decimals?: number; emptyValue?: number;
  publishValidOnly?: boolean; blankZero?: boolean; currency?: boolean;
};

/** Keep the editing text separate from the existing numeric draft/model. */
export default function NumericInput({ value, text, onValueChange, min = 0, max, decimals = 2, emptyValue = NaN, publishValidOnly = false, blankZero = false, currency = decimals === 2 && max !== 100, disabled, onBlur, ...props }: Props) {
  const id = useId();
  const symbol=householdCurrencySymbol(useHouseholdCurrency());
  const [edit, setEdit] = useState(() => ({ value, text: value === undefined || !Number.isFinite(value) || !currency && blankZero && value === 0 ? '' : String(value) }));
  const [touched, setTouched] = useState(false);
  if (!Object.is(value, edit.value)) setEdit({ value, text: value === undefined || !Number.isFinite(value) || !currency && blankZero && value === 0 ? '' : String(value) });
  const raw = text ?? edit.text;
  const parsed = parseFinancialInput(raw, { min, max, decimals, emptyValue: !currency && blankZero && value === 0 ? 0 : emptyValue });
  const error = disabled ? '' : parsed.error;
  const shown=currency && raw.trim() && !parsed.error ? symbol+parsed.value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : raw;
  const change = (text: string) => {
    const next = parseFinancialInput(text, { min, max, decimals, emptyValue });
    setEdit({ value: publishValidOnly && next.error ? value : next.value, text });
    if (!publishValidOnly || !next.error) onValueChange(next.value, text);
  };
  return <span className="numeric-control" data-currency={currency || undefined}>
    <input {...props} ref={input => { input?.setCustomValidity(error); }} type="text" inputMode={currency || decimals === 0 ? 'numeric' : 'decimal'} autoComplete="off" disabled={disabled} value={shown}
      data-financial-input aria-invalid={Boolean(error) || props['aria-invalid'] || undefined}
      aria-describedby={[props['aria-describedby'], touched && error ? id : ''].filter(Boolean).join(' ') || undefined}
      onChange={event => {
        const input=event.currentTarget;
        if(!currency){change(input.value);return;}
        const deleting=(event.nativeEvent as InputEvent).inputType?.startsWith('delete');
        const next=deleting&&parsed.value===0?'':currencyDigits(input.value,symbol);
        const atEnd=input.selectionStart===input.value.length;
        change(next);
        if(atEnd)requestAnimationFrame(()=>input.setSelectionRange(input.value.length,input.value.length));
      }}
      onBlur={event => { setTouched(true); if(currency && !raw.trim() && emptyValue===0)setEdit({value:0,text:'0.00'}); onBlur?.(event); }}
      onPaste={event => {
        const pasted = financialPaste(event.clipboardData.getData('text'));
        if(currency){event.preventDefault();change(pasted);return;}
        if (pasted === event.clipboardData.getData('text')) return;
        event.preventDefault();
        const input = event.currentTarget, start = input.selectionStart ?? 0, end = input.selectionEnd ?? start;
        change(raw.slice(0, start) + pasted + raw.slice(end));
        requestAnimationFrame(() => input.setSelectionRange(start + pasted.length, start + pasted.length));
      }}/>
    {touched && error && <small className="numeric-error" id={id} role="alert">{error}</small>}
  </span>;
}
