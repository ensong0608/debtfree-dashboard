# Standalone sample-data preview

This is the first mobile-client checkpoint. It reuses the current DebtFree dashboard and accounting code in a standalone browser bundle, with fabricated sample records. It is not yet an Android APK, a connected household app or an iPhone build.

## Start on Windows

```powershell
cd C:\Projects\debtfree-dashboard
npm.cmd run build:mobile
npm.cmd run preview:mobile
```

Open http://127.0.0.1:4179/ and keep the preview terminal running. Ctrl+C stops this preview. `preview:mobile` serves the already built assets; rebuild after source changes.

The existing local household app remains at http://localhost:8787/ with its separate startup command. The standalone preview does not need that server, its database, simulated login or the copied household. It must not be pointed at production or reused as a server wrapper.

The demo starts with two sample debts, editable categories, a sample payment, a snapshot and an explicit Progress starting balance. Edits persist in demo-scoped browser storage on this origin. Reopen the same address/profile to retain those edits. Reset clears the scoped demo state and does not silently reseed; the app's recovery checkpoint remains available. Damaged stored records produce a visible error without overwriting them. Use synthetic data for this development checkpoint.

## Focused verification

```powershell
npm.cmd run test:mobile:unit
npm.cmd run build:mobile
npm.cmd run test:mobile
```

Browser tests start their own static preview and require port 4179 to be free. Stop the manually started preview first. Tests use isolated browser contexts; they do not open the user's current tab or financial household. Generated output is ignored under `mobile/dist` and `mobile/test-results`.

The build includes an actual module inventory and rejects known server/framework/auth modules. Browser acceptance rejects backend/auth/external traffic on the exercised paths and checks category/payment/snapshot/reload/removal/reset/corruption behavior. This establishes browser-bundle behavior only. OCR assets and export chunks are bundled; OCR execution and native export/share have not been certified.

## Next checkpoint

Use `scripts/mobile/doctor.ps1` and `ANDROID_SETUP.md` to prepare Android tooling. Then assign Capacitor packaging and a debug APK. Physical phone testing must cover both Samsung devices with their actual Android/WebView versions. Native Back, keyboard/resume, secure storage, provider sign-in and connected household synchronization remain separate pending work; iOS needs later build/device access.
