# Deletion fulfillment — operator procedure (not activated)

Public signup remains closed. Current household_requests records are received/cancelled requests, not completed deletions. No real account or household may be deleted to test this procedure.

## Controlled fulfillment

The household owner/operator is the current release and incident decision maker. Assign a named backup operator and public contact before launch. In a private restricted case register (never this public repository), track request ID, verified subject ID, scope, received/confirmed time, cancellation status, operator, access revocation, identity removal, data disposal, recovery expiry, verification evidence and completion time. Do not copy financial payloads into the register. Use states received → verified → processing → awaiting-provider/retention → completed, or cancelled. Do not mark completed from a successful SQL command alone.

1. Confirm the signed-in requesting identity with Supabase, recheck the durable request and cancellation immediately before execution, and verify no conflicting household ownership. Stop on uncertainty. Never take an email in a support message as sole proof.
2. Explain affected shared records and export availability to the verified requester. Member deletion preserves household-owned history; remove access and pending invitations for that identity. Owner deletion must resolve all partners' access and scope; ownership transfer is not implemented. Do not treat a member request as authority to delete the entire household.
3. Suspend affected writes and revoke access first; revoke pending invitations and provider sessions. Supabase admin identity removal requires a server-only administrative credential, never the browser publishable key. Verify access/refresh tokens no longer authorize application reads, writes or exports; old JWT lifetime alone is not sufficient evidence of application access denial.
4. Apply the reviewed household/member scope transactionally. Preserve only documented, approved retention exceptions. Existing member audit names/emails embedded in financial history require an explicit anonymization/retention decision; deleting household_members alone is incomplete. Do not automatically erase shared payments to remove attribution.
5. Remove Supabase identity and linked provider references using the provider's supported admin process, revoke provider grants where applicable, and confirm repeated sign-in cannot recreate membership. No service-role key is currently provisioned to this workflow.
6. Record recovery-copy disposal/expiry, including private copies and seven-day Actions artifacts. On any later restore, reapply the restricted completed-deletion register before allowing access. D1 Time Travel/provider retention must be confirmed from the account; do not promise immediate physical purge from immutable backups.
7. Clear app-scoped pending drafts/cache on next access/logout, and explain that downloaded exports on members' devices are outside server deletion control. Confirm account switching cannot reveal them.
8. Independently verify identity absence, session denial, membership/invitation absence, approved data handling and recovery expiry with disposable accounts in isolated infrastructure. Record redacted evidence. Only then record completed and notify the verified requester through the approved channel. No public processing deadline or support inbox is approved yet.

## Blocking inputs and rehearsal

Requires Supabase administrative access, disposable provider identities, two isolated test households, approved owner/shared-history retention policy, private case register and recovery-copy expiration policy. Rehearse cancellation, member deletion, owner deletion, a failed identity-provider step, retry and restore/reapplication. This document makes the work executable but does not establish tested fulfillment. No deletion runner or destructive endpoint is enabled by this release.

## F02 review — October 22, 2026 (Pacific)

**Still blocked for public launch.** Source review confirms request capture and cancellation, not fulfillment. The request table has no processing/completion state, provider subject ID, processing lock or completion evidence. The case-register states above describe a proposed operator process; the app does not implement them. An operator must not treat a row with `cancelled_at IS NULL` as execution authorization.

Current safeguards: request kind comes from the server-resolved role; members request account deletion and owners request household deletion. Origin, identity and active-household guards apply. Capture uses one guarded SQL insert so overlapping retries reuse a pending reference for that household/identity/kind. Cancellation requires an owned reference, remains available after membership removal, and retries cannot cancel a replacement reference. The client displays every pending reference. Existing duplicate rows are not merged or erased. No fulfillment action, migration, privileged credential or destructive runner was added.

| Area | Current evidence | Remaining dependency |
| --- | --- | --- |
| Member/owner scope | Synthetic SQLite tests cover role-derived request scope, preserved financial state, owner leave rejection and member removal | Review an exact affected-record manifest for each case; resolve all owner/partner access before household disposal |
| Shared history | Leaving/removal preserves household state | Decide attribution anonymization/retention for names/emails inside state, `updated_by`, owner/member/invitation/request fields; do not erase shared payments by inference |
| Identity and access | APIs resolve current membership; lifecycle mode does not bootstrap removed members. Web logout uses local sign-out only | Authorized provider admin workflow, verified immutable subject IDs, all-device refresh/session revocation, and old-token denial for reads/writes/exports/lifecycle; ordinary logout is not deletion revocation |
| Cancellation | Targeted, identity-scoped, idempotent cancellation is locally tested | No processing lock/cancellation cutoff exists. Before activation, define an atomic claim/cancel protocol; a manual preflight recheck alone cannot close a cancellation/execution race |
| Retry and partial failure | Synthetic overlapping capture and failed-write retries pass | Provider/D1 operations are not one transaction. Maintain per-step evidence; resume only unfinished steps after rechecking scope and cancellation. Never restore membership automatically after a provider failure |
| Backups and restore | Workflows specify seven-day encrypted Actions artifact retention; separate recovery copies exist in historical release notes | Confirm actual artifact settings, inventory private copies and provider recovery windows, approve expiration, secure the deletion register independently of cascading request rows, and prove reapplication before reopening restored access |
| Completion | UI says request saved, not deletion completed | No completion endpoint, notifier, delivery channel or receipt exists. Verify all approved disposal/retention conditions and independent access-denial evidence before recording completion and sending confirmation |
| Device data | Pending edits/backups are scoped by identity/household | No deletion-triggered cache purge is implemented or verified. Decide purge behavior without destroying unrelated pending edits; downloaded exports cannot be remotely erased |

### Decisions required before activation

- Identify the actual operating person/entity and public support/deletion contact, including the external route for someone unable to sign in.
- Name the authorized deletion operator, independent verifier, incident owner and backup; a household owner role alone is not an administrative appointment.
- Approve owner/partner handling, identity-attribution treatment, any retention exceptions, case-register retention and access.
- Approve periods for active data, cancelled/completed requests, diagnostic/auth logs, provider backups and privately retained recovery copies. Seven-day Actions retention is one configured artifact setting, not a universal data-retention promise.
- Approve request acknowledgement, processing/cancellation boundary, completion deadlines, escalation and confirmation commitments. No periods or legal terms are selected here.

### Destructive-operation review packet — preparation only

Before any future execution, prepare a private packet containing the exact isolated environment/project/database identifiers; durable request reference and verified provider subject; current membership/role and cancellation status; scoped affected-row counts and shared-history treatment; required access-revocation steps; each proposed D1/provider operation with expected row counts; recovery-copy inventory/expiry; failure checkpoints; independent verification and the approved confirmation channel. Do not put user identifiers, financial payloads, exports or credentials in repository content. Owner disposal can cascade request rows, so preserve the approved case evidence separately before disposal.

Reject the packet if the provider project also serves unrelated apps/production identities without explicit scope approval. The existing preview has historically shared the authentication project; a separate D1 alone does not isolate identity deletion. No selected disposable identities plus a dedicated authorized authentication project were established in this review. No provider deletion/session call, remote D1 write, backup restore, email or alert was executed. This packet is a review specification, not an enabled deletion script.

Rehearsal acceptance remains: isolated member and owner cases; cancellation before processing and at the approved cutoff; failure before/after each provider/D1 step; repeated retries; existing access/refresh tokens and fresh sign-in; unaffected partner/other-household access; backup restoration with deletion reapplication; independent completion confirmation. Synthetic API tests below do not establish these external outcomes.

Provider reference checked for this review: [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data) and [sessions](https://supabase.com/docs/guides/auth/sessions). Identity removal does not retroactively invalidate issued JWTs; application access denial must be demonstrated separately. The changelog Markdown fetch was unavailable; no Supabase implementation or configuration changed.

Verification run for this change: all 12 tests in `tests/household-lifecycle.test.mjs` passed against synthetic in-memory SQLite, including member/owner request scope, targeted cancellation after removal, stale cancellation, overlapping retries, failed capture/retry and preserved financial state. Focused ESLint, TypeScript and `git diff --check` passed. Browser tests were updated to assert the selected cancellation reference and multiple visible cases, but did not execute: the normal dev-server startup check failed; a static isolated fallback then could not launch because the Playwright Chromium binary is not installed. UI interaction, real D1 concurrency and all provider/restore/delivery rehearsals remain unverified. No full suite ran.
