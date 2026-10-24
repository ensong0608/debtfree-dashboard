'use client';
import DateCalendar from './date-calendar';
import {nextDueDate} from './recurring-due-date';
import { DebtDetail, DebtOverview, ExperienceOverlay, type DebtDetailTab } from "./debt-experience";
import InfoTooltip from "./info-tooltip";
import { createHouseholdMoneyFormatter, householdCurrencySymbol } from "./household-currency";
import { useHouseholdCurrency } from "./household-currency-context";
import InstitutionIcon from "./institution-icon";
import OutlineIcon from "./outline-icon";
import LoanDetailsFields from "./loan-details-fields";
import LoanActivityPanel from "./loan-activity-panel";
import { useRef, useState } from 'react';
import UnsavedChangesDialog from './unsaved-changes-dialog';
import type { CashflowItem } from './dashboard-data';
import { loanForecastAssumptions, regularLoanPayment, loanProgress, loanPaymentSplit, recordLoanPayment, type LoanTracker } from './loan-progress';
import { householdDate } from './interest-accrual';
import { formatRecurringDueDate } from './recurring-due-date';
import { loanEntryErrors, type LoanEntryField } from './loan-entry';


export default function LoanProgressPanel({ loans, items, onChange, onDialog, initialDraft, editorOnly = false, readOnly = false, paymentSuggestion, payoffMonth, detailLoanId, detailTab = "Overview", onDetailTab, onDetailClose }: {
  paymentSuggestion?: number; payoffMonth?: string | null; detailLoanId?: string; detailTab?: DebtDetailTab; onDetailTab?: (tab: DebtDetailTab) => void; onDetailClose?: () => void; initialDraft?: LoanTracker; editorOnly?: boolean; readOnly?: boolean; loans: LoanTracker[]; items: CashflowItem[]; onChange: (loans: LoanTracker[]) => void; onDialog: (open: boolean) => void;
}) {
  const symbol = householdCurrencySymbol(useHouseholdCurrency());
  const householdCurrency = useHouseholdCurrency();
  const money = createHouseholdMoneyFormatter(householdCurrency, { style: 'currency', });
  const detailLoan = loans.find(loan => loan.id === detailLoanId);
  const detailRegularPayment = detailLoan ? regularLoanPayment(detailLoan, items) ?? 0 : 0;
  const suggestedRegular = Math.min(detailRegularPayment, paymentSuggestion ?? detailRegularPayment);
  const suggestedExtra = Math.max(0, (paymentSuggestion ?? detailRegularPayment) - detailRegularPayment);
  const [advanced, setAdvanced] = useState(false);
  const [activityLoan,setActivityLoan]=useState<LoanTracker|null>(null);
  const [draft, setDraft] = useState<LoanTracker | null>(initialDraft ?? (detailLoan ? {...detailLoan, monthlyPayment: regularLoanPayment(detailLoan, items)} : null));
  const [paymentDraft, setPaymentDraft] = useState<{ loan: LoanTracker; amount: number; extra: number; date: string } | null>(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<LoanEntryField, string>>>({});
  const [sourceLoan, setSourceLoan] = useState<LoanTracker | null>(detailLoan ?? null);
  const loanForm = useRef<HTMLFormElement>(null);
  const [pendingLoanExit, setPendingLoanExit] = useState<DebtDetailTab | 'close' | null>(null);
  const baselineDraft = sourceLoan ? { ...sourceLoan, monthlyPayment: regularLoanPayment(sourceLoan, items) } : null;
  const loanDraftDirty = detailTab === 'Info' && draft !== null && JSON.stringify(draft) !== JSON.stringify(baselineDraft);
  const finishLoanExit = (destination: DebtDetailTab | 'close') => {
    setPendingLoanExit(null);
    if (destination === 'close') onDetailClose?.(); else onDetailTab?.(destination);
  };
  const requestLoanExit = (destination: DebtDetailTab | 'close') => {
    if (destination === detailTab) return;
    if (loanDraftDirty) setPendingLoanExit(destination); else finishLoanExit(destination);
  };
  let paymentPreview = null;
  try { if (paymentDraft) paymentPreview = loanPaymentSplit(paymentDraft.loan, paymentDraft.amount, paymentDraft.extra); } catch {}
  const close = () => { if (pendingLoanExit) { finishLoanExit(pendingLoanExit); onDialog(false); return; } if (detailLoan) { onDetailTab?.("Overview"); setAdvanced(false); } else setDraft(null); onDialog(false); };
  const open = (loan: LoanTracker) => {
    setError(''); setFieldErrors({}); setSourceLoan(loan);
    setDraft({ ...loan, monthlyPayment: regularLoanPayment(loan, items) });
    onDialog(true);
  };
  const editor = draft && <form ref={loanForm} noValidate onSubmit={event => {
      event.preventDefault();
      if (readOnly) return;
      const existing = loans.find(loan => loan.id === draft.id);
      const candidate = { ...draft, asOf: existing && existing.remainingAmount !== draft.remainingAmount ? householdDate() : draft.asOf };
      const errors = loanEntryErrors(candidate);
      setFieldErrors(errors);
      const first = Object.keys(errors)[0];
      if (detailLoan && (first === "originalAmount" || first === "asOf")) setAdvanced(true);
      if (first) { (event.currentTarget.elements.namedItem(first) as HTMLElement | null)?.focus(); return; }
      if (sourceLoan && JSON.stringify(existing) !== JSON.stringify(sourceLoan)) { setError('This loan changed. Reopen it to review the latest balance.'); return; }
      const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
      const normalized = { ...candidate, monthlyPayment: cents(draft.monthlyPayment!), originalAmount: cents(draft.originalAmount), remainingAmount: cents(draft.remainingAmount), ...(draft.principalBalance === undefined ? {} : {principalBalance: cents(draft.principalBalance)}), ...(draft.escrow === undefined ? {} : { escrow: cents(draft.escrow) }) };
      const changed = !existing || existing.remainingAmount !== draft.remainingAmount || existing.asOf !== candidate.asOf || existing.balanceKind !== draft.balanceKind;
      const saved = { ...normalized, name: draft.name.trim(), history: changed ? [...draft.history, { date: candidate.asOf, amount: normalized.remainingAmount, balanceKind: draft.balanceKind, recordedAt: new Date().toISOString() }] : draft.history };
      onChange(existing ? loans.map(loan => loan.id === saved.id ? saved : loan) : [...loans, saved]); close();
    }}>{!detailLoan && <header className="back-form-header"><button type="button" data-dialog-close aria-label="Back from loan form" onClick={close}>‹</button><h2 id="loan-dialog-title">{draft.kind === 'house' ? 'Mortgage Details' : 'Car Loan Details'}</h2></header>}
      <div className="form-grid">
        <LoanDetailsFields mode={detailLoan ? "info" : "all"} draft={draft} onChange={setDraft} errors={fieldErrors}/>
        {Object.keys(fieldErrors).length > 0 && <div className="wide form-error" role="alert">Check the highlighted fields.</div>}
        {error && <p className="wide form-error" role="alert">{error.replace(/\$0(?:\.00)?/g, symbol + "0")}</p>}
      </div><footer><button className="primary" type="submit" disabled={readOnly}>Save</button>{detailLoan ? <button className="secondary" type="button" onClick={() => setAdvanced(true)}>Advanced</button> : <button className="secondary" type="button" onClick={close}>Cancel</button>}</footer>
    </form>;
  return <section className="loan-progress-section" aria-labelledby={editorOnly || detailLoan ? undefined : "loan-progress-title"}>
    {!editorOnly && !detailLoan && <><header><div><h2 id="loan-progress-title">House & car</h2><p>Loan progress</p></div></header>
    <div className="loan-progress-grid">{loans.map(loan => {
      const progress = loanProgress(loan), payment = regularLoanPayment(loan, items), approximate = loan.balanceKind === 'payoff';
      let split = null;
      try { if (payment) split = loanPaymentSplit(loan, payment); } catch {}
      return <article key={loan.id} className={`loan-progress-card loan-${loan.kind}`} aria-label={`${loan.name} loan progress`}>
        <button type="button" className="compact-debt-edit" disabled={readOnly} aria-label={`Edit details for ${loan.name}`} onClick={()=>open(loan)}><span className="loan-kind">{loan.kind === 'house' ? 'Mortgage' : 'Car loan'}</span><h3><InstitutionIcon institutionKey={loan.institutionKey} debtType={loan.kind}/>{loan.name}</h3>
        <span>{approximate ? 'Payoff quote' : 'Remaining principal'}</span><strong className="loan-balance">{money.format(loan.remainingAmount)}</strong>
        <div className="loan-progress-track" role="progressbar" aria-label={`${loan.name} balance reduction percentage`} aria-valuenow={Number(progress.percent.toFixed(2))} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress.percent}%` }}/></div>
        <div className="loan-progress-caption"><strong>{approximate ? '≈ ' : ''}{progress.percent.toFixed(2)}% reduced</strong><span>Balance {progress.reduction >= 0 ? 'reduced' : 'increased'} {money.format(Math.abs(progress.reduction))}</span></div>
        </button><dl><div><dt><InfoTooltip label="Original loan">{"The original principal entered for this loan tracker. It is the comparison amount for loan progress."}</InfoTooltip></dt><dd>{money.format(loan.originalAmount)}</dd></div><div><dt>Monthly payment</dt><dd>{payment ? money.format(payment) : 'Add payment'}</dd></div><div><dt>Next payment due</dt><dd>{formatRecurringDueDate(loan.dueDate ?? '')}</dd></div></dl>
        {split && <dl className="loan-payment-split"><div><dt><InfoTooltip label="Next payment · principal">{"The portion of the regular payment estimated to reduce loan principal after interest and escrow."}</InfoTooltip></dt><dd>{money.format(split.principal)}</dd></div><div><dt><InfoTooltip label="Interest">{"The estimated interest portion of the next regular payment, calculated from the saved remaining principal and loan rate."}</InfoTooltip></dt><dd>{money.format(split.interest)}</dd></div><div><dt><InfoTooltip label="Escrow">{"The saved escrow portion of the regular payment. It does not reduce the loan principal."}</InfoTooltip></dt><dd>{money.format(split.escrow)}</dd></div></dl>}
        <button type="button" className="debt-activity-chevron" aria-label={`Activity for ${loan.name}`} onClick={()=>setActivityLoan(loan)}>›</button><div className="compact-debt-actions">{split && <button className="secondary" type="button" disabled={readOnly} onClick={() => { setError(''); setPaymentDraft({ loan, amount: payment!, extra: 0, date: householdDate() }); onDialog(true); }}><OutlineIcon name="card"/>Payment</button>}
        {!split && <button className="primary" type="button" disabled={readOnly || loan.remainingAmount<=0} onClick={() => {setError('');setPaymentDraft({loan,amount:payment??0,extra:0,date:householdDate()});onDialog(true);}}><OutlineIcon name="card"/>Payment</button>}
        <button className="secondary" type="button" disabled={readOnly} aria-label={`Update ${loan.name} loan`} onClick={() => open(loan)}><OutlineIcon name="receipt"/>Balance</button></div>
      </article>;
    })}</div></>}
    {activityLoan&&<div className="modal-backdrop account-activity-backdrop"><section className="modal account-activity-modal" role="dialog" aria-modal="true" aria-label={`Activity for ${activityLoan.name}`}><header><h2>{activityLoan.name}</h2><button type="button" aria-label="Close activity" onClick={()=>setActivityLoan(null)}>×</button></header><LoanActivityPanel expanded loan={activityLoan}/></section></div>}
    {!detailLoan && draft && <div className="modal-backdrop"><section className="modal loan-modal loan-details-modal" role="dialog" aria-modal="true" aria-labelledby="loan-dialog-title">{editor}</section></div>}
    {detailLoan && <DebtDetail name={detailLoan.name} tab={detailTab} onTab={tab => { if (tab === "Info" && detailTab !== "Info") { setDraft({...detailLoan, monthlyPayment:regularLoanPayment(detailLoan, items)}); setSourceLoan(detailLoan); setError(''); setFieldErrors({}); } requestLoanExit(tab); }} onBack={() => requestLoanExit("close")} overview={<DebtOverview history={loanForecastAssumptions(detailLoan).length > 0 ? <small>{loanForecastAssumptions(detailLoan).join(" ")}</small> : undefined} payoff={payoffMonth} name={detailLoan.name} balance={detailLoan.remainingAmount} starting={detailLoan.originalAmount} apr={detailLoan.apr} minimum={regularLoanPayment(detailLoan, items)} dueDate={nextDueDate(detailLoan.dueDate??'')} readOnly={readOnly} onPayment={() => { setError(''); setPaymentDraft({loan:detailLoan, amount:suggestedRegular, extra:suggestedExtra, date:householdDate()}); onDialog(true); }} onBalance={() => { setDraft({...detailLoan, monthlyPayment:regularLoanPayment(detailLoan, items)}); setSourceLoan(detailLoan); onDetailTab?.("Info"); }}/>} transactions={<><button type="button" className="primary" disabled={readOnly || detailLoan.remainingAmount <= 0} onClick={() => { setError(''); setPaymentDraft({loan:detailLoan, amount:suggestedRegular, extra:suggestedExtra, date:householdDate()}); onDialog(true); }}>Record Payment</button><LoanActivityPanel expanded allHistory loan={detailLoan}/></>} info={<div className="loan-detail-info"><fieldset disabled={readOnly}>{editor}</fieldset></div>}/>}
    {pendingLoanExit && <UnsavedChangesDialog subject="loan" onSave={() => loanForm.current?.requestSubmit()} onDiscard={() => { setDraft(baselineDraft); finishLoanExit(pendingLoanExit); }} onCancel={() => setPendingLoanExit(null)}/>}
    {advanced && draft && <ExperienceOverlay title="Advanced" onBack={() => setAdvanced(false)}><fieldset className="advanced-info-content" disabled={readOnly}><LoanDetailsFields mode="advanced" draft={draft} onChange={setDraft} errors={fieldErrors}/><DateCalendar label="Balance date" value={draft.asOf} max={householdDate()} onChange={date => setDraft({...draft, asOf:date})}/><p>{draft.budgetItemName}</p><button className="primary" type="button" onClick={() => setAdvanced(false)}>Done</button></fieldset></ExperienceOverlay>}
    {paymentDraft && <div className="modal-backdrop"><section className="modal loan-modal" role="dialog" aria-modal="true" aria-labelledby="loan-payment-title"><form onSubmit={event => {
      event.preventDefault();
      if (readOnly) return;
      try {
        if (JSON.stringify(loans.find(loan => loan.id === paymentDraft.loan.id)) !== JSON.stringify(paymentDraft.loan)) throw new Error("This loan changed while the form was open. Reopen it to review the latest balance.");
        const saved = recordLoanPayment(paymentDraft.loan, paymentDraft.amount, paymentDraft.date, paymentDraft.extra);
        onChange(loans.map(loan => loan.id === saved.id ? saved : loan)); setPaymentDraft(null); onDialog(false);
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to record payment.'); }
    }}><header className="back-form-header"><h2 id="loan-payment-title">Record {paymentDraft.loan.name} payment</h2><button type="button" data-dialog-close aria-label="Back from payment form" onClick={() => { setPaymentDraft(null); onDialog(false); }}>‹</button></header><div className="form-grid">
      <DateCalendar label="Payment date" value={paymentDraft.date} min={paymentDraft.loan.asOf} max={householdDate()} onChange={date => setPaymentDraft({ ...paymentDraft, date: date })}/>
      <label>Regular payment<input type="number" required min="0.01" step="0.01" value={paymentDraft.amount} onChange={e => setPaymentDraft({ ...paymentDraft, amount: Number(e.target.value) })}/></label>
      <label>Extra principal<input type="number" required min="0" step="0.01" value={paymentDraft.extra} onChange={e => setPaymentDraft({ ...paymentDraft, extra: Number(e.target.value) })}/></label>
      {paymentPreview && <div className="wide loan-payment-preview">{paymentDraft.loan.kind === "car" && loanForecastAssumptions(paymentDraft.loan).length > 0 && <p>{loanForecastAssumptions(paymentDraft.loan).join(" ")}</p>}<p>{loanForecastAssumptions(paymentDraft.loan).length ? "Estimated interest" : "Interest"}: {money.format(paymentPreview.interest)} · Escrow: {money.format(paymentPreview.escrow)}</p><p>Principal deducted: {money.format(paymentPreview.principal + paymentPreview.extraPrincipal)}</p><p>{loanForecastAssumptions(paymentDraft.loan).length ? "Estimated new balance" : "New balance"}: <strong>{money.format(paymentPreview.remainingAmount)}</strong></p><p>Total paid: {money.format(paymentPreview.total)}. This does not add another Budget expense.</p></div>}
      {error && <p className="wide form-error" role="alert">{error.replace(/\$0(?:\.00)?/g, symbol + "0")}</p>}
    </div><footer><button className="secondary" type="button" onClick={() => { setPaymentDraft(null); onDialog(false); }}>Cancel</button><button className="primary" type="submit" disabled={!paymentPreview}>Confirm payment</button></footer></form></section></div>}

  </section>;
}
