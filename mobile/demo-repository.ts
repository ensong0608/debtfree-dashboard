import { createBrowserDataRepository, DASHBOARD_STORAGE_KEY, DASHBOARD_BACKUP_STORAGE_KEY, DASHBOARD_CHECKPOINT_STORAGE_KEY } from '../app/data-repository.ts';
import { parseDashboardJson } from '../app/dashboard-data.ts';
import { createDemoFixture } from './demo-fixture.ts';

export const DEMO_SCOPE = 'synthetic-mobile-demo-v1';
export const demoKey = (base: string) => base + ':' + encodeURIComponent(DEMO_SCOPE);
export const DEMO_INITIALIZED_KEY = demoKey('debtfree-demo-initialized');
type DemoStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// Validate before mounting DashboardClient: its normal load fallback must never
// turn damaged sample state into an empty auto-save or a fresh seed.
export async function createDemoRepository(storage: DemoStorage) {
  const keys = [DASHBOARD_STORAGE_KEY, DASHBOARD_BACKUP_STORAGE_KEY, DASHBOARD_CHECKPOINT_STORAGE_KEY];
  let hasSavedState = false;
  for (const key of keys) {
    const raw = storage.getItem(demoKey(key));
    if (raw !== null) {
      hasSavedState = true;
      try { parseDashboardJson(raw); }
      catch { throw new Error('Demo storage is damaged. Existing data was kept.'); }
    }
  }
  const repository = createBrowserDataRepository(payload => payload.accounts.length > 0 || payload.transactions.length > 0, () => storage, DEMO_SCOPE);
  if (!hasSavedState && storage.getItem(DEMO_INITIALIZED_KEY) === null) await repository.saveHousehold(createDemoFixture());
  storage.setItem(DEMO_INITIALIZED_KEY, 'true');
  return repository;
}
