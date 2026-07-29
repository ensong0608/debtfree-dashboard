"use client";

import { useEffect, useMemo, useState } from "react";

type PageId = "dashboard" | "accounts" | "history" | "plan" | "snapshots" | "utilization" | "stats" | "profile";
type DebtType = "Credit card" | "Personal loan" | "Auto loan" | "Student loan" | "Medical debt" | "Other";
type MinimumMode = "auto" | "manual";
type SortKey = "name" | "balance" | "apr" | "minimum" | "monthlyInterest" | "status" | "dueDate" | "payoff";
type SortDirection = "asc" | "desc";

type DebtAccount = {
  id: string;
  name: string;
  type: DebtType;
  balance: number;
  apr: number;
  minimum: number;
  minimumMode: MinimumMode;
  creditLimit: number;
  dueDate: string;
  createdAt: string;
};

type AccountDraft = Omit<DebtAccount, "id" | "createdAt">;
type PlanMonth = { month: number; interest: number; paid: number; remaining: number; focus: string; payments: Record<string, number>; paidOff: string[] };

const STORAGE_KEY = "debtfree-dashboard-prototype-v1";
const EMPTY_DRAFT: AccountDraft = { name: "", type: "Credit card", balance: 0, apr: 0, minimum: 0, minimumMode: "auto", creditLimit: 0, dueDate: "" };
const SAMPLE_ACCOUNTS: DebtAccount[] = [
  { id: "sample-1", name: "Everyday Rewards", type: "Credit card", balance: 3577.28, apr: 21.49, minimum: 0, minimumMode: "auto", creditLimit: 8500, dueDate: "2026-08-18", createdAt: "2026-07-01" },
  { id: "sample-2", name: "Freedom Card", type: "Credit card", balance: 5254.68, apr: 24.74, minimum: 0, minimumMode: "auto", creditLimit: 10000, dueDate: "2026-08-22", createdAt: "2026-07-01" },
  { id: "sample-3", name: "Warehouse Card", type: "Credit card", balance: 10684, apr: 23.74, minimum: 0, minimumMode: "auto", creditLimit: 14000, dueDate: "2026-08-27", createdAt: "2026-07-01" },
];
const DEBT_TYPES: DebtType[] = ["Credit card", "Personal loan", "Auto loan", "Student loan", "Medical debt", "Other"];
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const moneyPrecise = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = (value: string) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function estimatedMinimum(balance: number, apr: number) {
  if (balance <= 0) return 0;
  const monthlyInterest = balance * apr / 1200;
  return Math.min(round(balance + monthlyInterest), Math.max(25, round(balance * 0.01 + monthlyInterest)));
}
function effectiveMinimum(account: DebtAccount) {
  return account.balance <= 0 ? 0 : account.minimumMode === "auto" ? estimatedMinimum(account.balance, account.apr) : account.minimum;
}
function monthlyInterest(account: DebtAccount) {
  return round(account.balance * account.apr / 1200);
}
function formatDate(value: string) {
  if (!value) return "Not set";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function monthAfter(offset: number) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
function individualPayoffMonths(account: DebtAccount) {
  if (account.balance <= 0) return 0;
  const payment = effectiveMinimum(account);
  let balance = account.balance;
  for (let month = 1; month <= 1200; month++) {
    balance += balance * account.apr / 1200;
    balance -= Math.min(payment, balance);
    if (balance <= 0.005) return month;
  }
  return null;
}
function calculatePlan(accounts: DebtAccount[], extra: number) {
  const active = accounts.filter((account) => account.balance > 0);
  const balances = new Map(active.map((account) => [account.id, account.balance]));
  const monthly = active.reduce((sum, account) => sum + effectiveMinimum(account), 0) + extra;
  const months: PlanMonth[] = [];
  let totalInterest = 0;
  if (!active.length || monthly <= 0) return { months, totalInterest, monthly, stalled: false };
  for (let month = 1; month <= 1200; month++) {
    const before = new Map(balances);
    const payments: Record<string, number> = {};
    let interest = 0;
    active.forEach((account) => {
      const balance = balances.get(account.id) ?? 0;
      if (balance <= 0) return;
      const charge = balance * account.apr / 1200;
      balances.set(account.id, balance + charge);
      interest += charge;
    });
    totalInterest += interest;
    let available = monthly;
    active.forEach((account) => {
      const balance = balances.get(account.id) ?? 0;
      const payment = Math.min(effectiveMinimum(account), balance, available);
      if (payment > 0) {
        balances.set(account.id, balance - payment);
        payments[account.id] = payment;
        available -= payment;
      }
    });
    const priority = [...active].filter((account) => (balances.get(account.id) ?? 0) > 0.005).sort((a, b) => b.apr - a.apr || a.balance - b.balance);
    priority.forEach((account) => {
      const balance = balances.get(account.id) ?? 0;
      const payment = Math.min(balance, available);
      if (payment > 0) {
        balances.set(account.id, balance - payment);
        payments[account.id] = (payments[account.id] ?? 0) + payment;
        available -= payment;
      }
    });
    const remaining = [...balances.values()].reduce((sum, balance) => sum + balance, 0);
    const paidOff = active.filter((account) => (before.get(account.id) ?? 0) > 0 && (balances.get(account.id) ?? 0) <= 0.005).map((account) => account.name);
    months.push({ month, interest, paid: Object.values(payments).reduce((sum, payment) => sum + payment, 0), remaining, focus: priority[0]?.name ?? paidOff[0] ?? "Minimums", payments, paidOff });
    if (remaining <= 0.005) return { months, totalInterest, monthly, stalled: false };
    const focusId = priority[0]?.id;
    if (!paidOff.length && focusId && (balances.get(focusId) ?? 0) >= (before.get(focusId) ?? 0) - 0.005) return { months, totalInterest, monthly, stalled: true };
  }
  return { months, totalInterest, monthly, stalled: true };
}

const NAV_ITEMS: { id: PageId; label: string; icon: string; future?: boolean }[] = [
  { id: "dashboard", label: "Dashboard", icon: "⌂" },
  { id: "accounts", label: "Debt Accounts", icon: "▤" },
  { id: "history", label: "Payment History", icon: "↻", future: true },
  { id: "plan", label: "Payoff Plan", icon: "✓" },
  { id: "snapshots", label: "Payoff Snapshots", icon: "◉", future: true },
  { id: "utilization", label: "Credit Utilization", icon: "◔", future: true },
  { id: "stats", label: "Stats & Projections", icon: "↗", future: true },
  { id: "profile", label: "My Account", icon: "⚙" },
];

export default function Home() {
  const [page, setPage] = useState<PageId>("accounts");
  const [accounts, setAccounts] = useState<DebtAccount[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AccountDraft>(EMPTY_DRAFT);
  const [extra, setExtra] = useState(0);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as { accounts?: DebtAccount[]; extra?: number };
          if (Array.isArray(parsed.accounts)) setAccounts(parsed.accounts);
          if (Number.isFinite(parsed.extra)) setExtra(parsed.extra ?? 0);
        }
      } catch { /* A damaged prototype draft starts clean. */ }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accounts, extra }));
  }, [accounts, extra, loaded]);
  useEffect(() => {
    if (!modalOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setModalOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [modalOpen]);

  const totalBalance = useMemo(() => accounts.reduce((sum, account) => sum + account.balance, 0), [accounts]);
  const activeCount = useMemo(() => accounts.filter((account) => account.balance > 0).length, [accounts]);
  const minimums = useMemo(() => accounts.reduce((sum, account) => sum + effectiveMinimum(account), 0), [accounts]);
  const interest = useMemo(() => accounts.reduce((sum, account) => sum + monthlyInterest(account), 0), [accounts]);
  const plan = useMemo(() => calculatePlan(accounts, extra), [accounts, extra]);
  const paidOffById = useMemo(() => new Map(accounts.map((account) => {
    const month = plan.months.find((entry) => entry.paidOff.includes(account.name))?.month;
    return [account.id, month ?? individualPayoffMonths(account)];
  })), [accounts, plan.months]);
  const sortedAccounts = useMemo(() => [...accounts].sort((a, b) => {
    const values: Record<SortKey, [string | number, string | number]> = {
      name: [a.name.toLowerCase(), b.name.toLowerCase()],
      balance: [a.balance, b.balance],
      apr: [a.apr, b.apr],
      minimum: [effectiveMinimum(a), effectiveMinimum(b)],
      monthlyInterest: [monthlyInterest(a), monthlyInterest(b)],
      status: [a.balance > 0 ? "active" : "paid off", b.balance > 0 ? "active" : "paid off"],
      dueDate: [a.dueDate || "9999", b.dueDate || "9999"],
      payoff: [paidOffById.get(a.id) ?? 9999, paidOffById.get(b.id) ?? 9999],
    };
    const [first, second] = values[sortKey];
    const compared = typeof first === "number" && typeof second === "number" ? first - second : String(first).localeCompare(String(second));
    return sortDirection === "asc" ? compared : -compared;
  }), [accounts, paidOffById, sortDirection, sortKey]);

  const changeSort = (key: SortKey) => {
    if (key === sortKey) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDirection("asc"); }
  };
  const openNew = () => { setEditingId(null); setDraft(EMPTY_DRAFT); setModalOpen(true); };
  const openEdit = (account: DebtAccount) => {
    setEditingId(account.id);
    setDraft({ name: account.name, type: account.type, balance: account.balance, apr: account.apr, minimum: account.minimum, minimumMode: account.minimumMode, creditLimit: account.creditLimit, dueDate: account.dueDate });
    setModalOpen(true);
  };
  const saveAccount = () => {
    if (!draft.name.trim()) return;
    if (editingId) setAccounts((current) => current.map((account) => account.id === editingId ? { ...account, ...draft, name: draft.name.trim() } : account));
    else setAccounts((current) => [...current, { ...draft, id: `${Date.now()}-${Math.random()}`, name: draft.name.trim(), createdAt: new Date().toISOString() }]);
    setModalOpen(false);
  };
  const removeAccount = () => {
    if (!editingId) return;
    const account = accounts.find((item) => item.id === editingId);
    if (confirm(`Remove ${account?.name ?? "this account"} from DebtFree Dashboard?`)) {
      setAccounts((current) => current.filter((item) => item.id !== editingId));
      setModalOpen(false);
    }
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" type="button" onClick={() => setPage("dashboard")}><span>DF</span><div><strong>DebtFree</strong><small>Dashboard</small></div></button>
      <nav aria-label="Dashboard sections">{NAV_ITEMS.map((item) => <button type="button" key={item.id} className={page === item.id ? "nav-item active" : "nav-item"} onClick={() => setPage(item.id)}><i>{item.icon}</i><span>{item.label}</span>{item.future && <em>Soon</em>}</button>)}</nav>
      <div className="sidebar-foot"><span>Personal prototype</span><strong>Saved on this device</strong></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div><span className="mobile-product">DebtFree Dashboard</span><strong>{NAV_ITEMS.find((item) => item.id === page)?.label}</strong></div><div className="top-actions"><span className="save-state"><i/> Saved</span><button className="avatar" type="button" onClick={() => setPage("profile")} aria-label="Open My Account">LL</button></div></header>
      <div className="page-body">
        {page === "dashboard" && <DashboardPage accounts={accounts} activeCount={activeCount} totalBalance={totalBalance} minimums={minimums} interest={interest} plan={plan} onAdd={openNew} onAccounts={() => setPage("accounts")} onPlan={() => setPage("plan")}/>} 
        {page === "accounts" && <AccountsPage accounts={sortedAccounts} activeCount={activeCount} totalBalance={totalBalance} minimums={minimums} interest={interest} sortKey={sortKey} sortDirection={sortDirection} paidOffById={paidOffById} onSort={changeSort} onAdd={openNew} onEdit={openEdit} onSample={() => setAccounts(SAMPLE_ACCOUNTS)}/>} 
        {page === "plan" && <PayoffPlanPage accounts={accounts} plan={plan} extra={extra} onExtra={setExtra} onAccounts={() => setPage("accounts")}/>} 
        {page === "profile" && <ProfilePage/>}
        {(page === "history" || page === "snapshots" || page === "utilization" || page === "stats") && <FuturePage page={page}/>} 
      </div>
    </main>

    {modalOpen && <AccountModal draft={draft} editing={Boolean(editingId)} onChange={setDraft} onClose={() => setModalOpen(false)} onSave={saveAccount} onRemove={removeAccount}/>} 
  </div>;
}

function Metric({ label, value, detail, tone = "blue" }: { label: string; value: string; detail: string; tone?: string }) {
  return <article className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}
function DashboardPage({ accounts, activeCount, totalBalance, minimums, interest, plan, onAdd, onAccounts, onPlan }: { accounts: DebtAccount[]; activeCount: number; totalBalance: number; minimums: number; interest: number; plan: ReturnType<typeof calculatePlan>; onAdd: () => void; onAccounts: () => void; onPlan: () => void }) {
  return <div className="screen dashboard-screen">
    <div className="screen-title"><div><span className="eyebrow">Personal debt workspace</span><h1>Your financial command center</h1><p>See what you owe, what is due next, and where your payoff plan is headed.</p></div><button className="primary" type="button" onClick={onAdd}>+ Add new account</button></div>
    <section className="metrics"><Metric label="Active accounts" value={String(activeCount)} detail={`${accounts.length - activeCount} paid off`} tone="blue"/><Metric label="Total balance" value={money.format(totalBalance)} detail="Across all debt accounts" tone="navy"/><Metric label="Monthly minimums" value={money.format(minimums)} detail={`${money.format(interest)} est. monthly interest`} tone="mint"/><Metric label="Debt-free estimate" value={plan.months.length && !plan.stalled ? monthAfter(plan.months.length - 1) : "Not ready"} detail={plan.stalled ? "Increase payments" : `${plan.months.length || 0} months projected`} tone="violet"/></section>
    <section className="dashboard-grid"><article className="workspace-card"><div className="card-head"><div><span>Debt accounts</span><strong>Highest balances</strong></div><button type="button" onClick={onAccounts}>View all</button></div>{accounts.length ? <div className="account-preview">{[...accounts].sort((a,b) => b.balance-a.balance).slice(0,4).map((account) => <div key={account.id}><span className="account-mark">{account.name.slice(0,2).toUpperCase()}</span><div><strong>{account.name}</strong><small>{account.apr}% APR</small></div><b>{money.format(account.balance)}</b></div>)}</div> : <EmptyInline title="No accounts yet" text="Add your first debt account to start building a plan." action="Add account" onAction={onAdd}/>}</article><article className="workspace-card payoff-preview"><div className="card-head"><div><span>Payoff plan</span><strong>Avalanche estimate</strong></div><button type="button" onClick={onPlan}>Open plan</button></div>{plan.months.length && !plan.stalled ? <><div className="finish-ring"><div><span>Debt-free by</span><strong>{monthAfter(plan.months.length - 1)}</strong><small>{plan.months.length} months</small></div></div><div className="payoff-mini"><span>Monthly plan <b>{money.format(plan.monthly)}</b></span><span>Est. interest <b>{money.format(plan.totalInterest)}</b></span></div></> : <EmptyInline title="Your finish line is waiting" text="Add a workable minimum payment to calculate the payoff date." action="Review accounts" onAction={onAccounts}/>}</article></section>
  </div>;
}
function AccountsPage({ accounts, activeCount, totalBalance, minimums, interest, sortKey, sortDirection, paidOffById, onSort, onAdd, onEdit, onSample }: { accounts: DebtAccount[]; activeCount: number; totalBalance: number; minimums: number; interest: number; sortKey: SortKey; sortDirection: SortDirection; paidOffById: Map<string, number | null | undefined>; onSort: (key: SortKey) => void; onAdd: () => void; onEdit: (account: DebtAccount) => void; onSample: () => void }) {
  const headers: { key: SortKey; label: string }[] = [{ key: "name", label: "Account" }, { key: "balance", label: "Balance" }, { key: "apr", label: "APR %" }, { key: "minimum", label: "Min payment" }, { key: "monthlyInterest", label: "Monthly interest" }, { key: "status", label: "Status" }, { key: "dueDate", label: "Due date" }, { key: "payoff", label: "Paid off" }];
  return <div className="screen accounts-screen"><div className="screen-title"><div><span className="eyebrow">Account management</span><h1>Debt accounts</h1><p>Click any column heading to sort. Select an account name to edit its details.</p></div><button className="primary" type="button" onClick={onAdd}>+ Add new account</button></div><section className="compact-stats"><div><span>Active debt</span><strong>{activeCount}</strong></div><div><span>Total balance</span><strong>{money.format(totalBalance)}</strong></div><div><span>Minimums</span><strong>{money.format(minimums)}</strong></div><div><span>Monthly interest</span><strong>{money.format(interest)}</strong></div></section><section className="table-card"><div className="table-card-head"><div><span>Your debt accounts</span><strong>{accounts.length} {accounts.length === 1 ? "record" : "records"}</strong></div><span className="swipe-note">Swipe sideways to see every column</span></div>{accounts.length ? <div className="table-scroll"><table><caption>Sortable debt account list</caption><thead><tr>{headers.map((header) => <th key={header.key}><button type="button" onClick={() => onSort(header.key)}>{header.label}<i>{sortKey === header.key ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</i></button></th>)}</tr></thead><tbody>{accounts.map((account) => { const payoff = paidOffById.get(account.id); return <tr key={account.id}><td><button className="account-name" type="button" onClick={() => onEdit(account)}><span>{account.name.slice(0,2).toUpperCase()}</span><div><strong>{account.name}</strong><small>{account.type}</small></div></button></td><td className="number-cell"><strong>{moneyPrecise.format(account.balance)}</strong>{account.creditLimit > 0 && <small>{Math.round(account.balance/account.creditLimit*100)}% of limit</small>}</td><td className="number-cell">{account.apr.toFixed(2)}%</td><td className="number-cell"><strong>{moneyPrecise.format(effectiveMinimum(account))}</strong><small>{account.minimumMode === "auto" ? "Auto estimate" : "Manual"}</small></td><td className="number-cell">{moneyPrecise.format(monthlyInterest(account))}</td><td><span className={account.balance > 0 ? "status active" : "status paid"}>{account.balance > 0 ? "Active" : "Paid off"}</span></td><td><span className="date-cell"><i>□</i>{formatDate(account.dueDate)}</span></td><td>{account.balance <= 0 ? <strong className="paid-date">Complete</strong> : payoff ? <span>{monthAfter(payoff - 1)}</span> : <span className="needs">Needs adjustment</span>}</td></tr>; })}</tbody><tfoot><tr><td>Total</td><td className="number-cell">{moneyPrecise.format(totalBalance)}</td><td></td><td className="number-cell">{moneyPrecise.format(minimums)}</td><td className="number-cell">{moneyPrecise.format(interest)}</td><td colSpan={3}></td></tr></tfoot></table></div> : <div className="empty-table"><span>▤</span><h2>No debt accounts yet</h2><p>Add your first account, or load temporary sample records to explore the dashboard.</p><div><button className="primary" type="button" onClick={onAdd}>+ Add account</button><button className="secondary" type="button" onClick={onSample}>Load sample records</button></div></div>}</section></div>;
}
function PayoffPlanPage({ accounts, plan, extra, onExtra, onAccounts }: { accounts: DebtAccount[]; plan: ReturnType<typeof calculatePlan>; extra: number; onExtra: (value: number) => void; onAccounts: () => void }) {
  return <div className="screen plan-screen"><div className="screen-title"><div><span className="eyebrow">Avalanche strategy</span><h1>Payoff plan</h1><p>Minimums are paid first, then every extra dollar goes to the highest-APR balance.</p></div><label className="extra-control"><span>Extra each month</span><div><b>$</b><input type="number" min="0" inputMode="decimal" value={extra || ""} placeholder="0" onChange={(event) => onExtra(number(event.target.value))}/></div></label></div>{accounts.length && plan.months.length && !plan.stalled ? <><section className="plan-hero"><div><span>Projected debt-free date</span><strong>{monthAfter(plan.months.length - 1)}</strong><small>{plan.months.length} months from now</small></div><div><span>Monthly plan</span><strong>{money.format(plan.monthly)}</strong><small>Minimums + extra</small></div><div><span>Estimated interest</span><strong>{money.format(plan.totalInterest)}</strong><small>Monthly estimate</small></div></section><section className="table-card plan-table-card"><div className="table-card-head"><div><span>Month-by-month schedule</span><strong>{plan.months.length} rows</strong></div><span className="swipe-note">Complete plan, no cutoff</span></div><div className="table-scroll plan-scroll"><table><caption>Complete payoff plan</caption><thead><tr><th>Month</th><th>Focus</th>{accounts.map((account) => <th key={account.id}>{account.name}</th>)}<th>Interest</th><th>Total paid</th><th>Remaining</th><th>Milestone</th></tr></thead><tbody>{plan.months.map((month) => <tr key={month.month}><td>{monthAfter(month.month - 1)}</td><td>{month.focus}</td>{accounts.map((account) => <td className="number-cell" key={account.id}>{money.format(month.payments[account.id] ?? 0)}</td>)}<td className="number-cell">{money.format(month.interest)}</td><td className="number-cell"><strong>{money.format(month.paid)}</strong></td><td className="number-cell remaining">{money.format(month.remaining)}</td><td>{month.paidOff.length ? <span className="milestone">Paid off: {month.paidOff.join(", ")}</span> : "—"}</td></tr>)}</tbody></table></div></section></> : <section className="large-empty"><span>✓</span><h2>{plan.stalled ? "The current payments do not outpace interest" : "Add debt accounts to build your plan"}</h2><p>{plan.stalled ? "Increase a minimum payment or add an extra monthly amount to create a finish line." : "Once your accounts have balances, APRs, and minimums, the complete payoff schedule will appear here."}</p><button className="primary" type="button" onClick={onAccounts}>Review debt accounts</button></section>}</div>;
}
function ProfilePage() {
  return <div className="screen"><div className="screen-title"><div><span className="eyebrow">Workspace access</span><h1>My account</h1><p>This prototype is local-only. Account sign-in and household roles are planned for the shared version.</p></div></div><section className="profile-grid"><article className="profile-card"><div className="profile-avatar">LL</div><div><span>Prototype owner</span><strong>Personal workspace</strong><small>Data is currently saved only on this device.</small></div><button className="secondary" type="button" disabled>Sign-in coming later</button></article><article className="roles-card"><div className="card-head"><div><span>Future household access</span><strong>Roles we will support</strong></div></div><div className="role"><span>Admin</span><p>Can add, edit, remove, and record financial information.</p></div><div className="role"><span>Viewer</span><p>Can see the dashboard and payoff plan without changing anything.</p></div><div className="role"><span>Account owner</span><p>Can invite or remove members and manage workspace access.</p></div></article></section></div>;
}
function FuturePage({ page }: { page: PageId }) {
  const content: Record<string, { title: string; text: string; idea: string }> = {
    history: { title: "Payment history", text: "A chronological ledger of every payment recorded against each account.", idea: "Next: record payments, see principal versus interest, and correct or remove entries." },
    snapshots: { title: "Payoff snapshots", text: "A saved monthly picture of your total balance and progress.", idea: "Useful later for seeing how far you have come without changing the active plan." },
    utilization: { title: "Credit utilization", text: "The percentage of each credit limit currently being used.", idea: "Balance ÷ credit limit. This will apply only to revolving credit cards, not installment loans." },
    stats: { title: "Stats & projections", text: "Trends such as interest saved, balance change, and projected payoff scenarios.", idea: "This becomes valuable after several months of real payment history exist." },
  };
  const item = content[page] ?? content.history;
  return <div className="screen"><section className="large-empty future"><span>Coming later</span><h1>{item.title}</h1><p>{item.text}</p><div>{item.idea}</div></section></div>;
}
function EmptyInline({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) { return <div className="empty-inline"><strong>{title}</strong><p>{text}</p><button type="button" onClick={onAction}>{action}</button></div>; }
function AccountModal({ draft, editing, onChange, onClose, onSave, onRemove }: { draft: AccountDraft; editing: boolean; onChange: (draft: AccountDraft) => void; onClose: () => void; onSave: () => void; onRemove: () => void }) {
  const autoMinimum = estimatedMinimum(draft.balance, draft.apr);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title"><header><div><span>{editing ? "Edit debt account" : "New debt account"}</span><h2 id="account-modal-title">{editing ? draft.name || "Account details" : "Add a debt account"}</h2><p>Enter the current lender details. You can update them anytime.</p></div><button type="button" onClick={onClose} aria-label="Close account form">×</button></header><div className="form-grid"><label className="wide"><span>Name</span><input autoFocus value={draft.name} placeholder="Example: Everyday Rewards" onChange={(event) => onChange({ ...draft, name: event.target.value })}/></label><label><span>Debt type</span><select value={draft.type} onChange={(event) => onChange({ ...draft, type: event.target.value as DebtType })}>{DEBT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><Field label="Current balance" prefix="$" value={draft.balance} placeholder="0" onChange={(balance) => onChange({ ...draft, balance })}/><Field label="APR" suffix="%" value={draft.apr} placeholder="0.00" step=".01" onChange={(apr) => onChange({ ...draft, apr })}/><div className="minimum-editor"><div><span>Minimum payment</span><button type="button" className={draft.minimumMode === "auto" ? "mode active" : "mode"} onClick={() => onChange({ ...draft, minimumMode: draft.minimumMode === "auto" ? "manual" : "auto" })}>{draft.minimumMode === "auto" ? "Auto estimate" : "Use auto"}</button></div><Field prefix="$" value={draft.minimumMode === "auto" ? autoMinimum : draft.minimum} placeholder="0" disabled={draft.minimumMode === "auto"} onChange={(minimum) => onChange({ ...draft, minimum })}/><small>{draft.minimumMode === "auto" ? "1% of balance + monthly interest, with a $25 floor." : "Using your lender amount."}</small></div><Field label="Credit limit" prefix="$" value={draft.creditLimit} placeholder="Optional" onChange={(creditLimit) => onChange({ ...draft, creditLimit })}/><label><span>Next due date</span><input type="date" value={draft.dueDate} onChange={(event) => onChange({ ...draft, dueDate: event.target.value })}/></label></div><footer>{editing ? <button className="danger" type="button" onClick={onRemove}>Remove account</button> : <span/>}<div><button className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="button" disabled={!draft.name.trim()} onClick={onSave}>{editing ? "Save changes" : "Add account"}</button></div></footer></section></div>;
}
function Field({ label, prefix, suffix, value, placeholder, step, disabled, onChange }: { label?: string; prefix?: string; suffix?: string; value: number; placeholder: string; step?: string; disabled?: boolean; onChange: (value: number) => void }) { return <label>{label && <span>{label}</span>}<div className="field-input">{prefix && <b>{prefix}</b>}<input type="number" min="0" step={step} inputMode="decimal" disabled={disabled} value={value || ""} placeholder={placeholder} onChange={(event) => onChange(number(event.target.value))}/>{suffix && <b>{suffix}</b>}</div></label>; }