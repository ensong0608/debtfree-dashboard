"use client";
import type { ReactNode } from 'react';
import type { DebtAccount } from './dashboard-data';
import InstitutionIcon from './institution-icon';
import OutlineIcon from './outline-icon';
import { useHouseholdCurrency } from './household-currency-context';
import { createHouseholdMoneyFormatter } from './household-currency';

/** Shared presentation only. Each caller retains its own history and save commands. */
export default function TransactionCard({ id, kind, date, title, account, accountName, amount, difference, description, amountHint, footer, readOnly, onEdit, editLabel }: {
  id: string; kind: string; date: string; title: string; account?: Pick<DebtAccount, 'institutionKey'> & {type: string};
  accountName: string; amount: number; difference: number; description?: ReactNode; amountHint?: string;
  footer?: ReactNode; readOnly?: boolean; onEdit?: () => void; editLabel?: string;
}) {
  const money = createHouseholdMoneyFormatter(useHouseholdCurrency());
  const content = <>
    <InstitutionIcon institutionKey={account?.institutionKey} debtType={account?.type ?? 'Debt account'} accountName={accountName}/>
    <span className="budget-record-name"><strong>{title}</strong><span>{accountName}</span>{description && <small>{description}</small>}</span>
    <span className="budget-record-amount"><strong className={difference < 0 ? 'decreases' : difference > 0 ? 'increases' : ''}>{difference < 0 ? '−' : difference > 0 ? '+' : ''}<span className="money-value">{money.format(amount)}</span></strong>{(amountHint || difference === 0) && <small>{amountHint ?? 'Already included'}</small>}</span>
    {onEdit && <OutlineIcon name="chevron"/>}
  </>;
  return <article className="budget-record-card" data-activity-id={id} data-kind={kind}>
    <time className="budget-record-date" dateTime={date}>{new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}</time>
    {onEdit ? <button type="button" className="budget-record-main" disabled={readOnly} aria-label={editLabel} onClick={onEdit}>{content}</button> : <div className="budget-record-main">{content}</div>}
    {footer && <footer>{footer}</footer>}
  </article>;
}
