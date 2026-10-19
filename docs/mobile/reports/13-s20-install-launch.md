# Samsung S20+ install and first launch

October17,2026, America/Los_Angeles. Local development device check only. Owner reconnected the phone after its original USB connection only charged. No driver installer or global configuration changes were needed.

## Verified device and installation

- Exactly one ADB device, state authorized/device. Windows Samsung USB/ADB interfaces report OK. Serial numbers were not printed or saved in this report.
- Model SM-G986U1 (owner's S20+); Android13, API33; One UI raw system property50100; current Android System WebView155.0.8059.43.
- APK SHA256 rechecked before installation: `1e8417dace65cb9510cd0c982c0ba4e1f74f67a244a8c5a8a416fce7e613c1f0`, matching report12's inspected artifact.
- `com.debtfree.dashboard.dev` was not already installed. `adb -d install -r` returned Success. No uninstall, clear-storage, downgrade, permission-grant override or production-package operation.
- Explicit MainActivity launch returned Status ok / LaunchState COLD, TotalTime620ms. Confirmed development activity foreground and own process running afterward.
- App-PID-filtered AndroidRuntime/chromium/Capacitor error log was empty at this startup check. This is not proof all future paths are error-free.

## Visual evidence and limits

Captured only after confirming development app foreground, using adb exec-out screencap. Ignored screenshot: `.wrangler/mobile-s20-first-launch.png`. Reviewed image shows synthetic demo marker, saved-on-device label, sample debts/category tabs, mint/teal theme, single Debt+ button and bottom navigation. No blank/error startup screen or obvious initial-screen clipping observed. OS status/navigation areas and app content are separated in this portrait launch.

No taps/financial edits, keyboard test, rotation, Back, persistence/process-death, network toggling/offline cold launch, export/OCR or connected authentication tested in this step. Current startup success does not establish D2/D4 functional acceptance. No user data/other apps inspected beyond connection interfaces and selected OS/WebView properties. Do not infer connected data/auth from the sample app.

## Next checks

Owner-assisted category editing and Settings rename, payment/Progress/history, closing/reopening, Android Back/keyboard/insets and offline launch remain in ANDROID_PHONE_TEST.md. Preserve sample edits; no automatic reset/uninstall. Then test S21+5G. Production and imported localhost household stay separate from this installed development package. No worker chats/statuses checked or messages sent during this continuation.

## Owner follow-up: manual import passed

Owner subsequently requested to import their PC local-copy JSON themselves, then reported "the import worked beautifully." Record import as an owner-reported pass on S20+; no private file content, financial values, device screenshots or imported payload read/captured for this follow-up. Restart persistence/category/payment checks remain unconfirmed. Owner wants to share the APK independently to S21+; share the original APK file through My Files/Quick Share after copying it from PC, then import a backup separately on S21+ if desired. Installed user data is not part of this original APK; no automatic inter-device sync. No automatic device file transfer, worker check, reset or uninstall.
