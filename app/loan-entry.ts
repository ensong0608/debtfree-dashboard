import { validOptionalInstitution } from './institutions.ts';
import { householdDate } from './household-date.ts';
import type { LoanTracker } from './loan-progress.ts';

export type LoanEntryField = 'principalBalance' | 'institutionKey' | 'name' | 'originalAmount' | 'remainingAmount' | 'asOf' | 'apr' | 'escrow' | 'kind' | 'monthlyPayment' | 'dueDate';
const money = (value: number) => Number.isFinite(value) && value >= 0 && Number.isSafeInteger(Math.round(value * 100));

export function loanEntryErrors(loan: LoanTracker, today = householdDate()): Partial<Record<LoanEntryField, string>> {
  const errors: Partial<Record<LoanEntryField, string>> = {};
  if (!validOptionalInstitution(loan.institutionKey)) errors.institutionKey = 'Choose an institution from the list.';
  if (!['house', 'car'].includes(loan.kind)) errors.kind = 'Choose a category.';
  if (!loan.name.trim()) errors.name = 'Enter a loan name.';
  if (!money(loan.originalAmount) || Math.round(loan.originalAmount * 100) <= 0) errors.originalAmount = 'Enter an original loan amount greater than $0.';
  if (!money(loan.remainingAmount)) errors.remainingAmount = 'Enter a remaining amount of $0 or more.';
  if (loan.principalBalance !== undefined && (!money(loan.principalBalance) || loan.principalBalance > loan.remainingAmount)) errors.principalBalance = 'Enter principal from $0 up to the current balance.';
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(loan.asOf) && Number.isFinite(Date.parse(loan.asOf + 'T12:00:00Z')) && new Date(loan.asOf + 'T12:00:00Z').toISOString().slice(0, 10) === loan.asOf;
  if (!validDate || loan.asOf < '2000-01-01' || loan.asOf > today) errors.asOf = 'Choose a valid balance date, today or earlier.';
  if (loan.apr === undefined || !Number.isFinite(loan.apr) || loan.apr < 0 || loan.apr > 100) errors.apr = 'Enter an APR from 0% to 100%.';
  if (loan.kind === 'house' && (loan.escrow === undefined || !money(loan.escrow))) errors.escrow = 'Enter escrow of $0 or more.';
  if (loan.monthlyPayment === undefined || !money(loan.monthlyPayment) || loan.monthlyPayment <= 0) errors.monthlyPayment = 'Enter a payment greater than $0.';
  if (loan.dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(loan.dueDate) || !Number.isFinite(Date.parse(loan.dueDate + 'T12:00:00Z')) || new Date(loan.dueDate + 'T12:00:00Z').toISOString().slice(0, 10) !== loan.dueDate || loan.dueDate < '2000-01-01')) errors.dueDate = 'Choose a valid payment date.';
  return errors;
}
