'use client';
import {useState,type ReactNode} from 'react';
import {ExperienceOverlay} from './debt-experience';
import styles from './debt-detail-sections.module.css';
export function DetailSection({title,summary,children}:{title:string;summary:ReactNode;children:ReactNode}) {
 const [open,setOpen]=useState(false);
 return <><button type="button" className={styles.section} aria-haspopup="dialog" onClick={()=>setOpen(true)}><span className={styles.heading}>{title}<span aria-hidden="true">›</span></span><span className={styles.summary}>{summary}</span></button>{open&&<ExperienceOverlay title={title} onBack={()=>setOpen(false)}><div className={styles.fields}>{children}</div><footer className={styles.footer}><button className="primary" type="button" onClick={()=>setOpen(false)}>Done</button></footer></ExperienceOverlay>}</>;
}
export function DetailSwitch({label,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}) {
 return <label className={styles.switchRow}><span>{label}</span><input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={event=>onChange(event.target.checked)} className={styles.toggle}/></label>;
}
export function DetailSummary({label,value}:{label:string;value:ReactNode}) {return <span className={styles.summaryRow}><span>{label}</span><strong>{value}</strong></span>;}
export {styles as detailStyles};
