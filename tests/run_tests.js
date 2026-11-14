/* Groundwork checks: the bundle, the path rules, and the calculator engine on the worked example.
   Run: node tests/run_tests.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { window: {}, console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'data', 'bundle.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'engine', 'calc.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'engine', 'path.js'), 'utf8'), ctx);
const D = ctx.window.HC, calc = ctx.window.HCcalc, P = ctx.window.GWpath;
const items = D.costs.items;
let failures = 0;
function check(name, ok, detail) { console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok || detail == null ? '' : '  -> ' + detail)); if (!ok) failures++; }
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 0.5 : tol);
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

console.log('1. Bundle matches the JSON files');
for (const [key, fn] of [['costs', 'costs.json'], ['land', 'land_values.json'], ['tax', 'property_tax.json'], ['counties', 'counties.json'], ['rent', 'rent.json'], ['stage', 'stage.json']]) {
  const j = JSON.parse(fs.readFileSync(path.join(root, 'data', fn), 'utf8'));
  check(fn + ' is in bundle.js unchanged', JSON.stringify(j) === JSON.stringify(D[key]), 'run python scripts/bundle_data.py');
}
check('rent table has every state and DC', Object.keys(D.rent.counties).length === 51);
const fannin = D.rent.counties.TX['48147'];
check('Fannin County TX rent: 2BR $985, 3BR $1,370 (HUD FY2026)', fannin && fannin.fmr2 === 985 && fannin.fmr3 === 1370);
check('every stage source has a name and a link or is an estimate with a basis', Object.values(D.stage.sources).every((s) => s.name && (s.url || (s.estimate && s.basis))));

console.log('2. What the family needs');
const man = { cash: 3000, debt: 12000, debtm: 350, inc: 2400, from: 'job', adults: 2, kids: 2, exp: 'none', place: 'rent', move: 'yes', state: 'TX', county: 'Fannin', hours: 10, health: 'none', has: true };
const n = P.needs(man, D);
check('family of four', n.family === 4);
check('rent is the HUD 3-bedroom figure for Fannin County', n.rent === 1370 && n.rentFound);
check('one or two people get the 2-bedroom figure', P.needs(Object.assign({}, man, { adults: 1, kids: 0 }), D).rent === 985);
check('owning land already means no rent line', P.needs(Object.assign({}, man, { place: 'own' }), D).rent === 0);
check('health through work is not counted', P.needs(Object.assign({}, man, { health: 'work' }), D).health === 0);
check('debt payments carry in', n.debt === 350);
check('his own spending figure replaces the BLS average', P.needs(Object.assign({}, man, { spend: 2500 }), D).household === 2500 && P.needs(Object.assign({}, man, { spend: 2500 }), D).householdAverage === n.household);
const poor = P.needs(Object.assign({}, man, { inc: 1000, adults: 1, kids: 0 }), D);
check('below the poverty line the marketplace credit does not apply', poor.pctFpl < 100 && poor.health === D.stage.aca.benchmark_single.TX && poor.fplIncomeMonthly === Math.ceil(D.stage.aca.fpl['1'] / 12));
check('out each month = household + rent + health + debt', n.outgo === n.household + n.rent + n.health + n.debt);
check('gap = income - out', n.gap === 2400 - n.outgo);
check('cushion target = runway months x out', near(n.runwayTarget, D.stage.runway.months * n.outgo, 1));
if (D.stage.household_by_size) {
  const single = P.needs(Object.assign({}, man, { adults: 1, kids: 0 }), D);
  check('household spending for one man is the BLS one-person figure', near(single.household, D.stage.household_by_size.items['1'] / 12, 1));
}
if (D.stage.aca) {
  const lowInc = P.needs(Object.assign({}, man, { inc: 3000, adults: 2, kids: 2 }), D);
  check('marketplace premium is capped at the sliding-scale share of income at low income', lowInc.health < items.health_family_monthly.typ && lowInc.pctFpl > 0, lowInc.health);
}

console.log('3. Where he stands');
const r = P.path(man, D, calc);
check('short of money in: stage 1', r.where.current === 's1');
check('stage 1 months unknown while money out exceeds money in', r.stages[0].months === null && r.monthsUnknown);
const steady = Object.assign({}, man, { inc: 9000, cash: 30000 });
const r2 = P.path(steady, D, calc);
check('money in covers out and cushion in hand: stage 2', r2.where.current === 's2' && r2.where.done.s1);
check('stage 2 is 24 months for a man who never worked cattle', r2.stages[1].months === 24);
check('12 months with some experience', P.path(Object.assign({}, steady, { exp: 'some' }), D, calc).stages[1].months === 12);
const proven = Object.assign({}, steady, { exp: 'two' });
check('two years in: stage 3', P.path(proven, D, calc).where.current === 's3');
const ran = Object.assign({}, steady, { exp: 'own' });
check('ran his own: stage 4', P.path(ran, D, calc).where.current === 's4' && P.path(ran, D, calc).where.done.s3);
check('owns land already: stage 5 marked done', P.path(Object.assign({}, ran, { place: 'own' }), D, calc).where.done.s5);

console.log('4. Stage figures');
const s1 = r2.stages[0], s3 = r2.stages[2], s4 = r2.stages[3], s5 = r2.stages[4];
check('months to the cushion = shortfall / monthly surplus', r.stages[0].monthsToRunway === null && s1.monthsToRunway === 0);
const shortMan = Object.assign({}, man, { inc: 9000, cash: 1000 });
const rs = P.path(shortMan, D, calc);
const ns = rs.needs;
check('a man with a surplus gets a month count to the cushion', rs.stages[0].monthsToRunway === Math.ceil((ns.runwayTarget - 1000) / ns.gap));
check('debt months = debt / (payments + surplus)', rs.stages[0].debtMonths === Math.ceil(12000 / (350 + ns.gap)));
check('head by hours = hours x 52 / high hours per cow', s3.headByHours === Math.floor(10 * 52 / items.labor_hours_cow.high));
check('custom care per head matches the calculator deal', near(s3.deals.custom.net, calc.dealPerHead('custom', r2.calcInput, D).net, 1));
check('handling setup is the cost item', s3.handling === items.handling_setup.typ);
check('microloan buys floor(50,000 / cow capital) cows', s3.cowsPerMicro === Math.floor(items.fsa_microloan_max.typ / (items.cow_bred.typ + items.bull.typ / 25)));
check('stage 4 uses the rent path from the calculator plan', s4.needsYear === calc.plan(r2.calcInput, D, calc.compute(r2.calcInput, D)).paths.rent.needs);
check('stage 5 down payment = 5% of a modest place', near(s5.down, s5.setupTotal * D.stage.fsa.down_payment_pct / 100, 1));
check('calculator input carries his income as work income', r2.calcInput.work_income === 9000 * 12);
check('calculator input uses the county land value', r2.calcInput.price_per_acre > 0 && r2.calcInput.county === 'Fannin County');

console.log('4b. Paying off what he owes');
const dp = P.debtPlan([{ name: 'Card', bal: 3000, pay: 90, rate: 24 }, { name: 'Truck', bal: 8000, pay: 350, rate: 9 }], 500);
check('smallest balance is paid first when there is money to spare', dp.order[0].name === 'Card' && dp.order[0].paidMonth < dp.order[1].paidMonth);
check('order is listed by payoff month', P.debtPlan([{ name: 'Card', bal: 3000, pay: 90, rate: 24 }, { name: 'Truck', bal: 8000, pay: 350, rate: 9 }], 0).order[0].name === 'Truck');
check('everything clears in a sane number of months', dp.months > 6 && dp.months < 24, dp.months);
check('monthly budget = minimums + extra', dp.monthly === 90 + 350 + 500);
check('interest is charged when a rate is given', dp.interest > 0);
const dp0 = P.debtPlan([{ name: 'A', bal: 1200, pay: 100, rate: 0 }], 0);
check('no interest: 1,200 at 100 a month clears in 12 months', dp0.months === 12 && dp0.interest === 0);
const stuck = P.debtPlan([{ name: 'A', bal: 10000, pay: 50, rate: 30 }], 0);
check('a payment below the interest is reported as stuck', stuck.stuck && stuck.months === null);
check('no debts: nothing to pay', P.debtPlan([], 100).months === null && P.debtPlan([], 100).order.length === 0);

console.log('5. Calculator engine still agrees with itself');
const inp = r2.calcInput;
const c = calc.compute(inp, D);
check('setup total = sum of setup lines', near(c.setupTotal.typ, c.setup.reduce((t, l) => t + l.typ, 0), 2));
check('every line cites a source that exists', c.setup.concat(c.annual, c.income).every((l) => l.source === 'you' || l.source === 'tax' || !!D.costs.sources[l.source]));

console.log(failures ? '\n' + failures + ' check(s) FAILED' : '\nAll checks passed');
process.exit(failures ? 1 : 0);
