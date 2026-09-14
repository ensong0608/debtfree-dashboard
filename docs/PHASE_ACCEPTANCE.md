# Canonical phase acceptance checklist

This is the acceptance index for the existing phase guide; historical release headings describe implementation milestones, not proof of acceptance. Phase 6 is What-if and Phase 7 is Monthly Plan. The September reliability repair covers the audit recommendations; billing, independent household signup, bank connectivity and notifications remain later product work.

| Phase | Acceptance evidence / remaining boundary |
| --- | --- |
| 1 Data | Version 0–6 parsing, duplicate IDs/calendar checks, preserved unknown fields, checkpoint and round-trip tests. Missing historical references are retained with import warnings. |
| 2 Onboarding | Draft persistence, seeded income/expenses/buffer/commitment; real three-debt browser completion. |
| 3 Home | Paid-to-date recommendations and target-met state; obligation regressions. Calendar assumptions are in OPERATIONS.md. |
| 4 Debts | Signed corrections, payment/undo and archived/final-payment tests; browser dialogs. |
| 5 Payoff | Persisted commitment and rollover; strategy and duplicate-name/ID regressions. |
| 6 What-if | Isolated scenarios and explicit apply, shared commitment calculation; deterministic tests. |
| 7 Monthly Plan | Seed/copy, tracking, negative remaining, saved historical targets and retained payment history. |
| 8 Transactions | Posted balances do not depend on tracking visibility; partial linked spending is actualized by amount. |
| 9 Progress | Captured snapshots remain unchanged; baseline balances survive corrections; final payments retained. |
| 10 Promotions | Exact expiration before/on/after tests, monthly approximation explained in the application. |
| 11 Transparency | Common current-month context and effective rates; estimates remain explicitly approximate. |
| 12 Household | SQL compare-and-swap, serialized outbox, JWT and owner/admin/viewer execution tests; single-household scope. |
| 13 Recovery | Pre-import checkpoint, timestamp-only save, reload/outbox/conflict/lost-response and reset tests. |
| 14 Accessibility | Browser suite at desktop/tablet/phone, keyboard containment, Escape, axe serious/critical gate and overflow. This is not a claim of comprehensive assistive-technology certification. |
| 15 Design | Implementation wording removed from key user flows; explicit paid-month/debt-free states. |
| 16 Operations | npm run validate and CI; authenticated health endpoint; local SQL restore drill. Production restore rehearsal and account alert setup remain operational follow-ups described in OPERATIONS.md. |

Run evidence lives in tests/reliability.test.mjs, tests/household-api.test.mjs and tests/browser/dashboard.spec.ts alongside existing regressions. Record actual release checks and deployment ID in the delivery report. Never replace browser execution with source-string checks when accepting an interaction.
