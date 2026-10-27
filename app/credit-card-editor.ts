import { validOptionalInstitution } from './institutions.ts';
import type { DebtAccount, DebtAuditCreator } from './dashboard-data.ts';
import type { EntryState } from './debt-transactions.ts';
import { transactionAdjustedAccounts } from './progress-balances.ts';
import { createBalanceAdjustment, setDebtArchived } from './debts-screen.ts';
import { householdDate, reconcileInterest, interestSettingsError } from './interest-accrual.ts';
import {startingBalanceEdit} from './debt-starting-balance.ts';

const editableKeys = ['institutionKey', 'displayGroup', 'name', 'apr', 'interestFee', 'minimum', 'minimumMode', 'creditLimit', 'dueDate', 'promoEndDate', 'postPromoApr', 'postPromoMinimum'] as const;
export type CreditCardDraft = Pick<DebtAccount, typeof editableKeys[number] | 'interestAutomation'> & {balance: number; baselineBalance?: number; displayPosition?: number};
export type CardEditBaseline = {account: DebtAccount; balance: number; startingBalance?: number};

function reconcileBalance(state: EntryState, account: DebtAccount, balance: number, creator?: DebtAuditCreator): EntryState {
  const current = transactionAdjustedAccounts(state.accounts, state.transactions).find(item => item.id === account.id)!;
  if (balance === current.balance) return state;
  const date = householdDate();
  const checked = reconcileInterest(account, state.transactions, date);
  const result = createBalanceAdjustment({storedAccount: checked.account, currentBalance: current.balance, nextBalance: balance, date, transactions: checked.transactions, note: 'Balance updated from card details', creator});
  return {accounts: state.accounts.map(item => item.id === account.id ? {...result.account, balanceAsOf: date} : item), transactions: checked.transactions, adjustments: [...state.adjustments, result.adjustment]};
}

/** Commit card metadata and an optional reconciliation together; never invent a payment. */
export function saveCreditCardDetails(state: EntryState, id: string, draft: CreditCardDraft, baseline: CardEditBaseline, creator?: DebtAuditCreator): EntryState {
  const account = state.accounts.find(item => item.id === id);
  if (!account || account.type !== 'Credit card' || account.archivedAt) throw new Error('This card is no longer active. Reopen Debts.');
  if (editableKeys.some(key => account[key] !== baseline.account[key])) throw new Error('Card details changed. Reopen the card before saving.');
  if (!validOptionalInstitution(draft.institutionKey)) throw new Error('Choose an institution from the list.');
  if (!draft.name.trim()) throw new Error('Enter an account name.');
  const startingBalance=startingBalanceEdit(draft.baselineBalance,baseline.startingBalance ?? baseline.account.baselineBalance);
  if (startingBalance !== undefined && account.baselineBalance !== baseline.account.baselineBalance) throw new Error('Starting balance changed. Reopen the card before saving.');
  for (const key of ['balance', 'apr', 'interestFee', 'minimum', 'creditLimit', 'postPromoApr', 'postPromoMinimum'] as const) {
    const value = draft[key];
    if (value === (key === "balance" ? baseline.balance : baseline.account[key])) continue;
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100)) || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) throw new Error('Use non-negative amounts with up to two decimal places.');
  }
  const balanceChanged = draft.balance !== baseline.balance;
  const interestChanged = draft.interestAutomation !== undefined && JSON.stringify(draft.interestAutomation) !== JSON.stringify(baseline.account.interestAutomation);
  if (interestChanged) {
    if (JSON.stringify(account.interestAutomation) !== JSON.stringify(baseline.account.interestAutomation)) throw new Error('Interest settings changed. Reopen the card before saving.');
    const error = interestSettingsError(draft.interestAutomation!);
    if (error) throw new Error(error);
    if (balanceChanged) throw new Error('Save interest settings and balance changes separately.');
  }
  const current = transactionAdjustedAccounts(state.accounts, state.transactions).find(item => item.id === id)!;
  if (balanceChanged && current.balance !== baseline.balance) throw new Error('The balance changed. Reopen the card before editing its balance.');
  const next = balanceChanged ? reconcileBalance(state, account, draft.balance, creator) : state;
  const changes = Object.fromEntries(editableKeys.map(key => [key, key === 'name' ? draft.name.trim() : key === 'displayGroup' ? draft.displayGroup ?? baseline.account.displayGroup : draft[key]]));
  return {...next, accounts: next.accounts.map(item => item.id === id ? {...item, ...changes, ...(interestChanged ? {interestAutomation:draft.interestAutomation} : {}), ...(startingBalance !== undefined ? {baselineBalance:startingBalance} : {})} : item)};
}

export function markCreditCardPaidOff(state: EntryState, id: string, creator?: DebtAuditCreator): EntryState {
  const account = state.accounts.find(item => item.id === id);
  if (!account || account.type !== 'Credit card' || account.archivedAt) throw new Error('This card is no longer active.');
  const next = reconcileBalance(state, account, 0, creator);
  return {...next, accounts: next.accounts.map(item => item.id === id ? setDebtArchived(item, true, new Date().toISOString(), creator) : item)};
}
