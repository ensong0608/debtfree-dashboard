import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

async function loadSyntheticHousehold(page: Page) {
  const fixture = JSON.parse(readFileSync("tests/fixtures/legacy-v0.json", "utf8"));
  fixture.accounts = [{ ...fixture.accounts[0], id: "mobile-foundation", name: "Synthetic card", balance: 1000, baselineBalance: 1000, balanceOffset: 0, apr: 0, minimum: 50, minimumMode: "manual", interestFee: 0, archivedAt: null }];
  fixture.transactions = [];
  fixture.balanceAdjustments = [];
  fixture.snapshots = [];
  fixture.monthlyPlan = { months: {}, detailedSpendingTracking: false, progressStartingBalance: 1000 };
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({ name: "synthetic-mobile.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await expect(page.locator(".compact-debt-card")).toHaveCount(1);
}

test("mobile payment, account and balance forms fill the viewport and restore keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await loadSyntheticHousehold(page);
  for (const label of ["Record payment for Synthetic card", "Edit debt details for Synthetic card", "Update balance for Synthetic card"]) {
    const trigger = page.getByRole("button", { name: label, exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds?.x).toBe(0);
    expect(bounds?.y).toBe(0);
    expect(bounds?.width).toBe(320);
    expect(bounds?.height).toBe(740);
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});

test("activity Escape closes its own dialog and returns to the activity control", async ({ page }) => {
  await loadSyntheticHousehold(page);
  const trigger = page.getByRole("button", { name: "Activity for Synthetic card", exact: true });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator(".simple-balance").first()).toHaveText("$1,000.00");
});
