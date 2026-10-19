import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseDashboardContract, serializeDashboardBackup } from '../app/dashboard-data.ts';
const contract = parseDashboardContract(JSON.parse(readFileSync('tests/fixtures/legacy-v0.json', 'utf8')));
const now = new Date(); const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
const bills = structuredClone(contract.payload.monthlyBudgets['2026-07']);
const loanBills = ['Mortgage','Car payment'].map((name,i) => ({id:`local-bill-${i}`,name,kind:'expense',category:'Housing',amount:i?500:2000,paymentMethod:'debit',creditAccountId:'',recurring:true,createdAt:now.toISOString()}));
contract.payload.monthlyBudgets[month] = [...bills,...loanBills];
contract.payload.monthlyPlan.loanTrackers = ['house','car'].map((kind,i)=>({id:`local-loan-${i}`,name:i?'Demo Car':'Demo Home',kind,originalAmount:i?30000:250000,remainingAmount:i?22000:210000,balanceKind:'principal',asOf:`${month}-01`,budgetItemId:`local-bill-${i}`,budgetItemName:loanBills[i].name,apr:i?6:5,escrow:i?0:300,history:[]}));
const payload = serializeDashboardBackup(parseDashboardContract(contract));
const q = s => "'" + String(s).replaceAll("'", "''") + "'";
let sql = 'PRAGMA foreign_keys=ON;\n';
for (const [id,name,email] of [['local-demo','Demo Household','owner@example.test'],['local-other','Separate Household','other@example.test']]) {
 sql += `INSERT OR IGNORE INTO households VALUES (${q(id)},${q(name)},${q(email)},0,0);\n`;
 sql += `INSERT OR IGNORE INTO household_state VALUES (${q(id)},${q(payload)},0,${q(email)},0);\n`;
}
for (const [name,role,h] of [['owner','owner','local-demo'],['admin','admin','local-demo'],['viewer','viewer','local-demo'],['other','owner','local-other']]) sql += `INSERT OR IGNORE INTO household_members VALUES (${q(name+'@example.test')},${q(h)},${q(name)},${q(role)},'active',NULL,0,0);\n`;
mkdirSync('.wrangler',{recursive:true}); writeFileSync('.wrangler/local-seed.sql',sql);
console.log('Generated synthetic fixtures. Existing local household rows are preserved.');
