'use client';
import OutlineIcon from "./outline-icon";
import LoanActivityPanel from "./loan-activity-panel";
import { useEffect, useState } from 'react';
import type { CashflowItem } from './dashboard-data';
import { linkedLoanPayment, loanProgress, loanPaymentSplit, recordLoanPayment, type LoanTracker } from './loan-progress';
import { householdDate } from './interest-accrual';
import { loanEntryErrors, type LoanEntryField } from './loan-entry';
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function LoanProgressPanel({ loans, items, onChange, onDialog, initialDraft, editorOnly = false, readOnly = false }: {
  initialDraft?: LoanTracker; editorOnly?: boolean; readOnly?: boolean; loans: LoanTracker[]; items: CashflowItem[]; onChange: (loans: LoanTracker[]) => void; onDialog: (open: boolean) => void;
}) {
  const [activityLoan,setActivityLoan]=useState<LoanTracker|null>(null);
  const [draft, setDraft] = useState<LoanTracker | null>(initialDraft ?? null);
  const [paymentDraft, setPaymentDraft] = useState<{ loan: LoanTracker; amount: number; extra: number; date: string } | null>(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<LoanEntryField, string>>>({});
  const [sourceLoan, setSourceLoan] = useState<LoanTracker | null>(null);
  let paymentPreview = null;
  try { if (paymentDraft) paymentPreview = loanPaymentSplit(paymentDraft.loan, paymentDraft.amount, paymentDraft.extra); } catch {}
  const expenses = items.filter(item => item.kind !== 'income');
  const close = () => { setDraft(null); onDialog(false); };
  useEffect(() => {
    if (!draft && !paymentDraft) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setDraft(null); setPaymentDraft(null);setActivityLoan(null); onDialog(false); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [draft, paymentDraft, onDialog]);
  const open = (loan: LoanTracker) => {
    setError(''); setFieldErrors({}); setSourceLoan(loan);
    setDraft({ ...loan });
    onDialog(true);
  };
  return <section className="loan-progress-section" aria-labelledby={editorOnly ? undefined : "loan-progress-title"}>
    {!editorOnly && <><header><div><h2 id="loan-progress-title">House & car</h2><p>Loan progress · monthly payments linked to Budget</p></div></header>
    <div className="loan-progress-grid">{loans.map(loan => {
      const progress = loanProgress(loan), payment = linkedLoanPayment(loan, items), approximate = loan.balanceKind === 'payoff';
      let split = null;
      try { if (payment) split = loanPaymentSplit(loan, payment.amount); } catch {}
      return <article key={loan.id} className={`loan-progress-card loan-${loan.kind}`} aria-label={`${loan.name} loan progress`}>
        <button type="button" className="compact-debt-edit" disabled={readOnly} aria-label={`Edit details for ${loan.name}`} onClick={()=>open(loan)}><span className="loan-kind">{loan.kind === 'house' ? 'House loan' : 'Car loan'}</span><h3><span className="debt-name-icon"><OutlineIcon name={loan.kind === "house" ? "home" : "car"}/></span>{loan.name}</h3>
        <span>{approximate ? 'Payoff quote' : 'Remaining principal'}</span><strong className="loan-balance">{money.format(loan.remainingAmount)}</strong>
        <div className="loan-progress-track" role="progressbar" aria-label={`${loan.name} loan paid down`} aria-valuenow={Number(progress.percent.toFixed(2))} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress.percent}%` }}/></div>
        <div className="loan-progress-caption"><strong>{approximate ? '≈ ' : ''}{progress.percent.toFixed(2)}% paid down</strong><span>{money.format(progress.reduction)} reduction</span></div>
        <dl><div><dt>Original loan</dt><dd>{money.format(loan.originalAmount)}</dd></div><div><dt>Monthly · Budget</dt><dd>{payment ? money.format(payment.amount) : 'Link a current bill'}</dd></div><div><dt>Balance as of</dt><dd>{loan.asOf}</dd></div></dl>
        {split && <dl className="loan-payment-split"><div><dt>Next payment · principal</dt><dd>{money.format(split.principal)}</dd></div><div><dt>Interest</dt><dd>{money.format(split.interest)}</dd></div><div><dt>Escrow</dt><dd>{money.format(split.escrow)}</dd></div></dl>}
        </button><button type="button" className="debt-activity-chevron" aria-label={`Activity for ${loan.name}`} onClick={()=>setActivityLoan(loan)}>›</button><div className="compact-debt-actions">{split && <button className="secondary" type="button" disabled={readOnly} onClick={() => { setError(''); setPaymentDraft({ loan, amount: payment!.amount, extra: 0, date: householdDate() }); onDialog(true); }}><OutlineIcon name="card"/>Payment</button>}
        {!split && <button className="primary" type="button" disabled={readOnly || loan.remainingAmount<=0} onClick={() => {setError('');setPaymentDraft({loan,amount:payment?.amount??0,extra:0,date:householdDate()});onDialog(true);}}><OutlineIcon name="card"/>Payment</button>}
        <button className="secondary" type="button" disabled={readOnly} aria-label={`Update ${loan.name} loan`} onClick={() => open(loan)}><OutlineIcon name="receipt"/>Balance</button></div>
      </article>;
    })}</div></>}
    {activityLoan&&<div className="modal-backdrop account-activity-backdrop"><section className="modal account-activity-modal" role="dialog" aria-modal="true" aria-label={`Activity for ${activityLoan.name}`}><header><h2>{activityLoan.name}</h2><button type="button" aria-label="Close activity" onClick={()=>setActivityLoan(null)}>×</button></header><LoanActivityPanel expanded loan={activityLoan}/></section></div>}
    {paymentDraft && <div className="modal-backdrop"><section className="modal loan-modal" role="dialog" aria-modal="true" aria-labelledby="loan-payment-title"><form onSubmit={event => {
      event.preventDefault();
      if (readOnly) return;
      try {
        if (JSON.stringify(loans.find(loan => loan.id === paymentDraft.loan.id)) !== JSON.stringify(paymentDraft.loan)) throw new Error("This loan changed while the form was open. Reopen it to review the latest balance.");
        const saved = recordLoanPayment(paymentDraft.loan, paymentDraft.amount, paymentDraft.date, paymentDraft.extra);
        onChange(loans.map(loan => loan.id === saved.id ? saved : loan)); setPaymentDraft(null); onDialog(false);
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to record payment.'); }
    }}><header><h2 id="loan-payment-title">Record {paymentDraft.loan.name} payment</h2><button type="button" aria-label="Close payment form" onClick={() => { setPaymentDraft(null); onDialog(false); }}>×</button></header><div className="form-grid">
      <label>Payment date<input type="date" required min={paymentDraft.loan.asOf} max={householdDate()} value={paymentDraft.date} onChange={e => setPaymentDraft({ ...paymentDraft, date: e.target.value })}/></label>
      <label>Regular payment<input type="number" required min="0.01" step="0.01" value={paymentDraft.amount} onChange={e => setPaymentDraft({ ...paymentDraft, amount: Number(e.target.value) })}/></label>
      <label>Extra principal<input type="number" required min="0" step="0.01" value={paymentDraft.extra} onChange={e => setPaymentDraft({ ...paymentDraft, extra: Number(e.target.value) })}/></label>
      {paymentPreview && <div className="wide loan-payment-preview"><p>Interest: {money.format(paymentPreview.interest)} · Escrow: {money.format(paymentPreview.escrow)}</p><p>Principal deducted: {money.format(paymentPreview.principal + paymentPreview.extraPrincipal)}</p><p>New balance: <strong>{money.format(paymentPreview.remainingAmount)}</strong></p><p>Total paid: {money.format(paymentPreview.total)}. This does not add another Budget expense.</p></div>}
      {error && <p className="wide form-error" role="alert">{error}</p>}
    </div><footer><button className="secondary" type="button" onClick={() => { setPaymentDraft(null); onDialog(false); }}>Cancel</button><button className="primary" type="submit" disabled={!paymentPreview}>Confirm payment</button></footer></form></section></div>}
    {draft && <div className="modal-backdrop"><section className="modal loan-modal" role="dialog" aria-modal="true" aria-labelledby="loan-dialog-title"><form noValidate onSubmit={event => {
      event.preventDefault();
      if (readOnly) return;
      const errors = loanEntryErrors(draft);
      setFieldErrors(errors);
      const first = Object.keys(errors)[0];
      if (first) { (event.currentTarget.elements.namedItem(first) as HTMLElement | null)?.focus(); return; }
      const existing = loans.find(loan => loan.id === draft.id);
      if (sourceLoan && JSON.stringify(existing) !== JSON.stringify(sourceLoan)) { setError('This loan changed. Reopen it to review the latest balance.'); return; }
      const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
      const normalized = { ...draft, originalAmount: cents(draft.originalAmount), remainingAmount: cents(draft.remainingAmount), ...(draft.escrow === undefined ? {} : { escrow: cents(draft.escrow) }) };
      const changed = !existing || existing.remainingAmount !== draft.remainingAmount || existing.asOf !== draft.asOf || existing.balanceKind !== draft.balanceKind;
      const saved = { ...normalized, name: draft.name.trim(), history: changed ? [...draft.history, { date: draft.asOf, amount: normalized.remainingAmount, balanceKind: draft.balanceKind, recordedAt: new Date().toISOString() }] : draft.history };
      onChange(existing ? loans.map(loan => loan.id === saved.id ? saved : loan) : [...loans, saved]); close();
    }}><header><h2 id="loan-dialog-title">Loan progress</h2><button type="button" aria-label="Close loan form" onClick={close}>×</button></header>
      <div className="form-grid">
        <label className="wide">Loan name<input autoFocus name="name" aria-label="Loan name" aria-describedby={fieldErrors.name ? "loan-error-name" : undefined} aria-invalid={Boolean(fieldErrors.name)} required maxLength={100} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/>{fieldErrors.name && <small className="form-error" id="loan-error-name">{fieldErrors.name}</small>}</label>
        <label>Loan category<select value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as LoanTracker['kind'] })}><option value="house">House</option><option value="car">Car</option></select></label>
        <label>Original loan amount<input name="originalAmount" aria-label="Original loan amount" aria-describedby={fieldErrors.originalAmount ? "loan-error-originalAmount" : undefined} aria-invalid={Boolean(fieldErrors.originalAmount)} type="number" required min="0.01" step="0.01" value={draft.originalAmount || ''} onChange={e => setDraft({ ...draft, originalAmount: Number(e.target.value) })}/>{fieldErrors.originalAmount && <small className="form-error" id="loan-error-originalAmount">{fieldErrors.originalAmount}</small>}</label>
        <label>Remaining amount<input name="remainingAmount" aria-label="Remaining amount" aria-describedby={fieldErrors.remainingAmount ? "loan-error-remainingAmount" : undefined} aria-invalid={Boolean(fieldErrors.remainingAmount)} type="number" required min="0" step="0.01" value={Number.isFinite(draft.remainingAmount) ? draft.remainingAmount : ''} onChange={e => setDraft({ ...draft, remainingAmount: e.target.value === '' ? Number.NaN : Number(e.target.value) })}/>{fieldErrors.remainingAmount && <small className="form-error" id="loan-error-remainingAmount">{fieldErrors.remainingAmount}</small>}</label>
        <label>Balance type<select value={draft.balanceKind} onChange={e => setDraft({ ...draft, balanceKind: e.target.value as LoanTracker['balanceKind'] })}><option value="principal">Principal balance</option><option value="payoff">Payoff quote</option></select></label>
        <label>Balance date<input name="asOf" aria-label="Balance date" aria-describedby={fieldErrors.asOf ? "loan-error-asOf" : undefined} aria-invalid={Boolean(fieldErrors.asOf)} type="date" required max={householdDate()} value={draft.asOf} onChange={e => setDraft({ ...draft, asOf: e.target.value })}/>{fieldErrors.asOf && <small className="form-error" id="loan-error-asOf">{fieldErrors.asOf}</small>}</label>
        <label>Annual interest rate (%)<input name="apr" aria-label="Annual interest rate (%)" aria-describedby={fieldErrors.apr ? "loan-error-apr" : undefined} aria-invalid={Boolean(fieldErrors.apr)} type="number" min="0" max="100" step="0.001" value={draft.apr ?? ''} onChange={e => setDraft({ ...draft, apr: e.target.value === '' ? undefined : Number(e.target.value) })}/>{fieldErrors.apr && <small className="form-error" id="loan-error-apr">{fieldErrors.apr}</small>}</label>
        <label>Monthly escrow<input name="escrow" aria-label="Monthly escrow" aria-describedby={fieldErrors.escrow ? "loan-error-escrow" : undefined} aria-invalid={Boolean(fieldErrors.escrow)} type="number" min="0" step="0.01" value={draft.escrow ?? ''} onChange={e => setDraft({ ...draft, escrow: e.target.value === '' ? undefined : Number(e.target.value) })}/>{fieldErrors.escrow && <small className="form-error" id="loan-error-escrow">{fieldErrors.escrow}</small>}</label>

        <label className="wide">Monthly payment from Budget (optional)<select value={linkedLoanPayment(draft, items)?.id ?? ''} onChange={e => { const item = expenses.find(item => item.id === e.target.value); setDraft({ ...draft, budgetItemId: item?.id ?? '', budgetItemName: item?.name ?? '' }); }}><option value="">No Budget link</option>{expenses.map(item => <option value={item.id} key={item.id}>{item.name} · {money.format(item.amount)}</option>)}</select></label>
        {Object.keys(fieldErrors).length > 0 && <div className="wide form-error" role="alert">Check the highlighted fields.</div>}
        {error && <p className="wide form-error" role="alert">{error}</p>}
      </div><footer><button className="secondary" type="button" onClick={close}>Cancel</button><button className="primary" type="submit" disabled={readOnly}>Save loan</button></footer>
    </form></section></div>}
  </section>;
}
