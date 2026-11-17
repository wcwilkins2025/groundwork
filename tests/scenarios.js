/* Groundwork scenario harness: many men, many starting points, every one run through the path, the rungs and the
   rendered text of Your path. Prints each man's result in plain words and checks the rules that must hold for all of them.
   Run: node tests/scenarios.js            (report + checks)
        node tests/scenarios.js --quiet    (checks only)
        node tests/scenarios.js broke      (only scenarios whose key contains "broke") */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const only = args.filter((a) => !a.startsWith('--'));

/* ---------- a small DOM, enough for path.html's own script to render into ---------- */
function makeDom() {
  const byId = {};
  class El {
    constructor(tag) { this.tag = tag; this.children = []; this.cls = ''; this._text = ''; this.attrs = {}; this.style = {}; this.hidden = false; this.href = ''; }
    appendChild(c) { this.children.push(c); return c; }
    set className(v) { this.cls = v; } get className() { return this.cls; }
    set textContent(v) { this._text = String(v); this.children = []; }
    get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
    setAttribute(k, v) { this.attrs[k] = v; } getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; } removeAttribute(k) { delete this.attrs[k]; }
    addEventListener() {}
    querySelector(sel) { const t = sel.replace(/^\./, ''); const find = (e) => { for (const c of e.children) { if (c.tag === t || c.cls === t) return c; const f = find(c); if (f) return f; } return null; }; return find(this) || this.appendChild(new El(t)); }
    querySelectorAll() { return []; }
    /* text with a marker between children, for reading */
    lines() { const out = []; const walk = (e, depth) => { if (e._text) out.push(e._text); for (const c of e.children) walk(c, depth + 1); }; walk(this, 0); return out; }
  }
  const document = {
    createElement: (t) => new El(t),
    createTextNode: (t) => { const e = new El('#text'); e._text = String(t); return e; },
    getElementById: (id) => byId[id] || (byId[id] = Object.assign(new El('div'), { id })),
    documentElement: new El('html'),
    querySelector: (sel) => document.body.querySelector(sel.split(' ').pop()),
    body: new El('body'),
    querySelectorAll: () => [],
    addEventListener() {}
  };
  return { document, byId, El };
}

/* ---------- load the engine once, and path.html's script fresh per man ---------- */
const bundle = fs.readFileSync(path.join(root, 'data', 'bundle.js'), 'utf8');
const calcSrc = fs.readFileSync(path.join(root, 'engine', 'calc.js'), 'utf8');
const pathSrc = fs.readFileSync(path.join(root, 'engine', 'path.js'), 'utf8');
const siteSrc = fs.readFileSync(path.join(root, 'site.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'path.html'), 'utf8');
const inline = html.slice(html.lastIndexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));

const base = { window: {}, console }; vm.createContext(base);
vm.runInContext(bundle, base); vm.runInContext(calcSrc, base); vm.runInContext(pathSrc, base);
const D = base.window.HC, calc = base.window.HCcalc, P = base.window.GWpath;
const C = D.costs.items;

const DEFAULTS = { cash: 0, debt: 0, debtm: 0, inc: 0, from: 'none', spend: 0, rent: 0, adults: 1, kids: 0, exp: 'none', place: 'rent', move: 'yes', state: 'TX', county: '', hours: 10, health: 'none', debts: '', live: 'same',
  has_rv: 0, has_mobile: 0, has_truck: 0, has_trailer: 0, has_tractor: 0, has_panels: 0, has_tools: 0, horses_n: 0, cows_n: 0, grass_acres: 0, grass_rate: 0, running: 0 };

/* render path.html for one profile: returns the text of every stage, in order, plus the hero line */
function render(p) {
  const dom = makeDom();
  const ctx = { window: null, console, document: dom.document, location: { search: '', href: 'path.html', hash: '' }, navigator: { clipboard: null }, URLSearchParams, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, alert() {}, confirm: () => false, setTimeout, clearTimeout };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(bundle, ctx); vm.runInContext(calcSrc, ctx); vm.runInContext(pathSrc, ctx);
  ctx.window.GW_CONFIG = {};
  vm.runInContext(siteSrc, ctx);
  const GW = ctx.window.GW;
  GW.readProfile = () => Object.assign({ has: true }, p);
  GW.initTheme = () => {}; GW.carry = () => {}; GW.initAccount = () => {};
  vm.runInContext('(' + inline.trim().replace(/^\(function \(\) \{/, 'function () {').replace(/\}\)\(\);\s*$/, '}') + ')()', ctx);
  const stages = dom.byId.stages.children.map((li) => li.lines());
  return { stages, hero: [dom.byId.heroStage.textContent, dom.byId.heroGap.textContent, dom.byId.heroGapSub.textContent, dom.byId.heroTime.textContent, dom.byId.heroTimeSub.textContent], needsSub: dom.byId.needsSub.textContent };
}

/* ---------- the men ---------- */
const S = [];
function man(key, story, p) { S.push({ key, story, p: Object.assign({}, DEFAULTS, p) }); }

man('broke_single_tx', 'Nothing coming in, nothing in the bank, alone, never worked cattle. Texas, county unknown.', { inc: 0, cash: 0 });
man('broke_family_tx', 'No income, $200, wife and three kids, renting in Fannin County TX.', { inc: 0, cash: 200, adults: 2, kids: 3, county: 'Fannin' });
man('parttime_single_ok', 'Part-time work, $1,500 a month, $500 saved. Oklahoma.', { inc: 1500, from: 'job', cash: 500, state: 'OK' });
man('ranch_hand_mo', 'Already a hand at $2,800 a month with insurance, a truck note, some experience. Missouri.', { inc: 2800, from: 'job', cash: 2000, debt: 8000, debtm: 250, exp: 'some', state: 'MO', health: 'work', has_truck: 1 });
man('middle_family_tx', 'Town job $5,000, insurance through work, two kids, $20,000 owed at $600. Fannin County.', { inc: 5000, from: 'job', cash: 8000, debt: 20000, debtm: 600, adults: 2, kids: 2, county: 'Fannin', health: 'work' });
man('steady_couple_ok', 'Couple, $7,000 a month, $25,000 saved, two years on a ranch behind him, 15 hours a week. Oklahoma.', { inc: 7000, from: 'job', cash: 25000, adults: 2, exp: 'two', hours: 15, state: 'OK', health: 'work' });
man('retiree_az_motorhome', 'Retired couple in a motorhome, $15,000 a month, $100,000 cash, $400,000 owed at $7,000 a month, ran his own place once. Arizona.', { cash: 100000, debt: 400000, debtm: 7000, inc: 15000, from: 'pension', spend: 8000, rent: 1000, adults: 2, exp: 'own', place: 'motorhome', has_rv: 1, state: 'AZ', hours: 20, health: 'other' });
man('retiree_modest_mo', 'Retired couple, $4,500 pension, $60,000 saved, Medicare, never worked cattle, 25 hours a week. Missouri.', { inc: 4500, from: 'pension', cash: 60000, adults: 2, exp: 'none', hours: 25, state: 'MO', health: 'other' });
man('disabled_single_tx', 'Disability, $1,400 a month, nothing saved, Medicare, 5 hours a week. Texas.', { inc: 1400, from: 'pension', cash: 0, hours: 5, health: 'other' });
man('young_rvpark_tx', 'Single, $3,200 job, lives in his motorhome in an RV park, some experience, 15 hours.', { inc: 3200, from: 'job', cash: 4000, place: 'motorhome', has_rv: 1, live: 'rvpark', exp: 'some', hours: 15 });
man('with_family_ok', 'Couple with one child living with family, $3,500 a month, $1,000 saved. Oklahoma.', { inc: 3500, from: 'job', cash: 1000, adults: 2, kids: 1, live: 'family', state: 'OK' });
man('owns_house_tx', 'Owns a house in town, $6,000 a month, $15,000 saved, couple, insurance through work.', { inc: 6000, from: 'job', cash: 15000, adults: 2, place: 'house', health: 'work' });
man('owns_land_mo', 'Already owns land, $4,000 a month, $10,000 saved, two years experience, 20 hours. Missouri.', { inc: 4000, from: 'job', cash: 10000, exp: 'two', hours: 20, place: 'own', state: 'MO' });
man('owns_land_cows_ok', 'Owns land and 25 cows, $3,000 a month, ran his own before, 30 hours. Oklahoma.', { inc: 3000, from: 'own', cash: 5000, exp: 'own', cows_n: 25, hours: 30, place: 'own', state: 'OK' });
man('haves_on_lease_tx', 'RV, truck, trailer, panels, 160 leased acres, 12 cows, living on the lease, $5,000 a month, $30,000 saved.', { inc: 5000, from: 'job', cash: 30000, exp: 'two', has_rv: 1, has_truck: 1, has_trailer: 1, has_panels: 1, live: 'lease', grass_acres: 160, cows_n: 12, hours: 20, adults: 2, kids: 2, county: 'Fannin' });
man('debt_stuck_tx', '$3,000 a month, $60,000 owed at $1,800 a month, wife and two kids, no insurance.', { inc: 3000, from: 'job', cash: 0, debt: 60000, debtm: 1800, adults: 2, kids: 2 });
man('debt_list_tx', 'Single, $4,500 a month, three debts listed with rates.', { inc: 4500, from: 'job', cash: 2000, debts: [{ name: 'Card', bal: 4000, pay: 120, rate: 24 }, { name: 'Truck', bal: 18000, pay: 450, rate: 8 }, { name: 'Medical', bal: 2200, pay: 50, rate: 0 }], debtm: 620, debt: 24200 });
man('high_earner_ca', 'Couple with two kids, $12,000 a month, $150,000 saved, never worked cattle. California.', { inc: 12000, from: 'job', cash: 150000, adults: 2, kids: 2, state: 'CA', health: 'work' });
man('cash_no_income_tx', 'Sold a house: $250,000 cash, no income, couple, 40 hours a week free, no insurance.', { inc: 0, cash: 250000, adults: 2, hours: 40 });
man('poor_wy', 'Single, $1,200 a month, Wyoming, no insurance.', { inc: 1200, from: 'job', state: 'WY' });
man('poor_family_al', 'Wife and two kids, $2,200 a month, Alabama, no insurance.', { inc: 2200, from: 'job', adults: 2, kids: 2, state: 'AL' });
man('poor_ny', 'Single, $1,200 a month, New York, no insurance.', { inc: 1200, from: 'job', state: 'NY' });
man('fulltime_hours_tx', 'Own work $2,000 a month, 40 hours a week free, two years experience, $10,000 saved.', { inc: 2000, from: 'own', hours: 40, exp: 'two', cash: 10000 });
man('mobile_home_mo', 'Owns a mobile home, couple, $4,000 a month, $12,000 saved, some experience. Missouri.', { inc: 4000, from: 'job', cash: 12000, adults: 2, has_mobile: 1, exp: 'some', state: 'MO' });
man('spend_misuse_tx', 'Put his whole $6,000 income in the spending box.', { inc: 6000, from: 'job', spend: 6000, cash: 3000 });
man('five_kids_tx', 'Wife and five kids, $4,000 a month, $1,000 saved, no insurance.', { inc: 4000, from: 'job', cash: 1000, adults: 2, kids: 5 });
man('grass_no_cows_tx', '80 acres leased at $20, no cows yet, $4,000 a month, $8,000 saved, two years in, 10 hours.', { inc: 4000, from: 'job', cash: 8000, exp: 'two', grass_acres: 80, grass_rate: 20 });
man('horses_tractor_tx', 'Three horses, a tractor and tools, $4,500 a month, $6,000 saved, some experience.', { inc: 4500, from: 'job', cash: 6000, horses_n: 3, has_tractor: 1, has_tools: 1, exp: 'some' });
man('stay_put_tx', 'Cannot move; Fannin County; $3,800, $2,500 saved, couple.', { inc: 3800, from: 'job', cash: 2500, adults: 2, move: 'no', county: 'Fannin' });
man('big_herd_no_job_tx', '150 cows on 600 leased acres, no job, $20,000 cash, ran his own, 40 hours, no insurance.', { inc: 0, cash: 20000, exp: 'own', cows_n: 150, grass_acres: 600, hours: 40, has_truck: 1, has_trailer: 1, has_panels: 1 });
man('three_adults_tx', 'Three adults and a child, $7,500 a month, $5,000 saved.', { inc: 7500, from: 'job', cash: 5000, adults: 3, kids: 1 });
man('high_rent_tx', 'Single paying $2,500 rent on $5,000 a month.', { inc: 5000, from: 'job', rent: 2500, cash: 4000 });
man('surplus_no_cash_tx', 'Couple, $9,000 a month, nothing saved yet, never worked cattle.', { inc: 9000, from: 'job', cash: 0, adults: 2 });
man('own_cows_no_grass_tx', 'Owns 8 cows but no grass yet, $3,500 a month, two years in.', { inc: 3500, from: 'job', cash: 6000, exp: 'two', cows_n: 8 });
man('marketplace_single_tx', 'Single on a marketplace plan he pays for, $3,000 a month.', { inc: 3000, from: 'job', cash: 2000, health: 'marketplace' });
man('mt_no_wage_row', 'Montana (no state wage or course rows), $3,000 a month, $5,000 saved.', { inc: 3000, from: 'job', cash: 5000, state: 'MT' });

/* ---------- checks that must hold for every man ---------- */
let failures = 0, total = 0;
function check(key, name, ok, detail) { total++; if (!ok) { failures++; console.log('  FAIL [' + key + '] ' + name + (detail == null ? '' : '  -> ' + detail)); } }
const BAD = /NaN|undefined|Infinity|\$-|-\$|\bnull\b|\[object/;
function mo(m) { return m == null ? 'not yet' : m === 0 ? 'now' : m < 12 ? m + ' mo' : (Math.round(m / 12 * 10) / 10) + ' yr'; }
const money = (n) => (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US');

const sender = require(path.join(root, 'scripts', 'send_checkins.js'));
const chosen = S.filter((s) => !only.length || only.some((o) => s.key.includes(o)));
for (const sc of chosen) {
  const p = sc.p;
  let r, R, T;
  try { r = P.path(p, D, calc); R = P.rungs(p, D, calc); T = render(p); }
  catch (e) { check(sc.key, 'runs without throwing', false, e.stack.split('\n').slice(0, 3).join(' | ')); continue; }
  const n = r.needs, w = r.where, st = r.stages;
  const [s1, s2, s3, s4, s5, s6] = st;

  if (!quiet) {
    console.log('\n== ' + sc.key + ' ==  ' + sc.story);
    console.log('  in ' + money(n.income) + '  out ' + money(n.outgo) + ' (hh ' + money(n.household) + ', rent ' + money(n.rent) + ', health ' + money(n.health) + ', debt ' + money(n.debt) + ')  gap ' + money(n.gap) + '  cash ' + money(n.cash) + '  cushion ' + money(n.runwayTarget));
    if (n.healthNote) console.log('  health: ' + n.healthNote);
    if (n.spendWarning) console.log('  warn: ' + n.spendWarning);
    console.log('  stands at stage ' + (w.index + 1) + ' (' + P.STAGES[w.index].name + ')  done: ' + Object.keys(w.done).filter((k) => w.done[k]).join(',') + '  time to the place: ' + (r.monthsUnknown ? 'not yet' : mo(r.months)));
    console.log('  s1 months ' + mo(s1.months) + ' | jobFits ' + s1.jobFits + ' debtHeavy ' + s1.debtHeavy + ' spendHeavy ' + s1.spendHeavy + ' cashYears ' + s1.cashYears + ' debtMonths ' + s1.debtMonths);
    console.log('  s2 ' + mo(s2.months) + ' | s3 head ' + s3.head + ' (hours ' + s3.headByHours + ', grass ' + s3.headByGrass + ') custom ' + money(s3.head * s3.deals.custom.net) + '/yr share ' + money(s3.head * s3.deals.share.net) + '/yr setup ' + money(s3.setupNeeded) + ' short ' + money(s3.handlingShort) + ' ' + mo(s3.months));
    console.log('  s4 gap/yr ' + money(s4.gapYear) + ' own.head ' + (s4.own && s4.own.head) + ' acres ' + (s4.own && s4.own.acres) + ' startHalf ' + s4.startHalf + ' ramp ' + s4.rampYears + ' yrs cowsNow ' + s4.cowsNow + ' ' + mo(s4.months));
    console.log('  s5 setup ' + money(s5.setupTotal) + ' down ' + money(s5.down) + ' short ' + money(s5.cashShort) + ' ' + mo(s5.months) + (s5.motorhome ? ' (motorhome is the house)' : '') + (s5.movingMobile ? ' (moving his mobile home)' : '') + ' | s6 setup ' + money(s6.setup) + ' yearly ' + money(s6.yearly) + ' cows ' + (s6.solve && s6.solve.head));
    console.log('  rungs: ' + R.rungs.map((x) => x.key + ' ' + (x.unit === 'cows' ? x.figure + ' cows' : money(x.figure)) + ' @' + mo(x.reach.months)).join(' | '));
    console.log('  heroes: now=' + (R.heroes.now && R.heroes.now.key) + ' next=' + (R.heroes.next && R.heroes.next.key) + ' place=' + (R.heroes.place && R.heroes.place.key));
    console.log('  page: ' + T.hero.join(' / '));
    T.stages.forEach((lines, i) => { console.log('  [' + (i + 1) + '] ' + lines.slice(0, 2).join(' ') + ' | ' + lines.slice(2).filter((l) => l.trim() && !/^Sources:/.test(l)).join(' ').replace(/\s+/g, ' ').slice(0, 900)); });
  }

  /* arithmetic */
  check(sc.key, 'out = household + rent + health + debt', n.outgo === n.household + n.rent + n.health + n.debt);
  check(sc.key, 'gap = in - out', n.gap === n.income - n.outgo);
  check(sc.key, 'no negative line', n.parts.every((x) => x.monthly >= 0));
  check(sc.key, 'cushion = runway months x out', Math.abs(n.runwayTarget - n.runwayMonths * n.outgo) <= 1);
  /* where he stands */
  const keys = P.STAGES.map((s) => s.key);
  check(sc.key, 'current stage is the first not done', keys.indexOf(w.current) === keys.findIndex((k) => !w.done[k]) || (keys.every((k) => w.done[k]) && w.current === 's6'), w.current + ' ' + JSON.stringify(w.done));
  check(sc.key, 'stage 1 done means money in covers out and cushion in hand', w.done.s1 === (n.income >= n.outgo && n.cash >= n.runwayTarget));
  check(sc.key, 'stage 2 done matches experience', w.done.s2 === (p.exp === 'two' || p.exp === 'own'));
  check(sc.key, 'stage 3 done when he ran his own, owns cows, or is running cattle', w.done.s3 === (p.exp === 'own' || p.cows_n > 0 || !!p.running));
  check(sc.key, 'stage 5 done only when he owns land', w.done.s5 === (p.place === 'own'));
  check(sc.key, 'stage 4 done only when covered and he is running cattle', w.done.s4 === (s4.covered && w.done.s3));
  check(sc.key, 'stage 4 covered when what he keeps covers the family, or nearly, or the herd is there', s4.covered === (s4.gapYear <= 0 || s4.nearly || !!(s4.own && s4.own.head && s4.cowsNow >= s4.own.head)));
  check(sc.key, 'a gap a cow or two covers is nearly covered, not a herd', s4.nearly === (s4.gapYear > 0 && !!(s4.own && s4.own.head && s4.own.head <= 2)) && (!s4.nearly || !R.rungs.some((x) => x.key === 'herd' && x.unit === 'cows')));
  check(sc.key, 'the now hero is never the place', R.heroes.now.key !== 'place' || R.rungs.length === 1);
  if (n.cattle > 0 && p.health === 'none') check(sc.key, 'the poverty-line math counts the cows', n.pctFpl == null || n.pctFpl >= Math.floor(n.income * 12 / D.stage.aca.fpl[String(Math.min(n.family, 8))] * 100) - 1, n.pctFpl);
  if (p.cows_n > 0 && (p.grass_acres > 0 || p.place === 'own')) check(sc.key, 'cows on grass he has count as money coming in', n.cattle > 0 && n.income === n.incomeWork + n.cattle, n.cattle);
  else check(sc.key, 'no cattle income without cows on grass', n.cattle === 0);
  if ((p.from === 'job' || p.from === 'own') && s1.ranchMonthly && n.income >= s1.ranchMonthly * 0.9) check(sc.key, 'a working man earning the ranch wage is not sent to a ranch hand job', !s1.jobFits);
  if (p.from === 'pension' && p.hours < 20 && n.income > 0) check(sc.key, 'a retired or disabled man with few hours is not sent to a full-time job', !s1.jobFits);
  if (!w.done.s5) check(sc.key, 'stage 5 ahead takes a year at the least', s5.months === null || s5.months >= 12, s5.months);
  /* months */
  st.forEach((s, i) => { if (w.done[s.key]) check(sc.key, 'a done stage takes 0 months (stage ' + (i + 1) + ')', s.months === 0, s.months); });
  st.forEach((s, i) => check(sc.key, 'months are null or a whole number >= 0 (stage ' + (i + 1) + ')', s.months === null || (Number.isInteger(s.months) && s.months >= 0), s.months));
  if (n.gap < 0) check(sc.key, 'with money out above money in, saving stages are not timed', s1.months === null || w.done.s1);
  if (n.gap >= 0 && n.cash >= n.runwayTarget) check(sc.key, 'cushion in hand: stage 1 is done', w.done.s1);
  check(sc.key, 'timeline total = sum from current stage, or unknown', r.monthsUnknown || r.months === st.slice(w.index).reduce((t, s) => t + s.months, 0));
  /* stage 1 advice */
  if (n.income === 0) check(sc.key, 'no income: the job is the advice', s1.jobFits);
  if (n.income >= 6000) check(sc.key, 'a man earning well is not sent to a ranch hand job', !s1.jobFits);
  check(sc.key, 'stage 2 months by experience', s2.monthsNeeded === ({ none: 24, some: 12, two: 0, own: 0 })[p.exp]);
  /* stage 3 */
  check(sc.key, 'head by hours = hours x 52 / high hours per cow', s3.headByHours === Math.floor(p.hours * 52 / C.labor_hours_cow.high));
  if (p.grass_acres > 0) check(sc.key, 'leased acres cap the head', s3.head <= Math.floor(p.grass_acres / C.lease_apc.typ));
  check(sc.key, 'panels he owns take handling to zero', (s3.handling === 0) === !!p.has_panels);
  check(sc.key, 'pad only when living on the lease', (s3.pad > 0) === (n.live === 'lease'));
  check(sc.key, 'setup shortfall never negative', s3.handlingShort >= 0 && s5.cashShort >= 0);
  /* stage 5 */
  check(sc.key, 'place costs something and the down payment is 5% of it', s5.setupTotal > 0 && Math.abs(s5.down - s5.setupTotal * s5.downPct / 100) <= 1);
  check(sc.key, 'his RV or mobile home is the house', s5.motorhome === !!(p.place === 'motorhome' || p.has_rv || p.has_mobile));
  if (p.has_rv || p.place === 'motorhome') check(sc.key, 'an RV owner is not charged for moving a mobile home', !s5.movingMobile);
  /* rungs */
  check(sc.key, 'no rung shows a negative figure', R.rungs.every((x) => x.figure >= 0));
  check(sc.key, 'the place is the last rung', R.rungs[R.rungs.length - 1].key === 'place');
  const reach = R.rungs.slice(0, -1).map((x) => x.reach.months == null ? 1e9 : x.reach.months);
  check(sc.key, 'rungs are soonest first', reach.every((m, i) => i === 0 || m >= reach[i - 1]), reach.join(','));
  check(sc.key, 'job rung only when the job fits', R.rungs.some((x) => x.key === 'job') === !!(s1.jobFits && s1.ranchMonthly));
  check(sc.key, 'cows he has show as a rung', R.rungs.some((x) => x.key === 'have') === (p.cows_n > 0));
  check(sc.key, 'shares are a rung only where they clear something', R.rungs.some((x) => x.key === 'share') === (s3.head > 0 && s3.shareWorks));
  const herd = R.rungs.find((x) => x.key === 'herd'), ownR = R.rungs.find((x) => x.key === 'own');
  if (herd && herd.unit === 'cows' && !(p.cows_n >= herd.head) && !(s4.startIsHis)) check(sc.key, 'the herd is reached by growing from the first cows', herd.reach.months === (ownR && ownR.reach.months != null ? ownR.reach.months + (s4.rampYears || 0) * 12 : null), herd.reach.months);
  const placeR = R.rungs[R.rungs.length - 1];
  check(sc.key, 'the place rung is on the path\'s own clock', w.done.s5 ? placeR.reach.months === 0 : placeR.reach.months === (r.monthsUnknown || s5.monthsToDown == null ? null : r.months), placeR.reach.months + ' vs ' + r.months);
  if (w.done.s5) check(sc.key, 'a land owner sees the place he has', placeR.title === 'The place you have');
  check(sc.key, 'three heroes, place last', !!(R.heroes.now && R.heroes.place) && R.heroes.place.key === 'place');
  check(sc.key, 'the now hero is reachable now or is the first rung', R.heroes.now.reach.months === 0 || R.heroes.now === R.rungs[0]);
  check(sc.key, 'a rung reachable now is not short of its setup money', R.rungs.filter((x) => x.reach.months === 0 && (x.key === 'custom' || x.key === 'share')).every(() => s3.handlingShort === 0 && (w.done.s2)), R.rungs.filter((x) => x.reach.months === 0).map((x) => x.key).join(','));
  R.rungs.forEach((x) => check(sc.key, 'rung text is clean: ' + x.key, !BAD.test([x.title, x.what, x.takes, x.leads, x.unit].join(' ')), [x.what, x.takes].join(' ').match(BAD) && [x.what, x.takes].join(' ')));
  /* the check-in email for this man */
  const tok = 'f'.repeat(48);
  const em = sender.build(p, {}, tok, 'https://groundworkpath.org/');
  check(sc.key, 'check-in names the same stage as the page', em.stage === w.current && em.subject.indexOf('stage ' + (w.index + 1) + ',') > 0, em.subject);
  check(sc.key, 'check-in text is clean', !BAD.test(em.text.replace(/https?:\/\/\S+/g, '')), (em.text.match(new RegExp('.{0,60}(' + BAD.source + ').{0,60}')) || [])[0]);
  check(sc.key, 'check-in has three questions and every button carries the token', (em.text.match(/^\d\. /gm) || []).length === 3 && (em.html.match(/checkin\.html\?t=f+&amp;a=/g) || []).length === sender.E.K.QUESTIONS[w.current].reduce((t, q) => t + q.options.length, 0));
  check(sc.key, 'check-in path link carries his plan', em.text.indexOf('path.html' + (sender.E.GW.profileQuery(p) ? '?' + sender.E.GW.profileQuery(p) : '')) > 0);
  check(sc.key, 'check-in says it is automated and how to stop', /automated/.test(em.text) && /stop=1/.test(em.html));
  if (!quiet) console.log('  check-in: ' + em.subject + ' | ' + em.standing.lines.join(' '));

  /* rendered page */
  const pageText = T.stages.map((l) => l.join(' ')).join('\n') + '\n' + T.hero.join(' ') + '\n' + T.needsSub;
  check(sc.key, 'page text is clean', !BAD.test(pageText), (pageText.match(new RegExp('.{0,60}(' + BAD.source + ').{0,60}')) || [])[0]);
  check(sc.key, 'page shows six stages', T.stages.length === 6);
  check(sc.key, 'page marks the same stage as the engine', T.hero[0] === 'Stage ' + (w.index + 1));
  check(sc.key, 'page: one stage says You are here', T.stages.filter((l) => l[0] === 'You are here').length === 1);
  check(sc.key, 'page: stages before the current one are done, 4 is never done ahead of 3, 6 is never done', T.stages.slice(0, w.index).every((l) => l[0] === 'Done') && !(w.done.s4 && !w.done.s3) && T.stages[5][0] !== 'Done', T.stages.map((l) => l[0]).join(','));
  check(sc.key, 'page never says 1 cows, 0 years or 1 years', !/\b1 cows\b|\b0 years\b|(?<![\d.])1 years\b/.test(pageText), (pageText.match(/.{0,40}(\b1 cows\b|\b0 years\b|(?<![\d.])1 years\b).{0,20}/) || [])[0]);
  check(sc.key, 'page stage 3 shows no negative figure', !/-\$/.test(T.stages[2].join(' ')));
  if (n.cattle > 0) check(sc.key, 'page says what the cows bring in', /from the cows/.test(T.hero.join(' ')));
  check(sc.key, 'page never says 0 months or about 0 years', !/\b0 months?\b|about 0 years/.test(pageText), (pageText.match(/.{0,50}(\b0 months?\b|about 0 years).{0,30}/) || [])[0]);
  if (n.gap < 0 && !w.done.s1) check(sc.key, 'page stage 1 says short, not spare', /short/.test(T.stages[0].join(' ')) && !/\$[\d,]+ spare/.test(T.stages[0].join(' ')));
}

console.log('\n' + chosen.length + ' men, ' + total + ' checks, ' + (failures ? failures + ' FAILED' : 'all passed'));
process.exit(failures ? 1 : 0);
