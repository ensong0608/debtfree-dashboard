import type { DebtAccount } from "./dashboard-data";
import type { PayoffPlan } from "./payoff-engine";
import { categoryBalances, categoryGradient, DEBT_CATEGORY_COLORS, payoffMilestones, trackedPayoffProgress } from "./debt-presentation";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function MobileCategorySummary({ accounts }: { accounts: DebtAccount[] }) {
  const categories = categoryBalances(accounts);
  return <div className="mobile-category-summary">
    <div className="category-donut" style={{ background: categoryGradient(accounts) }} role="img" aria-label={categories.length ? `Balance by category: ${categories.map(category => `${category.label} ${money.format(category.balance)}`).join(", ")}` : "No outstanding debt balance"}/>
    <ul className="category-legend">{categories.map(category => <li key={category.type} data-debt-category={category.key}><i aria-hidden="true"/><span>{category.label}</span></li>)}</ul>
  </div>;
}

export function MobileDebtProgress({ account }: { account: DebtAccount }) {
  const progress = trackedPayoffProgress(account);
  return <div className="mobile-debt-progress">{progress !== null ? <>
    <div className="category-progress-track" role="progressbar" aria-label={`${account.name} balance reduction since tracking began`} aria-valuenow={Number(progress.toFixed(1))} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }}/></div>
    <div><span>Since tracking began</span><strong>{progress.toFixed(1)}% paid down</strong></div>
  </> : <p>Starting balance not recorded</p>}</div>;
}

export function MobilePayoffTimeline({ accounts, plan, monthLabel }: { accounts: DebtAccount[]; plan: PayoffPlan; monthLabel: (offset: number) => string }) {
  const milestones = payoffMilestones(accounts, plan);
  if (!milestones.length) return null;
  return <section className="mobile-payoff-timeline" aria-labelledby="mobile-payoff-steps-title">
    <h2 id="mobile-payoff-steps-title">Step-by-step payoff plan</h2>
    <ol>{milestones.map(({ account, month, previousMonth }, index) => {
      const category = DEBT_CATEGORY_COLORS[account.type];
      // Show the final forecast month, with minimum/extra split from that same month.
      const paid = month.payments[account.id] ?? 0;
      const minimum = Math.min(paid, month.minimums[account.id] ?? 0);
      return <li key={account.id} data-debt-category={category.key}>
        <details open={index === 0}><summary><span className="payoff-step-number">{index + 1}</span><div><strong>{account.name} paid off</strong><small>Estimated {monthLabel(month.month - 1)}</small></div></summary>
          <div className="payoff-step-body"><div className="category-milestone"><span aria-hidden="true">✓</span><strong>{category.label} cleared</strong></div>
            <dl><div><dt>Balance entering payoff month</dt><dd>{money.format(previousMonth?.balances[account.id] ?? account.balance)}</dd></div><div><dt>Minimum payment</dt><dd>{money.format(minimum)}</dd></div><div><dt>Extra payment</dt><dd>{money.format(Math.max(0, paid - minimum))}</dd></div><div><dt>Total paid that month</dt><dd>{money.format(paid)}</dd></div></dl>
            <p>Estimate based on your current balances, rates, and selected plan. Freed payments follow that strategy.</p>
          </div>
        </details>
      </li>;
    })}</ol>
  </section>;
}
