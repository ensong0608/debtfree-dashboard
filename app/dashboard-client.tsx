"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChatGPTUser } from "./chatgpt-auth";

type PageId = "dashboard" | "accounts" | "history" | "plan" | "snapshots" | "utilization" | "stats" | "profile";
type DebtType = "Credit card" | "Personal loan" | "Auto loan" | "Student loan" | "Medical debt" | "Other";
type MinimumMode = "auto" | "manual";
type PayoffMode = "priority" | "minimum-only";
type PayoffStrategy = "avalanche" | "snowball";
type CashflowKind = "income" | "expense" | "budget";
type PaymentMethod = "debit" | "credit";
type SortKey = "name" | "balance" | "creditLimit" | "apr" | "minimum" | "monthlyInterest" | "status" | "dueDate" | "payoff";
type SortDirection = "asc" | "desc";

type DebtAccount = {
  id: string;
  name: string;
  type: DebtType;
  balance: number;
  apr: number;
  interestFee: number;
  minimum: number;
  minimumMode: MinimumMode;
  payoffMode: PayoffMode;
  creditLimit: number;
  dueDate: string;
  createdAt: string;
};

type AccountDraft = Omit<DebtAccount, "id" | "createdAt">;
type CashflowItem = {
  id: string;
  name: string;
  kind: CashflowKind;
  category: string;
  amount: number;
  paymentMethod: PaymentMethod;
  creditAccountId: string;
  createdAt: string;
};
type CashflowDraft = Omit<CashflowItem, "id" | "createdAt">;
type PlanMonth = { month: number; interest: number; paid: number; remaining: number; payments: Record<string, number>; balances: Record<string, number>; paidOff: string[] };
type LinkedCardExpenses = Record<string, number>;
type LinkedCardExpenseItems = Record<string, CashflowItem[]>;
type DashboardPayload = { accounts: DebtAccount[]; cashflowItems: CashflowItem[]; extra: number; strategy: PayoffStrategy };
type CloudStatus = "connecting" | "saving" | "synced" | "error";
type HouseholdMember = { email: string; display_name: string | null; role: "owner" | "admin"; status: "active" | "invited" };
type HouseholdResponse = { householdName: string; role: "owner" | "admin"; payload: DashboardPayload | null; revision: number; members: HouseholdMember[] };

function normalizedPayload(value: unknown): DashboardPayload {
  const parsed = value && typeof value === "object" ? value as Partial<DashboardPayload> : {};
  const accounts = Array.isArray(parsed.accounts) ? parsed.accounts.map((account) => ({
    ...account,
    interestFee: Number.isFinite(account.interestFee) ? account.interestFee : 0,
    payoffMode: account.payoffMode === "minimum-only" ? "minimum-only" as const : "priority" as const,
  })) : [];
  const cashflowItems = Array.isArray(parsed.cashflowItems) ? parsed.cashflowItems.map((item) => ({
    ...item,
    paymentMethod: item.kind === "expense" && item.paymentMethod === "credit" ? "credit" as const : "debit" as const,
    creditAccountId: typeof item.creditAccountId === "string" ? item.creditAccountId : "",
  })) : [];
  return {
    accounts,
    cashflowItems,
    extra: Number.isFinite(parsed.extra) ? parsed.extra ?? 0 : 0,
    strategy: parsed.strategy === "snowball" ? "snowball" : "avalanche",
  };
}

const STORAGE_KEY = "debtfree-dashboard-prototype-v1";
const EMPTY_DRAFT: AccountDraft = { name: "", type: "Credit card", balance: 0, apr: 0, interestFee: 0, minimum: 0, minimumMode: "auto", payoffMode: "priority", creditLimit: 0, dueDate: "" };
const EMPTY_CASHFLOW_DRAFT: CashflowDraft = { name: "", kind: "expense", category: "Housing", amount: 0, paymentMethod: "debit", creditAccountId: "" };
const CASHFLOW_CATEGORIES: Record<CashflowKind, string[]> = {
  income: ["Salary", "Freelance", "Benefits", "Investment", "Other income"],
  expense: ["Housing", "Transportation", "Utilities", "Subscriptions", "Insurance", "Food", "Other expense"],
  budget: ["Savings", "Emergency fund", "Groceries", "Travel", "Personal", "Other budget"],
};
const SAMPLE_ACCOUNTS: DebtAccount[] = [
  { id: "sample-1", name: "Everyday Rewards", type: "Credit card", balance: 3577.28, apr: 21.49, interestFee: 0, minimum: 0, minimumMode: "auto", payoffMode: "priority", creditLimit: 8500, dueDate: "2026-08-18", createdAt: "2026-07-01" },
  { id: "sample-2", name: "Freedom Card", type: "Credit card", balance: 5254.68, apr: 24.74, interestFee: 0, minimum: 0, minimumMode: "auto", payoffMode: "priority", creditLimit: 10000, dueDate: "2026-08-22", createdAt: "2026-07-01" },
  { id: "sample-3", name: "Warehouse Card", type: "Credit card", balance: 10684, apr: 23.74, interestFee: 0, minimum: 0, minimumMode: "auto", payoffMode: "priority", creditLimit: 14000, dueDate: "2026-08-27", createdAt: "2026-07-01" },
];
const DEBT_TYPES: DebtType[] = ["Credit card", "Personal loan", "Auto loan", "Student loan", "Medical debt", "Other"];
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const moneyPrecise = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = (value: string) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { cell += '"'; index++; }
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(cell); cell = ""; }
    else if (character === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += character;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows;
}
function csvNumber(value: string | undefined) {
  const normalized = (value ?? "").replace(/[$,%\s]/g, "");
  return Number.isFinite(Number(normalized)) ? Math.max(0, Number(normalized)) : 0;
}
function inferDebtType(name: string): DebtType {
  const value = name.toLowerCase();
  if (/card|visa|mastercard|amex|discover|chase|citi|capital one|costco/.test(value)) return "Credit card";
  if (/auto|car|vehicle/.test(value)) return "Auto loan";
  if (/student|school|education/.test(value)) return "Student loan";
  if (/medical|hospital|health/.test(value)) return "Medical debt";
  if (/loan|lending|finance/.test(value)) return "Personal loan";
  return "Other";
}
function extractDebtFreeAccounts(text: string): DebtAccount[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  const sectionIndex = rows.findIndex((row) => (row[0] ?? "").trim().toUpperCase() === "CURRENT DEBT STATUS");
  if (sectionIndex < 0 || !rows[sectionIndex + 1]) throw new Error("This file does not contain the CURRENT DEBT STATUS section from DebtFree.");
  const headers = rows[sectionIndex + 1].map((header) => header.trim().toLowerCase());
  const find = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const nameIndex = find("debt", "name");
  const currentBalanceIndex = find("current estimated balance", "current balance", "balance");
  const originalBalanceIndex = find("original balance", "starting balance");
  const aprIndex = find("apr", "apr %", "interest rate");
  const modeIndex = find("minimum mode");
  const minimumIndex = find("current minimum", "minimum payment", "minimum");
  if (nameIndex < 0 || (currentBalanceIndex < 0 && originalBalanceIndex < 0) || aprIndex < 0 || minimumIndex < 0) throw new Error("The debt columns in this export are not recognized.");
  const imported: DebtAccount[] = [];
  for (let index = sectionIndex + 2; index < rows.length; index++) {
    const row = rows[index];
    if (!row.some((cell) => cell.trim())) break;
    const name = (row[nameIndex] ?? "").trim();
    if (!name || name.toUpperCase() === "DEBT") continue;
    const mode = (row[modeIndex] ?? "").toLowerCase();
    imported.push({
      id: `import-${Date.now()}-${index}-${Math.random()}`,
      name,
      type: inferDebtType(name),
      balance: csvNumber(row[currentBalanceIndex >= 0 ? currentBalanceIndex : originalBalanceIndex]),
      apr: csvNumber(row[aprIndex]),
      interestFee: 0,
      minimum: csvNumber(row[minimumIndex]),
      minimumMode: mode.includes("auto") || mode.includes("estimate") ? "auto" : "manual",
      payoffMode: "priority",
      creditLimit: 0,
      dueDate: "",
      createdAt: new Date().toISOString(),
    });
  }
  const unique = new Map(imported.map((account) => [account.name.trim().toLowerCase(), account]));
  if (!unique.size) throw new Error("No debt accounts were found in the export.");
  return [...unique.values()];
}
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function estimatedMinimum(balance: number, apr: number) {
  if (balance <= 0) return 0;
  const monthlyInterest = balance * apr / 1200;
  return Math.min(round(balance + monthlyInterest), Math.max(25, round(balance * 0.01 + monthlyInterest)));
}
function effectiveMinimum(account: DebtAccount) {
  return account.balance <= 0 ? 0 : account.minimumMode === "auto" ? estimatedMinimum(account.balance, account.apr) : account.minimum;
}
function projectedMonthlyRate(account: DebtAccount) {
  return account.interestFee > 0 && account.balance > 0 ? account.interestFee / account.balance : account.apr / 1200;
}
function monthlyInterest(account: DebtAccount) {
  return round(account.balance * projectedMonthlyRate(account));
}
function formatDate(value: string) {
  if (!value) return "Not set";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
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
function calculatePlan(accounts: DebtAccount[], extra: number, strategy: PayoffStrategy, linkedCardExpenses: LinkedCardExpenses = {}) {
  const active = accounts.filter((account) => account.balance > 0);
  const balances = new Map(active.map((account) => [account.id, account.balance]));
  const monthly = active.reduce((sum, account) => sum + effectiveMinimum(account) + (linkedCardExpenses[account.id] ?? 0), 0) + extra;
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
      const charge = balance * projectedMonthlyRate(account);
      balances.set(account.id, balance + charge);
      interest += charge;
    });
    totalInterest += interest;
    active.forEach((account) => {
      const recurringCharge = linkedCardExpenses[account.id] ?? 0;
      if (recurringCharge <= 0) return;
      balances.set(account.id, (balances.get(account.id) ?? 0) + recurringCharge);
    });
    let available = monthly;
    active.forEach((account) => {
      const balance = balances.get(account.id) ?? 0;
      const scheduledPayment = effectiveMinimum(account) + (linkedCardExpenses[account.id] ?? 0);
      const payment = Math.min(scheduledPayment, balance, available);
      if (payment > 0) {
        balances.set(account.id, balance - payment);
        payments[account.id] = payment;
        available -= payment;
      }
    });
    const priority = [...active].filter((account) => account.payoffMode !== "minimum-only" && (balances.get(account.id) ?? 0) > 0.005).sort((a, b) => strategy === "avalanche" ? b.apr - a.apr || a.balance - b.balance : a.balance - b.balance || b.apr - a.apr);
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
    months.push({ month, interest, paid: Object.values(payments).reduce((sum, payment) => sum + payment, 0), remaining, payments, balances: Object.fromEntries([...balances].map(([id, balance]) => [id, Math.max(0, round(balance))])), paidOff });
    if (remaining <= 0.005) return { months, totalInterest, monthly, stalled: false };
    const previousRemaining = [...before.values()].reduce((sum, balance) => sum + balance, 0);
    if (!paidOff.length && remaining >= previousRemaining - 0.005) return { months, totalInterest, monthly, stalled: true };
  }
  return { months, totalInterest, monthly, stalled: true };
}

const NAV_ITEMS: { id: PageId; label: string; icon: string; future?: boolean }[] = [
  { id: "dashboard", label: "Monthly Income & Expenses", icon: "⌂" },
  { id: "accounts", label: "Debt Accounts", icon: "▤" },
  { id: "history", label: "Payment History", icon: "↻", future: true },
  { id: "plan", label: "Payoff Plan", icon: "✓" },
  { id: "snapshots", label: "Payoff Snapshots", icon: "◉", future: true },
  { id: "utilization", label: "Credit Utilization", icon: "◔", future: true },
  { id: "stats", label: "Stats & Projections", icon: "↗", future: true },
  { id: "profile", label: "My Account", icon: "⚙" },
];

export default function DashboardClient({ user }: { user: ChatGPTUser }) {
  const [page, setPage] = useState<PageId>("dashboard");
  const [accounts, setAccounts] = useState<DebtAccount[]>([]);
  const [cashflowItems, setCashflowItems] = useState<CashflowItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AccountDraft>(EMPTY_DRAFT);
  const [extra, setExtra] = useState(0);
  const [strategy, setStrategy] = useState<PayoffStrategy>("avalanche");
  const [importMessage, setImportMessage] = useState("");
  const [cashflowModalOpen, setCashflowModalOpen] = useState(false);
  const [editingCashflowId, setEditingCashflowId] = useState<string | null>(null);
  const [cashflowDraft, setCashflowDraft] = useState<CashflowDraft>(EMPTY_CASHFLOW_DRAFT);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("connecting");
  const [householdName, setHouseholdName] = useState("My household");
  const [householdRole, setHouseholdRole] = useState<"owner" | "admin">("owner");
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);

  useEffect(() => {
    let cancelled = false;
    const applyPayload = (payload: DashboardPayload) => {
      setAccounts(payload.accounts);
      setCashflowItems(payload.cashflowItems);
      setExtra(payload.extra);
      setStrategy(payload.strategy);
    };
    const load = async () => {
      let localPayload: DashboardPayload | null = null;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          localPayload = normalizedPayload(JSON.parse(saved));
          applyPayload(localPayload);
        }
      } catch { /* Keep going so a damaged local draft cannot block cloud data. */ }
      try {
        const response = await fetch("/api/household", { cache: "no-store" });
        const data = await response.json() as HouseholdResponse & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Cloud storage is unavailable");
        if (cancelled) return;
        setHouseholdName(data.householdName);
        setHouseholdRole(data.role);
        setHouseholdMembers(data.members);
        if (data.payload) {
          applyPayload(normalizedPayload(data.payload));
        } else if (localPayload) {
          const upload = await fetch("/api/household", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload: localPayload }) });
          if (!upload.ok) throw new Error("Your existing device data could not be copied to the household yet");
        }
        setCloudStatus("synced");
      } catch {
        if (!cancelled) setCloudStatus("error");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const payload: DashboardPayload = { accounts, cashflowItems, extra, strategy };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    const syncTimer = window.setTimeout(() => {
      setCloudStatus("saving");
      void fetch("/api/household", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload }) })
        .then((response) => { if (!response.ok) throw new Error("Sync failed"); setCloudStatus("synced"); })
        .catch(() => setCloudStatus("error"));
    }, 650);
    return () => window.clearTimeout(syncTimer);
  }, [accounts, cashflowItems, extra, loaded, strategy]);
  useEffect(() => {
    if (!modalOpen && !cashflowModalOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setModalOpen(false); setCashflowModalOpen(false); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [cashflowModalOpen, modalOpen]);

  const totalBalance = useMemo(() => accounts.reduce((sum, account) => sum + account.balance, 0), [accounts]);
  const activeCount = useMemo(() => accounts.filter((account) => account.balance > 0).length, [accounts]);
  const minimums = useMemo(() => accounts.reduce((sum, account) => sum + effectiveMinimum(account), 0), [accounts]);
  const interest = useMemo(() => accounts.reduce((sum, account) => sum + monthlyInterest(account), 0), [accounts]);
  const monthlySurplus = useMemo(() => cashflowItems.reduce((sum, item) => sum + (item.kind === "income" ? item.amount : -item.amount), 0), [cashflowItems]);
  const linkedCardExpenseItems = useMemo(() => cashflowItems.reduce<LinkedCardExpenseItems>((items, item) => {
    if (item.kind === "expense" && item.paymentMethod === "credit" && item.creditAccountId) {
      (items[item.creditAccountId] ??= []).push(item);
    }
    return items;
  }, {}), [cashflowItems]);
  const linkedCardExpenses = useMemo(() => Object.fromEntries(Object.entries(linkedCardExpenseItems).map(([accountId, items]) => [accountId, round(items.reduce((sum, item) => sum + item.amount, 0))])), [linkedCardExpenseItems]);
  const availableExtra = useMemo(() => Math.max(0, round(monthlySurplus - minimums)), [minimums, monthlySurplus]);
  const plan = useMemo(() => calculatePlan(accounts, extra, strategy, linkedCardExpenses), [accounts, extra, linkedCardExpenses, strategy]);
  const paidOffById = useMemo(() => new Map(accounts.map((account) => {
    const month = plan.months.find((entry) => entry.paidOff.includes(account.name))?.month;
    return [account.id, month ?? individualPayoffMonths(account)];
  })), [accounts, plan.months]);
  const sortedAccounts = useMemo(() => [...accounts].sort((a, b) => {
    const values: Record<SortKey, [string | number, string | number]> = {
      name: [a.name.toLowerCase(), b.name.toLowerCase()],
      balance: [a.balance, b.balance],
      creditLimit: [a.creditLimit, b.creditLimit],
      apr: [a.apr, b.apr],
      minimum: [effectiveMinimum(a) + (linkedCardExpenses[a.id] ?? 0), effectiveMinimum(b) + (linkedCardExpenses[b.id] ?? 0)],
      monthlyInterest: [monthlyInterest(a), monthlyInterest(b)],
      status: [a.balance <= 0 ? "paid off" : a.payoffMode, b.balance <= 0 ? "paid off" : b.payoffMode],
      dueDate: [a.dueDate || "9999", b.dueDate || "9999"],
      payoff: [paidOffById.get(a.id) ?? 9999, paidOffById.get(b.id) ?? 9999],
    };
    const [first, second] = values[sortKey];
    const compared = typeof first === "number" && typeof second === "number" ? first - second : String(first).localeCompare(String(second));
    return sortDirection === "asc" ? compared : -compared;
  }), [accounts, linkedCardExpenses, paidOffById, sortDirection, sortKey]);

  const inviteAdmin = async (email: string) => {
    const response = await fetch("/api/household/members", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await response.json() as { members?: HouseholdMember[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "The admin could not be added");
    if (data.members) setHouseholdMembers(data.members);
  };
  const removeAdmin = async (email: string) => {
    const response = await fetch("/api/household/members?email=" + encodeURIComponent(email), { method: "DELETE" });
    const data = await response.json() as { members?: HouseholdMember[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "The admin could not be removed");
    if (data.members) setHouseholdMembers(data.members);
  };

  const changeSort = (key: SortKey) => {
    if (key === sortKey) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDirection("asc"); }
  };
  const openNew = () => { setEditingId(null); setDraft(EMPTY_DRAFT); setModalOpen(true); };
  const openNewCashflow = (kind: CashflowKind) => {
    setEditingCashflowId(null);
    setCashflowDraft({ ...EMPTY_CASHFLOW_DRAFT, kind, category: CASHFLOW_CATEGORIES[kind][0] });
    setCashflowModalOpen(true);
  };
  const openEditCashflow = (item: CashflowItem) => {
    setEditingCashflowId(item.id);
    setCashflowDraft({ name: item.name, kind: item.kind, category: item.category, amount: item.amount, paymentMethod: item.paymentMethod, creditAccountId: item.creditAccountId });
    setCashflowModalOpen(true);
  };
  const saveCashflow = () => {
    if (!cashflowDraft.name.trim() || cashflowDraft.amount <= 0) return;
    const normalized = { ...cashflowDraft, name: cashflowDraft.name.trim(), creditAccountId: cashflowDraft.kind === "expense" && cashflowDraft.paymentMethod === "credit" ? cashflowDraft.creditAccountId : "" };
    if (editingCashflowId) setCashflowItems((current) => current.map((item) => item.id === editingCashflowId ? { ...item, ...normalized } : item));
    else setCashflowItems((current) => [...current, { ...normalized, id: `${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString() }]);
    setCashflowModalOpen(false);
  };
  const removeCashflow = () => {
    if (!editingCashflowId) return;
    const item = cashflowItems.find((entry) => entry.id === editingCashflowId);
    if (confirm(`Remove ${item?.name ?? "this monthly item"}?`)) {
      setCashflowItems((current) => current.filter((entry) => entry.id !== editingCashflowId));
      setCashflowModalOpen(false);
    }
  };
  const openEdit = (account: DebtAccount) => {
    setEditingId(account.id);
    setDraft({ name: account.name, type: account.type, balance: account.balance, apr: account.apr, interestFee: account.interestFee, minimum: account.minimum, minimumMode: account.minimumMode, payoffMode: account.payoffMode, creditLimit: account.creditLimit, dueDate: account.dueDate });
    setModalOpen(true);
  };
  const toggleMinimumMode = (id: string) => {
    setAccounts((current) => current.map((account) => account.id !== id ? account : account.minimumMode === "auto" ? { ...account, minimumMode: "manual", minimum: effectiveMinimum(account) } : { ...account, minimumMode: "auto" }));
  };
  const togglePayoffMode = (id: string) => {
    setAccounts((current) => current.map((account) => account.id === id && account.balance > 0 ? { ...account, payoffMode: account.payoffMode === "minimum-only" ? "priority" : "minimum-only" } : account));
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
  const importDebtFreeCsv = async (file: File) => {
    try {
      const imported = extractDebtFreeAccounts(await file.text());
      const existingNames = new Set(accounts.map((account) => account.name.trim().toLowerCase()));
      const added = imported.filter((account) => !existingNames.has(account.name.trim().toLowerCase())).length;
      const updated = imported.length - added;
      setAccounts((current) => {
        const importedByName = new Map(imported.map((account) => [account.name.trim().toLowerCase(), account]));
        const merged = current.map((account) => {
          const match = importedByName.get(account.name.trim().toLowerCase());
          if (!match) return account;
          importedByName.delete(account.name.trim().toLowerCase());
          return { ...account, balance: match.balance, apr: match.apr, minimum: match.minimum, minimumMode: match.minimumMode };
        });
        return [...merged, ...importedByName.values()];
      });
      setImportMessage(`Imported ${imported.length} account${imported.length === 1 ? "" : "s"}: ${added} added${updated ? `, ${updated} updated` : ""}. Add credit limits and due dates when ready.`);
    } catch (error) {
      setImportMessage(`Import failed: ${error instanceof Error ? error.message : "The file could not be read."}`);
    }
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" type="button" onClick={() => setPage("dashboard")}><span>DF</span><div><strong>DebtFree</strong><small>Dashboard</small></div></button>
      <nav aria-label="Dashboard sections">{NAV_ITEMS.map((item) => <button type="button" key={item.id} className={page === item.id ? "nav-item active" : "nav-item"} onClick={() => setPage(item.id)}><i>{item.icon}</i><span>{item.label}</span>{item.future && <em>Soon</em>}</button>)}</nav>
      <div className="sidebar-foot"><span>{householdName}</span><strong>{cloudStatus === "synced" ? "Shared household data" : cloudStatus === "error" ? "Device backup active" : "Syncing changes"}</strong></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div><span className="mobile-product">DebtFree Dashboard</span><strong>{NAV_ITEMS.find((item) => item.id === page)?.label}</strong></div><div className="top-actions"><span className={`save-state ${cloudStatus}`}><i/> {cloudStatus === "synced" ? "Household saved" : cloudStatus === "error" ? "Saved on device" : "Saving"}</span><button className="avatar" type="button" onClick={() => setPage("profile")} aria-label="Open My Account">{user.displayName.slice(0,2).toUpperCase()}</button></div></header>
      <div className="page-body">
        {page === "dashboard" && <DashboardPage items={cashflowItems} accounts={accounts} onAdd={openNewCashflow} onEdit={openEditCashflow}/>}
        {page === "accounts" && <AccountsPage accounts={sortedAccounts} activeCount={activeCount} totalBalance={totalBalance} minimums={minimums} interest={interest} linkedCardExpenses={linkedCardExpenses} sortKey={sortKey} sortDirection={sortDirection} paidOffById={paidOffById} onSort={changeSort} onAdd={openNew} onEdit={openEdit} onToggleMinimum={toggleMinimumMode} onTogglePayoff={togglePayoffMode} onSample={() => setAccounts(SAMPLE_ACCOUNTS)} onImport={importDebtFreeCsv} importMessage={importMessage}/>}
        {page === "plan" && <PayoffPlanPage accounts={accounts} plan={plan} extra={extra} availableExtra={availableExtra} strategy={strategy} linkedCardExpenseItems={linkedCardExpenseItems} onExtra={setExtra} onStrategy={setStrategy} onAccounts={() => setPage("accounts")} onEditAccount={openEdit}/>}
        {page === "profile" && <ProfilePage user={user} householdName={householdName} role={householdRole} members={householdMembers} cloudStatus={cloudStatus} onInvite={inviteAdmin} onRemove={removeAdmin}/>}
        {(page === "history" || page === "snapshots" || page === "utilization" || page === "stats") && <FuturePage page={page}/>}
      </div>
    </main>

    {modalOpen && <AccountModal draft={draft} editing={Boolean(editingId)} onChange={setDraft} onClose={() => setModalOpen(false)} onSave={saveAccount} onRemove={removeAccount}/>}
    {cashflowModalOpen && <CashflowModal draft={cashflowDraft} editing={Boolean(editingCashflowId)} accounts={accounts} onChange={setCashflowDraft} onClose={() => setCashflowModalOpen(false)} onSave={saveCashflow} onRemove={removeCashflow}/>}
  </div>;
}

function DashboardPage({ items, accounts, onAdd, onEdit }: { items: CashflowItem[]; accounts: DebtAccount[]; onAdd: (kind: CashflowKind) => void; onEdit: (item: CashflowItem) => void }) {
  const kinds: { kind: CashflowKind; title: string; empty: string }[] = [
    { kind: "income", title: "Income", empty: "Add salary, freelance work, benefits, or another monthly source." },
    { kind: "expense", title: "Expenses", empty: "Add recurring bills and choose debit or the credit card that pays each one." },
    { kind: "budget", title: "Budget", empty: "Add money you want to reserve for savings, groceries, travel, or another goal." },
  ];
  const totalFor = (kind: CashflowKind) => items.filter((item) => item.kind === kind).reduce((sum, item) => sum + item.amount, 0);
  const totalIncome = totalFor("income");
  const totalExpenses = totalFor("expense");
  const totalBudget = totalFor("budget");
  const available = totalIncome - totalExpenses - totalBudget;
  const creditNames = new Map(accounts.map((account) => [account.id, account.name]));
  const detail = (item: CashflowItem) => {
    if (item.kind !== "expense") return item.category;
    if (item.paymentMethod === "debit") return `${item.category} · Debit`;
    return `${item.category} · Credit · ${creditNames.get(item.creditAccountId) ?? "Card not selected"}`;
  };

  return <div className="screen dashboard-screen monthly-screen">
    <div className="screen-title monthly-title"><div><span className="eyebrow">Monthly money plan</span><h1>Monthly income & expenses</h1><p>See income, recurring expenses, and your editable budget together on one screen.</p></div><div className="cashflow-quick-actions"><button className="income-action" type="button" onClick={() => onAdd("income")}>+ Add income</button><button className="expense-action" type="button" onClick={() => onAdd("expense")}>+ Add expense</button><button className="budget-action" type="button" onClick={() => onAdd("budget")}>+ Add budget</button></div></div>
    <section className="monthly-summary-strip" aria-label="Monthly totals"><div><span>Income</span><strong>{moneyPrecise.format(totalIncome)}</strong></div><div><span>Expenses</span><strong>{moneyPrecise.format(totalExpenses)}</strong></div><div><span>Budget</span><strong>{moneyPrecise.format(totalBudget)}</strong></div><div className={available >= 0 ? "available positive" : "available negative"}><span>Available</span><strong>{moneyPrecise.format(available)}</strong></div></section>
    <section className="cashflow-columns" aria-label="Income, expenses, and budget">
      {kinds.map(({ kind, title, empty }) => {
        const columnItems = items.filter((item) => item.kind === kind).sort((a, b) => b.amount - a.amount);
        return <article className={`cashflow-column ${kind}`} key={kind}><header><div><span>{title}</span><small>{columnItems.length} {columnItems.length === 1 ? "item" : "items"}</small></div><strong>{moneyPrecise.format(totalFor(kind))}</strong></header>{columnItems.length ? <div className="cashflow-column-list">{columnItems.map((item) => <button type="button" key={item.id} onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`}><div><strong>{item.name}</strong><small>{detail(item)}</small></div><b>{moneyPrecise.format(item.amount)}</b></button>)}</div> : <div className="cashflow-column-empty"><span>{kind === "income" ? "$" : kind === "expense" ? "↗" : "◎"}</span><strong>No {title.toLowerCase()} yet</strong><p>{empty}</p></div>}</article>;
      })}
    </section>
  </div>;
}function AccountsPage({ accounts, activeCount, totalBalance, minimums, interest, linkedCardExpenses, sortKey, sortDirection, paidOffById, onSort, onAdd, onEdit, onToggleMinimum, onTogglePayoff, onSample, onImport, importMessage }: { accounts: DebtAccount[]; activeCount: number; totalBalance: number; minimums: number; interest: number; linkedCardExpenses: LinkedCardExpenses; sortKey: SortKey; sortDirection: SortDirection; paidOffById: Map<string, number | null | undefined>; onSort: (key: SortKey) => void; onAdd: () => void; onEdit: (account: DebtAccount) => void; onToggleMinimum: (id: string) => void; onTogglePayoff: (id: string) => void; onSample: () => void; onImport: (file: File) => Promise<void>; importMessage: string }) {
  const headers: { key: SortKey; label: string }[] = [{ key: "name", label: "Account" }, { key: "balance", label: "Balance" }, { key: "creditLimit", label: "Credit limit" }, { key: "apr", label: "APR %" }, { key: "minimum", label: "Monthly payment" }, { key: "monthlyInterest", label: "Interest fee" }, { key: "status", label: "Status" }, { key: "dueDate", label: "Due date" }, { key: "payoff", label: "Estimated paid off date" }];
  const totalCreditLimit = accounts.reduce((sum, account) => sum + account.creditLimit, 0);
  const totalLinkedExpenses = Object.values(linkedCardExpenses).reduce((sum, amount) => sum + amount, 0);
  return <div className="screen"><div className="screen-title"><div><span className="eyebrow">Debt workspace</span><h1>Debt accounts</h1><p>Review balances, minimums, payoff priority, limits, and due dates in one clear table.</p></div><div className="screen-actions"><label className="secondary import-file"><input type="file" accept=".csv,text/csv" onChange={(event) => { const input = event.currentTarget; const file = input.files?.[0]; if (file) void onImport(file).finally(() => { input.value = ""; }); }}/><span>Import CSV</span></label><button className="primary" type="button" onClick={onAdd}>+ Add account</button></div></div>{importMessage && <p className={importMessage.startsWith("Import failed") ? "import-message error" : "import-message"}>{importMessage}</p>}<section className="metrics"><article className="metric"><span>Total balance</span><strong>{moneyPrecise.format(totalBalance)}</strong><small>Across all accounts</small></article><article className="metric"><span>Active accounts</span><strong>{activeCount}</strong><small>{accounts.length - activeCount} paid off</small></article><article className="metric"><span>Monthly card payments</span><strong>{moneyPrecise.format(minimums + totalLinkedExpenses)}</strong><small>{totalLinkedExpenses > 0 ? `${moneyPrecise.format(minimums)} minimums + ${moneyPrecise.format(totalLinkedExpenses)} card expenses` : "Auto estimates included"}</small></article><article className="metric"><span>Monthly interest</span><strong>{moneyPrecise.format(interest)}</strong><small>At current balances</small></article></section><section className="table-card"><div className="table-card-head"><div><span>Your debt accounts</span><strong>{accounts.length} {accounts.length === 1 ? "record" : "records"}</strong></div><span className="swipe-note">Click minimum or status to change it</span></div>{accounts.length ? <div className="table-scroll"><table className="accounts-table"><caption>Sortable debt account list</caption><thead><tr>{headers.map((header) => <th key={header.key}><button type="button" onClick={() => onSort(header.key)}>{header.label}<i>{sortKey === header.key ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</i></button></th>)}</tr></thead><tbody>{accounts.map((account) => { const payoff = paidOffById.get(account.id); const cardExpense = linkedCardExpenses[account.id] ?? 0; return <tr key={account.id}><td><button className="account-name" type="button" onClick={() => onEdit(account)}><span>{account.name.slice(0,2).toUpperCase()}</span><div><strong>{account.name}</strong><small>{account.type}</small></div></button></td><td className="number-cell"><strong>{moneyPrecise.format(account.balance)}</strong>{account.creditLimit > 0 && <small>{Math.round(account.balance/account.creditLimit*100)}% utilized</small>}</td><td className="number-cell"><strong>{account.creditLimit > 0 ? moneyPrecise.format(account.creditLimit) : "—"}</strong></td><td className="number-cell">{account.apr.toFixed(2)}%</td><td><button className={`minimum-toggle ${account.minimumMode}`} type="button" onClick={() => onToggleMinimum(account.id)} aria-label={`${account.name}: ${account.minimumMode === "auto" ? "use manual minimum payment" : "use automatic minimum estimate"}`}><strong>{moneyPrecise.format(effectiveMinimum(account) + cardExpense)}</strong><small>{cardExpense > 0 ? `${moneyPrecise.format(effectiveMinimum(account))} min + ${moneyPrecise.format(cardExpense)} expenses` : account.minimumMode === "auto" ? "Auto estimate" : "Manual amount"}</small></button></td><td className="number-cell"><strong>{moneyPrecise.format(monthlyInterest(account))}</strong><small>{account.interestFee > 0 ? "Actual statement fee" : "APR estimate"}</small></td><td><button className={`status-toggle ${account.balance <= 0 ? "paid" : account.payoffMode}`} type="button" disabled={account.balance <= 0} onClick={() => onTogglePayoff(account.id)} title={account.balance > 0 ? "Switch between payoff priority and minimum-only payments" : "This account is paid off"}>{account.balance <= 0 ? "Paid off" : account.payoffMode === "minimum-only" ? "Minimum only" : "Payoff priority"}</button></td><td><span className="date-cell"><i>□</i>{formatDate(account.dueDate)}</span></td><td>{account.balance <= 0 ? <strong className="paid-date">Complete</strong> : payoff ? <span>{monthAfter(payoff - 1)}</span> : <span className="needs">Needs adjustment</span>}</td></tr>; })}</tbody><tfoot><tr><td>Total</td><td className="number-cell">{moneyPrecise.format(totalBalance)}</td><td className="number-cell">{moneyPrecise.format(totalCreditLimit)}</td><td></td><td className="number-cell">{moneyPrecise.format(minimums + totalLinkedExpenses)}</td><td className="number-cell">{moneyPrecise.format(interest)}</td><td colSpan={3}></td></tr></tfoot></table></div> : <div className="empty-table"><span>▤</span><h2>No debt accounts yet</h2><p>Import the CSV from your original DebtFree app, add your first account, or load temporary sample records.</p><div><label className="secondary import-file"><input type="file" accept=".csv,text/csv" onChange={(event) => { const input = event.currentTarget; const file = input.files?.[0]; if (file) void onImport(file).finally(() => { input.value = ""; }); }}/><span>Import DebtFree CSV</span></label><button className="primary" type="button" onClick={onAdd}>+ Add account</button><button className="secondary" type="button" onClick={onSample}>Load samples</button></div></div>}</section></div>;
}

function PayoffPlanPage({ accounts, plan, extra, availableExtra, strategy, linkedCardExpenseItems, onExtra, onStrategy, onAccounts, onEditAccount }: { accounts: DebtAccount[]; plan: ReturnType<typeof calculatePlan>; extra: number; availableExtra: number; strategy: PayoffStrategy; linkedCardExpenseItems: LinkedCardExpenseItems; onExtra: (value: number) => void; onStrategy: (strategy: PayoffStrategy) => void; onAccounts: () => void; onEditAccount: (account: DebtAccount) => void }) {
  const description = strategy === "avalanche" ? "Highest APR first — usually the lowest total interest." : "Lowest balance first — faster early wins.";
  const planAccounts = accounts.filter((account) => account.balance > 0);
  return <div className="screen plan-screen"><div className="screen-title"><div><span className="eyebrow">{strategy} strategy</span><h1>Payoff plan</h1><p>Minimums and linked credit-card expenses are paid first, then extra money follows your selected strategy. Zero-balance accounts are hidden.</p></div><div className="plan-controls"><div className="strategy-control"><span>Strategy</span><div><button type="button" className={strategy === "avalanche" ? "active" : ""} onClick={() => onStrategy("avalanche")}>Avalanche</button><button type="button" className={strategy === "snowball" ? "active" : ""} onClick={() => onStrategy("snowball")}>Snowball</button></div><small>{description}</small></div><div className="extra-control"><label htmlFor="extra-monthly">Extra each month</label><div><b>$</b><input id="extra-monthly" type="number" min="0" inputMode="decimal" value={extra || ""} placeholder="0" onChange={(event) => onExtra(number(event.target.value))}/></div><button className={availableExtra > 0 && Math.abs(extra - availableExtra) < 0.01 ? "surplus-shortcut active" : "surplus-shortcut"} type="button" disabled={availableExtra <= 0} onClick={() => onExtra(availableExtra)}>{availableExtra > 0 ? `Use my ${moneyPrecise.format(availableExtra)} available extra` : "No extra available yet"}</button><small>{availableExtra > 0 ? "Calculated after monthly expenses, budgets, and debt minimums. Edit anytime." : "Add income or adjust expenses, budgets, and minimums to create extra."}</small></div></div></div>{planAccounts.length && plan.months.length && !plan.stalled ? <><section className="plan-hero"><div><span>Projected debt-free date</span><strong>{monthAfter(plan.months.length - 1)}</strong><small>{plan.months.length} months from now</small></div><div><span>Monthly plan</span><strong>{money.format(plan.monthly)}</strong><small>Minimums + linked card expenses + extra</small></div><div><span>Estimated interest</span><strong>{money.format(plan.totalInterest)}</strong><small>Actual fee calibration used when provided</small></div></section><section className="table-card plan-table-card"><div className="table-card-head"><div><span>Month-by-month schedule</span><strong>{plan.months.length} rows · {strategy}</strong></div><span className="swipe-note">Month, interest, and remaining stay visible while you scroll</span></div><div className="table-scroll plan-scroll"><table className="payoff-table"><caption>Complete payoff plan with account balances after each scheduled payment</caption><thead><tr><th className="month-plan-head month-sticky">Month</th>{planAccounts.map((account) => <th className="account-plan-head" key={account.id} title="Click the account name to edit it. Drag the lower-right edge to resize this column."><button className="account-plan-edit" type="button" onClick={() => onEditAccount(account)}><span>{account.name}</span><small>Starting debt {moneyPrecise.format(account.balance)}</small></button></th>)}<th>Total paid</th><th>Milestone</th><th className="interest-sticky">Interest</th><th className="remaining-sticky">Remaining</th></tr></thead><tbody>{plan.months.map((month) => <tr key={month.month}><td className="month-sticky">{monthAfter(month.month - 1)}</td>{planAccounts.map((account) => { const expenseItems = linkedCardExpenseItems[account.id] ?? []; return <td className="account-plan-cell" key={account.id}><strong>{moneyPrecise.format(month.payments[account.id] ?? 0)} paid</strong><small>{moneyPrecise.format(month.balances[account.id] ?? 0)} left</small>{expenseItems.map((item) => <em key={item.id}>+ {moneyPrecise.format(item.amount)} {item.name}</em>)}</td>; })}<td className="number-cell"><strong>{moneyPrecise.format(month.paid)}</strong></td><td>{month.paidOff.length ? <span className="milestone">Paid off: {month.paidOff.join(", ")}</span> : "\u2014"}</td><td className="number-cell interest-sticky">{moneyPrecise.format(month.interest)}</td><td className="number-cell remaining remaining-sticky">{moneyPrecise.format(month.remaining)}</td></tr>)}</tbody></table></div></section></> : <section className="large-empty"><span>✓</span><h2>{plan.stalled ? "The current payments do not outpace interest" : "Add debt accounts to build your plan"}</h2><p>{plan.stalled ? "Increase a minimum payment or add an extra monthly amount to create a finish line." : "Once your accounts have balances, APRs, and minimums, the complete payoff schedule will appear here."}</p><button className="primary" type="button" onClick={onAccounts}>Review debt accounts</button></section>}</div>;
}function ProfilePage({ user, householdName, role, members, cloudStatus, onInvite, onRemove }: { user: ChatGPTUser; householdName: string; role: "owner" | "admin"; members: HouseholdMember[]; cloudStatus: CloudStatus; onInvite: (email: string) => Promise<void>; onRemove: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const invite = async () => {
    setWorking(true);
    setMessage("");
    try { await onInvite(email); setEmail(""); setMessage("Admin added. They can now open this link and sign in with that email."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The admin could not be added"); }
    finally { setWorking(false); }
  };
  const remove = async (memberEmail: string) => {
    if (!confirm("Remove " + memberEmail + " from this household?")) return;
    setWorking(true);
    try { await onRemove(memberEmail); setMessage("Admin removed."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The admin could not be removed"); }
    finally { setWorking(false); }
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.origin); setMessage("Dashboard link copied."); }
    catch { setMessage("Copy this address from your browser and send it to your household admin."); }
  };
  return <div className="screen"><div className="screen-title"><div><span className="eyebrow">Household access</span><h1>My account</h1><p>Your dashboard is protected by ChatGPT sign-in and shared with the admins listed below.</p></div><button className="secondary" type="button" onClick={copyLink}>Copy dashboard link</button></div><section className="profile-grid"><article className="profile-card"><div className="profile-avatar">{user.displayName.slice(0,2).toUpperCase()}</div><div><span>{role === "owner" ? "Household owner" : "Household admin"}</span><strong>{user.displayName}</strong><small>{user.email}</small></div><div className="account-cloud-state"><i className={cloudStatus}/><span>{cloudStatus === "synced" ? "Household cloud sync is active" : cloudStatus === "error" ? "Cloud unavailable; device backup is safe" : "Syncing household changes"}</span></div><a className="secondary account-link" href="/signout-with-chatgpt?return_to=%2F">Sign out</a></article><article className="roles-card household-card"><div className="card-head"><div><span>{householdName}</span><strong>Household admins</strong></div></div>{role === "owner" && <div className="invite-admin"><label><span>Admin email</span><div><input type="email" value={email} placeholder="wife@example.com" onChange={(event) => setEmail(event.target.value)}/><button className="primary" type="button" disabled={working || !email.trim()} onClick={invite}>Add admin</button></div><small>Use the email connected to her ChatGPT account. She will sign in separately; never share your password.</small></label></div>}{message && <p className="share-message">{message}</p>}<div className="member-list">{members.map((member) => <div className="member-row" key={member.email}><div><strong>{member.display_name || member.email}</strong><small>{member.display_name ? member.email : member.status === "invited" ? "Waiting for first sign-in" : "Household member"}</small></div><span className={member.status}>{member.role}</span>{role === "owner" && member.role !== "owner" ? <button type="button" disabled={working} onClick={() => remove(member.email)}>Remove</button> : <i/>}</div>)}</div></article></section></div>;
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
function CashflowModal({ draft, editing, accounts, onChange, onClose, onSave, onRemove }: { draft: CashflowDraft; editing: boolean; accounts: DebtAccount[]; onChange: (draft: CashflowDraft) => void; onClose: () => void; onSave: () => void; onRemove: () => void }) {
  const creditAccounts = accounts.filter((account) => account.type === "Credit card");
  const needsCreditAccount = draft.kind === "expense" && draft.paymentMethod === "credit";
  const canSave = Boolean(draft.name.trim()) && draft.amount > 0 && (!needsCreditAccount || Boolean(draft.creditAccountId));
  const changeKind = (kind: CashflowKind) => onChange({ ...draft, kind, category: CASHFLOW_CATEGORIES[kind][0], paymentMethod: kind === "expense" ? draft.paymentMethod : "debit", creditAccountId: kind === "expense" ? draft.creditAccountId : "" });
  const title = draft.kind === "income" ? "income" : draft.kind === "expense" ? "recurring expense" : "set-aside budget";
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal cashflow-modal" role="dialog" aria-modal="true" aria-labelledby="cashflow-modal-title"><header><div><span>{editing ? `Edit ${title}` : `New ${title}`}</span><h2 id="cashflow-modal-title">{editing ? draft.name || "Monthly item" : `Add ${title}`}</h2><p>Monthly planning data stays on this device and can be changed anytime.</p></div><button type="button" onClick={onClose} aria-label="Close monthly item form">×</button></header><div className="form-grid"><div className="wide kind-editor"><span>Item type</span><div>{(["income", "expense", "budget"] as CashflowKind[]).map((kind) => <button type="button" key={kind} className={draft.kind === kind ? `active ${kind}` : kind} onClick={() => changeKind(kind)}>{kind === "income" ? "Income" : kind === "expense" ? "Expense" : "Budget"}</button>)}</div></div><label className="wide"><span>Name</span><input autoFocus value={draft.name} placeholder={draft.kind === "income" ? "Example: Salary" : draft.kind === "expense" ? "Example: Electric bill" : "Example: Emergency fund"} onChange={(event) => onChange({ ...draft, name: event.target.value })}/></label><Field label={draft.kind === "budget" ? "Budget amount" : "Monthly amount"} prefix="$" value={draft.amount} placeholder="0" onChange={(amount) => onChange({ ...draft, amount })}/><label><span>Category</span><select value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value })}>{CASHFLOW_CATEGORIES[draft.kind].map((category) => <option key={category}>{category}</option>)}</select></label>{draft.kind === "expense" && <div className="wide payment-editor"><span>Paid with</span><div><button type="button" className={draft.paymentMethod === "debit" ? "active" : ""} onClick={() => onChange({ ...draft, paymentMethod: "debit", creditAccountId: "" })}><i>DB</i><span>Debit</span><small>Paid from checking</small></button><button type="button" className={draft.paymentMethod === "credit" ? "active" : ""} onClick={() => onChange({ ...draft, paymentMethod: "credit" })}><i>CC</i><span>Credit</span><small>Charged to a card</small></button></div></div>}{needsCreditAccount && <label className="wide credit-account-field"><span>Credit card</span><select value={draft.creditAccountId} onChange={(event) => onChange({ ...draft, creditAccountId: event.target.value })}><option value="">Select the card used for this expense</option>{creditAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select><small>{creditAccounts.length ? "This links the recurring expense to the card you use." : "Add a credit card under Debt Accounts before assigning this expense to credit."}</small></label>}</div><footer>{editing ? <button className="danger" type="button" onClick={onRemove}>Remove item</button> : <span/>}<div><button className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="button" disabled={!canSave} onClick={onSave}>{editing ? "Save changes" : "Add monthly item"}</button></div></footer></section></div>;
}
function AccountModal({ draft, editing, onChange, onClose, onSave, onRemove }: { draft: AccountDraft; editing: boolean; onChange: (draft: AccountDraft) => void; onClose: () => void; onSave: () => void; onRemove: () => void }) {
  const autoMinimum = estimatedMinimum(draft.balance, draft.apr);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title"><header><div><span>{editing ? "Edit debt account" : "New debt account"}</span><h2 id="account-modal-title">{editing ? draft.name || "Account details" : "Add a debt account"}</h2><p>Enter the current lender details. You can update them anytime.</p></div><button type="button" onClick={onClose} aria-label="Close account form">×</button></header><div className="form-grid"><label className="wide"><span>Name</span><input autoFocus value={draft.name} placeholder="Example: Everyday Rewards" onChange={(event) => onChange({ ...draft, name: event.target.value })}/></label><label><span>Debt type</span><select value={draft.type} onChange={(event) => onChange({ ...draft, type: event.target.value as DebtType })}>{DEBT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><Field label="Current balance" prefix="$" value={draft.balance} placeholder="0" onChange={(balance) => onChange({ ...draft, balance })}/><Field label="APR" suffix="%" value={draft.apr} placeholder="0.00" step=".01" onChange={(apr) => onChange({ ...draft, apr })}/><div><Field label="Actual interest fee" prefix="$" value={draft.interestFee} placeholder="Optional" step=".01" onChange={(interestFee) => onChange({ ...draft, interestFee })}/><small className="field-help">Leave blank to estimate from balance × APR ÷ 12.</small></div><div className="minimum-editor"><div><span>Minimum payment</span><button type="button" className={draft.minimumMode === "auto" ? "mode active" : "mode"} onClick={() => onChange({ ...draft, minimumMode: draft.minimumMode === "auto" ? "manual" : "auto" })}>{draft.minimumMode === "auto" ? "Auto estimate" : "Use auto"}</button></div><Field prefix="$" value={draft.minimumMode === "auto" ? autoMinimum : draft.minimum} placeholder="0" disabled={draft.minimumMode === "auto"} onChange={(minimum) => onChange({ ...draft, minimum })}/><small>{draft.minimumMode === "auto" ? "1% of balance + monthly interest, with a $25 floor." : "Using your lender amount."}</small></div><Field label="Credit limit" prefix="$" value={draft.creditLimit} placeholder="Optional" onChange={(creditLimit) => onChange({ ...draft, creditLimit })}/><label><span>Next due date</span><input type="date" value={draft.dueDate} onChange={(event) => onChange({ ...draft, dueDate: event.target.value })}/></label></div><footer>{editing ? <button className="danger" type="button" onClick={onRemove}>Remove account</button> : <span/>}<div><button className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="button" disabled={!draft.name.trim()} onClick={onSave}>{editing ? "Save changes" : "Add account"}</button></div></footer></section></div>;
}
function Field({ label, prefix, suffix, value, placeholder, step, disabled, onChange }: { label?: string; prefix?: string; suffix?: string; value: number; placeholder: string; step?: string; disabled?: boolean; onChange: (value: number) => void }) { return <label>{label && <span>{label}</span>}<div className="field-input">{prefix && <b>{prefix}</b>}<input type="number" min="0" step={step} inputMode="decimal" disabled={disabled} value={value || ""} placeholder={placeholder} onChange={(event) => onChange(number(event.target.value))}/>{suffix && <b>{suffix}</b>}</div></label>; }