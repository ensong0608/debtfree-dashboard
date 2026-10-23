# Private-release monitoring and incident response

Implemented: Cloudflare Worker observability, authenticated database health query, fixed-event logging for read/write/export/lifecycle/storage failures and revision conflicts. Event-only logs accept no exception body, request, email, URL, token or financial fields. Client sync retains pending drafts and displays failed saves/conflicts. No client telemetry collector is added. Provider-generated request metadata needs an account review before public launch.

Account configuration still required: select a restricted on-call destination and named backup operator, set log retention/access, activate alerts and test delivery. Do not claim these exist because logs are enabled. Proposed initial alert rules: any failed database health check confirmed twice within 2 minutes; five service/read/write/export/lifecycle errors within 5 minutes; unusual sustained conflict rate (investigate before paging). Tune against beta traffic. Public monitoring should use anonymous login availability; authenticated health requires a dedicated disposable monitoring household and secret handling, never credentials in URLs.

Current responsible decision maker: household owner/operator. Release agent executes only a validated authorized release. Before public launch assign named incident/rollback coverage and response windows. On an incident: inspect event counts and release version, preserve recovery and pending edits, stop affected writes if correctness is uncertain, communicate via approved support channel, use a compatible forward fix or approved code rollback, verify saved data and sign-in. Never restore stale financial data automatically. Record redacted timeline/cause/resolution and test the regression. Refer to OPERATIONS.md and the private release compatibility rules.

## F04 review — October 22, 2026 (Pacific)

**Still blocked for public launch.** Privacy and terms remain explicitly marked drafts. Support/deletion pages point private testers to the project conversation and explicitly leave a public contact pending. These pages were not turned into final policies. Operator identity, support/deletion contact, launch/eligibility/legal review, retention periods and deletion commitments require actual approval; none was invented.

Source inspection found the following evidence boundary:

| Capability | Evidence | Status |
| --- | --- | --- |
| Worker observability | `wrangler.jsonc` enables observability | Configured in source; current account retention/access and sampling not inspected |
| Failure events | `safe-monitoring.ts` emits fixed read/write/export/lifecycle/storage/conflict events; health route emits `household_health_failed` | Logging only; no delivery proof |
| Database health | Authenticated `/api/health` queries the bound database | Request handler exists; no scheduled probe or recipient configured in inspected source |
| Notifications | No operational alert scheduler/receiver/delivery integration found in inspected workflows or monitoring code | External dashboard configuration may exist; not inspected and not claimed absent |
| Backup checks | Release workflows include recovery checks; remote recovery step is permitted to fail without failing the release | Inspect actual step result. Workflow success alone does not prove remote recovery or notification |
| Incident ownership | Existing text refers to household owner/operator | Named incident owner, backup, permissions, response windows and approved channel are unresolved |

The initial thresholds above are proposals, not enabled rules or a response commitment. A log line, successful health response, CI badge or anonymous login check cannot establish that an operator received an alert. Anonymous login availability also does not prove database health. Do not make the authenticated health route public or use an existing household's session to manufacture monitoring evidence.

### Delivery acceptance — not executed

1. Approve a named incident owner/backup, restricted destination, escalation/response windows, event retention/access and costs before configuring an external service. Select a dedicated authorized monitoring identity/household if authenticated probes are required.
2. Record the actual deployed rule IDs, source/environment, thresholds, routing, cooldown/recovery behavior and enabled state. Cover database health failures and read/write/export/lifecycle/storage errors; measure conflicts before choosing a paging threshold.
3. In isolated authorized infrastructure, cause a synthetic failure with a correlation reference containing no user data. Verify ingestion, rule evaluation, notification dispatch, receipt at the approved destination and acknowledgement by the responsible operator. Record timestamps and redacted evidence, including recovery notification where configured.
4. Exercise an unavailable destination and the approved fallback/escalation. A provider's send acknowledgement alone is insufficient evidence of receipt. Keep deduplication and recovery behavior in the evidence.
5. Review the recovery/deletion register procedure before any restoration. Alerts do not authorize restoring stale financial data or re-enabling deleted identities.

No approved recipient, monitoring credentials, dedicated monitoring household, external alert configuration or delivery receipt was available to this review. No messages or notifications were sent and no live failure was induced. Those dependencies remain unverified, rather than failed tests.

Production workflow source continues to set `HOUSEHOLD_CREATION_EMAILS` to an empty string, and the runtime defaults to an empty allowlist. No registration/authentication setting was changed. Current deployed flags and provider signup settings were not independently inspected; closed-registration source controls are preserved, not presented as a new live configuration verification.
