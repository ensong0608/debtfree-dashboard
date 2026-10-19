# Agent 1 — Mobile architecture and client extraction

You are a specialist reporting to the primary manager for DebtFree. Work in `C:\Projects\debtfree-dashboard`. Read `AGENTS.md` and `docs/mobile/README.md`; this task is explicitly local-only and discovery-only. Preserve all existing work. Your only writable file is `docs/mobile/reports/01-architecture.md`; do not modify app source, configuration, dependencies or other reports. Do not spawn agents.

Owner goal: Android and iPhone with shared code and the existing visual theme. Android first on Windows; no reliable iPhone/Mac access. First deliverable is an installable development app using isolated synthetic data, followed by real development authentication. The current web app and real imported local household must stay intact.

Inspect the actual entry points, DashboardClient and its dependency graph, framework/server-only imports, repository transport/persistence, device storage, browser API assumptions, asset/CSS handling, export/import and navigation/dialog lifecycles. Read the saved mobile plan/checklist and current local setup report. Identify concrete reuse and extraction boundaries. Do not assume server-rendered `dist/client` is already a Capacitor bundle, or propose only wrapping the remote production URL.

Produce: evidence-backed recommendation; smallest buildable bundled-client checkpoint; specific adapters and files to add/change; separation of sample-only demo vs authenticated connected app; preservation constraints for financial fields/baselines; integration risks and end-to-end acceptance. Coordinate transport/auth recommendations with Agent 2 through the manager if useful. Explain how to keep iOS possible without claiming iOS testing.

Verify current technical claims using official Capacitor/framework documentation where needed; browse only primary sources. No installs, cloud calls, production/private data access, build changes or full test runs. Source/config inspection and short read-only checks are sufficient.

Use `docs/mobile/REPORT_TEMPLATE.md`, write your report, then notify the manager directly with path, findings, blockers and proposed next implementation task. Mark native/device/auth checks unexecuted.
