import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

test("category colors stay readable on phones and payoff steps use the saved forecast", async ({ page }, testInfo) => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/legacy-v0.json", "utf8"));
  fixture.transactions = [];
  fixture.accounts[0].baselineBalance = 3000;
  fixture.accounts[1].type = "Auto loan";
  fixture.accounts[1].baselineBalance = 10000;
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "category-preview.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  const mobile = testInfo.project.name === "phone";
  const summary = page.locator(".mobile-category-summary");
  if (!mobile) {
    await expect(summary).toBeHidden();
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("button", { name: "Payoff Plan", exact: true }).click();
    await expect(page.locator(".mobile-payoff-timeline")).toBeHidden();
    return;
  }
  for (const width of [360,390,430]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(summary).toBeVisible();
    await expect(page.locator('.balance-first-cards [data-debt-category="credit"]')).toHaveCount(1);
    await expect(page.locator('.balance-first-cards [data-debt-category="auto"]')).toHaveCount(1);
    await expect(page.getByRole("progressbar", { name: "Sample Rewards Card balance reduction since tracking began" })).toHaveAttribute("aria-valuenow", "18.3");
    expect(await page.locator(".debts-screen").evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgb(244, 245, 247)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.screenshot({ path: "outputs/category-debts-phone.png", fullPage: true });
  const debtsAxe = await new AxeBuilder({ page }).include(".debts-screen").withRules(["color-contrast"]).analyze();
  expect(debtsAxe.violations).toEqual([]);
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: "Payoff Plan", exact: true }).click();
  await page.getByLabel("Extra each month", { exact: true }).fill("7000");
  await expect(page.locator(".mobile-payoff-timeline")).toHaveCount(0);
  await expect(page.locator(".plan-hero")).toContainText("$7,000.00");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const planAxe = await new AxeBuilder({ page }).include(".plan-screen").withRules(["color-contrast"]).analyze();
  expect(planAxe.violations).toEqual([]);
  await page.screenshot({ path: "outputs/category-payoff-phone.png", fullPage: true });
});
