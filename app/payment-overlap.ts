import type { BalanceAdjustment, LedgerTransaction } from './dashboard-data.ts';
import { round } from './payoff-engine.ts';
export type PaymentLink = { type: 'adjustment' | 'transaction'; id: string };
export function postedMovement(transaction: LedgerTransaction) {
  return transaction.deletedAt || transaction.includedIn ? 0 : round(transaction.amount * (transaction.type === 'payment' ? -1 : 1));
}
export function paymentOverlaps(transactions: LedgerTransaction[], adjustments: BalanceAdjustment[], accountId: string, amount: number, date: string) {
  if (!(amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const nearby = (day: string) => Math.abs(Date.parse(day) - Date.parse(date)) <= 7 * 86400000;
  return [
    ...adjustments.filter(a => !a.deletedAt && a.reportKind !== "credit" && a.accountId === accountId && a.difference < 0 && nearby(a.date)).map(a => {
      const attributed = transactions.filter(t => !t.deletedAt && t.includedIn?.type === 'adjustment' && t.includedIn.id === a.id).reduce((sum,t) => sum + t.amount, 0);
      return { link: {type:'adjustment' as const,id:a.id}, date:a.date, title:a.title || 'Balance update', difference:a.difference, remaining: a.confirmedPayment ? 0 : round(-a.difference - attributed), canLink: !a.confirmedPayment };
    }),
    ...transactions.filter(t => !t.deletedAt && !t.credit && t.type === 'payment' && t.accountId === accountId && round(t.amount) === round(amount) && nearby(t.date)).map(t => ({link:{type:'transaction' as const,id:t.id}, date:t.date,title:t.title || 'Recorded payment',difference:-t.amount,remaining:0,canLink:true})),
  ].sort((a,b) => b.date.localeCompare(a.date));
}
export function validatePaymentLinks(transactions: LedgerTransaction[], adjustments: BalanceAdjustment[]) {
  for (const t of transactions.filter(t => !t.deletedAt && t.includedIn)) {
    const link=t.includedIn!;
    const visited=new Set([t.id]);let ancestor=t;
    while(ancestor.includedIn?.type==='transaction'){const id=ancestor.includedIn.id;if(visited.has(id))throw new Error('Payment links cannot form a cycle.');visited.add(id);const parent=transactions.find(p=>p.id===id);if(!parent)break;ancestor=parent;}
    if (t.type !== 'payment' || t.credit) throw new Error('Only a payment can be linked.');
    const source = link.type === 'adjustment' ? adjustments.find(a=>a.id===link.id) : transactions.find(a=>a.id===link.id);
    if (!source || source.deletedAt || source.accountId !== t.accountId) throw new Error('The linked record is unavailable for this account.');
    if (link.type === 'transaction') {
      const payment=source as LedgerTransaction;
      if (payment.type !== 'payment' || payment.credit) throw new Error('The original payment changed. Review its linked records first.');
    } else {
      const adjustment=source as BalanceAdjustment;
      if (adjustment.reportKind === "credit") throw new Error("This balance update is a refund or credit. Review its linked payments first.");
      if (adjustment.confirmedPayment) throw new Error('This balance update already has a full payment classification. Keep its existing classification or the linked payments.');
    }
  }
}
