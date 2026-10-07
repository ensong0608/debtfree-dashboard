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
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  const adjustment = page.locator(".payment-activity>article").filter({ hasText: "Sample Rewards Card" }).first();
  await expect(adjustment).toContainText("Balance adjustment");
  await expect(page.locator(".simple-total>strong")).toHaveText("$0.00");
  await adjustment.getByText("This was a payment", { exact: true }).click();
  await adjustment.getByRole("button", { name: "Confirm as payment" }).click();
  await expect(page.locator(".simple-total>strong")).toHaveText("$150.00");
  await page.getByRole("button", { name: "Debts", exact: true }).click();
  await expect(card.locator(".simple-balance")).toHaveText("$2,300.75");
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
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
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
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
    for (const name of ["Debts", "Transactions", "Budget", "More"]) {
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
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
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
  await page.getByLabel("Extra each month", { exact: true }).fill("7000");
  await expect(page.getByText("Monthly calculator amount", { exact: true })).toBeVisible();
  await expect(page.locator(".plan-hero")).toContainText("$7,000.00");
  await expect(page.getByText("What-if calculator", { exact: true })).toHaveCount(0);
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

test("duplicate payments can be deleted, cancelled, and restored from Payments", async ({page}) => {
 const fixture=JSON.parse(readFileSync(path.resolve("tests/fixtures/legacy-v0.json"),"utf8"));fixture.transactions=[];
 await page.goto("/");
 await page.locator('input[type="file"]').setInputFiles({name:"delete-fixture.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fixture))});
 await page.getByRole("button",{name:"Transactions",exact:true}).click();
 for(let i=0;i<2;i++){
  await page.getByRole("button",{name:"Record payment",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByLabel("Payment debt",{exact:true}).selectOption("account-card-1");
  await dialog.getByLabel("Payment amount",{exact:true}).fill("100");
  await dialog.getByRole("button",{name:"Confirm payment",exact:true}).click();
 }
 await expect(page.locator(".simple-total>strong")).toHaveText("$200.00");
 const deleteButton=page.getByRole("button",{name:"Delete payment of $100.00 for Sample Rewards Card",exact:true}).first();
 await deleteButton.click();
 await expect(page.getByRole("dialog")).toContainText("$2,350.75");
 await page.getByRole("dialog").getByRole("button",{name:"Cancel",exact:true}).click();
 await expect(page.locator(".simple-total>strong")).toHaveText("$200.00");
 await deleteButton.click();
 await page.getByRole("dialog").getByRole("button",{name:"Confirm delete",exact:true}).click();
 await expect(page.locator(".simple-total>strong")).toHaveText("$100.00");
 await expect(page.locator(".payment-activity>article")).toHaveCount(1);
 await expect(page.getByRole("button",{name:"Refresh dashboard",exact:true})).toBeEnabled();
 await page.getByRole("button",{name:"Refresh dashboard",exact:true}).click();
 const card=page.locator(".balance-first-cards>article").filter({hasText:"Sample Rewards Card"});
 await expect(card.locator(".simple-balance")).toHaveText("$2,350.75");
 await page.getByRole("button",{name:"Transactions",exact:true}).click();
 await page.getByText("Deleted transactions (1)",{exact:true}).click();
 await page.getByRole("button",{name:"Restore payment of $100.00 for Sample Rewards Card",exact:true}).click();
 await expect(page.getByRole("dialog")).toContainText("$2,250.75");
 await page.getByRole("dialog").getByRole("button",{name:"Confirm restore",exact:true}).click();
 await expect(page.locator(".simple-total>strong")).toHaveText("$200.00");
 await expect(page.locator(".payment-activity>article")).toHaveCount(2);
 await page.getByRole("button",{name:"Debts",exact:true}).click();
 await expect(card.locator(".simple-balance")).toHaveText("$2,250.75");
});

test("payment amount stays readable with a phone keyboard viewport", async ({page},testInfo)=>{
 const fixture=JSON.parse(readFileSync(path.resolve("tests/fixtures/legacy-v0.json"),"utf8"));fixture.transactions=[];
 fixture.accounts[0].name="Family rewards card for groceries and household expenses";
 await page.goto("/");
 await page.locator('input[type="file"]').setInputFiles({name:"keyboard-fixture.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fixture))});
 await page.getByRole("button",{name:"Transactions",exact:true}).click();
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:844});
  await page.getByRole("button",{name:"Record payment",exact:true}).click();
  const dialog=page.getByRole("dialog");
  const amount=dialog.getByLabel("Payment amount",{exact:true});
  await amount.fill("123.45");
  // Android browsers can shrink visualViewport while keeping the layout viewport tall.
  await page.evaluate(()=>{Object.defineProperty(window.visualViewport!,"height",{configurable:true,value:330});Object.defineProperty(window.visualViewport!,"offsetTop",{configurable:true,value:20});window.visualViewport!.dispatchEvent(new Event("resize"));});
  await expect.poll(()=>amount.evaluate(el=>{const rect=el.getBoundingClientRect();return rect.top>=20 && rect.bottom<=350;})).toBe(true);
  expect(await amount.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(24);
  await expect(amount).toHaveValue("123.45");
  const confirm=dialog.getByRole("button",{name:"Confirm payment",exact:true});
  await confirm.scrollIntoViewIfNeeded();
  const box=await confirm.boundingBox();expect(box!.y).toBeGreaterThanOrEqual(20);expect(box!.y+box!.height).toBeLessThanOrEqual(350);
  await amount.focus();
  await amount.evaluate(el=>el.scrollIntoView({block:"nearest"}));
  if(width===390 && testInfo.project.name==="phone")await page.screenshot({path:"outputs/payment-keyboard-fixed-390.png"});
  await dialog.getByRole("button",{name:"Close payment form",exact:true}).click();
  await page.evaluate(()=>{delete (window.visualViewport as unknown as Record<string,unknown>).height;delete (window.visualViewport as unknown as Record<string,unknown>).offsetTop;window.visualViewport!.dispatchEvent(new Event("resize"));});
 }
});

test("Costco interest starts next cycle, survives refresh, and reconciles without a duplicate", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-03T20:00:00Z") });
  const fixture = JSON.parse(readFileSync(path.resolve("tests/fixtures/legacy-v0.json"), "utf8"));
  fixture.accounts[0].name = "Costco"; fixture.accounts[0].balance = 10075.60; fixture.accounts[0].apr = 23.74; fixture.transactions = [];
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "costco-test.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  const card = page.locator(".balance-first-cards>article").filter({ hasText: "Costco" });
  await expect(card.locator(".simple-balance")).toHaveText("$10,075.60");
  await card.getByRole("button", { name: "Edit debt details" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Automatically add estimated interest").check();
  const close = dialog.getByLabel("Latest closing date already included in my balance");
  await close.fill("2026-10-01");
  await expect(dialog.getByRole("button", { name: "Save details", exact: true })).toBeDisabled();
  await close.fill("2026-10-02");
  await expect(dialog.getByLabel(/^Estimated blended APR/)).toBeDisabled();
  const original = page.viewportSize()!;
  for (const width of [360,390,430]) {
    await page.setViewportSize({ width, height:844 });
    await dialog.getByLabel("Automatically add estimated interest").scrollIntoViewIfNeeded();
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  await page.setViewportSize(original);
  await dialog.getByRole("button", { name: "Save details", exact: true }).click();
  await card.getByRole("button", { name: "Edit debt details" }).click();
  await expect(dialog.getByLabel("Automatically add estimated interest")).toBeChecked();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(card.locator(".simple-balance")).toHaveText("$10,075.60");
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  await expect(page.locator(".payment-activity>article")).toHaveCount(0);
  await page.clock.setFixedTime(new Date("2026-11-03T20:00:00Z"));
  await page.reload();
  const blend=(3040*18.99+7438.18*22.99)/(3040+7438.18);
  const fee=Math.round(10075.60*blend/100*31/365*100)/100;
  const formatted = new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"}).format(10075.60+fee);
  await expect(card.locator(".simple-balance")).toHaveText(formatted);
  await page.reload();
  await expect(card.locator(".simple-balance")).toHaveText(formatted);
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  const activity=page.locator(".payment-activity>article").filter({hasText:"Estimated interest"});
  await expect(activity).toHaveCount(1);
  await expect(activity.getByRole("button", {name:/Delete payment/})).toHaveCount(0);
  await expect(page.locator(".simple-total>strong")).toHaveText("$0.00");
  await page.getByRole("button", { name: "Debts", exact: true }).click();
  await card.getByRole("button", {name:"Update balance for Costco",exact:true}).click();
  await dialog.getByLabel("New current balance").fill("10260.00");
  await dialog.getByLabel("Effective date").fill("2026-11-03");
  await dialog.getByRole("button", {name:"Confirm balance update"}).click();
  await expect(card.locator(".simple-balance")).toHaveText("$10,260.00");
  await page.reload();
  await expect(card.locator(".simple-balance")).toHaveText("$10,260.00");
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  await expect(activity).toHaveCount(1);
  await expect(activity).toContainText("Estimate reconciled to lender balance");
});

test("Debts can scroll to Wells Fargo on a desktop with many accounts", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop wheel and keyboard regression");
  const fixture = JSON.parse(readFileSync(path.resolve("tests/fixtures/legacy-v0.json"), "utf8"));
  fixture.transactions = [];
  fixture.accounts = Array.from({length:19},(_,index)=>({...fixture.accounts[0],id:"scroll-card-"+index,displayGroup:"Papi",displayOrder:index,name:index===18?"Wells Fargo":"Card "+String(index+1).padStart(2,"0"),interestFee:0}));
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({name:"scroll-fixture.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fixture))});
  const content = page.getByRole("region", {name:"Dashboard content"});
  const last = page.locator(".balance-first-cards>article").filter({hasText:"Wells Fargo"});
  await expect(last).toHaveCount(1);
  for (const viewport of [{width:1440,height:900},{width:1366,height:768},{width:1093,height:614}]) {
    await page.setViewportSize(viewport);
    const metrics = await content.evaluate(el=>({height:el.clientHeight,scrollHeight:el.scrollHeight,bottom:el.getBoundingClientRect().bottom,viewport:innerHeight,overflow:getComputedStyle(el).overflowY}));
    console.log("Desktop debt scrolling",viewport,metrics);
    expect(metrics.bottom).toBeLessThanOrEqual(viewport.height+1);
    expect(metrics.height).toBeGreaterThan(200);
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.height);
    await content.evaluate(el=>{el.scrollTop=0;});
    const bounds=await content.boundingBox();
    await page.mouse.move(bounds!.x+bounds!.width/2,bounds!.y+Math.min(100,bounds!.height/2));
    await page.mouse.wheel(0,2000);
    await expect.poll(()=>content.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
    await content.focus();
    await page.keyboard.press("Control+End");
    await expect.poll(()=>content.evaluate(el=>Math.abs(el.scrollHeight-el.clientHeight-el.scrollTop))).toBeLessThan(2);
    const button=last.getByRole("button",{name:"Update balance for Wells Fargo",exact:true});
    const visible=await button.evaluate(el=>{const box=el.getBoundingClientRect();return box.top>=0&&box.bottom<=innerHeight;});
    expect(visible).toBe(true);
    await button.click();
    await expect(page.getByRole("dialog",{name:"Update Wells Fargo balance"})).toBeVisible();
    await page.getByRole("button",{name:"Cancel",exact:true}).click();
  }
});


test("Transactions can add, edit, remove and restore purchases and balance adjustments", async ({ page }, testInfo) => {
  const fixture=JSON.parse(readFileSync(path.resolve("tests/fixtures/legacy-v0.json"),"utf8")); fixture.transactions=[];
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({name:"transaction-fixture.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fixture))});
  await page.getByRole("button",{name:"Transactions",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await page.getByRole("button",{name:"Add transaction",exact:true}).click();
  await dialog.getByLabel("Card used",{exact:true}).selectOption("account-card-1");
  await dialog.getByLabel("What’s it for?",{exact:true}).fill("SFC Henderson grocery run");
  await expect(dialog.getByLabel("Transaction type",{exact:true})).toHaveCount(0);
  await expect(dialog.getByLabel("Adjustment direction",{exact:true})).toHaveCount(0);
  await dialog.getByLabel("Transaction amount",{exact:true}).fill("+66.96");
  await dialog.locator(".compose-notes>summary").click();
  await dialog.getByLabel("Transaction notes",{exact:true}).fill("Groceries");
  if(testInfo.project.name === "desktop") expect((await new AxeBuilder({page}).include(".transaction-compose").withTags(["wcag2a","wcag2aa"]).analyze()).violations).toEqual([]);
  await expect(dialog).toContainText("$2,517.71");
  if(testInfo.project.name === "phone") {
    for(const width of [360,390,430]) {
      await page.setViewportSize({width,height:844});
      expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
      await dialog.getByLabel("Transaction amount",{exact:true}).focus();
      await page.evaluate(()=>{Object.defineProperty(window.visualViewport!,"height",{configurable:true,value:330});window.visualViewport!.dispatchEvent(new Event("resize"));});
      await expect.poll(()=>dialog.getByLabel("Transaction amount",{exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=330;})).toBe(true);
      await dialog.getByRole("button",{name:"Save transaction",exact:true}).scrollIntoViewIfNeeded();
      const box=await dialog.getByRole("button",{name:"Save transaction",exact:true}).boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(330);
      await page.evaluate(()=>{delete (window.visualViewport as unknown as Record<string,unknown>).height;window.visualViewport!.dispatchEvent(new Event("resize"));});
    }
  }
  if(testInfo.project.name === "phone") { await dialog.evaluate(el=>{el.scrollTop=0;}); await page.screenshot({path:"outputs/signed-transaction-form-430.png"}); }
  await dialog.getByRole("button",{name:"Save transaction",exact:true}).click();
  let entry=page.locator(".payment-activity>article").filter({hasText:"Purchase"});
  await expect(entry).toContainText("+$66.96");
  await expect(entry.getByRole("heading",{name:"SFC Henderson grocery run"})).toBeVisible();
  if(testInfo.project.name === "phone") { await entry.scrollIntoViewIfNeeded(); await page.screenshot({path:"outputs/named-transaction-card-430.png"}); }
  await expect(page.locator(".simple-total>strong")).toHaveText("$0.00");
  await entry.getByRole("button",{name:"Edit transaction",exact:true}).click();
  await dialog.getByLabel("Transaction amount",{exact:true}).fill("100");
  await expect(dialog).toContainText("$2,550.75");
  await dialog.getByRole("button",{name:"Save transaction",exact:true}).click();
  await entry.getByRole("button",{name:/Delete transaction of/}).click();
  await expect(dialog).toContainText("$2,450.75");
  await dialog.getByRole("button",{name:"Confirm delete",exact:true}).click();
  await page.getByText("Deleted transactions (1)",{exact:true}).click();
  await page.getByRole("button",{name:/Restore transaction of/}).click();
  await expect(dialog).toContainText("$2,550.75");
  await dialog.getByRole("button",{name:"Confirm restore",exact:true}).click();
  await page.getByRole("button",{name:"Add transaction",exact:true}).click();
  await dialog.getByLabel("Card used",{exact:true}).selectOption("account-card-1");
  await dialog.getByLabel("What’s it for?",{exact:true}).fill("Monthly card payment");
  await dialog.getByLabel("Transaction amount",{exact:true}).fill("50");
  await dialog.getByRole("button",{name:"Use negative amount",exact:true}).click();
  await expect(dialog.getByLabel("Transaction amount",{exact:true})).toHaveValue("-50");
  await expect(dialog).toContainText("$2,500.75");
  await dialog.getByRole("button",{name:"Save transaction",exact:true}).click();
  entry=page.locator(".payment-activity>article").filter({hasText:"Monthly card payment"});
  await entry.getByRole("button",{name:"Edit transaction",exact:true}).click();
  await dialog.getByLabel("Transaction amount",{exact:true}).fill("-75");
  await expect(dialog).toContainText("$2,475.75");
  await dialog.getByRole("button",{name:"Save transaction",exact:true}).click();
  await entry.getByRole("button",{name:/Delete payment of/}).click();
  await expect(dialog).toContainText("$2,550.75");
  await dialog.getByRole("button",{name:"Confirm delete",exact:true}).click();
  await page.reload();
  const card=page.locator(".balance-first-cards>article").filter({hasText:"Sample Rewards Card"});
  await expect(card.locator(".simple-balance")).toHaveText("$2,550.75");
  await page.getByRole("button",{name:"Transactions",exact:true}).click();
  await expect(page.locator(".payment-activity>article")).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});


test("a named lender adjustment uses its signed amount without another ledger deduction",async({page})=>{
 const fixture=JSON.parse(readFileSync(path.resolve("tests/fixtures/legacy-v0.json"),"utf8"));fixture.transactions=[];
 await page.goto("/");await page.locator('input[type="file"]').setInputFiles({name:"signed-adjustment.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fixture))});
 const card=page.locator(".balance-first-cards>article").filter({hasText:"Sample Rewards Card"});
 await card.getByRole("button",{name:"Update balance for Sample Rewards Card",exact:true}).click();
 const dialog=page.getByRole("dialog");await dialog.getByLabel("New current balance").fill("2517.71");await dialog.getByRole("button",{name:"Confirm balance update"}).click();
 await page.getByRole("button",{name:"Transactions",exact:true}).click();
 const entry=page.locator(".payment-activity>article");await entry.getByRole("button",{name:"Edit transaction",exact:true}).click();
 await expect(dialog.getByLabel("Transaction amount",{exact:true})).toHaveValue("+66.96");
 await dialog.getByLabel("What’s it for?",{exact:true}).fill("SFC Henderson grocery run");
 await expect(dialog).toContainText("$2,517.71");await dialog.getByRole("button",{name:"Save transaction",exact:true}).click();
 await expect(entry.getByRole("heading",{name:"SFC Henderson grocery run"})).toBeVisible();
 await entry.getByRole("button",{name:"Edit transaction",exact:true}).click();await dialog.getByLabel("Transaction amount",{exact:true}).fill("-50");
 await expect(dialog).toContainText("$2,400.75");await dialog.getByRole("button",{name:"Save transaction",exact:true}).click();
 await expect(page.locator(".simple-total>strong")).toHaveText("$50.00");
 await page.reload();await expect(card.locator(".simple-balance")).toHaveText("$2,400.75");
 await page.getByRole("button",{name:"Transactions",exact:true}).click();await expect(page.locator(".payment-activity>article")).toHaveCount(1);await expect(page.locator(".simple-total>strong")).toHaveText("$50.00");
});
