/** Display limit chosen for the household settings screen. Existing access and invitations remain intact. */
export const HOUSEHOLD_MEMBER_LIMIT=3;
export function canShowInvite(members:{status:string}[]){return members.filter(member=>member.status==='active'||member.status==='invited').length<HOUSEHOLD_MEMBER_LIMIT;}
