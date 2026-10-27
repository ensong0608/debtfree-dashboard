import type { CashflowItem, DebtAccount, PayoffStrategy } from './dashboard-data.ts';
import { calculateMinimumPayoffPlan } from './payoff-calculator.ts';
import { forecastMonthKey, forecastMinimum, forecastMonthlyRate, round, PAYOFF_PLAN_MONTH_LIMIT } from './payoff-engine.ts';
import { forecastLoanApr, forecastLoanPrincipal, regularLoanPayment, type LoanTracker } from './loan-progress.ts';

export type ScheduleMonth = { month: string; paid: number; interest: number; remaining: number; paidOff: string[] };
/** Presentation only: minimums consume the existing account commitment. Fixed loan
 * payments stay separate; escrow is cash paid, never principal reduction or interest. */
export function buildPayoffSchedule(accounts: DebtAccount[], loans: LoanTracker[], items: CashflowItem[], amount: number, strategy: PayoffStrategy, date = new Date()) {
  const cards = calculateMinimumPayoffPlan(accounts, amount, strategy, [], date);
  const issues: string[] = cards.error ? [cards.error] : [];
  if (cards.plan?.stalled) issues.push('Increase the debt payment budget to reach a payoff date.');
  const activeLoans = loans.filter(loan => loan.remainingAmount > 0);
  const validLoans = activeLoans.flatMap(loan => {
    const balance = forecastLoanPrincipal(loan), apr = forecastLoanApr(loan);
    const payment = regularLoanPayment(loan, items), escrow = loan.kind === 'car' ? 0 : loan.escrow;
    if (balance === undefined || apr === undefined || escrow === undefined || payment === undefined || !Number.isFinite(payment) || payment <= 0 || apr < 0 || payment - escrow <= round(balance * apr / 1200)) {
      issues.push(`Review payment and principal terms for ${loan.name}.`); return [];
    }
    return [{ ...loan, apr, balance, payment, escrow }];
  });
  const rows: ScheduleMonth[] = [];
  const payoffMonths: Record<string, string> = {};
  const cardMonths = cards.plan?.months ?? [];
  for (let cycle = 1; cycle <= PAYOFF_PLAN_MONTH_LIMIT; cycle++) {
    const card = cardMonths[cycle - 1];
    if (!card && !validLoans.some(loan => loan.balance > 0)) break;
    let paid = card?.paid ?? 0, interest = card?.interest ?? 0;
    const paidOff = [...(card?.paidOff ?? [])];
    if (card) for (const account of accounts) {
      if ((card.payments[account.id] ?? 0) > 0 && (card.balances[account.id] ?? Infinity) <= 0) payoffMonths[`account:${account.id}`] = forecastMonthKey(cycle, date);
    }
    for (const loan of validLoans) {
      if (loan.balance <= 0) continue;
      const charge = round(loan.balance * loan.apr! / 1200);
      const principal = Math.min(loan.balance, round(loan.payment - loan.escrow - charge));
      loan.balance = round(loan.balance - principal);
      paid = round(paid + principal + charge + loan.escrow);
      interest = round(interest + charge);
      if (loan.balance === 0) { paidOff.push(loan.name); payoffMonths[`loan:${loan.id}`] = forecastMonthKey(cycle, date); }
    }
    const cardRemaining = card?.remaining ?? cardMonths.at(-1)?.remaining ?? accounts.filter(a => !a.archivedAt).reduce((sum, a) => sum + a.balance, 0);
    rows.push({ month: forecastMonthKey(cycle, date), paid: round(paid), interest: round(interest), remaining: round(cardRemaining + validLoans.reduce((sum, loan) => sum + loan.balance, 0)), paidOff });
  }
  if (validLoans.some(loan => loan.balance > 0)) issues.push('A loan exceeds the forecast limit.');
  const complete = !issues.length && (rows.at(-1)?.remaining ?? 0) === 0;
  return { rows, issues, complete, payoffMonths, debtFreeMonth: complete ? rows.at(-1)?.month ?? null : null, monthly: round(amount + activeLoans.reduce((sum, loan) => sum + (regularLoanPayment(loan, items) ?? 0), 0)), totalInterest: round(rows.reduce((sum, row) => sum + row.interest, 0)) };
}
export type PayoffSchedule = ReturnType<typeof buildPayoffSchedule>;

/** Selected debt types share the existing minimum-reserving engine; loan escrow stays outside principal. */
export function buildConfiguredPayoffSchedule(accounts:DebtAccount[],loans:LoanTracker[],items:CashflowItem[],extra:number,strategy:PayoffStrategy,date=new Date()) {
 // Current balances already include recorded activity; project full cycles from next month.
 date = new Date(forecastMonthKey(2,date)+'-01T12:00:00Z');
 const issues:string[]=[];
 let unforecastedBalance=0, unforecastedPayment=0;
 const cardInputs=accounts.filter(a=>!a.archivedAt&&a.balance>0).map(a=>({...a,id:'account:'+a.id}));
 const loanInputs=loans.filter(l=>l.remainingAmount>0).flatMap(l=>{
  const balance=forecastLoanPrincipal(l),apr=forecastLoanApr(l);
  const payment=regularLoanPayment(l,items),escrow=l.kind==='car'?0:l.escrow;
  if(balance===undefined||apr===undefined||escrow===undefined||payment===undefined||payment-escrow<=round(balance*apr/1200)) {unforecastedBalance=round(unforecastedBalance+l.remainingAmount);unforecastedPayment=round(unforecastedPayment+(payment??0));const reason=balance===undefined?'Enter a remaining principal balance.':apr===undefined?'Enter the loan APR.':escrow===undefined?'Enter the mortgage escrow amount.':payment===undefined?'Enter the regular payment amount.':'Increase the regular payment to cover interest and escrow.';issues.push(l.name+': '+reason);return [];}
  return [{id:'loan:'+l.id,name:l.name,type:'Other' as const,balance,apr,interestFee:0,minimum:round(payment-escrow),minimumMode:'manual' as const,payoffMode:'priority' as const,creditLimit:0,dueDate:'',promoEndDate:'',postPromoApr:0,postPromoMinimum:0,createdAt:date.toISOString(),escrow}];
 });
 const inputs=[...cardInputs,...loanInputs];
 const minimums=round(inputs.reduce((sum,a)=>sum+forecastMinimum(a,round(a.balance*(1+forecastMonthlyRate(a,1,date))),1,date),0));
 const result=calculateMinimumPayoffPlan(inputs,round(minimums+extra),strategy,[],date);
 if(result.error)issues.push(result.error);if(result.plan?.stalled)issues.push('Increase extra payment to reach a payoff date.');
 const payoffMonths:Record<string,string>={};
 const rows=(result.plan?.months??[]).map((month,i)=>{
  const before=i===0?null:result.plan!.months[i-1];
  const escrow=loanInputs.filter(l=>(before?.balances[l.id]??l.balance)>0).reduce((sum,l)=>sum+l.escrow,0);
  const key=forecastMonthKey(month.month,date);
  for(const a of inputs)if((month.payments[a.id]??0)>0&&(month.balances[a.id]??Infinity)<=0)payoffMonths[a.id]=key;
  return {month:key,paid:round(month.paid+escrow),interest:month.interest,remaining:round(month.remaining+unforecastedBalance),paidOff:month.paidOff};
 });
 if(!rows.length&&unforecastedBalance>0) rows.push({month:forecastMonthKey(1,date),paid:0,interest:0,remaining:unforecastedBalance,paidOff:[]});
 const complete=!issues.length&&(rows.at(-1)?.remaining??0)===0;
 const firstPayments:Record<string,number>={...result.plan?.months[0]?.payments};
 for(const loan of loanInputs) firstPayments[loan.id]=round((firstPayments[loan.id]??forecastMinimum(loan,round(loan.balance*(1+forecastMonthlyRate(loan,1,date))),1,date))+loan.escrow);
 return {rows,issues,complete,payoffMonths,firstPayments,debtFreeMonth:complete?rows.at(-1)?.month??null:null,monthly:round(minimums+extra+unforecastedPayment+loanInputs.reduce((n,l)=>n+l.escrow,0)),totalInterest:round(rows.reduce((n,r)=>n+r.interest,0))};
}
