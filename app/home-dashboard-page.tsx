"use client";

import DebtFreeCountdown from "./debt-free-countdown";
import PayoffStrategyList from "./payoff-strategy-list";
import type { PayoffStrategyRow } from "./payoff-strategy";
import { useState } from "react";
import type { DebtAccount, LedgerTransaction, BalanceAdjustment, CashflowItem } from "./dashboard-data";
import type { buildActualProgress } from "./debt-activity";
import type { PayoffSchedule as Schedule } from "./payoff-schedule";
import type { LoanTracker } from "./loan-progress";
import type { ProgressCarouselScope, ProgressViews } from "./progress-view";
import { createHouseholdMoneyFormatter } from "./household-currency";
import { useHouseholdCurrency } from "./household-currency-context";
import { paymentActivity } from "./payments";
import OutlineIcon from "./outline-icon";
import DebtScopeCarousel from "./debt-scope-carousel";
import type { CSSProperties } from "react";
import styles from "./home-dashboard.module.css";
import HomeDueReminders, { type ReminderPaymentActions } from './home-due-reminders';
import type { DueReminder } from './due-reminders';


export default function HomeDashboardPage({ accounts, loans, items, schedule, progress, progressViews, transactions, adjustments, onSchedule, onViewProgress, onViewTransactions, onViewDue, strategyRows, strategy, dueReminders, onOpenReminder, reminderPaymentActions }: {
  reminderPaymentActions: Omit<ReminderPaymentActions, 'transactions' | 'adjustments' | 'loans' | 'items' | 'onOpen'>;
  dueReminders: DueReminder[]; onOpenReminder: (reminder: DueReminder) => void;
  strategyRows: PayoffStrategyRow[]; strategy: "avalanche" | "snowball";
  name: string; accounts: DebtAccount[]; schedule: Schedule; scopeLabel?: string; loans: LoanTracker[]; items: CashflowItem[];
  householdPayment?: number;
  progressViews?: ProgressViews;
  progress: ReturnType<typeof buildActualProgress>; transactions: LedgerTransaction[]; adjustments: BalanceAdjustment[];
  onViewTransactions: () => void;
  onViewDue: () => void;
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
  const recent = paymentActivity(transactions, adjustments).slice(0, 4);
  const accountNames = new Map(accounts.map(account => [account.id, account.name]));
  const [scope, setScope] = useState<ProgressCarouselScope>("accounts");
  const progressSlides = progressViews ? ([
    { scope: "accounts" as const, label: "Cards & Loans" },
    { scope: "home" as const, label: "Home" },
    { scope: "auto" as const, label: "Auto" },
  ].map(slide => {
    const view = progressViews[slide.scope];
    const percent = view.summary.percent;
    const arc = percent === null ? 0 : Math.max(0, Math.min(100, Math.abs(percent)));
    const ringStyle = { "--home-ring": `${arc * 3.6}deg` } as CSSProperties;
    return { ...slide, content: <div className={styles.progressCompact} data-negative={percent !== null && percent < 0}>
      <div className={styles.compactRing} style={ringStyle} role="img" aria-label={`${slide.label}: ${percent === null ? "starting comparison unavailable" : `${Math.abs(percent).toFixed(1)} percent ${percent >= 0 ? "reduced" : "increased"}`}`}><span>{percent === null ? "—" : `${Math.abs(percent).toFixed(1)}%`}</span></div>
      <div className={styles.compactCopy}>
        <small className={styles.paidLabel}>Paid:</small><b className={styles.progressValue}><span className="money-value">{view.summary.reduction === null ? '—' : money.format(view.summary.reduction)}</span></b>
        <small>Balance:</small><strong data-large-value={Math.abs(view.summary.current) >= 1000000}><span className="money-value">{money.format(view.summary.current)}</span></strong>
        <button type="button" className={styles.textLink} onClick={onViewProgress} aria-label="View detailed progress">View progress <OutlineIcon name="chevron"/></button>
      </div>
    </div> };
  })) : null;
  const activeScope = progressSlides?.some(slide => slide.scope === scope) ? scope : progressSlides?.[0]?.scope ?? "accounts";

  const forecastBalance = strategyRows.reduce((sum, row) => sum + row.balance, 0);
  const forecastScopes = progressViews ? [progressViews.accounts.summary, progressViews.auto.summary] : [];
  const comparable = forecastScopes.length > 0 && forecastScopes.every(view => view.starting !== null || view.current === 0);
  const forecastStarting = forecastScopes.reduce((sum, view) => sum + (view.starting ?? 0), 0);
  const countdownPercent = comparable && forecastStarting > 0 ? (forecastStarting - forecastBalance) / forecastStarting * 100 : null;

  return <div className={styles.home}>
    <section className={styles.debtSummary} aria-label="Debt summary">

      {progressViews && progressSlides?.length ? <DebtScopeCarousel slides={progressSlides} value={activeScope} onChange={setScope} label="Debt progress scope" /> : <div className={styles.progressCompact}>
        <div className={styles.compactRing} role="img" aria-label={progressPercent === null ? "Starting comparison unavailable" : `${Math.abs(progressPercent).toFixed(1)} percent ${progressPercent >= 0 ? "reduced" : "increased"}`}><span>{progressPercent === null ? "—" : `${Math.abs(progressPercent).toFixed(1)}%`}</span></div>
        <div className={styles.compactCopy}><strong><span className="money-value">{money.format(current)}</span> <small>left</small></strong><span>{progressPercent === null ? "Starting comparison unavailable" : `${money.format(Math.abs(reduction))} ${reduction >= 0 ? "reduced" : "increased"}`}</span><button type="button" className={styles.textLink} onClick={onViewProgress} aria-label="View detailed progress">View progress <OutlineIcon name="chevron"/></button></div>
      </div>}
    </section>

    <DebtFreeCountdown schedule={schedule} balance={forecastBalance} percent={countdownPercent} onOpen={onSchedule}/>

    <HomeDueReminders onSeeAll={onViewDue} reminders={dueReminders} transactions={transactions} adjustments={adjustments} loans={loans} items={items} onOpen={onOpenReminder} {...reminderPaymentActions}/>

    <section className={styles.scheduleCard} aria-label="Payoff Strategy preview">
      <header className={styles.sectionHeader}><div><h2>Payoff strategy</h2><p>{strategy === "snowball" ? "Snowball" : "Avalanche"} · Cards &amp; Loans</p></div><button type="button" className={styles.textLink} onClick={onSchedule}>See all <OutlineIcon name="chevron"/></button></header>
      <PayoffStrategyList rows={strategyRows} limit={2}/>
    </section>

    <section className={styles.updatesCard} aria-label="Recent financial updates">
      <header className={styles.sectionHeader}><div><h2>Recent activity</h2></div><button type="button" className={styles.textLink} onClick={onViewTransactions}>See all <OutlineIcon name="chevron"/></button></header>
      {recent.length ? <div className={styles.updateRows}>{recent.slice(0, 3).map(item=>{
        return <article key={item.id}>
          <i className={item.difference < 0 ? styles.blueIcon : styles.neutralIcon}><OutlineIcon name={item.difference < 0 ? "arrow-down" : "arrow-up"}/></i>
          <span><b>{item.kind==="payment" ? "Payment recorded" : item.difference>0 ? "Balance increased" : item.title}</b><small>{accountNames.get(item.accountId) || "Debt account"}</small></span>
          <div className={styles.updateMeta}><b className={item.difference < 0 ? styles.decrease : item.difference > 0 ? styles.increase : ""}>{item.difference < 0 ? "−" : item.difference > 0 ? "+" : ""}<span className="money-value">{money.format(item.amount)}</span></b><time dateTime={item.date}>{new Date(`${item.date}T12:00:00`).toLocaleDateString("en-US", {month:"short",day:"numeric"})}</time></div>
        </article>;
      })}</div> : <p className={styles.noUpdates}>Recorded payments and balance changes will appear here.</p>}
    </section>
  </div>;
}
