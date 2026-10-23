"use client";
import { createHouseholdMoneyFormatter, householdCurrencySymbol, resolveHouseholdCurrency } from "./household-currency";
import HouseholdCurrencySettings from "./household-currency-settings";
import { HouseholdCurrencyProvider, useHouseholdCurrency } from "./household-currency-context";
import { DebtCategorySettings } from "./debt-category-controls";
import { migrateLegacyGroups, neutralGroups, type DebtGroup } from "./debt-groups";
import HouseholdLifecyclePanel from "./household-lifecycle-panel";
import AppearanceSettings from "./appearance-settings";
import ActionConfirmation from "./action-confirmation";
import CardProgressChart from "./card-progress-chart";
import {scheduleView,SCHEDULE_TYPES,loanScheduleType} from "./schedule-view";
import {regularLoanPayment} from "./loan-progress";
import {updatePayoffMinimum} from "./payoff-calculator";
import CreditCardInfo from "./credit-card-info";
import {saveCreditCardDetails, markCreditCardPaidOff, type CardEditBaseline} from "./credit-card-editor";
import HomeDashboardPage from "./home-dashboard-page";
import PayoffSchedulePopup from "./payoff-schedule-popup";
import { buildActivePayoffCommitment, capturePayoffCommitment } from "./payoff-commitment";
import { DebtSummary, UnifiedDebtList, DebtDetail, DebtOverview, ExperienceOverlay, type DebtSelection, type DebtDetailTab } from "./debt-experience";
import mobileStyles from "./mobile-layout.module.css";
import { householdMonthOffset } from "./household-date";
import { buildProgressView } from "./progress-view";

import { nextDueDate } from "./recurring-due-date";
import InstitutionPicker from "./institution-picker";
import InstitutionIcon from "./institution-icon";
import { validOptionalInstitution } from "./institutions";
import OutlineIcon from "./outline-icon";

import type { LoanTracker } from "./loan-progress";
import LoanProgressPanel from "./loan-progress-panel";
import { settlementReports } from "./plan-settlements";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { DashboardUser } from "./cloudflare-auth";
import {
  createDashboardBackup,
  createDashboardPayload,
  dashboardDataErrorMessage,
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
import { createBrowserDataRepository, type DataRepository } from "./data-repository";
import { initialCommitment, paymentContext } from "./payment-context";
import { seedMonthlyPlan } from "./onboarding-plan";
import { HouseholdSync, type SyncStatus } from "./household-sync";
import { householdSessionHeaders } from "./household-session-scope";
import { householdOutboxPrefix, householdRecoveryDrafts, type HouseholdRecoveryDraft } from "./household-recovery";
import { useDialogFocus } from "./use-dialog-focus";
import DataSafetyPanel from "./data-safety-panel";
import { resolveDashboardImport, type ImportMode } from "./data-transfer";
import {
  calculatePlan,
  estimatedMinimum,
  effectiveMinimum,
  monthlyInterest,
  round,
  type LinkedCardExpenses,
} from "./payoff-engine";
import OnboardingFlow from "./onboarding-flow";
import MonthlyPlanPage from "./monthly-plan-page";
import { buildBudgetView, type BudgetTab } from "./budget-view";
import BudgetScheduleEntry from "./budget-schedule-entry";
import PaymentsPage from "./payments-page";
import DebtEntryDialog from "./debt-entry-dialog";
import UnsavedChangesDialog from "./unsaved-changes-dialog";
import { changeDebtEntry, undoDebtEntry, type EntryCommand, type EntryState } from "./debt-transactions";
import { confirmAdjustmentPayment, parseMoneyInput } from "./payments";

import CostcoInterestSettings from "./costco-interest-settings";
import { accrueCostcoInterest, householdDate, reconcileInterest, validInterestConfig, recordActualInterest } from "./interest-accrual";
import { arrangeDebt, groupedDisplayDebts, canArchiveDebt, createBalanceAdjustment, createDebtPayment, replaceDebtPayment, setDebtArchived } from "./debts-screen";
import { createPayoffSnapshot, transactionAdjustedAccounts } from "./progress-balances";
import ActualProgressPage from "./actual-progress-page";
import DebtInsightsPage from "./debt-insights-page";
import { paymentOverlaps, type PaymentLink } from "./payment-overlap";
import { buildActualProgress, retainRemovedProgressAccount } from "./debt-activity";
import { spentForPlannedItem, copyRecurringPlannedItems } from "./monthly-plan";
import {
  accountsWithCustomDebtOrder,
  normalizeCustomDebtOrder,
} from "./payoff-plan";
import {
  createOnboardingPlanning,
  hasEstablishedDashboardData,
  hasOnboardingProgress,
  shouldShowOnboarding,
  type GeneratedOnboardingPlan,
} from "./onboarding-plan";
import { scanReceipt, type ReceiptScanResult } from "./receipt-ocr";

type PageId = "payments" | "more" | "home" | "accounts" | "history" | "calculator" | "plan" | "monthly" | "snapshots" | "utilization" | "stats" | "profile" | "settings" | "debt-tools";

type AccountDraft = { displayPosition?: number; newCategory?: DebtGroup; actualInterest?: { amount: number; date: string } } & Pick<DebtAccount, "institutionKey" | "displayGroup" | "interestAutomation" | "name" | "type" | "balance" | "apr" | "interestFee" | "minimum" | "minimumMode" | "payoffMode" | "creditLimit" | "dueDate" | "promoEndDate" | "postPromoApr" | "postPromoMinimum">;
type CashflowDraft = Pick<CashflowItem, "name" | "kind" | "category" | "amount" | "paymentMethod" | "creditAccountId" | "recurring">;
type TransactionDraft = Pick<LedgerTransaction, "date" | "accountId" | "payeeId" | "payeeName" | "type" | "category" | "memo" | "amount" | "plannedItemId"> & { paymentKind: PaymentKind };
type LinkedCardExpenseItems = Record<string, CashflowItem[]>;
type LinkedCardPurchaseItems = Record<string, CashflowItem[]>;
type CloudStatus = SyncStatus;
type HouseholdRole = "owner" | "admin" | "viewer";
type HouseholdMember = { email: string; display_name: string | null; role: HouseholdRole; status: "active" | "invited" };

type PaymentRequest = { accountId: string; suggestedAmount: number };
type PaymentDraft = { amount: number; date: string; note: string; paymentKind: PaymentKind; includedIn?: PaymentLink };
type BalanceDraft = { balance: number; date: string; note: string; decreaseKind: "payment" | "credit" | "adjustment" };
function hasMeaningfulData(payload: DashboardPayload) {
  return hasEstablishedDashboardData(payload) || payload.planning.onboarding.completed || hasOnboardingProgress(payload.planning);
}

const NAVIGATION_COLLAPSED_KEY = "debtfree-dashboard-navigation-collapsed";
const EMPTY_DRAFT: AccountDraft = { displayGroup: "Other", name: "", type: "Credit card", balance: 0, apr: 0, interestFee: 0, minimum: 0, minimumMode: "manual", payoffMode: "priority", creditLimit: 0, dueDate: "", promoEndDate: "", postPromoApr: 0, postPromoMinimum: 0 };
const EMPTY_CASHFLOW_DRAFT: CashflowDraft = { name: "", kind: "expense", category: "Housing", amount: 0, paymentMethod: "debit", creditAccountId: "", recurring: true };
const TRANSACTION_CATEGORIES = ["Shopping", "Food", "Housing", "Transportation", "Utilities", "Health", "Debt payment", "Interest & fees", "Other"];
const CASHFLOW_CATEGORIES: Record<CashflowKind, string[]> = {
  income: ["Salary", "Freelance", "Benefits", "Investment", "Other income"],
  expense: ["Housing", "Transportation", "Utilities", "Subscriptions", "Insurance", "Food", "Other expense"],
  budget: ["Savings", "Emergency fund", "Groceries", "Travel", "Personal", "Other budget"],
  purchase: ["Shopping", "Home", "Transportation", "Health", "Travel", "Gifts", "Other purchase"],
};
const DEBT_TYPES: DebtType[] = ["Credit card", "Personal loan", "Auto loan", "Student loan", "Medical debt", "Other"];

const number = (value: string) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
function currentMonthKey() {
  return householdDate().slice(0, 7);
}
function dateInputValue() {
  return householdDate();
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
function monthAfter(offset: number) {
  const date = new Date(householdMonthOffset(offset) + "-01T12:00:00Z");
  return date.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", year: "numeric" });
}
const NAV_ITEMS: { id: PageId; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "accounts", label: "Debt", icon: "card" },
  { id: "snapshots", label: "Progress", icon: "trend" },
  { id: "monthly", label: "Budget", icon: "chart" },
  { id: "settings", label: "Settings", icon: "settings" },
];
const MORE_NAV_ITEMS: { id: PageId; label: string; icon: string }[] = [
  { id: "plan", label: "Payoff Schedule", icon: "calendar" },
  { id: "snapshots", label: "Progress", icon: "trend" },
  { id: "profile", label: "Account", icon: "account" },
];
const ADVANCED_NAV_ITEMS: { id: PageId; label: string; icon: string }[] = [
  { id: "utilization", label: "Credit Utilization", icon: "card" },
  { id: "stats", label: "Stats & Projections", icon: "trend" },
];
const ALL_NAV_ITEMS = [...NAV_ITEMS, ...MORE_NAV_ITEMS, ...ADVANCED_NAV_ITEMS, {id:"payments",label:"Transactions"}];
const MOBILE_NAV_ITEMS: { id: PageId; label: string }[] = [{id:"home",label:"Home"},{id:"accounts",label:"Debt"},{id:"snapshots",label:"Progress"},{id:"monthly",label:"Budget"},{id:"settings",label:"Settings"}];
function subscribeMobileViewport(notify: () => void) { const query = window.matchMedia('(max-width: 820px)'); query.addEventListener('change', notify); return () => query.removeEventListener('change', notify); }
const mobileViewportSnapshot = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches;
const serverViewportSnapshot = () => false;

export default function DashboardClient({ user, householdId, lifecycleEnabled = false, repository: suppliedRepository, syntheticDemo = false, managedHousehold }: { managedHousehold?: { name: string; role: HouseholdRole; readOnly: boolean }; user: DashboardUser; householdId?: string; lifecycleEnabled?: boolean; repository?: DataRepository; syntheticDemo?: boolean }) {
  const mobileView = useSyncExternalStore(subscribeMobileViewport, mobileViewportSnapshot, serverViewportSnapshot);
  const [toolsOpen, setToolsOpen] = useState(false);
  const repository = useMemo(() => suppliedRepository ?? createBrowserDataRepository(hasMeaningfulData, undefined, householdId ? user.email + ":" + householdId : undefined), [suppliedRepository, user.email, householdId]);
  useDialogFocus();
  const cloudWritesEnabled = useRef(false);
  const managedWriteAccess = useRef(false);
  const managedStagedPayload = useRef("");
  const sync = useRef<HouseholdSync | null>(null);
  const sessionScope = useMemo(() => ({ identity: user.email, householdId: householdId ?? "" }), [user.email, householdId]);
  const sessionHeaders = useMemo(() => householdSessionHeaders(sessionScope), [sessionScope]);
  const [recoveryDrafts, setRecoveryDrafts] = useState<HouseholdRecoveryDraft[]>([]);
  const [selectedRecovery, setSelectedRecovery] = useState(0);
  const pendingTransferMessage = useRef<string | null>(null);
  const [canEditCloud, setCanEditCloud] = useState(false);
  const [localError, setLocalError] = useState("");
  const dashboardContract = useRef<DashboardBackup | null>(null);
  const [page, setPage] = useState<PageId>("home");
  const [selectedDebt, setSelectedDebt] = useState<DebtSelection | null>(null);
  const [detailTab, setDetailTab] = useState<DebtDetailTab>("Overview");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [budgetTab, setBudgetTab] = useState<BudgetTab>("Overview");
  const accountReturnPage = useRef<PageId>("home");
  const [accounts, setAccounts] = useState<DebtAccount[]>([]);
  const [monthlyBudgets, setMonthlyBudgets] = useState<Record<string, CashflowItem[]>>({});
  const [monthlyPlan, setMonthlyPlan] = useState<MonthlyPlanSettings>({ debtGroups: neutralGroups, detailedSpendingTracking: false, months: {} });
  const householdCurrency = resolveHouseholdCurrency(monthlyPlan.currency);
  const moneyPrecise = createHouseholdMoneyFormatter(householdCurrency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [planning, setPlanning] = useState<PlannedPayoffData>(() => createOnboardingPlanning());
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [payees, setPayees] = useState<Payee[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [balanceAdjustments, setBalanceAdjustments] = useState<BalanceAdjustment[]>([]);
  const [snapshots, setSnapshots] = useState<PayoffSnapshot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newLoanDraft, setNewLoanDraft] = useState<LoanTracker | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [balanceAccountId, setBalanceAccountId] = useState<string | null>(null);
  const [undoEntry, setUndoEntry] = useState<{before: EntryState; after: string} | null>(null);
  const [debtActionMessage, setDebtActionMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AccountDraft>(EMPTY_DRAFT);
  const [accountDraftBaseline, setAccountDraftBaseline] = useState<AccountDraft>(EMPTY_DRAFT);
  const [modalExitPrompt, setModalExitPrompt] = useState(false);
  const [pendingDetailExit, setPendingDetailExit] = useState<{ type: "tab"; tab: DebtDetailTab } | { type: "close" } | null>(null);
  const [accountAutoFocus, setAccountAutoFocus] = useState<"name" | "balance">("name");
  const [extra, setExtra] = useState(0);
  const [strategy, setStrategy] = useState<PayoffStrategy>("avalanche");
  const [customDebtOrder, setCustomDebtOrder] = useState<string[]>([]);
  const [importMessage, setImportMessage] = useState("");
  const [cashflowModalOpen, setCashflowModalOpen] = useState(false);
  const [editingCashflowId, setEditingCashflowId] = useState<string | null>(null);
  const [cashflowDraft, setCashflowDraft] = useState<CashflowDraft>(EMPTY_CASHFLOW_DRAFT);
  const [debtEntryOpen, setDebtEntryOpen] = useState(false);
  const [newRecordOpen, setNewRecordOpen] = useState(false);
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
  const [deviceSaveStatus, setDeviceSaveStatus] = useState<SyncStatus>("connecting");
  const paymentSubmitted = useRef(false);
  const cardEditBaseline = useRef<CardEditBaseline | null>(null);
  const [cardEditError,setCardEditError]=useState("");
  const [deleteCardId,setDeleteCardId]=useState<string|null>(null);
  const [cardTransactionOpen,setCardTransactionOpen]=useState(false);
  const balanceExpected = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [page]);
  const primaryPage = (mobileView ? MOBILE_NAV_ITEMS : NAV_ITEMS).some(item => item.id === page) ? page : "settings";
  const navigateMobile = (next: PageId) => { if (next === "plan") setScheduleOpen(true); else setPage(next); setToolsOpen(false); };
  const toggleAccount = () => { setToolsOpen(false); if (page === "profile") setPage(accountReturnPage.current); else { accountReturnPage.current = page; setPage("profile"); } };
  const deviceOnly = Boolean(managedHousehold) || user.email === "Local device storage only";
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update(); window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  const isViewer = managedHousehold ? managedHousehold.readOnly || managedHousehold.role === "viewer" || !online : !deviceOnly && (!online || !canEditCloud || householdRole === "viewer");
  const updateCloudStatus = useCallback((status: SyncStatus) => {
    setCloudStatus(status);
    if (status === "unauthorized") setCanEditCloud(false);
  }, []);
  const auditCreator = deviceOnly && !managedHousehold ? undefined : { email: user.email, displayName: user.displayName };
  const visibleDebtActionMessage = /pending save/i.test(debtActionMessage) && deviceSaveStatus === "synced" && (deviceOnly || cloudStatus === "synced") ? "" : debtActionMessage;

  const applyDashboardPayload = useCallback((contract: DashboardBackup) => {
    dashboardContract.current = contract;
    const { payload } = contract;
    const savedProgress = buildActualProgress(payload.accounts, payload.transactions, payload.balanceAdjustments ?? [], payload.snapshots);
    const startingBalance = payload.monthlyPlan?.progressStartingBalance ?? (savedProgress.comparisonAvailable ? savedProgress.starting : undefined);
    const grouped = migrateLegacyGroups(payload.accounts, payload.monthlyPlan?.debtGroups);
    setAccounts(grouped.accounts);
    setMonthlyBudgets(payload.monthlyBudgets);
    setMonthlyPlan({ ...(payload.monthlyPlan ?? { detailedSpendingTracking: false, months: {} }), debtGroups: !payload.accounts.length && payload.monthlyPlan?.removedProgressAccounts?.length && !payload.monthlyPlan.debtGroups ? migrateLegacyGroups(payload.monthlyPlan.removedProgressAccounts).groups : grouped.groups, ...(payload.monthlyPlan?.removedProgressAccounts ? { removedProgressAccounts: migrateLegacyGroups(payload.monthlyPlan.removedProgressAccounts, payload.monthlyPlan.debtGroups).accounts } : {}), ...(startingBalance !== undefined && startingBalance >= 0 ? { progressStartingBalance: startingBalance } : {}), monthlyCommitment: initialCommitment(transactionAdjustedAccounts(payload.accounts, payload.transactions), payload.extra, payload.monthlyBudgets[currentMonthKey()] ?? [], payload.monthlyPlan) });
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
      try { localContract = (await repository.loadHousehold()).contract; }
      catch { setLocalError("Device storage is unavailable. Export a backup before closing this page."); }
      if (deviceOnly) {
        if (localContract) applyDashboardPayload(localContract);
        setCloudStatus("synced"); setLoaded(true); return;
      }
      try {
        const tabKey = "debtfree-outbox-tab";
        let tabId = sessionStorage.getItem(tabKey);
        if (!tabId) { tabId = crypto.randomUUID(); sessionStorage.setItem(tabKey, tabId); }
        const outboxKey = householdOutboxPrefix(sessionScope) + tabId;
        const controller = new HouseholdSync({ storage: localStorage, key: outboxKey, scope: sessionScope, status: updateCloudStatus });
        sync.current = controller;
        const { remote, contract } = await controller.load();
        if (cancelled) return;
        setHouseholdName(remote.householdName); setHouseholdRole(remote.role); setHouseholdMembers(remote.members);
        setCanEditCloud(remote.role !== "viewer");
        setRecoveryDrafts(householdRecoveryDrafts(localStorage, sessionScope, outboxKey, contract));
        if (contract) applyDashboardPayload(contract);
        else if (remote.payload === null && remote.revision === 0 && remote.role === "owner" && localContract && hasMeaningfulData(localContract.payload)) {
          applyDashboardPayload(localContract); controller.stage(localContract);
        }
        cloudWritesEnabled.current = true;
        void controller.flush();
      } catch {
        if (!cancelled) {
          if (sync.current?.pending) applyDashboardPayload(sync.current.pending.contract);
          setCloudStatus(current => current === "unauthorized" ? current : "error"); setCanEditCloud(false);
        }
      } finally { if (!cancelled) setLoaded(true); }
    };
    void load();
    return () => { cancelled = true; sync.current?.dispose(); };
  }, [applyDashboardPayload, deviceOnly, repository, user.email, householdId, sessionScope, updateCloudStatus]);

  useEffect(() => {
    if (pendingTransferMessage.current && deviceSaveStatus === "synced" && (deviceOnly || cloudStatus === "synced") && !sync.current?.pending) {
      setTransferMessage(pendingTransferMessage.current); pendingTransferMessage.current = null;
    }
  }, [cloudStatus, deviceSaveStatus, deviceOnly]);

  const refreshHousehold = useCallback(async () => {
    if (!sync.current) { window.location.reload(); return; }
    try {
      const { remote, contract } = await sync.current.load();
      setHouseholdRole(remote.role); setHouseholdMembers(remote.members); setCanEditCloud(remote.role !== "viewer");
      if (contract) applyDashboardPayload(contract);
      await sync.current.flush();
    } catch { setCanEditCloud(false); }
  }, [applyDashboardPayload]);
  useEffect(() => {
    if (deviceOnly || !loaded) return;
    let cancelled = false;
    const canApply = () => !cancelled && document.visibilityState === "visible" && !document.querySelector('[aria-modal="true"], .allocation-minimum button[type="submit"]') && !document.activeElement?.matches("input, select, textarea, [contenteditable=true]");
    const refresh = async () => {
      if (!canApply() || localError || deviceSaveStatus !== "synced") return;
      try {
        await sync.current?.flush();
        const result = await sync.current?.refresh(canApply);
        if (!result || !canApply()) return;
        setHouseholdRole(result.remote.role); setHouseholdMembers(result.remote.members); setCanEditCloud(result.remote.role !== "viewer");
        if (result.contract) applyDashboardPayload(result.contract);
      } catch { /* Sync retains precise access/failure status and pending data. */ }
    };
    const resume = () => { void refresh(); };
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    const timer = window.setInterval(resume, 30000);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener("online", resume); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); };
  }, [deviceOnly, loaded, localError, deviceSaveStatus, applyDashboardPayload]);

  useEffect(() => {
    if (!loaded || (managedHousehold ? managedHousehold.role === 'viewer' || managedHousehold.readOnly && !managedWriteAccess.current : isViewer)) return;
    if (managedHousehold && !managedHousehold.readOnly) managedWriteAccess.current = true;
    const payload = createDashboardPayload(dashboardContract.current?.payload, { accounts, monthlyBudgets, payees, transactions, snapshots, extra, strategy, planning, balanceAdjustments, monthlyPlan, customDebtOrder });
    if (!hasMeaningfulData(payload) && !cloudWritesEnabled.current) return;
    if (managedHousehold) {
      const fingerprint = JSON.stringify(payload);
      if (fingerprint === managedStagedPayload.current) return;
      managedStagedPayload.current = fingerprint;
    }
    const contract = createDashboardBackup(payload, dashboardContract.current);
    dashboardContract.current = contract;
    if (!deviceOnly) void Promise.resolve().then(() => sync.current?.stage(contract)).catch(() => setLocalError("Pending changes could not be saved on this device. Export a backup now."));
    void Promise.resolve().then(async () => {
      setDeviceSaveStatus("saving");
      try { await repository.saveHousehold(contract); setDeviceSaveStatus("synced"); }
      catch { setDeviceSaveStatus("error"); setLocalError("Device backup could not be saved. Export a backup before closing this page."); }
    });
  }, [accounts, balanceAdjustments, customDebtOrder, deviceOnly, extra, isViewer, loaded, managedHousehold, monthlyBudgets, monthlyPlan, payees, planning, repository, snapshots, strategy, transactions]);
  useEffect(() => {
    if (!modalOpen && !cashflowModalOpen && !transactionModalOpen && !payeeModalOpen && !paymentRequest && !balanceAccountId && !auditTransactionId && !selectedDebt) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { if (modalOpen) { if (JSON.stringify(draft) !== JSON.stringify(accountDraftBaseline)) setModalExitPrompt(true); else setModalOpen(false); } if (selectedDebt?.kind === "account" && !debtEntryOpen && !paymentRequest && !balanceAccountId && !auditTransactionId) { if (detailTab === "Info" && JSON.stringify(draft) !== JSON.stringify(accountDraftBaseline)) setPendingDetailExit({ type: "close" }); else setSelectedDebt(null); } setCashflowModalOpen(false); setTransactionModalOpen(false); setPayeeModalOpen(false); setPaymentRequest(null); setBalanceAccountId(null); setAuditTransactionId(null); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [accountDraftBaseline, auditTransactionId, balanceAccountId, cashflowModalOpen, debtEntryOpen, detailTab, draft, modalOpen, payeeModalOpen, paymentRequest, selectedDebt, transactionModalOpen]);

  useEffect(() => {
    if (!loaded || isViewer || cloudStatus !== "synced" || modalOpen || paymentRequest || balanceAccountId || debtEntryOpen || transactionModalOpen) return;
    let cancelled = false;
    const check = () => { if (!cancelled && document.visibilityState === "visible") setTransactions(current => accrueCostcoInterest(accounts, current)); };
    void Promise.resolve().then(check);
    const timer = window.setInterval(check, 60000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [accounts, balanceAccountId, debtEntryOpen, cloudStatus, isViewer, loaded, modalOpen, paymentRequest, transactionModalOpen]);

  const cashflowItems = useMemo(() => monthlyBudgets[selectedMonth] ?? [], [monthlyBudgets, selectedMonth]);
  const planningMonth = currentMonthKey();
  const planningCashflowItems = useMemo(() => monthlyBudgets[planningMonth] ?? [], [monthlyBudgets, planningMonth]);
  const detailedSpendingTracking = monthlyPlan.detailedSpendingTracking;
  const selectedPlanSettings = monthlyPlan.months[selectedMonth] ?? { safetyBuffer: 0, debtPaymentTarget: 0 };
  const setCashflowItems = (update: CashflowItem[] | ((current: CashflowItem[]) => CashflowItem[])) => setMonthlyBudgets((current) => {
    const items = current[selectedMonth] ?? [];
    const next = typeof update === "function" ? update(items) : update;
    return { ...current, [selectedMonth]: next };
  });
  const calculatedAccounts = useMemo(() => transactionAdjustedAccounts(accounts, transactions, detailedSpendingTracking), [accounts, detailedSpendingTracking, transactions]);
  const payoffAccounts = useMemo(() => accountsWithCustomDebtOrder(calculatedAccounts, customDebtOrder), [calculatedAccounts, customDebtOrder]);
  const activeCount = useMemo(() => calculatedAccounts.filter((account) => account.balance > 0).length, [calculatedAccounts]);
  const minimums = useMemo(() => calculatedAccounts.reduce((sum, account) => sum + effectiveMinimum(account), 0), [calculatedAccounts]);
  const interest = useMemo(() => calculatedAccounts.reduce((sum, account) => sum + monthlyInterest(account), 0), [calculatedAccounts]);
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
  const monthlyReports = useMemo(() => [...transactions, ...settlementReports(monthlyPlan.months[currentMonthKey()]?.settlements)], [transactions, monthlyPlan.months]);
  const actualizedLinkedCardSpending = useMemo(() => planningCashflowItems.reduce<LinkedCardExpenses>((totals, item) => {
    if (item.paymentMethod === "credit" && item.creditAccountId) totals[item.creditAccountId] = round((totals[item.creditAccountId] ?? 0) + Math.min(item.amount, spentForPlannedItem(item.id, monthlyReports, currentMonthKey(), true)));
    return totals;
  }, {}), [planningCashflowItems, monthlyReports]);
  const commitment = monthlyPlan.monthlyCommitment ?? initialCommitment(calculatedAccounts, extra, planningCashflowItems);
  const effectiveExtra = Math.max(0, round(commitment - minimums - Object.values(linkedCardExpenses).reduce((sum, n) => sum + n, 0)));
  const currentPaymentContext = useMemo(() => ({ ...paymentContext(monthlyReports, currentMonthKey(), commitment), minimumTargets: monthlyPlan.months[currentMonthKey()]?.minimums }), [monthlyReports, commitment, monthlyPlan.months]);
  const plan = useMemo(() => calculatePlan(payoffAccounts, effectiveExtra, strategy, linkedCardExpenses, linkedCardPurchases, new Date(), actualizedLinkedCardSpending, currentPaymentContext), [actualizedLinkedCardSpending, currentPaymentContext, effectiveExtra, linkedCardExpenses, linkedCardPurchases, payoffAccounts, strategy]);
  const monthlyTargets = useMemo(() => {
    const first = plan.months[0];
    const payments = { ...first?.payments };
    const minimums = { ...first?.minimums };
    for (const [id, paid] of Object.entries(currentPaymentContext.paid ?? {})) payments[id] = round((payments[id] ?? 0) + paid);
    for (const [id, paid] of Object.entries(currentPaymentContext.minimumPaid ?? {})) minimums[id] = currentPaymentContext.minimumTargets?.[id] ?? Math.min((accounts.find(a => a.id === id) ? effectiveMinimum(accounts.find(a => a.id === id)!) : 0), round((minimums[id] ?? 0) + paid));
    return { payments, minimums };
  }, [plan, currentPaymentContext, accounts]);
  useEffect(() => {
    if (!loaded || isViewer || !accounts.length) return;
    const month = currentMonthKey();
    if (monthlyPlan.months[month]?.payments) return;
    const timer = window.setTimeout(() => setMonthlyPlan((current) => ({ ...current, months: { ...current.months, [month]: { ...(current.months[month] ?? { safetyBuffer: 0, debtPaymentTarget: commitment }), ...monthlyTargets } } })), 0);
    return () => clearTimeout(timer);
  }, [accounts.length, commitment, isViewer, loaded, monthlyPlan.months, monthlyTargets]);
  const paymentAccount = paymentRequest ? calculatedAccounts.find((account) => account.id === paymentRequest.accountId) ?? null : null;
  const balanceAccount = balanceAccountId ? calculatedAccounts.find((account) => account.id === balanceAccountId) ?? null : null;
  const auditTransaction = auditTransactionId ? transactions.find((transaction) => transaction.id === auditTransactionId) ?? null : null;
  const auditAccountWithoutOriginal = auditTransaction ? transactionAdjustedAccounts(accounts, transactions.filter((transaction) => transaction.id !== auditTransaction.id), detailedSpendingTracking).find((account) => account.id === auditTransaction.accountId) ?? null : null;
  const inviteMember = async (email: string, role: Exclude<HouseholdRole, "owner">) => {
    const response = await fetch("/api/household/members", { method: "POST", headers: { ...sessionHeaders, "content-type": "application/json" }, body: JSON.stringify({ email, role }) });
    const data = await response.json() as { members?: HouseholdMember[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "The household member could not be added");
    if (data.members) setHouseholdMembers(data.members);
  };
  const removeAdmin = async (email: string) => {
    const response = await fetch("/api/household/members?email=" + encodeURIComponent(email), { method: "DELETE", headers: sessionHeaders });
    const data = await response.json() as { members?: HouseholdMember[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "The admin could not be removed");
    if (data.members) setHouseholdMembers(data.members);
  };

  const openNew = () => { const group=(monthlyPlan.debtGroups ?? neutralGroups)[0].id; const next = { ...EMPTY_DRAFT, displayGroup: group, displayPosition: (groupedDisplayDebts(accounts).find(item=>item.group===group)?.accounts.length ?? 0)+1 }; setEditingId(null); setAccountAutoFocus("name"); setDraft(next); setAccountDraftBaseline(next); setModalExitPrompt(false); setModalOpen(true); };
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
    if (isViewer) return;
    if (!cashflowDraft.name.trim() || cashflowDraft.amount <= 0) return;
    const normalized = { ...cashflowDraft, name: cashflowDraft.name.trim(), creditAccountId: (cashflowDraft.kind === "expense" || cashflowDraft.kind === "purchase") && cashflowDraft.paymentMethod === "credit" ? cashflowDraft.creditAccountId : "" };
    if (editingCashflowId) setCashflowItems((current) => current.map((item) => item.id === editingCashflowId ? { ...item, ...normalized } : item));
    else setCashflowItems((current) => [...current, { ...normalized, id: `${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString() }]);
    setCashflowModalOpen(false);
  };
  const removeCashflow = () => {
    if (isViewer) return;
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
    cardEditBaseline.current={account:stored,balance:account.balance};
    setCardEditError("");
    const group=stored.displayGroup ?? (monthlyPlan.debtGroups ?? neutralGroups)[0].id;
    const nextDraft = { institutionKey: stored.institutionKey, displayGroup: group, displayPosition: Math.max(1,(groupedDisplayDebts(accounts).find(item=>item.group===group)?.accounts.findIndex(item=>item.id===stored.id)??-1)+1), name: stored.name, type: stored.type, balance: account.balance, apr: stored.apr, interestFee: stored.interestFee, minimum: stored.minimum, minimumMode: stored.minimumMode, payoffMode: stored.payoffMode, creditLimit: stored.creditLimit, dueDate: stored.dueDate, promoEndDate: stored.promoEndDate, postPromoApr: stored.postPromoApr, postPromoMinimum: stored.postPromoMinimum, ...(stored.interestAutomation ? { interestAutomation: stored.interestAutomation } : {}) };
    setDraft(nextDraft);
    setAccountDraftBaseline(nextDraft);
    setModalOpen(true);
  };
  const openBalanceEdit = (account: DebtAccount) => {
    setDebtActionMessage("");
    balanceExpected.current = account.balance;
    setBalanceAccountId(account.id);
  };

  const saveAccount = () => {
    if (isViewer) return false;
    if (!draft.name.trim() || !validOptionalInstitution(draft.institutionKey)) return false;
    const groups = monthlyPlan.debtGroups ?? neutralGroups;
    const newCategory = draft.newCategory?.id === draft.displayGroup ? draft.newCategory : undefined;
    if (newCategory && (groups.length >= 20 || groups.some(group => group.name.trim().toLowerCase() === newCategory.name.trim().toLowerCase()))) return false;
    if (!groups.some(group => group.id === draft.displayGroup) && !newCategory) return false;
    if (draft.interestAutomation?.enabled && (!validInterestConfig(draft.interestAutomation) || draft.interestAutomation.coveredThrough > householdDate())) return false;
    if (draft.actualInterest && editingId) {
      const account = accounts.find(item => item.id === editingId);
      if (account) { try { setTransactions(recordActualInterest(account, transactions, draft.actualInterest.amount, draft.actualInterest.date)); } catch (error) { alert(error instanceof Error ? error.message : "Could not record interest."); return false; } }
    }
    if (newCategory) setMonthlyPlan(current => ({ ...current, debtGroups: [...(current.debtGroups ?? neutralGroups), newCategory] }));
    if (editingId) setAccounts((current) => {
      let placed = current.find(account => account.id === editingId)?.displayGroup !== draft.displayGroup ? arrangeDebt(current, editingId, draft.displayGroup!) : current;
      if (draft.displayPosition !== undefined) {
        const peers = groupedDisplayDebts(placed).find(group => group.group === draft.displayGroup)?.accounts ?? [];
        const from = peers.findIndex(account => account.id === editingId);
        const to = Math.max(0, Math.min(peers.length - 1, draft.displayPosition - 1));
        if (from >= 0) for (let step = 0; step < Math.abs(to - from); step++) placed = arrangeDebt(placed, editingId, draft.displayGroup!, to > from ? 1 : -1);
      }
      return placed.map((account) => account.id !== editingId ? account : {
      ...account,
      name: draft.name.trim(),
      displayGroup: draft.displayGroup,
      type: draft.type,
      institutionKey: draft.institutionKey,
      apr: draft.apr,
      interestFee: draft.interestFee,
      ...(draft.interestAutomation ? { interestAutomation: draft.interestAutomation } : {}),
      minimum: draft.minimum,
      minimumMode: draft.minimumMode,
      payoffMode: draft.payoffMode,
      creditLimit: draft.creditLimit,
      dueDate: draft.dueDate,
      promoEndDate: draft.promoEndDate,
      postPromoApr: draft.postPromoApr,
      postPromoMinimum: draft.postPromoMinimum,
    }); });
    else {
      const { displayPosition: _displayPosition, actualInterest: _actualInterest, newCategory: _newCategory, ...accountDraft } = draft;
      void _displayPosition;
      void _newCategory;
      void _actualInterest;
      const account = { ...accountDraft, baselineBalance: draft.balance, id: crypto.randomUUID(), name: draft.name.trim(), createdAt: new Date().toISOString() };
      setAccounts((current) => { let placed=[...current,account]; const peers=groupedDisplayDebts(placed).find(group=>group.group===draft.displayGroup)?.accounts??[]; const from=peers.findIndex(item=>item.id===account.id); const to=Math.max(0,Math.min(peers.length-1,(draft.displayPosition??peers.length)-1)); if(from>=0)for(let step=0;step<Math.abs(to-from);step++)placed=arrangeDebt(placed,account.id,draft.displayGroup!,to>from?1:-1); return placed; });
      setCustomDebtOrder((current) => [...current.filter((id) => id !== account.id), account.id]);
    }
    setModalOpen(false);
    return true;
  };
  const deleteAccountConfirmed = (id:string) => {
    if(isViewer)return;
    const account=accounts.find(item=>item.id===id),posted=calculatedAccounts.find(item=>item.id===id);
    if(!account||!posted)return;
    setMonthlyPlan(current=>({...current,removedProgressAccounts:retainRemovedProgressAccount(current.removedProgressAccounts??[],account,posted.balance)}));
    setAccounts(current=>current.filter(item=>item.id!==id));setCustomDebtOrder(current=>current.filter(item=>item!==id));setModalOpen(false);if(account.type==="Credit card")setSelectedDebt(null);setDeleteCardId(null);setDebtActionMessage("Debt account permanently deleted. Existing history references were retained.");
  };
  const removeAccount = () => {
    if(isViewer||!editingId)return;
    const account=accounts.find(item=>item.id===editingId);
    if(account?.type==="Credit card"){setDeleteCardId(editingId);return;}
    if(confirm("Permanently delete "+(account?.name??"this debt account")+"? Payment, adjustment, and snapshot references will remain for audit, but the debt details cannot be restored."))deleteAccountConfirmed(editingId);
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
  const recordPayment = (draft: PaymentDraft) => {
    const account = calculatedAccounts.find((item) => item.id === paymentRequest?.accountId);
    if (!account || isViewer || paymentSubmitted.current) return false;
    const now = new Date().toISOString();
    const existingPayee = payees.find((payee) => !payee.deletedAt && payee.name.toLowerCase() === account.name.toLowerCase());
    const payee = existingPayee ?? { id: crypto.randomUUID(), name: account.name, createdAt: now, deletedAt: null };
    try {
      const next = changeDebtEntry({accounts, transactions, adjustments: balanceAdjustments}, {action:"save", draft:{accountId: account.id, title:"Payment", kind:"payment", direction:"decrease", amount:draft.amount, date:draft.date, note:draft.note, paymentKind:draft.paymentKind, includedIn:draft.includedIn}}, auditCreator);
      const transaction = next.transactions.at(-1)!;
      paymentSubmitted.current = true;
      if (!deviceOnly) setCloudStatus("saving");
      if (!existingPayee) setPayees((current) => [...current, payee]);
      setTransactions(next.transactions);
      setUndoEntry({before:{accounts,transactions,adjustments:balanceAdjustments},after:JSON.stringify(next)});
      setPaymentRequest(null);
      setDebtActionMessage(moneyPrecise.format(transaction.amount) + " payment pending save for " + account.name + ". Balance: " + moneyPrecise.format(transaction.balanceBefore ?? account.balance) + " to " + moneyPrecise.format(transaction.balanceAfter ?? 0) + ".");
      return true;
    } catch (error) {
      if (error instanceof Error) setDebtActionMessage(error.message);
      return false;
    }
  };
  const updateAccountBalance = (draft: BalanceDraft) => {
    const storedAccount = accounts.find((item) => item.id === balanceAccountId);
    const currentAccount = calculatedAccounts.find((item) => item.id === balanceAccountId);
    if (!storedAccount || !currentAccount || isViewer) return;
    if (balanceExpected.current !== currentAccount.balance) {
      setDebtActionMessage("This debt changed while the form was open. Close and reopen Update balance to review the latest balance.");
      return;
    }
    try {
      const checked = reconcileInterest(storedAccount, transactions, draft.date);
      const result = createBalanceAdjustment({ storedAccount: checked.account, currentBalance: currentAccount.balance, nextBalance: draft.balance, date: draft.date, note: draft.note, creator: auditCreator, transactions: checked.transactions });
      if (result.adjustment && result.adjustment.difference < 0) {
        if (draft.decreaseKind === "payment") result.adjustment.confirmedPayment = { confirmedAt: new Date().toISOString(), ...(auditCreator ? { creator: auditCreator } : {}) };
        else if (draft.decreaseKind === "credit") result.adjustment.reportKind = "credit";
      }
      if (result.adjustment) setUndoEntry({before:{accounts,transactions,adjustments:balanceAdjustments},after:JSON.stringify({accounts:accounts.map(a=>a.id===result.account.id?{...result.account,balanceAsOf:draft.date}:a),transactions:checked.transactions,adjustments:[...balanceAdjustments,result.adjustment]})});
      setTransactions(checked.transactions);
      if (!deviceOnly) setCloudStatus("saving");
      setAccounts((current) => current.map((item) => item.id === result.account.id ? { ...result.account, balanceAsOf: draft.date } : item));
      if (result.adjustment) setBalanceAdjustments((current) => [...current, result.adjustment!]);
      setBalanceAccountId(null);
      if (!result.adjustment) { setDebtActionMessage("Lender balance confirmed. Interest through this date is covered and will not be added again."); return; }
      const direction = result.adjustment.difference >= 0 ? "increased" : "decreased";
      setDebtActionMessage(currentAccount.name + " balance " + direction + " by " + moneyPrecise.format(Math.abs(result.adjustment.difference)) + ", from " + moneyPrecise.format(result.adjustment.balanceBefore) + " to " + moneyPrecise.format(result.adjustment.balanceAfter) + ". The difference is in Transactions as an adjustment.");
    } catch (error) {
      if (error instanceof Error) setDebtActionMessage(error.message);
    }
  };
  const confirmBalancePayment = (id: string) => {
    if (isViewer || !balanceAdjustments.some(item => item.id === id && item.difference < 0 && !item.deletedAt && !item.confirmedPayment)) return;
    setBalanceAdjustments(current => current.map(item => item.id === id ? confirmAdjustmentPayment(item, auditCreator) : item));
    if (!deviceOnly) setCloudStatus("saving");
    setDebtActionMessage("Payment identified from the balance update. The debt balance did not decrease again.");
  };
  const undoBalancePayment = (id: string) => {
    if (isViewer || !balanceAdjustments.some(item => item.id === id && !item.deletedAt && item.confirmedPayment)) return;
    setBalanceAdjustments(current => current.map(item => {
      if (item.id !== id) return item;
      const copy = { ...item }; delete copy.confirmedPayment; return copy;
    }));
    if (!deviceOnly) setCloudStatus("saving");
    setDebtActionMessage("Entry kept as a balance adjustment. Balance unchanged.");
  };
  const changeTransactionEntry = (command: EntryCommand, expected: string): string | null => {
    if (isViewer) return "Your household access is read-only.";
    const state = { accounts, transactions, adjustments: balanceAdjustments };
    if (JSON.stringify(state) !== expected) return "The household changed while this form was open. Close and reopen it to review the latest balances.";
    try {
      const next = changeDebtEntry(state, command, auditCreator);
      createDashboardPayload(dashboardContract.current?.payload, { accounts: next.accounts, transactions: next.transactions, balanceAdjustments: next.adjustments, monthlyBudgets, payees, snapshots, extra, strategy, planning, monthlyPlan, customDebtOrder });
      setUndoEntry({before:state, after:JSON.stringify(next)});
      setAccounts(next.accounts); setTransactions(next.transactions); setBalanceAdjustments(next.adjustments);
      if (!deviceOnly) setCloudStatus("saving");
      setDebtActionMessage(command.action === "save" ? "Pending save. Balance: " + moneyPrecise.format(transactionAdjustedAccounts(next.accounts, next.transactions).find(a=>a.id===command.draft?.accountId)?.balance ?? 0) : command.action === "delete" ? "Deletion pending save. The record remains in Deleted transactions." : "Restoration pending save.");
      return null;
    } catch (error) { return error instanceof Error ? error.message : "Could not save this transaction."; }
  };
  const markAccountPaidOff = (id: string) => {
    const account = calculatedAccounts.find((item) => item.id === id);
    if (!account || isViewer) return;
    if(account.type === "Credit card") {
      if(!confirm("Mark "+account.name+" paid off and archive it?")) return;
      try {const next=markCreditCardPaidOff({accounts,transactions,adjustments:balanceAdjustments},id,auditCreator);setAccounts(next.accounts);setTransactions(next.transactions);setBalanceAdjustments(next.adjustments);setSelectedDebt(null);setDebtActionMessage("Card marked paid off and archived.");} catch(error){setCardEditError(error instanceof Error?error.message:"Could not mark this card paid off.");}
      return;
    }
    if (account.balance <= 0) return;
    if (!confirm("Mark " + account.name + " paid off by recording a final " + moneyPrecise.format(account.balance) + " payment?")) return;
    const now = new Date().toISOString();
    const existingPayee = payees.find((payee) => !payee.deletedAt && payee.name.toLowerCase() === account.name.toLowerCase());
    const payee = existingPayee ?? { id: crypto.randomUUID(), name: account.name, createdAt: now, deletedAt: null };
    const transaction = createDebtPayment({ account, amount: account.balance, date: dateInputValue(), note: "Marked paid off from Debts", createdAt: now, payeeId: payee.id, creator: auditCreator, action: "mark-paid-off", paymentKind: "combined" });
    if (!existingPayee) setPayees((current) => [...current, payee]);
    setTransactions((current) => [...current, transaction]);
    setDebtActionMessage(account.name + " is paid off and retained for progress reporting. You can archive it in Advanced.");
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

  const exportDashboardBackup = async () => {
    const payload = createDashboardPayload(dashboardContract.current?.payload, { accounts, monthlyBudgets, payees, transactions, snapshots, extra, strategy, planning, balanceAdjustments, monthlyPlan, customDebtOrder });
    const backup = createDashboardBackup(payload, dashboardContract.current);
    dashboardContract.current = backup;
    let exported = await repository.exportData(backup);
    const savedHousehold = !deviceOnly && cloudStatus === "synced" && !sync.current?.pending;
    if (savedHousehold) {
      let response: Response;
      try { response = await fetch("/api/household/export", { cache: "no-store", headers: sessionHeaders }); }
      catch { setTransferMessage("Export unavailable. Reconnect and retry."); return; }
      if (!response.ok) { setTransferMessage("Could not export saved household. Retry or export pending changes."); return; }
      exported = await response.text();
    }
    const url = URL.createObjectURL(new Blob([exported], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `debtfree-${savedHousehold ? "household-backup" : "device-recovery"}-${dateInputValue()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setTransferMessage(savedHousehold ? "Saved household exported. Keep this file private." : "Device recovery exported. May include unsaved changes.");
  };

  const importDashboardBackup = async (file: File, mode: ImportMode) => {
    if (isViewer) return;
    setTransferMessage("");
    try {
      const incoming = await repository.importData(await file.text());
      if (!hasMeaningfulData(incoming.payload)) throw new Error("The backup does not contain dashboard data.");
      const currentPayload = createDashboardPayload(dashboardContract.current?.payload, { accounts, monthlyBudgets, payees, transactions, snapshots, extra, strategy, planning, balanceAdjustments, monthlyPlan, customDebtOrder });
      const currentContract = createDashboardBackup(currentPayload, dashboardContract.current);
      const contract = resolveDashboardImport(currentContract, incoming, mode);
      await repository.checkpoint(currentContract);
      await repository.saveHousehold(contract);
      if (!deviceOnly) setCloudStatus("saving");
      cloudWritesEnabled.current = true;
      applyDashboardPayload(contract);
      const { payload } = contract;
      const success = `Full backup ${mode === "merge" ? "merged" : "restored"}: ${payload.accounts.length} debts, ${payload.transactions.length} transactions, ${payload.snapshots.length} snapshots, and ${Object.keys(payload.monthlyBudgets).length} plan months.`;
      pendingTransferMessage.current = deviceOnly ? null : success;
      setTransferMessage(deviceOnly ? success : "Restore pending save.");
    } catch (error) {
      setTransferMessage(`Import failed: ${dashboardDataErrorMessage(error)}`);
    }
  };

  const resetDashboardData = async () => {
    if (isViewer) return;
    setTransferMessage("");
    try {
      const payload = createDashboardPayload(null, {
        accounts: [],
        monthlyBudgets: {},
        payees: [],
        transactions: [],
        snapshots: [],
        extra: 0,
        strategy: "avalanche",
        planning: createOnboardingPlanning(),
        balanceAdjustments: [],
        monthlyPlan: { detailedSpendingTracking: false, months: {} },
        customDebtOrder: [],
      });
      const contract = createDashboardBackup(payload);
      if (dashboardContract.current) await repository.checkpoint(dashboardContract.current);
      await repository.saveHousehold(contract);
      if (!deviceOnly) setCloudStatus("saving");
      cloudWritesEnabled.current = true;
      applyDashboardPayload(contract);
      setSelectedMonth(currentMonthKey());
      pendingTransferMessage.current = deviceOnly ? null : "Dashboard data reset. Recovery checkpoint kept.";
      setTransferMessage(deviceOnly ? "Dashboard data reset. Recovery checkpoint kept." : "Reset pending save.");
    } catch (error) {
      setTransferMessage(`Reset failed: ${dashboardDataErrorMessage(error)}`);
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
    paymentSubmitted.current = false;
    const account = calculatedAccounts.find((item) => item.id === accountId);
    if (!account) return;
    setDebtActionMessage("");
    setPaymentRequest({ accountId, suggestedAmount: Math.min(account.balance, round(amount)) });
  };
  const openEditTransaction = (transaction: LedgerTransaction) => {
    if (transaction.interestEstimate || transaction.actualInterestCycle) return; // Reconcile automatic interest via the lender balance.
    setEditingTransactionId(transaction.id);
    setTransactionDraft({ date: transaction.date, accountId: transaction.accountId, payeeId: transaction.payeeId, payeeName: transaction.payeeName, type: transaction.type, category: transaction.category, memo: transaction.memo, amount: transaction.amount, plannedItemId: transaction.plannedItemId ?? "", paymentKind: transaction.paymentKind ?? "combined" });
    setTransactionModalOpen(true);
  };
  const saveTransaction = () => {
    if (isViewer) return;
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
        setDebtActionMessage(moneyPrecise.format(transaction.amount) + " payment pending save for " + account.name + ". Balance: " + moneyPrecise.format(transaction.balanceBefore ?? account.balance) + " to " + moneyPrecise.format(transaction.balanceAfter ?? 0) + ".");
      } catch (error) {
        if (error instanceof Error) setDebtActionMessage(error.message);
      }
      return;
    }
    let matchedPayee = payees.find((payee) => !payee.deletedAt && payee.name.toLowerCase() === transactionDraft.payeeName.trim().toLowerCase());
    if (!matchedPayee) {
      matchedPayee = { id: crypto.randomUUID(), name: transactionDraft.payeeName.trim(), createdAt: now, deletedAt: null };
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
      if (original.includedIn || transactions.some(t=>!t.deletedAt&&t.includedIn?.type==="transaction"&&t.includedIn.id===original.id)) {
        const error=changeTransactionEntry({action:"save",id:"transaction:"+original.id,draft:{accountId:original.accountId,kind:"payment",direction:"decrease",amount:draft.amount,date:draft.date,note:draft.note,paymentKind:draft.paymentKind}},JSON.stringify({accounts,transactions,adjustments:balanceAdjustments}));
        if(error) throw new Error(error);setAuditTransactionId(null);return true;
      }
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
      setDebtActionMessage("Payment correction pending save for " + original.payeeName + ". The original audit record was retained as replaced, and the balance reflects the corrected payment exactly once.");
      return true;
    } catch (error) {
      if (error instanceof Error) setDebtActionMessage(error.message);
      return false;
    }
  };
  const softDeleteTransaction = (id: string) => {
    if (isViewer) return;
    if (!confirm("Move this transaction to deleted items? You can restore it later.")) return;
    const now = new Date().toISOString();
    setTransactions((current) => current.map((transaction) => transaction.id === id ? { ...transaction, deletedAt: now, updatedAt: now } : transaction));
    setTransactionModalOpen(false);
  };
  const restoreTransaction = (id: string) => setTransactions((current) => current.map((transaction) => transaction.id === id && !transaction.replacedByTransactionId ? { ...transaction, deletedAt: null, updatedAt: new Date().toISOString() } : transaction));
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
    setPayees((current) => [...current, { id: crypto.randomUUID(), name: trimmed, createdAt: new Date().toISOString(), deletedAt: null }]);
  };
  const renamePayee = (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPayees((current) => current.map((payee) => payee.id === id ? { ...payee, name: trimmed } : payee));
    setTransactions((current) => current.map((transaction) => transaction.payeeId === id ? { ...transaction, payeeName: trimmed, updatedAt: new Date().toISOString() } : transaction));
  };
  const deletePayee = (id: string) => setPayees((current) => current.map((payee) => payee.id === id ? { ...payee, deletedAt: new Date().toISOString() } : payee));
  const captureSnapshot = (note: string) => {
    const progress = buildActualProgress(accounts, transactions, balanceAdjustments, snapshots, new Date(), monthlyPlan.progressStartingBalance, monthlyPlan.removedProgressAccounts);
    const snapshotAccounts = [...calculatedAccounts, ...progress.groups.flatMap(group => group.accounts.filter(account => account.removedFromDebts))];
    if (!snapshotAccounts.length) return;
    const month = currentMonthKey();
    const now = new Date().toISOString();
    const projectedDebtFreeMonth = plan.months.length && !plan.stalled ? monthAfter(plan.months.length - 1) : null;
    setSnapshots((current) => {
      const existing = current.find((snapshot) => snapshot.month === month);
      const next = createPayoffSnapshot({
        existing,
        accounts: snapshotAccounts,
        month,
        capturedAt: now,
        totalBalance: round(snapshotAccounts.reduce((sum, account) => sum + account.balance, 0)),
        monthlyInterest: interest,
        activeAccountCount: activeCount,
        projectedDebtFreeMonth,
        note,
        id: `snapshot-${Date.now()}-${Math.random()}`,
      });
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
    const seeded = seedMonthlyPlan(result, currentMonthKey(), monthlyBudgets, monthlyPlan);
    setMonthlyBudgets(seeded.monthlyBudgets);
    setMonthlyPlan({ ...seeded.monthlyPlan, ...(monthlyPlan.currency ? { currency: monthlyPlan.currency } : {}), debtGroups: neutralGroups });
    setExtra(result.extra);
    setStrategy(result.strategy);
    setCustomDebtOrder(normalizeCustomDebtOrder(result.accounts));
    setPage("home");
  };
  const loans = useMemo(()=>monthlyPlan.loanTrackers??[],[monthlyPlan.loanTrackers]);
  const visiblePlan = useMemo(()=>scheduleView(accounts,loans,snapshots,monthlyPlan.removedProgressAccounts??[],monthlyPlan),[accounts,loans,snapshots,monthlyPlan]);
  const includedCalculatedAccounts=useMemo(()=>calculatedAccounts.filter(account=>!(monthlyPlan.payoffExcludedTypes??[]).includes(account.type)),[calculatedAccounts,monthlyPlan.payoffExcludedTypes]);
  const forecastDate=householdDate();
  const activePayoff = useMemo(() => buildActivePayoffCommitment(payoffAccounts, loans, planningCashflowItems, monthlyPlan, new Date(forecastDate + "T12:00:00Z")), [payoffAccounts, loans, planningCashflowItems, monthlyPlan, forecastDate]);
  const progressViews = useMemo(() => {
    const input = { accounts, transactions, adjustments: balanceAdjustments, snapshots, loans, startingBalance: monthlyPlan.progressStartingBalance, removedAccounts: monthlyPlan.removedProgressAccounts ?? [], date: new Date(forecastDate + "T12:00:00Z"), forecast: { settings: monthlyPlan, items: planningCashflowItems } };
    return { accounts: buildProgressView(input, "accounts"), loans: buildProgressView(input, "loans"), household: buildProgressView(input, "household") };
  }, [accounts, transactions, balanceAdjustments, snapshots, loans, monthlyPlan, forecastDate, planningCashflowItems]);
  const extraPayment = activePayoff.extra;
  const payoffSchedule = activePayoff.schedule;
  const budgetView = buildBudgetView({ items: cashflowItems, transactions, settings: monthlyPlan, loans, month: selectedMonth, currentMonth: currentMonthKey(), commitment: activePayoff });
  const budgetPayoffAmount = budgetView.planned.payoff;
  useEffect(() => {
    if (!loaded || isViewer) return;
    const month = forecastDate.slice(0, 7);
    if (!accounts.length && !loans.length && !monthlyPlan.months[month] && !monthlyBudgets[month]) return;
    if (monthlyPlan.months[month]?.debtPaymentTarget === activePayoff.budgetCommitment) return;
    const timer = window.setTimeout(() => setMonthlyPlan(current => capturePayoffCommitment(current, month, householdDate().slice(0, 7), activePayoff.budgetCommitment)), 0);
    return () => clearTimeout(timer);
  }, [loaded, isViewer, forecastDate, accounts.length, loans.length, monthlyPlan.months, monthlyBudgets, activePayoff.budgetCommitment]);
  const setScheduleChoices=(patch:Partial<MonthlyPlanSettings>)=>{if(!isViewer)setMonthlyPlan(current=>({...current,payoffExtraPayment:current.payoffExtraPayment??extraPayment,...patch}));};
  const minimumItems=[...includedCalculatedAccounts.filter(a=>!a.archivedAt&&a.balance>0).map(a=>({id:'account:'+a.id,name:a.name,amount:effectiveMinimum(a)})),...visiblePlan.loans.filter(l=>l.remainingAmount>0).map(l=>({id:'loan:'+l.id,name:l.name,amount:regularLoanPayment(l,planningCashflowItems)}))];
  const minimumExpected=JSON.stringify({items:minimumItems,accounts:includedCalculatedAccounts.map(a=>[a.id,a.minimum,a.minimumMode]),loans:visiblePlan.loans.map(l=>[l.id,l.monthlyPayment,l.escrow,l.principalAndInterest])});
  const saveScheduleMinimums=(values:Record<string,number>,expected:string):string|null=>{
    if(isViewer)return "Editing is unavailable.";
    if(expected!==minimumExpected)return "The plan changed. Close and reopen minimums.";
    try{
      let next=accounts;let nextLoans=loans;
      for(const [key,value]of Object.entries(values)){
        if(!minimumItems.some(item=>item.id===key)||!Number.isFinite(value)||value<=0||!Number.isSafeInteger(Math.round(value*100))||round(value)!==value)throw new Error("Enter valid minimums greater than 0.");
        if(key.startsWith('account:'))next=updatePayoffMinimum(next,key.slice(8),value);
        else nextLoans=nextLoans.map(loan=>{if(loan.id!==key.slice(5))return loan;const escrow=loan.kind==='house'?loan.escrow:0;if(escrow!==undefined&&value<=escrow)throw new Error("Payment must exceed escrow.");return {...loan,monthlyPayment:value,...(loan.principalAndInterest!==undefined&&escrow!==undefined?{principalAndInterest:round(value-escrow)}:{})};});
      }
      setAccounts(next);setMonthlyPlan(current=>({...current,payoffExtraPayment:current.payoffExtraPayment??extraPayment,loanTrackers:nextLoans}));return null;
    }catch(error){return error instanceof Error?error.message:"Could not save minimums.";}
  };
  const selectedAccount = selectedDebt?.kind === "account" ? calculatedAccounts.find(account => account.id === selectedDebt.id) : undefined;
  const selectedLoan = selectedDebt?.kind === "loan" ? loans.find(loan => loan.id === selectedDebt.id) : undefined;
  const openDebt = (selection: DebtSelection) => {
    if (selection.kind === "account") { const account = calculatedAccounts.find(item => item.id === selection.id); if (account) openEdit(account); setModalOpen(false); }
    setSelectedDebt(selection); setDetailTab("Overview");
  };
  const householdProgress = buildActualProgress(accounts, transactions, balanceAdjustments, snapshots, new Date(), monthlyPlan.progressStartingBalance, monthlyPlan.removedProgressAccounts??[]);
  const cardDetails = selectedAccount?.type === "Credit card";
  const saveCard = () => {
    if(isViewer || !selectedAccount || !cardEditBaseline.current) return false;
    try {
      let next=saveCreditCardDetails({accounts,transactions,adjustments:balanceAdjustments},selectedAccount.id,draft,cardEditBaseline.current,auditCreator);
      let ordered=next.accounts;
      const savedAccount=ordered.find(account=>account.id===selectedAccount.id)!;
      if((savedAccount.displayGroup??'Other')!==(draft.displayGroup??'Other')) ordered=arrangeDebt(ordered,selectedAccount.id,draft.displayGroup??'Other');
      if(draft.displayPosition!==undefined){const peers=groupedDisplayDebts(ordered).find(group=>group.group===(draft.displayGroup??'Other'))?.accounts??[];const from=peers.findIndex(account=>account.id===selectedAccount.id);const to=Math.max(0,Math.min(peers.length-1,draft.displayPosition-1));if(from>=0)for(let step=0;step<Math.abs(to-from);step++)ordered=arrangeDebt(ordered,selectedAccount.id,draft.displayGroup??'Other',to>from?1:-1);}
      next={...next,accounts:ordered};
      createDashboardPayload(dashboardContract.current?.payload,{accounts:next.accounts,transactions:next.transactions,balanceAdjustments:next.adjustments,monthlyBudgets,payees,snapshots,extra,strategy,planning,monthlyPlan,customDebtOrder});
      setAccounts(next.accounts);setTransactions(next.transactions);setBalanceAdjustments(next.adjustments);
      const stored=next.accounts.find(account=>account.id===selectedAccount.id)!;
      const posted=transactionAdjustedAccounts(next.accounts,next.transactions).find(account=>account.id===selectedAccount.id)!;
      cardEditBaseline.current={account:stored,balance:posted.balance};
      const savedDraft={...draft,balance:posted.balance};setDraft(savedDraft);setAccountDraftBaseline(savedDraft);setCardEditError("");return true;
    }catch(error){setCardEditError(error instanceof Error?error.message:"Could not save this card.");return false;}
  };
  const accountDraftDirty = JSON.stringify(draft) !== JSON.stringify(accountDraftBaseline);
  const requestAccountModalClose = () => {
    if (accountDraftDirty) setModalExitPrompt(true);
    else setModalOpen(false);
  };
  const requestDetailTab = (tab: DebtDetailTab) => {
    if (tab === detailTab) return;
    if (detailTab === "Info" && accountDraftDirty) { setPendingDetailExit({ type: "tab", tab }); return; }
    if (tab === "Info" && detailTab !== "Info" && selectedAccount) { openEdit(selectedAccount); setModalOpen(false); }
    setDetailTab(tab);
  };
  const requestDetailClose = () => {
    if (detailTab === "Info" && accountDraftDirty) { setPendingDetailExit({ type: "close" }); return; }
    setSelectedDebt(null);
  };
  const resolveDetailExit = (save: boolean) => {
    if (!pendingDetailExit) return;
    if (save && !(selectedAccount?.type === "Credit card" ? saveCard() : saveAccount())) return;
    if (!save) setDraft(accountDraftBaseline);
    const destination = pendingDetailExit;
    setPendingDetailExit(null);
    if (destination.type === "close") setSelectedDebt(null);
    else setDetailTab(destination.tab);
  };
  const detailInfo = selectedAccount && (cardDetails ? <CreditCardInfo accountId={selectedAccount.id} groups={monthlyPlan.debtGroups ?? neutralGroups} accounts={accounts} draft={draft} interestAutomated={Boolean(draft.interestAutomation?.enabled)} readOnly={isViewer} onChange={next=>{setDraft(current=>({...current,...next}));setCardEditError("");}} onPaidOff={()=>markAccountPaidOff(selectedAccount.id)} onDelete={removeAccount}/> : <AccountModal inline dirty={accountDraftDirty} readOnly={isViewer} onLoanType={() => {}} draft={draft} editing editingAccountId={selectedAccount.id} autoFocusField="name" groups={monthlyPlan.debtGroups ?? neutralGroups} accounts={accounts} onChange={setDraft} onClose={() => requestDetailTab("Overview")} onSave={() => { if (saveAccount()) setDetailTab("Overview"); }} onRemove={removeAccount} onArchive={() => archiveAccount(selectedAccount.id)} onMarkPaidOff={() => markAccountPaidOff(selectedAccount.id)}/>);
  if (!loaded) return <main className="onboarding-shell onboarding-loading" role="status"><div><span>DF</span><strong>Loading your household.</strong></div></main>;
  if (!isViewer && !recoveryDrafts.length && shouldShowOnboarding({ accounts, monthlyBudgets, payees, transactions, snapshots, extra, strategy, planning })) {
    return <HouseholdCurrencyProvider currency={householdCurrency}><>{syntheticDemo && <div className="viewer-notice" role="status">Synthetic demo</div>}<OnboardingFlow
      planning={planning}
      importMessage={transferMessage}
      onCurrencyChange={currency => setMonthlyPlan(current => ({ ...current, currency }))}
      onPlanningChange={setPlanning}
      onImport={(file) => importDashboardBackup(file, "replace")}
      onComplete={completeOnboarding}
    /></></HouseholdCurrencyProvider>;
  }
  return <HouseholdCurrencyProvider currency={householdCurrency}><div data-view-page={page} data-page={primaryPage} data-mobile-layout={mobileView ? "true" : undefined} className={(navigationCollapsed ? "app-shell dashboard-collapsed" : "app-shell") + (mobileView ? " " + mobileStyles.shell : "")}>
    <aside className="sidebar" id="dashboard-navigation">
      <div className="sidebar-head"><button className="brand" type="button" onClick={() => setPage("home")}><span>DF</span><div><strong>DebtFree</strong><small>Dashboard</small></div></button><button className={navigationCollapsed ? "dashboard-toggle sidebar-dashboard-toggle is-collapsed" : "dashboard-toggle sidebar-dashboard-toggle"} type="button" onClick={toggleDashboardNavigation} aria-label={navigationCollapsed ? "Expand dashboard navigation" : "Collapse dashboard navigation"} aria-controls="dashboard-navigation" aria-expanded={!navigationCollapsed}><i aria-hidden="true"><b/></i></button></div>
      <nav aria-label="Primary navigation">{(mobileView ? MOBILE_NAV_ITEMS : NAV_ITEMS).map((item) => <button type="button" key={item.id} data-nav-page={item.id} className={primaryPage === item.id ? "nav-item active" : "nav-item"} aria-current={primaryPage === item.id ? "page" : undefined} onClick={() => setPage(item.id)}><i aria-hidden="true"><OutlineIcon name={item.id === "accounts" ? "card" : item.id === "payments" ? "list" : item.id === "home" ? "home" : item.id === "snapshots" ? "trend" : item.id === "monthly" ? "chart" : "settings"}/></i><span>{item.label}</span></button>)}</nav>

      <div className="sidebar-foot"><span>{managedHousehold?.name ?? householdName}</span><strong>{managedHousehold ? "Connected test household" : deviceOnly ? "Stored on this device" : cloudStatus === "synced" ? "Shared household data" : cloudStatus === "error" || cloudStatus === "too-large" || cloudStatus === "conflict" ? "Cloud changes need attention" : "Syncing changes"}</strong></div>
    </aside>

    <main className="main-area">
      <div ref={contentRef} className="page-body" role="region" aria-label="Dashboard content" tabIndex={0}>
        <div className="page-heading">
          {mobileView && <button className={mobileStyles.headerButton} type="button" aria-label="Open Tools" aria-expanded={toolsOpen} aria-controls="mobile-tools" onClick={() => setToolsOpen(true)}><OutlineIcon name="menu"/></button>}
          <h1 className={mobileView && page === "home" ? mobileStyles.homeBrand : undefined}>{mobileView && page === "home" ? <><span>Debt</span><b>Free</b></> : mobileView && page === "profile" ? "Account" : (mobileView ? MOBILE_NAV_ITEMS.find(item => item.id === page)?.label : undefined) ?? ALL_NAV_ITEMS.find((item) => item.id === page)?.label}{syntheticDemo && <small className="eyebrow" style={{ display: "block" }}>Synthetic demo</small>}</h1>
          {!mobileView && <button className="account-bubble" type="button" onClick={toggleAccount} aria-label={page === "profile" ? "Return to previous page" : "Open My Account"}>{user.displayName.split(/\s+/).filter(Boolean).map(part => part[0]).slice(0,2).join("").toUpperCase()}<span className={`sync-dot ${deviceOnly ? deviceSaveStatus : cloudStatus}`} aria-hidden="true"/></button>}
          {!mobileView && <span className="save-status" role="status">{deviceOnly ? deviceSaveStatus === "synced" ? "Saved on device" : "Saving on device" : cloudStatus === "synced" && deviceSaveStatus === "synced" ? "Saved" : cloudStatus === "conflict" ? "Save conflict" : cloudStatus === "error" || cloudStatus === "too-large" ? "Save failed" : cloudStatus === "unauthorized" ? "Sign in required" : "Saving"}</span>}

          {mobileView && <button className={mobileStyles.headerButton + " " + mobileStyles.avatarButton} type="button" aria-label={page === "profile" ? "Close Account" : "Open Account"} onClick={toggleAccount}><span>{user.displayName.split(/\s+/).filter(Boolean).map(part => part[0]).slice(0,2).join("").toUpperCase() || "DF"}</span></button>}
        </div>
        {localError && <section role="alert" className="viewer-notice">{localError}<button onClick={() => void exportDashboardBackup()}>Export backup</button></section>}
        {recoveryDrafts.length > 0 && <section role="alert" className="viewer-notice">Unsaved changes on this device.
          <select aria-label="Unsaved draft" value={selectedRecovery} onChange={event => setSelectedRecovery(Number(event.target.value))}>{recoveryDrafts.map((draft, index) => <option key={draft.key} value={index}>Draft {index + 1} · {new Date(draft.contract.exportedAt).toLocaleString()}</option>)}</select>
          <button disabled={isViewer} onClick={() => { try {
            const draft = recoveryDrafts[selectedRecovery]; if (!draft || !sync.current) return;
            sync.current.recoverDraft(draft); applyDashboardPayload(draft.contract); setRecoveryDrafts([]);
          } catch { setLocalError("Resolve current changes before restoring this draft."); } }}>Restore unsaved draft</button>
        </section>}
        {!deviceOnly && (cloudStatus === "error" || cloudStatus === "conflict" || cloudStatus === "too-large") && <section role="alert" className="viewer-notice"><strong>{cloudStatus === "conflict" ? "Another session changed this household. Your changes are retained. Export your changes, then load the latest household. Review it and reapply any missing edits." : cloudStatus === "too-large" ? "This household exceeds the cloud save limit. Pending changes are retained on this device. Export your changes and contact support for help; retrying will not reduce the size. Keep your history." : "Cloud access or saving is unavailable. Pending changes are retained."}</strong>{cloudStatus === "error" && <button onClick={() => void refreshHousehold()}>Retry connection</button>}<button onClick={() => void exportDashboardBackup()}>Export my changes</button>{cloudStatus === "conflict" && <button onClick={() => { void (async () => { if (!confirm("Load the latest household data? Your current changes will be kept as a recovery checkpoint.")) return; try { if (dashboardContract.current) await repository.checkpoint(dashboardContract.current); const loaded = await sync.current?.useCloud(); if (loaded?.contract) applyDashboardPayload(loaded.contract); } catch { setLocalError("Could not load the household. Export your changes before continuing."); } })(); }}>Load latest household</button>}</section>}
        {!deviceOnly && !online && <section className="viewer-notice" role="status">Offline. Reconnect to edit. Pending changes are kept.</section>}
        {!deviceOnly && cloudStatus === "unauthorized" && <section className="viewer-notice" role="alert">Session expired. Pending changes are kept. <a href="/auth/login">Sign in</a></section>}
        {isViewer && householdRole === "viewer" && <section className="viewer-notice" role="status"><strong>Viewer access</strong><span>You can review this household dashboard, but only the owner and admins can make changes.</span></section>}
        {page === "more" && <div className="screen more-screen"><h1 className="sr-only">More</h1>
          <section className="toolkit-hero"><span className="tool-icon"><OutlineIcon name="grid"/></span><div><h2>Your debt toolkit</h2><p>Plan smarter. Track every milestone.</p></div><span className="toolkit-art" aria-hidden="true"><i/><i/><i/></span></section>
          <h2 className="tool-section-label">Payoff tools</h2><section className="more-links" aria-label="More tools">{MORE_NAV_ITEMS.filter(item => item.id !== "profile" && (!mobileView || item.id !== "calculator")).map(item => <button key={item.id} type="button" aria-label={item.label} onClick={() => setPage(item.id)}><span className={`tool-icon ${item.id === "plan" ? "orange" : ""}`}><OutlineIcon name={item.id === "calculator" ? "calculator" : item.id === "plan" ? "calendar" : "chart"}/></span><span className="tool-copy"><strong>{item.label}</strong><small>{item.id === "calculator" ? "Try a what-if payoff scenario." : item.id === "plan" ? "Monthly commitment & minimums." : "Actual debt reduction & saved snapshots."}</small></span><span aria-hidden="true">›</span></button>)}</section>
          <h2 className="tool-section-label">Account</h2><section className="more-links"><button type="button" aria-label="Account & backups" onClick={() => setPage("profile")}><span className="tool-icon neutral"><OutlineIcon name="account"/></span><span className="tool-copy"><strong>Account &amp; backups</strong><small>Household access, data & backups.</small></span><span aria-hidden="true">›</span></button></section>
          <details className="more-advanced" open><summary>Advanced tools</summary><div className="more-links">{ADVANCED_NAV_ITEMS.filter(item => item.id !== "history" || detailedSpendingTracking).map(item => <button key={item.id} type="button" aria-label={item.label} onClick={() => setPage(item.id)}><span className={`tool-icon ${item.id === "utilization" ? "orange" : ""}`}><OutlineIcon name={item.id === "utilization" ? "card" : item.id === "history" ? "list" : "pie"}/></span><span className="tool-copy"><strong>{item.label}</strong><small>{item.id === "utilization" ? "Understand balances vs card limits." : item.id === "history" ? "Review detailed spending records." : "Interest costs and debt insights."}</small></span><span aria-hidden="true">›</span></button>)}</div></details>
        </div>}
        {undoEntry && <div className="entry-undo" role="status"><span>{visibleDebtActionMessage}</span><button type="button" className="secondary" disabled={isViewer} onClick={() => { if (JSON.stringify({accounts,transactions,adjustments:balanceAdjustments}) !== undoEntry.after) {setDebtActionMessage("Newer changes exist. Use transaction history to correct this entry.");setUndoEntry(null);return;} const undone=undoDebtEntry(undoEntry.before,{accounts,transactions,adjustments:balanceAdjustments});setAccounts(undone.accounts);setTransactions(undone.transactions);setBalanceAdjustments(undone.adjustments);setUndoEntry(null);setDebtActionMessage("Entry undone."); }}>Undo</button></div>}
        {page === "payments" && <PaymentsPage mobile={mobileView} readOnly={isViewer} accounts={calculatedAccounts} transactions={transactions} adjustments={balanceAdjustments} message={undoEntry ? "" : debtActionMessage} onConfirm={confirmBalancePayment} onUndoConfirmation={undoBalancePayment} storedAccounts={accounts} onChange={changeTransactionEntry} onDialog={setDebtEntryOpen}/>}
        <fieldset className="viewer-readonly-surface" disabled={isViewer && !["home", "accounts", "snapshots", "monthly", "profile", "settings"].includes(page)}>

        {page === "home" && <HomeDashboardPage name={user.displayName} accounts={payoffAccounts} loans={loans} schedule={payoffSchedule} householdPayment={activePayoff.householdPayment} scopeLabel={activePayoff.scopeLabel} progress={householdProgress} transactions={transactions} adjustments={balanceAdjustments} onSchedule={() => setScheduleOpen(true)} onAccount={toggleAccount} onViewProgress={() => setPage("snapshots")} onViewDebts={() => setPage("accounts")}/> }
        {page === "monthly" && <div className="budget-workspace"><nav className="budget-tabs" aria-label="Budget sections">{(["Overview", "Transactions", "Schedule"] as const).map(tab => <button key={tab} type="button" aria-pressed={budgetTab === tab} onClick={() => setBudgetTab(tab)}>{tab}</button>)}</nav>
        {budgetTab === "Transactions" && <PaymentsPage loans={loans} onLoan={id => openDebt({ kind: "loan", id })} budgetSettings={monthlyPlan} reportingMonth={selectedMonth} onReportingMonth={setSelectedMonth} mobile={mobileView} readOnly={isViewer} accounts={calculatedAccounts} transactions={transactions} adjustments={balanceAdjustments} message={debtActionMessage} onConfirm={confirmBalancePayment} onUndoConfirmation={undoBalancePayment} storedAccounts={accounts} onChange={changeTransactionEntry} onDialog={setDebtEntryOpen}/>}
        {budgetTab === "Schedule" && <BudgetScheduleEntry commitment={activePayoff} onOpen={() => setScheduleOpen(true)}/>}
        {budgetTab === "Overview" && <MonthlyPlanPage readOnly={isViewer} view={budgetView} payoffAmount={budgetPayoffAmount} commitment={selectedMonth === currentMonthKey() ? activePayoff : undefined} month={selectedMonth} hasMonth={Object.prototype.hasOwnProperty.call(monthlyBudgets, selectedMonth)} previousHasItems={(monthlyBudgets[shiftMonth(selectedMonth, -1)] ?? []).some((item) => item.recurring ?? item.kind !== "purchase")} items={cashflowItems} accounts={calculatedAccounts} transactions={transactions} settings={selectedPlanSettings} trackingEnabled={detailedSpendingTracking} plannedMinimums={selectedPlanSettings.minimums ?? (selectedMonth === currentMonthKey() ? monthlyTargets.minimums : {})} plannedPayments={selectedMonth === currentMonthKey() ? monthlyTargets.payments : selectedPlanSettings.payments ?? {}} onMonth={setSelectedMonth} onCopyPrevious={copyPreviousBudget} onStartBlank={startBlankBudget} onAdd={openNewCashflow} onEdit={openEditCashflow} onSettings={updateSelectedPlanSettings} onTracking={setDetailedSpendingTracking} onViewTransactions={() => setBudgetTab("Transactions")}/>}</div>}
        {(page === "accounts" || page === "debt-tools") && <><DebtSummary preferenceScope={householdId + ":" + user.email} accounts={calculatedAccounts} loans={loans} items={planningCashflowItems}/><UnifiedDebtList preferenceScope={householdId + ":" + user.email} accounts={payoffAccounts} loans={loans} items={planningCashflowItems} groups={monthlyPlan.debtGroups ?? neutralGroups} onSelect={openDebt}/></>}
        {page === "settings" && <div className={mobileStyles.settings}><HouseholdCurrencySettings readOnly={isViewer} onChange={currency => { if (!isViewer) setMonthlyPlan(current => ({ ...current, currency })); }}/><AppearanceSettings/><section className={mobileStyles.accountTools} aria-label="Notifications"><h2>Notifications</h2><p>Notification preferences are not available yet.</p></section><DebtCategorySettings groups={monthlyPlan.debtGroups ?? neutralGroups} onChange={debtGroups => { if (!isViewer) setMonthlyPlan(current => ({ ...current, debtGroups })); }} readOnly={isViewer}/><section className={mobileStyles.accountTools} aria-label="Settings tools"><h2>Account &amp; tools</h2>{[...MORE_NAV_ITEMS, ...ADVANCED_NAV_ITEMS].map(item => <button type="button" key={item.id} onClick={() => item.id === "plan" ? setScheduleOpen(true) : item.id === "profile" ? toggleAccount() : setPage(item.id)}>{item.label}</button>)}</section><section className={mobileStyles.archives} aria-label="Archived debts"><h2>Archived debts</h2>{calculatedAccounts.filter(a => a.archivedAt).map(account => <article key={account.id}><button type="button" onClick={() => openDebt({kind:"account", id:account.id})}>{account.name}</button><button type="button" className="secondary" disabled={isViewer} onClick={() => restoreAccount(account.id)}>Restore</button></article>)}</section></div>}
        {page === "history" && detailedSpendingTracking && <TransactionsPage accounts={calculatedAccounts} payees={payees} transactions={transactions} onQuickAdd={openNewTransaction} onEdit={openEditTransaction} onAudit={setAuditTransactionId} onDelete={softDeleteTransaction} onRestore={restoreTransaction} onBatchAdd={addBatchTransactions} onManagePayees={() => setPayeeModalOpen(true)}/>}


        {page === "snapshots" && <ActualProgressPage groups={monthlyPlan.debtGroups ?? neutralGroups} readOnly={isViewer} accounts={accounts} removedAccounts={monthlyPlan.removedProgressAccounts??[]} transactions={transactions} adjustments={balanceAdjustments} snapshots={snapshots} loans={loans} progressViews={progressViews} onLoanSnapshot={()=>{if(isViewer)return;setMonthlyPlan(current=>({...current,loanTrackers:(current.loanTrackers??[]).map(loan=>({...loan,history:[...loan.history,{date:loan.asOf,amount:loan.remainingAmount,balanceKind:loan.balanceKind,recordedAt:new Date().toISOString()}]}))}));} } onCapture={captureSnapshot} onUpdateNote={updateSnapshotNote} onDelete={removeSnapshot} onActivity={() => setPage("accounts")} onAccounts={() => setPage("accounts")}/>}
        {page === "profile" && <ProfilePage connected={Boolean(managedHousehold)} syntheticDemo={syntheticDemo} lifecycleEnabled={lifecycleEnabled} householdId={householdId} readOnly={isViewer} user={user} householdName={managedHousehold?.name ?? householdName} role={managedHousehold?.role ?? householdRole} members={householdMembers} cloudStatus={cloudStatus} deviceOnly={deviceOnly} transferMessage={transferMessage} onExportBackup={exportDashboardBackup} onImportBackup={importDashboardBackup} onReset={resetDashboardData} onRecover={async () => { if (isViewer) return; try { const checkpoint = await repository.loadCheckpoint(); if (!checkpoint) { setTransferMessage("No recovery checkpoint is available."); return; } if (!confirm("Restore the saved recovery checkpoint? Current data will be saved as the automatic backup.")) return; await repository.saveHousehold(checkpoint); applyDashboardPayload(checkpoint); } catch (error) { setTransferMessage(dashboardDataErrorMessage(error)); } }} onInvite={inviteMember} onRemove={removeAdmin}/>}
        {page === "profile" && <><section className={mobileStyles.accountTools} aria-label="Account tools"><h2>Account tools</h2><button type="button" onClick={() => navigateMobile("settings")}>Settings</button><label className="secondary import-file">Import DebtFree CSV<input type="file" accept=".csv,text/csv" disabled={isViewer} onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void importDebtFreeCsv(file); event.currentTarget.value = ""; }}/></label>{importMessage && <p role="status">{importMessage}</p>}</section><section className={mobileStyles.archives} aria-label="Paid off & archived"><h2>Paid off &amp; archived</h2>{calculatedAccounts.filter(account => account.archivedAt).length === 0 && <p>No archived debts.</p>}{calculatedAccounts.filter(account => account.archivedAt).map(account => <article key={account.id}><div><strong>{account.name}</strong><small>{account.balance === 0 ? "PAID OFF" : "ARCHIVED"}</small></div><button type="button" className="secondary" aria-label={"Restore " + account.name} disabled={isViewer} onClick={() => { if (confirm("Restore " + account.name + " to current debts?")) restoreAccount(account.id); }}>Restore</button></article>)}</section></>}
        {page === "utilization" && <UtilizationPage accounts={calculatedAccounts} onEditAccount={account => { openDebt({kind:"account",id:account.id}); setDetailTab("Info"); }}/>}
        {page === "stats" && <DebtInsightsPage accounts={calculatedAccounts} onPlan={()=>setScheduleOpen(true)} onProgress={()=>setPage("snapshots")}/>}
        </fieldset>
      </div>
      {page === "payments" && !debtEntryOpen && <section className="bottom-action-bar transaction-add-bar" aria-label="Add a record"><button type="button" aria-label="Add record" disabled={isViewer || !accounts.length} onClick={() => { setNewRecordOpen(true); setDebtEntryOpen(true); }}><OutlineIcon name="plus"/>Record New Transaction</button></section>}
        {page === "accounts" && <section hidden={debtEntryOpen} className="bottom-action-bar debt-add-bar" aria-label="Add a debt"><button type="button" disabled={isViewer} onClick={openNew}>Debt +</button></section>}
      {page === "monthly" && !cashflowModalOpen && <section className="bottom-action-bar budget-add-bar" aria-label="Add a budget entry"><button type="button" className="income-action" disabled={isViewer} onClick={() => openNewCashflow("income")}><OutlineIcon name="money"/>Income +</button><button type="button" className="expense-action" disabled={isViewer} onClick={() => openNewCashflow("expense")}><OutlineIcon name="cart"/>Spending +</button><button type="button" className="purchase-action" aria-label="One-off +" disabled={isViewer} onClick={() => openNewCashflow("purchase")}><OutlineIcon name="plus"/>One-off +</button></section>}
    </main>

    {mobileView && toolsOpen && <div className={mobileStyles.backdrop} onClick={event => { if (event.target === event.currentTarget) setToolsOpen(false); }} onKeyDown={event => { if (event.key === "Escape") setToolsOpen(false); }}><section id="mobile-tools" className={mobileStyles.tools} role="dialog" aria-modal="true" aria-label="Tools"><header><h2>Tools</h2><button type="button" className={mobileStyles.headerButton} aria-label="Close Tools" onClick={() => setToolsOpen(false)}>×</button></header><nav aria-label="Tools">{[...MORE_NAV_ITEMS.filter(item => item.id !== "profile" && item.id !== "calculator"), ...ADVANCED_NAV_ITEMS, { id: "debt-tools" as PageId, label: "Debt details & import" }].map(item => <button type="button" key={item.id} onClick={() => navigateMobile(item.id)}>{item.label}</button>)}</nav><section aria-label="Settings"><h3>Settings</h3><button type="button" onClick={() => navigateMobile("settings")}>Appearance &amp; preferences</button></section><section aria-label="Account"><h3>Account</h3><button type="button" onClick={() => navigateMobile("profile")}>Account &amp; backups</button></section></section></div>}
    {selectedAccount && <DebtDetail name={selectedAccount.name} tab={detailTab} onTab={requestDetailTab} onBack={requestDetailClose} overview={<DebtOverview name={selectedAccount.name} balance={selectedAccount.balance} starting={selectedAccount.baselineBalance??[...snapshots].sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt)).flatMap(s=>s.accounts).find(a=>a.accountId===selectedAccount.id)?.balance} apr={selectedAccount.apr} minimum={effectiveMinimum(selectedAccount)} dueDate={nextDueDate(selectedAccount.dueDate)} readOnly={isViewer} onEdit={cardDetails?()=>requestDetailTab("Info"):undefined} onPayment={() => openRecommendedPayment(selectedAccount.id, activePayoff.accountSuggestions[selectedAccount.id] ?? effectiveMinimum(selectedAccount))} onBalance={() => openBalanceEdit(selectedAccount)} history={cardDetails?<CardProgressChart id={selectedAccount.id} current={selectedAccount.balance} transactions={transactions} adjustments={balanceAdjustments}/>:undefined} payoff={payoffSchedule.payoffMonths[`account:${selectedAccount.id}`]??null}/>} transactions={<>{!cardDetails&&<button type="button" className="primary" disabled={isViewer} onClick={() => openRecommendedPayment(selectedAccount.id, activePayoff.accountSuggestions[selectedAccount.id] ?? effectiveMinimum(selectedAccount))}>Record Payment</button>}<PaymentsPage cardDetail={cardDetails} accountScope={selectedAccount.id} mobile={mobileView} readOnly={isViewer} accounts={calculatedAccounts} transactions={transactions} adjustments={balanceAdjustments} message={debtActionMessage} onConfirm={confirmBalancePayment} onUndoConfirmation={undoBalancePayment} storedAccounts={accounts} onChange={changeTransactionEntry} onDialog={setDebtEntryOpen}/></>} info={detailInfo} actions={cardDetails?<>{cardEditError&&<p className="form-error" role="alert">{cardEditError}</p>}<button className="primary" type="button" disabled={isViewer} onClick={()=>setCardTransactionOpen(true)}><OutlineIcon name="plus"/><span>+ Transaction</span></button><button className="secondary" type="button" disabled={isViewer} onClick={()=>requestDetailTab("Info")}><OutlineIcon name="receipt"/><span>Edit</span></button>{detailTab === "Info" && accountDraftDirty && <button className="primary" type="button" disabled={isViewer} onClick={saveCard}><OutlineIcon name="check"/><span>Save</span></button>}</>:undefined}/> }
    {selectedAccount && cardTransactionOpen && <DebtEntryDialog accountScope={selectedAccount.id} flexibleScope mobile={mobileView} state={{accounts,transactions,adjustments:balanceAdjustments}} command={{action:"save"}} readOnly={isViewer} onSave={changeTransactionEntry} onClose={()=>setCardTransactionOpen(false)}/>}
    {selectedLoan && <LoanProgressPanel paymentSuggestion={activePayoff.loanSuggestions[selectedLoan.id]} payoffMonth={payoffSchedule.payoffMonths[`loan:${selectedLoan.id}`]??null} key={selectedLoan.id} detailLoanId={selectedLoan.id} detailTab={detailTab} onDetailTab={setDetailTab} onDetailClose={() => setSelectedDebt(null)} readOnly={isViewer} loans={loans} items={planningCashflowItems} onChange={loanTrackers => setMonthlyPlan(current => ({ ...current, loanTrackers }))} onDialog={setDebtEntryOpen}/>}
    {deleteCardId&&<ActionConfirmation title="Delete debt permanently?" message={"Delete "+(accounts.find(a=>a.id===deleteCardId)?.name??"this debt")+"? This cannot be undone. Past transactions and Progress snapshots remain preserved."} confirmLabel="Delete debt" onCancel={()=>setDeleteCardId(null)} onConfirm={()=>deleteAccountConfirmed(deleteCardId)}/>}
    {scheduleOpen && <PayoffSchedulePopup scopeLabel={activePayoff.scopeLabel} scopeBalance={activePayoff.scopeBalance} onReviewTerms={issue => { const loan=loans.find(item=>issue.startsWith(item.name+": "));setScheduleOpen(false);if(loan){setSelectedDebt({kind:"loan",id:loan.id});setDetailTab("Info");}else setPage("accounts"); }} schedule={payoffSchedule} amount={extraPayment} date={new Date()} readOnly={isViewer} onAmount={payoffExtraPayment=>setScheduleChoices({payoffExtraPayment})} strategy={monthlyPlan.payoffPlanStrategy==='snowball'?'snowball':'avalanche'} onStrategy={payoffPlanStrategy=>setScheduleChoices({payoffPlanStrategy})} types={[...new Set([...accounts.filter(a=>!a.archivedAt).map(a=>a.type),...loans.map(loanScheduleType),...(monthlyPlan.payoffExcludedTypes??[])])].filter(type=>SCHEDULE_TYPES.includes(type as typeof SCHEDULE_TYPES[number]))} excludedTypes={monthlyPlan.payoffExcludedTypes??[]} onTypes={payoffExcludedTypes=>setScheduleChoices({payoffExcludedTypes})} minimums={minimumItems} minimumExpected={minimumExpected} onMinimums={saveScheduleMinimums} onClose={()=>setScheduleOpen(false)}/>}
    {householdRole !== "viewer" && newRecordOpen && <DebtEntryDialog state={{accounts, transactions, adjustments:balanceAdjustments}} command={{action:"save"}} readOnly={isViewer} onSave={changeTransactionEntry} onClose={() => { setNewRecordOpen(false); setDebtEntryOpen(false); }}/>}
    {householdRole !== "viewer" && newLoanDraft && <LoanProgressPanel readOnly={isViewer} key={newLoanDraft.id} editorOnly initialDraft={newLoanDraft} loans={monthlyPlan.loanTrackers ?? []} items={planningCashflowItems} onChange={loanTrackers => { setMonthlyPlan(current => ({ ...current, loanTrackers }));  }} onDialog={open => { setDebtEntryOpen(open); if (!open) setNewLoanDraft(null); }}/>}
    {householdRole !== "viewer" && modalOpen && <AccountModal onLoanType={kind => { setNewLoanDraft({ id: crypto.randomUUID(), name: draft.name, institutionKey: draft.institutionKey, kind, originalAmount: 0, remainingAmount: draft.balance > 0 ? draft.balance : Number.NaN, balanceKind: "principal", asOf: householdDate(), budgetItemId: "", budgetItemName: "", history: [], apr: draft.apr }); setModalOpen(false); setDebtEntryOpen(true); }} draft={draft} dirty={accountDraftDirty} editingAccountId={editingId??undefined} editing={Boolean(editingId)} autoFocusField={accountAutoFocus} groups={monthlyPlan.debtGroups ?? neutralGroups} accounts={accounts} onChange={setDraft} onClose={requestAccountModalClose} onSave={saveAccount} onRemove={removeAccount}/>}
    {modalExitPrompt && <UnsavedChangesDialog subject="debt account" onSave={() => { if (saveAccount()) setModalExitPrompt(false); }} onDiscard={() => { setDraft(accountDraftBaseline); setModalExitPrompt(false); setModalOpen(false); }} onCancel={() => setModalExitPrompt(false)}/>}
    {pendingDetailExit && <UnsavedChangesDialog subject="debt account" onSave={() => resolveDetailExit(true)} onDiscard={() => resolveDetailExit(false)} onCancel={() => setPendingDetailExit(null)}/>}
    {householdRole !== "viewer" && paymentAccount && paymentRequest && <PaymentModal key={paymentAccount.id + paymentRequest.suggestedAmount} accounts={calculatedAccounts.filter(a => !a.archivedAt && (!selectedAccount || a.id === selectedAccount.id))} onAccountChange={id => openRecommendedPayment(id, activePayoff.accountSuggestions[id] ?? 0)} error={visibleDebtActionMessage} account={paymentAccount} transactions={transactions} adjustments={balanceAdjustments} suggestedAmount={paymentRequest.suggestedAmount} onClose={() => setPaymentRequest(null)} onSave={recordPayment}/>}
    {householdRole !== "viewer" && auditTransaction && <PaymentCorrectionModal key={auditTransaction.id + auditTransaction.updatedAt} transaction={auditTransaction} accountWithoutOriginal={auditAccountWithoutOriginal} onClose={() => setAuditTransactionId(null)} onSave={correctDebtPayment}/> }
    {householdRole !== "viewer" && balanceAccount && <BalanceUpdateModal key={balanceAccount.id} error={visibleDebtActionMessage} account={balanceAccount} onClose={() => setBalanceAccountId(null)} onSave={updateAccountBalance}/>}
    {householdRole !== "viewer" && cashflowModalOpen && <CashflowModal draft={cashflowDraft} editing={Boolean(editingCashflowId)} accounts={calculatedAccounts} onChange={setCashflowDraft} onClose={() => setCashflowModalOpen(false)} onSave={saveCashflow} onRemove={removeCashflow}/>}
    {householdRole !== "viewer" && detailedSpendingTracking && transactionModalOpen && <TransactionModal draft={transactionDraft} editing={Boolean(editingTransactionId)} accounts={calculatedAccounts} payees={payees} plannedItems={planningCashflowItems} onChange={setTransactionDraft} onClose={() => setTransactionModalOpen(false)} onSave={saveTransaction} onRemove={() => editingTransactionId && softDeleteTransaction(editingTransactionId)}/>}
    {!isViewer && detailedSpendingTracking && payeeModalOpen && <PayeeModal payees={payees} onAdd={addPayee} onRename={renamePayee} onDelete={deletePayee} onClose={() => setPayeeModalOpen(false)}/>}
  </div></HouseholdCurrencyProvider>;
}

function TransactionsPage({ accounts, payees, transactions, onQuickAdd, onEdit, onAudit, onDelete, onRestore, onBatchAdd, onManagePayees }: { accounts: DebtAccount[]; payees: Payee[]; transactions: LedgerTransaction[]; onQuickAdd: () => void; onEdit: (transaction: LedgerTransaction) => void; onAudit: (id: string) => void; onDelete: (id: string) => void; onRestore: (id: string) => void; onBatchAdd: (drafts: TransactionDraft[]) => void; onManagePayees: () => void }) {
  const householdCurrency = useHouseholdCurrency();
  const moneyPrecise = createHouseholdMoneyFormatter(householdCurrency, { style: "currency", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const symbol = householdCurrencySymbol(householdCurrency);
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
    <div className="screen-title"><div><span className="eyebrow">Core transaction ledger</span><h1>Detailed ledger</h1><p>Record charges, fees, and payments. Every active entry is included in the calculated account balances below.</p></div><div className="screen-actions ledger-actions"><button className="secondary" type="button" onClick={onManagePayees}>Merchants &amp; recipients</button><button className="secondary" type="button" disabled={!accounts.length} onClick={() => { setBatchRows(makeRows()); setBatchOpen((open) => !open); }}>Batch entry</button><label className={accounts.length ? "primary receipt-file-button" : "primary receipt-file-button disabled"}><input type="file" accept="image/*" capture="environment" disabled={!accounts.length} onChange={(event) => { const input = event.currentTarget; const file = input.files?.[0]; if (file) setReceiptFile(file); input.value = ""; }}/><span>Scan receipt</span></label><button className="secondary" type="button" disabled={!accounts.length} onClick={onQuickAdd}>+ Quick add</button></div></div>
    {!accounts.length ? <section className="large-empty"><span>Ledger</span><h2>Add a debt account first</h2><p>Transactions need an account so DebtFree can calculate how each charge, fee, or payment changes its balance.</p></section> : <>
      <section className="ledger-metrics"><article><span>Calculated debt</span><strong>{moneyPrecise.format(accounts.reduce((sum, account) => sum + account.balance, 0))}</strong><small>Opening balances plus active ledger entries</small></article><article><span>Charges & fees</span><strong className="charge">{moneyPrecise.format(charges)}</strong><small>Increase account balances</small></article><article><span>Payments</span><strong className="payment">{moneyPrecise.format(payments)}</strong><small>Reduce account balances</small></article><article><span>Saved names</span><strong>{payees.filter((payee) => !payee.deletedAt).length}</strong><small>{transactions.filter((transaction) => transaction.deletedAt).length} deleted transactions retained</small></article></section>
      <section className="balance-strip" aria-label="Calculated account balances">{accounts.map((account) => <div key={account.id}><span><InstitutionIcon institutionKey={account.institutionKey} debtType={account.type}/> {account.name}</span><strong>{moneyPrecise.format(account.balance)}</strong><small>Calculated balance</small></div>)}</section>
      {batchOpen && <section className="batch-card"><div className="batch-head"><div><span>Batch entry</span><strong>Add several transactions at once</strong></div><button type="button" onClick={() => setBatchOpen(false)}>Close</button></div><div className="batch-scroll"><table className="batch-table"><thead><tr><th>Date</th><th>Account</th><th>Type</th><th>Merchant / recipient</th><th>Amount</th><th>Memo</th></tr></thead><tbody>{batchRows.map((row, index) => <tr key={index}><td><input aria-label={`Row ${index + 1} date`} type="date" value={row.date} onChange={(event) => updateBatch(index, { date: event.target.value })}/></td><td><select aria-label={`Row ${index + 1} account`} value={row.accountId} onChange={(event) => updateBatch(index, { accountId: event.target.value })}><option value="">Select</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></td><td><select aria-label={`Row ${index + 1} type`} value={row.type} onChange={(event) => { const type = event.target.value as TransactionType; updateBatch(index, { type, category: type === "payment" ? "Debt payment" : type === "fee" ? "Interest & fees" : "Other" }); }}><option value="charge">Charge</option><option value="fee">Fee</option></select></td><td><input aria-label={`Row ${index + 1} merchant or recipient`} list="batch-payees" value={row.payeeName} placeholder="Who received it?" onChange={(event) => updateBatch(index, { payeeName: event.target.value })}/></td><td><div className="batch-amount"><span>{symbol}</span><input aria-label={`Row ${index + 1} amount`} type="number" min="0" step=".01" value={row.amount || ""} placeholder="0.00" onChange={(event) => updateBatch(index, { amount: number(event.target.value) })}/></div></td><td><input aria-label={`Row ${index + 1} memo`} value={row.memo} placeholder="Optional" onChange={(event) => updateBatch(index, { memo: event.target.value })}/></td></tr>)}</tbody></table><datalist id="batch-payees">{payees.filter((payee) => !payee.deletedAt).map((payee) => <option key={payee.id} value={payee.name}/>)}</datalist></div><div className="batch-footer"><button className="secondary" type="button" onClick={() => setBatchRows((current) => [...current, emptyTransactionDraft(accounts)])}>+ Add row</button><button className="primary" type="button" disabled={!batchRows.some((row) => row.accountId && row.payeeName.trim() && row.amount > 0)} onClick={submitBatch}>Save batch</button></div></section>}
      <section className="ledger-card"><div className="ledger-toolbar"><label className="ledger-search"><span>Search</span><input value={search} placeholder="Merchant, recipient, memo, category, or account" onChange={(event) => { setSearch(event.target.value); setPageNumber(1); }}/></label><label><span>Account</span><select value={accountFilter} onChange={(event) => { setAccountFilter(event.target.value); setPageNumber(1); }}><option value="all">All accounts</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label><span>Type</span><select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value as "all" | TransactionType); setPageNumber(1); }}><option value="all">All types</option><option value="charge">Charges</option><option value="payment">Payments</option><option value="fee">Fees</option></select></label><label><span>Status</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as "active" | "deleted" | "all"); setPageNumber(1); }}><option value="active">Active</option><option value="deleted">Deleted</option><option value="all">All</option></select></label></div>
        {visible.length ? <div className="ledger-table-scroll"><table className="ledger-table"><caption>Searchable transaction ledger</caption><thead><tr><th>Date</th><th>Merchant / recipient</th><th>Account</th><th>Type</th><th>Category / memo</th><th>Amount</th><th>Action</th></tr></thead><tbody>{visible.map((transaction) => <tr key={transaction.id} className={transaction.deletedAt ? "deleted-row" : ""}><td>{formatTransactionDate(transaction.date)}</td><td><strong>{transaction.payeeName}</strong>{transaction.deletedAt && <small>Deleted</small>}</td><td>{accountNames.get(transaction.accountId) ?? "Removed account"}</td><td><span className={`transaction-type ${transaction.type}`}>{transaction.type}</span></td><td><strong>{transaction.type === "payment" ? paymentKindLabel(transaction.paymentKind) : transaction.category}</strong>{transaction.type === "payment" && <small>Debt payment</small>}{transaction.memo && <small>{transaction.memo}</small>}{transaction.balanceBefore !== undefined && transaction.balanceAfter !== undefined && <small className="audit-balances">Balance {moneyPrecise.format(transaction.balanceBefore)} to {moneyPrecise.format(transaction.balanceAfter)}</small>}</td><td className={`ledger-amount ${transaction.type}`}>{transaction.type === "payment" ? "-" : "+"}{moneyPrecise.format(transaction.amount)}</td><td>{transaction.deletedAt ? transaction.replacedByTransactionId ? <span className="audit-lock">Replaced</span> : <button className="restore-action" type="button" onClick={() => onRestore(transaction.id)}>Restore</button> : transaction.debtAction === "payment" ? <button className="audit-action" type="button" onClick={() => onAudit(transaction.id)} aria-label={"View or correct payment for " + transaction.payeeName}>View / correct</button> : transaction.interestEstimate || transaction.actualInterestCycle ? <span className="audit-lock">Statement interest</span> : transaction.debtAction ? <span className="audit-lock">Audit record</span> : <div className="row-actions"><button type="button" onClick={() => onEdit(transaction)}>Edit</button><button type="button" onClick={() => onDelete(transaction.id)}>Delete</button></div>}</td></tr>)}</tbody></table></div> : <div className="ledger-empty"><strong>No matching transactions</strong><p>{transactions.length ? "Try changing the search or filters." : "Use Quick add or Batch entry to record your first transaction."}</p></div>}
        <div className="ledger-pagination"><span>{filtered.length ? `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length}` : "0 transactions"}</span><div><button type="button" disabled={currentPage === 1} onClick={() => setPageNumber((page) => Math.max(1, page - 1))}>Previous</button><strong>Page {currentPage} of {pageCount}</strong><button type="button" disabled={currentPage === pageCount} onClick={() => setPageNumber((page) => Math.min(pageCount, page + 1))}>Next</button></div></div>
      </section>
    </>}
    {receiptFile && <ReceiptScannerModal file={receiptFile} accounts={accounts} onClose={() => setReceiptFile(null)} onAdd={(draft) => { onBatchAdd([draft]); setReceiptFile(null); }}/>}
  </div>;
}

function ReceiptScannerModal({ file, accounts, onClose, onAdd }: { file: File; accounts: DebtAccount[]; onClose: () => void; onAdd: (draft: TransactionDraft) => void }) {
  const householdCurrency = useHouseholdCurrency();
  const moneyPrecise = createHouseholdMoneyFormatter(householdCurrency, { style: "currency", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const symbol = householdCurrencySymbol(householdCurrency);
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
      setDraft({ date: result.date, accountId: accounts[0]?.id ?? "", payeeId: "", payeeName: result.merchant, type: "charge", category: result.category, memo: result.memo, amount: result.total, paymentKind: "combined" });
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
          <div className="receipt-form"><label className="wide"><span>Merchant</span><input value={draft.payeeName} onChange={(event) => setDraft({ ...draft, payeeName: event.target.value, payeeId: "" })}/></label><label><span>Purchase date</span><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })}/></label><label><span>Account charged</span><select value={draft.accountId} onChange={(event) => setDraft({ ...draft, accountId: event.target.value })}><option value="">Select account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><Field label="Receipt total" prefix={symbol} value={draft.amount} placeholder="0.00" step=".01" onChange={(amount) => setDraft({ ...draft, amount })}/><label><span>Suggested category</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{TRANSACTION_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label className="wide"><span>Memo</span><input value={draft.memo} onChange={(event) => setDraft({ ...draft, memo: event.target.value })}/></label></div>
          <div className="receipt-extracted"><div><span>Tax found</span><strong>{scan.tax > 0 ? moneyPrecise.format(scan.tax) : "Not detected"}</strong></div><div><span>Category match</span><strong>{draft.category}</strong></div></div>
          <details><summary>View extracted receipt text</summary><pre>{scan.rawText}</pre></details>
        </>}
      </section>
    </div>
    <footer><span>{scan ? "Check every field before saving." : "Keep this window open while the receipt is read."}</span><div><button className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="button" disabled={!canAdd} onClick={() => onAdd(draft)}>Add to transactions</button></div></footer>
  </section></div>;
}


function TransactionModal({ draft, editing, accounts, payees, plannedItems, onChange, onClose, onSave, onRemove }: { draft: TransactionDraft; editing: boolean; accounts: DebtAccount[]; payees: Payee[]; plannedItems: CashflowItem[]; onChange: (draft: TransactionDraft) => void; onClose: () => void; onSave: () => void; onRemove: () => void }) {
  const householdCurrency = useHouseholdCurrency();
  const moneyPrecise = createHouseholdMoneyFormatter(householdCurrency, { style: "currency", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const symbol = householdCurrencySymbol(householdCurrency);
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
        <Field label="Amount" prefix={symbol} value={draft.amount} placeholder="0.00" step=".01" onChange={(amount) => onChange({ ...draft, amount })}/>
        {overpayment && <p className="form-error wide" role="alert">Payment cannot exceed the current balance of {moneyPrecise.format(account?.balance ?? 0)}.</p>}
        {draft.type !== "payment" && <><label><span>Category</span><select value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value })}>{TRANSACTION_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label className="wide"><span>Planned entry match</span><select value={draft.plannedItemId ?? ""} onChange={(event) => onChange({ ...draft, plannedItemId: event.target.value })}><option value="">No planned entry</option>{plannedItems.filter((item) => item.kind !== "income").map((item) => <option key={item.id} value={item.id}>{item.name} - {moneyPrecise.format(item.amount)}</option>)}</select><small className="field-help">Matching an actual charge prevents the same planned card purchase from changing the payoff projection twice.</small></label></>}
        <label className="wide"><span>Memo</span><input value={draft.memo} placeholder="Optional note" onChange={(event) => onChange({ ...draft, memo: event.target.value })}/></label>
      </div>
      <footer className="transaction-editor-footer"><div><button className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="button" disabled={!canSave} onClick={onSave}>{editing ? "Save changes" : draft.type === "payment" ? "Record payment" : "Add transaction"}</button></div>{editing && <button className="transaction-delete-link" type="button" onClick={onRemove}>Delete transaction</button>}</footer>
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
function ProfilePage({ connected = false, syntheticDemo, lifecycleEnabled, householdId, readOnly, user, householdName, role, members, cloudStatus, deviceOnly, transferMessage, onExportBackup, onImportBackup, onReset, onRecover, onInvite, onRemove }: { connected?: boolean; syntheticDemo: boolean; lifecycleEnabled: boolean; householdId?: string; readOnly: boolean; user: DashboardUser; householdName: string; role: HouseholdRole; members: HouseholdMember[]; cloudStatus: CloudStatus; deviceOnly: boolean; transferMessage: string; onExportBackup: () => Promise<void>; onImportBackup: (file: File, mode: ImportMode) => Promise<void>; onReset: () => Promise<void>; onRecover: () => Promise<void>; onInvite: (email: string, role: Exclude<HouseholdRole, "owner">) => Promise<void>; onRemove: (email: string) => Promise<void> }) {
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
        <span className="eyebrow">{connected ? "Test household" : deviceOnly ? "Device storage" : "Household access"}</span>
        <h1>My account</h1>
        <p>{connected ? "Your separate connected test household." : deviceOnly ? "This dashboard keeps your financial data in this browser on this device." : "Your verified personal email controls access to this shared household dashboard."}</p>
      </div>
      {!syntheticDemo && !connected && <button className="secondary" type="button" onClick={copyLink}>Copy dashboard link</button>}
    </div>
    <section className={deviceOnly ? "profile-grid device-only-profile" : "profile-grid"}>
      <article className="profile-card">
        <div className="profile-avatar">{user.displayName.slice(0,2).toUpperCase()}</div>
        <div>
          <span>{connected ? roleLabel : deviceOnly ? "Local dashboard" : roleLabel}</span>
          <strong>{user.displayName}</strong>
          <small>{user.email}</small>
        </div>
        <div className="account-cloud-state">
          <i className={cloudStatus}/>
          <span>{connected ? "Connected test household" : deviceOnly ? "Saved in this browser on this device" : role === "viewer" ? "Read-only household access" : cloudStatus === "synced" ? "Household cloud sync is active" : cloudStatus === "error" || cloudStatus === "conflict" || cloudStatus === "too-large" ? "Cloud changes need attention" : "Syncing household changes"}</span>
        </div>
        {!deviceOnly && <form action="/auth/logout" method="post"><button type="submit" className="secondary account-link">Sign out</button></form>}
        {deviceOnly && message && <p className="share-message">{message}</p>}
      </article>
      {!deviceOnly && lifecycleEnabled && <HouseholdLifecyclePanel identity={user.email} householdId={householdId} role={role} members={members}/>}
      {!deviceOnly && !lifecycleEnabled && <article className="roles-card household-card">
        <div className="card-head"><div><span>{householdName}</span><strong>Household members</strong></div></div>
        {role === "owner" && <div className="invite-admin"><label><span>Member email and access</span><div><input type="email" value={email} placeholder="member@example.com" onChange={(event) => setEmail(event.target.value)}/><select aria-label="Household access role" value={accessRole} onChange={(event) => setAccessRole(event.target.value as Exclude<HouseholdRole, "owner">)}><option value="admin">Admin</option><option value="viewer">Viewer</option></select><button className="primary" type="button" disabled={readOnly || working || !email.trim()} onClick={invite}>Add member</button></div><small>Admins can edit the shared dashboard. Viewers can only review it. Each member signs in with Google using their authorized email.</small></label></div>}
        {message && <p className="share-message">{message}</p>}
        <div className="member-list">{members.map((member) => <div className="member-row" key={member.email}><div><strong>{member.display_name || member.email}</strong><small>{member.display_name ? member.email : member.status === "invited" ? "Waiting for first sign-in" : "Household member"}</small></div><span className={member.status}>{member.role}</span>{role === "owner" && member.role !== "owner" ? <button type="button" disabled={readOnly || working} onClick={() => remove(member.email)}>Remove</button> : <i/>}</div>)}</div>
      </article>}
      {deviceOnly && !connected && <DataSafetyPanel deviceOnly={deviceOnly} isViewer={readOnly} transferMessage={transferMessage} onExport={onExportBackup} onImport={onImportBackup} onReset={onReset} onRecover={onRecover}/>}
      {!deviceOnly && <DataSafetyPanel deviceOnly={deviceOnly} isViewer={readOnly} transferMessage={transferMessage} onExport={onExportBackup} onImport={onImportBackup} onReset={onReset} onRecover={onRecover}/>}
    </section>
  </div>;
}
function UtilizationPage({ accounts, onEditAccount }: { accounts: DebtAccount[]; onEditAccount: (account: DebtAccount) => void }) {
  const householdCurrency = useHouseholdCurrency();
  const moneyPrecise = createHouseholdMoneyFormatter(householdCurrency, { style: "currency", minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
      <section className="utilization-hero"><div className="utilization-ring" style={{ background: `conic-gradient(${overall < 30 ? "var(--theme-success)" : overall < 50 ? "var(--theme-warning)" : "var(--theme-danger)"} ${Math.min(100, overall)}%, var(--theme-track) 0)` }}><div><strong>{overall.toFixed(1)}%</strong><span>Overall</span></div></div><div className="utilization-hero-copy"><span className={`utilization-status ${overallLevel.className}`}>{overallLevel.label}</span><h2>{overall < 10 ? "Your revolving balances are in a low range." : overall < 30 ? "Your total utilization is below 30%." : `Pay down ${moneyPrecise.format(toThirty)} to move below 30%.`}</h2><p>Overall utilization combines only credit cards with a saved limit. Installment loans are excluded.</p></div><div className="utilization-hero-total"><span>Used credit</span><strong>{moneyPrecise.format(totalBalance)}</strong><small>of {moneyPrecise.format(totalLimit)}</small></div></section>
      <section className="utilization-metrics"><article><span>Available credit</span><strong>{moneyPrecise.format(availableCredit)}</strong><small>Across cards with limits</small></article><article><span>Cards tracked</span><strong>{cardsWithLimits.length}</strong><small>{cardsMissingLimits.length ? `${cardsMissingLimits.length} still need a limit` : "Every card has a limit"}</small></article><article className={aboveThirty ? "warning" : "good"}><span>At or above 30%</span><strong>{aboveThirty}</strong><small>{aboveThirty ? "Review the cards below" : "All tracked cards are below 30%"}</small></article><article><span>To overall 10%</span><strong>{moneyPrecise.format(Math.max(0, totalBalance - totalLimit * .1))}</strong><small>Optional low-utilization target</small></article></section>
      <section className="utilization-grid">{cardsWithLimits.map((account) => { const percent = account.balance / account.creditLimit * 100; const status = level(percent); const toCardThirty = Math.max(0, account.balance - account.creditLimit * .3); const toCardTen = Math.max(0, account.balance - account.creditLimit * .1); return <article className="utilization-card" key={account.id}><header><div><span>{account.name.slice(0,2).toUpperCase()}</span><div><strong>{account.name}</strong><small>{account.apr.toFixed(2)}% APR</small></div></div><button type="button" onClick={() => onEditAccount(account)}>Edit</button></header><div className="utilization-card-value"><strong>{percent.toFixed(1)}%</strong><span className={`utilization-status ${status.className}`}>{status.label}</span></div><div className="utilization-track"><i className={status.className} style={{ width: `${Math.min(100, percent)}%` }}/><b className="marker-thirty"/><b className="marker-ten"/></div><div className="utilization-card-numbers"><div><span>Balance</span><strong>{moneyPrecise.format(account.balance)}</strong></div><div><span>Limit</span><strong>{moneyPrecise.format(account.creditLimit)}</strong></div><div><span>Available</span><strong>{moneyPrecise.format(Math.max(0, account.creditLimit - account.balance))}</strong></div></div><div className="utilization-targets"><div><span>To below 30%</span><strong>{toCardThirty > 0 ? moneyPrecise.format(toCardThirty) : "Reached"}</strong></div><div><span>To 10%</span><strong>{toCardTen > 0 ? moneyPrecise.format(toCardTen) : "Reached"}</strong></div></div></article>; })}</section>
      {cardsMissingLimits.length > 0 && <section className="utilization-missing"><div><span>Missing credit limits</span><strong>Finish setup for {cardsMissingLimits.length} {cardsMissingLimits.length === 1 ? "card" : "cards"}</strong></div><div>{cardsMissingLimits.map((account) => <button type="button" key={account.id} onClick={() => onEditAccount(account)}>Add {account.name} limit</button>)}</div></section>}
    </>}
  </div>;
}


function CashflowModal({ draft, editing, accounts, onChange, onClose, onSave, onRemove }: { draft: CashflowDraft; editing: boolean; accounts: DebtAccount[]; onChange: (draft: CashflowDraft) => void; onClose: () => void; onSave: () => void; onRemove: () => void }) {
  const symbol = householdCurrencySymbol(useHouseholdCurrency());
  const creditAccounts = accounts.filter((account) => account.type === "Credit card");
  const isOutflow = draft.kind === "expense" || draft.kind === "purchase";
  const needsCreditAccount = isOutflow && draft.paymentMethod === "credit";
  const canSave = Boolean(draft.name.trim()) && draft.amount > 0 && (!needsCreditAccount || Boolean(draft.creditAccountId));
  const changeKind = (kind: CashflowKind) => { const outflow = kind === "expense" || kind === "purchase"; onChange({ ...draft, kind, recurring: kind !== "purchase", category: CASHFLOW_CATEGORIES[kind][0], paymentMethod: outflow ? draft.paymentMethod : "debit", creditAccountId: outflow ? draft.creditAccountId : "" }); };
  const title = draft.kind === "income" ? "planned income" : draft.kind === "purchase" ? "one-time adjustment" : "planned spending";
  const amountLabel = draft.kind === "purchase" ? "Adjustment amount" : draft.recurring ? "Monthly amount" : "One-time amount";
  const placeholder = draft.kind === "income" ? "Example: Salary" : draft.kind === "expense" ? "Example: Electric bill" : draft.kind === "purchase" ? "Example: New tires" : "Example: Emergency fund";
  const modalDescription = draft.kind === "purchase" ? "This adjustment affects only this month and is not copied forward." : "This planned entry is expected cash flow. It never changes a current debt balance.";
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal cashflow-modal" role="dialog" aria-modal="true" aria-labelledby="cashflow-modal-title"><header><div><span>{editing ? `Edit ${title}` : `New ${title}`}</span><h2 id="cashflow-modal-title">{editing ? draft.name || "Planned entry" : `Add ${title}`}</h2><p>{modalDescription}</p></div><button type="button" onClick={onClose} aria-label="Close planned entry form">&times;</button></header><div className="form-grid"><div className="wide kind-editor"><span>Item type</span><div>{(["income", "expense", "purchase"] as CashflowKind[]).map((kind) => <button type="button" key={kind} className={draft.kind === kind ? `active ${kind}` : kind} onClick={() => changeKind(kind)}>{kind === "income" ? "Income" : kind === "expense" ? "Planned spending" : "One-time adjustment"}</button>)}</div></div><label className="wide"><span>Name</span><input autoFocus value={draft.name} placeholder={placeholder} onChange={(event) => onChange({ ...draft, name: event.target.value })}/></label><Field label={amountLabel} prefix={symbol} value={draft.amount} placeholder="0" onChange={(amount) => onChange({ ...draft, amount })}/><label><span>Category</span><select value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value })}>{CASHFLOW_CATEGORIES[draft.kind].map((category) => <option key={category}>{category}</option>)}</select></label>{draft.kind !== "purchase" && <label className="wide recurring-choice"><input type="checkbox" checked={draft.recurring ?? true} onChange={(event) => onChange({ ...draft, recurring: event.target.checked })}/><span>Repeat this planned entry every month</span></label>}{isOutflow && <div className="wide payment-editor"><span>Paid with</span><div><button type="button" className={draft.paymentMethod === "debit" ? "active" : ""} onClick={() => onChange({ ...draft, paymentMethod: "debit", creditAccountId: "" })}><i>DB</i><span>Debit</span><small>Paid from checking</small></button><button type="button" className={draft.paymentMethod === "credit" ? "active" : ""} onClick={() => onChange({ ...draft, paymentMethod: "credit" })}><i>CC</i><span>Credit</span><small>Charged to a card</small></button></div></div>}{needsCreditAccount && <label className="wide credit-account-field"><span>Credit card</span><select value={draft.creditAccountId} onChange={(event) => onChange({ ...draft, creditAccountId: event.target.value })}><option value="">Select the card used for this {draft.kind === "purchase" ? "purchase" : "expense"}</option>{creditAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select><small>{creditAccounts.length ? (draft.kind === "purchase" ? "This records how you paid without turning the purchase into a recurring card charge." : "This links the recurring expense to the card you use.") : `Add a credit card under Debt Accounts before assigning this ${draft.kind === "purchase" ? "purchase" : "expense"} to credit.`}</small></label>}</div><footer>{editing ? <button className="danger" type="button" onClick={onRemove}>Remove item</button> : <span/>}<div><button className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="button" disabled={!canSave} onClick={onSave}>{editing ? "Save changes" : draft.kind === "purchase" ? "Add one-time adjustment" : "Add planned entry"}</button></div></footer></section></div>;
}
function PaymentModal({ account, accounts, transactions, adjustments, onAccountChange, error, suggestedAmount, onClose, onSave }: { account: DebtAccount; accounts: DebtAccount[]; transactions: LedgerTransaction[]; adjustments: BalanceAdjustment[]; onAccountChange: (id: string) => void; error: string; suggestedAmount: number; onClose: () => void; onSave: (draft: PaymentDraft) => void }) {
  const householdCurrency = useHouseholdCurrency();
  const moneyPrecise = createHouseholdMoneyFormatter(householdCurrency, { style: "currency", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const symbol = householdCurrencySymbol(householdCurrency);
  const [draft, setDraft] = useState<PaymentDraft>({ amount: Math.min(account.balance, suggestedAmount), date: dateInputValue(), note: "", paymentKind: "combined" });
  const [amountText, setAmountText] = useState(() => draft.amount > 0 ? String(draft.amount) : "");
  const [choice, setChoice] = useState<PaymentLink | "separate" | null>(null);
  const [review, setReview] = useState(false);
  const matches = paymentOverlaps(transactions, adjustments, account.id, draft.amount, draft.date);
  const included = choice && choice !== "separate";
  const overpayment = !included && draft.amount > account.balance;
  const balanceAfter = round(Math.max(0, account.balance - (Number.isFinite(draft.amount) ? draft.amount : 0)));
  const canSave = draft.amount > 0 && Boolean(draft.date) && (!overpayment || matches.some(m=>m.canLink));
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="modal debt-action-modal payment-entry-modal" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title" aria-describedby="payment-modal-description">
      <header className="back-form-header"><div><span>Balance-changing payment</span><h2 id="payment-modal-title">Record payment</h2><p id="payment-modal-description" className="sr-only">Record an amount actually paid</p></div><button type="button" onClick={onClose} data-dialog-close aria-label="Back from payment form">‹</button></header>
      <div className="debt-action-form">

        {overpayment && <p className="form-error" role="alert">Payment cannot exceed the current balance of {moneyPrecise.format(account.balance)}. Use the exact balance for a final payment.</p>}
        <label className="payment-debt-picker"><span>Debt</span><select aria-label="Payment debt" value={account.id} onChange={event => onAccountChange(event.target.value)}>{accounts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-grid"><label className="payment-amount-field"><span>Payment amount</span><div className="field-input"><b aria-hidden="true">{symbol}</b><input aria-label="Payment amount" type="text" inputMode="decimal" value={amountText} placeholder="0.00" onChange={event => { setChoice(null); setReview(false); setAmountText(event.target.value); setDraft({ ...draft, amount: parseMoneyInput(event.target.value) }); }}/></div></label><label><span>Payment date</span><input type="date" value={draft.date} onChange={(event) => { setChoice(null); setReview(false); setDraft({ ...draft, date: event.target.value }); }}/></label></div><div className="balance-change-preview" aria-live="polite"><div><span>Balance before</span><strong>{moneyPrecise.format(account.balance)}</strong></div><i aria-hidden="true">&rarr;</i><div><span>Balance after</span><strong>{moneyPrecise.format(balanceAfter)}</strong></div></div><details className="payment-options"><summary>Payment details (optional)</summary><div className="form-grid"><label className="wide"><span>What does this payment cover?</span><select aria-label="Payment classification" value={draft.paymentKind} onChange={(event) => setDraft({ ...draft, paymentKind: event.target.value as PaymentKind })}><option value="minimum">Statement minimum</option><option value="extra">Extra payment only</option><option value="combined">Minimum plus extra</option></select><small className="field-help">This label lets Budget show what is paid and what is still planned.</small></label><label className="wide"><span>Optional note</span><input value={draft.note} maxLength={240} placeholder="Confirmation number or payment note" onChange={(event) => setDraft({ ...draft, note: event.target.value })}/></label></div></details>
      </div>
      {review && <section className="payment-overlap" aria-label="Review possible overlap"><strong>This payment may already be included</strong>{matches.map(match => <div key={match.link.type+match.link.id}><p>{match.title} · {match.date} · {moneyPrecise.format(match.difference)} balance change</p><button type="button" className="secondary" disabled={!match.canLink} aria-pressed={Boolean(included && choice.id===match.link.id)} onClick={() => setChoice(match.link)}>Already included in that update</button>{!match.canLink && <small>This update already has a payment classification.</small>}</div>)}<button type="button" className="secondary" aria-pressed={choice==="separate"} onClick={() => setChoice("separate")}>This is another payment</button></section>}
      <footer><div><button className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="button" disabled={!canSave} onClick={() => { if (matches.length && !choice) { setReview(true); return; } onSave({...draft, ...(included ? {includedIn: choice} : {})}); }}>Confirm payment</button></div></footer>
    </section>
  </div>;
}

function PaymentCorrectionModal({ transaction, accountWithoutOriginal, onClose, onSave }: { transaction: LedgerTransaction; accountWithoutOriginal: DebtAccount | null; onClose: () => void; onSave: (draft: PaymentDraft) => void }) {
  const householdCurrency = useHouseholdCurrency();
  const moneyPrecise = createHouseholdMoneyFormatter(householdCurrency, { style: "currency", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const symbol = householdCurrencySymbol(householdCurrency);
  const [draft, setDraft] = useState<PaymentDraft>({ amount: transaction.amount, date: transaction.date, note: transaction.memo, paymentKind: transaction.paymentKind ?? "combined" });
  const overpayment = Boolean(accountWithoutOriginal) && draft.amount > (accountWithoutOriginal?.balance ?? 0);
  const balanceAfter = accountWithoutOriginal ? round(Math.max(0, accountWithoutOriginal.balance - draft.amount)) : 0;
  const changed = draft.amount !== transaction.amount || draft.date !== transaction.date || draft.note.trim() !== transaction.memo || draft.paymentKind !== (transaction.paymentKind ?? "combined");
  const canSave = Boolean(accountWithoutOriginal && draft.amount > 0 && draft.date && !overpayment && changed);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="modal debt-action-modal" role="dialog" aria-modal="true" aria-labelledby="payment-correction-title" aria-describedby="payment-correction-description">
      <header className="back-form-header"><div><span>Protected payment history</span><h2 id="payment-correction-title">View or correct {transaction.payeeName} payment</h2><p id="payment-correction-description">The original record is never erased. Saving a correction marks it as replaced and creates one linked payment with the corrected details.</p></div><button type="button" onClick={onClose} data-dialog-close aria-label="Back from payment correction">‹</button></header>
      <div className="debt-action-form">
        <div className="audit-explanation" role="note"><strong>Why this is protected</strong><span>The saved balance trail proves that this payment changed the debt once. Correcting it preserves that history and prevents duplicate balance changes.</span></div>
        <div className="balance-change-preview" aria-live="polite"><div><span>Balance before corrected payment</span><strong>{accountWithoutOriginal ? moneyPrecise.format(accountWithoutOriginal.balance) : "Unavailable"}</strong></div><i aria-hidden="true">&rarr;</i><div><span>Balance after corrected payment</span><strong>{accountWithoutOriginal ? moneyPrecise.format(balanceAfter) : "Unavailable"}</strong></div></div>
        {overpayment && <p className="form-error" role="alert">Corrected payment cannot exceed the balance before this payment, {moneyPrecise.format(accountWithoutOriginal?.balance ?? 0)}.</p>}
        <div className="form-grid">
          <label className="wide"><span>What does this payment cover?</span><select aria-label="Corrected payment classification" value={draft.paymentKind} onChange={(event) => setDraft({ ...draft, paymentKind: event.target.value as PaymentKind })}><option value="minimum">Statement minimum</option><option value="extra">Extra payment only</option><option value="combined">Minimum plus extra</option></select></label>
          <Field label="Corrected amount" prefix={symbol} value={draft.amount} placeholder="0.00" step=".01" autoFocus onChange={(amount) => setDraft({ ...draft, amount })}/>
          <label><span>Payment date</span><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })}/></label>
          <label className="wide"><span>Optional note</span><input value={draft.note} maxLength={240} placeholder="Confirmation number or payment note" onChange={(event) => setDraft({ ...draft, note: event.target.value })}/></label>
        </div>
      </div>
      <footer><span>{changed ? "Saving will retain the original as a replaced audit record." : "Change a field to create a correction."}</span><div><button className="secondary" type="button" onClick={onClose}>Close</button><button className="primary" type="button" disabled={!canSave} onClick={() => onSave(draft)}>Save correction</button></div></footer>
    </section>
  </div>;
}

function BalanceUpdateModal({ account, error, onClose, onSave }: { account: DebtAccount; error: string; onClose: () => void; onSave: (draft: BalanceDraft) => void }) {
  const householdCurrency = useHouseholdCurrency();
  const moneyPrecise = createHouseholdMoneyFormatter(householdCurrency, { style: "currency", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const symbol = householdCurrencySymbol(householdCurrency);
  const [draft, setDraft] = useState<BalanceDraft>({ balance: account.balance, date: dateInputValue(), note: "", decreaseKind: "adjustment" });
  const [balanceText, setBalanceText] = useState(account.balance.toFixed(2));
  const parsedBalance = parseMoneyInput(balanceText);
  const difference = round(parsedBalance - account.balance);
  const invalidBalance = !Number.isFinite(parsedBalance);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="modal debt-action-modal balance-compose transaction-compose" role="dialog" aria-modal="true" aria-labelledby="balance-modal-title">
      <header className="back-form-header"><div><h2 id="balance-modal-title">Update balance</h2></div><button type="button" onClick={onClose} data-dialog-close aria-label="Back from balance update form">‹</button></header>
      <form onSubmit={event => { event.preventDefault(); if (!invalidBalance && draft.date) onSave({ ...draft, balance: parsedBalance }); }}><div className="debt-action-form compose-fields">
        <div className="balance-account"><strong>{account.name}</strong><span>Previous balance {moneyPrecise.format(account.balance)}</span></div>
        <label className="compose-field signed-money"><span>New balance</span><div className="signed-money-input"><span aria-hidden="true">{symbol}</span><input type="text" inputMode="decimal" aria-label="New current balance" value={balanceText} aria-invalid={invalidBalance} onChange={event => setBalanceText(event.target.value)}/></div></label>
        {!invalidBalance && <div className={`balance-difference ${difference > 0 ? "increase" : "decrease"}`} aria-live="polite">{difference === 0 ? "Balance unchanged" : (difference > 0 ? "Increase " : "Decrease ") + moneyPrecise.format(Math.abs(difference))}</div>}
        {difference < 0 && <fieldset className="decrease-classification"><legend>Report decrease as</legend><div>{([{value:"payment",label:"Payment"},{value:"credit",label:"Refund / credit"},{value:"adjustment",label:"Balance correction"}] as const).map(option => <label key={option.value} className={draft.decreaseKind===option.value?"is-selected":""}><input type="radio" name="balance-decrease" checked={draft.decreaseKind===option.value} onChange={() => setDraft({ ...draft, decreaseKind: option.value })}/><span>{option.label}</span></label>)}</div></fieldset>}
        <label className="compose-field"><span>Date</span><input type="date" value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })}/></label>
        <details className="compose-notes"><summary>Add a note <span>optional</span></summary><label className="compose-field"><span className="sr-only">Optional note</span><textarea value={draft.note} maxLength={240} rows={2} onChange={event => setDraft({ ...draft, note: event.target.value })}/></label></details>
        {invalidBalance && <p className="form-error" role="alert">Enter a balance of 0 or more, with up to two decimal places.</p>}{error && <p className="form-error" role="alert">{error}</p>}
      </div><footer><div><button className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit" disabled={invalidBalance || !draft.date}>Save balance</button></div></footer></form>
    </section>
  </div>;
}

function AccountModal({ inline = false, dirty, readOnly = false, onArchive, onMarkPaidOff, onLoanType, draft, editing, editingAccountId, autoFocusField, groups = neutralGroups, accounts = [], onChange, onClose, onSave, onRemove }: { inline?: boolean; dirty: boolean; readOnly?: boolean; onArchive?: () => void; onMarkPaidOff?: () => void; onLoanType: (kind: "house" | "car") => void; draft: AccountDraft; editing: boolean; editingAccountId?: string; autoFocusField: "name" | "balance"; groups?: DebtGroup[]; accounts?: DebtAccount[]; onChange: (draft: AccountDraft) => void; onClose: () => void; onSave: () => void; onRemove: () => void }) {
  const dueDayHelpId = useId();
  const inheritedCurrency = useHouseholdCurrency();
  const symbol = householdCurrencySymbol(useHouseholdCurrency());
  const [advanced, setAdvanced] = useState(false);
  const autoMinimum = estimatedMinimum(draft.balance, draft.apr);
  const isCreditCard = draft.type === "Credit card";

  const invalidInterestDate = draft.interestAutomation?.enabled && (!validInterestConfig(draft.interestAutomation) || draft.interestAutomation.coveredThrough > householdDate());
  return <div className={inline ? "inline-debt-info" : "modal-backdrop"} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className={inline ? "debt-action-modal inline-info-form" : "modal debt-action-modal"} role={inline ? undefined : "dialog"} aria-modal={inline ? undefined : true} aria-label={inline ? undefined : editing ? draft.name || "Account details" : "Add a debt account"}>
      {!inline && <header className="back-form-header"><button type="button" data-dialog-close onClick={onClose} aria-label="Back from account form">‹</button><div><h2 id="account-modal-title">{editing ? draft.name || "Account details" : "Add a debt account"}</h2><small>Household currency: {inheritedCurrency}</small></div></header>}
      <fieldset disabled={readOnly}>
      <div className="debt-action-form"><div className="form-grid">
        <label className="wide"><span>Account name</span><input autoFocus={autoFocusField === "name"} value={draft.name} placeholder="Example: Everyday Rewards" onChange={(event) => onChange({ ...draft, name: event.target.value })}/></label>
        <InstitutionPicker value={draft.institutionKey} onChange={institutionKey => onChange({ ...draft, institutionKey })}/>
        <label><span>Household group</span><select aria-label="Household group" value={draft.displayGroup} onChange={event=>{const displayGroup=event.target.value;onChange({...draft,displayGroup,displayPosition:1});}}>{groups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <label><span>Position in group</span><select aria-label="Position in group" value={draft.displayPosition??1} onChange={event=>onChange({...draft,displayPosition:Number(event.target.value)})}>{Array.from({length:Math.max(1,accounts.filter(account=>!account.archivedAt&&account.id!==editingAccountId&&(account.displayGroup??'Other')===draft.displayGroup).length+(editing?1:0))},(_,index)=><option key={index+1} value={index+1}>{index+1}</option>)}</select></label>
        <label><span>Debt type</span><select value={draft.type} onChange={(event) => { const type = event.target.value; if (!editing && (type === "House loan" || type === "Auto loan")) { onLoanType(type === "House loan" ? "house" : "car"); return; } onChange({ ...draft, type: type as DebtType }); }}>{!editing && <option value="House loan">Mortgage</option>}{DEBT_TYPES.map((type) => <option key={type} value={type}>{type === "Auto loan" ? "Car loan" : type}</option>)}</select></label>
        {!editing && <Field label="Current balance" prefix={symbol} value={draft.balance} placeholder="0" autoFocus={autoFocusField === "balance"} onChange={(balance) => onChange({ ...draft, balance })}/>}
        <Field label="APR" suffix="%" value={draft.apr} placeholder="0.00" step=".01" onChange={(apr) => onChange({ ...draft, apr })}/>
        <div className="minimum-editor"><div><span>{draft.minimumMode === "auto" ? "Estimated minimum" : "Minimum payment"}</span><button type="button" className={draft.minimumMode === "auto" ? "mode active" : "mode"} onClick={() => onChange({ ...draft, minimumMode: draft.minimumMode === "auto" ? "manual" : "auto" })}>{draft.minimumMode === "auto" ? "Auto estimate" : "Use auto"}</button></div><Field label={draft.minimumMode === "auto" ? "Estimated minimum" : "Minimum payment"} prefix={symbol} value={draft.minimumMode === "auto" ? autoMinimum : draft.minimum} placeholder="0" disabled={draft.minimumMode === "auto"} onChange={(minimum) => onChange({ ...draft, minimum })}/><small>{draft.minimumMode === "auto" ? "Estimated; replace with your statement minimum anytime." : "Statement amount."}</small></div>
        <label><span>Due day</span><input aria-label="Due day" aria-describedby={dueDayHelpId} type="date" value={draft.dueDate} onChange={(event) => onChange({ ...draft, dueDate: event.target.value })}/><small id={dueDayHelpId} className="field-help">Repeats monthly on this day; shorter months use the last day.</small></label>
      </div></div>
      <footer><div>{(!editing || dirty) && <button className="primary" type="button" disabled={readOnly || !draft.name.trim() || Boolean(invalidInterestDate)} onClick={onSave}>{editing ? "Save account" : "Add debt"}</button>}<button className="secondary" type="button" onClick={() => setAdvanced(true)}>Advanced</button></div></footer></fieldset>
      {advanced && <ExperienceOverlay title="Advanced" onBack={() => setAdvanced(false)}><fieldset className="advanced-info-content" disabled={readOnly}>        <div className="form-grid">
        <div><Field label="Actual interest fee" disabled={draft.interestAutomation?.enabled} prefix={symbol} value={draft.interestFee} placeholder="Optional" step=".01" onChange={(interestFee) => onChange({ ...draft, interestFee })}/><small className="field-help">Leave blank to estimate from balance x APR / 12.</small></div>

        {isCreditCard && <CostcoInterestSettings apr={draft.apr} value={draft.interestAutomation} onChange={interestAutomation => onChange({ ...draft, interestAutomation })}/>}
        {editing && isCreditCard && <fieldset className="wide"><legend>Record actual interest — optional</legend><label>Amount<input type="number" min="0" step="0.01" value={draft.actualInterest?.amount ?? ""} onChange={event => onChange({ ...draft, actualInterest: event.target.value === "" ? undefined : { amount: Number(event.target.value), date: draft.actualInterest?.date ?? householdDate() } })}/></label>{draft.actualInterest && <label>Statement closing date<input type="date" max={householdDate()} value={draft.actualInterest.date} onChange={event => onChange({ ...draft, actualInterest: { amount: draft.actualInterest!.amount, date: event.target.value } })}/></label>}</fieldset>}
        {invalidInterestDate && <p className="form-error wide" role="alert">Enter a valid APR and included closing date, no later than today.</p>}
        {isCreditCard && <div className="wide promo-editor">
          <div><span>0% promotional period</span><small>Optional. These terms drive the payoff forecast after the promotion ends.</small></div>
          <div className="promo-fields">
            <label><span>Promotion ends</span><input type="date" value={draft.promoEndDate} onChange={(event) => onChange({ ...draft, promoEndDate: event.target.value })}/></label>
            <Field label="APR after promotion" suffix="%" value={draft.postPromoApr} placeholder="0.00" step=".01" onChange={(postPromoApr) => onChange({ ...draft, postPromoApr })}/>
            <Field label="Actual minimum after promotion" prefix={symbol} value={draft.postPromoMinimum} placeholder="Keep current" step=".01" onChange={(postPromoMinimum) => onChange({ ...draft, postPromoMinimum })}/>
          </div>
          <small className="promo-help">If the future minimum is unknown, DebtFree keeps today&apos;s minimum instead of inventing a higher payment. Update it when the issuer confirms the amount.</small>
        </div>}
        <Field label="Credit limit" prefix={symbol} value={draft.creditLimit} placeholder="Optional" onChange={(creditLimit) => onChange({ ...draft, creditLimit })}/>

        </div><div className="advanced-account-actions">{editing && <><button className="secondary" type="button" onClick={() => onChange({...draft, payoffMode:draft.payoffMode === "minimum-only" ? "priority" : "minimum-only"})}>{draft.payoffMode === "minimum-only" ? "Include extra payments" : "Pay minimum only"}</button><button className="secondary" type="button" onClick={onMarkPaidOff}>Mark paid off</button><button className="secondary" type="button" disabled={draft.balance > 0} onClick={onArchive}>Archive debt</button><p>Permanently deleting removes debt details. Existing history and snapshots are retained.</p><button className="danger" type="button" onClick={onRemove}>Permanently delete debt account</button></>}{(!editing || dirty) && <button type="button" className="primary" disabled={readOnly || !draft.name.trim() || Boolean(invalidInterestDate)} onClick={onSave}>{editing ? "Save account" : "Add debt"}</button>}</div></fieldset></ExperienceOverlay>}
    </section>
  </div>;
}
function Field({ label, prefix, suffix, value, placeholder, step, disabled, autoFocus, onChange }: { label?: string; prefix?: string; suffix?: string; value: number; placeholder: string; step?: string; disabled?: boolean; autoFocus?: boolean; onChange: (value: number) => void }) { return <label>{label && <span>{label}</span>}<div className="field-input">{prefix && <b>{prefix}</b>}<input type="number" min="0" step={step} inputMode="decimal" disabled={disabled} autoFocus={autoFocus} value={value || ""} placeholder={placeholder} onChange={(event) => onChange(number(event.target.value))}/>{suffix && <b>{suffix}</b>}</div></label>; }
