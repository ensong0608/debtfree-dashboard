# Agent report: portable Android toolchain preparation

Date/time zone: October 17, 2026, America/Los_Angeles.
Status: portable tool preparation complete; SDK packages blocked on owner license acceptance. No native build/device pass.
Owned files: NEW `scripts/mobile/setup-android.ps1`, updated `docs/mobile/ANDROID_SETUP.md`, NEW this report. Authorized ignored cache/extractions only under `.wrangler/android-tools`.

## Inspected evidence

Read AGENTS, mobile board, prompt08, doctor, report05 and manager report07. Preserved existing user and other worker changes. Rechecked standard/selected Java/SDK roots; no usable prior tools were discovered here before preparation. Existing custom roots can be passed explicitly; no disk-wide scan. Checked `.wrangler/android-tools` is ignored, and measured free disk before downloads (~34.8 GiB).

Generated project evidence (read-only): `mobile/android/variables.gradle` min24/compile36/target36; `build.gradle` AGP8.13.0; wrapper Gradle8.14.3-all; installed Capacitor Android library source/target Java21. Manager confirmed pinned Capacitor8.5.3. No native/package/lock/client/doctor file written by this worker.

Official references checked October17:

- [Google command-line tools download](https://developer.android.com/studio#command-tools): official archive and SHA256, CLI-only option without Studio.
- [SDK manager](https://developer.android.com/tools/sdkmanager): headless layout, `--sdk_root`, package/interactive license workflow. Page now recommends Android CLI as successor, but still provides/documents sdkmanager. We use pinned verified package22.0 rather than introduce another CLI. Deprecation does not establish this pinned build attempt passed.
- [AGP8.13 table](https://developer.android.com/build/releases/agp-8-13-0-release-notes): Build Tools default/min35.0.0; API36 compatible. Native project has no explicit Build-Tools override. Exact minimal later packages: `platforms;android-36`, `build-tools;35.0.0`, `platform-tools`. No NDK, emulator or system images requested.
- [Gradle Java compatibility](https://docs.gradle.org/current/userguide/compatibility.html): Java21 supports running Gradle from8.5; compatible with generated8.14.3. Capacitor source21 requires JDK21 despite AGP's lower minimum17.
- [Adoptium archive installation](https://adoptium.net/installation/archives), official Adoptium API metadata and release checksum/JSON below. No third-party installer scripts or mirrors.

## Prepared artifacts and provenance

| Archive | Official URL / SHA256 | Result |
|---|---|---|
| Eclipse Temurin21.0.12.1+1, Windows x64 HotSpot JDK | `https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_x64_windows_hotspot_21.0.12.1_1.zip`; `f9d6e191ab098c0d416e7d588a24420a8621cd2f4720dab2459b8b7b2d2d8b4e` | Verified205,073,461-byte archive `downloads/temurin-curl-21.0.12.1.zip`; compiler21.0.12.1. |
| Google Android command-line tools build15859902, revision22.0 | `https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip`; `90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a` | Verified155,655,386-byte archive `downloads/commandlinetools-win-15859902.zip`; sdkmanager22.0. |

JDK hash agreed with both `https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse` snapshot and the pinned release `.zip.sha256.txt`. Pinned release `.zip.json` saved as ignored `temurin-release-metadata.json`. The API latest endpoint was used only for discovery; script uses exact pinned URL/hash. One exploratory version-specific API endpoint returned404; pinned release metadata/checksum were fetched successfully instead.

Extracted paths:

- JAVA_HOME: `C:\Projects\debtfree-dashboard\.wrangler\android-tools\temurin-21.0.12.1\jdk-21.0.12.1+1`.
- ANDROID_HOME: `C:\Projects\debtfree-dashboard\.wrangler\android-tools\sdk`.
- SDK manager: `sdk\cmdline-tools\15859902\bin\sdkmanager.bat` beneath tools root. Archive's top folder was normalized with checked source/destination moves, no overwrite/deletion. Package source.properties says revision22.0. Folder label15859902 pins archive build rather than claiming SDK revision.
- JDK `NOTICE`, `legal/`, release metadata and Google `NOTICE.txt`/source.properties retained. Preparation does not claim license consent on owner's behalf.

Initial Windows PowerShell Invoke-WebRequest transfer progressed slowly. A separate bounded curl transfer from the same official URL completed and matched the published hash; only that verified archive was extracted. The redundant original task-owned transfer was cancelled (its session only), leaving a199,436,741-byte partial `downloads/temurin-21.0.12.1.zip`, never extracted/executed. It is retained for inspection, not used as a fallback. If extraction must be recreated later, this partial filename must be reviewed/quarantined within private tools root before retry; script rejects mismatching cached hashes and does not auto-delete/overwrite. No unrelated process was stopped.

Final root footprint1,083,922,397 bytes (~1.01GiB), including both JDK copies/partial and34-byte synthetic hash fixture; free C: about33.9GiB. No user-data cleanup performed. Later SDK/Gradle caches need additional room.

## Script behavior and executed verification

`setup-android.ps1` modes:

- **Status** (default): read-only roots/disk JSON; no network/tool execution. Exit0 = candidate roots found,1 = missing roots,2 = script failure. `nativeBuildVerified=false` always. Does not pretend directory presence proves licenses/build.
- **Prepare**: verified pinned download/extraction in private ignored root; existing complete extracted tools reused; bounded java/javac/sdkmanager version subprocesses. Exit0 = compiler21/sdkmanager version verified,2 = failure. No SDK package installation or license acceptance. Environment changes process-local only.
- **ReviewLicenses**: owner-only interactive official sdkmanager --licenses with inherited stdin/stdout after tool verification. No automatic answers/package installation. Implemented, NOT RUN by agent.
- **InstallSdk**: requires owner-interaction confirmation switch, exact scope-limited packages, existing license record and EOF-only check that all current licenses are accepted before package install. No yes/accepted-hash synthesis. NOT RUN beyond precondition rejection; SDK packages remain absent.

Checks actually run:

1. AST syntax parse passed, repeated after final changes.
2. Initial default status exit1; after preparation default status exit0 with expected roots and buildVerified false. File names/lengths/timestamps stable across status (only the then-running redundant download excluded from comparison); no writes caused by status.
3. Actual verified Java/compiler and sdkmanager version checks succeeded. Prepare rerun repeatedly exit0; javac.exe/sdkmanager.bat SHA256 fingerprints unchanged across repeated Prepare. Normalized SDK layout persisted correctly.
4. InstallSdk without `LicensesAccepted`, with absent actual license record, and with disallowed system-image package all rejected before package requests. Final controlled exit2 verified. An initial catch used Write-Error under Stop and yielded exit1; changed to redacted plain output plus explicit exit2 and repeated error checks successfully.
5. Nonexistent explicit JavaHome rejected exit2. Pure path containment function rejected target outside private root. Hash-mismatch synthetic cached archive rejected without network/extraction. Reparse checks cover existing ancestors through repository root; no replacement/deletion operations.
6. Both complete archive SHA256 values rechecked. JDK release file identifies Eclipse Adoptium/Temurin21.0.12.1+1. License-record existence check false. Final Prepare exit0 then missing-license InstallSdk rejection exit2 repeated.

No SDK package listing/download/install, license prompt/acceptance, Gradle/native build, phone/adb/device/server/emulator/cloud/provider/production action ran. Download/version child timeout code is bounded; no actual timeout fixture was needed. Actual accepted-license SDK-install success path remains untested. No full application tests or commit/deployment.

## Exact owner action and next task

From `C:\Projects\debtfree-dashboard` in owner's PowerShell terminal:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\mobile\setup-android.ps1 -Mode ReviewLicenses
```

This is interactive owner review, not an agent approval workaround. Do not pipe yes or manufacture license files/hashes. Prompt08 explicitly reserves acceptance to owner. Actual blocker is missing private SDK license record; no SDK packages have been requested. If owner declines, build remains blocked; no purchase/store obligation is required here.

After acceptance and manager confirmation, agent may use the guide's exact reviewed package-array command to install Platform36, Build Tools35.0.0 and Platform-Tools, then verify actual SDK metadata. Packaging/manager then owns wrapper JVM verification and APK/lint build using this private SDK and a private Gradle cache. CLI preparation alone is not native readiness. Studio GUI remains a later optional workflow; doctor retains its original Studio-oriented discovery semantics.

Phone versions/USB prompts, physical S20+/S21+ checks, real connected auth/isolated synthetic backend and macOS/iPhone access remain later gates. Existing localhost:8787 and imported household were untouched/unexposed. Human completion-notification authorization persists from the previously verified manager history; one labelled completion notice follows this saved report.

## Cache correction — October17, 2026 (America/Los_Angeles)

Owner now prefers saved reports and final worker-chat handoff, then owner will tell manager when workers finish. No manager message will be sent for this correction; this supersedes the prior completion-notice plan for the current follow-up.

Verified no powershell.exe preparation writer remained (matching setup script/Prepare command count0); partial opened with FileShare.None. The earlier original download session had already returned exit1 after task-only cancellation. Checked all resolved absolute source/destination paths against private tools root, including existing ancestor reparse checks, before moves/copy. No unrelated process or file touched.

- Canonical `C:\Projects\debtfree-dashboard\.wrangler\android-tools\downloads\temurin-21.0.12.1.zip` was199,436,741 bytes, hash `41efe8d29b86491d7eee26a7333200220fea44a1083c3667a870409fd091a6aa` (bad).
- Verified complete `...\downloads\temurin-curl-21.0.12.1.zip` against published SHA256 `f9d6e191ab098c0d416e7d588a24420a8621cd2f4720dab2459b8b7b2d2d8b4e` before copying.
- Moved only the partial to checked nonexisting `...\downloads\temurin-21.0.12.1.partial-20261017.zip`. Copied verified complete archive into now-free canonical path, then rehashed canonical: published hash matches,205,073,461 bytes. Alternate complete copy and partial quarantine retained; no deletions. This resolves/supersedes the earlier canonical-cache recovery warning.

Fetch-Verified now uses canonical + `.part` for downloads and an exclusive `.download.lock` handle per archive. It never downloads into canonical. Download failure or mismatched hash retains `.part`; canonical stays absent. Verified `.part` is promoted within the same directory only after hash check, without overwrite. Existing mismatched canonical fails for inspection. Retained canonical archives are also rehashed on Prepare even when extracted tools are reused. Lock files remain but OS locks release on exit/interruption. Concurrent same-archive script workflow is rejected rather than allowed to overwrite. Guide explains retry/inspection semantics.

Synthetic offline checks used AST-extracted functions with a fake Invoke-WebRequest inside the test shell (no network/tool execution), under ignored `downloads/fetch-checks-4a930abe6da0428d8ba6933db76f4230`:

1. Valid temporary download promoted; canonical exists and `.part` absent.
2. Verified canonical reused without another request.
3. Bad temporary hash retained, no canonical created.
4. Simulated interrupted request retained `.part`, no canonical created.
5. Verified retained part promoted on retry without request.
6. Bad existing canonical rejected without request.
7. Both actual canonical JDK/Google archives rehashed/reused with zero requests.

All assertions passed. Actual Prepare again verified compiler21.0.12.1 and sdkmanager22.0, exit0; Status exit0 and buildVerified false. Missing real SDK license record still rejects InstallSdk with confirmation switch, exit2, before any SDK package request. ReviewLicenses was not run. Final syntax/Prepare/Status/license checks after the extra cached-archive revalidation are recorded below. Current C: free about33.6GiB after retaining canonical+alternate+quarantine. Scope remains setup script/guide/this report/private cache; no license acceptance, SDK installation, native build, devices or production/data operations.

Final post-edit verification: AST syntax passed; Prepare exit0 (including both canonical archive hash checks), Status exit0/nativeBuildVerified false, and actual missing-license InstallSdk gate exit2. No SDK/license command was reached. Latest status measured33.0GiB free (other authorized workers may be using disk concurrently); earlier33.6GiB figure is its observation time. Scoped diff check passed. Report and worker-chat handoff only; no manager completion message sent for this correction.
