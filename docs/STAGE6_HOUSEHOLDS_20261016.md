# Stage 6 household lifecycle — October 16, 2026

The user accepted the design review and release checks for current private use and explicitly requested Stage 6, followed by discussion of conversion into an official mobile app. This authorizes the lifecycle implementation; it does not claim outstanding independent live security/device checks passed or authorize public registration.

## Delivered scope

- Explicit invitation acceptance by the intended verified Google email. Seven-day expiry, owner revocation/reissue, pending invitation display and copyable setup link. No email/message is sent.
- Only the owner can invite, change admin/viewer access or remove other members. Owner removal/demotion and owner leaving are rejected by the server. Admins edit financial data; viewers remain read-only but may manage their own access/deletion request.
- Existing active members continue unchanged. Existing legacy invited rows require explicit acceptance when lifecycle mode is enabled; merely signing in does not activate them. The legacy member-add endpoint cannot bypass invitations in lifecycle mode.
- Non-owners can leave after typing LEAVE. Shared debts, payments and snapshots remain with the household. Subsequent requests resolve membership again.
- Explicit, server-allowlisted household creation starts with NULL state and revision zero; the existing empty onboarding initializes that household. Production creation allowlist is empty. Public signup remains closed.
- Cancellable durable deletion requests after typing DELETE. Owner requests cover the household; non-owner requests cover their access/account. This is a manual review policy, **not automatic deletion or fulfillment of public app-store deletion requirements**.
- Help/support page and an account entry. Private test issue reporting continues in the existing project conversation; no fictional support inbox or delivery claim.

## Deployment and preservation

Additive schema only: household_invitations and household_requests, plus indexes. No existing table columns, balances, transactions or Progress baselines are transformed. Migration SQL is idempotent. Production workflow confirms account/Worker/D1, restores and encrypts a pre-migration SQL backup, saves encrypted recovery, then applies only this additive schema before publishing. Post-release fingerprints compare all original household/member/financial-state columns to that checkpoint. New tables are included in all subsequent full SQL backups and in the local recovery drill.

The preview uses its own D1. HOUSEHOLD_LIFECYCLE_ENABLED enables the new flows; HOUSEHOLD_CREATION_EMAILS is a server-only allowlist. Production explicitly uses an empty creation allowlist; the existing preview-owner secret allows controlled creation in preview. No financial sample data enters production.

Rollback: disable lifecycle mode or deploy compatible prior private app source. Leave additive tables in place to preserve invitation/request history. No automatic financial restore, member removal or account deletion. Do not roll back to versions predating the reconciliation-anchor/optional-loan validators.

## Manual deletion policy before public launch

A request is recorded, not processed automatically. It can be cancelled. Until a reviewed, authorized deletion procedure exists, do not claim requests have been completed or open public signup. The public-launch work must define ownership/partner notice, retention and backup expiration, removal of authentication identity/sessions, local cached exports, operator access and request tracking/response timelines. Never delete all of an individual's shared financial history merely because they leave a household. Owner deletion affects all partners and requires explicit scope review. There is no ownership-transfer feature in this batch.

## Next agenda: official mobile app conversion

The existing authoritative planning file is DebtFree_Public_App_Requirements.txt, created October 10, 2026 (Library identity libfile_2a6a3881aa108191a946912e0605eeb1). Reopen it when starting mobile planning and update status from evidence; its earlier pricing/store rules need re-verification before acting.

1. Decide first platform(s), launch scope and packaging approach after inspecting current web architecture.
2. Plan development, testing and production separation; keep the existing household, historical financial data and Progress baseline intact. Packaging does not require moving the database.
3. Prove mobile Google/Apple login, session storage, callback/invitation deep links, logout and account switching.
4. Implement native navigation/back behavior, safe areas, keyboards, lifecycle refresh, offline states, icons and signed/versioned builds.
5. Finish public identity/household isolation checks, real sync/session/device tests, operational recovery and actual deletion fulfillment.
6. Establish developer accounts, identifiers/signing, privacy/terms/support/deletion URLs and store disclosures.
7. Decide monetization/household entitlements; implement store billing/trials/restoration only if included in the first release.
8. Beta-test through the relevant platform channels, prepare store assets/reviewer access and roll out gradually with monitoring/rollback.

This is the agreed next discussion after Stage 6. No timed/background reminder was requested or created.
