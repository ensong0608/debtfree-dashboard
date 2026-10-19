# Separate connected test environment — setup runbook

October 17, 2026 / America/Los_Angeles. Local client adapters AND isolated backend/channel implemented. The owner expanded working connected development into CURRENT scope; manager handles provisioning/native integration. This worker has not created resources, used real credentials or built a connected APK. Existing DebtApp is production-associated and must remain untouched. Never tunnel/expose localhost:8787 or copy its household into test fixtures.

Manager-supplied provisioning update (not independently queried by this worker): separate `debtfree-mobile-test` is ACTIVE_HEALTHY in ensong/us-west-1 with public ref `otggeztwtaklsqwtztgz`. Forbidden production ref is `acpderotiyoecmwwyfsu`. Thus the test issuer is `https://otggeztwtaklsqwtztgz.supabase.co/auth/v1` and Google's test callback is `https://otggeztwtaklsqwtztgz.supabase.co/auth/v1/callback`. Manager owns Worker/D1/Google configuration. App ID is `com.debtfree.dashboard.connectedtest`; final callback scheme was clarified to **`com.debtfree.connectedtest://auth/callback`**, superseding the earlier dashboard-qualified callback proposal throughout this document.

Further manager-supplied provisioning evidence: Cloudflare account `005a72abf0c701cfc067867e4f3ba034`; new D1 name `debtfree-mobile-test`, ID `df2bf22b-d8af-4a16-9d74-cc1211d39a3d`, empty with no schema applied. Separate Google Cloud project `debtfree-mobile-test` (DebtFree Mobile Test) has OAuth app prepared in Testing mode, awaiting the owner's Google User Data Policy agreement. No Worker is deployed yet. These public resource identifiers are wiring evidence only; this worker did not access the account/database/provider or verify deployment.

Manager wiring checklist for `wrangler.mobile-test.jsonc` (this worker does not edit it):

| Configuration slot | Required value / source |
|---|---|
| `name` / entry | `debtfree-mobile-test` / `worker/mobile-test.ts` |
| `account_id` | `005a72abf0c701cfc067867e4f3ba034`, as verified by manager |
| `d1_databases[].binding` | `DB` |
| Test D1 database name / ID | `debtfree-mobile-test` / `df2bf22b-d8af-4a16-9d74-cc1211d39a3d` |
| `durable_objects.bindings[].name` / class | `HOUSEHOLD_REVISIONS_TEST` / `HouseholdNotifications` |
| DO class migration | Manager chooses a new test-only migration tag for class `HouseholdNotifications`; no production migration |
| Private service binding | `SESSION_AUTHORITY` -> separately reviewed private liveness service, not yet supplied |
| `vars.TEST_ENVIRONMENT` | `debtfree-mobile-test` |
| `vars.TEST_API_ORIGIN` | Exact allocated HTTPS test Worker origin, no trailing slash; still supplied by manager |
| `vars.TEST_ISSUER` | `https://otggeztwtaklsqwtztgz.supabase.co/auth/v1` |
| `vars.PRODUCTION_ISSUER` (deny metadata) | `https://acpderotiyoecmwwyfsu.supabase.co/auth/v1` |
| `vars.TEST_WEBVIEW_ORIGIN` | Exact connected WebView origin after packaging verification; no wildcard (typically `https://localhost`, not assumed proven) |
| Worker secret | `NOTIFICATION_INTERNAL_KEY`, generated/provisioned securely by manager; same environment feeds the DO |

The existing app D1 schema must be applied only to the new empty test database before synthetic membership/bootstrap can work. Manager owns that operation and verifies the bound ID before it; no production data copy is required. Keep schema/seed/deployment unverified until actually executed. Liveness service binding is mandatory: a Worker with DB configured but no authority returns503 before D1 reads, as the local deployment-entry test demonstrates.

October 18 provider update, supplied by manager: owner created the separate Google test OAuth client and entered its secret directly into test Supabase. Manager verified Google enabled, Skip nonce checks OFF, missing-email bypass OFF, anonymous sign-in OFF; Google project remains Testing with exactly two approved private tester accounts persisted after reload. No identities or secret values are recorded here. Test Supabase has exact redirect `com.debtfree.connectedtest://auth/callback`, no wildcard; default Site URL remains `http://localhost:3000`. This supersedes the earlier pending-policy/setup status, but not the callback proof gate: the adapters require an independent correlation query, and exact allowlist/query preservation must be proven with the real provider. Explicit redirectTo must be used; do not fall back to Site URL, widen redirects or skip nonce checks to make a failed flow pass. No real native PKCE/cold/warm callback, Worker deployment, liveness service, vault or durable editing acceptance is established by provider configuration alone.

Implemented backend entry `worker/mobile-test.ts` exports default fetch handler and **`HouseholdNotifications`** Durable Object class. Required environment: `TEST_ENVIRONMENT=debtfree-mobile-test`, exact `TEST_API_ORIGIN`, `TEST_ISSUER`, `PRODUCTION_ISSUER`, test `DB`, private `SESSION_AUTHORITY` service binding, `HOUSEHOLD_REVISIONS_TEST` namespace binding and secret `NOTIFICATION_INTERNAL_KEY`; `TEST_WEBVIEW_ORIGIN` enables one exact CORS origin. Manager alone writes Wrangler IDs/bindings/secrets. No production DB identity can be inferred from D1's runtime object: manager must verify its actual binding ID before deployment.

Private authority contract: service-binding POST `/check` and `/revoke` carry Authorization only in headers, with a 5-second request timeout. `/check` returns `{active,subject,sessionId,confirmedEmail,googleIdentity,userEnabled,policyVersion:'native-test-v1',checkedAt,inactiveAt,absoluteExpiresAt}`; timestamps are milliseconds, inactiveAt is the server-enforced inactivity DEADLINE. Check must derive identity/session from verified token, enforce Google-confirmed/active user and timeout/reuse/disable policy, and be fresh within 5 seconds. Logout requires `/revoke` then a fresh inactive check of the same subject/session. This is a coded fail-closed integration contract, not a provisioned or permission-verified liveness implementation.

Routes now implemented: GET session, GET/PUT household, POST logout, POST notifications/ticket, GET notifications/socket/<householdId>. Members/export/lifecycle wrappers are still unimplemented inventory items and return 404; never bypass to existing web routes. Financial PUT delegates to existing `createHouseholdApi` without copying mutation logic. Ticket route uses verified D1 household, requires private binding key and returns socket URL plus `['debtfree-revisions','debtfree-ticket.<opaque one-use ticket>']`; raw bearer never appears in URL. Client NativeApi allows ticket POST only; all financial mutations remain blocked until durable draft/vault gates pass.

Channel implementation uses **standard resident WebSockets**, not hibernating sockets, so auth tokens/tickets remain memory-only. Namespace class rechecks liveness/member before subscription, each revision send and on 15-second alarms; revoked/outage sessions close before another notification, with idle disconnect bounded by alarm scheduling. Tickets expire after 30 seconds, are scope-bound and consumed before rechecking. A DO restart loses pending tickets and requires reissuance/reconnect. This deliberate resident-socket choice needs manager cost/scale review; hibernation with durable auth is not claimed. A failed notification after a committed write returns `x-debtfree-notification: refetch-required`; revision refetch/resume remains necessary and duplicate identical-write retries can emit duplicate revision metadata safely.

## What can run now

From `C:\Projects\debtfree-dashboard`:

```powershell
node --test tests/native-auth-contract.test.mjs tests/native-test-backend.test.mjs
npx eslint mobile/native/*.ts tests/native-auth-contract.test.mjs
npx tsc --noEmit --strict --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --allowImportingTsExtensions --lib es2022,dom,dom.iterable mobile/native/contracts.ts mobile/native/callback.ts mobile/native/session.ts mobile/native/api.ts
```

These use injected fake OAuth/browser/vault/authority/transport and synthetic identities only. No server or provider is contacted. New files have no import from the existing mobile entry and no side effects on import; the current zero-network entry/config/build boundary is unchanged. API helper permits only verified reads; every mutation is deliberately blocked. No in-memory financial editing is enabled. `NativeSession.snapshot()` exposes state/scope/generation, not credentials. `changed` is an optional state-only UI notification; consumers must clear old UI/repositories when leaving ready. `createNativeApi` exposes `request(path,init)` compatible with injected fetch-shaped calls, but integration is future work.

## 1. Approve the isolated resources and public configuration

Manager first checks account ownership, free/project limits, desired region and cost; owner approves concrete creation/configuration in a later task. Do not upgrade or assume paid entitlements. Proposed names, not allocated IDs:

| Item | Exact proposed setting / relationship |
|---|---|
| Supabase project | `debtfree-mobile-test`, new project/ref; never existing DebtApp |
| Public project URL | `https://<TEST_SUPABASE_REF>.supabase.co` |
| Public issuer | `https://<TEST_SUPABASE_REF>.supabase.co/auth/v1` |
| Public client key | Test project's publishable key only; supplied through separately reviewed connected build config |
| Google development OAuth client | A separate Web application client used by test Supabase's Google provider |
| Google authorized redirect URI | `https://<TEST_SUPABASE_REF>.supabase.co/auth/v1/callback`, exact match to test Supabase provider callback |
| Google audience/test users | Only owner/wife's interactively selected tester accounts; minimal openid/email/profile scopes, no public invitation automation |
| Final app callback | `com.debtfree.connectedtest://auth/callback`, registered only in separate connected package |
| Supabase final redirect allowlist | Exact scheme/host/path above plus reviewed correlation query behavior; no broad arbitrary-host wildcard |
| Worker | `debtfree-mobile-test`, HTTPS origin `https://debtfree-mobile-test.<ACCOUNT_WORKERS_SUBDOMAIN>.workers.dev` |
| Financial database | New D1 `debtfree-mobile-test`; binding `DB` points only to its newly allocated test database ID |
| Notification namespace | Proposed private Durable Object binding `HOUSEHOLD_REVISIONS_TEST`; no public broadcast or financial payloads |
| Android identity | New `com.debtfree.dashboard.connectedtest`, label `DebtFree Connected Test`; retain current `com.debtfree.dashboard.dev` installation/storage untouched |

Public adapter configuration is explicitly `{environment:'test', backendId:'debtfree-mobile-test', apiOrigin:<exact HTTPS origin>, issuer:<test issuer>, productionIssuer:<public production issuer to deny>, callbackBase:<exact callback>}`. Nothing has a default or reads environment/window automatically. Production issuer is deny metadata only, never a fallback; manager supplies it from reviewed public configuration without credentials. Validator requires a `debtfree-mobile-test.` API hostname, canonical origin and distinct HTTPS Supabase issuer; this is a local guard, not proof that someone configured the right cloud account. Manager must compare actual resource IDs/bindings and APK configuration.

Secret placeholders for later secure setup: `TEST_GOOGLE_CLIENT_SECRET` (Supabase provider secret), `TEST_LIVENESS_SERVICE_CREDENTIAL` (Worker-to-private-service auth), and narrowly scoped `TEST_LIVENESS_DATABASE_CREDENTIAL` only if the reviewed service requires database access. These names designate secret destinations, not values or existing files. No Google secret, service-role key, database credential or provider refresh token belongs in public config/APK/source/report/chat. Owner and wife complete Google selection/consent themselves; do not ask for passwords/tokens or send invitations from tools.

## 2. Prove callback and secure credentials before real sign-in adoption

Injected OAuth `prepare` owns provider-supported PKCE generation and independent cryptographic correlation, producing a pending verifier/correlation with <=5-minute expiry. Native handler validates exact callback and consumes pending before exchange; warm/cold handlers must share ONE NativeSession instance. A cold process may use its persisted pending record without trusting cached financial scope. Callback duplicate keys/fragments/extra navigation parameters fail closed.

Current local tests do not prove the provider preserves `correlation` through redirectTo/allowlisting. Keep Supabase's upstream state unchanged. In an authorized test-provider task, capture only redacted success/failure, prove the app query survives and substitutions/replays fail. If the exact correlation flow is unsupported, revise to a reviewed relay/native auth-session adapter; do not remove correlation or broaden redirects. Current strict parser accepts only `code` and `correlation`, so any additional provider parameter requires an explicit contract review. Browser cancel and timeout must call cancelLogin; browser launch alone is not login.

No vault plugin is installed/selected by this task. Implement CredentialVault async native read/write/remove with per-test-issuer namespace and protected credentials/pending records; no localStorage fallback. Prove native-only operation, serialized/atomic session rotation, lock/key invalidation, backup/reinstall behavior and failure cleanup before use. `@aparajita/capacitor-secure-storage` remains a candidate from NATIVE_AUTH_CONTRACT, not a certified choice; iOS/macOS remains untested. If clearing secure storage fails, session stays locked and UI must report local cleanup failure, not offer a normal sign-in switch. A real vault/integration must prevent canceled pending restoration after removal failure/restart; no such persistence guarantee follows from a fake Map vault. Injected provider/authority/vault operations must have bounded timeouts; this local class has no native/browser timer scheduler.

## 3. Implement the authoritative test backend (one backend owner)

`app/native-auth.ts`, `app/native-household.ts` and `worker/mobile-test.ts` now implement native session/logout/household wrappers, reusing existing financial API. For remaining members/export/lifecycle wrappers, manager assigns one owner for extracting domain operations from `app/household-lifecycle.ts` and adapting `app/api/household/store.ts`; no parallel shared edits. Preserve existing cookie web routes, global Origin/CSRF checks, D1 store, schema validation, invitation consent/expiry, allowlists, active membership, current roles and revision compare-and-swap. Native wrappers use bearer-only auth, no cookie fallback, JSON/no-store and narrow test WebView CORS. Never spoof web Origin or let caller scope select a household.

Authority.bootstrap is only an injected contract here. Implement and independently test signature/issuer/audience/expiry/subject/session ID, confirmed Google identity and current D1 membership. Client does not decode JWTs to grant access. Every protected operation must recheck authoritative session liveness and membership; bootstrap is not a lease allowing later authorization bypass.

First backend proof is a narrow private liveness service: authenticate the Worker, derive `(sub,session_id)` from verified token, check session presence and explicit active-user/disabled/deleted policy; return only status, no rows. No client/public auth.sessions access or broad public definer RPC. A service-role key is not narrowly scoped. Demonstrate actual permissible server interface/permissions before adoption; none is provisioned here. Reject on outage and avoid positive caches/lagging revocation replicas. Define test timeout policy explicitly, provisionally 30-minute inactivity and 12-hour absolute application lifetime (manager approval required); enforce timestamps server-side even while Supabase retains rows. Do not assume paid Supabase timeout settings or row presence alone covers timeout/reuse/disable paths.

Proof sequence with synthetic identities A/B: bootstrap A; hold its unexpired token; revoke the upstream session; next household/export request must deny. Repeat app logout, external revocation, deleted/disabled identity, adopted inactivity/absolute expiry and refresh-reuse termination. Prove no old JWT can re-enroll through a broker. Test outage, issuer mismatch, cross-household read/export/write, viewer/removed-member writes and role changes. A broker alone is insufficient for external upstream revocation; JWT/getUser alone also does not meet immediate revocation. Already-authorized D1 operations remain a documented race, not a distributed rollback promise.

## 4. Durable drafts and notification channel, then a separate APK

Assign a storage owner to encrypted native file/database drafts with vault-held key and awaited durable writes; namespace by `(backendId,issuer,subject,householdId)`. Existing synchronous HouseholdSync Storage cannot be replaced by async fire-and-forget writes. Preserve revision and pending recovery across restart, lock drafts across account switches, no offline financial writes. The new foundation blocks all mutations until a later reviewed implementation replaces this gate; there is no feature flag that silently enables edits.

Notification owner adds private per-household revision metadata after accepted D1 commits. Supabase Auth is not D1 realtime. Authorize subscription and reconnect via server-verifiable credentials and recheck liveness/member role while open; reject/close revoked or removed memberships, not only on initial handshake. Use secure handshake/first-frame authorization or reviewed single-use short-lived channel ticket; never raw bearer in logged URLs. No financial payloads in notifications. Missed/duplicate revisions trigger ordinary authorized refetch; pending edits keep conflict/recovery guards. If temporary polling is chosen, label it polling, not push. Measure foreground two-phone latency; background suspension/offline cannot promise continuous delivery.

Manager separately integrates API/session/navigation into all inventory sites in NATIVE_AUTH_CONTRACT: HouseholdSync; members/export direct calls; lifecycle loads/actions; native bootstrap; sign-in/logout/account switch and invitation navigation. Do not import native auth into current zero-network entry. Packaging owner creates separately reviewed connected entry/config/output/native application ID, pins plugins and audits actual APK for exact test issuer/API, no secrets/fallbacks and side-by-side storage isolation. Ticket/channel server routes now exist; native WebSocket opening, reconnect and authorized refetch integration still need current-scope work.

Start with A/B separate synthetic households to prove denial, then explicit invitation/acceptance to one test household; test edits/refetch/conflicts/restart/logout/revocation on both phones before claiming shared sync. No automatic import/merge/upload from either phone or production. Only after acceptance may owner explicitly choose a backup import with a recovery checkpoint; this runbook performs none.

## Official evidence rechecked October 17

- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions): session ID correlation is documented; timeout cleanup is delayed, so row existence alone is not complete policy enforcement.
- [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow) and [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls): provider exchange/callback constraints; local fake parser does not establish interoperability.
- [TLS notice](https://supabase.com/changelog/cbc-tls-ciphers-deprecated): old CBC suites scheduled for removal no earlier than November 10, 2026; retain HTTPS and prove actual runtime compatibility.
- [Cloudflare WebSocket hibernation](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/): candidate notification mechanism, not implemented or capacity/cost-tested here.

Next current-scope integration task: manager wires the implemented test Worker/DO with actual isolated bindings and an authoritative liveness service, proves real held-token revocation and synthetic D1 authorization, then completes approved provider/browser/vault/durable-draft integration and separate connected APK acceptance. Local code is not the full current deliverable: real Google sign-in and two-phone same-household behavior must still pass. No completion message or status polling is authorized.


## October 18 source integration — current command/configuration additions

The connected entry now exists in local source; it is unverified. Follow the latest block in CONNECTED_DELIVERY_STATUS.md rather than older future-tense integration instructions above. Owner requires implementation first and explicit approval before any tests/checks/builds. Do not execute these commands merely because they are documented here.

After approval, `npm.cmd run build:mobile:connected` builds separate `mobile/connected-dist` assets. Supply only the isolated project's publishable client key as process environment `DEBTFREE_MOBILE_TEST_PUBLISHABLE_KEY`; never use a secret/service-role key. `npm.cmd run android:connected` runs the explicit PowerShell web build/native sync/Android build+lint pipeline with `-PconnectedTest=true`. Use the existing documented JDK/SDK process environment. It installs nothing and performs no phone operation. Native generated assets are shared on disk: a later device-only APK requires the normal `npm.cmd run android:sync` first. Gradle's identity guard rejects mixing connected/device-only assets.

The private authority proxy configuration is `wrangler.mobile-authority.jsonc` (no public route or workers.dev). Test API configuration remains `wrangler.mobile-test.jsonc`; production/default deploy scripts are unsuitable. The Edge entry is `supabase/functions/mobile-session-authority/index.ts`; the existing restricted SQL/real permission gates in report24 are still required. Independent handler authentication remains mandatory even though the Edge gateway verify_jwt flag is false.

Additional test-only D1 setup source: `scripts/mobile/enrollment-schema.sql`. Apply only after explicit approval to database debtfree-mobile-test using its explicit test config, never to production or the local private household. Store two already-approved normalized tester emails in the test Worker's `TESTER_EMAILS` secret as a JSON array, owner first. No identities are in this file. The API authenticates Google/session authority before offering enrollment and each tester must accept joining. A successful prior enrollment cannot be reused to recreate removed membership. The new test household starts empty and never auto-imports the installed device-only app's records.

No cloud setup, checks, builds or deployment were executed for these additions. Runtime SQL permissions/TLS, live callback correlation, encrypted native durability and two-phone behavior remain acceptance gates.

## October 18 — deployed test environment; current setup supersedes earlier pending notes

Follow the newest CONNECTED_DELIVERY_STATUS.md checkpoint for actual versions, checks, APK and remaining phone gates. Owner approved isolated setup/deployment and local/cloud checks; do not repeat those approval requests within this delivery.

Authority schema is now installed through the connector. The SQL creates a disabled NOLOGIN runtime role. The secure provisioning command no longer installs schema: it verifies the disabled restricted role/function, checks test D1 access, stores generated credentials in official Supabase/Cloudflare secrets, and enables the login last. It can retry incomplete setup while the role remains disabled; it refuses to alter an already active authority. Tokens/passwords/keys are not command arguments or local secret files. Owner successfully completed this step.

Public client key only: ignored .wrangler/private/mobile-test/publishable-key.txt. Opaque server key and restricted database URL stay in the official secret stores. Supabase management token is owner-held, project-scoped and expires after24 hours; it is not needed in either APK or runtime.

Native correlation now uses #correlation=<independent nonce> on the exact approved callback base. Supabase Auth source ignores fragments while matching allowlists and preserves the fragment when inserting the PKCE code. The app parser accepts exactly one code and exact saved nonce fragment, with expiry/one-time consumption. No redirect wildcard was added. This source/mechanics proof still needs an actual provider-to-Android callback.

Both Workers and Edge function are deployed; test D1 enrollment schema is applied. Do not reapply first-install SQL or rerun secret setup against the active role. Direct Edge calls without the server key deny401; API anonymous/invalid credentials deny401, wrong origin403, native origin preflight204. Actual signed-in database transport and physical two-phone sync are the next gate, not a completed pass.

For phone testing use the separately named DebtFree Connected Test APK from the newest checkpoint. Both approved users explicitly accept the same test household; use dummy records only. Do not upload existing device-only/production records as part of acceptance.
