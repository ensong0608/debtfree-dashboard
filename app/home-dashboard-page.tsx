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

function paymentAction(model: HomeDashboardModel) {
  const focus = model.nextPayment;
  if (!model.activeDebtCount) return { title: "Add first debt", detail: "Add a balance, APR, and minimum payment to build your payoff plan." };
  if (model.stalled) return { title: "Increase your monthly payment", detail: "Your current target is not reducing every balance." };
  if (!focus) return { title: "Review your payoff plan", detail: "Complete the payment details needed to model the next month." };
  return {
    title: `Pay ${preciseMoney.format(focus.payment)} to ${focus.name}`,
    detail: focus.dueDate ? `Due by ${formatDate(focus.dueDate)}` : "Due date missing - add it for calendar guidance.",
  };
}

export default function HomeDashboardPage({
  model,
  onRecordPayment,
  onExtra,
  onAction,
  onViewPayments,
  onViewPlan,
  onViewDebts,
  onViewProgress,
  onViewMonthlyPlan,
}: {
  model: HomeDashboardModel;
  onRecordPayment: (accountId: string, amount: number) => void;
  onExtra: (value: number) => void;
  onAction: (action: HomeAction) => void;
  onViewPayments: () => void;
  onViewPlan: () => void;
  onViewDebts: () => void;
  onViewProgress: () => void;
  onViewMonthlyPlan: () => void;
}) {
  const focus = model.nextPayment;
  const recommendedAction = paymentAction(model);
  return <div className="screen home-screen">
    <div className="home-heading">
      <div><span className="eyebrow">Household payoff command center</span><h1>Here’s what to do next</h1><p>Your current balances, payment target, and payoff order in one place.</p></div>
      <button className="secondary home-monthly-link" type="button" onClick={onViewMonthlyPlan}>Review monthly plan</button>
    </div>

    <section className="home-summary" aria-labelledby="home-summary-title">
      <h2 className="sr-only" id="home-summary-title">Payoff summary</h2>
      <article className="home-debt-free"><span>Estimated debt-free date</span><strong>{formatMonth(model.debtFreeMonth)}</strong><small>{model.stalled ? "Increase the payment target to create a finish line" : `${model.strategy === "avalanche" ? "Avalanche" : model.strategy === "snowball" ? "Snowball" : "Custom"} strategy · ${preciseMoney.format(model.estimatedInterest)} projected interest`}</small></article>
      <article><span>Total remaining debt</span><strong>{preciseMoney.format(model.totalDebt)}</strong><small>{model.activeDebtCount} active {model.activeDebtCount === 1 ? "debt" : "debts"}</small></article>
      <article><span>Amount already paid off</span><strong>{preciseMoney.format(model.amountPaid)}</strong><small>{model.progressLabel}</small></article>
      <article className="home-progress-card"><div><span>Plan progress</span><strong>{model.progressPercent.toFixed(1)}%</strong></div><div className="home-progress-track" role="progressbar" aria-label="Debt payoff progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={model.progressPercent}><i style={{ width: `${model.progressPercent}%` }}/></div><small>{money.format(model.startingDebt)} starting debt</small></article>
      <article><span>Monthly debt target</span><strong>{preciseMoney.format(model.monthlyTarget)}</strong><small>Includes all minimum payments</small></article>
      <article className="home-extra-card"><label htmlFor="home-extra-payment">Extra above minimums</label><div className="home-extra-editor"><span>$</span><input id="home-extra-payment" type="number" min="0" step=".01" inputMode="decimal" value={model.extraPayment || ""} placeholder="0" aria-describedby="home-extra-help" onChange={(event) => onExtra(Math.max(0, Number(event.target.value) || 0))}/></div><small id="home-extra-help">Updates the Home target, Payoff Plan, and projections everywhere.</small></article>
      <article className="home-next-action"><span>Next recommended action</span><strong>{recommendedAction.title}</strong><small>{recommendedAction.detail}</small></article>
    </section>


    {model.stalled && model.activeDebtCount > 0 && <section className="home-plan-warning" role="alert" aria-labelledby="home-plan-warning-title"><div><span>Payment plan needs attention</span><h2 id="home-plan-warning-title">Your current payment target does not fully pay down the debt.</h2><p>{model.nonAmortizingDebtNames.length ? `${model.nonAmortizingDebtNames.join(", ")} ${model.nonAmortizingDebtNames.length === 1 ? "is" : "are"} not shrinking after interest or linked charges.` : "The modeled balances do not reach zero with the current payment settings."} Increase the extra payment or correct a missing minimum to create a workable finish line.</p></div><button className="primary" type="button" onClick={onViewPlan}>Adjust payoff plan</button></section>}
    <section className="home-primary-grid">
      <article className="next-payment-card">
        <div className="next-payment-label"><span>Next payment</span><i>Recommended action</i></div>
        {focus ? <>
          <h2>Pay {preciseMoney.format(focus.payment)} to {focus.name}{focus.dueDate ? ` by ${formatDate(focus.dueDate)}` : " - due date missing"}</h2>
          <div className="next-payment-breakdown">
            <div><span>Minimum payment</span><strong>{preciseMoney.format(focus.minimum)}</strong></div>
            <div><span>Above minimum</span><strong>{preciseMoney.format(focus.aboveMinimum)}</strong></div>
            <div><span>Effective APR</span><strong>{focus.apr.toFixed(2)}%</strong></div>
            <div><span>Estimated payoff</span><strong>{formatMonth(focus.projectedPayoffMonth)}</strong></div>
          </div>
          <p>Paying the recommended amount keeps your current projection on track. Record the amount you actually paid.</p>
          <button className="primary next-payment-button" type="button" onClick={() => onRecordPayment(focus.accountId, focus.payment)}>Record payment</button>
        </> : <div className="home-empty-action"><h2>{model.activeDebtCount ? "Adjust your payment plan" : "No debts in your plan yet"}</h2><p>{model.activeDebtCount ? "The engine cannot model a first payment with the current minimums and monthly target. Review those values to create an actionable recommendation." : "Debts power the payoff date, monthly target, and next-payment recommendation. Add the first balance you want to eliminate."}</p><button className="primary" type="button" onClick={model.activeDebtCount ? onViewPlan : onViewDebts}>{model.activeDebtCount ? "Review payoff plan" : "Add first debt"}</button></div>}
      </article>

      <article className="payoff-preview-card">
        <header><div><span>Payoff order preview</span><h2>Next three debts</h2></div><button type="button" onClick={onViewPlan}>View full payoff plan</button></header>
        {model.payoffOrder.length ? <ol>{model.payoffOrder.map((item, index) => <li key={item.accountId}><i>{index + 1}</i><div><strong>{item.name}</strong><small>{preciseMoney.format(item.balance)} balance · {item.apr.toFixed(2)}% APR</small></div><div><strong>{preciseMoney.format(item.payment)}</strong><small>{formatMonth(item.projectedPayoffMonth)}</small></div></li>)}</ol> : <div className="home-empty-compact"><strong>Payoff order shows where extra money goes first</strong><p>Add an active priority debt so the engine can build the queue.</p><button className="secondary" type="button" onClick={onViewDebts}>Add first debt</button></div>}
      </article>
    </section>

    <section className="home-payments-card" aria-label="Actual debt payments this month">
      <header><div><span>Actual payments</span><h2>{formatMonth(model.paymentMonth)}</h2></div><div><strong>{preciseMoney.format(model.actualPaymentTotal)}</strong><small>Recorded this month</small></div><button type="button" onClick={onViewPayments}>View all payments</button></header>
      {model.actualPayments.length ? <div className="home-payment-list">{model.actualPayments.slice(0, 6).map((payment) => <article key={payment.id}><div><strong>{payment.accountName}</strong><small>Paid {formatDate(payment.date)}</small></div><strong>{preciseMoney.format(payment.amount)}</strong></article>)}</div> : <div className="home-empty-compact"><strong>No payments recorded this month</strong><p>Use Record payment above and the actual amount will appear here immediately.</p></div>}
    </section>

    <section className="upcoming-actions-card">
      <header><div><span>Upcoming actions</span><h2>Keep the plan accurate</h2></div><button type="button" onClick={onViewProgress}>Open progress</button></header>
      {model.actions.length ? <div className="home-action-list">{model.actions.map((action) => <button className="home-action-item" type="button" key={action.id} onClick={() => onAction(action)}><ActionIcon action={action}/><div><strong>{action.title}</strong><small>{action.detail}</small></div>{action.date && <time dateTime={action.date}>{formatDate(action.date)}</time>}<span className="home-action-arrow" aria-hidden="true">→</span></button>)}</div> : <div className="home-empty-compact"><strong>{model.activeDebtCount ? "Nothing needs attention right now" : "Upcoming actions keep deadlines visible"}</strong><p>{model.activeDebtCount ? "Your due dates, promotional rates, and monthly review are current. Return after the next payment or balance update." : "Add a debt to see payment due dates, promotional APR expirations, and missing projection details here."}</p>{!model.activeDebtCount && <button className="secondary" type="button" onClick={onViewDebts}>Add first debt</button>}</div>}
    </section>
  </div>;
}
