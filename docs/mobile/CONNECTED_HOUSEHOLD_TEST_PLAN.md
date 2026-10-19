# Connected household test plan

October17,2026 / America/Los_Angeles. Manager proposal and read-only findings; no connected implementation, resource provisioning, provider changes or phone synchronization pass.

Latest owner direction: begin changes and delegate. Native worker assigned prompt15 to implement/test local dependency-injected callback/session/API adapters and produce exact CONNECTED_TEST_SETUP.md, report21. This is an actual local foundation task; not cloud provisioning or a connected APK pass. UI/currency workers have disjoint scopes. Manager waits for owner's heads-up before reviewing results; no automatic completion detection.

## What exists

- Owner wants both Samsung phones to share household updates while testing with their wife. Owner is unsure whether a separate development Supabase/Google setup exists.
- Connected Supabase account inventory returned one healthy project, DebtApp. Its public reference matches docs/GOOGLE_LOGIN_SETUP.md and the existing production deployment workflow. Treat it as production-associated and leave it untouched. This inventory does not cover other unconnected accounts or organizations.
- No financial tables, Auth users, secrets or production data were queried. Read-only inventory does not prove current Google provider settings.
- Current APK has no remote server configuration or native authentication. Its standalone bundle blocks server/Auth imports; it saves on that device only. JSON import does not establish a shared household.
- Existing connected web code refreshes on foreground/focus/network events and a30-second interval, with pending-draft/conflict guards. It is not push realtime. Whole-household revision checks already reject competing stale writes; preserve these checks.

## Proposed isolated resources

Names below are proposals, not created resources. Before creation, check account ownership, availability, plan limits and any cost; never upgrade a plan or purchase automatically.

| Resource | Proposed purpose |
|---|---|
| Supabase project `debtfree-mobile-test` | Separate development issuer and Google provider; no production users/session configuration changes |
| Google OAuth development client | Supabase callback plus exact reviewed native redirect; two tester identities only initially |
| Worker `debtfree-mobile-test` | Separate HTTPS API, native bearer endpoints and private live notifications |
| D1 `debtfree-mobile-test` | Synthetic households initially; no production binding, migration or database copy |
| Private Durable Object namespace | Per-household revision notifications, authenticated and scoped server-side |
| Connected Android test build | Proposed separate app ID `com.debtfree.dashboard.connectedtest`, installed alongside device-only Dev so existing imported copies stay available |

Never expose or tunnel localhost:8787; it contains the owner's private imported household. Leave production configuration and existing device-only APK storage untouched. Keep all provider credentials in secure interactive setup/server secrets, outside chat/repository/reports/APK. Client carries only public configuration. Reject missing configuration and production fallback origins.

## Delivery order

1. Finish the approved UI slice and manager review first, after owner says workers are ready. Run integrated checks and inspect a replacement device-only APK using the existing package/signature without clearing data.
2. Prepare the local native-auth contract proof with fake identities. Follow NATIVE_AUTH_CONTRACT.md: browser Google PKCE, exact one-time correlated callback, secure token vault, account-switch cancellation and server-authoritative membership/revocation. Prove selected plugin behavior before adoption.
3. Establish the separate test resources through an explicitly authorized setup task. Configure Google interactively; owner and wife authenticate themselves. Never request their passwords or tokens in chat. Do not repurpose the existing DebtApp project by assumption.
4. Prove isolated HTTPS API/session/membership behavior against synthetic households. Keep web cookie/Origin protections unchanged. Use server-side session-liveness checks; JWT/getUser alone does not satisfy the adopted revocation contract.
5. Integrate encrypted durable financial drafts with awaited writes and verified identity/household namespaces. An authentication-only memory proof cannot enable connected financial edits. No offline financial writes in this milestone; pending recovery/conflicts must survive restart.
6. Implement private live revision notifications after accepted D1 commits. Both phones refetch through normal authorized household API; the server remains source of truth. Notifications contain revision metadata, not financial payloads. Preserve revision checks and pending local drafts during refresh.
7. Install the separate connected test build and prove two-phone behavior with synthetic records. First run separate-household denial tests, then explicit invitation/acceptance puts the two tester identities in one household. Initial permissions restricted to the two approved testers; no public signup.
8. Only after those gates pass, offer an explicit owner-selected backup import into the new test household. Never auto-upload, merge or replace either existing local copy. Preserve original copies and capture a recovery checkpoint before any owner-approved import.

## Live-update behavior and limits

Cloudflare Durable Objects support WebSocket fan-out/hibernation, so D1 can remain the financial store. A notification channel needs its own reviewed authentication, session/membership enforcement and revocation/disconnect handling; an authenticated opening handshake alone is insufficient. No bearer tokens in logged URLs or public broadcast channels. Authorize reconnect and refetch normally. Issue notifications only after successful writes and tolerate missed/duplicate notifications with revision refresh.

Proposed target: changes appear on the other foreground, online phone within a few seconds. Measure the actual delay on both phones before claiming realtime works. Android background suspension/offline operation cannot promise continuous delivery; resume reconnects and refreshes safely. A shorter polling interval could be a temporary near-real-time fallback, but must be labeled and agreed rather than reported as push realtime. Supabase Realtime Postgres Changes does not automatically observe the existing D1 database; no financial-store migration is required for this plan.

## Acceptance evidence required

- Both identities sign in, accept the correct invitation and see the same synthetic household; a third identity/other household is denied reads, writes and export.
- A payment/edit/category change on either phone appears once on the other. Record measured latency; preserve correct balances/history and Progress starting total.
- Simultaneous edits produce explicit conflict/recovery rather than silent overwrite. Background refresh never erases pending input or drafts.
- Kill/relaunch, rotation, offline interruption, reconnect and acknowledgment loss preserve drafts safely and do not duplicate transactions. No saved acknowledgment before durable storage succeeds.
- Removed members/viewers/revoked sessions lose appropriate access; old unexpired tokens and open channels cannot bypass authority. Liveness outage fails closed.
- Callback cancellation/replay/warm+cold launch, token rotation, secure-storage failure, logout/account switch and stale request cancellation satisfy the native contract.
- Both S20+ and S21+ versions/runtime are recorded at actual testing. S20+ launch and owner-reported device-only import are historical evidence, not these connected passes.
- APK inspection proves separate test endpoints/configuration, no production fallbacks, no secrets; web regressions and current local-data preservation checks pass.

## Owner inputs when setup begins

Use the existing securely connected account for inventory/setup where possible. Owner handles provider consent and any required Google account selections interactively; wife signs in herself when the build is ready. The manager will prepare exact resource/configuration changes and report any account-limit/cost gate before execution. No action or technical detective work is needed from owner merely to establish whether DebtApp is a separate development project: current evidence says it is already used by production.

## Sources checked October17

- Repository: mobile/capacitor.config.ts, mobile/main.tsx, mobile/vite.config.ts, app/auth-config.ts, app/household-sync.ts, existing dashboard refresh logic and NATIVE_AUTH_CONTRACT.md.
- Supabase connector list_projects: one project; compared public reference with existing login guide and production workflow. No cloud mutation.
- [Supabase native deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking) and [Realtime](https://supabase.com/docs/guides/realtime).
- [Cloudflare WebSocket hibernation example](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/).
- [Supabase TLS changelog](https://supabase.com/changelog/cbc-tls-ciphers-deprecated): old CBC cipher removal scheduled no earlier than November10,2026; actual Android HTTPS proof remains necessary, with no cleartext/TLS downgrade.

UI workers were assigned prompts10–12 before this read-only investigation. No worker reports/statuses were inspected to detect completion. Owner heads-up remains required before manager integration.
