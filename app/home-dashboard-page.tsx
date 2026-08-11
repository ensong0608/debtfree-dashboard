"use client";

import type { HomeAction, HomeDashboardModel } from "./home-dashboard";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const preciseMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatMonth(value: string | null) {
  if (!value) return "Needs adjustment";
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ActionIcon({ action }: { action: HomeAction }) {
  return <span className={`home-action-icon ${action.kind}`} aria-hidden="true">{action.kind === "due" ? "$" : action.kind === "promo" ? "%" : action.kind === "warning" ? "!" : "✓"}</span>;
}

export default function HomeDashboardPage({
  model,
  onRecordPayment,
  onViewPlan,
  onViewDebts,
  onViewProgress,
  onViewMonthlyPlan,
}: {
  model: HomeDashboardModel;
  onRecordPayment: (accountId: string, amount: number) => void;
  onViewPlan: () => void;
  onViewDebts: () => void;
  onViewProgress: () => void;
  onViewMonthlyPlan: () => void;
}) {
  const focus = model.nextPayment;
  return <div className="screen home-screen">
    <div className="home-heading">
      <div><span className="eyebrow">Household payoff command center</span><h1>Here’s what to do next</h1><p>Your current balances, payment target, and payoff order in one place.</p></div>
      <button className="secondary home-monthly-link" type="button" onClick={onViewMonthlyPlan}>Review monthly plan</button>
    </div>

    <section className="home-summary" aria-label="Payoff summary">
      <article className="home-debt-free"><span>Estimated debt-free date</span><strong>{formatMonth(model.debtFreeMonth)}</strong><small>{model.stalled ? "Increase the payment target to create a finish line" : `${model.strategy === "avalanche" ? "Avalanche" : "Snowball"} strategy · ${preciseMoney.format(model.estimatedInterest)} projected interest`}</small></article>
      <article><span>Total remaining debt</span><strong>{preciseMoney.format(model.totalDebt)}</strong><small>{model.activeDebtCount} active {model.activeDebtCount === 1 ? "debt" : "debts"}</small></article>
      <article><span>Amount already paid off</span><strong>{preciseMoney.format(model.amountPaid)}</strong><small>{model.progressLabel}</small></article>
      <article className="home-progress-card"><div><span>Plan progress</span><strong>{model.progressPercent.toFixed(1)}%</strong></div><div className="home-progress-track" role="progressbar" aria-label="Debt payoff progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={model.progressPercent}><i style={{ width: `${model.progressPercent}%` }}/></div><small>{money.format(model.startingDebt)} starting debt</small></article>
      <article><span>Monthly debt target</span><strong>{preciseMoney.format(model.monthlyTarget)}</strong><small>Includes all minimum payments</small></article>
      <article><span>Extra above minimums</span><strong>{preciseMoney.format(model.extraPayment)}</strong><small>Directed by your selected strategy</small></article>
    </section>

    <section className="home-primary-grid">
      <article className="next-payment-card">
        <div className="next-payment-label"><span>Next payment</span><i>Recommended action</i></div>
        {focus ? <>
          <h2>Pay {preciseMoney.format(focus.payment)} to {focus.name}{focus.dueDate ? ` by ${formatDate(focus.dueDate)}` : " this month"}</h2>
          <div className="next-payment-breakdown">
            <div><span>Minimum payment</span><strong>{preciseMoney.format(focus.minimum)}</strong></div>
            <div><span>Above minimum</span><strong>{preciseMoney.format(focus.aboveMinimum)}</strong></div>
            <div><span>Effective APR</span><strong>{focus.apr.toFixed(2)}%</strong></div>
            <div><span>Estimated payoff</span><strong>{formatMonth(focus.projectedPayoffMonth)}</strong></div>
          </div>
          <p>Paying the recommended amount keeps your current projection on track. Record the amount you actually paid.</p>
          <button className="primary next-payment-button" type="button" onClick={() => onRecordPayment(focus.accountId, focus.payment)}>Record payment</button>
        </> : <div className="home-empty-action"><h2>{model.activeDebtCount ? "Adjust your payment plan" : "Add your first debt"}</h2><p>{model.activeDebtCount ? "The current plan does not have a priority payment. Review minimums and the monthly target." : "Add balances, APRs, and minimum payments to receive a recommendation."}</p><button className="primary" type="button" onClick={model.activeDebtCount ? onViewPlan : onViewDebts}>{model.activeDebtCount ? "Review payoff plan" : "Add debt"}</button></div>}
      </article>

      <article className="payoff-preview-card">
        <header><div><span>Payoff order preview</span><strong>Next three debts</strong></div><button type="button" onClick={onViewPlan}>View full payoff plan</button></header>
        {model.payoffOrder.length ? <ol>{model.payoffOrder.map((item, index) => <li key={item.accountId}><i>{index + 1}</i><div><strong>{item.name}</strong><small>{preciseMoney.format(item.balance)} balance · {item.apr.toFixed(2)}% APR</small></div><div><strong>{preciseMoney.format(item.payment)}</strong><small>{formatMonth(item.projectedPayoffMonth)}</small></div></li>)}</ol> : <div className="home-empty-compact"><strong>No payoff order yet</strong><p>Add an active priority debt to build the queue.</p></div>}
      </article>
    </section>

    <section className="upcoming-actions-card">
      <header><div><span>Upcoming actions</span><strong>Keep the plan accurate</strong></div><button type="button" onClick={onViewProgress}>Open progress</button></header>
      {model.actions.length ? <div className="home-action-list">{model.actions.map((action) => <article key={action.id}><ActionIcon action={action}/><div><strong>{action.title}</strong><small>{action.detail}</small></div>{action.date && <time dateTime={action.date}>{formatDate(action.date)}</time>}</article>)}</div> : <div className="home-empty-compact"><strong>You’re all caught up</strong><p>No due dates, warnings, or monthly reviews need attention right now.</p></div>}
    </section>
  </div>;
}
