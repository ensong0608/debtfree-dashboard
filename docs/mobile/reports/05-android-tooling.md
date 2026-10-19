# Agent report: Android tooling doctor

Date/time zone: October 17, 2026, America/Los_Angeles.
Status: complete for assigned local tooling/documentation slice; native/device gates pending.
Owned files: NEW `scripts/mobile/doctor.ps1`, `docs/mobile/ANDROID_SETUP.md`, this `docs/mobile/reports/05-android-tooling.md` only.

## Inspected evidence

Read AGENTS.md, mobile README, round 2 prompt and previous readiness continuation; inspected dirty status before work. Rechecked official [Capacitor setup](https://capacitorjs.com/docs/getting-started/environment-setup), [v8 baseline](https://capacitorjs.com/docs/updating/8-0), and [Studio installation](https://developer.android.com/studio/install) October 17. Existing discovery details remain in report 03; this report covers the new checker only.

## Findings and changes

Doctor supports optional explicit installation roots and human/JSON output; searches only known paths, selected Java/SDK variables and executable PATH. It reads SDK package metadata without executing adb/sdkmanager/Gradle/Studio. Only found Node/Java/Javac version processes run, bounded to five seconds (with bounded output completion); timeout cleanup affects only that child. Output extracts numeric versions and suppresses raw process/exception output. No environment dump, device identifiers, network or data access. SDK selection is deterministic and incomplete selected roots are reported, not combined with unrelated SDKs.

Actual runs found Node 24.14.1; no Java/Javac, Studio or SDK discovered. API36/Build-Tools/Platform-Tools/Command-line Tools remain missing from observed roots; custom installs elsewhere remain possible. Free disk fluctuated 35.1–35.2 GiB. A found toolchain gets `prerequisites-found`, not a native-build pass; `buildReady` is always false. Studio version/license status, package integrity, effective Gradle/JDK compatibility and exact eventual pinned-template versions are explicitly unverified.

Guide separates doctor use, later authorized installation with owner license/elevation interaction, build verification, offline demo, APK, physical Samsung acceptance and connected-auth/iOS gates. No emulator needed for first USB phone milestone. No routing/exposure of localhost:8787 or imported household permitted.

## Verification actually performed

- PowerShell AST ParseFile syntax check: zero errors, repeated after final fix.
- `pwsh -NoProfile -File scripts/mobile/doctor.ps1`: human `unready`, expected exit 1, seven Android/JDK gaps.
- Same command with `-Json`: parsed valid JSON, asserted status `unready`, buildReady false and exit 1; repeated after final edit.
- Each of `-JavaPath`, `-SdkPath`, `-StudioPath` with `C:\does-not-exist-debtfree-tool-check -Json`: valid controlled error JSON and exit 2, no unhandled failure.
- Windows PowerShell `powershell.exe -NoProfile -File scripts/mobile/doctor.ps1 -Json`: expected exit 1. This exposed empty pipeline values serializing as objects in Windows PowerShell; normalized missing Studio/SDK values to null, reran and asserted null schema fields successfully.
- Scoped `git diff --check`: no issues (new untracked files additionally syntax/read reviewed). No fixture/output files created. Installed-tool success branch, actual Java process failure/timeout and SDK metadata discovery were not exercised on this missing-tool machine; they remain a later toolchain verification step. No full app tests, native build, device or provider test ran.

Exit 0 means prerequisite discovery only; 1 means normal missing prerequisites; 2 means script/explicit-path/version-check error. Shell parameter-binding errors precede script output. Invalid explicit paths fail before external checks. Raw exceptions are suppressed to avoid leaking subprocess data; error message directs checks to paths/permissions/time limits.

## Blockers and owner input

Now: no owner action needed to review these three files. Manager reviews/integrates client work independently.
Later: explicitly assigned installation/download session; verify any known custom Studio/SDK root first, remeasure disk, owner accepts licenses/elevation. Compatible selected JDK/SDK and native package generation precede APK. Owner records Android/One UI/WebView versions on S20+/S21+ 5G and handles USB/RSA prompts only after APK review. Separate synthetic backend/native session contract before connected testing; Mac/iPhone access still pending. No secrets requested.

## Handoff

Only these three new files were written; existing user/worker edits preserved. No installs/downloaded tools, SDK-license actions, environment changes, device/server/emulator/production operations, native/package changes, commit or deployment.

Verified direct human notification authorization by reading manager thread `01a1489e-837e-7b63-ba04-2911935fe420`: owner requested workers “either notify you if that is possible or update a document,” and clarified that they should not validate completion. One completion notice will be sent under that authorization; no reply loop.

Next task: manager accepts doctor/guide and standalone-client result, then assigns authorized Windows tool installation and pinned Capacitor packaging with explicit file ownership. Do not interpret this tooling slice as APK/device readiness.

## Parser correction — October 17, 2026 (America/Los_Angeles)

Manager review correctly found that the original first-number regex could misread `Picked up JAVA_TOOL_OPTIONS: -Xmx512m` as Java version 512. Replaced it with a pure tool-specific parser requiring anchored Node `v...`, quoted `java/openjdk [version] "..."`, or `javac ...` lines. Numeric option banners and lines for a different tool are ignored. Missing recognized version throws into the existing redacted controlled error (exit 2); stdout/stderr now have an explicit newline separator. Bounded process execution and output redaction remain unchanged. Guide, including manager's Windows PowerShell commands, was not edited.

Executed inline synthetic checks by AST-extracting only the pure parser (no fixture files or test framework): seven valid cases passed covering numeric banners plus Java17, Java21, quoted Oracle Java, OpenJDK without `version` and with build suffix, javac17/javac21, and Node24.14.1. Banner-only output rejected for each of java/javac/node (three cases); javac line rejected when java requested (one case). All 11 assertions passed; Java17 remains 17, never 512. Final script AST syntax check passed.

Re-ran actual Windows PowerShell human mode: `unready`, exit 1; JSON parsed/asserted `unready`, Node24.14.1, exit 1. Each nonexistent explicit JavaPath/SdkPath/StudioPath returned controlled JSON `error`, exit 2. Android tools remain undiscovered; C: free observed 34.8 GiB in this run. No SDK/device/native/process-service actions or installs occurred; only normal safe Node version subprocess ran. Real Java timeout/failure branch remains unexecuted, distinct from tested pure parser behavior. Changed only doctor and this report; manager should re-review parser correction before acceptance.
