import type { DebtAccount, DebtAuditCreator } from './dashboard-data.ts';
import type { EntryState } from './debt-transactions.ts';
import { transactionAdjustedAccounts } from './progress-balances.ts';
import { createBalanceAdjustment, setDebtArchived } from './debts-screen.ts';
import { householdDate, reconcileInterest } from './interest-accrual.ts';

const editableKeys = ['name', 'apr', 'interestFee', 'minimum', 'minimumMode', 'creditLimit', 'dueDate', 'promoEndDate', 'postPromoApr', 'postPromoMinimum'] as const;
export type CreditCardDraft = Pick<DebtAccount, typeof editableKeys[number]> & {balance: number};
export type CardEditBaseline = {account: DebtAccount; balance: number};

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
  if (!draft.name.trim()) throw new Error('Enter an account name.');
  for (const key of ['balance', 'apr', 'interestFee', 'minimum', 'creditLimit', 'postPromoApr', 'postPromoMinimum'] as const) {
    const value = draft[key];
    if (value === (key === "balance" ? baseline.balance : baseline.account[key])) continue;
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100)) || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) throw new Error('Use non-negative amounts with up to two decimal places.');
  }
  const balanceChanged = draft.balance !== baseline.balance;
  const current = transactionAdjustedAccounts(state.accounts, state.transactions).find(item => item.id === id)!;
  if (balanceChanged && current.balance !== baseline.balance) throw new Error('The balance changed. Reopen the card before editing its balance.');
  const next = balanceChanged ? reconcileBalance(state, account, draft.balance, creator) : state;
  const changes = Object.fromEntries(editableKeys.map(key => [key, key === 'name' ? draft.name.trim() : draft[key]]));
  return {...next, accounts: next.accounts.map(item => item.id === id ? {...item, ...changes} : item)};
}

export function markCreditCardPaidOff(state: EntryState, id: string, creator?: DebtAuditCreator): EntryState {
  const account = state.accounts.find(item => item.id === id);
  if (!account || account.type !== 'Credit card' || account.archivedAt) throw new Error('This card is no longer active.');
  const next = reconcileBalance(state, account, 0, creator);
  return {...next, accounts: next.accounts.map(item => item.id === id ? setDebtArchived(item, true, new Date().toISOString(), creator) : item)};
}
