"use client";

type ProgressReport = ReturnType<(typeof import("./progress-report"))["buildProgressReport"]>;

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

function monthLabel(month: string | null) {
  if (!month) return "Not available";
  const [year, value] = month.split("-").map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function changeLabel(value: number) {
  if (Math.abs(value) < .005) return "No change";
  return `${value > 0 ? "-" : "+"}${currency.format(Math.abs(value))}`;
}

function timeLabel(value: number | null) {
  if (value === null) return "Needs 2 snapshots";
  if (value === 0) return "No change";
  return `${Math.abs(value)} month${Math.abs(value) === 1 ? "" : "s"} ${value > 0 ? "gained" : "lost"}`;
}

export default function ProgressReportPanel({ report }: { report: ProgressReport }) {
  const width = 960;
  const height = 250;
  const padX = 34;
  const padY = 24;
  const maxBalance = Math.max(1, report.startingDebt, ...report.chart.flatMap((point) => [point.actual ?? 0, point.projected ?? 0]));
  const x = (index: number) => report.chart.length <= 1 ? width / 2 : padX + index / (report.chart.length - 1) * (width - padX * 2);
  const y = (value: number) => padY + (1 - value / maxBalance) * (height - padY * 2);
  const line = (key: "actual" | "projected") => report.chart
    .map((point, index) => point[key] === null ? null : `${x(index)},${y(point[key]!)}`)
    .filter(Boolean)
    .join(" ");
  const actualLine = line("actual");
  const projectedLine = line("projected");
  const labelIndexes = [...new Set([0, Math.max(0, report.chart.findIndex((point) => point.label === "Now")), report.chart.length - 1])];

  return <>
    <section className="phase-nine-metrics" aria-label="Debt payoff progress metrics">
      <article><span>Starting debt</span><strong>{currency.format(report.startingDebt)}</strong><small>Opening payoff balance</small></article>
      <article><span>Current debt</span><strong>{currency.format(report.currentDebt)}</strong><small>Transaction-adjusted balance</small></article>
      <article className="good"><span>Principal eliminated</span><strong>{currency.format(report.principalEliminated)}</strong><small>Balance reduction since start</small></article>
      <article className="good"><span>Progress</span><strong>{report.progressPercent.toFixed(1)}%</strong><small>Of starting debt eliminated</small></article>
      <article className={report.changeThisMonth >= 0 ? "good" : "warning"}><span>Change this month</span><strong>{changeLabel(report.changeThisMonth)}</strong><small>Prior snapshot or current ledger</small></article>
      <article><span>Estimated interest paid</span><strong>{currency.format(report.estimatedInterestPaid)}</strong><small>Recorded interest and fee entries</small></article>
      <article className="good"><span>Estimated interest avoided</span><strong>{report.estimatedInterestAvoided === null ? "Not available" : currency.format(report.estimatedInterestAvoided)}</strong><small>Compared with minimum-only pace</small></article>
      <article><span>Current debt-free date</span><strong>{monthLabel(report.currentDebtFreeMonth)}</strong><small>Current saved plan</small></article>
      <article><span>Previous debt-free date</span><strong>{monthLabel(report.previousDebtFreeMonth)}</strong><small>Most recent prior-month snapshot</small></article>
      <article className={(report.timeGainedMonths ?? 0) >= 0 ? "good" : "warning"}><span>Schedule movement</span><strong>{timeLabel(report.timeGainedMonths)}</strong><small>Current versus previous forecast</small></article>
    </section>

    <section className="progress-path-card" aria-labelledby="progress-path-title">
      <header><div><span>Progress chart</span><h2 id="progress-path-title">Actual balance and projected payoff path</h2></div><div className="progress-chart-legend"><span className="actual">Actual</span><span className="projected">Projected</span></div></header>
      <div className="progress-path-scroll">
        <svg viewBox={`0 0 ${width} ${height + 34}`} role="img" aria-label="Actual total debt by saved month followed by the projected payoff path">
          <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} className="chart-axis"/>
          {actualLine && <polyline points={actualLine} className="actual-line"/>}
          {projectedLine && <polyline points={projectedLine} className="projected-line"/>}
          {report.chart.map((point, index) => <g key={`${point.label}-${index}`}>
            {point.actual !== null && <circle cx={x(index)} cy={y(point.actual)} r="5" className="actual-point"><title>{`${point.label}: ${currency.format(point.actual)} actual debt`}</title></circle>}
            {point.projected !== null && <circle cx={x(index)} cy={y(point.projected)} r="4" className="projected-point"><title>{`${point.label}: ${currency.format(point.projected)} projected debt`}</title></circle>}
          </g>)}
          {labelIndexes.map((index) => report.chart[index] && <text key={index} x={x(index)} y={height + 16} textAnchor={index === 0 ? "start" : index === report.chart.length - 1 ? "end" : "middle"}>{report.chart[index].label === "Now" ? "Now" : monthLabel(report.chart[index].month)}</text>)}
        </svg>
      </div>
      <p>Actual points use saved snapshots and today&apos;s balance. The projected line uses the current strategy, rates, and monthly payment assumptions.</p>
    </section>

    <section className="progress-milestones" aria-labelledby="progress-milestones-title">
      <header><span>Milestones</span><h2 id="progress-milestones-title">Meaningful payoff checkpoints</h2></header>
      <div>{report.milestones.map((item) => <article key={item.id} className={item.status}>
        <i aria-hidden="true">{item.status === "achieved" ? "\u2713" : item.status === "projected" ? "\u2192" : "\u00b7"}</i>
        <div><strong>{item.label}</strong><small>{item.status === "achieved" ? "Achieved" : item.status === "projected" ? "Projected" : "Not yet projected"}</small></div>
        <time>{item.month ? monthLabel(item.month) : "Pending"}</time>
      </article>)}</div>
    </section>
  </>;
}
