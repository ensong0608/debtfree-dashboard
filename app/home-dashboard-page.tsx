"use client";

import type { DebtAccount, LedgerTransaction, BalanceAdjustment } from "./dashboard-data";
import type { buildActualProgress } from "./debt-activity";
import type { PayoffSchedule as Schedule } from "./payoff-schedule";
import type { LoanTracker } from "./loan-progress";
import { createHouseholdMoneyFormatter } from "./household-currency";
import { useHouseholdCurrency } from "./household-currency-context";
import { paymentActivity } from "./payments";
import OutlineIcon from "./outline-icon";
import styles from "./home-dashboard.module.css";

const monthLabel = (key: string, short = false) => new Date(key + "-01T12:00:00").toLocaleDateString("en-US", { month: short ? "short" : "long", year: "numeric" });

function SnapshotChart({ progress, money, onViewProgress }: { progress: ReturnType<typeof buildActualProgress>; money: Intl.NumberFormat; onViewProgress: () => void }) {
  const points = progress.snapshots.filter(snapshot => Number.isFinite(snapshot.totalBalance)).slice(-6);
  if (!points.length) return <div className={styles.chartEmpty}>Save a Progress snapshot to start a balance trend.</div>;
  const values = points.map(point => point.totalBalance);
  const min = Math.min(...values), max = Math.max(...values), range = Math.max(1, max - min);
  const coords = values.map((value, index) => ({ x: points.length === 1 ? 50 : 8 + index * 84 / (points.length - 1), y: 76 - (value - min) / range * 58 }));
  const segments = coords.flatMap((point, index) => {
    if (!index) return [];
    const previousMonth = new Date(points[index - 1].month + "-01T12:00:00");
    previousMonth.setMonth(previousMonth.getMonth() + 1);
    if (previousMonth.getFullYear() !== Number(points[index].month.slice(0, 4)) || previousMonth.getMonth() + 1 !== Number(points[index].month.slice(5))) return [];
    return [{ previous: coords[index - 1], point }];
  });
  const summary = points.map(point => `${monthLabel(point.month, true)} ${money.format(point.totalBalance)}`).join("; ");
  return <div className={styles.chartWrap}>
    <svg className={styles.chart} viewBox="0 0 100 86" role="img" aria-label={`Saved account balance snapshots: ${summary}`} preserveAspectRatio="none">
      <defs><linearGradient id="home-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--theme-accent)" stopOpacity=".30"/><stop offset="1" stopColor="var(--theme-accent)" stopOpacity=".02"/></linearGradient></defs>
      <line x1="0" y1="82" x2="100" y2="82" stroke="var(--theme-chart-grid)" strokeWidth=".6"/>
      {segments.map(({previous,point},index)=><g key={index}><path d={`M${previous.x},82 ${previous.x},${previous.y} ${point.x},${point.y} ${point.x},82 Z`} fill="url(#home-chart-fill)"/><line x1={previous.x} y1={previous.y} x2={point.x} y2={point.y} stroke="var(--theme-chart-1)" strokeWidth="2.2" vectorEffect="non-scaling-stroke"/></g>)}
      {coords.map((point,index)=><circle key={points[index].id} cx={point.x} cy={point.y} r="1.8" fill="var(--theme-chart-1)" vectorEffect="non-scaling-stroke"/>)}
    </svg>
    <div className={styles.chartLabels}><span>{monthLabel(points[0].month, true)}</span>{points.length > 1 && <span>{monthLabel(points.at(-1)!.month, true)}</span>}</div>
    <button type="button" className={styles.textLink} onClick={onViewProgress}>Account snapshots <OutlineIcon name="chevron"/></button>
  </div>;
}

export default function HomeDashboardPage({ name, accounts, schedule, householdPayment, scopeLabel = "Whole household", loans, progress, transactions, adjustments, onSchedule, onAccount, onViewDebts, onViewProgress }: {
  name: string; accounts: DebtAccount[]; schedule: Schedule; scopeLabel?: string; loans: LoanTracker[];
  householdPayment?: number;
  progress: ReturnType<typeof buildActualProgress>; transactions: LedgerTransaction[]; adjustments: BalanceAdjustment[];
  onSchedule: () => void; onAccount: () => void; onViewDebts: () => void; onViewProgress: () => void;
}) {
  const currency = useHouseholdCurrency();
  const money = createHouseholdMoneyFormatter(currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const loansCurrent = loans.reduce((sum, loan) => sum + loan.remainingAmount, 0);
  const loansStarting = loans.reduce((sum, loan) => sum + loan.originalAmount, 0);
  const current = progress.current + loansCurrent;
  const starting = progress.starting + loansStarting;
  const reduction = starting - current;
  const progressPercent = progress.comparisonAvailable && starting > 0 ? reduction / starting * 100 : null;
  const firstForecast = schedule.rows[0];
  const recent = paymentActivity(transactions, adjustments).slice(0, 4);
  const accountNames = new Map(accounts.map(account => [account.id, account.name]));
  const firstName = name.trim().split(/\s+/)[0] || "there";
  const hasForecast = schedule.debtFreeMonth !== null;
  const forecastNeedsReview = !hasForecast && (schedule.issues.length > 0 || schedule.rows.length > 0);
  const forecastState = forecastNeedsReview ? "Forecast needs review" : hasForecast ? "Projected payoff" : "No payoff projection yet";

  return <div className={styles.home}>
    <header className={styles.topbar}>
      <div className={styles.wordmark} aria-label="DebtFree"><span>Debt</span><b>Free</b></div>
      <button className={styles.accountButton} type="button" onClick={onAccount} aria-label="Open Account"><OutlineIcon name="account"/></button>
    </header>
    <section className={styles.greeting} aria-label="Welcome"><h1>Welcome, {firstName}</h1><p>Your household debt overview</p></section>

    <section className={styles.debtSummary} aria-label="Total household debt">
      <div className={styles.summaryHead}><span>Total household debt</span><button type="button" onClick={onViewDebts}>View debts <OutlineIcon name="chevron"/></button></div>
      <strong className={styles.total}>{money.format(current)}</strong>
      {progressPercent !== null && <p className={styles.balanceChange}>{money.format(Math.abs(reduction))} {reduction >= 0 ? "below" : "above"} recorded starting balances · {Math.abs(progressPercent).toFixed(1)}%</p>}
      <SnapshotChart progress={progress} money={money} onViewProgress={onViewProgress}/>
    </section>

    <section className={styles.payoffCard} aria-label="Payoff summary">
      <div className={styles.cardIcon}><OutlineIcon name="calendar"/></div>
      <div className={styles.payoffCopy}><span>{forecastState} · {scopeLabel}</span>
        <strong>{hasForecast ? monthLabel(schedule.debtFreeMonth!) : forecastNeedsReview ? "Review payment terms" : "Add debt or set a schedule"}</strong>
        {hasForecast && <small>{money.format(schedule.monthly)} monthly forecast payment · {schedule.rows.length} projected months</small>}
        {forecastNeedsReview && <small>{schedule.issues[0] || "The current payment assumptions do not complete the forecast."}</small>}
      </div>
      <button type="button" className={styles.iconLink} onClick={onSchedule} aria-label="Open full schedule"><OutlineIcon name="chevron"/></button>
    </section>

    <section className={styles.nextPayment} aria-label="Next projected payment">
      <div className={styles.paymentIcon}><OutlineIcon name="money"/></div>
      <div><span>{firstForecast ? `Next projected payment · ${monthLabel(firstForecast.month, true)}` : householdPayment ? "Household monthly commitment" : "No upcoming payment"}</span><small>{scopeLabel} · forecast</small></div>
      <strong>{firstForecast ? money.format(firstForecast.paid) : householdPayment ? money.format(householdPayment) : "—"}</strong>
    </section>

    <section className={styles.scheduleCard} aria-label="Payoff Schedule preview">
      <header className={styles.sectionHeader}><div><h2>Payoff Schedule</h2><p>{scopeLabel} · projected payments</p></div><button type="button" className={styles.textLink} onClick={onSchedule}>See all <OutlineIcon name="chevron"/></button></header>
      {schedule.rows.length ? <div className={styles.scheduleRows}>{schedule.rows.slice(0, 3).map((row,index)=><button type="button" key={row.month} onClick={onSchedule}>
        <time dateTime={`${row.month}-01`}>{monthLabel(row.month, true)}</time><i className={index % 2 ? styles.blueIcon : styles.purpleIcon}><OutlineIcon name="calendar"/></i>
        <span><b>{row.paidOff.length ? row.paidOff.join(", ") : "Scheduled debt payment"}</b><small>{row.paidOff.length ? "Projected payoff" : `Projected balance ${money.format(row.remaining)}`}</small></span><strong>{money.format(row.paid)}</strong><OutlineIcon name="chevron"/>
      </button>)}</div> : <button type="button" className={styles.scheduleEmpty} onClick={onSchedule}>{schedule.issues[0] || "Open the Payoff Schedule to review your forecast."}<OutlineIcon name="chevron"/></button>}
    </section>

    <section className={styles.updatesCard} aria-label="Recent financial updates">
      <header className={styles.sectionHeader}><div><h2>Recent updates</h2><p>Recorded financial activity</p></div></header>
      {recent.length ? <div className={styles.updateRows}>{recent.slice(0, 3).map(item=>{
        const impact = item.difference < 0 ? "Balance decrease" : item.difference > 0 ? "Balance increase" : item.kind === "payment" ? "Payment recorded" : "Financial record";
        return <article key={item.id}>
          <i className={item.difference < 0 ? styles.blueIcon : styles.neutralIcon}><OutlineIcon name={item.kind === "payment" ? "money" : "receipt"}/></i>
          <span><b>{item.title}</b><small>{accountNames.get(item.accountId) || "Debt account"} · {impact}</small></span>
          <div className={styles.updateMeta}><b className={item.difference < 0 ? styles.decrease : item.difference > 0 ? styles.increase : ""}>{item.difference < 0 ? "−" : item.difference > 0 ? "+" : ""}{money.format(item.amount)}</b><time dateTime={item.date}>{new Date(`${item.date}T12:00:00`).toLocaleDateString("en-US", {month:"short",day:"numeric"})}</time></div>
        </article>;
      })}</div> : <p className={styles.noUpdates}>Recorded payments and balance changes will appear here.</p>}
    </section>
  </div>;
}
