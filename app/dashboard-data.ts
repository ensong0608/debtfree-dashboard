import { validOptionalInstitution, type InstitutionKey } from "./institutions.ts";
import { householdMonthOffset } from "./household-date.ts";
import { validDisplayName, type DebtGroup } from "./debt-groups.ts";
import { validatePaymentLinks } from "./payment-overlap.ts";
import type { LoanTracker } from "./loan-progress.ts";
import { validDate, closingDate, type InterestAutomation, type InterestEstimate } from "./interest-accrual.ts";
export const DASHBOARD_BACKUP_FORMAT = "debtfree-dashboard-backup" as const;
export const LEGACY_DASHBOARD_DATA_VERSION = 1 as const;
export const PLANNING_DASHBOARD_DATA_VERSION = 2 as const;
export const AUDIT_DASHBOARD_DATA_VERSION = 3 as const;
export const MONTHLY_PLAN_DASHBOARD_DATA_VERSION = 4 as const;
export const DASHBOARD_DATA_VERSION = 6 as const;

export type DebtType = "Credit card" | "Personal loan" | "Auto loan" | "Student loan" | "Medical debt" | "Other";
export type MinimumMode = "auto" | "manual";
export type PayoffMode = "priority" | "minimum-only";
export type PayoffStrategy = "avalanche" | "snowball" | "custom";
export type CashflowKind = "income" | "expense" | "purchase" | "budget";
export type PaymentMethod = "debit" | "credit";
export type TransactionType = "charge" | "payment" | "fee";
export type PaymentKind = "minimum" | "extra" | "combined";
export type PlannedAssignment = "household" | "partner-1" | "partner-2";
export type PayoffCapacityMethod = "known" | "calculated";

export type OwnershipMetadata = {
  householdId?: string;
  memberId?: string;
  createdBy?: string;
  updatedBy?: string;
};

export type BalanceReconciliation = {
  adjustmentId: string;
  accountId?: string;
  previousAdjustmentId?: string;
  balance: number;
  date: string;
  createdAt: string;
  offset: number;
  coveredTransactionIds?: string[];
  previous?: BalanceReconciliation;
};

export type DebtAccount = OwnershipMetadata & {
  institutionKey?: InstitutionKey;
  id: string;
  name: string;
  type: DebtType;
  balance: number;
  balanceOffset?: number;
  reconciliation?: BalanceReconciliation;
  baselineBalance?: number;
  apr: number;
  interestFee: number;
  interestAutomation?: InterestAutomation;
  minimum: number;
  minimumMode: MinimumMode;
  payoffMode: PayoffMode;
  creditLimit: number;
  dueDate: string;
  promoEndDate: string;
  postPromoApr: number;
  postPromoMinimum: number;
  createdAt: string;
  archivedAt?: string | null;
  archiveHistory?: DebtArchiveEvent[];
  customOrder?: number;
  displayGroup?: string;
  displayOrder?: number;
  householdMember?: PlannedAssignment;
  [key: string]: unknown;
};

export type DebtAuditCreator = {
  email?: string;
  displayName?: string;
};

export type DebtArchiveEvent = {
  id: string;
  action: "archived" | "restored";
  createdAt: string;
  creator?: DebtAuditCreator;
};

export type CashflowItem = OwnershipMetadata & {
  id: string;
  name: string;
  kind: CashflowKind;
  category: string;
  amount: number;
  paymentMethod: PaymentMethod;
  creditAccountId: string;
  createdAt: string;
  recurring?: boolean;
  dueDay?: number;
  [key: string]: unknown;
};

export type Payee = OwnershipMetadata & {
  id: string;
  name: string;
  createdAt: string;
  deletedAt: string | null;
  [key: string]: unknown;
};

export type LedgerTransaction = OwnershipMetadata & {
  id: string;
  date: string;
  accountId: string;
  payeeId: string;
  payeeName: string;
  type: TransactionType;
  category: string;
  memo: string;
  title?: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  reductionKind?: "credit" | "adjustment";
  includedIn?: { type: "adjustment" | "transaction"; id: string };
  deletedWithSource?: string;
  debtAction?: "payment" | "mark-paid-off";
  balanceBefore?: number;
  balanceAfter?: number;
  creator?: DebtAuditCreator;
  plannedItemId?: string;
  paymentKind?: PaymentKind;
  replacesTransactionId?: string;
  interestEstimate?: InterestEstimate;
  replacedByTransactionId?: string;
  [key: string]: unknown;
};

export type BalanceAdjustment = OwnershipMetadata & {
  reconciliationAnchor?: BalanceReconciliation;
  id: string;
  accountId: string;
  date: string;
  balanceBefore: number;
  balanceAfter: number;
  difference: number;
  createdAt: string;
  note?: string;
  title?: string;
  creator?: DebtAuditCreator;
  reportKind?: "purchase" | "interest" | "fee" | "credit";
  confirmedPayment?: { confirmedAt: string; creator?: DebtAuditCreator };
  deletedAt?: string | null;
  updatedAt?: string;
  [key: string]: unknown;
};

export type SnapshotAccount = {
  accountId: string;
  name: string;
  type: DebtType;
  balance: number;
  apr: number;
  [key: string]: unknown;
};

export type PayoffSnapshot = OwnershipMetadata & {
  autoCheckpoint?: string;
  loanBalances?: { loanId: string; amount: number; balanceKind: "principal" | "payoff" }[];
  id: string;
  month: string;
  capturedAt: string;
  totalBalance: number;
  monthlyInterest: number;
  activeAccountCount: number;
  projectedDebtFreeMonth: string | null;
  note: string;
  accounts: SnapshotAccount[];
  [key: string]: unknown;
};

export type PlannedIncomeSource = OwnershipMetadata & {
  id: string;
  name: string;
  monthlyTakeHome: number;
  payFrequency?: "monthly" | "biweekly" | "weekly";
  payAmount?: number;
  assignment: PlannedAssignment;
  [key: string]: unknown;
};

export type PlannedDebt = OwnershipMetadata & {
  trackerKind?: "house" | "car";
  originalLoanAmount?: number;
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimum: number;
  dueDate: string;
  creditLimit: number;
  promoEndDate: string;
  postPromoApr: number;
  postPromoMinimum: number;
  type: DebtType;
  assignment: PlannedAssignment;
  payoffMode: PayoffMode;
  [key: string]: unknown;
};

export type PlannedEssentialExpenses = {
  housing: number;
  utilities: number;
  food: number;
  transportation: number;
  insurance: number;
  subscriptions: number;
  otherObligations: number;
  safetyBuffer: number;
  [key: string]: unknown;
};

export type PlannedPayoffData = {
  onboarding: {
    completed: boolean;
    currentStep: number;
    completedAt: string | null;
    [key: string]: unknown;
  };
  incomeSources: PlannedIncomeSource[];
  debts: PlannedDebt[];
  essentialExpenses: PlannedEssentialExpenses;
  capacity: {
    method: PayoffCapacityMethod;
    monthlyAmount: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type DashboardPayloadV1 = {
  accounts: DebtAccount[];
  monthlyBudgets: Record<string, CashflowItem[]>;
  payees: Payee[];
  transactions: LedgerTransaction[];
  snapshots: PayoffSnapshot[];
  extra: number;
  strategy: PayoffStrategy;
  [key: string]: unknown;
};

export type DashboardPayloadV2 = DashboardPayloadV1 & {
  planning: PlannedPayoffData;
};

export type DashboardPayloadV3 = DashboardPayloadV2 & {
  balanceAdjustments?: BalanceAdjustment[];
};

export type PlanSettlement = { automatic?: boolean; id: string; targetId: string; name: string; kind: "spending" | "minimum"; amount: number; date: string; createdAt: string; source: "debit" | "included" };

export type MonthlyPlanMonth = {
  skippedRecurringPayments?: string[];
  settlements?: PlanSettlement[];
  payments?: Record<string, number>;
  minimums?: Record<string, number>;
  safetyBuffer: number;
  debtPaymentTarget: number;
  [key: string]: unknown;
};

export type RemovedProgressAccount = Pick<DebtAccount, "id" | "name" | "balance" | "baselineBalance" | "displayGroup" | "displayOrder"> & { removedAt: string };

export type MonthlyPlanSettings = {
  currency?: import('./household-currency').HouseholdCurrency;
  debtGroups?: DebtGroup[];
  payoffPlanAmount?: number;
  payoffExtraPayment?: number;
  payoffExcludedTypes?: string[];
  payoffPlanStrategy?: PayoffStrategy;
  payoffPlanOrder?: string[];
  removedProgressAccounts?: RemovedProgressAccount[];
  loanTrackers?: LoanTracker[];
  monthlyCommitment?: number;
  calculatorAmount?: number;
  progressStartingBalance?: number;
  detailedSpendingTracking: boolean;
  months: Record<string, MonthlyPlanMonth>;
  [key: string]: unknown;
};

export type DashboardPayloadV4 = DashboardPayloadV3 & {
  monthlyPlan?: MonthlyPlanSettings;
};

export type DashboardPayload = DashboardPayloadV4 & {
  customDebtOrder?: string[];
};

export type DashboardBackupV1 = {
  format: typeof DASHBOARD_BACKUP_FORMAT;
  version: typeof LEGACY_DASHBOARD_DATA_VERSION;
  exportedAt: string;
  payload: DashboardPayloadV1;
  [key: string]: unknown;
};

export type DashboardBackupV2 = {
  format: typeof DASHBOARD_BACKUP_FORMAT;
  version: typeof PLANNING_DASHBOARD_DATA_VERSION;
  exportedAt: string;
  payload: DashboardPayloadV2;
  [key: string]: unknown;
};

export type DashboardBackupV3 = {
  format: typeof DASHBOARD_BACKUP_FORMAT;
  version: typeof AUDIT_DASHBOARD_DATA_VERSION;
  exportedAt: string;
  payload: DashboardPayloadV3;
  [key: string]: unknown;
};

export type DashboardBackupV4 = {
  format: typeof DASHBOARD_BACKUP_FORMAT;
  version: typeof MONTHLY_PLAN_DASHBOARD_DATA_VERSION;
  exportedAt: string;
  payload: DashboardPayloadV4;
  [key: string]: unknown;
};

export type DashboardBackup = {
  format: typeof DASHBOARD_BACKUP_FORMAT;
  version: typeof DASHBOARD_DATA_VERSION;
  exportedAt: string;
  payload: DashboardPayload;
  [key: string]: unknown;
};

type UnknownRecord = Record<string, unknown>;

export function createEmptyPlannedPayoff(): PlannedPayoffData {
  return {
    onboarding: { completed: false, currentStep: 1, completedAt: null },
    incomeSources: [],
    debts: [],
    essentialExpenses: {
      housing: 0,
      utilities: 0,
      food: 0,
      transportation: 0,
      insurance: 0,
      subscriptions: 0,
      otherObligations: 0,
      safetyBuffer: 0,
    },
    capacity: { method: "known", monthlyAmount: 0 },
  };
}

export class DashboardDataError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    const [first = "Dashboard data is invalid."] = issues;
    super(issues.length > 1 ? `${first} (${issues.length - 1} more validation ${issues.length === 2 ? "error" : "errors"}.)` : first);
    this.name = "DashboardDataError";
    this.issues = issues;
  }
}

const debtTypes = new Set<DebtType>(["Credit card", "Personal loan", "Auto loan", "Student loan", "Medical debt", "Other"]);
const minimumModes = new Set<MinimumMode>(["auto", "manual"]);
const payoffModes = new Set<PayoffMode>(["priority", "minimum-only"]);
const cashflowKinds = new Set<CashflowKind>(["income", "expense", "purchase", "budget"]);
const paymentMethods = new Set<PaymentMethod>(["debit", "credit"]);
const transactionTypes = new Set<TransactionType>(["charge", "payment", "fee"]);
const paymentKinds = new Set<PaymentKind>(["minimum", "extra", "combined"]);
const strategies = new Set<PayoffStrategy>(["avalanche", "snowball", "custom"]);

const plannedAssignments = new Set<PlannedAssignment>(["household", "partner-1", "partner-2"]);
const capacityMethods = new Set<PayoffCapacityMethod>(["known", "calculated"]);
function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value: UnknownRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function withDefault(value: UnknownRecord, key: string, fallback: unknown) {
  return hasOwn(value, key) ? value[key] : fallback;
}

function migrateAccount(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...value,
    interestFee: withDefault(value, "interestFee", 0),
    payoffMode: withDefault(value, "payoffMode", "priority"),
    promoEndDate: withDefault(value, "promoEndDate", ""),
    postPromoApr: withDefault(value, "postPromoApr", 0),
    postPromoMinimum: withDefault(value, "postPromoMinimum", 0),
  };
}

function migrateCashflow(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...value,
    paymentMethod: withDefault(value, "paymentMethod", "debit"),
    creditAccountId: withDefault(value, "creditAccountId", ""),
  };
}

function migratePayee(value: unknown) {
  if (!isRecord(value)) return value;
  return { ...value, deletedAt: withDefault(value, "deletedAt", null) };
}

function migrateTransaction(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...value,
    payeeId: withDefault(value, "payeeId", ""),
    payeeName: withDefault(value, "payeeName", ""),
    category: withDefault(value, "category", "Other"),
    memo: withDefault(value, "memo", ""),
    updatedAt: withDefault(value, "updatedAt", value.createdAt),
    deletedAt: withDefault(value, "deletedAt", null),
  };
}

function migrateBalanceAdjustment(value: unknown) {
  return isRecord(value) ? { ...value } : value;
}

function migrateSnapshotAccount(value: unknown) {
  return isRecord(value) ? { ...value } : value;
}

function migrateSnapshot(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...value,
    monthlyInterest: withDefault(value, "monthlyInterest", 0),
    projectedDebtFreeMonth: withDefault(value, "projectedDebtFreeMonth", null),
    note: withDefault(value, "note", ""),
    accounts: Array.isArray(value.accounts) ? value.accounts.map(migrateSnapshotAccount) : value.accounts,
  };
}

function migratePlannedDebt(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...value,
    dueDate: withDefault(value, "dueDate", ""),
    creditLimit: withDefault(value, "creditLimit", 0),
    promoEndDate: withDefault(value, "promoEndDate", ""),
    postPromoApr: withDefault(value, "postPromoApr", 0),
    postPromoMinimum: withDefault(value, "postPromoMinimum", 0),
    type: withDefault(value, "type", "Credit card"),
    assignment: withDefault(value, "assignment", "household"),
    payoffMode: withDefault(value, "payoffMode", "priority"),
  };
}

function migratePlanning(value: unknown): unknown {
  const defaults = createEmptyPlannedPayoff();
  if (!isRecord(value)) return defaults;
  const onboarding = isRecord(value.onboarding) ? {
    ...value.onboarding,
    completed: withDefault(value.onboarding, "completed", false),
    currentStep: withDefault(value.onboarding, "currentStep", 1),
    completedAt: withDefault(value.onboarding, "completedAt", null),
  } : defaults.onboarding;
  const expenses = isRecord(value.essentialExpenses) ? {
    ...value.essentialExpenses,
    ...Object.fromEntries(Object.entries(defaults.essentialExpenses).map(([key, fallback]) => [key, withDefault(value.essentialExpenses as UnknownRecord, key, fallback)])),
  } : defaults.essentialExpenses;
  const capacity = isRecord(value.capacity) ? {
    ...value.capacity,
    method: withDefault(value.capacity, "method", "known"),
    monthlyAmount: withDefault(value.capacity, "monthlyAmount", 0),
  } : defaults.capacity;
  return {
    ...value,
    onboarding,
    incomeSources: Array.isArray(value.incomeSources) ? value.incomeSources.map((item) => isRecord(item) ? {
      ...item,
      assignment: withDefault(item, "assignment", "household"),
    } : item) : [],
    debts: Array.isArray(value.debts) ? value.debts.map(migratePlannedDebt) : [],
    essentialExpenses: expenses,
    capacity,
  };
}

function migratePayloadFields(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const legacyCashflow = Array.isArray(value.cashflowItems)
    ? { [householdMonthOffset(0)]: value.cashflowItems.map(migrateCashflow) }
    : {};
  const monthlySource = hasOwn(value, "monthlyBudgets") ? value.monthlyBudgets : legacyCashflow;
  const monthlyBudgets = isRecord(monthlySource)
    ? Object.fromEntries(Object.entries(monthlySource).map(([month, items]) => [month, Array.isArray(items) ? items.map(migrateCashflow) : items]))
    : monthlySource;
  return {
    ...value,
    accounts: Array.isArray(value.accounts) ? value.accounts.map(migrateAccount) : withDefault(value, "accounts", []),
    monthlyBudgets,
    payees: Array.isArray(value.payees) ? value.payees.map(migratePayee) : withDefault(value, "payees", []),
    transactions: Array.isArray(value.transactions) ? value.transactions.map(migrateTransaction) : withDefault(value, "transactions", []),
    snapshots: Array.isArray(value.snapshots) ? value.snapshots.map(migrateSnapshot) : withDefault(value, "snapshots", []),
    extra: withDefault(value, "extra", 0),
    strategy: withDefault(value, "strategy", "avalanche"),
  };
}

function migratePayloadV1ToV2(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return { ...value, planning: migratePlanning(value.planning) };
}

function migratePayloadV2ToV3(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return {
    ...value,
    balanceAdjustments: Array.isArray(value.balanceAdjustments)
      ? value.balanceAdjustments.map(migrateBalanceAdjustment)
      : [],
  };
}

function migratePayloadV3ToV4(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const existing = isRecord(value.monthlyPlan) ? value.monthlyPlan : {};
  const monthlyBudgets = isRecord(value.monthlyBudgets)
    ? Object.fromEntries(Object.entries(value.monthlyBudgets).map(([month, items]) => [month, Array.isArray(items) ? items.map((item) => isRecord(item) ? { ...item, recurring: withDefault(item, "recurring", item.kind !== "purchase") } : item) : items]))
    : value.monthlyBudgets;
  const meaningfulAdvancedData = (Array.isArray(value.transactions) && value.transactions.length > 0)
    || (Array.isArray(value.payees) && value.payees.length > 0);
  const months = isRecord(existing.months) ? Object.fromEntries(Object.entries(existing.months).map(([month, settings]) => {
    const record = isRecord(settings) ? settings : {};
    return [month, {
      ...record,
      safetyBuffer: withDefault(record, "safetyBuffer", 0),
      debtPaymentTarget: withDefault(record, "debtPaymentTarget", 0),
    }];
  })) : {};
  return {
    ...value,
    monthlyBudgets,
    monthlyPlan: {
      ...existing,
      detailedSpendingTracking: withDefault(existing, "detailedSpendingTracking", meaningfulAdvancedData),
      months,
    },
  };
}
function migratePayloadV4ToV5(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const accounts = Array.isArray(value.accounts) ? value.accounts : [];
  const accountIds = new Set(accounts.filter(isRecord).map((account) => String(account.id)));
  const saved = Array.isArray(value.customDebtOrder) ? value.customDebtOrder.filter((id): id is string => typeof id === "string") : [];
  const seen = new Set<string>();
  const customDebtOrder = saved.filter((id) => accountIds.has(id) && !seen.has(id) && Boolean(seen.add(id)));
  const missing = accounts
    .map((account, index) => ({ account, index }))
    .filter((entry): entry is { account: UnknownRecord; index: number } => isRecord(entry.account) && typeof entry.account.id === "string" && !seen.has(entry.account.id))
    .sort((a, b) => {
      const first = typeof a.account.customOrder === "number" ? a.account.customOrder : Number.MAX_SAFE_INTEGER;
      const second = typeof b.account.customOrder === "number" ? b.account.customOrder : Number.MAX_SAFE_INTEGER;
      return first - second || a.index - b.index || String(a.account.id).localeCompare(String(b.account.id));
    });
  missing.forEach(({ account }) => {
    const id = String(account.id);
    if (!seen.has(id)) {
      seen.add(id);
      customDebtOrder.push(id);
    }
  });
  return { ...value, customDebtOrder };
}
function requiredRecord(value: unknown, path: string, issues: string[]): UnknownRecord | null {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`);
    return null;
  }
  return value;
}

function requiredArray(value: unknown, path: string, issues: string[]): unknown[] | null {
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array.`);
    return null;
  }
  return value;
}

function requiredString(value: unknown, path: string, issues: string[], allowEmpty = false) {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) issues.push(`${path} must be ${allowEmpty ? "a string" : "a non-empty string"}.`);
}

function nullableString(value: unknown, path: string, issues: string[]) {
  if (value !== null && typeof value !== "string") issues.push(`${path} must be a string or null.`);
}

function requiredNumber(value: unknown, path: string, issues: string[], integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push(`${path} must be a finite number.`);
    return;
  }
  if (/\.(balance|balanceBefore|balanceAfter|baselineBalance|amount|minimum|interestFee|creditLimit|postPromoMinimum|monthlyTakeHome)$/.test(path) && Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) issues.push(`${path} must have at most two decimal places.`);
  if (/\.(apr|postPromoApr)$/.test(path) && value > 100) issues.push(`${path} must be at most 100.`);
  if (value < 0) issues.push(`${path} must be zero or greater.`);
  if (!Number.isSafeInteger(Math.round(value * 100))) issues.push(`${path} exceeds the supported numeric range.`);
  if (integer && !Number.isInteger(value)) issues.push(`${path} must be a whole number.`);
}
function requiredBoolean(value: unknown, path: string, issues: string[]) {
  if (typeof value !== "boolean") issues.push(path + " must be true or false.");
}


function enumValue<T extends string>(value: unknown, allowed: Set<T>, path: string, issues: string[]) {
  if (typeof value !== "string" || !allowed.has(value as T)) issues.push(`${path} must be one of: ${[...allowed].join(", ")}.`);
}


function validateCreator(value: unknown, path: string, issues: string[]) {
  const creator = requiredRecord(value, path, issues);
  if (!creator) return;
  if (hasOwn(creator, "email")) requiredString(creator.email, path + ".email", issues, true);
  if (hasOwn(creator, "displayName")) requiredString(creator.displayName, path + ".displayName", issues, true);
}

function validateArchiveEvent(value: unknown, path: string, issues: string[]) {
  const event = requiredRecord(value, path, issues);
  if (!event) return;
  requiredString(event.id, path + ".id", issues);
  enumValue(event.action, new Set(["archived", "restored"]), path + ".action", issues);
  requiredString(event.createdAt, path + ".createdAt", issues);
  if (hasOwn(event, "creator")) validateCreator(event.creator, path + ".creator", issues);
}
function validateReconciliation(value: unknown, path: string, issues: string[], depth = 0) {
  if (depth > 100) { issues.push(path + " contains too many reconciliation revisions."); return; }
  const item = requiredRecord(value, path, issues);
  if (!item) return;
  requiredString(item.adjustmentId, path + ".adjustmentId", issues);
  if (item.accountId !== undefined) requiredString(item.accountId, path + ".accountId", issues);
  if (item.previousAdjustmentId !== undefined) requiredString(item.previousAdjustmentId, path + ".previousAdjustmentId", issues);
  requiredNumber(item.balance, path + ".balance", issues);
  if (typeof item.date !== "string" || !validDate(item.date)) issues.push(path + ".date must be a valid date.");
  if (typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt))) issues.push(path + ".createdAt must be a valid timestamp.");
  if (typeof item.offset !== "number" || !Number.isFinite(item.offset) || !Number.isSafeInteger(Math.round(item.offset * 100))) issues.push(path + ".offset must be a supported finite amount.");
  if (item.coveredTransactionIds !== undefined && (!Array.isArray(item.coveredTransactionIds) || item.coveredTransactionIds.some(id => typeof id !== "string"))) issues.push(path + ".coveredTransactionIds must contain IDs.");
  if (item.previous !== undefined) validateReconciliation(item.previous, path + ".previous", issues, depth + 1);
}

function validateAccount(value: unknown, path: string, issues: string[]) {
  const item = requiredRecord(value, path, issues);
  if (!item) return;
  requiredString(item.id, `${path}.id`, issues);
  requiredString(item.name, `${path}.name`, issues);
  if (!validOptionalInstitution(item.institutionKey)) issues.push(`${path}.institutionKey must be a catalog key.`);
  enumValue(item.type, debtTypes, `${path}.type`, issues);
  requiredNumber(item.balance, `${path}.balance`, issues);
  if (item.reconciliation !== undefined) validateReconciliation(item.reconciliation, path + ".reconciliation", issues);
  if (item.balanceOffset !== undefined && (typeof item.balanceOffset !== "number" || !Number.isFinite(item.balanceOffset))) issues.push(`${path}.balanceOffset must be finite.`);
  if (item.baselineBalance !== undefined) requiredNumber(item.baselineBalance, `${path}.baselineBalance`, issues);
  requiredNumber(item.apr, `${path}.apr`, issues);
  requiredNumber(item.interestFee, `${path}.interestFee`, issues);
  if (hasOwn(item, "interestAutomation")) {
    const config = requiredRecord(item.interestAutomation, path + ".interestAutomation", issues);
    if (config) {
      requiredBoolean(config.enabled, path + ".interestAutomation.enabled", issues);
      if (config.closingDay !== undefined && (typeof config.closingDay !== "number" || !Number.isInteger(config.closingDay) || config.closingDay < 1 || config.closingDay > 31)) issues.push(path + ".interestAutomation.closingDay must be 1–31.");
      if (typeof config.coveredThrough !== "string" || !validDate(config.coveredThrough) || config.coveredThrough !== closingDate(String(config.coveredThrough).slice(0, 7), typeof config.closingDay === "number" ? config.closingDay : 2)) issues.push(path + ".interestAutomation.coveredThrough must be a valid closing date and configuration.");
      if (typeof config.estimatedApr !== "number" || !Number.isFinite(config.estimatedApr) || config.estimatedApr < 0 || config.enabled === true && config.estimatedApr === 0 || config.estimatedApr > 100) issues.push(path + ".interestAutomation.estimatedApr must be greater than 0 and at most 100.");
    }
  }
  requiredNumber(item.minimum, `${path}.minimum`, issues);
  enumValue(item.minimumMode, minimumModes, `${path}.minimumMode`, issues);
  enumValue(item.payoffMode, payoffModes, `${path}.payoffMode`, issues);
  requiredNumber(item.creditLimit, `${path}.creditLimit`, issues);
  requiredString(item.dueDate, `${path}.dueDate`, issues, true);
  requiredString(item.promoEndDate, `${path}.promoEndDate`, issues, true);
  requiredNumber(item.postPromoApr, `${path}.postPromoApr`, issues);
  requiredNumber(item.postPromoMinimum, `${path}.postPromoMinimum`, issues);
  requiredString(item.createdAt, `${path}.createdAt`, issues);
  if (hasOwn(item, "archivedAt")) nullableString(item.archivedAt, `${path}.archivedAt`, issues);
  if (hasOwn(item, "displayGroup")) requiredString(item.displayGroup, `${path}.displayGroup`, issues);
  if (hasOwn(item, "displayOrder")) requiredNumber(item.displayOrder, `${path}.displayOrder`, issues, true);
  if (hasOwn(item, "customOrder")) requiredNumber(item.customOrder, `${path}.customOrder`, issues, true);
  if (hasOwn(item, "householdMember")) enumValue(item.householdMember, plannedAssignments, path + ".householdMember", issues);
  if (hasOwn(item, "archiveHistory")) {
    const history = requiredArray(item.archiveHistory, path + ".archiveHistory", issues);
    history?.forEach((entry, index) => validateArchiveEvent(entry, path + ".archiveHistory[" + index + "]", issues));
  }
}

function validateCashflow(value: unknown, path: string, issues: string[]) {
  const item = requiredRecord(value, path, issues);
  if (!item) return;
  requiredString(item.id, `${path}.id`, issues);
  requiredString(item.name, `${path}.name`, issues);
  enumValue(item.kind, cashflowKinds, `${path}.kind`, issues);
  requiredString(item.category, `${path}.category`, issues);
  requiredNumber(item.amount, `${path}.amount`, issues);
  enumValue(item.paymentMethod, paymentMethods, `${path}.paymentMethod`, issues);
  requiredString(item.creditAccountId, `${path}.creditAccountId`, issues, true);
  requiredString(item.createdAt, `${path}.createdAt`, issues);
  if (hasOwn(item, "recurring")) requiredBoolean(item.recurring, `${path}.recurring`, issues);
  if (item.dueDay !== undefined && (!Number.isInteger(item.dueDay) || Number(item.dueDay) < 1 || Number(item.dueDay) > 31)) issues.push(`${path}.dueDay must be a day from 1 to 31.`);
}

function validatePayee(value: unknown, path: string, issues: string[]) {
  const item = requiredRecord(value, path, issues);
  if (!item) return;
  requiredString(item.id, `${path}.id`, issues);
  requiredString(item.name, `${path}.name`, issues);
  requiredString(item.createdAt, `${path}.createdAt`, issues);
  nullableString(item.deletedAt, `${path}.deletedAt`, issues);
}

function validateTransaction(value: unknown, path: string, issues: string[]) {
  const item = requiredRecord(value, path, issues);
  if (!item) return;
  requiredString(item.id, `${path}.id`, issues);
  requiredString(item.date, `${path}.date`, issues);
  if (hasOwn(item, "credit")) requiredBoolean(item.credit, `${path}.credit`, issues);
  if(hasOwn(item,"reductionKind")) enumValue(item.reductionKind,new Set(["credit","adjustment"]),path+".reductionKind",issues);
  if (hasOwn(item, "includedIn")) {
    const link = requiredRecord(item.includedIn, path + ".includedIn", issues);
    if (link) { enumValue(link.type, new Set(["adjustment", "transaction"]), path + ".includedIn.type", issues); requiredString(link.id, path + ".includedIn.id", issues); }
  }
  requiredString(item.accountId, `${path}.accountId`, issues);
  requiredString(item.payeeId, `${path}.payeeId`, issues, true);
  requiredString(item.payeeName, `${path}.payeeName`, issues, true);
  enumValue(item.type, transactionTypes, `${path}.type`, issues);
  if (hasOwn(item, "interestEstimate")) {
    const estimate = requiredRecord(item.interestEstimate, path + ".interestEstimate", issues);
    if (estimate) {
      for (const key of ["cycle", "periodStart"]) if (typeof estimate[key] !== "string" || !validDate(estimate[key] as string)) issues.push(path + ".interestEstimate." + key + " must be a valid date.");
      requiredNumber(estimate.days, path + ".interestEstimate.days", issues, true);
      requiredNumber(estimate.estimatedApr, path + ".interestEstimate.estimatedApr", issues);
      if (item.type !== "fee" || item.date !== estimate.cycle || typeof estimate.cycle !== "string" || item.id !== "interest:" + item.accountId + ":" + estimate.cycle.slice(0, 7)) issues.push(path + ".interestEstimate requires a unique monthly interest fee.");
      if (hasOwn(estimate, "reconciledAt")) requiredString(estimate.reconciledAt, path + ".interestEstimate.reconciledAt", issues);
    }
  }
  requiredString(item.category, `${path}.category`, issues);
  requiredString(item.memo, `${path}.memo`, issues, true);
  requiredNumber(item.amount, `${path}.amount`, issues);
  if (hasOwn(item, "title")) requiredString(item.title, path + ".title", issues, true);
  requiredString(item.createdAt, `${path}.createdAt`, issues);
  requiredString(item.updatedAt, `${path}.updatedAt`, issues);
  nullableString(item.deletedAt, `${path}.deletedAt`, issues);
  if (hasOwn(item, "debtAction")) enumValue(item.debtAction, new Set(["payment", "mark-paid-off"]), path + ".debtAction", issues);
  if (hasOwn(item, "balanceBefore")) requiredNumber(item.balanceBefore, path + ".balanceBefore", issues);
  if (hasOwn(item, "balanceAfter")) requiredNumber(item.balanceAfter, path + ".balanceAfter", issues);
  if (hasOwn(item, "creator")) validateCreator(item.creator, path + ".creator", issues);
  if (hasOwn(item, "plannedItemId")) requiredString(item.plannedItemId, path + ".plannedItemId", issues, true);
  if (hasOwn(item, "paymentKind")) enumValue(item.paymentKind, paymentKinds, path + ".paymentKind", issues);
  if (hasOwn(item, "replacesTransactionId")) requiredString(item.replacesTransactionId, path + ".replacesTransactionId", issues);
  if (hasOwn(item, "replacedByTransactionId")) requiredString(item.replacedByTransactionId, path + ".replacedByTransactionId", issues);
}


function validateBalanceAdjustment(value: unknown, path: string, issues: string[]) {
  const item = requiredRecord(value, path, issues);
  if (!item) return;
  if (item.reconciliationAnchor !== undefined) validateReconciliation(item.reconciliationAnchor, path + ".reconciliationAnchor", issues);
  requiredString(item.id, path + ".id", issues);
  requiredString(item.accountId, path + ".accountId", issues);
  requiredString(item.date, path + ".date", issues);
  requiredNumber(item.balanceBefore, path + ".balanceBefore", issues);
  requiredNumber(item.balanceAfter, path + ".balanceAfter", issues);
  if (typeof item.difference !== "number" || !Number.isFinite(item.difference)) issues.push(path + ".difference must be a finite number.");
  requiredString(item.createdAt, path + ".createdAt", issues);
  if (hasOwn(item, "deletedAt")) nullableString(item.deletedAt, path + ".deletedAt", issues);
  if (hasOwn(item, "updatedAt")) requiredString(item.updatedAt, path + ".updatedAt", issues);
  if (hasOwn(item, "title")) requiredString(item.title, path + ".title", issues, true);
  if (hasOwn(item, "note")) requiredString(item.note, path + ".note", issues, true);
  if (hasOwn(item, "creator")) validateCreator(item.creator, path + ".creator", issues);
  if (hasOwn(item, "reportKind")) {
    enumValue(item.reportKind, new Set(["purchase", "interest", "fee", "credit"]), path + ".reportKind", issues);
    if (item.reportKind === "credit" ? !(Number(item.difference) < 0) : !(Number(item.difference) > 0)) issues.push(path + ".reportKind does not match the balance direction.");
    if (hasOwn(item, "confirmedPayment")) issues.push(path + ".reportKind cannot also be a payment.");
  }
  if (hasOwn(item, "confirmedPayment")) {
    const confirmation = requiredRecord(item.confirmedPayment, path + ".confirmedPayment", issues);
    if (confirmation) {
      requiredString(confirmation.confirmedAt, path + ".confirmedPayment.confirmedAt", issues);
      if (hasOwn(confirmation, "creator")) validateCreator(confirmation.creator, path + ".confirmedPayment.creator", issues);
      if (!(typeof item.difference === "number" && item.difference < 0)) issues.push(path + ".confirmedPayment requires a balance decrease.");
    }
  }
}
function validateSnapshotAccount(value: unknown, path: string, issues: string[]) {
  const item = requiredRecord(value, path, issues);
  if (!item) return;
  requiredString(item.accountId, `${path}.accountId`, issues);
  requiredString(item.name, `${path}.name`, issues);
  enumValue(item.type, debtTypes, `${path}.type`, issues);
  requiredNumber(item.balance, `${path}.balance`, issues);
  requiredNumber(item.apr, `${path}.apr`, issues);
}

function validateSnapshot(value: unknown, path: string, issues: string[]) {
  const item = requiredRecord(value, path, issues);
  if (!item) return;
  requiredString(item.id, `${path}.id`, issues);
  requiredString(item.month, `${path}.month`, issues);
  requiredString(item.capturedAt, `${path}.capturedAt`, issues);
  requiredNumber(item.totalBalance, `${path}.totalBalance`, issues);
  requiredNumber(item.monthlyInterest, `${path}.monthlyInterest`, issues);
  requiredNumber(item.activeAccountCount, `${path}.activeAccountCount`, issues, true);
  nullableString(item.projectedDebtFreeMonth, `${path}.projectedDebtFreeMonth`, issues);
  requiredString(item.note, `${path}.note`, issues, true);
  if (item.autoCheckpoint !== undefined && (typeof item.autoCheckpoint !== 'string' || !validDate(item.autoCheckpoint) || item.autoCheckpoint.slice(0, 7) !== item.month)) issues.push(path + '.autoCheckpoint must belong to its month.');
  if (item.loanBalances !== undefined) requiredArray(item.loanBalances, path + '.loanBalances', issues)?.forEach((raw, index) => {
    const entry = requiredRecord(raw, path + '.loanBalances[' + index + ']', issues);
    if (!entry) return;
    requiredString(entry.loanId, path + '.loanBalances.loanId', issues);
    requiredNumber(entry.amount, path + '.loanBalances.amount', issues);
    enumValue(entry.balanceKind, new Set(['principal', 'payoff']), path + '.loanBalances.balanceKind', issues);
  });
  const accounts = requiredArray(item.accounts, `${path}.accounts`, issues);
  accounts?.forEach((account, index) => validateSnapshotAccount(account, `${path}.accounts[${index}]`, issues));
}

function validatePlannedIncome(value: unknown, path: string, issues: string[]) {
  const item = requiredRecord(value, path, issues);
  if (!item) return;
  requiredString(item.id, path + ".id", issues);
  requiredString(item.name, path + ".name", issues, true);
  requiredNumber(item.monthlyTakeHome, path + ".monthlyTakeHome", issues);
  if (item.payFrequency !== undefined) enumValue(item.payFrequency, new Set(["monthly", "biweekly", "weekly"]), path + ".payFrequency", issues);
  if (item.payAmount !== undefined) requiredNumber(item.payAmount, path + ".payAmount", issues);
  enumValue(item.assignment, plannedAssignments, path + ".assignment", issues);
}

function validatePlannedDebt(value: unknown, path: string, issues: string[]) {
  const item = requiredRecord(value, path, issues);
  if (!item) return;
  if (item.trackerKind !== undefined) enumValue(item.trackerKind, new Set(["house", "car"]), path + ".trackerKind", issues);
  if (item.originalLoanAmount !== undefined) requiredNumber(item.originalLoanAmount, path + ".originalLoanAmount", issues);
  requiredString(item.id, path + ".id", issues);
  requiredString(item.name, path + ".name", issues, true);
  requiredNumber(item.balance, path + ".balance", issues);
  requiredNumber(item.apr, path + ".apr", issues);
  requiredNumber(item.minimum, path + ".minimum", issues);
  requiredString(item.dueDate, path + ".dueDate", issues, true);
  requiredNumber(item.creditLimit, path + ".creditLimit", issues);
  requiredString(item.promoEndDate, path + ".promoEndDate", issues, true);
  requiredNumber(item.postPromoApr, path + ".postPromoApr", issues);
  requiredNumber(item.postPromoMinimum, path + ".postPromoMinimum", issues);
  enumValue(item.type, debtTypes, path + ".type", issues);
  enumValue(item.assignment, plannedAssignments, path + ".assignment", issues);
  enumValue(item.payoffMode, payoffModes, path + ".payoffMode", issues);
}

function validatePlanning(value: unknown, path: string, issues: string[]) {
  const planning = requiredRecord(value, path, issues);
  if (!planning) return;
  const onboarding = requiredRecord(planning.onboarding, path + ".onboarding", issues);
  if (onboarding) {
    requiredBoolean(onboarding.completed, path + ".onboarding.completed", issues);
    requiredNumber(onboarding.currentStep, path + ".onboarding.currentStep", issues, true);
    if (typeof onboarding.currentStep === "number" && (onboarding.currentStep < 1 || onboarding.currentStep > 5)) issues.push(path + ".onboarding.currentStep must be between 1 and 5.");
    nullableString(onboarding.completedAt, path + ".onboarding.completedAt", issues);
  }
  const incomeSources = requiredArray(planning.incomeSources, path + ".incomeSources", issues);
  incomeSources?.forEach((income, index) => validatePlannedIncome(income, path + ".incomeSources[" + index + "]", issues));
  const debts = requiredArray(planning.debts, path + ".debts", issues);
  debts?.forEach((debt, index) => validatePlannedDebt(debt, path + ".debts[" + index + "]", issues));
  if (onboarding?.completed === true) {
    for (const [kind, items] of [["incomeSources", incomeSources], ["debts", debts]] as const) items?.forEach((item, index) => { if (isRecord(item)) requiredString(item.name, path + "." + kind + "[" + index + "].name", issues); });
  }
  const expenses = requiredRecord(planning.essentialExpenses, path + ".essentialExpenses", issues);
  if (expenses) {
    ["housing", "utilities", "food", "transportation", "insurance", "subscriptions", "otherObligations", "safetyBuffer"]
      .forEach((key) => requiredNumber(expenses[key], path + ".essentialExpenses." + key, issues));
  }
  const capacity = requiredRecord(planning.capacity, path + ".capacity", issues);
  if (capacity) {
    enumValue(capacity.method, capacityMethods, path + ".capacity.method", issues);
    requiredNumber(capacity.monthlyAmount, path + ".capacity.monthlyAmount", issues);
  }
}


function validateMonthlyPlan(value: unknown, path: string, issues: string[]) {
  const plan = requiredRecord(value, path, issues);
  if (!plan) return;
  if (Object.prototype.hasOwnProperty.call(plan, 'currency') && !['USD', 'PHP', 'EUR', 'GBP', 'CAD', 'AUD'].includes(plan.currency as string)) issues.push(path + '.currency must be a supported household currency.');
  if (plan.payoffExtraPayment !== undefined) requiredNumber(plan.payoffExtraPayment, path + ".payoffExtraPayment", issues);
  if (plan.payoffExcludedTypes !== undefined) requiredArray(plan.payoffExcludedTypes, path + ".payoffExcludedTypes", issues)?.forEach((value,i)=>enumValue(value,new Set(["Credit card","Mortgage","Auto loan","Personal loan","Student loan","Medical debt","Other"]),path+".payoffExcludedTypes["+i+"]",issues));
  if (plan.payoffPlanAmount !== undefined) requiredNumber(plan.payoffPlanAmount, path + ".payoffPlanAmount", issues);
  if (plan.payoffPlanStrategy !== undefined) enumValue(plan.payoffPlanStrategy, new Set(["avalanche", "snowball", "custom"]), path + ".payoffPlanStrategy", issues);
  if (plan.payoffPlanOrder !== undefined) requiredArray(plan.payoffPlanOrder, path + ".payoffPlanOrder", issues)?.forEach((id, i) => requiredString(id, path + ".payoffPlanOrder[" + i + "]", issues));
  if (plan.removedProgressAccounts !== undefined) {
    const ids = new Set<string>();
    requiredArray(plan.removedProgressAccounts, path + ".removedProgressAccounts", issues)?.forEach((raw, i) => {
      const p = path + ".removedProgressAccounts[" + i + "]";
      const account = requiredRecord(raw, p, issues);
      if (!account) return;
      for (const key of ["id", "name", "removedAt"]) requiredString(account[key], p + "." + key, issues);
      requiredNumber(account.balance, p + ".balance", issues);
      if (account.baselineBalance !== undefined) requiredNumber(account.baselineBalance, p + ".baselineBalance", issues);
      if (account.displayGroup !== undefined) requiredString(account.displayGroup, p + ".displayGroup", issues);
      if (account.displayOrder !== undefined) requiredNumber(account.displayOrder, p + ".displayOrder", issues);
      if (typeof account.id === "string") { if (ids.has(account.id)) issues.push(p + ".id is duplicated."); ids.add(account.id); }
    });
  }
  if (plan.debtGroups !== undefined) {
    if (!Array.isArray(plan.debtGroups) || plan.debtGroups.length < 1 || plan.debtGroups.length > 20) issues.push(path + ".debtGroups must contain 1–20 groups.");
    else {
      const ids = new Set(), names = new Set();
      for (const group of plan.debtGroups) {
        if (!group || typeof group.id !== "string" || !/^(Mama|Papi|Other|group-[a-zA-Z0-9-]{1,80})$/.test(group.id) || ids.has(group.id)) issues.push(path + ".debtGroups requires unique stable IDs.");
        if (!group || typeof group.name !== "string" || !validDisplayName(group.name) || names.has(group.name.trim().toLowerCase())) issues.push(path + ".debtGroups requires unique names of 1–40 characters.");
        if (group) { ids.add(group.id); if (typeof group.name === "string") names.add(group.name.trim().toLowerCase()); }
      }
    }
  }
  if (plan.progressStartingBalance !== undefined) requiredNumber(plan.progressStartingBalance, path + ".progressStartingBalance", issues);
  if (plan.loanTrackers !== undefined) {
    const loans = requiredArray(plan.loanTrackers, path + ".loanTrackers", issues);
    const ids = new Set<string>();
    loans?.forEach((raw, i) => {
      const p = path + ".loanTrackers[" + i + "]";
      const loan = requiredRecord(raw, p, issues);
      if (!loan) return;
      if (!validOptionalInstitution(loan.institutionKey)) issues.push(p + ".institutionKey must be a catalog key.");
      for (const key of ["id", "name"]) requiredString(loan[key], p + "." + key, issues);
      for (const key of ["budgetItemId", "budgetItemName"]) requiredString(loan[key], p + "." + key, issues, true);
      if (typeof loan.budgetItemId === "string" && typeof loan.budgetItemName === "string" && Boolean(loan.budgetItemId.trim()) !== Boolean(loan.budgetItemName.trim())) issues.push(p + ".budgetItemId and budgetItemName must both be set or both be empty.");
      if (typeof loan.id === "string") { if (ids.has(loan.id)) issues.push(p + ".id is duplicated."); ids.add(loan.id); }
      enumValue(loan.kind, new Set(["house", "car"]), p + ".kind", issues);
      enumValue(loan.balanceKind, new Set(["principal", "payoff"]), p + ".balanceKind", issues);
      requiredNumber(loan.originalAmount, p + ".originalAmount", issues);
      if (typeof loan.originalAmount === "number" && loan.originalAmount <= 0) issues.push(p + ".originalAmount must be positive.");
      requiredNumber(loan.remainingAmount, p + ".remainingAmount", issues);
      for (const key of ["apr", "escrow", "principalAndInterest", "monthlyPayment"]) if (loan[key] !== undefined) requiredNumber(loan[key], p + "." + key, issues);
      if (loan.dueDate !== undefined && (typeof loan.dueDate !== "string" || !validDate(loan.dueDate))) issues.push(p + ".dueDate must be a valid date.");
      if (typeof loan.asOf !== "string" || !validDate(loan.asOf)) issues.push(p + ".asOf must be a valid date.");
      requiredArray(loan.history, p + ".history", issues)?.forEach((raw, index) => {
        const entry = requiredRecord(raw, p + ".history[" + index + "]", issues);
        if (!entry) return;
        requiredNumber(entry.amount, p + ".history.amount", issues);
        for (const key of ["payment", "principal", "interest", "escrow", "extraPrincipal"]) if (entry[key] !== undefined) requiredNumber(entry[key], p + ".history." + key, issues);
        enumValue(entry.balanceKind, new Set(["principal", "payoff"]), p + ".history.balanceKind", issues);
        if (typeof entry.date !== "string" || !validDate(entry.date)) issues.push(p + ".history.date must be a valid date.");
        requiredString(entry.recordedAt, p + ".history.recordedAt", issues);
      });
    });
  }
  requiredBoolean(plan.detailedSpendingTracking, path + ".detailedSpendingTracking", issues);
  if (plan.calculatorAmount !== undefined) requiredNumber(plan.calculatorAmount, path + ".calculatorAmount", issues);
  if (plan.monthlyCommitment !== undefined) requiredNumber(plan.monthlyCommitment, path + ".monthlyCommitment", issues);
  const months = requiredRecord(plan.months, path + ".months", issues);
  if (months) Object.entries(months).forEach(([month, raw]) => {
    const settings = requiredRecord(raw, path + ".months[" + JSON.stringify(month) + "]", issues);
    if (settings) {
      if (settings.skippedRecurringPayments !== undefined) requiredArray(settings.skippedRecurringPayments, path + '.skippedRecurringPayments', issues)?.forEach((id, index) => requiredString(id, path + '.skippedRecurringPayments[' + index + ']', issues));
      if (settings.settlements !== undefined) requiredArray(settings.settlements, path + ".settlements", issues)?.forEach((raw, i) => {
        const entry = requiredRecord(raw, path + ".settlements[" + i + "]", issues);
        if (!entry) return;
        for (const key of ["id", "targetId", "name", "date", "createdAt"]) requiredString(entry[key], path + ".settlements." + key, issues);
        requiredNumber(entry.amount, path + ".settlements.amount", issues);
        if (entry.automatic !== undefined) requiredBoolean(entry.automatic, path + ".settlements.automatic", issues);
        if (!["spending", "minimum"].includes(String(entry.kind))) issues.push(path + ".settlements.kind is invalid.");
        if (!["debit", "included"].includes(String(entry.source))) issues.push(path + ".settlements.source is invalid.");
        if (entry.kind === "minimum" && entry.source !== "included") issues.push("Previously paid minimums must already be included in balances.");
        if (typeof entry.date === "string" && entry.date.slice(0,7) !== month) issues.push("Settlement date must belong to its plan month.");
      });
      requiredNumber(settings.safetyBuffer, path + ".months[" + JSON.stringify(month) + "].safetyBuffer", issues);
      requiredNumber(settings.debtPaymentTarget, path + ".months[" + JSON.stringify(month) + "].debtPaymentTarget", issues);
    }
  });
}

function validateIdentifiersAndDates(payload: UnknownRecord, path: string, issues: string[]) {
  const calendarDate = (value: unknown, field: string, monthOnly = false) => {
    if (value === "" || value === null || value === undefined || typeof value !== "string") return;
    const text = monthOnly ? value + "-01" : value;
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(Date.parse(text)) && new Date(text).toISOString().slice(0, 10) === text;
    if (!valid) issues.push(field + " must be a valid " + (monthOnly ? "YYYY-MM month." : "YYYY-MM-DD date."));
  };
  const collection = (items: unknown, field: string) => {
    if (!Array.isArray(items)) return;
    const ids = new Set<string>();
    items.forEach((item, i) => {
      if (!isRecord(item)) return;
      if (typeof item.id === "string") {
        if (ids.has(item.id)) issues.push(field + "[" + i + "].id duplicates " + item.id + ".");
        ids.add(item.id);
      }
      for (const key of ["date", "dueDate", "promoEndDate", "balanceAsOf"]) calendarDate(item[key], field + "[" + i + "]." + key);
      calendarDate(item.month, field + "[" + i + "].month", true);
    });
  };
  for (const key of ["accounts", "transactions", "payees", "snapshots", "balanceAdjustments"]) collection(payload[key], path + "." + key);
  if (isRecord(payload.monthlyBudgets)) for (const [month, items] of Object.entries(payload.monthlyBudgets)) {
    calendarDate(month, path + ".monthlyBudgets key", true); collection(items, path + ".monthlyBudgets." + month);
  }
  if (isRecord(payload.planning)) for (const key of ["incomeSources", "debts"]) collection(payload.planning[key], path + ".planning." + key);
  if (isRecord(payload.monthlyPlan) && isRecord(payload.monthlyPlan.months)) for (const [month, settings] of Object.entries(payload.monthlyPlan.months)) {
    calendarDate(month, path + ".monthlyPlan.months key", true);
    if (isRecord(settings)) collection(settings.settlements, path + ".monthlyPlan.months." + month + ".settlements");
    if (isRecord(settings)) for (const key of ["payments", "minimums"]) if (settings[key] !== undefined) {
      const values = requiredRecord(settings[key], path + ".monthlyPlan.months." + month + "." + key, issues);
      if (values) for (const [id, amount] of Object.entries(values)) requiredNumber(amount, key + "." + id, issues);
    }
  }
}

function validateDashboardPayloadFields(value: unknown, path: string, includePlanning: boolean) {
  const issues: string[] = [];
  const payload = requiredRecord(value, path, issues);
  if (payload) {
    const accounts = requiredArray(payload.accounts, `${path}.accounts`, issues);
    accounts?.forEach((account, index) => validateAccount(account, `${path}.accounts[${index}]`, issues));
    const budgets = requiredRecord(payload.monthlyBudgets, `${path}.monthlyBudgets`, issues);
    if (budgets) Object.entries(budgets).forEach(([month, items]) => {
      const entries = requiredArray(items, `${path}.monthlyBudgets[${JSON.stringify(month)}]`, issues);
      entries?.forEach((item, index) => validateCashflow(item, `${path}.monthlyBudgets[${JSON.stringify(month)}][${index}]`, issues));
    });
    const payees = requiredArray(payload.payees, `${path}.payees`, issues);
    payees?.forEach((payee, index) => validatePayee(payee, `${path}.payees[${index}]`, issues));
    const transactions = requiredArray(payload.transactions, `${path}.transactions`, issues);
    transactions?.forEach((transaction, index) => validateTransaction(transaction, `${path}.transactions[${index}]`, issues));
    const snapshots = requiredArray(payload.snapshots, `${path}.snapshots`, issues);
    snapshots?.forEach((snapshot, index) => validateSnapshot(snapshot, `${path}.snapshots[${index}]`, issues));
    requiredNumber(payload.extra, `${path}.extra`, issues);
    enumValue(payload.strategy, strategies, `${path}.strategy`, issues);
    if (hasOwn(payload, "balanceAdjustments")) {
      const adjustments = requiredArray(payload.balanceAdjustments, path + ".balanceAdjustments", issues);
      adjustments?.forEach((adjustment, index) => validateBalanceAdjustment(adjustment, path + ".balanceAdjustments[" + index + "]", issues));
    }
  }
  if (payload) validateIdentifiersAndDates(payload, path, issues);
  if (payload && includePlanning) validatePlanning(payload.planning, path + ".planning", issues);
  if (payload && hasOwn(payload, "monthlyPlan")) validateMonthlyPlan(payload.monthlyPlan, path + ".monthlyPlan", issues);
  if (payload && hasOwn(payload, "customDebtOrder")) {
    const order = requiredArray(payload.customDebtOrder, path + ".customDebtOrder", issues);
    order?.forEach((id, index) => requiredString(id, path + ".customDebtOrder[" + index + "]", issues));
    if (order && new Set(order).size !== order.length) {
      issues.push(path + ".customDebtOrder must not contain duplicate debt ids.");
    }
  }
  if (!issues.length && payload) {
    const plan = payload.monthlyPlan as MonthlyPlanSettings | undefined;
    if (plan?.debtGroups) {
      const ids = new Set(plan.debtGroups.map(group => group.id));
      for (const account of [...payload.accounts as DebtAccount[], ...(plan.removedProgressAccounts ?? [])]) if (!ids.has(account.displayGroup ?? "Other")) issues.push(path + ".accounts must reference a saved debt group.");
    }
    const cycles = new Set<string>();
    for (const transaction of payload.transactions as LedgerTransaction[]) {
      if (transaction.actualInterestCycle !== undefined) {
        if (typeof transaction.actualInterestCycle !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(transaction.actualInterestCycle) || transaction.type !== "fee" || !transaction.date.startsWith(transaction.actualInterestCycle)) issues.push(path + ".transactions requires a valid actual-interest cycle.");
        const key = transaction.accountId + ":" + transaction.actualInterestCycle;
        if (!transaction.deletedAt && cycles.has(key)) issues.push(path + ".transactions duplicates actual interest for one cycle.");
        if (!transaction.deletedAt) cycles.add(key);
      }
    }
  }
  if (!issues.length && payload && Array.isArray(payload.transactions)) {
    try { validatePaymentLinks(payload.transactions as LedgerTransaction[], (payload.balanceAdjustments ?? []) as BalanceAdjustment[]); }
    catch(error) { issues.push(error instanceof Error ? error.message : "Invalid linked payment."); }
  }
  if (issues.length) throw new DashboardDataError(issues);
  return value as DashboardPayload | DashboardPayloadV1;
}

function validateDashboardPayloadV1(value: unknown, path = "payload"): DashboardPayloadV1 {
  return validateDashboardPayloadFields(value, path, false) as DashboardPayloadV1;
}

export function validateDashboardPayload(value: unknown, path = "payload"): DashboardPayload {
  return validateDashboardPayloadFields(value, path, true) as DashboardPayload;
}

export function migrateV0ToV1(value: unknown, exportedAt = new Date().toISOString()): DashboardBackupV1 {
  const payload = validateDashboardPayloadV1(migratePayloadFields(value));
  return { format: DASHBOARD_BACKUP_FORMAT, version: LEGACY_DASHBOARD_DATA_VERSION, exportedAt, payload };
}

export function migrateV1ToV2(value: DashboardBackupV1): DashboardBackupV2 {
  const payload = validateDashboardPayloadFields(migratePayloadV1ToV2(value.payload), "payload", true) as DashboardPayloadV2;
  return { ...value, format: DASHBOARD_BACKUP_FORMAT, version: PLANNING_DASHBOARD_DATA_VERSION, exportedAt: value.exportedAt, payload };
}

export function migrateV2ToV3(value: DashboardBackupV2): DashboardBackupV3 {
  const payload = validateDashboardPayloadFields(migratePayloadV2ToV3(value.payload), "payload", true) as DashboardPayloadV3;
  return { ...value, format: DASHBOARD_BACKUP_FORMAT, version: AUDIT_DASHBOARD_DATA_VERSION, exportedAt: value.exportedAt, payload };
}

export function migrateV3ToV4(value: DashboardBackupV3): DashboardBackupV4 {
  const payload = validateDashboardPayloadFields(migratePayloadV3ToV4(value.payload), "payload", true) as DashboardPayloadV4;
  return { ...value, format: DASHBOARD_BACKUP_FORMAT, version: MONTHLY_PLAN_DASHBOARD_DATA_VERSION, exportedAt: value.exportedAt, payload };
}

export function migrateV4ToV5(value: DashboardBackupV4): DashboardBackup {
  const payload = validateDashboardPayload(migratePayloadV4ToV5(value.payload));
  return { ...value, format: DASHBOARD_BACKUP_FORMAT, version: DASHBOARD_DATA_VERSION, exportedAt: value.exportedAt, payload };
}


function wrapperSignal(value: UnknownRecord) {
  return hasOwn(value, "format") || hasOwn(value, "version") || hasOwn(value, "payload") || hasOwn(value, "exportedAt");
}

export function parseDashboardContract(value: unknown, path = "backup"): DashboardBackup {
  if (!isRecord(value)) throw new DashboardDataError([`${path} must be a JSON object.`]);
  if (!wrapperSignal(value)) return migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(migrateV0ToV1(value)))));

  const issues: string[] = [];
  if (value.format !== DASHBOARD_BACKUP_FORMAT) issues.push(`${path}.format must be "${DASHBOARD_BACKUP_FORMAT}".`);
  if (value.version !== LEGACY_DASHBOARD_DATA_VERSION && value.version !== PLANNING_DASHBOARD_DATA_VERSION && value.version !== AUDIT_DASHBOARD_DATA_VERSION && value.version !== MONTHLY_PLAN_DASHBOARD_DATA_VERSION && value.version !== 5 && value.version !== DASHBOARD_DATA_VERSION) {
    issues.push(path + ".version must be 1, 2, 3, 4, 5, or 6; received " + JSON.stringify(value.version) + ".");
  }
  requiredString(value.exportedAt, `${path}.exportedAt`, issues);
  if (!hasOwn(value, "payload")) issues.push(`${path}.payload is required.`);
  if (issues.length) throw new DashboardDataError(issues);
  const corePayload = migratePayloadFields(value.payload);
  if (value.version === LEGACY_DASHBOARD_DATA_VERSION) {
    const payload = validateDashboardPayloadV1(corePayload, `${path}.payload`);
    return migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(migrateV1ToV2({ ...value, format: DASHBOARD_BACKUP_FORMAT, version: LEGACY_DASHBOARD_DATA_VERSION, exportedAt: value.exportedAt as string, payload } as DashboardBackupV1))));
  }
  if (value.version === PLANNING_DASHBOARD_DATA_VERSION) {
    const payload = validateDashboardPayloadFields(migratePayloadV1ToV2(corePayload), path + ".payload", true) as DashboardPayloadV2;
    return migrateV4ToV5(migrateV3ToV4(migrateV2ToV3({ ...value, format: DASHBOARD_BACKUP_FORMAT, version: PLANNING_DASHBOARD_DATA_VERSION, exportedAt: value.exportedAt as string, payload } as DashboardBackupV2)));
  }
  if (value.version === AUDIT_DASHBOARD_DATA_VERSION) {
    const payload = validateDashboardPayloadFields(migratePayloadV2ToV3(migratePayloadV1ToV2(corePayload)), path + ".payload", true) as DashboardPayloadV3;
    return migrateV4ToV5(migrateV3ToV4({ ...value, format: DASHBOARD_BACKUP_FORMAT, version: AUDIT_DASHBOARD_DATA_VERSION, exportedAt: value.exportedAt as string, payload } as DashboardBackupV3));
  }
  const payload = validateDashboardPayload(migratePayloadV4ToV5(migratePayloadV3ToV4(migratePayloadV2ToV3(migratePayloadV1ToV2(corePayload)))), path + ".payload");
  if (value.version === MONTHLY_PLAN_DASHBOARD_DATA_VERSION) {
    const payload = validateDashboardPayloadFields(migratePayloadV3ToV4(migratePayloadV2ToV3(migratePayloadV1ToV2(corePayload))), path + ".payload", true) as DashboardPayloadV4;
    return migrateV4ToV5({ ...value, format: DASHBOARD_BACKUP_FORMAT, version: MONTHLY_PLAN_DASHBOARD_DATA_VERSION, exportedAt: value.exportedAt as string, payload } as DashboardBackupV4);
  }
  return { ...value, format: DASHBOARD_BACKUP_FORMAT, version: DASHBOARD_DATA_VERSION, exportedAt: value.exportedAt as string, payload } as DashboardBackup;
}
function jsonError(error: unknown, text: string, path: string) {
  const detail = error instanceof Error ? error.message : "Unknown JSON syntax error";
  const position = /position\s+(\d+)/i.exec(detail);
  const unexpectedToken = /Unexpected token '([^']+)'/i.exec(detail);
  const offset = position ? Number(position[1]) : detail.includes("Unexpected end") ? text.length : unexpectedToken ? text.indexOf(unexpectedToken[1]) : -1;
  if (offset < 0) return new DashboardDataError([`${path} contains invalid JSON: ${detail}.`]);
  const before = text.slice(0, offset);
  const line = before.split("\n").length;
  const column = offset - before.lastIndexOf("\n");
  return new DashboardDataError([`${path} contains invalid JSON at line ${line}, column ${column}.`]);
}

export function parseDashboardJson(text: string): DashboardBackup {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch (error) { throw jsonError(error, text, "Backup file"); }
  return parseDashboardContract(value);
}

export function createDashboardPayload(template: DashboardPayload | null | undefined, known: Pick<DashboardPayload, "accounts" | "monthlyBudgets" | "payees" | "transactions" | "snapshots" | "extra" | "strategy" | "planning" | "balanceAdjustments" | "monthlyPlan" | "customDebtOrder">): DashboardPayload {
  return validateDashboardPayload({ ...(template ?? {}), ...known });
}

export function createDashboardBackup(payload: DashboardPayload, template?: DashboardBackup | null, exportedAt = new Date().toISOString()): DashboardBackup {
  return {
    ...(template ?? {}),
    format: DASHBOARD_BACKUP_FORMAT,
    version: DASHBOARD_DATA_VERSION,
    exportedAt,
    payload: validateDashboardPayload(payload),
  };
}

export function serializeDashboardBackup(backup: DashboardBackup | DashboardBackupV1, pretty = false) {
  const validated = parseDashboardContract(backup);
  return JSON.stringify(validated, null, pretty ? 2 : undefined);
}

export function parseHouseholdWriteJson(raw: string): DashboardBackup {
  let body: unknown;
  try { body = JSON.parse(raw); }
  catch (error) { throw jsonError(error, raw, "Household request"); }
  if (!isRecord(body)) throw new DashboardDataError(["Household request must be a JSON object."]);
  if (!hasOwn(body, "payload")) throw new DashboardDataError(["Household request.payload is required."]);
  return parseDashboardContract(body.payload, "Household request.payload");
}

export function dashboardDataErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Dashboard data is invalid.";
}
