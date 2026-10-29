import {readBoundedBody,RequestError} from './request-safety.ts';
import {checkHouseholdSession} from './household-session-scope.ts';
import {notificationPreferences,webSubscription,EMPTY_NOTIFICATIONS} from './notification-preferences.ts';
type Context={db:D1Database;user:{email:string};member:{household_id:string}};
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'cache-control':'private, no-store'}});
export function createNotificationApi(context:()=>Promise<Context|null>,configuration:()=>{origin:string;publicKey:string|null}){
 async function handle(request:Request){
  const ctx=await context();if(!ctx)return reply({error:'Sign in required'},401);
  const write=request.method!=='GET';
  if(write&&request.headers.get('origin')!==new URL(configuration().origin).origin)return reply({error:'Invalid origin'},403);
  const changed=checkHouseholdSession(request,ctx,write);if(changed)return changed;
  const id=new URL(request.url).searchParams.get('device')??'';
  if(id&&!/^[a-f0-9-]{36}$/.test(id))return reply({error:'Invalid device'},400);
  if(!write){
   const row=id?await ctx.db.prepare('SELECT preferences FROM notification_subscriptions WHERE id=? AND email=? AND household_id=?').bind(id,ctx.user.email,ctx.member.household_id).first<{preferences:string}>():null;
   return reply({deviceKnown:Boolean(row),publicKey:configuration().publicKey,preferences:row?notificationPreferences(JSON.parse(row.preferences)):EMPTY_NOTIFICATIONS});
  }
  if(request.method==='DELETE'){
   if(id)await ctx.db.prepare('DELETE FROM notification_subscriptions WHERE id=? AND email=? AND household_id=?').bind(id,ctx.user.email,ctx.member.household_id).run();
   return reply({ok:true});
  }
  if(request.method!=='PUT')return reply({error:'Method not allowed'},405);
  const body=JSON.parse(await readBoundedBody(request,6000));
  const preferences=notificationPreferences(body.preferences);
  if(!preferences.enabled&&id){
   await ctx.db.prepare('UPDATE notification_subscriptions SET preferences=?,updated_at=? WHERE id=? AND email=? AND household_id=?').bind(JSON.stringify(preferences),Date.now(),id,ctx.user.email,ctx.member.household_id).run();
   return reply({id,preferences});
  }
  if(!configuration().publicKey)return reply({error:'Phone notifications are not configured yet'},503);
  const subscription=webSubscription(body.subscription);
  const existing=await ctx.db.prepare('SELECT id,email,household_id FROM notification_subscriptions WHERE endpoint=?').bind(subscription.endpoint).first<{id:string;email:string;household_id:string}>();
  // Never transfer a browser subscription between identities. Unsubscribe before switching accounts.
  if(existing&&(existing.email!==ctx.user.email||existing.household_id!==ctx.member.household_id))return reply({error:'Remove this browser’s previous notification subscription before enabling notifications.'},409);
  if(!existing){const count=await ctx.db.prepare('SELECT COUNT(*) AS n FROM notification_subscriptions WHERE email=?').bind(ctx.user.email).first<{n:number}>();if((count?.n??0)>=10)return reply({error:'Device limit reached. Disable notifications on another device first.'},409);}
  const deviceId=existing?.id??crypto.randomUUID();
  await ctx.db.prepare('INSERT INTO notification_subscriptions(id,email,household_id,endpoint,subscription,preferences,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET subscription=excluded.subscription,preferences=excluded.preferences,updated_at=excluded.updated_at')
   .bind(deviceId,ctx.user.email,ctx.member.household_id,subscription.endpoint,JSON.stringify(subscription),JSON.stringify(preferences),Date.now()).run();
  return reply({id:deviceId,preferences});
 }
 const guarded=async(request:Request)=>{try{return await handle(request);}catch(error){return reply({error:error instanceof RequestError?error.message:'Could not update notifications. Try again.'},error instanceof RequestError?error.status:400);}};
 return {GET:guarded,PUT:guarded,DELETE:guarded};
}
export function createFeedbackApi(context:()=>Promise<Context|null>,origin:()=>string){
 return async(request:Request)=>{
  const ctx=await context();if(!ctx)return reply({error:'Sign in required'},401);
  if(request.headers.get('origin')!==new URL(origin()).origin)return reply({error:'Invalid origin'},403);
  const changed=checkHouseholdSession(request,ctx,true);if(changed)return changed;
  try{
   const body=JSON.parse(await readBoundedBody(request,12000));
   if(!['idea','problem','other'].includes(body.kind)||typeof body.message!=='string'||body.message.trim().length<10||body.message.length>2000)return reply({error:'Enter 10–2,000 characters.'},400);
   const count=await ctx.db.prepare('SELECT COUNT(*) AS n FROM app_feedback WHERE email=? AND created_at>?').bind(ctx.user.email,Date.now()-86400000).first<{n:number}>();
   if((count?.n??0)>=10)return reply({error:'Daily feedback limit reached. Please try tomorrow.'},429);
   await ctx.db.prepare('INSERT INTO app_feedback(id,email,household_id,kind,message,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),ctx.user.email,ctx.member.household_id,body.kind,body.message.trim(),Date.now()).run();
   return reply({ok:true});
  }catch{return reply({error:'Could not save feedback. Try again.'},503);}
 };
}
