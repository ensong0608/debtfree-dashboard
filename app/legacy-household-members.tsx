"use client";
import {useState} from 'react';
import TitleSelect from './title-select';
import HouseholdMemberMenu from './household-member-menu';
import {canShowInvite} from './household-capacity';
type Member={email:string;display_name:string|null;role:'owner'|'admin'|'viewer';status:string};
export default function LegacyHouseholdMembers({members,owner,onInvite,onRemove}:{members:Member[];owner:boolean;onInvite:(email:string,role:'admin'|'viewer')=>Promise<void>;onRemove:(email:string)=>Promise<void>}){
 const [email,setEmail]=useState(''),[role,setRole]=useState<'admin'|'viewer'>('admin'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 return <section className="settings-local-household"><h2>Household members</h2>{owner&&canShowInvite(members)&&<form onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{await onInvite(email,role);setEmail('');setMessage('Member access saved.');}catch(error){setMessage(error instanceof Error?error.message:'Could not add member.');}finally{setBusy(false);}}}><label>Member email<input type="email" value={email} required onChange={e=>setEmail(e.target.value)}/></label><TitleSelect aria-label="Household access role" value={role} onChange={e=>setRole(e.target.value as 'admin'|'viewer')}><option value="admin">Admin</option><option value="viewer">Viewer</option></TitleSelect><button className="primary" disabled={busy}>Add member</button></form>}
 <div className="member-list">{members.map(member=><div className="member-row" key={member.email}><div><strong>{member.display_name||member.email}</strong><small>{member.role}</small></div>{owner&&member.role!=='owner'&&<HouseholdMemberMenu name={member.display_name||member.email}><button className="secondary" disabled={busy} onClick={async()=>{if(!confirm('Remove '+member.email+' from this household?'))return;setBusy(true);try{await onRemove(member.email);}catch(error){setMessage(error instanceof Error?error.message:'Could not remove member.');}finally{setBusy(false);}}}>Remove</button></HouseholdMemberMenu>}</div>)}</div>{message&&<p role="status">{message}</p>}</section>;
}
