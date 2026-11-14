/* Groundwork: shared page helpers. Theme, nav, and the plan carried in the link.
   Until a man signs in (a later milestone), his plan is the query string. Every page reads it and
   passes it on, so a bookmark or a pasted link is his saved plan. */
(function () {
  'use strict';
  var GW = {};

  /* ---------- the profile: fields, defaults, URL ---------- */
  GW.FIELDS = ['cash', 'debt', 'debtm', 'inc', 'from', 'spend', 'adults', 'kids', 'exp', 'place', 'move', 'state', 'county', 'hours', 'health'];
  GW.DEFAULTS = { cash: 0, debt: 0, debtm: 0, inc: 0, from: 'none', spend: 0, adults: 1, kids: 0, exp: 'none', place: 'rent', move: 'yes', state: 'TX', county: '', hours: 10, health: 'none' };

  GW.readProfile = function () {
    var q = new URLSearchParams(location.search);
    var p = {};
    GW.FIELDS.forEach(function (k) { p[k] = q.has(k) ? q.get(k) : GW.DEFAULTS[k]; });
    ['cash', 'debt', 'debtm', 'inc', 'spend', 'adults', 'kids', 'hours'].forEach(function (k) { p[k] = Math.max(0, +p[k] || 0); });
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

  window.GW = GW;
})();
