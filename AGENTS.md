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
