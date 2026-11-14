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
  function needs(p, data, calc) {
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
    var live = p.live && p.live !== 'same' ? p.live : (p.place === 'motorhome' ? 'rvpark' : (p.place === 'house' || p.place === 'own') ? 'house' : 'rent');
    out.live = live;
    var rent = 0, rentSrc = '';
    if (num(p.rent) > 0) { rent = num(p.rent); rentSrc = 'you'; }
    else if (live === 'rvpark') { rent = C.rv_lot_monthly.typ; rentSrc = C.rv_lot_monthly.source; }
    else if (live === 'rent') {
      var r = countyRent(data, p.state, p.county);
      if (r) { rent = family <= 2 ? r.fmr2 : r.fmr3; rentSrc = data.rent.source && data.rent.source.name; }
      else { rent = family <= 2 ? C.rent_monthly.low : C.rent_monthly.typ; rentSrc = C.rent_monthly.source; }
    }
    out.rent = Math.round(rent); out.rentFound = live === 'rent' && !!countyRent(data, p.state, p.county); out.rentOwn = num(p.rent) > 0;
    var rentLabel = { lease: 'Rent (your own housing on the leased grass)', rvpark: 'RV lot rent', rent: 'Rent', family: 'Rent (with family)', house: 'Rent (a house you own)', land: 'Rent (land you own)' }[live] || 'Rent';
    out.parts.push({ key: 'rent', label: out.rentOwn ? 'Rent or lot rent' : rentLabel, monthly: out.rent, source: rentSrc, note: out.rentOwn ? 'Your figure.' : (live === 'rvpark' ? 'No public table for RV lots; put in your own figure on Where you are.' : '') });

    /* cows he already owns on grass he already has: their calf money is money coming in, at typical prices */
    out.cattle = 0; out.cattleNote = '';
    var cowsNow = num(p.cows_n), grassAcres = num(p.grass_acres);
    if (cowsNow > 0 && (grassAcres > 0 || p.place === 'own')) {
      var land0 = (data.land.states && data.land.states[p.state]) || {};
      var rate0 = grassAcres > 0 ? (num(p.grass_rate) > 0 ? num(p.grass_rate) : (land0.pasture_rent || C.lease_rate_us.typ)) : 0;
      var netCow = C.calf_sale.typ - C.cow_annual.typ - C.lease_apc.typ * rate0;
      var upkeep0 = grassAcres > 0 && calc ? calc.fenceFeet(grassAcres, 1, 1).perimeter * C.fence_barbed_per_ft.typ * C.fence_upkeep_pct.typ : 0;
      out.cattle = Math.max(0, Math.round((cowsNow * netCow - upkeep0) / 12));
      out.cattleNote = (cowsNow === 1 ? 'one cow' : cowsNow + ' cows') + ' at the typical calf price, after the keep' + (rate0 > 0 ? ' and the grass' : '') + (upkeep0 > 0 ? ' and the fence' : '') + '.';
    }
    out.incomeWork = Math.round(num(p.inc));
    out.income = out.incomeWork + out.cattle;
    /* health insurance: through work is counted in his pay; otherwise the marketplace, capped by the subsidy rule when we have it */
    var health = 0, healthNote = '', healthSrc = C.health_family_monthly.source;
    if (p.health === 'work') { health = 0; healthNote = 'Through your job today. If you leave it, this line comes back.'; }
    else if (p.health === 'other') { health = 0; healthNote = 'Medicare, VA, Medicaid or other. Nothing to add here.'; }
    else {
      var bench = S.aca && S.aca.benchmark_single && (S.aca.benchmark_single[p.state] || S.aca.benchmark_single.US);
      var full = family === 1 ? (bench || C.health_family_monthly.low) : C.health_family_monthly.typ;
      health = full;
      healthNote = family === 1 ? 'One man on the marketplace, full price, before any subsidy.' : 'A family on the marketplace, full price, before any subsidy.';
      if (S.aca && S.aca.fpl && S.aca.applicable_pct) {
        var fpl = S.aca.fpl[String(Math.min(family, 8))];
        var incAll = out.income;
        if (fpl) {
          var pctFpl = (incAll * 12) / fpl * 100;
          var below = incAll > 0 ? 'Below the poverty line (' + Math.round(pctFpl) + '% of it at your income)' : 'With nothing coming in you are below the poverty line';
          var cap = pctFpl >= 100 ? capShare(S.aca.applicable_pct, pctFpl) : null;
          out.pctFpl = Math.round(pctFpl);
          if (pctFpl < 100) {
            out.fplIncomeMonthly = Math.ceil(fpl / 12);
            var expanded = S.medicaid ? S.medicaid.not_expanded.indexOf(p.state) < 0 : null;
            if (expanded === true) { health = 0; healthNote = below + '. Your state expanded Medicaid, so you qualify for it up to ' + S.medicaid.limit_pct + '% of the line. Apply.'; }
            else healthNote = below + (incAll > 0 ? ' the marketplace credit does not apply' : ', where the marketplace credit does not apply') + (expanded === false ? ', and your state did not expand Medicaid, so there is no help at this income' : '') + '. Income of $' + fmt(out.fplIncomeMonthly) + ' a month opens the credit, which caps the plan at ' + S.aca.applicable_pct[0][2].toFixed(1) + '% of income.';
          }
          if (cap != null && S.medicaid && S.medicaid.not_expanded.indexOf(p.state) < 0 && pctFpl <= S.medicaid.limit_pct) { health = 0; healthNote = 'At ' + Math.round(pctFpl) + '% of the poverty line in a state that expanded Medicaid, you qualify for Medicaid (up to ' + S.medicaid.limit_pct + '%). Apply.'; cap = null; }
          if (cap != null) {
            var capped = Math.round(incAll * cap / 100);
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

    /* a spending figure as big as the income is almost always rent, insurance or debt counted twice */
    out.spendWarning = own && num(p.inc) > 0 && num(p.spend) >= num(p.inc) * 0.6 ? 'Your spending figure, $' + fmt(num(p.spend)) + ' a month, is most of what comes in. It should not include rent, health insurance or debt payments; those are counted on their own lines. Check it on Where you are.' : '';
    out.outgo = out.household + out.rent + out.health + out.debt;
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


  /* ---------- paying off what he owes: smallest balance first, every freed payment rolls to the next ----------
     debts: [{name, bal, pay, rate}] with rate in percent a year (0 if unknown); extra: dollars a month above the minimums.
     Returns the payoff month for each debt, the month everything is clear, and the interest paid along the way. */
  function debtPlan(debts, extra) {
    var list = (debts || []).map(function (d, i) { return { i: i, name: d.name || ('Debt ' + (i + 1)), bal: Math.max(0, num(d.bal)), pay: Math.max(0, num(d.pay)), rate: Math.max(0, num(d.rate)), paidMonth: null, interest: 0 }; })
      .filter(function (d) { return d.bal > 0; });
    list.sort(function (a, b) { return a.bal - b.bal; });
    extra = Math.max(0, num(extra));
    var month = 0, interest = 0, budget = list.reduce(function (t, d) { return t + d.pay; }, 0) + extra;
    var stuck = list.some(function (d) { return d.pay + extra <= d.bal * d.rate / 1200; });
    if (list.length && budget <= 0) stuck = true;
    while (!stuck && month < 600 && list.some(function (d) { return d.bal > 0; })) {
      month++;
      var pool = budget;
      /* interest first, then minimums, then everything left to the smallest open balance */
      list.forEach(function (d) { if (d.bal > 0) { var i = d.bal * d.rate / 1200; d.bal += i; d.interest += i; interest += i; } });
      list.forEach(function (d) { if (d.bal > 0) { var m = Math.min(d.pay, d.bal); d.bal -= m; pool -= m; } });
      for (var k = 0; k < list.length && pool > 0; k++) {
        var d2 = list[k];
        if (d2.bal > 0) { var m2 = Math.min(pool, d2.bal); d2.bal -= m2; pool -= m2; }
      }
      list.forEach(function (d) { if (d.bal <= 0.005 && d.paidMonth == null) { d.bal = 0; d.paidMonth = month; } });
    }
    var done = list.every(function (d) { return d.paidMonth != null; });
    var order = list.map(function (d) { return { name: d.name, paidMonth: d.paidMonth, interest: Math.round(d.interest) }; });
    order.sort(function (a, b) { return (a.paidMonth == null ? 1e9 : a.paidMonth) - (b.paidMonth == null ? 1e9 : b.paidMonth); });
    return { order: order,
      months: list.length && done ? month : null, interest: Math.round(interest), monthly: Math.round(budget), stuck: list.length ? (stuck || !done) : false };
  }

  /* ---------- where he stands ---------- */
  function place(p, n) {
    var done = {
      s1: n.income >= n.outgo && n.cash >= n.runwayTarget,
      s2: p.exp === 'two' || p.exp === 'own',
      s3: p.exp === 'own' || num(p.cows_n) > 0,
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
    var n = needs(p, data, calc);
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
    var debts = typeof p.debts === 'object' ? p.debts : null;
    if (debts && debts.length) {
      var dp = debtPlan(debts, surplus);
      s1.debt = Math.round(debts.reduce(function (t, d) { return t + num(d.bal); }, 0));
      s1.debtMonths = dp.months; s1.debtPlan = dp;
    } else if (s1.debt > 0) {
      var pay = n.debt + surplus;
      s1.debtMonths = pay > 0 ? Math.ceil(s1.debt / pay) : null;
    }
    /* what stage 1 is about for this man: no money coming in, payments eating it, spending above it, or a cushion still to build */
    var earner = p.from === 'job' || p.from === 'own';   /* already working: a hand job is a sideways move unless it pays more */
    var canWork = !(p.from === 'pension' && num(p.hours) < 20);   /* retired or disabled with few hours: not sent to a full-time job */
    s1.jobFits = n.income === 0 || (canWork && (s1.ranchMonthly ? n.income < s1.ranchMonthly * (earner ? 0.9 : 1.5) : n.income < (earner ? 2500 : 4000)));
    s1.debtHeavy = n.income > 0 && n.debt >= n.income * 0.3;
    s1.spendHeavy = n.householdAverage > 0 && n.household > n.householdAverage * 1.25;
    s1.cashYears = n.gap < 0 && n.cash > 0 ? Math.round(n.cash / (-n.gap) / 12 * 10) / 10 : null;
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
    s3.grassAcres = num(p.grass_acres);
    s3.headByGrass = s3.grassAcres > 0 ? Math.floor(s3.grassAcres / C.lease_apc.typ) : null;
    s3.head = s3.headByGrass != null ? Math.min(s3.headByHours, s3.headByGrass) : s3.headByHours;
    s3.hasPanels = !!p.has_panels;
    /* his own housing on the lease needs a pad: water, power, a tank */
    s3.pad = n.live === 'lease' ? Math.round(C.well_per_ft.typ * num(inp.well_depth) + C.well_pump_package.typ + C.electric_line_per_ft.typ * 300 + C.electric_service.typ + C.holding_tank.typ) : 0;
    s3.deals = {};
    ['custom', 'share'].forEach(function (d) {
      var x = calc.dealPerHead(d, inp, data);
      s3.deals[d] = { net: Math.round(x.net), capital: Math.round(x.capital), acres: x.acres, hours: x.hours, name: x.name, yearly: Math.round(x.net * s3.headByHours), acresNeeded: Math.round(x.acres * s3.headByHours) };
    });
    s3.shareWorks = s3.deals.share.net > 0;
    s3.handling = p.has_panels ? 0 : C.handling_setup.typ;
    s3.setupNeeded = s3.handling + s3.pad;
    s3.handlingShort = Math.max(0, s3.setupNeeded - Math.max(0, n.cash - n.runwayTarget));
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
    s4.cowsNow = num(p.cows_n);
    /* the start of the herd: the cows he has, plus what a microloan buys */
    s4.start = s4.own && s4.own.head ? Math.min(s4.own.head, s4.cowsNow + s3.cowsPerMicro) : null;
    s4.startHalf = s4.start;
    s4.startIsHis = s4.start != null && s4.cowsNow >= s4.start;
    s4.startText = s4.start == null ? '' : s4.startIsHis ? cows(s4.start) + ' you have' : s4.cowsNow > 0 ? cows(s4.start) + ' (the ' + s4.cowsNow + ' you have and the rest on a microloan)' : cows(s4.start) + ' a microloan buys';
    s4.rampYears = s4.start != null ? (s4.start >= s4.own.head ? 0 : Math.round(calc.rampYears(s4.start, s4.own.head, data))) : null;
    s4.hoursWeek = s4.own && s4.own.head ? s4.own.hoursWeek : 0;
    s4.hoursShort = s4.hoursWeek > num(p.hours);
    s4.nearly = s4.gapYear > 0 && !!(s4.own && s4.own.head && s4.own.head <= 2);   /* a cow or two, or a leaner month */
    s4.covered = s4.gapYear <= 0 || s4.nearly || !!(s4.own && s4.own.head && s4.cowsNow >= s4.own.head);
    /* grown means covered while running cattle; a job that covers the family is not a herd */
    if (s4.covered && where.done.s3) {
      where.done.s4 = true;
      where.current = 's6';
      for (var k = 0; k < STAGES.length; k++) { if (!where.done[STAGES[k].key]) { where.current = STAGES[k].key; break; } }
      where.index = STAGES.map(function (s) { return s.key; }).indexOf(where.current);
    }
    s4.months = where.done.s4 || s4.covered ? 0 : (s4.rampYears ? s4.rampYears * 12 : (s4.own && s4.own.head ? 12 : null));
    out.stages.push(s4);

    /* stage 5: land, with the FSA down payment program */
    var s5 = { key: 's5' };
    /* a modest place: a used mobile home unless his motorhome is the house */
    var ownHousing = p.place === 'motorhome' || !!p.has_rv || !!p.has_mobile;
    var placeInp = Object.assign({}, inp, { house: ownHousing ? 'existing' : 'mobile_used', existing_house_price: 0 });
    var r5 = calc.compute(placeInp, data);
    if (p.has_mobile && !p.has_rv && p.place !== 'motorhome') r5.setupTotal.typ += C.mobile_setup.typ;   /* moving the mobile home he owns */
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
    s5.floorMonths = 12;   /* the FSA paperwork starts a year ahead, and the place has to be found */
    s5.months = where.done.s5 ? 0 : (s5.monthsToDown == null ? null : Math.max(s5.floorMonths, s5.monthsToDown));
    s5.experienceYears = (S.fsa && S.fsa.ownership_experience_years) || 3;
    s5.motorhome = ownHousing;
    s5.movingMobile = !!p.has_mobile && !p.has_rv && p.place !== 'motorhome';
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


  /* ---------- what he can get to: the rungs, from where he stands ----------
     Positive by construction: each rung is something reachable, with what it clears, what it takes,
     and when his cash and hours get him there. The shortfall never leads. */
  function rungs(p, data, calc) {
    var C = data.costs.items, S = data.stage || {};
    var r = path(p, data, calc);
    var n = r.needs, st = p.state;
    var names = data.land.state_names || {};
    var surplus = Math.max(0, n.gap);
    var s1 = r.stages[0], s3 = r.stages[2], s4 = r.stages[3], s5 = r.stages[4];
    var out = { rungs: [], needs: n, where: r.where, path: r };
    function when(months, note) { return { months: months, note: note }; }
    function monthsToSave(amount) { if (amount <= 0) return 0; return surplus > 0 ? Math.ceil(amount / surplus) : null; }

    /* rung 0: the job that pays and teaches */
    if (s1.ranchMonthly && s1.jobFits) {
      out.rungs.push({ key: 'job', title: 'A job that pays and teaches', figure: s1.ranchMonthly, unit: 'a month', what: 'Ranch hand, about $' + s1.ranchHourly.toFixed(2) + ' an hour' + (s1.wageState ? ' in ' + names[st] : '') + ', full time. Housing often comes with it.',
        takes: 'Showing up. No money down.', leads: 'This is stage 1 and stage 2 at once: it covers the bills and it is the two years every lease and loan asks about.', reach: when(0, 'now'), source: s1.wageSource });
    }

    /* rung 1: caring for other men's pairs */
    var dc = s3.deals.custom, ds = s3.deals.share;
    var head = s3.head;
    var grassNote = s3.grassAcres > 0 ? ' on the ' + fmt(s3.grassAcres) + ' acres you already lease' : '';
    var padNote = s3.pad > 0 ? ' Your housing on the lease needs a pad, water, power and a tank, about $' + fmt(s3.pad) + ' on the page\'s own well, power and tank figures; they stay with the owner\'s land, so the lease has to say so.' : '';
    var setupTakes = (s3.handling > 0 ? 'Panels, a chute and a tank, about $' + fmt(s3.handling) : 'You have the panels and chute') + (s3.pad > 0 ? ', plus the pad' : '') + (s3.handlingShort > 0 ? ' (you are $' + fmt(s3.handlingShort) + ' short of it above the cushion)' : s3.setupNeeded > 0 ? ' (you have it)' : '');
    var upkeep = head > 0 ? calc.fenceFeet(head * dc.acres, 1, 1).perimeter * C.fence_barbed_per_ft.typ * C.fence_upkeep_pct.typ : 0;
    var handlingMonths = monthsToSave(s3.handlingShort);
    var afterProving = r.where.done.s2 ? 0 : (r.stages[1].months || 0);
    if (head > 0) {
      out.rungs.push({ key: 'custom', title: 'Caring for other men\'s pairs', figure: Math.max(0, Math.round(head * dc.net - upkeep)), unit: 'a year', head: head, acres: Math.round(head * dc.acres),
        what: head + ' pairs' + (grassNote || ' on about ' + fmt(head * dc.acres) + ' leased acres') + ', ' + p.hours + ' hours a week, paid about $' + C.custom_care_day.typ.toFixed(2) + ' a head a day for the season. The owner pays the grass, mineral and vet.' + padNote,
        takes: setupTakes + ', the lease on paper, and a man who trusts you with his cattle.',
        leads: 'Nothing to buy, no price risk. It is the cheapest way to be running cattle, and the owner you care for is the man who leases you cows on shares next.' + (p.place === 'motorhome' ? ' Ask whether your motorhome can sit on the lease: a man living on the grass is worth more to the owner, and the lot rent goes away.' : ''),
        reach: when(handlingMonths == null ? null : Math.max(afterProving, handlingMonths), afterProving > 0 ? 'after stage 2' : 'when the setup money is there'), source: C.custom_care_day.source });
      /* rung 2: cows on shares, where the grass is cheap enough for them to clear anything */
      if (s3.shareWorks) out.rungs.push({ key: 'share', title: 'Cows on shares', figure: Math.max(0, Math.round(head * ds.net - upkeep)), unit: 'a year', head: head, acres: Math.round(head * ds.acres),
        what: head + ' cows a rancher keeps owning, on your leased grass' + grassNote + '. You supply grass, hay, labor and management and keep about ' + Math.round(C.cow_share_operator.typ * 100) + '% of the calf money.',
        takes: (s3.handling > 0 ? 'The same panels and chute, ' : 'Your panels and chute, ') + 'the lease, and the rancher who is slowing down.',
        leads: 'Calves you can keep as heifers, and the cows themselves when he is ready to sell.',
        reach: when(handlingMonths == null ? null : Math.max(afterProving, handlingMonths), afterProving > 0 ? 'after stage 2' : 'when the setup money is there'), source: C.cow_share_operator.source });
    }

    /* rung: the cows he already owns */
    var cowsNow = num(p.cows_n);
    var planNow = calc.plan(r.calcInput, data, calc.compute(r.calcInput, data));
    if (cowsNow > 0) {
      var ownNet = planNow.perHead.own.net;
      var upNow = s3.grassAcres > 0 ? calc.fenceFeet(s3.grassAcres, 1, 1).perimeter * C.fence_barbed_per_ft.typ * C.fence_upkeep_pct.typ : 0;
      out.rungs.push({ key: 'have', title: 'The cows you have', figure: Math.max(0, Math.round(cowsNow * ownNet - upNow)), unit: 'a year', head: cowsNow, acres: Math.round(cowsNow * planNow.perHead.own.acres), headline: cowsNow + ' cows',
        what: cowsNow + ' cows of your own' + (s3.grassAcres > 0 ? grassNote : ', needing about ' + fmt(cowsNow * planNow.perHead.own.acres) + ' acres of grass') + ', clearing about $' + fmt(Math.max(0, Math.round(ownNet))) + ' a head a year at typical prices after the keep and the lease.',
        takes: (s3.grassAcres > 0 ? 'Nothing you do not have.' : 'Grass to put them on.') + (s3.handlingShort > 0 ? ' The panels and chute, about $' + fmt(s3.handling) + ': one cow sold buys them.' : ''),
        leads: 'Keep the heifers and they grow about ' + Math.round(planNow.growth * 100) + '% a year on their own.',
        reach: when(s3.grassAcres > 0 ? 0 : (handlingMonths == null ? null : Math.max(afterProving, handlingMonths)), s3.grassAcres > 0 ? 'now' : 'when the grass is found'), source: C.calf_sale.source });
    }

    /* rung 3: his first cows, on a microloan, growing */
    var inp = r.calcInput;
    var plan = calc.plan(inp, data, calc.compute(inp, data));
    var cowsMicro = Math.floor(plan.fsa.microMax / plan.perHead.own.capital);
    if (cowsMicro > 0 && plan.perHead.own.net > 0) {
      var g = plan.growth;
      var five = Math.round(cowsMicro * Math.pow(1 + g, 3));   /* two years before the first kept heifer calves, then three years of growth */
      var clears = Math.round(cowsMicro * plan.perHead.own.net - plan.fsa.microPayment);
      out.rungs.push({ key: 'own', title: 'Your first cows', figure: Math.max(0, clears), unit: 'a year, after the loan payment', head: cowsMicro, acres: Math.round(cowsMicro * plan.perHead.own.acres),
        what: cowsMicro + ' bred cows on an FSA microloan (' + money(plan.fsa.microMax) + ' at ' + plan.fsa.ratePct + '%, about ' + money(plan.fsa.microPayment) + ' a year for ' + plan.fsa.years + ' years), on ' + fmt(cowsMicro * plan.perHead.own.acres) + ' leased acres.' + (clears < 0 ? ' At today\'s lease and calf figures the loan payment eats the calf check; the gain is the herd itself.' : ''),
        takes: 'Stage 2 behind you, a lease, and the FSA paperwork. A beginning farmer is anyone under ten years in.',
        leads: 'Keep the heifers and ' + cowsMicro + ' cows are about ' + five + ' in five years, with the loan paid off two years after that.',
        reach: when(handlingMonths == null ? null : afterProving + handlingMonths, afterProving > 0 ? 'after stage 2' : 'when the setup money is there'), source: C.fsa_microloan_max.source, five: five });
    }

    /* rung 4: a herd that carries the family */
    if (s4.own && s4.own.head && !s4.nearly) {
      var ownRung = out.rungs.filter(function (x) { return x.key === 'own'; })[0];
      var herdFrom = s4.cowsNow >= s4.own.head ? 0 : s4.startIsHis ? (s3.grassAcres > 0 ? 0 : (handlingMonths == null ? null : Math.max(afterProving, handlingMonths))) : (ownRung ? ownRung.reach.months : null);
      var hoursNote = s4.hoursShort ? ' That is more than the ' + p.hours + ' hours you have: the herd grows into the job, or the job shrinks to fit it.' : '';
      out.rungs.push({ key: 'herd', title: 'A herd that carries the family', figure: s4.own.head, unit: 'cows', head: s4.own.head, acres: s4.own.acres, headline: cows(s4.own.head),
        what: cows(s4.own.head) + ' on about ' + fmt(s4.own.acres) + ' leased acres clear what the family needs renting a house' + (plan.work > 0 ? ', with what you keep from work' : '') + '. About ' + s4.own.hoursWeek + ' hours a week.' + hoursNote,
        takes: s4.cowsNow >= s4.own.head ? 'You have the cows. Grass for them and the hours.' : s4.rampYears > 0 ? 'Years, not money: start with the ' + s4.startText + ' and keep the heifers, about ' + s4.rampYears + ' years. Or buy in faster with calf checks and an FSA operating loan.' : 'The ' + s4.startText + ' are the herd. Grass for them and the hours.',
        leads: 'The point where the job becomes optional.',
        reach: when(herdFrom == null ? null : herdFrom + (s4.rampYears || 0) * 12, s4.rampYears ? 'years out' : 'now'), source: C.calf_sale.source });
    } else if (s4.gapYear <= 0 || s4.nearly) {
      out.rungs.push({ key: 'herd', title: 'The family is covered', figure: 0, unit: '', what: s4.nearly ? 'What you keep from work covers rent, household and health insurance all but ' + money(rh(s4.gapYear)) + ' a year. A cow or two, or a leaner month, closes that. Every cow past it is money in the bank or a smaller job.' : 'What you keep from work already covers rent, household and health insurance. Every cow from here is money in the bank or a smaller job.', takes: '', leads: '', reach: when(0, 'now'), source: '' });
    }

    /* rung 5: the place */
    var loan = s5.setupTotal - s5.down;
    var rate = (s5.fsaOwnershipRate || 6.25) / 100 / 12, nper = 40 * 12;
    var payment = loan > 0 ? Math.round(loan * rate / (1 - Math.pow(1 + rate, -nper)) * 12) : 0;
    var downMonths = s5.monthsToDown;
    if (r.where.done.s5) {
      var finish = Math.max(0, s5.setupTotal - s5.landCost);
      out.rungs.push({ key: 'place', title: 'The place you have', figure: finish, unit: 'to finish it, at most', what: 'You own the land. What is left is whatever of the well, septic, power and fence is not there yet; the figure is all of it new, so yours is less.',
        takes: 'Line by line under The whole place: take out what you already have.', leads: 'Stage 6. The place, the cattle and what you keep cover the family.', reach: when(0, 'now'), source: C.fsa_operating_max.source, payment: 0, setup: s5.setupTotal });
    } else out.rungs.push({ key: 'place', title: 'A place of your own', figure: s5.down, unit: 'down, ' + s5.downPct + '%', what: (s5.motorhome ? 'Your motorhome is the house. ' + s5.acres + ' acres in ' + (inp.county || names[st]) + ' at $' + fmt(s5.pricePerAcre) + ' with a well, septic, power and fence, about ' + money(rh(s5.setupTotal)) + ' all in, and you park on it.' : 'A modest place in ' + (inp.county || names[st]) + ': ' + s5.acres + ' acres at $' + fmt(s5.pricePerAcre) + ' with the house, well, septic and fence, about ' + money(rh(s5.setupTotal)) + ' all in.') + ' The FSA ownership programs lend the rest over 40 years at ' + (s5.fsaOwnershipRate || 6.25) + '%, about ' + money(rh(payment)) + ' a year.',
      takes: s5.experienceYears + ' years of experience, the down payment' + (s5.cashShort > 0 ? ' (you are about ' + money(rh(s5.cashShort)) + ' short of it)' : ' (you have it)') + ', and the place found. ' + (s5.movingMobile ? 'Moving the mobile home you own runs about $' + fmt(C.mobile_setup.typ) + ' for delivery, pad, tie-downs and hookups, and that is in the figure. ' : '') + (s5.motorhome ? 'Land with a well and power already on it saves the most; ask the lease owner first whether you can park on the grass and skip buying for now.' : 'Buy one with the house, well and septic already there.'),
      leads: 'Stage 6. The place, the cattle and what you keep cover the family.',
      reach: when(r.monthsUnknown || downMonths == null ? null : r.months, 'when the down payment is there'), source: C.fsa_operating_max.source, payment: payment, setup: s5.setupTotal });

    /* soonest first; ties keep their order; the place stays last */
    var place = out.rungs.pop();
    out.rungs = out.rungs.map(function (x, i) { return [x, i]; }).sort(function (a, b) { var ma = a[0].reach.months == null ? 1e9 : a[0].reach.months, mb = b[0].reach.months == null ? 1e9 : b[0].reach.months; return ma - mb || a[1] - b[1]; }).map(function (x) { return x[0]; });
    out.rungs.push(place);
    /* the three headline figures */
    var first = out.rungs.filter(function (x) { return x.reach.months === 0 && x.figure > 0 && x.key !== 'job' && x.key !== 'place'; })[0] || out.rungs.filter(function (x) { return x.reach.months === 0 && x.figure > 0 && x.key !== 'place'; })[0] || out.rungs[0];
    var mid = out.rungs.filter(function (x) { return x.key === 'own'; })[0] || out.rungs.filter(function (x) { return x.key === 'share' || x.key === 'custom'; })[0];
    out.heroes = { now: first, next: mid, place: out.rungs[out.rungs.length - 1] };
    return out;
  }
  function money(n) { return (n < 0 ? '-$' : '$') + fmt(Math.abs(n)); }
  function cows(n) { return n === 1 ? '1 cow' : fmt(n) + ' cows'; }
  function rh(n) { return Math.round(n / 100) * 100; }

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
      house: (p.place === 'motorhome' || p.has_rv || p.has_mobile) ? 'existing' : 'mobile_used', house_sqft: 1400, existing_house_price: 0,
      well: 'well', well_depth: wd ? wd.typ : data.costs.well_depth_default.typ, septic: 'conventional', power: 'grid', power_distance: 300,
      fence_type: 'barbed', fence_shape: '1', pastures: 2, fence_existing_pct: 0, barn_sqft: 0,
      tractor: false, trailer: !p.has_trailer, truck: !p.has_truck, utv: false,
      cows: 0, bull: false, horses: num(p.horses_n), horses_owned: num(p.horses_n) > 0, goats: 0, hens: 12, garden: true, trees: 0,
      town_monthly: n.outgo, household_monthly: n.household, health_monthly: n.health, runway_months: n.runwayMonths,
      cow_deal: 'own', lease_acres: num(p.grass_acres), lease_rate: num(p.grass_rate) > 0 ? num(p.grass_rate) : (land.pasture_rent || C.lease_rate_us.typ), graze_apc: C.lease_apc.typ, sell_how: 'barn',
      work_income: Math.round(num(p.inc) * 12), rent_monthly: n.rent
    };
  }

  root.GWpath = { STAGES: STAGES, needs: needs, place: place, path: path, rungs: rungs, calcInput: calcInput, debtPlan: debtPlan, fmt: fmt, cows: cows };
})(typeof window !== 'undefined' ? window : globalThis);
