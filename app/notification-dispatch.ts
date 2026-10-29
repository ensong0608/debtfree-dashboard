import {parseDashboardJson,type DashboardPayload} from './dashboard-data.ts';
import {transactionAdjustedAccounts} from './progress-balances.ts';
import {buildDueReminders} from './due-reminders.ts';
import {householdDate} from './household-date.ts';
import {notificationPreferences,webSubscription,type NotificationPreferences} from './notification-preferences.ts';
import {readPushKeys,sendWebPush} from './web-push.ts';
export type Reminder={key:string;title:string;body:string;url:string};
/** Same unpaid-cycle policy as Upcoming. This adapter is read-only. */
export function scheduledReminders(payload:DashboardPayload,prefs:NotificationPreferences,now=new Date()):Reminder[]{
 if(!prefs.enabled)return [];
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'2-digit',hourCycle:'h23'}).format(now));
 if(hour!==9)return [];
 const today=householdDate(now),month=today.slice(0,7),day=new Date(today+'T12:00:00Z');
 const output:Reminder[]=[];
 const settings=payload.monthlyPlan??{months:{},detailedSpendingTracking:false};
 if(prefs.nextDue){
  const accounts=transactionAdjustedAccounts(payload.accounts,payload.transactions,settings.detailedSpendingTracking);
  const dues=buildDueReminders({accounts,loans:(settings.loanTrackers??[]).filter(l=>!l.removedAt),items:payload.monthlyBudgets[month]??[],transactions:payload.transactions,adjustments:payload.balanceAdjustments,settings,today});
  if(dues.some(d=>d.date===today))output.push({key:'due:'+today,title:'Next Due Reminder',body:'You have a payment due today. Open Upcoming to review.',url:'/?reminder=due'});
 }
 const tomorrow=new Date(day);tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
 if(prefs.nextBudget&&tomorrow.getUTCMonth()!==day.getUTCMonth())output.push({key:'budget:'+month,title:'Next Budget Reminder',body:'A new month is almost here. Take a moment to plan your next budget.',url:'/?reminder=budget'});
 if(prefs.transactions&&day.getUTCDay()===2)output.push({key:'transactions:'+today,title:'Transactions Reminder',body:'Time for your weekly check-in. Review your recorded payments and transactions.',url:'/?reminder=transactions'});
 return output;
}
export async function dispatchNotifications(env:{DB:D1Database;WEB_PUSH_KEYS?:string},now=new Date(),send=sendWebPush){
 const keys=readPushKeys(env.WEB_PUSH_KEYS);if(!keys)return;
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'2-digit',hourCycle:'h23'}).format(now));if(hour!==9)return;
 const rows=await env.DB.prepare("SELECT s.id,s.email,s.household_id,s.subscription,s.preferences,h.payload FROM notification_subscriptions s JOIN household_members m ON m.email=s.email AND m.household_id=s.household_id AND m.status='active' JOIN household_state h ON h.household_id=s.household_id WHERE json_extract(s.preferences,'$.enabled')=1").all<{id:string;email:string;household_id:string;subscription:string;preferences:string;payload:string|null}>();
 for(const row of rows.results){
  try{
   if(!row.payload)continue;
   const reminders=scheduledReminders(parseDashboardJson(row.payload).payload,notificationPreferences(JSON.parse(row.preferences)),now);
   for(const reminder of reminders){
    const current=await env.DB.prepare("SELECT s.preferences FROM notification_subscriptions s JOIN household_members m ON m.email=s.email AND m.household_id=s.household_id AND m.status='active' WHERE s.id=?").bind(row.id).first<{preferences:string}>();
    if(!current)break;const preferences=notificationPreferences(JSON.parse(current.preferences));
    if(!preferences.enabled||!preferences[reminder.key.startsWith('due:')?'nextDue':reminder.key.startsWith('budget:')?'nextBudget':'transactions'])continue;
    const claimed=await env.DB.prepare("INSERT INTO notification_deliveries(subscription_id,reminder_key,status,attempted_at) VALUES(?,?,'pending',?) ON CONFLICT(subscription_id,reminder_key) DO NOTHING").bind(row.id,reminder.key,now.getTime()).run();
    if(claimed.meta.changes!==1)continue;
    try{
     const response=await send(webSubscription(JSON.parse(row.subscription)),keys,{title:reminder.title,body:reminder.body,tag:reminder.key,url:reminder.url});
     if(response.status===404||response.status===410){await env.DB.prepare('DELETE FROM notification_subscriptions WHERE id=?').bind(row.id).run();break;}
     await env.DB.prepare('UPDATE notification_deliveries SET status=? WHERE subscription_id=? AND reminder_key=?').bind(response.ok?'sent':'failed',row.id,reminder.key).run();
    }catch{await env.DB.prepare("UPDATE notification_deliveries SET status='failed' WHERE subscription_id=? AND reminder_key=?").bind(row.id,reminder.key).run();}
   }
  }catch{console.error('Reminder delivery skipped; no household data logged.');}
 }
 await env.DB.prepare('DELETE FROM notification_deliveries WHERE attempted_at<?').bind(now.getTime()-60*86400000).run();
}
