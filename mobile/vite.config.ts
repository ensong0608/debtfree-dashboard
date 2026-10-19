import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig(({ mode }) => {
  const connected = mode === 'connected-test', out = connected ? 'connected-dist' : 'dist';
  const publicKey = connected ? process.env.DEBTFREE_MOBILE_TEST_PUBLISHABLE_KEY ?? '' : '';
  if (connected && !/^sb_publishable_[A-Za-z0-9_-]{16,512}$/.test(publicKey)) throw new Error('Set only the isolated test publishable key before building the connected app.');
  return {
    root, base: '/', envDir: false, publicDir: false,
    define: connected ? { __MOBILE_TEST_PUBLISHABLE_KEY__: JSON.stringify(publicKey) } : {},
    css: { postcss: resolve(root, '..') },
    plugins: [react(), {
      name: 'mobile-asset-allowlist',
      closeBundle() {
        mkdirSync(resolve(root, out), { recursive: true });
        for (const asset of ['favicon.svg', 'ocr']) cpSync(resolve(root, '../public', asset), resolve(root, out, asset), { recursive: true });
        if (connected) writeFileSync(resolve(root, out, 'index.html'), readFileSync(resolve(root, out, 'connected.html')));
        writeFileSync(resolve(root, out, 'mobile-build.json'), JSON.stringify({ mode: connected ? 'connected-test' : 'device-only', appId: connected ? 'com.debtfree.dashboard.connectedtest' : 'com.debtfree.dashboard.dev' }));
      },
    }, {
      name: 'mobile-module-boundary',
      generateBundle() {
        const ids = [...this.getModuleIds()].map(id => id.replaceAll('\\', '/'));
        const forbidden = ids.filter(id => /\/app\/(api\/|auth\.|auth-config\.|cloudflare-auth\.)|\/node_modules\/(next|vinext|wrangler|@cloudflare|@supabase)\//.test(id) || (!connected && /\/mobile\/native\//.test(id)) || (connected && /\/mobile\/demo-(fixture|repository)\./.test(id)));
        if (forbidden.length) this.error('Unexpected modules reached the mobile bundle: ' + forbidden.join(', '));
        const projectRoot = resolve(root, '..').replaceAll('\\', '/') + '/';
        this.emitFile({ type: 'asset', fileName: 'module-inventory.json', source: JSON.stringify(ids.map(id => id.replace(projectRoot, '')), null, 2) });
      },
    }],
    build: { outDir: out, emptyOutDir: true, ...(connected ? { rollupOptions: { input: resolve(root, 'connected.html') } } : {}) },
    preview: { host: '127.0.0.1', port: 4179, strictPort: true },
  };
});
