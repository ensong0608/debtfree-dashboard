'use client';
import LoanActivityPanel from "./loan-activity-panel";
import { useEffect, useState } from 'react';
import type { CashflowItem } from './dashboard-data';
import { linkedLoanPayment, loanProgress, loanPaymentSplit, recordLoanPayment, type LoanTracker } from './loan-progress';
import { householdDate } from './interest-accrual';
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function LoanProgressPanel({ loans, items, onChange, onDialog, readOnly = false }: {
  readOnly?: boolean; loans: LoanTracker[]; items: CashflowItem[]; onChange: (loans: LoanTracker[]) => void; onDialog: (open: boolean) => void;
}) {
  const [activityLoan,setActivityLoan]=useState<LoanTracker|null>(null);
  const [draft, setDraft] = useState<LoanTracker | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<{ loan: LoanTracker; amount: number; extra: number; date: string } | null>(null);
  const [error, setError] = useState('');
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
  const open = (loan?: LoanTracker) => {
    setDraft(loan ? { ...loan } : { id: crypto.randomUUID(), name: '', kind: 'house', originalAmount: 0, remainingAmount: 0, balanceKind: 'principal', asOf: householdDate(), budgetItemId: '', budgetItemName: '', history: [] });
    onDialog(true);
  };
  return <section className="loan-progress-section" aria-labelledby="loan-progress-title">
    <header><div><h2 id="loan-progress-title">House & car</h2><p>Loan progress · monthly payments linked to Budget</p></div><button className="secondary" type="button" onClick={() => open()} disabled={readOnly}>+ Track loan</button></header>
    <div className="loan-progress-grid">{loans.map(loan => {
      const progress = loanProgress(loan), payment = linkedLoanPayment(loan, items), approximate = loan.balanceKind === 'payoff';
      let split = null;
      try { if (payment) split = loanPaymentSplit(loan, payment.amount); } catch {}
      return <article key={loan.id} className={`loan-progress-card loan-${loan.kind}`} aria-label={`${loan.name} loan progress`}>
        <button type="button" className="compact-debt-edit" disabled={readOnly} aria-label={`Edit details for ${loan.name}`} onClick={()=>open(loan)}><span className="loan-kind">{loan.kind === 'house' ? 'House loan' : 'Car loan'}</span><h3>{loan.name}</h3>
        <span>{approximate ? 'Payoff quote' : 'Remaining principal'}</span><strong className="loan-balance">{money.format(loan.remainingAmount)}</strong>
        <div className="loan-progress-track" role="progressbar" aria-label={`${loan.name} loan paid down`} aria-valuenow={Number(progress.percent.toFixed(2))} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress.percent}%` }}/></div>
        <div className="loan-progress-caption"><strong>{approximate ? '≈ ' : ''}{progress.percent.toFixed(2)}% paid down</strong><span>{money.format(progress.reduction)} reduction</span></div>
        <dl><div><dt>Original loan</dt><dd>{money.format(loan.originalAmount)}</dd></div><div><dt>Monthly · Budget</dt><dd>{payment ? money.format(payment.amount) : 'Link a current bill'}</dd></div><div><dt>Balance as of</dt><dd>{loan.asOf}</dd></div></dl>
        {split && <dl className="loan-payment-split"><div><dt>Next payment · principal</dt><dd>{money.format(split.principal)}</dd></div><div><dt>Interest</dt><dd>{money.format(split.interest)}</dd></div><div><dt>Escrow</dt><dd>{money.format(split.escrow)}</dd></div></dl>}
        </button><button type="button" className="debt-activity-chevron" aria-label={`Activity for ${loan.name}`} onClick={()=>setActivityLoan(loan)}>›</button><div className="compact-debt-actions">{split && <button className="secondary" type="button" disabled={readOnly} onClick={() => { setError(''); setPaymentDraft({ loan, amount: payment!.amount, extra: 0, date: householdDate() }); onDialog(true); }}>Payment</button>}
        {!split && <button className="primary" type="button" disabled={readOnly || loan.remainingAmount<=0} onClick={() => {setError('');setPaymentDraft({loan,amount:payment?.amount??0,extra:0,date:householdDate()});onDialog(true);}}>Payment</button>}
        <button className="secondary" type="button" disabled={readOnly} aria-label={`Update ${loan.name} loan`} onClick={() => open(loan)}>Balance</button></div>
      </article>;
    })}</div>
    {activityLoan&&<div className="modal-backdrop"><section className="modal account-activity-modal" role="dialog" aria-modal="true" aria-label={`Activity for ${activityLoan.name}`}><header><h2>{activityLoan.name}</h2><button type="button" aria-label="Close activity" onClick={()=>setActivityLoan(null)}>×</button></header><LoanActivityPanel expanded loan={activityLoan}/></section></div>}
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
    {draft && <div className="modal-backdrop"><section className="modal loan-modal" role="dialog" aria-modal="true" aria-labelledby="loan-dialog-title"><form onSubmit={event => {
      event.preventDefault();
      if (readOnly) return;
      const existing = loans.find(loan => loan.id === draft.id);
      const changed = !existing || existing.remainingAmount !== draft.remainingAmount || existing.asOf !== draft.asOf || existing.balanceKind !== draft.balanceKind;
      const saved = { ...draft, name: draft.name.trim(), history: changed ? [...draft.history, { date: draft.asOf, amount: draft.remainingAmount, balanceKind: draft.balanceKind, recordedAt: new Date().toISOString() }] : draft.history };
      onChange(existing ? loans.map(loan => loan.id === saved.id ? saved : loan) : [...loans, saved]); close();
    }}><header><h2 id="loan-dialog-title">Loan progress</h2><button type="button" aria-label="Close loan form" onClick={close}>×</button></header>
      <div className="form-grid">
        <label className="wide">Loan name<input required maxLength={100} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label>
        <label>Loan category<select value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as LoanTracker['kind'] })}><option value="house">House</option><option value="car">Car</option></select></label>
        <label>Original loan amount<input type="number" required min="0.01" step="0.01" value={draft.originalAmount || ''} onChange={e => setDraft({ ...draft, originalAmount: Number(e.target.value) })}/></label>
        <label>Remaining amount<input type="number" required min="0" step="0.01" value={draft.remainingAmount} onChange={e => setDraft({ ...draft, remainingAmount: Number(e.target.value) })}/></label>
        <label>Balance type<select value={draft.balanceKind} onChange={e => setDraft({ ...draft, balanceKind: e.target.value as LoanTracker['balanceKind'] })}><option value="principal">Principal balance</option><option value="payoff">Payoff quote</option></select></label>
        <label>Balance date<input type="date" required max={householdDate()} value={draft.asOf} onChange={e => setDraft({ ...draft, asOf: e.target.value })}/></label>
        <label>Annual interest rate (%)<input type="number" min="0" max="100" step="0.001" value={draft.apr ?? ''} onChange={e => setDraft({ ...draft, apr: e.target.value === '' ? undefined : Number(e.target.value) })}/></label>
        <label>Monthly escrow<input type="number" min="0" step="0.01" value={draft.escrow ?? ''} onChange={e => setDraft({ ...draft, escrow: e.target.value === '' ? undefined : Number(e.target.value) })}/></label>
        {draft.kind === 'house' && <button className="secondary wide" type="button" onClick={() => setDraft({ ...draft, apr: 3.625, escrow: 618.37, principalAndInterest: 1592.53 })}>Use Pennymac terms · 3.625% APR · $618.37 escrow</button>}
        <label className="wide">Monthly payment from Budget<select required value={linkedLoanPayment(draft, items)?.id ?? ''} onChange={e => { const item = expenses.find(item => item.id === e.target.value); if (item) setDraft({ ...draft, budgetItemId: item.id, budgetItemName: item.name }); }}><option value="">Select budget bill</option>{expenses.map(item => <option value={item.id} key={item.id}>{item.name} · {money.format(item.amount)}</option>)}</select></label>
      </div><footer><button className="secondary" type="button" onClick={close}>Cancel</button><button className="primary" type="submit" disabled={!draft.name.trim()}>Save loan</button></footer>
    </form></section></div>}
  </section>;
}
