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
check('his own rent or lot rent figure wins over the HUD figure', P.needs(Object.assign({}, man, { rent: 650 }), D).rent === 650 && P.needs(Object.assign({}, man, { rent: 650 }), D).rentOwn);
check('health through work is not counted', P.needs(Object.assign({}, man, { health: 'work' }), D).health === 0);
check('Medicare, VA or Medicaid is not counted either', P.needs(Object.assign({}, man, { health: 'other' }), D).health === 0);
check('a spending figure as big as the income gets a warning', !!P.needs(Object.assign({}, man, { inc: 15000, spend: 15000 }), D).spendWarning && !P.needs(Object.assign({}, man, { inc: 15000, spend: 4000 }), D).spendWarning);
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
const ranPath = P.path(ran, D, calc);
check('ran his own: stage 4, or stage 5 when what he keeps already covers the family', ranPath.where.done.s3 && ranPath.where.current === (ranPath.stages[3].gapYear <= 0 ? 's5' : 's4'), ranPath.where.current);
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

const retiree = P.path({ cash: 100000, debt: 400000, debtm: 7000, inc: 15000, from: 'pension', spend: 8000, rent: 1000, adults: 2, kids: 0, exp: 'own', place: 'rent', move: 'yes', state: 'AZ', county: '', hours: 20, health: 'other', has: true }, D, calc);
check('retiree: $1,000 short, health not charged', retiree.needs.gap === -1000 && retiree.needs.health === 0, retiree.needs.gap);
check('retiree: the job is not the advice; the payments are', !retiree.stages[0].jobFits && retiree.stages[0].debtHeavy && retiree.stages[0].cashYears === 8.3);
check('a man with no income is pointed at the job', P.path(Object.assign({}, man, { inc: 0 }), D, calc).stages[0].jobFits);

const rv = P.path(Object.assign({}, man, { place: 'motorhome', inc: 9000, cash: 30000, exp: 'own' }), D, calc);
check('a motorhome is the house: no house line at stage 5', !rv.calcInput || rv.calcInput.house === 'existing');
check('motorhome: stage 5 costs less than with a used mobile home', rv.stages[4].setupTotal < P.path(Object.assign({}, man, { place: 'rent', inc: 9000, cash: 30000, exp: 'own' }), D, calc).stages[4].setupTotal);

const haves = Object.assign({}, man, { inc: 5000, cash: 30000, exp: 'two', has_rv: 1, has_truck: 1, has_trailer: 1, has_panels: 1, live: 'lease', grass_acres: 160, cows_n: 12, hours: 20 });
const hv = P.path(haves, D, calc);
check('what he has: no truck or trailer to buy, his housing is the house', hv.calcInput.truck === false && hv.calcInput.trailer === false && hv.calcInput.house === 'existing');
check('what he has: panels he owns take the handling cost to zero', hv.stages[2].handling === 0);
check('what he has: living on the lease adds a pad from the page\'s own well, power and tank items', hv.stages[2].pad === Math.round(items.well_per_ft.typ * hv.calcInput.well_depth + items.well_pump_package.typ + items.electric_line_per_ft.typ * 300 + items.electric_service.typ + items.holding_tank.typ));
check('what he has: no rent line while living on the lease', hv.needs.rent === 0 && hv.needs.live === 'lease');
check('what he has: 160 leased acres cap the head at 40', hv.stages[2].headByGrass === 40 && hv.stages[2].head === Math.min(40, hv.stages[2].headByHours));
check('what he has: cows of his own put stage 3 behind him', hv.where.done.s3 && hv.where.current !== 's3');
const covered = P.path(Object.assign({}, man, { inc: 15000, cash: 100000, exp: 'own', spend: 4000, health: 'other' }), D, calc);
check('income that covers the family marks stage 4 done and puts him at stage 5', covered.where.done.s4 && covered.where.current === 's5', covered.where.current);
check('what he has: the herd starts from his 12 cows', hv.stages[3].start >= Math.min(12, hv.stages[3].own.head) && /12 you have/.test(hv.stages[3].startText), hv.stages[3].startText);
check('what he has: his 12 cows on the lease count as money coming in', hv.needs.cattle > 0 && hv.needs.income === 5000 + hv.needs.cattle, hv.needs.cattle);
check('cows with no grass yet are not counted as income', P.needs(Object.assign({}, man, { cows_n: 8 }), D, calc).cattle === 0);
check('a hand already earning the ranch wage is not sent to a ranch hand job', !P.path(Object.assign({}, man, { inc: 2800, from: 'job', state: 'MO' }), D, calc).stages[0].jobFits);
check('a disabled man with five hours a week is not sent to a full-time job', !P.path(Object.assign({}, man, { inc: 1400, from: 'pension', hours: 5 }), D, calc).stages[0].jobFits);
check('stage 4 is not done for a man with no cattle, even when work covers the family', !P.path(Object.assign({}, man, { inc: 9000, cash: 30000, exp: 'two' }), D, calc).where.done.s4);
check('shares that lose money at the state lease rate are not a rung', !P.rungs(Object.assign({}, man, { state: 'MO' }), D, calc).rungs.some((x) => x.key === 'share') && P.path(Object.assign({}, man, { state: 'MO' }), D, calc).stages[2].shareWorks === false);
check('stage 5 takes a year at the least when it is ahead', P.path(steady, D, calc).stages[4].months >= 12);
check('horses he owns are kept, not bought', !calc.compute(P.calcInput(Object.assign({}, man, { horses_n: 2 }), P.needs(man, D, calc), D), D).setup.some((l) => l.key === 'horses'));
const hr = P.rungs(haves, D, calc);
check('what he has: the cows he has are a rung, reachable now on his grass', hr.rungs.find((x) => x.key === 'have') && hr.rungs.find((x) => x.key === 'have').reach.months === 0);
check('RV park lot rent is the estimate unless he gives a figure', P.needs(Object.assign({}, man, { live: 'rvpark' }), D).rent === items.rv_lot_monthly.typ && P.needs(Object.assign({}, man, { live: 'rvpark', rent: 500 }), D).rent === 500);
check('a mobile home he owns adds the moving cost to the place', P.path(Object.assign({}, man, { has_mobile: 1, inc: 9000, cash: 30000 }), D, calc).stages[4].movingMobile);

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

console.log('4c. What he can get to');
const rg = P.rungs(man, D, calc);
check('rungs: the job first for a man short of income, the place last', rg.rungs[0].key === 'job' && rg.rungs[rg.rungs.length - 1].key === 'place', rg.rungs.map((x) => x.key).join(','));
check('rungs: no job rung for a man whose income is already there', !P.rungs(Object.assign({}, man, { inc: 9000 }), D, calc).rungs.some((x) => x.key === 'job'));
check('rungs: the cows he has come before rungs he cannot reach yet', hr.rungs.findIndex((x) => x.key === 'have') < hr.rungs.findIndex((x) => x.key === 'custom'));
check('no rung shows a negative figure', rg.rungs.every((x) => x.figure >= 0));
check('the job rung is reachable now and pays the BLS ranch hand wage', rg.rungs[0].reach.months === 0 && rg.rungs[0].figure === Math.round(D.stage.wages.ranch_hand.states.TX.median_hourly * 2080 / 12));
const cu = rg.rungs.find((x) => x.key === 'custom');
check('custom care rung = head by hours x net per head, less lease fence upkeep', near(cu.figure, Math.max(0, cu.head * Math.round(calc.dealPerHead('custom', rg.path.calcInput, D).net) - calc.fenceFeet(cu.head * items.lease_apc.typ, 1, 1).perimeter * items.fence_barbed_per_ft.typ * items.fence_upkeep_pct.typ), 1));
const ow = rg.rungs.find((x) => x.key === 'own');
check('first cows rung = cows a microloan buys, less the loan payment', ow.head === Math.floor(items.fsa_microloan_max.typ / (items.cow_bred.typ + items.bull.typ / 25)) && ow.figure === Math.max(0, Math.round(ow.head * calc.dealPerHead('own', rg.path.calcInput, D).net - rg.path.stages[2].fsa.microPayment)));
const pl5 = rg.rungs.find((x) => x.key === 'place');
check('place rung shows the 5% down payment and a 40-year payment on the rest', pl5.figure === rg.path.stages[4].down && pl5.payment > 0 && pl5.payment < pl5.setup);
check('heroes: now is a reachable rung, place is the last rung', rg.heroes.now.reach.months === 0 && rg.heroes.place.key === 'place');
const rich = P.rungs(Object.assign({}, man, { inc: 12000, cash: 60000, exp: 'two' }), D, calc);
check('a man past stage 2 with the setup money reaches the cattle rungs now', rich.rungs.find((x) => x.key === 'custom').reach.months === 0);

console.log('5. Calculator engine still agrees with itself');
const inp = r2.calcInput;
const c = calc.compute(inp, D);
check('setup total = sum of setup lines', near(c.setupTotal.typ, c.setup.reduce((t, l) => t + l.typ, 0), 2));
check('every line cites a source that exists', c.setup.concat(c.annual, c.income).every((l) => l.source === 'you' || l.source === 'tax' || !!D.costs.sources[l.source]));

console.log(failures ? '\n' + failures + ' check(s) FAILED' : '\nAll checks passed');
process.exit(failures ? 1 : 0);
