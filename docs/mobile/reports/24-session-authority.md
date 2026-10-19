# Agent report: Private test session authority

Date/time zone: October 18, 2026 / America/Los_Angeles
Status: local implementation and focused proof complete; deployment, SQL permission/runtime and live upstream proof pending
Owned files created: `supabase/functions/mobile-session-authority/index.ts`, focused helper `core.ts`, `supabase/mobile-test/session-authority.sql`, `worker/session-authority-proxy.ts`, `tests/session-authority.test.mjs`, and this report. No existing auth/test Worker/notification/accounting/config/package files edited.

## Result and exact integration interface

Prepared a pinned Deno Edge entry, private SQL function/restricted login, and Cloudflare service-binding proxy. No service-role/admin connection fallback exists. Existing `worker/mobile-test.ts` can retain its `SESSION_AUTHORITY` interface: service-binding POST `/check` or `/revoke` at `https://session-authority.internal`, user bearer in Authorization header, no request body. Proxy adds the server-only opaque key and forwards to the fixed test project Edge URL. Successful JSON matches existing LivenessResult; inactive check returns200 with active=false, which existing native-auth denies. Revoke succeeds only after official test GoTrue local logout and a fresh same-session DB result with active=false.

This supplies code for the authority gap; it is not an assertion that the gap is deployed or live-proven. Test backend must remain closed if binding/SQL/credentials/policy are unavailable. Nothing touches forbidden production `acpderotiyoecmwwyfsu`.

### Manager-owned deployment/configuration

| Destination | Exact required input |
|---|---|
| Test Supabase project | `otggeztwtaklsqwtztgz` only |
| Edge function name/entry | `mobile-session-authority` / `supabase/functions/mobile-session-authority/index.ts` |
| Edge request endpoint base | `https://otggeztwtaklsqwtztgz.supabase.co/functions/v1/mobile-session-authority` |
| Edge public config | `MOBILE_TEST_PROJECT_REF=otggeztwtaklsqwtztgz`; `MOBILE_TEST_ISSUER=https://otggeztwtaklsqwtztgz.supabase.co/auth/v1` |
| Edge publishable key | `MOBILE_TEST_PUBLISHABLE_KEY` = test `sb_publishable_…` key, used solely as GoTrue gateway apikey, not database authority |
| Edge restricted connection secret | `MOBILE_AUTHORITY_DATABASE_URL`, custom login only; never platform default/admin env |
| Edge optional database CA | `MOBILE_AUTHORITY_DATABASE_CA` = official test database root PEM if default trust does not validate certificate; never disable verification |
| Shared opaque secret | `MOBILE_AUTHORITY_SERVER_KEY`, manager generates 256-bit base64url (43–128 allowed characters), same value stored separately in Edge/proxy secret stores; no value in source/chat/report |
| Proposed private proxy Worker | `debtfree-mobile-session-authority-test`; entry `worker/session-authority-proxy.ts`; `workers_dev=false`, no public routes/custom domain |
| Proxy vars | `TEST_ENVIRONMENT=debtfree-mobile-test`, `TEST_SUPABASE_REF=otggeztwtaklsqwtztgz`, `TEST_ISSUER` exact above, `AUTHORITY_EDGE_URL` exact Edge base above |
| Existing mobile-test Worker binding | `SESSION_AUTHORITY` -> private proxy Worker service; do not bind directly to public Supabase endpoint |

Manager must configure Edge gateway JWT verification OFF for this function, since the handler performs independent ES256/RS256 verification plus opaque server-key authentication; this is not disabling handler authentication. Deploy with explicit test project ref and review exact deployment flags/config through current CLI help (no CLI/deployment performed here). Do not change Google, signup or production settings. Edge is HTTPS reachable but server-key protected and rejects Origin/cookies/CORS; proxy is service-binding-only and additionally requires the existing internal request origin.

Minimal shared integration change to report, not applied here: root Node tsconfig should exclude only `supabase/functions/mobile-session-authority/index.ts` (Deno `npm:` entry). Its exact static npm imports intentionally require Deno resolution rather than Node's root resolver. `core.ts` and proxy remain in ordinary Node TS checking. Manager should add/run a separate `deno check supabase/functions/mobile-session-authority/index.ts` using approved tooling; Deno is not installed/available in this worker session, so runtime-entry type/bundle readiness is NOT claimed. Static imports ensure deploy bundlers can discover packages; no computed import or ambient npm-resolution shim hides missing Deno proof.

## SQL authority and permissions

Script is first-install-only and transaction-wrapped. Before running, manager independently verifies the exact test connection/project, then sets session GUC `mobile_test.project_ref='otggeztwtaklsqwtztgz'`. This explicit guard prevents accidental execution but is not cryptographic project attestation. Existing role names abort rather than silently mutate unknown privilege state. No password appears: login initially has PASSWORD NULL and cannot authenticate until manager securely provisions one. Do not put password SQL in repository or command history/logs.

- Non-login owner: `mobile_session_authority_owner`, no superuser/createdb/createrole/replication/BYPASSRLS. Only auth schema usage and SELECT on the exact referenced columns of sessions/users/identities; no raw tokens, passwords or user_metadata.
- Login: `mobile_session_authority_login`, NOINHERIT and connection limit4, no role membership grant. Usage on the one private schema and EXECUTE on `mobile_session_authority.check_session(uuid,uuid)`; no direct Auth or private-policy table reads/writes. Empty search_path,2s statement timeout,3s idle-transaction timeout.
- Function uses SECURITY DEFINER because the network login must not read the tables. Fixed empty search_path, fully qualified relations, bound UUID tuple and explicit session_user equality guard. It is owned by the narrow non-login role. PUBLIC/anon/authenticated/service_role schema/function rights are explicitly revoked; never expose this schema as Data API RPC. Function owner lacks BYPASSRLS: actual test Auth RLS/column permissions must work, or fail closed; never fix failure by using broad admin credentials.
- Private `session_policy` holds only session UUID/user UUID/last authority activity/expired flag, with session foreign key cascading deletion. This is authentication policy state, not a financial table. Owner can mutate that table through the function; network login cannot. The function reads no financial tables and modifies no Auth rows.

Restricted URL validator accepts only test direct `db.otggeztwtaklsqwtztgz.supabase.co` with username `mobile_session_authority_login`, or an official `*.pooler.supabase.com` host with username `mobile_session_authority_login.otggeztwtaklsqwtztgz`; database `/postgres`. It rejects postgres/service_role, other refs, arbitrary host/options and insecure sslmode. Real custom-role Supavisor support/session_user mapping must be tested; if unavailable use the supported test direct endpoint, never broad-role fallback. Code forces TLS verify-full (or explicit CA with rejectUnauthorized=true). Upstream postgres.js `ssl:'require'` disables certificate verification, so that mode is deliberately NOT used as driver configuration.

### Application policy, scope and limitations

30-minute inactivity and12-hour absolute lifetime are provisional application policy, not paid GoTrue timeout entitlements. Activity is an authenticated authority check, including live-channel membership/liveness rechecks. Thus an open authorized channel can keep inactivity alive; mobile background integration should close channels if background time must count as idle. This is not a claim to measure physical user interaction.

Initial enrollment requires a session created within30min. Serialized policy row checks make expiration sticky: refreshing upstream cannot revive an overdue private policy record. Banned/deleted/unconfirmed/non-Google/ineligible sessions fail closed; a policy record denied after ban/timeout stays expired and requires a new provider sign-in/session. Absolute lifetime uses session created_at plus12h, capped by not_after. Fresh authorization updates only private last_seen; no positive response cache.

**Legacy refresh sessions are denied:** function requires non-null/nonnegative `auth.sessions.refresh_token_counter`. Current upstream V1 reuse can revoke refresh-token rows while leaving session rows present, invisible to the requested three-table check; V2 reuse termination removes session. No refresh-token/HMAC value is read. Manager must prove deployed test GoTrue version, V2 session behavior and rotation/reuse settings before enabling financial access. If test project still creates legacy sessions, this authority intentionally returns inactive; do not remove the gate to make login pass. An explicitly reviewed narrow extension or upstream policy change would then be needed. No immediate detection is claimed for provider-side events that do not terminate a session or ban/delete the Supabase identity (for example unrelated Google account state).

Requests already authorized before revocation can be in flight; this is not an atomic transaction with D1. Existing server membership checks and current-role enforcement remain necessary on every operation/channel.

## Limits and secret-safe behavior

Only POST check/revoke and exact function route forms; no bodies/caller tuple accepted. Subject/session derived from independently verified configured issuer/audience/signature/expiry/issued-at JWT. Opaque key is hash-compared, bearer limited8192 characters. Four operations per Edge isolate,2 pooled DB connections, prepare=false for transaction pooling,2s SQL timeout,3s connect timeout,2.5s JWKS/logout fetch timeout,4.5s handler deadline. Timed-out operations retain occupied concurrency slots until underlying work settles; no unbounded pending queue. DB login connection limit4 is an additional global guard, not a capacity guarantee.

Proxy pins exact HTTPS test ref/base, no arbitrary URL/redirect/browser/cookie/body forwarding;4800ms fetch timeout,4096-byte response limit, explicit LivenessResult field allowlist, no upstream errors/debug headers/content exposed. No logs in handler/proxy; Postgres notices suppressed. SQL/DB role/admin env never appear in errors or response. Real TLS/pooler and cross-isolate load/time budgets require manager acceptance.

## Verification actually performed

- `node --test tests/session-authority.test.mjs`: **11 passed**. Actual locally generated signed ES256 JWT verification, wrong issuer/audience/signature/expiry/UUID denial before DB; synthetic DB/logout held-token inactive proof; disabled/missing/Google/deadline/outage handling; unconfirmed logout denial; concurrency and actual4.5s deadline; restricted-role URL rejection; pinned proxy destination/header/redirect/response bounds and secret-safe errors; static SQL privilege/policy/import assertions.
- `npx eslint supabase/functions/mobile-session-authority/*.ts worker/session-authority-proxy.ts tests/session-authority.test.mjs`: passed.
- Strict scoped `tsc --noEmit` on core.ts and proxy: passed. Deno runtime entry excluded from this scoped command explicitly, not presented as checked.
- Current official docs/changelog and upstream source/registry metadata inspected read-only; no packages installed, source/config beyond owned paths edited, real database/financial/Auth data queried or credentials accessed. Deno/psql were not found. SQL has NOT been executed/parsed by a real PostgreSQL server; static permission assertions are not permission proof. No remote SQL, provider mutation, deploy, APK/device/ADB, integration suites, commit/push, agent, peer polling or completion message.

## Manager's required real permission and held-token proof

1. Verify exact test ref/connection and deployed Auth schema/version/columns. Run script only after explicit test guard; missing counter column/role privileges/RLS must stop rather than degrade. Securely provision login password/URL, TLS CA and opaque key through official stores.
2. Connect as the restricted login and check current_user AND session_user equal `mobile_session_authority_login`. Calling the function through `SET ROLE` from an admin session will intentionally fail its session_user guard; use the actual login.
3. Verify login has schema USAGE and function EXECUTE, no schema CREATE, no owner membership, no superuser/BYPASSRLS, and no SELECT column/table privileges on Auth/private policy. Test direct reads/writes with permission-only queries (e.g. LIMIT0) and confirm denied. Audit privileges inherited via PUBLIC and unrelated public definer functions; NOINHERIT does not remove PUBLIC rights. If any broad access exists, stop and resolve narrowly in test.
4. Verify anon/authenticated/service_role cannot execute the private function or reach it as RPC. Login should call it with nonexistent synthetic UUIDs and receive inactive/status-only; owner/privilege failures must not be repaired with service_role fallback.
5. Deno-check and deploy Edge/proxy to test only; configure the tabled env/bindings. Wrong opaque key/browser/body/wrong issuer should deny. Confirm proxy is not publicly routed and no request headers/SQL details are logged.
6. With an explicitly approved synthetic Google identity, establish fresh V2 session and successful check. Hold an unexpired access token securely, perform official local logout through revoke, prove DB absence/inactive and next protected Worker request denial. Repeat external logout, ban/delete/unconfirmed/identity unlink, configured V2 refresh-reuse termination, private inactivity/absolute timeout and outage. For timers, use controlled synthetic policy timestamps under a reviewed test procedure; never change production session rows or log tokens/identities. Confirm an overdue private policy cannot be revived by refresh. These live steps remain unexecuted.

## Sources inspected October18

- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions), [sign-out](https://supabase.com/docs/guides/auth/signout), [Edge database connections](https://supabase.com/docs/guides/functions/connect-to-postgres), [Edge authentication](https://supabase.com/docs/guides/functions/auth), [function security](https://supabase.com/docs/guides/database/functions). Changelog scanned; TLS notice remains relevant, with no TLS downgrade adopted.
- Auth source inspected at `ce9a8eee0cc042be8c7a42981a7ddae631e41d91`: [sessions](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/models/sessions.go), [logout](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/api/logout.go), [user ban/deletion fields](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/models/user.go), [provider identity verification](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/models/identity.go), [V1/V2 refresh termination](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/tokens/service.go). Reviewed migrations for sessions/refreshed_at/counter. Repository source is not proof of the hosted project's deployed revision.
- Runtime pins: [jose6.2.8](https://www.npmjs.com/package/jose/v/6.2.8), MIT, matching current installed root version used by local JWT tests; [postgres3.4.7](https://github.com/porsager/postgres/tree/v3.4.7), Unlicense. Pins are static Deno imports; root dependency/lock unchanged. Postgres [TLS source](https://github.com/porsager/postgres/blob/v3.4.7/src/connection.js) inspected for certificate semantics. Manager must bundle/check these exact runtime imports before deployment.

Next current task is manager's Deno/SQL permission/deployment/held-token proof with these exact interfaces, followed by already-scoped vault/draft/provider/connected APK integration. This worker saves its handoff here only; owner provides the manager heads-up.
