# Android encrypted persistence

Date: October18,2026 / America/Los_Angeles.
Status: assigned native plugin/TypeScript adapters implemented and scoped checks passed. Native registration, compilation and physical security proofs remain pending; this is not connected-editing acceptance.

## Scope

Read AGENTS.md, complete NATIVE_AUTH_CONTRACT.md, prompt16 and existing MainActivity/package/contracts/session/callback source. Preserved existing work and all production/device-only financial state. No MainActivity, manifest, Gradle, package/dependency, session/API/contract or peer-file edits. No cloud/provisioning, ADB/device, native/integrated build, commit/push/deploy, subagent or worker-chat/status access. No completion message sent.

New files only:
- mobile/android/app/src/main/java/com/debtfree/dashboard/dev/ConnectedSecureStorePlugin.java
- mobile/native/secure-store.ts
- tests/native-secure-store.test.mjs
- this report

Java package matches existing MainActivity: com.debtfree.dashboard.dev. Actual runtime application ID must instead be exactly com.debtfree.dashboard.connectedtest for plugin operations. Every operation checks it before opening storage; device-only com.debtfree.dashboard.dev is rejected. The plugin is intentionally not registered in MainActivity by this assignment.

## Native implementation

Capacitor8 ConnectedSecureStore exposes asynchronous get/set/remove with a process-wide single-thread executor and process-wide failed-store lock. The coordinator contains no record values and survives Activity recreation, avoiding concurrent AtomicFile writers or an accidental lock reset. A failed store admits cleanup/remove only; normal access requires a new process plus successful verification/recovery. No implicit unlock/reset API.

Each record uses its own AndroidKeyStore-generated256-bit AES key, AES/GCM/NoPadding,128-bit authentication tag and12-byte provider-generated random IV. Key material is never exported/imported into JS. AAD binds exact connected application ID, format version and record identifier. Native IDs are restricted to auth./draft. plus64 lowercase hex digits; files cannot be selected by arbitrary paths. Header/version/length, GCM authentication and strict UTF8 decoding fail closed. Missing/unavailable key with any existing encrypted base/backup/new file raises KEY_UNAVAILABLE; no replacement key is silently generated over old ciphertext.

Records live in normal credential-protected private getNoBackupFilesDir()/connected-secure-v1. No SharedPreferences, browser/localStorage, plaintext record or in-memory financial fallback. A one-byte .deny cancellation file is non-secret denial metadata, not a plaintext credential/draft representation. It intentionally carries no token/verifier/financial payload or raw tuple.

AtomicFile replacement explicitly writes, flushes and syncs the stream before finishWrite, verifies committed bytes/size, and fsyncs the parent directory before resolution. Initial directory creation syncs parent directory entries. AtomicFile recovery can select a valid old base/backup after an interrupted new write; malformed committed ciphertext is rejected. Native body max1MiB, encrypted overhead32bytes, bounded artifact count before new key creation. Error responses are generic safe codes without payload/exception/log forwarding. No application logging is added.

Reads/writes require a secure device lock and currently unlocked device, checked before access and before returning/acknowledging. On API28+ keys also request unlocked-device-required. No biometric prompt/per-use authentication mechanism or StrongBox/hardware-attestation claim is made. Key invalidation, authentication/lock, corrupt ciphertext, wrong app, storage/quota/closed-store failures are explicit codes. Android's documented API28–34 unlocked-device-required caveats remain a device gate: weak biometric unlock can fail, and removing a secure lock can delete those keys. Existing encrypted files then remain locked, rather than being replaced with a new key.

## Durable cancellation, honest failure and remaining limit

Normal remove first atomically commits/fsyncs a denial marker, then deletes encrypted base/backup/new files with checked directory fsync, and deletes/verifies absence of the record key. Only completion resolves successfully. Denial remains until a fresh explicit set commits encrypted replacement and durably removes the marker. A get treats any denial base/backup/new artifact as absent, even when its marker is damaged. Thus a successfully persisted denial prevents adoption of leftover cancelled credentials/pending state if later ciphertext cleanup fails.

If the denial write or even directory access fails, native removal independently attempts record-key invalidation. Confirmed alias absence is reported as CANCELLATION_KEY_INVALIDATED, not successful cleanup. Encrypted-file-with-missing-key guard prevents silent regeneration. Failed key invalidation reports CANCELLATION_UNCONFIRMED. Native lock persists across Activity recreation. TypeScript attempts one bounded remove retry; even retry-confirmed cancellation still rejects the original failed operation and leaves access locked, with an explicit cancellationConfirmed boolean in its sanitized error.

Residual atomic-failure limit: if neither denial persistence nor key destruction can complete, there is no durable local fact proving cancellation after process/power loss. This code reports unknown cancellation and locks the current process; it does NOT claim cold-start no-resurrection in that simultaneous failure. The adapter cannot manufacture persistence when both OS authorities fail. Similarly, a process can die before any native cancellation call reaches its executor. Connected acceptance must retain this gate and require real fault/kill testing plus authoritative remote revocation/revalidation. Do not label offline logout safely cleared in that condition, or claim that a Map test solved it. Cold pending-callback acceptance after uncertain cancellation remains gated. Flash forensic secure-erasure, rooted-device rollback and adversarial full-app-state rollback are not guaranteed.

## TypeScript integration

Exports:
- ConnectedSecureStoreBridge: get({id}) -> {value:string|null}, set({id,value}), remove({id}). Default registerPlugin('ConnectedSecureStore') has no web implementation.
- createCredentialVault(options?): implements existing CredentialVault read/write/remove and a value-free snapshot(). Credential and pending keys exactly match current NativeSession's canonical JSON key form. Records use auth.<SHA256> IDs, distinct validated envelopes and strict credential/pending shapes; expired pending timing remains the session/callback owner's validation responsibility.
- createEncryptedDraftStore(verifiedScope, options?): async read/write/remove for snapshot/outbox/checkpoint, lock() and value-free snapshot(). It captures the exact canonical (backendId,issuer,subject,householdId) tuple and binds tuple/kind inside encrypted JSON as well as hashed record ID. Changing the caller's scope object later cannot retarget it. No unscoped browser/demo adoption.
- SecureStoreError exposes safe code and cancellationConfirmed, never raw native error/record data. snapshot includes only locked/failure.

Default runtime rejects web and iOS before bridge access; native code is authoritative for actual application ID. Injected bridge/runtime options support focused tests only, with no fallback implementation. Adapters sharing a bridge share an ordered lane and failed-state lock. ID hashing happens inside ordered operations. A per-operation guard prevents a delayed digest from dispatching a write after its deadline/cleanup; already-dispatched native work is serialized by Java. Late acknowledgements never unlock a failed adapter. Default native/hash deadline5s (validated configurable20–30000ms); credential write failure awaits bounded removal/retry rather than launching cleanup in the background. If native IO stalls, it cannot be forcibly cancelled from JS; queued cleanup may complete after JS has reported unknown durability.

Credentials are stored as one complete JSON envelope with64KiB cap; financial envelopes max1MiB. Financial JSON rejects non-finite values, undefined/functions, cycles, exotic objects, getters, symbols, sparse arrays, oversized/deep/node-heavy structures instead of silently dropping fields. No plaintext finance cache or synchronous Storage shim exists. Returning a decrypted read value is necessary for its explicit caller; JS immutable strings/bridge copies cannot promise RAM zeroization.

Manager must provide only validated isolated configuration and authoritative VerifiedScope after bootstrap. This persistence module does not authenticate a scope, authorize viewer edits, perform sync, or integrate HouseholdSync's synchronous outbox. Financial editing remains gated until the manager assigns a genuinely awaited asynchronous draft/recovery integration, schema/revision validation and explicit same-scope recovery. Offline financial writes remain outside scope.

## Manager registration/configuration requirements

1. Create/use the side-by-side connected test applicationId exactly com.debtfree.dashboard.connectedtest. Appending .connectedtest to current .dev ID would produce a different ID and be rejected. Java namespace/package can stay dev; no need to rename this source or existing MainActivity. Preserve the existing device-only installed package/data.
2. Register ConnectedSecureStorePlugin.class in the connected variant only. Installed Capacitor8 BridgeActivity initializes bridgeBuilder before onCreate and creates the bridge within super.onCreate; register before calling super.onCreate. Add android.os.Bundle import in MainActivity when manager owns that edit. Guard registration by exact getPackageName or use a connected-only Activity/source set. No Gradle/plugin dependency is needed beyond existing Capacitor core/android.
3. Retain connected manifest backup exclusions: allowBackup=false, fullBackupContent=false, appropriate dataExtractionRules; noBackupFilesDir is additional exclusion, not proof of every OEM transfer behavior. Do not copy encrypted files between application IDs or create a browser fallback if a key is missing. No storage permission is required for these private files.
4. Keep dedicated connected config, loggingBehavior none, remote navigation disabled and WebView inspection disabled for credential use; inspect generated bridge/runtime logging, source maps and error reporters for leaks. This plugin adds no logs, but does not control all caller/SDK/OS instrumentation. Do not pass secrets to snapshots, UI props, analytics or console output.
5. Session cancellation/logout must await vault.remove, honor local cleanup errors/locked state, revoke/revalidate server session independently, and reject stale generations. No automatic process-local unlock or fresh adapter as a recovery shortcut. Explicit recovery after key loss/uncertain cleanup needs its own reviewed path, not deleting encrypted financial history silently.

## Checks actually run

- Scoped ESLint mobile/native/secure-store.ts and tests/native-secure-store.test.mjs: passed.
- Scoped TypeScript command passed: npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --lib ES2022,DOM --allowImportingTsExtensions --strict --skipLibCheck mobile/native/secure-store.ts.
- node --test tests/native-secure-store.test.mjs:10 passed,0 failed. Covers native-only/wrong-app propagated failures; awaited serialization; credentials/pending separation/shape checks; exact scope/kind/auth isolation; immutable captured tuple; JSON/size/corrupt-envelope lock; durable-denial protocol fixture across a fresh JS adapter; honest retry confirmation; unknown cancellation process-lock; bounded timeout/late native commit cleanup; delayed digest unable to dispatch after timeout. Test fixtures are explicitly abstract native acknowledgement/denial models, not encryption or persistent Android implementations.
- Root npm run typecheck attempted, blocked only by unowned supabase/functions/mobile-session-authority/index.ts npm:jose@6.2.8 and npm:postgres@3.4.7 Deno import declarations. No peer/config edit made to hide those errors; manager owns integrated TS/Deno boundary handling. Scoped check above passes.
- Inspected installed Capacitor8 PluginCall reject signatures, Plugin lifecycle and BridgeActivity registration ordering; read current manifest backup flags. No Android compile/instrumentation/provider/device/power-loss test run. No Java compile success claimed. Node strip-only syntax initially rejected parameter properties; replaced with normal declared fields and reran tests successfully.

## Official reference review (October18)

[AtomicFile API](https://developer.android.com/reference/android/util/AtomicFile) describes commit/sync and explicitly requires callers' own concurrency protection; implementation adds a process-wide executor, direct fsync and checked results.

[Keystore system](https://developer.android.com/privacy-and-security/keystore) describes app-private key operations and device-dependent hardware backing; no StrongBox/attestation certification claimed here.

[KeyGenParameterSpec.Builder](https://developer.android.com/reference/android/security/keystore/KeyGenParameterSpec.Builder) documents randomized IV generation, unlocked-device versus per-use authentication, and older-OS unlocked-key caveats. Implementation retains fail-closed key loss handling; device compatibility remains unverified.

## Proof gates / next action

Manager reviews source and registers only the side-by-side test build, then compiles/lints native code. On synthetic test identities/data, prove API24/modern-device lock/PIN/biometric paths, key deletion/invalidation without regeneration, AES-GCM tamper/AAD/record-swap failure and IV non-reuse, corrupt/truncated base/.bak/.new files, cancellation during locked device/IO failure, directory/full-disk/delete/key failures, process kills at each commit/removal stage, cold callback after cancellation, rotated credentials, same-scope encrypted draft recovery/conflicts, backup/restore/reinstall and OEM transfer exclusions. Re-check server revocation with a held unexpired token. No connected financial access, power-loss durability, APK/device readiness or provider/sync acceptance follows from these source/Node checks.

Owner announces completion manually. Report/final remain in this chat; no manager/peer completion message or status polling.
