"use client";
import { useState } from 'react';
import OutlineIcon from './outline-icon';
import { institutionPresentation } from './institutions';
import styles from './institution-icon.module.css';
const artwork = [
 {id:'penfed',label:'PenFed',match:/^pen\s*fed(?:\s|$)/i,file:'penfed-owner.png'},
 {id:'chase',label:'Chase',match:/^chase(?:\s|$)/i,file:'chase-symbol.svg'},
 {id:'citi',label:'Citi',match:/^(?:citi|citibank)(?:\s|$)/i,file:'citi.svg'},
 {id:'discover',label:'Discover',match:/^discover(?:\s|$)/i,file:'discover.svg'},
 {id:'wells-fargo',label:'Wells Fargo',match:/^wells\s*fargo(?:\s|$)/i,file:'wells-fargo.svg'},
 {id:'us-bank',label:'U.S. Bank',match:/^(?:u\.?s\.?\s*bank|usb(?:\s*connect)?)(?:\s|$)/i,file:'us-bank-owner.png'},
];
/** Display-only artwork lookup. Never changes institution keys, account types or records. */
export default function InstitutionIcon({ institutionKey, debtType, accountName = '' }: { institutionKey?: unknown; debtType: string; accountName?: string }) {
 const loanIcon=/^(?:car|auto|vehicle)(?: loan)?$/i.test(debtType) ? 'car' : /^(?:(?:house|home)(?: loan)?|mortgage)$/i.test(debtType) ? 'home' : null;
 const known=artwork.find(a=>a.match.test(accountName)) ?? artwork.find(a=>a.id===institutionKey);
 const {label,icon}=institutionPresentation(institutionKey,debtType);
 const [failed,setFailed]=useState(false);
 const initials=(accountName || label).trim().split(/\s+/).map(word=>word[0]).slice(0,2).join('').toUpperCase();
 return <span className={styles.tile} data-institution={loanIcon ? `loan-${loanIcon}` : known?.id ?? 'fallback'} role="img" aria-label={loanIcon ? loanIcon==='car' ? 'Car loan' : 'House loan' : known?.label ?? (label && label!=='Other' ? label : accountName || debtType)}>
  {loanIcon ? <OutlineIcon name={loanIcon}/> : known && !failed ? <img src={`/institutions/${known.file}`} alt="" width="36" height="36" onError={()=>setFailed(true)}/> : initials ? <span className={styles.initials}>{initials}</span> : <OutlineIcon name={icon}/>}
 </span>;
}
