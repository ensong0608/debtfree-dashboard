import { test, expect } from "@playwright/test";

test("onboarding scrolls to Continue with multiple income sources and a short phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Start my payoff plan", exact: true }).click();
  await page.getByLabel("Income source name", { exact: true }).fill("Test salary A");
  await page.getByLabel("Monthly take-home amount", { exact: true }).fill("2000");
  await page.getByRole("button", { name: "+ Add another income source", exact: true }).click();
  await page.getByLabel("Income source name", { exact: true }).nth(1).fill("Test salary B");
  await page.getByLabel("Monthly take-home amount", { exact: true }).nth(1).fill("1000");
  const setup = page.getByRole("main", { name: "Household setup", exact: true });
  const next = page.getByRole("button", { name: "Continue", exact: true });
  for (const viewport of [
    { width: 360, height: 844 }, { width: 390, height: 420 }, { width: 430, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await setup.evaluate(el => { el.scrollTop = 0; });
    const metrics = await setup.evaluate(el => ({
      height: el.clientHeight, content: el.scrollHeight, bottom: el.getBoundingClientRect().bottom,
    }));
    expect(metrics.bottom).toBeLessThanOrEqual(viewport.height + 1);
    expect(metrics.content).toBeGreaterThan(metrics.height);
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.mouse.wheel(0, 3000);
    await expect.poll(() => setup.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await expect.poll(() => next.evaluate(el => {
      const box = el.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= innerHeight;
    })).toBe(true);
    await setup.evaluate(el => { el.scrollTop = 0; });
    await setup.focus();
    await page.keyboard.press("Control+End");
    await expect.poll(() => setup.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThan(2);
    await expect(page.getByLabel("Income source name", { exact: true }).nth(1)).toHaveValue("Test salary B");
    await expect(page.getByLabel("Monthly take-home amount", { exact: true }).nth(1)).toHaveValue("1000");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await next.click();
  await expect(page.getByRole("heading", { name: "Add debts", exact: true })).toBeVisible();
});
