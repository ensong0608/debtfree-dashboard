import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

test('Google login requests account selection while preserving callback and origin guards', async t => {
  // Exercise the real handler without credentials, cookies or a network request.
  const stubURL = 'data:text/javascript,' + encodeURIComponent(`
    export const state = { calls: [], error: null, url: 'https://auth.example.test/authorize', fail: false };
    export const requireSupabaseConfiguration = () => ({origin:'https://preview.example.test'});
    export async function supabaseServer() {
      if (state.fail) throw new Error('Synthetic configuration failure');
      return {auth:{signInWithOAuth:async options => {
        state.calls.push(options);
        return {data:{url:state.url},error:state.error};
      }}};
    }
    export const NextResponse = {redirect:(url,status)=>Response.redirect(url,status)};
  `);
  const hook = registerHooks({resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/app/auth/google/route.ts') &&
        ['next/server','../../supabase-server','../../auth-config'].includes(specifier)) {
      return {url:stubURL,shortCircuit:true};
    }
    return nextResolve(specifier,context);
  }});
  let POST, state;
  try {
    ({POST}=await import('../app/auth/google/route.ts'));
    ({state}=await import(stubURL));
  } finally { hook.deregister(); }
  const request = origin => new Request('https://preview.example.test/auth/google', {
    method:'POST', headers:origin ? {origin} : {},
  });

  await t.test('explicit sign-in requests chooser and stays on the configured callback origin', async()=>{
    const response=await POST(request('https://preview.example.test'));
    assert.equal(response.status,303);
    assert.equal(response.headers.get('location'),state.url);
    assert.equal(state.calls.length,1);
    const call=state.calls[0];
    assert.equal(call.provider,'google');
    assert.equal(call.options.queryParams.prompt,'select_account');
    assert.equal(call.options.queryParams.login_hint,undefined);
    assert.equal(call.options.redirectTo,'https://preview.example.test/auth/callback');
    assert.equal(call.options.skipBrowserRedirect,true);
  });
  await t.test('foreign or missing origins cannot initiate authentication', async()=>{
    for(const origin of ['https://foreign.example.test',null]) {
      assert.equal((await POST(request(origin))).status,403);
    }
    assert.equal(state.calls.length,1);
  });
  await t.test('provider rejection returns to login without reporting success', async()=>{
    state.error={message:'Synthetic rejection'};
    const response=await POST(request('https://preview.example.test'));
    assert.equal(response.status,303);
    assert.equal(response.headers.get('location'),'https://preview.example.test/auth/login?error=unavailable');
  });
  await t.test('unavailable authentication is not cached', async()=>{
    state.fail=true;
    const response=await POST(request('https://preview.example.test'));
    assert.equal(response.status,503);
    assert.equal(response.headers.get('cache-control'),'no-store');
  });
});
