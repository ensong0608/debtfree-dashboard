# First Android phone test

Owner selected the Samsung S20+ first on October17,2026. Samsung S21+5G follows. Record Android, One UI and Android System WebView versions before compatibility sign-off. Do not record phone serial numbers in shared reports.

This milestone tests **DebtFree Dev**, the bundled device-local application `com.debtfree.dashboard.dev`, initially seeded with samples. It does not connect to the production app or imported PC household. The owner subsequently explicitly requested to manually export the PC local copy and import that private JSON on the phone to test the flow. That manual import is authorized; never automatically copy the real data into fixtures/reports/logs or capture financial screenshots. Real sign-in/shared-household sync are a later milestone.

## Before connecting

Manager must finish APK assembly, native lint, asset/config/manifest/signature inspection and record the APK hash/size. A generated project or successful browser test is insufficient. See the latest manager build report for actual results; this checklist itself is not a test pass.

When the manager says the APK is ready, connect the unlocked S20+ with a USB data cable. Enable Developer options and USB debugging if needed, and review/accept the phone's prompt for this PC. Tell the manager it is connected and provide its Android version. Do not enable wireless debugging or expose the existing localhost app.

Manager then verifies there is exactly one intended connected device without publishing serials, verifies the APK's recorded hash, and installs that development package. If the development app already exists with test changes, preserve its state; do not uninstall or clear storage to work around a signing/version conflict without discussing recovery. Production app data is outside this package's scope.

## Owner-assisted checks

- Launch from its DF launcher icon; verify mint/teal theme, splash, visible demo marker and no production login/data. Check portrait and landscape for clipped controls, keyboard overlap and usable bottom actions.
- Open a debt, change its category using an existing category, add another category, then rename it in Settings. Verify filters/groups update and the single Debt+ entry remains usable.
- Make a sample balance/payment change, record a Progress snapshot and verify starting balance/history remain consistent. Close and reopen the app; confirm saved sample edits remain.
- Test Android Back while an editor/modal is open and from the main screen. Check Home/resume, backgrounding and a process restart. Report unexpected exits, lost drafts or navigation.
- Enable airplane mode, fully close and relaunch, then repeat a sample edit. Bundled launch and local sample persistence should work without any backend. Restore the phone's prior network setting afterward.
- Check numeric keyboard/decimal entry, larger system text, scroll behavior and tap targets. Capture actual failures before changing implementation.

Export/import/share, PDF download, OCR/camera, connected sign-in/session security and native encrypted draft recovery require separate checks; browser passes do not establish Android support. Owner's manual private-data import test is authorized; preserve the source backup and record only success/failure metadata. No automatic reset/clear/uninstall during acceptance. After an import, the build's static Synthetic demo label still identifies the test build; it does not establish that the loaded data is synthetic.

Record each check as pass/fail/not run, phone versions, exact APK hash and any reproduction steps. Repeat on the S21+5G after S20+ findings are resolved. Keep iOS explicitly untested until macOS/iPhone access is available.
