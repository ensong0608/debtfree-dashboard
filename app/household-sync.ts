import { parseDashboardContract, type DashboardBackup } from "./dashboard-data.ts";
import { householdSessionHeaders, type HouseholdSessionScope } from "./household-session-scope.ts";
import { householdOutboxPrefix, parsePendingHouseholdDraft, type PendingHouseholdDraft } from "./household-recovery.ts";

export type SyncStatus = "connecting" | "saving" | "synced" | "error" | "conflict" | "unauthorized";
export type RemoteHousehold = { householdName: string; role: "owner" | "admin" | "viewer"; payload: unknown; revision: number; members: { email: string; display_name: string | null; role: "owner" | "admin" | "viewer"; status: "active" | "invited" }[] };
type Pending = { revision: number; contract: DashboardBackup };
export const payloadFingerprint = (data: DashboardBackup) => JSON.stringify(data.payload);

/** A serialized, revision-checked outbox. A conflict never automatically replaces remote data. */
type SyncOptions = { storage: Pick<Storage, "getItem" | "setItem" | "removeItem">; key: string; scope?: HouseholdSessionScope; request?: typeof fetch; status: (status: SyncStatus) => void };
export class HouseholdSync {
  private options: SyncOptions;
  revision: number | null = null;
  pending: Pending | null = null;
  private inFlight = false;
  private refreshing = false;
  private generation = 0;
  private writable = false;
  private conflict = false;
  private accepted = "";
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  private recoveredSource: { key: string; raw: string } | null = null;
  private clearRecoveredSource() {
    if (this.recoveredSource && this.options.storage.getItem(this.recoveredSource.key) === this.recoveredSource.raw) this.options.storage.removeItem(this.recoveredSource.key);
    this.recoveredSource = null;
  }
  constructor(options: SyncOptions) {
    this.options = options;
    const raw = options.storage.getItem(options.key);
    if (raw) {
      this.pending = parsePendingHouseholdDraft(raw);
    }
  }
  private status(status: SyncStatus) { if (!this.disposed) this.options.status(status); }
  private request = (url: string, init?: RequestInit) => (this.options.request ?? fetch)(url, {
    ...init, headers: { ...(this.options.scope ? householdSessionHeaders(this.options.scope) : {}), ...init?.headers },
  });
  private async readRemote() {
    const response = await this.request("/api/household", { cache: "no-store" }).catch(error => { this.status("error"); throw error; });
    if (!response.ok) {
      this.writable = false;
      this.status(response.status === 401 || response.status === 403 ? "unauthorized" : "error");
      throw new Error("Could not verify household access. Your pending changes are retained.");
    }
    const remote = await response.json() as RemoteHousehold & { identity?: string; householdId?: string };
    if (this.options.scope && (remote.identity !== this.options.scope.identity || remote.householdId !== this.options.scope.householdId)) {
      this.writable = false; this.status("unauthorized");
      throw new Error("Account changed. Reopen this dashboard.");
    }
    if (!Number.isSafeInteger(remote.revision) || remote.revision < 0 || !["owner", "admin", "viewer"].includes(remote.role)) throw new Error("Invalid household response.");
    const cloud = remote.payload === null ? null : parseDashboardContract(remote.payload, "Household dashboard");
    return { remote, cloud };
  }
  async load() {
    if (this.disposed) throw new Error("This dashboard is closed.");
    if (this.inFlight) throw new Error("A save is still in progress. Retry shortly.");
    const { remote, cloud } = await this.readRemote();
    if (this.disposed) throw new Error("This dashboard is closed.");
    return this.acceptRemote(remote, cloud);
  }
  /** Background reads never replace edits made while the request was outstanding. */
  async refresh(canApply: () => boolean = () => true) {
    if (this.disposed || this.refreshing || this.inFlight || this.pending || !canApply()) return null;
    this.refreshing = true;
    const generation = this.generation;
    try {
      const { remote, cloud } = await this.readRemote();
      if (this.disposed || this.pending || this.inFlight || this.generation !== generation || !canApply()) return null;
      return this.acceptRemote(remote, cloud);
    } finally { this.refreshing = false; }
  }
  private acceptRemote(remote: RemoteHousehold, cloud: DashboardBackup | null) {
    this.writable = remote.role !== "viewer";
    this.revision = remote.revision;
    this.accepted = cloud ? payloadFingerprint(cloud) : "";
    if (this.pending && this.accepted === payloadFingerprint(this.pending.contract)) {
      this.pending = null;
      this.options.storage.removeItem(this.options.key);
      this.clearRecoveredSource();
    }
    this.conflict = Boolean(this.pending && (this.pending.revision !== remote.revision || !this.writable));
    this.status(this.conflict ? "conflict" : this.pending ? "saving" : "synced");
    return { remote, contract: this.pending?.contract ?? cloud, cloud };
  }
  stage(contract: DashboardBackup) {
    if (this.disposed || this.revision === null || !this.writable) return;
    if (!this.pending && payloadFingerprint(contract) === this.accepted) return;
    this.generation++;
    this.pending = { revision: this.pending?.revision ?? this.revision, contract };
    this.options.storage.setItem(this.options.key, JSON.stringify(this.pending));
    if (this.conflict) return;
    this.status("saving");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush(); }, 650);
  }
  /** An explicit recovery choice retains the original revision, never overwriting newer cloud history. */
  recoverDraft(draft: PendingHouseholdDraft & { key?: string }) {
    if (this.disposed || !this.writable || this.revision === null || this.pending) throw new Error("Finish or resolve current changes before restoring a draft.");
    if (draft.key && this.options.scope && !draft.key.startsWith(householdOutboxPrefix(this.options.scope))) throw new Error("Draft belongs to another household.");
    const recovered = parsePendingHouseholdDraft(JSON.stringify(draft));
    this.options.storage.setItem(this.options.key, JSON.stringify(recovered));
    this.pending = recovered;
    if (draft.key) {
      const raw = this.options.storage.getItem(draft.key);
      if (raw) {
        const original = parsePendingHouseholdDraft(raw);
        if (original.revision === recovered.revision && payloadFingerprint(original.contract) === payloadFingerprint(recovered.contract)) this.recoveredSource = { key: draft.key, raw };
      }
    }
    this.generation++;
    this.conflict = recovered.revision !== this.revision;
    this.status(this.conflict ? "conflict" : "saving");
    if (!this.conflict) void this.flush();
  }
  async flush() {
    if (this.disposed || this.inFlight || !this.pending || this.conflict || !this.writable) return;
    this.inFlight = true;
    const sent = this.pending;
    try {
      const response = await this.request("/api/household", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload: sent.contract, revision: sent.revision }) });
      if (this.disposed) return;
      if (response.status === 409) { this.conflict = true; this.status("conflict"); return; }
      if (!response.ok) { if (response.status === 401 || response.status === 403) { this.writable = false; this.status("unauthorized"); } throw new Error("Sync failed"); }
      const result = await response.json() as { revision: number };
      if (!Number.isSafeInteger(result.revision) || result.revision !== sent.revision + 1) throw new Error("Save acknowledgment is invalid.");
      if (this.disposed) return;
      this.revision = result.revision;
      this.accepted = payloadFingerprint(sent.contract);
      if (this.pending === sent) {
        this.options.storage.removeItem(this.options.key);
        this.clearRecoveredSource();
        this.pending = null;
        this.status("synced");
      } else if (this.pending) {
        this.pending.revision = result.revision;
        this.options.storage.setItem(this.options.key, JSON.stringify(this.pending));
      }
    } catch { if (this.writable) this.status("error"); }
    finally { this.inFlight = false; }
    if (this.pending && this.pending !== sent) await this.flush();
  }
  /** Caller must checkpoint local data and obtain an explicit user choice first. */
  async useCloud() {
    if (this.disposed || this.inFlight || this.refreshing) throw new Error("Wait for the current save to finish.");
    const generation = this.generation;
    const { remote, cloud } = await this.readRemote();
    if (this.disposed || this.inFlight || this.generation !== generation) throw new Error("Changes are still being saved.");
    this.options.storage.removeItem(this.options.key);
    this.pending = null;
    this.conflict = false;
    return this.acceptRemote(remote, cloud);
  }
  dispose() { this.disposed = true; clearTimeout(this.timer); }
}
