export type NotificationPreferences = { enabled: boolean; nextDue: boolean; nextBudget: boolean; transactions: boolean };
export const EMPTY_NOTIFICATIONS: NotificationPreferences = { enabled:false,nextDue:false,nextBudget:false,transactions:false };
export const NOTIFICATION_DEVICE_KEY='debtfree-notification-device-v1';
export function notificationPreferences(value:unknown):NotificationPreferences {
 if(!value||typeof value!=='object')throw new Error('Invalid notification preferences');
 const v=value as Record<string,unknown>;
 for(const key of Object.keys(EMPTY_NOTIFICATIONS))if(typeof v[key]!=='boolean')throw new Error('Invalid notification preferences');
 return {enabled:v.enabled as boolean,nextDue:v.nextDue as boolean,nextBudget:v.nextBudget as boolean,transactions:v.transactions as boolean};
}
export function pushEndpoint(value:string) {
 const url=new URL(value);
 const allowed=url.hostname==='fcm.googleapis.com'||url.hostname==='updates.push.services.mozilla.com'||url.hostname.endsWith('.push.apple.com')||url.hostname.endsWith('.notify.windows.com');
 if(!allowed||url.protocol!=='https:'||url.port||url.username||url.password||url.hash||value.length>2048)throw new Error('Unsupported push service');
 return url.href;
}
export type WebSubscription={endpoint:string;keys:{p256dh:string;auth:string}};
export function webSubscription(value:unknown):WebSubscription {
 const v=value as WebSubscription;
 if(!v||typeof v.endpoint!=='string'||!v.keys||!/^[-_A-Za-z0-9]{87}$/.test(v.keys.p256dh)||!/^[-_A-Za-z0-9]{22}$/.test(v.keys.auth))throw new Error('Invalid push subscription');
 return {endpoint:pushEndpoint(v.endpoint),keys:{p256dh:v.keys.p256dh,auth:v.keys.auth}};
}
