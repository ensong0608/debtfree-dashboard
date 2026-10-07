import type { DebtAccount } from "./dashboard-data";
import { trackedPayoffProgress } from "./debt-presentation";
export default function DebtProgressRing({ account }: { account: DebtAccount }) {
  const progress = trackedPayoffProgress(account);
  const fraction = (progress ?? 0) / 100;
  const start = fraction < .5 ? [222, 105, 100] : [238, 195, 74];
  const end = fraction < .5 ? [238, 195, 74] : [115, 205, 178];
  const blend = fraction < .5 ? fraction * 2 : (fraction - .5) * 2;
  const color = start.map((channel, index) => Math.round(channel + (end[index] - channel) * blend));
  const track = color.map(channel => Math.round(channel + (255 - channel) * .72));
  return <div className="debt-progress-ring" role={progress === null ? "img" : "progressbar"} aria-label={progress === null ? `${account.name}: starting balance not recorded` : `${account.name} balance reduction since tracking began`} aria-valuenow={progress === null ? undefined : Number(progress.toFixed(1))} aria-valuemin={progress === null ? undefined : 0} aria-valuemax={progress === null ? undefined : 100} style={{ background: progress === null ? "#dce3eb" : `conic-gradient(rgb(${color.join(",")}) ${progress}%, rgb(${track.join(",")}) 0)` }}><span>{progress === null ? "—" : `${progress.toFixed(1)}%`}</span></div>;
}
