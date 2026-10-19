# Native authentication contract — connected development

October 17, 2026 / America/Los_Angeles. Status: reviewable design; implementation gates open. This document refines `reports/02-authentication.md`; it does not establish provider, vault, revocation or device readiness.

## Scope and decisions

The independent bundled synthetic demo issues no auth/API requests. This contract applies only to a subsequent connected development build using a separate Supabase issuer, Google provider configuration, Worker API and synthetic D1 households. Never expose/tunnel the current localhost:8787 server or its imported data. No production configuration, public signup, offline financial writes or Apple identity expansion is authorized here. Preserve Google-only verified identity policy, existing accounting and web protections. Original full requirements remain unavailable; reconcile before launch scope.

Required security target: once server revocation completes, a new native request using that session's still-unexpired access token must be denied. A request already authorized before revocation can be in flight; this is not a distributed transaction across Supabase and D1. Do not promise cancellation of committed writes. Provider timeout settings and other revocation causes need explicit semantics below; do not substitute eventual JWT expiry for this target.

## Minimal client boundary

Use three small adapters, owned by a future connected slice. Do not introduce a generic application framework or require demo changes now.

```ts
type VerifiedScope = {
  backendId: string; issuer: string; subject: string;
  identity: string; householdId: string; role: 'owner' | 'admin' | 'viewer';
};
interface NativeSession {
  startGoogleLogin(): Promise<void>;
  bootstrap(): Promise<VerifiedScope | null>;
  accessToken(): Promise<string>; // serialized refresh, never a UI prop
  logout(): Promise<{ serverRevoked: boolean }>;
}
interface NativeApi {
  request(path: string, init?: RequestInit): Promise<Response>;
}
interface NativeNavigation {
  show(route: 'signIn' | 'household' | 'dashboard'): void;
}
```

`request` is bound to a fixed development HTTPS origin and a literal allowlist of relative API paths; reject arbitrary URLs, redirects to another origin and caller Authorization/cookie overrides. It adds the current bearer and expected scope, uses `credentials: 'omit'`, no-store and cancellation/generation control. Return normal Response objects for HouseholdSync's existing injected `request`; no second outbox protocol. Session scope comes from server bootstrap, never a decoded client JWT or cached household selection. Session changes dispose sync and replace all repositories/UI state before accepting new results. No token logs.

Call-site inventory that must be integrated together:

| Existing source | Connected adapter responsibility |
|---|---|
| `app/household-sync.ts:SyncOptions/request` | Inject native API for read, PUT and refresh; preserve revision/conflict handling |
| `app/dashboard-client.tsx` members POST/DELETE, export GET | Route all three direct fetches through native API |
| `app/household-lifecycle-panel.tsx` GET/load/reload and POST | Same API, cancellation and verified scope; native route after accept/create/leave |
| `app/page.tsx`, `app/household/page.tsx` | Native entry performs session/bootstrap instead of importing server pages |
| `app/auth/login/page.tsx`, dashboard expired-session anchor, logout/account-switch forms | Native login/logout actions and navigation; web forms stay supported |
| Lifecycle invitation copy link and `window.location` | Configured development invitation destination; never WebView origin as a public household link |

State transitions: `signedOut -> authorizing -> exchanging -> verifying -> ready`; cancellation/error returns to signedOut. Stored credential restoration starts `verifying`, never ready. Refresh is a single-flight substate; a failed/denied refresh goes to `locked`, hides financial UI and stops writes. Foreground/resume revalidates session and membership before connected use. Logout/account switch enters `closing`, increments generation, cancels/ignores outstanding work, disposes sync, hides data, performs server revocation then local-scope provider sign-out, and clears credentials. Cleanup must run even on server error. Offline logout returns `serverRevoked:false`; do not imply remote invalidation. Switching accounts requires a fresh browser choice and bootstrap, not reuse of old cached identity.

## Browser, PKCE and callback

Required approach: Supabase-mediated Google OAuth with `flowType:'pkce'`, `skipBrowserRedirect:true` and explicit redirect. Google redirects to the separate development Supabase HTTPS callback; Supabase redirects to the application. No embedded dashboard WebView login, provider client secret or service-role key in the bundle. Only public project configuration belongs in the native client. [Supabase Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [Google user-agent restrictions](https://developers.google.com/identity/protocols/oauth2/native-app).

Candidate browser bridge: Capacitor Browser launch + App warm `appUrlOpen` and cold `getLaunchUrl`; install listeners before starting login and deduplicate delivery. Browser open/close is not proof of a completed auth session. Cancel/timeout must invalidate the pending transaction; a later callback is rejected. iOS behavior remains a separate proof. [Browser API](https://capacitorjs.com/docs/apis/browser), [App API](https://capacitorjs.com/docs/apis/app).

Pending transaction contains random correlation nonce, creation/deadline, backend ID, exact callback base and SDK verifier in secure storage. Proposed callback base `com.debtfree.dev://auth/callback` is not a registered app ID. Prefer verified App Links/Universal Links when association is available. Validate scheme/host/path, duplicate parameters, one code, nonce, deadline and pending transaction before exchange. Reject unsolicited/error/token-fragment/arbitrary-next links; never navigate to callback-supplied destinations. Consume once and clear verifier/transaction on terminal outcomes. Serialize callback exchange and refresh.

Correlation gate remains OPEN: upstream OAuth state belongs to Supabase/provider and must not be overridden through queryParams. Current auth-js source forwards `redirectTo` into `redirect_to`, but that alone does not prove nonce query preservation and allowlist matching end-to-end. Proposed app nonce is a redirect query parameter, separate from upstream state; configured allowlist must constrain exact scheme/host/path and accepted query form. Test preservation and rejection of substituted callbacks before adopting it. If unsupported, use a reviewed native auth-session implementation or server transaction callback relay; do not remove correlation checks or broaden arbitrary redirects. Pin tested SDK/plugin versions; moving upstream source is evidence of mechanics only. [auth-js source](https://github.com/supabase/auth-js/blob/master/src/GoTrueClient.ts), [redirect rules](https://supabase.com/docs/guides/auth/redirect-urls).

## Credentials and financial drafts are separate

Candidate `@aparajita/capacitor-secure-storage`: upstream README documents Android Keystore-backed AES-GCM storage and iOS Keychain; web falls back to plaintext localStorage. iOS uninstall may leave keychain items. It is a candidate, not security certification. Disable cloud synchronization and reject web fallback for connected credentials. [Maintainer README](https://github.com/aparajita/capacitor-secure-storage).

Upstream package currently identifies version 8.0.1, MIT license, Capacitor 8+ and Node >=20; this is not an installed/pinned version. API declarations expose async `get`, `set`, `remove`, `setSynchronize(false)`, `setKeyPrefix` and keychain access options. A Supabase custom storage adapter can translate string/null values and await these operations. Persist rotated session as one record, test failures/crash recovery, and avoid parallel SDK instances. Do not assume atomic durability without testing. [Package manifest](https://raw.githubusercontent.com/aparajita/capacitor-secure-storage/main/package.json), [API declarations](https://raw.githubusercontent.com/aparajita/capacitor-secure-storage/main/src/definitions.ts), [Supabase storage support](https://supabase.com/docs/guides/auth/sessions).

Alternative: Ionic Identity Vault advertises iOS/Android session storage with a subscription; no purchase, entitlement or compatibility has been checked. Do not make it a milestone dependency. [Vendor documentation](https://ionic.io/docs/identity-vault).

Selection gate: native proof must cover device lock/key invalidation, backup/restore exclusion, reinstall clearing before credential restoration (especially iOS), no web fallback, corrupt/partial records and logout. Android minimum OS and iOS/toolchain compatibility must be reconciled with the packaging worker; phone model alone proves none of these. No token plugin is approved yet.

Financial snapshots/drafts may exceed small-item vault capabilities. Existing `DataRepository` is async, but HouseholdSync/outbox/recovery directly use synchronous `Storage`; promises cannot satisfy that contract. For the initial connected spike, use an in-memory sync store after verified bootstrap and explicitly show unsaved status; it provides no process-restart draft persistence. Do not claim parity until persistence is implemented. If durable drafts are required before the milestone, gate connected editing on a separate async encrypted-draft integration: encrypted native file/database with vault-held key, awaited flush before any saved acknowledgment, and recovery on the same verified identity. Do not add fire-and-forget persistence behind synchronous `setItem`.

Namespace all snapshots/checkpoints/drafts by encoded tuple `(backendId, issuer, subject, householdId)` with unambiguous serialization. Keep tokens in their session namespace, not a financial repository. On switch/logout lock retained encrypted drafts; only restore after the same verified scope returns and explicit conflict-safe recovery. Never adopt unscoped browser caches or demo data. Memory-only drafts disappear on process death; this limitation needs manager acceptance, not silent data loss. No offline financial writes in either variant.

## API and authoritative revocation gate

Proposed routes: `/api/native/v1/session` (bootstrap), `/logout`, `/household`, `/household/members`, `/household/export`, `/household/lifecycle`. New wrappers authenticate bearer only, reject mixed credentials and malformed inputs, and return JSON errors/no-store. Permit only explicit development WebView origins/methods/headers for web fetch preflight, without credential cookies; CORS never grants authorization. Native HTTP bridge is optional, not a bypass requirement.

Do not alter `proxy.ts` web mutation Origin checks, `/auth/*`, or cookie authentication to admit native origins. Native routes lie outside the current matcher and therefore must supply their own complete guards. Never exempt existing web endpoints merely because Authorization exists. `app/household-lifecycle.ts` currently embeds web Origin checks: extract only authenticated domain operations into a shared service and keep separate web-CSRF/native-bearer wrappers, rather than spoofing Origin or skipping all validation.

Each native route verifies configured issuer/audience/algorithm/signature/expiry/subject/session ID, resolves current confirmed Google identity server-side, checks authoritative liveness, then resolves active D1 membership and role. Retain identity/household headers solely as expected-scope restrictions, bounded bodies, schema checks, owner/viewer rules, invitation acceptance/expiry/allowlist, compare-and-swap revisions and identical-retry behavior. Never authorize from user-editable metadata or caller household/role. Bootstrap can return an authenticated identity with no active household plus allowed lifecycle state; no financial access until membership exists.

| Option | Feasibility and revocation coverage | Decision |
|---|---|---|
| Narrow server liveness service | Worker makes authenticated HTTPS call to a service near Supabase; service privately checks verified `(session_id,sub)` against `auth.sessions`, returns only boolean/status. Covers session-row removal, including provider sign-out; row presence alone does not enforce inactivity/max-lifetime cleanup delays. Service must explicitly enforce adopted timeout policy and disabled/deleted users. | Preferred proof target; not provisioned or validated |
| Application session broker | Random app session, hashed server record and authoritative revocation state; D1/other strongly consistent authority checked per request. App logout/administrative app revoke can deny immediately. Supabase external revocation remains invisible without authoritative upstream check; exchanging an old JWT must not mint a new session after provider logout. | Alternative only with upstream liveness or explicit separately approved change in revocation scope; not sufficient alone |
| JWT/getUser only | Verifies identity/token but does not establish promised immediate session revocation | Rejected for this target |

Supabase documents the `auth.sessions` check, but this review did not establish a ready public Auth introspection endpoint or a safe deployed service for it. Do not invent one or assume listUsers/getUser exposes session liveness. A possible implementation is a server-only service using narrowly scoped database access, or reviewed private function invoked by a privileged server wrapper. No auth tables are exposed to clients. Prefer invoker/read-only permissions; if a definer is demonstrably necessary, private schema, fixed empty search_path/qualified relations, revoked PUBLIC/anon/authenticated execution, minimum owner privileges and explicit caller authorization are mandatory. A service-role key is broad, not a narrowly scoped credential. Never grant arbitrary session queries to a public RPC. Configuration/permission proof requires a later authorized isolated backend task. [Supabase sessions](https://supabase.com/docs/guides/auth/sessions), [function security](https://supabase.com/docs/guides/database/functions).

For target enforcement use no positive liveness caching, fail closed on timeout/unavailable service, and do not read revocation state through lagging replicas. Define operation ordering: liveness before each protected operation; logout acknowledges only after revocation authority confirms it. Deny new requests thereafter; already-authorized operations remain a documented race. Row-existence alone may not cover every provider timeout/reuse/disable path: test each adopted revocation source and add explicit checks before claiming coverage. Membership is independently read from D1, so role/removal must not await a token refresh. No database replacement or financial-data migration is required by packaging.

## Proof tasks and acceptance

1. Local fake contract tests first: one auth owner creates future `mobile/src/auth/session.ts`, `mobile/src/auth/callback.ts`, `mobile/src/auth/secure-storage.ts`, `mobile/src/api.ts` and `tests/native-auth-contract.test.mjs` only after assignment. Match the architecture worker's final mobile layout before creating files. No edits to its current demo/dashboard/lifecycle files in parallel.
2. Authorized isolated-backend proof: backend owner creates `app/native-auth.ts`, native route wrappers and tests; manager assigns extraction ownership for `app/household-lifecycle.ts`, `app/api/household/store.ts` and any new domain module. Prove authoritative check permissions and logout denial with a held unexpired JWT. If it fails, connected financial access remains gated.
3. Packaging owner pins compatible Browser/App/vault packages and generated Android registrations only after selection. Auth owner tests callback/rotation/storage with dedicated provider identities. Manager alone integrates dashboard/lifecycle entry actions and runs web regression tests. No configuration changes are included in this document assignment.

| Negative/behavior case | Required result |
|---|---|
| Missing/expired/bad signature/wrong issuer or audience/mixed cookie+bearer | Deny without financial response |
| Revoked session with unexpired JWT; external provider logout; liveness outage | Deny after confirmed revoke; fail closed; record coverage gaps explicitly |
| Disabled/deleted user, timeout/reuse termination | Defined adopted policy enforced by proof; row existence not assumed sufficient |
| A/B synthetic identities in separate households; forged scope/metadata; export | A never reads/writes/exports B; server membership wins |
| Viewer write, removed member, changed role, stale revision/ack-loss retry | Denial/current role; conflict or identical retry without duplicate financial change |
| Unsolicited/wrong nonce/duplicate params/missing verifier/replayed code | No session; clear/consume pending transaction safely |
| Cancel, timeout, warm/cold callback, process death during exchange | Exactly one terminal transition; no late account replacement |
| Refresh concurrency/storage failure, A request pending during switch to B | Single refresh; locked on unsafe persistence; stale result discarded |
| Logout offline/online, relaunch/reinstall/backup restore | Local cleanup always; honest revocation result; no stale credential resurrection |
| Web foreign/missing Origin mutations and existing same-origin login | Existing denials and valid browser flow unchanged |
| Synthetic demo | Zero auth/API traffic; separate storage and no provider-readiness claim |

Physical Android acceptance remains pending on S20+ and S21+ 5G after OS/browser/WebView versions are recorded. No reliable macOS/iPhone access: iOS build, callback, storage and store/provider decisions remain pending. Current Supabase [TLS changelog](https://supabase.com/changelog/cbc-tls-ciphers-deprecated) schedules old CBC cipher removal no earlier than November 10, 2026; verify actual runtime compatibility rather than assuming it.

All official links above were inspected October 17, 2026. Next actionable slice is local fake callback/session tests plus the isolated liveness-service proof design; external provisioning/provider flows require a later authorized task. Connected authentication is not ready merely because this contract is documented.

## October 18 callback correction

The adopted implementation now places the independent correlation nonce in an exact fragment, not a redirect query. Supabase Auth current request.go excludes fragments from allowlist matching, and prepPKCERedirectURL in verify.go preserves the fragment while adding the code query. The launch destination before the fragment remains the exact approved native callback, without wildcard/upstream-state overrides. Parser accepts one code and exact pending nonce fragment only; it still rejects token/error/foreign/duplicate links and consumes the pending record once. Hosted Google/Android preservation remains unverified until real phone sign-in succeeds. See the latest delivery checkpoint; older query-only proposals above are historical.

## October 18 hosted legacy-session compatibility correction

The adopted restricted authority now supports V1 by checking existence of matching unrevoked refresh metadata (session_id/user_id/revoked only), alongside the session/user/verified Google checks and sticky application timeouts. Current official Auth rotation swaps within one transaction; family reuse revokes all session refresh rows. V2 still requires its nonnegative counter. Token/HMAC values remain unreadable. This supersedes the historical three-table/V2-only gate; it does not adopt JWT/getUser-only authorization. Hosted auth schema USAGE cannot be delegated by postgres: a private definition-time-bound SQL-standard INVOKER session_facts reader avoids runtime namespace lookup while retaining narrow owner column grants/RLS. Runtime can execute only guarded check_session. Real restricted TLS/function cold-start proof passed; actual phone bootstrap, held-token logout and two-device sharing remain pending. See latest connected delivery checkpoint.
