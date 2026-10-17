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
