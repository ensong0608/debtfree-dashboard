import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("calculator uses only the entered amount and preserves balances and Budget", async ({ page }) => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/legacy-v0.json", "utf8"));
  fixture.transactions = [];
  fixture.accounts = [0, 1].map(index => ({ ...fixture.accounts[0], id: `calc-${index}`, name: `Calculator card ${index}`, balance: 10000, baselineBalance: 10000, apr: 0, interestFee: 0, promoEndDate: "", postPromoApr: 0, minimum: 900, minimumMode: "manual", payoffMode: index ? "minimum-only" : "priority" }));
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "calculator.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: "Payoff Calculator", exact: true }).click();
  await page.getByLabel("Total monthly debt payment", { exact: true }).fill("7000");
  await expect(page.locator(".plan-hero")).toContainText("3 months");
  await expect(page.locator(".plan-hero")).toContainText("$7,000.00");
  await expect(page.locator(".plan-table tbody tr")).toHaveCount(3);
  await expect(page.locator(".plan-table tbody tr").last()).toContainText("$6,000.00");
  await expect(page.getByText("Recommended strategy", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Compare strategies", { exact: true })).toHaveCount(0);
  await expect(page.locator(".what-if-card,.mobile-payoff-timeline")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByLabel("Total monthly debt payment", { exact: true }).fill("5000");
  await expect(page.locator(".plan-hero")).toContainText("4 months");
  await expect(page.locator(".plan-table tbody tr")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Custom", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Show all|Show fewer/ })).toHaveCount(0);
  await expect(page.getByText("Enter a monthly amount to see how long it could take to pay off your current debts.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("This is the entire monthly amount used by this calculator.", { exact: false })).toHaveCount(0);
  const results = await page.locator(".plan-hero>div").evaluateAll(elements => elements.map(e => ({top:e.getBoundingClientRect().top, left:e.getBoundingClientRect().left})));
  expect(results).toHaveLength(3);
  expect(results[0].top).toBe(results[1].top);
  expect(results[1].top).toBe(results[2].top);
  expect(results[0].left).toBeLessThan(results[1].left);
  expect(results[1].left).toBeLessThan(results[2].left);
  const ordering = await page.locator(".plan-screen").evaluate(screen => ({
    resultsBottom: screen.querySelector(".plan-hero")!.getBoundingClientRect().bottom,
    scheduleTop: screen.querySelector(".plan-table-card")!.getBoundingClientRect().top,
  }));
  expect(ordering.resultsBottom).toBeLessThanOrEqual(ordering.scheduleTop);
  await page.reload();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: "Payoff Calculator", exact: true }).click();
  await expect(page.getByLabel("Total monthly debt payment", { exact: true })).toHaveValue("5000");
  await page.getByRole("button", { name: "Debts", exact: true }).click();
  await expect(page.locator(".simple-total")).toContainText("$20,000.00");
});
