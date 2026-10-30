"use client";
import segmentedStyles from "./segmented-control.module.css";
import PaidStatus from './paid-status';
import OutlineIcon from './outline-icon';
import { useState, type CSSProperties, type ReactNode } from "react";
import { createHouseholdMoneyFormatter } from "./household-currency";
import { useHouseholdCurrency } from "./household-currency-context";
import type { DebtGroup } from "./debt-groups";
import type { BalanceAdjustment, DebtAccount, LedgerTransaction, PayoffSnapshot, RemovedProgressAccount } from "./dashboard-data";
import type { LoanTracker } from "./loan-progress";
import { monthlyProgressReport } from "./monthly-progress-report";
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

export default function ActualProgressPage({ accounts, loans, transactions, adjustments, items, plannedAccountAmount, removedAccounts = [], progressViews, nextPayoffs, onAccounts, utilization, tab: controlledTab, onTab }: {
  tab?: ProgressTab; onTab?: (tab: ProgressTab) => void; groups?: DebtGroup[]; accounts: DebtAccount[]; transactions: LedgerTransaction[]; adjustments: BalanceAdjustment[]; snapshots?: PayoffSnapshot[]; loans: LoanTracker[]; removedAccounts?: RemovedProgressAccount[];
  items: import("./dashboard-data").CashflowItem[]; plannedAccountAmount: number; progressViews: ProgressViews; nextPayoffs: NextPayoffViews; readOnly?: boolean; onLoanSnapshot?: () => void; onCapture?: (note: string) => void; onDelete?: (id: string) => void; onUpdateNote?: (id: string, note: string) => void; onAccounts: () => void; onActivity?: () => void; utilization?: ReactNode;
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
  const achievedMilestones=view.milestones.filter(item=>item.status==='achieved');
  const report=monthlyProgressReport({scope:currentScope,today:householdDate(),accounts,loans,transactions,adjustments,items,plannedAccountAmount});
  const monthLabel=new Date(`${report.month}-01T12:00:00Z`).toLocaleDateString('en-US',{month:'long',timeZone:'UTC'});
  const fill=report.percentage===null?0:Math.min(100,Math.max(0,report.percentage));

  return <div className={`screen snapshots-screen actual-progress-screen ${styles.screen}`}>
    {!accounts.length && !removedAccounts.length && !loans.length ? <section className="large-empty"><h2>Add a debt to start tracking progress</h2><button className="primary" onClick={onAccounts}>Add debt</button></section> : <>
      {!onTab && <nav className={segmentedStyles.root} aria-label="Progress sections">{([['overview', 'Overview'], ['utilization', 'Utilization'], ['milestones', 'Milestones']] as const).map(([value, label]) => <button key={value} type="button" aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value)}>{label}</button>)}</nav>}

      {tab === "overview" && <div className={styles.stack}>
        <div className={styles.integratedSummary}><DebtScopeCarousel slides={scopeSlides} value={currentScope} onChange={setScope} label="Progress scope" /></div>

        <section className={`${styles.card} ${styles.monthlyReport}`} aria-labelledby="monthly-report-title">
          <header className={styles.monthlyReportHeader}><div><h2 id="monthly-report-title">{monthLabel} progress</h2><p>Payments toward your plan</p></div></header>
          <div className={styles.monthlyOverview}><div className={styles.monthlyAmounts}><span>Recorded payments</span><strong className={styles.monthlyPaid}>{money.format(report.recorded)}</strong><span>{report.planned===null?'No planned amount':`${money.format(report.planned)} planned`}</span></div>
          <div className={styles.monthlyRing} role="progressbar" aria-label="Recorded payments toward plan" aria-valuemin={0} aria-valuemax={100} aria-valuenow={report.percentage===null?undefined:fill} aria-valuetext={report.percentage===null?'No planned amount':`${Math.round(report.percentage)} percent of plan`} style={{background:`conic-gradient(var(--theme-success) ${fill}%, var(--theme-track) 0)`}}><span>{report.percentage===null?'—':`${Math.round(report.percentage)}%`}</span></div></div>
          <p className={styles.monthlyRemaining}>{report.remaining===null?'No planned amount':report.remaining===0?'Plan reached':`${money.format(report.remaining)} remaining in your plan`}</p>
          <div className={styles.monthlyMetrics}><div><span>Interest &amp; fees recorded</span><strong>{report.interest===null?'—':money.format(report.interest)}</strong>{report.hasEstimate&&<small>Includes estimates</small>}</div><div><span>Recorded balance change</span><strong>{report.netChange===null?'—':moneyFormat(report.netChange,money)}</strong></div></div>
          <div className={styles.monthlyAccounts}><h3>Payments by account</h3>{report.accountPayments.length?<ul>{report.accountPayments.map(account=><li key={account.id}><strong>{account.name}</strong><span>{account.paid>0?money.format(account.paid):'No payment recorded'}</span></li>)}</ul>:<p>No accounts in this category.</p>}</div>
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
          <header className={styles.victoryHeader}><span className={styles.victoryMark} aria-hidden="true"><OutlineIcon name="check"/></span><div><h2 id="paid-off-debts-title">One less debt. Well done.</h2><p>{paidOffDebts.length} {paidOffDebts.length===1?'account':'accounts'} paid off</p></div></header>
          <ul className={styles.victoryList}>{paidOffDebts.map(account=><li key={account.id}><strong>{account.name}</strong><PaidStatus label="Paid off"/></li>)}</ul>
        </section>}


      </div>}

      {tab === "utilization" && <div className={styles.stack}>{utilization ?? <section className={styles.card}><p className={styles.emptyChart}>Utilization data is unavailable.</p></section>}</div>}

      {tab === "milestones" && <div className={styles.stack}>
        <div className={styles.integratedSummary}><DebtScopeCarousel slides={scopeSlides} value={currentScope} onChange={setScope} label="Progress scope" /></div>
        <section className={`${styles.card} ${styles.achievementCard}`} aria-labelledby="achievement-title">
          <header className={styles.victoryHeader}><div className={styles.achievementRing} style={{'--achievement-angle':`${achievedMilestones.length/view.milestones.length*360}deg`} as CSSProperties} role="img" aria-label={`${achievedMilestones.length} of ${view.milestones.length} milestones achieved`}><span>{achievedMilestones.length}/{view.milestones.length}</span></div><div><h2 id="achievement-title">Your progress, celebrated</h2><p>{achievedMilestones.length?'Every milestone is a step forward.':'Your next win starts with a payment.'}</p></div></header>
          <ol className={styles.milestoneSteps} aria-label="Paydown milestones">{(['quarter','half','three-quarter','debt-free'] as const).map((id,index)=>{const item=view.milestones.find(item=>item.id===id)!;return <li key={id} data-achieved={item.status==='achieved'}><span aria-hidden="true">{item.status==='achieved'?<OutlineIcon name="check"/>:<OutlineIcon name="percent"/>}</span><small>{(index+1)*25}%<span className="sr-only"> {item.status==='achieved'?'achieved':item.status==='projected'?'projected':'pending'}</span></small></li>;})}</ol>
        </section>
        {([['Achieved', view.milestones.filter(item => item.status === 'achieved')], ['Coming next', view.milestones.filter(item => item.status !== 'achieved')]] as const).map(([heading, items]) => <section className={styles.card} key={heading}><header className={styles.cardHeader}><h2>{heading}</h2></header>{items.length ? <ol className={styles.milestoneList}>{items.map(item => <MilestoneItem key={item.id} item={item}/>)}</ol> : <p className={styles.emptyChart}>{heading === 'Achieved' ? 'No achieved milestones recorded yet.' : 'No upcoming milestones.'}</p>}</section>)}
        <section className={styles.card} aria-labelledby="milestone-progress-ring-title"><header className={styles.cardHeader}><div><h2 id="milestone-progress-ring-title">Milestone progress</h2></div></header><div className={styles.ringGrid}>{categoryData.map(category => <ProgressRing key={category.label} label={category.label} starting={category.starting} current={category.current} reduction={category.reduction} money={money} />)}</div></section>
      </div>}
    </>}
  </div>;
}
