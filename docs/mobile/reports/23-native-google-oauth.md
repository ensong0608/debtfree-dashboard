# Agent report: Google PKCE transport and native browser adapter

Date/time zone: October18,2026 / America/Los_Angeles.
Status: assigned local adapter implementation + synthetic verification complete. Live provider/callback/phone proof remains gated.
Owned NEW files only: `mobile/native/google-oauth.ts`, `mobile/native/browser-auth.ts`, `tests/native-google-oauth.test.mjs`, this `docs/mobile/reports/23-native-google-oauth.md`.

## Evidence and boundaries

Read AGENTS, complete prompt17/NATIVE_AUTH_CONTRACT and current native contracts/session/callback/API test interfaces. Applied Supabase skill and checked current primary docs/source. Preserved dirty work; no existing session/contracts/API/entry/dashboard, native manifest, dependency/package, vault or backend edits. No real Auth/user/financial query, provider consent, key/credential inspection, remote mutation, adb, peer/status polling or completion message.

Primary evidence inspected October18:

- [Supabase changelog index](https://supabase.com/changelog.md): web reader rejected markdown content-type; retrieved directly with Invoke-WebRequest and scanned relevant breaking changes. [TLS change](https://supabase.com/changelog/cbc-tls-ciphers-deprecated) remains a runtime compatibility proof; self-hosted external URL change does not change our fixed hosted Auth path.
- [PKCE guide](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [redirect rules](https://supabase.com/docs/guides/auth/redirect-urls), [auth-js source](https://github.com/supabase/auth-js/blob/master/src/GoTrueClient.ts). Also inspected installed official auth-js2.117.2 `_getUrlForProvider`, exchange/refresh and admin signOut implementations. They establish authorize `provider/redirect_to/code_challenge/code_challenge_method`, exchange `auth_code/code_verifier`, refresh `refresh_token`, and local sign-out scope. No SDK instance or auto-refresh/storage is added by this transport.
- [Supabase Auth configuration source](https://github.com/supabase/auth/blob/master/internal/conf/configuration.go) compiles URIAllowList via gobwas glob with dot/slash separators. Auth-js's `_maybeAppendFlowIdToRedirect` explicitly warns that query strings participate in exact allowlist matching. [gobwas glob syntax](https://github.com/gobwas/glob#syntax) documents literal escaping and character lists. Uppercase README and an assumed lexer source path returned404; repository/source discovery supplied the actual grammar instead. No Go toolchain/matcher test was installed/run.
- [Capacitor Browser](https://capacitorjs.com/docs/apis/browser), [App](https://capacitorjs.com/docs/apis/app), and actual manager-installed Browser8.0.5/App8.1.2 declarations. Pinned Android Browser source includes close-controller behavior; closing still needs real phone proof and never supplies auth proof.

## Google OAuth implementation

`createGoogleOAuth({supabaseUrl,publishableKey},options?)` implements existing OAuthProvider without installing/changing dependencies. Requires exact `https://otggeztwtaklsqwtztgz.supabase.co`; no trailing-path/alternate/project fallback. Runtime public publishable key required, format-checked; no embedded key, service-role/secret key, legacy JWT fallback or production destination. Production acpderotiyoecmwwyfsu is rejected. Injected fetch/WebCrypto/time/timeout supports isolated testing.

- prepare: independent32-byte WebCrypto draws for PKCE verifier and correlation. Verifier is43-character base64url; correlation is64-character lowercase hex (256bits each). Hex makes a precise allowlist character-list pattern unambiguous. SHA256/base64url S256 challenge, five-minute Pending compatible with existing contract, exact native callback base plus correlation. Google provider and select_account prompt. Does not set/replace upstream OAuth state or experimental SDK flow-id parameters. No network request until browser launch.
- exchange: POST `/auth/v1/token?grant_type=pkce`, JSON `{auth_code,code_verifier}`.
- refresh: POST `/auth/v1/token?grant_type=refresh_token`, JSON `{refresh_token}`.
- signOut: POST `/auth/v1/logout?scope=local`, current access bearer only. Existing authority/session owns server revocation semantics; local provider sign-out alone is not claimed sufficient.
- All requests fixed to test Auth origin, runtime apikey, omitted cookies, no-store, no-referrer and redirect:error. Enforces returned response destination/redirect state, successful status, JSON token response and streaming64KiB bound. Deadline default15seconds (configurable1–30000ms), including body reads, rejects even a fake fetch ignoring abort. Errors are generic/redacted; no output/logging. No provider error/body/token/JWT claim logging.
- Token response validates bounded JWT-shaped access token, bounded refresh token, bearer type, safe integer expires_in1–86400 seconds and optional positive integer expires_at; expiry is the conservative earlier bound and must remain future. Stores only contract access/refresh/expiry, not provider credentials/user claims. JWT shape is transport validation, not signature/identity verification. NativeSession's existing authority/bootstrap remains the sole route to ready. Test Auth JWT lifetime must fit this explicit24hour cap.

## Correlation allowlist gate — not changed or proved live

Current configured exact base entry does NOT cover redirect_to's correlation query according to current SDK/source mechanics. Code does not remove correlation or substitute broad redirects. No allowlist was changed here. Manager must review/configure/test a narrow pattern or adopt another reviewed relay; current hosted flow remains unproven.

Precisely generated candidate glob (NOT a regular expression):

```js
const pattern = String.raw`com.debtfree.connectedtest://auth/callback\?correlation=`
  + '[0123456789abcdef]'.repeat(64);
```

This means literal callback scheme/host/path and literal question mark/key, followed by exactly64 lowercase hex characters. Character list contains no ambiguous ranges, commas or star/globstar. It excludes extra parameters/path/port/fragment/foreign host and upper/nonhex/short/long correlation. Dashboard plain input uses one backslash before question mark; JSON string encoding requires escaping that backslash. Match redirect_to BEFORE Supabase appends its code; native callback parser subsequently requires exactly one code + matching correlation.

Syntax is supported by documented underlying glob grammar and configuration source, not an assertion that this hosted project accepts the long pattern or preserves query end-to-end. No actual Go matcher or live hosted redirect was executed. Required manager proof: project accepts exact generated entry, correlated redirect retained after Google, only one code/matching nonce delivered, substituted/unlisted destination fails rather than falls back into an accepted native session. If unsupported, stop and review a transaction relay/auth-session design; never drop correlation. Exact-base-only fallback is not sign-in readiness.

## Native Browser/App adapter and single-instance wiring

NativeBrowserAuth uses injected SystemBrowserPort/AppCallbackPort and one existing NativeSession. Rejects non-native platform. Required official plugin methods: Browser.open({url,presentationStyle:'fullscreen'}), close(), addListener('browserFinished',listener); App.addListener('appUrlOpen',listener), getLaunchUrl(); returned handles.remove(). No global removeAllListeners, embedded dashboard WebView, window.open or plugin import inside adapters.

Manager wiring outline (not implemented in entry/dashboard):

```ts
let browserAuth: NativeBrowserAuth;
const oauth = createGoogleOAuth({supabaseUrl: GOOGLE_TEST_ORIGIN,
  publishableKey: publicConfig.publishableKey});
const session = new NativeSession(reviewedTestConfig, {
  vault, oauth, authority, now: Date.now,
  browser: {open: url => browserAuth.open(url)},
});
browserAuth = new NativeBrowserAuth({session, vault, browser: Browser, app: App,
  isNative: Capacitor.isNativePlatform(), platform: 'android'});
await browserAuth.initialize();
// User login: await browserAuth.startGoogleLogin();
// User cancels pending sign-in: await browserAuth.cancel();
// Dispose bridge when replacing the owning runtime: await browserAuth.dispose();
```

Use actual native platform guard (iOS separately verified later), one vault and SAME session for API/bootstrap/UI. Initialize before initiating login/credential-restoration orchestration; cold callback can itself enter verifying/ready. Do not restore a second SDK session, concurrently replace identity, or manufacture ready from decoded JWT. Manager must choose restore/login UI ordering around persisted pending and existing session state. Plugin package/manifest/native sync and vault implementation remain manager/other-owner scope.

Bridge installs owned listeners before launch, reads existing secure pending key `['debtfree-native-test-v1',testIssuer,'pending']`, re-arms remaining expiry after restart, and feeds warm/cold delivery into same session.handleCallback. Serial queue + bounded in-memory URL fingerprints suppress duplicate code delivery without persisting raw callback URLs. Foreign URLs ignored; callback-base provider errors/missing nonce are rejected by existing parser/session, consume pending and expose no provider details.

Pending expiry and browserFinished invalidate sign-in through session.cancelLogin; finished event has250ms redirect-race grace and does not interrupt an already exchanging/verifying session. Explicit cancel remains available. Open/listener/launch-query/close operations bounded15seconds. Cleanup removes only own listeners, including late registration after timeout/dispose, and still closes/removes listeners when cancellation fails. Browser.close failure does not prevent credential/pending invalidation. Dispose preserves a ready session; logout remains manager/session responsibility.

Handled races: callback can complete before Browser.open settles without locking verified session; stale delayed initialization pending read cannot rearm an old timer after warm verification; pending generation checks prevent late exchange/refresh restoration. Real OS event ordering/closing requires physical proof, not assumptions based on fake ports.

## Executed verification

- `node --test tests/native-google-oauth.test.mjs tests/native-auth-contract.test.mjs`: **31 passed,0 failed** (~303ms final), comprising17 new transport/browser tests +14 existing contract tests. All transports, plugin ports, credentials, provider errors and authority scopes synthetic; no live Auth endpoint hit.
- Coverage: real field shapes/methods/headers; independent PKCE/correlation/challenge; test-only config and launch destination rejection; malformed/oversized/expired/redirect responses; request/body timeout; authority-required readiness; warm/cold replay dedup; browserFinished/explicit restart cancellation/expiry/provider-error; launch failure/open timeout/late open success; listener-timeout cleanup; cleanup under cancellation error; expired restart; stale refresh after logout; callback before browser launch promise settles; initialization/callback race.
- Initial authority-state test assumed one event-loop turn was enough for WebCrypto; replaced assumption with an explicit fake-authority entry signal. No timer retries or live-provider workaround.
- Scoped ESLint passed on two new TypeScript modules and test.
- Scoped strict TypeScript passed: `node_modules/.bin/tsc.cmd --noEmit --incremental false --target ES2022 --lib dom,dom.iterable,esnext --module esnext --moduleResolution bundler --allowImportingTsExtensions --skipLibCheck --strict mobile/native/google-oauth.ts mobile/native/browser-auth.ts`.
- Additional TypeScript virtual-source check (no file emitted/executed) assigned actual BrowserPlugin8.0.5 and AppPlugin8.1.2 to injected port interfaces: passed. Actual pinned declarations/Android close implementation read only; no dependency or native sync command by this worker.
- Scoped whitespace check after final source/report normalization. No full build/native command or full app suite.

## Remaining proof and next step

Manager review/adoption of callback pattern and real Google query preservation is the immediate external gate. Then secure-vault native proof, single-session entry/API integration, real bootstrap/liveness denial/revocation, actual plugin/manifest links, user cancel/expired/replay/refresh and cold/warm phone tests. Native browser launch is not login, token receipt is not authorization, and these fake tests do not establish connected readiness. iOS/macOS/phone, public launch/store and financial draft persistence retain separate gates.

No production/cloud/auth/user queries, real token/key reads, financial payloads/fixtures, device/native actions, server changes, commits/deploys, extra dependencies, peer/status inspections or completion notices. Saved report and own-chat final only. Owner supplies manager heads-up.
