"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createHouseholdMoneyFormatter } from "./household-currency";
import { useHouseholdCurrency } from "./household-currency-context";
import type { DebtGroup } from "./debt-groups";
import type { BalanceAdjustment, DebtAccount, LedgerTransaction, PayoffSnapshot, RemovedProgressAccount } from "./dashboard-data";
import type { LoanTracker } from "./loan-progress";
import { activityMonthLabel } from "./debt-activity-panel";
import type { ProgressScope, buildProgressView } from "./progress-view";
import DebtScopeCarousel from "./debt-scope-carousel";
import styles from "./actual-progress-page.module.css";

type ProgressView = ReturnType<typeof buildProgressView>;
export type ProgressTab = "overview" | "utilization" | "milestones";
type Range = "3M" | "6M" | "1Y" | "ALL";
const ranges: Range[] = ["3M", "6M", "1Y", "ALL"];
const monthDate = (month: string) => new Date(`${month}-01T12:00:00Z`);
const monthText = (month: string) => monthDate(month).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const monthShort = (month: string) => monthDate(month).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
const moneyFormat = (value: number, formatter: Intl.NumberFormat) => `${value < 0 ? "−" : ""}${formatter.format(Math.abs(value))}`;


function useVisibleTrend(view: ProgressView, range: Range) {
  return useMemo(() => {
    if (range === "ALL") return view.trend;
    const count = range === "3M" ? 3 : range === "6M" ? 6 : 12;
    const latest = view.trend.at(-1)?.month;
    if (!latest) return [];
    const cutoff = Number(latest.slice(0, 4)) * 12 + Number(latest.slice(5, 7)) - count;
    return view.trend.filter(point => Number(point.month.slice(0, 4)) * 12 + Number(point.month.slice(5, 7)) - 1 >= cutoff);
  }, [view.trend, range]);
}

type ChartPoint = ProgressView["trend"][number] & { id?: string; date?: string };
const observationLabel = (point: ChartPoint) => point.date
  ? new Date(`${point.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
  : monthText(point.month);
const axisLabel = (point: ChartPoint) => point.date
  ? new Date(`${point.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
  : monthShort(point.month);

function BalanceChart({ points, money, label }: { points: ChartPoint[]; money: Intl.NumberFormat; label: string }) {
  const figure = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const element = figure.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(Math.max(240, element.clientWidth - 24)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [points.length]);
  const values = points.flatMap(point => point.savedBalance === null ? [] : [{ ...point, balance: point.savedBalance }]);
  if (!values.length) return <div className={styles.emptyChart} role="status"><strong>No saved balance observations in this range.</strong><span>A balance observation is saved when you open the app after a checkpoint.</span></div>;
  const height = 195, left = 60, right = 12, top = 18, bottom = 38;
  const max = Math.max(...values.map(point => point.balance), 1), min = Math.min(...values.map(point => point.balance), 0);
  const span = Math.max(max - min, Math.max(max * .12, 1));
  const low = Math.max(0, min - span * .08), high = max + span * .08;
  const x = (index: number) => points.length <= 1 ? (left + width - right) / 2 : left + index / (points.length - 1) * (width - left - right);
  const y = (balance: number) => top + (high - balance) / (high - low) * (height - top - bottom);
  const segments: string[][] = [];
  points.forEach((point, index) => {
    if (point.savedBalance === null) return;
    const prior = points[index - 1];
    if (prior?.savedBalance !== null && prior && index > 0) {
      const segment = segments.at(-1);
      if (segment) segment.push(`${x(index)},${y(point.savedBalance)}`);
      else segments.push([`${x(index - 1)},${y(prior.savedBalance)}`, `${x(index)},${y(point.savedBalance)}`]);
    } else segments.push([`${x(index)},${y(point.savedBalance)}`]);
  });
  const labelIndexes = points.length <= 4 ? points.map((_, index) => index) : [0, Math.round((points.length - 1) / 3), Math.round((points.length - 1) * 2 / 3), points.length - 1];
  const summary = values.map(point => `${observationLabel(point)} saved balance ${money.format(point.balance)}`).join("; ");
  return <figure ref={figure} className={`progress-snapshot-chart ${styles.chartFigure}`}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}. Recorded saved balance observations: ${summary}. Missing months are left blank.`}>
      {[0, .5, 1].map(fraction => {
        const value = high - fraction * (high - low), yy = y(value);
        return <g key={fraction}><line x1={left} x2={width - right} y1={yy} y2={yy} className={styles.gridLine} /><text x={left - 10} y={yy + 4} textAnchor="end">{new Intl.NumberFormat(money.resolvedOptions().locale, { style: "currency", currency: money.resolvedOptions().currency, notation: "compact", maximumFractionDigits: 1 }).format(value)}</text></g>;
      })}
      {segments.map((segment, index) => segment.length > 1 && <polyline key={index} points={segment.join(" ")} className={styles.balanceLine} />)}
      {points.map((point, index) => point.savedBalance === null ? null : <circle key={point.id ?? point.date ?? point.month} cx={x(index)} cy={y(point.savedBalance)} r="5" className={styles.balanceDot}><title>{observationLabel(point)} saved balance: <span className="money-value">{money.format(point.savedBalance)}</span></title></circle>)}
      {labelIndexes.map(index => <text key={points[index].id ?? points[index].date ?? `${points[index].month}-${index}`} x={x(index)} y={height - 10} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}>{axisLabel(points[index])}</text>)}
    </svg>
    <figcaption>{values.length === 1 ? "One balance recorded" : `${money.format(values[0].balance)} to ${money.format(values.at(-1)!.balance)}`} · missing periods stay blank.</figcaption>
    <ol className="snapshot-chart-labels">{(values.length > 2 ? [values[0], values.at(-1)!] : values).map(point => <li key={point.id ?? point.date ?? point.month}><time dateTime={point.date ?? point.observation?.observedOn ?? point.month}>{observationLabel(point)}</time><strong><span className="money-value">{money.format(point.balance)}</span></strong></li>)}</ol>
  </figure>;
}

function ProgressRing({ label, starting, current, reduction, money }: { label: string; starting: number | null; current: number; reduction: number | null; money: Intl.NumberFormat }) {
  const percent = starting !== null && starting > 0 && reduction !== null ? reduction / starting * 100 : null;
  const arc = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const ringStyle = { "--progress-ring": `${arc * 3.6}deg` } as CSSProperties;
  return <article className={styles.ringCard}>
    <div className={styles.ring} style={ringStyle} role="img" aria-label={`${label}: ${percent === null ? "starting comparison unavailable" : `${Math.abs(percent).toFixed(0)} percent ${percent >= 0 ? "reduced" : "increased"}`}`}><span>{percent === null ? "—" : `${Math.abs(percent).toFixed(0)}%`}</span></div>
    <strong>{label}</strong>
    <span>{reduction === null ? "Starting comparison unavailable" : `${moneyFormat(Math.abs(reduction), money)} ${reduction >= 0 ? "reduced" : "increased"}`}</span>
    <small>Current <span className="money-value">{money.format(current)}</span></small>
  </article>;
}

function MilestoneItem({ item }: { item: ProgressView["milestones"][number] }) {
  const evidence = item.status === "projected" && item.projectedMonth ? `Projected ${monthText(item.projectedMonth)}`
    : item.achievedOn ? `Recorded ${new Date(`${item.achievedOn}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`
      : item.firstObservedMonth ? `First observed ${monthText(item.firstObservedMonth)}`
        : item.evidence === "live-balance" ? "Attained by current balance" : "Not recorded yet";
  return <li className={`${styles.milestone} ${styles[item.status]}`}>
    <span className={styles.milestoneMark} aria-hidden="true">{item.status === "achieved" ? "✓" : item.status === "projected" ? "◷" : "○"}</span>
    <span className={styles.milestoneCopy}><strong>{item.label}</strong><small>{evidence}</small></span>
    <b>{item.status === "achieved" ? "Achieved" : item.status === "projected" ? "Projected" : "Pending"}</b>
  </li>;
}

export default function ActualProgressPage({ accounts, loans, removedAccounts = [], progressViews, onAccounts, utilization, tab: controlledTab, onTab }: {
  tab?: ProgressTab; onTab?: (tab: ProgressTab) => void; groups?: DebtGroup[]; accounts: DebtAccount[]; transactions: LedgerTransaction[]; adjustments: BalanceAdjustment[]; snapshots?: PayoffSnapshot[]; loans: LoanTracker[]; removedAccounts?: RemovedProgressAccount[];
  progressViews: Record<ProgressScope, ProgressView>; readOnly?: boolean; onLoanSnapshot?: () => void; onCapture?: (note: string) => void; onDelete?: (id: string) => void; onUpdateNote?: (id: string, note: string) => void; onAccounts: () => void; onActivity?: () => void; utilization?: ReactNode;
}) {
  const householdCurrency = useHouseholdCurrency();
  const money = createHouseholdMoneyFormatter(householdCurrency, { style: "currency" });
  const [localTab, setLocalTab] = useState<ProgressTab>("overview");
  const tab = controlledTab ?? localTab, setTab = onTab ?? setLocalTab;
  const [scope, setScope] = useState<ProgressScope>(() => accounts.length || removedAccounts.length ? "accounts" : loans.length ? "loans" : "household");
  const [range, setRange] = useState<Range>("6M");
  const scopeOptions: { value: ProgressView["scope"]; label: string }[] = [
    {value:"accounts", label:"Cards & Loans"}, {value:"loans", label:"Home & Auto"}, {value:"household", label:"All debts"}
  ];
  const currentScope = scopeOptions.some(option => option.value === scope) ? scope : scopeOptions[0]?.value ?? "household";
  const view = progressViews[currentScope];
  const scopeSlides = scopeOptions.map(option => ({
    scope: option.value,
    label: option.label,
    content: (() => {
      const scopedView = progressViews[option.value];
      const scopedReduction = scopedView.summary.reduction;
      const scopedPercent = scopedView.summary.percent;
      const arc = scopedPercent === null ? 0 : Math.max(0, Math.min(100, Math.abs(scopedPercent)));
      const ringStyle = { "--progress-ring": `${arc * 3.6}deg` } as CSSProperties;
      const label = scopedView.summary.comparisonAvailable && scopedPercent !== null ? `${Math.abs(scopedPercent).toFixed(1)}%` : "—";
      return <section className={`${styles.summary} ${styles.compactSummary}`} data-negative={scopedReduction !== null && scopedReduction < 0} aria-label={`${option.label} debt progress`}>
        <div className={styles.compactSummaryMain}>
          <div className={styles.compactProgressRing} style={ringStyle} role="img" aria-label={`${option.label}: ${scopedPercent === null ? "starting comparison unavailable" : `${Math.abs(scopedPercent).toFixed(1)} percent ${scopedPercent >= 0 ? "reduced" : "increased"}`}`}><span>{label}</span></div>
          <div className={styles.compactProgressCopy}><strong data-large-value={Math.abs(scopedView.summary.current) >= 1000000}><span className="money-value">{money.format(scopedView.summary.current)}</span></strong><small>Remaining</small><p>{scopedReduction === null ? "Starting comparison unavailable" : <><b>{moneyFormat(Math.abs(scopedReduction), money)}</b> {scopedReduction >= 0 ? "reduced" : "increased"}</>}</p></div>
        </div>
        <small className={styles.compactBaseline}>{scopedView.baselineKind === "original-loan-amounts" ? "Original balances" : scopedView.baselineKind === "mixed" ? "Starting balances" : "Saved start"} · {scopedView.summary.starting === null ? "Unavailable" : money.format(scopedView.summary.starting)}</small>
        {scopedView.actual.retainedCount > 0 && option.value !== "loans" && <small className={styles.retained}>Includes last balances for {scopedView.actual.retainedCount} removed accounts.</small>}
      </section>;
    })(),
  }));
  const trend = useVisibleTrend(view, range);
  const currentMonth = view.live.asOf.slice(0, 7);
  const accountData = view.actual;
  const baselineLabel = view.baselineKind === "original-loan-amounts" ? "Original loan balances" : view.baselineKind === "mixed" ? "Saved account and original loan balances" : "Saved starting balance";
  const categoryData = (() => {
    const cardsLoans = progressViews.accounts;
    const houses = loans.filter(loan => loan.kind === "house");
    const autos = loans.filter(loan => loan.kind === "car");
    const loanCategory = (label: string, items: LoanTracker[]) => {
      const valid = items.every(loan => Number.isFinite(loan.originalAmount) && loan.originalAmount > 0);
      const start = valid && items.length ? items.reduce((sum, loan) => sum + loan.originalAmount, 0) : null;
      const now = items.reduce((sum, loan) => sum + loan.remainingAmount, 0);
      return { label, starting: start, current: now, reduction: start === null ? null : start - now };
    };
    const categories = [] as { label: string; starting: number | null; current: number; reduction: number | null }[];
    if (cardsLoans.actual.groups.length || accounts.length || removedAccounts.length) categories.push({ label: "Cards & Loans", starting: cardsLoans.summary.starting, current: cardsLoans.summary.current, reduction: cardsLoans.summary.reduction });
    if (houses.length) categories.push(loanCategory("House", houses));
    if (autos.length) categories.push(loanCategory("Auto", autos));
    return categories;
  })();
  const paidOffAccounts = accountData.groups.flatMap(group => group.accounts).filter(account => !account.removedFromDebts && (account.baselineBalance ?? 0) > 0 && account.balance <= 0).length;
  const activityMonth = accountData.monthEntries.length ? activityMonthLabel(currentMonth) : null;
  const monthlyMovement = accountData.monthEntries.length ? accountData.monthlyChange : null;

  return <div className={`screen snapshots-screen actual-progress-screen ${styles.screen}`}>
    {!accounts.length && !removedAccounts.length && !loans.length ? <section className="large-empty"><h2>Add a debt to start tracking progress</h2><button className="primary" onClick={onAccounts}>Add debt</button></section> : <>
      {!onTab && <nav className="compact-segments" aria-label="Progress sections">{([['overview', 'Overview'], ['utilization', 'Utilization'], ['milestones', 'Milestones']] as const).map(([value, label]) => <button key={value} type="button" aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value)}>{label}</button>)}</nav>}

      {tab === "overview" && <div className={styles.stack}>
        <div className={styles.integratedSummary}><DebtScopeCarousel slides={scopeSlides} value={currentScope} onChange={setScope} label="Progress scope" /></div>

        <section className={`${styles.card} ${styles.overviewTrend}`} aria-labelledby="progress-trend-title">
          <header className={styles.cardHeader}><div><h2 id="progress-trend-title">Debt balance trend</h2><p>Saved balance observations</p></div><div className={styles.ranges} role="group" aria-label="Debt trend time range">{ranges.map(value => <button type="button" key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{value}</button>)}</div></header>
          <BalanceChart points={trend} money={money} label="Debt balance trend" />
        </section>

        <section className={styles.card} aria-labelledby="progress-category-title">
          <header className={styles.cardHeader}><div><h2 id="progress-category-title">All-category comparison</h2><p>Cards &amp; Loans · House · Auto</p></div></header>
          <div className={styles.ringGrid}>
            {categoryData.map(category => <ProgressRing key={category.label} label={category.label} starting={category.starting} current={category.current} reduction={category.reduction} money={money} />)}
          </div>
        </section>

        <section className={`${styles.card} ${styles.monthlyCard}`} aria-labelledby="progress-overview-detail-title">
          <header className={styles.cardHeader}><div><h2 id="progress-overview-detail-title">This month</h2></div></header>
          <div className="progress-month-highlights">
            {currentScope !== "loans" && <article className="actual-month-card paid-off-card"><h3>Accounts paid off</h3><strong>{paidOffAccounts}</strong></article>}
            {currentScope !== "loans" && <article className="actual-month-card"><h3>Net account change</h3><strong>{monthlyMovement === null ? "—" : moneyFormat(-monthlyMovement, money)}</strong><p>{monthlyMovement === null ? "No recorded change" : `${monthlyMovement <= 0 ? "lower" : "higher"} · ${activityMonth ?? ""}`}</p></article>}
          </div>
        </section>

        {currentScope !== "loans" && <section className={`${styles.card} ${styles.compactAccountRows}`} aria-label="Account balance changes">
          {accountData.groups.flatMap(group=>group.accounts).map(account=><article key={account.id}><span><strong>{account.name}</strong>{account.removedFromDebts && <small>Removed debt · retained balance</small>}</span><b>{account.baselineBalance === undefined ? 'Unavailable' : `${money.format(Math.abs(account.baselineBalance-account.balance))} ${account.baselineBalance>=account.balance?'lower':'higher'}`}</b></article>)}
        </section>}
      </div>}

      {tab === "utilization" && <div className={styles.stack}>{utilization ?? <section className={styles.card}><p className={styles.emptyChart}>Utilization data is unavailable.</p></section>}</div>}

      {tab === "milestones" && <div className={styles.stack}>
        <div className={styles.integratedSummary}><DebtScopeCarousel slides={scopeSlides} value={currentScope} onChange={setScope} label="Progress scope" /></div>
        {([['Achieved', view.milestones.filter(item => item.status === 'achieved')], ['Coming next', view.milestones.filter(item => item.status !== 'achieved')]] as const).map(([heading, items]) => <section className={styles.card} key={heading}><header className={styles.cardHeader}><h2>{heading}</h2></header>{items.length ? <ol className={styles.milestoneList}>{items.map(item => <MilestoneItem key={item.id} item={item}/>)}</ol> : <p className={styles.emptyChart}>{heading === 'Achieved' ? 'No achieved milestones recorded yet.' : 'No upcoming milestones.'}</p>}</section>)}
        <section className={styles.card} aria-labelledby="milestone-progress-ring-title"><header className={styles.cardHeader}><div><h2 id="milestone-progress-ring-title">Milestone progress</h2><p>{baselineLabel}</p></div></header><div className={styles.ringGrid}>{categoryData.map(category => <ProgressRing key={category.label} label={category.label} starting={category.starting} current={category.current} reduction={category.reduction} money={money} />)}</div></section>
      </div>}
    </>}
  </div>;
}
