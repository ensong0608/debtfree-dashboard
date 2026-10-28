"use client";
import BackButton from "./back-button";
import OutlineIcon from "./outline-icon";
import type { ReactNode } from "react";
export default function DashboardHeader({ title, home = false, accountOpen, onAccount, status, onSettings, settingsOpen, tabs }: { title: string; home?: boolean; accountOpen: boolean; onAccount: () => void; status: string; onSettings?: () => void; settingsOpen?: boolean; tabs?: ReactNode }) {
  return <header className="shared-dashboard-header">
    <div className="shared-dashboard-topbar shared-dashboard-title-row">{!home && accountOpen && <BackButton className="shared-header-back" aria-label="Close Account" onClick={onAccount}/>}{home ? <div className="shared-dashboard-wordmark" aria-label="DebtFree"><span>Debt</span><b>Free</b></div> : <div className="shared-dashboard-title"><h1>{title}</h1></div>}
      {home && <div className="shared-dashboard-account"><button type="button" onClick={onAccount} aria-label="Open Account"><span><OutlineIcon name="account"/></span></button></div>}
      {!home && onSettings && <button className="shared-header-settings" type="button" aria-label={settingsOpen ? "Close Settings" : "Open Settings"} aria-pressed={settingsOpen} onClick={onSettings}><OutlineIcon name="settings"/></button>}
      <span className="sr-only" role="status">{status}</span>
    </div>
    {tabs && <div className="shared-dashboard-tab-row">{tabs}</div>}
  </header>;
}
