"use client";
import segmentedStyles from "./segmented-control.module.css";
import Milestones from "./milestones";
import TitleSelect from "./title-select";
import PaidStatus from './paid-status';
import OutlineIcon from './outline-icon';
import { useState, type CSSProperties, type ReactNode } from "react";
import { createHouseholdMoneyFormatter } from "./household-currency";
import { useHouseholdCurrency } from "./household-currency-context";
import type { DebtGroup } from "./debt-groups";
import type { BalanceAdjustment, DebtAccount, DuePaymentAssociation, LedgerTransaction, PayoffSnapshot, RemovedProgressAccount } from "./dashboard-data";
import type { LoanTracker } from "./loan-progress";
import { monthlyProgressReport } from "./monthly-progress-report";
import { monthlyProgressStatus } from "./monthly-progress-status";
import { householdDate } from "./household-date";
import type { ProgressCarouselScope, ProgressViews, buildProgressView } from "./progress-view";
import type { NextPayoffViews } from './next-payoff';
import DebtScopeCarousel from "./debt-scope-carousel";
import styles from "./actual-progress-page.module.css";

type ProgressView = ReturnType<typeof buildProgressView>;
export type ProgressTab = "overview" | "utilization" | "milestones";
const monthText = (month: string) => new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", {month:"short",year:"numeric",timeZone:"UTC"});
const moneyFormat = (value: number, formatter: Intl.NumberFormat) => `${value < 0 ? "−" : ""}${formatter.format(Math.abs(value))}`;

function ProgressRing({ label, starting, current, reduction, money }: { label: string; starting: number | null; current: number; reduction: number | null; money: Intl.NumberFormat }) {
  const percent = starting !== null && starting > 0 && reduction !== null ? reduction / starting * 100 : null;
  const arc = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const ringStyle = { "--progress-ring": `${arc * 3.6}deg` } as CSSProperties;
  return <article className={styles.ringCard}>
    <div className={styles.ring} style={ringStyle} role="img" aria-label={`${label}: ${percent === null ? "starting comparison unavailable" : `${Math.abs(percent).toFixed(0)} percent ${percent >= 0 ? "reduced" : "increased"}`}`}><span>{percent === null ? "—" : `${Math.abs(percent).toFixed(0)}%`}</span></div>
    <strong>{label}</strong>
    <span>{reduction === null ? "Starting comparison unavailable" : <>Paid: <b className={styles.ringAmount}><span className="money-value">{moneyFormat(reduction, money)}</span></b></>}</span>
    <small>Balance: <span className={styles.ringAmount}><span className="money-value">{money.format(current)}</span></span></small>
  </article>;
}


export default function ActualProgressPage({ accounts, loans, transactions, adjustments, items, plannedAccountAmount, duePaymentAssociations, removedAccounts = [], progressViews, nextPayoffs, onAccounts, utilization, tab: controlledTab, onTab }: {
  tab?: ProgressTab; onTab?: (tab: ProgressTab) => void; groups?: DebtGroup[]; accounts: DebtAccount[]; transactions: LedgerTransaction[]; adjustments: BalanceAdjustment[]; snapshots?: PayoffSnapshot[]; loans: LoanTracker[]; removedAccounts?: RemovedProgressAccount[];
  items: import("./dashboard-data").CashflowItem[]; plannedAccountAmount: number; duePaymentAssociations?: DuePaymentAssociation[]; progressViews: ProgressViews; nextPayoffs: NextPayoffViews; readOnly?: boolean; onLoanSnapshot?: () => void; onCapture?: (note: string) => void; onDelete?: (id: string) => void; onUpdateNote?: (id: string, note: string) => void; onAccounts: () => void; onActivity?: () => void; utilization?: ReactNode;
}) {
  const householdCurrency = useHouseholdCurrency();
  const money = createHouseholdMoneyFormatter(householdCurrency, { style: "currency" });
  const [localTab, setLocalTab] = useState<ProgressTab>("overview");
  const tab = controlledTab ?? localTab, setTab = onTab ?? setLocalTab;
  const [scope, setScope] = useState<ProgressCarouselScope>("accounts");
  const scopeOptions: { value: ProgressCarouselScope; label: string }[] = [
    {value:"accounts", label:"Cards & Loans"}, {value:"home", label:"Home"}, {value:"auto", label:"Auto"}
  ];
  const currentScope = scopeOptions.some(option => option.value === scope) ? scope : scopeOptions[0]?.value ?? "accounts";
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
          <div className={styles.compactProgressCopy}><small>Paid:</small><p><b className={styles.paidValue}>{scopedReduction === null ? '—' : moneyFormat(scopedReduction, money)}</b></p><small>Balance:</small><strong data-large-value={Math.abs(scopedView.summary.current) >= 1000000}><span className="money-value">{money.format(scopedView.summary.current)}</span></strong></div>
        </div>

        {scopedView.actual.retainedCount > 0 && option.value === "accounts" && <small className={styles.retained}>Includes last balances for {scopedView.actual.retainedCount} removed accounts.</small>}
      </section>;
    })(),
  }));
  const accountData = view.actual;

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
    if (houses.length) categories.push(loanCategory("Home", houses));
    if (autos.length) categories.push(loanCategory("Auto", autos));
    return categories;
  })();
  const paidOffDebts = [
    ...accountData.groups.flatMap(group => group.accounts).filter(account => !account.removedFromDebts && (account.baselineBalance ?? 0) > 0 && account.balance <= .005).map(account=>({id:account.id,name:account.name})),
    ...loans.filter(loan=>view.loanIds.includes(loan.id)&&loan.originalAmount>0&&loan.remainingAmount<=.005).map(loan=>({id:loan.id,name:loan.name})),
  ];
  const report=monthlyProgressReport({scope:currentScope,today:householdDate(),accounts,loans,transactions,adjustments,items,plannedAccountAmount,duePaymentAssociations});
  const monthLabel=new Date(`${report.month}-01T12:00:00Z`).toLocaleDateString('en-US',{month:'long',timeZone:'UTC'});
  const status=monthlyProgressStatus(report.percentage);
  const gauge=Math.min(200,Math.max(0,report.percentage??0));

  return <div className={`screen snapshots-screen actual-progress-screen ${styles.screen}`}>
    {!accounts.length && !removedAccounts.length && !loans.length ? <section className="large-empty"><h2>Add a debt to start tracking progress</h2><button className="primary" onClick={onAccounts}>Add debt</button></section> : <>
      {!onTab && <nav className={segmentedStyles.root} aria-label="Progress sections">{([['overview', 'Overview'], ['utilization', 'Utilization'], ['milestones', 'Milestones']] as const).map(([value, label]) => <button key={value} type="button" aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value)}>{label}</button>)}</nav>}

      {tab === "overview" && <div className={styles.stack}>
        <div className={styles.integratedSummary}><DebtScopeCarousel slides={scopeSlides} value={currentScope} onChange={setScope} label="Progress scope" /></div>

        <section className={`${styles.card} ${styles.monthlyReport}`} aria-labelledby="monthly-report-title">
          <header className={styles.monthlyReportHeader}><div><h2 id="monthly-report-title">{monthLabel} progress</h2><p>Payments toward your plan</p></div></header>
          <div className={styles.monthlyHero}><div className={styles.monthlyMessage}><strong>{status.label}</strong><span>{report.remaining===null?'No planned amount':report.remaining>0?`${money.format(report.remaining)} remaining`:report.recorded>report.planned!?`${money.format(report.recorded-report.planned!)} above your plan`:'Your plan is complete'}</span>{report.percentage!==null&&<small className={styles.monthlyComparison} data-positive={report.percentage>=100}><OutlineIcon name="trend"/>{report.percentage===100?'On target':`${Math.abs(Math.floor(report.percentage)-100)}% ${report.percentage>=100?'above':'below'} target`}</small>}</div>
            <div className={styles.monthlyGauge} role="img" aria-label={report.percentage===null?'No planned amount':`${status.display} of plan, ${status.label}`}>
              <svg viewBox="0 0 240 130" aria-hidden="true"><path d="M 20 120 A 100 100 0 0 1 220 120" pathLength="200" className={styles.gaugeTrack}/>{Array.from({length:7},(_,index)=><path key={index} d="M 20 120 A 100 100 0 0 1 220 120" pathLength="200" className={styles.gaugeSegment} data-tone={index} strokeDasharray={`${200/7-((index===0||index===6) ? .6 : 1.2)} 200`} strokeDashoffset={-(index*200/7+(index===0?0:.6))}/>)}{report.percentage!==null&&<line x1="120" y1="120" x2="35" y2="120" transform={`rotate(${gauge/200*180} 120 120)`} className={styles.gaugeNeedle}/>}<circle cx="120" cy="120" r="6" className={styles.gaugeHub}/></svg><div className={styles.gaugeLabels} aria-hidden="true"><span>0%</span><span>200%+</span></div><b>{status.display}</b>
            </div></div>
          <div className={styles.monthlyOverview}><div className={styles.monthlyAmounts}><span>Recorded payments</span><strong className={styles.monthlyPaid}>{money.format(report.recorded)}</strong><span>{report.planned===null?'No planned amount':`${money.format(report.planned)} planned`}</span></div></div>
          <div className={styles.monthlyMetrics}><div><i className={styles.monthlyMetricIcon} aria-hidden="true"><OutlineIcon name="money"/></i><span>Interest &amp; fees recorded</span><strong>{report.interest===null?'—':money.format(report.interest)}</strong>{report.hasEstimate&&<small>Includes estimates</small>}</div><div><i className={styles.monthlyMetricIcon} aria-hidden="true"><OutlineIcon name="trend"/></i><span>Recorded balance change</span><strong>{report.netChange===null?'—':moneyFormat(report.netChange,money)}</strong></div></div>
          <div className={styles.monthlyAccounts}><header><h3>Payments by account</h3><span>{report.accountPayments.length} {report.accountPayments.length===1?'account':'accounts'}</span></header>{report.accountPayments.length?<ul>{report.accountPayments.map((account,index)=><li key={account.id}><i className={styles.monthlyAccountInitials} data-tone={index%7} aria-hidden="true">{account.name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase()}</i><strong>{account.name}</strong><span className={styles.monthlyAccountAmount} data-empty={account.paid<=0}>{account.paid>0?money.format(account.paid):'No payment recorded'}</span></li>)}</ul>:<p>No accounts in this category.</p>}</div>
        </section>

        <section className={`${styles.card} ${styles.nextPayoff}`} aria-labelledby="next-payoff-title">
          <header className={styles.cardHeader}><h2 id="next-payoff-title">Next payoff</h2></header>
          {nextPayoffs[currentScope].length ? <ol>{nextPayoffs[currentScope].slice(0,2).map((debt,index)=><li key={debt.id}><div><small>{index===0?'Up next':'Then'}</small><strong>{debt.name}</strong>{debt.payoffMonth&&<small>Estimated payoff <time dateTime={debt.payoffMonth}>{monthText(debt.payoffMonth)}</time></small>}</div><b><span className="money-value">{money.format(debt.balance)}</span></b></li>)}</ol> : <p>No remaining debts in this category.</p>}
        </section>

        <section className={styles.card} aria-labelledby="progress-category-title">
          <header className={styles.cardHeader}><div><h2 id="progress-category-title">All-category comparison</h2><p>Cards &amp; Loans · Home · Auto</p></div></header>
          <div className={styles.ringGrid}>
            {categoryData.map(category => <ProgressRing key={category.label} label={category.label} starting={category.starting} current={category.current} reduction={category.reduction} money={money} />)}
          </div>
        </section>

        {paidOffDebts.length>0 && <section className={`${styles.card} ${styles.victories}`} aria-labelledby="paid-off-debts-title">
          <header className={styles.victoryHeader}><div><h2 id="paid-off-debts-title">Look how far you’ve come</h2><p>{paidOffDebts.length} {paidOffDebts.length===1?'account':'accounts'} paid off</p></div></header>
          <div className={styles.victoryTrail} aria-hidden="true">{paidOffDebts.slice(0,4).map(account=><span key={account.id}><OutlineIcon name="check"/></span>)}</div>
          <ul className={styles.victoryList}>{paidOffDebts.map(account=><li key={account.id}><strong>{account.name}</strong><PaidStatus label="Paid off"/></li>)}</ul>
        </section>}


      </div>}

      {tab === "utilization" && <div className={styles.stack}>{utilization ?? <section className={styles.card}><p className={styles.emptyChart}>Utilization data is unavailable.</p></section>}</div>}

      {tab === "milestones" && <Milestones view={view} money={money} scopeControl={<label className={styles.milestoneScope}>Debt category<TitleSelect aria-label="Milestone category" value={currentScope} onChange={event=>setScope(event.target.value as ProgressCarouselScope)}>{scopeOptions.map(option=><option value={option.value} key={option.value}>{option.label}</option>)}</TitleSelect></label>}/>}
    </>}
  </div>;
}
