# DebtFree Dashboard agent instructions

## Cloudflare publishing

Cloudflare Workers is the sole production hosting target. The production Worker is `debtfree-dashboard`, its configuration is in `wrangler.jsonc`, and its shared household data is stored in the D1 database bound as `DB`.

- Default to local development. Do not commit, push, merge, deploy, apply remote migrations, or perform destructive database operations without explicit user approval. A development request alone does not authorize publishing. Approval for one release does not authorize future releases.
- At the start of the turn, inspect the dirty working tree and preserve all existing user changes. Confirm the active Cloudflare account and current `debtfree-dashboard` deployment before publishing.
- Do not use ChatGPT Sites, create Sites versions, or deploy to a `chatgpt.site` URL.
- Run lint and the full test suite before publishing. Run `npm run deploy:check` to validate the exact Cloudflare Worker bundle without changing production.
- For an explicitly approved release, commit only intended files and use the approved deployment path. Inspect CI triggers before pushing to origin; do not duplicate an automatic deployment with a direct npm run deploy. Direct deployment remains available when specifically approved.
- Apply remote D1 migrations only when committed schema migrations changed. Never replace, recreate, or delete the production D1 database during an ordinary deployment.
- After deployment, confirm Wrangler reports the production Worker URL and deployment identifier, verify Google sign-in protects the app and unauthenticated household API requests are denied, and verify the application responds successfully after authentication where practical.
- For an explicitly approved production release, report deployment completion only after deployment and production checks succeed. Local tasks can complete after their focused local checks.
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

- The private household app was promoted from the tested public-app foundations on October 15, 2026, with user approval. For production release provenance, consult `codex/production-release-20261015` and `docs/PRIVATE_PRODUCTION_RELEASE_20261015.md` for the exact validated/deployed commit, Worker version and recovery evidence. `main` and the older PR stack are not the current deployed source. Do not publish an older branch over this release.
- Historical private-app release approvals do not override the explicit approval requirement above. Public signup and Stage 6 lifecycle activation remain gated; a private-use release does not establish public-launch readiness. Keep preview financial data isolated and never copy it into production.
- Preserve the reconciliation-anchor and optional-loan-validator compatibility rules when fixing or rolling back. Use the approved encrypted backup/recovery workflow, never put financial payloads/private keys in repository content or logs, and verify stored production rows after publishing.

- Latest private reference-fidelity correction: app source `19f71c4a38c5b294837feaf32a9b5d4fa90b8c04`, Worker version `8bc8af1c-2e85-4c28-9e38-aeabb9b00ab2`. Read `docs/REFERENCE_FIDELITY_RELEASE_20261016.md`, the prior `docs/VISUAL_REDESIGN_RELEASE_20261016.md`, and the original private release notes. Treat the production release branch as historical deployment provenance; preserve the current local development branch. Documentation-only follow-ups do not change the deployed app. Preserve the same backup/data/public-launch guards. Buttons use subtle 8px corners, as explicitly requested.

## Stage 6 and next mobile-app agenda

- User authorized Stage 6 on October 16 after accepting design/release checks for private use. See `docs/STAGE6_HOUSEHOLDS_20261016.md`. Public signup stays closed; production household-creation allowlist must remain empty until separately authorized.
- Lifecycle invitations require explicit acceptance, expire in seven days and can be revoked. Never auto-activate pending invitations upon sign-in in lifecycle mode or send invitations/messages from agent tools without explicit instructions.
- Deletion is a cancellable request for manual review, not an automatic destructive operation or completed account deletion. Before public launch, finish actual identity/deletion processing and retention policy. Preserve all existing household financial history in ordinary releases.
- After Stage 6, discuss official mobile-app conversion using the existing `DebtFree_Public_App_Requirements.txt` checklist. Re-verify current store/platform rules, pricing and packaging choices when planning. Do not imply a database migration is required just to package the web app.

## Efficient development and continuity

- Use one focused agent. Do not spawn subagents without explicit user approval; cost efficiency takes priority over parallel speed. Do not introduce API billing or paid tools without approval.
- Model preference: GPT-6 Luna / Low for small isolated fixes, UI adjustments, documentation and routine inspection; GPT-6.1 Sol / Medium for standard features, coordinated multi-file work and moderate debugging; GPT-6 Astra / Medium or High only for difficult unresolved bugs, architecture, security, data integrity or major migrations. Use the lowest capable reasoning effort. These are recommendations, not automatic routing; the user selects the current chat model in the app. Never claim a model switch or delegated model without confirmation.
- Before implementing, state the outcome, smallest scope, appropriate model and completion criteria. Read only relevant files, reuse existing patterns, and avoid full-repository audits or unrelated refactors. Clarify requirements when they materially affect scope, security or data integrity.
- Preserve all uncommitted work, authentication, household access, transactions, debt history, settings and saved Progress snapshots. Never modify production financial data for tests. Do not log private payloads, keys or credentials.
- Use existing local commands and focused tests; review the diff and run git diff --check. Report changed files, checks and unresolved issues. Do not start unrelated next tasks automatically.
- Use this root file as the primary instruction entry point. Do not create duplicate requirements, rules, plans or templates. Additional documentation requires an explanation of why existing files are insufficient and user approval.
- For a fresh chat, inspect branch/dirty state and read only the relevant checkpoint: LOCAL_DEVELOPMENT_SETUP.md for Windows development and isolation; docs/mobile/CONNECTED_DELIVERY_STATUS.md for connected mobile delivery; linked release notes above for production recovery. Update an existing checkpoint only after a meaningful lasting change; distinguish historical verification from checks run now.
- Current Windows checkout: C:\Projects\debtfree-dashboard, local/windows-development-20261016. Do not switch to the historical production branch or overwrite local changes merely because the release notes identify it as deployed source. Verify the actual branch each session.
- Local web: npm.cmd run dev:local; mobile preview: see docs/mobile/LOCAL_DEMO.md. Available checks are defined in package.json: lint, typecheck, test (includes build), test:local:api, test:browser:local and mobile checks. Local API/browser checks need their documented server/fixtures. Use npm.cmd/npx.cmd in PowerShell. Do not seed, reset or import data merely to inspect readiness.
- Push approval must account for CI side effects: .github/workflows/deploy-cloudflare.yml automatically deploys matching app/test changes pushed to its listed production branches. Preview deployment also has branch triggers. Inspect workflows before any approved push; do not change infrastructure as part of routine setup.

## Testing approval — latest owner instruction

- Finish the requested implementation before running tests. Do not run automated tests, test builds, lint, typechecks, browser/device acceptance checks or remote verification probes without asking the user and receiving explicit approval for the proposed checks.
- Read-only source inspection and diff review may proceed during implementation. Report implementation as unverified until approved checks pass; never represent implementation completion as tested acceptance.
- At implementation completion, explain the focused checks proposed, their purpose and any data/environment effects, then ask permission. This timing and approval rule supersedes earlier instructions to run checks automatically, including release checks; publishing still requires explicit approval and successful required validation.
