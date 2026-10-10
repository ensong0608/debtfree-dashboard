import test from 'node:test';
import assert from 'node:assert/strict';
import {recurringDueDate} from '../app/recurring-due-date.ts';
test('due dates use the saved day in each current month',()=>{
 assert.equal(recurringDueDate('2026-08-17','2026-10'),'2026-10-17');
 assert.equal(recurringDueDate('2026-08-17','2027-01'),'2027-01-17');
});
test('short months clamp without losing the original recurring day',()=>{
 const saved='2026-08-31';
 assert.equal(recurringDueDate(saved,'2027-02'),'2027-02-28');
 assert.equal(recurringDueDate(saved,'2028-02'),'2028-02-29');
 assert.equal(recurringDueDate(saved,'2028-03'),'2028-03-31');
 assert.equal(recurringDueDate(saved,'2026-04'),'2026-04-30');
});
test('unset due dates stay unset',()=>{
 assert.equal(recurringDueDate('','2026-10'),'');
 assert.equal(recurringDueDate('invalid','2026-10'),'');
});
