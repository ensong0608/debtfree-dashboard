import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolveHouseholdCurrency, createHouseholdMoneyFormatter, householdCurrencySymbol, HOUSEHOLD_CURRENCIES } from '../app/household-currency.ts';
import { createDemoFixture } from '../mobile/demo-fixture.ts';
import { parseDashboardContract, serializeDashboardBackup } from '../app/dashboard-data.ts';
import { buildPayoffCsv, exportPayoffExcel } from '../app/payoff-export.ts';
const require = createRequire(import.meta.url);

test('CSV and workbook exports use explicit household units with backward compatible USD default', async () => {
  const report = { generatedAt: '2026-10-17', budgetMonth: 'Oct 2026', strategy: 'Avalanche', projectedDebtFree: 'Oct 2027', monthsToPayoff: 12, stalled: false, startingDebt: 1000, monthlyPlan: 100, estimatedInterest: 20, extraPayment: 50, totalIncome: 200, totalExpenses: 0, totalBudget: 0, monthlySurplus: 200, totalMinimums: 50, availableExtra: 50, cashflow: [], accounts: [], schedule: [], transactions: [], snapshots: [] };
  assert.match(buildPayoffCsv(report), /Currency,USD/);
  assert.match(buildPayoffCsv(report, 'PHP'), /Currency,PHP/);
  let blob;
  const previous = { document: globalThis.document, window: globalThis.window, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  globalThis.document = { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } };
  globalThis.window = { setTimeout: () => 0 };
  URL.createObjectURL = value => { blob = value; return 'blob:synthetic-test'; }; URL.revokeObjectURL = () => {};
  try {
    await exportPayoffExcel(report, 'PHP');
    const { unzipSync, strFromU8 } = require('fflate');
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    assert.match(strFromU8(files['xl/styles.xml']), /₱/);
    assert(!strFromU8(files['xl/styles.xml']).includes('&quot;$&quot;'));
    assert.match(strFromU8(files['xl/worksheets/sheet1.xml']), /Currency PHP/);
  } finally {
    globalThis.document = previous.document; globalThis.window = previous.window; URL.createObjectURL = previous.create; URL.revokeObjectURL = previous.revoke;
  }
});

test('supported, missing and invalid household currencies are explicit', () => {
  assert.equal(resolveHouseholdCurrency(undefined), 'USD');
  for (const code of HOUSEHOLD_CURRENCIES) assert.equal(resolveHouseholdCurrency(code), code);
  for (const invalid of [null, '', 'php', 'JPY', {}, 1]) assert.throws(() => resolveHouseholdCurrency(invalid), RangeError);
  assert.equal(createHouseholdMoneyFormatter('USD').format(1234.5), '$1,234.50');
  assert.equal(createHouseholdMoneyFormatter('PHP').format(1234.5), '₱1,234.50');
  assert.equal(householdCurrencySymbol('PHP'), '₱');
  assert.equal(createHouseholdMoneyFormatter('PHP', { currency: 'USD', maximumFractionDigits: 0 }).format(1234.5), '₱1,235');
});

test('old and current backup roundtrips preserve units, amounts and unknown fields', () => {
  const legacy = createDemoFixture();
  legacy.futureEnvelope = { retained: true }; legacy.payload.futurePayload = { retained: true };
  const before = JSON.stringify(legacy);
  const decoded = parseDashboardContract(JSON.parse(serializeDashboardBackup(legacy)));
  assert.equal(JSON.stringify(decoded), before);
  assert(!Object.hasOwn(decoded.payload.monthlyPlan, 'currency'));
  const old = parseDashboardContract({ ...legacy, version: 4 });
  assert.equal(old.payload.monthlyPlan.progressStartingBalance, 1500);
  assert(!Object.hasOwn(old.payload.monthlyPlan, 'currency'));
  const php = structuredClone(legacy); php.payload.monthlyPlan.currency = 'PHP';
  const parsed = parseDashboardContract(JSON.parse(serializeDashboardBackup(php)));
  assert.equal(parsed.payload.monthlyPlan.currency, 'PHP');
  assert.deepEqual(parsed.payload.accounts, legacy.payload.accounts);
  assert.deepEqual(parsed.payload.transactions, legacy.payload.transactions);
  assert.deepEqual(parsed.payload.snapshots, legacy.payload.snapshots);
  for (const bad of ['JPY', null, 'usd', 1]) assert.throws(() => parseDashboardContract({ ...legacy, payload: { ...legacy.payload, monthlyPlan: { ...legacy.payload.monthlyPlan, currency: bad } } }), /currency/);
});

test('React provider is tree-local, defaults to USD and performs no storage writes', () => {
  const ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const filename = fileURLToPath(new URL('../app/household-currency-context.tsx', import.meta.url));
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const contextModule = new Module(filename); contextModule.filename = filename; contextModule.paths = require.resolve.paths('react');
  const nativeRequire = contextModule.require.bind(contextModule);
  contextModule.require = id => id === './household-currency' ? require('../app/household-currency.ts') : nativeRequire(id);
  contextModule._compile(compiled, filename);
  const { HouseholdCurrencyProvider, useHouseholdCurrency } = contextModule.exports;
  function ReadCurrency() { return React.createElement('span', null, useHouseholdCurrency()); }
  const read = () => React.createElement(ReadCurrency);
  const output = renderToStaticMarkup(React.createElement(React.Fragment, null, React.createElement(HouseholdCurrencyProvider, { currency: 'PHP' }, read(), React.createElement(HouseholdCurrencyProvider, { currency: 'EUR' }, read()), read()), read()));
  assert.equal(output, '<span>PHP</span><span>EUR</span><span>PHP</span><span>USD</span>');
  assert.equal(renderToStaticMarkup(read()), '<span>USD</span>');
  const settingsFile = fileURLToPath(new URL('../app/household-currency-settings.tsx', import.meta.url));
  const settingsModule = new Module(settingsFile); settingsModule.filename = settingsFile; settingsModule.paths = contextModule.paths;
  settingsModule.require = id => id.endsWith('.css') ? {} : id === './household-currency-context' ? contextModule.exports : id === './household-currency' ? require('../app/household-currency.ts') : nativeRequire(id);
  settingsModule._compile(ts.transpileModule(readFileSync(settingsFile, 'utf8'), { compilerOptions: { contextModule: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, settingsFile);
  let changed = false;
  const viewer = renderToStaticMarkup(React.createElement(HouseholdCurrencyProvider, { currency: 'PHP' }, React.createElement(settingsModule.exports.default, { readOnly: true, onChange: () => { changed = true; } })));
  assert.match(viewer, /<select[^>]*disabled/); assert.match(viewer, /value="PHP" selected/); assert.equal(changed, false);
});
