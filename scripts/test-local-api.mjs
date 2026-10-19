import assert from 'node:assert/strict';
const origin='http://localhost:8787';
const call=(path,who,options={})=>fetch(origin+path,{...options,headers:{Origin:origin,...(who?{cookie:`debtfree-local-user=${who}@example.test`}:{}),...options.headers}});
assert.equal((await call('/api/household')).status,401);
const data={};
for(const who of ['owner','admin','viewer','other']){const r=await call('/api/household',who);assert.equal(r.status,200);data[who]=await r.json();assert.equal(data[who].identity,who+'@example.test');}
assert.equal(data.owner.householdId,data.admin.householdId);
assert.notEqual(data.owner.householdId,data.other.householdId);
const put=(who,body,household=data[who].householdId)=>call('/api/household',who,{method:'PUT',headers:{'Content-Type':'application/json','x-debtfree-identity':who+'@example.test','x-debtfree-household':household},body:JSON.stringify(body)});
assert.equal((await put('viewer',{revision:data.viewer.revision,payload:data.viewer.payload})).status,403);
assert.equal((await put('other',{revision:data.owner.revision,payload:data.owner.payload},data.owner.householdId)).status,403);
assert.equal((await put('admin',{revision:data.admin.revision,payload:data.admin.payload})).status,200);
assert.equal((await call('/api/household','owner',{method:'PUT',headers:{Origin:'https://example.test'},body:'{}'})).status,403);
const logout=await call('/auth/logout','owner',{method:'POST',redirect:'manual'});assert.equal(logout.status,303);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
assert.equal((await call('/api/household','unknown')).status,401);
console.log('PASS: local identities, shared members, household isolation, viewer denial, admin revision save, CSRF, logout, unknown and anonymous denial.');
