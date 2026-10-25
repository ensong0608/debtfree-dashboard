"use client";
import OutlineIcon from "./outline-icon";
import type { ReactNode } from "react";
export default function DashboardHeader({ title, home = false, accountOpen, onAccount, status, action, tabs }: { title: string; home?: boolean; accountOpen: boolean; onAccount: () => void; status: string; action?: { label: string; disabled?: boolean; onClick: () => void }; tabs?: ReactNode }) {
  return <header className="shared-dashboard-header">
    <div className="shared-dashboard-topbar">{home ? <div className="shared-dashboard-wordmark" aria-label="DebtFree"><span>Debt</span><b>Free</b></div> : <div className="page-heading"><h1>{title}</h1></div>}
      {home && <div className="shared-dashboard-account"><button type="button" onClick={onAccount} aria-label="Open Account"><span><OutlineIcon name="account"/></span></button></div>}
      {!home && action && <button className="shared-header-action" type="button" aria-label={action.label} disabled={action.disabled} onClick={action.onClick}><span className="shared-header-action-disc"><OutlineIcon name="plus"/></span></button>}
      {!home && accountOpen && <button className="shared-header-back" type="button" aria-label="Close Account" onClick={onAccount}>‹</button>}
      <span className="sr-only" role="status">{status}</span>
    </div>
    {tabs}
  </header>;
}
