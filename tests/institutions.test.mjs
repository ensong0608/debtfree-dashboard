import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { INSTITUTIONS, isInstitutionKey, institutionPresentation } from '../app/institutions.ts';
import { parseDashboardContract, serializeDashboardBackup, parseHouseholdWriteJson } from '../app/dashboard-data.ts';
import { previewDashboardImport, resolveDashboardImport } from '../app/data-transfer.ts';
import { saveCreditCardDetails } from '../app/credit-card-editor.ts';
import { loanEntryErrors } from '../app/loan-entry.ts';
import { createDemoFixture } from '../mobile/demo-fixture.ts';
const loan = () => ({ id:'synthetic-mortgage', name:'My mortgage', kind:'house', originalAmount:200000, remainingAmount:180000, apr:5, escrow:100, monthlyPayment:1500, balanceKind:'principal', asOf:'2026-10-01', budgetItemId:'', budgetItemName:'', history:[{date:'2026-10-01',amount:180000,balanceKind:'principal',recordedAt:'2026-10-01T12:00:00Z'}] });
const fixture = () => { const value = createDemoFixture(); value.payload.monthlyPlan.loanTrackers=[loan()]; value.payload.monthlyPlan.removedProgressAccounts=[]; return value; };
const roundTrip = value => parseHouseholdWriteJson(JSON.stringify({payload:JSON.parse(serializeDashboardBackup(value)),expectedRevision:3}));

test('catalog has bounded unique keys; unsupported institutions use generic type icons', () => {
  assert.equal(new Set(INSTITUTIONS.map(i=>i.key)).size,INSTITUTIONS.length);
  for (const {key} of INSTITUTIONS) assert.ok(isInstitutionKey(key));
  for (const value of ['Chase', 'https://example.com/logo.svg', '<svg/>', {}, null, 'x'.repeat(33)]) assert.equal(isInstitutionKey(value),false);
  assert.deepEqual(institutionPresentation('chase','Credit card'),{label:'Chase',icon:'card'});
  assert.deepEqual(institutionPresentation('citi','house'),{label:'Citi',icon:'home'});
  assert.deepEqual(institutionPresentation('missing','car'),{label:'',icon:'car'});
  assert.deepEqual(institutionPresentation('other','Personal loan'),{label:'Other',icon:'money'});
});

test('legacy names never infer institutions and normalization leaves absent metadata absent', async () => {
  const legacy=JSON.parse(await readFile(new URL('./fixtures/legacy-v0.json',import.meta.url),'utf8'));
  legacy.accounts[0].name='Chase Freedom';
  const current=parseDashboardContract(legacy);
  const saved=roundTrip(current);
  assert.deepEqual(saved.payload,current.payload);
  assert.equal(saved.payload.accounts[0].name,'Chase Freedom');
  assert.ok(saved.payload.accounts.every(a=>!Object.hasOwn(a,'institutionKey')));
});

test('explicit card selection, removal, save/reload, import replace and merge preserve financial records', () => {
  const before=fixture(), value=structuredClone(before), card=value.payload.accounts[0];
  const state={accounts:value.payload.accounts, transactions:value.payload.transactions, adjustments:value.payload.balanceAdjustments};
  const next=saveCreditCardDetails(state,card.id,{...card,institutionKey:'chase'},{account:card,balance:card.balance});
  value.payload.accounts=next.accounts;
  value.payload.monthlyPlan.loanTrackers[0].institutionKey='citi';
  const saved=roundTrip(value);
  const incoming=previewDashboardImport(serializeDashboardBackup(saved)).contract;
  for (const mode of ['merge','replace']) {
    const imported=resolveDashboardImport(before,incoming,mode);
    assert.equal(imported.payload.accounts[0].institutionKey,'chase');
    assert.equal(imported.payload.monthlyPlan.loanTrackers[0].institutionKey,'citi');
    const clean=structuredClone(imported.payload);
    delete clean.accounts[0].institutionKey;
    delete clean.monthlyPlan.loanTrackers[0].institutionKey;
    assert.deepEqual(clean,roundTrip(before).payload);
  }
  assert.deepEqual(next.transactions,state.transactions);
  assert.deepEqual(next.adjustments,state.adjustments);
  const selected=saved.payload.accounts[0];
  const removed=saveCreditCardDetails({...state,accounts:saved.payload.accounts},selected.id,{...selected,institutionKey:undefined},{account:selected,balance:selected.balance});
  saved.payload.accounts=removed.accounts;
  assert.ok(!Object.hasOwn(roundTrip(saved).payload.accounts[0],'institutionKey'));
  assert.equal(before.payload.accounts[0].institutionKey,undefined);
});

test('account and loan write/import validation reject noncatalog metadata without mutating input', () => {
  for (const key of ['',null,42,'toString','https://bank/logo.svg','<svg onload=alert(1)>','x'.repeat(33)]) {
    for (const kind of ['account','loan']) {
      const value=fixture();
      const record=kind==='account'?value.payload.accounts[0]:value.payload.monthlyPlan.loanTrackers[0];
      record.institutionKey=key;
      const before=structuredClone(value);
      assert.throws(()=>roundTrip(value),/institutionKey/);
      assert.throws(()=>previewDashboardImport(JSON.stringify(value)),/institutionKey/);
      assert.deepEqual(value,before);
      if(kind==='loan') assert.ok(loanEntryErrors(record,'2026-10-23').institutionKey);
    }
  }
  for(const institutionKey of ['chase','citi','other',undefined]) {
    const value=fixture(); value.payload.accounts[0].institutionKey=institutionKey; value.payload.monthlyPlan.loanTrackers[0].institutionKey=institutionKey;
    assert.equal(roundTrip(value).payload.accounts[0].institutionKey,institutionKey);
    assert.deepEqual(loanEntryErrors({...loan(),institutionKey},'2026-10-23'),{});
  }
});

test('institution edits participate in card conflict checks and reject invalid direct saves', () => {
  const card=fixture().payload.accounts[0];
  const state={accounts:[{...card,institutionKey:'citi'}],transactions:[],adjustments:[]};
  assert.throws(()=>saveCreditCardDetails(state,card.id,{...card,institutionKey:'chase'},{account:card,balance:card.balance}),/details changed/);
  assert.throws(()=>saveCreditCardDetails({...state,accounts:[card]},card.id,{...card,institutionKey:'<svg/>'},{account:card,balance:card.balance}),/institution/);
});
