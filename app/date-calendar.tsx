"use client";
import { useId, useState } from 'react';
import { recurringDueDate } from './recurring-due-date';
import { householdDate } from './household-date';

/** One calendar for due dates, dated records and term dates. Values stay YYYY-MM-DD. */
export default function DateCalendar({ label, value, onChange, min, max, disabled = false, invalid = false, describedBy, recurring = false, recurringDay, className = '' }: {
  label: string; value?: string; recurring?: boolean; recurringDay?: number; onChange: (date: string) => void; min?: string; max?: string;
  disabled?: boolean; invalid?: boolean; describedBy?: string; className?: string;
}) {
  const id = useId();
  const [month, setMonth] = useState(() => !recurring && /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? value!.slice(0,7) : householdDate().slice(0,7));
  const [year, index] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year,index-1,1)).getUTCDay(), count = new Date(Date.UTC(year,index,0)).getUTCDate();
  const selected = recurring ? recurringDueDate(recurringDay ? `2000-01-${String(recurringDay).padStart(2,"0")}` : value ?? "", month) : value;
  const move = (offset: number) => {
    const date = new Date(Date.UTC(year,index-1+offset,1));
    setMonth(date.toISOString().slice(0,7));
  };
  return <fieldset className={`date-calendar-field ${className}`} disabled={disabled} aria-label={label} aria-invalid={invalid || undefined} aria-describedby={describedBy}>
    <legend id={id}>{label}</legend>
    <div className="loan-calendar date-calendar">
      <div className="loan-calendar-heading"><button type="button" className="secondary" aria-label={`Previous month for ${label}`} disabled={Boolean(min && month <= min.slice(0,7))} onClick={()=>move(-1)}>‹</button><strong aria-live="polite">{new Date(Date.UTC(year,index-1,1)).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'})}</strong><button type="button" className="secondary" aria-label={`Next month for ${label}`} disabled={Boolean(max && month >= max.slice(0,7))} onClick={()=>move(1)}>›</button></div>
      <div className="loan-calendar-grid">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(day=><span key={day} aria-hidden="true">{day}</span>)}{Array.from({length:first},(_,i)=><span key={'empty'+i}/>)}{Array.from({length:count},(_,i)=>{
        const date=`${month}-${String(i+1).padStart(2,'0')}`;
        return <button key={date} type="button" aria-label={date} aria-pressed={selected===date} aria-current={date===householdDate()?'date':undefined} disabled={Boolean(min && date<min || max && date>max)} onClick={()=>onChange(date)}>{i+1}</button>;
      })}</div>
    </div>
  </fieldset>;
}
