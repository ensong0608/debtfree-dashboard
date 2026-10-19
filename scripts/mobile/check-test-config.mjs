import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Deliberately accepts no alternative config/database/issuer arguments.
assert.equal(process.argv.length, 2, 'Alternative config arguments are forbidden.');
const config = JSON.parse(readFileSync(new URL('../../wrangler.mobile-test.jsonc', import.meta.url), 'utf8'));
assert.deepEqual(Object.keys(config).sort(), ['$schema', 'name', 'main', 'account_id', 'compatibility_date', 'compatibility_flags', 'workers_dev', 'vars', 'd1_databases', 'services', 'durable_objects', 'migrations', 'observability'].sort());
assert.deepEqual(Object.keys(config.vars).sort(), ['TEST_ENVIRONMENT', 'TEST_API_ORIGIN', 'TEST_ISSUER', 'PRODUCTION_ISSUER', 'TEST_WEBVIEW_ORIGIN'].sort());
assert.equal(config.name, 'debtfree-mobile-test');
assert.equal(config.main, 'worker/mobile-test.ts');
assert.equal(config.account_id, '005a72abf0c701cfc067867e4f3ba034');
assert.equal(config.vars.TEST_ENVIRONMENT, 'debtfree-mobile-test');
assert.equal(config.vars.TEST_API_ORIGIN, 'https://debtfree-mobile-test.ensong0608.workers.dev');
assert.equal(config.vars.TEST_ISSUER, 'https://otggeztwtaklsqwtztgz.supabase.co/auth/v1');
assert.equal(config.vars.PRODUCTION_ISSUER, 'https://acpderotiyoecmwwyfsu.supabase.co/auth/v1');
assert.equal(config.vars.TEST_WEBVIEW_ORIGIN, 'https://localhost');
assert.deepEqual(config.d1_databases, [{ binding: 'DB', database_name: 'debtfree-mobile-test', database_id: 'df2bf22b-d8af-4a16-9d74-cc1211d39a3d', migrations_dir: 'drizzle' }]);
assert.deepEqual(config.services, [{ binding: 'SESSION_AUTHORITY', service: 'debtfree-mobile-session-authority-test' }]);
assert.deepEqual(config.durable_objects, { bindings: [{ name: 'HOUSEHOLD_REVISIONS_TEST', class_name: 'HouseholdNotifications' }] });
assert.deepEqual(config.migrations, [{ tag: 'mobile-test-v1', new_sqlite_classes: ['HouseholdNotifications'] }]);
assert.equal(config.env, undefined);
assert.equal(config.routes, undefined);
assert.equal(config.assets, undefined);
for (const [name, value] of Object.entries(config)) {
  if (name === 'vars') continue;
  assert.ok(!JSON.stringify(value).includes('3f2dd9d5-77de-4945-8e13-f6c1af454de1'), 'Production D1 is forbidden.');
}
console.log('PASS: exact isolated test Worker, D1, issuer and authority bindings. WebView origin still requires runtime proof.');
