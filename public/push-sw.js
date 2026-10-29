/* Push only: never caches household pages, API responses, or credentials. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()??{};}catch{/* Use generic text for malformed messages. */}
 const url=typeof data.url==='string'&&['/?reminder=due','/?reminder=budget','/?reminder=transactions'].includes(data.url)?data.url:'/';
 event.waitUntil(self.registration.showNotification(typeof data.title==='string'?data.title:'DebtFree reminder',{body:typeof data.body==='string'?data.body:'Open DebtFree to review your reminders.',icon:'/favicon.svg',tag:typeof data.tag==='string'?data.tag:'debtfree-reminder',data:{url}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const url=new URL(event.notification.data?.url??'/',self.location.origin);
 if(url.origin!==self.location.origin)return;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const client=clients.find(c=>new URL(c.url).origin===self.location.origin);if(client){await client.navigate(url.href);return client.focus();}return self.clients.openWindow(url.href);}));
});
