import { parseDashboardContract, type DashboardBackup } from "./dashboard-data.ts";

export type SyncStatus = "connecting" | "saving" | "synced" | "error" | "conflict";
export type RemoteHousehold = { householdName: string; role: "owner" | "admin" | "viewer"; payload: unknown; revision: number; members: { email: string; display_name: string | null; role: "owner" | "admin" | "viewer"; status: "active" | "invited" }[] };
type Pending = { revision: number; contract: DashboardBackup };
export const payloadFingerprint = (data: DashboardBackup) => JSON.stringify(data.payload);

/** A serialized, revision-checked outbox. A conflict never automatically replaces remote data. */
type SyncOptions = { storage: Pick<Storage, "getItem" | "setItem" | "removeItem">; key: string; request?: typeof fetch; status: (status: SyncStatus) => void };
export class HouseholdSync {
  private options: SyncOptions;
  revision: number | null = null;
  pending: Pending | null = null;
  private inFlight = false;
  private writable = false;
  private conflict = false;
  private accepted = "";
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(options: SyncOptions) {
    this.options = options;
    const raw = options.storage.getItem(options.key);
    if (raw) {
      const saved = JSON.parse(raw);
      if (!Number.isSafeInteger(saved.revision) || saved.revision < 0) throw new Error("Recovery revision is invalid. Export your device backup before continuing.");
      this.pending = { revision: saved.revision, contract: parseDashboardContract(saved.contract) };
    }
  }
  private request = (url: string, init?: RequestInit) => (this.options.request ?? fetch)(url, init);
  async load() {
    if (this.inFlight) throw new Error("A save is still in progress. Retry shortly.");
    const response = await this.request("/api/household", { cache: "no-store" });
    if (!response.ok) { this.writable = false; throw new Error("Could not verify household access. Your pending changes are retained."); }
    const remote = await response.json() as RemoteHousehold;
    const cloud = remote.payload === null ? null : parseDashboardContract(remote.payload, "Household dashboard");
    this.writable = remote.role !== "viewer";
    this.revision = remote.revision;
    this.accepted = cloud ? payloadFingerprint(cloud) : "";
    if (this.pending && this.accepted === payloadFingerprint(this.pending.contract)) {
      this.pending = null;
      this.options.storage.removeItem(this.options.key);
    }
    this.conflict = Boolean(this.pending && (this.pending.revision !== remote.revision || !this.writable));
    this.options.status(this.conflict ? "conflict" : this.pending ? "saving" : "synced");
    return { remote, contract: this.pending?.contract ?? cloud, cloud };
  }
  stage(contract: DashboardBackup) {
    if (this.revision === null || !this.writable) return;
    if (!this.pending && payloadFingerprint(contract) === this.accepted) return;
    this.pending = { revision: this.pending?.revision ?? this.revision, contract };
    this.options.storage.setItem(this.options.key, JSON.stringify(this.pending));
    if (this.conflict) return;
    this.options.status("saving");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush(); }, 650);
  }
  async flush() {
    if (this.inFlight || !this.pending || this.conflict || !this.writable) return;
    this.inFlight = true;
    const sent = this.pending;
    try {
      const response = await this.request("/api/household", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload: sent.contract, revision: sent.revision }) });
      if (response.status === 409) { this.conflict = true; this.options.status("conflict"); return; }
      if (!response.ok) { if (response.status === 401 || response.status === 403) this.writable = false; throw new Error("Sync failed"); }
      const result = await response.json() as { revision: number };
      this.revision = result.revision;
      this.accepted = payloadFingerprint(sent.contract);
      if (this.pending === sent) {
        this.options.storage.removeItem(this.options.key);
        this.pending = null;
        this.options.status("synced");
      } else if (this.pending) {
        this.pending.revision = result.revision;
        this.options.storage.setItem(this.options.key, JSON.stringify(this.pending));
      }
    } catch { this.options.status("error"); }
    finally { this.inFlight = false; }
    if (this.pending && this.pending !== sent) await this.flush();
  }
  /** Caller must checkpoint local data and obtain an explicit user choice first. */
  async useCloud() {
    if (this.inFlight) throw new Error("Wait for the current save to finish.");
    this.options.storage.removeItem(this.options.key);
    this.pending = null;
    this.conflict = false;
    return this.load();
  }
  dispose() { clearTimeout(this.timer); }
}
