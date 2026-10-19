import type { CapacitorConfig } from '@capacitor/cli';

// Paths are relative to the root CLI working directory, through its config bridge.
const config: CapacitorConfig = {
  appId: 'com.debtfree.dashboard.dev',
  appName: 'DebtFree Dev',
  webDir: 'mobile/dist',
  // This package remains device-only; connected builds use a separate config.
  includePlugins: [],
  android: { path: 'mobile/android' },
};

export default config;
