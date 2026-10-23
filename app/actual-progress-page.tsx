"use client";
import { useMemo, useState, type CSSProperties } from "react";
import InfoTooltip from "./info-tooltip";
import { createHouseholdMoneyFormatter } from "./household-currency";
import { useHouseholdCurrency } from "./household-currency-context";
import type { DebtGroup } from "./debt-groups";
import type { BalanceAdjustment, DebtAccount, LedgerTransaction, PayoffSnapshot, RemovedProgressAccount } from "./dashboard-data";
import type { LoanTracker } from "./loan-progress";
import DebtActivityPanel, { activityMonthLabel } from "./debt-activity-panel";
import type { ProgressScope, buildProgressView } from "./progress-view";
import { householdDate } from "./household-date";
import styles from "./actual-progress-page.module.css";

type ProgressView = ReturnType<typeof buildProgressView>;
type ProgressTab = "overview" | "trends" | "milestones";
type Range = "3M" | "6M" | "1Y" | "ALL";
const ranges: Range[] = ["3M", "6M", "1Y", "ALL"];
const monthDate = (month: string) => new Date(`${month}-01T12:00:00Z`);
const monthText = (month: string) => monthDate(month).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const monthShort = (month: string) => monthDate(month).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
const moneyFormat = (value: number, formatter: Intl.NumberFormat) => `${value < 0 ? "−" : ""}${formatter.format(Math.abs(value))}`;

function ProgressBar({ name, starting, current }: { name: string; starting: number; current: number }) {
  const percent = starting > 0 ? Math.max(0, Math.min(100, (starting - current) / starting * 100)) : 0;
  return <div className="actual-progress-bar" role="progressbar" aria-label={`${name} balance reduction`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(percent.toFixed(1))}><i style={{ width: `${percent}%` }} /></div>;
}

function useVisibleTrend(view: ProgressView, range: Range) {
  return useMemo(() => {
    if (range === "ALL") return view.trend;
    const count = range === "3M" ? 3 : range === "6M" ? 6 : 12;
    return view.trend.slice(-count);
  }, [view.trend, range]);
}

function BalanceChart({ points, money, label }: { points: ProgressView["trend"]; money: Intl.NumberFormat; label: string }) {
  const values = points.flatMap(point => point.savedBalance === null ? [] : [{ ...point, balance: point.savedBalance }]);
  if (!values.length) return <div className={styles.emptyChart} role="status"><strong>No saved balance observations in this range.</strong><span>Save a snapshot or balance check to start a trend.</span></div>;
  const width = 640, height = 260, left = 66, right = 18, top = 18, bottom = 38;
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
  const summary = values.map(point => `${monthText(point.month)} saved balance ${money.format(point.balance)}`).join("; ");
  return <figure className={`progress-snapshot-chart ${styles.chartFigure}`}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}. Recorded saved balance observations: ${summary}. Missing months are left blank.`}>
      {[0, .5, 1].map(fraction => {
        const value = high - fraction * (high - low), yy = y(value);
        return <g key={fraction}><line x1={left} x2={width - right} y1={yy} y2={yy} className={styles.gridLine} /><text x={left - 10} y={yy + 4} textAnchor="end">{money.format(value)}</text></g>;
      })}
      {segments.map((segment, index) => segment.length > 1 && <polyline key={index} points={segment.join(" ")} className={styles.balanceLine} />)}
      {points.map((point, index) => point.savedBalance === null ? null : <circle key={point.month} cx={x(index)} cy={y(point.savedBalance)} r="5" className={styles.balanceDot}><title>{monthText(point.month)} saved balance: {money.format(point.savedBalance)}</title></circle>)}
      {labelIndexes.map(index => <text key={`${points[index]?.month}-${index}`} x={x(index)} y={height - 10} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}>{monthShort(points[index].month)}</text>)}
    </svg>
    <figcaption>Saved observations only · gaps show months without a comparable saved balance.</figcaption>
    <ol className="snapshot-chart-labels">{values.map(point => <li key={point.month}><time dateTime={point.month}>{monthText(point.month)}</time><strong>{money.format(point.balance)}</strong></li>)}</ol>
  </figure>;
}

function ChangeChart({ points, money }: { points: ProgressView["trend"]; money: Intl.NumberFormat }) {
  const values = points.flatMap(point => point.observedNetChange === null ? [] : [{ month: point.month, change: point.observedNetChange }]);
  if (!values.length) return <div className={styles.emptyChart} role="status"><strong>No month-to-month saved observations to compare.</strong><span>Monthly change appears when saved balance observations exist for consecutive months.</span></div>;
  const max = Math.max(1, ...values.map(value => Math.abs(value.change)));
  const width = 640, height = 260, left = 48, right = 14, baseline = 116;
  const step = (width - left - right) / values.length, barWidth = Math.min(34, step * .56);
  const summary = values.map(value => `${monthText(value.month)} ${value.change > 0 ? "increased" : value.change < 0 ? "decreased" : "changed by"} ${money.format(Math.abs(value.change))}`).join("; ");
  return <figure className={styles.chartFigure}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Net change between consecutive saved balance observations. Positive values are debt increases. ${summary}`}>
      <line x1={left} x2={width - right} y1={baseline} y2={baseline} className={styles.axisLine} />
      {values.map((value, index) => {
        const h = Math.max(2, Math.abs(value.change) / max * 76), center = left + step * index + step / 2;
        const increase = value.change > 0;
        return <g key={value.month}><rect x={center - barWidth / 2} y={increase ? baseline : baseline - h} width={barWidth} height={h} rx="5" className={increase ? styles.increaseBar : styles.reductionBar}><title>{monthText(value.month)}: {increase ? "debt increased" : "debt reduced"} by {money.format(Math.abs(value.change))}</title></rect><text x={center} y={height - 10} textAnchor="middle">{monthShort(value.month)}</text><text x={center} y={increase ? baseline + h + 16 : baseline - h - 7} textAnchor="middle">{moneyFormat(value.change, money)}</text></g>;
      })}
    </svg>
    <figcaption>Between consecutive saved observations · positive means balances increased; negative means balances decreased.</figcaption>
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
    <small>Current {money.format(current)}</small>
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

function SavedCheck({ snapshot, onDelete, onUpdateNote, readOnly }: { snapshot: PayoffSnapshot; readOnly: boolean; onDelete: (id: string) => void; onUpdateNote: (id: string, note: string) => void }) {
  const householdCurrency = useHouseholdCurrency();
  const money = createHouseholdMoneyFormatter(householdCurrency, { style: "currency" });
  const [note, setNote] = useState(snapshot.note);
  return <details className={`saved-check ${styles.savedCheck}`}><summary><span>{activityMonthLabel(snapshot.month)} · {money.format(snapshot.totalBalance)}</span><small>Saved {snapshot.capturedAt && !Number.isNaN(Date.parse(snapshot.capturedAt)) ? new Date(snapshot.capturedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "date unavailable"}</small></summary><p>Balance period: {activityMonthLabel(snapshot.month)}</p>{Array.isArray(snapshot.revisions) && snapshot.revisions.length > 0 && <details><summary>Prior saved checks ({snapshot.revisions.length})</summary>{snapshot.revisions.map((version, index) => <p key={index}>{String(version.capturedAt)} · {money.format(Number(version.totalBalance))} · {version.accounts.map((account: { name: string; balance: number }) => `${account.name}: ${money.format(account.balance)}`).join("; ")}</p>)}</details>}<ul>{snapshot.accounts.map(account => <li key={account.accountId}>{account.name}: {money.format(account.balance)}</li>)}</ul><label>Note<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={240} /></label><div className={styles.snapshotActions}><button className="secondary" disabled={readOnly || note === snapshot.note} onClick={() => onUpdateNote(snapshot.id, note)}>Save note</button><button className="secondary" disabled={readOnly} onClick={() => onDelete(snapshot.id)}>Delete balance check</button></div></details>;
}

export default function ActualProgressPage({ groups = [], accounts, transactions, adjustments, snapshots, loans, removedAccounts = [], progressViews, readOnly = false, onLoanSnapshot, onCapture, onDelete, onUpdateNote, onAccounts, onActivity }: {
  groups?: DebtGroup[]; accounts: DebtAccount[]; transactions: LedgerTransaction[]; adjustments: BalanceAdjustment[]; snapshots: PayoffSnapshot[]; loans: LoanTracker[]; removedAccounts?: RemovedProgressAccount[];
  progressViews: Record<ProgressScope, ProgressView>; readOnly?: boolean; onLoanSnapshot?: () => void; onCapture: (note: string) => void; onDelete: (id: string) => void; onUpdateNote: (id: string, note: string) => void; onAccounts: () => void; onActivity?: () => void;
}) {
  const householdCurrency = useHouseholdCurrency();
  const money = createHouseholdMoneyFormatter(householdCurrency, { style: "currency" });
  const [tab, setTab] = useState<ProgressTab>("overview");
  const [scope, setScope] = useState<ProgressView["scope"]>(() => accounts.length || removedAccounts.length ? "accounts" : loans.length ? "loans" : "household");
  const [range, setRange] = useState<Range>("6M");
  const [note, setNote] = useState(() => snapshots.find(snapshot => snapshot.month === householdDate().slice(0, 7))?.note ?? "");
  const scopeOptions: { value: ProgressView["scope"]; label: string }[] = [];
  if (accounts.length || removedAccounts.length) scopeOptions.push({ value: "accounts", label: "Cards & other" });
  if (loans.length) scopeOptions.push({ value: "loans", label: "House & car" });
  if (accounts.length && loans.length) scopeOptions.push({ value: "household", label: "Household" });
  const currentScope = scopeOptions.some(option => option.value === scope) ? scope : scopeOptions[0]?.value ?? "household";
  const view = progressViews[currentScope];
  const trend = useVisibleTrend(view, range);
  const currentMonth = view.live.asOf.slice(0, 7);
  const accountData = view.actual;
  const starting = view.summary.starting;
  const reduction = view.summary.reduction;
  const baselineLabel = view.baselineKind === "original-loan-amounts" ? "Original loan balances" : view.baselineKind === "mixed" ? "Saved account and original loan balances" : "Saved starting balance";
  const projectedDebtFree = view.milestones.find(item => item.id === "debt-free")?.status === "projected" ? view.milestones.find(item => item.id === "debt-free")?.projectedMonth : null;
  const accountGroups = accountData.groups.map(group => {
    const known = group.accounts.every(account => account.baselineBalance !== undefined);
    return { ...group, label: groups.find(item => item.id === group.group)?.name ?? group.group, starting: known ? group.starting : null };
  });
  const savedSnapshots = [...accountData.snapshots].reverse();
  const paidOffAccounts = accountData.groups.flatMap(group => group.accounts).filter(account => !account.removedFromDebts && (account.baselineBalance ?? 0) > 0 && account.balance <= 0).length;
  const activityMonth = accountData.monthEntries.length ? activityMonthLabel(currentMonth) : null;
  const monthlyMovement = accountData.monthEntries.length ? accountData.monthlyChange : null;

  return <div className={`screen snapshots-screen actual-progress-screen ${styles.screen}`}>
    {!accounts.length && !removedAccounts.length && !loans.length ? <section className="large-empty"><h2>Add a debt to start tracking progress</h2><button className="primary" onClick={onAccounts}>Add debt</button></section> : <>
      <div className={styles.scopeBar} role="group" aria-label="Progress scope">{scopeOptions.map(option => <button type="button" key={option.value} aria-pressed={currentScope === option.value} onClick={() => setScope(option.value)}>{option.label}</button>)}</div>
      <nav className={styles.tabs} aria-label="Progress sections">{([['overview', 'Overview'], ['trends', 'Trends'], ['milestones', 'Milestones']] as const).map(([value, label]) => <button key={value} type="button" aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value)}>{label}</button>)}</nav>

      {tab === "overview" && <div className={styles.stack}>
        <section className={`${styles.summary} actual-progress-summary`} aria-label={`${currentScope} debt progress`}>
          <div className={styles.summaryHeading}><div><span>Total progress</span><strong className="progress-percent">{view.summary.comparisonAvailable && view.summary.percent !== null ? `${Math.abs(view.summary.percent).toFixed(1)}%` : "Progress"}</strong><small>{view.summary.comparisonAvailable ? `${reduction !== null && reduction >= 0 ? "reduced" : "increased"} from ${baselineLabel.toLowerCase()}` : "Starting comparison unavailable"}</small></div>
            {projectedDebtFree ? <div className={styles.forecastBadge}><span aria-hidden="true">◷</span><small>Debt-free projected</small><strong>{monthText(projectedDebtFree)}</strong></div> : null}
          </div>
          <div className={styles.summaryTrack} role="progressbar" aria-label="Debt reduction from selected starting balance" aria-valuemin={0} aria-valuemax={100} aria-valuenow={view.summary.percent === null ? 0 : Math.max(0, Math.min(100, view.summary.percent))}><i style={{ width: `${view.summary.percent === null ? 0 : Math.max(0, Math.min(100, view.summary.percent))}%` }} /></div>
          <p className={styles.summaryMovement}>{reduction === null ? "Starting comparison unavailable" : <><strong>{moneyFormat(reduction, money)}</strong> {reduction >= 0 ? "reduced" : "increased"} · {money.format(view.summary.current)} remaining</>}</p>
          <dl className={styles.summaryValues}><div><dt>{baselineLabel}</dt><dd>{starting === null ? "Unavailable" : money.format(starting)}</dd></div><div><dt>Current balance</dt><dd>{money.format(view.summary.current)}</dd></div></dl>
          {accountData.retainedCount > 0 && currentScope !== "loans" && <small className={styles.retained}>Includes last balances for {accountData.retainedCount} removed accounts.</small>}
        </section>

        <section className={styles.card} aria-labelledby="progress-trend-title">
          <header className={styles.cardHeader}><div><h2 id="progress-trend-title">Debt balance trend</h2><p>Saved balance observations</p></div><div className={styles.ranges} role="group" aria-label="Debt trend time range">{ranges.map(value => <button type="button" key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{value}</button>)}</div></header>
          <BalanceChart points={trend} money={money} label="Debt balance trend" />
          <button type="button" className={styles.textLink} onClick={() => setTab("trends")}>View trends</button>
        </section>

        <section className={styles.card} aria-labelledby="progress-milestone-preview-title">
          <header className={styles.cardHeader}><div><h2 id="progress-milestone-preview-title">Milestones</h2><p>Checkpoints supported by recorded evidence</p></div><button type="button" className={styles.textLink} onClick={() => setTab("milestones")}>See all</button></header>
          <ol className={styles.milestoneList}>{view.milestones.slice(0, 4).map(item => <MilestoneItem key={item.id} item={item} />)}</ol>
        </section>

        <section className={styles.card} aria-labelledby="progress-category-title">
          <header className={styles.cardHeader}><div><h2 id="progress-category-title">Progress by category</h2><p>{currentScope === "loans" ? "House & car" : "Cards & other account groups"}</p></div></header>
          <div className={styles.ringGrid}>
            {currentScope !== "loans" && accountGroups.length ? accountGroups.map(group => <ProgressRing key={group.group} label={group.label} starting={group.starting} current={group.current} reduction={group.starting === null ? null : group.reduction} money={money} />)
              : <ProgressRing label={currentScope === "loans" ? "House & car" : "Selected scope"} starting={starting} current={view.summary.current} reduction={reduction} money={money} />}
          </div>
        </section>

        <section className={`${styles.card} snapshot-controls`} aria-label="Snapshots">
          <header className={styles.cardHeader}><div><h2>Saved snapshots ({savedSnapshots.length})</h2><p>Balance checks and their saved history</p></div><InfoTooltip label="Saved snapshots">Saved snapshots preserve balance observations, notes and earlier revisions. A saved balance check is separate from the live balance above.</InfoTooltip></header>
          {savedSnapshots.length ? <div className={styles.snapshotList}>{savedSnapshots.map(snapshot => <SavedCheck key={snapshot.id} snapshot={snapshot} onDelete={onDelete} readOnly={readOnly} onUpdateNote={onUpdateNote} />)}</div> : <p className={styles.snapshotEmpty}>No saved snapshots yet.</p>}
          {(accounts.length > 0 || removedAccounts.length > 0) ? <><details className="snapshot-note"><summary>Add a note · optional</summary><label>Snapshot note<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={240} /></label></details>
            <button className="primary" disabled={readOnly} onClick={() => onCapture(note)}>{snapshots.some(snapshot => snapshot.month === currentMonth) ? "Update this month's snapshot" : "Save snapshot"}</button></>
            : <p className={styles.snapshotEmpty}>Account balance snapshots are available when Cards &amp; other debt is tracked.</p>}
          {loans.length > 0 && <div className={styles.loanHistory}>
            <div className={styles.cardSubhead}><h3>House & car balance history</h3><button type="button" className="secondary" disabled={readOnly} onClick={onLoanSnapshot}>Save loan balance check</button></div>
            {progressViews.loans.loanHistory.map(history => { const loan = loans.find(item => item.id === history.id); return loan ? <details key={history.id}><summary>{loan.name} · {history.history.length} saved records</summary>{history.history.map((entry, index) => <p key={`${entry.date}-${index}`}>Balance date {entry.date} · {money.format(entry.amount)}{entry.payment !== undefined ? <> · Payment {money.format(entry.payment)}</> : null}{entry.principal !== undefined ? <> · Principal {money.format(entry.principal)}</> : null}<br />Saved {entry.recordedAt && !Number.isNaN(Date.parse(entry.recordedAt)) ? new Date(entry.recordedAt).toLocaleString() : "date unavailable"}</p>)}</details> : null; })}
          </div>}
        </section>

        <section className={styles.card} aria-labelledby="progress-overview-detail-title">
          <header className={styles.cardHeader}><div><h2 id="progress-overview-detail-title">This month</h2><p>{activityMonth ?? "No recorded account activity"}</p></div></header>
          <div className="progress-month-highlights">
            {currentScope !== "loans" && <article className="actual-month-card paid-off-card"><h3>Accounts paid off</h3><strong>{paidOffAccounts}</strong></article>}
            {currentScope !== "loans" && <article className="actual-month-card"><h3>Net account change</h3><strong>{monthlyMovement === null ? "—" : moneyFormat(-monthlyMovement, money)}</strong><p>{monthlyMovement === null ? "No recorded change" : `${monthlyMovement <= 0 ? "lower" : "higher"} · ${activityMonth ?? ""}`}</p></article>}
          </div>
          {currentScope !== "loans" && accountData.monthEntries.length > 0 && <details className="progress-month-story progress-month-breakdown"><summary>Activity breakdown · {activityMonth}</summary><p>{accountData.reductionCount} debt reduction{accountData.reductionCount === 1 ? "" : "s"} recorded this month.</p><dl><div><dt>Recorded payments</dt><dd>{money.format(accountData.monthEntries.filter(row => row.kind === "payment").reduce((sum, row) => sum + row.amount, 0))}</dd></div><div><dt>Purchases</dt><dd>{money.format(accountData.monthEntries.filter(row => row.kind === "purchase").reduce((sum, row) => sum + row.amount, 0))}</dd></div><div><dt>Interest &amp; fees</dt><dd>{money.format(accountData.monthEntries.filter(row => row.kind === "interest" || row.kind === "fee").reduce((sum, row) => sum + row.amount, 0))}</dd></div><div><dt>Adjustments</dt><dd>{money.format(accountData.monthEntries.filter(row => row.kind === "adjustment").reduce((sum, row) => sum + row.difference, 0))}</dd></div><div><dt>Debt reductions</dt><dd>−{money.format(accountData.monthlyReductions)}</dd></div><div><dt>Debt increases</dt><dd>+{money.format(accountData.monthlyIncreases)}</dd></div></dl></details>}
        </section>

        {currentScope !== "loans" && <section className={styles.card}>
          <details className="progress-account-details"><summary>Account breakdown</summary><h2 className="progress-section-heading">Which accounts changed?</h2>
            {accountData.groups.filter(group => group.accounts.length).map(group => <section className="actual-progress-group" key={group.group}><header><h2>{groups.find(item => item.id === group.group)?.name ?? group.group}</h2><div><strong>{money.format(group.current)}</strong><small>{group.accounts.every(account => account.baselineBalance !== undefined) ? moneyFormat(group.reduction, money) + " from saved starting balances" : "Starting comparison unavailable"}</small></div></header><div className="actual-account-grid progress-account-list">{group.accounts.map(account => <article key={account.id}><h3>{account.name}</h3>{account.removedFromDebts === true && <small>Removed from Debts · last balance retained</small>}<strong className="progress-account-change">{account.baselineBalance === undefined ? "Starting balance unavailable" : moneyFormat(account.baselineBalance - account.balance, money) + (account.baselineBalance >= account.balance ? " lower" : " higher")}</strong><details className="progress-account-numbers"><summary>Balance details</summary><dl><div><dt>Started at</dt><dd>{account.baselineBalance === undefined ? "Unavailable" : money.format(account.baselineBalance)}</dd></div><div><dt>Now</dt><dd>{money.format(account.balance)}</dd></div><div><dt>Balance change</dt><dd>{account.baselineBalance === undefined ? "Unavailable" : moneyFormat(account.baselineBalance - account.balance, money)}</dd></div></dl></details><ProgressBar name={account.name} starting={account.baselineBalance ?? account.balance} current={account.balance} /><DebtActivityPanel accountId={account.id} name={account.name} transactions={transactions} adjustments={adjustments} /></article>)}</div></section>)}
          </details>{onActivity && <button className="progress-view-activity" type="button" onClick={onActivity}>View activity →</button>}
        </section>}
      </div>}

      {tab === "trends" && <div className={styles.stack}>
        <section className={styles.card}><header className={styles.cardHeader}><div><h2>Debt balance trend</h2><p>Saved balances · missing observations remain gaps</p></div></header><div className={styles.rangeWide} role="group" aria-label="Trend time range">{ranges.map(value => <button type="button" key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{value}</button>)}</div><BalanceChart points={trend} money={money} label="Debt balance trend" />
          <div className={styles.observationList} aria-label="Saved balance observations">{trend.filter(point => point.observation).map(point => <div key={point.month}><time dateTime={point.observation?.observedOn ?? point.month}>{monthText(point.month)}{point.observation?.observedOn ? ` · ${point.observation.observedOn}` : ""}</time><strong>{money.format(point.observation!.balance)}</strong><small>{point.observation?.source === "loan-history" ? "Saved loan balance" : point.observation?.source === "combined" ? "Saved account and loan balances" : "Saved snapshot"}</small></div>)}{!trend.some(point => point.observation) && <p>No saved observations in this range.</p>}</div>
        </section>
        <section className={styles.card}><header className={styles.cardHeader}><div><h2>Monthly change</h2><p>Between consecutive saved balance observations</p></div></header><ChangeChart points={trend} money={money} /></section>
        <section className={styles.card}><header className={styles.cardHeader}><div><h2>Recorded account activity</h2><p>Account ledger changes · not a complete household activity history</p></div></header><div className={styles.activityList}>{trend.filter(point => point.recordedAccountChange !== null).map(point => <div key={point.month}><time dateTime={point.month}>{monthText(point.month)}</time><strong>{moneyFormat(point.recordedAccountChange!, money)}</strong></div>)}{!trend.some(point => point.recordedAccountChange !== null) && <p>No recorded account changes in this range.</p>}</div></section>
        <p className={styles.liveNote}>Live balance {money.format(view.live.balance)} · as of {view.live.asOf}. Live balances are not plotted as saved observations.</p>
      </div>}

      {tab === "milestones" && <div className={styles.stack}>
        <section className={styles.card}><header className={styles.cardHeader}><div><h2>Your milestones</h2><p>Achievements are based on recorded events or balance observations.</p></div></header><ol className={`${styles.milestoneList} ${styles.fullMilestones}`}>{view.milestones.map(item => <MilestoneItem key={item.id} item={item} />)}</ol></section>
        <section className={styles.card} aria-labelledby="milestone-progress-ring-title"><header className={styles.cardHeader}><div><h2 id="milestone-progress-ring-title">Milestone progress</h2><p>{baselineLabel}</p></div></header><div className={styles.ringGrid}>{currentScope !== "loans" && accountGroups.length ? accountGroups.map(group => <ProgressRing key={group.group} label={group.label} starting={group.starting} current={group.current} reduction={group.starting === null ? null : group.reduction} money={money} />) : <ProgressRing label={currentScope === "loans" ? "House & car" : "Selected scope"} starting={starting} current={view.summary.current} reduction={reduction} money={money} />}</div></section>
      </div>}
    </>}
  </div>;
}
