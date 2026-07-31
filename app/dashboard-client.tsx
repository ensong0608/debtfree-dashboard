"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
type TransactionType = "charge" | "payment" | "fee";
type Payee = { id: string; name: string; createdAt: string; deletedAt: string | null };
type LedgerTransaction = {
  id: string;
  date: string;
  accountId: string;
  payeeId: string;
  payeeName: string;
  type: TransactionType;
  category: string;
  memo: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
type TransactionDraft = Omit<LedgerTransaction, "id" | "createdAt" | "updatedAt" | "deletedAt">;
type PayoffSnapshot = {
  id: string;
  month: string;
  capturedAt: string;
  totalBalance: number;
  monthlyInterest: number;
  activeAccountCount: number;
  projectedDebtFreeMonth: string | null;
  note: string;
  accounts: { accountId: string; name: string; type: DebtType; balance: number; apr: number }[];
};
type PlanMonth = { month: number; interest: number; paid: number; remaining: number; payments: Record<string, number>; balances: Record<string, number>; paidOff: string[] };
type LinkedCardExpenses = Record<string, number>;
type LinkedCardExpenseItems = Record<string, CashflowItem[]>;
type DashboardPayload = { accounts: DebtAccount[]; monthlyBudgets: Record<string, CashflowItem[]>; payees: Payee[]; transactions: LedgerTransaction[]; snapshots: PayoffSnapshot[]; extra: number; strategy: PayoffStrategy };
type CloudStatus = "connecting" | "saving" | "synced" | "error";
type HouseholdMember = { email: string; display_name: string | null; role: "owner" | "admin"; status: "active" | "invited" };
type HouseholdResponse = { householdName: string; role: "owner" | "admin"; payload: DashboardPayload | null; revision: number; members: HouseholdMember[] };

function normalizedPayload(value: unknown): DashboardPayload {
  const parsed = value && typeof value === "object" ? value as Partial<DashboardPayload> & { cashflowItems?: CashflowItem[] } : {};
  const accounts = Array.isArray(parsed.accounts) ? parsed.accounts.map((account) => ({
    ...account,
    interestFee: Number.isFinite(account.interestFee) ? account.interestFee : 0,
    payoffMode: account.payoffMode === "minimum-only" ? "minimum-only" as const : "priority" as const,
  })) : [];
  const normalizeCashflow = (items: CashflowItem[]) => items.map((item) => ({
    ...item,
    paymentMethod: item.kind === "expense" && item.paymentMethod === "credit" ? "credit" as const : "debit" as const,
    creditAccountId: typeof item.creditAccountId === "string" ? item.creditAccountId : "",
  }));
  const monthlyBudgets = parsed.monthlyBudgets && typeof parsed.monthlyBudgets === "object"
    ? Object.fromEntries(Object.entries(parsed.monthlyBudgets).filter(([, items]) => Array.isArray(items)).map(([month, items]) => [month, normalizeCashflow(items as CashflowItem[])]))
    : Array.isArray(parsed.cashflowItems) ? { [currentMonthKey()]: normalizeCashflow(parsed.cashflowItems) } : {};
  const payees = Array.isArray(parsed.payees) ? parsed.payees.filter((payee) => payee && typeof payee.name === "string").map((payee) => ({ ...payee, deletedAt: payee.deletedAt ?? null })) : [];
  const transactions = Array.isArray(parsed.transactions) ? parsed.transactions.filter((transaction) => transaction && typeof transaction.accountId === "string").map((transaction) => ({ ...transaction, payeeName: transaction.payeeName ?? "", memo: transaction.memo ?? "", category: transaction.category ?? "Other", updatedAt: transaction.updatedAt ?? transaction.createdAt, deletedAt: transaction.deletedAt ?? null })) : [];
  const snapshots = Array.isArray(parsed.snapshots) ? parsed.snapshots.filter((snapshot) => snapshot && typeof snapshot.month === "string" && Array.isArray(snapshot.accounts)).map((snapshot) => ({ ...snapshot, note: snapshot.note ?? "", projectedDebtFreeMonth: snapshot.projectedDebtFreeMonth ?? null, monthlyInterest: Number.isFinite(snapshot.monthlyInterest) ? snapshot.monthlyInterest : 0 })) : [];
  return {
    accounts,
    monthlyBudgets,
    payees,
    transactions,
    snapshots,
    extra: Number.isFinite(parsed.extra) ? parsed.extra ?? 0 : 0,
    strategy: parsed.strategy === "snowball" ? "snowball" : "avalanche",
  };
}

function hasMeaningfulData(payload: DashboardPayload) {
  return payload.accounts.length > 0 || Object.values(payload.monthlyBudgets).some((items) => items.length > 0) || payload.payees.length > 0 || payload.transactions.length > 0 || payload.snapshots.length > 0 || payload.extra > 0;
}

const STORAGE_KEY = "debtfree-dashboard-prototype-v1";
const STORAGE_BACKUP_KEY = "debtfree-dashboard-prototype-v1-backup";
const EMPTY_DRAFT: AccountDraft = { name: "", type: "Credit card", balance: 0, apr: 0, interestFee: 0, minimum: 0, minimumMode: "auto", payoffMode: "priority", creditLimit: 0, dueDate: "" };
const EMPTY_CASHFLOW_DRAFT: CashflowDraft = { name: "", kind: "expense", category: "Housing", amount: 0, paymentMethod: "debit", creditAccountId: "" };
const TRANSACTION_CATEGORIES = ["Shopping", "Food", "Housing", "Transportation", "Utilities", "Health", "Debt payment", "Interest & fees", "Other"];
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
function currentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function dateInputValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function shiftMonth(month: string, offset: number) {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(year, index - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(month: string) {
  const [year, index] = month.split("-").map(Number);
  return new Date(year, index - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function emptyTransactionDraft(accounts: DebtAccount[]): TransactionDraft {
  return { date: dateInputValue(), accountId: accounts[0]?.id ?? "", payeeId: "", payeeName: "", type: "charge", category: "Other", memo: "", amount: 0 };
}
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

const NAV_ITEMS: { id: PageId; label: string; icon: string }[] = [
  { id: "dashboard", label: "Monthly Budget", icon: "⌂" },
  { id: "accounts", label: "Debt Accounts", icon: "▤" },
  { id: "history", label: "Transactions", icon: "↻" },
  { id: "plan", label: "Payoff Plan", icon: "✓" },
  { id: "snapshots", label: "Payoff Snapshots", icon: "◉" },
  { id: "utilization", label: "Credit Utilization", icon: "◔" },
  { id: "stats", label: "Stats & Projections", icon: "↗" },
  { id: "profile", label: "My Account", icon: "⚙" },
];

export default function DashboardClient({ user }: { user: ChatGPTUser }) {
  const cloudWritesEnabled = useRef(false);
  const [page, setPage] = useState<PageId>("dashboard");
  const [accounts, setAccounts] = useState<DebtAccount[]>([]);
  const [monthlyBudgets, setMonthlyBudgets] = useState<Record<string, CashflowItem[]>>({});
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [payees, setPayees] = useState<Payee[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [snapshots, setSnapshots] = useState<PayoffSnapshot[]>([]);
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
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [transactionDraft, setTransactionDraft] = useState<TransactionDraft>(() => emptyTransactionDraft([]));
  const [payeeModalOpen, setPayeeModalOpen] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("connecting");
  const [householdName, setHouseholdName] = useState("My household");
  const [householdRole, setHouseholdRole] = useState<"owner" | "admin">("owner");
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);

  useEffect(() => {
    let cancelled = false;
    const applyPayload = (payload: DashboardPayload) => {
      setAccounts(payload.accounts);
      setMonthlyBudgets(payload.monthlyBudgets);
      setPayees(payload.payees);
      setTransactions(payload.transactions);
      setSnapshots(payload.snapshots);
      setExtra(payload.extra);
      setStrategy(payload.strategy);
    };
    const load = async () => {
      let localPayload: DashboardPayload | null = null;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const backup = localStorage.getItem(STORAGE_BACKUP_KEY);
        const primaryPayload = saved ? normalizedPayload(JSON.parse(saved)) : null;
        const backupPayload = backup ? normalizedPayload(JSON.parse(backup)) : null;
        if (primaryPayload && hasMeaningfulData(primaryPayload)) localPayload = primaryPayload;
        else if (backupPayload && hasMeaningfulData(backupPayload)) {
          localPayload = backupPayload;
          setImportMessage("Recovered your most recent device backup.");
        } else localPayload = primaryPayload;
        if (localPayload) applyPayload(localPayload);
      } catch { /* Keep going so a damaged local draft cannot block cloud data. */ }
      try {
        const response = await fetch("/api/household", { cache: "no-store" });
        const data = await response.json() as HouseholdResponse & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Cloud storage is unavailable");
        if (cancelled) return;
        setHouseholdName(data.householdName);
        setHouseholdRole(data.role);
        setHouseholdMembers(data.members);
        const cloudPayload = data.payload ? normalizedPayload(data.payload) : null;
        const localHasData = localPayload ? hasMeaningfulData(localPayload) : false;
        const cloudHasData = cloudPayload ? hasMeaningfulData(cloudPayload) : false;
        if (cloudHasData && cloudPayload) {
          cloudWritesEnabled.current = true;
          applyPayload(cloudPayload);
        } else if (localHasData && localPayload) {
          cloudWritesEnabled.current = true;
          applyPayload(localPayload);
          const upload = await fetch("/api/household", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload: localPayload }) });
          if (!upload.ok) throw new Error("Your existing device data could not be copied to the household yet");
        } else if (cloudPayload) {
          applyPayload(cloudPayload);
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
    const payload: DashboardPayload = { accounts, monthlyBudgets, payees, transactions, snapshots, extra, strategy };
    if (hasMeaningfulData(payload)) cloudWritesEnabled.current = true;
    if (!cloudWritesEnabled.current) return;
    const serialized = JSON.stringify(payload);
    try {
      const previous = localStorage.getItem(STORAGE_KEY);
      if (previous && previous !== serialized) {
        const previousPayload = normalizedPayload(JSON.parse(previous));
        if (hasMeaningfulData(previousPayload)) localStorage.setItem(STORAGE_BACKUP_KEY, previous);
      }
    } catch { /* A damaged old draft should not block the current safe save. */ }
    localStorage.setItem(STORAGE_KEY, serialized);
    const syncTimer = window.setTimeout(() => {
      setCloudStatus("saving");
      void fetch("/api/household", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload }) })
        .then((response) => { if (!response.ok) throw new Error("Sync failed"); setCloudStatus("synced"); })
        .catch(() => setCloudStatus("error"));
    }, 650);
    return () => window.clearTimeout(syncTimer);
  }, [accounts, extra, loaded, monthlyBudgets, payees, snapshots, strategy, transactions]);
  useEffect(() => {
    if (!modalOpen && !cashflowModalOpen && !transactionModalOpen && !payeeModalOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setModalOpen(false); setCashflowModalOpen(false); setTransactionModalOpen(false); setPayeeModalOpen(false); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [cashflowModalOpen, modalOpen, payeeModalOpen, transactionModalOpen]);

  const cashflowItems = useMemo(() => monthlyBudgets[selectedMonth] ?? [], [monthlyBudgets, selectedMonth]);
  const planningCashflowItems = useMemo(() => monthlyBudgets[currentMonthKey()] ?? [], [monthlyBudgets]);
  const setCashflowItems = (update: CashflowItem[] | ((current: CashflowItem[]) => CashflowItem[])) => setMonthlyBudgets((current) => {
    const items = current[selectedMonth] ?? [];
    const next = typeof update === "function" ? update(items) : update;
    return { ...current, [selectedMonth]: next };
  });
  const activeTransactions = useMemo(() => transactions.filter((transaction) => !transaction.deletedAt), [transactions]);
  const calculatedAccounts = useMemo(() => accounts.map((account) => ({
    ...account,
    balance: Math.max(0, round(account.balance + activeTransactions.filter((transaction) => transaction.accountId === account.id).reduce((sum, transaction) => sum + (transaction.type === "payment" ? -transaction.amount : transaction.amount), 0))),
  })), [accounts, activeTransactions]);
  const totalBalance = useMemo(() => calculatedAccounts.reduce((sum, account) => sum + account.balance, 0), [calculatedAccounts]);
  const activeCount = useMemo(() => calculatedAccounts.filter((account) => account.balance > 0).length, [calculatedAccounts]);
  const minimums = useMemo(() => calculatedAccounts.reduce((sum, account) => sum + effectiveMinimum(account), 0), [calculatedAccounts]);
  const interest = useMemo(() => calculatedAccounts.reduce((sum, account) => sum + monthlyInterest(account), 0), [calculatedAccounts]);
  const monthlySurplus = useMemo(() => planningCashflowItems.reduce((sum, item) => sum + (item.kind === "income" ? item.amount : -item.amount), 0), [planningCashflowItems]);
  const linkedCardExpenseItems = useMemo(() => planningCashflowItems.reduce<LinkedCardExpenseItems>((items, item) => {
    if (item.kind === "expense" && item.paymentMethod === "credit" && item.creditAccountId) {
      (items[item.creditAccountId] ??= []).push(item);
    }
    return items;
  }, {}), [planningCashflowItems]);
  const linkedCardExpenses = useMemo(() => Object.fromEntries(Object.entries(linkedCardExpenseItems).map(([accountId, items]) => [accountId, round(items.reduce((sum, item) => sum + item.amount, 0))])), [linkedCardExpenseItems]);
  const availableExtra = useMemo(() => Math.max(0, round(monthlySurplus - minimums)), [minimums, monthlySurplus]);
  const plan = useMemo(() => calculatePlan(calculatedAccounts, extra, strategy, linkedCardExpenses), [calculatedAccounts, extra, linkedCardExpenses, strategy]);
  const paidOffById = useMemo(() => new Map(calculatedAccounts.map((account) => {
    const month = plan.months.find((entry) => entry.paidOff.includes(account.name))?.month;
    return [account.id, month ?? individualPayoffMonths(account)];
  })), [calculatedAccounts, plan.months]);
  const sortedAccounts = useMemo(() => [...calculatedAccounts].sort((a, b) => {
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
  }), [calculatedAccounts, linkedCardExpenses, paidOffById, sortDirection, sortKey]);

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
    const stored = accounts.find((item) => item.id === account.id) ?? account;
    setEditingId(stored.id);
    setDraft({ name: stored.name, type: stored.type, balance: stored.balance, apr: stored.apr, interestFee: stored.interestFee, minimum: stored.minimum, minimumMode: stored.minimumMode, payoffMode: stored.payoffMode, creditLimit: stored.creditLimit, dueDate: stored.dueDate });
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

  const copyPreviousBudget = () => {
    const sourceMonth = shiftMonth(selectedMonth, -1);
    const source = monthlyBudgets[sourceMonth] ?? [];
    setMonthlyBudgets((current) => ({ ...current, [selectedMonth]: source.map((item) => ({ ...item, id: `${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString() })) }));
  };
  const startBlankBudget = () => setMonthlyBudgets((current) => ({ ...current, [selectedMonth]: [] }));
  const openNewTransaction = () => {
    setEditingTransactionId(null);
    setTransactionDraft(emptyTransactionDraft(calculatedAccounts));
    setTransactionModalOpen(true);
  };
  const openEditTransaction = (transaction: LedgerTransaction) => {
    setEditingTransactionId(transaction.id);
    setTransactionDraft({ date: transaction.date, accountId: transaction.accountId, payeeId: transaction.payeeId, payeeName: transaction.payeeName, type: transaction.type, category: transaction.category, memo: transaction.memo, amount: transaction.amount });
    setTransactionModalOpen(true);
  };
  const saveTransaction = () => {
    if (!transactionDraft.accountId || !transactionDraft.date || transactionDraft.amount <= 0 || !transactionDraft.payeeName.trim()) return;
    const now = new Date().toISOString();
    let matchedPayee = payees.find((payee) => !payee.deletedAt && payee.name.toLowerCase() === transactionDraft.payeeName.trim().toLowerCase());
    if (!matchedPayee) {
      matchedPayee = { id: `payee-${Date.now()}-${Math.random()}`, name: transactionDraft.payeeName.trim(), createdAt: now, deletedAt: null };
      setPayees((current) => [...current, matchedPayee as Payee]);
    }
    const normalized = { ...transactionDraft, payeeId: matchedPayee.id, payeeName: matchedPayee.name, memo: transactionDraft.memo.trim() };
    if (editingTransactionId) setTransactions((current) => current.map((transaction) => transaction.id === editingTransactionId ? { ...transaction, ...normalized, updatedAt: now } : transaction));
    else setTransactions((current) => [...current, { ...normalized, id: `transaction-${Date.now()}-${Math.random()}`, createdAt: now, updatedAt: now, deletedAt: null }]);
    setTransactionModalOpen(false);
  };
  const softDeleteTransaction = (id: string) => {
    if (!confirm("Move this transaction to deleted items? You can restore it later.")) return;
    const now = new Date().toISOString();
    setTransactions((current) => current.map((transaction) => transaction.id === id ? { ...transaction, deletedAt: now, updatedAt: now } : transaction));
    setTransactionModalOpen(false);
  };
  const restoreTransaction = (id: string) => setTransactions((current) => current.map((transaction) => transaction.id === id ? { ...transaction, deletedAt: null, updatedAt: new Date().toISOString() } : transaction));
  const addBatchTransactions = (drafts: TransactionDraft[]) => {
    const valid = drafts.filter((draft) => draft.accountId && draft.date && draft.payeeName.trim() && draft.amount > 0);
    if (!valid.length) return;
    const now = new Date().toISOString();
    const known = new Map(payees.filter((payee) => !payee.deletedAt).map((payee) => [payee.name.toLowerCase(), payee]));
    const addedPayees: Payee[] = [];
    const addedTransactions = valid.map((draft, index) => {
      const key = draft.payeeName.trim().toLowerCase();
      let payee = known.get(key);
      if (!payee) {
        payee = { id: `payee-${Date.now()}-${index}-${Math.random()}`, name: draft.payeeName.trim(), createdAt: now, deletedAt: null };
        known.set(key, payee);
        addedPayees.push(payee);
      }
      return { ...draft, payeeId: payee.id, payeeName: payee.name, memo: draft.memo.trim(), id: `transaction-${Date.now()}-${index}-${Math.random()}`, createdAt: now, updatedAt: now, deletedAt: null };
    });
    if (addedPayees.length) setPayees((current) => [...current, ...addedPayees]);
    setTransactions((current) => [...current, ...addedTransactions]);
  };
  const addPayee = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || payees.some((payee) => !payee.deletedAt && payee.name.toLowerCase() === trimmed.toLowerCase())) return;
    setPayees((current) => [...current, { id: `payee-${Date.now()}-${Math.random()}`, name: trimmed, createdAt: new Date().toISOString(), deletedAt: null }]);
  };
  const renamePayee = (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPayees((current) => current.map((payee) => payee.id === id ? { ...payee, name: trimmed } : payee));
    setTransactions((current) => current.map((transaction) => transaction.payeeId === id ? { ...transaction, payeeName: trimmed, updatedAt: new Date().toISOString() } : transaction));
  };
  const deletePayee = (id: string) => setPayees((current) => current.map((payee) => payee.id === id ? { ...payee, deletedAt: new Date().toISOString() } : payee));
  const captureSnapshot = (note: string) => {
    if (!calculatedAccounts.length) return;
    const month = currentMonthKey();
    const now = new Date().toISOString();
    const projectedDebtFreeMonth = plan.months.length && !plan.stalled ? monthAfter(plan.months.length - 1) : null;
    setSnapshots((current) => {
      const existing = current.find((snapshot) => snapshot.month === month);
      const next: PayoffSnapshot = {
        id: existing?.id ?? `snapshot-${Date.now()}-${Math.random()}`,
        month,
        capturedAt: now,
        totalBalance,
        monthlyInterest: interest,
        activeAccountCount: activeCount,
        projectedDebtFreeMonth,
        note: note.trim(),
        accounts: calculatedAccounts.map((account) => ({ accountId: account.id, name: account.name, type: account.type, balance: account.balance, apr: account.apr })),
      };
      return existing ? current.map((snapshot) => snapshot.id === existing.id ? next : snapshot) : [...current, next];
    });
  };
  const updateSnapshotNote = (id: string, note: string) => setSnapshots((current) => current.map((snapshot) => snapshot.id === id ? { ...snapshot, note: note.trim() } : snapshot));
  const removeSnapshot = (id: string) => {
    const snapshot = snapshots.find((item) => item.id === id);
    if (!confirm(`Delete the ${snapshot ? monthLabel(snapshot.month) : ""} payoff snapshot?`)) return;
    setSnapshots((current) => current.filter((item) => item.id !== id));
  };
  const closeDashboard = () => {
    try {
      window.open("", "_self");
      window.close();
    } catch { /* Some mobile browsers do not allow scripts to close an existing tab. */ }
    window.setTimeout(() => {
      if (document.visibilityState === "visible") window.location.assign("https://chatgpt.com/");
    }, 250);
  };
  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" type="button" onClick={() => setPage("dashboard")}><span>DF</span><div><strong>DebtFree</strong><small>Dashboard</small></div></button>
      <nav aria-label="Dashboard sections">{NAV_ITEMS.map((item) => <button type="button" key={item.id} className={page === item.id ? "nav-item active" : "nav-item"} onClick={() => setPage(item.id)}><i>{item.icon}</i><span>{item.label}</span></button>)}</nav>
      <div className="sidebar-foot"><span>{householdName}</span><strong>{cloudStatus === "synced" ? "Shared household data" : cloudStatus === "error" ? "Device backup active" : "Syncing changes"}</strong></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div><span className="mobile-product">DebtFree Dashboard</span><strong>{NAV_ITEMS.find((item) => item.id === page)?.label}</strong></div><div className="top-actions"><span className={`save-state ${cloudStatus}`}><i/> {cloudStatus === "synced" ? "Household saved" : cloudStatus === "error" ? "Saved on device" : "Saving"}</span><button className="close-dashboard" type="button" onClick={closeDashboard} aria-label="Close dashboard"><span>Close dashboard</span><b aria-hidden="true">x</b></button><button className="avatar" type="button" onClick={() => setPage("profile")} aria-label="Open My Account">{user.displayName.slice(0,2).toUpperCase()}</button></div></header>
      <div className="page-body">
        {page === "dashboard" && <DashboardPage month={selectedMonth} hasMonth={Object.prototype.hasOwnProperty.call(monthlyBudgets, selectedMonth)} previousHasItems={(monthlyBudgets[shiftMonth(selectedMonth, -1)] ?? []).length > 0} items={cashflowItems} accounts={calculatedAccounts} onMonth={setSelectedMonth} onCopyPrevious={copyPreviousBudget} onStartBlank={startBlankBudget} onAdd={openNewCashflow} onEdit={openEditCashflow}/>}
        {page === "accounts" && <AccountsPage accounts={sortedAccounts} activeCount={activeCount} totalBalance={totalBalance} minimums={minimums} interest={interest} linkedCardExpenses={linkedCardExpenses} sortKey={sortKey} sortDirection={sortDirection} paidOffById={paidOffById} onSort={changeSort} onAdd={openNew} onEdit={openEdit} onToggleMinimum={toggleMinimumMode} onTogglePayoff={togglePayoffMode} onSample={() => setAccounts(SAMPLE_ACCOUNTS)} onImport={importDebtFreeCsv} importMessage={importMessage}/>}
        {page === "history" && <TransactionsPage accounts={calculatedAccounts} payees={payees} transactions={transactions} onQuickAdd={openNewTransaction} onEdit={openEditTransaction} onDelete={softDeleteTransaction} onRestore={restoreTransaction} onBatchAdd={addBatchTransactions} onManagePayees={() => setPayeeModalOpen(true)}/>}
        {page === "plan" && <PayoffPlanPage accounts={calculatedAccounts} plan={plan} extra={extra} availableExtra={availableExtra} strategy={strategy} linkedCardExpenseItems={linkedCardExpenseItems} onExtra={setExtra} onStrategy={setStrategy} onAccounts={() => setPage("accounts")} onEditAccount={openEdit}/>}
        {page === "snapshots" && <SnapshotsPage accounts={calculatedAccounts} snapshots={snapshots} currentInterest={interest} onCapture={captureSnapshot} onUpdateNote={updateSnapshotNote} onDelete={removeSnapshot}/>}
        {page === "profile" && <ProfilePage user={user} householdName={householdName} role={householdRole} members={householdMembers} cloudStatus={cloudStatus} onInvite={inviteAdmin} onRemove={removeAdmin}/>}
        {page === "utilization" && <UtilizationPage accounts={calculatedAccounts} onEditAccount={openEdit}/>}
        {page === "stats" && <StatsPage accounts={calculatedAccounts} snapshots={snapshots} transactions={transactions} extra={extra} strategy={strategy} linkedCardExpenses={linkedCardExpenses}/>}
      </div>
    </main>

    {modalOpen && <AccountModal draft={draft} editing={Boolean(editingId)} onChange={setDraft} onClose={() => setModalOpen(false)} onSave={saveAccount} onRemove={removeAccount}/>}
    {cashflowModalOpen && <CashflowModal draft={cashflowDraft} editing={Boolean(editingCashflowId)} accounts={calculatedAccounts} onChange={setCashflowDraft} onClose={() => setCashflowModalOpen(false)} onSave={saveCashflow} onRemove={removeCashflow}/>}
    {transactionModalOpen && <TransactionModal draft={transactionDraft} editing={Boolean(editingTransactionId)} accounts={calculatedAccounts} payees={payees} onChange={setTransactionDraft} onClose={() => setTransactionModalOpen(false)} onSave={saveTransaction} onRemove={() => editingTransactionId && softDeleteTransaction(editingTransactionId)}/>}
    {payeeModalOpen && <PayeeModal payees={payees} onAdd={addPayee} onRename={renamePayee} onDelete={deletePayee} onClose={() => setPayeeModalOpen(false)}/>}
  </div>;
}

function DashboardPage({ month, hasMonth, previousHasItems, items, accounts, onMonth, onCopyPrevious, onStartBlank, onAdd, onEdit }: { month: string; hasMonth: boolean; previousHasItems: boolean; items: CashflowItem[]; accounts: DebtAccount[]; onMonth: (month: string) => void; onCopyPrevious: () => void; onStartBlank: () => void; onAdd: (kind: CashflowKind) => void; onEdit: (item: CashflowItem) => void }) {
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
  const isCurrent = month === currentMonthKey();
  const detail = (item: CashflowItem) => {
    if (item.kind !== "expense") return item.category;
    if (item.paymentMethod === "debit") return `${item.category} ? Debit`;
    return `${item.category} ? Credit ? ${creditNames.get(item.creditAccountId) ?? "Card not selected"}`;
  };

  return <div className="screen dashboard-screen monthly-screen">
    <div className="screen-title monthly-title"><div><span className="eyebrow">{isCurrent ? "Current monthly budget" : "Monthly budget archive"}</span><h1>Monthly Budget</h1><p>Plan each month separately, then copy the previous plan or start fresh when a new month begins.</p></div><div className="cashflow-quick-actions"><button className="income-action" type="button" onClick={() => onAdd("income")}>+ Add income</button><button className="expense-action" type="button" onClick={() => onAdd("expense")}>+ Add expense</button><button className="budget-action" type="button" onClick={() => onAdd("budget")}>+ Add budget</button></div></div>
    <section className="month-switcher" aria-label="Select budget month"><button type="button" onClick={() => onMonth(shiftMonth(month, -1))} aria-label="Previous month">?</button><div><span>{isCurrent ? "Current month" : "Budget month"}</span><strong>{monthLabel(month)}</strong></div><button type="button" onClick={() => onMonth(shiftMonth(month, 1))} aria-label="Next month">?</button><button className="today-month" type="button" disabled={isCurrent} onClick={() => onMonth(currentMonthKey())}>This month</button></section>
    {!hasMonth ? <section className="month-start-card"><span>New month</span><h2>Set up {monthLabel(month)}</h2><p>This month does not have a budget yet. Carry forward last month?s income, expenses, and set-asides, or begin with a clean plan.</p><div>{previousHasItems && <button className="primary" type="button" onClick={onCopyPrevious}>Copy {monthLabel(shiftMonth(month, -1))}</button>}<button className="secondary" type="button" onClick={onStartBlank}>Start with no entries</button></div></section> : <>
      <section className="monthly-summary-strip" aria-label="Monthly totals"><div><span>Income</span><strong>{moneyPrecise.format(totalIncome)}</strong></div><div><span>Expenses</span><strong>{moneyPrecise.format(totalExpenses)}</strong></div><div><span>Budget</span><strong>{moneyPrecise.format(totalBudget)}</strong></div><div className={available >= 0 ? "available positive" : "available negative"}><span>Available</span><strong>{moneyPrecise.format(available)}</strong></div></section>
      <section className="cashflow-columns" aria-label="Income, expenses, and budget">
        {kinds.map(({ kind, title, empty }) => {
          const columnItems = items.filter((item) => item.kind === kind).sort((a, b) => b.amount - a.amount);
          return <article className={`cashflow-column ${kind}`} key={kind}><header><div><span>{title}</span><small>{columnItems.length} {columnItems.length === 1 ? "item" : "items"}</small></div><strong>{moneyPrecise.format(totalFor(kind))}</strong></header>{columnItems.length ? <div className="cashflow-column-list">{columnItems.map((item) => <button type="button" key={item.id} onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`}><div><strong>{item.name}</strong><small>{detail(item)}</small></div><b>{moneyPrecise.format(item.amount)}</b></button>)}</div> : <div className="cashflow-column-empty"><span>{kind === "income" ? "$" : kind === "expense" ? "?" : "?"}</span><strong>No {title.toLowerCase()} yet</strong><p>{empty}</p></div>}</article>;
        })}
      </section>
    </>}
  </div>;
}
function TransactionsPage({ accounts, payees, transactions, onQuickAdd, onEdit, onDelete, onRestore, onBatchAdd, onManagePayees }: { accounts: DebtAccount[]; payees: Payee[]; transactions: LedgerTransaction[]; onQuickAdd: () => void; onEdit: (transaction: LedgerTransaction) => void; onDelete: (id: string) => void; onRestore: (id: string) => void; onBatchAdd: (drafts: TransactionDraft[]) => void; onManagePayees: () => void }) {
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "deleted" | "all">("active");
  const [pageNumber, setPageNumber] = useState(1);
  const [batchOpen, setBatchOpen] = useState(false);
  const makeRows = () => Array.from({ length: 5 }, () => emptyTransactionDraft(accounts));
  const [batchRows, setBatchRows] = useState<TransactionDraft[]>(makeRows);
  const accountNames = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
  const filtered = useMemo(() => transactions.filter((transaction) => {
    const needle = search.trim().toLowerCase();
    const matchesSearch = !needle || [transaction.payeeName, transaction.memo, transaction.category, accountNames.get(transaction.accountId) ?? ""].some((value) => value.toLowerCase().includes(needle));
    const matchesAccount = accountFilter === "all" || transaction.accountId === accountFilter;
    const matchesType = typeFilter === "all" || transaction.type === typeFilter;
    const matchesStatus = statusFilter === "all" || (statusFilter === "deleted" ? Boolean(transaction.deletedAt) : !transaction.deletedAt);
    return matchesSearch && matchesAccount && matchesType && matchesStatus;
  }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [accountFilter, accountNames, search, statusFilter, transactions, typeFilter]);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(pageNumber, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const active = transactions.filter((transaction) => !transaction.deletedAt);
  const charges = active.filter((transaction) => transaction.type !== "payment").reduce((sum, transaction) => sum + transaction.amount, 0);
  const payments = active.filter((transaction) => transaction.type === "payment").reduce((sum, transaction) => sum + transaction.amount, 0);
  const updateBatch = (index: number, patch: Partial<TransactionDraft>) => setBatchRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const submitBatch = () => { onBatchAdd(batchRows); setBatchRows(makeRows()); setBatchOpen(false); };
  const formatTransactionDate = (value: string) => { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };

  return <div className="screen ledger-screen">
    <div className="screen-title"><div><span className="eyebrow">Core transaction ledger</span><h1>Transactions</h1><p>Record charges, fees, and payments. Every active entry is included in the calculated account balances below.</p></div><div className="screen-actions ledger-actions"><button className="secondary" type="button" onClick={onManagePayees}>Payees</button><button className="secondary" type="button" disabled={!accounts.length} onClick={() => { setBatchRows(makeRows()); setBatchOpen((open) => !open); }}>Batch entry</button><button className="primary" type="button" disabled={!accounts.length} onClick={onQuickAdd}>+ Quick add</button></div></div>
    {!accounts.length ? <section className="large-empty"><span>Ledger</span><h2>Add a debt account first</h2><p>Transactions need an account so DebtFree can calculate how each charge, fee, or payment changes its balance.</p></section> : <>
      <section className="ledger-metrics"><article><span>Calculated debt</span><strong>{moneyPrecise.format(accounts.reduce((sum, account) => sum + account.balance, 0))}</strong><small>Opening balances plus active ledger entries</small></article><article><span>Charges & fees</span><strong className="charge">{moneyPrecise.format(charges)}</strong><small>Increase account balances</small></article><article><span>Payments</span><strong className="payment">{moneyPrecise.format(payments)}</strong><small>Reduce account balances</small></article><article><span>Payees</span><strong>{payees.filter((payee) => !payee.deletedAt).length}</strong><small>{transactions.filter((transaction) => transaction.deletedAt).length} deleted transactions retained</small></article></section>
      <section className="balance-strip" aria-label="Calculated account balances">{accounts.map((account) => <div key={account.id}><span>{account.name}</span><strong>{moneyPrecise.format(account.balance)}</strong><small>Calculated balance</small></div>)}</section>
      {batchOpen && <section className="batch-card"><div className="batch-head"><div><span>Batch entry</span><strong>Add several transactions at once</strong></div><button type="button" onClick={() => setBatchOpen(false)}>Close</button></div><div className="batch-scroll"><table className="batch-table"><thead><tr><th>Date</th><th>Account</th><th>Type</th><th>Payee</th><th>Amount</th><th>Memo</th></tr></thead><tbody>{batchRows.map((row, index) => <tr key={index}><td><input aria-label={`Row ${index + 1} date`} type="date" value={row.date} onChange={(event) => updateBatch(index, { date: event.target.value })}/></td><td><select aria-label={`Row ${index + 1} account`} value={row.accountId} onChange={(event) => updateBatch(index, { accountId: event.target.value })}><option value="">Select</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></td><td><select aria-label={`Row ${index + 1} type`} value={row.type} onChange={(event) => { const type = event.target.value as TransactionType; updateBatch(index, { type, category: type === "payment" ? "Debt payment" : type === "fee" ? "Interest & fees" : "Other" }); }}><option value="charge">Charge</option><option value="payment">Payment</option><option value="fee">Fee</option></select></td><td><input aria-label={`Row ${index + 1} payee`} list="batch-payees" value={row.payeeName} placeholder="Payee" onChange={(event) => updateBatch(index, { payeeName: event.target.value })}/></td><td><div className="batch-amount"><span>$</span><input aria-label={`Row ${index + 1} amount`} type="number" min="0" step=".01" value={row.amount || ""} placeholder="0.00" onChange={(event) => updateBatch(index, { amount: number(event.target.value) })}/></div></td><td><input aria-label={`Row ${index + 1} memo`} value={row.memo} placeholder="Optional" onChange={(event) => updateBatch(index, { memo: event.target.value })}/></td></tr>)}</tbody></table><datalist id="batch-payees">{payees.filter((payee) => !payee.deletedAt).map((payee) => <option key={payee.id} value={payee.name}/>)}</datalist></div><div className="batch-footer"><button className="secondary" type="button" onClick={() => setBatchRows((current) => [...current, emptyTransactionDraft(accounts)])}>+ Add row</button><button className="primary" type="button" disabled={!batchRows.some((row) => row.accountId && row.payeeName.trim() && row.amount > 0)} onClick={submitBatch}>Save batch</button></div></section>}
      <section className="ledger-card"><div className="ledger-toolbar"><label className="ledger-search"><span>Search</span><input value={search} placeholder="Payee, memo, category, or account" onChange={(event) => { setSearch(event.target.value); setPageNumber(1); }}/></label><label><span>Account</span><select value={accountFilter} onChange={(event) => { setAccountFilter(event.target.value); setPageNumber(1); }}><option value="all">All accounts</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label><span>Type</span><select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value as "all" | TransactionType); setPageNumber(1); }}><option value="all">All types</option><option value="charge">Charges</option><option value="payment">Payments</option><option value="fee">Fees</option></select></label><label><span>Status</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as "active" | "deleted" | "all"); setPageNumber(1); }}><option value="active">Active</option><option value="deleted">Deleted</option><option value="all">All</option></select></label></div>
        {visible.length ? <div className="ledger-table-scroll"><table className="ledger-table"><caption>Searchable transaction ledger</caption><thead><tr><th>Date</th><th>Payee</th><th>Account</th><th>Type</th><th>Category / memo</th><th>Amount</th><th>Action</th></tr></thead><tbody>{visible.map((transaction) => <tr key={transaction.id} className={transaction.deletedAt ? "deleted-row" : ""}><td>{formatTransactionDate(transaction.date)}</td><td><strong>{transaction.payeeName}</strong>{transaction.deletedAt && <small>Deleted</small>}</td><td>{accountNames.get(transaction.accountId) ?? "Removed account"}</td><td><span className={`transaction-type ${transaction.type}`}>{transaction.type}</span></td><td><strong>{transaction.category}</strong>{transaction.memo && <small>{transaction.memo}</small>}</td><td className={`ledger-amount ${transaction.type}`}>{transaction.type === "payment" ? "?" : "+"}{moneyPrecise.format(transaction.amount)}</td><td>{transaction.deletedAt ? <button className="restore-action" type="button" onClick={() => onRestore(transaction.id)}>Restore</button> : <div className="row-actions"><button type="button" onClick={() => onEdit(transaction)}>Edit</button><button type="button" onClick={() => onDelete(transaction.id)}>Delete</button></div>}</td></tr>)}</tbody></table></div> : <div className="ledger-empty"><strong>No matching transactions</strong><p>{transactions.length ? "Try changing the search or filters." : "Use Quick add or Batch entry to record your first transaction."}</p></div>}
        <div className="ledger-pagination"><span>{filtered.length ? `${(currentPage - 1) * pageSize + 1}?${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length}` : "0 transactions"}</span><div><button type="button" disabled={currentPage === 1} onClick={() => setPageNumber((page) => Math.max(1, page - 1))}>Previous</button><strong>Page {currentPage} of {pageCount}</strong><button type="button" disabled={currentPage === pageCount} onClick={() => setPageNumber((page) => Math.min(pageCount, page + 1))}>Next</button></div></div>
      </section>
    </>}
  </div>;
}

function TransactionModal({ draft, editing, accounts, payees, onChange, onClose, onSave, onRemove }: { draft: TransactionDraft; editing: boolean; accounts: DebtAccount[]; payees: Payee[]; onChange: (draft: TransactionDraft) => void; onClose: () => void; onSave: () => void; onRemove: () => void }) {
  const activePayees = payees.filter((payee) => !payee.deletedAt);
  const canSave = Boolean(draft.accountId && draft.date && draft.payeeName.trim() && draft.amount > 0);
  const changeType = (type: TransactionType) => onChange({ ...draft, type, category: type === "payment" ? "Debt payment" : type === "fee" ? "Interest & fees" : draft.category === "Debt payment" || draft.category === "Interest & fees" ? "Other" : draft.category });
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal transaction-modal" role="dialog" aria-modal="true" aria-labelledby="transaction-modal-title"><header><div><span>{editing ? "Edit transaction" : "Quick add"}</span><h2 id="transaction-modal-title">{editing ? draft.payeeName || "Transaction details" : "New transaction"}</h2><p>Charges and fees increase the balance; payments reduce it.</p></div><button type="button" onClick={onClose} aria-label="Close transaction form">?</button></header><div className="form-grid"><div className="wide transaction-kind"><span>Transaction type</span><div>{(["charge", "payment", "fee"] as TransactionType[]).map((type) => <button type="button" key={type} className={draft.type === type ? `active ${type}` : type} onClick={() => changeType(type)}>{type === "charge" ? "Charge" : type === "payment" ? "Payment" : "Interest / fee"}</button>)}</div></div><label><span>Date</span><input type="date" value={draft.date} onChange={(event) => onChange({ ...draft, date: event.target.value })}/></label><label><span>Account</span><select value={draft.accountId} onChange={(event) => onChange({ ...draft, accountId: event.target.value })}><option value="">Select account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} ? {moneyPrecise.format(account.balance)}</option>)}</select></label><label className="wide"><span>Payee</span><input autoFocus list="transaction-payees" value={draft.payeeName} placeholder={draft.type === "payment" ? "Example: Card issuer" : "Example: Grocery store"} onChange={(event) => { const name = event.target.value; const match = activePayees.find((payee) => payee.name.toLowerCase() === name.toLowerCase()); onChange({ ...draft, payeeName: name, payeeId: match?.id ?? "" }); }}/><datalist id="transaction-payees">{activePayees.map((payee) => <option key={payee.id} value={payee.name}/>)}</datalist><small className="field-help">A new name is automatically saved to Payees.</small></label><Field label="Amount" prefix="$" value={draft.amount} placeholder="0.00" step=".01" onChange={(amount) => onChange({ ...draft, amount })}/><label><span>Category</span><select value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value })}>{TRANSACTION_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label className="wide"><span>Memo</span><input value={draft.memo} placeholder="Optional note" onChange={(event) => onChange({ ...draft, memo: event.target.value })}/></label></div><footer>{editing ? <button className="danger" type="button" onClick={onRemove}>Delete transaction</button> : <span/>}<div><button className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="button" disabled={!canSave} onClick={onSave}>{editing ? "Save changes" : "Add transaction"}</button></div></footer></section></div>;
}

function PayeeModal({ payees, onAdd, onRename, onDelete, onClose }: { payees: Payee[]; onAdd: (name: string) => void; onRename: (id: string, name: string) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const active = payees.filter((payee) => !payee.deletedAt).sort((a, b) => a.name.localeCompare(b.name));
  const add = () => { if (!name.trim()) return; onAdd(name); setName(""); };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal payee-modal" role="dialog" aria-modal="true" aria-labelledby="payee-modal-title"><header><div><span>Transaction directory</span><h2 id="payee-modal-title">Payees</h2><p>Saved payees make quick and batch entry faster.</p></div><button type="button" onClick={onClose} aria-label="Close payees">?</button></header><div className="payee-body"><div className="payee-add"><input autoFocus value={name} placeholder="New payee name" onKeyDown={(event) => { if (event.key === "Enter") add(); }} onChange={(event) => setName(event.target.value)}/><button className="primary" type="button" disabled={!name.trim()} onClick={add}>Add payee</button></div><div className="payee-list">{active.length ? active.map((payee) => <PayeeRow key={payee.id} payee={payee} onRename={onRename} onDelete={onDelete}/>) : <p>No saved payees yet. Adding a transaction also creates its payee automatically.</p>}</div></div><footer><span>{active.length} active {active.length === 1 ? "payee" : "payees"}</span><button className="primary" type="button" onClick={onClose}>Done</button></footer></section></div>;
}

function PayeeRow({ payee, onRename, onDelete }: { payee: Payee; onRename: (id: string, name: string) => void; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(payee.name);
  return <div className="payee-row"><div><span>{payee.name.slice(0, 2).toUpperCase()}</span>{editing ? <input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && name.trim()) { onRename(payee.id, name); setEditing(false); } }}/>: <strong>{payee.name}</strong>}</div><div>{editing ? <button type="button" onClick={() => { if (name.trim()) onRename(payee.id, name); setEditing(false); }}>Save</button> : <button type="button" onClick={() => setEditing(true)}>Rename</button>}<button type="button" onClick={() => onDelete(payee.id)}>Remove</button></div></div>;
}
function AccountsPage({ accounts, activeCount, totalBalance, minimums, interest, linkedCardExpenses, sortKey, sortDirection, paidOffById, onSort, onAdd, onEdit, onToggleMinimum, onTogglePayoff, onSample, onImport, importMessage }: { accounts: DebtAccount[]; activeCount: number; totalBalance: number; minimums: number; interest: number; linkedCardExpenses: LinkedCardExpenses; sortKey: SortKey; sortDirection: SortDirection; paidOffById: Map<string, number | null | undefined>; onSort: (key: SortKey) => void; onAdd: () => void; onEdit: (account: DebtAccount) => void; onToggleMinimum: (id: string) => void; onTogglePayoff: (id: string) => void; onSample: () => void; onImport: (file: File) => Promise<void>; importMessage: string }) {
  const headers: { key: SortKey; label: string }[] = [{ key: "name", label: "Account" }, { key: "balance", label: "Balance" }, { key: "creditLimit", label: "Credit limit" }, { key: "apr", label: "APR %" }, { key: "minimum", label: "Monthly payment" }, { key: "monthlyInterest", label: "Interest fee" }, { key: "status", label: "Status" }, { key: "dueDate", label: "Due date" }, { key: "payoff", label: "Estimated paid off date" }];
  const totalCreditLimit = accounts.reduce((sum, account) => sum + account.creditLimit, 0);
  const totalLinkedExpenses = Object.values(linkedCardExpenses).reduce((sum, amount) => sum + amount, 0);
  return <div className="screen"><div className="screen-title"><div><span className="eyebrow">Debt workspace</span><h1>Debt accounts</h1><p>Review balances, minimums, payoff priority, limits, and due dates in one clear table.</p></div><div className="screen-actions"><label className="secondary import-file"><input type="file" accept=".csv,text/csv" onChange={(event) => { const input = event.currentTarget; const file = input.files?.[0]; if (file) void onImport(file).finally(() => { input.value = ""; }); }}/><span>Import CSV</span></label><button className="primary" type="button" onClick={onAdd}>+ Add account</button></div></div>{importMessage && <p className={importMessage.startsWith("Import failed") ? "import-message error" : "import-message"}>{importMessage}</p>}<section className="metrics"><article className="metric"><span>Total balance</span><strong>{moneyPrecise.format(totalBalance)}</strong><small>Opening balances plus active ledger entries</small></article><article className="metric"><span>Active accounts</span><strong>{activeCount}</strong><small>{accounts.length - activeCount} paid off</small></article><article className="metric"><span>Monthly card payments</span><strong>{moneyPrecise.format(minimums + totalLinkedExpenses)}</strong><small>{totalLinkedExpenses > 0 ? `${moneyPrecise.format(minimums)} minimums + ${moneyPrecise.format(totalLinkedExpenses)} card expenses` : "Auto estimates included"}</small></article><article className="metric"><span>Monthly interest</span><strong>{moneyPrecise.format(interest)}</strong><small>At current balances</small></article></section><section className="table-card"><div className="table-card-head"><div><span>Your debt accounts</span><strong>{accounts.length} {accounts.length === 1 ? "record" : "records"}</strong></div><span className="swipe-note">Click minimum or status to change it</span></div>{accounts.length ? <div className="table-scroll"><table className="accounts-table"><caption>Sortable debt account list</caption><thead><tr>{headers.map((header) => <th key={header.key}><button type="button" onClick={() => onSort(header.key)}>{header.label}<i>{sortKey === header.key ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</i></button></th>)}</tr></thead><tbody>{accounts.map((account) => { const payoff = paidOffById.get(account.id); const cardExpense = linkedCardExpenses[account.id] ?? 0; return <tr key={account.id}><td><button className="account-name" type="button" onClick={() => onEdit(account)}><span>{account.name.slice(0,2).toUpperCase()}</span><div><strong>{account.name}</strong><small>{account.type}</small></div></button></td><td className="number-cell"><strong>{moneyPrecise.format(account.balance)}</strong>{account.creditLimit > 0 && <small>{Math.round(account.balance/account.creditLimit*100)}% utilized</small>}</td><td className="number-cell"><strong>{account.creditLimit > 0 ? moneyPrecise.format(account.creditLimit) : "—"}</strong></td><td className="number-cell">{account.apr.toFixed(2)}%</td><td><button className={`minimum-toggle ${account.minimumMode}`} type="button" onClick={() => onToggleMinimum(account.id)} aria-label={`${account.name}: ${account.minimumMode === "auto" ? "use manual minimum payment" : "use automatic minimum estimate"}`}><strong>{moneyPrecise.format(effectiveMinimum(account) + cardExpense)}</strong><small>{cardExpense > 0 ? `${moneyPrecise.format(effectiveMinimum(account))} min + ${moneyPrecise.format(cardExpense)} expenses` : account.minimumMode === "auto" ? "Auto estimate" : "Manual amount"}</small></button></td><td className="number-cell"><strong>{moneyPrecise.format(monthlyInterest(account))}</strong><small>{account.interestFee > 0 ? "Actual statement fee" : "APR estimate"}</small></td><td><button className={`status-toggle ${account.balance <= 0 ? "paid" : account.payoffMode}`} type="button" disabled={account.balance <= 0} onClick={() => onTogglePayoff(account.id)} title={account.balance > 0 ? "Switch between payoff priority and minimum-only payments" : "This account is paid off"}>{account.balance <= 0 ? "Paid off" : account.payoffMode === "minimum-only" ? "Minimum only" : "Payoff priority"}</button></td><td><span className="date-cell"><i>□</i>{formatDate(account.dueDate)}</span></td><td>{account.balance <= 0 ? <strong className="paid-date">Complete</strong> : payoff ? <span>{monthAfter(payoff - 1)}</span> : <span className="needs">Needs adjustment</span>}</td></tr>; })}</tbody><tfoot><tr><td>Total</td><td className="number-cell">{moneyPrecise.format(totalBalance)}</td><td className="number-cell">{moneyPrecise.format(totalCreditLimit)}</td><td></td><td className="number-cell">{moneyPrecise.format(minimums + totalLinkedExpenses)}</td><td className="number-cell">{moneyPrecise.format(interest)}</td><td colSpan={3}></td></tr></tfoot></table></div> : <div className="empty-table"><span>▤</span><h2>No debt accounts yet</h2><p>Import the CSV from your original DebtFree app, add your first account, or load temporary sample records.</p><div><label className="secondary import-file"><input type="file" accept=".csv,text/csv" onChange={(event) => { const input = event.currentTarget; const file = input.files?.[0]; if (file) void onImport(file).finally(() => { input.value = ""; }); }}/><span>Import DebtFree CSV</span></label><button className="primary" type="button" onClick={onAdd}>+ Add account</button><button className="secondary" type="button" onClick={onSample}>Load samples</button></div></div>}</section></div>;
}

function PayoffPlanPage({ accounts, plan, extra, availableExtra, strategy, linkedCardExpenseItems, onExtra, onStrategy, onAccounts, onEditAccount }: { accounts: DebtAccount[]; plan: ReturnType<typeof calculatePlan>; extra: number; availableExtra: number; strategy: PayoffStrategy; linkedCardExpenseItems: LinkedCardExpenseItems; onExtra: (value: number) => void; onStrategy: (strategy: PayoffStrategy) => void; onAccounts: () => void; onEditAccount: (account: DebtAccount) => void }) {
  const description = strategy === "avalanche" ? "Highest APR first — usually the lowest total interest." : "Lowest balance first — faster early wins.";
  const planAccounts = accounts.filter((account) => account.balance > 0);
  return <div className="screen plan-screen"><div className="screen-title"><div><span className="eyebrow">{strategy} strategy</span><h1>Payoff plan</h1><p>Minimums and linked credit-card expenses are paid first, then extra money follows your selected strategy. Zero-balance accounts are hidden.</p></div><div className="plan-controls"><div className="strategy-control"><span>Strategy</span><div><button type="button" className={strategy === "avalanche" ? "active" : ""} onClick={() => onStrategy("avalanche")}>Avalanche</button><button type="button" className={strategy === "snowball" ? "active" : ""} onClick={() => onStrategy("snowball")}>Snowball</button></div><small>{description}</small></div><div className="extra-control"><label htmlFor="extra-monthly">Extra each month</label><div><b>$</b><input id="extra-monthly" type="number" min="0" inputMode="decimal" value={extra || ""} placeholder="0" onChange={(event) => onExtra(number(event.target.value))}/></div><button className={availableExtra > 0 && Math.abs(extra - availableExtra) < 0.01 ? "surplus-shortcut active" : "surplus-shortcut"} type="button" disabled={availableExtra <= 0} onClick={() => onExtra(availableExtra)}>{availableExtra > 0 ? `Use my ${moneyPrecise.format(availableExtra)} available extra` : "No extra available yet"}</button><small>{availableExtra > 0 ? "Calculated after monthly expenses, budgets, and debt minimums. Edit anytime." : "Add income or adjust expenses, budgets, and minimums to create extra."}</small></div></div></div>{planAccounts.length && plan.months.length && !plan.stalled ? <><section className="plan-hero"><div><span>Projected debt-free date</span><strong>{monthAfter(plan.months.length - 1)}</strong><small>{plan.months.length} months from now</small></div><div><span>Monthly plan</span><strong>{money.format(plan.monthly)}</strong><small>Minimums + linked card expenses + extra</small></div><div><span>Estimated interest</span><strong>{money.format(plan.totalInterest)}</strong><small>Actual fee calibration used when provided</small></div></section><section className="table-card plan-table-card"><div className="table-card-head"><div><span>Month-by-month schedule</span><strong>{plan.months.length} rows · {strategy}</strong></div><span className="swipe-note">Month, interest, and remaining stay visible while you scroll</span></div><div className="table-scroll plan-scroll"><table className="payoff-table"><caption>Complete payoff plan with account balances after each scheduled payment</caption><thead><tr><th className="month-plan-head month-sticky">Month</th>{planAccounts.map((account) => <th className="account-plan-head" key={account.id} title="Click the account name to edit it. Drag the lower-right edge to resize this column."><button className="account-plan-edit" type="button" onClick={() => onEditAccount(account)}><span>{account.name}</span><small>Starting debt {moneyPrecise.format(account.balance)}</small></button></th>)}<th>Amount 2 Pay/month</th><th>Milestone</th><th className="interest-sticky">Interest</th><th className="remaining-sticky">Remaining</th></tr></thead><tbody>{plan.months.map((month) => <tr key={month.month}><td className="month-sticky">{monthAfter(month.month - 1)}</td>{planAccounts.map((account) => { const expenseItems = linkedCardExpenseItems[account.id] ?? []; return <td className="account-plan-cell" key={account.id}><strong>{moneyPrecise.format(month.payments[account.id] ?? 0)}</strong><small>{moneyPrecise.format(month.balances[account.id] ?? 0)} left</small>{expenseItems.map((item) => <em key={item.id}>+ {moneyPrecise.format(item.amount)} {item.name}</em>)}</td>; })}<td className="number-cell"><strong>{moneyPrecise.format(month.paid)}</strong></td><td>{month.paidOff.length ? <span className="milestone">Paid off: {month.paidOff.join(", ")}</span> : "\u2014"}</td><td className="number-cell interest-sticky">{moneyPrecise.format(month.interest)}</td><td className="number-cell remaining remaining-sticky">{moneyPrecise.format(month.remaining)}</td></tr>)}</tbody></table></div></section></> : <section className="large-empty"><span>✓</span><h2>{plan.stalled ? "The current payments do not outpace interest" : "Add debt accounts to build your plan"}</h2><p>{plan.stalled ? "Increase a minimum payment or add an extra monthly amount to create a finish line." : "Once your accounts have balances, APRs, and minimums, the complete payoff schedule will appear here."}</p><button className="primary" type="button" onClick={onAccounts}>Review debt accounts</button></section>}</div>;
}function ProfilePage({ user, householdName, role, members, cloudStatus, onInvite, onRemove }: { user: ChatGPTUser; householdName: string; role: "owner" | "admin"; members: HouseholdMember[]; cloudStatus: CloudStatus; onInvite: (email: string) => Promise<void>; onRemove: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const invite = async () => {
    setWorking(true);
    setMessage("");
    try { await onInvite(email); setEmail(""); setMessage("Admin saved. This email must also be allowed into the private site before the link will open."); }
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
  return <div className="screen"><div className="screen-title"><div><span className="eyebrow">Household access</span><h1>My account</h1><p>Your dashboard is protected by ChatGPT sign-in. Listed admins share the household after the same email is allowed into this private site.</p></div><button className="secondary" type="button" onClick={copyLink}>Copy dashboard link</button></div><section className="profile-grid"><article className="profile-card"><div className="profile-avatar">{user.displayName.slice(0,2).toUpperCase()}</div><div><span>{role === "owner" ? "Household owner" : "Household admin"}</span><strong>{user.displayName}</strong><small>{user.email}</small></div><div className="account-cloud-state"><i className={cloudStatus}/><span>{cloudStatus === "synced" ? "Household cloud sync is active" : cloudStatus === "error" ? "Cloud unavailable; device backup is safe" : "Syncing household changes"}</span></div><a className="secondary account-link" href="/signout-with-chatgpt?return_to=%2F">Sign out</a></article><article className="roles-card household-card"><div className="card-head"><div><span>{householdName}</span><strong>Household admins</strong></div></div>{role === "owner" && <div className="invite-admin"><label><span>Admin email</span><div><input type="email" value={email} placeholder="wife@example.com" onChange={(event) => setEmail(event.target.value)}/><button className="primary" type="button" disabled={working || !email.trim()} onClick={invite}>Add admin</button></div><small>Use the email connected to her ChatGPT account. She will sign in separately. The same email must be added to the private site access list; never share your password.</small></label></div>}{message && <p className="share-message">{message}</p>}<div className="member-list">{members.map((member) => <div className="member-row" key={member.email}><div><strong>{member.display_name || member.email}</strong><small>{member.display_name ? member.email : member.status === "invited" ? "Waiting for first sign-in" : "Household member"}</small></div><span className={member.status}>{member.role}</span>{role === "owner" && member.role !== "owner" ? <button type="button" disabled={working} onClick={() => remove(member.email)}>Remove</button> : <i/>}</div>)}</div></article></section></div>;
}
function SnapshotsPage({ accounts, snapshots, currentInterest, onCapture, onUpdateNote, onDelete }: { accounts: DebtAccount[]; snapshots: PayoffSnapshot[]; currentInterest: number; onCapture: (note: string) => void; onUpdateNote: (id: string, note: string) => void; onDelete: (id: string) => void }) {
  const [captureNote, setCaptureNote] = useState(() => snapshots.find((snapshot) => snapshot.month === currentMonthKey())?.note ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const ordered = useMemo(() => [...snapshots].sort((a, b) => a.month.localeCompare(b.month) || a.capturedAt.localeCompare(b.capturedAt)), [snapshots]);
  const latest = ordered.at(-1) ?? null;
  const selected = snapshots.find((snapshot) => snapshot.id === selectedId) ?? latest;
  const currentTotal = accounts.reduce((sum, account) => sum + account.balance, 0);
  const currentMonthSnapshot = snapshots.find((snapshot) => snapshot.month === currentMonthKey());
  const first = ordered[0] ?? null;
  const paidSinceFirst = first ? round(first.totalBalance - currentTotal) : 0;
  const changedSinceLatest = latest ? round(latest.totalBalance - currentTotal) : 0;
  const maxBalance = Math.max(currentTotal, ...ordered.map((snapshot) => snapshot.totalBalance), 1);
  const selectedIndex = selected ? ordered.findIndex((snapshot) => snapshot.id === selected.id) : -1;
  const previous = selectedIndex > 0 ? ordered[selectedIndex - 1] : null;
  const previousBalances = new Map(previous?.accounts.map((account) => [account.accountId, account.balance]) ?? []);
  const formatCaptured = (value: string) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const capture = () => { onCapture(captureNote); };

  return <div className="screen snapshots-screen">
    <div className="screen-title"><div><span className="eyebrow">Monthly progress archive</span><h1>Payoff snapshots</h1><p>Save a monthly picture of every calculated balance so you can see real debt movement without changing the active payoff plan.</p></div><button className="primary snapshot-capture-button" type="button" disabled={!accounts.length} onClick={capture}>{currentMonthSnapshot ? `Update ${monthLabel(currentMonthKey())}` : `Save ${monthLabel(currentMonthKey())}`}</button></div>
    {!accounts.length ? <section className="large-empty"><span>Snapshot</span><h2>Add a debt account first</h2><p>Your first snapshot will capture the calculated balance of every debt account.</p></section> : <>
      <section className="snapshot-capture-card"><div><span>{currentMonthSnapshot ? "This month is already saved" : "Ready for this month"}</span><strong>{moneyPrecise.format(currentTotal)}</strong><small>{accounts.filter((account) => account.balance > 0).length} active accounts | {moneyPrecise.format(currentInterest)} estimated monthly interest</small></div><label><span>Monthly note</span><textarea value={captureNote} maxLength={240} placeholder="Optional: what changed this month?" onChange={(event) => setCaptureNote(event.target.value)}/></label><button className="primary" type="button" onClick={capture}>{currentMonthSnapshot ? "Refresh snapshot" : "Capture balances"}</button></section>
      {snapshots.length ? <>
        <section className="snapshot-metrics"><article><span>Current debt</span><strong>{moneyPrecise.format(currentTotal)}</strong><small>Live calculated balance</small></article><article className={paidSinceFirst >= 0 ? "good" : "warning"}><span>Change since first</span><strong>{paidSinceFirst >= 0 ? "-" : "+"}{moneyPrecise.format(Math.abs(paidSinceFirst))}</strong><small>{first ? `Since ${monthLabel(first.month)}` : "Capture a starting point"}</small></article><article className={changedSinceLatest >= 0 ? "good" : "warning"}><span>Since last snapshot</span><strong>{changedSinceLatest >= 0 ? "-" : "+"}{moneyPrecise.format(Math.abs(changedSinceLatest))}</strong><small>{latest ? `Compared with ${monthLabel(latest.month)}` : "No comparison yet"}</small></article><article><span>Months tracked</span><strong>{snapshots.length}</strong><small>{first && latest ? `${monthLabel(first.month)} to ${monthLabel(latest.month)}` : "Your progress archive"}</small></article></section>
        <section className="snapshot-chart-card"><div className="snapshot-card-head"><div><span>Balance trend</span><strong>Debt remaining by snapshot</strong></div><small>Shorter bars mean less debt</small></div><div className="snapshot-chart" aria-label="Debt balance by payoff snapshot">{ordered.map((snapshot) => <button type="button" key={snapshot.id} className={selected?.id === snapshot.id ? "selected" : ""} onClick={() => setSelectedId(snapshot.id)} aria-label={`${monthLabel(snapshot.month)} balance ${moneyPrecise.format(snapshot.totalBalance)}`}><span className="snapshot-bar-value">{money.format(snapshot.totalBalance)}</span><i style={{ height: `${Math.max(8, snapshot.totalBalance / maxBalance * 100)}%` }}/><b>{monthLabel(snapshot.month)}</b></button>)}<div className="snapshot-now"><span>{money.format(currentTotal)}</span><i style={{ height: `${Math.max(8, currentTotal / maxBalance * 100)}%` }}/><b>Now</b></div></div></section>
        <section className="snapshot-workspace">
          <article className="snapshot-history-card"><div className="snapshot-card-head"><div><span>Snapshot history</span><strong>{snapshots.length} saved {snapshots.length === 1 ? "month" : "months"}</strong></div></div><div className="snapshot-history-list">{[...ordered].reverse().map((snapshot, reverseIndex, reversed) => { const older = reversed[reverseIndex + 1]; const change = older ? round(older.totalBalance - snapshot.totalBalance) : null; return <button type="button" key={snapshot.id} className={selected?.id === snapshot.id ? "active" : ""} onClick={() => setSelectedId(snapshot.id)}><div><strong>{monthLabel(snapshot.month)}</strong><small>Captured {formatCaptured(snapshot.capturedAt)}</small></div><div><strong>{moneyPrecise.format(snapshot.totalBalance)}</strong><small className={change === null ? "" : change >= 0 ? "improved" : "increased"}>{change === null ? "Starting point" : change >= 0 ? `${moneyPrecise.format(change)} paid down` : `${moneyPrecise.format(Math.abs(change))} increase`}</small></div><span>&gt;</span></button>; })}</div></article>
          {selected && <article className="snapshot-detail-card"><div className="snapshot-detail-head"><div><span>Selected snapshot</span><h2>{monthLabel(selected.month)}</h2><p>{moneyPrecise.format(selected.totalBalance)} across {selected.activeAccountCount} active accounts</p></div><button className="snapshot-delete" type="button" onClick={() => onDelete(selected.id)}>Delete</button></div><div className="snapshot-detail-stats"><div><span>Monthly interest</span><strong>{moneyPrecise.format(selected.monthlyInterest)}</strong></div><div><span>Projected debt-free</span><strong>{selected.projectedDebtFreeMonth ?? "Needs adjustment"}</strong></div></div><div className="snapshot-account-list">{[...selected.accounts].sort((a, b) => b.balance - a.balance).map((account) => { const prior = previousBalances.get(account.accountId); const change = prior === undefined ? null : round(prior - account.balance); return <div key={account.accountId}><span>{account.name.slice(0, 2).toUpperCase()}</span><div><strong>{account.name}</strong><small>{account.type} | {account.apr.toFixed(2)}% APR</small></div><div><strong>{moneyPrecise.format(account.balance)}</strong><small className={change === null ? "" : change >= 0 ? "improved" : "increased"}>{change === null ? (previous ? "New since prior snapshot" : "Starting balance") : change >= 0 ? `${moneyPrecise.format(change)} lower` : `${moneyPrecise.format(Math.abs(change))} higher`}</small></div></div>; })}</div><SnapshotNoteEditor key={selected.id} snapshot={selected} onSave={onUpdateNote}/></article>}
        </section>
      </> : <section className="snapshot-empty"><span>Start your progress history</span><h2>Capture the balances you have today</h2><p>This becomes your baseline. Next month, DebtFree will show exactly how much the total and each account moved.</p><button className="primary" type="button" onClick={capture}>Save first snapshot</button></section>}
    </>}
  </div>;
}

function SnapshotNoteEditor({ snapshot, onSave }: { snapshot: PayoffSnapshot; onSave: (id: string, note: string) => void }) {
  const [note, setNote] = useState(snapshot.note);
  const changed = note.trim() !== snapshot.note;
  return <label className="snapshot-note-editor"><span>Snapshot note</span><textarea value={note} maxLength={240} placeholder="Add context for this month" onChange={(event) => setNote(event.target.value)}/><button type="button" disabled={!changed} onClick={() => onSave(snapshot.id, note)}>Save note</button></label>;
}
function UtilizationPage({ accounts, onEditAccount }: { accounts: DebtAccount[]; onEditAccount: (account: DebtAccount) => void }) {
  const creditCards = accounts.filter((account) => account.type === "Credit card");
  const cardsWithLimits = creditCards.filter((account) => account.creditLimit > 0).sort((a, b) => b.balance / b.creditLimit - a.balance / a.creditLimit);
  const cardsMissingLimits = creditCards.filter((account) => account.creditLimit <= 0);
  const totalBalance = cardsWithLimits.reduce((sum, account) => sum + account.balance, 0);
  const totalLimit = cardsWithLimits.reduce((sum, account) => sum + account.creditLimit, 0);
  const availableCredit = Math.max(0, totalLimit - totalBalance);
  const overall = totalLimit > 0 ? totalBalance / totalLimit * 100 : 0;
  const toThirty = Math.max(0, totalBalance - totalLimit * .3);
  const aboveThirty = cardsWithLimits.filter((account) => account.balance / account.creditLimit >= .3).length;
  const level = (value: number) => value < 10 ? { label: "Excellent", className: "excellent" } : value < 30 ? { label: "Healthy", className: "healthy" } : value < 50 ? { label: "Watch", className: "watch" } : { label: "High", className: "high" };
  const overallLevel = level(overall);

  return <div className="screen utilization-screen">
    <div className="screen-title"><div><span className="eyebrow">Revolving credit health</span><h1>Credit utilization</h1><p>See how much of every credit-card limit is in use, using balances calculated from the transaction ledger.</p></div></div>
    {!creditCards.length ? <section className="large-empty"><span>CC</span><h2>No credit cards yet</h2><p>Add a debt account with the Credit card type to start tracking utilization.</p></section> : !cardsWithLimits.length ? <section className="large-empty"><span>%</span><h2>Add credit limits to your cards</h2><p>Utilization needs both a calculated balance and a credit limit.</p><div className="utilization-missing-actions">{cardsMissingLimits.map((account) => <button className="secondary" type="button" key={account.id} onClick={() => onEditAccount(account)}>Add limit for {account.name}</button>)}</div></section> : <>
      <section className="utilization-hero"><div className="utilization-ring" style={{ background: `conic-gradient(${overall < 30 ? "#37b58a" : overall < 50 ? "#e2a13f" : "#df6b62"} ${Math.min(100, overall)}%, #e9eef4 0)` }}><div><strong>{overall.toFixed(1)}%</strong><span>Overall</span></div></div><div className="utilization-hero-copy"><span className={`utilization-status ${overallLevel.className}`}>{overallLevel.label}</span><h2>{overall < 10 ? "Your revolving balances are in a low range." : overall < 30 ? "Your total utilization is below 30%." : `Pay down ${moneyPrecise.format(toThirty)} to move below 30%.`}</h2><p>Overall utilization combines only credit cards with a saved limit. Installment loans are excluded.</p></div><div className="utilization-hero-total"><span>Used credit</span><strong>{moneyPrecise.format(totalBalance)}</strong><small>of {moneyPrecise.format(totalLimit)}</small></div></section>
      <section className="utilization-metrics"><article><span>Available credit</span><strong>{moneyPrecise.format(availableCredit)}</strong><small>Across cards with limits</small></article><article><span>Cards tracked</span><strong>{cardsWithLimits.length}</strong><small>{cardsMissingLimits.length ? `${cardsMissingLimits.length} still need a limit` : "Every card has a limit"}</small></article><article className={aboveThirty ? "warning" : "good"}><span>At or above 30%</span><strong>{aboveThirty}</strong><small>{aboveThirty ? "Review the cards below" : "All tracked cards are below 30%"}</small></article><article><span>To overall 10%</span><strong>{moneyPrecise.format(Math.max(0, totalBalance - totalLimit * .1))}</strong><small>Optional low-utilization target</small></article></section>
      <section className="utilization-grid">{cardsWithLimits.map((account) => { const percent = account.balance / account.creditLimit * 100; const status = level(percent); const toCardThirty = Math.max(0, account.balance - account.creditLimit * .3); const toCardTen = Math.max(0, account.balance - account.creditLimit * .1); return <article className="utilization-card" key={account.id}><header><div><span>{account.name.slice(0,2).toUpperCase()}</span><div><strong>{account.name}</strong><small>{account.apr.toFixed(2)}% APR</small></div></div><button type="button" onClick={() => onEditAccount(account)}>Edit</button></header><div className="utilization-card-value"><strong>{percent.toFixed(1)}%</strong><span className={`utilization-status ${status.className}`}>{status.label}</span></div><div className="utilization-track"><i className={status.className} style={{ width: `${Math.min(100, percent)}%` }}/><b className="marker-thirty"/><b className="marker-ten"/></div><div className="utilization-card-numbers"><div><span>Balance</span><strong>{moneyPrecise.format(account.balance)}</strong></div><div><span>Limit</span><strong>{moneyPrecise.format(account.creditLimit)}</strong></div><div><span>Available</span><strong>{moneyPrecise.format(Math.max(0, account.creditLimit - account.balance))}</strong></div></div><div className="utilization-targets"><div><span>To below 30%</span><strong>{toCardThirty > 0 ? moneyPrecise.format(toCardThirty) : "Reached"}</strong></div><div><span>To 10%</span><strong>{toCardTen > 0 ? moneyPrecise.format(toCardTen) : "Reached"}</strong></div></div></article>; })}</section>
      {cardsMissingLimits.length > 0 && <section className="utilization-missing"><div><span>Missing credit limits</span><strong>Finish setup for {cardsMissingLimits.length} {cardsMissingLimits.length === 1 ? "card" : "cards"}</strong></div><div>{cardsMissingLimits.map((account) => <button type="button" key={account.id} onClick={() => onEditAccount(account)}>Add {account.name} limit</button>)}</div></section>}
    </>}
  </div>;
}

function StatsPage({ accounts, snapshots, transactions, extra, strategy, linkedCardExpenses }: { accounts: DebtAccount[]; snapshots: PayoffSnapshot[]; transactions: LedgerTransaction[]; extra: number; strategy: PayoffStrategy; linkedCardExpenses: LinkedCardExpenses }) {
  const [scenarioExtra, setScenarioExtra] = useState(extra);
  const totalDebt = accounts.reduce((sum, account) => sum + account.balance, 0);
  const forecast = useMemo(() => calculatePlan(accounts, scenarioExtra, strategy, linkedCardExpenses), [accounts, linkedCardExpenses, scenarioExtra, strategy]);
  const avalanche = useMemo(() => calculatePlan(accounts, scenarioExtra, "avalanche", linkedCardExpenses), [accounts, linkedCardExpenses, scenarioExtra]);
  const snowball = useMemo(() => calculatePlan(accounts, scenarioExtra, "snowball", linkedCardExpenses), [accounts, linkedCardExpenses, scenarioExtra]);
  const baseline = useMemo(() => calculatePlan(accounts, 0, strategy, linkedCardExpenses), [accounts, linkedCardExpenses, strategy]);
  const activeTransactions = transactions.filter((transaction) => !transaction.deletedAt);
  const payments = activeTransactions.filter((transaction) => transaction.type === "payment").reduce((sum, transaction) => sum + transaction.amount, 0);
  const charges = activeTransactions.filter((transaction) => transaction.type !== "payment").reduce((sum, transaction) => sum + transaction.amount, 0);
  const netLedgerReduction = round(payments - charges);
  const orderedSnapshots = [...snapshots].sort((a, b) => a.month.localeCompare(b.month));
  const firstSnapshot = orderedSnapshots[0] ?? null;
  const latestSnapshot = orderedSnapshots.at(-1) ?? null;
  const actualSnapshotReduction = firstSnapshot && latestSnapshot ? round(firstSnapshot.totalBalance - latestSnapshot.totalBalance) : 0;
  const averageSnapshotReduction = orderedSnapshots.length > 1 ? round(actualSnapshotReduction / (orderedSnapshots.length - 1)) : 0;
  const payoffDate = (result: ReturnType<typeof calculatePlan>) => result.stalled ? "Needs adjustment" : result.months.length ? monthAfter(result.months.length - 1) : totalDebt <= 0 ? "Debt free" : "No projection";
  const scenarioValues = [...new Set([0, extra, extra + 100, extra + 250, extra + 500].map((value) => Math.max(0, round(value))))].sort((a, b) => a - b);
  const scenarios = scenarioValues.map((value) => ({ value, result: calculatePlan(accounts, value, strategy, linkedCardExpenses) }));
  const milestone = (remainingShare: number) => { const entry = forecast.months.find((month) => month.remaining <= totalDebt * remainingShare + .005); return entry ? monthAfter(entry.month - 1) : null; };
  const forecastInterestSaved = baseline.totalInterest > 0 ? Math.max(0, round(baseline.totalInterest - forecast.totalInterest)) : 0;

  return <div className="screen stats-screen">
    <div className="screen-title"><div><span className="eyebrow">Complete debt outlook</span><h1>Stats & projections</h1><p>Combine your live ledger, saved snapshots, and payoff plan to understand progress and test faster payoff scenarios.</p></div></div>
    {!accounts.length ? <section className="large-empty"><span>Stats</span><h2>Add debt accounts to build projections</h2><p>Once balances and minimum payments exist, this page will compare strategies and payoff scenarios.</p></section> : <>
      <section className="stats-hero"><div><span>Projected debt-free date</span><strong>{payoffDate(forecast)}</strong><small>{forecast.stalled ? "Increase monthly payments to create a finish line" : `${forecast.months.length} months using ${strategy}`}</small></div><div><span>Current debt</span><strong>{moneyPrecise.format(totalDebt)}</strong><small>{accounts.filter((account) => account.balance > 0).length} active accounts</small></div><div><span>Monthly payoff plan</span><strong>{moneyPrecise.format(forecast.monthly)}</strong><small>Minimums, linked card expenses, and extra</small></div><div><span>Projected interest</span><strong>{moneyPrecise.format(forecast.totalInterest)}</strong><small>{forecastInterestSaved > 0 ? `${moneyPrecise.format(forecastInterestSaved)} less than minimum-only pace` : "Based on current balances and rates"}</small></div></section>
      <section className="scenario-card"><div className="scenario-copy"><span>What-if planner</span><h2>Extra payment each month</h2><p>Adjust this amount to update every projection below. This does not change your saved payoff plan.</p></div><div className="scenario-control"><div><span>$</span><input type="number" min="0" step="25" value={scenarioExtra || ""} placeholder="0" onChange={(event) => setScenarioExtra(number(event.target.value))}/><button type="button" disabled={scenarioExtra === extra} onClick={() => setScenarioExtra(extra)}>Use saved extra</button></div><input aria-label="Extra monthly payment scenario" type="range" min="0" max="2000" step="25" value={Math.min(2000, scenarioExtra)} onChange={(event) => setScenarioExtra(number(event.target.value))}/></div><div className="scenario-result"><span>Scenario finish</span><strong>{payoffDate(forecast)}</strong><small>{forecast.stalled ? "Payments do not outpace interest" : `${forecast.months.length} months | ${moneyPrecise.format(forecast.totalInterest)} interest`}</small></div></section>
      <section className="stats-grid">
        <article className="strategy-card"><div className="stats-card-head"><div><span>Strategy comparison</span><strong>Same payment, different order</strong></div></div><div className="strategy-comparison"><div className={strategy === "avalanche" ? "active" : ""}><span>Avalanche</span><strong>{payoffDate(avalanche)}</strong><small>{avalanche.months.length} months</small><b>{moneyPrecise.format(avalanche.totalInterest)} interest</b></div><div className={strategy === "snowball" ? "active" : ""}><span>Snowball</span><strong>{payoffDate(snowball)}</strong><small>{snowball.months.length} months</small><b>{moneyPrecise.format(snowball.totalInterest)} interest</b></div></div><p>{avalanche.totalInterest <= snowball.totalInterest ? `Avalanche saves ${moneyPrecise.format(snowball.totalInterest - avalanche.totalInterest)} in projected interest.` : `Snowball saves ${moneyPrecise.format(avalanche.totalInterest - snowball.totalInterest)} in this projection.`}</p></article>
        <article className="progress-card"><div className="stats-card-head"><div><span>Recorded progress</span><strong>What your real data shows</strong></div></div><div className="recorded-progress"><div><span>Ledger payments</span><strong>{moneyPrecise.format(payments)}</strong></div><div><span>Charges & fees</span><strong>{moneyPrecise.format(charges)}</strong></div><div className={netLedgerReduction >= 0 ? "good" : "warning"}><span>Net ledger movement</span><strong>{netLedgerReduction >= 0 ? "-" : "+"}{moneyPrecise.format(Math.abs(netLedgerReduction))}</strong></div><div className={actualSnapshotReduction >= 0 ? "good" : "warning"}><span>Snapshot change</span><strong>{orderedSnapshots.length > 1 ? `${actualSnapshotReduction >= 0 ? "-" : "+"}${moneyPrecise.format(Math.abs(actualSnapshotReduction))}` : "Need 2 months"}</strong></div></div><p>{orderedSnapshots.length > 1 ? `Average saved-month reduction: ${moneyPrecise.format(Math.abs(averageSnapshotReduction))}.` : "Capture a snapshot in two different months to measure actual monthly progress."}</p></article>
      </section>
      <section className="stats-grid lower">
        <article className="composition-card"><div className="stats-card-head"><div><span>Balance composition</span><strong>Where your debt sits today</strong></div></div><div className="composition-list">{[...accounts].filter((account) => account.balance > 0).sort((a, b) => b.balance - a.balance).map((account) => <div key={account.id}><div><span>{account.name}</span><strong>{moneyPrecise.format(account.balance)}</strong></div><div className="composition-track"><i style={{ width: `${totalDebt > 0 ? account.balance / totalDebt * 100 : 0}%` }}/></div><small>{totalDebt > 0 ? (account.balance / totalDebt * 100).toFixed(1) : "0"}% of total | {account.apr.toFixed(2)}% APR</small></div>)}</div></article>
        <article className="milestones-card"><div className="stats-card-head"><div><span>Payoff milestones</span><strong>Projected balance checkpoints</strong></div></div><div className="milestone-list">{[{ share: .75, label: "25% paid off" }, { share: .5, label: "Halfway there" }, { share: .25, label: "75% paid off" }, { share: 0, label: "Debt free" }].map((item, index) => <div key={item.label}><span>{index + 1}</span><div><strong>{item.label}</strong><small>{item.share > 0 ? `${moneyPrecise.format(totalDebt * item.share)} remaining` : "$0 remaining"}</small></div><b>{milestone(item.share) ?? "Needs adjustment"}</b></div>)}</div></article>
      </section>
      <section className="projection-table-card"><div className="stats-card-head"><div><span>Extra-payment scenarios</span><strong>Compare finish dates and interest</strong></div></div><div className="projection-table-scroll"><table className="projection-table"><thead><tr><th>Extra each month</th><th>Total monthly plan</th><th>Payoff date</th><th>Months</th><th>Projected interest</th><th>Interest saved</th></tr></thead><tbody>{scenarios.map(({ value, result }) => <tr key={value} className={Math.abs(value - scenarioExtra) < .01 ? "active" : ""}><td><strong>{moneyPrecise.format(value)}</strong>{Math.abs(value - extra) < .01 && <small>Saved plan</small>}</td><td>{moneyPrecise.format(result.monthly)}</td><td>{payoffDate(result)}</td><td>{result.stalled ? "-" : result.months.length}</td><td>{moneyPrecise.format(result.totalInterest)}</td><td className="saved">{baseline.totalInterest > result.totalInterest ? moneyPrecise.format(baseline.totalInterest - result.totalInterest) : "-"}</td></tr>)}</tbody></table></div></section>
    </>}
  </div>;
}
function CashflowModal({ draft, editing, accounts, onChange, onClose, onSave, onRemove }: { draft: CashflowDraft; editing: boolean; accounts: DebtAccount[]; onChange: (draft: CashflowDraft) => void; onClose: () => void; onSave: () => void; onRemove: () => void }) {
  const creditAccounts = accounts.filter((account) => account.type === "Credit card");
  const needsCreditAccount = draft.kind === "expense" && draft.paymentMethod === "credit";
  const canSave = Boolean(draft.name.trim()) && draft.amount > 0 && (!needsCreditAccount || Boolean(draft.creditAccountId));
  const changeKind = (kind: CashflowKind) => onChange({ ...draft, kind, category: CASHFLOW_CATEGORIES[kind][0], paymentMethod: kind === "expense" ? draft.paymentMethod : "debit", creditAccountId: kind === "expense" ? draft.creditAccountId : "" });
  const title = draft.kind === "income" ? "income" : draft.kind === "expense" ? "recurring expense" : "set-aside budget";
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal cashflow-modal" role="dialog" aria-modal="true" aria-labelledby="cashflow-modal-title"><header><div><span>{editing ? `Edit ${title}` : `New ${title}`}</span><h2 id="cashflow-modal-title">{editing ? draft.name || "Monthly item" : `Add ${title}`}</h2><p>This month?s planning data is saved with your shared household dashboard.</p></div><button type="button" onClick={onClose} aria-label="Close monthly item form">×</button></header><div className="form-grid"><div className="wide kind-editor"><span>Item type</span><div>{(["income", "expense", "budget"] as CashflowKind[]).map((kind) => <button type="button" key={kind} className={draft.kind === kind ? `active ${kind}` : kind} onClick={() => changeKind(kind)}>{kind === "income" ? "Income" : kind === "expense" ? "Expense" : "Budget"}</button>)}</div></div><label className="wide"><span>Name</span><input autoFocus value={draft.name} placeholder={draft.kind === "income" ? "Example: Salary" : draft.kind === "expense" ? "Example: Electric bill" : "Example: Emergency fund"} onChange={(event) => onChange({ ...draft, name: event.target.value })}/></label><Field label={draft.kind === "budget" ? "Budget amount" : "Monthly amount"} prefix="$" value={draft.amount} placeholder="0" onChange={(amount) => onChange({ ...draft, amount })}/><label><span>Category</span><select value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value })}>{CASHFLOW_CATEGORIES[draft.kind].map((category) => <option key={category}>{category}</option>)}</select></label>{draft.kind === "expense" && <div className="wide payment-editor"><span>Paid with</span><div><button type="button" className={draft.paymentMethod === "debit" ? "active" : ""} onClick={() => onChange({ ...draft, paymentMethod: "debit", creditAccountId: "" })}><i>DB</i><span>Debit</span><small>Paid from checking</small></button><button type="button" className={draft.paymentMethod === "credit" ? "active" : ""} onClick={() => onChange({ ...draft, paymentMethod: "credit" })}><i>CC</i><span>Credit</span><small>Charged to a card</small></button></div></div>}{needsCreditAccount && <label className="wide credit-account-field"><span>Credit card</span><select value={draft.creditAccountId} onChange={(event) => onChange({ ...draft, creditAccountId: event.target.value })}><option value="">Select the card used for this expense</option>{creditAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select><small>{creditAccounts.length ? "This links the recurring expense to the card you use." : "Add a credit card under Debt Accounts before assigning this expense to credit."}</small></label>}</div><footer>{editing ? <button className="danger" type="button" onClick={onRemove}>Remove item</button> : <span/>}<div><button className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="button" disabled={!canSave} onClick={onSave}>{editing ? "Save changes" : "Add monthly item"}</button></div></footer></section></div>;
}
function AccountModal({ draft, editing, onChange, onClose, onSave, onRemove }: { draft: AccountDraft; editing: boolean; onChange: (draft: AccountDraft) => void; onClose: () => void; onSave: () => void; onRemove: () => void }) {
  const autoMinimum = estimatedMinimum(draft.balance, draft.apr);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title"><header><div><span>{editing ? "Edit debt account" : "New debt account"}</span><h2 id="account-modal-title">{editing ? draft.name || "Account details" : "Add a debt account"}</h2><p>Enter the current lender details. You can update them anytime.</p></div><button type="button" onClick={onClose} aria-label="Close account form">×</button></header><div className="form-grid"><label className="wide"><span>Name</span><input autoFocus value={draft.name} placeholder="Example: Everyday Rewards" onChange={(event) => onChange({ ...draft, name: event.target.value })}/></label><label><span>Debt type</span><select value={draft.type} onChange={(event) => onChange({ ...draft, type: event.target.value as DebtType })}>{DEBT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><Field label="Opening balance" prefix="$" value={draft.balance} placeholder="0" onChange={(balance) => onChange({ ...draft, balance })}/><Field label="APR" suffix="%" value={draft.apr} placeholder="0.00" step=".01" onChange={(apr) => onChange({ ...draft, apr })}/><div><Field label="Actual interest fee" prefix="$" value={draft.interestFee} placeholder="Optional" step=".01" onChange={(interestFee) => onChange({ ...draft, interestFee })}/><small className="field-help">Leave blank to estimate from balance × APR ÷ 12.</small></div><div className="minimum-editor"><div><span>Minimum payment</span><button type="button" className={draft.minimumMode === "auto" ? "mode active" : "mode"} onClick={() => onChange({ ...draft, minimumMode: draft.minimumMode === "auto" ? "manual" : "auto" })}>{draft.minimumMode === "auto" ? "Auto estimate" : "Use auto"}</button></div><Field prefix="$" value={draft.minimumMode === "auto" ? autoMinimum : draft.minimum} placeholder="0" disabled={draft.minimumMode === "auto"} onChange={(minimum) => onChange({ ...draft, minimum })}/><small>{draft.minimumMode === "auto" ? "1% of balance + monthly interest, with a $25 floor." : "Using your lender amount."}</small></div><Field label="Credit limit" prefix="$" value={draft.creditLimit} placeholder="Optional" onChange={(creditLimit) => onChange({ ...draft, creditLimit })}/><label><span>Next due date</span><input type="date" value={draft.dueDate} onChange={(event) => onChange({ ...draft, dueDate: event.target.value })}/></label></div><footer>{editing ? <button className="danger" type="button" onClick={onRemove}>Remove account</button> : <span/>}<div><button className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="button" disabled={!draft.name.trim()} onClick={onSave}>{editing ? "Save changes" : "Add account"}</button></div></footer></section></div>;
}
function Field({ label, prefix, suffix, value, placeholder, step, disabled, onChange }: { label?: string; prefix?: string; suffix?: string; value: number; placeholder: string; step?: string; disabled?: boolean; onChange: (value: number) => void }) { return <label>{label && <span>{label}</span>}<div className="field-input">{prefix && <b>{prefix}</b>}<input type="number" min="0" step={step} inputMode="decimal" disabled={disabled} value={value || ""} placeholder={placeholder} onChange={(event) => onChange(number(event.target.value))}/>{suffix && <b>{suffix}</b>}</div></label>; }