import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintRows } from '../scripts/production-preservation.mjs';
const rows=()=>({household_invitations:[{id:'invite',outcome:null}],household_requests:[{id:'request',cancelled_at:null}],households:[{id:'synthetic-b',name:'B'},{id:'synthetic-a',name:'A'}],household_members:[{email:'synthetic@example.test',role:'owner'}],household_state:[{household_id:'synthetic-a',revision:2,payload:'{"balance":100,"savedDate":"2026-07-01"}'}]});
test('production fingerprints tolerate row and column ordering, while retaining exact stored bytes',()=>{
 const a=rows(),b=rows();b.households.reverse();b.household_state=b.household_state.map(r=>Object.fromEntries(Object.entries(r).reverse()));
 assert.deepEqual(fingerprintRows(a),fingerprintRows(b));
 b.household_state[0].payload='{"balance":100, "savedDate":"2026-07-01"}';
 assert.notDeepEqual(fingerprintRows(a),fingerprintRows(b));
});
test('production preservation detects membership, revision, row removal and financial changes',()=>{
 for(const mutate of [r=>{r.household_invitations[0].outcome='revoked';},r=>{r.household_requests[0].cancelled_at=1;},r=>{r.household_members[0].role='viewer';},r=>{r.household_state[0].revision++;},r=>{r.households.pop();},r=>{r.household_state[0].payload='{"balance":99,"savedDate":"2026-07-01"}';}]) {const changed=rows();mutate(changed);assert.notDeepEqual(fingerprintRows(rows()),fingerprintRows(changed));}
 assert.throws(()=>fingerprintRows({}),/Missing/);
});
