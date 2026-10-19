package com.debtfree.dashboard.dev;

import android.app.KeyguardManager;
import android.content.Context;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.security.keystore.UserNotAuthenticatedException;
import android.system.Os;
import android.system.OsConstants;
import android.util.AtomicFile;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.UnrecoverableKeyException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** No web/device-only fallback. Register only in the separately identified test app. */
@CapacitorPlugin(name = "ConnectedSecureStore")
public class ConnectedSecureStorePlugin extends Plugin {
    private static final String APP_ID = "com.debtfree.dashboard.connectedtest";
    private static final String KEY_PREFIX = "debtfree-connected-v1.";
    private static final int MAX_BYTES = 1024 * 1024;
    private static final int MAGIC = 0x44465331;
    private static final ExecutorService queue = Executors.newSingleThreadExecutor();
    // All disk and Keystore operations run on this queue. No values enter logs.
    private static boolean locked = false;

    private static final class StoreFailure extends Exception {
        final String code;
        StoreFailure(String code) { super("Secure persistence unavailable."); this.code = code; }
    }
    private void allowed() throws StoreFailure {
        if (!APP_ID.equals(getContext().getPackageName())) throw new StoreFailure("WRONG_APPLICATION");
    }
    private void unlocked() throws StoreFailure {
        KeyguardManager guard = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
        if (guard == null || guard.isDeviceLocked()) throw new StoreFailure("DEVICE_LOCKED");
        if (!guard.isDeviceSecure()) throw new StoreFailure("DEVICE_NOT_SECURED");
    }
    private String identifier(PluginCall call) throws StoreFailure {
        String id = call.getString("id");
        if (id == null || !id.matches("(?:auth|draft)\\.[a-f0-9]{64}")) throw new StoreFailure("INVALID_IDENTIFIER");
        return id;
    }
    private File directory() throws Exception {
        File root = new File(getContext().getNoBackupFilesDir(), "connected-secure-v1");
        if (!root.exists()) {
            if (!root.mkdir() && !root.isDirectory()) throw new IOException();
            syncDirectory(root.getParentFile());
            syncDirectory(root.getParentFile().getParentFile());
        }
        if (!root.isDirectory()) throw new IOException();
        return root;
    }
    private static void syncDirectory(File dir) throws Exception {
        FileDescriptor descriptor = Os.open(dir.getAbsolutePath(), OsConstants.O_RDONLY | OsConstants.O_NOFOLLOW, 0);
        try {
            if (!OsConstants.S_ISDIR(Os.fstat(descriptor).st_mode)) throw new IOException();
            Os.fsync(descriptor);
        } finally { Os.close(descriptor); }
    }
    private static boolean artifacts(File file) {
        return file.exists() || new File(file.getPath() + ".bak").exists() || new File(file.getPath() + ".new").exists();
    }
    private static void atomicWrite(File file, byte[] data) throws Exception {
        AtomicFile atomic = new AtomicFile(file);
        FileOutputStream stream = null;
        try {
            stream = atomic.startWrite(); stream.write(data); stream.flush(); stream.getFD().sync();
            atomic.finishWrite(stream); stream = null;
            // AtomicFile finishWrite does not report all rename/delete failures.
            if (!file.isFile() || file.length() != data.length || new File(file.getPath() + ".new").exists()) throw new IOException();
            byte[] actual = atomic.readFully();
            if (!MessageDigest.isEqual(data, actual)) throw new IOException();
            syncDirectory(file.getParentFile());
        } catch (Exception error) {
            if (stream != null) atomic.failWrite(stream);
            throw error;
        }
    }
    private static void durableDelete(File file) throws Exception {
        new AtomicFile(file).delete();
        if (artifacts(file)) throw new IOException();
        syncDirectory(file.getParentFile());
    }
    private KeyStore keys() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null); return store;
    }
    private SecretKey key(String id, File record, boolean create) throws Exception {
        KeyStore store = keys(); String alias = KEY_PREFIX + id;
        if (store.containsAlias(alias)) {
            java.security.Key found = store.getKey(alias, null);
            if (!(found instanceof SecretKey)) throw new StoreFailure("KEY_UNAVAILABLE");
            return (SecretKey) found;
        }
        // Never hide key loss/invalidation behind a new key and unreadable data.
        if (artifacts(record)) throw new StoreFailure("KEY_UNAVAILABLE");
        if (!create) return null;
        File[] existing = record.getParentFile().listFiles();
        if (existing == null || existing.length >= 768) throw new StoreFailure("STORE_CAPACITY");
        KeyGenParameterSpec.Builder spec = new KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setRandomizedEncryptionRequired(true);
        if (Build.VERSION.SDK_INT >= 28) spec.setUnlockedDeviceRequired(true);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(spec.build()); return generator.generateKey();
    }
    private byte[] aad(String id) { return (APP_ID + "\u0000v1\u0000" + id).getBytes(StandardCharsets.UTF_8); }
    private void writeValue(String id, File file, byte[] value) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key(id, file, true));
        byte[] iv = cipher.getIV();
        if (iv == null || iv.length != 12) throw new StoreFailure("CRYPTO_FAILURE");
        cipher.updateAAD(aad(id)); byte[] encrypted = cipher.doFinal(value);
        byte[] bytes = ByteBuffer.allocate(4 + 12 + encrypted.length).putInt(MAGIC).put(iv).put(encrypted).array();
        atomicWrite(file, bytes);
    }
    private String readValue(String id, File file) throws Exception {
        if (!artifacts(file)) return null;
        for (File candidate : new File[] { file, new File(file.getPath() + ".bak"), new File(file.getPath() + ".new") }) {
            if (candidate.exists() && candidate.length() > MAX_BYTES + 32L) throw new StoreFailure("CORRUPT_RECORD");
        }
        SecretKey secret = key(id, file, false);
        byte[] raw = new AtomicFile(file).readFully();
        if (raw.length < 32 || raw.length > MAX_BYTES + 32 || ByteBuffer.wrap(raw).getInt() != MAGIC) throw new StoreFailure("CORRUPT_RECORD");
        byte[] iv = new byte[12]; System.arraycopy(raw, 4, iv, 0, 12);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, secret, new GCMParameterSpec(128, iv)); cipher.updateAAD(aad(id));
        byte[] value = cipher.doFinal(raw, 16, raw.length - 16);
        // Strict decoding, rather than replacing damaged UTF-8 with new data.
        return StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(value)).toString();
    }
    private void removeRecord(String id, File record, File denial) throws Exception {
        try {
            // Non-secret, fail-closed denial metadata; never a plaintext value fallback.
            // Reads treat .deny/.bak/.new existence as cancellation, even if damaged.
            atomicWrite(denial, new byte[] { 1 });
        } catch (Exception barrierFailure) {
            // Best-effort second independent authority: make retained ciphertext unusable.
            // If both operations fail, durable cancellation is UNKNOWN, never success.
            boolean invalidated = false;
            try { KeyStore store = keys(); store.deleteEntry(KEY_PREFIX + id); invalidated = !store.containsAlias(KEY_PREFIX + id); } catch (Exception ignored) { /* no logs */ }
            if (invalidated) throw new StoreFailure("CANCELLATION_KEY_INVALIDATED");
            throw new StoreFailure("CANCELLATION_UNCONFIRMED");
        }
        // Denial remains after cleanup; a fresh explicit write removes it only after commit.
        durableDelete(record);
        KeyStore store = keys(); store.deleteEntry(KEY_PREFIX + id);
        if (store.containsAlias(KEY_PREFIX + id)) throw new StoreFailure("CLEANUP_FAILED");
    }
    private String code(Exception error) {
        if (error instanceof StoreFailure) return ((StoreFailure) error).code;
        if (error instanceof UserNotAuthenticatedException) return "DEVICE_LOCKED";
        if (error instanceof KeyPermanentlyInvalidatedException) return "KEY_INVALIDATED";
        if (error instanceof UnrecoverableKeyException) return "KEY_UNAVAILABLE";
        if (error instanceof AEADBadTagException) return "CORRUPT_RECORD";
        return "STORAGE_FAILURE";
    }
    private void execute(PluginCall call, String operation) {
        try { queue.execute(() -> {
            String validatedId = null;
            try {
                allowed(); String id = identifier(call); validatedId = id;
                if (locked && !operation.equals("remove")) throw new StoreFailure("STORE_LOCKED");
                File root = directory(), record = new File(root, id + ".bin"), denial = new File(root, id + ".deny");
                JSObject result = new JSObject();
                if (operation.equals("remove")) { removeRecord(id, record, denial); }
                else {
                    unlocked();
                    if (operation.equals("get")) {
                        String value = artifacts(denial) ? null : readValue(id, record);
                        unlocked(); result.put("value", value == null ? org.json.JSONObject.NULL : value);
                    } else {
                        String value = call.getString("value");
                        if (value == null || value.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) throw new StoreFailure("INVALID_VALUE");
                        writeValue(id, record, value.getBytes(StandardCharsets.UTF_8));
                        durableDelete(denial); unlocked();
                    }
                }
                call.resolve(result);
            } catch (Exception error) {
                locked = true;
                String failure = code(error);
                // A directory/fs failure before removeRecord must not skip the
                // independent key-invalidation attempt for cancelled credentials.
                if (operation.equals("remove") && validatedId != null && !failure.equals("CANCELLATION_KEY_INVALIDATED")) {
                    try {
                        KeyStore store = keys(); store.deleteEntry(KEY_PREFIX + validatedId);
                        failure = store.containsAlias(KEY_PREFIX + validatedId) ? "CANCELLATION_UNCONFIRMED" : "CANCELLATION_KEY_INVALIDATED";
                    } catch (Exception ignored) { failure = "CANCELLATION_UNCONFIRMED"; }
                }
                call.reject("Secure persistence unavailable.", failure);
            }
        }); } catch (java.util.concurrent.RejectedExecutionException closed) { call.reject("Secure persistence unavailable.", "STORE_CLOSED"); }
    }
    @PluginMethod public void get(PluginCall call) { execute(call, "get"); }
    @PluginMethod public void set(PluginCall call) { execute(call, "set"); }
    @PluginMethod public void remove(PluginCall call) { execute(call, "remove"); }
    // Process-wide queue/lock survive activity recreation; never reset a failed
    // store merely because a WebView or Activity was recreated. No values cached.
}
