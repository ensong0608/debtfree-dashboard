import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectReleaseResources } from '../scripts/inspect-release-resources.mjs';
import { PREVIEW_ACCOUNT, PRODUCTION_DATABASE_ID, PREVIEW_DATABASE } from '../scripts/provision-preview-isolation.mjs';
function setup({ leaked = false, wrongAuth = false } = {}) {
  const calls = [];
  return { calls, api: async path => {
    calls.push(path);
    if (path.endsWith('/d1/database/' + PRODUCTION_DATABASE_ID)) return { name: 'debtfree-dashboard-prod' };
    if (path.endsWith('/d1/database?per_page=100')) return [{ name: PREVIEW_DATABASE, uuid: 'separate-test-id' }];
    if (path.endsWith('/deployments')) return { deployments: [{ id: 'deployment', versions: [{ version_id: 'source' }] }] };
    if (path.includes(PREVIEW_DATABASE)) return { bindings: [{ name: 'DB', type: 'd1', id: leaked ? PRODUCTION_DATABASE_ID : 'separate-test-id' }] };
    if (path.endsWith('/settings')) return { bindings: [{ name: 'DB', type: 'd1', id: PRODUCTION_DATABASE_ID }, { name: 'AUTH_PROVIDER', text: wrongAuth ? 'none' : 'supabase' }, { name: 'SECRET', text: 'must-not-appear' }] };
    throw new Error('Unexpected endpoint');
  } };
}
test('read-only inspection checks deployment, auth and separate bindings without exposing settings', async () => {
  const env = setup();
  const report = await inspectReleaseResources(PREVIEW_ACCOUNT, env.api);
  assert.equal(report.previewDatabaseSeparate, true);
  assert.deepEqual(report.productionDeployments, [{ id: 'deployment', versions: ['source'] }]);
  assert.ok(!JSON.stringify(report).includes('must-not-appear'));
  assert.equal(env.calls.length, 5);
  assert.ok(env.calls.every(p => !p.includes('/query') && !p.includes('/export')));
  assert.match(report.limitation, /IAM.*unverified/);
});
test('resource inspection fails closed on production binding leaks and disabled authentication', async () => {
  for (const options of [{ leaked: true }, { wrongAuth: true }]) {
    await assert.rejects(inspectReleaseResources(PREVIEW_ACCOUNT, setup(options).api), /mismatch/);
  }
});
test('unexpected account is rejected before any resource request', async () => {
  const env = setup();
  await assert.rejects(inspectReleaseResources('other-account', env.api));
  assert.deepEqual(env.calls, []);
});
