'use client';
import { useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { CashflowItem, DebtAccount } from './dashboard-data';
import { useHouseholdCurrency } from './household-currency-context';
import { createHouseholdMoneyFormatter } from './household-currency';
import { trackedPayoffProgress } from './debt-presentation';
import { effectiveMinimum } from './payoff-engine';
import { nextDueDate } from './recurring-due-date';
import { regularLoanPayment, type LoanTracker } from './loan-progress';
import type { PayoffSchedule } from './payoff-schedule';
import OutlineIcon from './outline-icon';
import { navigateTabs } from './tab-navigation';
import styles from './debt-experience.module.css';
export type DebtSelection = { kind: 'account' | 'loan'; id: string };
export type DebtDetailTab = 'Overview' | 'Transactions' | 'Info';
export function monthName(month: string | null) { return month ? new Date(month + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Set your payment target'; }
function tone(type: string) { return type === 'Credit card' ? 'credit' : type === 'house' ? 'house' : type === 'car' || type === 'Auto loan' ? 'car' : type === 'Personal loan' ? 'personal' : 'other'; }

const preferenceFallback = new Map<string,string>();
function useDebtPreference(scope:string, name:string, fallback:string, allowed:string[]) {
 const key='debtfree:debt-view:'+scope+':'+name;
 const value=useSyncExternalStore(notify=>{window.addEventListener('storage',notify);window.addEventListener('debt-view-preference',notify);return()=>{window.removeEventListener('storage',notify);window.removeEventListener('debt-view-preference',notify);};},()=>{try {const saved=localStorage.getItem(key)??preferenceFallback.get(key);return saved && allowed.includes(saved)?saved:fallback;} catch{return preferenceFallback.get(key)??fallback;}},()=>fallback);
 return [value,(next:string)=>{if(!allowed.includes(next))return;preferenceFallback.set(key,next);try{localStorage.setItem(key,next);}catch{}window.dispatchEvent(new Event('debt-view-preference'));}] as const;
}

type DebtControls = {search: string; sort: string; onSearch: (value: string) => void; onSort: (value: string) => void};
function DebtListControls({search, sort, onSearch, onSort}: DebtControls) {
 return <div className={styles.toolbar}><label className={styles.sort}><OutlineIcon name="sort"/><span>Sort</span><select aria-label="Sort debts" value={sort} onChange={event => onSort(event.target.value)}><option value="name">A - Z</option><option value="apr">Highest APR</option><option value="amount">Highest AMT</option></select></label><label className={styles.search}><span className="sr-only">Search debts</span><input type="search" placeholder="Search debts" value={search} onChange={event => onSearch(event.target.value)}/></label></div>;
}
export function UnifiedDebtList({ accounts, loans, items, onSelect, compact = false, controls, preferenceScope = "device" }: { accounts: DebtAccount[]; loans: LoanTracker[]; items: CashflowItem[]; onSelect: (selection: DebtSelection) => void; compact?: boolean; controls?: DebtControls; preferenceScope?: string }) {
  const money = createHouseholdMoneyFormatter(useHouseholdCurrency());
  const [localSort, setSort] = useDebtPreference(preferenceScope,'sort','name',['name','apr','amount']);
  const [localSearch, setSearch] = useState('');
  const sort = controls?.sort ?? localSort, search = controls?.search ?? localSearch;
  const rows = useMemo(() => [
    ...accounts.filter(a => !a.archivedAt).map(a => ({ id: a.id, kind: 'account' as const, name: a.name, type: a.type, balance: a.balance, apr: a.apr, minimum: effectiveMinimum(a), dueDate: nextDueDate(a.dueDate), color: tone(a.type), progress: trackedPayoffProgress(a) })),
    ...loans.map(loan => ({ id: loan.id, kind: 'loan' as const, name: loan.name, type: loan.kind === 'house' ? 'Mortgage' : 'Car loan', balance: loan.remainingAmount, apr: loan.apr, minimum: regularLoanPayment(loan, items), dueDate: nextDueDate(loan.dueDate ?? ''), color: tone(loan.kind), progress: loan.originalAmount > 0 ? Math.max(0,Math.min(100,(1-loan.remainingAmount/loan.originalAmount)*100)) : null })),
  ].filter(a => a.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).sort((a, b) => (sort === 'apr' ? (b.apr ?? -1) - (a.apr ?? -1) : sort === 'amount' ? b.balance - a.balance : a.name.localeCompare(b.name)) || a.name.localeCompare(b.name)), [accounts, loans, items, search, sort]);
  return <section className={styles.debtSection} aria-label={compact ? 'Your debts' : 'Debt list'}>
    {!controls && <DebtListControls search={search} sort={sort} onSearch={setSearch} onSort={setSort}/>}
    <div className={styles.debtGrid}>{rows.map(row => <button key={row.kind + row.id} className={styles.debtCard} data-debt-tone={row.color} onClick={() => onSelect({ kind: row.kind, id: row.id })} aria-label={`Open ${row.name}`} type="button"><span className={styles.cardTop}><span className={styles.typeIcon}><OutlineIcon name={row.color === 'house' ? 'home' : row.color === 'car' ? 'car' : 'card'}/></span><span>{row.type}</span><span className={styles.chevron} aria-hidden="true">›</span></span><h3>{row.name}</h3><strong className={styles.balance}>{money.format(row.balance)}</strong><span className={styles.cardMetrics}><span>APR<b className={row.apr===undefined?undefined:row.apr>=24?styles.highApr:styles.lowApr}>{row.apr === undefined ? '—' : `${row.apr}%`}</b></span><span>Minimum payment<b>{row.minimum === undefined ? '—' : money.format(row.minimum)}</b></span></span>{row.progress!==null && <span className={styles.listProgress}><span>{row.progress.toFixed(1)}% paid</span><span role="progressbar" aria-label={row.name+' balance reduction'} aria-valuenow={Number(row.progress.toFixed(1))} aria-valuemin={0} aria-valuemax={100}><i style={{width:row.progress+'%'}}/></span></span>}{row.dueDate && <span className={styles.due}>Due {new Date(row.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}</button>)}</div>
    {!rows.length && <p className={styles.empty}>{search ? 'No debts match your search.' : 'Add your first debt with Debt +.'}</p>}
  </section>;
}
function Landscape() {
  const id = useId().replaceAll(':', '');
  return <svg className={styles.scenery} viewBox="0 0 800 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id={`${id}sky`} x2="0" y2="1"><stop stopColor="#d9f5f6"/><stop offset="1" stopColor="#f4faf1"/></linearGradient><linearGradient id={`${id}lake`} x2="0" y2="1"><stop stopColor="#8ddbdc"/><stop offset="1" stopColor="#d4f2df"/></linearGradient></defs>
    <path fill={`url(#${id}sky)`} d="M0 0h800v260H0z"/><circle cx="663" cy="73" r="39" fill="#ffe39a"/>
    <g fill="#fff" opacity=".8"><path d="M500 64c0-14 19-17 24-7 13-23 43-13 40 7h18v7h-94v-7z"/><path d="M180 35c0-9 13-11 17-5 9-15 29-9 27 5h12v5h-65v-5z"/></g>
    <path d="m130 219 172-106 60 42 115-111 68 71 52-35 126 100 77-42v122H0z" fill="#add9e4"/>
    <path d="m305 223 172-179 48 50 36 62 36-76 126 100 77-42v122H180z" fill="#73b8d2"/>
    <path d="m477 44-35 70 34-14 18 15 12-16 19-5z" fill="#eff8f5"/><path d="m375 221 136-91 62 57 62-56 96 65 69-32v96H260z" fill="#459eac"/>
    <path d="M0 215q170-40 310-7t295-6 195-5v63H0" fill={`url(#${id}lake)`}/>
    <path d="M426 224h174m-207 10h157m-85 13h188" stroke="#f4fff3" strokeWidth="3" opacity=".8"/>
    {[15,42,70,106,638,662,687,715,745,775,798].map((x,i)=><g key={x} transform={`translate(${x} ${150+i%3*16}) scale(${.65+i%3*.2})`}><path d="M0-53-17-17h9L-23 8h14L-28 34h56L9 8h14L8-17h9Z" fill={i%2 ? '#286f75' : '#368b80'}/><path d="M-2 24h4v23h-4z" fill="#285d5b"/></g>)}
    <path d="M0 239q102-28 199 21H0m800-32q-104 8-135 32h135" fill="#6aaa86"/>
    {[4,30,55,85,730,758,790].map((x,i)=><g key={x} transform={`translate(${x} 265) rotate(${i%2?15:-15})`}><ellipse cy="-25" rx="8" ry="31" fill={i%2?'#3a8f84':'#81c2a1'}/><path d="M0 0v-48" stroke="#c4e5b6"/></g>)}
  </svg>;
}
function ProgressRing({ percent, small = false }: { percent: number; small?: boolean }) {
  return <div className={`${styles.ring} ${small ? styles.smallRing : ''}`} style={{ background: `conic-gradient(var(--ring-color, #26b5bc) ${percent}%, var(--ring-track, #dcf4f3) 0)` }}><span><strong>{percent.toFixed(1)}%</strong>reduced</span></div>;
}
function remainingTime(month: string | null) {
  if (!month) return null;
  const now = new Date(), end = new Date(month + '-01T12:00:00');
  if (end <= now) return [0, 0, 0];
  let years = end.getFullYear() - now.getFullYear(), months = end.getMonth() - now.getMonth(), days = end.getDate() - now.getDate();
  if (days < 0) { months--; days += new Date(end.getFullYear(), end.getMonth(), 0).getDate(); }
  if (months < 0) { years--; months += 12; }
  return [years, months, days];
}
export function DebtSummary({ accounts, loans, items, preferenceScope = 'device' }: { accounts: DebtAccount[]; loans: LoanTracker[]; items: CashflowItem[]; preferenceScope?: string }) {
 const money=createHouseholdMoneyFormatter(useHouseholdCurrency());
 const [view,setView]=useDebtPreference(preferenceScope,'summary','total',['total','cards']);
 const pointer=useRef<{x:number;y:number}|null>(null);
 const active=accounts.filter(a=>!a.archivedAt && (view==='total'||a.type==='Credit card')), includedLoans=view==='total'?loans:[];
 const total=active.reduce((n,a)=>n+a.balance,0)+includedLoans.reduce((n,l)=>n+l.remainingAmount,0);
 const monthly=active.reduce((n,a)=>n+effectiveMinimum(a),0)+includedLoans.reduce((n,l)=>n+(regularLoanPayment(l,items)??0),0);
 return <section className={styles.debtSummary} aria-label="Debt summary" onPointerDown={event=>{pointer.current={x:event.clientX,y:event.clientY};}} onPointerUp={event=>{const start=pointer.current;pointer.current=null;if(start&&Math.abs(event.clientX-start.x)>45&&Math.abs(event.clientX-start.x)>Math.abs(event.clientY-start.y)*1.5)setView(view==='total'?'cards':'total');}} onPointerCancel={()=>{pointer.current=null;}}>
  <nav className={styles.summaryDots} aria-label="Debt summary views">{[{id:'total',label:'Total outstanding debt'},{id:'cards',label:'Card debts'}].map(option=><button type="button" key={option.id} aria-label={option.label} aria-pressed={view===option.id} onClick={()=>setView(option.id)}><i/></button>)}</nav>
  <span>{view==='total'?'Total debt outstanding':'Card debts'}</span><strong>{money.format(total)}</strong><div><span>Active debts<b>{active.filter(a=>a.balance>0).length+includedLoans.filter(l=>l.remainingAmount>0).length}</b></span><span>Minimum payments<b>{money.format(monthly)}</b></span><span>Average APR<b>{total>0&&includedLoans.every(l=>l.remainingAmount<=0||l.apr!==undefined)?((active.reduce((n,a)=>n+a.balance*a.apr,0)+includedLoans.reduce((n,l)=>n+l.remainingAmount*(l.apr??0),0))/total).toFixed(2)+'%':'—'}</b></span></div>
 </section>;
}
export function HomeExperience({ name, accounts, loans, starting, current, schedule, onSchedule, onProgress, onDebts, onAccount }: { name: string; accounts: DebtAccount[]; loans: LoanTracker[]; starting: number; current: number; schedule: PayoffSchedule; onSchedule: () => void; onProgress: () => void; onDebts: () => void; onAccount: () => void }) {
  const money = createHouseholdMoneyFormatter(useHouseholdCurrency());
  const totalStart = starting + loans.reduce((sum, loan) => sum + loan.originalAmount, 0), remaining = current + loans.reduce((sum, loan) => sum + loan.remainingAmount, 0), reduction = totalStart - remaining;
  const percent = totalStart > 0 ? Math.max(0, Math.min(100, reduction / totalStart * 100)) : 0;
  const countdown = remainingTime(schedule.debtFreeMonth);
  const categories = [...accounts.filter(a=>!a.archivedAt).map(a=>({type:a.type, balance:a.balance, starting:a.baselineBalance, month:schedule.payoffMonths[`account:${a.id}`]})), ...loans.map(l=>({type:l.kind==='house'?'Mortgage':'Auto loan',balance:l.remainingAmount,starting:l.originalAmount,month:schedule.payoffMonths[`loan:${l.id}`]}))].reduce((groups, entry) => {
    let group=groups.find(g=>g.type===entry.type);
    if(!group) {group={type:entry.type,balance:0,starting:0,known:true,month:null as string|null};groups.push(group);}
    group.balance+=entry.balance; group.starting+=entry.starting??0; group.known &&= entry.starting!==undefined && entry.starting>0;
    if(entry.balance>0 && !entry.month) group.month=''; else if(entry.month && group.month!=='' && (!group.month || entry.month>group.month)) group.month=entry.month;
    return groups;
  }, [] as {type:string;balance:number;starting:number;known:boolean;month:string|null}[]);
  return <div className={styles.home}>
    <header className={styles.greeting}><div><h2>Hi {name.split(' ')[0] || 'there'}!</h2><p>You’re one step closer to a debt-free future. <span>♥</span></p></div><button type="button" className={styles.avatar} onClick={onAccount} aria-label="Open My Account">{name.split(/\s+/).filter(Boolean).map(p=>p[0]).slice(0,2).join('').toUpperCase()||'DF'}</button></header>
    <section className={styles.countdown}><Landscape/><div className={styles.countdownContent}><span>DEBT-FREE COUNTDOWN</span><h2>{schedule.debtFreeMonth ? monthName(schedule.debtFreeMonth) : remaining === 0 ? 'A fresh start' : 'Your brighter tomorrow'}</h2>{countdown ? <div className={styles.countdownUnits}>{countdown.map((value,i)=><span key={i}><strong>{value}</strong>{['years','months','days'][i]}</span>)}</div> : <p>Small steps today. A brighter future ahead.</p>}</div></section>
    <section className={styles.progressCard}><header><h2>Overall payoff progress</h2><button type="button" onClick={onProgress}>View details ›</button></header><div className={styles.progressBody}><ProgressRing percent={percent}/><dl><div><dt><OutlineIcon name="money"/>Balance reduced</dt><dd className={styles.positive}>{money.format(reduction)}</dd></div><div><dt><OutlineIcon name="receipt"/>Remaining balance</dt><dd className={styles.remaining}>{money.format(remaining)}</dd></div></dl></div></section>
    <section className={styles.highlights} aria-label="Household overview"><button type="button" onClick={onSchedule}><OutlineIcon name="calendar"/><span>Monthly payment<strong>{money.format(schedule.monthly)}</strong></span></button><button type="button" onClick={onDebts}><OutlineIcon name="pie"/><span>Total debts<strong>{accounts.filter(a => !a.archivedAt).length + loans.length}</strong></span></button><button type="button" onClick={onSchedule}><OutlineIcon name="calendar"/><span>Est. payoff date<strong>{schedule.debtFreeMonth ? new Date(schedule.debtFreeMonth+'-01T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'}) : 'Review schedule'}</strong></span></button></section>
    <section className={styles.categories} aria-label="Your debt categories"><header><h2>Your debt categories</h2><button type="button" onClick={onDebts}>View all ›</button></header><div className={styles.categoryGrid}>{categories.map(category=>{const color=tone(category.type==='Mortgage'?'house':category.type),progress=category.known?Math.max(0,Math.min(100,(1-category.balance/category.starting)*100)):0;return <button type="button" className={styles.categoryCard} data-debt-tone={color} key={category.type} onClick={onDebts}><div className={styles.categoryTitle}><span className={styles.typeIcon}><OutlineIcon name={color==='house'?'home':color==='car'?'car':'card'}/></span><span><strong>{category.type}</strong><small>{category.balance===0?'Paid off':category.month && schedule.complete ? `Payoff ${new Date(category.month+'-01T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'})}`:'View debts'}</small></span><span aria-hidden="true">›</span></div><div className={styles.categoryBody}>{category.known && <ProgressRing small percent={progress}/>}<span>Balance<strong>{money.format(category.balance)}</strong></span></div></button>;})}</div>{!categories.length&&<button className="secondary" type="button" onClick={onDebts}>Add your first debt</button>}</section>
    <section className={styles.preview} aria-label="Payoff Schedule preview"><Landscape/><header><div><h2>Payoff Schedule</h2><p>Your upcoming payments at a glance.</p></div><button type="button" onClick={onSchedule}>Open full schedule ›</button></header><button type="button" className={styles.previewRows} onClick={onSchedule} aria-label="View Payoff Schedule">{!schedule.issues.length && schedule.rows.slice(0, 3).map(row => <span key={row.month}><OutlineIcon name="calendar"/><span>{new Date(row.month+'-01T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'})}<small>Monthly payment</small></span><strong>{money.format(row.paid)}</strong><span aria-hidden="true">›</span></span>)}{!schedule.rows.length && !schedule.issues.length && <span>Set your monthly payment to see the schedule. ›</span>}{schedule.issues.length > 0 && <span>Review payment settings to complete your forecast. ›</span>}</button></section>
  </div>;
}
export function ExperienceOverlay({ title, onBack, children, wide = false, cardLayout = false }: { title: string; onBack: () => void; children: ReactNode; wide?: boolean; cardLayout?: boolean }) {
  return <div className={styles.backdrop}><section className={`${styles.overlay} ${wide ? styles.wide : ''} ${cardLayout ? styles.cardOverlay : ''}`}  role="dialog" aria-modal="true" aria-label={title}><header className={styles.overlayHeader}><button type="button" data-dialog-close aria-label={`Back from ${title}`} onClick={onBack}>‹</button><h2>{title}</h2></header>{children}</section></div>;
}
export function DebtDetail({ name, tab, onTab, onBack, overview, transactions, info, actions }: { name: string; tab: DebtDetailTab; onTab: (tab: DebtDetailTab) => void; onBack: () => void; overview: ReactNode; transactions: ReactNode; info: ReactNode; actions?: ReactNode }) {
  return <ExperienceOverlay title={name} onBack={onBack} cardLayout={Boolean(actions)}><div role="tablist" aria-label="Debt detail" className={styles.tabs}>{(['Overview', 'Transactions', 'Info'] as const).map(value => <button key={value} type="button" role="tab" id={`debt-${value}`} aria-controls="debt-detail-panel" aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} onKeyDown={navigateTabs} onClick={() => onTab(value)}>{value}</button>)}</div><div className={actions ? styles.detailContent+" "+styles.withCardActions : styles.detailContent} id="debt-detail-panel" role="tabpanel" aria-labelledby={`debt-${tab}`}>{tab === 'Overview' ? overview : tab === 'Transactions' ? transactions : info}</div>{actions&&<footer className={styles.cardActions}>{actions}</footer>}</ExperienceOverlay>;
}
export function DebtOverview({ name, balance, starting, apr, minimum, dueDate, readOnly, onPayment, onBalance, payoff, onEdit, history }: { name: string; balance: number; starting?: number; apr?: number; minimum?: number; dueDate?: string; readOnly: boolean; onPayment: () => void; onBalance: () => void; payoff?: string | null; onEdit?: () => void; history?: ReactNode }) {
  const money = createHouseholdMoneyFormatter(useHouseholdCurrency());
  const percent = starting && starting > 0 ? Math.max(0, Math.min(100, (1 - balance / starting) * 100)) : null;
  return <section className={styles.overview} aria-label={`${name} overview`} role={onEdit ? "button" : undefined} tabIndex={onEdit ? 0 : undefined} onClick={onEdit} onKeyDown={event=>{if(onEdit && (event.key==="Enter"||event.key===" ")){event.preventDefault();onEdit();}}}><span>Current balance</span><strong className={styles.balance}>{money.format(balance)}</strong><dl><div><dt>APR</dt><dd>{apr === undefined ? '—' : `${apr}%`}</dd></div><div><dt>Minimum payment</dt><dd>{minimum === undefined ? '—' : money.format(minimum)}</dd></div><div><dt>Due date</dt><dd>{dueDate || '—'}</dd></div><div><dt>Estimated payoff</dt><dd>{payoff ? monthName(payoff) : balance === 0 ? 'Paid off' : 'Review schedule'}</dd></div></dl>{onEdit && starting!==undefined && <dl className={styles.cardStarting}><div><dt>Starting balance</dt><dd>{money.format(starting)}</dd></div><div><dt>Balance reduced</dt><dd>{money.format(starting-balance)}</dd></div></dl>}{percent !== null && <div className={styles.debtProgress}><span>{percent.toFixed(1)}% reduced</span><progress aria-label="Debt balance reduction" max="100" value={percent}/></div>}{history}{!onEdit && <div className={styles.actions}><button type="button" className="primary" disabled={readOnly || balance <= 0} onClick={onPayment}>Record Payment</button><button type="button" className="secondary" disabled={readOnly} onClick={onBalance}>Update balance</button></div>}</section>;
}
export function ScheduleRows({ schedule, settings }: { schedule: PayoffSchedule; settings: ReactNode }) {
  const money = createHouseholdMoneyFormatter(useHouseholdCurrency());
  const first = schedule.rows[0];
  return <section className={styles.schedule} aria-label="Monthly payoff schedule">
    <div className={styles.scheduleIntro}><Landscape/><div><h2>Your month-by-month path to a debt-free future.</h2><p>See how each payment reduces your balance and gets you closer to your goals.</p></div></div>
    <section className={styles.currentPayment} aria-label="Current payment"><header><span>Current payment</span><strong>{first ? monthName(first.month) : 'Monthly target'}</strong></header><div><OutlineIcon name="calendar"/><span>{first ? new Date(first.month+'-01T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'}) : 'Next cycle'}<small>Your next payment</small></span><span>Payment<strong>{money.format(first?.paid??schedule.monthly)}</strong></span></div><details><summary>Edit payment &amp; payoff order</summary>{settings}</details></section>
    {schedule.issues.map(issue => <p role="status" key={issue} className={styles.issue}>{issue}</p>)}
    {schedule.rows.length > 0 && !schedule.issues.length && <div className={styles.tableWrap} role="region" aria-label="Full payoff schedule" tabIndex={0}><table><caption className="sr-only">Projected interest, balance after payment and debts paid off. Each month includes its projected payment.</caption><colgroup><col className={styles.monthCol}/><col className={styles.interestCol}/><col className={styles.balanceCol}/><col className={styles.milestoneCol}/></colgroup><thead><tr><th>Month</th><th>Interest</th><th>Balance after payment</th><th>Debt paid off</th></tr></thead><tbody>{schedule.rows.map(row => <tr key={row.month}><th scope="row"><span className={styles.monthCell}><OutlineIcon name="calendar"/><span>{new Date(row.month+'-01T12:00:00').toLocaleDateString('en-US',{month:'short'})}<small>{row.month.slice(0,4)}</small></span></span><span className="sr-only">Payment {money.format(row.paid)}</span></th><td>{money.format(row.interest)}</td><td><strong>{money.format(row.remaining)}</strong><small className={styles.rowPayment}>Pay {money.format(row.paid)}</small></td><td>{row.paidOff.length ? row.paidOff.map((name, i) => <span key={name + i} className={styles.milestone}><OutlineIcon name="check"/>{name} paid off!</span>) : '—'}</td></tr>)}</tbody></table></div>}
    {!schedule.rows.length && !schedule.issues.length && <p className={styles.empty}>No outstanding debt to forecast.</p>}
  </section>;
}
