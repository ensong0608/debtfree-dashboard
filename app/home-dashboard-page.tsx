"use client";
import { useState, type CSSProperties } from "react";
import type { DebtAccount } from "./dashboard-data";
import type { buildActualProgress } from "./debt-activity";
import type { PayoffSchedule as Schedule } from "./payoff-schedule";
import type { LoanTracker } from "./loan-progress";
import { householdDate } from "./household-date";
import { createHouseholdMoneyFormatter } from "./household-currency";
import { useHouseholdCurrency } from "./household-currency-context";
import OutlineIcon from "./outline-icon";
import PayoffLandscape from "./payoff-landscape";
import styles from "./payoff-home.module.css";

const monthLabel = (key: string, short = false) => new Date(key + "-01T12:00:00").toLocaleDateString("en-US", {month: short ? "short" : "long", year:"numeric"});
function Ring({ percent, small = false }: { percent: number | null; small?: boolean }) {
  return <div className={`${styles.ring} ${small ? styles.smallRing : ""}`} style={{"--progress":`${Math.min(100,Math.max(0,percent ?? 0))}%`} as CSSProperties} role="img" aria-label={percent === null ? "No starting balance recorded" : `${percent.toFixed(1)} percent paid`}><div><strong>{percent === null ? "—" : `${Math.max(0,percent).toFixed(1)}%`}</strong><span>paid</span></div></div>;
}
export default function HomeDashboardPage({ name, accounts, schedule, overviewSchedule, loans, progress, onSchedule, onViewPlan, onViewDebts, onViewProgress }: {
  name: string; accounts: DebtAccount[]; schedule: Schedule; overviewSchedule: Schedule; loans: LoanTracker[];
  progress: ReturnType<typeof buildActualProgress>; onSchedule: () => void;
  onViewPlan: () => void; onViewDebts: () => void; onViewProgress: () => void;
}) {
  const currency = useHouseholdCurrency();
  const money = createHouseholdMoneyFormatter(currency, {minimumFractionDigits:2,maximumFractionDigits:2});
  const [date] = useState(() => new Date());
  const active = accounts.filter(account => !account.archivedAt && account.balance > 0);
  const debtFree = overviewSchedule.debtFreeMonth;
  const today = new Date(householdDate(date) + "T12:00:00");
  const finish = debtFree ? new Date(debtFree + "-01T12:00:00") : null;
  let years = 0, months = 0, days = 0;
  if (finish && finish > today) {
    let totalMonths = (finish.getFullYear()-today.getFullYear())*12+finish.getMonth()-today.getMonth();
    if (finish.getDate() < today.getDate()) totalMonths--;
    const anchor = new Date(today.getFullYear(), today.getMonth()+totalMonths, today.getDate());
    years = Math.floor(totalMonths/12); months = totalMonths%12; days = Math.max(0,Math.round((finish.getTime()-anchor.getTime())/86400000));
  }
  const entries = [...accounts.filter(account => !account.archivedAt).map(account => ({type:account.type as string, balance:account.balance, start:account.baselineBalance, month:overviewSchedule.payoffMonths['account:'+account.id]})), ...loans.map(loan=>({type:loan.kind === 'house' ? 'Mortgage' : 'Auto loan', balance:loan.remainingAmount, start:loan.originalAmount, month:overviewSchedule.payoffMonths['loan:'+loan.id]}))];
  const categories = [...new Set(entries.filter(entry=>entry.balance>0).map(entry=>entry.type))].map(type=>{
    const items=entries.filter(entry=>entry.type===type), balance=items.reduce((sum,item)=>sum+item.balance,0), start=items.reduce((sum,item)=>sum+(item.start??item.balance),0);
    const payoffMonth=items.every(item=>item.balance<=0 || item.month) && overviewSchedule.complete ? items.map(item=>item.month).filter(Boolean).sort().at(-1) : undefined;
    return {type,balance,percent:items.every(item=>item.start!==undefined)&&start>0?Math.max(0,(start-balance)/start*100):null,payoffMonth};
  });
  const starting=progress.starting+loans.reduce((sum,loan)=>sum+loan.originalAmount,0), current=progress.current+loans.reduce((sum,loan)=>sum+loan.remainingAmount,0);
  const reduction=starting-current;
  const comparisonAvailable=progress.comparisonAvailable||(accounts.length===0&&loans.length>0);
  const percent=comparisonAvailable && starting>0 ? Math.min(100,Math.max(0,reduction/starting*100)) : null;
  const openSchedule = onSchedule;
  return <div className={styles.home}>
    <header className={styles.greeting}><h1>Hi {name.split(/\s+/)[0] || "there"}!</h1><p>You’re one step closer to a debt-free future. <span>♥</span></p></header>
    <section className={styles.countdown} aria-label="Debt-free countdown"><PayoffLandscape/><div className={styles.countdownText}><span>DEBT-FREE COUNTDOWN</span><h2>{debtFree ? monthLabel(debtFree) : active.length ? "Let’s find your finish line" : "A fresh start"}</h2>{finish ? <div className={styles.countdownNumbers}>{[[years,"years"],[months,"months"],[days,"days"]].map(([value,label])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div> : <button type="button" onClick={active.length ? onViewPlan : onViewDebts}>{active.length ? "Set your payment plan" : "Add your first debt"} →</button>}</div><span className={styles.countdownSaying}>A brighter<br/>tomorrow<br/>is possible <b>♥</b></span></section>
    <section className={styles.progressCard}><header><h2>Overall payoff progress</h2><button type="button" onClick={onViewProgress}>View details <OutlineIcon name="chevron"/></button></header><div className={styles.progressBody}><div className={styles.progressVisual}><span className={styles.smallSaying}>Small<br/>steps<br/>count <b>♥</b></span><Ring percent={percent}/></div><div className={styles.progressAmounts}><div><i className={styles.greenIcon}><OutlineIcon name="money"/></i><div><span>Principal paid</span><strong className={styles.green}>{comparisonAvailable ? money.format(Math.max(0,reduction)) : "—"}</strong></div></div><div><i className={styles.redIcon}><OutlineIcon name="receipt"/></i><div><span>Remaining balance</span><strong className={styles.red}>{money.format(current)}</strong></div></div></div><span className={styles.progressSaying}>You<br/>got<br/>this <b>♥</b></span></div></section>
    <section className={styles.quickStats} aria-label="Plan at a glance"><button type="button" onClick={openSchedule}><i><OutlineIcon name="calendar"/></i><span>Monthly payment<strong>{money.format(overviewSchedule.monthly)}</strong></span><OutlineIcon name="chevron"/></button><button type="button" onClick={onViewDebts}><i><OutlineIcon name="pie"/></i><span>Total debts<strong>{active.length + loans.filter(loan=>loan.remainingAmount>0).length}</strong></span><OutlineIcon name="chevron"/></button><button type="button" onClick={onViewPlan}><i><OutlineIcon name="calendar"/></i><span>Est. payoff date<strong>{debtFree ? monthLabel(debtFree,true) : "Set your plan"}</strong></span><OutlineIcon name="chevron"/></button></section>
    <section className={styles.categories} aria-label="Your debt categories"><header><h2>Your debt categories</h2><button type="button" onClick={onViewDebts}>View all <OutlineIcon name="chevron"/></button></header><div className={styles.categoryGrid}>{categories.map(category=><button type="button" key={category.type} data-debt-tone={category.type === "Mortgage"?"house":category.type === "Auto loan"?"car":category.type === "Credit card"?"credit":"other"} className={styles.goldCategory} onClick={onViewDebts}><div className={styles.categoryHeading}><i><OutlineIcon name={category.type === "Auto loan" ? "car" : category.type === "Credit card" ? "card" : "receipt"}/></i><div><h3>{category.type}</h3><span>{category.payoffMonth ? `Paid off ${monthLabel(category.payoffMonth,true)}` : "Keep moving forward"}</span></div><OutlineIcon name="chevron"/></div><div className={styles.categoryBalance}><Ring percent={category.percent} small/><div><span>Balance</span><strong>{money.format(category.balance)}</strong></div></div></button>)}</div>{!categories.length && <button type="button" className={styles.emptyDebts} onClick={onViewDebts}>Add a debt to begin your journey →</button>}</section>
    <section className={styles.schedulePreview}><PayoffLandscape/><header><div><h2>Payoff Schedule</h2><p>Your upcoming payments at a glance.</p></div><button type="button" onClick={openSchedule}>Open full schedule <OutlineIcon name="chevron"/></button></header><div className={styles.previewRows}>{schedule.rows.slice(0,3).map(month=>{
      const focus = active.find(account => month.paidOff.includes(account.name));
      return <button type="button" key={month.month} onClick={openSchedule}><time dateTime={month.month}>{monthLabel(month.month,true)}</time><i><OutlineIcon name={focus?.type === "Auto loan" ? "car" : "card"}/></i><span><strong>{focus?.name ?? "Debt payoff"}</strong><small>{month.paidOff.length ? `${month.paidOff.join(", ")} paid off` : "Monthly payment"}</small></span><b>{money.format(month.paid)}</b><OutlineIcon name="chevron"/></button>;
    })}{!schedule.rows.length && <button type="button" onClick={openSchedule}>Build your payoff schedule <OutlineIcon name="chevron"/></button>}</div><span className={styles.previewSaying}>Progress<br/>today,<br/>brighter days<br/>tomorrow <b>♥</b></span></section>
  </div>;
}
