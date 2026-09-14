import {
  parseDashboardContract,
  parseDashboardJson,
  serializeDashboardBackup,
  type DashboardBackup,
  type DashboardPayload,
} from "./dashboard-data.ts";

export const DASHBOARD_STORAGE_KEY = "debtfree-dashboard-prototype-v1";
export const DASHBOARD_CHECKPOINT_STORAGE_KEY = "debtfree-dashboard-pre-import";
export const DASHBOARD_BACKUP_STORAGE_KEY = "debtfree-dashboard-prototype-v1-backup";

type StorageAdapter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type HouseholdLoadResult = {
  contract: DashboardBackup | null;
  recoveredFromBackup: boolean;
};

export interface DataRepository {
  loadHousehold(): Promise<HouseholdLoadResult>;
  saveHousehold(data: DashboardBackup): Promise<void>;
  exportData(data: DashboardBackup): Promise<string>;
  importData(payload: string): Promise<DashboardBackup>;
  resetHousehold(): Promise<void>;
  checkpoint(data: DashboardBackup): Promise<void>;
  loadCheckpoint(): Promise<DashboardBackup | null>;
}

function readContract(storage: StorageAdapter, key: string, label: string) {
  const serialized = storage.getItem(key);
  if (!serialized) return null;
  return parseDashboardContract(JSON.parse(serialized), label);
}

export function createBrowserDataRepository(
  isMeaningful: (payload: DashboardPayload) => boolean,
  storageFactory: () => StorageAdapter = () => window.localStorage,
): DataRepository {
  return {
    async loadHousehold() {
      const storage = storageFactory();
      let primary: DashboardBackup | null = null;
      let backup: DashboardBackup | null = null;
      try { primary = readContract(storage, DASHBOARD_STORAGE_KEY, "Saved dashboard"); }
      catch { /* A damaged primary can be recovered from the automatic backup. */ }
      try { backup = readContract(storage, DASHBOARD_BACKUP_STORAGE_KEY, "Saved dashboard backup"); }
      catch { /* A damaged backup should not block a valid primary. */ }
      if (primary) return { contract: primary, recoveredFromBackup: false };
      if (backup && isMeaningful(backup.payload)) return { contract: backup, recoveredFromBackup: true };
      return { contract: primary, recoveredFromBackup: false };
    },

    async saveHousehold(data) {
      const storage = storageFactory();
      const serialized = serializeDashboardBackup(data);
      try {
        const previous = readContract(storage, DASHBOARD_STORAGE_KEY, "Saved dashboard");
        const previousSerialized = previous ? serializeDashboardBackup(previous) : null;
        if (previous && previousSerialized !== null && JSON.stringify(previous.payload) !== JSON.stringify(data.payload) && isMeaningful(previous.payload)) {
          storage.setItem(DASHBOARD_BACKUP_STORAGE_KEY, previousSerialized);
        }
      } catch { /* A damaged previous draft should not block the current safe save. */ }
      storage.setItem(DASHBOARD_STORAGE_KEY, serialized);
    },

    async checkpoint(data) {
      storageFactory().setItem(DASHBOARD_CHECKPOINT_STORAGE_KEY, serializeDashboardBackup(data));
    },
    async loadCheckpoint() {
      return readContract(storageFactory(), DASHBOARD_CHECKPOINT_STORAGE_KEY, "Recovery checkpoint");
    },

    async exportData(data) {
      return serializeDashboardBackup(data, true);
    },

    async importData(payload) {
      return parseDashboardJson(payload);
    },

    async resetHousehold() {
      const storage = storageFactory();
      storage.removeItem(DASHBOARD_STORAGE_KEY);
      storage.removeItem(DASHBOARD_BACKUP_STORAGE_KEY);
      storage.removeItem(DASHBOARD_CHECKPOINT_STORAGE_KEY);
    },
  };
}
