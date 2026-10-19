# Windows Android setup

Updated October 17, 2026 (America/Los_Angeles). Owner completed interactive SDK license review. Platform36 revision2, Build Tools35.0.0 and Platform-Tools37.0.1 are installed in ignored `.wrangler/android-tools/sdk`. The development APK built successfully, passed native lint with0 errors/10 warnings and passed packaged asset/config/signature checks. Phone testing is still pending; S20+ is first. See `reports/12-manager-first-apk.md` and `ANDROID_PHONE_TEST.md`. The setup sections below retain commands and prerequisite behavior for future machines.

Device update: S20+ (SM-G986U1, Android13/API33) is now installed and cold-launched successfully. Initial synthetic screen visually checked; functional/offline/restart testing is still pending. See `reports/13-s20-install-launch.md`.

## Run the read-only doctor

From `C:\Projects\debtfree-dashboard`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\mobile\doctor.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\mobile\doctor.ps1 -Json
# Optional known installation ROOT directories (not executable filenames):
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\mobile\doctor.ps1 -JavaPath 'C:\Program Files\Android\Android Studio\jbr' -StudioPath 'C:\Program Files\Android\Android Studio' -SdkPath "$env:LOCALAPPDATA\Android\Sdk" -Json
```

Exit codes: **0** = prerequisite files/metadata found, still not build-ready; **1** = normal discovery gaps; **2** = doctor failure, invalid explicit directory, unreadable metadata or failed/timed-out version process. JSON `status` distinguishes `prerequisites-found`, `unready`, `error`; `buildReady` is always false. JSON is the only stdout in JSON mode. Shell argument-binding errors occur before the script and follow PowerShell's own error behavior.

Search is limited to explicit roots, JAVA_HOME/ANDROID_HOME/ANDROID_SDK_ROOT, standard Studio/SDK locations and executable PATH discovery. JavaPath takes precedence over JAVA_HOME then discovered Studio JBR then PATH; SDK selection takes the first existing directory (explicit, selected variables, standard paths, then adb PATH inference). An incomplete selected SDK is reported, not silently merged with another installation. Custom installations elsewhere may exist. The doctor invokes only Node/Java/Javac version commands with five-second process limits; it terminates only its own timed-out version child. It never executes adb, sdkmanager, Gradle or Studio, enumerates devices, starts services, changes PATH or reads project financial state. SDK versions come from source.properties plus expected executable presence. Metadata can be stale/incomplete; no license or package-integrity pass is implied. Errors suppress raw subprocess/exception text.

## Portable command-line setup (current path)

Use Windows PowerShell from `C:\Projects\debtfree-dashboard`. No elevation, global PATH, Studio launch or emulator is needed for this command-line build attempt. [Google documents headless SDK management](https://developer.android.com/tools/sdkmanager) and [Gradle supports Java21 from 8.5 onward](https://docs.gradle.org/current/userguide/compatibility.html). Capacitor's documented Studio workflow remains available later; CLI compilation will only be proven by the actual build.

```powershell
# Default/status: read-only, no network or tool execution
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\mobile\setup-android.ps1
# Explicit preparation: pinned archives/checksums, no SDK package/license acceptance
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\mobile\setup-android.ps1 -Mode Prepare
```

Status exit 0 means Java/SDK candidate roots found, 1 means missing roots, 2 means script failure. It is not license/compatibility/build validation. Prepare exit 0 means JDK21 compiler and sdkmanager version checks succeeded; 2 means error. Existing complete private extractions are reused; retained canonical archives are rehashed during Prepare. Downloads go to a same-directory `.part` file under an exclusive archive-workflow lock and are promoted only after SHA256 passes. Interrupted/mismatched `.part` and mismatched canonical caches are retained for inspection, never overwritten or executed. A verified retained `.part` can be promoted on retry without another download. Incomplete/unmarked extraction stops without replacement/deletion. Known JAVA_HOME/Studio JBR and SDK variables/standard roots are checked first; explicit `-JavaHome`/`-SdkRoot` directories are supported. External SDK roots are read-only candidates; this script refuses preparation/install writes outside its private root rather than duplicate or overwrite that SDK. Version checks are bounded; only their own timed-out child is terminated. All mutations remain inside the ignored private tool root, with reparse-point and containment checks before writes/moves. No global environment is persisted.

Pins: Temurin JDK21.0.12.1+1 Windows x64 archive (SHA256 `f9d6e191ab098c0d416e7d588a24420a8621cd2f4720dab2459b8b7b2d2d8b4e`); Google commandlinetools-win-15859902 archive, revision22.0 (SHA256 `90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a`). Exact official URLs are pinned in script/report09. JDK NOTICE/legal and Google NOTICE/source.properties remain with extraction. Pin updates require review, never implicit latest resolution.

Current generated native project is `mobile/android`, Capacitor8.5.3, Gradle8.14.3, AGP8.13.0, Java source/target21, min24/compile36/target36. [AGP8.13 compatibility table](https://developer.android.com/build/releases/agp-8-13-0-release-notes) specifies default Build Tools35.0.0. Minimal later SDK list: `platforms;android-36`, `build-tools;35.0.0`, `platform-tools`; no NDK/system images/emulator. Java21 exceeds AGP's minimum17 because Capacitor compiles source21. Do not substitute JDK17.

### Owner step: accept SDK licenses interactively

On a new setup, accepted SDK license records must exist before SDK installation; archive preparation is not consent. On this machine the owner has now completed this step. To review official prompts interactively when needed:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\mobile\setup-android.ps1 -Mode ReviewLicenses
```

ReviewLicenses verifies the prepared tools and sets their paths only in its child process, then inherits your terminal input/output for official prompts. It does not install SDK packages; the agent has not run this interactive mode. Do not pipe yes or copy/generated license hashes. The official sdkmanager page now recommends Android CLI as its successor but still documents this pinned command-line package and license workflow; adding another unrelated CLI is unnecessary for this controlled build attempt.

After owner acceptance and manager confirmation, the agent may run the exact minimal install below in PowerShell (array syntax matters; do not use `powershell.exe -File` with a comma-joined package string):

```powershell
& .\scripts\mobile\setup-android.ps1 -Mode InstallSdk -LicensesAccepted -Packages @('platforms;android-36','build-tools;35.0.0','platform-tools')
```

InstallSdk requires the explicit post-interaction switch and an owner-created license record, checks `--licenses` with closed stdin (no acceptance), then requests only reviewed packages. Failure/unresolved licenses stop without package requests. SDK installs can need several GiB; recheck disk before the authorized install. Native Gradle/build/dependency caches require further margin. The machine had roughly35GiB free before portable preparation; exact footprint is in report09. Later build shell must set verified JAVA_HOME/ANDROID_HOME and private GRADLE_USER_HOME; packaging/manager owns build commands and native local.properties. No script changes native/package files.

Studio GUI may be installed later using [official Studio](https://developer.android.com/studio/install) if needed; do not download it just to satisfy the doctor's Studio-oriented discovery gap. Doctor missing-Studio output is not evidence the verified CLI path cannot compile. Exact installed SDK metadata and wrapper JVM must be checked before claiming build readiness.

## Rebuild the current development APK

From the repository root in PowerShell, keep tool paths process-local:

```powershell
$env:JAVA_HOME = Join-Path (Get-Location) '.wrangler/android-tools/temurin-21.0.12.1/jdk-21.0.12.1+1'
$env:ANDROID_HOME = Join-Path (Get-Location) '.wrangler/android-tools/sdk'
$env:ANDROID_USER_HOME = Join-Path (Get-Location) '.wrangler/android-tools/android-user'
$env:GRADLE_USER_HOME = Join-Path (Get-Location) '.wrangler/android-tools/gradle'
npm run android:sync
if ($LASTEXITCODE -ne 0) { throw 'Mobile bundle/sync failed' }
npm run android:debug
if ($LASTEXITCODE -ne 0) { throw 'Native build/lint failed' }
npm run android:audit
```

Output: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. The audit checks all18 original web assets against actual APK contents, development config, plugin list and unexpected file entries, and records size/SHA256 under ignored `.wrangler`. SDK apksigner/manifest inspection are separate manager checks. Android's asset merger expands `.gz` assets; the native Gradle task adds one outer compression layer for the OCR language file so the packaged original path/bytes remain intact. Do not remove that task or weaken the asset audit to accommodate renamed files. No shared web/OCR runtime source was changed for this fix.

## Separate completion gates

- **Bundled demo:** standalone client with synthetic fixtures and isolated local storage, root `index.html`, no server dependency; browser checks only.
- **APK:** packaging owner pins Capacitor dependencies/config, distinct development app id/name and generated native project. After the mobile build, local `cap.cmd sync android` and generated `mobile/android/gradlew.bat assembleDebug lintDebug` must pass. Inspect APK assets/config/merged manifest, report size/SHA256 and source state. No `server.url`, real household fixture or unnecessary cleartext allowance. See [Android command-line builds](https://developer.android.com/build/building-cmdline). Packaging/manager owns execution and validation of those commands.
- **Physical devices:** only after APK review. Owner records Android, One UI and WebView versions for Samsung S20+ and S21+ 5G, enables USB debugging, connects one unlocked phone with a data cable and accepts this PC's RSA prompt. Later agent installs the exact hashed APK using verified adb `-d install -r`; avoid serial output. Use [official device instructions](https://developer.android.com/studio/run/device); OEM USB driver is a contingency. Airplane-mode cold launch plus the matrix in `reports/03-android-readiness.md` is required on each phone. Build/browser passes do not count as device results.
- **Connected auth:** subsequent reviewed native session contract and a separate synthetic backend/provider. Never route to, forward, tunnel or expose existing localhost:8787 or its copied data. USB transport alone does not solve auth/CORS/TLS. Keep release secure defaults.
- **iOS:** shared code readiness does not replace macOS/Xcode build access and physical iPhone testing, both still pending. Release signing, purchases and store submission are later work.




Cache correction October17: canonical `downloads/temurin-21.0.12.1.zip` is now the complete205,073,461-byte hash-verified archive. The old partial was quarantined as `downloads/temurin-21.0.12.1.partial-20261017.zip`; the verified alternate copy remains. No unrelated files were removed.
