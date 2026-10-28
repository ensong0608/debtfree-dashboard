import type {DebtAccount, PayoffSnapshot} from './dashboard-data.ts';

/** Match the existing account overview; never infer a start from APR or ledger movement. */
export function displayedStartingBalance(account: DebtAccount, snapshots: PayoffSnapshot[] = []) {
  return account.baselineBalance ?? snapshots.flatMap(snapshot=>[...(Array.isArray(snapshot.revisions) ? snapshot.revisions as PayoffSnapshot[] : []),snapshot]).sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt))
    .flatMap(snapshot=>snapshot.accounts).find(saved=>saved.accountId===account.id)?.balance;
}

export function validatedStartingBalance(value: number) {
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value*100)) || Math.abs(value*100-Math.round(value*100))>0.000001) {
    throw new Error('Enter a starting balance of 0 or more, with up to two decimal places.');
  }
  return value;
}

/** An unchanged legacy display fallback must not become a stored baseline on an unrelated save. */
export function startingBalanceEdit(value: number | undefined, displayed: number | undefined) {
  return value === undefined || value === displayed ? undefined : validatedStartingBalance(value);
}
