export const DASHBOARD_BACKUP_FORMAT = "debtfree-dashboard-backup" as const;
export const DASHBOARD_DATA_VERSION = 1 as const;

export type DebtType = "Credit card" | "Personal loan" | "Auto loan" | "Student loan" | "Medical debt" | "Other";
export type MinimumMode = "auto" | "manual";
export type PayoffMode = "priority" | "minimum-only";
export type PayoffStrategy = "avalanche" | "snowball";
export type CashflowKind = "income" | "expense" | "purchase" | "budget";
export type PaymentMethod = "debit" | "credit";
export type TransactionType = "charge" | "payment" | "fee";

export type DebtAccount = {
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
  promoEndDate: string;
  postPromoApr: number;
  postPromoMinimum: number;
  createdAt: string;
  [key: string]: unknown;
};

export type CashflowItem = {
  id: string;
  name: string;
  kind: CashflowKind;
  category: string;
  amount: number;
  paymentMethod: PaymentMethod;
  creditAccountId: string;
  createdAt: string;
  [key: string]: unknown;
};

export type Payee = {
  id: string;
  name: string;
  createdAt: string;
  deletedAt: string | null;
  [key: string]: unknown;
};

export type LedgerTransaction = {
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

export type PayoffSnapshot = {
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

export type DashboardPayload = {
  accounts: DebtAccount[];
  monthlyBudgets: Record<string, CashflowItem[]>;
  payees: Payee[];
  transactions: LedgerTransaction[];
  snapshots: PayoffSnapshot[];
  extra: number;
  strategy: PayoffStrategy;
  [key: string]: unknown;
};

export type DashboardBackupV1 = {
  format: typeof DASHBOARD_BACKUP_FORMAT;
  version: typeof DASHBOARD_DATA_VERSION;
  exportedAt: string;
  payload: DashboardPayload;
  [key: string]: unknown;
};

type UnknownRecord = Record<string, unknown>;

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
const strategies = new Set<PayoffStrategy>(["avalanche", "snowball"]);

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

function migratePayloadFields(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const legacyCashflow = Array.isArray(value.cashflowItems)
    ? { [new Date().toISOString().slice(0, 7)]: value.cashflowItems.map(migrateCashflow) }
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
  if (value < 0) issues.push(`${path} must be zero or greater.`);
  if (integer && !Number.isInteger(value)) issues.push(`${path} must be a whole number.`);
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>, path: string, issues: string[]) {
  if (typeof value !== "string" || !allowed.has(value as T)) issues.push(`${path} must be one of: ${[...allowed].join(", ")}.`);
}

function validateAccount(value: unknown, path: string, issues: string[]) {
  const item = requiredRecord(value, path, issues);
  if (!item) return;
  requiredString(item.id, `${path}.id`, issues);
  requiredString(item.name, `${path}.name`, issues);
  enumValue(item.type, debtTypes, `${path}.type`, issues);
  requiredNumber(item.balance, `${path}.balance`, issues);
  requiredNumber(item.apr, `${path}.apr`, issues);
  requiredNumber(item.interestFee, `${path}.interestFee`, issues);
  requiredNumber(item.minimum, `${path}.minimum`, issues);
  enumValue(item.minimumMode, minimumModes, `${path}.minimumMode`, issues);
  enumValue(item.payoffMode, payoffModes, `${path}.payoffMode`, issues);
  requiredNumber(item.creditLimit, `${path}.creditLimit`, issues);
  requiredString(item.dueDate, `${path}.dueDate`, issues, true);
  requiredString(item.promoEndDate, `${path}.promoEndDate`, issues, true);
  requiredNumber(item.postPromoApr, `${path}.postPromoApr`, issues);
  requiredNumber(item.postPromoMinimum, `${path}.postPromoMinimum`, issues);
  requiredString(item.createdAt, `${path}.createdAt`, issues);
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
  requiredString(item.accountId, `${path}.accountId`, issues);
  requiredString(item.payeeId, `${path}.payeeId`, issues, true);
  requiredString(item.payeeName, `${path}.payeeName`, issues, true);
  enumValue(item.type, transactionTypes, `${path}.type`, issues);
  requiredString(item.category, `${path}.category`, issues);
  requiredString(item.memo, `${path}.memo`, issues, true);
  requiredNumber(item.amount, `${path}.amount`, issues);
  requiredString(item.createdAt, `${path}.createdAt`, issues);
  requiredString(item.updatedAt, `${path}.updatedAt`, issues);
  nullableString(item.deletedAt, `${path}.deletedAt`, issues);
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
  const accounts = requiredArray(item.accounts, `${path}.accounts`, issues);
  accounts?.forEach((account, index) => validateSnapshotAccount(account, `${path}.accounts[${index}]`, issues));
}

export function validateDashboardPayload(value: unknown, path = "payload"): DashboardPayload {
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
  }
  if (issues.length) throw new DashboardDataError(issues);
  return value as DashboardPayload;
}

export function migrateV0ToV1(value: unknown, exportedAt = new Date().toISOString()): DashboardBackupV1 {
  const payload = validateDashboardPayload(migratePayloadFields(value));
  return { format: DASHBOARD_BACKUP_FORMAT, version: DASHBOARD_DATA_VERSION, exportedAt, payload };
}

function wrapperSignal(value: UnknownRecord) {
  return hasOwn(value, "format") || hasOwn(value, "version") || hasOwn(value, "payload") || hasOwn(value, "exportedAt");
}

export function parseDashboardContract(value: unknown, path = "backup"): DashboardBackupV1 {
  if (!isRecord(value)) throw new DashboardDataError([`${path} must be a JSON object.`]);
  if (!wrapperSignal(value)) return migrateV0ToV1(value);

  const issues: string[] = [];
  if (value.format !== DASHBOARD_BACKUP_FORMAT) issues.push(`${path}.format must be "${DASHBOARD_BACKUP_FORMAT}".`);
  if (value.version !== DASHBOARD_DATA_VERSION) issues.push(`${path}.version must be ${DASHBOARD_DATA_VERSION}; received ${JSON.stringify(value.version)}.`);
  requiredString(value.exportedAt, `${path}.exportedAt`, issues);
  if (!hasOwn(value, "payload")) issues.push(`${path}.payload is required.`);
  if (issues.length) throw new DashboardDataError(issues);
  const payload = validateDashboardPayload(migratePayloadFields(value.payload), `${path}.payload`);
  return { ...value, format: DASHBOARD_BACKUP_FORMAT, version: DASHBOARD_DATA_VERSION, exportedAt: value.exportedAt as string, payload } as DashboardBackupV1;
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

export function parseDashboardJson(text: string): DashboardBackupV1 {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch (error) { throw jsonError(error, text, "Backup file"); }
  return parseDashboardContract(value);
}

export function createDashboardPayload(template: DashboardPayload | null | undefined, known: Pick<DashboardPayload, "accounts" | "monthlyBudgets" | "payees" | "transactions" | "snapshots" | "extra" | "strategy">): DashboardPayload {
  return validateDashboardPayload({ ...(template ?? {}), ...known });
}

export function createDashboardBackup(payload: DashboardPayload, template?: DashboardBackupV1 | null, exportedAt = new Date().toISOString()): DashboardBackupV1 {
  return {
    ...(template ?? {}),
    format: DASHBOARD_BACKUP_FORMAT,
    version: DASHBOARD_DATA_VERSION,
    exportedAt,
    payload: validateDashboardPayload(payload),
  };
}

export function serializeDashboardBackup(backup: DashboardBackupV1, pretty = false) {
  const validated = parseDashboardContract(backup);
  return JSON.stringify(validated, null, pretty ? 2 : undefined);
}

export function parseHouseholdWriteJson(raw: string): DashboardBackupV1 {
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
