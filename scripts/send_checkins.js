/* Groundwork: send the check-ins that are due. Run once a day by .github/workflows/checkins.yml.
   Asks the database who is due, builds each man's email from the same engine the pages use, sends it through Resend,
   and marks it sent. No packages: Node 20 and fetch.

   Settings (GitHub Actions secrets, never in this repo):
     SUPABASE_URL           https://<project>.supabase.co
     SUPABASE_SECRET_KEY    the secret (service role) key, from Supabase > Project Settings > API Keys
     RESEND_API_KEY         from resend.com > API Keys
     GW_FROM                the sender, e.g. "Groundwork <checkin@yourdomain>"
     GW_BASE                the site, default https://wcwilkins2025.github.io/groundwork/

   node scripts/send_checkins.js                 send what is due
   node scripts/send_checkins.js --dry           list who is due and build their emails, send nothing, change nothing
   node scripts/send_checkins.js --sample DIR    write sample emails for worked-example men to DIR, no network at all */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const root = path.join(__dirname, '..');

/* ---------- the engine, loaded the way the pages load it ---------- */
function loadEngine() {
  const noop = () => {};
  const el = () => ({ appendChild: noop, setAttribute: noop, addEventListener: noop, style: {}, children: [] });
  const document = { readyState: 'complete', addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: el, documentElement: el() };
  const ctx = { console, document, location: { search: '', origin: '', pathname: '/' }, URLSearchParams, setTimeout, clearTimeout, localStorage: { getItem: () => null, setItem: noop, removeItem: noop }, sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop }, matchMedia: () => ({ matches: false }) };
  ctx.window = ctx; vm.createContext(ctx);
  for (const f of ['data/bundle.js', 'engine/calc.js', 'engine/path.js', 'engine/checkin.js', 'site.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  return { D: ctx.HC, calc: ctx.HCcalc, P: ctx.GWpath, K: ctx.GWcheckin, GW: ctx.GW };
}
const E = loadEngine();

/* a stored profile, with every field present, as readProfile would give it */
function full(profile) {
  const p = Object.assign({}, E.GW.DEFAULTS, profile || {});
  ['cash', 'debt', 'debtm', 'inc', 'spend', 'rent', 'adults', 'kids', 'hours', 'horses_n', 'cows_n', 'grass_acres', 'grass_rate'].forEach((k) => { p[k] = Math.max(0, +p[k] || 0); });
  E.GW.BOOLS.forEach((k) => { p[k] = /^(1|true|yes|on)$/i.test(String(p[k])) ? 1 : 0; });
  p.state = String(p.state || 'TX').toUpperCase();
  p.has = true;
  return p;
}
function build(profile, state, token, base) {
  return E.K.email(full(profile), state || {}, E.D, E.calc, E.P, { base, token, link: E.GW.link });
}

/* ---------- worked examples, for looking at the emails with no accounts ---------- */
const SAMPLES = {
  stage1_short: { inc: 1500, from: 'job', cash: 500, state: 'OK' },
  stage1_saving: { inc: 4500, from: 'job', cash: 6000, exp: 'some' },
  stage2: { inc: 6000, from: 'job', cash: 15000, adults: 2, health: 'work' },
  stage3: { inc: 7000, from: 'job', cash: 25000, adults: 2, exp: 'two', hours: 15, state: 'OK', health: 'work' },
  cows_on_lease: { inc: 5000, from: 'job', cash: 30000, exp: 'two', has_rv: 1, has_truck: 1, has_trailer: 1, has_panels: 1, live: 'lease', grass_acres: 160, cows_n: 12, hours: 20, adults: 2, kids: 2, county: 'Fannin' },
  stage5: { inc: 0, cash: 20000, exp: 'own', cows_n: 150, grass_acres: 600, hours: 40, has_truck: 1, has_trailer: 1, has_panels: 1 }
};

/* ---------- the database and the mail service ---------- */
function env(k, d) { const v = process.env[k]; return v && v.trim() ? v.trim() : d; }
function dbHeaders(key) { const h = { apikey: key, 'Content-Type': 'application/json' }; if (/^eyJ/.test(key)) h.Authorization = 'Bearer ' + key; return h; }
async function db(method, url, key, body, prefer) {
  const h = dbHeaders(key); if (prefer) h.Prefer = prefer;
  const r = await fetch(url, { method, headers: h, body: body == null ? undefined : JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error(method + ' ' + url.replace(/^https:\/\/[^/]+/, '') + ' ' + r.status + ': ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}
async function sendMail(apiKey, from, to, mail, stopUrl) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject: mail.subject, html: mail.html, text: mail.text, headers: { 'List-Unsubscribe': '<' + stopUrl + '>' } })
  });
  const t = await r.text();
  if (!r.ok) throw new Error('Resend ' + r.status + ': ' + t.slice(0, 300));
  return JSON.parse(t);
}
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const mask = (e) => String(e).replace(/^(.).*(@.*)$/, '$1***$2');

async function main() {
  const args = process.argv.slice(2);
  const base = env('GW_BASE', 'https://wcwilkins2025.github.io/groundwork/').replace(/\/?$/, '/');

  if (args[0] === '--sample') {
    const dir = path.resolve(args[1] || 'checkin-samples'); fs.mkdirSync(dir, { recursive: true });
    for (const [name, prof] of Object.entries(SAMPLES)) {
      const m = build(prof, {}, 'sample' + '0'.repeat(26), base);
      fs.writeFileSync(path.join(dir, name + '.html'), m.html); fs.writeFileSync(path.join(dir, name + '.txt'), m.subject + '\n\n' + m.text);
      console.log(name + ': ' + m.subject);
    }
    console.log('Wrote ' + Object.keys(SAMPLES).length + ' samples to ' + dir);
    return 0;
  }

  const dry = args.includes('--dry');
  const url = env('SUPABASE_URL'), key = env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  const resend = env('RESEND_API_KEY'), from = env('GW_FROM');
  const missing = [['SUPABASE_URL', url], ['SUPABASE_SECRET_KEY', key]].concat(dry ? [] : [['RESEND_API_KEY', resend], ['GW_FROM', from]]).filter((x) => !x[1]).map((x) => x[0]);
  if (missing.length) { console.log('Check-ins are not set up yet. Missing: ' + missing.join(', ') + '. Nothing sent.'); return 0; }
  const rest = url.replace(/\/$/, '') + '/rest/v1';

  const due = await db('POST', rest + '/rpc/checkins_due', key, {});
  console.log(due.length + ' due' + (dry ? ' (dry run, nothing sent)' : ''));
  let sent = 0, failed = 0;
  for (const man of due) {
    const token = crypto.randomBytes(24).toString('hex');
    let row = null;
    try {
      const mail = build(man.profile, man.state, token, base);
      const stopUrl = base + 'checkin.html?t=' + token + '&stop=1';
      if (dry) { console.log('  would send ' + mask(man.email) + ': ' + mail.subject); continue; }
      row = (await db('POST', rest + '/checkins', key, { user_id: man.user_id, token, stage: mail.stage, cadence: man.checkin }, 'return=representation'))[0];
      await sendMail(resend, from, man.email, mail, stopUrl);
      await db('PATCH', rest + '/plans?user_id=eq.' + encodeURIComponent(man.user_id), key, { checkin_last: new Date().toISOString() }, 'return=minimal');
      sent++; console.log('  sent ' + mask(man.email) + ': ' + mail.subject);
    } catch (e) {
      failed++; console.log('  FAILED ' + mask(man.email) + ': ' + (e.message || e));
      if (row) { try { await db('DELETE', rest + '/checkins?id=eq.' + row.id, key, null, 'return=minimal'); } catch (e2) { /* the unanswered row expires on its own */ } }
    }
    await sleep(600);   /* Resend's free plan takes two a second */
  }
  if (!dry) console.log(sent + ' sent, ' + failed + ' failed');
  return failed ? 1 : 0;
}

if (require.main === module) main().then((code) => process.exit(code), (e) => { console.error(e.message || e); process.exit(1); });
module.exports = { build, full, SAMPLES, E };
