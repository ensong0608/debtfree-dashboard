"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardUser } from "./cloudflare-auth";
import {
  createDashboardBackup,
  createDashboardPayload,
  dashboardDataErrorMessage,
  parseDashboardContract,
  parseDashboardJson,
  serializeDashboardBackup,
  type CashflowItem,
  type BalanceAdjustment,
  type CashflowKind,
  type DashboardBackup,
  type DashboardPayload,
  type DebtAccount,
  type DebtType,
  type LedgerTransaction,
  type MonthlyPlanSettings,
  type Payee,
  type PaymentKind,
  type PayoffSnapshot,
  type PlannedPayoffData,
  type PayoffStrategy,
  type TransactionType,
} from "./dashboard-data";
import { exportPayoffCsv, exportPayoffExcel, exportPayoffPdf, type PayoffReportData } from "./payoff-export";
import {
  calculatePlan,
  estimatedMinimum,
  effectiveMinimum,
  hasPromoTerms,
  individualPayoffMonths,
  monthlyInterest,
  round,
  type LinkedCardExpenses,
  type PayoffPlan,
} from "./payoff-engine";
import OnboardingFlow from "./onboarding-flow";
import MonthlyPlanPage from "./monthly-plan-page";
import HomeDashboardPage from "./home-dashboard-page";
import { buildHomeDashboard, type HomeAction } from "./home-dashboard";
import { canArchiveDebt, createBalanceAdjustment, createDebtPayment, replaceDebtPayment, DebtBalanceError, DebtPaymentError, debtStatus, payoffPriority, promoNotice, setDebtArchived, splitDebtAccounts } from "./debts-screen";
import { buildProgressBalanceView, transactionAdjustedAccounts } from "./progress-balances";
import { actualizedPlannedIds, copyRecurringPlannedItems } from "./monthly-plan";
import {
  DEFAULT_SCHEDULE_PREVIEW_MONTHS,
  accountsWithCustomDebtOrder,
  buildPayoffScheduleRows,
  buildStrategyComparison,
  mergeVisibleCustomDebtOrder,
  normalizeCustomDebtOrder,
  payoffCalculationWarnings,
  visibleCustomDebtOrder,
} from "./payoff-plan";
import {
  createOnboardingPlanning,
  hasEstablishedDashboardData,
  hasOnboardingProgress,
  shouldShowOnboarding,
  type GeneratedOnboardingPlan,
} from "./onboarding-plan";
import { scanReceipt, type ReceiptScanResult } from "./receipt-ocr";

type PageId = "home" | "accounts" | "history" | "plan" | "monthly" | "snapshots" | "utilization" | "stats" | "profile";
type SortKey = "name" | "balance" | "creditLimit" | "apr" | "minimum" | "monthlyInterest" | "status" | "dueDate" | "payoff";
type SortDirection = "asc" | "desc";

type AccountDraft = Pick<DebtAccount, "name" | "type" | "balance" | "apr" | "interestFee" | "minimum" | "minimumMode" | "payoffMode" | "creditLimit" | "dueDate" | "promoEndDate" | "postPromoApr" | "postPromoMinimum">;
type CashflowDraft = Pick<CashflowItem, "name" | "kind" | "category" | "amount" | "paymentMethod" | "creditAccountId" | "recurring">;
type TransactionDraft = Pick<LedgerTransaction, "date" | "accountId" | "payeeId" | "payeeName" | "type" | "category" | "memo" | "amount" | "plannedItemId"> & { paymentKind: PaymentKind };
type LinkedCardExpenseItems = Record<string, CashflowItem[]>;
type LinkedCardPurchaseItems = Record<string, CashflowItem[]>;
type CloudStatus = "connecting" | "saving" | "synced" | "error";
type HouseholdRole = "owner" | "admin" | "viewer";
type HouseholdMember = { email: string; display_name: string | null; role: HouseholdRole; status: "active" | "invited" };
type HouseholdResponse = { householdName: string; role: HouseholdRole; payload: unknown; revision: number; members: HouseholdMember[] };

type PaymentRequest = { accountId: string; suggestedAmount: number };
type PaymentDraft = { amount: number; date: string; note: string; paymentKind: PaymentKind };
type BalanceDraft = { balance: number; date: string; note: string };
function hasMeaningfulData(payload: DashboardPayload) {
  return hasEstablishedDashboardData(payload) || payload.planning.onboarding.completed || hasOnboardingProgress(payload.planning);
}

const STORAGE_KEY = "debtfree-dashboard-prototype-v1";
const STORAGE_BACKUP_KEY = "debtfree-dashboard-prototype-v1-backup";
const NAVIGATION_COLLAPSED_KEY = "debtfree-dashboard-navigation-collapsed";
const EMPTY_DRAFT: AccountDraft = { name: "", type: "Credit card", balance: 0, apr: 0, interestFee: 0, minimum: 0, minimumMode: "auto", payoffMode: "priority", creditLimit: 0, dueDate: "", promoEndDate: "", postPromoApr: 0, postPromoMinimum: 0 };
const EMPTY_CASHFLOW_DRAFT: CashflowDraft = { name: "", kind: "expense", category: "Housing", amount: 0, paymentMethod: "debit", creditAccountId: "", recurring: true };
const TRANSACTION_CATEGORIES = ["Shopping", "Food", "Housing", "Transportation", "Utilities", "Health", "Debt payment", "Interest & fees", "Other"];
const CASHFLOW_CATEGORIES: Record<CashflowKind, string[]> = {
  income: ["Salary", "Freelance", "Benefits", "Investment", "Other income"],
  expense: ["Housing", "Transportation", "Utilities", "Subscriptions", "Insurance", "Food", "Other expense"],
  budget: ["Savings", "Emergency fund", "Groceries", "Travel", "Personal", "Other budget"],
  purchase: ["Shopping", "Home", "Transportation", "Health", "Travel", "Gifts", "Other purchase"],
};
const SAMPLE_ACCOUNTS: DebtAccount[] = [
  { id: "sample-1", name: "Everyday Rewards", type: "Credit card", balance: 3577.28, apr: 21.49, interestFee: 0, minimum: 0, minimumMode: "auto", payoffMode: "priority", creditLimit: 8500, dueDate: "2026-08-18", promoEndDate: "", postPromoApr: 0, postPromoMinimum: 0, createdAt: "2026-07-01" },
  { id: "sample-2", name: "Freedom Card", type: "Credit card", balance: 5254.68, apr: 24.74, interestFee: 0, minimum: 0, minimumMode: "auto", payoffMode: "priority", creditLimit: 10000, dueDate: "2026-08-22", promoEndDate: "", postPromoApr: 0, postPromoMinimum: 0, createdAt: "2026-07-01" },
  { id: "sample-3", name: "Warehouse Card", type: "Credit card", balance: 10684, apr: 23.74, interestFee: 0, minimum: 0, minimumMode: "auto", payoffMode: "priority", creditLimit: 14000, dueDate: "2026-08-27", promoEndDate: "", postPromoApr: 0, postPromoMinimum: 0, createdAt: "2026-07-01" },
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
function paymentKindLabel(kind?: PaymentKind) {
  return kind === "minimum" ? "Statement minimum" : kind === "extra" ? "Extra payment" : kind === "combined" ? "Minimum + extra" : "Payment";
}
function emptyTransactionDraft(accounts: DebtAccount[]): TransactionDraft {
  return { date: dateInputValue(), accountId: accounts[0]?.id ?? "", payeeId: "", payeeName: "", type: "charge", category: "Other", memo: "", amount: 0, plannedItemId: "", paymentKind: "combined" };
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
      promoEndDate: "",
      postPromoApr: 0,
      postPromoMinimum: 0,
      createdAt: new Date().toISOString(),
    });
  }
  const unique = new Map(imported.map((account) => [account.name.trim().toLowerCase(), account]));
  if (!unique.size) throw new Error("No debt accounts were found in the export.");
  return [...unique.values()];
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
function strategyLabel(strategy: PayoffStrategy) {
  if (strategy === "avalanche") return "Avalanche";
  if (strategy === "snowball") return "Snowball";
  return "Custom";
}

const NAV_ITEMS: { id: PageId; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "\u2302" },
  { id: "accounts", label: "Debts", icon: "\u25a4" },
  { id: "plan", label: "Payoff Plan", icon: "\u2713" },
  { id: "monthly", label: "Monthly Plan", icon: "\u25a6" },
  { id: "snapshots", label: "Progress", icon: "\u25c9" },
  { id: "profile", label: "Settings", icon: "\u2699" },
];
const ADVANCED_NAV_ITEMS: { id: PageId; label: string; icon: string }[] = [
  { id: "history", label: "Transactions", icon: "\u21bb" },
  { id: "utilization", label: "Credit Utilization", icon: "\u25d4" },
  { id: "stats", label: "Stats & Projections", icon: "\u2197" },
];
const ALL_NAV_ITEMS = [...NAV_ITEMS, ...ADVANCED_NAV_ITEMS];

export default function DashboardClient({ user }: { user: DashboardUser }) {
  const cloudWritesEnabled = useRef(false);
  const dashboardContract = useRef<DashboardBackup | null>(null);
  const [page, setPage] = useState<PageId>("home");
  const [accounts, setAccounts] = useState<DebtAccount[]>([]);
  const [monthlyBudgets, setMonthlyBudgets] = useState<Record<string, CashflowItem[]>>({});
  const [monthlyPlan, setMonthlyPlan] = useState<MonthlyPlanSettings>({ detailedSpendingTracking: false, months: {} });
  const [planning, setPlanning] = useState<PlannedPayoffData>(() => createOnboardingPlanning());
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [payees, setPayees] = useState<Payee[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [balanceAdjustments, setBalanceAdjustments] = useState<BalanceAdjustment[]>([]);
  const [snapshots, setSnapshots] = useState<PayoffSnapshot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [balanceAccountId, setBalanceAccountId] = useState<string | null>(null);
  const [debtActionMessage, setDebtActionMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AccountDraft>(EMPTY_DRAFT);
  const [accountAutoFocus, setAccountAutoFocus] = useState<"name" | "balance">("name");
  const [extra, setExtra] = useState(0);
  const [strategy, setStrategy] = useState<PayoffStrategy>("avalanche");
  const [customDebtOrder, setCustomDebtOrder] = useState<string[]>([]);
  const [importMessage, setImportMessage] = useState("");
  const [cashflowModalOpen, setCashflowModalOpen] = useState(false);
  const [editingCashflowId, setEditingCashflowId] = useState<string | null>(null);
  const [cashflowDraft, setCashflowDraft] = useState<CashflowDraft>(EMPTY_CASHFLOW_DRAFT);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [auditTransactionId, setAuditTransactionId] = useState<string | null>(null);
  const [transactionDraft, setTransactionDraft] = useState<TransactionDraft>(() => emptyTransactionDraft([]));
  const [payeeModalOpen, setPayeeModalOpen] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("connecting");
  const [householdName, setHouseholdName] = useState("My household");
  const [householdRole, setHouseholdRole] = useState<HouseholdRole>("owner");
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const [transferMessage, setTransferMessage] = useState("");
  const deviceOnly = user.email === "Local device storage only";
  const isViewer = !deviceOnly && householdRole === "viewer";
  const auditCreator = deviceOnly ? undefined : { email: user.email, displayName: user.displayName };

  const applyDashboardPayload = useCallback((contract: DashboardBackup) => {
    dashboardContract.current = contract;
    const { payload } = contract;
    setAccounts(payload.accounts);
    setMonthlyBudgets(payload.monthlyBudgets);
    setMonthlyPlan(payload.monthlyPlan ?? { detailedSpendingTracking: false, months: {} });
    setPayees(payload.payees);
    setTransactions(payload.transactions);
    setSnapshots(payload.snapshots);
    setBalanceAdjustments(payload.balanceAdjustments ?? []);
    setExtra(payload.extra);
    setStrategy(payload.strategy);
    setPlanning(payload.planning);
    setCustomDebtOrder(payload.customDebtOrder ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setNavigationCollapsed(localStorage.getItem(NAVIGATION_COLLAPSED_KEY) === "true"), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let localContract: DashboardBackup | null = null;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const backup = localStorage.getItem(STORAGE_BACKUP_KEY);
        const primaryContract = saved ? parseDashboardContract(JSON.parse(saved), "Saved dashboard") : null;
        const backupContract = backup ? parseDashboardContract(JSON.parse(backup), "Saved dashboard backup") : null;
        if (primaryContract && hasMeaningfulData(primaryContract.payload)) localContract = primaryContract;
        else if (backupContract && hasMeaningfulData(backupContract.payload)) {
          localContract = backupContract;
          setImportMessage("Recovered your most recent device backup.");
        } else localContract = primaryContract;
      } catch { /* Keep going so a damaged local draft cannot block cloud data. */ }
      if (deviceOnly) {
        if (localContract) applyDashboardPayload(localContract);
        setHouseholdName("This device");
        setCloudStatus("synced");
        setLoaded(true);
        return;
      }
      try {
        const response = await fetch("/api/household", { cache: "no-store" });
        const data = await response.json() as HouseholdResponse & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Cloud storage is unavailable");
        if (cancelled) return;
        setHouseholdName(data.householdName);
        setHouseholdRole(data.role);
        setHouseholdMembers(data.members);
        const canWrite = data.role !== "viewer";
        const cloudContract = data.payload ? parseDashboardContract(data.payload, "Household dashboard") : null;
        const localHasData = localContract ? hasMeaningfulData(localContract.payload) : false;
        const cloudHasData = cloudContract ? hasMeaningfulData(cloudContract.payload) : false;
        if (cloudHasData && cloudContract) {
          cloudWritesEnabled.current = canWrite;
          applyDashboardPayload(cloudContract);
        } else if (localHasData && localContract && canWrite) {
          cloudWritesEnabled.current = true;
          applyDashboardPayload(localContract);
          const upload = await fetch("/api/household", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload: localContract }) });
          if (!upload.ok) throw new Error("Your existing device data could not be copied to the household yet");
        } else if (cloudContract) {
          applyDashboardPayload(cloudContract);
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
  }, [applyDashboardPayload, deviceOnly]);
  useEffect(() => {
    if (!loaded || isViewer) return;
    const payload = createDashboardPayload(dashboardContract.current?.payload, { accounts, monthlyBudgets, payees, transactions, snapshots, extra, strategy, planning, balanceAdjustments, monthlyPlan, customDebtOrder });
    if (hasMeaningfulData(payload)) cloudWritesEnabled.current = true;
    if (!cloudWritesEnabled.current) return;
    const contract = createDashboardBackup(payload, dashboardContract.current);
    dashboardContract.current = contract;
    const serialized = serializeDashboardBackup(contract);
    try {
      const previous = localStorage.getItem(STORAGE_KEY);
      if (previous && previous !== serialized) {
        const previousContract = parseDashboardContract(JSON.parse(previous), "Saved dashboard");
        if (hasMeaningfulData(previousContract.payload)) localStorage.setItem(STORAGE_BACKUP_KEY, previous);
      }
    } catch { /* A damaged old draft should not block the current safe save. */ }
    localStorage.setItem(STORAGE_KEY, serialized);
    if (deviceOnly) return;
    const syncTimer = window.setTimeout(() => {
      setCloudStatus("saving");
      void fetch("/api/household", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload: contract }) })
        .then((response) => { if (!response.ok) throw new Error("Sync failed"); setCloudStatus("synced"); })
        .catch(() => setCloudStatus("error"));
    }, 650);
    return () => window.clearTimeout(syncTimer);
  }, [accounts, balanceAdjustments, customDebtOrder, deviceOnly, extra, isViewer, loaded, monthlyBudgets, monthlyPlan, payees, planning, snapshots, strategy, transactions]);
  useEffect(() => {
    if (!modalOpen && !cashflowModalOpen && !transactionModalOpen && !payeeModalOpen && !paymentRequest && !balanceAccountId && !auditTransactionId) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setModalOpen(false); setCashflowModalOpen(false); setTransactionModalOpen(false); setPayeeModalOpen(false); setPaymentRequest(null); setBalanceAccountId(null); setAuditTransactionId(null); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [auditTransactionId, balanceAccountId, cashflowModalOpen, modalOpen, payeeModalOpen, paymentRequest, transactionModalOpen]);

  const cashflowItems = useMemo(() => monthlyBudgets[selectedMonth] ?? [], [monthlyBudgets, selectedMonth]);
  const planningCashflowItems = useMemo(() => monthlyBudgets[currentMonthKey()] ?? [], [monthlyBudgets]);
  const detailedSpendingTracking = monthlyPlan.detailedSpendingTracking;
  const selectedPlanSettings = monthlyPlan.months[selectedMonth] ?? { safetyBuffer: 0, debtPaymentTarget: 0 };
  const setCashflowItems = (update: CashflowItem[] | ((current: CashflowItem[]) => CashflowItem[])) => setMonthlyBudgets((current) => {
    const items = current[selectedMonth] ?? [];
    const next = typeof update === "function" ? update(items) : update;
    return { ...current, [selectedMonth]: next };
  });
  const calculatedAccounts = useMemo(() => transactionAdjustedAccounts(accounts, transactions, detailedSpendingTracking), [accounts, detailedSpendingTracking, transactions]);
  const totalBalance = useMemo(() => calculatedAccounts.reduce((sum, account) => sum + account.balance, 0), [calculatedAccounts]);
  const payoffAccounts = useMemo(() => accountsWithCustomDebtOrder(calculatedAccounts, customDebtOrder), [calculatedAccounts, customDebtOrder]);
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
  const linkedCardPurchaseItems = useMemo(() => planningCashflowItems.reduce<LinkedCardPurchaseItems>((items, item) => {
    if (item.kind === "purchase" && item.paymentMethod === "credit" && item.creditAccountId) {
      (items[item.creditAccountId] ??= []).push(item);
    }
    return items;
  }, {}), [planningCashflowItems]);
  const linkedCardPurchases = useMemo(() => Object.fromEntries(Object.entries(linkedCardPurchaseItems).map(([accountId, items]) => [accountId, round(items.reduce((sum, item) => sum + item.amount, 0))])), [linkedCardPurchaseItems]);
  const actualizedIds = useMemo(() => actualizedPlannedIds(transactions, currentMonthKey(), detailedSpendingTracking), [detailedSpendingTracking, transactions]);
  const actualizedLinkedCardSpending = useMemo(() => planningCashflowItems.reduce<LinkedCardExpenses>((totals, item) => {
    if (item.paymentMethod === "credit" && item.creditAccountId && actualizedIds.has(item.id)) totals[item.creditAccountId] = round((totals[item.creditAccountId] ?? 0) + item.amount);
    return totals;
  }, {}), [actualizedIds, planningCashflowItems]);
  const availableExtra = useMemo(() => Math.max(0, round(monthlySurplus - minimums)), [minimums, monthlySurplus]);
  const plan = useMemo(() => calculatePlan(payoffAccounts, extra, strategy, linkedCardExpenses, linkedCardPurchases, new Date(), actualizedLinkedCardSpending), [actualizedLinkedCardSpending, extra, linkedCardExpenses, linkedCardPurchases, payoffAccounts, strategy]);
  const homeDashboard = useMemo(() => buildHomeDashboard({
    accounts: payoffAccounts,
    openingAccounts: accounts,
    plan,
    extra,
    strategy,
    planning,
    snapshots,
    transactions,
  }), [accounts, extra, payoffAccounts, plan, planning, snapshots, strategy, transactions]);
  const paidOffById = useMemo(() => new Map(calculatedAccounts.map((account) => {
    const month = plan.months.find((entry) => entry.paidOff.includes(account.name))?.month;
    return [account.id, month ?? individualPayoffMonths(account)];
  })), [calculatedAccounts, plan.months]);
  const priorityById = useMemo(() => new Map(payoffPriority(payoffAccounts, strategy, plan.months[0]?.aprs).map((account, index) => [account.id, index + 1])), [payoffAccounts, plan.months, strategy]);
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

  const paymentAccount = paymentRequest ? calculatedAccounts.find((account) => account.id === paymentRequest.accountId) ?? null : null;
  const balanceAccount = balanceAccountId ? calculatedAccounts.find((account) => account.id === balanceAccountId) ?? null : null;
  const auditTransaction = auditTransactionId ? transactions.find((transaction) => transaction.id === auditTransactionId) ?? null : null;
  const auditAccountWithoutOriginal = auditTransaction ? transactionAdjustedAccounts(accounts, transactions.filter((transaction) => transaction.id !== auditTransaction.id), detailedSpendingTracking).find((account) => account.id === auditTransaction.accountId) ?? null : null;
  const inviteMember = async (email: string, role: Exclude<HouseholdRole, "owner">) => {
    const response = await fetch("/api/household/members", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, role }) });
    const data = await response.json() as { members?: HouseholdMember[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "The household member could not be added");
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
  const openNew = () => { setEditingId(null); setAccountAutoFocus("name"); setDraft(EMPTY_DRAFT); setModalOpen(true); };
  const openNewCashflow = (kind: CashflowKind) => {
    setEditingCashflowId(null);
    setCashflowDraft({ ...EMPTY_CASHFLOW_DRAFT, kind, category: CASHFLOW_CATEGORIES[kind][0], recurring: kind !== "purchase" });
    setCashflowModalOpen(true);
  };
  const openEditCashflow = (item: CashflowItem) => {
    setEditingCashflowId(item.id);
    setCashflowDraft({ name: item.name, kind: item.kind, category: item.category, amount: item.amount, paymentMethod: item.paymentMethod, creditAccountId: item.creditAccountId, recurring: item.recurring ?? item.kind !== "purchase" });
    setCashflowModalOpen(true);
  };
  const saveCashflow = () => {
    if (!cashflowDraft.name.trim() || cashflowDraft.amount <= 0) return;
    const normalized = { ...cashflowDraft, name: cashflowDraft.name.trim(), creditAccountId: (cashflowDraft.kind === "expense" || cashflowDraft.kind === "purchase") && cashflowDraft.paymentMethod === "credit" ? cashflowDraft.creditAccountId : "" };
    if (editingCashflowId) setCashflowItems((current) => current.map((item) => item.id === editingCashflowId ? { ...item, ...normalized } : item));
    else setCashflowItems((current) => [...current, { ...normalized, id: `${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString() }]);
    setCashflowModalOpen(false);
  };
  const removeCashflow = () => {
    if (!editingCashflowId) return;
    const item = cashflowItems.find((entry) => entry.id === editingCashflowId);
    if (confirm(`Remove ${item?.name ?? "this planned entry"}?`)) {
      setCashflowItems((current) => current.filter((entry) => entry.id !== editingCashflowId));
      setCashflowModalOpen(false);
    }
  };
  const openEdit = (account: DebtAccount) => {
    setDebtActionMessage("");
    setAccountAutoFocus("name");
    const stored = accounts.find((item) => item.id === account.id) ?? account;
    setEditingId(stored.id);
    setDraft({ name: stored.name, type: stored.type, balance: account.balance, apr: stored.apr, interestFee: stored.interestFee, minimum: stored.minimum, minimumMode: stored.minimumMode, payoffMode: stored.payoffMode, creditLimit: stored.creditLimit, dueDate: stored.dueDate, promoEndDate: stored.promoEndDate, postPromoApr: stored.postPromoApr, postPromoMinimum: stored.postPromoMinimum });
    setModalOpen(true);
  };
  const openBalanceEdit = (account: DebtAccount) => {
    setDebtActionMessage("");
    setBalanceAccountId(account.id);
  };

  const toggleMinimumMode = (id: string) => {
    setAccounts((current) => current.map((account) => account.id !== id ? account : account.minimumMode === "auto" ? { ...account, minimumMode: "manual", minimum: effectiveMinimum(account) } : { ...account, minimumMode: "auto" }));
  };
  const togglePayoffMode = (id: string) => {
    setAccounts((current) => current.map((account) => account.id === id && account.balance > 0 ? { ...account, payoffMode: account.payoffMode === "minimum-only" ? "priority" : "minimum-only" } : account));
  };
  const saveAccount = () => {
    if (!draft.name.trim()) return;
    if (editingId) setAccounts((current) => current.map((account) => account.id !== editingId ? account : {
      ...account,
      name: draft.name.trim(),
      type: draft.type,
      apr: draft.apr,
      interestFee: draft.interestFee,
      minimum: draft.minimum,
      minimumMode: draft.minimumMode,
      payoffMode: draft.payoffMode,
      creditLimit: draft.creditLimit,
      dueDate: draft.dueDate,
      promoEndDate: draft.promoEndDate,
      postPromoApr: draft.postPromoApr,
      postPromoMinimum: draft.postPromoMinimum,
    }));
    else {
      const account = { ...draft, id: crypto.randomUUID(), name: draft.name.trim(), createdAt: new Date().toISOString() };
      setAccounts((current) => [...current, account]);
      setCustomDebtOrder((current) => [...current.filter((id) => id !== account.id), account.id]);
    }
    setModalOpen(false);
  };
  const removeAccount = () => {
    if (!editingId) return;
    const account = accounts.find((item) => item.id === editingId);
    if (confirm("Permanently delete " + (account?.name ?? "this debt account") + "? Payment, adjustment, and snapshot references will remain for audit, but the debt details cannot be restored.")) {
      setAccounts((current) => current.filter((item) => item.id !== editingId));
      setCustomDebtOrder((current) => current.filter((id) => id !== editingId));
      setModalOpen(false);
      setDebtActionMessage("Debt account permanently deleted. Existing history references were retained.");
    }
  };
  const archiveStoredDebt = (id: string, archived: boolean) => {
    const now = new Date().toISOString();
    setAccounts((current) => current.map((item) => item.id === id ? setDebtArchived(item, archived, now, auditCreator) : item));
  };
  const archiveAccount = (id: string) => {
    const account = calculatedAccounts.find((item) => item.id === id);
    if (!account || !canArchiveDebt(account)) return;
    if (!confirm("Archive " + account.name + "? The debt and all payment, adjustment, and reporting history will be preserved.")) return;
    archiveStoredDebt(id, true);
    setDebtActionMessage(account.name + " was archived and remains available below.");
  };
  const restoreAccount = (id: string) => {
    const account = calculatedAccounts.find((item) => item.id === id);
    archiveStoredDebt(id, false);
    setDebtActionMessage((account?.name ?? "Debt") + " was restored to the current debt list.");
  };
  const recordPayment = (draft: PaymentDraft, action: "payment" | "mark-paid-off" = "payment") => {
    const account = calculatedAccounts.find((item) => item.id === paymentRequest?.accountId);
    if (!account) return false;
    const now = new Date().toISOString();
    const existingPayee = payees.find((payee) => !payee.deletedAt && payee.name.toLowerCase() === account.name.toLowerCase());
    const payee = existingPayee ?? { id: crypto.randomUUID(), name: account.name, createdAt: now, deletedAt: null };
    try {
      const transaction = createDebtPayment({ account, amount: draft.amount, date: draft.date, note: draft.note, createdAt: now, payeeId: payee.id, creator: auditCreator, action, paymentKind: draft.paymentKind });
      if (!existingPayee) setPayees((current) => [...current, payee]);
      setTransactions((current) => [...current, transaction]);
      setPaymentRequest(null);
      setDebtActionMessage(moneyPrecise.format(transaction.amount) + " payment recorded for " + account.name + ". Balance: " + moneyPrecise.format(transaction.balanceBefore ?? account.balance) + " to " + moneyPrecise.format(transaction.balanceAfter ?? 0) + ".");
      return true;
    } catch (error) {
      if (error instanceof DebtPaymentError) setDebtActionMessage(error.message);
      return false;
    }
  };
  const updateAccountBalance = (draft: BalanceDraft) => {
    const storedAccount = accounts.find((item) => item.id === balanceAccountId);
    const currentAccount = calculatedAccounts.find((item) => item.id === balanceAccountId);
    if (!storedAccount || !currentAccount) return;
    try {
      const result = createBalanceAdjustment({ storedAccount, currentBalance: currentAccount.balance, nextBalance: draft.balance, date: draft.date, note: draft.note, creator: auditCreator });
      setAccounts((current) => current.map((item) => item.id === result.account.id ? result.account : item));
      setBalanceAdjustments((current) => [...current, result.adjustment]);
      setBalanceAccountId(null);
      const direction = result.adjustment.difference >= 0 ? "increased" : "decreased";
      setDebtActionMessage(currentAccount.name + " balance " + direction + " by " + moneyPrecise.format(Math.abs(result.adjustment.difference)) + ", from " + moneyPrecise.format(result.adjustment.balanceBefore) + " to " + moneyPrecise.format(result.adjustment.balanceAfter) + ".");
    } catch (error) {
      if (error instanceof DebtBalanceError) setDebtActionMessage(error.message);
    }
  };
  const markAccountPaidOff = (id: string) => {
    const account = calculatedAccounts.find((item) => item.id === id);
    if (!account || account.balance <= 0) return;
    if (!confirm("Mark " + account.name + " paid off by recording a final " + moneyPrecise.format(account.balance) + " payment?")) return;
    const now = new Date().toISOString();
    const existingPayee = payees.find((payee) => !payee.deletedAt && payee.name.toLowerCase() === account.name.toLowerCase());
    const payee = existingPayee ?? { id: crypto.randomUUID(), name: account.name, createdAt: now, deletedAt: null };
    const transaction = createDebtPayment({ account, amount: account.balance, date: dateInputValue(), note: "Marked paid off from Debts", createdAt: now, payeeId: payee.id, creator: auditCreator, action: "mark-paid-off", paymentKind: "combined" });
    if (!existingPayee) setPayees((current) => [...current, payee]);
    setTransactions((current) => [...current, transaction]);
    setDebtActionMessage(account.name + " is paid off and retained for progress reporting. You can archive it from the debt list.");
    if (confirm(account.name + " is paid off. Archive it now? It will remain restorable with all history preserved.")) archiveStoredDebt(id, true);
  };
  const importDebtFreeCsv = async (file: File) => {
    try {
      const imported = extractDebtFreeAccounts(await file.text());
      const existingNames = new Set(accounts.map((account) => account.name.trim().toLowerCase()));
      const newAccounts = imported.filter((account) => !existingNames.has(account.name.trim().toLowerCase()));
      const added = newAccounts.length;
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
      setCustomDebtOrder((current) => [...current, ...newAccounts.map((account) => account.id).filter((id) => !current.includes(id))]);
      setImportMessage(`Imported ${imported.length} account${imported.length === 1 ? "" : "s"}: ${added} added${updated ? `, ${updated} updated` : ""}. Add credit limits and due dates when ready.`);
    } catch (error) {
      setImportMessage(`Import failed: ${error instanceof Error ? error.message : "The file could not be read."}`);
    }
  };

  const exportDashboardBackup = () => {
    const payload = createDashboardPayload(dashboardContract.current?.payload, { accounts, monthlyBudgets, payees, transactions, snapshots, extra, strategy, planning, balanceAdjustments, monthlyPlan, customDebtOrder });
    const backup = createDashboardBackup(payload, dashboardContract.current);
    dashboardContract.current = backup;
    const url = URL.createObjectURL(new Blob([serializeDashboardBackup(backup, true)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `debtfree-dashboard-full-backup-${dateInputValue()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setTransferMessage("Full backup downloaded. Keep this JSON file private because it contains your financial data.");
  };

  const importDashboardBackup = async (file: File) => {
    setTransferMessage("");
    try {
      const contract = parseDashboardJson(await file.text());
      const { payload } = contract;
      if (!hasMeaningfulData(payload)) throw new Error("The backup does not contain dashboard data.");
      const current = createDashboardPayload(dashboardContract.current?.payload, { accounts, monthlyBudgets, payees, transactions, snapshots, extra, strategy, planning, balanceAdjustments, monthlyPlan });
      if (hasMeaningfulData(current) && !window.confirm("Replace the data currently on this device with the selected full backup?")) {
        setTransferMessage("Import canceled. Your current dashboard was not changed.");
        return;
      }
      const serialized = serializeDashboardBackup(contract);
      try {
        const previous = localStorage.getItem(STORAGE_KEY);
        if (previous && previous !== serialized) {
          const previousContract = parseDashboardContract(JSON.parse(previous), "Saved dashboard");
          if (hasMeaningfulData(previousContract.payload)) localStorage.setItem(STORAGE_BACKUP_KEY, previous);
        }
      } catch { /* A damaged previous draft should not block a verified backup import. */ }
      localStorage.setItem(STORAGE_KEY, serialized);
      cloudWritesEnabled.current = true;
      applyDashboardPayload(contract);
      setTransferMessage(`Full backup imported: ${payload.accounts.length} accounts, ${payload.transactions.length} transactions, and ${Object.keys(payload.monthlyBudgets).length} plan months restored.`);
    } catch (error) {
      setTransferMessage(`Import failed: ${dashboardDataErrorMessage(error)}`);
    }
  };

  const copyPreviousBudget = () => {
    const sourceMonth = shiftMonth(selectedMonth, -1);
    const source = monthlyBudgets[sourceMonth] ?? [];
    setMonthlyBudgets((current) => ({ ...current, [selectedMonth]: copyRecurringPlannedItems(source, new Date().toISOString(), (_item, index) => `${Date.now()}-${index}-${Math.random()}`) }));
  };
  const startBlankBudget = () => setMonthlyBudgets((current) => ({ ...current, [selectedMonth]: [] }));
  const updateSelectedPlanSettings = (settings: { safetyBuffer: number; debtPaymentTarget: number }) => setMonthlyPlan((current) => ({ ...current, months: { ...current.months, [selectedMonth]: settings } }));
  const setDetailedSpendingTracking = (enabled: boolean) => setMonthlyPlan((current) => ({ ...current, detailedSpendingTracking: enabled }));
  const openNewTransaction = () => {
    setEditingTransactionId(null);
    setTransactionDraft(emptyTransactionDraft(calculatedAccounts));
    setTransactionModalOpen(true);
  };
  const openRecommendedPayment = (accountId: string, amount: number) => {
    const account = calculatedAccounts.find((item) => item.id === accountId);
    if (!account || account.balance <= 0) return;
    setDebtActionMessage("");
    setPaymentRequest({ accountId, suggestedAmount: Math.min(account.balance, round(amount)) });
  };
  const openHomeAction = (action: HomeAction) => {
    if (action.destination === "payment" && action.accountId) {
      openRecommendedPayment(action.accountId, action.amount ?? 0);
      return;
    }
    if (action.destination === "debt") {
      const account = calculatedAccounts.find((item) => item.id === action.accountId);
      if (account) openEdit(account);
      else setPage("accounts");
      return;
    }
    setPage("snapshots");
  };
  const openEditTransaction = (transaction: LedgerTransaction) => {
    setEditingTransactionId(transaction.id);
    setTransactionDraft({ date: transaction.date, accountId: transaction.accountId, payeeId: transaction.payeeId, payeeName: transaction.payeeName, type: transaction.type, category: transaction.category, memo: transaction.memo, amount: transaction.amount, plannedItemId: transaction.plannedItemId ?? "", paymentKind: transaction.paymentKind ?? "combined" });
    setTransactionModalOpen(true);
  };
  const saveTransaction = () => {
    if (!transactionDraft.accountId || !transactionDraft.date || transactionDraft.amount <= 0 || (transactionDraft.type !== "payment" && !transactionDraft.payeeName.trim())) return;
    const now = new Date().toISOString();
    if (transactionDraft.type === "payment" && !editingTransactionId) {
      const account = calculatedAccounts.find((item) => item.id === transactionDraft.accountId);
      if (!account) return;
      const existingPayee = payees.find((payee) => !payee.deletedAt && payee.name.toLowerCase() === account.name.toLowerCase());
      const payee = existingPayee ?? { id: crypto.randomUUID(), name: account.name, createdAt: now, deletedAt: null };
      try {
        const transaction = createDebtPayment({ account, amount: transactionDraft.amount, date: transactionDraft.date, note: transactionDraft.memo, createdAt: now, payeeId: payee.id, creator: auditCreator, paymentKind: transactionDraft.paymentKind });
        if (!existingPayee) setPayees((current) => [...current, payee]);
        setTransactions((current) => [...current, transaction]);
        setTransactionModalOpen(false);
        setDebtActionMessage(moneyPrecise.format(transaction.amount) + " payment recorded for " + account.name + ". Balance: " + moneyPrecise.format(transaction.balanceBefore ?? account.balance) + " to " + moneyPrecise.format(transaction.balanceAfter ?? 0) + ".");
      } catch (error) {
        if (error instanceof DebtPaymentError) setDebtActionMessage(error.message);
      }
      return;
    }
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
  const correctDebtPayment = (draft: PaymentDraft) => {
    const original = transactions.find((transaction) => transaction.id === auditTransactionId);
    if (!original || !auditAccountWithoutOriginal) return false;
    const now = new Date().toISOString();
    try {
      const correction = replaceDebtPayment({
        original,
        accountWithoutOriginal: auditAccountWithoutOriginal,
        amount: draft.amount,
        date: draft.date,
        note: draft.note,
        paymentKind: draft.paymentKind,
        createdAt: now,
        creator: auditCreator,
      });
      setTransactions((current) => [...current.map((transaction) => transaction.id === original.id ? correction.original : transaction), correction.replacement]);
      setAuditTransactionId(null);
      setDebtActionMessage("Payment correction saved for " + original.payeeName + ". The original audit record was retained as replaced, and the balance reflects the corrected payment exactly once.");
      return true;
    } catch (error) {
      if (error instanceof DebtPaymentError) setDebtActionMessage(error.message);
      return false;
    }
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
        ...(existing ?? {}),
        id: existing?.id ?? `snapshot-${Date.now()}-${Math.random()}`,
        month,
        capturedAt: now,
        totalBalance,
        monthlyInterest: interest,
        activeAccountCount: activeCount,
        projectedDebtFreeMonth,
        note: note.trim(),
        accounts: calculatedAccounts.map((account) => ({
          ...(existing?.accounts.find((saved) => saved.accountId === account.id) ?? {}),
          accountId: account.id, name: account.name, type: account.type, balance: account.balance, apr: account.apr,
        })),
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
  const toggleDashboardNavigation = () => {
    setNavigationCollapsed((current) => {
      const next = !current;
      localStorage.setItem(NAVIGATION_COLLAPSED_KEY, String(next));
      return next;
    });
  };
  const completeOnboarding = (result: GeneratedOnboardingPlan) => {
    cloudWritesEnabled.current = true;
    setAccounts(result.accounts);
    setPlanning(result.planning);
    setExtra(result.extra);
    setStrategy(result.strategy);
    setCustomDebtOrder(normalizeCustomDebtOrder(result.accounts));
    setPage("home");
  };
  if (!loaded) return <main className="onboarding-shell onboarding-loading" role="status"><div><span>DF</span><strong>Loading your household.</strong></div></main>;
  if (!isViewer && shouldShowOnboarding({ accounts, monthlyBudgets, payees, transactions, snapshots, extra, strategy, planning })) {
    return <OnboardingFlow
      planning={planning}
      importMessage={transferMessage}
      onPlanningChange={setPlanning}
      onImport={importDashboardBackup}
      onComplete={completeOnboarding}
    />;
  }
  return <div className={navigationCollapsed ? "app-shell dashboard-collapsed" : "app-shell"}>
    <aside className="sidebar" id="dashboard-navigation">
      <div className="sidebar-head"><button className="brand" type="button" onClick={() => setPage("home")}><span>DF</span><div><strong>DebtFree</strong><small>Dashboard</small></div></button><button className={navigationCollapsed ? "dashboard-toggle sidebar-dashboard-toggle is-collapsed" : "dashboard-toggle sidebar-dashboard-toggle"} type="button" onClick={toggleDashboardNavigation} aria-label={navigationCollapsed ? "Expand dashboard navigation" : "Collapse dashboard navigation"} aria-controls="dashboard-navigation" aria-expanded={!navigationCollapsed}><i aria-hidden="true"><b/></i></button></div>
      <nav aria-label="Primary navigation">{NAV_ITEMS.map((item) => <button type="button" key={item.id} className={page === item.id ? "nav-item active" : "nav-item"} aria-current={page === item.id ? "page" : undefined} onClick={() => setPage(item.id)}><i aria-hidden="true">{item.icon}</i><span>{item.label}</span></button>)}</nav>
      <details className="secondary-navigation"><summary>Advanced tools</summary><nav aria-label="Advanced tools">{ADVANCED_NAV_ITEMS.filter((item) => item.id !== "history" || detailedSpendingTracking).map((item) => <button type="button" key={item.id} className={page === item.id ? "nav-item active" : "nav-item"} aria-current={page === item.id ? "page" : undefined} onClick={() => setPage(item.id)}><i aria-hidden="true">{item.icon}</i><span>{item.label}</span></button>)}</nav></details>
      <div className="sidebar-foot"><span>{householdName}</span><strong>{deviceOnly ? "Stored on this device" : cloudStatus === "synced" ? "Shared household data" : cloudStatus === "error" ? "Device backup active" : "Syncing changes"}</strong></div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div><span className="mobile-product">DebtFree Dashboard</span><strong>{ALL_NAV_ITEMS.find((item) => item.id === page)?.label}</strong></div>
        <div className="top-actions">
          <span className={`save-state ${cloudStatus}`}><i/> {deviceOnly ? "Saved on device" : cloudStatus === "synced" ? "Household saved" : cloudStatus === "error" ? "Saved on device" : "Saving"}</span>
          <button className={navigationCollapsed ? "dashboard-toggle mobile-dashboard-toggle is-collapsed" : "dashboard-toggle mobile-dashboard-toggle"} type="button" onClick={toggleDashboardNavigation} aria-label={navigationCollapsed ? "Expand dashboard navigation" : "Collapse dashboard navigation"} aria-controls="dashboard-navigation" aria-expanded={!navigationCollapsed}><i aria-hidden="true"><b/></i></button>
          <button className="avatar" type="button" onClick={() => setPage("profile")} aria-label="Open My Account">{user.displayName.slice(0,2).toUpperCase()}</button>
        </div>
      </header>
      <div className="page-body">
        {isViewer && <section className="viewer-notice" role="status"><strong>Viewer access</strong><span>You can review this household dashboard, but only the owner and admins can make changes.</span></section>}
        <fieldset className="viewer-readonly-surface" disabled={isViewer}>
        {page === "home" && <HomeDashboardPage model={homeDashboard} onRecordPayment={openRecommendedPayment} onExtra={setExtra} onAction={openHomeAction} onViewPayments={() => setPage(detailedSpendingTracking ? "history" : "monthly")} onViewPlan={() => setPage("plan")} onViewDebts={() => setPage("accounts")} onViewProgress={() => setPage("snapshots")} onViewMonthlyPlan={() => setPage("monthly")}/>}
        {page === "monthly" && <MonthlyPlanPage month={selectedMonth} hasMonth={Object.prototype.hasOwnProperty.call(monthlyBudgets, selectedMonth)} previousHasItems={(monthlyBudgets[shiftMonth(selectedMonth, -1)] ?? []).some((item) => item.recurring ?? item.kind !== "purchase")} items={cashflowItems} accounts={calculatedAccounts} transactions={transactions} settings={selectedPlanSettings} trackingEnabled={detailedSpendingTracking} plannedPayments={plan.months[0]?.payments ?? {}} onMonth={setSelectedMonth} onCopyPrevious={copyPreviousBudget} onStartBlank={startBlankBudget} onAdd={openNewCashflow} onEdit={openEditCashflow} onSettings={updateSelectedPlanSettings} onTracking={setDetailedSpendingTracking} onViewTransactions={() => setPage("history")}/>}
        {page === "accounts" && <AccountsPage accounts={sortedAccounts} transactions={transactions} balanceAdjustments={balanceAdjustments} actionMessage={debtActionMessage} activeCount={activeCount} totalBalance={totalBalance} minimums={minimums} interest={interest} linkedCardExpenses={linkedCardExpenses} sortKey={sortKey} sortDirection={sortDirection} paidOffById={paidOffById} priorityById={priorityById} strategy={strategy} onSort={changeSort} onAdd={openNew} onEdit={openEdit} onUpdateBalance={openBalanceEdit} onRecordPayment={(account) => openRecommendedPayment(account.id, plan.months[0]?.payments[account.id] ?? effectiveMinimum(account))} onMarkPaidOff={markAccountPaidOff} onArchive={archiveAccount} onRestore={restoreAccount} onToggleMinimum={toggleMinimumMode} onTogglePayoff={togglePayoffMode} onSample={() => { setAccounts(SAMPLE_ACCOUNTS); setCustomDebtOrder(normalizeCustomDebtOrder(SAMPLE_ACCOUNTS)); }} onImport={importDebtFreeCsv} importMessage={importMessage}/>}
        {page === "history" && detailedSpendingTracking && <TransactionsPage accounts={calculatedAccounts} payees={payees} transactions={transactions} onQuickAdd={openNewTransaction} onEdit={openEditTransaction} onAudit={setAuditTransactionId} onDelete={softDeleteTransaction} onRestore={restoreTransaction} onBatchAdd={addBatchTransactions} onManagePayees={() => setPayeeModalOpen(true)}/>}
        {page === "plan" && <PayoffPlanPage accounts={payoffAccounts} plan={plan} extra={extra} availableExtra={availableExtra} strategy={strategy} customDebtOrder={customDebtOrder} linkedCardExpenseItems={linkedCardExpenseItems} linkedCardPurchaseItems={linkedCardPurchaseItems} actualizedLinkedCardExpenses={actualizedLinkedCardSpending} monthlyItems={planningCashflowItems} transactions={transactions} snapshots={snapshots} onExtra={setExtra} onStrategy={setStrategy} onCustomOrder={(orderedIds) => setCustomDebtOrder((current) => mergeVisibleCustomDebtOrder(accounts, current, orderedIds))} onAccounts={() => setPage("accounts")}/>}
        {page === "snapshots" && <SnapshotsPage openingAccounts={accounts} transactions={transactions} snapshots={snapshots} currentInterest={interest} plan={plan} strategy={strategy} onCapture={captureSnapshot} onUpdateNote={updateSnapshotNote} onDelete={removeSnapshot} onAddDebt={() => setPage("accounts")} onDetailedProjections={() => setPage("stats")}/>}
        {page === "profile" && <ProfilePage user={user} householdName={householdName} role={householdRole} members={householdMembers} cloudStatus={cloudStatus} deviceOnly={deviceOnly} transferMessage={transferMessage} onExportBackup={exportDashboardBackup} onImportBackup={importDashboardBackup} onInvite={inviteMember} onRemove={removeAdmin}/>}
        {page === "utilization" && <UtilizationPage accounts={calculatedAccounts} onEditAccount={openEdit}/>}
        {page === "stats" && <StatsPage accounts={calculatedAccounts} snapshots={snapshots} transactions={transactions} extra={extra} strategy={strategy} linkedCardExpenses={linkedCardExpenses} linkedCardPurchases={linkedCardPurchases}/>}
        </fieldset>
      </div>
    </main>

    {!isViewer && modalOpen && <AccountModal draft={draft} editing={Boolean(editingId)} autoFocusField={accountAutoFocus} onChange={setDraft} onClose={() => setModalOpen(false)} onSave={saveAccount} onRemove={removeAccount}/>}
    {!isViewer && paymentAccount && paymentRequest && <PaymentModal key={paymentAccount.id + paymentRequest.suggestedAmount} account={paymentAccount} suggestedAmount={paymentRequest.suggestedAmount} onClose={() => setPaymentRequest(null)} onSave={recordPayment}/>}
    {!isViewer && auditTransaction && <PaymentCorrectionModal key={auditTransaction.id + auditTransaction.updatedAt} transaction={auditTransaction} accountWithoutOriginal={auditAccountWithoutOriginal} onClose={() => setAuditTransactionId(null)} onSave={correctDebtPayment}/> }
    {!isViewer && balanceAccount && <BalanceUpdateModal key={balanceAccount.id + balanceAccount.balance} account={balanceAccount} onClose={() => setBalanceAccountId(null)} onSave={updateAccountBalance}/>}
    {!isViewer && cashflowModalOpen && <CashflowModal draft={cashflowDraft} editing={Boolean(editingCashflowId)} accounts={calculatedAccounts} onChange={setCashflowDraft} onClose={() => setCashflowModalOpen(false)} onSave={saveCashflow} onRemove={removeCashflow}/>}
    {!isViewer && detailedSpendingTracking && transactionModalOpen && <TransactionModal draft={transactionDraft} editing={Boolean(editingTransactionId)} accounts={calculatedAccounts} payees={payees} plannedItems={planningCashflowItems} onChange={setTransactionDraft} onClose={() => setTransactionModalOpen(false)} onSave={saveTransaction} onRemove={() => editingTransactionId && softDeleteTransaction(editingTransactionId)}/>}
    {!isViewer && detailedSpendingTracking && payeeModalOpen && <PayeeModal payees={payees} onAdd={addPayee} onRename={renamePayee} onDelete={deletePayee} onClose={() => setPayeeModalOpen(false)}/>}
  </div>;
}

function TransactionsPage({ accounts, payees, transactions, onQuickAdd, onEdit, onAudit, onDelete, onRestore, onBatchAdd, onManagePayees }: { accounts: DebtAccount[]; payees: Payee[]; transactions: LedgerTransaction[]; onQuickAdd: () => void; onEdit: (transaction: LedgerTransaction) => void; onAudit: (id: string) => void; onDelete: (id: string) => void; onRestore: (id: string) => void; onBatchAdd: (drafts: TransactionDraft[]) => void; onManagePayees: () => void }) {
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "deleted" | "all">("active");
  const [pageNumber, setPageNumber] = useState(1);
  const [batchOpen, setBatchOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
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
    <div className="screen-title"><div><span className="eyebrow">Core transaction ledger</span><h1>Transactions</h1><p>Record charges, fees, and payments. Every active entry is included in the calculated account balances below.</p></div><div className="screen-actions ledger-actions"><button className="secondary" type="button" onClick={onManagePayees}>Merchants &amp; recipients</button><button className="secondary" type="button" disabled={!accounts.length} onClick={() => { setBatchRows(makeRows()); setBatchOpen((open) => !open); }}>Batch entry</button><label className={accounts.length ? "primary receipt-file-button" : "primary receipt-file-button disabled"}><input type="file" accept="image/*" capture="environment" disabled={!accounts.length} onChange={(event) => { const input = event.currentTarget; const file = input.files?.[0]; if (file) setReceiptFile(file); input.value = ""; }}/><span>Scan receipt</span></label><button className="secondary" type="button" disabled={!accounts.length} onClick={onQuickAdd}>+ Quick add</button></div></div>
    {!accounts.length ? <section className="large-empty"><span>Ledger</span><h2>Add a debt account first</h2><p>Transactions need an account so DebtFree can calculate how each charge, fee, or payment changes its balance.</p></section> : <>
      <section className="ledger-metrics"><article><span>Calculated debt</span><strong>{moneyPrecise.format(accounts.reduce((sum, account) => sum + account.balance, 0))}</strong><small>Opening balances plus active ledger entries</small></article><article><span>Charges & fees</span><strong className="charge">{moneyPrecise.format(charges)}</strong><small>Increase account balances</small></article><article><span>Payments</span><strong className="payment">{moneyPrecise.format(payments)}</strong><small>Reduce account balances</small></article><article><span>Saved names</span><strong>{payees.filter((payee) => !payee.deletedAt).length}</strong><small>{transactions.filter((transaction) => transaction.deletedAt).length} deleted transactions retained</small></article></section>
      <section className="balance-strip" aria-label="Calculated account balances">{accounts.map((account) => <div key={account.id}><span>{account.name}</span><strong>{moneyPrecise.format(account.balance)}</strong><small>Calculated balance</small></div>)}</section>
      {batchOpen && <section className="batch-card"><div className="batch-head"><div><span>Batch entry</span><strong>Add several transactions at once</strong></div><button type="button" onClick={() => setBatchOpen(false)}>Close</button></div><div className="batch-scroll"><table className="batch-table"><thead><tr><th>Date</th><th>Account</th><th>Type</th><th>Merchant / recipient</th><th>Amount</th><th>Memo</th></tr></thead><tbody>{batchRows.map((row, index) => <tr key={index}><td><input aria-label={`Row ${index + 1} date`} type="date" value={row.date} onChange={(event) => updateBatch(index, { date: event.target.value })}/></td><td><select aria-label={`Row ${index + 1} account`} value={row.accountId} onChange={(event) => updateBatch(index, { accountId: event.target.value })}><option value="">Select</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></td><td><select aria-label={`Row ${index + 1} type`} value={row.type} onChange={(event) => { const type = event.target.value as TransactionType; updateBatch(index, { type, category: type === "payment" ? "Debt payment" : type === "fee" ? "Interest & fees" : "Other" }); }}><option value="charge">Charge</option><option value="fee">Fee</option></select></td><td><input aria-label={`Row ${index + 1} merchant or recipient`} list="batch-payees" value={row.payeeName} placeholder="Who received it?" onChange={(event) => updateBatch(index, { payeeName: event.target.value })}/></td><td><div className="batch-amount"><span>$</span><input aria-label={`Row ${index + 1} amount`} type="number" min="0" step=".01" value={row.amount || ""} placeholder="0.00" onChange={(event) => updateBatch(index, { amount: number(event.target.value) })}/></div></td><td><input aria-label={`Row ${index + 1} memo`} value={row.memo} placeholder="Optional" onChange={(event) => updateBatch(index, { memo: event.target.value })}/></td></tr>)}</tbody></table><datalist id="batch-payees">{payees.filter((payee) => !payee.deletedAt).map((payee) => <option key={payee.id} value={payee.name}/>)}</datalist></div><div className="batch-footer"><button className="secondary" type="button" onClick={() => setBatchRows((current) => [...current, emptyTransactionDraft(accounts)])}>+ Add row</button><button className="primary" type="button" disabled={!batchRows.some((row) => row.accountId && row.payeeName.trim() && row.amount > 0)} onClick={submitBatch}>Save batch</button></div></section>}
      <section className="ledger-card"><div className="ledger-toolbar"><label className="ledger-search"><span>Search</span><input value={search} placeholder="Merchant, recipient, memo, category, or account" onChange={(event) => { setSearch(event.target.value); setPageNumber(1); }}/></label><label><span>Account</span><select value={accountFilter} onChange={(event) => { setAccountFilter(event.target.value); setPageNumber(1); }}><option value="all">All accounts</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label><span>Type</span><select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value as "all" | TransactionType); setPageNumber(1); }}><option value="all">All types</option><option value="charge">Charges</option><option value="payment">Payments</option><option value="fee">Fees</option></select></label><label><span>Status</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as "active" | "deleted" | "all"); setPageNumber(1); }}><option value="active">Active</option><option value="deleted">Deleted</option><option value="all">All</option></select></label></div>
        {visible.length ? <div className="ledger-table-scroll"><table className="ledger-table"><caption>Searchable transaction ledger</caption><thead><tr><th>Date</th><th>Merchant / recipient</th><th>Account</th><th>Type</th><th>Category / memo</th><th>Amount</th><th>Action</th></tr></thead><tbody>{visible.map((transaction) => <tr key={transaction.id} className={transaction.deletedAt ? "deleted-row" : ""}><td>{formatTransactionDate(transaction.date)}</td><td><strong>{transaction.payeeName}</strong>{transaction.deletedAt && <small>Deleted</small>}</td><td>{accountNames.get(transaction.accountId) ?? "Removed account"}</td><td><span className={`transaction-type ${transaction.type}`}>{transaction.type}</span></td><td><strong>{transaction.type === "payment" ? paymentKindLabel(transaction.paymentKind) : transaction.category}</strong>{transaction.type === "payment" && <small>Debt payment</small>}{transaction.memo && <small>{transaction.memo}</small>}{transaction.balanceBefore !== undefined && transaction.balanceAfter !== undefined && <small className="audit-balances">Balance {moneyPrecise.format(transaction.balanceBefore)} to {moneyPrecise.format(transaction.balanceAfter)}</small>}</td><td className={`ledger-amount ${transaction.type}`}>{transaction.type === "payment" ? "-" : "+"}{moneyPrecise.format(transaction.amount)}</td><td>{transaction.deletedAt ? transaction.replacedByTransactionId ? <span className="audit-lock">Replaced</span> : <button className="restore-action" type="button" onClick={() => onRestore(transaction.id)}>Restore</button> : transaction.debtAction === "payment" ? <button className="audit-action" type="button" onClick={() => onAudit(transaction.id)} aria-label={"View or correct payment for " + transaction.payeeName}>View / correct</button> : transaction.debtAction ? <span className="audit-lock">Audit record</span> : <div className="row-actions"><button type="button" onClick={() => onEdit(transaction)}>Edit</button><button type="button" onClick={() => onDelete(transaction.id)}>Delete</button></div>}</td></tr>)}</tbody></table></div> : <div className="ledger-empty"><strong>No matching transactions</strong><p>{transactions.length ? "Try changing the search or filters." : "Use Quick add or Batch entry to record your first transaction."}</p></div>}
        <div className="ledger-pagination"><span>{filtered.length ? `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length}` : "0 transactions"}</span><div><button type="button" disabled={currentPage === 1} onClick={() => setPageNumber((page) => Math.max(1, page - 1))}>Previous</button><strong>Page {currentPage} of {pageCount}</strong><button type="button" disabled={currentPage === pageCount} onClick={() => setPageNumber((page) => Math.min(pageCount, page + 1))}>Next</button></div></div>
      </section>
    </>}
    {receiptFile && <ReceiptScannerModal file={receiptFile} accounts={accounts} onClose={() => setReceiptFile(null)} onAdd={(draft) => { onBatchAdd([draft]); setReceiptFile(null); }}/>}
  </div>;
}

function ReceiptScannerModal({ file, accounts, onClose, onAdd }: { file: File; accounts: DebtAccount[]; onClose: () => void; onAdd: (draft: TransactionDraft) => void }) {
  const [previewUrl] = useState(() => URL.createObjectURL(file));
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Preparing receipt");
  const [error, setError] = useState("");
  const [scan, setScan] = useState<ReceiptScanResult | null>(null);
  const [draft, setDraft] = useState<TransactionDraft>(() => emptyTransactionDraft(accounts));

  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  useEffect(() => {
    let cancelled = false;
    void scanReceipt(file, (update) => {
      if (cancelled) return;
      setStatus(update.status === "recognizing text" ? "Reading receipt" : update.status === "loading tesseract core" ? "Starting private OCR" : "Preparing receipt");
      setProgress(Math.round(update.progress * 100));
    }).then((result) => {
      if (cancelled) return;
      setScan(result);
      setProgress(100);
      setStatus("Ready to review");
      setDraft({ date: result.date, accountId: accounts[0]?.id ?? "", payeeId: "", payeeName: result.merchant, type: "charge", category: result.category, memo: result.memo, amount: result.total });
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "The receipt could not be read.");
    });
    return () => { cancelled = true; };
  }, [accounts, file]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const canAdd = Boolean(scan && draft.accountId && draft.date && draft.payeeName.trim() && draft.amount > 0);
  return <div className="modal-backdrop receipt-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-modal-title">
    <header><div><span>On-device receipt OCR</span><h2 id="receipt-modal-title">Scan receipt</h2><p>The photo is processed on this device. It is not uploaded or saved with your transaction.</p></div><button type="button" onClick={onClose} aria-label="Close receipt scanner">&times;</button></header>
    <div className="receipt-body">
      <aside className="receipt-preview">{previewUrl && <img src={previewUrl} alt="Receipt selected for scanning"/>}<div><strong>{file.name}</strong><small>{Math.max(1, Math.round(file.size / 1024))} KB</small></div></aside>
      <section className="receipt-review" aria-live="polite">
        {!scan && !error && <div className="receipt-progress"><span className="receipt-scan-mark" aria-hidden="true"><i/></span><strong>{status}</strong><p>Finding the merchant, date, total, tax, and best category.</p><div><i style={{ width: String(Math.max(5, progress)) + "%" }}/></div><small>{progress}%</small></div>}
        {error && <div className="receipt-error"><strong>We couldn&apos;t read this receipt</strong><p>{error}</p><p>Try a clear, well-lit photo with the full receipt filling the frame. You can still use Quick add.</p></div>}
        {scan && <><div className="receipt-result-head"><div><span>Extraction complete</span><strong>{scan.confidence >= 80 ? "High-confidence read" : scan.confidence >= 55 ? "Review suggested" : "Careful review needed"}</strong></div><b>{scan.confidence}% text confidence</b></div>
          <div className="receipt-form"><label className="wide"><span>Merchant</span><input value={draft.payeeName} onChange={(event) => setDraft({ ...draft, payeeName: event.target.value, payeeId: "" })}/></label><label><span>Purchase date</span><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })}/></label><label><span>Account charged</span><select value={draft.accountId} onChange={(event) => setDraft({ ...draft, accountId: event.target.value })}><option value="">Select account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><Field label="Receipt total" prefix="$" value={draft.amount} placeholder="0.00" step=".01" onChange={(amount) => setDraft({ ...draft, amount })}/><label><span>Suggested category</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{TRANSACTION_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label className="wide"><span>Memo</span><input value={draft.memo} onChange={(event) => setDraft({ ...draft, memo: event.target.value })}/></label></div>
          <div className="receipt-extracted"><div><span>Tax found</span><strong>{scan.tax > 0 ? moneyPrecise.format(scan.tax) : "Not detected"}</strong></div><div><span>Category match</span><strong>{draft.category}</strong></div></div>
          <details><summary>View extracted receipt text</summary><pre>{scan.rawText}</pre></details>
        </>}
      </section>
    </div>
    <footer><span>{scan ? "Check every field before saving." : "Keep this window open while the receipt is read."}</span><div><button className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="button" disabled={!canAdd} onClick={() => onAdd(draft)}>Add to transactions</button></div></footer>
  </section></div>;
}


function TransactionModal({ draft, editing, accounts, payees, plannedItems, onChange, onClose, onSave, onRemove }: { draft: TransactionDraft; editing: boolean; accounts: DebtAccount[]; payees: Payee[]; plannedItems: CashflowItem[]; onChange: (draft: TransactionDraft) => void; onClose: () => void; onSave: () => void; onRemove: () => void }) {
  const activePayees = payees.filter((payee) => !payee.deletedAt);
  const account = accounts.find((item) => item.id === draft.accountId);
  const overpayment = draft.type === "payment" && Boolean(account) && draft.amount > (account?.balance ?? 0);
  const canSave = Boolean(draft.accountId && draft.date && (draft.type === "payment" || draft.payeeName.trim()) && draft.amount > 0 && !overpayment);
  const recipientLabel = draft.type === "charge" ? "Merchant" : "Charged by";
  const recipientPlaceholder = draft.type === "charge" ? "Example: Costco" : "Example: Card issuer";
  const changeType = (type: TransactionType) => onChange({ ...draft, type, category: type === "payment" ? "Debt payment" : type === "fee" ? "Interest & fees" : draft.category === "Debt payment" || draft.category === "Interest & fees" ? "Other" : draft.category, plannedItemId: type === "payment" ? "" : draft.plannedItemId });
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="modal transaction-modal" role="dialog" aria-modal="true" aria-labelledby="transaction-modal-title">
      <header><div><span>{editing ? "Edit transaction" : "Quick add"}</span><h2 id="transaction-modal-title">{editing ? draft.payeeName || "Transaction details" : "New transaction"}</h2><p>Charges and fees increase the balance. Payments use the audited debt-payment action and reduce the balance exactly once.</p></div><button type="button" onClick={onClose} aria-label="Close transaction form">&times;</button></header>
      <div className="form-grid">
        <div className="wide transaction-kind"><span>Transaction type</span><div>{(["charge", "payment", "fee"] as TransactionType[]).map((type) => <button type="button" key={type} className={draft.type === type ? `active ${type}` : type} onClick={() => changeType(type)}>{type === "charge" ? "Charge" : type === "payment" ? "Payment" : "Interest / fee"}</button>)}</div></div>
        <label><span>Date</span><input type="date" value={draft.date} onChange={(event) => onChange({ ...draft, date: event.target.value })}/></label>
        <label><span>Account</span><select value={draft.accountId} onChange={(event) => onChange({ ...draft, accountId: event.target.value })}><option value="">Select account</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name} - {moneyPrecise.format(item.balance)}</option>)}</select></label>
        {draft.type === "payment" ? <label className="wide"><span>What does this payment cover?</span><select aria-label="Payment classification" value={draft.paymentKind} onChange={(event) => onChange({ ...draft, paymentKind: event.target.value as PaymentKind })}><option value="minimum">Statement minimum</option><option value="extra">Extra payment only</option><option value="combined">Minimum plus extra</option></select><small className="field-help">Monthly Plan uses this to show what has been paid and what is still planned. A payment is never counted as household spending.</small></label> : <label className="wide"><span>{recipientLabel}</span><input autoFocus list="transaction-payees" value={draft.payeeName} placeholder={recipientPlaceholder} onChange={(event) => { const name = event.target.value; const match = activePayees.find((payee) => payee.name.toLowerCase() === name.toLowerCase()); onChange({ ...draft, payeeName: name, payeeId: match?.id ?? "" }); }}/><datalist id="transaction-payees">{activePayees.map((payee) => <option key={payee.id} value={payee.name}/>)}</datalist><small className="field-help">Who received the money or charged the account. The selected account is the debt balance this transaction changes.</small></label>}
        <Field label="Amount" prefix="$" value={draft.amount} placeholder="0.00" step=".01" onChange={(amount) => onChange({ ...draft, amount })}/>
        {overpayment && <p className="form-error wide" role="alert">Payment cannot exceed the current balance of {moneyPrecise.format(account?.balance ?? 0)}.</p>}
        {draft.type !== "payment" && <><label><span>Category</span><select value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value })}>{TRANSACTION_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label className="wide"><span>Planned entry match</span><select value={draft.plannedItemId ?? ""} onChange={(event) => onChange({ ...draft, plannedItemId: event.target.value })}><option value="">No planned entry</option>{plannedItems.filter((item) => item.kind !== "income").map((item) => <option key={item.id} value={item.id}>{item.name} - {moneyPrecise.format(item.amount)}</option>)}</select><small className="field-help">Matching an actual charge prevents the same planned card purchase from changing the payoff projection twice.</small></label></>}
        <label className="wide"><span>Memo</span><input value={draft.memo} placeholder="Optional note" onChange={(event) => onChange({ ...draft, memo: event.target.value })}/></label>
      </div>
      <footer>{editing ? <button className="danger" type="button" onClick={onRemove}>Delete transaction</button> : <span/>}<div><button className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="button" disabled={!canSave} onClick={onSave}>{editing ? "Save changes" : draft.type === "payment" ? "Record payment" : "Add transaction"}</button></div></footer>
    </section>
  </div>;
}

function PayeeModal({ payees, onAdd, onRename, onDelete, onClose }: { payees: Payee[]; onAdd: (name: string) => void; onRename: (id: string, name: string) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const active = payees.filter((payee) => !payee.deletedAt).sort((a, b) => a.name.localeCompare(b.name));
  const add = () => { if (!name.trim()) return; onAdd(name); setName(""); };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal payee-modal" role="dialog" aria-modal="true" aria-labelledby="payee-modal-title"><header><div><span>Transaction directory</span><h2 id="payee-modal-title">Merchants &amp; recipients</h2><p>Saved names make quick and batch entry faster.</p></div><button type="button" onClick={onClose} aria-label="Close merchants and recipients">&times;</button></header><div className="payee-body"><div className="payee-add"><input autoFocus value={name} placeholder="New merchant or recipient" onKeyDown={(event) => { if (event.key === "Enter") add(); }} onChange={(event) => setName(event.target.value)}/><button className="primary" type="button" disabled={!name.trim()} onClick={add}>Add name</button></div><div className="payee-list">{active.length ? active.map((payee) => <PayeeRow key={payee.id} payee={payee} onRename={onRename} onDelete={onDelete}/>) : <p>No saved names yet. Adding a transaction automatically saves its merchant or recipient.</p>}</div></div><footer><span>{active.length} saved {active.length === 1 ? "name" : "names"}</span><button className="primary" type="button" onClick={onClose}>Done</button></footer></section></div>;
}

function PayeeRow({ payee, onRename, onDelete }: { payee: Payee; onRename: (id: string, name: string) => void; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(payee.name);
  return <div className="payee-row"><div><span>{payee.name.slice(0, 2).toUpperCase()}</span>{editing ? <input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && name.trim()) { onRename(payee.id, name); setEditing(false); } }}/>: <strong>{payee.name}</strong>}</div><div>{editing ? <button type="button" onClick={() => { if (name.trim()) onRename(payee.id, name); setEditing(false); }}>Save</button> : <button type="button" onClick={() => setEditing(true)}>Rename</button>}<button type="button" onClick={() => onDelete(payee.id)}>Remove</button></div></div>;
}
type AccountsPageProps = {
  accounts: DebtAccount[];
  activeCount: number;
  transactions: LedgerTransaction[];
  balanceAdjustments: BalanceAdjustment[];
  actionMessage: string;
  totalBalance: number;
  minimums: number;
  interest: number;
  linkedCardExpenses: LinkedCardExpenses;
  sortKey: SortKey;
  sortDirection: SortDirection;
  paidOffById: Map<string, number | null | undefined>;
  priorityById: Map<string, number>;
  strategy: PayoffStrategy;
  onSort: (key: SortKey) => void;
  onAdd: () => void;
  onEdit: (account: DebtAccount) => void;
  onUpdateBalance: (account: DebtAccount) => void;
  onRecordPayment: (account: DebtAccount) => void;
  onMarkPaidOff: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onToggleMinimum: (id: string) => void;
  onTogglePayoff: (id: string) => void;
  onSample: () => void;
  onImport: (file: File) => Promise<void>;
  importMessage: string;
};

function AccountsPage({
  accounts, transactions, balanceAdjustments, actionMessage, activeCount, totalBalance, minimums, interest, linkedCardExpenses, sortKey, sortDirection,
  paidOffById, priorityById, strategy, onSort, onAdd, onEdit, onUpdateBalance, onRecordPayment,
  onMarkPaidOff, onArchive, onRestore, onToggleMinimum, onTogglePayoff, onSample, onImport, importMessage,
}: AccountsPageProps) {
  const { current, archived } = splitDebtAccounts(accounts);
  const totalLinkedExpenses = Object.values(linkedCardExpenses).reduce((sum, amount) => sum + amount, 0);
  const paidOffCount = current.filter((account) => account.balance <= 0).length;
  const headers: { key: SortKey; label: string }[] = [
    { key: "name", label: "Debt" }, { key: "balance", label: "Balance" }, { key: "apr", label: "APR" },
    { key: "minimum", label: "Minimum" }, { key: "dueDate", label: "Due date" }, { key: "status", label: "Status" },
  ];
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
  const auditRows = [
    ...transactions.filter((transaction) => transaction.debtAction && transaction.balanceBefore !== undefined && transaction.balanceAfter !== undefined).map((transaction) => ({
      id: transaction.id, accountId: transaction.accountId, kind: transaction.debtAction === "mark-paid-off" ? "Marked paid off" : "Payment",
      date: transaction.date, createdAt: transaction.createdAt, before: transaction.balanceBefore ?? 0, after: transaction.balanceAfter ?? 0,
      difference: -transaction.amount, note: transaction.memo, creator: transaction.creator,
    })),
    ...balanceAdjustments.map((adjustment) => ({
      id: adjustment.id, accountId: adjustment.accountId, kind: "Balance update",
      date: adjustment.date, createdAt: adjustment.createdAt, before: adjustment.balanceBefore, after: adjustment.balanceAfter,
      difference: adjustment.difference, note: adjustment.note ?? "", creator: adjustment.creator,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const auditCreatorLabel = (creator: { email?: string; displayName?: string } | undefined) => creator?.displayName || creator?.email || "Household member";
  const importInput = (label: string) => <label className="secondary import-file">
    <input type="file" accept=".csv,text/csv" onChange={(event) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (file) void onImport(file).finally(() => { input.value = ""; });
    }}/>
    <span>{label}</span>
  </label>;
  const priorityLabel = (account: DebtAccount) => {
    if (account.balance <= 0) return "Complete";
    if (account.payoffMode === "minimum-only") return "Minimum only";
    const priority = priorityById.get(account.id);
    return priority ? "#" + priority + " " + strategyLabel(strategy) : "Not ranked";
  };
  const payoffLabel = (account: DebtAccount) => {
    if (account.balance <= 0) return "Paid off";
    const payoff = paidOffById.get(account.id);
    return payoff ? monthAfter(payoff - 1) : "Needs adjustment";
  };
  const actionButtons = (account: DebtAccount) => <div className="debt-actions" aria-label={`Actions for ${account.name}`}>
    <button type="button" className="debt-action primary-action" aria-label={`Record payment for ${account.name}`} disabled={account.balance <= 0} onClick={() => onRecordPayment(account)}>Record payment</button>
    <button type="button" className="debt-action" aria-label={`Update balance for ${account.name}`} onClick={() => onUpdateBalance(account)}>Update balance</button>
    {account.balance > 0
      ? <button type="button" className="debt-action" aria-label={`Mark ${account.name} paid off`} onClick={() => onMarkPaidOff(account.id)}>Mark paid off</button>
      : <button type="button" className="debt-action" aria-label={`Archive ${account.name}`} onClick={() => onArchive(account.id)}>Archive</button>}
    <button type="button" className="debt-action" aria-label={`Edit ${account.name}`} onClick={() => onEdit(account)}>Edit</button>
  </div>;

  return <div className="screen debts-screen">
    <div className="screen-title">
      <div><span className="eyebrow">Debt workspace</span><h1>Debts</h1><p>See what to pay, what is due, and where every debt sits in your payoff order.</p></div>
      <div className="screen-actions">{importInput("Import CSV")}<button className="primary" type="button" onClick={onAdd}>+ Add debt</button></div>
    </div>
    {importMessage && <p className={importMessage.startsWith("Import failed") ? "import-message error" : "import-message"}>{importMessage}</p>}
    {actionMessage && <p className="debt-action-message" role="status" aria-live="polite">{actionMessage}</p>}
    <section className="metrics">
      <article className="metric"><span>Total balance</span><strong>{moneyPrecise.format(totalBalance)}</strong><small>Across current debts</small></article>
      <article className="metric"><span>Active debts</span><strong>{activeCount}</strong><small>{paidOffCount} paid off and ready to archive</small></article>
      <article className="metric"><span>Monthly minimums</span><strong>{moneyPrecise.format(minimums + totalLinkedExpenses)}</strong><small>{totalLinkedExpenses > 0 ? moneyPrecise.format(totalLinkedExpenses) + " in linked card expenses" : "Auto estimates included"}</small></article>
      <article className="metric"><span>Monthly interest</span><strong>{moneyPrecise.format(interest)}</strong><small>Estimate at current balances</small></article>
    </section>
    <section className="debt-list-card">
      <header className="table-card-head">
        <div><span>Current debt list</span><strong>{current.length} {current.length === 1 ? "debt" : "debts"}</strong></div>
        <span className="swipe-note">Priority follows your {strategy} plan</span>
      </header>
      {current.length ? <>
        <div className="debt-table-wrap">
          <table className="debt-table">
            <caption>Sortable debt account list with actions</caption>
            <thead><tr>
              {headers.map((header) => <th key={header.key}><button type="button" onClick={() => onSort(header.key)}>{header.label}<i aria-hidden="true">{sortKey === header.key ? (sortDirection === "asc" ? "\u2191" : "\u2193") : "\u2195"}</i></button></th>)}
              <th>Priority</th><th>Promotion</th><th>Actions</th>
            </tr></thead>
            <tbody>{current.map((account) => {
              const cardExpense = linkedCardExpenses[account.id] ?? 0;
              const promo = promoNotice(account);
              const status = debtStatus(account);
              return <tr key={account.id}>
                <td><button className="account-name" type="button" onClick={() => onEdit(account)}><span>{account.name.slice(0, 2).toUpperCase()}</span><div><strong>{account.name}</strong><small>{account.type} - Estimated paid off date: {payoffLabel(account)}</small></div></button></td>
                <td className="number-cell"><strong>{moneyPrecise.format(account.balance)}</strong>{account.creditLimit > 0 && <small>{Math.round(account.balance / account.creditLimit * 100)}% utilized</small>}</td>
                <td className="number-cell">{account.apr.toFixed(2)}%</td>
                <td><button className={"minimum-toggle " + account.minimumMode} type="button" disabled={account.balance <= 0} onClick={() => onToggleMinimum(account.id)}><strong>{moneyPrecise.format(effectiveMinimum(account) + cardExpense)}</strong><small>{account.minimumMode === "auto" ? "Auto estimate" : "Manual amount"}</small></button></td>
                <td><span className="date-cell">{formatDate(account.dueDate)}</span></td>
                <td>{account.balance > 0 ? <button className={"status-toggle " + account.payoffMode} type="button" onClick={() => onTogglePayoff(account.id)}>{status}</button> : <span className="status-toggle paid">{status}</span>}</td>
                <td><strong className="priority-order">{priorityLabel(account)}</strong></td>
                <td>{promo ? <span className={"promo-notice " + promo.tone}>{promo.label}</span> : <span className="muted-value">No promotion</span>}</td>
                <td>{actionButtons(account)}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <div className="debt-card-list">{current.map((account) => {
          const cardExpense = linkedCardExpenses[account.id] ?? 0;
          const promo = promoNotice(account);
          const status = debtStatus(account);
          return <article className={account.balance <= 0 ? "debt-card paid" : "debt-card"} key={account.id}>
            <header><div className="debt-card-name"><span>{account.name.slice(0, 2).toUpperCase()}</span><div><h2>{account.name}</h2><p>{account.type}</p></div></div><span className={account.balance <= 0 ? "status-toggle paid" : "status-toggle " + account.payoffMode}>{status}</span></header>
            <div className="debt-card-balance"><span>Current balance</span><strong>{moneyPrecise.format(account.balance)}</strong><small>Estimated paid off date: {payoffLabel(account)}</small></div>
            <dl>
              <div><dt>APR</dt><dd>{account.apr.toFixed(2)}%</dd></div>
              <div><dt>Minimum</dt><dd>{moneyPrecise.format(effectiveMinimum(account) + cardExpense)}</dd></div>
              <div><dt>Due date</dt><dd>{formatDate(account.dueDate)}</dd></div>
              <div><dt>Priority</dt><dd>{priorityLabel(account)}</dd></div>
            </dl>
            {promo && <p className={"promo-notice " + promo.tone}>{promo.label}</p>}
            {actionButtons(account)}
          </article>;
        })}</div>
      </> : <div className="empty-table"><span>{"\u25a4"}</span><h2>No debts added yet</h2><p>Add your debts to calculate your recommended payoff order and estimated debt-free date.</p><div>{importInput("Import DebtFree CSV")}<button className="primary" type="button" onClick={onAdd}>Add first debt</button><button className="secondary" type="button" onClick={onSample}>Load samples</button></div></div>}
    </section>
    {auditRows.length > 0 && <section className="debt-audit-card" aria-labelledby="debt-audit-title"><header><div><span>Auditable debt activity</span><h2 id="debt-audit-title">Payment and balance history</h2></div><small>Every entry preserves the balance before and after the action.</small></header><div className="debt-audit-list">{auditRows.slice(0, 10).map((row) => <article key={row.id}><div><strong>{row.kind}: {accountNames.get(row.accountId) ?? "Removed debt"}</strong><span>{formatDate(row.date)} - {auditCreatorLabel(row.creator)}</span>{row.note && <small>{row.note}</small>}</div><div><strong>{moneyPrecise.format(row.before)} to {moneyPrecise.format(row.after)}</strong><span className={row.difference <= 0 ? "decrease" : "increase"}>{row.difference <= 0 ? "-" : "+"}{moneyPrecise.format(Math.abs(row.difference))}</span></div></article>)}</div></section>}
    {archived.length > 0 && <details className="archived-debts">
      <summary>Archived debts ({archived.length})</summary>
      <div>{archived.map((account) => <article key={account.id}><div><strong>{account.name}</strong><span>Paid off - {account.type}</span></div><button type="button" className="secondary" aria-label={`Restore ${account.name}`} onClick={() => onRestore(account.id)}>Restore</button></article>)}</div>
    </details>}
  </div>;
}
function PayoffPlanPage({ accounts, plan, extra, availableExtra, strategy, customDebtOrder, linkedCardExpenseItems, linkedCardPurchaseItems, actualizedLinkedCardExpenses, monthlyItems, transactions, snapshots, onExtra, onStrategy, onCustomOrder, onAccounts }: { accounts: DebtAccount[]; plan: PayoffPlan; extra: number; availableExtra: number; strategy: PayoffStrategy; customDebtOrder: string[]; linkedCardExpenseItems: LinkedCardExpenseItems; linkedCardPurchaseItems: LinkedCardPurchaseItems; actualizedLinkedCardExpenses: LinkedCardExpenses; monthlyItems: CashflowItem[]; transactions: LedgerTransaction[]; snapshots: PayoffSnapshot[]; onExtra: (value: number) => void; onStrategy: (strategy: PayoffStrategy) => void; onCustomOrder: (orderedIds: string[]) => void; onAccounts: () => void }) {
  const [exporting, setExporting] = useState<"csv" | "excel" | "pdf" | null>(null);
  const [exportError, setExportError] = useState("");
  const [draggedCustomId, setDraggedCustomId] = useState<string | null>(null);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [reorderAnnouncement, setReorderAnnouncement] = useState("");
  const calculationDate = useMemo(() => new Date(), []);

  const description = strategy === "avalanche"
    ? "Highest effective APR first - usually the lowest total interest."
    : strategy === "snowball"
      ? "Lowest balance first - faster early wins."
      : "Choose the exact order. Drag on desktop or use Move up and Move down.";
  const planAccounts = accounts.filter((account) => account.balance > 0 || (linkedCardExpenseItems[account.id]?.length ?? 0) > 0 || (linkedCardPurchaseItems[account.id]?.length ?? 0) > 0);
  const currentMonthPurchaseTotal = Object.values(linkedCardPurchaseItems).flat().reduce((sum, item) => sum + item.amount, 0);
  const nonAmortizingNames = accounts.filter((account) => plan.nonAmortizingAccountIds.includes(account.id)).map((account) => account.name);
  const linkedExpenseTotals = useMemo(() => Object.fromEntries(Object.entries(linkedCardExpenseItems).map(([id, items]) => [id, round(items.reduce((sum, item) => sum + item.amount, 0))])), [linkedCardExpenseItems]);
  const linkedPurchaseTotals = useMemo(() => Object.fromEntries(Object.entries(linkedCardPurchaseItems).map(([id, items]) => [id, round(items.reduce((sum, item) => sum + item.amount, 0))])), [linkedCardPurchaseItems]);
  const comparisonModel = useMemo(() => buildStrategyComparison(accounts, extra, customDebtOrder, linkedExpenseTotals, linkedPurchaseTotals, calculationDate, actualizedLinkedCardExpenses), [accounts, actualizedLinkedCardExpenses, calculationDate, customDebtOrder, extra, linkedExpenseTotals, linkedPurchaseTotals]);
  const { comparisons: comparison, recommendedStrategy, alternativeStrategy, projectedSavings } = comparisonModel;
  const customAccounts = visibleCustomDebtOrder(accounts, customDebtOrder);
  const scheduleRows = useMemo(() => buildPayoffScheduleRows(accounts, plan, linkedExpenseTotals, linkedPurchaseTotals, actualizedLinkedCardExpenses), [accounts, actualizedLinkedCardExpenses, linkedExpenseTotals, linkedPurchaseTotals, plan]);
  const displayedScheduleRows = scheduleExpanded ? scheduleRows : scheduleRows.slice(0, DEFAULT_SCHEDULE_PREVIEW_MONTHS);
  const calculationWarnings = payoffCalculationWarnings(accounts, plan);
  const calculatedOn = calculationDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const priorityMinimumTotal = accounts.filter((account) => !account.archivedAt && account.balance > 0).reduce((sum, account) => sum + effectiveMinimum(account), 0);
  const linkedExpenseTotal = round(Object.values(linkedExpenseTotals).reduce((sum, amount) => sum + amount, 0));
  const comparisonDifference = (item: (typeof comparison)[number]) => {
    if (item.strategy === recommendedStrategy) return "Recommended baseline";
    const interestPart = item.interestDifference > .005 ? `+${moneyPrecise.format(item.interestDifference)} interest` : "Same interest";
    const monthPart = item.monthDifference === null ? "payoff incomplete" : item.monthDifference === 0 ? "same payoff month" : `${item.monthDifference > 0 ? "+" : ""}${item.monthDifference} month${Math.abs(item.monthDifference) === 1 ? "" : "s"}`;
    return `${interestPart}; ${monthPart}`;
  };
  const announceCustomOrder = (ids: string[], movedId: string) => {
    const moved = accounts.find((account) => account.id === movedId);
    const position = ids.indexOf(movedId) + 1;
    if (moved && position > 0) setReorderAnnouncement(`${moved.name} moved to position ${position} of ${ids.length}.`);
  };
  const reorderCustom = (movingId: string, targetId: string) => {
    if (movingId === targetId) return;
    const ids = customAccounts.map((account) => account.id);
    const from = ids.indexOf(movingId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    onCustomOrder(ids);
    announceCustomOrder(ids, movingId);
  };
  const moveCustom = (accountId: string, direction: -1 | 1) => {
    const ids = customAccounts.map((account) => account.id);
    const from = ids.indexOf(accountId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    onCustomOrder(ids);
    announceCustomOrder(ids, accountId);
  };

  const createReport = (): PayoffReportData => {
    const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
    const totalIncome = monthlyItems.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = monthlyItems.filter((item) => item.kind === "expense" || item.kind === "purchase").reduce((sum, item) => sum + item.amount, 0);
    const totalBudget = monthlyItems.filter((item) => item.kind === "budget").reduce((sum, item) => sum + item.amount, 0);
    const totalMinimums = accounts.reduce((sum, account) => sum + effectiveMinimum(account), 0);
    const payoffMonthByName = new Map<string, number>();
    plan.months.forEach((entry) => entry.paidOff.forEach((name) => payoffMonthByName.set(name, entry.month)));
    return {
      generatedAt: new Date().toLocaleString("en-US"),
      budgetMonth: monthLabel(currentMonthKey()),
      strategy: strategyLabel(strategy),
      projectedDebtFree: plan.months.length && !plan.stalled ? monthAfter(plan.months.length - 1) : "Needs adjustment",
      monthsToPayoff: plan.months.length,
      stalled: plan.stalled,
      startingDebt: round(accounts.reduce((sum, account) => sum + account.balance, 0)),
      monthlyPlan: round(plan.monthly),
      estimatedInterest: round(plan.totalInterest),
      extraPayment: round(extra),
      totalIncome: round(totalIncome),
      totalExpenses: round(totalExpenses),
      totalBudget: round(totalBudget),
      monthlySurplus: round(totalIncome - totalExpenses - totalBudget),
      totalMinimums: round(totalMinimums),
      availableExtra: round(availableExtra),
      cashflow: monthlyItems.map((item) => ({
        type: item.kind === "income" ? "Income" : item.kind === "expense" ? "Expense" : item.kind === "purchase" ? "One-time purchase" : "Budget",
        name: item.name,
        category: item.category,
        amount: item.amount,
        paymentMethod: item.kind !== "expense" && item.kind !== "purchase" ? "Not applicable" : item.paymentMethod === "credit" ? "Credit card" : "Debit / checking",
        linkedAccount: (item.kind === "expense" || item.kind === "purchase") && item.paymentMethod === "credit" ? accountNames.get(item.creditAccountId) ?? "Card not selected" : "",
      })),
      accounts: accounts.map((account) => {
        const linkedExpenses = (linkedCardExpenseItems[account.id] ?? []).reduce((sum, item) => sum + item.amount, 0);
        const payoffMonth = payoffMonthByName.get(account.name);
        return {
          name: account.name,
          type: account.type,
          balance: account.balance,
          apr: account.apr,
          monthlyInterest: monthlyInterest(account),
          minimumPayment: effectiveMinimum(account),
          linkedCardExpenses: round(linkedExpenses),
          plannedMonthlyPayment: round(plan.months[0]?.payments[account.id] ?? effectiveMinimum(account) + linkedExpenses),
          payoffMode: account.balance <= 0 ? "Paid off" : account.payoffMode === "minimum-only" ? "Minimum only" : "Payoff priority",
          creditLimit: account.creditLimit,
          utilization: account.creditLimit > 0 ? round(account.balance / account.creditLimit * 100) : null,
          dueDate: formatDate(account.dueDate),
          projectedPayoff: account.balance <= 0 ? "Complete" : payoffMonth ? monthAfter(payoffMonth - 1) : "Needs adjustment",
        };
      }),
      schedule: scheduleRows.map((row) => ({
        month: monthAfter(row.month.month - 1),
        focusDebt: row.focusDebt,
        minimumPayments: row.minimumPayments,
        extraPayment: row.extraPayment,
        totalPaid: row.totalPaid,
        interest: row.interest,
        remaining: row.endingBalance,
        milestone: row.month.paidOff.length ? `Paid off: ${row.month.paidOff.join(", ")}` : "",
        accounts: planAccounts.map((account) => ({ name: account.name, payment: round(row.month.payments[account.id] ?? 0), endingBalance: round(row.month.balances[account.id] ?? 0) })),
      })),
      transactions: [...transactions].sort((a, b) => b.date.localeCompare(a.date)).map((transaction) => ({
        date: transaction.date,
        merchant: transaction.payeeName,
        account: accountNames.get(transaction.accountId) ?? "Removed account",
        type: transaction.type === "fee" ? "Interest / fee" : transaction.type[0].toUpperCase() + transaction.type.slice(1),
        category: transaction.category,
        memo: transaction.memo,
        amount: transaction.amount,
        status: transaction.deletedAt ? "Deleted" : "Active",
      })),
      snapshots: [...snapshots].sort((a, b) => b.month.localeCompare(a.month)).map((snapshot) => ({
        month: monthLabel(snapshot.month),
        capturedAt: new Date(snapshot.capturedAt).toLocaleString("en-US"),
        totalBalance: snapshot.totalBalance,
        monthlyInterest: snapshot.monthlyInterest,
        activeAccountCount: snapshot.activeAccountCount,
        projectedDebtFree: snapshot.projectedDebtFreeMonth ?? "Needs adjustment",
        note: snapshot.note,
        accounts: snapshot.accounts.map((account) => ({ name: account.name, type: account.type, balance: account.balance, apr: account.apr })),
      })),
    };
  };

  const exportReport = async (format: "csv" | "excel" | "pdf") => {
    setExporting(format);
    setExportError("");
    try {
      const report = createReport();
      if (format === "csv") exportPayoffCsv(report);
      else if (format === "excel") await exportPayoffExcel(report);
      else await exportPayoffPdf(report);
    } catch {
      setExportError("The report could not be created. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  return <div className="screen plan-screen">
    <div className="screen-title">
      <div><span className="eyebrow">{strategyLabel(strategy)} strategy</span><h1>Payoff plan</h1><p>Compare proven payoff methods, choose your own order, and open the monthly details only when you need them.</p></div>
      <div className="plan-controls">
        <div className="strategy-control"><span>Strategy</span><div><button type="button" className={strategy === "avalanche" ? "active" : ""} onClick={() => onStrategy("avalanche")}>Avalanche</button><button type="button" className={strategy === "snowball" ? "active" : ""} onClick={() => onStrategy("snowball")}>Snowball</button><button type="button" className={strategy === "custom" ? "active" : ""} onClick={() => onStrategy("custom")}>Custom</button></div><small>{description}</small></div>
        <div className="extra-control"><label htmlFor="extra-monthly">Extra each month</label><div><b>$</b><input id="extra-monthly" type="number" min="0" inputMode="decimal" value={extra || ""} placeholder="0" onChange={(event) => onExtra(number(event.target.value))}/></div><button className={availableExtra > 0 && Math.abs(extra - availableExtra) < 0.01 ? "surplus-shortcut active" : "surplus-shortcut"} type="button" disabled={availableExtra <= 0} onClick={() => onExtra(availableExtra)}>{availableExtra > 0 ? `Use my ${moneyPrecise.format(availableExtra)} available extra` : "No extra available yet"}</button><small>{availableExtra > 0 ? "Calculated after planned spending and debt minimums. Edit anytime." : "Add income or adjust planned spending and minimums to create extra."}</small></div>
        <div className="export-control"><span>Export full report</span><div><button type="button" disabled={Boolean(exporting)} onClick={() => void exportReport("csv")}>{exporting === "csv" ? "Preparing..." : "CSV"}</button><button type="button" disabled={Boolean(exporting)} onClick={() => void exportReport("excel")}>{exporting === "excel" ? "Preparing..." : "Excel"}</button><button type="button" disabled={Boolean(exporting)} onClick={() => void exportReport("pdf")}>{exporting === "pdf" ? "Preparing..." : "PDF"}</button></div><small>Budget, debts, schedule, transactions, and snapshots.</small>{exportError && <em role="alert">{exportError}</em>}</div>
      </div>
    </div>
    {planAccounts.length && plan.months.length && !plan.stalled ? <>
      <section className="plan-hero"><div><span>Projected debt-free date</span><div className="plan-hero-value"><strong>{monthAfter(plan.months.length - 1)}</strong><small>- {plan.months.length} months from now</small></div></div><div><span>Monthly plan</span><div className="plan-hero-value"><strong>{money.format(plan.monthly)}</strong><small>- {currentMonthPurchaseTotal > 0 ? `Current month ${moneyPrecise.format(plan.months[0]?.requiredMonthly ?? plan.monthly)} includes one-time card purchases` : plan.peakMonthly > plan.monthly + .005 ? `Rises to ${moneyPrecise.format(plan.peakMonthly)} when a saved post-promo minimum begins` : "Minimums + linked card expenses + extra"}</small></div></div><div><span>Estimated interest</span><div className="plan-hero-value"><strong>{money.format(plan.totalInterest)}</strong><small>- Actual fee calibration used when provided</small></div></div></section>
      <section className="plan-insights">
        <article className="strategy-recommendation">
          <div><span>Recommended strategy</span><strong>{strategyLabel(recommendedStrategy)}</strong><p>{projectedSavings > .005 ? `${strategyLabel(recommendedStrategy)} is recommended because it is projected to save ${moneyPrecise.format(projectedSavings)} in interest compared with ${strategyLabel(alternativeStrategy)}.` : "Avalanche is recommended because it prioritizes the highest effective APR; both standard strategies currently project the same interest."}</p></div>
          <button type="button" className="secondary" onClick={() => onStrategy(recommendedStrategy)}>Use recommendation</button>
        </article>
        <article className="strategy-comparison-card">
          <header><span>Compare strategies</span><strong>Same monthly payment, different order</strong></header>
          <div className="strategy-table-wrap"><table><caption>Avalanche, snowball, and available custom payoff comparison</caption><thead><tr><th>Strategy</th><th>Debt-free date</th><th>Total interest</th><th>First target debt</th><th>Months to payoff</th><th>Difference from recommendation</th></tr></thead><tbody>{comparison.map((item) => <tr key={item.strategy} className={strategy === item.strategy ? "active" : ""}><td><strong>{strategyLabel(item.strategy)}</strong>{strategy === item.strategy && <small>Saved strategy</small>}</td><td>{item.plan.stalled ? "Needs adjustment" : monthAfter(item.plan.months.length - 1)}</td><td>{moneyPrecise.format(item.plan.totalInterest)}</td><td>{item.firstTarget}</td><td>{item.plan.stalled ? "Not available" : item.plan.months.length}</td><td>{comparisonDifference(item)}</td></tr>)}</tbody></table></div>
        </article>
      </section>
      {strategy === "custom" && customAccounts.length > 0 && <section className="custom-order-card">
        <header><div><span>Custom payoff order</span><strong>Put debts in the order you want extra money applied</strong></div><small>Drag rows on desktop or use the accessible buttons.</small></header>
        <ol>{customAccounts.map((account, index) => <li key={account.id} draggable onDragStart={(event) => { setDraggedCustomId(account.id); event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedCustomId) reorderCustom(draggedCustomId, account.id); setDraggedCustomId(null); }} onDragEnd={() => setDraggedCustomId(null)} className={draggedCustomId === account.id ? "dragging" : ""}>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{reorderAnnouncement}</p>
          <span className="drag-handle" aria-hidden="true">::</span><b>{index + 1}</b><div><strong>{account.name}</strong><small>{moneyPrecise.format(account.balance)} &middot; {account.apr.toFixed(2)}% APR</small></div><div className="custom-order-actions"><button type="button" disabled={index === 0} aria-label={`Move ${account.name} up`} onClick={() => moveCustom(account.id, -1)}>Move up</button><button type="button" disabled={index === customAccounts.length - 1} aria-label={`Move ${account.name} down`} onClick={() => moveCustom(account.id, 1)}>Move down</button></div>
        </li>)}</ol>
      </section>}
      <section className="table-card plan-table-card payoff-schedule" aria-labelledby="payoff-schedule-title">
        <header className="table-card-head"><div className="plan-table-summary"><strong id="payoff-schedule-title">Month-by-month schedule</strong><span>{plan.months.length} months &middot; {strategyLabel(strategy)}</span><small>{scheduleExpanded ? "Complete schedule shown." : `First ${Math.min(DEFAULT_SCHEDULE_PREVIEW_MONTHS, scheduleRows.length)} months shown.`}</small></div><button type="button" className="schedule-toggle" aria-expanded={scheduleExpanded} aria-controls="payoff-schedule-table" onClick={() => setScheduleExpanded((current) => !current)}>{scheduleExpanded ? "Show summary" : `Show all ${scheduleRows.length} months`}</button></header>
        <div className="table-scroll plan-scroll" id="payoff-schedule-table"><table className="payoff-table compact-payoff-table"><caption>{scheduleExpanded ? "Complete month-by-month payoff schedule" : "Initial payoff schedule summary"}</caption><thead><tr><th>Month</th><th>Focus debt</th><th>Minimum payments</th><th>Extra payment</th><th>Interest</th><th>Total paid</th><th>Ending balance</th></tr></thead><tbody>{displayedScheduleRows.map(({ month, focusDebt, minimumPayments, extraPayment, interest, totalPaid, endingBalance }) => <tr key={month.month}><td><strong>{monthAfter(month.month - 1)}</strong><small>Month {month.month}</small></td><td><strong>{focusDebt}</strong>{month.paidOff.length > 0 && <small className="milestone">Paid off: {month.paidOff.join(", ")}</small>}</td><td className="number-cell">{moneyPrecise.format(minimumPayments)}</td><td className="number-cell">{moneyPrecise.format(extraPayment)}</td><td className="number-cell">{moneyPrecise.format(interest)}</td><td className="number-cell">{moneyPrecise.format(totalPaid)}</td><td className="number-cell remaining">{moneyPrecise.format(endingBalance)}</td></tr>)}</tbody></table></div>
      </section>
      <details className="calculation-details">
        <summary>How this plan was calculated</summary>
        <div className="calculation-details-body">
          <dl>
            <div><dt>Selected strategy</dt><dd>{strategyLabel(strategy)}. {description}</dd></div>
            <div><dt>Monthly payment amount</dt><dd>{moneyPrecise.format(plan.monthly)}: {moneyPrecise.format(priorityMinimumTotal)} in entered or estimated minimums, {moneyPrecise.format(linkedExpenseTotal)} in recurring linked card expenses, and {moneyPrecise.format(extra)} extra.</dd></div>
            <div><dt>Minimum-payment assumptions</dt><dd>Manual minimums use the amounts entered. Automatic minimums use the larger of $25 or 1% of balance plus monthly interest, capped at the balance.</dd></div>
            <div><dt>Interest calculation method</dt><dd>Interest is projected monthly from each opening balance using the effective forecast APR, including actual interest-fee calibration when entered, and rounded to cents in the schedule.</dd></div>
            <div><dt>Payment rollover</dt><dd>After minimums, extra money follows the selected target order. Payments freed by a payoff roll to the next eligible debt; minimum-only debts never receive extra.</dd></div>
            <div><dt>Promotional-rate assumptions</dt><dd>Saved promotional APRs apply through their ending month, then the saved post-promotion APR and minimum take effect. Avalanche re-ranks using that month&apos;s effective forecast APR.</dd></div>
            <div><dt>Planned new-purchase assumptions</dt><dd>{currentMonthPurchaseTotal > 0 ? `${moneyPrecise.format(currentMonthPurchaseTotal)} of planned one-time card purchases is added only in the first forecast month.` : "No planned one-time card purchases are added."} Recurring linked card expenses continue monthly, excluding current-month items already recorded.</dd></div>
            <div><dt>Calculation date</dt><dd>{calculatedOn}</dd></div>
            <div><dt>Missing-data warnings</dt><dd>{calculationWarnings.length ? <ul>{calculationWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : "No missing calculation data detected."}</dd></div>
          </dl>
          <p>Estimate based on the balances, rates, and payments currently entered.</p>
        </div>
      </details>
    </> : <section className="large-empty"><span>{"\u2713"}</span><h2>{plan.stalled ? (nonAmortizingNames.length ? "A balance is not amortizing" : "The current payments do not outpace interest") : "Add debt accounts to build your plan"}</h2><p>{plan.stalled ? (nonAmortizingNames.length ? `${nonAmortizingNames.join(", ")} does not shrink after interest and new charges at the modeled payment. Enter the issuer's actual minimum or add extra payment.` : "Increase a minimum payment or add an extra monthly amount to create a finish line.") : "Once your accounts have balances, APRs, and minimums, the complete payoff schedule will appear here."}</p><button className="primary" type="button" onClick={onAccounts}>Review debt accounts</button></section>}
  </div>;
}
function ProfilePage({ user, householdName, role, members, cloudStatus, deviceOnly, transferMessage, onExportBackup, onImportBackup, onInvite, onRemove }: { user: DashboardUser; householdName: string; role: HouseholdRole; members: HouseholdMember[]; cloudStatus: CloudStatus; deviceOnly: boolean; transferMessage: string; onExportBackup: () => void; onImportBackup: (file: File) => Promise<void>; onInvite: (email: string, role: Exclude<HouseholdRole, "owner">) => Promise<void>; onRemove: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [accessRole, setAccessRole] = useState<Exclude<HouseholdRole, "owner">>("admin");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const invite = async () => {
    setWorking(true);
    setMessage("");
    try {
      await onInvite(email, accessRole);
      setEmail("");
      setMessage((accessRole === "admin" ? "Admin" : "Viewer") + " access saved for that email.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The household member could not be added");
    } finally {
      setWorking(false);
    }
  };
  const remove = async (memberEmail: string) => {
    if (!confirm("Remove " + memberEmail + " from this household?")) return;
    setWorking(true);
    try { await onRemove(memberEmail); setMessage("Household member removed."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The household member could not be removed"); }
    finally { setWorking(false); }
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.origin); setMessage("Dashboard link copied."); }
    catch { setMessage("Copy this address from your browser."); }
  };
  const roleLabel = role === "owner" ? "Household owner" : role === "admin" ? "Household admin" : "Household viewer";
  return <div className="screen profile-screen">
    <div className="screen-title">
      <div>
        <span className="eyebrow">{deviceOnly ? "Device storage" : "Household access"}</span>
        <h1>My account</h1>
        <p>{deviceOnly ? "This dashboard keeps your financial data in this browser on this device." : "Your verified personal email controls access to this shared household dashboard."}</p>
      </div>
      <button className="secondary" type="button" onClick={copyLink}>Copy dashboard link</button>
    </div>
    <section className={deviceOnly ? "profile-grid device-only-profile" : "profile-grid"}>
      <article className="profile-card">
        <div className="profile-avatar">{user.displayName.slice(0,2).toUpperCase()}</div>
        <div>
          <span>{deviceOnly ? "Local dashboard" : roleLabel}</span>
          <strong>{user.displayName}</strong>
          <small>{user.email}</small>
        </div>
        <div className="account-cloud-state">
          <i className={cloudStatus}/>
          <span>{deviceOnly ? "Saved in this browser on this device" : role === "viewer" ? "Read-only household access" : cloudStatus === "synced" ? "Household cloud sync is active" : cloudStatus === "error" ? "Cloud unavailable; device backup is safe" : "Syncing household changes"}</span>
        </div>
        {!deviceOnly && <a className="secondary account-link" href="/cdn-cgi/access/logout">Sign out</a>}
        {deviceOnly && message && <p className="share-message">{message}</p>}
      </article>
      {!deviceOnly && <article className="roles-card household-card">
        <div className="card-head"><div><span>{householdName}</span><strong>Household members</strong></div></div>
        {role === "owner" && <div className="invite-admin"><label><span>Member email and access</span><div><input type="email" value={email} placeholder="member@example.com" onChange={(event) => setEmail(event.target.value)}/><select aria-label="Household access role" value={accessRole} onChange={(event) => setAccessRole(event.target.value as Exclude<HouseholdRole, "owner">)}><option value="admin">Admin</option><option value="viewer">Viewer</option></select><button className="primary" type="button" disabled={working || !email.trim()} onClick={invite}>Add member</button></div><small>Admins can edit the shared dashboard. Viewers can only review it. Each member signs in with a one-time code sent to their own email.</small></label></div>}
        {message && <p className="share-message">{message}</p>}
        <div className="member-list">{members.map((member) => <div className="member-row" key={member.email}><div><strong>{member.display_name || member.email}</strong><small>{member.display_name ? member.email : member.status === "invited" ? "Waiting for first sign-in" : "Household member"}</small></div><span className={member.status}>{member.role}</span>{role === "owner" && member.role !== "owner" ? <button type="button" disabled={working} onClick={() => remove(member.email)}>Remove</button> : <i/>}</div>)}</div>
      </article>}
      <section className="data-transfer-card">
        <div>
          <span className="eyebrow">Full data transfer</span>
          <h2>Backup or restore the complete dashboard</h2>
          <p>Use one private JSON file to move debts, monthly plans, one-time adjustments, payees, transactions, payoff settings, and snapshots between dashboard addresses.</p>
          <small>{deviceOnly ? "Imported data is stored only in this browser on this device." : role === "viewer" ? "Viewers cannot replace household data." : "Imported data is saved to this device and your connected household."}</small>
        </div>
        <div className="data-transfer-actions">
          <button className="secondary" type="button" onClick={onExportBackup}>Export full backup</button>
          {role !== "viewer" && <label className="primary import-file">
            <input type="file" accept=".json,application/json" onChange={(event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              if (file) void onImportBackup(file).finally(() => { input.value = ""; });
            }}/>
            <span>Import full backup</span>
          </label>}
        </div>
        {transferMessage && <p role={transferMessage.startsWith("Import failed") ? "alert" : "status"} className={transferMessage.startsWith("Import failed") ? "transfer-message error" : "transfer-message"}>{transferMessage}</p>}
      </section>
    </section>
  </div>;
}
function SnapshotsPage({ openingAccounts, transactions, snapshots, currentInterest, plan, strategy, onCapture, onUpdateNote, onDelete, onAddDebt, onDetailedProjections }: { openingAccounts: DebtAccount[]; transactions: LedgerTransaction[]; snapshots: PayoffSnapshot[]; currentInterest: number; plan: PayoffPlan; strategy: PayoffStrategy; onCapture: (note: string) => void; onUpdateNote: (id: string, note: string) => void; onDelete: (id: string) => void; onAddDebt: () => void; onDetailedProjections: () => void }) {
  const [captureNote, setCaptureNote] = useState(() => snapshots.find((snapshot) => snapshot.month === currentMonthKey())?.note ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const progress = useMemo(() => buildProgressBalanceView(openingAccounts, transactions, snapshots), [openingAccounts, snapshots, transactions]);
  const accounts = progress.currentAccounts;
  const ordered = progress.snapshots;
  const latest = ordered.at(-1) ?? null;
  const selected = ordered.find((snapshot) => snapshot.id === selectedId) ?? latest;
  const currentTotal = progress.currentTotal;
  const currentMonthSnapshot = snapshots.find((snapshot) => snapshot.month === currentMonthKey());
  const first = ordered[0] ?? null;
  const paidSinceFirst = first ? round(progress.startingTotal - currentTotal) : 0;
  const changedSinceLatest = latest ? round(latest.totalBalance - currentTotal) : 0;
  const maxBalance = Math.max(currentTotal, progress.startingTotal, ...ordered.map((snapshot) => snapshot.totalBalance), 1);
  const selectedIndex = selected ? ordered.findIndex((snapshot) => snapshot.id === selected.id) : -1;
  const previous = selectedIndex > 0 ? ordered[selectedIndex - 1] : null;
  const previousBalances = new Map(previous?.accounts.map((account) => [account.accountId, account.balance]) ?? []);
  const formatCaptured = (value: string) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const capture = () => { onCapture(captureNote); };
  const projectedDebtFree = plan.months.length && !plan.stalled ? monthAfter(plan.months.length - 1) : plan.stalled ? "Needs adjustment" : "Debt free";

  return <div className="screen snapshots-screen">
    <div className="screen-title"><div><span className="eyebrow">Progress and projections</span><h1>Progress</h1><p>Compare your live payoff projection with saved monthly snapshots so you can see where the plan is headed and what has actually changed.</p></div><button className="primary snapshot-capture-button" type="button" disabled={!accounts.length} onClick={capture}>{currentMonthSnapshot ? `Update ${monthLabel(currentMonthKey())}` : `Save ${monthLabel(currentMonthKey())}`}</button></div>
    {accounts.length > 0 && <section className="progress-projection-card" aria-labelledby="progress-projection-title"><header><div><span>Current projection</span><h2 id="progress-projection-title">Where this plan is headed</h2></div><button type="button" onClick={onDetailedProjections}>Detailed projections</button></header><div><article><span>Projected debt-free</span><strong>{projectedDebtFree}</strong><small>{strategyLabel(strategy)} strategy</small></article><article><span>Monthly debt payment</span><strong>{moneyPrecise.format(plan.monthly)}</strong><small>Minimums and extra payment</small></article><article><span>Projected interest</span><strong>{moneyPrecise.format(plan.totalInterest)}</strong><small>From the tested payoff engine</small></article><article><span>Projection status</span><strong>{plan.stalled ? "Action needed" : "On track"}</strong><small>{plan.stalled ? "Increase payment or correct debt terms" : `${plan.months.length} modeled months`}</small></article></div></section>}
    {!accounts.length ? <section className="large-empty"><span>Progress</span><h2>Progress starts with your first debt</h2><p>A debt gives the payoff engine a starting balance and lets monthly snapshots show what changed over time.</p><button className="primary" type="button" onClick={onAddDebt}>Add first debt</button></section> : <>
      <section className="snapshot-capture-card"><div><span>{currentMonthSnapshot ? "This month is already saved" : "Ready for this month"}</span><strong>{moneyPrecise.format(currentTotal)}</strong><small>{accounts.filter((account) => account.balance > 0).length} active accounts | {moneyPrecise.format(currentInterest)} estimated monthly interest</small></div><label><span>Monthly note</span><textarea value={captureNote} maxLength={240} placeholder="Optional: what changed this month?" onChange={(event) => setCaptureNote(event.target.value)}/></label><button className="primary" type="button" onClick={capture}>{currentMonthSnapshot ? "Refresh snapshot" : "Capture balances"}</button></section>
      {snapshots.length ? <>
        <section className="snapshot-metrics"><article><span>Current debt</span><strong>{moneyPrecise.format(currentTotal)}</strong><small>Starting balances + charges and fees - payments</small></article><article className={paidSinceFirst >= 0 ? "good" : "warning"}><span>Change since start</span><strong>{paidSinceFirst >= 0 ? "-" : "+"}{moneyPrecise.format(Math.abs(paidSinceFirst))}</strong><small>{progress.baselineMonth ? `Since ${monthLabel(progress.baselineMonth)}` : "Opening account balances"}</small></article><article className={changedSinceLatest >= 0 ? "good" : "warning"}><span>Since last snapshot</span><strong>{changedSinceLatest >= 0 ? "-" : "+"}{moneyPrecise.format(Math.abs(changedSinceLatest))}</strong><small>{latest ? `Compared with ${monthLabel(latest.month)}` : "No comparison yet"}</small></article><article><span>Starting debt</span><strong>{moneyPrecise.format(progress.startingTotal)}</strong><small>{progress.baselineMonth ? `${monthLabel(progress.baselineMonth)} opening balance` : "Opening account balances"}</small></article></section>
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

function StatsPage({ accounts, snapshots, transactions, extra, strategy, linkedCardExpenses, linkedCardPurchases }: { accounts: DebtAccount[]; snapshots: PayoffSnapshot[]; transactions: LedgerTransaction[]; extra: number; strategy: PayoffStrategy; linkedCardExpenses: LinkedCardExpenses; linkedCardPurchases: LinkedCardExpenses }) {
  const [scenarioExtra, setScenarioExtra] = useState(extra);
  const totalDebt = accounts.reduce((sum, account) => sum + account.balance, 0);
  const forecast = useMemo(() => calculatePlan(accounts, scenarioExtra, strategy, linkedCardExpenses, linkedCardPurchases), [accounts, linkedCardExpenses, linkedCardPurchases, scenarioExtra, strategy]);
  const avalanche = useMemo(() => calculatePlan(accounts, scenarioExtra, "avalanche", linkedCardExpenses, linkedCardPurchases), [accounts, linkedCardExpenses, linkedCardPurchases, scenarioExtra]);
  const snowball = useMemo(() => calculatePlan(accounts, scenarioExtra, "snowball", linkedCardExpenses, linkedCardPurchases), [accounts, linkedCardExpenses, linkedCardPurchases, scenarioExtra]);
  const baseline = useMemo(() => calculatePlan(accounts, 0, strategy, linkedCardExpenses, linkedCardPurchases), [accounts, linkedCardExpenses, linkedCardPurchases, strategy]);
  const activeTransactions = transactions.filter((transaction) => !transaction.deletedAt);
  const payments = activeTransactions.filter((transaction) => transaction.type === "payment").reduce((sum, transaction) => sum + transaction.amount, 0);
  const charges = activeTransactions.filter((transaction) => transaction.type !== "payment").reduce((sum, transaction) => sum + transaction.amount, 0);
  const netLedgerReduction = round(payments - charges);
  const orderedSnapshots = [...snapshots].sort((a, b) => a.month.localeCompare(b.month));
  const firstSnapshot = orderedSnapshots[0] ?? null;
  const latestSnapshot = orderedSnapshots.at(-1) ?? null;
  const actualSnapshotReduction = firstSnapshot && latestSnapshot ? round(firstSnapshot.totalBalance - latestSnapshot.totalBalance) : 0;
  const averageSnapshotReduction = orderedSnapshots.length > 1 ? round(actualSnapshotReduction / (orderedSnapshots.length - 1)) : 0;
  const payoffDate = (result: PayoffPlan) => result.stalled ? (result.nonAmortizingAccountIds.length ? "No payoff at this payment" : "Needs adjustment") : result.months.length ? monthAfter(result.months.length - 1) : totalDebt <= 0 ? "Debt free" : "No projection";
  const scenarioValues = [...new Set([0, extra, extra + 100, extra + 250, extra + 500].map((value) => Math.max(0, round(value))))].sort((a, b) => a - b);
  const scenarios = scenarioValues.map((value) => ({ value, result: calculatePlan(accounts, value, strategy, linkedCardExpenses, linkedCardPurchases) }));
  const milestone = (remainingShare: number) => { const entry = forecast.months.find((month) => month.remaining <= totalDebt * remainingShare + .005); return entry ? monthAfter(entry.month - 1) : null; };
  const promoAccounts = accounts.filter(hasPromoTerms);
  const nonAmortizingAccounts = accounts.filter((account) => forecast.nonAmortizingAccountIds.includes(account.id));
  const fallbackPromoAccounts = accounts.filter((account) => forecast.promoMinimumFallbackIds.includes(account.id));
  const forecastInterestSaved = baseline.totalInterest > 0 && !baseline.stalled && !forecast.stalled ? Math.max(0, round(baseline.totalInterest - forecast.totalInterest)) : 0;

  return <div className="screen stats-screen">
    <div className="screen-title"><div><span className="eyebrow">Complete debt outlook</span><h1>Stats & projections</h1><p>Combine your live ledger, saved snapshots, and payoff plan to understand progress and test faster payoff scenarios.</p></div></div>
    {!accounts.length ? <section className="large-empty"><span>Stats</span><h2>Add debt accounts to build projections</h2><p>Once balances and minimum payments exist, this page will compare strategies and payoff scenarios.</p></section> : <>
      <section className="stats-hero"><div><span>Projected debt-free date</span><strong>{payoffDate(forecast)}</strong><small>{forecast.stalled ? "Increase monthly payments to create a finish line" : `${forecast.months.length} months using ${strategy}`}</small></div><div><span>Current debt</span><strong>{moneyPrecise.format(totalDebt)}</strong><small>{accounts.filter((account) => account.balance > 0).length} active accounts</small></div><div><span>Monthly payoff plan</span><strong>{moneyPrecise.format(forecast.monthly)}</strong><small>Minimums, linked card expenses, and extra</small></div><div><span>Projected interest</span><strong>{moneyPrecise.format(forecast.totalInterest)}</strong><small>{forecastInterestSaved > 0 ? `${moneyPrecise.format(forecastInterestSaved)} less than minimum-only pace` : "Based on current balances and rates"}</small></div></section>
      <section className="scenario-card"><div className="scenario-copy"><span>What-if planner</span><h2>Extra payment each month</h2><p>Adjust this amount to update every projection below. This does not change your saved payoff plan.</p></div><div className="scenario-control"><div><span>$</span><input type="number" min="0" step="25" value={scenarioExtra || ""} placeholder="0" onChange={(event) => setScenarioExtra(number(event.target.value))}/><button type="button" disabled={scenarioExtra === extra} onClick={() => setScenarioExtra(extra)}>Use saved extra</button></div><input aria-label="Extra monthly payment scenario" type="range" min="0" max="2000" step="25" value={Math.min(2000, scenarioExtra)} onChange={(event) => setScenarioExtra(number(event.target.value))}/></div><div className="scenario-result"><span>Scenario finish</span><strong>{payoffDate(forecast)}</strong><small>{forecast.stalled ? "Payments do not outpace interest" : `${forecast.months.length} months | ${moneyPrecise.format(forecast.totalInterest)} interest`}</small></div></section>
      {promoAccounts.length > 0 && <section className={forecast.stalled ? "true-cost-warning danger" : "true-cost-warning"}>
        <div className="true-cost-icon" aria-hidden="true">!</div>
        <div className="true-cost-copy">
          <span>True Cost forecast</span>
          <h2>{forecast.stalled ? "No reliable payoff date at this payment" : `${moneyPrecise.format(forecast.totalInterest)} projected interest through ${payoffDate(forecast)}`}</h2>
          <p>{forecast.stalled
            ? `The forecast stops when the balance no longer falls. It accumulated ${moneyPrecise.format(forecast.totalInterest)} in interest before that point.`
            : forecast.peakMonthly > forecast.monthly + .005
              ? `The required monthly plan rises from ${moneyPrecise.format(forecast.monthly)} to ${moneyPrecise.format(forecast.peakMonthly)} when the saved post-promo minimum takes effect.`
              : `The monthly plan stays at ${moneyPrecise.format(forecast.monthly)} while the post-promo APR and minimum are applied.`}</p>
          <div className="true-cost-terms">{promoAccounts.map((account) => <div key={account.id}><strong>{account.name}</strong><span>{formatDate(account.promoEndDate)} end</span><span>{account.postPromoApr.toFixed(2)}% APR after</span><span>{moneyPrecise.format(account.postPromoMinimum > 0 ? account.postPromoMinimum : effectiveMinimum(account))} minimum after</span></div>)}</div>
          {fallbackPromoAccounts.length > 0 && <small>Minimum not yet supplied for {fallbackPromoAccounts.map((account) => account.name).join(", ")}. The forecast keeps the current minimum; it does not silently estimate a higher one.</small>}
          {nonAmortizingAccounts.length > 0 && <strong className="non-amortizing">Non-amortizing: {nonAmortizingAccounts.map((account) => account.name).join(", ")}. The modeled payment does not reduce the balance after interest and new charges.</strong>}
        </div>
      </section>}\n      <section className="stats-grid">
        <article className="strategy-card"><div className="stats-card-head"><div><span>Strategy comparison</span><strong>Same payment, different order</strong></div></div><div className="strategy-comparison"><div className={strategy === "avalanche" ? "active" : ""}><span>Avalanche</span><strong>{payoffDate(avalanche)}</strong><small>{avalanche.stalled ? "Non-amortizing" : `${avalanche.months.length} months`}</small><b>{moneyPrecise.format(avalanche.totalInterest)} interest</b></div><div className={strategy === "snowball" ? "active" : ""}><span>Snowball</span><strong>{payoffDate(snowball)}</strong><small>{snowball.stalled ? "Non-amortizing" : `${snowball.months.length} months`}</small><b>{moneyPrecise.format(snowball.totalInterest)} interest</b></div></div><p>{avalanche.totalInterest <= snowball.totalInterest ? `Avalanche saves ${moneyPrecise.format(snowball.totalInterest - avalanche.totalInterest)} in projected interest.` : `Snowball saves ${moneyPrecise.format(avalanche.totalInterest - snowball.totalInterest)} in this projection.`}</p></article>
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
  const isOutflow = draft.kind === "expense" || draft.kind === "purchase";
  const needsCreditAccount = isOutflow && draft.paymentMethod === "credit";
  const canSave = Boolean(draft.name.trim()) && draft.amount > 0 && (!needsCreditAccount || Boolean(draft.creditAccountId));
  const changeKind = (kind: CashflowKind) => { const outflow = kind === "expense" || kind === "purchase"; onChange({ ...draft, kind, recurring: kind !== "purchase", category: CASHFLOW_CATEGORIES[kind][0], paymentMethod: outflow ? draft.paymentMethod : "debit", creditAccountId: outflow ? draft.creditAccountId : "" }); };
  const title = draft.kind === "income" ? "planned income" : draft.kind === "purchase" ? "one-time adjustment" : "planned spending";
  const amountLabel = draft.kind === "purchase" ? "Adjustment amount" : draft.recurring ? "Monthly amount" : "One-time amount";
  const placeholder = draft.kind === "income" ? "Example: Salary" : draft.kind === "expense" ? "Example: Electric bill" : draft.kind === "purchase" ? "Example: New tires" : "Example: Emergency fund";
  const modalDescription = draft.kind === "purchase" ? "This adjustment affects only this month and is not copied forward." : "This planned entry is expected cash flow. It never changes a current debt balance.";
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal cashflow-modal" role="dialog" aria-modal="true" aria-labelledby="cashflow-modal-title"><header><div><span>{editing ? `Edit ${title}` : `New ${title}`}</span><h2 id="cashflow-modal-title">{editing ? draft.name || "Planned entry" : `Add ${title}`}</h2><p>{modalDescription}</p></div><button type="button" onClick={onClose} aria-label="Close planned entry form">&times;</button></header><div className="form-grid"><div className="wide kind-editor"><span>Item type</span><div>{(["income", "expense", "purchase"] as CashflowKind[]).map((kind) => <button type="button" key={kind} className={draft.kind === kind ? `active ${kind}` : kind} onClick={() => changeKind(kind)}>{kind === "income" ? "Income" : kind === "expense" ? "Planned spending" : "One-time adjustment"}</button>)}</div></div><label className="wide"><span>Name</span><input autoFocus value={draft.name} placeholder={placeholder} onChange={(event) => onChange({ ...draft, name: event.target.value })}/></label><Field label={amountLabel} prefix="$" value={draft.amount} placeholder="0" onChange={(amount) => onChange({ ...draft, amount })}/><label><span>Category</span><select value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value })}>{CASHFLOW_CATEGORIES[draft.kind].map((category) => <option key={category}>{category}</option>)}</select></label>{draft.kind !== "purchase" && <label className="wide recurring-choice"><input type="checkbox" checked={draft.recurring ?? true} onChange={(event) => onChange({ ...draft, recurring: event.target.checked })}/><span>Repeat this planned entry every month</span></label>}{isOutflow && <div className="wide payment-editor"><span>Paid with</span><div><button type="button" className={draft.paymentMethod === "debit" ? "active" : ""} onClick={() => onChange({ ...draft, paymentMethod: "debit", creditAccountId: "" })}><i>DB</i><span>Debit</span><small>Paid from checking</small></button><button type="button" className={draft.paymentMethod === "credit" ? "active" : ""} onClick={() => onChange({ ...draft, paymentMethod: "credit" })}><i>CC</i><span>Credit</span><small>Charged to a card</small></button></div></div>}{needsCreditAccount && <label className="wide credit-account-field"><span>Credit card</span><select value={draft.creditAccountId} onChange={(event) => onChange({ ...draft, creditAccountId: event.target.value })}><option value="">Select the card used for this {draft.kind === "purchase" ? "purchase" : "expense"}</option>{creditAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select><small>{creditAccounts.length ? (draft.kind === "purchase" ? "This records how you paid without turning the purchase into a recurring card charge." : "This links the recurring expense to the card you use.") : `Add a credit card under Debt Accounts before assigning this ${draft.kind === "purchase" ? "purchase" : "expense"} to credit.`}</small></label>}</div><footer>{editing ? <button className="danger" type="button" onClick={onRemove}>Remove item</button> : <span/>}<div><button className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="button" disabled={!canSave} onClick={onSave}>{editing ? "Save changes" : draft.kind === "purchase" ? "Add one-time adjustment" : "Add planned entry"}</button></div></footer></section></div>;
}
function PaymentModal({ account, suggestedAmount, onClose, onSave }: { account: DebtAccount; suggestedAmount: number; onClose: () => void; onSave: (draft: PaymentDraft) => void }) {
  const [draft, setDraft] = useState<PaymentDraft>({ amount: Math.min(account.balance, suggestedAmount || effectiveMinimum(account)), date: dateInputValue(), note: "Recommended payoff payment", paymentKind: suggestedAmount > effectiveMinimum(account) ? "combined" : "minimum" });
  const overpayment = draft.amount > account.balance;
  const balanceAfter = round(Math.max(0, account.balance - draft.amount));
  const canSave = draft.amount > 0 && Boolean(draft.date) && !overpayment;
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="modal debt-action-modal" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title" aria-describedby="payment-modal-description">
      <header><div><span>Balance-changing payment</span><h2 id="payment-modal-title">Record payment to {account.name}</h2><p id="payment-modal-description">This creates one ledger payment and reduces the calculated balance exactly once. It is not added as a household expense.</p></div><button type="button" onClick={onClose} aria-label="Close payment form">&times;</button></header>
      <div className="debt-action-form">
        <div className="balance-change-preview" aria-live="polite"><div><span>Balance before</span><strong>{moneyPrecise.format(account.balance)}</strong></div><i aria-hidden="true">&rarr;</i><div><span>Balance after</span><strong>{moneyPrecise.format(balanceAfter)}</strong></div></div>
        {overpayment && <p className="form-error" role="alert">Payment cannot exceed the current balance of {moneyPrecise.format(account.balance)}. Use the exact balance for a final payment.</p>}
        <div className="form-grid"><label className="wide"><span>What does this payment cover?</span><select aria-label="Payment classification" value={draft.paymentKind} onChange={(event) => setDraft({ ...draft, paymentKind: event.target.value as PaymentKind })}><option value="minimum">Statement minimum</option><option value="extra">Extra payment only</option><option value="combined">Minimum plus extra</option></select><small className="field-help">This label lets Monthly Plan show what is paid and what is still planned.</small></label><Field label="Payment amount" prefix="$" value={draft.amount} placeholder="0.00" step=".01" autoFocus onChange={(amount) => setDraft({ ...draft, amount })}/><label><span>Payment date</span><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })}/></label><label className="wide"><span>Optional note</span><input value={draft.note} maxLength={240} placeholder="Confirmation number or payment note" onChange={(event) => setDraft({ ...draft, note: event.target.value })}/></label></div>
      </div>
      <footer><span>The transaction stores the debt ID, date, amount, before/after balances, creation time, and member when available.</span><div><button className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="button" disabled={!canSave} onClick={() => onSave(draft)}>Confirm payment</button></div></footer>
    </section>
  </div>;
}

function PaymentCorrectionModal({ transaction, accountWithoutOriginal, onClose, onSave }: { transaction: LedgerTransaction; accountWithoutOriginal: DebtAccount | null; onClose: () => void; onSave: (draft: PaymentDraft) => void }) {
  const [draft, setDraft] = useState<PaymentDraft>({ amount: transaction.amount, date: transaction.date, note: transaction.memo, paymentKind: transaction.paymentKind ?? "combined" });
  const overpayment = Boolean(accountWithoutOriginal) && draft.amount > (accountWithoutOriginal?.balance ?? 0);
  const balanceAfter = accountWithoutOriginal ? round(Math.max(0, accountWithoutOriginal.balance - draft.amount)) : 0;
  const changed = draft.amount !== transaction.amount || draft.date !== transaction.date || draft.note.trim() !== transaction.memo || draft.paymentKind !== (transaction.paymentKind ?? "combined");
  const canSave = Boolean(accountWithoutOriginal && draft.amount > 0 && draft.date && !overpayment && changed);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="modal debt-action-modal" role="dialog" aria-modal="true" aria-labelledby="payment-correction-title" aria-describedby="payment-correction-description">
      <header><div><span>Protected payment history</span><h2 id="payment-correction-title">View or correct {transaction.payeeName} payment</h2><p id="payment-correction-description">The original record is never erased. Saving a correction marks it as replaced and creates one linked payment with the corrected details.</p></div><button type="button" onClick={onClose} aria-label="Close payment correction">&times;</button></header>
      <div className="debt-action-form">
        <div className="audit-explanation" role="note"><strong>Why this is protected</strong><span>The saved balance trail proves that this payment changed the debt once. Correcting it preserves that history and prevents duplicate balance changes.</span></div>
        <div className="balance-change-preview" aria-live="polite"><div><span>Balance before corrected payment</span><strong>{accountWithoutOriginal ? moneyPrecise.format(accountWithoutOriginal.balance) : "Unavailable"}</strong></div><i aria-hidden="true">&rarr;</i><div><span>Balance after corrected payment</span><strong>{accountWithoutOriginal ? moneyPrecise.format(balanceAfter) : "Unavailable"}</strong></div></div>
        {overpayment && <p className="form-error" role="alert">Corrected payment cannot exceed the balance before this payment, {moneyPrecise.format(accountWithoutOriginal?.balance ?? 0)}.</p>}
        <div className="form-grid">
          <label className="wide"><span>What does this payment cover?</span><select aria-label="Corrected payment classification" value={draft.paymentKind} onChange={(event) => setDraft({ ...draft, paymentKind: event.target.value as PaymentKind })}><option value="minimum">Statement minimum</option><option value="extra">Extra payment only</option><option value="combined">Minimum plus extra</option></select></label>
          <Field label="Corrected amount" prefix="$" value={draft.amount} placeholder="0.00" step=".01" autoFocus onChange={(amount) => setDraft({ ...draft, amount })}/>
          <label><span>Payment date</span><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })}/></label>
          <label className="wide"><span>Optional note</span><input value={draft.note} maxLength={240} placeholder="Confirmation number or payment note" onChange={(event) => setDraft({ ...draft, note: event.target.value })}/></label>
        </div>
      </div>
      <footer><span>{changed ? "Saving will retain the original as a replaced audit record." : "Change a field to create a correction."}</span><div><button className="secondary" type="button" onClick={onClose}>Close</button><button className="primary" type="button" disabled={!canSave} onClick={() => onSave(draft)}>Save correction</button></div></footer>
    </section>
  </div>;
}

function BalanceUpdateModal({ account, onClose, onSave }: { account: DebtAccount; onClose: () => void; onSave: (draft: BalanceDraft) => void }) {
  const [draft, setDraft] = useState<BalanceDraft>({ balance: account.balance, date: dateInputValue(), note: "" });
  const difference = round(draft.balance - account.balance);
  const invalidBalance = !Number.isFinite(draft.balance) || draft.balance < 0;
  const changed = !invalidBalance && Math.abs(difference) >= 0.005;
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="modal debt-action-modal" role="dialog" aria-modal="true" aria-labelledby="balance-modal-title" aria-describedby="balance-modal-description">
      <header><div><span>Balance reconciliation</span><h2 id="balance-modal-title">Update {account.name} balance</h2><p id="balance-modal-description">Match the lender&apos;s current balance without creating a payment, charge, or duplicate ledger effect.</p></div><button type="button" onClick={onClose} aria-label="Close balance update form">&times;</button></header>
      <div className="debt-action-form">
        <div className="balance-change-preview" aria-live="polite"><div><span>Previous balance</span><strong>{moneyPrecise.format(account.balance)}</strong></div><i aria-hidden="true">&rarr;</i><div><span>New balance</span><strong>{moneyPrecise.format(draft.balance)}</strong></div></div>
        {invalidBalance && <p className="form-error" role="alert">Current balance must be $0.00 or greater.</p>}
        <p className={difference > 0 ? "balance-difference increase" : "balance-difference decrease"}>{changed ? (difference > 0 ? "Increase " : "Decrease ") + moneyPrecise.format(Math.abs(difference)) : "Enter a different current balance to continue."}</p>
        <div className="form-grid"><Field label="New current balance" prefix="$" value={draft.balance} placeholder="0.00" step=".01" autoFocus onChange={(balance) => setDraft({ ...draft, balance })}/><label><span>Effective date</span><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })}/></label><label className="wide"><span>Optional note</span><input value={draft.note} maxLength={240} placeholder="Example: Reconciled to August statement" onChange={(event) => setDraft({ ...draft, note: event.target.value })}/></label></div>
      </div>
      <footer><span>A non-ledger adjustment record preserves the previous value, new value, difference, and creator.</span><div><button className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="button" disabled={!changed || !draft.date} onClick={() => onSave(draft)}>Confirm balance update</button></div></footer>
    </section>
  </div>;
}

function AccountModal({ draft, editing, autoFocusField, onChange, onClose, onSave, onRemove }: { draft: AccountDraft; editing: boolean; autoFocusField: "name" | "balance"; onChange: (draft: AccountDraft) => void; onClose: () => void; onSave: () => void; onRemove: () => void }) {
  const autoMinimum = estimatedMinimum(draft.balance, draft.apr);
  const isCreditCard = draft.type === "Credit card";
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
      <header><div><span>{editing ? "Edit debt details" : "New debt account"}</span><h2 id="account-modal-title">{editing ? draft.name || "Account details" : "Add a debt account"}</h2><p>{editing ? "Update lender terms here. Use Update balance on the debt list for an auditable reconciliation." : "Enter the starting balance and current lender details."}</p></div><button type="button" onClick={onClose} aria-label="Close account form">&times;</button></header>
      <div className="form-grid">
        <label className="wide"><span>Name</span><input autoFocus={autoFocusField === "name"} value={draft.name} placeholder="Example: Everyday Rewards" onChange={(event) => onChange({ ...draft, name: event.target.value })}/></label>
        <label><span>Debt type</span><select value={draft.type} onChange={(event) => onChange({ ...draft, type: event.target.value as DebtType })}>{DEBT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
        {!editing && <Field label="Starting balance" prefix="$" value={draft.balance} placeholder="0" autoFocus={autoFocusField === "balance"} onChange={(balance) => onChange({ ...draft, balance })}/>}
        <Field label={isCreditCard ? "Current APR" : "APR"} suffix="%" value={draft.apr} placeholder="0.00" step=".01" onChange={(apr) => onChange({ ...draft, apr })}/>
        <div><Field label="Actual interest fee" prefix="$" value={draft.interestFee} placeholder="Optional" step=".01" onChange={(interestFee) => onChange({ ...draft, interestFee })}/><small className="field-help">Leave blank to estimate from balance x APR / 12.</small></div>
        <div className="minimum-editor"><div><span>Minimum payment</span><button type="button" className={draft.minimumMode === "auto" ? "mode active" : "mode"} onClick={() => onChange({ ...draft, minimumMode: draft.minimumMode === "auto" ? "manual" : "auto" })}>{draft.minimumMode === "auto" ? "Auto estimate" : "Use auto"}</button></div><Field prefix="$" value={draft.minimumMode === "auto" ? autoMinimum : draft.minimum} placeholder="0" disabled={draft.minimumMode === "auto"} onChange={(minimum) => onChange({ ...draft, minimum })}/><small>{draft.minimumMode === "auto" ? "1% of balance + monthly interest, with a $25 floor." : "Using your lender amount."}</small></div>
        {isCreditCard && <div className="wide promo-editor">
          <div><span>0% promotional period</span><small>Optional. These terms drive the payoff forecast after the promotion ends.</small></div>
          <div className="promo-fields">
            <label><span>Promotion ends</span><input type="date" value={draft.promoEndDate} onChange={(event) => onChange({ ...draft, promoEndDate: event.target.value })}/></label>
            <Field label="APR after promotion" suffix="%" value={draft.postPromoApr} placeholder="0.00" step=".01" onChange={(postPromoApr) => onChange({ ...draft, postPromoApr })}/>
            <Field label="Actual minimum after promotion" prefix="$" value={draft.postPromoMinimum} placeholder="Keep current" step=".01" onChange={(postPromoMinimum) => onChange({ ...draft, postPromoMinimum })}/>
          </div>
          <small className="promo-help">If the future minimum is unknown, DebtFree keeps today&apos;s minimum instead of inventing a higher payment. Update it when the issuer confirms the amount.</small>
        </div>}
        <Field label="Credit limit" prefix="$" value={draft.creditLimit} placeholder="Optional" onChange={(creditLimit) => onChange({ ...draft, creditLimit })}/>
        <label><span>Next due date</span><input type="date" value={draft.dueDate} onChange={(event) => onChange({ ...draft, dueDate: event.target.value })}/></label>
      </div>
      <footer>{editing ? <details className="advanced-danger"><summary>Advanced destructive action</summary><p>Permanently deleting removes the debt details. Existing payments, adjustments, and snapshots remain referenced for audit.</p><button className="danger" type="button" onClick={onRemove}>Permanently delete debt account</button></details> : <span/>}<div><button className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="button" disabled={!draft.name.trim()} onClick={onSave}>{editing ? "Save details" : "Add debt"}</button></div></footer>
    </section>
  </div>;
}
function Field({ label, prefix, suffix, value, placeholder, step, disabled, autoFocus, onChange }: { label?: string; prefix?: string; suffix?: string; value: number; placeholder: string; step?: string; disabled?: boolean; autoFocus?: boolean; onChange: (value: number) => void }) { return <label>{label && <span>{label}</span>}<div className="field-input">{prefix && <b>{prefix}</b>}<input type="number" min="0" step={step} inputMode="decimal" disabled={disabled} autoFocus={autoFocus} value={value || ""} placeholder={placeholder} onChange={(event) => onChange(number(event.target.value))}/>{suffix && <b>{suffix}</b>}</div></label>; }
