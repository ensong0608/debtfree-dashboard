"use client";
import { useId, useState, type InputHTMLAttributes } from 'react';
import { financialPaste, parseFinancialInput } from './financial-input';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & {
  value?: number; onValueChange: (value: number, text: string) => void;
  text?: string;
  min?: number; max?: number; decimals?: number; emptyValue?: number;
  publishValidOnly?: boolean; blankZero?: boolean;
};

/** Keep the editing text separate from the existing numeric draft/model. */
export default function NumericInput({ value, text, onValueChange, min = 0, max, decimals = 2, emptyValue = NaN, publishValidOnly = false, blankZero = false, disabled, onBlur, ...props }: Props) {
  const id = useId();
  const [edit, setEdit] = useState(() => ({ value, text: value === undefined || !Number.isFinite(value) || blankZero && value === 0 ? '' : String(value) }));
  const [touched, setTouched] = useState(false);
  if (!Object.is(value, edit.value)) setEdit({ value, text: value === undefined || !Number.isFinite(value) || blankZero && value === 0 ? '' : String(value) });
  const raw = text ?? edit.text;
  const parsed = parseFinancialInput(raw, { min, max, decimals, emptyValue });
  const error = disabled ? '' : parsed.error;
  const change = (text: string) => {
    const next = parseFinancialInput(text, { min, max, decimals, emptyValue });
    setEdit({ value: publishValidOnly && next.error ? value : next.value, text });
    if (!publishValidOnly || !next.error) onValueChange(next.value, text);
  };
  return <span className="numeric-control">
    <input {...props} ref={input => { input?.setCustomValidity(error); }} type="text" inputMode={decimals === 0 ? 'numeric' : 'decimal'} autoComplete="off" disabled={disabled} value={raw}
      data-financial-input aria-invalid={Boolean(error) || props['aria-invalid'] || undefined}
      aria-describedby={[props['aria-describedby'], touched && error ? id : ''].filter(Boolean).join(' ') || undefined}
      onChange={event => change(event.target.value)}
      onBlur={event => { setTouched(true); onBlur?.(event); }}
      onPaste={event => {
        const pasted = financialPaste(event.clipboardData.getData('text'));
        if (pasted === event.clipboardData.getData('text')) return;
        event.preventDefault();
        const input = event.currentTarget, start = input.selectionStart ?? 0, end = input.selectionEnd ?? start;
        change(raw.slice(0, start) + pasted + raw.slice(end));
        requestAnimationFrame(() => input.setSelectionRange(start + pasted.length, start + pasted.length));
      }}/>
    {touched && error && <small className="numeric-error" id={id} role="alert">{error}</small>}
  </span>;
}
