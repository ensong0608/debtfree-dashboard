import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes, pbkdf2Sync, createHmac, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

// First-install only. Execute after owner-approved checks and isolated setup.
// Credentials arrive on stdin, stay in process memory, and go only to the
// official Supabase API and the two explicitly named Cloudflare secret stores.
const root = resolve(import.meta.dirname, '../..');
const ref = 'otggeztwtaklsqwtztgz', account = '005a72abf0c701cfc067867e4f3ba034';
let stage = 'local configuration';
const fail = () => { throw new Error('Setup stopped'); };
const read = path => readFileSync(resolve(root, path), 'utf8');
const config = path => JSON.parse(read(path));
const proxy = config('wrangler.mobile-authority.jsonc'), api = config('wrangler.mobile-test.jsonc');
const provision = config('.wrangler/private/mobile-test/provisioning.json');
const publicKey = read('.wrangler/private/mobile-test/publishable-key.txt').trim();
const emails = [provision.ownerEmail, provision.secondTesterEmail].map(value => typeof value === 'string' ? value.trim().toLowerCase() : '');
if (provision.supabaseProjectRef !== ref || proxy.account_id !== account || api.account_id !== account
 || proxy.name !== 'debtfree-mobile-session-authority-test' || api.name !== 'debtfree-mobile-test'
 || proxy.vars.TEST_SUPABASE_REF !== ref || api.vars.TEST_ISSUER !== 'https://' + ref + '.supabase.co/auth/v1'
 || api.d1_databases?.length !== 1 || api.d1_databases[0].database_id !== 'df2bf22b-d8af-4a16-9d74-cc1211d39a3d'
 || !/^sb_publishable_[A-Za-z0-9_-]{16,512}$/.test(publicKey)
 || emails.length !== 2 || emails[0] === emails[1] || emails.some(value => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) fail();
let input = '';
for await (const chunk of process.stdin) { input += chunk; if (input.length > 8192) fail(); }
let token = input.trim(); input = '';
if (!token || /\s/.test(token)) fail();
async function management(path, method = 'GET', body) {
 const response = await fetch('https://api.supabase.com/v1/projects/' + ref + path, { method,
  headers: { authorization: 'Bearer ' + token, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'error', signal: AbortSignal.timeout(30000) });
 if (!response.ok) { await response.body?.cancel(); fail(); }
 const text = await response.text(); return text ? JSON.parse(text) : null;
}
function runWrangler(args, input = '') {
 return new Promise((resolvePromise, reject) => {
  const child = spawn(process.execPath, [resolve(root, 'node_modules/wrangler/bin/wrangler.js'), ...args],
   { cwd: root, windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_SANITIZE: 'true', WRANGLER_LOG: 'error' } });
  const timer = setTimeout(() => { child.kill(); reject(new Error('Cloudflare operation timed out')); }, 90000);
  child.once('error', error => { clearTimeout(timer); reject(error); });
  child.stdin.on('error', error => { clearTimeout(timer); reject(error); });
  child.once('exit', code => { clearTimeout(timer); if (code === 0) resolvePromise(); else reject(new Error('Cloudflare operation failed')); });
  child.stdin.end(input);
 });
}
function wrangler(configPath, secrets) {
 return runWrangler(['secret', 'bulk', '--config', configPath], JSON.stringify(secrets));
}
function scram(password) {
 const salt = randomBytes(16), rounds = 4096;
 const salted = pbkdf2Sync(password, salt, rounds, 32, 'sha256');
 const client = createHmac('sha256', salted).update('Client Key').digest();
 const stored = createHash('sha256').update(client).digest('base64');
 const server = createHmac('sha256', salted).update('Server Key').digest('base64');
 salted.fill(0); client.fill(0);
 return 'SCRAM-SHA-256$' + rounds + ':' + salt.toString('base64') + '$' + stored + ':' + server;
}
try {
 stage = 'test project identity';
 const project = await management('');
 if (project.id !== ref || project.name !== 'debtfree-mobile-test' || project.status !== 'ACTIVE_HEALTHY') fail();
 stage = 'restricted session authority readiness';
 const ready = await management('/database/query', 'POST', { read_only: true, query: [
  "SELECT (EXISTS (SELECT FROM pg_roles WHERE rolname='mobile_session_authority_owner' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolbypassrls)",
  "AND EXISTS (SELECT FROM pg_roles WHERE rolname='mobile_session_authority_login' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolbypassrls)",
  "AND NOT pg_has_role('mobile_session_authority_login','mobile_session_authority_owner','MEMBER')",
  "AND EXISTS (SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='mobile_session_authority' AND p.proname='check_session' AND p.prosecdef AND r.rolname='mobile_session_authority_owner')",
  "AND has_function_privilege('mobile_session_authority_login','mobile_session_authority.check_session(uuid,uuid)','EXECUTE')",
  "AND NOT has_any_column_privilege('mobile_session_authority_login','auth.sessions','SELECT')",
  "AND NOT has_any_column_privilege('mobile_session_authority_login','auth.users','SELECT')",
  "AND NOT has_any_column_privilege('mobile_session_authority_login','auth.identities','SELECT')) AS ready"
 ].join(' ') });
 if (!Array.isArray(ready) || ready.length !== 1 || ready[0].ready !== true) fail();
 stage = 'test pooler configuration';
 const pools = await management('/config/database/pooler');
 const pool = Array.isArray(pools) && pools.find(value => value.database_type === 'PRIMARY' && value.db_name === 'postgres'
  && /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(value.db_host) && [5432, 6543].includes(value.db_port)
  && value.db_user === 'postgres.' + ref);
 if (!pool) fail();
 stage = 'Cloudflare test-database access';
 await runWrangler(['d1', 'execute', 'debtfree-mobile-test', '--remote', '--config', 'wrangler.mobile-test.jsonc', '--command', 'SELECT 1 AS ready', '--json']);
 const password = randomBytes(32).toString('base64url'), serverKey = randomBytes(32).toString('base64url');
 const notificationKey = randomBytes(32).toString('base64url');
 const db = new URL('postgresql://' + pool.db_host + ':' + pool.db_port + '/postgres');
 db.username = 'mobile_session_authority_login.' + ref; db.password = password;
 stage = 'Supabase test secret storage';
 await management('/secrets', 'POST', Object.entries({ MOBILE_TEST_PROJECT_REF: ref,
  MOBILE_TEST_ISSUER: 'https://' + ref + '.supabase.co/auth/v1', MOBILE_TEST_PUBLISHABLE_KEY: publicKey,
  MOBILE_AUTHORITY_DATABASE_URL: db.toString(), MOBILE_AUTHORITY_SERVER_KEY: serverKey
 }).map(([name, value]) => ({ name, value })));
 stage = 'private Cloudflare test authority secret storage';
 await wrangler('wrangler.mobile-authority.jsonc', { MOBILE_AUTHORITY_SERVER_KEY: serverKey });
 stage = 'Cloudflare test household secret storage';
 await wrangler('wrangler.mobile-test.jsonc', { NOTIFICATION_INTERNAL_KEY: notificationKey, TESTER_EMAILS: JSON.stringify(emails) });
 stage = 'restricted login activation';
 const activation = "BEGIN; DO $guard$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='mobile_session_authority_login' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolbypassrls) THEN RAISE EXCEPTION 'Disabled restricted login required'; END IF; END $guard$; ALTER ROLE mobile_session_authority_login LOGIN PASSWORD '" + scram(password) + "'; COMMIT;";
 await management('/database/query', 'POST', { query: activation });
 console.log('Isolated credentials configured. Runtime deployment and verification are still required.');
} catch {
 // Never print API error bodies, database queries, credentials or tester identities.
 console.error('Isolated setup stopped during ' + stage + '. Inspect that stage before retrying; the disabled-login readiness guard prevents changes to an active authority.');
 process.exitCode = 1;
} finally { token = ''; }
