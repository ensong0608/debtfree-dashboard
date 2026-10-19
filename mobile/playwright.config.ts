import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: ['demo.spec.ts', 'ui-refinements.spec.ts'], outputDir: 'test-results',
  workers: 1, timeout: 60000, expect: { timeout: 10000 }, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4179', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'small-phone', use: { viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true } },
    { name: 'phone-viewport', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: 'npm run preview:mobile', cwd: '..', url: 'http://127.0.0.1:4179', reuseExistingServer: false, timeout: 30000 },
});
