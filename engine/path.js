/* Groundwork: the path. Plain rules over the sourced tables.
   Takes a man's profile (site.js readProfile) and the data bundle (window.HC: costs, land, tax, counties,
   stage, rent) and returns where he stands, what each stage needs from him, and how long it takes.
   No DOM here. path.html and tests/run_tests.js both load this file after engine/calc.js. */
(function (root) {
  'use strict';

  var STAGES = [
    { key: 's1', name: 'Get steady', short: 'Money in covers money out, and a cushion in the bank.' },
    { key: 's2', name: 'Prove yourself', short: 'Two years working cattle for someone else.' },
    { key: 's3', name: 'First cattle without capital', short: 'Other men\'s cows on leased grass, while the job continues.' },
    { key: 's4', name: 'Grow', short: 'Keep heifers, add grass, own more of the herd.' },
    { key: 's5', name: 'Land', short: 'A place of your own with the house, well and septic already on it.' },
    { key: 's6', name: 'Live off it', short: 'The place, the cattle and what you keep cover the family.' }
  ];

  function fmt(n) { n = Math.round(n); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function num(x, d) { var n = +x; return isFinite(n) ? n : (d || 0); }

  function countyRow(data, st, name) {
    var rows = (data.counties && data.counties.states[st]) || [];
    var t = String(name || '').toLowerCase().replace(/\s+county$/, '');
    for (var i = 0; i < rows.length; i++) {
      var n = rows[i][1].toLowerCase().replace(/\s+county$/, '');
      if (n === t) return rows[i];
    }
    return null;
  }
  function countyRent(data, st, name) {
    var R = data.rent && data.rent.counties && data.rent.counties[st];
    if (!R) return null;
    var t = String(name || '').toLowerCase().replace(/\s+county$/, '');
    for (var fips in R) {
      var n = String(R[fips].name || '').toLowerCase().replace(/\s+county$/, '');
      if (n === t) return R[fips];
    }
    return null;
  }

  /* ---------- what the family needs each month, where he is now ---------- */
  function needs(p, data) {
    var C = data.costs.items, S = data.stage || {}, out = { parts: [] };
    var family = Math.max(1, num(p.adults, 1)) + num(p.kids, 0);
    out.family = family;

    /* household spending by family size (BLS), else the calculator's rural figure */
    var hh = null, hhSrc = '';
    if (S.household_by_size && S.household_by_size.items) {
      var key = String(Math.min(family, 5));
      if (S.household_by_size.items[key]) { hh = S.household_by_size.items[key] / 12; hhSrc = S.household_by_size.source; }
    }
    if (hh == null) { hh = C.household_spending_rural.typ / 12; hhSrc = C.household_spending_rural.source; }
    out.householdAverage = Math.round(hh);
    var own = num(p.spend) > 0;
    if (own) { hh = num(p.spend); hhSrc = 'you'; }
    out.household = Math.round(hh); out.parts.push({ key: 'household', label: 'Groceries, fuel, phone, clothes, everything else', monthly: out.household, source: hhSrc, note: own ? 'Your figure. The BLS average for ' + (family === 1 ? 'one person' : family + ' people') + ' is $' + fmt(out.householdAverage) + '.' : 'BLS average for ' + (family === 1 ? 'one person' : family + ' people') + '. Put in your own figure on Where you are.' });

    /* rent: HUD for his county, 2 bedroom for one or two people, 3 bedroom for a family */
    var rent = 0, rentSrc = '';
    if (p.place !== 'own') {
      var r = countyRent(data, p.state, p.county);
      if (r) { rent = family <= 2 ? r.fmr2 : r.fmr3; rentSrc = data.rent.source && data.rent.source.name; }
      else { rent = family <= 2 ? C.rent_monthly.low : C.rent_monthly.typ; rentSrc = C.rent_monthly.source; }
    }
    out.rent = Math.round(rent); out.rentFound = !!countyRent(data, p.state, p.county);
    out.parts.push({ key: 'rent', label: p.place === 'own' ? 'Rent (you own your place)' : 'Rent', monthly: out.rent, source: rentSrc });

    /* health insurance: through work is counted in his pay; otherwise the marketplace, capped by the subsidy rule when we have it */
    var health = 0, healthNote = '', healthSrc = C.health_family_monthly.source;
    if (p.health === 'work') { health = 0; healthNote = 'Through your job today. If you leave it, this line comes back.'; }
    else {
      var bench = S.aca && S.aca.benchmark_single && (S.aca.benchmark_single[p.state] || S.aca.benchmark_single.US);
      var full = family === 1 ? (bench || C.health_family_monthly.low) : C.health_family_monthly.typ;
      health = full;
      healthNote = family === 1 ? 'One man on the marketplace, full price, before any subsidy.' : 'A family on the marketplace, full price, before any subsidy.';
      if (S.aca && S.aca.fpl && S.aca.applicable_pct && num(p.inc) > 0) {
        var fpl = S.aca.fpl[String(Math.min(family, 8))];
        if (fpl) {
          var pctFpl = (num(p.inc) * 12) / fpl * 100;
          var cap = pctFpl >= 100 ? capShare(S.aca.applicable_pct, pctFpl) : null;
          out.pctFpl = Math.round(pctFpl);
          if (pctFpl < 100) { out.fplIncomeMonthly = Math.ceil(fpl / 12); healthNote = 'Below the poverty line (' + Math.round(pctFpl) + '% of it at your income) the marketplace credit does not apply, and in states that did not expand Medicaid a man there gets no help. Income of $' + fmt(out.fplIncomeMonthly) + ' a month opens the credit, which caps the plan at ' + S.aca.applicable_pct[0][2].toFixed(1) + '% of income.'; }
          if (cap != null) {
            var capped = Math.round(num(p.inc) * cap / 100);
            if (capped < health) { health = capped; healthNote = 'Marketplace plan capped at ' + cap.toFixed(1) + '% of income at your income (' + Math.round(pctFpl) + '% of the poverty line). Check it at the subsidy calculator.'; }
            out.pctFpl = Math.round(pctFpl);
          }
        }
      }
    }
    out.health = Math.round(health); out.healthNote = healthNote;
    out.parts.push({ key: 'health', label: 'Health insurance', monthly: out.health, source: healthSrc, note: healthNote });

    out.debt = Math.round(num(p.debtm));
    out.parts.push({ key: 'debt', label: 'Debt payments', monthly: out.debt, source: 'you' });

    out.outgo = out.household + out.rent + out.health + out.debt;
    out.income = Math.round(num(p.inc));
    out.gap = out.income - out.outgo;
    var runwayMonths = (S.runway && S.runway.months) || 3;
    out.runwayMonths = runwayMonths;
    out.runwayTarget = Math.round(runwayMonths * out.outgo);
    out.runwaySource = (S.runway && S.runway.source) || '';
    return out;
  }
  /* the share of income a household pays for the benchmark plan, from the sliding scale table [[pctFplFrom, pctFplTo, shareFrom, shareTo], ...] */
  function capShare(table, pctFpl) {
    for (var i = 0; i < table.length; i++) {
      var row = table[i];
      if (pctFpl >= row[0] && pctFpl < row[1]) {
        var t = (pctFpl - row[0]) / (row[1] - row[0]);
        return row[2] + (row[3] - row[2]) * t;
      }
    }
    return null;
  }

  /* ---------- where he stands ---------- */
  function place(p, n) {
    var done = {
      s1: n.income >= n.outgo && n.cash >= n.runwayTarget,
      s2: p.exp === 'two' || p.exp === 'own',
      s3: p.exp === 'own',
      s4: false,
      s5: p.place === 'own',
      s6: false
    };
    var current = 's6';
    for (var i = 0; i < STAGES.length; i++) { if (!done[STAGES[i].key]) { current = STAGES[i].key; break; } }
    return { done: done, current: current, index: STAGES.map(function (s) { return s.key; }).indexOf(current) };
  }

  /* ---------- the whole path ---------- */
  function path(p, data, calc) {
    var C = data.costs.items, S = data.stage || {};
    var n = needs(p, data);
    n.cash = Math.round(num(p.cash));
    var where = place(p, n);
    var st = p.state, land = (data.land.states && data.land.states[st]) || {};
    var leaseRate = land.pasture_rent || C.lease_rate_us.typ;
    var surplus = Math.max(0, n.gap);
    var out = { needs: n, where: where, stages: [], leaseRate: leaseRate, months: 0 };

    /* stage 1: get steady */
    var s1 = { key: 's1', figs: [], month: [], sources: [] };
    s1.gapMonthly = n.gap;
    s1.runwayShort = Math.max(0, n.runwayTarget - n.cash);
    s1.monthsToRunway = surplus > 0 ? Math.ceil(s1.runwayShort / surplus) : null;
    if (S.wages && S.wages.ranch_hand) {
      var w = S.wages.ranch_hand;
      var hourly = (w.states && w.states[st] && w.states[st].median_hourly) || w.median_hourly;
      s1.ranchHourly = hourly; s1.ranchMonthly = Math.round(hourly * 2080 / 12); s1.wageSource = w.source;
      s1.wageState = !!(w.states && w.states[st] && w.states[st].median_hourly);
    }
    s1.debt = Math.round(num(p.debt));
    if (s1.debt > 0) {
      var pay = n.debt + surplus;
      s1.debtMonths = pay > 0 ? Math.ceil(s1.debt / pay) : null;
    }
    s1.months = where.done.s1 ? 0 : (s1.monthsToRunway == null ? null : s1.monthsToRunway);
    out.stages.push(s1);

    /* stage 2: prove yourself */
    var s2 = { key: 's2' };
    s2.monthsNeeded = p.exp === 'none' ? 24 : p.exp === 'some' ? 12 : 0;
    s2.months = where.done.s2 ? 0 : s2.monthsNeeded;
    s2.savedDuring = Math.round(surplus * s2.monthsNeeded);
    s2.fsaExperience = S.fsa && S.fsa.experience;
    out.stages.push(s2);

    /* stage 3: first cattle without capital */
    var s3 = { key: 's3' };
    var inp = calcInput(p, n, data);
    /* a part-time beginner takes the high end of the hours-per-cow range */
    s3.hoursPerCow = C.labor_hours_cow.high;
    s3.headByHours = Math.floor(num(p.hours) * 52 / s3.hoursPerCow);
    s3.deals = {};
    ['custom', 'share'].forEach(function (d) {
      var x = calc.dealPerHead(d, inp, data);
      s3.deals[d] = { net: Math.round(x.net), capital: Math.round(x.capital), acres: x.acres, hours: x.hours, name: x.name, yearly: Math.round(x.net * s3.headByHours), acresNeeded: Math.round(x.acres * s3.headByHours) };
    });
    s3.handling = C.handling_setup.typ;
    s3.handlingShort = Math.max(0, s3.handling - Math.max(0, n.cash - n.runwayTarget));
    s3.monthsToHandling = s3.handlingShort === 0 ? 0 : surplus > 0 ? Math.ceil(s3.handlingShort / surplus) : null;
    var plan = calc.plan(inp, data, calc.compute(inp, data));
    s3.fsa = plan.fsa;
    s3.cowsPerMicro = Math.floor(plan.fsa.microMax / plan.perHead.own.capital);
    s3.ownNet = Math.round(plan.perHead.own.net);
    s3.months = where.done.s3 ? 0 : (s3.monthsToHandling == null ? null : Math.max(1, s3.monthsToHandling));
    out.stages.push(s3);

    /* stage 4: grow */
    var s4 = { key: 's4' };
    var rp = plan.paths.rent;
    s4.needsYear = rp.needs;
    s4.keepYear = plan.work;
    s4.gapYear = rp.gapBefore;
    s4.own = rp.solve.own; s4.share = rp.solve.share; s4.custom = rp.solve.custom;
    s4.growth = plan.growth;
    s4.startHalf = s4.own && s4.own.head ? s4.own.startHalf : null;
    s4.rampYears = s4.own && s4.own.head ? s4.own.rampYears : null;
    s4.months = where.done.s4 ? 0 : (s4.rampYears ? s4.rampYears * 12 : (s4.gapYear <= 0 ? 0 : null));
    out.stages.push(s4);

    /* stage 5: land, with the FSA down payment program */
    var s5 = { key: 's5' };
    var placeInp = Object.assign({}, inp, { house: 'existing', existing_house_price: 0 });
    var r5 = calc.compute(placeInp, data);
    var landLine = r5.setup.filter(function (l) { return l.key === 'land'; })[0];
    s5.acres = inp.acres; s5.pricePerAcre = inp.price_per_acre;
    s5.landCost = landLine ? landLine.typ : 0;
    s5.setupTotal = r5.setupTotal.typ;
    var downPct = (S.fsa && S.fsa.down_payment_pct) || 5;
    s5.downPct = downPct;
    s5.down = Math.round(s5.setupTotal * downPct / 100);
    s5.fsaOwnershipRate = C.fsa_operating_rate.typ;  /* replaced by the ownership rate when stage data has it */
    if (S.fsa && S.fsa.ownership_rate) s5.fsaOwnershipRate = S.fsa.ownership_rate;
    if (S.fsa && S.fsa.down_payment_rate != null) s5.downRate = S.fsa.down_payment_rate;
    s5.cashShort = Math.max(0, s5.down - Math.max(0, n.cash - n.runwayTarget));
    s5.monthsToDown = s5.cashShort === 0 ? 0 : surplus > 0 ? Math.ceil(s5.cashShort / surplus) : null;
    s5.months = where.done.s5 ? 0 : (s5.monthsToDown == null ? null : s5.monthsToDown);
    s5.experienceYears = (S.fsa && S.fsa.ownership_experience_years) || 3;
    out.stages.push(s5);

    /* stage 6: live off it */
    var s6 = { key: 's6' };
    var r6 = calc.compute(inp, data);
    var p6 = calc.plan(inp, data, r6);
    s6.setup = r6.setupTotal.typ; s6.yearly = r6.netAnnual.typ; s6.solve = p6.paths.own.solve.own; s6.gapYear = p6.paths.own.gapBefore;
    s6.months = 0;
    out.stages.push(s6);

    /* timeline from where he stands */
    var total = 0, unknown = false;
    for (var i = where.index; i < STAGES.length; i++) {
      var m = out.stages[i].months;
      if (m == null) unknown = true; else total += m;
    }
    out.months = total; out.monthsUnknown = unknown;
    out.calcInput = inp;
    return out;
  }

  /* the calculator inputs that follow from his profile */
  function calcInput(p, n, data) {
    var C = data.costs.items, S = data.stage || {};
    var st = p.state, land = (data.land.states && data.land.states[st]) || {};
    var row = countyRow(data, st, p.county);
    var price = row && row[2] ? Math.round(row[2] / 50) * 50 : land.farm_real_estate ? Math.round(land.farm_real_estate / 50) * 50 : 5000;
    var tax = row && row[4] != null ? row[4] : (data.tax.states[st] != null ? data.tax.states[st] : 1.0);
    var wd = data.costs.well_depth_by_state[st];
    return {
      state: st, county: row ? row[1] : '', acres: 40, price_per_acre: price, tax_rate: tax, ag_exempt: true,
      house: 'mobile_used', house_sqft: 1400, existing_house_price: 0,
      well: 'well', well_depth: wd ? wd.typ : data.costs.well_depth_default.typ, septic: 'conventional', power: 'grid', power_distance: 300,
      fence_type: 'barbed', fence_shape: '1', pastures: 2, fence_existing_pct: 0, barn_sqft: 0,
      tractor: false, trailer: true, truck: true, utv: false,
      cows: 0, bull: false, horses: 0, goats: 0, hens: 12, garden: true, trees: 0,
      town_monthly: n.outgo, household_monthly: n.household, health_monthly: n.health, runway_months: n.runwayMonths,
      cow_deal: 'own', lease_acres: 0, lease_rate: land.pasture_rent || C.lease_rate_us.typ, graze_apc: C.lease_apc.typ, sell_how: 'barn',
      work_income: Math.round(num(p.inc) * 12), rent_monthly: n.rent
    };
  }

  root.GWpath = { STAGES: STAGES, needs: needs, place: place, path: path, calcInput: calcInput, fmt: fmt };
})(typeof window !== 'undefined' ? window : globalThis);
