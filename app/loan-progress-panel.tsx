'use client';
import BackButton from './back-button';
import NumericInput from './numeric-input';
import { useFormExit } from './use-form-exit';
import DateCalendar from './date-calendar';
import {nextDueDate} from './recurring-due-date';
import { DebtDetail, DebtOverview, ExperienceOverlay, type DebtDetailTab } from "./debt-experience";
import InfoTooltip from "./info-tooltip";
import { createHouseholdMoneyFormatter, householdCurrencySymbol } from "./household-currency";
import { useHouseholdCurrency } from "./household-currency-context";
import InstitutionIcon from "./institution-icon";
import OutlineIcon from "./outline-icon";
import {DetailSection,DetailSummary,detailStyles} from './debt-detail-sections';
import LoanDetailsFields from "./loan-details-fields";
import FloatingAddButton from "./floating-add-button";
import LoanActivityPanel from "./loan-activity-panel";
import { useRef, useState } from 'react';
import UnsavedChangesDialog from './unsaved-changes-dialog';
import type { CashflowItem } from './dashboard-data';
import { loanForecastAssumptions, regularLoanPayment, loanProgress, loanPaymentSplit, recordLoanPayment, type LoanTracker } from './loan-progress';
import { householdDate } from './interest-accrual';
import { formatRecurringDueDate } from './recurring-due-date';
import { loanEntryErrors, type LoanEntryField } from './loan-entry';


export default function LoanProgressPanel({ onDeleteDebt, loans, items, onChange, onDialog, initialDraft, embedded = false, onDebtType, onDraftChange, editorOnly = false, readOnly = false, paymentSuggestion, payoffMonth, detailLoanId, detailTab = "Overview", onDetailTab, onDetailClose }: {
  onDeleteDebt?: (loan:LoanTracker)=>void;
  onDraftChange?: (draft: LoanTracker) => void; embedded?: boolean; onDebtType?: (type: string) => void; paymentSuggestion?: number; payoffMonth?: string | null; detailLoanId?: string; detailTab?: DebtDetailTab; onDetailTab?: (tab: DebtDetailTab) => void; onDetailClose?: () => void; initialDraft?: LoanTracker; editorOnly?: boolean; readOnly?: boolean; loans: LoanTracker[]; items: CashflowItem[]; onChange: (loans: LoanTracker[]) => void; onDialog: (open: boolean) => void;
}) {
  const symbol = householdCurrencySymbol(useHouseholdCurrency());
  const householdCurrency = useHouseholdCurrency();
  const money = createHouseholdMoneyFormatter(householdCurrency, { style: 'currency', });
  const detailLoan = loans.find(loan => loan.id === detailLoanId);
  const detailRegularPayment = detailLoan ? regularLoanPayment(detailLoan, items) ?? 0 : 0;
  const suggestedRegular = Math.min(detailRegularPayment, paymentSuggestion ?? detailRegularPayment);
  const suggestedExtra = Math.max(0, (paymentSuggestion ?? detailRegularPayment) - detailRegularPayment);
  const [activityLoan,setActivityLoan]=useState<LoanTracker|null>(null);
  const [draft, setDraft] = useState<LoanTracker | null>(initialDraft ?? (detailLoan ? {...detailLoan, monthlyPayment: regularLoanPayment(detailLoan, items)} : null));
  const [initialEditorDraft] = useState(draft);
  const paymentForm = useRef<HTMLFormElement>(null);
  const [paymentDraft, setPaymentDraft] = useState<{ loan: LoanTracker; amount: number; extra: number; date: string } | null>(null);
  const paymentExit = useFormExit('loan payment', paymentDraft, () => { setPaymentDraft(null); onDialog(false); }, () => paymentForm.current?.requestSubmit(), paymentDraft?.loan.id);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<LoanEntryField, string>>>({});
  const [sourceLoan, setSourceLoan] = useState<LoanTracker | null>(detailLoan ?? null);
  const loanForm = useRef<HTMLFormElement>(null);
  const [pendingLoanExit, setPendingLoanExit] = useState<DebtDetailTab | 'close' | null>(null);
  const baselineDraft = sourceLoan ? { ...sourceLoan, monthlyPayment: regularLoanPayment(sourceLoan, items) } : initialEditorDraft;
  const loanDraftDirty = (!detailLoan || detailTab === 'Info') && draft !== null && JSON.stringify(draft) !== JSON.stringify(baselineDraft);
  const finishLoanExit = (destination: DebtDetailTab | 'close') => {
    setPendingLoanExit(null);
    if (destination === 'close') { if (detailLoan) onDetailClose?.(); else { setDraft(null); onDialog(false); } } else onDetailTab?.(destination);
  };
  const requestLoanExit = (destination: DebtDetailTab | 'close') => {
    if (destination === detailTab) return;
    if (loanDraftDirty) setPendingLoanExit(destination); else finishLoanExit(destination);
  };
  let paymentPreview = null;
  try { if (paymentDraft) paymentPreview = loanPaymentSplit(paymentDraft.loan, paymentDraft.amount, paymentDraft.extra); } catch {}
  const close = () => { if (pendingLoanExit) { finishLoanExit(pendingLoanExit); onDialog(false); return; } if (detailLoan) { onDetailTab?.("Overview"); } else setDraft(null); onDialog(false); };
  const open = (loan: LoanTracker) => {
    setError(''); setFieldErrors({}); setSourceLoan(loan);
    setDraft({ ...loan, monthlyPayment: regularLoanPayment(loan, items) });
    onDialog(true);
  };
  const editor = draft && <form className="reliable-loan-form" ref={loanForm} noValidate onSubmit={event => {
      event.preventDefault();
      if (readOnly) return;
      const existing = loans.find(loan => loan.id === draft.id);
      const candidate = { ...draft, asOf: existing && existing.remainingAmount !== draft.remainingAmount ? householdDate() : draft.asOf };
      const errors = loanEntryErrors(candidate);
      setFieldErrors(errors);
      const first = Object.keys(errors)[0];
      if (first) { (event.currentTarget.elements.namedItem(first) as HTMLElement | null)?.focus(); return; }
      if (sourceLoan && JSON.stringify(existing) !== JSON.stringify(sourceLoan)) { setError('This loan changed. Reopen it to review the latest balance.'); return; }
      const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
      const normalized = { ...candidate, monthlyPayment: cents(draft.monthlyPayment!), originalAmount: cents(draft.originalAmount), remainingAmount: cents(draft.remainingAmount), ...(draft.principalBalance === undefined ? {} : {principalBalance: cents(draft.principalBalance)}), ...(draft.escrow === undefined ? {} : { escrow: cents(draft.escrow) }) };
      const changed = !existing || existing.remainingAmount !== draft.remainingAmount || existing.asOf !== candidate.asOf || existing.balanceKind !== draft.balanceKind;
      const saved = { ...normalized, name: draft.name.trim(), history: changed ? [...draft.history, { date: candidate.asOf, amount: normalized.remainingAmount, balanceKind: draft.balanceKind, recordedAt: new Date().toISOString() }] : draft.history };
      onChange(existing ? loans.map(loan => loan.id === saved.id ? saved : loan) : [...loans, saved]); close();
    }}>{!detailLoan && !embedded && <header className="back-form-header"><BackButton type="button" data-dialog-close aria-label="Back from loan form" onClick={() => requestLoanExit("close")}/><h2 id="loan-dialog-title">{draft.kind === 'house' ? 'Mortgage Details' : 'Auto Loan Details'}</h2></header>}
      <div className="form-grid">
        <div className={detailStyles.stack}>
         <DetailSection title="Debt details" summary={<><DetailSummary label="Account name" value={draft.name||'Add a name'}/>{draft.customNoteEnabled&&draft.customNote&&<DetailSummary label="Custom note" value={draft.customNote}/>}</>}><LoanDetailsFields onDebtType={onDebtType} mode="debt" draft={draft} onChange={next=>{setDraft(next);onDraftChange?.(next);}} errors={fieldErrors}/></DetailSection>
         <DetailSection title="Payment & Terms" summary={<><DetailSummary label="Current balance" value={money.format(draft.remainingAmount||0)}/><DetailSummary label="APR" value={`${draft.apr??0}%`}/><DetailSummary label="Minimum payment" value={money.format(draft.monthlyPayment??0)}/></>}><LoanDetailsFields mode="terms" draft={draft} onChange={next=>{setDraft(next);onDraftChange?.(next);}} errors={fieldErrors}/><DateCalendar label="Balance date" value={draft.asOf} max={householdDate()} onChange={asOf=>{const next={...draft,asOf};setDraft(next);onDraftChange?.(next);}}/></DetailSection>
        </div>
        {Object.keys(fieldErrors).length > 0 && <div className="wide form-error" role="alert">Check the highlighted fields.</div>}
        {error && <p className="wide form-error" role="alert">{error.replace(/\$0(?:\.00)?/g, symbol + "0")}</p>}
      </div><footer className="form-action-footer"><button className="primary" type="submit" disabled={readOnly}>Save</button></footer>
      {detailLoan&&onDeleteDebt&&<button type="button" className={detailStyles.delete} onClick={()=>onDeleteDebt(detailLoan)}>Delete debt</button>}
    </form>;
  if (embedded) return <>{editor}{pendingLoanExit && <UnsavedChangesDialog subject="loan" onSave={()=>loanForm.current?.requestSubmit()} onDiscard={()=>finishLoanExit(pendingLoanExit)} onCancel={()=>setPendingLoanExit(null)}/>}</>;
  return <section className="loan-progress-section" aria-labelledby={editorOnly || detailLoan ? undefined : "loan-progress-title"}>
    {!editorOnly && !detailLoan && <><header><div><h2 id="loan-progress-title">Home & Auto</h2><p>Loan progress</p></div></header>
    <div className="loan-progress-grid">{loans.map(loan => {
      const progress = loanProgress(loan), payment = regularLoanPayment(loan, items), approximate = loan.balanceKind === 'payoff';
      let split = null;
      try { if (payment) split = loanPaymentSplit(loan, payment); } catch {}
      return <article key={loan.id} className={`loan-progress-card loan-${loan.kind}`} aria-label={`${loan.name} loan progress`}>
        <button type="button" className="compact-debt-edit" disabled={readOnly} aria-label={`Edit details for ${loan.name}`} onClick={()=>open(loan)}><span className="loan-kind">{loan.kind === 'house' ? 'Mortgage' : 'Auto loan'}</span><h3><InstitutionIcon institutionKey={loan.institutionKey} debtType={loan.kind}/>{loan.name}</h3>
        <span>{approximate ? 'Payoff quote' : 'Remaining principal'}</span><strong className="loan-balance"><span className="money-value">{money.format(loan.remainingAmount)}</span></strong>
        <div className="loan-progress-track" role="progressbar" aria-label={`${loan.name} balance reduction percentage`} aria-valuenow={Number(progress.percent.toFixed(2))} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress.percent}%` }}/></div>
        <div className="loan-progress-caption"><strong>{approximate ? '≈ ' : ''}{progress.percent.toFixed(2)}% reduced</strong><span>Balance {progress.reduction >= 0 ? 'reduced' : 'increased'} <span className="money-value">{money.format(Math.abs(progress.reduction))}</span></span></div>
        </button><dl><div><dt><InfoTooltip label="Original loan">{"The original principal entered for this loan tracker. It is the comparison amount for loan progress."}</InfoTooltip></dt><dd><span className="money-value">{money.format(loan.originalAmount)}</span></dd></div><div><dt>Monthly payment</dt><dd>{payment ? money.format(payment) : 'Add payment'}</dd></div><div><dt>Next payment due</dt><dd>{formatRecurringDueDate(loan.dueDate ?? '')}</dd></div></dl>
        {split && <dl className="loan-payment-split"><div><dt><InfoTooltip label="Next payment · principal">{"The portion of the regular payment estimated to reduce loan principal after interest and escrow."}</InfoTooltip></dt><dd><span className="money-value">{money.format(split.principal)}</span></dd></div><div><dt><InfoTooltip label="Interest">{"The estimated interest portion of the next regular payment, calculated from the saved remaining principal and loan rate."}</InfoTooltip></dt><dd><span className="money-value">{money.format(split.interest)}</span></dd></div><div><dt><InfoTooltip label="Escrow">{"The saved escrow portion of the regular payment. It does not reduce the loan principal."}</InfoTooltip></dt><dd><span className="money-value">{money.format(split.escrow)}</span></dd></div></dl>}
        <button type="button" className="debt-activity-chevron" aria-label={`Activity for ${loan.name}`} onClick={()=>setActivityLoan(loan)}>›</button><div className="compact-debt-actions">{split && <button className="secondary" type="button" disabled={readOnly} onClick={() => { setError(''); setPaymentDraft({ loan, amount: payment!, extra: 0, date: householdDate() }); onDialog(true); }}><OutlineIcon name="card"/>Payment</button>}
        {!split && <button className="primary" type="button" disabled={readOnly || loan.remainingAmount<=0} onClick={() => {setError('');setPaymentDraft({loan,amount:payment??0,extra:0,date:householdDate()});onDialog(true);}}><OutlineIcon name="card"/>Payment</button>}
        <button className="secondary" type="button" disabled={readOnly} aria-label={`Update ${loan.name} loan`} onClick={() => open(loan)}><OutlineIcon name="receipt"/>Balance</button></div>
      </article>;
    })}</div></>}
    {activityLoan&&<div className="modal-backdrop account-activity-backdrop"><section className="modal account-activity-modal" role="dialog" aria-modal="true" aria-label={`Activity for ${activityLoan.name}`}><header><h2>{activityLoan.name}</h2><button type="button" aria-label="Close activity" onClick={()=>setActivityLoan(null)}>×</button></header><LoanActivityPanel expanded loan={activityLoan}/></section></div>}
    {!detailLoan && draft && <div className="modal-backdrop"><section className="modal loan-modal loan-details-modal" role="dialog" aria-modal="true" aria-labelledby="loan-dialog-title">{editor}</section></div>}
    {detailLoan && <DebtDetail readOnly={readOnly} onEdit={() => { setDraft({...detailLoan, monthlyPayment:regularLoanPayment(detailLoan, items)}); setSourceLoan(detailLoan); setError(''); setFieldErrors({}); requestLoanExit("Info"); }} name={detailLoan.name} tab={detailTab} onTab={tab => { if (tab === "Info" && detailTab !== "Info") { setDraft({...detailLoan, monthlyPayment:regularLoanPayment(detailLoan, items)}); setSourceLoan(detailLoan); setError(''); setFieldErrors({}); } requestLoanExit(tab); }} onBack={() => requestLoanExit("close")} overview={<DebtOverview completedOn={detailLoan.remainingAmount <= .005 ? [...detailLoan.history].filter(entry => entry.amount <= .005).sort((a,b)=>b.date.localeCompare(a.date))[0]?.date : undefined} history={loanForecastAssumptions(detailLoan).length > 0 ? <small>{loanForecastAssumptions(detailLoan).join(" ")}</small> : undefined} payoff={payoffMonth} name={detailLoan.name} balance={detailLoan.remainingAmount} starting={detailLoan.originalAmount} apr={detailLoan.apr} minimum={regularLoanPayment(detailLoan, items)} dueDate={nextDueDate(detailLoan.dueDate??'')} readOnly={readOnly} onPayment={() => { setError(''); setPaymentDraft({loan:detailLoan, amount:suggestedRegular, extra:suggestedExtra, date:householdDate()}); onDialog(true); }} onBalance={() => { setDraft({...detailLoan, monthlyPayment:regularLoanPayment(detailLoan, items)}); setSourceLoan(detailLoan); onDetailTab?.("Info"); }}/>} transactions={<><FloatingAddButton label="Add loan transaction" disabled={readOnly || detailLoan.remainingAmount <= 0} onClick={() => { setError(''); setPaymentDraft({loan:detailLoan, amount:suggestedRegular, extra:suggestedExtra, date:householdDate()}); onDialog(true); }}/><LoanActivityPanel expanded allHistory loan={detailLoan}/></>} info={<div className="loan-detail-info"><fieldset disabled={readOnly}>{editor}</fieldset></div>}/>}

    {pendingLoanExit && <UnsavedChangesDialog subject="loan" onSave={() => loanForm.current?.requestSubmit()} onDiscard={() => { setDraft(baselineDraft); finishLoanExit(pendingLoanExit); }} onCancel={() => setPendingLoanExit(null)}/>}

    {paymentDraft && <div className="modal-backdrop"><section className="modal loan-modal" role="dialog" aria-modal="true" aria-labelledby="loan-payment-title"><form ref={paymentForm} onSubmit={event => {
      event.preventDefault();
      if (readOnly) return;
      try {
        if (JSON.stringify(loans.find(loan => loan.id === paymentDraft.loan.id)) !== JSON.stringify(paymentDraft.loan)) throw new Error("This loan changed while the form was open. Reopen it to review the latest balance.");
        const saved = recordLoanPayment(paymentDraft.loan, paymentDraft.amount, paymentDraft.date, paymentDraft.extra);
        onChange(loans.map(loan => loan.id === saved.id ? saved : loan)); setPaymentDraft(null); onDialog(false);
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to record payment.'); }
    }}><header className="back-form-header"><h2 id="loan-payment-title">Record {paymentDraft.loan.name} payment</h2><BackButton aria-label="Back from payment form" onClick={paymentExit.requestClose}/></header><div className="form-grid">
      <DateCalendar label="Payment date" value={paymentDraft.date} min={paymentDraft.loan.asOf} max={householdDate()} onChange={date => setPaymentDraft({ ...paymentDraft, date: date })}/>
      <label>Regular payment<NumericInput aria-label="Regular payment" min={0.01} value={paymentDraft.amount} onValueChange={amount => setPaymentDraft({ ...paymentDraft, amount })}/></label>
      <label>Extra principal<NumericInput aria-label="Extra principal" value={paymentDraft.extra} emptyValue={0} onValueChange={extra => setPaymentDraft({ ...paymentDraft, extra })}/></label>
      {paymentPreview && <div className="wide loan-payment-preview">{paymentDraft.loan.kind === "car" && loanForecastAssumptions(paymentDraft.loan).length > 0 && <p>{loanForecastAssumptions(paymentDraft.loan).join(" ")}</p>}<p>{loanForecastAssumptions(paymentDraft.loan).length ? "Estimated interest" : "Interest"}: <span className="money-value">{money.format(paymentPreview.interest)}</span> · Escrow: <span className="money-value">{money.format(paymentPreview.escrow)}</span></p><p>Principal deducted: <span className="money-value">{money.format(paymentPreview.principal + paymentPreview.extraPrincipal)}</span></p><p>{loanForecastAssumptions(paymentDraft.loan).length ? "Estimated new balance" : "New balance"}: <strong><span className="money-value">{money.format(paymentPreview.remainingAmount)}</span></strong></p><p>Total paid: <span className="money-value">{money.format(paymentPreview.total)}</span>. This does not add another Budget expense.</p></div>}
      {error && <p className="wide form-error" role="alert">{error.replace(/\$0(?:\.00)?/g, symbol + "0")}</p>}
    </div><footer className="form-action-footer"><button className="secondary" type="button" onClick={paymentExit.requestClose}>Back</button><button className="primary" type="submit" disabled={!paymentPreview}>Save</button></footer></form></section></div>}

    {paymentDraft && paymentExit.prompt}
  </section>;
}
