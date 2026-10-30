import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveAprOn } from '../app/debt-terms.ts';
import { forecastApr } from '../app/payoff-engine.ts';
import { estimateCycleInterest } from '../app/interest-accrual.ts';
const card={id:'synthetic',type:'Credit card',balance:1000,apr:24,promoApr:0,promoEnabled:true,promoEndDate:'2026-10-31',postPromoApr:0,minimum:25,postPromoMinimum:0,createdAt:'2026-09-01',interestAutomation:{enabled:true,coveredThrough:'2026-09-01',estimatedApr:24}};
test('current, forecast and dated estimates agree on inclusive promotional end and expiry',()=>{
 for(const [day,apr] of [['2026-10-30',0],['2026-10-31',0],['2026-11-01',24]]){
  assert.equal(effectiveAprOn(card,day),apr);
  assert.equal(forecastApr(card,1,new Date(day+'T20:00:00Z')),apr);
 }
 assert.equal(forecastApr(card,2,new Date('2026-10-31T20:00Z')),24);
 assert.equal(estimateCycleInterest(card,[],'2026-10-30','2026-11-01').estimatedApr,12);
 assert.equal(estimateCycleInterest(card,[],'2026-10-30','2026-10-31').amount,0);
});
test('legacy, disabled and non-card promotions retain regular rates and historical estimate overrides',()=>{
 const legacy={...card,apr:2,promoApr:undefined,postPromoApr:28};
 assert.equal(effectiveAprOn(legacy,'2026-10-31'),2);assert.equal(effectiveAprOn(legacy,'2026-11-01'),28);
 assert.equal(effectiveAprOn({...card,promoEnabled:false},'2026-10-31'),24);
 assert.equal(effectiveAprOn({...card,type:'Personal loan'},'2026-10-31'),24);
 assert.equal(effectiveAprOn({...card,promoEndDate:''},'2026-10-31',19),19);
});
test('projected months clamp short months and Pacific midnight determines the current rate',()=>{
 const boundary={...card,promoEndDate:'2027-02-28'};
 assert.equal(forecastApr(boundary,2,new Date('2027-01-31T20:00Z')),0);
 assert.equal(forecastApr(boundary,3,new Date('2027-01-31T20:00Z')),24);
 assert.equal(forecastApr(card,1,new Date('2026-11-01T06:59:59Z')),0);
 assert.equal(forecastApr(card,1,new Date('2026-11-01T07:00:00Z')),24);
});
