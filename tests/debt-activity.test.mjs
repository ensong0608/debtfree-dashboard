import test from "node:test";
import assert from "node:assert/strict";
import { buildDebtActivity, buildActualProgress, recentDebtMonths } from "../app/debt-activity.ts";
const date=new Date("2026-10-07T12:00:00");
const account={id:"card",name:"Citi1",balance:1000,baselineBalance:1000,balanceOffset:-150,createdAt:"2026-08-01",type:"Credit card",apr:0,minimum:25,minimumMode:"manual",payoffMode:"priority"};
const transaction=(id,type,amount,extra={})=>({id,accountId:"card",date:"2026-10-05",createdAt:"2026-10-05T12:00:00",type,amount,payeeName:"Card",memo:"",category:"Debt payment",...extra});
const adjustment={id:"adjustment",accountId:"card",date:"2026-10-06",createdAt:"2026-10-06T12:00:00",difference:-150,balanceBefore:900,balanceAfter:750};
test("six months include empty months and rollover across years",()=>{
 assert.deepEqual(recentDebtMonths(new Date("2026-02-01T12:00:00")),["2026-02","2026-01","2025-12","2025-11","2025-10","2025-09"]);
});
test("counts two payments and confirmed updates once, retaining increases and manual reductions",()=>{
 const transactions=[transaction("p1","payment",100),transaction("p2","payment",200),transaction("interest","fee",30),transaction("deleted","payment",500,{deletedAt:"2026-10-06"}),transaction("old","payment",40,{date:"2026-03-01"})];
 const months=buildDebtActivity("card",transactions,[adjustment],date);
 assert.equal(months.length,6);assert.equal(months[0].paymentCount,2);assert.equal(months[0].payments,300);assert.equal(months[0].increases,30);assert.equal(months[0].decreases,450);assert.equal(months[0].netChange,-420);
 assert.equal(months[1].paymentCount,0);assert.equal(months[1].rows.length,0);
 assert.equal(buildDebtActivity("card",transactions,[{...adjustment,confirmedPayment:{confirmedAt:"2026-10-06"}}],date)[0].paymentCount,3);
 assert.equal(transactions.length,5);
});
test("actual progress includes manual updates without counting confirmations twice and ignores snapshots as baseline",()=>{
 const transactions=[transaction("p1","payment",100),transaction("interest","fee",30)];
 const snapshot={month:"2026-10",totalBalance:9999,accounts:[]};
 const report=buildActualProgress([account],transactions,[{...adjustment,confirmedPayment:{confirmedAt:"2026-10-06"}}],[snapshot],date);
 assert.equal(report.starting,1000);assert.equal(report.current,780);assert.equal(report.reduction,220);assert.equal(report.monthlyChange,-220);assert.equal(report.paymentCount,2);assert.equal(report.groups[0].current,780);
 assert.equal(buildActualProgress([account],transactions,[adjustment],[],date).starting,report.starting);
 assert.equal(snapshot.totalBalance,9999);
});
test("increases remain visible and legacy baselines and archived paid cards stay in tracking totals",()=>{
 const report=buildActualProgress([{...account,baselineBalance:undefined,balanceOffset:100}],[],[],[],date);
 assert.equal(report.comparisonAvailable,false);assert.equal(report.starting,0);assert.equal(report.current,1100);assert.equal(report.reduction,0);assert.equal(report.percent,0);
 const paid=buildActualProgress([{...account,balanceOffset:-1000,archivedAt:"2026-10-07"}],[],[],[],date);
 assert.equal(paid.reduction,1000);assert.equal(paid.groups[0].accounts.length,1);
});
