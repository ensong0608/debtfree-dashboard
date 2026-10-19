# Mobile calculator, filtering and ordering refinement

October17,2026 / America/Los_Angeles. Owner supplied five screenshots and requested presentation/control refinements plus household-sync feasibility. Changes remain local; no production/provider/resource/dependency/phone operations. No new workers or cross-chat status checks. Existing source and UI APK preserved; source baseline saved under ignored .wrangler/mobile-ui-refinement-baseline.

## Implemented

- Mobile category pills replaced with one styled native select showing Filter, selected category and count. Categories derive from household settings; All and empty categories remain available. No hardcoded Mama/Papi filters.
- Mobile Sort replaced by existing-theme calculator icon. It opens Quick Payoff Calculator in an accessible modal with close/Escape/backdrop and focus restoration. Calculator removed from the bottom of Debts; desktop controls unchanged.
- Mobile Edit debt details adds Position in category. Position/category changes are staged with the other draft fields and applied by existing arrangeDebt only on Save details; Cancel does not reorder. No transient displayPosition field is stored in the financial record. Existing displayGroup/displayOrder carry saved ordering; ledger/balances unchanged.
- Calculator subtitle Cards & loan debts; label Extra Payment and input share one row. Copy: Minimums $X included. Total: $X. Existing engine, amount/minimum reservation/account scope and saved-plan isolation preserved. Separate House/car loanTrackers are not added to its financial model by this wording change.
- Debt name and payoff month share a single row; very long names ellipsize visually with full text retained in DOM/title. Schedule columns use natural content width. Fixed root cause: shared table minimum1030px leaked into the schedule; calculator now scopes min-width0/width:max-content/table-layout:auto. The same inherited minimum was removed from the compact Transactions history table.
- First6months summary explicitly keyboard-focusable inside the existing modal focus trap. No shared global styling or Budget content changes.

## Verification

Typecheck and full source lint passed. Web build plus all320 unit/API tests passed. Integrated synthetic browser run19 passed/6 intentional viewport skips, covering previous flows plus dropdown filtering, ordering save/cancel, no ledger/balance changes or transient field leakage, calculator modal/close/Escape/focus return, minimum reservations, order/date row alignment and compact table widths. Dedicated final keyboard check and final APK evidence recorded below after packaging.

Visually inspected synthetic390px Debts/calculator captures, with six-month schedule expanded. Sample table width251px; column widths65/57/57/73px, no page errors. Private screenshots supplied by owner were references only; no real financial payload/device screenshot used in tests. Existing local household payload fingerprint passed unchanged. Dependency manifests/Wrangler/global/reference styles untouched. No full historical web136-case browser rerun claimed; focused integrated suite and full unit/API coverage used.

Actual phone update/Back/keyboard/WebView behaviour and S21 acceptance remain pending. Current device-only installed app/data was not accessed, installed over, uninstalled or cleared. Production untouched. Sync is feasible but remains the separate isolated backend/native-auth/durable-draft milestone described in CONNECTED_HOUSEHOLD_TEST_PLAN.md; this APK does not silently connect to production.

## Final packaging evidence

- Final dedicated calculator keyboard check passed: Tab from Snowball reaches First6months, Enter opens it, Escape closes modal and restores calculator-trigger focus; saved plan remains unchanged. Scoped lint passed after this final accessibility change.
- Final mobile build/cap sync and Android assembleDebug/lintDebug passed; final native build20seconds. All18 web assets match actual APK, including OCR gzip. No remote server configured, no native plugins/forbidden private files; expected bridge extras only. SDK apksigner verified the same retained Android Debug signer (SHA25601f3806626d72c8b53d2a1dd5c1069d1248a9968fadf906d8d7ae1aa799273ab).
- APK size12,844,653 bytes; SHA2565a30bd3f859aee281f359ce0cb7f83941e406a0d348f06606c181ce574ef531f.
- Canonical mobile/android/app/build/outputs/apk/debug/app-debug.apk copied exclusively to both `C:\Users\masil\Desktop\PROJECTS\0LESS\DebtFree-Dev-20261017-UI-v2.apk` and its builds subdirectory. Both copies fingerprint-verified. Earlier UI APK copies preserved.
- No phone operation performed. Owner can install this as an update over DebtFree Dev without uninstalling; actual data persistence after that update still needs physical confirmation.
