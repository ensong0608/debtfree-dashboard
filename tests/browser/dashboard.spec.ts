import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import { readFileSync } from "node:fs";

test("Payments connects lender updates and recorded payments without a second deduction", async ({ page }) => {
  const fixture = JSON.parse(readFileSync(path.resolve("tests/fixtures/legacy-v0.json"), "utf8"));
  fixture.transactions = [];
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "payment-flow.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  const card = page.locator(".balance-first-cards>article").filter({ hasText: "Sample Rewards Card" });
  await expect(card.locator(".simple-balance")).toHaveText("$2,450.75");
  await card.getByRole("button", { name: "Update balance for Sample Rewards Card", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("New current balance").fill("");
  await expect(dialog.getByRole("button", { name: "Confirm balance update" })).toBeDisabled();
  await dialog.getByLabel("New current balance").fill("2300.75");
  await dialog.getByRole("button", { name: "Confirm balance update" }).click();
  await page.getByRole("button", { name: "Payments", exact: true }).click();
  const adjustment = page.locator(".payment-activity>article").filter({ hasText: "Sample Rewards Card" }).first();
  await expect(adjustment).toContainText("Balance adjustment");
  await expect(page.locator(".simple-total>strong")).toHaveText("$0.00");
  await adjustment.getByText("This was a payment", { exact: true }).click();
  await adjustment.getByRole("button", { name: "Confirm as payment" }).click();
  await expect(page.locator(".simple-total>strong")).toHaveText("$150.00");
  await page.getByRole("button", { name: "Debts", exact: true }).click();
  await expect(card.locator(".simple-balance")).toHaveText("$2,300.75");
  await page.getByRole("button", { name: "Payments", exact: true }).click();
  await page.getByRole("button", { name: "Record payment", exact: true }).click();
  await dialog.getByLabel("Payment debt", { exact: true }).selectOption("account-card-1");
  await dialog.getByLabel("Payment amount").fill("100");
  const originalViewport = page.viewportSize()!;
  if (originalViewport.width <= 430) {
    await page.setViewportSize({ width: originalViewport.width, height: 420 });
    await dialog.getByRole("button", { name: "Confirm payment" }).scrollIntoViewIfNeeded();
    await expect(dialog.getByRole("button", { name: "Confirm payment" })).toBeVisible();
    await page.setViewportSize(originalViewport);
  }
  await dialog.getByRole("button", { name: "Confirm payment" }).click();
  await expect(page.locator(".simple-total>strong")).toHaveText("$250.00");
  await page.reload();
  await expect(card.locator(".simple-balance")).toHaveText("$2,200.75");
  await page.getByRole("button", { name: "Payments", exact: true }).click();
  await expect(page.locator(".simple-total>strong")).toHaveText("$250.00");
  await page.getByRole("button", { name: "Keep as adjustment", exact: true }).click();
  await expect(page.locator(".simple-total>strong")).toHaveText("$100.00");
  await page.getByRole("button", { name: "Debts", exact: true }).click();
  await expect(card.locator(".simple-balance")).toHaveText("$2,200.75");
});

test("phone navigation and long account names fit 360, 390, and 430px", async ({ page }, testInfo) => {
  const fixture = JSON.parse(readFileSync(path.resolve("tests/fixtures/legacy-v0.json"), "utf8"));
  fixture.accounts[0].name = "Family rewards credit card for groceries and household expenses";
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  fixture.monthlyBudgets[month] = [{ id: "income-phone", name: "Household salary", kind: "income", category: "Salary", amount: 6500, paymentMethod: "debit", creditAccountId: "", recurring: true, createdAt: now.toISOString() }, { id: "mortgage-phone", name: "Mortgage and monthly property escrow", kind: "expense", category: "Housing", amount: 1800, paymentMethod: "debit", creditAccountId: "", recurring: true, createdAt: now.toISOString() }];
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "phone-fixture.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator(".save-state")).toBeVisible();
    const boxes = await page.locator('nav[aria-label="Primary navigation"] button').evaluateAll(buttons => buttons.map(button => ({ y: button.getBoundingClientRect().y, height: button.getBoundingClientRect().height })));
    expect(boxes).toHaveLength(4);
    expect(new Set(boxes.map(box => Math.round(box.y))).size).toBe(1);
    expect(boxes.every(box => box.height >= 48)).toBe(true);
    for (const name of ["Debts", "Payments", "Budget", "More"]) {
      await page.getByRole("button", { name, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      if (width === 390 && testInfo.project.name === "phone") await page.screenshot({ path: `outputs/updated-${name.toLowerCase()}-390.png` });
    }
  }
});

test("create a household plan, record payment, change strategy and restore a backup", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Start my payoff plan" }).click();
  await page.getByLabel("Income source name").fill("Household salary");
  await page.getByLabel(/Monthly take-home amount/).fill("5000");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  for (let i = 0; i < 3; i++) {
    if (i) await page.getByRole("button", { name: /Add another debt/ }).click();
    await page.getByLabel("Debt name", { exact: true }).nth(i).fill(`Test card ${i + 1}`);
    await page.getByLabel(/Current balance/).nth(i).fill("1000");
    await page.getByRole("spinbutton", { name: /^APR/ }).nth(i).fill("18");
    await page.getByLabel(/Minimum monthly payment/).nth(i).fill("50");
  }
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel(/Total monthly debt-payment amount/).fill("500");
  await page.getByRole("button", { name: /Generate/ }).click();
  await page.getByRole("button", { name: "Continue into the application" }).click();
  await expect(page.getByRole("heading", { name: "Debts", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Payments", exact: true }).click();
  await page.getByRole("button", { name: "Record payment", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Payment amount/).fill("100");
  await dialog.getByRole("button", { name: "Confirm payment" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Debts", exact: true }).click();
  await page.getByRole("button", { name: "Update balance for Test card 1", exact: true }).filter({ visible: true }).click();
  await page.getByRole("dialog").getByLabel(/New current balance/).fill("850");
  await page.getByRole("button", { name: "Confirm balance update" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Budget", exact: true }).click();
  await expect(page.getByRole("button", { name: /Edit Household salary/ })).toBeVisible();
  await page.getByText("Detailed spending tracking (optional)", { exact: true }).click();
  await page.getByLabel("Enable detailed spending tracking").check();
  await page.getByLabel("Enable detailed spending tracking").uncheck();
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await page.getByRole("button", { name: "Copy recurring items" }).click();
  await expect(page.getByRole("button", { name: /Edit Household salary/ })).toBeVisible();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: "Payoff Plan", exact: true }).click();
  await page.getByRole("button", { name: /Snowball/, exact: false }).first().click();
  await expect(page.getByRole("heading", { name: "What if we paid more each month?" })).toBeVisible();
  const savedExtra = page.getByText(/^Saved extra:/);
  const beforeScenario = await savedExtra.textContent();
  await page.getByLabel(/Custom additional amount/).fill("50");
  await expect(savedExtra).toHaveText(beforeScenario!);
  await page.getByRole("button", { name: "Apply this amount to my plan" }).click();
  await expect(savedExtra).not.toHaveText(beforeScenario!);
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export full backup", exact: true }).click();
  const file = await download;
  const filePath = await file.path();
  await page.locator('input[type="file"][accept=".json,application/json"]').setInputFiles(filePath!);
  await page.getByRole("button", { name: "Replace and import" }).click();
  await expect(page.getByText(/Full backup restored/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Debts", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("legacy import and modal keyboard focus work without document overflow", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(path.resolve("tests/fixtures/legacy-v0.json"));
  await expect(page.getByRole("button", { name: "Debts", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Debts", exact: true }).click();
  const trigger = page.getByRole("button", { name: /Add debt/, exact: false }).first();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(accessibility.violations.filter(v => v.impact === "critical" || v.impact === "serious").map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
});

test("unauthenticated API requests cannot read or change household data", async ({ request }) => {
  expect((await request.get("/api/household")).status()).toBe(401);
  expect((await request.put("/api/household", { data: { revision: 0, payload: {} } })).status()).toBe(401);
  expect((await request.post("/api/household/members", { data: { email: "test@example.test" } })).status()).toBe(401);
  expect((await request.get("/api/health")).status()).toBe(401);
});

test("paid expense and minimum records preserve balances, survive reload, and can be undone", async ({page}) => {
 const {readFileSync} = await import("node:fs");
 const fixture = JSON.parse(readFileSync(path.resolve("tests/fixtures/legacy-v0.json"),"utf8"));
 const now=new Date();const month=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
 fixture.monthlyBudgets[month]=[{id:"paid-rent",name:"Paid rent",kind:"expense",category:"Housing",amount:500,paymentMethod:"debit",creditAccountId:"",createdAt:now.toISOString(),recurring:true},{id:"paid-card",name:"Included card expense",kind:"expense",category:"Other",amount:20,paymentMethod:"credit",creditAccountId:"account-card-1",createdAt:now.toISOString(),recurring:true}];
 fixture.transactions=[];
 await page.goto("/");
 await page.locator('input[type="file"]').setInputFiles({name:"paid-setup.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fixture))});
 await page.getByRole("button",{name:"More",exact:true}).click();
 await page.getByRole("button",{name:"Home",exact:true}).click();
 const balance = page.locator(".home-summary article").filter({hasText:/Total remaining debt/i}).locator("strong");
 const before=await balance.textContent();
 await page.getByRole("button",{name:"Budget",exact:true}).click();
 await page.getByRole("button",{name:"Record paid for Paid rent",exact:true}).click();
 await expect(page.getByLabel("Paid using")).toHaveValue("debit");
 await page.getByRole("button",{name:"Save paid record"}).click();
 await expect(page.getByRole("button",{name:"Edit Paid rent",exact:true})).toContainText("$0.00");
 await page.getByRole("button",{name:"Record paid for Included card expense",exact:true}).click();
 await expect(page.getByLabel("Paid using")).toHaveValue("included");
 await page.getByRole("button",{name:"Save paid record"}).click();
 await page.getByRole("button",{name:"Minimum already paid for Sample Rewards Card",exact:true}).click();
 await page.getByRole("button",{name:"Save paid record"}).click();
 await expect(page.getByRole("button",{name:"Minimum already paid for Sample Rewards Card",exact:true})).toHaveCount(0);
 await page.reload();
 await page.getByRole("button",{name:"More",exact:true}).click();
 await page.getByRole("button",{name:"Home",exact:true}).click();
 await expect(balance).toHaveText(before!);
 await page.getByRole("button",{name:"Budget",exact:true}).click();
 await expect(page.getByRole("button",{name:"Undo paid record for Paid rent",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Next month",exact:true}).click();
 await page.getByRole("button",{name:"Copy recurring items",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Paid records without balance changes"})).toHaveCount(0);
 await page.getByRole("button",{name:"Previous month",exact:true}).click();
 await page.getByRole("button",{name:"Undo paid record for Sample Rewards Card",exact:true}).click();
 await expect(page.getByRole("button",{name:"Minimum already paid for Sample Rewards Card",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Undo paid record for Paid rent",exact:true}).click();
 await expect(page.getByRole("button",{name:"Edit Paid rent",exact:true})).toContainText("$0.00");
});
