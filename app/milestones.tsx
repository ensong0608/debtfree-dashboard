import type { ReactNode } from 'react';
import OutlineIcon from './outline-icon';
import type { buildProgressView, ProgressMilestoneView } from './progress-view';
import styles from './milestones.module.css';
type View = ReturnType<typeof buildProgressView>;
const goals = {quarter:25, half:50, 'three-quarter':75, 'debt-free':100};
const descriptions: Record<ProgressMilestoneView['id'],string> = {
  'first-payment':'The first step toward a lighter future.', 'first-1000':'A thousand dollars less to carry.',
  'first-debt':'Bring one account balance to zero.', quarter:'A quarter of your starting debt eliminated.',
  half:'Halfway to a fresh start.', 'three-quarter':'Three quarters of the way there.', 'debt-free':'Every tracked balance paid off.',
};
/** Presentation only: completion and dates remain owned by buildProgressView. */
export default function Milestones({view,money,scopeControl}:{view:View;money:Intl.NumberFormat;scopeControl:ReactNode}) {
  const rows = view.milestones.map(item=>{
    const achieved=item.status==='achieved';
    const target=item.id==='first-1000' ? (view.summary.starting!==null&&view.summary.starting>=1000?1000:null) : item.id in goals ? (view.summary.starting!==null&&view.summary.starting>0?goals[item.id as keyof typeof goals]:null) : 1;
    const amount=item.id==='first-1000'?Math.max(0,view.summary.reduction??0):item.id in goals?Math.max(0,view.summary.percent??0):achieved?1:0;
    const percent=target===null?null:achieved?100:Math.min(100,amount/target*100);
    const progress=target===null?null:item.id==='first-1000'?`${money.format(Math.min(amount,target))} / ${money.format(target)}`:item.id in goals?`${Math.min(amount,target).toFixed(1)}% / ${target}%`:`${achieved?1:0} / 1`;
    return {item,percent,progress,group:achieved?'Completed':percent!==null&&percent>0?'In Progress':'Up Next'};
  });
  const next=rows.filter(row=>row.group==='In Progress').sort((a,b)=>(b.percent??0)-(a.percent??0))[0]??rows.find(row=>row.group==='Up Next'&&row.percent!==null);
  const bar=(row:typeof rows[number])=>row.percent!==null&&<div className={styles.progress}><span role="progressbar" aria-label={row.item.label} aria-valuenow={Math.round(row.percent)} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${row.percent}%`}}/></span><small>{row.progress}</small></div>;
  return <div className={styles.page}>
    <header className={styles.heading}><div><h2>Milestones</h2><p>Small wins add up to a debt-free you.</p></div><svg viewBox="0 0 140 90" aria-hidden="true"><path d="M0 85 42 34 66 59 98 12 140 85Z" fill="var(--theme-accent-soft)"/><path d="M45 85 98 12 140 85Z" fill="var(--theme-scenery-front)"/><path d="M90 85Q62 74 91 60T98 25" fill="none" stroke="var(--theme-surface)" strokeWidth="5"/><path d="M98 12V0M98 1 116 5 98 9" fill="var(--theme-success)" stroke="var(--theme-success)" strokeWidth="2"/></svg></header>
    {scopeControl}
    <div className={styles.counts}>{(['Completed','In Progress','Up Next'] as const).map(group=><div key={group}><strong>{rows.filter(row=>row.group===group).length}</strong><span>{group}</span></div>)}</div>
    {next&&<section className={styles.featured} aria-labelledby="next-milestone-title"><span className={styles.icon}><OutlineIcon name="flag"/></span><div><small>Next unlock</small><h3 id="next-milestone-title">{next.item.label}</h3><span className={styles.featurePercent}>{Math.round(next.percent??0)}% of target</span><p>{descriptions[next.item.id]}</p>{bar(next)}</div></section>}
    {(['Completed','In Progress','Up Next'] as const).map(group=><section className={styles.group} key={group} aria-label={group+' milestones'}><h3>{group}<span>{rows.filter(row=>row.group===group).length}</span></h3>{rows.filter(row=>row.group===group).length?<ul>{rows.filter(row=>row.group===group).map(row=><li className={styles.row} data-state={group} key={row.item.id}><span className={styles.icon}><OutlineIcon name={group==='Completed'?'check':row.item.id==='first-payment'?'receipt':row.item.id==='first-debt'?'card':'flag'}/></span><div><strong>{row.item.label}</strong><p>{descriptions[row.item.id]}</p>{row.item.achievedOn?<small>Recorded <time dateTime={row.item.achievedOn}>{new Date(row.item.achievedOn+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})}</time></small>:row.item.firstObservedMonth?<small>First observed {row.item.firstObservedMonth}</small>:row.item.evidence==='live-balance'?<small>Attained by current balance</small>:null}{group!=='Completed'&&bar(row)}{group!=='Completed'&&row.item.projectedMonth&&<small>Projected {new Date(row.item.projectedMonth+'-01T12:00:00Z').toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'})}</small>}{row.percent===null&&<small>Starting comparison unavailable</small>}</div></li>)}</ul>:<p className={styles.empty}>{group==='Completed'?'Your first win is ahead.':group==='In Progress'?'No milestones in progress.':'All milestones are underway or completed.'}</p>}</section>)}
  </div>;
}
