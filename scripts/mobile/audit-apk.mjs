import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';

const root = resolve(import.meta.dirname, '../..');
const connected = process.argv.slice(2).length === 1 && process.argv[2] === '--connected-test';
assert(process.argv.length === 2 || connected, 'Unknown APK audit mode');
const webDir = connected ? 'mobile/connected-dist' : 'mobile/dist';
const expectedAppId = connected ? 'com.debtfree.dashboard.connectedtest' : 'com.debtfree.dashboard.dev';
const apkPath = resolve(root, 'mobile/android/app/build/outputs/apk/debug/app-debug.apk');
const bytes = readFileSync(apkPath);
const entries = unzipSync(bytes);
const digest = data => createHash('sha256').update(data).digest('hex');
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
const webRoot = resolve(root, webDir);
const webFiles = walk(webRoot);
for (const file of webFiles) {
  const name = `assets/public/${relative(webRoot, file).replaceAll('\\', '/')}`;
  assert(entries[name], `Missing bundle entry: ${name}`);
  assert.equal(digest(entries[name]), digest(readFileSync(file)), `Changed bundle entry: ${name}`);
}
const config = JSON.parse(new TextDecoder().decode(entries['assets/capacitor.config.json']));
assert.equal(config.appId, expectedAppId);
assert.equal(config.appName, connected ? 'DebtFree Connected Test' : 'DebtFree Dev');
assert.equal(config.webDir, webDir);
assert.equal(config.server?.url, undefined);
assert.equal(config.server?.allowNavigation, undefined);
const plugins = JSON.parse(new TextDecoder().decode(entries['assets/capacitor.plugins.json']));
if (connected) {
  assert.deepEqual(plugins.map(plugin => [plugin.pkg, plugin.classpath]).sort(), [
    ['@capacitor/app', 'com.capacitorjs.plugins.app.AppPlugin'],
    ['@capacitor/browser', 'com.capacitorjs.plugins.browser.BrowserPlugin'],
  ].sort());
  assert.deepEqual(config.includePlugins, ['@capacitor/app', '@capacitor/browser']);
  const marker = JSON.parse(new TextDecoder().decode(entries['assets/public/mobile-build.json']));
  assert.deepEqual(marker, { mode: 'connected-test', appId: expectedAppId });
  const inventory = JSON.parse(new TextDecoder().decode(entries['assets/public/module-inventory.json']));
  assert(Array.isArray(inventory) && inventory.some(id => id.endsWith('/native/runtime.ts')), 'Missing connected runtime');
  assert(!inventory.some(id => /demo-(?:fixture|repository)\.|\/app\/(?:api\/|auth\.|auth-config\.|cloudflare-auth\.)|\/node_modules\/(?:next|vinext|wrangler|@cloudflare|@supabase)\//.test(id)), 'Unexpected module in connected APK');
  const bundledCode = Object.entries(entries).filter(([name]) => /^assets\/public\/.*\.(?:js|html|json)$/.test(name)).map(([, data]) => new TextDecoder().decode(data)).join('\n');
  assert(bundledCode.includes('https://otggeztwtaklsqwtztgz.supabase.co'), 'Wrong test identity endpoint');
  assert(bundledCode.includes('https://debtfree-mobile-test.ensong0608.workers.dev'), 'Wrong shared API endpoint');
  assert.doesNotMatch(bundledCode, /sb_secret_[A-Za-z0-9_-]+|MOBILE_AUTHORITY_DATABASE_URL|MOBILE_AUTHORITY_SERVER_KEY|SUPABASE_SERVICE_ROLE_KEY|postgres(?:ql)?:\/\//, 'Server credential material in APK');
} else {
  assert.deepEqual(plugins, []);
}
const expectedWeb = new Set(webFiles.map(file => `assets/public/${relative(webRoot, file).replaceAll('\\', '/')}`));
const extraWeb = Object.keys(entries).filter(name => name.startsWith('assets/public/') && !name.endsWith('/') && !expectedWeb.has(name));
assert(extraWeb.every(name => ['assets/public/cordova.js', 'assets/public/cordova_plugins.js'].includes(name)), 'Unexpected extra bundled web file');
const forbidden = Object.keys(entries).filter(name => /(?:^|\/)(?:\.env[^/]*|\.wrangler|local\.properties|google-services\.json|[^/]*\.(?:jks|keystore|sqlite)|debtfree-household-backup[^/]*)$/i.test(name));
assert.deepEqual(forbidden, [], 'Private source/config file packaged');
const result = { apkPath, bytes: statSync(apkPath).size, sha256: digest(bytes), matchedWebFiles: webFiles.length, extraBridgeFiles: extraWeb, appId: config.appId, plugins: plugins.length, serverUrlConfigured: Boolean(config.server?.url), forbiddenFileEntries: forbidden.length, totalZipEntries: Object.keys(entries).length };
writeFileSync(resolve(root, connected ? '.wrangler/mobile-connected-apk-audit.json' : '.wrangler/mobile-round4-apk-audit.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
