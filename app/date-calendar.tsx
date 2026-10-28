"use client";
import OutlineIcon from './outline-icon';
import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { recurringDueDate } from './recurring-due-date';
import { householdDate } from './household-date';

/** One calendar for due dates, dated records and term dates. Values stay YYYY-MM-DD. */
export default function DateCalendar({ label, value, onChange, min, max, disabled = false, invalid = false, describedBy, recurring = false, recurringDay, className = '' }: {
  label: string; value?: string; recurring?: boolean; recurringDay?: number; onChange: (date: string) => void; min?: string; max?: string;
  disabled?: boolean; invalid?: boolean; describedBy?: string; className?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(value ?? '');
  const close = () => { setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); };
  // The pending recurring value is the canonical day, never this month's clamped occurrence.
  const show = () => { setPending(recurring && recurringDay ? `2000-01-${String(recurringDay).padStart(2, '0')}` : value ?? ''); setMonth(!recurring && /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? value!.slice(0,7) : householdDate().slice(0,7)); setOpen(true); };
  const [month, setMonth] = useState(() => !recurring && /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? value!.slice(0,7) : householdDate().slice(0,7));
  const [year, index] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year,index-1,1)).getUTCDay(), count = new Date(Date.UTC(year,index,0)).getUTCDate();
  const selected = recurring ? recurringDueDate(pending || (recurringDay ? `2000-01-${String(recurringDay).padStart(2,"0")}` : value ?? ""), month) : pending;
  const displayDate = recurring ? recurringDueDate(recurringDay ? `2000-01-${String(recurringDay).padStart(2,"0")}` : value ?? '', householdDate().slice(0,7)) : value;
  const display = displayDate ? new Date(`${displayDate}T12:00:00Z`).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}) : 'Choose date';
  const move = (offset: number) => {
    const date = new Date(Date.UTC(year,index-1+offset,1));
    setMonth(date.toISOString().slice(0,7));
  };
  return <fieldset className={`date-calendar-field ${className}`} disabled={disabled} aria-label={label} aria-invalid={invalid || undefined} aria-describedby={describedBy}>
    <legend id={id}>{label}</legend><span className="date-field-label" aria-hidden="true">{label}</span>
    <button className="date-field-trigger" type="button" ref={trigger} aria-haspopup="dialog" aria-expanded={open} onClick={show}>{display}<OutlineIcon name="calendar"/></button>
    {open && createPortal(<div className="date-picker-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><section className="date-picker-sheet" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
    <header><h2 id={`${id}-title`}>{label}</h2><button type="button" data-dialog-close aria-label="Close date picker" onClick={close}>×</button></header>
    <div className="loan-calendar date-calendar">
      <div className="loan-calendar-heading"><button type="button" className="secondary" aria-label={`Previous month for ${label}`} disabled={Boolean(min && month <= min.slice(0,7))} onClick={()=>move(-1)}>‹</button><strong aria-live="polite">{new Date(Date.UTC(year,index-1,1)).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'})}</strong><button type="button" className="secondary" aria-label={`Next month for ${label}`} disabled={Boolean(max && month >= max.slice(0,7))} onClick={()=>move(1)}>›</button></div>
      <div className="loan-calendar-grid">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(day=><span key={day} aria-hidden="true">{day}</span>)}{Array.from({length:first},(_,i)=><span key={'empty'+i}/>)}{Array.from({length:count},(_,i)=>{
        const date=`${month}-${String(i+1).padStart(2,'0')}`;
        return <button key={date} type="button" aria-label={date} aria-pressed={selected===date} aria-current={date===householdDate()?'date':undefined} disabled={Boolean(min && date<min || max && date>max)} onClick={()=>setPending(date)}>{i+1}</button>;
      })}</div>
    </div><footer><button className="secondary" type="button" onClick={close}>Cancel</button><button className="primary" type="button" disabled={!pending || Boolean(min && pending < min || max && pending > max)} onClick={() => { onChange(pending); close(); }}>Confirm date</button></footer></section></div>, document.body)}
  </fieldset>;
}
