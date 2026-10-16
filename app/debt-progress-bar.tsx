import type { DebtAccount } from "./dashboard-data";
import { trackedPayoffProgress } from "./debt-presentation";
export default function DebtProgressBar({ account }: { account: DebtAccount }) {
  const progress = trackedPayoffProgress(account);
  return <div className="debt-reduction">
    {progress !== null && <div className="debt-reduction-track" role="progressbar" aria-label={`${account.name} balance reduction since tracking began`} aria-valuenow={Number(progress.toFixed(1))} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%`, background: progress < 20 ? "var(--progress-low)" : progress < 60 ? "var(--progress-mid)" : "var(--progress-high)" }}/></div>}
    <div className="debt-reduction-labels"><span>{progress === null ? "Starting balance not recorded" : <><b>{progress.toFixed(1)}%</b> reduced since tracking began</>}</span></div>
  </div>;
}
