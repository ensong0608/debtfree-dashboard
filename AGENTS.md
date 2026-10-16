# DebtFree Dashboard agent instructions

## Cloudflare publishing

Cloudflare Workers is the sole production hosting target. The production Worker is `debtfree-dashboard`, its configuration is in `wrangler.jsonc`, and its shared household data is stored in the D1 database bound as `DB`.

- For any requested site change, complete editing, validation, commit, push, and direct Cloudflare production deployment in the same turn unless the user explicitly asks for local-only work.
- At the start of the turn, inspect the dirty working tree and preserve all existing user changes. Confirm the active Cloudflare account and current `debtfree-dashboard` deployment before publishing.
- Do not use ChatGPT Sites, create Sites versions, or deploy to a `chatgpt.site` URL.
- Run lint and the full test suite before publishing. Run `npm run deploy:check` to validate the exact Cloudflare Worker bundle without changing production.
- Commit only the intended source and tests, push the exact commit to `origin`, then run `npm run deploy` to publish that source directly to Cloudflare.
- Apply remote D1 migrations only when committed schema migrations changed. Never replace, recreate, or delete the production D1 database during an ordinary deployment.
- After deployment, confirm Wrangler reports the production Worker URL and deployment identifier, verify Google sign-in protects the app and unauthenticated household API requests are denied, and verify the application responds successfully after authentication where practical.
- Do not report completion until the direct Cloudflare deployment and production checks succeed.
- Never stage `.codex-remote-attachments/`, `debtfree-old-dashboard.json`, generated deployment bundles, credentials, or other user-provided reference files.

## App wording and simplicity

- Keep app copy short, useful, and limited to the user's requested information and controls.
- Do not add unsolicited explanations, lender-check dates, "unknown" status labels, disclaimers, or technical notes to cards or other app surfaces. Necessary validation and error messages should be concise and appear beside the relevant action.
- Preserve explicitly removed text and sections. Do not restore them during audits or redesigns without the user's request.
- Debt cards must not display "Lender date unknown", "Lender last checked", or household-saving/lender-verification explanations. Due dates recur on the chosen day in the current month; show only the concise due-date label and value.

- Keep the Progress snapshot controls and saved snapshot list directly visible. Do not hide the snapshot feature inside nested dropdowns.

- Progress must preserve its first recorded starting total in `monthlyPlan.progressStartingBalance`. Later snapshots, balance edits, and removed accounts must not replace or hide that starting amount. Do not invent a starting date when none is saved.

- Debt + is the single creation entry point for every debt type, including house/car loans. Do not restore the removed + Track loan control.

## Current production source

- The private household app was promoted from the tested public-app foundations on October 15, 2026, with user approval. Continue from `codex/production-release-20261015`; consult `docs/PRIVATE_PRODUCTION_RELEASE_20261015.md` for the exact validated/deployed commit, Worker version and recovery evidence. `main` and the older PR stack are not the current deployed source. Do not publish an older branch over this release.
- Requested private-app fixes should reach the real app after validation, as the user directed. Public signup and Stage 6 lifecycle activation remain gated; a private-use release does not establish public-launch readiness. Keep preview financial data isolated and never copy it into production.
- Preserve the reconciliation-anchor and optional-loan-validator compatibility rules when fixing or rolling back. Use the approved encrypted backup/recovery workflow, never put financial payloads/private keys in repository content or logs, and verify stored production rows after publishing.

- Latest private reference-fidelity correction: app source `19f71c4a38c5b294837feaf32a9b5d4fa90b8c04`, Worker version `8bc8af1c-2e85-4c28-9e38-aeabb9b00ab2`. Read `docs/REFERENCE_FIDELITY_RELEASE_20261016.md`, the prior `docs/VISUAL_REDESIGN_RELEASE_20261016.md`, and the original private release notes. Continue from the production release branch; documentation-only follow-ups do not change the deployed app. Preserve the same backup/data/public-launch guards. Buttons use subtle 8px corners, as explicitly requested.

## Stage 6 and next mobile-app agenda

- User authorized Stage 6 on October 16 after accepting design/release checks for private use. See `docs/STAGE6_HOUSEHOLDS_20261016.md`. Public signup stays closed; production household-creation allowlist must remain empty until separately authorized.
- Lifecycle invitations require explicit acceptance, expire in seven days and can be revoked. Never auto-activate pending invitations upon sign-in in lifecycle mode or send invitations/messages from agent tools without explicit instructions.
- Deletion is a cancellable request for manual review, not an automatic destructive operation or completed account deletion. Before public launch, finish actual identity/deletion processing and retention policy. Preserve all existing household financial history in ordinary releases.
- After Stage 6, discuss official mobile-app conversion using the existing `DebtFree_Public_App_Requirements.txt` checklist. Re-verify current store/platform rules, pricing and packaging choices when planning. Do not imply a database migration is required just to package the web app.
