"use client";
import NumericInput from "./numeric-input";
import { parseFinancialInput } from "./financial-input";
import InfoTooltip from "./info-tooltip";
import { useId, useMemo, useState } from 'react';
import type { DebtAccount } from './dashboard-data';
import { calculateMinimumPayoffPlan } from './payoff-calculator';
import { forecastMinimum, forecastMonthlyRate, forecastMonthKey, round } from './payoff-engine';
import { payoffPriority } from './debts-screen';
import { useHouseholdMoney } from './household-currency-context';
import { effectiveForecastApr } from './payoff-engine';
import styles from './quick-payoff-calculator.module.css';


export default function QuickPayoffCalculator({ accounts, onClose }: { accounts: DebtAccount[]; onClose?: () => void }) {
  const { moneyPrecise: money, symbol } = useHouseholdMoney();
  const [extraText, setExtraText] = useState('0');
  const [strategy, setStrategy] = useState<'avalanche' | 'snowball'>('avalanche');
  const [date] = useState(() => new Date());
  const inputId = useId();
  const active = useMemo(() => accounts.filter(account => !account.archivedAt && account.balance > 0), [accounts]);
  const extra = parseFinancialInput(extraText).value;
  const valid = Number.isFinite(extra) && extra >= 0 && Number.isSafeInteger(Math.round(extra * 100));
  const minimums = round(active.reduce((sum, account) => sum + forecastMinimum(account, account.balance * (1 + forecastMonthlyRate(account, 1, date)), 1, date), 0));
  const total = round(minimums + (valid ? extra : 0));
  const result = useMemo(() => valid ? calculateMinimumPayoffPlan(active, total, strategy, [], date) : { error: 'Enter a valid extra payment.', plan: null }, [active, total, strategy, date, valid]);
  const plan = result.plan;
  const belowMinimums = plan?.months.some(month => round(Object.values(month.minimums).reduce((sum, value) => sum + value, 0)) > total + 0.005);
  const error = result.error || (belowMinimums ? 'Increase extra to cover future minimum payments.' : plan?.monthLimitReached ? 'Payoff exceeds the calculation limit. Increase extra.' : plan?.stalled ? 'Increase extra to outpace interest.' : '');
  const monthLabel = (month: number) => new Date(forecastMonthKey(month, date) + '-01T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', year: 'numeric' });
  const ordered = payoffPriority(active.map(account => ({ ...account, payoffMode: 'priority' as const })), strategy, plan?.months[0]?.aprs);
  return <section className={styles.calculator} aria-labelledby={`${inputId}-title`}>
    <header><div><h2 id={`${inputId}-title`}>Quick Payoff Calculator</h2><p>Cards &amp; loan debts</p></div>{onClose && <button type="button" className={styles.close} aria-label="Close Quick Payoff Calculator" onClick={onClose}>×</button>}</header>
    {!active.length ? <p>No active card or other debt to calculate.</p> : <>
      <div className={styles.paymentRow}><span className="help-label"><InfoTooltip label="Extra Payment">{"This is added to the minimum payments, rather than replacing them. The calculator is a what-if estimate and does not change your saved plan or Budget."}</InfoTooltip></span>
      <div className={styles.amountInput}><span aria-hidden="true">{symbol}</span><NumericInput id={inputId} aria-label="Extra Payment" value={extra} onValueChange={(_, text) => setExtraText(text)} aria-describedby={`${inputId}-minimums`}/></div></div>
      <p id={`${inputId}-minimums`}>Minimums {money.format(minimums)} included. Total: {money.format(total)}.</p>
      <div className={styles.strategies} role="group" aria-label="Quick payoff strategy">{(['avalanche', 'snowball'] as const).map(value => <button key={value} type="button" aria-pressed={strategy === value} onClick={() => setStrategy(value)}>{value === 'avalanche' ? 'Avalanche' : 'Snowball'}</button>)}</div>
      {error ? <p role="status">{error}</p> : plan && <div aria-live="polite">
        <dl className={styles.metrics}><div><dt><InfoTooltip label="Estimated debt-free">{"The projected final payoff month using current balances, estimated or saved minimums, your extra payment and the selected strategy. House and car trackers stay separate."}</InfoTooltip></dt><dd>{monthLabel(plan.months.length)}</dd></div><div><dt><InfoTooltip label="Monthly total">{"First-month minimum payments plus the extra amount you entered. The total is held steady as paid-off debts free up money for the remaining debts."}</InfoTooltip></dt><dd>{money.format(total)}</dd></div><div><dt><InfoTooltip label="Estimated interest">{"Interest summed across the projected schedule, using saved APRs, any interest calibration and promotional changes. This does not record a charge."}</InfoTooltip></dt><dd>{money.format(plan.totalInterest)}</dd></div><div><dt><InfoTooltip label="Total paid">{"The sum of all projected payments, including principal and estimated interest. The final payment can be smaller than the monthly total."}</InfoTooltip></dt><dd>{money.format(round(plan.months.reduce((sum, month) => sum + month.paid, 0)))}</dd></div></dl>
        <ol className={styles.order} aria-label="Quick payoff order">{ordered.map(account => {
          const month = plan.months.find(month => (month.balances[account.id] ?? account.balance) <= 0.005);
          const apr = effectiveForecastApr(account, 1, date);
          return <li key={account.id}><div><span title={account.name}>{account.name}</span><small className={apr >= 24 ? styles.highApr : styles.apr}>{apr.toLocaleString("en-US", { maximumFractionDigits: 2 })}% APR</small></div><strong>{month ? monthLabel(month.month) : 'Increase extra'}</strong></li>;
        })}</ol>
        <section aria-label="Full payoff schedule"><h3 className={styles.scheduleTitle}>Full schedule <span>{plan.months.length} months</span></h3><div className={styles.schedule}><table><caption className="sr-only">Estimated payments and remaining balances</caption><thead><tr><th>Month</th><th>Paid</th><th>Interest</th><th>Remaining</th></tr></thead><tbody>{plan.months.map(month => <tr key={month.month}><th scope="row">{monthLabel(month.month)}</th><td>{money.format(month.paid)}</td><td>{money.format(month.interest)}</td><td>{money.format(month.remaining)}</td></tr>)}</tbody></table></div></section>
      </div>}
      <small>Local estimate. Your saved plan and Budget stay unchanged.</small>
    </>}
  </section>;
}
