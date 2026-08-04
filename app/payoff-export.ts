export type PayoffReportCashflow = { type: "Income" | "Expense" | "One-time purchase" | "Budget"; name: string; category: string; amount: number; paymentMethod: string; linkedAccount: string };
export type PayoffReportAccount = { name: string; type: string; balance: number; apr: number; monthlyInterest: number; minimumPayment: number; linkedCardExpenses: number; plannedMonthlyPayment: number; payoffMode: string; creditLimit: number; utilization: number | null; dueDate: string; projectedPayoff: string };
export type PayoffReportScheduleRow = { month: string; totalPaid: number; interest: number; remaining: number; milestone: string; accounts: { name: string; payment: number; endingBalance: number }[] };
export type PayoffReportTransaction = { date: string; merchant: string; account: string; type: string; category: string; memo: string; amount: number; status: string };
export type PayoffReportSnapshot = { month: string; capturedAt: string; totalBalance: number; monthlyInterest: number; activeAccountCount: number; projectedDebtFree: string; note: string; accounts: { name: string; type: string; balance: number; apr: number }[] };
export type PayoffReportData = {
  generatedAt: string; budgetMonth: string; strategy: string; projectedDebtFree: string; monthsToPayoff: number; stalled: boolean;
  startingDebt: number; monthlyPlan: number; estimatedInterest: number; extraPayment: number; totalIncome: number; totalExpenses: number;
  totalBudget: number; monthlySurplus: number; totalMinimums: number; availableExtra: number; cashflow: PayoffReportCashflow[];
  accounts: PayoffReportAccount[]; schedule: PayoffReportScheduleRow[]; transactions: PayoffReportTransaction[]; snapshots: PayoffReportSnapshot[];
};

type CellValue = string | number | null;
type StyledCell = { value: CellValue; style: number };
type SheetSpec = { name: string; rows: (CellValue | StyledCell)[][]; widths: number[]; merges?: string[]; freezeRows?: number; autoFilter?: string; landscape?: boolean };
const BLUE = [22, 119, 255] as const;
const NAVY: [number, number, number] = [19, 34, 56];
const GREEN = [13, 139, 99] as const;
const ORANGE = [231, 137, 38] as const;
const VIOLET = [106, 93, 231] as const;
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const percent = (value: number) => `${value.toFixed(2)}%`;
const reportFilename = (extension: string) => `debtfree-payoff-report-${new Date().toISOString().slice(0, 10)}.${extension}`;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function csvCell(value: CellValue) {
  const text = value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
const csvRow = (values: CellValue[]) => values.map(csvCell).join(",");
function categoryTotals(report: PayoffReportData, type?: PayoffReportCashflow["type"]) {
  const totals = new Map<string, number>();
  report.cashflow.filter((item) => !type || item.type === type).forEach((item) => {
    const key = type ? item.category : `${item.type} | ${item.category}`;
    totals.set(key, (totals.get(key) ?? 0) + item.amount);
  });
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

function spendingCategoryTotals(report: PayoffReportData) {
  const totals = new Map<string, number>();
  report.cashflow.filter((item) => item.type === "Expense" || item.type === "One-time purchase").forEach((item) => {
    totals.set(item.category, (totals.get(item.category) ?? 0) + item.amount);
  });
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}
export function buildPayoffCsv(report: PayoffReportData) {
  const rows: string[] = [];
  const section = (title: string) => { if (rows.length) rows.push(""); rows.push(csvRow([title])); };
  section("DEBTFREE PAYOFF REPORT");
  [
    ["Generated", report.generatedAt], ["Budget month", report.budgetMonth], ["Strategy", report.strategy],
    ["Projection status", report.stalled ? "Needs adjustment" : "On track"], ["Projected debt-free", report.projectedDebtFree],
    ["Months to payoff", report.monthsToPayoff], ["Starting debt", report.startingDebt], ["Monthly payoff plan", report.monthlyPlan],
    ["Estimated interest", report.estimatedInterest], ["Extra payment", report.extraPayment], ["Total income", report.totalIncome],
    ["Total expenses", report.totalExpenses], ["Total budget / set-asides", report.totalBudget],
    ["Monthly surplus before debt minimums", report.monthlySurplus], ["Debt minimums", report.totalMinimums], ["Available extra", report.availableExtra],
  ].forEach((row) => rows.push(csvRow(row as CellValue[])));

  section("MONTHLY BUDGET BREAKDOWN");
  rows.push(csvRow(["Type", "Name", "Category", "Amount", "Payment method", "Linked debt account"]));
  report.cashflow.forEach((item) => rows.push(csvRow([item.type, item.name, item.category, item.amount, item.paymentMethod, item.linkedAccount])));
  rows.push(csvRow(["TOTAL INCOME", "", "", report.totalIncome]));
  rows.push(csvRow(["TOTAL EXPENSES", "", "", report.totalExpenses]));
  rows.push(csvRow(["TOTAL BUDGET", "", "", report.totalBudget]));

  section("CATEGORY SUMMARY");
  rows.push(csvRow(["Type and category", "Amount", "Share of income"]));
  categoryTotals(report).forEach(([category, amount]) => rows.push(csvRow([category, amount, report.totalIncome > 0 ? amount / report.totalIncome : 0])));

  section("DEBT ACCOUNTS");
  rows.push(csvRow(["Account", "Type", "Balance", "APR", "Monthly interest", "Minimum", "Linked card expenses", "Planned monthly payment", "Payoff mode", "Credit limit", "Utilization", "Due date", "Projected payoff"]));
  report.accounts.forEach((account) => rows.push(csvRow([account.name, account.type, account.balance, account.apr, account.monthlyInterest, account.minimumPayment, account.linkedCardExpenses, account.plannedMonthlyPayment, account.payoffMode, account.creditLimit, account.utilization ?? "", account.dueDate, account.projectedPayoff])));

  section("PAYOFF SCHEDULE");
  const scheduleAccounts = report.accounts.filter((account) => account.balance > 0).map((account) => account.name);
  rows.push(csvRow(["Month", ...scheduleAccounts.flatMap((name) => [`${name} payment`, `${name} ending balance`]), "Total paid", "Interest", "Remaining", "Milestone"]));
  report.schedule.forEach((entry) => {
    const accountMap = new Map(entry.accounts.map((account) => [account.name, account]));
    rows.push(csvRow([entry.month, ...scheduleAccounts.flatMap((name) => [accountMap.get(name)?.payment ?? 0, accountMap.get(name)?.endingBalance ?? 0]), entry.totalPaid, entry.interest, entry.remaining, entry.milestone]));
  });

  section("TRANSACTION LEDGER");
  rows.push(csvRow(["Date", "Merchant / recipient", "Account", "Type", "Category", "Memo", "Amount", "Status"]));
  report.transactions.forEach((transaction) => rows.push(csvRow([transaction.date, transaction.merchant, transaction.account, transaction.type, transaction.category, transaction.memo, transaction.amount, transaction.status])));

  section("PAYOFF SNAPSHOTS");
  rows.push(csvRow(["Snapshot month", "Captured", "Account", "Type", "Account balance", "APR", "Snapshot total", "Monthly interest", "Active accounts", "Projected debt-free", "Note"]));
  report.snapshots.forEach((snapshot) => {
    if (!snapshot.accounts.length) rows.push(csvRow([snapshot.month, snapshot.capturedAt, "", "", "", "", snapshot.totalBalance, snapshot.monthlyInterest, snapshot.activeAccountCount, snapshot.projectedDebtFree, snapshot.note]));
    snapshot.accounts.forEach((account) => rows.push(csvRow([snapshot.month, snapshot.capturedAt, account.name, account.type, account.balance, account.apr, snapshot.totalBalance, snapshot.monthlyInterest, snapshot.activeAccountCount, snapshot.projectedDebtFree, snapshot.note])));
  });
  return `\uFEFF${rows.join("\r\n")}`;
}
export function exportPayoffCsv(report: PayoffReportData) {
  downloadBlob(new Blob([buildPayoffCsv(report)], { type: "text/csv;charset=utf-8" }), reportFilename("csv"));
}
const styled = (value: CellValue, style: number): StyledCell => ({ value, style });
const isStyled = (value: CellValue | StyledCell): value is StyledCell => typeof value === "object" && value !== null && "style" in value;
const xmlEscape = (value: CellValue) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function columnName(index: number) {
  let result = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function worksheetXml(sheet: SheetSpec) {
  const maxColumns = Math.max(sheet.widths.length, ...sheet.rows.map((row) => row.length), 1);
  const maxRows = Math.max(sheet.rows.length, 1);
  const columns = sheet.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const rows = sheet.rows.map((row, rowIndex) => {
    const cells = row.map((input, columnIndex) => {
      const entry = isStyled(input) ? input : styled(input, 0);
      if (entry.value === null || entry.value === "") return "";
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      if (typeof entry.value === "number") return `<c r="${ref}" s="${entry.style}"><v>${Number.isFinite(entry.value) ? entry.value : 0}</v></c>`;
      return `<c r="${ref}" s="${entry.style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(entry.value)}</t></is></c>`;
    }).join("");
    const height = rowIndex === 0 ? ' ht="30" customHeight="1"' : rowIndex === 1 ? ' ht="22" customHeight="1"' : "";
    return `<row r="${rowIndex + 1}"${height}>${cells}</row>`;
  }).join("");
  const mergeCells = sheet.merges?.length ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>` : "";
  const pane = sheet.freezeRows ? `<pane ySplit="${sheet.freezeRows}" topLeftCell="A${sheet.freezeRows + 1}" activePane="bottomLeft" state="frozen"/>` : "";
  const autoFilter = sheet.autoFilter ? `<autoFilter ref="${sheet.autoFilter}"/>` : "";
  const orientation = sheet.landscape ? ' orientation="landscape" fitToWidth="1" fitToHeight="0"' : ' orientation="portrait" fitToWidth="1" fitToHeight="0"';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${columnName(maxColumns - 1)}${maxRows}"/><sheetViews><sheetView showGridLines="0" workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${columns}</cols><sheetData>${rows}</sheetData>${autoFilter}${mergeCells}<pageMargins left="0.3" right="0.3" top="0.6" bottom="0.6" header="0.2" footer="0.2"/><pageSetup paperSize="9"${orientation}/></worksheet>`;
}

function workbookStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00;[Red]-&quot;$&quot;#,##0.00"/><numFmt numFmtId="166" formatCode="0.00&quot;%&quot;"/></numFmts>
  <fonts count="5"><font><sz val="10"/><name val="Aptos"/><color rgb="FF17243A"/></font><font><b/><sz val="20"/><name val="Aptos Display"/><color rgb="FFFFFFFF"/></font><font><sz val="10"/><name val="Aptos"/><color rgb="FF6F7C8F"/></font><font><b/><sz val="10"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="14"/><name val="Aptos Display"/><color rgb="FF1677FF"/></font></fonts>
  <fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF132238"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1677FF"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDF5FF"/></patternFill></fill></fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFDDE4EC"/></left><right style="thin"><color rgb="FFDDE4EC"/></right><top style="thin"><color rgb="FFDDE4EC"/></top><bottom style="thin"><color rgb="FFDDE4EC"/></bottom><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="17">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFill="1" applyFont="1"/>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="4" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyFont="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="3" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyFont="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>
  </cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

function tableSheet(name: string, subtitle: string, headers: string[], rows: (CellValue | StyledCell)[][], widths: number[], landscape = false): SheetSpec {
  const endColumn = columnName(headers.length - 1);
  return {
    name,
    rows: [[styled(name, 1)], [styled(subtitle, 2)], [], headers.map((header) => styled(header, 4)), ...(rows.length ? rows : [[styled("No records available", 15)]])],
    widths, merges: [`A1:${endColumn}1`, `A2:${endColumn}2`], freezeRows: 4,
    autoFilter: rows.length ? `A4:${endColumn}${rows.length + 4}` : undefined, landscape,
  };
}

function reportSheets(report: PayoffReportData): SheetSpec[] {
  const categories = spendingCategoryTotals(report);
  const overviewRows: (CellValue | StyledCell)[][] = [
    [styled("DebtFree household payoff report", 1)],
    [styled(`Generated ${report.generatedAt} | Budget month ${report.budgetMonth} | ${report.strategy} strategy`, 2)], [],
    [styled("PLAN AT A GLANCE", 3)],
    [styled("Starting debt", 8), styled(report.startingDebt, 9), styled("Projected debt-free", 8), styled(report.projectedDebtFree, 10), styled("Months to payoff", 8), styled(report.monthsToPayoff, 10), styled("Status", 8), styled(report.stalled ? "Needs adjustment" : "On track", 10)],
    [styled("Monthly payoff plan", 8), styled(report.monthlyPlan, 9), styled("Estimated interest", 8), styled(report.estimatedInterest, 9), styled("Extra payment", 8), styled(report.extraPayment, 9), styled("Available extra", 8), styled(report.availableExtra, 9)], [],
    [styled("MONTHLY CASH FLOW", 3)],
    [styled("Income", 4), styled("Expenses", 4), styled("Budget / set-asides", 4), styled("Surplus before minimums", 4), styled("Debt minimums", 4), styled("Available extra", 4)],
    [styled(report.totalIncome, 9), styled(report.totalExpenses, 9), styled(report.totalBudget, 9), styled(report.monthlySurplus, 9), styled(report.totalMinimums, 9), styled(report.availableExtra, 9)], [],
    [styled("EXPENSE CATEGORY BREAKDOWN", 3)],
    [styled("Category", 4), styled("Amount", 4), styled("Share of expenses", 4)],
    ...categories.map(([category, amount]) => [styled(category, 13), styled(amount, 5), styled(report.totalExpenses > 0 ? amount / report.totalExpenses * 100 : 0, 6)]), [],
    [styled("REPORT CONTENTS", 3)],
    [styled("Monthly Budget", 7), styled(`${report.cashflow.length} planning items`, 13)],
    [styled("Debt Accounts", 7), styled(`${report.accounts.length} accounts`, 13)],
    [styled("Payoff Schedule", 7), styled(`${report.schedule.length} months`, 13)],
    [styled("Transactions", 7), styled(`${report.transactions.length} ledger entries`, 13)],
    [styled("Snapshots", 7), styled(`${report.snapshots.length} captured checkpoints`, 13)],
  ];
  const overview: SheetSpec = { name: "Overview", rows: overviewRows, widths: [24, 18, 24, 18, 24, 18, 24, 20], merges: ["A1:H1", "A2:H2", "A4:H4", "A8:H8", "A12:H12"], freezeRows: 2 };

  const monthlyRows: (CellValue | StyledCell)[][] = report.cashflow.map((item, index) => [styled(item.type, index % 2 ? 13 : 7), styled(item.name, 15), styled(item.category, 13), styled(item.paymentMethod, 13), styled(item.linkedAccount, 15), styled(item.amount, index % 2 ? 5 : 14)]);
  monthlyRows.push([styled("TOTAL INCOME", 11), "", "", "", "", styled(report.totalIncome, 12)]);
  monthlyRows.push([styled("TOTAL EXPENSES", 11), "", "", "", "", styled(report.totalExpenses, 12)]);
  monthlyRows.push([styled("TOTAL BUDGET", 11), "", "", "", "", styled(report.totalBudget, 12)]);
  const monthly = tableSheet("Monthly Budget", `${report.budgetMonth} income, recurring expenses, and set-aside budgets`, ["Type", "Name", "Category", "Payment method", "Linked account", "Amount"], monthlyRows, [14, 28, 22, 18, 26, 16]);

  const accountRows = report.accounts.map((account, index) => [styled(account.name, index % 2 ? 13 : 7), styled(account.type, 13), styled(account.balance, index % 2 ? 5 : 14), styled(account.apr, 6), styled(account.monthlyInterest, 5), styled(account.minimumPayment, 5), styled(account.linkedCardExpenses, 5), styled(account.plannedMonthlyPayment, 5), styled(account.payoffMode, 15), styled(account.creditLimit, 5), styled(account.utilization ?? 0, 6), styled(account.dueDate, 13), styled(account.projectedPayoff, 15)]);
  const accounts = tableSheet("Debt Accounts", "Balances include active ledger entries; payments include linked card expenses", ["Account", "Type", "Balance", "APR", "Monthly interest", "Minimum", "Linked expenses", "Planned payment", "Payoff mode", "Credit limit", "Utilization", "Due date", "Projected payoff"], accountRows, [26, 18, 16, 12, 16, 15, 16, 17, 18, 16, 13, 15, 18], true);

  const activeNames = report.accounts.filter((account) => account.balance > 0).map((account) => account.name);
  const scheduleRows = report.schedule.map((entry, index) => {
    const accountMap = new Map(entry.accounts.map((account) => [account.name, account]));
    return [styled(entry.month, index % 2 ? 13 : 7), ...activeNames.flatMap((name) => [styled(accountMap.get(name)?.payment ?? 0, index % 2 ? 5 : 14), styled(accountMap.get(name)?.endingBalance ?? 0, index % 2 ? 5 : 14)]), styled(entry.totalPaid, 5), styled(entry.interest, 5), styled(entry.remaining, 5), styled(entry.milestone, 15)];
  });
  const scheduleHeaders = ["Month", ...activeNames.flatMap((name) => [`${name} payment`, `${name} balance`]), "Total paid", "Interest", "Remaining", "Milestone"];
  const schedule = tableSheet("Payoff Schedule", `Complete ${report.strategy} schedule with monthly payments and ending balances`, scheduleHeaders, scheduleRows, [14, ...activeNames.flatMap(() => [16, 16]), 16, 15, 16, 28], true);

  const transactionRows = report.transactions.map((transaction, index) => [styled(transaction.date, index % 2 ? 13 : 7), styled(transaction.merchant, 15), styled(transaction.account, 15), styled(transaction.type, 13), styled(transaction.category, 13), styled(transaction.memo, 15), styled(transaction.amount, index % 2 ? 5 : 14), styled(transaction.status, 13)]);
  const transactions = tableSheet("Transactions", "Complete ledger, including soft-deleted entries for audit history", ["Date", "Merchant / recipient", "Account", "Type", "Category", "Memo", "Amount", "Status"], transactionRows, [15, 28, 25, 13, 20, 34, 16, 13], true);

  const snapshotRows: (CellValue | StyledCell)[][] = [];
  report.snapshots.forEach((snapshot) => {
    if (!snapshot.accounts.length) snapshotRows.push([styled(snapshot.month, 13), styled(snapshot.capturedAt, 13), "", "", "", "", styled(snapshot.totalBalance, 5), styled(snapshot.monthlyInterest, 5), styled(snapshot.activeAccountCount, 16), styled(snapshot.projectedDebtFree, 15), styled(snapshot.note, 15)]);
    snapshot.accounts.forEach((account, index) => snapshotRows.push([styled(snapshot.month, index % 2 ? 13 : 7), styled(snapshot.capturedAt, 13), styled(account.name, 15), styled(account.type, 13), styled(account.balance, index % 2 ? 5 : 14), styled(account.apr, 6), styled(snapshot.totalBalance, 5), styled(snapshot.monthlyInterest, 5), styled(snapshot.activeAccountCount, 16), styled(snapshot.projectedDebtFree, 15), styled(snapshot.note, 15)]));
  });
  const snapshots = tableSheet("Snapshots", "Historical payoff checkpoints and account-level balances", ["Snapshot month", "Captured", "Account", "Type", "Account balance", "APR", "Snapshot total", "Monthly interest", "Active accounts", "Projected debt-free", "Note"], snapshotRows, [17, 20, 26, 18, 17, 12, 17, 16, 15, 18, 38], true);
  return [overview, monthly, accounts, schedule, transactions, snapshots];
}

export async function exportPayoffExcel(report: PayoffReportData) {
  const { strToU8, zipSync } = await import("fflate");
  const sheets = reportSheets(report);
  const workbookSheets = sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const workbookRels = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const overrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${overrides}</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
    "docProps/core.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>DebtFree Payoff Report</dc:title><dc:creator>DebtFree Dashboard</dc:creator><dc:description>Household budget and debt payoff tracker export</dc:description><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`),
    "docProps/app.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>DebtFree Dashboard</Application><TitlesOfParts><vt:vector size="${sheets.length}" baseType="lpstr">${sheets.map((sheet) => `<vt:lpstr>${xmlEscape(sheet.name)}</vt:lpstr>`).join("")}</vt:vector></TitlesOfParts></Properties>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${workbookSheets}</sheets><calcPr calcId="191029"/></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(workbookStylesXml()),
  };
  sheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheetXml(sheet)); });
  const bytes = zipSync(files, { level: 6 });
  downloadBlob(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), reportFilename("xlsx"));
}
type PdfDocument = import("jspdf").jsPDF;
type AutoTable = (typeof import("jspdf-autotable"))["default"];
type PdfWithLastTable = PdfDocument & { lastAutoTable?: { finalY: number } };

function pdfPageHeader(doc: PdfDocument, title: string) {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(title, 10, 6.5);
}

function pdfTable(doc: PdfDocument, autoTable: AutoTable, title: string, headers: string[], rows: (string | number)[][], startY?: number) {
  let y = startY ?? 18;
  if (y > doc.internal.pageSize.getHeight() - 35) { doc.addPage(); y = 18; }
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, 10, y);
  autoTable(doc, {
    startY: y + 4,
    head: [headers],
    body: rows.length ? rows : [["No records available", ...headers.slice(1).map(() => "")]],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 2, lineColor: [221, 229, 238], lineWidth: 0.2, textColor: NAVY },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 250, 253] },
    margin: { top: 16, right: 10, bottom: 14, left: 10 },
    didDrawPage: () => pdfPageHeader(doc, "DebtFree payoff report"),
  });
  return (doc as PdfWithLastTable).lastAutoTable?.finalY ?? y + 10;
}

function drawPdfKpi(doc: PdfDocument, x: number, y: number, width: number, label: string, value: string, color: readonly [number, number, number]) {
  doc.setFillColor(248, 250, 253);
  doc.setDrawColor(223, 229, 236);
  doc.roundedRect(x, y, width, 22, 2.5, 2.5, "FD");
  doc.setFillColor(...color);
  doc.rect(x, y, 2.2, 22, "F");
  doc.setTextColor(111, 124, 143);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(label.toUpperCase(), x + 5, y + 7);
  doc.setTextColor(...NAVY);
  doc.setFontSize(12);
  doc.text(value, x + 5, y + 16);
}

export async function exportPayoffPdf(report: PayoffReportData) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter", compress: true });
  doc.setProperties({ title: "DebtFree Payoff Report", subject: "Household budget and payoff plan", author: "DebtFree Dashboard", creator: "DebtFree Dashboard" });
  const pageWidth = doc.internal.pageSize.getWidth();
  pdfPageHeader(doc, "DebtFree payoff report");
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("Your complete payoff plan", 10, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(111, 124, 143);
  doc.text(`${report.budgetMonth} household plan | ${report.strategy} strategy | Generated ${report.generatedAt}`, 10, 32);

  const gap = 4;
  const cardWidth = (pageWidth - 20 - gap * 3) / 4;
  drawPdfKpi(doc, 10, 39, cardWidth, "Starting debt", money(report.startingDebt), NAVY);
  drawPdfKpi(doc, 10 + cardWidth + gap, 39, cardWidth, "Debt-free date", report.projectedDebtFree, BLUE);
  drawPdfKpi(doc, 10 + (cardWidth + gap) * 2, 39, cardWidth, "Monthly payoff", money(report.monthlyPlan), GREEN);
  drawPdfKpi(doc, 10 + (cardWidth + gap) * 3, 39, cardWidth, "Estimated interest", money(report.estimatedInterest), ORANGE);
  drawPdfKpi(doc, 10, 65, cardWidth, "Income", money(report.totalIncome), GREEN);
  drawPdfKpi(doc, 10 + cardWidth + gap, 65, cardWidth, "Expenses", money(report.totalExpenses), ORANGE);
  drawPdfKpi(doc, 10 + (cardWidth + gap) * 2, 65, cardWidth, "Budget / set-asides", money(report.totalBudget), VIOLET);
  drawPdfKpi(doc, 10 + (cardWidth + gap) * 3, 65, cardWidth, "Available extra", money(report.availableExtra), BLUE);

  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Expense breakdown", 10, 96);
  const categories = spendingCategoryTotals(report).slice(0, 7);
  const maxCategory = Math.max(1, ...categories.map(([, amount]) => amount));
  if (!categories.length) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(111, 124, 143);
    doc.setFontSize(9);
    doc.text("No recurring expenses are entered for this month.", 10, 105);
  } else {
    categories.forEach(([category, amount], index) => {
      const y = 103 + index * 9;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...NAVY);
      doc.text(category, 10, y + 4);
      doc.setFillColor(235, 240, 246);
      doc.roundedRect(48, y, 95, 5, 2, 2, "F");
      doc.setFillColor(...ORANGE);
      doc.roundedRect(48, y, Math.max(3, 95 * amount / maxCategory), 5, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.text(money(amount), 148, y + 4);
    });
  }

  doc.setFillColor(237, 245, 255);
  doc.roundedRect(pageWidth - 93, 96, 83, 50, 3, 3, "F");
  doc.setTextColor(...BLUE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("PLAN NOTES", pageWidth - 87, 106);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  [
    `${report.monthsToPayoff} projected months to payoff`,
    `${money(report.totalMinimums)} in debt minimums`,
    `${money(report.extraPayment)} manually assigned extra`,
    report.stalled ? "Payments must increase to outpace interest" : "Current plan reaches a projected finish line",
  ].forEach((note, index) => doc.text(`- ${note}`, pageWidth - 87, 116 + index * 7));

  doc.addPage();
  let y = pdfTable(doc, autoTable, "Monthly budget breakdown", ["Type", "Name", "Category", "Payment method", "Linked account", "Amount"], report.cashflow.map((item) => [item.type, item.name, item.category, item.paymentMethod, item.linkedAccount, money(item.amount)]));
  y = pdfTable(doc, autoTable, "Debt accounts", ["Account", "Type", "Balance", "APR", "Interest / mo.", "Minimum", "Linked expenses", "Planned payment", "Projected payoff"], report.accounts.map((account) => [account.name, account.type, money(account.balance), percent(account.apr), money(account.monthlyInterest), money(account.minimumPayment), money(account.linkedCardExpenses), money(account.plannedMonthlyPayment), account.projectedPayoff]), y + 10);
  y = pdfTable(doc, autoTable, "Month-by-month payoff schedule", ["Month", "Total paid", "Interest", "Remaining", "Milestone"], report.schedule.map((entry) => [entry.month, money(entry.totalPaid), money(entry.interest), money(entry.remaining), entry.milestone]), y + 10);

  report.accounts.filter((account) => account.balance > 0).forEach((account) => {
    const rows = report.schedule.map((entry) => ({ entry, detail: entry.accounts.find((item) => item.name === account.name) }))
      .filter(({ detail }) => detail && (detail.payment > 0 || detail.endingBalance > 0))
      .map(({ entry, detail }) => [entry.month, money(detail?.payment ?? 0), money(detail?.endingBalance ?? 0), entry.milestone.includes(account.name) ? entry.milestone : ""]);
    y = pdfTable(doc, autoTable, `${account.name} payment detail`, ["Month", "Payment", "Ending balance", "Milestone"], rows, y + 10);
  });

  y = pdfTable(doc, autoTable, "Transaction ledger", ["Date", "Merchant / recipient", "Account", "Type", "Category", "Memo", "Amount", "Status"], report.transactions.map((transaction) => [transaction.date, transaction.merchant, transaction.account, transaction.type, transaction.category, transaction.memo, money(transaction.amount), transaction.status]), y + 10);
  const snapshotRows: (string | number)[][] = [];
  report.snapshots.forEach((snapshot) => {
    if (!snapshot.accounts.length) snapshotRows.push([snapshot.month, snapshot.capturedAt, "", money(snapshot.totalBalance), money(snapshot.monthlyInterest), snapshot.projectedDebtFree, snapshot.note]);
    snapshot.accounts.forEach((account) => snapshotRows.push([snapshot.month, snapshot.capturedAt, account.name, money(account.balance), money(snapshot.monthlyInterest), snapshot.projectedDebtFree, snapshot.note]));
  });
  pdfTable(doc, autoTable, "Payoff snapshot history", ["Month", "Captured", "Account", "Balance", "Monthly interest", "Projected debt-free", "Note"], snapshotRows, y + 10);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(223, 229, 236);
    doc.line(10, doc.internal.pageSize.getHeight() - 10, pageWidth - 10, doc.internal.pageSize.getHeight() - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(111, 124, 143);
    doc.text("DebtFree Dashboard | Personal planning report - estimates are not financial advice", 10, doc.internal.pageSize.getHeight() - 5);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - 10, doc.internal.pageSize.getHeight() - 5, { align: "right" });
  }
  doc.save(reportFilename("pdf"));
}