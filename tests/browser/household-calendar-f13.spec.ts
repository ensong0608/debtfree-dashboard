import { test, expect, type Page } from '@playwright/test';
import { createDemoFixture } from '../../mobile/demo-fixture';

async function mount(page: Page, modulePath: string, props: object, exportName = 'default') {
  await page.route('**/__f13-harness', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' }));
  await page.goto('/__f13-harness');
  await page.evaluate(async ({ modulePath, props, exportName }) => {
    const refreshPath = '/@react-refresh';
    const refresh = (await import(refreshPath)).default;
    refresh.injectIntoGlobalHook(window);
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true });
    const cssPath = '/app/globals.css';
    await import(cssPath);
    const reactPath = '/node_modules/.vite/deps/react.js';
    const domPath = '/node_modules/.vite/deps/react-dom_client.js';
    const React = (await import(reactPath)).default;
    const { createRoot } = (await import(domPath)).default;
    const Component = (await import(modulePath))[exportName];
    const node = document.createElement('div');
    document.body.replaceChildren(node);
    const callbacks = Object.fromEntries(['onMonth','onCopyPrevious','onStartBlank','onAdd','onEdit','onSettings','onTracking','onViewTransactions','onChange','onDialog','onConfirm','onUndoConfirmation','onClose','onSchedule','onProgress','onDebts','onAccount'].map(key => [key, () => {}]));
    createRoot(node).render(React.createElement(Component, { ...callbacks, ...props }));
  }, { modulePath, props, exportName });
}

for (const timezoneId of ['UTC', 'Asia/Manila', 'America/Los_Angeles']) {
  test.describe(timezoneId, () => {
    test.use({ timezoneId, viewport: { width: 1440, height: 1000 } });
    test('receipt fallback uses the household day and preserves printed receipt dates', async ({ page }) => {
      await page.clock.setFixedTime(new Date('2027-01-01T00:30:00Z'));
      await mount(page, '/app/payments-page.tsx', { readOnly: false, accounts: [], transactions: [], adjustments: [], storedAccounts: [], message: '' });
      await page.route('**/ocr/tesseract.esm.min.js*', route => route.fulfill({ contentType: 'text/javascript', body: `export async function createWorker() { return { setParameters: async () => {}, recognize: async () => ({ data: { text: globalThis.calendarReceiptText, confidence: 100 } }), terminate: async () => {} }; }` }));
      const dates = await page.evaluate(async () => {
        const path = '/app/receipt-ocr.ts';
        const { scanReceipt } = await import(path);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 20;
        const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!)));
        const file = new File([blob], 'synthetic-receipt.png', { type: 'image/png' });
        const dates = [];
        for (const text of ['Sample shop\nTOTAL 10.00', 'Sample shop\n01/01/2027\nTOTAL 10.00', 'Sample shop\nJanuary 1, 2027\nTOTAL 10.00']) {
          Object.assign(window, { calendarReceiptText: text });
          dates.push((await scanReceipt(file, () => {})).date);
        }
        return dates;
      });
      expect(dates).toEqual(['2026-12-31','2027-01-01','2027-01-01']);
    });
    for (const [instant, month, title, day] of [
      ['2027-01-01T07:59:59Z','2026-12','December 2026','2026-12-31'],
      ['2028-03-01T07:59:59Z','2028-02','February 2028','2028-02-29'],
    ]) {
      test(`Budget, Transactions and settlement defaults agree at ${instant}`, async ({ page }) => {
        await page.clock.setFixedTime(new Date(instant));
        await mount(page, '/app/monthly-plan-page.tsx', { payoffAmount: 0, month, hasMonth: true, previousHasItems: false, items: [], accounts: [], transactions: [], settings: { safetyBuffer: 0, debtPaymentTarget: 0 }, trackingEnabled: false, plannedPayments: {} });
        await expect(page.getByRole('button', { name: 'This month', exact: true, includeHidden: true })).toBeDisabled();
        await expect(page.getByRole('region', { name: 'Select plan month' })).toContainText(title);
        await mount(page, '/app/payments-page.tsx', { readOnly: false, accounts: [], transactions: [], adjustments: [], storedAccounts: [], message: '' });
        await expect(page.getByLabel('Period', { exact: true })).toHaveValue(`month:${month}`);
        await mount(page, '/app/plan-settlement-dialog.tsx', { request: { targetId: 'test', name: 'Boundary spending', kind: 'spending', amount: 10, source: 'debit' }, month });
        await expect(page.getByLabel('Date paid', { exact: true })).toHaveValue(day);
        await expect(page.getByLabel('Date paid', { exact: true })).toHaveAttribute('max', day);
        await mount(page, '/app/plan-settlement-dialog.tsx', { request: { targetId: 'test', name: 'Historical spending', kind: 'spending', amount: 10, source: 'debit' }, month: '2026-09' });
        await expect(page.getByLabel('Date paid', { exact: true })).toHaveValue('2026-09-01');
        const nextMonth = month === '2026-12' ? '2027-01' : '2028-03';
        await mount(page, '/app/debt-experience.tsx', { name: 'Synthetic', accounts: [], loans: [], starting: 0, current: 0, schedule: { debtFreeMonth: nextMonth, payoffMonths: {}, rows: [], issues: [], monthly: 0, complete: true } }, 'HomeExperience');
        await expect(page.locator('section').filter({ hasText: 'DEBT-FREE COUNTDOWN' }).locator('strong')).toHaveText(['0','0','1']);
      });
    }
  });
}

for (const kind of ['conflict', 'too-large'] as const) {
  test(`${kind} notice offers recovery actions and preserves changes`, async ({ page }) => {
    const scope = { identity: 'synthetic-calendar@example.test', householdId: 'calendar-f13' };
    const cloud = createDemoFixture();
    const draft = structuredClone(cloud);
    draft.payload.accounts[0].name = 'Retained draft card';
    const outboxKey = `debtfree-outbox:${scope.identity}:${scope.householdId}:f13`;
    await page.addInitScript(({ outboxKey, draft }) => {
      sessionStorage.setItem('debtfree-outbox-tab', 'f13');
      localStorage.setItem(outboxKey, JSON.stringify({ revision: 0, contract: draft }));
    }, { outboxKey, draft });
    let writes = 0;
    let revision = kind === 'conflict' ? 1 : 0;
    let remote = cloud;
    await page.route('**/api/household', route => {
      if (route.request().method() === 'PUT') {
        writes++;
        if (kind === 'too-large') return route.fulfill({ status: 413, json: { error: 'Dashboard data is too large' } });
        const body = route.request().postDataJSON();
        if (body.revision !== revision) return route.fulfill({ status: 409, json: { error: 'Synthetic conflict' } });
        remote = body.payload; revision++;
        return route.fulfill({ json: { revision } });
      }
      return route.fulfill({ json: { ...scope, householdName: 'Synthetic calendar household', role: 'owner', members: [], revision, payload: remote } });
    });
    await mount(page, '/app/dashboard-client.tsx', { user: { email: scope.identity, displayName: 'Synthetic', fullName: null }, householdId: scope.householdId });
    const notice = page.getByRole('alert').filter({ hasText: kind === 'conflict' ? 'Another session changed' : 'exceeds the cloud save limit' });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole('button', { name: 'Retry connection' })).toHaveCount(0);
    const downloadReady = page.waitForEvent('download');
    await notice.getByRole('button', { name: 'Export my changes', exact: true }).click();
    const download = await downloadReady;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(chunk);
    const exported = JSON.parse(Buffer.concat(chunks).toString());
    expect(exported.payload.accounts[0].name).toBe('Retained draft card');
    expect(exported.payload.snapshots).toEqual(draft.payload.snapshots);
    expect(JSON.parse((await page.evaluate(key => localStorage.getItem(key), outboxKey))!).revision).toBe(0);
    if (kind === 'conflict') {
      expect(writes).toBe(0);
      page.once('dialog', dialog => dialog.accept());
      await notice.getByRole('button', { name: 'Load latest household', exact: true }).click();
      await expect(notice).toHaveCount(0);
      const checkpoint = await page.evaluate(async scope => {
        const path = '/app/data-repository.ts';
        const { createBrowserDataRepository } = await import(path);
        return createBrowserDataRepository(() => true, undefined, `${scope.identity}:${scope.householdId}`).loadCheckpoint();
      }, scope);
      expect(checkpoint.payload.accounts[0].name).toBe('Retained draft card');
      expect(checkpoint.payload.snapshots).toEqual(draft.payload.snapshots);
      await expect.poll(() => page.evaluate(key => localStorage.getItem(key), outboxKey)).toBeNull();
      expect(remote.payload.accounts[0].name).toBe('Sample card');
      expect(remote.payload.snapshots).toEqual(cloud.payload.snapshots);
    } else {
      expect(writes).toBeGreaterThan(0);
      await expect(notice.getByRole('button', { name: 'Load latest household', exact: true })).toHaveCount(0);
    }
  });
}
