import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
test('signed refunds, date corrections and lender confirmations preserve balances and reporting',async({page})=>{
 const fixture=JSON.parse(readFileSync('tests/fixtures/legacy-v0.json','utf8'));fixture.transactions=[];
 await page.goto('/');await page.locator('input[type="file"]').setInputFiles({name:'audit-isolated.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 const card=page.locator('.balance-first-cards>article').filter({hasText:'Sample Rewards Card'});
 const now=new Date();const due=new Date(now.getFullYear(),now.getMonth(),18).toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric'});await expect(card).toContainText('Due '+due);await expect(card).not.toContainText('Lender last checked');
 await page.getByRole('button',{name:'Transactions',exact:true}).click();await page.getByRole('button',{name:'Add record',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('group',{name:'Record type'})).toHaveCount(0);
 await dialog.getByLabel('What’s it for?',{exact:true}).fill('Store refund');await dialog.getByLabel('Card used',{exact:true}).selectOption('account-card-1');await dialog.getByLabel('Transaction amount',{exact:true}).fill('-66.96');
 await dialog.getByText('Refund or credit? (optional)',{exact:true}).click();await dialog.getByLabel('Decrease classification').selectOption('credit');await dialog.getByRole('button',{name:'Save transaction',exact:true}).click();
 await expect(page.locator('.simple-total>strong')).toHaveText('$0.00');const entry=page.locator('.payment-activity>article').filter({hasText:'Store refund'});await expect(entry).toContainText('Refund / credit');
 await entry.locator('.transaction-edit-surface').click();await dialog.getByLabel('Transaction amount',{exact:true}).fill('-50');await dialog.getByRole('button',{name:'Save transaction',exact:true}).click();
 await entry.getByText('Balance history & corrections',{exact:true}).click();await expect(entry).toContainText('net $16.96');await expect(entry).toContainText('Prior version');
 await page.getByRole('button',{name:'Debts',exact:true}).click();await expect(card.locator('.simple-balance')).toHaveText('$2,400.75');
 await card.getByRole('button',{name:'Update balance for Sample Rewards Card',exact:true}).click();await dialog.getByRole('button',{name:'Confirm balance update'}).click();
 await expect(card.locator('.simple-balance')).toHaveText('$2,400.75');await expect(card).not.toContainText('Lender last checked unknown');
 await page.reload();await expect(card.locator('.simple-balance')).toHaveText('$2,400.75');
});
