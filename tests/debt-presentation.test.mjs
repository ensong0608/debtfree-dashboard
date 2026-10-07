import assert from "node:assert/strict";
import test from "node:test";
import { categoryBalances, categoryGradient, payoffMilestones, trackedPayoffProgress } from "../app/debt-presentation.ts";

test("category chart sums current balances and excludes archives and zero balances", () => {
  const accounts = [{type:"Credit card",balance:100}, {type:"Credit card",balance:200}, {type:"Auto loan",balance:700}, {type:"Other",balance:0}, {type:"Auto loan",balance:999,archivedAt:"2026-10-01"}];
  assert.deepEqual(categoryBalances(accounts).map(c => [c.type,c.balance]), [["Credit card",300],["Auto loan",700]]);
  assert.equal(categoryGradient(accounts), "conic-gradient(#e8b63b 0% 30%, #9473e4 30% 100%)");
  assert.equal(categoryGradient([]), "#e4e8ed");
});
test("progress uses the saved baseline and never invents an original loan amount", () => {
  assert.equal(trackedPayoffProgress({balance:750,baselineBalance:1000}),25);
  assert.equal(trackedPayoffProgress({balance:1200,baselineBalance:1000}),0);
  assert.equal(trackedPayoffProgress({balance:0,baselineBalance:1000}),100);
  assert.equal(trackedPayoffProgress({balance:750}),null);
  assert.equal(trackedPayoffProgress({balance:0,baselineBalance:0}),null);
});
test("milestones identify accounts by ID, handle ties, and suppress unreliable forecasts", () => {
  const accounts = [{id:"a",name:"Same name",balance:100}, {id:"b",name:"Same name",balance:200}, {id:"paid",name:"Paid",balance:0}, {id:"missing",name:"Missing",balance:50}];
  const plan = {stalled:false,months:[{month:1,balances:{a:0,b:100}},{month:2,balances:{a:0,b:0}}]};
  assert.deepEqual(payoffMilestones(accounts,plan).map(m => [m.account.id,m.month.month]),[["a",1],["b",2]]);
  assert.deepEqual(payoffMilestones(accounts,{...plan,stalled:true}),[]);
});
