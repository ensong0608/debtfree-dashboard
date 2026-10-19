# Agent report: Round 2 native authentication contract

Date/time zone: October 17, 2026 / America/Los_Angeles
Status: complete (documentation); connected implementation gates open
Owned files: new `docs/mobile/NATIVE_AUTH_CONTRACT.md`, new `docs/mobile/reports/06-auth-contract.md`

## Inspected evidence

Read AGENTS.md, mobile work board, prompt 06, report template and report 02. Rechecked source symbols in `proxy.ts`, `app/household-sync.ts`, `app/dashboard-client.tsx`, `app/household-lifecycle-panel.tsx` and `app/household-lifecycle.ts`; source evidence and full call-site inventory are recorded in the contract. Previous inspected auth/store/repository symbols remain explicitly referenced there. No private payloads or credential files accessed.

Followed the previously read Supabase skill: documentation-search MCP, current official session/PKCE/redirect/Google/function docs, auth-js source, Capacitor Browser/App and secure-storage maintainer declarations/manifest. Refetched changelog markdown and checked Auth-related breaking entries; TLS notice remains relevant to eventual device checks. Links and inspection date are in the contract. Documentation evidence is not implementation proof.

Verified direct human manager-notification authorization by reading manager chat `01a1489e-837e-7b63-ba04-2911935fe420` on host local, including the owner's delegation message asking workers to notify the manager or update a document, and subsequent clarification that the owner should not validate completion. One labelled completion notice is authorized; no unrelated messaging.

## Findings

- Small session/API/navigation interfaces are enough; no framework rewrite required. All sync, members/export, lifecycle, bootstrap, login/logout/account-switch and invitation-navigation call sites are accounted for.
- Browser PKCE is supported conceptually, but app nonce propagation/redirect allowlisting and native cancellation/cold-start behavior remain proof gates. Do not overwrite upstream OAuth state or treat browser launch as successful auth.
- A concrete MIT/Capacitor 8 secure-storage candidate has async APIs; native compatibility, backup/reinstall/rotation behavior remain unverified. A subscription alternative is documented without purchase. Web fallback is unsuitable for credentials.
- Async token storage cannot satisfy synchronous financial outbox Storage. Contract separates memory-only spike behavior from a future awaited encrypted-draft integration; durable restart recovery remains a gate if required for milestone acceptance.
- Immediate revocation remains the target. Prefer proving a narrow server liveness service, not blindly requiring privileged auth.sessions access from Worker. A session broker alone covers app revokes but misses external Supabase revocation and token re-enrollment. No ready introspection route or safe service has been demonstrated.
- Separate native wrappers retain web Origin/CSRF protection and shared membership/revision/domain checks. Google-only policy remains; no production/provider changes proposed for this round.

## Recommended implementation slices

Contract lists exact proposed auth modules, native API wrappers, single-owner shared extraction/integration files and a negative-test matrix. Next: local fake callback/session state tests; then an authorized isolated liveness-service permission/revocation proof before financial API connectivity. Architecture worker's no-network demo continues independently. Manager must settle final mobile folder layout and ownership before any shared edits.

## Verification actually performed

Read-only git status/source searches and documentation fetches/searches; checked both assigned files did not exist before creation. Read the manager human messages for notification authorization. Inspected upstream storage API/manifest and auth-js redirect forwarding. Wrote only the two assigned documentation files and checked their presence/headings/content.

No installs, tests/builds, provider/device flows, native storage exercises, liveness query, account/resource creation, server exposure, configuration changes, commits, pushes or deployment occurred. Existing test counts are not new results. Changes elsewhere can occur from other assigned workers and were not modified by this worker.

## Blockers and owner input

No owner input needed to complete this documentation slice. Connected access is gated on authoritative liveness proof, callback correlation proof, selected/pinned native storage/browser APIs and separately authorized synthetic provider/backend. Draft persistence decision must be explicit. Android OS versions remain unknown; iOS/macOS/device/store/provider expansion and original full requirements are later prerequisites. No credentials requested in chat.

## Changes made and handoff

Created the two owned documents only. Ready for manager review; no implementation acceptance implied. Next action: assign local fake contract tests and a minimal isolated liveness proof task, preserving independent demo work. Send one explicitly labelled agent completion handoff to the authorized manager after saved-file verification; no acknowledgement loop.
