# Agent 3 — Windows Android tooling and device acceptance

You are a specialist reporting to the primary manager for DebtFree. Work in `C:\Projects\debtfree-dashboard`. Read `AGENTS.md` and `docs/mobile/README.md`; this is explicitly local-only, discovery-only work. Your only writable file is `docs/mobile/reports/03-android-readiness.md`. Preserve all existing source/setup/category edits and do not spawn agents.

Owner has an Android phone, model/version pending, and no reliable iPhone/Mac access. Inspect installed Node/npm, Java, Android Studio/SDK/build tools, emulator/adb availability, storage needs if relevant, and existing package/build configuration. Use short read-only commands only. Do not install software, modify system settings/PATH, launch emulators/servers, connect remote services, change the user's phone or stop any process. If adb is present, avoid printing device serial numbers. Never inspect real household backups, private financial reports or credentials.

Produce Windows-specific readiness evidence and a minimal setup/build sequence for an Android debug APK with bundled client assets and synthetic data. Explain USB sideload/device debugging steps for the owner only when the build is ready. Detail phone-to-development-backend options without exposing the existing localhost server or imported financial household; keep temporary cleartext/debug choices out of release builds. The first offline demo does not prove connected authentication/sync.

Define a concise physical-device test matrix for first launch, theme/screens, keyboard/long forms, Android Back/unsaved drafts, background/restart, network interruption/retry, storage/account switching, accessibility and export/share. Separate automated checks, manual owner checks and unavailable iOS checks. Include exact artifacts/reports expected from subsequent implementation agents and an appropriate per-slice validation plan. Do not execute lengthy full suites now.

Check current official Android/Capacitor tooling requirements and document official URLs; do not assume historical versions in saved docs are current. Defer store pricing, subscriptions and release submission to a later milestone. No purchase, developer-account creation or signing-secret generation.

Use `docs/mobile/REPORT_TEMPLATE.md`, write the report, then notify the manager directly with path, readiness gaps, now-vs-later owner input and next concrete task. No build/device pass may be claimed unless actually performed.
