import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("household debts can be reordered and moved with saved placement", async ({ page }) => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/legacy-v0.json", "utf8"));
  const template = fixture.accounts[0];
  fixture.accounts = ["Discover", "Costco", "Citi1"].map((name, index) => ({ ...template, id: `group-${index}`, name }));
  fixture.transactions = [];
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "groups.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  const mama = page.getByRole("region", { name: "Mama debts", exact: true });
  const papi = page.getByRole("region", { name: "Papi debts", exact: true });
  await expect(mama.locator("article h2")).toHaveText(["Citi1", "Discover"]);
  await page.getByRole("button", { name: "Arrange debts", exact: true }).click();
  await page.getByRole("button", { name: "Move Discover up", exact: true }).click();
  await expect(mama.locator("article h2")).toHaveText(["Discover", "Citi1"]);
  await page.getByLabel("Group for Citi1", { exact: true }).selectOption("Papi");
  await expect(papi.locator("article h2")).toHaveText(["Costco", "Citi1"]);
  await page.getByRole("button", { name: "Done arranging", exact: true }).click();
  await page.reload();
  await expect(mama.locator("article h2")).toHaveText(["Discover"]);
  await expect(papi.locator("article h2")).toHaveText(["Costco", "Citi1"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
