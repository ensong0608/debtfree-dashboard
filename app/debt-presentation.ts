import type { DebtAccount, DebtType } from "./dashboard-data.ts";
import type { LoanTracker } from "./loan-progress.ts";
import type { PayoffPlan } from "./payoff-engine.ts";

export const DEBT_CATEGORY_COLORS: Record<DebtType, { key: string; color: string; label: string }> = {
  "Credit card": { key: "credit", color: "#e8b63b", label: "Credit card" },
  "Auto loan": { key: "auto", color: "#9473e4", label: "Auto loan" },
  "Medical debt": { key: "medical", color: "#e46e9f", label: "Medical debt" },
  "Student loan": { key: "student", color: "#42a88d", label: "Student loan" },
  "Personal loan": { key: "personal", color: "#5797d0", label: "Personal loan" },
  "Other": { key: "other", color: "#8493a5", label: "Other" },
};

export function categoryBalances(accounts: DebtAccount[], loans: LoanTracker[] = []) {
  const categories = (Object.keys(DEBT_CATEGORY_COLORS) as DebtType[]).map(type => ({
    type, ...DEBT_CATEGORY_COLORS[type],
    balance: accounts.filter(account => !account.archivedAt && account.type === type).reduce((sum, account) => sum + Math.max(0, account.balance), 0),
  }));
  for (const loan of loans) {
    if (loan.kind === "car") categories.find(category => category.type === "Auto loan")!.balance += Math.max(0, loan.remainingAmount);
  }
  return [...categories, { type: "House loan", key: "house", color: "#328575", label: "House loan", balance: loans.filter(loan => loan.kind === "house").reduce((sum, loan) => sum + Math.max(0, loan.remainingAmount), 0) }].filter(category => category.balance > 0);
}

export function categoryGradient(accounts: DebtAccount[], loans: LoanTracker[] = []) {
  const categories = categoryBalances(accounts, loans);
  const total = categories.reduce((sum, category) => sum + category.balance, 0);
  let position = 0;
  return total > 0 ? `conic-gradient(${categories.map(category => {
    const start = position;
    position += category.balance / total * 100;
    return `${category.color} ${start}% ${position}%`;
  }).join(", ")})` : "#e4e8ed";
}

// Baseline is the saved tracking start, not an inferred original loan amount.
export function trackedPayoffProgress(account: DebtAccount) {
  const baseline = account.baselineBalance;
  if (typeof baseline !== "number" || !Number.isFinite(baseline) || baseline <= 0) return null;
  return Math.min(100, Math.max(0, (baseline - account.balance) / baseline * 100));
}

export function payoffMilestones(accounts: DebtAccount[], plan: PayoffPlan) {
  if (plan.stalled) return [];
  return accounts.filter(account => !account.archivedAt && account.balance > 0).flatMap(account => {
    const index = plan.months.findIndex(month => month.balances[account.id] !== undefined && month.balances[account.id] <= 0.005);
    return index >= 0 ? [{ account, month: plan.months[index], previousMonth: plan.months[index - 1] }] : [];
  }).sort((a, b) => a.month.month - b.month.month || a.account.name.localeCompare(b.account.name));
}
