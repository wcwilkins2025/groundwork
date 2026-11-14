/* Groundwork: shared page helpers. Theme, nav, and the plan carried in the link.
   Until a man signs in (a later milestone), his plan is the query string. Every page reads it and
   passes it on, so a bookmark or a pasted link is his saved plan. */
(function () {
  'use strict';
  var GW = {};

  /* ---------- the profile: fields, defaults, URL ---------- */
  GW.FIELDS = ['cash', 'debt', 'debtm', 'inc', 'from', 'spend', 'rent', 'adults', 'kids', 'exp', 'place', 'live', 'move', 'state', 'county', 'hours', 'health', 'debts',
    'has_rv', 'has_mobile', 'has_truck', 'has_trailer', 'has_tractor', 'has_panels', 'has_tools', 'horses_n', 'cows_n', 'grass_acres', 'grass_rate'];
  GW.BOOLS = ['has_rv', 'has_mobile', 'has_truck', 'has_trailer', 'has_tractor', 'has_panels', 'has_tools'];
  GW.DEFAULTS = { cash: 0, debt: 0, debtm: 0, inc: 0, from: 'none', spend: 0, rent: 0, adults: 1, kids: 0, exp: 'none', place: 'rent', move: 'yes', state: 'TX', county: '', hours: 10, health: 'none', debts: '', live: 'same',
    has_rv: 0, has_mobile: 0, has_truck: 0, has_trailer: 0, has_tractor: 0, has_panels: 0, has_tools: 0, horses_n: 0, cows_n: 0, grass_acres: 0, grass_rate: 0 };

  GW.readProfile = function () {
    var q = new URLSearchParams(location.search);
    var p = {};
    GW.FIELDS.forEach(function (k) { p[k] = q.has(k) ? q.get(k) : GW.DEFAULTS[k]; });
    ['cash', 'debt', 'debtm', 'inc', 'spend', 'rent', 'adults', 'kids', 'hours', 'horses_n', 'cows_n', 'grass_acres', 'grass_rate'].forEach(function (k) { p[k] = Math.max(0, +p[k] || 0); });
    GW.BOOLS.forEach(function (k) { p[k] = /^(1|true|yes|on)$/i.test(String(p[k])) ? 1 : 0; });
    p.state = String(p.state || 'TX').toUpperCase();
    p.has = GW.FIELDS.some(function (k) { return q.has(k); });
    return p;
  };
  GW.profileQuery = function (p) {
    var q = new URLSearchParams();
    GW.FIELDS.forEach(function (k) { if (p[k] !== undefined && p[k] !== null && String(p[k]) !== String(GW.DEFAULTS[k])) q.set(k, p[k]); });
    return q.toString();
  };
  GW.link = function (page, p) { var qs = GW.profileQuery(p); return page + (qs ? '?' + qs : ''); };

  /* carry the plan on every nav link */
  GW.carry = function (p) {
    document.querySelectorAll('a[data-carry]').forEach(function (a) {
      var page = a.getAttribute('data-carry');
      a.setAttribute('href', GW.link(page, p));
    });
  };

  /* the debt list in the link: name:balance:payment:rate|name:balance:payment:rate */
  GW.parseDebts = function (s) {
    if (!s) return [];
    return String(s).split('|').map(function (part) { var f = part.split(':'); return { name: decodeURIComponent(f[0] || ''), bal: +f[1] || 0, pay: +f[2] || 0, rate: +f[3] || 0 }; }).filter(function (d) { return d.bal > 0 || d.name; });
  };
  GW.encodeDebts = function (list) {
    return list.filter(function (d) { return d.bal > 0; }).map(function (d) { return [encodeURIComponent(d.name || ''), d.bal, d.pay, d.rate].join(':'); }).join('|');
  };

  /* ---------- theme ---------- */
  function setTheme(t) {
    if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
    try { if (t) localStorage.setItem('theme', t); else localStorage.removeItem('theme'); } catch (e) {}
    var btn = document.getElementById('themeBtn');
    if (!btn) return;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    btn.textContent = dark ? 'Light mode' : 'Dark mode';
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
  }
  GW.initTheme = function () {
    var saved = null; try { saved = localStorage.getItem('theme'); } catch (e) {}
    setTheme(saved);
    var btn = document.getElementById('themeBtn');
    if (btn) btn.addEventListener('click', function () {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setTheme(dark ? 'light' : 'dark');
    });
  };

  /* ---------- small helpers ---------- */
  GW.$ = function (id) { return document.getElementById(id); };
  GW.fmt = function (n) { n = Math.round(n); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  GW.money = function (n) { return (n < 0 ? '-$' : '$') + GW.fmt(Math.abs(n)); };
  GW.rh = function (n) { return Math.round(n / 100) * 100; };
  GW.el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  GW.copyText = function (text, okMsg) {
    var flash = document.getElementById('flash');
    function done(msg) { if (flash) { flash.textContent = msg; setTimeout(function () { flash.textContent = ''; }, 4000); } }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(okMsg); }, function () { done('Could not copy. Select the text and copy it.'); });
    else done('Could not copy. Select the text and copy it.');
  };


  /* ---------- the account: sign in by email link, keep the plan, delete it ----------
     The plan still rides in the link. Signing in only adds a place to keep it: one row, his alone. */
  var client = null;
  GW.supa = function () {
    if (client) return client;
    if (!window.supabase || !window.GW_CONFIG) return null;
    client = window.supabase.createClient(GW_CONFIG.supabaseUrl, GW_CONFIG.supabaseKey, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } });
    return client;
  };
  GW.session = function () {
    var c = GW.supa(); if (!c) return Promise.resolve(null);
    return c.auth.getSession().then(function (r) { return r.data.session || null; });
  };
  GW.signIn = function (email) {
    var c = GW.supa(); if (!c) return Promise.reject(new Error('not set up'));
    var back = location.origin + location.pathname.replace(/[^\/]*$/, '') + 'account.html';
    return c.auth.signInWithOtp({ email: email, options: { emailRedirectTo: back } });
  };
  GW.signOut = function () { var c = GW.supa(); return c ? c.auth.signOut() : Promise.resolve(); };
  GW.savePlan = function (profile) {
    var c = GW.supa();
    return GW.session().then(function (s) {
      if (!s) throw new Error('not signed in');
      var clean = {}; GW.FIELDS.forEach(function (k) { if (profile[k] !== undefined) clean[k] = profile[k]; });
      return c.from('plans').upsert({ user_id: s.user.id, profile: clean }, { onConflict: 'user_id' }).then(function (r) { if (r.error) throw r.error; return clean; });
    });
  };
  GW.loadPlan = function () {
    var c = GW.supa();
    return GW.session().then(function (s) {
      if (!s) return null;
      return c.from('plans').select('profile, updated_at').eq('user_id', s.user.id).maybeSingle().then(function (r) { if (r.error) throw r.error; return r.data; });
    });
  };
  GW.deleteMe = function () {
    var c = GW.supa();
    return c.rpc('delete_me').then(function (r) { if (r.error) throw r.error; return c.auth.signOut(); });
  };

  /* the small account line in the nav, and the Save button on the plan pages */
  GW.initAccount = function (profile) {
    var slot = document.getElementById('account');
    var saveBtn = document.getElementById('saveBtn');
    if (!GW.supa()) { if (slot) slot.hidden = true; if (saveBtn) saveBtn.hidden = true; return; }
    GW.session().then(function (s) {
      if (slot) {
        slot.textContent = '';
        var a = document.createElement('a'); a.href = GW.link('account.html', profile || GW.readProfile());
        a.textContent = s ? 'Your account' : 'Sign in to keep this';
        slot.appendChild(a);
      }
      if (saveBtn) {
        saveBtn.hidden = !s;
        saveBtn.addEventListener('click', function () {
          saveBtn.disabled = true;
          GW.savePlan(profile || GW.readProfile()).then(function () { GW.flash('Saved. Sign in on any phone or computer and it is there.'); }, function (e) { GW.flash('Could not save: ' + (e.message || e)); }).then(function () { saveBtn.disabled = false; });
        });
      }
      /* a signed-in man opening a page with no plan in the link gets his saved one */
      if (s && profile && !profile.has && !sessionStorage.getItem('gw-loaded')) {
        GW.loadPlan().then(function (row) {
          if (row && row.profile && Object.keys(row.profile).length) {
            try { sessionStorage.setItem('gw-loaded', '1'); } catch (e) {}
            var page = location.pathname.replace(/^.*\//, '') || 'index.html';
            if (page !== 'index.html' && page !== 'account.html' && page !== 'privacy.html') location.replace(GW.link(page, row.profile));
          }
        }).catch(function () {});
      }
    }).catch(function () {});
  };
  GW.flash = function (msg) { var f = document.getElementById('flash'); if (f) { f.textContent = msg; setTimeout(function () { f.textContent = ''; }, 5000); } };

  window.GW = GW;
})();
