import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

test.use({ timezoneId: "UTC" });

test("lender balances, payments and activity share the household date across UTC midnight", async ({ page }) => {
  // UTC has entered November while the established Pacific household calendar is October 31.
  await page.clock.setFixedTime(new Date("2026-11-01T00:30:00Z"));
  const fixture = JSON.parse(readFileSync(path.resolve("tests/fixtures/legacy-v0.json"), "utf8"));
  fixture.accounts = [{
    ...fixture.accounts[0], name: "Calendar card", balance: 1000, baselineBalance: 1000,
    apr: 0, interestFee: 0, minimum: 50, minimumMode: "manual",
    promoEndDate: "", postPromoApr: 0, archivedAt: null,
  }];
  fixture.transactions = [];
  fixture.balanceAdjustments = [];
  fixture.snapshots = [];
  fixture.monthlyBudgets = {};
  fixture.monthlyPlan = { months: {}, detailedSpendingTracking: false };
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "household-calendar.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  const card = page.locator(".balance-first-cards>article").filter({ hasText: "Calendar card" });
  const dialog = page.getByRole("dialog");
  await expect(card.locator(".simple-balance")).toHaveText("$1,000.00");
  await card.getByRole("button", { name: "Update balance for Calendar card", exact: true }).click();
  await expect(dialog.getByLabel("Date", { exact: true })).toHaveValue("2026-10-31");
  await dialog.getByLabel("New current balance").fill("1100");
  await dialog.getByRole("button", { name: "Save balance", exact: true }).click();
  await expect(card.locator(".simple-balance")).toHaveText("$1,100.00");
  await card.getByRole("button", { name: "Record payment for Calendar card", exact: true }).click();
  await expect(dialog.getByLabel("Payment date", { exact: true })).toHaveValue("2026-10-31");
  await dialog.getByLabel("Payment amount", { exact: true }).fill("50");
  await dialog.getByRole("button", { name: "Confirm payment", exact: true }).click();
  await expect(card.locator(".simple-balance")).toHaveText("$1,050.00");
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  await page.getByRole("button", { name: "Add record", exact: true }).click();
  await expect(dialog.getByLabel("Transaction date", { exact: true })).toHaveValue("2026-10-31");
  await dialog.getByLabel("What’s it for?", { exact: true }).fill("Test purchase");
  await dialog.getByLabel("Transaction amount", { exact: true }).fill("+25");
  await dialog.getByRole("button", { name: "Save transaction", exact: true }).click();
  await page.getByRole("button", { name: "Debts", exact: true }).click();
  await expect(card.locator(".simple-balance")).toHaveText("$1,075.00");
  await page.reload();
  await expect(card.locator(".simple-balance")).toHaveText("$1,075.00");
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: "Progress", exact: true }).filter({ visible: true }).click();
  await expect(page.locator(".actual-progress-summary")).toContainText("$1,075.00");
  await expect(page.locator(".progress-month-highlights")).toContainText("October 2026");
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: "Payoff Plan", exact: true }).click();
  await page.getByLabel("Total monthly debt payment", { exact: true }).fill("100");
  const allocation = page.getByRole("region", { name: "Monthly payment allocation" });
  await expect(allocation.getByRole("heading", { name: "October 2026", exact: true })).toBeVisible();
  await allocation.getByRole("tab", { name: "Recorded", exact: true }).click();
  await expect(allocation.locator(".recorded-summary")).toContainText("$50.00");
});
