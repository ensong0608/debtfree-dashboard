# Agent report: Windows Android tooling and device acceptance

Date/time zone: October 17, 2026, America/Los_Angeles.
Status: complete (discovery only; native build and physical-device checks pending).
Owned files: `docs/mobile/reports/03-android-readiness.md` only.

## Inspected evidence

- Read `AGENTS.md`, `docs/mobile/README.md`, the assigned prompt and report template. The owner's local-only instruction applies; no production publishing workflow was run.
- Read `package.json:5` and `:8` (Node engine and scripts), `vite.config.ts:1` through `:36` (vinext/Cloudflare build and local-only plugin), `docs/MOBILE_DEVELOPMENT_PLAN.md`, and relevant mobile/status entries in `docs/PUBLIC_MOBILE_CHECKLIST_20261017.md`, `docs/STAGE6_HOUSEHOLDS_20261016.md` and `LOCAL_DEVELOPMENT_SETUP.md`.
- Checked only tool discovery, standard installation locations, public build output filenames, OS/CPU/RAM/free disk and git status. Did not inspect private state, exported financial files, tokens or credentials.
- Official references below were checked October 17, 2026. Version values are a discovery snapshot, not a reason to follow an unpinned `latest` dependency later.

## Findings

### Actual machine and repository facts

| Item | Observed state | Consequence |
|---|---|---|
| OS/CPU | Windows 11 Home x64, build 26200; Intel i5-8300H | Suitable baseline for Windows Android tooling; no BIOS/virtualization settings were changed or validated. |
| RAM / C: free | 15.9 GiB RAM; 35.1 GiB free | Prefer physical phones initially. Recheck free disk before installing; SDK/Gradle caches consume additional space. |
| Node/npm | Node 24.14.1, npm 11.11.0 | Meets Capacitor v8's Node 22+ requirement. |
| Java/JDK | `java` and `javac` not on PATH; `JAVA_HOME` unset | No usable command-line Java confirmed. Use Android Studio's bundled JDK after installation and verify the chosen Gradle JDK. |
| Android tools | `adb`, `sdkmanager`, `emulator`, `studio64`, `gradle` not on PATH | No native build/device tooling confirmed. Global Gradle is unnecessary when using the generated wrapper. |
| Standard locations | Android Studio under Program Files, SDK under LocalAppData/Android/Sdk or C:/Android/Sdk, Program Files/Java and Program Files/Microsoft absent | Evidence of missing standard installation, not proof that no custom portable install exists anywhere. `ANDROID_HOME`/`ANDROID_SDK_ROOT` unset. |
| Current app | No Capacitor dependencies, config, Android manifest or Gradle project found among project files excluding dependencies/generated/private state | An APK cannot yet be built from this repository. Existing `npm run build` produces the web Worker app. |
| Current web assets | `dist/client` exists; `dist/client/index.html` absent | Do not use `dist/client` directly as Capacitor `webDir`; it is not a standalone bundled client. |
| Phones (owner statement) | Samsung S20+ and Samsung S21+ 5G | Two useful physical Android test devices; installed Android, One UI and WebView versions remain unknown. No phone was inspected. |

The two phones provide same-platform and Samsung behavior coverage, not full Android vendor/OS coverage. Choose the S21+ as a proposed primary test device and S20+ as regression coverage; the owner can switch that preference. Do not infer the installed Android version or web-runtime compatibility from the model name. Capacitor's minimum WebView support also does not prove this app's compiled JavaScript works on an old WebView: record the actual provider/version and test the built bundle.

### Current official requirements

- [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup): v8 requires Node 22+, Android Studio 2025.2.1 or newer and an Android SDK. Studio supplies a JDK; a separate JDK installer is unnecessary. iOS needs macOS/Xcode, with a v8 baseline of Xcode 26.0. A cloud build does not replace physical iPhone testing.
- [Capacitor v8 Android upgrade baseline](https://capacitorjs.com/docs/updating/8-0): minimum Android API 24; compile/target API 36; AGP 8.13.0; Gradle wrapper 8.14.3. Treat generated templates for the selected pinned v8 patch as the implementation authority and reconcile plugin requirements before changing versions.
- [Official Capacitor 8.5.0 Android source](https://raw.githubusercontent.com/ionic-team/capacitor/8.5.0/android/capacitor/build.gradle): Java source/target compatibility is 21. Verify a compatible Studio JDK and `gradlew.bat --version`; do not select an arbitrary older Java from PATH.
- [Capacitor Android support](https://capacitorjs.com/docs/android): Android 7/API 24+ and WebView Chrome 60+ are framework baselines. Android 10+ uses Android System WebView. Update/record the real device WebView; the application and its plugins may need a stricter effective baseline.
- [Android Studio Windows requirements](https://developer.android.com/studio/install): 64-bit Windows 10 minimum, Studio-only 8 GB RAM/8 GB disk; Studio plus emulator 16 GB RAM/16 GB disk; recommended 32 GB RAM and SSD with 32 GB or more. CPU baseline includes Intel 8th-gen i5. The page currently offers Rabbit 1/2026.2.1. No emulator is necessary for the first USB-phone milestone. Our 35.1 GiB free exceeds the listed minima but is a limited working margin; reserve room for Gradle/dependency caches and remeasure rather than promising exact download size.
- [Capacitor installation](https://capacitorjs.com/docs/getting-started): requires a built asset folder with root `index.html`; `cap sync` copies it into native projects. Shared-source client extraction must come first.
- [Capacitor v8.5 migration](https://capacitorjs.com/docs/updating/8-5) includes an iOS scene-lifecycle change for Xcode 27. Recheck the selected template/Xcode pair when iOS work starts; historical Xcode 26 notes alone are not an iOS readiness pass.

### Proposed backend connection and isolation

1. **First APK: bundled synthetic demo with no server.** Package all UI/assets in the APK; use an explicitly synthetic fixture and a mobile-specific storage namespace. Disable connected auth/sync rather than pretending a local simulator is Google sign-in. This proves packaging and UI only.
2. **Connected development via USB (preferred next):** create a separate loopback-only development API on proposed port 8790 with its own configuration, fresh D1 state directory (for example `.wrangler/mobile-test-state`), synthetic seed and separate test identities. Before starting it, assert these paths/configs differ from `.wrangler/local-state` and production. Do not point the phone at port 8787 or its copied household. A future `adb -d reverse tcp:8790 tcp:8790` forwards phone localhost to the PC's isolated loopback service without opening a LAN listener. This command was not executed. Remove that mapping after testing. See the [official adb command reference](https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/docs/user/adb.1.md).
3. **Transport remains an explicit implementation decision:** bundled Android origin defaults to `https://localhost`, so fetch/CORS/mixed-content and cookie behavior must be tested. USB forwarding alone does not solve authentication or WebView security. Prefer trusted development HTTPS or a reviewed native transport; if HTTP is necessary for an initial synthetic debug test, use a scoped debug-only network security configuration/transport, no real credentials, and verify the release merged manifest/config excludes cleartext/mixed-content exceptions. Do not weaken the web API's origin/CSRF checks. Authentication agent must define the real native API contract first.
4. **Remote isolated HTTPS test backend (later alternative):** useful for browser OAuth callbacks and two-device synchronization without a cable. Requires separately authorized development resources/provider setup and synthetic-only households. No tunnel to 8787, production reuse, broad LAN binding, firewall opening or service creation in this round.

[Capacitor config](https://capacitorjs.com/docs/config) explicitly treats `server.url`, cleartext and navigation overrides as development mechanisms. Keep bundled assets and normal secure defaults in release configuration. Check generated/native configuration as well as TypeScript source; stale `cap sync` output can retain a debug override.

## Recommended implementation slices

Paths below are proposed ownership boundaries; manager must reconcile architecture/authentication reports before assigning them.

| Slice | Dependencies / one owner | Proposed exact files | Acceptance / durable output |
|---|---|---|---|
| 1. Standalone synthetic client | Architecture decision; client owner | `mobile/index.html`, `mobile/main.tsx`, `mobile/vite.config.ts`, `mobile/fixtures/demo.ts`; coordinated edits to `package.json`/lockfile only by assigned integrator | Build standalone `mobile/dist/index.html`; no server/Next/Cloudflare-only imports in bundle, no production endpoints/private payload. Existing theme/categories/Progress behavior retained. Focused browser smoke then lint/types/accounting tests if shared code changes. Report files changed/commands and synthetic screenshots. |
| 2. Windows native toolchain | Tooling owner, after manager authorizes installation/download sequence | Proposed `scripts/mobile/doctor.ps1`, `docs/mobile/ANDROID_SETUP.md` | Install official Studio and SDK API36/platform-tools/compatible build-tools; record actual JDK/SDK/AGP/wrapper versions and free space. Avoid emulator download initially. Doctor must redact serials and never print env secrets. No production/cloud credentials required. |
| 3. Bundled Android debug APK | Slices1/2; packaging owner owns shared manifest/config | `capacitor.config.ts`, generated `android/` including wrapper, `android/app/build.gradle`, `android/app/src/main/AndroidManifest.xml`, resources; `.gitignore`, package scripts by integrator | Distinct development application id/name; minSdk24 unless dependencies require higher; pinned compatible Capacitor packages. `cap sync android`, `android/gradlew.bat --version`, `assembleDebug` and Android lint. APK contains bundled assets, no `server.url` or production financial fixture, starts without PC/network. Capture hash/size and redacted build manifest. No release-key generation/store submission. |
| 4. Phone UI and lifecycle | APK ready; platform owner + owner at phone | Proposed `mobile/platform/android.ts`, narrowly scoped shared UI/CSS changes and focused tests | Run matrix below on both phones. One device at a time for USB commands avoids serial exposure. Record versions, build hash, screenshots and pass/fail/untested. A desktop screenshot is not a pass. |
| 5. Connected native session/sync | Reviewed authentication contract and isolated backend | Auth-agent-owned adapter/API files; proposed `wrangler.mobile-test.jsonc`, `scripts/mobile/test-backend.mjs`, separate fixture/seed | Native login/cancel/expiry/logout, household membership, conflict/retry and two-device tests against synthetic data only. No coupling to existing imported household. Unit/API tests of security and replay behavior before device sign-in. Add Android build/test checks after integration. |

Minimal future Windows build sequence, **not run**: install and verify tooling; build standalone mobile assets with the new assigned script; `npx cap add android` once; `npx cap sync android` after web/native changes; from `android/`, run `./gradlew.bat assembleDebug` and `./gradlew.bat lintDebug`. Expected default artifact: `android/app/build/outputs/apk/debug/app-debug.apk`. Use the wrapper rather than installing global Gradle. [Android command-line build instructions](https://developer.android.com/build/building-cmdline) describe debug signing and APK output. Debug signing is automatic for development, not a release signing/recovery plan.

After each small implementation slice run only its meaningful focused checks. Once integrated, the manager runs lint/typecheck/build and the existing full automated suite once, followed by the actual Android build/device gate. Do not start concurrent full browser servers or turn old web results into a native pass.

### Physical-device acceptance matrix

All rows are pending. Record S20+/S21+ separately; repeat critical flows on both. Demo and connected checkpoints have different completion criteria.

| Area | Automated evidence | Manual owner/device acceptance |
|---|---|---|
| Install / first launch | APK manifest/assets/hash check; no remote startup URL | Install development app; airplane-mode cold launch shows synthetic demo; no blank screen, unwanted permission prompt or existing-app collision. |
| Theme / screens | Existing viewport screenshots, focused client smoke | Mint/teal theme, 8px corners, all tabs, categories/add/edit/settings and Progress snapshots; no notch/status/gesture-bar overlap. Portrait and landscape; no horizontal overflow. |
| Keyboard / long forms | Form validation tests | Samsung keyboard open/close, decimal fields, long names, scrolling, focused input visible, Save/Cancel reachable and no accidental submit. |
| Back / drafts | Navigation-state tests | Test gesture and three-button Back: keyboard, modal, nested screen then exit; unsaved changes preserved or explicit discard flow; no silent payment loss. |
| Background / restart | State-adapter tests | Home/lock/unlock/return, process removal and relaunch; correct selected household and saved draft; no stale balance overwrites. OS-kill timing documented. |
| Network / retry (connected slice) | Revision/conflict/retry tests, duplicate-operation prevention | Airplane mode before/during save, restore connection, retry once; no duplicate payment or false saved status, pending draft retained. |
| Storage / accounts (connected slice) | Namespaced cache/outbox/session tests | Logout/account switch/removed membership; no previous household flash or pending write sent as another identity. Two phones concurrently edit synthetic household; conflict recovery preserves both histories. Never clear existing real app/browser storage. |
| Accessibility | axe and semantic/form tests | TalkBack focus/order/labels, category chooser and dialogs, large font/display scaling, contrast/targets, no clipped balance/footer. |
| Export / share | Export format tests and native adapter mocks | Export only synthetic data using Android share/save chooser; correct file opens in a chosen viewer; cancel returns safely; permissions minimal. Browser download success alone is insufficient. |
| Native login/deep links (connected slice) | State/PKCE/callback/replay tests | Real separate development provider login, cancel, expiry, app cold/warm callback, no secret URL/log leakage. Demo APK does not satisfy this row. |

Expected handoff artifacts: APK + SHA256/size/version and source revision/dirty patch description; redacted toolchain/build report; mobile config/merged-manifest safety check; synthetic screenshots; per-device matrix including Android/One UI/WebView version; failures/reproduction steps; and explicit untested items. Suggested durable reports: `docs/mobile/reports/04-client-spike.md`, `05-android-build.md`, `06-device-acceptance.md`, `07-connected-auth.md`, assigned one owner each. Do not include device serial, IMEI, email/token, real household data or full unfiltered logcat.

## Verification actually performed

- `Get-Command` for Node/npm/Java/Javac/adb/sdkmanager/emulator/studio64/Gradle; Node/npm version commands; presence checks of standard folders and SDK/JAVA environment variables.
- `Get-CimInstance` for OS/CPU/RAM; `Get-PSDrive C` for free storage. No system settings modified.
- `git status --short` confirmed pre-existing source/setup edits; `rg --files` scoped away from dependencies/generated/private state; public `dist/client` filename listing and root-index existence check.
- Source/config/document reads described above and official-document browsing. No installs, dependency changes, downloads of installers, emulator/server/process operations, native builds, device/adb session, automated app suite or real-provider test ran.
- Historical web test counts in the work board were not rerun and establish no physical-device result. No iOS build, simulator, iPhone or Mac check ran.

## Blockers and owner input

**Now:** no immediate owner action blocks client extraction/design. Record Android and One UI versions for each phone under Settings > About phone > Software information when convenient. Original requirements file is still missing; the historical checklist is incomplete evidence. Confirming those does not require passwords, serial numbers or IMEI.

**Before first build/device session:** Android Studio/SDK/JDK toolchain is not confirmed installed. Recheck space and install only after assignment; SDK licenses/downloads may need the owner's interactive acceptance. Have a USB data cable available. Once an APK is ready, guide owner to Developer options (Samsung typically About phone > Software information > tap Build number seven times), USB debugging, connect/unlock and approve only this PC's RSA prompt. Install with Studio Run or `adb -d install -r <APK>` with one phone connected. Windows may require the official Samsung OEM USB driver if detection fails. [Official device setup](https://developer.android.com/studio/run/device). No debugging setting needs changing now.

**Before connected testing:** separate native auth/API contract and isolated test backend/provider configuration. Phone loopback does not point to the PC without deliberate forwarding. Do not reuse current 8787 data or change its host/origin guards.

**Later:** reliable iPhone tester and macOS/Xcode build/signing access; current native minimums and template lifecycle must be rechecked then. Android-only acceptance does not close iOS rows. Store identities, purchases, pricing, subscriptions and release signing are outside this milestone.

## Changes made and handoff

Created only this report. No source/config/dependency changes; no production/private-data access, commit, push, deployment, installation or process side effects.

Next concrete task: manager reconcile architecture/auth reports, assign the standalone synthetic-client slice with exact file ownership, then toolchain setup and bundled debug APK. Owner's two Samsung phones make physical Android testing viable without an emulator purchase or immediate Mac access.

## Continuation — October 17, 2026 (America/Los_Angeles)

Status: handoff review complete; setup/build assignment below is for later execution, not authorization or evidence of execution. Original discovery above is preserved.

### Rechecks and corrections

- Confirmed repository `C:\Projects\debtfree-dashboard`, branch `local/windows-development-20261016`; existing modified/untracked work remains. Read AGENTS, mobile board/prompt, report/template and package scripts. No `build:mobile` script, Capacitor package/config or native Gradle/manifest project is currently available. `dist/client/index.html` remains absent. The current web build is not an APK build input.
- Re-ran command discovery: Node 24.14.1/npm 11.11.0 available; Java/Javac/adb/sdkmanager/emulator/studio64/Gradle absent from PATH. JAVA_HOME, ANDROID_HOME and ANDROID_SDK_ROOT unset; standard Studio, LocalAppData SDK, C:\Android\Sdk and Program Files\Java directories absent. These are observed discovery gaps, not proof that a custom/portable installation is absent. Before installing, ask only for any known custom Studio/SDK location and verify that explicit location; avoid a whole-disk scan. No global Gradle installation is required.
- C: free space rechecked at 35.1 GiB. CPU/RAM/OS findings above were not remeasured. Phone Android/One UI/WebView versions remain unverified; S20+ and S21+ 5G model names cannot supply those values.
- Rechecked [Capacitor environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup) and [v8 Android baseline](https://capacitorjs.com/docs/updating/8-0): Node 22+, Studio 2025.2.1+, SDK compile/target 36, minSdk 24, AGP 8.13.0 and wrapper 8.14.3. Keep these as a baseline; later integrator must pin one compatible Capacitor patch and inspect its generated template. Do not force these baseline versions over a newer selected template. Studio's bundled JDK must be verified for Java 21 source compilation; its presence alone does not prove the terminal/Gradle uses it.

### Exact next assignment: Windows toolchain, then bundled synthetic debug APK

Manager assigns one tooling/packaging owner, coordinating shared package/config ownership with the client owner. Proposed writable scope for that future task: `scripts/mobile/doctor.ps1`, `docs/mobile/ANDROID_SETUP.md`, `docs/mobile/reports/05-android-build.md`; a separate packaging assignment must explicitly own `package.json`, lockfile, `capacitor.config.ts`, `.gitignore` and generated `android/`. This continuation grants no writes to those files.

1. **Agent preflight, before downloads:** inspect dirty status, recheck free disk, verify any owner-provided custom installation. Record chosen Studio/JDK/SDK paths and versions without printing unrelated environment variables. If absent, prepare official Studio Windows installer and SDK component list for the authorized setup session. Use [official Studio](https://developer.android.com/studio); skip emulator/system images for the first phone milestone.
2. **Owner-interactive setup:** owner accepts installer/SDK licenses and any Windows elevation prompt. Install Studio and use SDK Manager for Android SDK Platform 36, Platform-Tools, Command-line Tools (latest), and the Build-Tools revision required by the selected generated AGP project. Record the exact installed revision; do not guess a Build-Tools version or blindly install every platform. Agent may perform authorized noninteractive setup/checks later, but must not auto-accept licenses with piped yes. No account purchase or release signing key is needed.
3. **Agent verification:** use verified paths; set JAVA_HOME to the chosen compatible Studio `jbr` and ANDROID_HOME to the SDK in the current PowerShell session only. Invoke `& "$env:JAVA_HOME\bin\java.exe" -version`, `& "$env:JAVA_HOME\bin\javac.exe" -version`, `& "$env:ANDROID_HOME\platform-tools\adb.exe" version`, and `& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --list_installed` (adapt `latest` to the actual selected directory). Do not persist PATH or run adb device enumeration during tooling-only checks. After native generation, `android\gradlew.bat --version` must identify the selected JVM and wrapper. Stop on incompatible/missing components and record the precise gap.
4. **Client/packaging prerequisite:** client owner first delivers a standalone synthetic bundle and an assigned `build:mobile` script producing `mobile/dist/index.html`; proposed paths remain subject to architecture review. Packaging owner pins compatible Capacitor core/android/cli versions, selects a distinct development app id/name and configures `webDir: "mobile/dist"` without `server.url`. Use local installed CLI (`.\node_modules\.bin\cap.cmd`), avoiding an implicit npx download. Run `cap.cmd add android` once only after config/dependencies exist; use sync on subsequent builds.
5. **Agent build, only after prerequisites:** from the repository, run the following PowerShell commands separately, checking each exit code before continuing. Gradle may download its pinned distribution/dependencies; this belongs to the later authorized build session.

```powershell
npm run build:mobile
Test-Path -LiteralPath mobile/dist/index.html
.\node_modules\.bin\cap.cmd sync android
Push-Location android
.\gradlew.bat --version
.\gradlew.bat assembleDebug lintDebug
Pop-Location
Get-Item android/app/build/outputs/apk/debug/app-debug.apk | Select-Object Length
Get-FileHash android/app/build/outputs/apk/debug/app-debug.apk -Algorithm SHA256
```

A false index check or nonzero build/lint exit stops the sequence. `build:mobile` and the native paths do not exist yet; do not run this block against today's repository. Android automatically debug-signs the development APK; inspect bundled assets, generated Capacitor config and merged debug manifest for the intended app id, synthetic-only content, no remote startup URL and no unnecessary cleartext exception. Report build/lint output locations and actual versions. See [official command-line builds](https://developer.android.com/build/building-cmdline).

6. **Owner/device checkpoint, after APK review:** owner records Android/One UI/WebView versions, enables developer options/USB debugging, connects one unlocked phone using a data cable and accepts this PC's RSA prompt. Agent then uses the verified adb path with `-d install -r` on the exact hashed APK; no unfiltered serial listing/logcat. Owner performs airplane-mode launch and the pending matrix above on S21+ then S20+. USB drivers are a detection contingency, not an assumed prerequisite. Follow [official physical-device setup](https://developer.android.com/studio/run/device). A successful build does not satisfy this checkpoint.

Deliver `05-android-build.md` with source revision plus preserved dirty-work description, installed tool versions/paths, exact successful commands, APK path/bytes/SHA256, asset/config/manifest checks, lint report and explicit remaining device/auth/iOS rows. No real financial payloads, device identifiers or credentials in artifacts. Connected testing is a subsequent assignment: separate synthetic backend and reviewed native auth contract; never expose or forward localhost:8787, its state or imported data. No backend/server/device action occurred during this review.

### Checks actually run and remaining blockers

Ran document/package reads, `git status --short`, `git branch --show-current`, scoped `rg --files`, `Get-Command`, Node/npm versions, standard-path/environment-presence checks, `Get-PSDrive C`, root client-index existence check and official-document browsing. No installers/downloaded tooling, dependency/source edits, builds/tests, servers/emulators, device sessions, cloud connections, commits or deployments. Only this dated continuation was appended to the owned report.

Next action: manager accepts the standalone synthetic-client boundary and assigns the toolchain setup scope above for later execution. Immediate blockers to APK: no confirmed Android/JDK toolchain and no standalone client/native packaging. Phone versions are needed before physical acceptance; owner license/USB interaction is needed at the corresponding later checkpoints. Real native auth and iOS testing remain pending.
