"use client";
import OutlineIcon from "./outline-icon";
export default function DashboardHeader({ title, subtitle, accountOpen, onAccount, status }: { title: string; subtitle?: string; accountOpen: boolean; onAccount: () => void; status: string }) {
  return <header className="shared-dashboard-header">
    <div className="shared-dashboard-topbar"><div className="shared-dashboard-wordmark" aria-label="DebtFree"><span>Debt</span><b>Free</b></div><div className="shared-dashboard-account"><button type="button" onClick={onAccount} aria-label={accountOpen ? "Close Account" : "Open Account"}><OutlineIcon name="account"/></button><span className="sr-only" role="status">{status}</span></div></div>
    <div className="page-heading"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
  </header>;
}
