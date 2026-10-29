"use client";
import {useEffect,useMemo,useState,type ReactNode} from 'react';
import OutlineIcon,{type IconName} from './outline-icon';
import {ExperienceOverlay} from './debt-experience';
import {APPEARANCE_EVENT,APPEARANCE_KEY,DEFAULT_APPEARANCE,loadAppearance,textSizePoints,type Appearance} from './appearance';
import {useHouseholdCurrency} from './household-currency-context';
import {NotificationSettings,SecuritySettings,ReferFriends,FeedbackForm,ResetAccount,SignOutButton,settingsExtraStyles as styles} from './settings-extras';
type Panel='appearance'|'household'|'currency'|'data'|'archives'|'policies'|'notifications'|'security'|'refer'|'feedback'|'reset';
function Row({icon,label,value,onClick,href,dot}:{icon:IconName;label:string;value?:string;onClick?:()=>void;href?:string;dot?:string}){
 const content=<><OutlineIcon name={icon}/><strong>{label}</strong>{dot?<i className="settings-color-dot" style={{background:dot}}/>:value?<span className="settings-row-value">{value}</span>:null}<span className="settings-row-chevron" aria-hidden="true">›</span></>;
 return href ? <a className="settings-row" href={href}>{content}</a> : <button className="settings-row" type="button" onClick={onClick}>{content}</button>;
}
export default function SettingsHub({name,email,householdId,roleLabel,memberCount,onExport,onReset,transferMessage,deviceOnly,readOnly,appearance,currency,household,data,archives}:{name:string;email:string;householdId?:string;roleLabel:string;memberCount:number;onExport:()=>Promise<void>;onReset:()=>Promise<void>;transferMessage:string;deviceOnly:boolean;readOnly:boolean;appearance:ReactNode;currency:ReactNode;household:ReactNode;data:ReactNode;archives:ReactNode}){
 const [panel,setPanel]=useState<Panel|null>(null),[look,setLook]=useState<Appearance>(DEFAULT_APPEARANCE);
 const scope=useMemo(()=>({identity:email,householdId:householdId??''}),[email,householdId]);
 const unit=useHouseholdCurrency();
 useEffect(()=>{const update=()=>{try{setLook(loadAppearance(localStorage));}catch{}};update();window.addEventListener(APPEARANCE_EVENT,update);const storage=(event:StorageEvent)=>{if(event.key===APPEARANCE_KEY||event.key===null)update();};window.addEventListener('storage',storage);return()=>{window.removeEventListener(APPEARANCE_EVENT,update);window.removeEventListener('storage',storage);};},[]);
 const titles:Record<Panel,string>={appearance:'Appearance',household:'Household',currency:'Currency',data:'Backup & recovery',archives:'Archived Debts',policies:'Privacy & terms',notifications:'Notifications',security:'Security settings',refer:'Refer friends',feedback:'Give feedback',reset:'Reset Account'};
 return <div className="settings-hub">
  <div className={styles.identity}><span aria-hidden="true">{name.trim()[0]?.toUpperCase()||'D'}</span><div><strong>{name}</strong>{!deviceOnly&&<small>{email}</small>}<small>{roleLabel}</small></div></div>
  <section className="settings-group-block"><h2>Preferences</h2><div className="settings-rows"><Row icon="moon" label="Theme" value={look.theme==='tomorrow'?'A Brighter Tomorrow':look.theme==='dark'?'Dark':'Light'} onClick={()=>setPanel('appearance')}/><Row icon="palette" label="Accent color" dot={look.accent} onClick={()=>setPanel('appearance')}/><Row icon="text" label="Text size" value={`${textSizePoints(look.size)} pt`} onClick={()=>setPanel('appearance')}/><Row icon="bell" label="Notifications" onClick={()=>setPanel('notifications')}/></div></section>
  <section className="settings-group-block"><h2>Household</h2><div className="settings-rows"><Row icon="users" label="Members" value={`${memberCount} ${memberCount===1?'member':'members'}`} onClick={()=>setPanel('household')}/><Row icon="globe" label="Currency" value={unit} onClick={()=>setPanel('currency')}/></div></section>
  <section className="settings-group-block"><h2>Data &amp; security</h2><div className="settings-rows"><Row icon="shield" label="Security" onClick={()=>setPanel('security')}/><Row icon="download" label="Backup & recovery" onClick={()=>setPanel('data')}/><Row icon="archive" label="Archived Debts" onClick={()=>setPanel('archives')}/><Row icon="refresh" label="Reset Account" onClick={()=>setPanel('reset')}/></div></section>
  <section className="settings-group-block"><h2>Help &amp; information</h2><div className="settings-rows"><Row icon="users" label="Refer friends" onClick={()=>setPanel('refer')}/><Row icon="text" label="Give feedback" onClick={()=>setPanel('feedback')}/><Row icon="help" label="Help & support" href="/support"/><Row icon="shield" label="Privacy & terms" onClick={()=>setPanel('policies')}/></div></section>
  {!deviceOnly&&<div className={styles.signout}><SignOutButton/></div>}
  {panel&&<ExperienceOverlay title={titles[panel]} onBack={()=>setPanel(null)} wide><div className={`settings-panel settings-panel-${panel}`}>
   {panel==='appearance'?appearance:panel==='household'?household:panel==='currency'?currency:panel==='data'?data:panel==='archives'?archives:panel==='notifications'?<NotificationSettings scope={scope} deviceOnly={deviceOnly}/>:panel==='security'?<SecuritySettings email={email} deviceOnly={deviceOnly}/>:panel==='refer'?<ReferFriends/>:panel==='feedback'?<FeedbackForm scope={scope} deviceOnly={deviceOnly}/>:panel==='reset'?<ResetAccount shared={!deviceOnly} readOnly={readOnly} onReset={onReset} onExport={onExport} onCancel={()=>setPanel(null)} message={transferMessage}/>:<div className="settings-rows"><Row icon="shield" label="Privacy policy" href="/privacy"/><Row icon="receipt" label="Terms of service" href="/terms"/><Row icon="account" label="Account deletion" href="/deletion"/></div>}
  </div></ExperienceOverlay>}
 </div>;
}
