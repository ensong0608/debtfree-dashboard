import {linkedLoanPayment} from './loan-progress.ts';
import type { DashboardPayload, PayoffSnapshot } from './dashboard-data.ts';

const round = (n: number) => Math.round(n * 100) / 100;
/** Confirmed permanent deletion only. Paid-off archives use a separate, history-preserving path. */
export function permanentlyDeleteDebt(payload: DashboardPayload, id: string, kind: 'account' | 'loan' = 'account'): DashboardPayload {
  const plan = payload.monthlyPlan;
  const account = payload.accounts.find(a => a.id === id) ?? plan?.removedProgressAccounts?.find(a => a.id === id);
  const loan = plan?.loanTrackers?.find(a => a.id === id);
  if (kind === 'account' ? !account : !loan) throw new Error('Debt no longer exists.');
  const deletedTransactions = new Set(payload.transactions.filter(t => kind === 'account' && t.accountId === id).map(t => t.id));
  const deletedAdjustments = new Set((payload.balanceAdjustments ?? []).filter(a => kind === 'account' && a.accountId === id).map(a => a.id));
  const deletedBudgetIds=new Set<string>();
  if(kind==='loan'&&loan) for(const items of Object.values(payload.monthlyBudgets)){const linked=linkedLoanPayment(loan,items);if(linked&&!(plan?.loanTrackers??[]).some(other=>other.id!==id&&Object.values(payload.monthlyBudgets).some(entries=>linkedLoanPayment(other,entries)?.id===linked.id)))deletedBudgetIds.add(linked.id);}
  const deletedSettlementIds=new Set(Object.values(plan?.months??{}).flatMap(month=>month.settlements??[]).filter(entry=>entry.targetId===id||deletedBudgetIds.has(entry.targetId)).map(entry=>'settlement:'+entry.id));
  const targetKeys = new Set(kind === 'account' ? [id, `account:${id}`] : [id, `loan:${id}`]);
  const cleanSnapshot = (snapshot: PayoffSnapshot): PayoffSnapshot => {
    const removed = snapshot.accounts.filter(a => kind === 'account' && a.accountId === id);
    const accounts = snapshot.accounts.filter(a => kind !== 'account' || a.accountId !== id);
    const loanBalances = snapshot.loanBalances?.filter(a => kind !== 'loan' || a.loanId !== id);
    return { ...snapshot, accounts, ...(loanBalances ? {loanBalances} : {}),
      totalBalance: round(Math.max(0, snapshot.totalBalance - removed.reduce((sum,a) => sum + a.balance,0))),
      monthlyInterest: round(Math.max(0, snapshot.monthlyInterest - removed.reduce((sum,a) => sum + a.balance*a.apr/1200,0))),
      activeAccountCount: Math.max(0, snapshot.activeAccountCount - removed.filter(a => a.balance > 0).length),
      ...(removed.length ? {projectedDebtFreeMonth:null} : {}),
      ...(Array.isArray(snapshot.revisions) ? {revisions:snapshot.revisions.map(revision => cleanSnapshot(revision as PayoffSnapshot))} : {}),
    };
  };
  const snapshots = payload.snapshots.map(cleanSnapshot).filter(s => s.accounts.length || s.loanBalances?.length);
  // A debt created after the original observation never contributed to the fixed start.
  const firstSnapshot = payload.snapshots.flatMap(s => [...(Array.isArray(s.revisions) ? s.revisions as PayoffSnapshot[] : []), s]).sort((a,b) => a.capturedAt.localeCompare(b.capturedAt)).find(s => s.accounts.length);
  const originalEntry = firstSnapshot?.accounts.find(a => a.accountId === id);
  const baseline = kind === 'account' ? firstSnapshot ? originalEntry ? account?.baselineBalance ?? originalEntry.balance : 0 : account?.baselineBalance ?? account?.balance ?? 0 : 0;
  const cleanRecord = (values?: Record<string,number>) => values && Object.fromEntries(Object.entries(values).filter(([key]) => !targetKeys.has(key)));
  for(const budgetId of deletedBudgetIds){targetKeys.add(budgetId);targetKeys.add('spending:'+budgetId);}
  const cleanBudget = (items: DashboardPayload['monthlyBudgets'][string]) => items.filter(item=>!deletedBudgetIds.has(item.id)).map(item => kind === 'account' && item.creditAccountId === id ? {...item,paymentMethod:'debit' as const,creditAccountId:''} : item);
  return { ...payload,
    accounts: payload.accounts.filter(a => kind !== 'account' || a.id !== id),
    transactions: payload.transactions.filter(t => !deletedTransactions.has(t.id)),
    balanceAdjustments: (payload.balanceAdjustments ?? []).filter(a => !deletedAdjustments.has(a.id)),
    snapshots,
    customDebtOrder: payload.customDebtOrder?.filter(key => !targetKeys.has(key)),
    planning: {...payload.planning,debts:payload.planning.debts.filter(a => a.id !== id)},
    monthlyBudgets: Object.fromEntries(Object.entries(payload.monthlyBudgets).map(([month,items]) => [month,cleanBudget(items)])),
    ...(plan ? {monthlyPlan:{ ...plan,
      removedProgressAccounts:plan.removedProgressAccounts?.filter(a => kind !== 'account' || a.id !== id),
      loanTrackers:plan.loanTrackers?.filter(a => kind !== 'loan' || a.id !== id),
      payoffPlanOrder:plan.payoffPlanOrder?.filter(key => !targetKeys.has(key)),
      ...(plan.progressStartingBalance !== undefined && kind === 'account' ? {progressStartingBalance:round(Math.max(0,plan.progressStartingBalance-baseline))} : {}),
      dueReminderPaid:plan.dueReminderPaid?.filter(a => !targetKeys.has(a.id)),
      duePaymentAssociations:plan.duePaymentAssociations?.filter(a => !targetKeys.has(a.reminderId) && !(a.source.type === 'transaction' && deletedTransactions.has(a.source.id)) && !(a.source.type === 'adjustment' && deletedAdjustments.has(a.source.id)) && !deletedSettlementIds.has(a.source.id) && !(kind==='loan' && a.source.type==='loan-history' && a.source.id.startsWith(id+':'))),
      months:Object.fromEntries(Object.entries(plan.months).map(([month,values]) => [month,{...values,
        ...Object.fromEntries(['minimumPaid','minimumTargets'].filter(key=>values[key]&&typeof values[key]==='object').map(key=>[key,cleanRecord(values[key] as Record<string,number>)])),
        ...(values.skippedRecurringPayments?{skippedRecurringPayments:values.skippedRecurringPayments.filter(key=>!targetKeys.has(key))}:{}),
        ...(values.payments ? {payments:cleanRecord(values.payments)} : {}),
        ...(values.minimums ? {minimums:cleanRecord(values.minimums)} : {}),
        ...(values.settlements ? {settlements:values.settlements.filter(a => !targetKeys.has(a.targetId))} : {}),
      }])),
    }} : {}),
  };
}
