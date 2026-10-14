import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseDashboardContract, type DashboardBackup } from "../../app/dashboard-data";
import type { HouseholdSync } from "../../app/household-sync";

type TestWindow = Window & { foundationSync?: HouseholdSync; foundationStatus?: string };
const scope = { identity: "synthetic-owner@example.test", householdId: "synthetic-browser-household" };
const prefix = "debtfree-outbox:" + scope.identity + ":" + scope.householdId + ":";
function fixture() {
  const contract = parseDashboardContract(JSON.parse(readFileSync("tests/fixtures/legacy-v0.json", "utf8")));
  contract.payload.accounts[0].name = "Synthetic browser card";
  return contract;
}
async function transport(context: BrowserContext) {
  let payload = fixture(), revision = 0, failWrites = false, failReads = false;
  await context.route("**/api/household", async route => {
    const request = route.request();
    const identity = request.headers()["x-debtfree-identity"];
    if (![scope.identity, "synthetic-partner@example.test"].includes(identity)) { await route.fulfill({status: 403, json: {error: "Synthetic identity denied"}}); return; }
    if (request.method() === "PUT") {
      if (failWrites) { await route.abort("failed"); return; }
      const body = JSON.parse(request.postData()!);
      if (body.revision !== revision) { await route.fulfill({ status: 409, json: { error: "Synthetic conflict" } }); return; }
      payload = body.payload; revision++;
      await route.fulfill({ json: { ok: true, revision } }); return;
    }
    if (failReads) { await route.abort("failed"); return; }
    await route.fulfill({ json: { ...scope, identity, payload, revision, role: "owner", householdName: "Synthetic browser household", members: [] } });
  });
  return { fail(value: boolean) { failWrites = value; }, disconnect(value: boolean) { failReads = value; }, saved: () => ({ payload, revision }) };
}
async function controller(page: Page, key: string, identity = scope.identity) {
  await page.goto("/");
  return page.evaluate(async ({ scope, key }) => {
    const modulePath = "/app/household-sync.ts";
    const { HouseholdSync } = await import(modulePath);
    const sync = new HouseholdSync({ storage: localStorage, key, scope, status: (value: string) => { (window as TestWindow).foundationStatus = value; } });
    (window as TestWindow).foundationSync = sync;
    return (await sync.load()).contract as DashboardBackup;
  }, { scope: {...scope, identity}, key });
}

test("closed browser tabs expose pending drafts for explicit recovery on reopening", async ({ context, page }) => {
  const cloud = await transport(context);
  await controller(page, prefix + "closed-tab");
  cloud.fail(true);
  await page.evaluate(async () => {
    const sync = (window as TestWindow).foundationSync!;
    const contract = structuredClone((await sync.load()).contract!);
    contract.payload.extra = 123;
    sync.stage(contract); await sync.flush(); sync.dispose();
  });
  await page.close();
  const reopened = await context.newPage();
  await controller(reopened, prefix + "new-tab");
  const found = await reopened.evaluate(async ({ scope, prefix }) => {
    const modulePath = "/app/household-recovery.ts";
    const { householdRecoveryDrafts } = await import(modulePath);
    const drafts = householdRecoveryDrafts(localStorage, scope, prefix + "new-tab");
    return { count: drafts.length, amount: drafts[0]?.contract.payload.extra, pending: (window as TestWindow).foundationSync!.pending };
  }, { scope, prefix });
  expect(found).toEqual({ count: 1, amount: 123, pending: null });
  cloud.fail(false);
  await reopened.evaluate(async ({ scope, prefix }) => {
    const modulePath = "/app/household-recovery.ts";
    const { householdRecoveryDrafts } = await import(modulePath);
    const draft = householdRecoveryDrafts(localStorage, scope, prefix + "new-tab")[0];
    (window as TestWindow).foundationSync!.recoverDraft(draft);
  }, { scope, prefix });
  await expect.poll(() => cloud.saved().payload.payload.extra).toBe(123);
  expect(cloud.saved().revision).toBe(1);
  await reopened.evaluate(() => (window as TestWindow).foundationSync!.dispose());
});

test("a second browser tab sees partner changes after reconnection without overwriting a draft", async ({ context, page }) => {
  const cloud = await transport(context);
  const first = await controller(page, prefix + "first");
  const partner = await context.newPage();
  await controller(partner, "debtfree-outbox:synthetic-partner@example.test:" + scope.householdId + ":partner", "synthetic-partner@example.test");
  await page.evaluate(async contract => {
    contract.payload.extra = 456;
    const sync = (window as TestWindow).foundationSync!; sync.stage(contract); await sync.flush();
  }, first!);
  cloud.disconnect(true);
  await context.setOffline(true);
  await partner.evaluate(async () => { try { await (window as TestWindow).foundationSync!.refresh(); } catch { /* Synthetic offline request. */ } });
  await expect.poll(() => partner.evaluate(() => (window as TestWindow).foundationStatus)).toBe("error");
  cloud.disconnect(false);
  await context.setOffline(false);
  const result = await partner.evaluate(async () => (await (window as TestWindow).foundationSync!.refresh())?.contract?.payload.extra);
  expect(result).toBe(456);
  expect(cloud.saved().revision).toBe(1);
  await page.evaluate(() => (window as TestWindow).foundationSync!.dispose());
  await partner.evaluate(() => (window as TestWindow).foundationSync!.dispose());
});
