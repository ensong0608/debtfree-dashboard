import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Independent synthetic component harness: no app server, storage or household API.
let javascript = "";
let css = "";
const now = "2026-10-17T12:00:00.000Z";
const event = (before: number, after: number, recordedAt: string) => ({ action: "save", recordedAt, effectiveDate: "2026-10-12", movement: [{ accountId: "demo-card", before, after }] });
const transaction = (id: string, extra = {}) => ({ id, accountId: "demo-card", date: "2026-10-12", type: "payment", amount: 100, payeeId: "", payeeName: "", category: "", memo: "", title: id, createdAt: "2026-10-12T12:00:00.000Z", updatedAt: now, deletedAt: null, ...extra });
const adjustment = (id: string, deletedAt: string) => ({ id, accountId: "demo-card", date: "2026-10-12", balanceBefore: 1000, balanceAfter: 900, difference: -100, createdAt: now, title: id, deletedAt });

test.beforeAll(async () => {
  const result = await build({
    stdin: { contents: `import {createRoot} from 'react-dom/client'; import {useState} from 'react'; import PaymentsPage from './app/payments-page'; import DebtEntryDialog from './app/debt-entry-dialog'; import {changeDebtEntry} from './app/debt-transactions'; import {HouseholdCurrencyProvider} from './app/household-currency-context'; import {createDemoFixture} from './mobile/demo-fixture'; import './app/globals.css'; import './app/design-system.css'; import './app/reference-layout.css'; const data=window.__fixture; const account={...createDemoFixture().payload.accounts[0],id:'demo-card',name:'Synthetic card',balance:1000}; const noop=()=>{}; window.__before=JSON.stringify(data); window.__commands=[];
function Harness(){const [state,setState]=useState({accounts:[account],transactions:data.transactions||[],adjustments:data.adjustments||[]});window.__state=state;window.__staleUpdate=()=>setState(current=>({...current,transactions:current.transactions.map(entry=>({...entry,memo:'Concurrent change'}))}));const save=(command,expected)=>{window.__commands.push({command,expected});if(expected!==JSON.stringify(state))return 'Entry changed. Reopen it.';try{setState(changeDebtEntry(state,command,undefined,'2026-10-17T12:00:00.000Z','synthetic-new'));return null;}catch(error){return error.message;}};return <HouseholdCurrencyProvider currency={data.currency||'USD'}>{data.newEntry?<DebtEntryDialog mobile state={state} command={{action:'save'}} readOnly={false} onSave={save} onClose={noop} onRequestDelete={noop}/>:<PaymentsPage mobile={data.mobile!==false} readOnly={!!data.readOnly} accounts={state.accounts} storedAccounts={state.accounts} transactions={state.transactions} adjustments={state.adjustments} message='' onConfirm={noop} onUndoConfirmation={noop} onChange={save} onDialog={noop}/>}</HouseholdCurrencyProvider>;}createRoot(document.getElementById('root')).render(<Harness/>);`, resolveDir: process.cwd(), loader: "tsx" },
    bundle: true, write: false, outfile: path.resolve(".wrangler/mobile-transactions/harness.js"), jsx: "automatic",
    plugins: [{ name: "plain-global-css", setup(builder) { builder.onLoad({ filter: /[\\/]app[\\/]globals\.css$/ }, async args => ({ contents: (await readFile(args.path, "utf8")).replace('@import "tailwindcss";', '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}'), loader: "css" })); } }],
  });
  javascript = result.outputFiles!.find(file => file.path.endsWith(".js"))!.text;
  css = result.outputFiles!.find(file => file.path.endsWith(".css"))!.text;
});

async function render(page: Page, data: object) {
  await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(fixture => { (window as unknown as { __fixture: object }).__fixture = fixture; }, data);
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://mobile-transactions.test") return route.abort();
    if (url.pathname === "/harness.js") return route.fulfill({ contentType: "text/javascript", body: javascript });
    if (url.pathname === "/harness.css") return route.fulfill({ contentType: "text/css", body: css });
    return route.fulfill({ contentType: "text/html", body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/harness.css"></head><body style="overflow:auto"><div id="root"></div><script src="/harness.js"></script></body></html>' });
  });
  await page.goto("http://mobile-transactions.test/");
  if ((data as { newEntry?: boolean }).newEntry) await expect(page.getByRole("dialog", { name: "New transaction", exact: true })).toBeVisible();
  else await expect(page.getByRole("heading", { name: "Transactions", exact: true })).toBeAttached();
}

for (const width of [320, 390]) test(`mobile summary keeps three cards, large amounts and accessible dialogs at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await render(page, { transactions: [transaction("Large payment", { amount: 123456789.12 }), transaction("Fee", { type: "fee", amount: 52.25 })] });
  await expect(page.locator('.transaction-month-control b')).toHaveText("OCT 2026");
  await expect(page.getByLabel("Month", { exact: true })).toHaveValue("2026-10");
  await expect(page.getByRole("combobox", { name: "Account", exact: true })).toHaveValue("all");
  await expect(page.getByRole("option", { name: "ALL", exact: true })).toBeAttached();
  const cards = page.getByRole("region", { name: "Monthly transaction summary" }).locator("article");
  await expect(cards).toHaveCount(3);
  const boxes = await cards.evaluateAll(elements => elements.map(element => { const box = element.getBoundingClientRect(); return { y: box.y, right: box.right, width: box.width, overflow: element.scrollWidth > element.clientWidth }; }));
  expect(new Set(boxes.map(box => box.y)).size).toBe(1);
  expect(boxes.every(box => box.right <= width && box.width > 60 && !box.overflow)).toBe(true);
  expect(await page.locator(".transaction-signed-total").evaluateAll(elements => elements.every(element => element.scrollWidth <= element.clientWidth))).toBe(true);
  const spacing = await cards.locator("button").evaluateAll(buttons => buttons.map(button => ({
    centered: getComputedStyle(button.querySelector("strong")!).textAlign === "center",
    minimum: getComputedStyle(button).minHeight,
    countMargin: getComputedStyle(button.querySelector("small")!).marginTop,
  })));
  expect(spacing.every(value => value.centered && value.minimum === "0px" && value.countMargin === "0px")).toBe(true);
  await page.screenshot({ path: `.wrangler/mobile-transactions/summary-${width}.png` });
  await expect(cards.nth(2)).toContainText("−$123,456,736.87");
  await expect(page.getByText("Payments this month", { exact: true })).toHaveCount(0);
  for (const title of ["Payments recorded", "Interest & fees", "Net balance change"]) {
    const trigger = page.getByRole("button", { name: `Explain ${title}`, exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: title, exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close explanation" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Close explanation" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("debt history includes early and recent payments, excludes other debts and expands older months", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  const older = Array.from({length: 10}, (_, i) => transaction(`Older ${i}`, {date: `2026-09-${String(i + 1).padStart(2, "0")}`}));
  await render(page, { transactions: [transaction("Recent", {date: "2026-10-19"}), transaction("Early", {date: "2026-10-02"}), transaction("Other debt", {accountId: "another-card"}), transaction("Deleted", {deletedAt: now}), ...older] });
  const card = page.locator('[data-activity-id="transaction:Recent"]');
  await card.getByText("Debt history", {exact: true}).click();
  const history = card.getByLabel("Transaction activity for Synthetic card");
  await expect(history.getByRole("listitem")).toHaveCount(10);
  await expect(history.getByRole("listitem").first()).toContainText("Recent");
  await expect(history).toContainText("Early");
  await expect(history).not.toContainText("Other debt");
  await expect(history).not.toContainText("Deleted");
  await expect(history.locator('[data-current="true"]')).toContainText("Recent");
  await history.getByRole("button", {name: "Show all 12 entries"}).click();
  await expect(history.getByRole("listitem")).toHaveCount(12);
  const dates = await history.locator("time").evaluateAll(elements => elements.map(element => element.getAttribute("datetime")));
  expect(dates).toEqual([...dates].sort().reverse());
  await history.getByRole("button", {name: "Show recent activity"}).click();
  await expect(history.getByRole("listitem")).toHaveCount(10);
  expect(await page.evaluate(() => JSON.stringify((window as unknown as {__fixture: object}).__fixture) === (window as unknown as {__before: string}).__before)).toBe(true);
});

test("seven-day visible recovery boundary covers transactions and adjustments without mutating tombstones", async ({ page }) => {
  const boundary = "2026-10-10T12:00:00.000Z";
  const recent = "2026-10-10T12:00:00.001Z";
  await render(page, { transactions: [transaction("Recent", { deletedAt: recent }), transaction("Boundary", { deletedAt: boundary }), transaction("Old", { deletedAt: "2026-10-01T12:00:00Z" }), transaction("Invalid", { deletedAt: "unavailable" }), transaction("Replaced", { deletedAt: recent, replacedByTransactionId: "replacement" })], adjustments: [adjustment("Recent adjustment", recent), adjustment("Boundary adjustment", boundary), adjustment("Invalid adjustment", "invalid")] });
  const recovery = page.locator(".deleted-payments");
  await recovery.getByText("Recently deleted (4)", { exact: true }).click();
  await expect(recovery.getByRole("button", { name: /^Restore/ })).toHaveCount(4);
  expect(await page.evaluate(() => JSON.stringify((window as unknown as { __fixture: object }).__fixture) === (window as unknown as { __before: string }).__before)).toBe(true);
});

test("desktop fallback and viewer controls are preserved", async ({ page }) => {
  await render(page, { mobile: false, readOnly: true, transactions: [transaction("Viewer payment"), transaction("Old deleted", { deletedAt: "2026-10-01T12:00:00Z" })] });
  await expect(page.getByRole("button", { name: /^Explain/ })).toHaveCount(3);
  await expect(page.getByRole("button", { name: /^Explain/ }).locator("svg")).toHaveCount(0);
  await page.getByRole("button", { name: "Explain Payments recorded", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Payments recorded", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close explanation", exact: true }).click();
  await expect(page.locator(".transaction-reporting")).toBeAttached();
  await expect(page.getByRole("button", { name: "Edit Viewer payment for Synthetic card" })).toBeDisabled();
  await page.getByText("Deleted transactions (1)", { exact: true }).click();
  await expect(page.getByRole("button", { name: /^Restore/ })).toBeDisabled();
});


test("mobile retains edit/delete/restore dialogs and disables mutations for viewers", async ({ page }) => {
  await render(page, { transactions: [transaction("Editable"), transaction("Recoverable", { deletedAt: now })] });
  await page.getByRole("button", { name: "Edit Editable for Synthetic card", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit transaction", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close transaction", exact: true }).click();
  await page.getByRole("button", { name: "Edit Editable for Synthetic card", exact: true }).click();
  await page.getByRole("button", { name: "Delete transaction", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Delete payment?", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByText("Recently deleted (1)", { exact: true }).click();
  await page.getByRole("button", { name: "Restore payment of $100.00 for Synthetic card", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Restore payment?", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("mobile viewer can inspect summaries and history without mutation controls", async ({ page }) => {
  await render(page, { readOnly: true, transactions: [transaction("Viewer") ] });
  await expect(page.getByRole("button", { name: "Edit Viewer for Synthetic card", exact: true })).toBeDisabled();
  await expect(page.locator(".transaction-delete-x")).toHaveCount(0);
  await page.getByRole("button", { name: "Explain Payments recorded", exact: true }).click();
  await page.getByRole("button", { name: "Close explanation", exact: true }).click();
  await page.getByText("Debt history", { exact: true }).click();
  await expect(page.getByLabel("Transaction activity for Synthetic card")).toBeVisible();
});

test("debt history keeps large PHP values readable and omits uncaptured balances", async ({ page }) => {
  await page.setViewportSize({width: 390, height: 1100});
  await render(page, {currency: "PHP", transactions: [transaction("Groceries", {type: "charge", amount: 12345678.12}), transaction("Captured", {balanceBefore: 1000, balanceAfter: 900}), transaction("Included", {includedIn: {type: "adjustment", id: "anchor"}})]});
  const card = page.locator('[data-activity-id="transaction:Groceries"]');
  await card.getByText("Debt history", {exact: true}).click();
  const history = card.getByLabel("Transaction activity for Synthetic card");
  await expect(history).toContainText("+₱12,345,678.12");
  await expect(history.getByRole("listitem").filter({hasText: "Captured"})).toContainText("Balance: ₱900.00");
  await expect(history.getByRole("listitem").filter({hasText: "Groceries"})).not.toContainText("Balance:");
  await expect(history.getByRole("listitem").filter({hasText: "Included"})).toContainText("Included");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: ".wrangler/mobile-transactions/debt-history-390.png"});
});

test("PHP input symbol and delete confirmation discard unsaved edits and commit only original command", async ({ page }) => {
  await render(page, { currency: "PHP", transactions: [transaction("Original payment")] });
  await page.getByRole("button", { name: "Edit Original payment for Synthetic card", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Edit transaction", exact: true });
  await expect(dialog.locator(".signed-money-input > span")).toHaveText("₱");
  await dialog.getByLabel("What’s it for?", { exact: true }).fill("Unsaved title");
  await dialog.getByLabel("Transaction amount", { exact: true }).fill("-999");
  await dialog.getByRole("button", { name: "Delete transaction", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Delete payment?", exact: true });
  await expect(dialog).toContainText("Original payment");
  await expect(dialog).toContainText("₱100.00");
  await expect(dialog).not.toContainText("Unsaved title");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as {__commands:object[]}).__commands.length)).toBe(0);
  await page.getByRole("button", { name: "Edit Original payment for Synthetic card", exact: true }).click();
  await page.getByRole("button", { name: "Delete transaction", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as {__commands:{command:object}[]}).__commands.map(call => call.command))).toEqual([{action:"delete",id:"transaction:Original payment"}]);
  const state = await page.evaluate(() => (window as unknown as {__state:{transactions:{amount:number;title:string;deletedAt:string}[]}}).__state);
  expect(state.transactions[0].amount).toBe(100);
  expect(state.transactions[0].title).toBe("Original payment");
  expect(state.transactions[0].deletedAt).toBe(now);
});

test("delete confirmation preserves stale expected-state guard and new dialogs offer no Delete", async ({ page }) => {
  await render(page, { transactions: [transaction("Stale payment")] });
  await page.getByRole("button", { name: "Edit Stale payment for Synthetic card", exact: true }).click();
  await page.evaluate(() => (window as unknown as {__staleUpdate:()=>void}).__staleUpdate());
  await page.getByRole("button", { name: "Delete transaction", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Entry changed. Reopen it.");
  expect(await page.evaluate(() => (window as unknown as {__state:{transactions:{deletedAt:null}[]}}).__state.transactions[0].deletedAt)).toBeNull();
});

test("new entry never offers Delete", async ({ page }) => {
  await render(page, { newEntry: true });
  await expect(page.getByRole("dialog", { name: "New transaction", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete transaction", exact: true })).toHaveCount(0);
});


test("heading does not repeat a title that already names the transaction type", async ({ page }) => {
  await render(page, { transactions: [transaction("Payment")] });
  await expect(page.locator('[data-activity-id="transaction:Payment"] .transaction-clean-name > strong')).toHaveText("Payment");
  await expect(page.locator('[data-activity-id="transaction:Payment"] .transaction-amount small')).toHaveCount(0);
});


test("negative PHP history preserves sign, original movement and fixture bytes", async ({ page }) => {
  await render(page, { currency: "PHP", transactions: [transaction("Large original", { amount: 12345678.12, balanceBefore: 12346678.12, balanceAfter: 1000, balanceEvents: [event(12346678.12, 1000, "2026-10-12T12:00:00.000Z")] })] });
  await page.getByText("Debt history", { exact: true }).click();
  const history = page.getByLabel("Transaction activity for Synthetic card");
  await expect(history.getByRole("listitem")).toHaveCount(1);
  await expect(history).toContainText("\u2212₱12,345,678.12");
  expect(await page.evaluate(() => JSON.stringify((window as unknown as {__fixture:object}).__fixture) === (window as unknown as {__before:string}).__before)).toBe(true);
});
