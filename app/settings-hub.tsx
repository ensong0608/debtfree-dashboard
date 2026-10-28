"use client";
import {useEffect,useState,type ReactNode} from 'react';
import OutlineIcon,{type IconName} from './outline-icon';
import {ExperienceOverlay} from './debt-experience';
import {APPEARANCE_EVENT,APPEARANCE_KEY,DEFAULT_APPEARANCE,loadAppearance,textSizePoints,type Appearance} from './appearance';
import {useHouseholdCurrency} from './household-currency-context';
type Panel='appearance'|'household'|'currency'|'data'|'archives'|'tools'|'policies';
function Row({icon,label,value,onClick,href,dot}:{icon:IconName;label:string;value?:string;onClick?:()=>void;href?:string;dot?:string}){
 const content=<><OutlineIcon name={icon}/><strong>{label}</strong>{dot?<i className="settings-color-dot" style={{background:dot}}/>:value?<span className="settings-row-value">{value}</span>:null}<span className="settings-row-chevron" aria-hidden="true">›</span></>;
 return href ? <a className="settings-row" href={href}>{content}</a> : <button className="settings-row" type="button" onClick={onClick}>{content}</button>;
}
export default function SettingsHub({name,roleLabel,memberCount,onAccount,onExport,appearance,currency,household,data,archives,tools}:{name:string;roleLabel:string;memberCount:number;onAccount:()=>void;onExport:()=>Promise<void>;appearance:ReactNode;currency:ReactNode;household:ReactNode;data:ReactNode;archives:ReactNode;tools:{label:string;onClick:()=>void}[]}){
 const [panel,setPanel]=useState<Panel|null>(null);
 const [look,setLook]=useState<Appearance>(DEFAULT_APPEARANCE);
 const unit=useHouseholdCurrency();
 useEffect(()=>{const update=()=>{try{setLook(loadAppearance(localStorage));}catch{}};update();window.addEventListener(APPEARANCE_EVENT,update);const storage=(event:StorageEvent)=>{if(event.key===APPEARANCE_KEY||event.key===null)update();};window.addEventListener('storage',storage);return()=>{window.removeEventListener(APPEARANCE_EVENT,update);window.removeEventListener('storage',storage);};},[]);
 const titles={appearance:'Appearance',household:'Household',currency:'Currency',data:'Backup & recovery',archives:'Debt history',tools:'More tools',policies:'Privacy & terms'};
 return <div className="settings-hub">
  <button type="button" className="settings-profile" onClick={onAccount}><span className="settings-profile-avatar">{name.trim()[0]?.toUpperCase()||'D'}</span><span><strong>{name}</strong><small>{roleLabel}</small></span><span aria-hidden="true">›</span></button>
  <section className="settings-group-block"><h2>Appearance</h2><div className="settings-rows"><Row icon="moon" label="Theme" value={look.theme==='dark'?'Dark':'Light'} onClick={()=>setPanel('appearance')}/><Row icon="palette" label="Accent color" dot={look.accent} onClick={()=>setPanel('appearance')}/><Row icon="text" label="Text size" value={`${textSizePoints(look.size)} pt`} onClick={()=>setPanel('appearance')}/></div></section>
  <section className="settings-group-block"><h2>Household</h2><div className="settings-rows"><Row icon="users" label="Members" value={`${memberCount} ${memberCount===1?'member':'members'}`} onClick={()=>setPanel('household')}/><Row icon="globe" label="Currency" value={unit} onClick={()=>setPanel('currency')}/></div></section>
  <section className="settings-group-block"><h2>Data</h2><div className="settings-rows"><Row icon="upload" label="Export backup" onClick={()=>void onExport()}/><Row icon="download" label="Import backup" onClick={()=>setPanel('data')}/><Row icon="archive" label="Debt history" onClick={()=>setPanel('archives')}/></div></section>
  <section className="settings-group-block"><h2>Support</h2><div className="settings-rows"><Row icon="help" label="Help & support" href="/support"/><Row icon="shield" label="Privacy & terms" onClick={()=>setPanel('policies')}/></div></section>
  <button className="settings-more-tools" type="button" onClick={()=>setPanel('tools')}>More tools &amp; recovery</button>
  {panel && <ExperienceOverlay title={titles[panel]} onBack={()=>setPanel(null)} wide><div className={`settings-panel settings-panel-${panel}`}>{panel==='appearance'?appearance:panel==='household'?household:panel==='currency'?currency:panel==='data'?data:panel==='archives'?archives:panel==='policies'?<div className="settings-rows"><Row icon="shield" label="Privacy policy" href="/privacy"/><Row icon="receipt" label="Terms of service" href="/terms"/><Row icon="account" label="Account deletion" href="/deletion"/></div>:<><div className="settings-rows">{tools.map(tool=><Row key={tool.label} icon="chart" label={tool.label} onClick={()=>{setPanel(null);tool.onClick();}}/>)}<Row icon="download" label="Backup & recovery" onClick={()=>setPanel('data')}/></div><p className="settings-unavailable">Notification preferences are not available yet.</p></>}</div></ExperienceOverlay>}
 </div>;
}
