"use client";
import {useEffect,useState,useSyncExternalStore} from 'react';
import {EMPTY_NOTIFICATIONS,NOTIFICATION_DEVICE_KEY,type NotificationPreferences} from './notification-preferences';
import {householdSessionHeaders} from './household-session-scope';
import TitleSelect from './title-select';
import styles from './settings-extras.module.css';
export type SettingsScope={identity:string;householdId:string};
async function responseJson(response:Response){const data=await response.json().catch(()=>{throw new Error("Could not connect. Please try again.");}) as {error?:string;preferences?:NotificationPreferences;publicKey?:string;id?:string;deviceKnown?:boolean};if(!response.ok)throw new Error(data.error??'Please try again.');return data;}
const subscribeBrowser=(notify:()=>void)=>{window.addEventListener('storage',notify);return()=>window.removeEventListener('storage',notify);};
const supportsPush=()=>typeof window!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
function deviceId(){try{return localStorage.getItem(NOTIFICATION_DEVICE_KEY)??'';}catch{return '';}}
function Switch({label,checked,disabled,onChange}:{label:string;checked:boolean;disabled:boolean;onChange:()=>void}){return <button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={onChange} className={styles.toggle}/>;}
export function NotificationSettings({scope,deviceOnly}:{scope:SettingsScope;deviceOnly:boolean}){
 const [prefs,setPrefs]=useState<NotificationPreferences>(EMPTY_NOTIFICATIONS),[publicKey,setPublicKey]=useState(''),[busy,setBusy]=useState(true),[message,setMessage]=useState(''),[known,setKnown]=useState(false);
 const supported=useSyncExternalStore(subscribeBrowser,supportsPush,()=>false);
 useEffect(()=>{
  let active=true;
  if(deviceOnly){void Promise.resolve().then(()=>{if(active){setBusy(false);setMessage('Sign in to enable phone reminders.');}});return()=>{active=false;};}
  fetch('/api/notifications?device='+encodeURIComponent(deviceId()),{cache:'no-store',headers:householdSessionHeaders(scope)}).then(responseJson).then(data=>{if(active){setPrefs(data.preferences??EMPTY_NOTIFICATIONS);setPublicKey(data.publicKey??'');setKnown(data.deviceKnown===true);}}).catch(error=>{if(active)setMessage(error.message);}).finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;};
 },[deviceOnly,scope]);
 const save=async(next:NotificationPreferences)=>{
  setBusy(true);setMessage('');
  try{
   let subscription:PushSubscription|null=null;
   if(next.enabled){
    if(!publicKey)throw new Error('Phone notifications are not configured yet.');
    // Browser permission must be requested by this deliberate switch click.
    const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
    if(permission!=='granted')throw new Error('Notifications are blocked. Allow them in your browser or phone settings.');
    const registration=await navigator.serviceWorker.register('/push-sw.js',{scope:'/'});
    await navigator.serviceWorker.ready;
    subscription=await registration.pushManager.getSubscription();
    if(subscription&&!known){await subscription.unsubscribe();subscription=null;localStorage.removeItem(NOTIFICATION_DEVICE_KEY);}
    if(!subscription){const bytes=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});}
   }
   const data=await fetch('/api/notifications?device='+encodeURIComponent(deviceId()),{method:'PUT',headers:{'content-type':'application/json',...householdSessionHeaders(scope)},body:JSON.stringify({preferences:next,subscription:subscription?.toJSON()})}).then(responseJson);
   if(data.id)localStorage.setItem(NOTIFICATION_DEVICE_KEY,data.id);
   setPrefs(data.preferences??EMPTY_NOTIFICATIONS);setKnown(true);setMessage('Saved.');
  }catch(error){setMessage(error instanceof Error?error.message:'Could not save notifications.');}
  finally{setBusy(false);}
 };
 const options=[{key:'nextDue' as const,title:'Next Due Reminder',copy:'A reminder at 9:00 AM Pacific when a bill, loan, or debt payment is due.'},{key:'nextBudget' as const,title:'Next Budget Reminder',copy:'A reminder at the end of the month at 9:00 AM Pacific to plan your next budget.'},{key:'transactions' as const,title:'Transactions Reminder',copy:'A reminder every Tuesday at 9:00 AM Pacific to check your transactions.'}];
 return <div className={styles.stack}><section className={styles.card}><div className={styles.row}><strong>Notifications</strong><Switch label="Notifications" checked={prefs.enabled} disabled={busy||deviceOnly||!supported} onChange={()=>void save({...prefs,enabled:!prefs.enabled})}/></div></section>
  {options.map(option=><section className={styles.card} key={option.key}><div className={styles.row}><div><strong>{option.title}</strong><p>{option.copy}</p></div><Switch label={option.title} checked={prefs[option.key]} disabled={busy||!prefs.enabled} onChange={()=>void save({...prefs,[option.key]:!prefs[option.key]})}/></div></section>)}
  {!supported&&<p className={styles.hint}>Use a browser that supports push notifications. On iPhone, add DebtFree to your Home Screen and open it there.</p>}
  {message&&<p role="status" className={styles.status}>{message}</p>}
 </div>;
}
export function SignOutButton({all=false}:{all?:boolean}){
 const id=useSyncExternalStore(subscribeBrowser,deviceId,()=>'');
 return <form action="/auth/logout" method="post" onSubmit={event=>{if(all&&!confirm('Sign out of DebtFree on all devices? Other devices may stay active until their current session token expires.'))event.preventDefault();}}><input type="hidden" name="device" value={id}/>{all&&<input type="hidden" name="scope" value="global"/>}<button type="submit" className={all?'secondary':'danger'}>{all?'Sign out of all devices':'Sign out'}</button></form>;
}
export function SecuritySettings({email,deviceOnly}:{email:string;deviceOnly:boolean}){
 const device=useSyncExternalStore(subscribeBrowser,()=>{const ua=navigator.userAgent;const platform=/Android/.test(ua)?'Android':/iPhone|iPad/.test(ua)?'iPhone / iPad':/Windows/.test(ua)?'Windows':/Macintosh/.test(ua)?'Mac':'This device';const browser=/Edg\//.test(ua)?'Edge':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'browser';return platform+' · '+browser;},()=>'This browser');
 return <div className={styles.stack}><section className={styles.card}><h3>Login info</h3><dl><div><dt>Email</dt><dd>{deviceOnly?'Not signed in':email}</dd></div><div><dt>Sign-in method</dt><dd>{deviceOnly?'Device storage':'Google'}</dd></div></dl></section>
 {!deviceOnly&&<section className={styles.card}><h3>Linked account</h3><p>Google · Connected</p><a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer">Manage Google security ↗</a><p>Manage your password, two-step verification, and passkeys in your Google account.</p></section>}
 <section className={styles.card}><h3>Current device</h3><p>{device}</p>{!deviceOnly&&<><SignOutButton all/><p>Other sessions end when their current access token expires.</p></>}</section></div>;
}
export function ReferFriends(){
 const [message,setMessage]=useState('');
 const share=async()=>{setMessage('');try{const data={title:'DebtFree',text:'Take small steps toward a debt-free future with DebtFree.',url:window.location.origin+'/'};if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(data.url);setMessage('App link copied.');}}catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))setMessage('Could not share. Try copying the link.');}};
 return <section className={styles.card}><h3>A little encouragement goes a long way.</h3><p>Share DebtFree with a friend. Sharing the app link does not give access to your household.</p><div className={styles.actions}><button className="primary" onClick={()=>void share()}>Share DebtFree</button><button className="secondary" onClick={()=>void navigator.clipboard.writeText(window.location.origin+'/').then(()=>setMessage('App link copied.')).catch(()=>setMessage('Could not copy the link.'))}>Copy link</button></div>{message&&<p role="status">{message}</p>}</section>;
}
export function FeedbackForm({scope,deviceOnly}:{scope:SettingsScope;deviceOnly:boolean}){
 const [kind,setKind]=useState('idea'),[text,setText]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 return <form className={`${styles.card} ${styles.form}`} onSubmit={async event=>{event.preventDefault();if(deviceOnly)return;setBusy(true);setMessage('');try{await fetch('/api/feedback',{method:'POST',headers:{'content-type':'application/json',...householdSessionHeaders(scope)},body:JSON.stringify({kind,message:text})}).then(responseJson);setText('');setMessage('Thank you. Your feedback has been saved.');}catch(error){setMessage(error instanceof Error?error.message:'Could not save feedback.');}finally{setBusy(false);}}}>
 <label><span>Feedback type</span><TitleSelect value={kind} onChange={e=>setKind(e.target.value)}><option value="idea">Suggestion</option><option value="problem">Report a problem</option><option value="other">Other</option></TitleSelect></label>
 <label><span>Your feedback</span><textarea minLength={10} maxLength={2000} required value={text} onChange={e=>setText(e.target.value)} placeholder="What could we improve?"/></label>
 <p className={styles.hint}>Please leave out balances, passwords, and other private details.</p><button className="primary" disabled={busy||deviceOnly||text.trim().length<10}>{busy?'Saving…':'Send feedback'}</button>{deviceOnly&&<p>Sign in to send feedback.</p>}{message&&<p role="status">{message}</p>}</form>;
}
export function ResetAccount({shared,readOnly,onReset,onExport,onCancel,message}:{shared:boolean;readOnly:boolean;onReset:()=>Promise<void>;onExport:()=>Promise<void>;onCancel:()=>void;message:string}){
 const [confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false);
 return <section className={`${styles.card} ${styles.form}`}><h3 className={styles.danger}>Reset {shared?'household':'account'} data?</h3><p>This removes debts, balances, budgets, transactions, and progress history. Your sign-in account is kept.</p>{shared&&<p className={styles.danger}>This resets the shared financial data for every household member.</p>}<p>A recovery checkpoint is kept. Export a backup first if you may need it.</p><label><span>Type RESET to confirm</span><input value={confirmation} autoComplete="off" disabled={readOnly||busy} onChange={e=>setConfirmation(e.target.value)}/></label><button className="secondary" disabled={busy} onClick={()=>void onExport()}>Export backup</button><div className={styles.actions}><button className="secondary" disabled={busy} onClick={onCancel}>Cancel</button><button className="danger" disabled={readOnly||busy||confirmation!=='RESET'} onClick={async()=>{setBusy(true);try{await onReset();}finally{setBusy(false);}}}>{busy?'Resetting…':'Reset Account'}</button></div>{readOnly&&<p>Your access does not allow resetting household data.</p>}{message&&<p role="status">{message}</p>}</section>;
}
export {styles as settingsExtraStyles};
