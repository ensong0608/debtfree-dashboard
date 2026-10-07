import type { DebtAccount } from "./dashboard-data";
import { trackedPayoffProgress } from "./debt-presentation";
export default function DebtProgressRing({ account }: { account: DebtAccount }) {
  const progress = trackedPayoffProgress(account);
  const fraction = (progress ?? 0) / 100;
  const color = [222, 120, 110].map((start, index) => Math.round(start + ([115, 205, 178][index] - start) * fraction));
  const track = color.map(channel => Math.round(channel + (255 - channel) * .72));
  return <div className="debt-progress-ring" role={progress === null ? "img" : "progressbar"} aria-label={progress === null ? `${account.name}: starting balance not recorded` : `${account.name} balance reduction since tracking began`} aria-valuenow={progress === null ? undefined : Number(progress.toFixed(1))} aria-valuemin={progress === null ? undefined : 0} aria-valuemax={progress === null ? undefined : 100} style={{ background: progress === null ? "#dce3eb" : `conic-gradient(rgb(${color.join(",")}) ${progress}%, rgb(${track.join(",")}) 0)` }}><span>{progress === null ? "—" : `${progress.toFixed(1)}%`}</span></div>;
}
