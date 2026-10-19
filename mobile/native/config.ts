import { validateConfig, type TestConfig } from './contracts.ts';

export const CONNECTED_APPLICATION_ID = 'com.debtfree.dashboard.connectedtest';
export const CONNECTED_CONFIG: Readonly<TestConfig> = validateConfig({
  environment: 'test', backendId: 'debtfree-mobile-test',
  apiOrigin: 'https://debtfree-mobile-test.ensong0608.workers.dev',
  issuer: 'https://otggeztwtaklsqwtztgz.supabase.co/auth/v1',
  productionIssuer: 'https://acpderotiyoecmwwyfsu.supabase.co/auth/v1',
  callbackBase: 'com.debtfree.connectedtest://auth/callback',
});
