import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { canArchiveDebt, debtStatus, openingBalanceForCurrentBalance, payoffPriority, promoNotice, splitDebtAccounts } from "../app/debts-screen.ts";

function account(id, overrides = {}) {
  return {
    id, name: id, type: "Credit card", balance: 1000, apr: 18, interestFee: 0, minimum: 50,
    minimumMode: "manual", payoffMode: "priority", creditLimit: 5000, dueDate: "2026-08-25",
    promoEndDate: "", postPromoApr: 0, postPromoMinimum: 0, createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

test("classifies current, paid-off, and archived debt records without deleting history", () => {
  const active = account("active");
  const paid = account("paid", { balance: 0 });
  const archived = account("archived", { balance: 0, archivedAt: "2026-08-11T20:00:00.000Z" });
  assert.equal(debtStatus(active), "Payoff priority");
  assert.equal(debtStatus(account("minimum", { payoffMode: "minimum-only" })), "Minimum only");
  assert.equal(debtStatus(paid), "Paid off");
  assert.equal(debtStatus(archived), "Archived");
  assert.equal(canArchiveDebt(active), false);
  assert.equal(canArchiveDebt(paid), true);
  assert.equal(canArchiveDebt(archived), false);
  assert.deepEqual(splitDebtAccounts([active, paid, archived]).current.map((item) => item.id), ["active", "paid"]);
  assert.deepEqual(splitDebtAccounts([active, paid, archived]).archived.map((item) => item.id), ["archived"]);
});

test("updates the displayed balance without double-counting existing ledger activity", () => {
  assert.equal(openingBalanceForCurrentBalance(1000, 800, 700), 900);
  assert.equal(openingBalanceForCurrentBalance(1000, 1125.55, 900), 774.45);
  assert.equal(openingBalanceForCurrentBalance(100, 0, 0), 100);
});

test("shows the selected payoff strategy priority and excludes minimum-only or archived debts", () => {
  const debts = [
    account("high-apr", { apr: 29, balance: 4000 }),
    account("small", { apr: 12, balance: 300 }),
    account("minimum", { apr: 35, payoffMode: "minimum-only" }),
    account("archived", { balance: 0, archivedAt: "2026-08-11T20:00:00.000Z" }),
  ];
  assert.deepEqual(payoffPriority(debts, "avalanche").map((item) => item.id), ["high-apr", "small"]);
  assert.deepEqual(payoffPriority(debts, "snowball").map((item) => item.id), ["small", "high-apr"]);
  assert.deepEqual(payoffPriority([debts[0], debts[1]].map((item, index) => ({ ...item, customOrder: 1 - index })), "custom").map((item) => item.id), ["small", "high-apr"]);
});

test("surfaces useful promotional-rate warnings", () => {
  const today = new Date(2026, 7, 11, 12);
  assert.equal(promoNotice(account("standard"), today), null);
  assert.equal(promoNotice(account("missing", { promoEndDate: "2026-09-15" }), today)?.tone, "danger");
  assert.match(promoNotice(account("future", { promoEndDate: "2026-09-15", postPromoApr: 24 }), today)?.label ?? "", /then 24\.00% APR/);
  assert.equal(promoNotice(account("expired", { promoEndDate: "2026-07-15", postPromoApr: 22 }), today)?.tone, "warning");
});

test("Phase 4 Debts UI exposes required actions and swaps the desktop table for mobile cards", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, />Record payment</);
  assert.match(client, />Update balance</);
  assert.match(client, />Mark paid off</);
  assert.match(client, />Archive</);
  assert.match(client, /Archived debts/);
  assert.match(client, /className="debt-card-list"/);
  assert.match(client, /priorityById/);
  assert.match(client, /promoNotice\(account\)/);
  assert.match(styles, /Phase 4 responsive debt workspace/);
  assert.match(styles, /@media\(max-width:760px\)[\s\S]*\.debt-table-wrap\{display:none\}/);
  assert.match(styles, /\.debt-card-list\{display:grid/);
  assert.match(styles, /\.debt-action\{min-height:46px/);
  assert.match(styles, /\.debt-table-wrap\{min-height:0;flex:1 1 auto;overflow:scroll/);
  assert.match(styles, /\.debt-table\{width:1400px;min-width:1400px;table-layout:fixed/);
  assert.match(styles, /\.debt-table th:nth-child\(8\),\.debt-table td:nth-child\(8\)\{width:150px/);
  assert.match(styles, /text-overflow:ellipsis;white-space:nowrap/);
});
