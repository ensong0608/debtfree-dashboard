"use client";

import { useState } from "react";
import { dashboardDataErrorMessage } from "./dashboard-data";
import { previewDashboardImport, type DashboardImportPreview, type ImportMode } from "./data-transfer";

type PendingImport = DashboardImportPreview & { file: File };

export default function DataSafetyPanel(props: {
  deviceOnly: boolean;
  isViewer: boolean;
  transferMessage: string;
  onExport: () => Promise<void>;
  onImport: (file: File, mode: ImportMode) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("replace");
  const [localMessage, setLocalMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState("");

  const prepareImport = async (file: File) => {
    setLocalMessage("");
    try {
      const preview = previewDashboardImport(await file.text());
      setPendingImport({ ...preview, file });
      setImportMode("replace");
    } catch (error) {
      setLocalMessage(`Import failed: ${dashboardDataErrorMessage(error)}`);
    }
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    setWorking(true);
    try {
      await props.onImport(pendingImport.file, importMode);
      setPendingImport(null);
    } finally {
      setWorking(false);
    }
  };

  const confirmReset = async () => {
    if (resetText !== "RESET") return;
    setWorking(true);
    try {
      await props.onReset();
      setResetOpen(false);
      setResetText("");
    } finally {
      setWorking(false);
    }
  };

  const message = localMessage || props.transferMessage;
  return <section className="data-transfer-card">
    <div>
      <span className="eyebrow">Full data transfer</span>
      <h2>Backup or restore the complete dashboard</h2>
      <p>Use one private JSON file to move debts, monthly plans, one-time adjustments, payees, transactions, payoff settings, and snapshots between dashboard addresses.</p>
      <small>{props.deviceOnly ? "Imported data is stored only in this browser on this device." : props.isViewer ? "Viewers cannot replace household data." : "Imported data is saved to this device and your connected household."}</small>
    </div>
    <aside className="backup-reminder" role="note">
      <strong>Keep a recent private backup</strong>
      <p>Clearing browser data may remove information stored on this device. Export a full backup after meaningful changes and keep it somewhere private.</p>
    </aside>
    <div className="data-transfer-actions">
      <button className="secondary" type="button" onClick={() => void props.onExport()}>Export full backup</button>
      {!props.isViewer && <label className="primary import-file">
        <input type="file" accept=".json,application/json" onChange={(event) => {
          const input = event.currentTarget;
          const file = input.files?.[0];
          if (file) void prepareImport(file);
          input.value = "";
        }}/>
        <span>Import full backup</span>
      </label>}
    </div>
    {pendingImport && <div className="import-preview" role="dialog" aria-modal="true" aria-labelledby="import-preview-title">
      <div><span>Review before importing</span><h3 id="import-preview-title">{pendingImport.file.name}</h3><p>Nothing changes until you confirm an import method.</p></div>
      <dl>
        <div><dt>Debts</dt><dd>{pendingImport.debtCount}</dd></div>
        <div><dt>Monthly records</dt><dd>{pendingImport.monthlyRecordCount}</dd></div>
        <div><dt>Transactions</dt><dd>{pendingImport.transactionCount}</dd></div>
        <div><dt>Snapshots</dt><dd>{pendingImport.snapshotCount}</dd></div>
        <div><dt>Import version</dt><dd>{pendingImport.sourceVersion}</dd></div>
      </dl>
      <fieldset><legend>Import method</legend>
        <label><input type="radio" name="import-mode" value="replace" checked={importMode === "replace"} onChange={() => setImportMode("replace")}/><span><strong>Replace current data</strong><small>Uses the selected backup as the complete dashboard. Your current data is automatically backed up first.</small></span></label>
        <label><input type="radio" name="import-mode" value="merge" checked={importMode === "merge"} onChange={() => setImportMode("merge")}/><span><strong>Merge with current data</strong><small>Keeps current records, adds new IDs, and updates matching IDs with imported values.</small></span></label>
      </fieldset>
      <div className="import-preview-actions"><button className="secondary" type="button" disabled={working} onClick={() => setPendingImport(null)}>Cancel</button><button className="primary" type="button" disabled={working} onClick={() => void confirmImport()}>{working ? "Importing..." : importMode === "replace" ? "Replace and import" : "Merge and import"}</button></div>
    </div>}
    {!props.isViewer && <div className="reset-data-row"><div><strong>Reset dashboard data</strong><p>Remove debts, plans, transactions, snapshots, and settings while keeping your account access.</p></div><button className="danger" type="button" onClick={() => setResetOpen(true)}>Reset data</button></div>}
    {resetOpen && <div className="reset-confirmation" role="dialog" aria-modal="true" aria-labelledby="reset-data-title">
      <h3 id="reset-data-title">Reset the complete dashboard?</h3>
      <p>This clears the current dashboard and its automatic device backup. Export first if you may need this information later.</p>
      <label><span>Type RESET to confirm</span><input value={resetText} autoComplete="off" onChange={(event) => setResetText(event.target.value)}/></label>
      <div><button className="secondary" type="button" disabled={working} onClick={() => { setResetOpen(false); setResetText(""); }}>Cancel</button><button className="danger" type="button" disabled={working || resetText !== "RESET"} onClick={() => void confirmReset()}>{working ? "Resetting..." : "Reset dashboard"}</button></div>
    </div>}
    {message && <p role={message.startsWith("Import failed") || message.startsWith("Reset failed") ? "alert" : "status"} className={message.startsWith("Import failed") || message.startsWith("Reset failed") ? "transfer-message error" : "transfer-message"}>{message}</p>}
  </section>;
}
