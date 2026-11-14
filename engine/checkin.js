/* Groundwork: the check-in. Three questions for the stage a man is in, the email that carries them,
   and what his answers change in his plan. Templates filled with his numbers; nothing invented.
   No DOM and no network here. Used by checkin.html in the browser, scripts/send_checkins.js in Node, and the tests.
   Load after engine/calc.js and engine/path.js. */
(function (root) {
  'use strict';

  var CHANGE = { key: 'change', text: 'Did anything big change: work, money, family, or where you can live?', options: [['no', 'No'], ['yes', 'Yes, update my plan']] };
  var QUESTIONS = {
    s1: [
      { key: 'covered', text: 'Since the last check-in, did money in cover money out?', options: [['yes', 'Yes, with some left'], ['even', 'About even'], ['short', 'No, I came up short']] },
      { key: 'saved', text: 'Did you put anything in the bank?', options: [['yes', 'Yes'], ['no', 'No']], number: { field: 'cash', label: 'What is in the bank now', unit: 'dollars' } },
      CHANGE],
    s2: [
      { key: 'worked', text: 'Since the last check-in, did you work cattle for someone?', options: [['yes', 'Yes, steady'], ['some', 'Some days'], ['no', 'No']] },
      { key: 'logged', text: 'Did you write it down, with dates and who you worked for?', options: [['yes', 'Yes'], ['no', 'Not yet']] },
      CHANGE],
    s3: [
      { key: 'running', text: 'Are you running cattle on leased grass yet, yours or another man\'s?', options: [['yes', 'Yes'], ['close', 'Working on a lease'], ['no', 'Not yet']] },
      { key: 'asked', text: 'Did you talk to a landowner or a rancher about grass or cows?', options: [['yes', 'Yes'], ['no', 'No']] },
      CHANGE],
    s4: [
      { key: 'kept', text: 'Since the last check-in, did you keep heifers or add cows?', options: [['yes', 'Yes'], ['no', 'No']], number: { field: 'cows_n', label: 'Cows you own now', unit: 'head' } },
      { key: 'grass', text: 'Did you add grass?', options: [['yes', 'Yes'], ['no', 'No']], number: { field: 'grass_acres', label: 'Acres you lease now', unit: 'acres' } },
      CHANGE],
    s5: [
      { key: 'fsa', text: 'Have you started the FSA paperwork?', options: [['yes', 'Yes'], ['no', 'Not yet']] },
      { key: 'looked', text: 'Since the last check-in, did you look at places?', options: [['yes', 'Yes'], ['no', 'No'], ['bought', 'I bought one']] },
      CHANGE],
    s6: [
      { key: 'covered', text: 'Did the place, the cattle and what you keep cover the family?', options: [['yes', 'Yes'], ['close', 'Close'], ['no', 'No']] },
      { key: 'kept', text: 'Did you keep heifers or add cows?', options: [['yes', 'Yes'], ['no', 'No']], number: { field: 'cows_n', label: 'Cows you own now', unit: 'head' } },
      CHANGE]
  };
  var CADENCE_DAYS = { weekly: 7, monthly: 30 };
  var EXP_ORDER = ['none', 'some', 'two', 'own'];
  var YEAR = 360;   /* twelve monthly check-ins of steady work make a year */

  function fmt(n) { n = Math.round(n); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function money(n) { return (n < 0 ? '-$' : '$') + fmt(Math.abs(n)); }
  function rh(n) { return Math.round(n / 100) * 100; }
  function months(m) { if (m == null) return 'not yet'; if (m <= 0) return 'now'; if (m < 12) return m + ' month' + (m === 1 ? '' : 's'); var y = Math.round(m / 12 * 10) / 10; return y === 1 ? 'about a year' : 'about ' + y + ' years'; }
  function clone(o) { return JSON.parse(JSON.stringify(o || {})); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* days of cattle work he has told the check-ins about, all of them */
  function daysWorked(state) {
    var w = (state && state.worked) || {}, t = +(state && state.worked_base) || 0;
    Object.keys(w).forEach(function (k) { t += +w[k] || 0; });
    return t;
  }
  /* the experience the check-ins have earned him, from where he started: a year of work is a step */
  function earnedExp(start, days) {
    var i = Math.max(0, EXP_ORDER.indexOf(start));
    if (i >= 2) return EXP_ORDER[i];
    return EXP_ORDER[Math.min(2, i + Math.floor(days / YEAR))];
  }
  /* months of stage 2 still to go, counting the days he has reported */
  function stage2Left(profile, state) {
    var start = (state && state.exp_start) || profile.exp;
    var need = start === 'none' ? 2 * YEAR : start === 'some' ? YEAR : 0;
    return Math.max(0, Math.ceil((need - daysWorked(state)) / 30));
  }

  /* where he stands and the one or two lines that say it, with his numbers */
  function standing(profile, state, data, calc, P) {
    var r = P.path(profile, data, calc), n = r.needs, w = r.where, st = r.stages;
    var i = w.index, def = P.STAGES[i], k = w.current, lines = [];
    var s1 = st[0], s3 = st[2], s4 = st[3], s5 = st[4], s6 = st[5];
    if (k === 's1') {
      if (n.gap < 0) lines.push('Money out runs ' + money(-n.gap) + ' a month above money in. Closing that is the whole job right now.');
      else lines.push('You have ' + money(n.gap) + ' spare a month. The cushion is ' + money(n.runwayTarget) + '; you have ' + money(n.cash) + '.' + (s1.monthsToRunway ? ' At this rate that is ' + months(s1.monthsToRunway) + '.' : ''));
    } else if (k === 's2') {
      var left = stage2Left(profile, state);
      lines.push(left > 0 ? 'Still ' + months(left) + ' of working cattle for someone else to go.' + (n.gap > 0 ? ' The cushion keeps growing meanwhile, ' + money(n.gap) + ' a month.' : '') : 'Your two years are in. Write them down; stage 3 is next.');
    } else if (k === 's3') {
      lines.push(s3.head > 0 ? 'Your hours handle about ' + s3.head + ' head. Caring for other men\'s pairs pays about ' + money(rh(s3.head * s3.deals.custom.net)) + ' a year, with nothing to buy but the panels.' : 'Find the grass and the man whose cattle you will run.');
      if (s3.handlingShort > 0) lines.push('You are ' + money(s3.handlingShort) + ' short of the panels and chute above the cushion. Borrow a chute before you buy one.');
    } else if (k === 's4') {
      if (s4.own && s4.own.head && !s4.nearly) lines.push(P.cows(s4.own.head) + ' carry the family renting a house; you have ' + (s4.cowsNow ? P.cows(s4.cowsNow) : 'none yet') + '. Keep every heifer.');
      else lines.push('What you keep from work all but covers the family. Every cow from here is money in the bank.');
    } else if (k === 's5') {
      lines.push(money(rh(s5.down)) + ' down on a modest place. ' + (s5.cashShort > 0 ? 'You are ' + money(rh(s5.cashShort)) + ' short of it.' : 'You have it.') + ' Start the FSA paperwork a year ahead.');
    } else {
      lines.push('About ' + money(rh(s6.yearly)) + ' a year to live on the place. The page shows the cattle and what you keep against it.');
    }
    return { path: r, key: k, index: i, name: def.name, short: def.short, lines: lines };
  }

  /* the email: subject, plain text and HTML. opts: { base, token, link(page, profile) } */
  function email(profile, state, data, calc, P, opts) {
    var s = standing(profile, state, data, calc, P);
    var qs = QUESTIONS[s.key];
    var base = opts.base.replace(/\/?$/, '/');
    function answerUrl(q, v) { return base + 'checkin.html?t=' + encodeURIComponent(opts.token) + '&a=' + encodeURIComponent(q + '.' + v); }
    var pathUrl = base + opts.link('path.html', profile);
    var openUrl = base + 'checkin.html?t=' + encodeURIComponent(opts.token);
    var stopUrl = openUrl + '&stop=1';
    var subject = 'Groundwork check-in: stage ' + (s.index + 1) + ', ' + s.name;
    var notice = 'This check-in is automated. It is filled in from your plan and the published figures. It is not a brother on the other end.';

    var text = ['You are at stage ' + (s.index + 1) + ': ' + s.name + '. ' + s.short, ''].concat(s.lines).concat(['', 'Three questions. Tap an answer; it opens a page with the other two.', '']);
    qs.forEach(function (q, i) { text.push((i + 1) + '. ' + q.text); q.options.forEach(function (o) { text.push('   ' + o[1] + ': ' + answerUrl(q.key, o[0])); }); text.push(''); });
    text = text.concat(['Your path: ' + pathUrl, '', notice, 'You get these because you turned on check-ins at Your account. Stop them: ' + stopUrl]);

    var btn = 'display:inline-block;margin:4px 6px 4px 0;padding:10px 16px;border:2px solid #8a4b1f;border-radius:8px;color:#8a4b1f;text-decoration:none;font-weight:600;font-size:16px;';
    var h = [];
    h.push('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light dark"><title>' + esc(subject) + '</title></head>');
    h.push('<body style="margin:0;padding:0;background:#f3f1ec;color:#1f2328;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:17px;line-height:1.5;">');
    h.push('<div style="max-width:560px;margin:0 auto;padding:20px 16px;">');
    h.push('<p style="margin:0 0 4px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#5c6369;">Groundwork check-in</p>');
    h.push('<h1 style="margin:0 0 6px;font-size:26px;line-height:1.1;">Stage ' + (s.index + 1) + ': ' + esc(s.name) + '</h1>');
    h.push('<p style="margin:0 0 14px;color:#5c6369;">' + esc(s.short) + '</p>');
    s.lines.forEach(function (l) { h.push('<p style="margin:0 0 10px;">' + esc(l) + '</p>'); });
    h.push('<p style="margin:18px 0 8px;font-weight:600;">Three questions. Tap an answer; it opens a page with the other two.</p>');
    qs.forEach(function (q, i) {
      h.push('<div style="background:#ffffff;border:1px solid #d6d2c8;padding:12px 14px;margin:0 0 10px;">');
      h.push('<p style="margin:0 0 6px;">' + (i + 1) + '. ' + esc(q.text) + '</p>');
      q.options.forEach(function (o) { h.push('<a href="' + esc(answerUrl(q.key, o[0])) + '" style="' + btn + '">' + esc(o[1]) + '</a>'); });
      h.push('</div>');
    });
    h.push('<p style="margin:16px 0;"><a href="' + esc(pathUrl) + '" style="' + btn + 'background:#8a4b1f;color:#ffffff;">Open your path</a></p>');
    h.push('<p style="margin:18px 0 6px;font-size:14px;color:#5c6369;">' + esc(notice) + '</p>');
    h.push('<p style="margin:0;font-size:14px;color:#5c6369;">You get these because you turned on check-ins at Your account. <a href="' + esc(stopUrl) + '" style="color:#5c6369;">Stop these emails</a>.</p>');
    h.push('</div></body></html>');
    return { subject: subject, text: text.join('\n'), html: h.join(''), stage: s.key, standing: s };
  }

  /* what his answers change. Same answers in, same plan out: tapping twice never counts twice.
     answers: { key: value, cash: 1234, cows_n: 12, grass_acres: 160 }; ctx: { id, cadence } */
  function apply(profile, state, answers, ctx) {
    var p = clone(profile), s = clone(state), a = answers || {}, reply = [], changed = [];
    var id = String(ctx && ctx.id != null ? ctx.id : 'x');
    var days = CADENCE_DAYS[ctx && ctx.cadence] || 30;
    if (!s.exp_start) s.exp_start = p.exp || 'none';

    /* numbers he typed */
    [['cash', 'Cash in the bank'], ['cows_n', 'Cows you own'], ['grass_acres', 'Acres you lease']].forEach(function (f) {
      if (a[f[0]] !== undefined && a[f[0]] !== '' && isFinite(+a[f[0]]) && +a[f[0]] >= 0 && +a[f[0]] !== +p[f[0]]) { p[f[0]] = Math.round(+a[f[0]]); changed.push(f[1] + ' is now ' + (f[0] === 'cash' ? money(p[f[0]]) : fmt(p[f[0]])) + '.'); }
    });

    /* days of cattle work: this check-in's credit, replaced, never added twice */
    if (a.worked !== undefined) {
      s.worked = s.worked || {};
      s.worked[id] = a.worked === 'yes' ? days : a.worked === 'some' ? Math.round(days / 2) : 0;
      var keys = Object.keys(s.worked);
      if (keys.length > 24) { keys.sort(function (x, y) { return (+x || 0) - (+y || 0); }).slice(0, keys.length - 24).forEach(function (k) { s.worked_base = (+s.worked_base || 0) + (+s.worked[k] || 0); delete s.worked[k]; }); }
      var earned = earnedExp(s.exp_start, daysWorked(s));
      if (EXP_ORDER.indexOf(earned) > EXP_ORDER.indexOf(p.exp)) { p.exp = earned; changed.push(earned === 'two' ? 'Two years of working cattle are in. Stage 2 is done.' : 'A year of working cattle is in.'); }
    }
    if (a.running === 'yes' && !p.running) { p.running = 1; changed.push('Running cattle on leased grass. Stage 3 is done.'); }
    if (a.looked === 'bought' && p.place !== 'own') { p.place = 'own'; changed.push('A place of your own. Stage 5 is done.'); }

    /* the reply, by answer */
    var R = {
      covered: { yes: 'Good. Every month like that builds the cushion.', even: 'Even is a start. The cushion grows on what is left over.', short: 'Then the gap is this month\'s work. The budget sheet on Get steady shows where it goes.', close: 'Close is most of the way. Look at the one line that missed.', no: 'Then the job and the lean household carry more for now. That is how most men do it.' },
      saved: { no: 'A little every month counts more than a lot once.' },
      worked: { no: 'Day work at a neighbor\'s, a sale barn, a feedlot: any of it counts, and it is paid.', some: 'Some days count. Write them down.' },
      logged: { no: 'Do it tonight: the dates, the place, the man, what you did. The FSA and the man with the grass will both ask.' },
      running: { close: 'Get the lease on paper: who fixes fence, who hauls water, who buys mineral.', no: 'Ask the man you worked for who is slowing down. That is where the first cattle come from.' },
      asked: { no: 'One conversation this month. Ask who has grass that is not being used.' },
      kept: { no: 'Keep the next good heifer. The herd grows on the ones you keep.' },
      grass: { no: 'The cheapest acres are the ones next to the ones you lease now.' },
      fsa: { no: 'Call the county FSA office. The paperwork goes faster than the place turns up, but start it a year ahead.' },
      looked: { no: 'Look at one place a month, even if you are not ready. You learn what a fair price is.' },
      change: { yes: 'Change your answers on Where you are and your path moves with them.' }
    };
    Object.keys(R).forEach(function (k) { if (a[k] !== undefined && R[k][a[k]]) reply.push(R[k][a[k]]); });
    return { profile: p, state: s, changed: changed, reply: reply };
  }

  root.GWcheckin = { QUESTIONS: QUESTIONS, CADENCE_DAYS: CADENCE_DAYS, standing: standing, email: email, apply: apply, daysWorked: daysWorked, earnedExp: earnedExp, stage2Left: stage2Left };
})(typeof window !== 'undefined' ? window : globalThis);
