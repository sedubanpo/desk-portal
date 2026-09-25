import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../../../docs/subscription-details.js',import.meta.url),'utf8'),scope);
const details=scope.window.SubscriptionDetails;
test('subscription calendar validates leap years without restricting reporting month',()=>{
 for(const date of ['2024-02-29','2028-12-31','1999-01-01'])assert.equal(details.validDate(date),true);
 for(const date of ['2025-02-29','2026-09-31','invalid'])assert.equal(details.validDate(date),false);
});
test('KRW estimates distinguish missing rates and amounts from zero',()=>{
 assert.equal(details.estimate({amount:35,currency:'USD'},{rate:1400.25}),49009);
 assert.equal(details.estimate({amount:0,currency:'USD'},{rate:1400}),0);
 for(const amount of [null,'',undefined])assert.equal(details.estimate({amount,currency:'USD'},{rate:1400}),null);
 assert.equal(details.estimate({amount:35,currency:'USD'},null),null);
 assert.equal(details.estimate({amount:35,currency:'USD'},{rate:0}),null);
 assert.equal(details.estimate({amount:35,currency:'KRW'},{rate:1400}),null);
});
test('card suffixes preserve leading zeros and all configured issuer assets exist',()=>{
 assert.equal(details.cardLabel({issuer:'kb',last4:'0012'}),'KB국민카드 · 0012');
 for(const [,,asset] of details.cards)assert.ok(fs.existsSync(new URL('../../../docs/assets/cards/'+asset,import.meta.url)));
});
test('annual amounts are divided before conversion without rounding each service',()=>{
 assert.equal(details.monthlyAmount({amount:168000,currency:'KRW',billingCycle:'yearly'}),14000);
 assert.equal(details.monthlyAmount({amount:3990,billingCycle:'monthly'}),3990);
 assert.equal(details.monthlyAmount({amount:159000,billingCycle:'unknown'}),159000);
 assert.equal(details.monthlyAmount({amount:null,billingCycle:'yearly'}),null);
 assert.equal(details.monthlyAmount({amount:0,billingCycle:'yearly'}),0);
 assert.equal(details.monthlyKRW({amount:120,currency:'USD',billingCycle:'yearly'},{rate:1400}),14000);
 assert.equal(details.monthlyKRW({amount:120,currency:'USD',billingCycle:'yearly'},null),null);
 assert.equal(details.monthlyKRW({amount:168000,currency:'KRW',billingCycle:'yearly'},null),14000);
});

test('zero USD monthly cost does not need an exchange rate',()=>{assert.equal(details.monthlyKRW({amount:0,currency:'USD',billingCycle:'yearly'},null),0);});
