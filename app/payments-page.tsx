"use client";
import PaidStatus from './paid-status';
import TransactionAccountFilter from './transaction-account-filter';
import {settlementName,settlementFilter,transactionAccountOptions} from './transaction-filters';
import LoanHistoryEditor from './loan-history-editor';
import TitleSelect from './title-select';
import { householdMonthOffset } from "./household-date";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { BalanceAdjustment, DebtAccount, LedgerTransaction, MonthlyPlanSettings, PlanSettlement } from "./dashboard-data";
import {householdDate} from "./household-date";
import { paymentActivity } from "./payments";
import { buildBudgetActivity, budgetLoanActivity, inBudgetPeriod } from "./budget-view";
import type { LoanTracker } from "./loan-progress";
import OutlineIcon from "./outline-icon";
import { ExplanationDialog } from "./info-tooltip";
import SummaryFitAmount from './summary-fit-amount';
import FloatingAddButton from "./floating-add-button";
import DebtEntryDialog from "./debt-entry-dialog";
import type { EntryCommand } from "./debt-transactions";
import InstitutionIcon from "./institution-icon";
import TransactionCard from "./transaction-card";
import BudgetRecordEditor from "./budget-record-editor";
import styles from "./payments-mobile.module.css";

import { useHouseholdCurrency } from "./household-currency-context";
import { createHouseholdMoneyFormatter } from "./household-currency";
function currentMonth() { return householdMonthOffset(0); }
function dateLabel(value: string) { return new Date(value + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

const explanations = {
  payments: { title: "Payments recorded", body: "Recorded payments for the selected period and account. Refunds, credits and unidentified balance adjustments are excluded. Includes recorded house and auto loan payments. Budget paid acknowledgements do not add another payment." },
  interest: { title: "Interest & fees", body: "Interest and fees recorded for the selected period and account, including recorded estimates. These increase the debt balance." },
  adjustments: { title: "Balance adjustments", body: "Other recorded balance movements: balance updates, purchases, refunds and credits. Positive amounts increase the balance; negative amounts decrease it. Net change equals balance adjustments plus interest and fees minus payments." },
  net: { title: "Net balance change", body: "The combined balance movement for the selected period and account. Payments and credits decrease it; purchases, interest, fees and balance adjustments can increase it. Already-included records add no extra movement." },
};
function SummaryExplanation({ kind, value, onClose }: { kind: keyof typeof explanations; value:string; onClose: () => void }) {
  return <ExplanationDialog title={explanations[kind].title} onClose={onClose}><strong className="money-value">{value}</strong><p>{explanations[kind].body}</p></ExplanationDialog>;
}

export default function PaymentsPage({ readOnly, accounts, transactions, adjustments, message, storedAccounts, onChange, onDialog, mobile = false, accountScope, cardDetail = false, reportingMonth, onReportingMonth, budgetSettings, loans = [], onLoan, onUndoBudgetPaid, onEditBudgetPaid, onBalanceInfo, onLoansChange, budgetItems=[], budgetMonths={} }: {
  onLoansChange?: (loan:LoanTracker,expected:string)=>string|null;
  budgetMonths?: Record<string,import('./dashboard-data').CashflowItem[]>;
  budgetItems?: import('./dashboard-data').CashflowItem[];
  onEditBudgetPaid?: (entry: PlanSettlement) => void;
  onBalanceInfo?: (accountId: string) => void;
  loans?: LoanTracker[]; onLoan?: (id: string) => void; onUndoBudgetPaid?: (id: string) => void;
  budgetSettings?: MonthlyPlanSettings;
  reportingMonth?: string; onReportingMonth?: (month: string) => void;
  accountScope?: string; cardDetail?: boolean; mobile?: boolean; readOnly: boolean; accounts: DebtAccount[]; transactions: LedgerTransaction[]; adjustments: BalanceAdjustment[]; message: string;
  onConfirm: (id: string) => void; onUndoConfirmation: (id: string) => void; storedAccounts: DebtAccount[]; onChange: (command: EntryCommand, expected: string) => string | null; onDialog: (open: boolean) => void;
}) {
  const [editingLoan,setEditingLoan]=useState<{id:string;index:number}|null>(null);
  const historyLoan=loans.find(loan=>loan.id===editingLoan?.id);
  const [editingPaid,setEditingPaid]=useState<string|null>(null);
  const settlements=Object.values(budgetSettings?.months??{}).flatMap(plan=>plan.settlements??[]);
  const originalPaidEntry=settlements.find(entry=>entry.id===editingPaid);
  const paidEntry=originalPaidEntry?{...originalPaidEntry,name:settlementName(originalPaidEntry,budgetMonths,accounts)}:undefined;
  const closePaid=()=>{setEditingPaid(null);onDialog(false);};
  const [sortOrder,setSortOrder]=useState("recent");
  const unit=useHouseholdCurrency();
  const currency = createHouseholdMoneyFormatter(unit);
  const compactCurrency=createHouseholdMoneyFormatter(unit,{notation:"compact",minimumFractionDigits:0,maximumFractionDigits:2});
  const compact=(value:number)=>compactCurrency.format(value).replace(/([KMBT])\b/g,letter=>letter.toLowerCase());
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
  const accountOptions=transactionAccountOptions(accounts,activity,loans,settlements,budgetMonths);
  const [kindFilter, setKindFilter] = useState("all");
  const [search, setSearch] = useState("");
  const inPeriod = (date: string) => inBudgetPeriod(date, month, period);
  const budgetActivity = budgetSettings ? buildBudgetActivity(transactions, adjustments, budgetSettings, month, period) : null;
  const periodRows = (budgetActivity?.rows ?? activity).filter(row => inPeriod(row.date) && ((accountScope ?? accountId) === "all" || row.accountId === (accountScope ?? accountId)));
  const rows = periodRows.filter(row => kindFilter === "all" || (kindFilter === "payments" ? row.kind === "payment" : kindFilter === "adjustments" ? !["payment","interest","fee"].includes(row.kind) : row.kind === "interest" || row.kind === "fee")).filter(row => {
    if (!search.trim()) return true;
    const query = search.trim().toLocaleLowerCase();
    return `${row.title} ${names.get(row.accountId) ?? "Removed debt"} ${row.date} ${row.kind}`.toLocaleLowerCase().includes(query);
  });
  if(sortOrder!=="recent") rows.sort((a,b)=>sortOrder==="oldest" ? a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt) : b.amount-a.amount||b.date.localeCompare(a.date));
  const paymentRows = periodRows.filter(row => row.kind === "payment");
  const selectedLoanPayments=budgetLoanActivity(loans,month,period).filter(row=>(accountScope??accountId)==='all'||`loan:${row.loanId}`===(accountScope??accountId));
  const paymentTotal = paymentRows.reduce((sum, row) => sum + row.amount, 0)+selectedLoanPayments.reduce((sum,row)=>sum+(row.payment??0),0);
  const interestRows = periodRows.filter(row => row.kind === "interest" || row.kind === "fee");
  const interestTotal = interestRows.reduce((sum, row) => sum + row.difference, 0);
  const adjustmentTotal = periodRows.filter(row=>!["payment","interest","fee"].includes(row.kind)).reduce((sum,row)=>sum+row.difference,0);
  const netChange = periodRows.reduce((sum, row) => sum + row.difference, 0);
  const years = [...new Set([month.slice(0, 4), currentMonth().slice(0, 4), ...transactions.map(row => row.date.slice(0, 4)), ...adjustments.map(row => row.date.slice(0, 4)), ...settlements.map(row=>row.date.slice(0,4)), ...loans.flatMap(loan=>loan.history.map(row=>row.date.slice(0,4)))])].sort().reverse();
  const summaryLabel = period === "month" ? "Monthly transaction summary" : period === "year" ? "Yearly transaction summary" : "Lifetime transaction summary";
  const paymentsLabel = period === "month" ? "Payments this month" : period === "year" ? `Payments in ${month.slice(0, 4)}` : "Lifetime payments";
  const periodControl = (
      <label className="transaction-period-control budget-board-filter"><span><OutlineIcon name="calendar"/><span className="sr-only">Period</span></span><TitleSelect aria-label="Period" value={period === "lifetime" ? "lifetime" : period === "year" ? `year:${month.slice(0, 4)}` : `month:${month}`} onChange={e => {
        const value = e.target.value;
        if (value === "lifetime") setPeriod("lifetime");
        else if (value.startsWith("year:")) { setPeriod("year"); setMonth(`${value.slice(5)}-${month.slice(5, 7)}`); }
        else { setPeriod("month"); setMonth(value.slice(6)); }
      }}>
        <option value="lifetime">Lifetime</option>
        <optgroup label="Year">{years.map(year => <option key={year} value={`year:${year}`}>{year}</option>)}</optgroup>
        <optgroup label="Month">{years.flatMap(year => Array.from({length: 12}, (_, i) => {
          const value = `${year}-${String(12 - i).padStart(2, "0")}`;
          return <option key={value} value={`month:${value}`}>{new Date(`${value}-01T12:00:00`).toLocaleDateString("en-US", {month: "short", year: "numeric"})}</option>;
        }))}</optgroup>
      </TitleSelect><OutlineIcon name="chevron"/></label>
  );
  const loanRows=budgetLoanActivity(loans,month,period).filter(row=>(accountScope??accountId)==='all'||`loan:${row.loanId}`===(accountScope??accountId));
  const paidFeed = budgetSettings ? [
        ...(budgetActivity?.settlements ?? []).map(row => {const entry=settlements.find(entry=>'settlement:'+entry.id===row.id)!;return {id: row.id, filterId:settlementFilter(entry,budgetMonths,loans), title: settlementName(entry,budgetMonths,accounts), date: row.date, amount: row.amount, loanId: undefined as string | undefined, settlementId: row.id.slice('settlement:'.length), automatic: row.memo.includes('Automatically')};}),
        ...loanRows.map(row => ({id: row.id, filterId:`loan:${row.loanId}`, title: row.name, date: row.date, amount: row.payment ?? 0, loanId: row.loanId, settlementId: undefined as string | undefined, automatic: false}))
      ].filter(row => (!search.trim() || `${row.title} ${row.date}`.toLowerCase().includes(search.trim().toLowerCase())) && !['interest','adjustments'].includes(kindFilter) && ((accountScope ?? accountId) === 'all'||row.filterId===(accountScope??accountId))).sort((a,b)=>b.date.localeCompare(a.date)).map(row => ({id:row.id,date:row.date,amount:row.amount,node:<article className="budget-record-card budget-paid-record" key={row.id} data-paid-record={row.id}>
        <time className="budget-record-date" dateTime={row.date}>{dateLabel(row.date)}</time>
        <button type="button" className="budget-record-main" disabled={row.settlementId ? !onEditBudgetPaid : !row.loanId} onClick={()=>{if(row.settlementId){setEditingPaid(row.settlementId);onDialog(true);}else if(row.loanId){setEditingLoan({id:row.loanId,index:Number(row.id.split(':').at(-1))});onDialog(true);}}}>
          {row.loanId ? <InstitutionIcon debtType={loans.find(loan=>loan.id===row.loanId)?.kind??'Debt account'} accountName={row.title}/> : <span className="budget-paid-icon"><OutlineIcon name="receipt"/></span>}
          <span className="budget-record-name"><strong>{row.title}</strong><span>{row.loanId?'Loan payment':'Budget paid record'}</span></span><span className="budget-record-amount"><strong className="decreases"><span className="money-value">{currency.format(row.amount)}</span></strong><small><PaidStatus/></small></span><OutlineIcon name="chevron"/>
        </button>

      </article>})) : [];
  const ledgerFeed = rows.map(row => {
        const account = accounts.find(item => item.id === row.accountId);
        const title = row.kind === 'payment' ? 'Payment recorded' : row.kind === 'adjustment' ? 'Balance update' : row.title;
        const name = names.get(row.accountId) ?? 'Removed debt';
        return {id:row.id,date:row.date,amount:row.amount,node:<TransactionCard key={row.id} id={row.id} kind={row.kind} date={row.date} title={title} account={account} accountName={name} amount={row.amount} difference={row.difference} readOnly={readOnly} editLabel={`Edit ${row.title} for ${name}`} onEdit={() => open({ action: 'save', id: row.id })}
          description={row.title !== title && !/^(payment|balance (update|adjustment|increased|decreased))$/i.test(row.title) ? row.title : undefined}
          footer={!mobile ? <button type="button" className="budget-record-delete" disabled={readOnly} aria-label={`Delete transaction for ${name}`} onClick={() => open({ action: 'delete', id: row.id })}>×</button> : undefined}/>};
      });
  const feed: {id:string;date:string;amount:number;node:ReactNode}[] = [...paidFeed,...ledgerFeed];
  feed.sort((a,b)=>sortOrder === "amount" ? b.amount-a.amount || b.date.localeCompare(a.date) : (sortOrder === "oldest" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)) || a.id.localeCompare(b.id));
  const dates=[...new Set(feed.map(row=>row.date))];
  return <div className={`screen payments-screen transactions-screen budget-transactions-board${mobile ? " " + styles.mobile : ""}`}>
    {historyLoan&&editingLoan&&onLoansChange&&<LoanHistoryEditor loan={historyLoan} index={editingLoan.index} items={budgetItems} readOnly={readOnly} onSave={onLoansChange} onClose={()=>{setEditingLoan(null);onDialog(false);}}/>}
    <h1 className="sr-only">Transactions</h1>
    {message && <p className="debt-action-message" role="status">{message}</p>}
    <div className={`payments-filters${mobile ? " " + styles.filters : ""}`}>
      {periodControl}
      {!accountScope && <TransactionAccountFilter value={accountId} options={accountOptions} onChange={setAccountId}/>}
    </div>
    <section className="budget-board-summary" aria-label={summaryLabel}>
      {([{key:'payments',label:'Payments',icon:'arrow-down',value:currency.format(paymentTotal),compact:compact(paymentTotal)},{key:'interest',label:'Interest & fees',icon:'arrow-up',value:currency.format(interestTotal),compact:compact(interestTotal)},{key:'adjustments',label:'Adjustments',icon:'sort',value:(adjustmentTotal<0?'−':adjustmentTotal>0?'+':'')+currency.format(Math.abs(adjustmentTotal)),compact:(adjustmentTotal<0?'−':adjustmentTotal>0?'+':'')+compact(Math.abs(adjustmentTotal))}] as const).map(card=><button type="button" className={`budget-summary-tile ${card.key}`} key={card.key} aria-label={`Explain ${explanations[card.key].title}`} onClick={()=>{setExplanation(card.key);onDialog(true);}}><i><OutlineIcon name={card.icon}/></i><span><small>{card.label}</small><strong><SummaryFitAmount full={card.value} compact={card.compact}/></strong></span></button>)}
      <button type="button" className="budget-net-change" aria-label="Explain Net balance change" onClick={()=>{setExplanation('net');onDialog(true);}}><span>Net balance change <OutlineIcon name="help"/></span><strong className={netChange>0?'increases':netChange<0?'decreases':''}><SummaryFitAmount full={(netChange<0?'−':netChange>0?'+':'')+currency.format(Math.abs(netChange))} compact={(netChange<0?'−':netChange>0?'+':'')+compact(Math.abs(netChange))}/></strong></button>
    </section>
    <div className="budget-board-toolbar">
      <label className="budget-transaction-search"><OutlineIcon name="search"/><span className="sr-only">Search transactions</span><input aria-label="Search transactions" type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search"/></label>
      <label className="budget-board-filter transaction-category-filter"><span className="sr-only">Transaction type</span><TitleSelect aria-label="Transaction type" value={kindFilter} onChange={event=>setKindFilter(event.target.value)}><option value="all">Type</option><option value="payments">Payments</option><option value="interest">Interest &amp; fees</option><option value="adjustments">Adjustments</option></TitleSelect><OutlineIcon name="chevron"/></label>
      <label className="budget-board-sort"><OutlineIcon name="sort"/><span className="sr-only">Sort transactions</span><TitleSelect aria-label="Sort transactions" value={sortOrder} onChange={event=>setSortOrder(event.target.value)}><option value="recent">Newest first</option><option value="oldest">Oldest first</option><option value="amount">Largest amount</option></TitleSelect></label>
    </div>

    <section className="payment-activity" aria-label="Transaction activity">{dates.map(date=><section className="transaction-date-group" data-activity-date={date} key={date}><h2>{dateLabel(date)}</h2>{feed.filter(row=>row.date===date).map(row=><div key={row.id}>{row.node}</div>)}</section>)}{!feed.length&&<p>No activity in this period.</p>}</section>
    {!mobile && <details className="transaction-reporting"><summary>{paymentsLabel}</summary><section className="simple-total" aria-label="Confirmed payment total"><span>{paymentsLabel}</span><strong>{currency.format(paymentTotal)}</strong><p>Payments exclude refunds, credits, and unidentified reconciliation adjustments. Includes recorded house/car payments. Net balance change covers account ledger movements; loan payments retain their own principal, interest and escrow breakdown. Payments recorded differ from net debt reduction because purchases, interest, credits, and lender adjustments also change balances. Budget checklists stay unchanged.</p></section></details>}

    {explanation && <SummaryExplanation kind={explanation} value={currency.format(explanation==='payments'?paymentTotal:explanation==='interest'?interestTotal:explanation==='adjustments'?adjustmentTotal:netChange)} onClose={() => { setExplanation(null); onDialog(false); }}/>}
    {!pendingAction && <FloatingAddButton label="Add transaction" disabled={readOnly} onClick={() => open({action:"save"})}/>}
    {paidEntry && onEditBudgetPaid && <BudgetRecordEditor key={paidEntry.id} entry={paidEntry} readOnly={readOnly} onClose={closePaid} onSave={entry=>{onEditBudgetPaid(entry);closePaid();}} onUndo={()=>{onUndoBudgetPaid?.(paidEntry.id);closePaid();}}/>}
    {pendingAction && <DebtEntryDialog flexibleScope={cardDetail} accountScope={accountScope} key={`${pendingAction.action}:${pendingAction.id ?? "new"}`} mobile={mobile} expectedState={pendingExpected} onRequestDelete={mobile && pendingAction.id ? expected => { setPendingExpected(expected); setPendingAction({ action: "delete", id: pendingAction.id }); } : undefined} state={{ accounts: storedAccounts, transactions, adjustments }} command={pendingAction} readOnly={readOnly} onSave={onChange} onClose={close}/>}
  </div>;
}
