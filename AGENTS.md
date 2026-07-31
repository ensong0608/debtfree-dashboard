# DebtFree Dashboard agent instructions

## Sites publishing

This repository is linked to an existing Sites project through `.openai/hosting.json`.

- For any requested site change, complete editing, validation, commit, and production deployment in the same turn unless the user explicitly asks for local-only work or a saved version without deployment.
- At the start of the turn, read `.openai/hosting.json`, discover the Sites tools, and call the read-only `get_site` operation to verify the project and keep the Sites connector active. Do not request a source write credential yet.
- Finish all slow local work before requesting a credential: edit, run tests, commit the exact source, and run `npm run sites:prepare`.
- `npm run sites:prepare` must succeed before publishing. Use its `commit_sha` and `archive` output for the Sites version.
- Only after preparation succeeds, request a fresh source repository write credential. Immediately push the prepared commit with per-command HTTP authorization, save one version, deploy it privately, and poll until the deployment reaches a terminal state.
- Never reuse a source write credential from a previous turn. Never save its token in a remote URL, Git configuration, a file, logs, or user-visible output.
- If a push fails because the credential is expired or unauthorized, request one fresh credential and retry the push once. Do not rebuild or repackage unless the committed source changed.
- Do not report success until Sites reports that the deployment succeeded.
- Never stage `.codex-remote-attachments/` or other user-provided reference files unless the user explicitly asks to add them to the product.
