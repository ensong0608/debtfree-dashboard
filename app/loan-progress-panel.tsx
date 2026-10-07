'use client';
import { useEffect, useState } from 'react';
import type { CashflowItem } from './dashboard-data';
import { linkedLoanPayment, loanProgress, type LoanTracker } from './loan-progress';
import { householdDate } from './interest-accrual';
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function LoanProgressPanel({ loans, items, onChange, onDialog }: {
  loans: LoanTracker[]; items: CashflowItem[]; onChange: (loans: LoanTracker[]) => void; onDialog: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<LoanTracker | null>(null);
  const expenses = items.filter(item => item.kind !== 'income');
  const close = () => { setDraft(null); onDialog(false); };
  useEffect(() => {
    if (!draft) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setDraft(null); onDialog(false); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [draft, onDialog]);
  const open = (loan?: LoanTracker) => {
    setDraft(loan ? { ...loan } : { id: crypto.randomUUID(), name: '', kind: 'house', originalAmount: 0, remainingAmount: 0, balanceKind: 'principal', asOf: householdDate(), budgetItemId: '', budgetItemName: '', history: [] });
    onDialog(true);
  };
  return <section className="loan-progress-section" aria-labelledby="loan-progress-title">
    <header><div><h2 id="loan-progress-title">House & car</h2><p>Loan progress · monthly payments linked to Budget</p></div><button className="secondary" type="button" onClick={() => open()}>+ Track loan</button></header>
    <div className="loan-progress-grid">{loans.map(loan => {
      const progress = loanProgress(loan), payment = linkedLoanPayment(loan, items), approximate = loan.balanceKind === 'payoff';
      return <article key={loan.id} className={`loan-progress-card loan-${loan.kind}`} aria-label={`${loan.name} loan progress`}>
        <span className="loan-kind">{loan.kind === 'house' ? 'House loan' : 'Car loan'}</span><h3>{loan.name}</h3>
        <span>{approximate ? 'Payoff quote' : 'Remaining principal'}</span><strong className="loan-balance">{money.format(loan.remainingAmount)}</strong>
        <div className="loan-progress-track" role="progressbar" aria-label={`${loan.name} loan paid down`} aria-valuenow={Number(progress.percent.toFixed(2))} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress.percent}%` }}/></div>
        <div className="loan-progress-caption"><strong>{approximate ? '≈ ' : ''}{progress.percent.toFixed(2)}% paid down</strong><span>{money.format(progress.reduction)} reduction</span></div>
        <dl><div><dt>Original loan</dt><dd>{money.format(loan.originalAmount)}</dd></div><div><dt>Monthly · Budget</dt><dd>{payment ? money.format(payment.amount) : 'Link a current bill'}</dd></div><div><dt>Balance as of</dt><dd>{loan.asOf}</dd></div></dl>
        {approximate && <p className="loan-quote-note">Progress uses a payoff quote, which may include accrued interest or fees.</p>}
        <button className="secondary" type="button" aria-label={`Update ${loan.name} loan`} onClick={() => open(loan)}>Update loan</button>
        <details><summary>Balance history</summary>{loan.history.slice().reverse().map((entry, index) => <p key={index}>{entry.date} · {money.format(entry.amount)} · {entry.balanceKind === 'payoff' ? 'Payoff quote' : 'Principal'}</p>)}</details>
      </article>;
    })}</div>
    <p className="loan-budget-note">Payments are already included in Budget. Update the lender balance here to track principal progress.</p>
    {draft && <div className="modal-backdrop"><section className="modal loan-modal" role="dialog" aria-modal="true" aria-labelledby="loan-dialog-title"><form onSubmit={event => {
      event.preventDefault();
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
        <label className="wide">Monthly payment from Budget<select required value={linkedLoanPayment(draft, items)?.id ?? ''} onChange={e => { const item = expenses.find(item => item.id === e.target.value); if (item) setDraft({ ...draft, budgetItemId: item.id, budgetItemName: item.name }); }}><option value="">Select budget bill</option>{expenses.map(item => <option value={item.id} key={item.id}>{item.name} · {money.format(item.amount)}</option>)}</select></label>
      </div><footer><button className="secondary" type="button" onClick={close}>Cancel</button><button className="primary" type="submit" disabled={!draft.name.trim()}>Save loan</button></footer>
    </form></section></div>}
  </section>;
}
