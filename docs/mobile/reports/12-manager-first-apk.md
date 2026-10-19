# First Android development APK

October17,2026, America/Los_Angeles. Local-only. APK build and inspection passed; installation and physical phone behavior remain untested. Owner selected Samsung S20+ first, then S21+5G. Android versions still pending.

## Actual result

Artifact: `C:\Projects\debtfree-dashboard\mobile\android\app\build\outputs\apk\debug\app-debug.apk`.

- Size:12,636,903 bytes (about12.6MB /12.05MiB).
- SHA256:`1e8417dace65cb9510cd0c982c0ba4e1f74f67a244a8c5a8a416fce7e613c1f0`.
- Application:`com.debtfree.dashboard.dev`, label DebtFree Dev, version1.0/code1; minSDK24, target/compile36.
- Actual APK signature verified by SDK apksigner: v2 signature, one Android Debug signer. This is a development build, not a release/store package. Debug key stays in private ignored Android user home.
- Actual APK manifest decoded with apkanalyzer, metadata confirmed by aapt2. Debuggable true, allowBackup/fullBackupContent false, extraction rules included, no explicit cleartext allowance. INTERNET and the app's signature-level dynamic-receiver permission are present. Launcher exported intentionally; FileProvider and Startup provider unexported. Standard ProfileInstallReceiver is exported with android.permission.DUMP required. No OAuth callback filter or connected native provider config.
- `npm run android:audit` passed: all18 mobile/dist files byte-for-byte equal inside APK, including OCR gzip asset; only two expected Cordova bridge files are extra; no native plugins, remote server URL/navigation override or forbidden private-config/database/key filenames found. This is scoped packaged-content evidence, not a general secret audit or network-runtime proof.

## SDK/build evidence

Owner said their interactive license review finished. Verified real license records and setup script's EOF-only "all licenses accepted" check before SDK package requests. No automatic yes input or generated acceptance records. Installed requested Platform36 revision2, Build Tools35.0.0 and Platform-Tools37.0.1 only; no emulator/system image/NDK/Studio. Metadata and android.jar/aapt2/apksigner/adb executable presence checked. No adb execution or device enumeration.

Java21.0.12.1, Gradle8.14.3, AGP8.13.0. All tool paths/process environment, Android user home/debug key and Gradle cache are under ignored `.wrangler/android-tools`; no persisted PATH/registry/environment changes. Free disk after build about31.5GiB.

First `gradlew.bat --no-daemon --console=plain assembleDebug lintDebug` succeeded in4m10s,132 tasks executed. Asset inspection then caught the issue below, so that artifact was not accepted. After correction the same build/lint command succeeded in49s,133 tasks (14 executed/119 up-to-date). Logs: ignored `.wrangler/mobile-round4-native-build.log` and `mobile-round4-native-build-final.log`. Signature/decoded manifest/audit evidence also saved under ignored `.wrangler/mobile-round4-*`.

App lint report has0 errors/10 warnings: template manifest ordering, available Gradle/AppCompat updates, redundant v24 resources, unused template resources, and missing monochrome themed-icon variants. No blanket suppression or dependency upgrade added. Capacitor dependency lint retains its upstream baseline (6 errors filtered); do not describe the entire dependency tree as zero-issue. Build also reports template flatDir warnings, unchecked upstream Java and SDK XML schema-version warning; none prevented this actual compile/lint. These remain review items before release, not claimed fixes.

## Packaging defect corrected

Initial APK inspection failed: `assets/public/ocr/lang/eng.traineddata.gz` was missing, replaced with expanded `eng.traineddata`. Confirmed its bytes equaled the decompressed original and inspected installed sdk-common31.13.0 bytecode: AssetItem strips gz suffix and MergedAssetWriter expands gzip during asset merge. Source assets/browser tests alone had not caught this native transformation.

Changed only native `mobile/android/app/build.gradle`: a declared-input/output prepareOcrLanguageAsset task generates an outer gzip layer in the ignored build directory; the original is excluded from Android asset merge and the generated file loses that outer layer during normal AGP processing. Resulting APK retains the original compressed bytes and .gz URL. No shared web/OCR runtime, browser asset or user-data file changed. Added `scripts/mobile/audit-apk.mjs` and package script android:audit so future builds verify this boundary. The audit failed against the first APK and passed against the corrected actual artifact; its source also passed ESLint. Native lint reran after the Gradle change.

This fixes packaging, not OCR runtime acceptance. WebView worker/WASM/image input and the complete receipt flow still require actual phone tests.

## Changes and preservation

This continuation changed native app/build.gradle, package.json (audit command only), new scripts/mobile/audit-apk.mjs, new ANDROID_PHONE_TEST.md, setup/board/queue documentation and this report. SDK/cache/build outputs are ignored. No lock/dependency/web UI/accounting changes. Prior accepted web315/unit4/demo-browser6 and full browser136/2 skipped results remain historical; not needlessly repeated for native-only changes. Existing shared source/Wrangler hashes and local-household payload fingerprint checked unchanged during and at end of work. No production/provider/cloud actions, commit/push/deploy or household overwrite.

No worker chat/status inspection, completion polling, messages or new assignments during this continuation. Owner's latest instruction requires waiting until they explicitly announce workers are ready; "finished" here referred to their license command. Updated manager documentation to preserve this distinction.

## Next action

Owner connects unlocked S20+ using a USB data cable with USB debugging enabled and reviews this PC's authorization prompt; provide Android version. Manager then verifies exactly one intended device without recording serials, rechecks APK hash and installs this development package. Do not uninstall/clear existing development data to bypass conflicts. Follow ANDROID_PHONE_TEST.md for cold/offline launch, category editing, payments/Progress, persistence/process restart, Back, keyboard/insets and larger text. D2 only completes after actual phone acceptance. Connected authentication/backend, native protected storage, export/OCR execution and iOS remain separate pending gates.
