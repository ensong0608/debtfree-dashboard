import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: 'http://localhost:8787', extraHTTPHeaders: { Origin: 'http://localhost:8787' } },
  webServer: { command: 'npm run dev:local', url: 'http://localhost:8787', reuseExistingServer: true, timeout: 120000 },
});
