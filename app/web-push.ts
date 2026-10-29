import {SignJWT,importJWK,type JWK} from 'jose';
import {webSubscription,type WebSubscription} from './notification-preferences.ts';
export type PushKeys={publicKey:string;privateKey:JWK};
export function readPushKeys(raw?:string):PushKeys|null{try{const k=JSON.parse(raw??'');return k.publicKey&&k.privateKey?.d?k:null;}catch{return null;}}
const encode=(s:string)=>new TextEncoder().encode(s);
export const decode64=(s:string)=>new Uint8Array(Buffer.from(s,'base64url'));
const join=(...parts:Uint8Array[])=>{const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){result.set(p,offset);offset+=p.length;}return result;};
async function hmac(key:Uint8Array,data:Uint8Array){const k=await crypto.subtle.importKey('raw',key as BufferSource,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,data as BufferSource));}
async function expand(key:Uint8Array,info:Uint8Array,length:number){return (await hmac(key,join(info,new Uint8Array([1])))).slice(0,length);}
/** RFC 8291 single-record aes128gcm encryption; VAPID signing uses a separate P-256 key. */
export async function encryptPush(subscription:WebSubscription,message:string){
 const clientKey=decode64(subscription.keys.p256dh),auth=decode64(subscription.keys.auth);
 const local=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const publicKey=new Uint8Array(await crypto.subtle.exportKey('raw',local.publicKey));
 const peer=await crypto.subtle.importKey('raw',clientKey as BufferSource,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:peer},local.privateKey,256));
 const prk=await hmac(auth,shared);
 const ikm=await expand(prk,join(encode('WebPush: info\0'),clientKey,publicKey),32);
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const saltPrk=await hmac(salt,ikm);
 const cek=await expand(saltPrk,encode('Content-Encoding: aes128gcm\0'),16);
 const nonce=await expand(saltPrk,encode('Content-Encoding: nonce\0'),12);
 const key=await crypto.subtle.importKey('raw',cek as BufferSource,'AES-GCM',false,['encrypt']);
 const plaintext=join(encode(message),new Uint8Array([2]));
 if(plaintext.length>3000)throw new Error('Push payload too large');
 const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce as BufferSource},key,plaintext as BufferSource));
 const recordSize=new Uint8Array(4);new DataView(recordSize.buffer).setUint32(0,4096);
 return join(salt,recordSize,new Uint8Array([65]),publicKey,encrypted);
}
export async function sendWebPush(subscription:WebSubscription,keys:PushKeys,payload:{title:string;body:string;tag:string;url:string},sender:typeof fetch=fetch){
 subscription=webSubscription(subscription);
 const key=await importJWK(keys.privateKey,'ES256');
 const token=await new SignJWT({sub:'https://debtfree-dashboard.ensong0608.workers.dev/support'}).setProtectedHeader({alg:'ES256',typ:'JWT'}).setAudience(new URL(subscription.endpoint).origin).setExpirationTime(Math.floor(Date.now()/1000)+3600).sign(key);
 const body=await encryptPush(subscription,JSON.stringify(payload));
 return sender(subscription.endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{authorization:`vapid t=${token}, k=${keys.publicKey}`,'content-encoding':'aes128gcm','content-type':'application/octet-stream',TTL:'3600',Urgency:'normal'},body:body as unknown as BodyInit});
}
