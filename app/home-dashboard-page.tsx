"use client";

import { useState } from "react";
import type { DebtAccount, LedgerTransaction, BalanceAdjustment } from "./dashboard-data";
import type { buildActualProgress } from "./debt-activity";
import type { PayoffSchedule as Schedule } from "./payoff-schedule";
import type { LoanTracker } from "./loan-progress";
import type { ProgressScope, buildProgressView } from "./progress-view";
import { createHouseholdMoneyFormatter } from "./household-currency";
import { useHouseholdCurrency } from "./household-currency-context";
import { paymentActivity } from "./payments";
import OutlineIcon from "./outline-icon";
import DebtScopeCarousel from "./debt-scope-carousel";
import type { CSSProperties } from "react";
import styles from "./home-dashboard.module.css";

const monthLabel = (key: string, short = false) => new Date(key + "-01T12:00:00").toLocaleDateString("en-US", { month: short ? "short" : "long", year: "numeric" });

export default function HomeDashboardPage({ name, accounts, schedule, householdPayment, scopeLabel = "Whole household", loans, progress, progressViews, transactions, adjustments, onSchedule, onAccount, onViewDebts, onViewProgress }: {
  name: string; accounts: DebtAccount[]; schedule: Schedule; scopeLabel?: string; loans: LoanTracker[];
  householdPayment?: number;
  progressViews?: Record<ProgressScope, ReturnType<typeof buildProgressView>>;
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
  const [scope, setScope] = useState<ProgressScope>(accounts.length ? "accounts" : loans.length ? "loans" : "household");
  const progressSlides = progressViews ? ([
    { scope: "accounts" as const, label: "Cards & Loans" },
    { scope: "loans" as const, label: "House & Auto" },
    { scope: "household" as const, label: "All" },
  ].filter(slide => slide.scope === "accounts" ? accounts.length > 0 : slide.scope === "loans" ? loans.length > 0 : accounts.length > 0 && loans.length > 0).map(slide => {
    const view = progressViews[slide.scope];
    const percent = view.summary.percent;
    const arc = percent === null ? 0 : Math.max(0, Math.min(100, Math.abs(percent)));
    const ringStyle = { "--home-ring": `${arc * 3.6}deg` } as CSSProperties;
    return { ...slide, content: <div className={styles.progressCompact}>
      <div className={styles.compactRing} style={ringStyle} role="img" aria-label={`${slide.label}: ${percent === null ? "starting comparison unavailable" : `${Math.abs(percent).toFixed(1)} percent ${percent >= 0 ? "reduced" : "increased"}`}`}><span>{percent === null ? "—" : `${Math.abs(percent).toFixed(0)}%`}</span></div>
      <div className={styles.compactCopy}>
        <strong>{money.format(view.summary.current)} <small>left</small></strong>
        <span>{slide.label} · {view.summary.reduction === null ? "Starting comparison unavailable" : `${money.format(Math.abs(view.summary.reduction))} ${view.summary.reduction >= 0 ? "reduced" : "increased"}`}</span>
        <button type="button" className={styles.textLink} onClick={onViewProgress}>View progress <OutlineIcon name="chevron"/></button>
      </div>
    </div> };
  })) : null;
  const activeScope = progressSlides?.some(slide => slide.scope === scope) ? scope : progressSlides?.[0]?.scope ?? "household";

  return <div className={styles.home}>
    <header className={styles.topbar}>
      <div className={styles.wordmark} aria-label="DebtFree"><span>Debt</span><b>Free</b></div>
      <button className={styles.accountButton} type="button" onClick={onAccount} aria-label="Open Account"><OutlineIcon name="account"/></button>
    </header>
    <section className={styles.greeting} aria-label="Welcome"><h1>Welcome, {firstName}</h1><p>Your household debt overview</p></section>

    <section className={styles.debtSummary} aria-label="Debt summary">
      <div className={styles.summaryHead}><span>Total debt</span><button type="button" onClick={onViewDebts}>View debts <OutlineIcon name="chevron"/></button></div>
      {progressViews && progressSlides?.length ? <DebtScopeCarousel slides={progressSlides} value={activeScope} onChange={setScope} label="Debt progress scope" /> : <div className={styles.progressCompact}>
        <div className={styles.compactRing} role="img" aria-label={progressPercent === null ? "Starting comparison unavailable" : `${Math.abs(progressPercent).toFixed(1)} percent ${progressPercent >= 0 ? "reduced" : "increased"}`}><span>{progressPercent === null ? "—" : `${Math.abs(progressPercent).toFixed(0)}%`}</span></div>
        <div className={styles.compactCopy}><strong>{money.format(current)} <small>left</small></strong><span>{progressPercent === null ? "Starting comparison unavailable" : `${money.format(Math.abs(reduction))} ${reduction >= 0 ? "reduced" : "increased"}`}</span><button type="button" className={styles.textLink} onClick={onViewProgress}>View progress <OutlineIcon name="chevron"/></button></div>
      </div>}
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
