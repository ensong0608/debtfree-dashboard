import type { CapacitorConfig } from '@capacitor/cli';
import deviceOnly from './mobile/capacitor.config';

// Only the dedicated command opts into connected assets/plugins. Normal existing
// sync/build commands retain the device-only application identity.
const connected: CapacitorConfig = {
  appId: 'com.debtfree.dashboard.connectedtest', appName: 'DebtFree Connected Test',
  webDir: 'mobile/connected-dist', includePlugins: ['@capacitor/app', '@capacitor/browser'],
  android: { path: 'mobile/android' },
};
export default process.env.DEBTFREE_CONNECTED_TEST === '1' ? connected : deviceOnly;
