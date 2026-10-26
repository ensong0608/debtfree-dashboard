"use client";
import { householdMonthOffset } from "./household-date";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { BalanceAdjustment, DebtAccount, LedgerTransaction, MonthlyPlanSettings } from "./dashboard-data";
import {householdDate} from "./household-date";
import { paymentActivity } from "./payments";
import { buildBudgetActivity, budgetLoanActivity, inBudgetPeriod } from "./budget-view";
import type { LoanTracker } from "./loan-progress";
import OutlineIcon from "./outline-icon";
import InfoTooltip, { ExplanationDialog } from "./info-tooltip";
import DebtEntryDialog from "./debt-entry-dialog";
import type { EntryCommand } from "./debt-transactions";
import InstitutionIcon from "./institution-icon";
import DebtActivityHistory from "./debt-activity-history";
import styles from "./payments-mobile.module.css";

import { useHouseholdCurrency } from "./household-currency-context";
import { createHouseholdMoneyFormatter } from "./household-currency";
function currentMonth() { return householdMonthOffset(0); }
function dateLabel(value: string) { return new Date(value + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

/** Only limits recovery presentation; no tombstone or financial mutation. */
export function isRecentlyDeleted(deletedAt: unknown, now = Date.now()) {
  const timestamp = typeof deletedAt === "string" ? Date.parse(deletedAt) : NaN;
  return !Number.isFinite(timestamp) || now - timestamp < 7 * 24 * 60 * 60 * 1000;
}
const explanations = {
  payments: { title: "Payments recorded", body: "Recorded payments for the selected period and account. Refunds, credits and unidentified balance adjustments are excluded. House and car loan payments are tracked separately." },
  interest: { title: "Interest & fees", body: "Interest and fees recorded for the selected period and account, including recorded estimates. These increase the debt balance." },
  net: { title: "Net balance change", body: "The combined balance movement for the selected period and account. Payments and credits decrease it; purchases, interest, fees and balance adjustments can increase it. Already-included records add no extra movement." },
};
function SummaryExplanation({ kind, onClose }: { kind: keyof typeof explanations; onClose: () => void }) {
  return <ExplanationDialog title={explanations[kind].title} onClose={onClose}><p>{explanations[kind].body}</p></ExplanationDialog>;
}

export default function PaymentsPage({ readOnly, accounts, transactions, adjustments, message, storedAccounts, onChange, onDialog, mobile = false, accountScope, cardDetail = false, reportingMonth, onReportingMonth, budgetSettings, loans = [], onLoan, onUndoBudgetPaid }: {
  loans?: LoanTracker[]; onLoan?: (id: string) => void; onUndoBudgetPaid?: (id: string) => void;
  budgetSettings?: MonthlyPlanSettings;
  reportingMonth?: string; onReportingMonth?: (month: string) => void;
  accountScope?: string; cardDetail?: boolean; mobile?: boolean; readOnly: boolean; accounts: DebtAccount[]; transactions: LedgerTransaction[]; adjustments: BalanceAdjustment[]; message: string;
  onConfirm: (id: string) => void; onUndoConfirmation: (id: string) => void; storedAccounts: DebtAccount[]; onChange: (command: EntryCommand, expected: string) => string | null; onDialog: (open: boolean) => void;
}) {
  const board = Boolean(budgetSettings);
  const [sortOrder,setSortOrder]=useState("recent");
  const currency = createHouseholdMoneyFormatter(useHouseholdCurrency());
  useEffect(() => () => onDialog(false), [onDialog]);
  const [explanation, setExplanation] = useState<keyof typeof explanations | null>(null);
  const [pendingExpected, setPendingExpected] = useState<string | undefined>();
  const [pendingAction, setPendingAction] = useState<EntryCommand | null>(null);
  const open = (command: EntryCommand) => { setPendingExpected(undefined); setPendingAction(command); onDialog(true); };
  const close = () => { setPendingAction(null); onDialog(false); };
  const [localMonth, setLocalMonth] = useState(()=>cardDetail?householdDate().slice(0,7):currentMonth());
  const month = reportingMonth ?? localMonth;
  const setMonth = onReportingMonth ?? setLocalMonth;
  const [period, setPeriod] = useState<"month" | "year" | "lifetime">(cardDetail ? "month" : accountScope ? "lifetime" : "month");
  const [accountId, setAccountId] = useState(accountScope ?? "all");
  const activity = useMemo(() => paymentActivity(transactions, adjustments), [transactions, adjustments]);
  const names = new Map(accounts.map(a => [a.id, a.name]));
  const knownIds = [...new Set([...accounts.map(a => a.id), ...activity.map(a => a.accountId)])];
  const [kindFilter, setKindFilter] = useState("all");
  const [search, setSearch] = useState("");
  const inPeriod = (date: string) => inBudgetPeriod(date, month, period);
  const budgetActivity = budgetSettings ? buildBudgetActivity(transactions, adjustments, budgetSettings, month, period) : null;
  const periodRows = (budgetActivity?.rows ?? activity).filter(row => inPeriod(row.date) && (accountId === "all" || row.accountId === accountId));
  const rows = periodRows.filter(row => kindFilter === "all" || (kindFilter === "payments" ? row.kind === "payment" : row.kind === "interest" || row.kind === "fee")).filter(row => {
    if (!search.trim()) return true;
    const query = search.trim().toLocaleLowerCase();
    return `${row.title} ${names.get(row.accountId) ?? "Removed debt"} ${row.date} ${row.kind}`.toLocaleLowerCase().includes(query);
  });
  if(board && sortOrder!=="recent") rows.sort((a,b)=>sortOrder==="oldest" ? a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt) : b.amount-a.amount||b.date.localeCompare(a.date));
  const paymentRows = periodRows.filter(row => row.kind === "payment");
  const paymentTotal = paymentRows.reduce((sum, row) => sum + row.amount, 0);
  const interestRows = periodRows.filter(row => row.kind === "interest" || row.kind === "fee");
  const interestTotal = interestRows.reduce((sum, row) => sum + row.difference, 0);
  const netChange = periodRows.reduce((sum, row) => sum + row.difference, 0);
  const paymentCount = paymentRows.length;
  const interestCount = interestRows.length;
  const years = [...new Set([month.slice(0, 4), currentMonth().slice(0, 4), ...transactions.map(row => row.date.slice(0, 4)), ...adjustments.map(row => row.date.slice(0, 4))])].sort().reverse();
  const summaryLabel = period === "month" ? "Monthly transaction summary" : period === "year" ? "Yearly transaction summary" : "Lifetime transaction summary";
  const paymentsLabel = period === "month" ? "Payments this month" : period === "year" ? `Payments in ${month.slice(0, 4)}` : "Lifetime payments";
  const deleted = [
    ...transactions.filter(t => t.deletedAt && !t.replacedByTransactionId && (!mobile || isRecentlyDeleted(t.deletedAt))).map(t => ({ id: "transaction:" + t.id, accountId: t.accountId, amount: t.amount, date: t.date, kind: t.type })),
    ...adjustments.filter(a => a.deletedAt && (!mobile || isRecentlyDeleted(a.deletedAt))).map(a => ({ id: "adjustment:" + a.id, accountId: a.accountId, amount: Math.abs(a.difference), date: a.date, kind: "adjustment" })),
  ].filter(t => inPeriod(t.date) && (accountId === "all" || t.accountId === accountId));
  const periodControl = (
      <label className={"transaction-period-control"+(board?" budget-board-filter":"")}><span><OutlineIcon name="calendar"/><span className={board?"sr-only":undefined}>Period</span></span><select aria-label="Period" value={period === "lifetime" ? "lifetime" : period === "year" ? `year:${month.slice(0, 4)}` : `month:${month}`} onChange={e => {
        const value = e.target.value;
        if (value === "lifetime") setPeriod("lifetime");
        else if (value.startsWith("year:")) { setPeriod("year"); setMonth(`${value.slice(5)}-${month.slice(5, 7)}`); }
        else { setPeriod("month"); setMonth(value.slice(6)); }
      }}>
        {cardDetail ? <><option value={'month:'+householdDate().slice(0,7)}>{new Date(householdDate().slice(0,7)+'-01T12:00:00').toLocaleDateString('en-US',{month:'short'})}</option><option value="lifetime">Lifetime</option><option value={'year:'+householdDate().slice(0,4)}>{householdDate().slice(0,4)}</option></> : <><option value="lifetime">Lifetime</option>
        <optgroup label="Year">{years.map(year => <option key={year} value={`year:${year}`}>{year}</option>)}</optgroup>
        <optgroup label="Month">{years.flatMap(year => Array.from({length: 12}, (_, i) => {
          const value = `${year}-${String(12 - i).padStart(2, "0")}`;
          return <option key={value} value={`month:${value}`}>{new Date(`${value}-01T12:00:00`).toLocaleDateString("en-US", {month: "short", year: "numeric"})}</option>;
        }))}</optgroup></>}
      </select>{board && <OutlineIcon name="chevron"/>}</label>
  );
  return <div className={`screen payments-screen transactions-screen${board ? " budget-transactions-board" : ""}${mobile ? " " + styles.mobile : ""}`}>
    <h1 className="sr-only">Transactions</h1>{accountScope && !cardDetail && <button className="secondary" type="button" disabled={readOnly} onClick={() => open({action:"save"})}>Add transaction</button>}
    {message && <p className="debt-action-message" role="status">{message}</p>}
    {!cardDetail && <div className={`payments-filters${mobile ? " " + styles.filters : ""}`}>
      {!cardDetail && periodControl}
      {!accountScope && <label className={board?"budget-board-filter":undefined}><span>{board && <OutlineIcon name="list"/>}<span className={board?"sr-only":undefined}>Account</span></span><select aria-label="Account" value={accountId} onChange={e => setAccountId(e.target.value)}><option value="all">All accounts</option>{knownIds.map(id => <option key={id} value={id}>{names.get(id) ?? "Removed debt (" + id + ")"}</option>)}</select>{board && <OutlineIcon name="chevron"/>}</label>}
    </div>}
    {board ? <section className="budget-board-summary" aria-label={summaryLabel}>
      {([{key:'payments',label:'Payments',icon:'arrow-down',value:currency.format(paymentTotal)},{key:'interest',label:'Interest & fees',icon:'arrow-up',value:currency.format(interestTotal)}] as const).map(card=><button type="button" className={`budget-summary-tile ${card.key}`} key={card.key} aria-label={`Explain ${explanations[card.key].title}`} onClick={()=>{setExplanation(card.key);onDialog(true);}}><i><OutlineIcon name={card.icon}/></i><span><small>{card.label}</small><strong><span className="money-value">{card.value}</span></strong></span></button>)}
      <button type="button" className="budget-net-change" aria-label="Explain Net balance change" onClick={()=>{setExplanation('net');onDialog(true);}}><span>Net balance change <OutlineIcon name="help"/></span><strong className={netChange>0?'increases':netChange<0?'decreases':''}>{netChange<0?'−':netChange>0?'+':''}<span className="money-value">{currency.format(Math.abs(netChange))}</span></strong></button>
    </section> : mobile ? <section className={`transaction-highlights ${styles.highlights}`} aria-label={summaryLabel}>{([
      { key: "payments", icon: "trend", value: currency.format(paymentTotal), count: paymentCount },
      { key: "interest", icon: "percent", value: currency.format(interestTotal), count: interestCount },
      { key: "net", icon: "check", value: `${netChange < 0 ? "−" : netChange > 0 ? "+" : ""}${currency.format(Math.abs(netChange))}`, count: periodRows.length },
    ] as const).map(card => <article key={card.key}><button type="button" className={styles.summaryButton} aria-haspopup="dialog" aria-label={`Explain ${explanations[card.key].title}`} onClick={() => { setExplanation(card.key); onDialog(true); }}><span className={styles.summaryHeading}>{card.key === "net" ? <i><OutlineIcon name={card.icon}/></i> : <OutlineIcon name={card.icon}/>}<span className={styles.summaryLabel}>{explanations[card.key].title}</span></span><strong>{card.value.split(",").map((part, index, parts) => <span className={styles.moneyChunk} key={index}>{part}{index < parts.length - 1 ? "," : ""}</span>)}</strong><small>{card.count} {card.count === 1 ? "transaction" : "transactions"}</small></button></article>)}</section> : <section className="transaction-highlights" aria-label={summaryLabel}><article><OutlineIcon name="trend"/><div><span><InfoTooltip label="Payments recorded">{explanations.payments.body}</InfoTooltip></span><strong>{currency.format(paymentTotal)}</strong><small>{paymentCount} {paymentCount === 1 ? "transaction" : "transactions"}</small></div></article><article><OutlineIcon name="percent"/><div><span><InfoTooltip label="Interest & fees">{explanations.interest.body}</InfoTooltip></span><strong>{currency.format(interestTotal)}</strong><small>{interestCount} {interestCount === 1 ? "transaction" : "transactions"}</small></div></article><article className="net-change"><i><OutlineIcon name="check"/></i><span><InfoTooltip label="Net balance change">{explanations.net.body}</InfoTooltip></span><strong className={netChange > 0 ? "negative" : ""}>{netChange < 0 ? "−" : netChange > 0 ? "+" : ""}{currency.format(Math.abs(netChange))}</strong></article></section>}
    {board && <div className="budget-board-toolbar"><label className="budget-transaction-search"><OutlineIcon name="search"/><span className="sr-only">Search transactions</span><input aria-label="Search transactions" type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search transactions"/></label><label className="budget-board-sort"><OutlineIcon name="sort"/><span>Sort</span><select aria-label="Sort transactions" value={sortOrder} onChange={event=>setSortOrder(event.target.value)}><option value="recent">Newest first</option><option value="oldest">Oldest first</option><option value="amount">Largest amount</option></select><OutlineIcon name="chevron"/></label></div>}
    <div className={"transaction-kind-filters"+(cardDetail?" "+styles.cardFilters:"")} role="group" aria-label="Filter activity category">{cardDetail && periodControl}{[{id:"all",label:"All"},{id:"payments",label:"Payments only"},{id:"interest",label:"Interest & fees"}].map(filter => <button type="button" key={filter.id} aria-pressed={kindFilter === filter.id} onClick={() => setKindFilter(filter.id)}>{board ? filter.id==="payments" ? "Payments" : filter.label : <>{filter.label} ({filter.id === "all" ? periodRows.length : filter.id === "payments" ? paymentCount : interestCount})</>}</button>)}</div>

    {budgetSettings && <section className="payment-activity budget-paid-activity" aria-label="Budget paid activity">
      {[
        ...(budgetActivity?.settlements ?? []).map(row => ({id: row.id, title: row.payeeName, date: row.date, amount: row.amount, loanId: undefined as string | undefined, settlementId: row.id.slice('settlement:'.length), automatic: row.memo.includes('Automatically')})),
        ...budgetLoanActivity(loans, month, period).map(row => ({id: row.id, title: row.name, date: row.date, amount: row.payment ?? 0, loanId: row.loanId, settlementId: undefined as string | undefined, automatic: false}))
      ].filter(row => (!search.trim() || `${row.title} ${row.date}`.toLowerCase().includes(search.trim().toLowerCase())) && kindFilter !== 'interest').sort((a,b)=>b.date.localeCompare(a.date)).map(row => <article className="budget-record-card budget-paid-record" key={row.id} data-paid-record={row.id}>
        <time className="budget-record-date" dateTime={row.date}>{dateLabel(row.date)}</time>
        <button type="button" className="budget-record-main" disabled={!row.loanId} onClick={()=>row.loanId && onLoan?.(row.loanId)}>
          {row.loanId ? <InstitutionIcon debtType={loans.find(loan=>loan.id===row.loanId)?.kind??'Debt account'} accountName={row.title}/> : <span className="budget-paid-icon"><OutlineIcon name="receipt"/></span>}
          <span className="budget-record-name"><strong>{row.title}</strong><span>{row.loanId?'Loan payment':'Budget paid record'}</span></span><span className="budget-record-amount"><strong className="decreases"><span className="money-value">{currency.format(row.amount)}</span></strong><small>Paid</small></span><OutlineIcon name="chevron"/>
        </button>
        <footer className="budget-paid-footer"><span>{row.automatic?'Automatic':'Recorded'}</span>{row.settlementId && onUndoBudgetPaid && <button type="button" disabled={readOnly} onClick={()=>onUndoBudgetPaid(row.settlementId!)} aria-label={`Undo paid record for ${row.title}`}>Undo paid</button>}</footer>
      </article>)}
    </section>}
    <section className="payment-activity" aria-label="Debt transaction activity">
      {rows.length ? rows.map((row, index) => {
        const kind = row.kind === "payment" ? "Payment" : row.kind === "credit" ? "Refund / credit" : row.kind === "interest" ? (transactions.find(t => "transaction:" + t.id === row.id)?.interestEstimate ? "Estimated interest" : "Interest") : row.kind === "purchase" ? "Purchase" : row.kind === "fee" ? "Fee" : "Balance adjustment";
        if(board){const account=accounts.find(item=>item.id===row.accountId);const title=row.kind==='payment'?'Payment recorded':row.kind==='adjustment'?'Balance update':row.title;return <article key={row.id} className="budget-record-card" data-activity-id={row.id} data-kind={row.kind}>
          <time className="budget-record-date" dateTime={row.date}>{dateLabel(row.date)}</time>
          <button type="button" className="budget-record-main" disabled={readOnly} aria-label={`Edit ${row.title} for ${names.get(row.accountId)??'removed debt'}`} onClick={()=>open({action:'save',id:row.id})}>
            <InstitutionIcon institutionKey={account?.institutionKey} debtType={account?.type??'Debt account'} accountName={account?.name??'Removed debt'}/>
            <span className="budget-record-name"><strong>{title}</strong><span>{names.get(row.accountId)??'Removed debt'}</span>{row.title!==title && !/^(payment|balance (update|adjustment|increased|decreased))$/i.test(row.title) && <small>{row.title}</small>}</span>
            <span className="budget-record-amount"><strong className={row.difference<0?'decreases':row.difference>0?'increases':''}>{row.difference<0?'−':row.difference>0?'+':''}<span className="money-value">{currency.format(row.amount)}</span></strong>{row.difference===0 && <small>Already included</small>}</span><OutlineIcon name="chevron"/>
          </button>
          <footer><DebtActivityHistory compact key={`${row.id}:${period}:${month}`} entries={periodRows} accountId={row.accountId} accountName={names.get(row.accountId)??'Removed debt'} currentEntryId={row.id}/>{!mobile && <button type="button" className="budget-record-delete" disabled={readOnly} aria-label={`Delete transaction for ${names.get(row.accountId)??'removed debt'}`} onClick={()=>open({action:'delete',id:row.id})}>×</button>}</footer>
        </article>;}
        return <Fragment key={row.id}>
          {(index === 0 || rows[index - 1].date.slice(0,7) !== row.date.slice(0,7)) && <h2 className="budget-activity-month">{new Date(row.date.slice(0,7)+"-01T12:00:00").toLocaleDateString("en-US",{month:"long",year:"numeric"})}<span>{rows.filter(item => item.date.slice(0,7) === row.date.slice(0,7)).length} {rows.filter(item => item.date.slice(0,7) === row.date.slice(0,7)).length === 1 ? "entry" : "entries"}</span></h2>}
          {(index === 0 || rows[index - 1].date !== row.date) && <h3 className="transaction-date"><time dateTime={row.date}>{dateLabel(row.date)}</time><span className={rows.filter(item => item.date === row.date).reduce((sum, item) => sum + item.difference, 0) > 0 ? "increases" : "decreases"}>{currency.format(rows.filter(item => item.date === row.date).reduce((sum, item) => sum + item.difference, 0))} net change</span></h3>}
          <article className="clean-transaction-card" data-activity-id={row.id} data-kind={row.kind}>
          <button type="button" className="transaction-edit-surface" disabled={readOnly} aria-label={`Edit ${row.title} for ${names.get(row.accountId) ?? "removed debt"}`} onClick={() => open({ action: "save", id: row.id })}>
            <span className={"transaction-icon " + (row.difference < 0 ? "decrease" : "increase")}><OutlineIcon name={row.kind === "purchase" ? "cart" : row.kind === "payment" || row.kind === "credit" ? "check" : row.kind === "interest" || row.kind === "fee" ? "percent" : "receipt"}/></span>
            <span className="transaction-clean-name"><strong className={mobile ? styles.transactionHeading : undefined}>{row.title}{mobile && row.title.trim().toLowerCase() !== kind.toLowerCase() && <span className={styles.transactionType}> · {kind}</span>}</strong><span>{names.get(row.accountId) ?? "Removed debt"}</span></span>
            <span className="transaction-amount"><strong className={"transaction-signed-total " + (row.difference < 0 ? "is-payment" : "is-increase")}>{row.difference === 0 ? "" : row.difference < 0 ? "−" : "+"}{currency.format(row.amount)}</strong>{(!mobile || row.difference === 0) && <small>{row.difference === 0 ? "Already included" : kind}</small>}</span>
          </button>
          <div className="transaction-card-footer"><span className="transaction-record-detail"><OutlineIcon name={row.kind === "payment" ? "check" : "receipt"}/>{row.kind === "payment" ? "Recorded" : row.kind === "interest" || row.kind === "fee" ? kind : typeof row.after === "number" ? `New balance: ${currency.format(row.after)}` : kind}</span>
          {!mobile && <button type="button" className="secondary transaction-delete-x" disabled={readOnly} onClick={() => open({ action: "delete", id: row.id })} aria-label={(row.kind === "payment" && !row.adjustment ? "Delete payment of " : "Delete transaction of ") + currency.format(row.amount) + " for " + (names.get(row.accountId) ?? "removed debt")}>×</button>}
          {!cardDetail && <DebtActivityHistory key={`${row.id}:${period}:${month}`} entries={periodRows} accountId={row.accountId} accountName={names.get(row.accountId) ?? "Removed debt"} currentEntryId={row.id}/>}</div>
        </article></Fragment>;
      }) : <div className="simple-empty"><h2>No activity in this period</h2><p>Use + to add a record, or update a lender balance in Debts.</p></div>}

    </section>
    {!mobile && <details className="transaction-reporting"><summary>{paymentsLabel}</summary><section className="simple-total" aria-label="Confirmed payment total"><span>{paymentsLabel}</span><strong>{currency.format(paymentTotal)}</strong><p>Payments exclude refunds, credits, and unidentified reconciliation adjustments. Cards and other accounts only; house/car payments are separate. Payments recorded differ from net debt reduction because purchases, interest, credits, and lender adjustments also change balances. Budget checklists stay unchanged.</p></section></details>}
    {deleted.length > 0 && <details className="deleted-payments"><summary>{mobile ? "Recently deleted" : "Deleted transactions"} ({deleted.length})</summary><p>Retained for recovery. Deleted entries do not affect balances or payment totals.</p>{deleted.map(t => <article key={t.id}><div><strong>{names.get(t.accountId) ?? "Removed debt"} · {currency.format(t.amount)}</strong><p>{t.kind} · {dateLabel(t.date)}</p></div><button type="button" className="secondary" disabled={readOnly} onClick={() => open({ action: "restore", id: t.id })} aria-label={"Restore " + (t.kind === "payment" ? "payment" : "transaction") + " of " + currency.format(t.amount) + " for " + (names.get(t.accountId) ?? "removed debt")}>Restore</button></article>)}</details>}
    {explanation && <SummaryExplanation kind={explanation} onClose={() => { setExplanation(null); onDialog(false); }}/>}
    {pendingAction && <DebtEntryDialog flexibleScope={cardDetail} accountScope={accountScope} key={`${pendingAction.action}:${pendingAction.id ?? "new"}`} mobile={mobile} expectedState={pendingExpected} onRequestDelete={mobile && pendingAction.id ? expected => { setPendingExpected(expected); setPendingAction({ action: "delete", id: pendingAction.id }); } : undefined} state={{ accounts: storedAccounts, transactions, adjustments }} command={pendingAction} readOnly={readOnly} onSave={onChange} onClose={close}/>}
  </div>;
}
