import { assertLocalConfiguration } from './scripts/local-config.mjs';
import { localDevelopmentPlugin } from './scripts/local-development-plugin.ts';
import vinext from "vinext";
import { defineConfig } from "vite";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(async ({ command }) => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  const local = command === 'serve' && process.env.DEBTFREE_LOCAL === '1';
  if (local) assertLocalConfiguration();
  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : local ? { watch: { ignored: ['**/.wrangler/**', '**/outputs/**'] } } : undefined,
    plugins: [
      ...(local ? [localDevelopmentPlugin()] : []),
      vinext(),
      cloudflare({
        ...(local ? { configPath: 'wrangler.local.jsonc', persistState: { path: '.wrangler/local-state' } } : {}),
        ...(process.env.DEBTFREE_DISABLE_INSPECTOR === "1" ? { inspectorPort: false as const } : {}),
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      }),
    ],
  };
});
