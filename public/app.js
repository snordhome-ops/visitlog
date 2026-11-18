/* Nord Home Sales Desk: sign-in, shared helpers, dashboard, daily report, visits. */
(function () {
  'use strict';
  var NH = window.NH = window.NH || {};
  var $ = function (id) { return document.getElementById(id); };
  var STATUSES = ['Visit only', 'Follow-up', 'Sample', 'Sale'];
  var ARCH = ['', 'Yes', 'No', 'Designer', 'Carpenter'];
  var state = NH.state = { visits: [], quotes: [], loaded: false, view: 'dashboard', range: 30, period: 'day', date: today(), filter: { q: '', sp: '', status: '', month: '' }, editing: null, confirmDel: null };

  /* ---------- helpers ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return ymd(new Date()); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }
  function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); }
  function weekStart(s) { var d = parse(s), k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return ymd(d); }
  function dShort(s) { return parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  function dLong(s) { return parse(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function dDay(s) { return parse(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function toast(m) { var t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 2600); }
  function spKey(s) { var w = String(s || '').toLowerCase().replace(/[.,]/g, ' ').split(/\s+/).filter(function (x) { return x && !/^(mr|mrs|ms|miss|dr|sb|sir|sahib|engr|ar)$/.test(x); }); return w[0] || ''; }
  function spName(k) { return k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Not noted'; }
  function pill(s) { return '<span class="pill p-' + esc(String(s || 'Visit only').replace(' ', '-')) + '">' + esc(s || 'Visit only') + '</span>'; }
  function count(list, fn) { var m = {}; list.forEach(function (v) { var k = fn(v); if (!k) return; m[k] = (m[k] || 0) + 1; }); return Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; }); }
  var ICONS = {
    dashboard: '<path d="M4 13h6V4H4zM14 20h6V11h-6zM4 20h6v-3H4zM14 8h6V4h-6z"/>',
    report: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/>',
    visits: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5M16 5.5a3 3 0 0 1 0 5.8M17.5 14.8c2 .6 3 2.3 3 5.2"/>',
    quotes: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'
  };
  function icon(n) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + '</svg>'; }
  var VIEWS = [['dashboard', 'Dashboard'], ['report', 'Daily report'], ['visits', 'Visits'], ['quotes', 'Quotations']];
  Object.assign(NH, { esc: esc, fmt: fmt, today: today, addDays: addDays, toast: toast, parse: parse, ymd: ymd });
  NH.canEdit = function () { return !SESS || SESS.role !== 'viewer'; };

  /* ---------- session + api ---------- */
  var SESS = null;
  try { SESS = JSON.parse(localStorage.getItem('nh_sess') || 'null'); } catch (e) { SESS = null; }
  function saveSess(s) { SESS = s; try { if (s) localStorage.setItem('nh_sess', JSON.stringify(s)); else localStorage.removeItem('nh_sess'); } catch (e) { } }
  function raw(method, url, body, auth) {
    var h = { 'content-type': 'application/json' };
    if (auth && SESS) h.Authorization = 'Bearer ' + SESS.access_token;
    return fetch(url, { method: method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  }
  var refreshing = null;
  function refresh() {
    if (!SESS) return Promise.reject(new Error('auth'));
    if (!refreshing) {
      refreshing = raw('POST', '/api/auth', { action: 'refresh', refresh_token: SESS.refresh_token }).then(function (r) { if (!r.ok) throw new Error('auth'); return r.json(); }).then(function (s) { saveSess(s); }).then(function () { refreshing = null; }, function (e) { refreshing = null; throw e; });
    }
    return refreshing;
  }
  function chk(r) {
    if (r.status === 401) { logout(true); throw new Error('auth'); }
    if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { var e = new Error(j.error || 'http ' + r.status); e.status = r.status; throw e; });
    return r.json();
  }
  function api(method, path, body) {
    var go = function () { return raw(method, path, body, true); };
    var pre = SESS && SESS.expires_at - Date.now() / 1000 < 60 ? refresh().catch(function () { }) : Promise.resolve();
    return pre.then(go).then(function (r) {
      if (r.status === 401) return refresh().then(go, function () { logout(true); throw new Error('auth'); }).then(chk);
      return chk(r);
    });
  }
  NH.api = api;

  /* ---------- login / logout ---------- */
  function showLogin(msg, info) {
    $('shell').hidden = true; $('login').hidden = false;
    var m = $('lmsg'); m.hidden = !msg; m.textContent = msg || ''; m.className = 'msg' + (info ? ' info' : '');
    document.title = 'Sign in · Nord Home';
    setTimeout(function () { ($('lemail').value ? $('lpass') : $('lemail')).focus(); }, 30);
  }
  function logout(expired) {
    saveSess(null); state.loaded = false; state.visits = []; state.quotes = [];
    ['v-dashboard', 'v-report', 'v-visits'].forEach(function (id) { $(id).innerHTML = ''; });
    showLogin(expired === true ? 'Your session ended. Please sign in again.' : '', true);
  }
  $('lshow').onclick = function () { var p = $('lpass'), s = p.type === 'password'; p.type = s ? 'text' : 'password'; this.textContent = s ? 'Hide' : 'Show'; };
  $('lform').addEventListener('submit', function (e) {
    e.preventDefault();
    var b = $('lgo'); b.disabled = true; b.textContent = 'Signing in…';
    raw('POST', '/api/auth', { action: 'login', email: $('lemail').value, password: $('lpass').value }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Could not sign in.'); return j; });
    }).then(function (s) { saveSess(s); $('lpass').value = ''; boot(); }, function (err) { showLogin(err.message); $('lpass').select(); })
      .then(function () { b.disabled = false; b.textContent = 'Sign in'; });
  });
  $('logout').onclick = $('logout2').onclick = function () { logout(false); };

  /* ---------- shell + routing ---------- */
  function buildNav() {
    var h = VIEWS.map(function (v) { return '<a href="#' + v[0] + '" data-v="' + v[0] + '">' + icon(v[0]) + '<span>' + v[1] + '</span></a>'; }).join('');
    $('nav').innerHTML = h; $('mobnav').innerHTML = h;
    $('whoEmail').textContent = SESS.email || 'Signed in';
    $('whoRole').textContent = SESS.role === 'viewer' ? 'View-only access' : 'Can add and edit';
  }
  function route() {
    var v = (location.hash || '').replace('#', '');
    if (!VIEWS.some(function (x) { return x[0] === v; })) v = 'dashboard';
    state.view = v;
    document.querySelectorAll('.view').forEach(function (s) { s.hidden = s.id !== 'v-' + v; });
    document.querySelectorAll('[data-v]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-v') === v); });
    document.title = VIEWS.filter(function (x) { return x[0] === v; })[0][1] + ' · Nord Home';
    render();
    window.scrollTo(0, 0);
    if (v === 'quotes' && NH.quote) NH.quote.show();
  }
  window.addEventListener('hashchange', function () { if (SESS) route(); });
  NH.go = function (v) { if (location.hash === '#' + v) route(); else location.hash = '#' + v; };

  function render() {
    if (!state.loaded) { ['dashboard', 'report', 'visits'].forEach(function (v) { $('v-' + v).innerHTML = '<div class="empty">Loading…</div>'; }); return; }
    if (state.view === 'dashboard') renderDashboard();
    else if (state.view === 'report') renderReport();
    else if (state.view === 'visits') renderVisits();
  }

  function load() {
    return Promise.all([api('GET', '/api/visits'), api('GET', '/api/quotations')]).then(function (r) {
      state.visits = r[0].map(function (x) { x.status = x.status || 'Visit only'; return x; });
      state.quotes = r[1];
      var first = !state.loaded; state.loaded = true;
      if (first && state.visits.length && !state.visits.some(function (v) { return v.date === state.date; })) state.date = state.visits.reduce(function (m, v) { return v.date > m ? v.date : m; }, '');
      if (NH.quote) NH.quote.dataChanged();
      var ae = document.activeElement;
      if (!$('vdlg').open && !(ae && ae.closest && ae.closest('.view') && /INPUT|SELECT|TEXTAREA/.test(ae.tagName))) render();
    }, function (e) { if (e.message !== 'auth') { if (!state.loaded) { $('v-' + state.view).innerHTML = '<div class="empty">Could not reach the server. <button class="btn sm" id="retry">Try again</button></div>'; var rb = $('retry'); if (rb) rb.onclick = load; } } });
  }
  NH.reload = load;

  function boot() {
    if (!SESS) { showLogin(); return; }
    $('login').hidden = true; $('shell').hidden = false;
    buildNav(); route(); load();
  }
  setInterval(function () { if (SESS && !document.hidden && state.loaded) load(); }, 45000);
  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (SESS && state.view === 'dashboard' && state.loaded) drawCharts(); }, 150); });

  /* ---------- dashboard ---------- */
  function rangeBounds() {
    var end = today(), start;
    if (state.range === 'all') start = state.visits.concat(state.quotes).reduce(function (m, x) { return !m || x.date < m ? x.date : m; }, '') || end;
    else start = addDays(end, -(state.range - 1));
    return [start, end];
  }
  function inR(list, a, b) { return list.filter(function (x) { return x.date >= a && x.date <= b; }); }
  function delta(cur, prev, label) {
    if (state.range === 'all') return '';
    if (!prev && !cur) return '<span>no change</span>';
    if (!prev) return '<span>new vs previous ' + label + '</span>';
    var p = Math.round((cur - prev) / prev * 100);
    return '<span>' + (p > 0 ? '▲ ' : p < 0 ? '▼ ' : '') + Math.abs(p) + '% vs previous ' + label + '</span>';
  }
  function renderDashboard() {
    var rb = rangeBounds(), a = rb[0], b = rb[1], span = diffDays(a, b) + 1;
    var pa = addDays(a, -span), pb = addDays(a, -1), lab = state.range === 'all' ? '' : state.range + ' days';
    var V = inR(state.visits, a, b), Q = inR(state.quotes, a, b), PV = inR(state.visits, pa, pb), PQ = inR(state.quotes, pa, pb);
    var sale = V.filter(function (v) { return v.status === 'Sale'; }).length, psale = PV.filter(function (v) { return v.status === 'Sale'; }).length;
    var qv = Q.reduce(function (s, q) { return s + q.total; }, 0), pqv = PQ.reduce(function (s, q) { return s + q.total; }, 0);
    var won = Q.filter(function (q) { return q.status === 'Won'; }).reduce(function (s, q) { return s + q.total; }, 0);
    var conv = V.length ? Math.round(sale / V.length * 100) : 0;
    function kpi(l, n, d, cls, title) { return '<div class="kpi ' + (cls || '') + '"><div class="l">' + l + '</div><div class="n" title="' + esc(title || '') + '">' + n + '</div><div class="d">' + (d || '') + '</div></div>'; }
    var h = '<div class="ph"><div><h1>Dashboard</h1><p>Walk-in visits and quotations, ' + (state.range === 'all' ? 'all time' : 'last ' + state.range + ' days') + ' (' + dShort(a) + ' – ' + dShort(b) + ')</p></div><div class="acts"><div class="seg" role="group" aria-label="Period">' + [[7, '7 days'], [30, '30 days'], [90, '90 days'], ['all', 'All time']].map(function (p) { return '<button data-range="' + p[0] + '" class="' + (state.range === p[0] ? 'on' : '') + '">' + p[1] + '</button>'; }).join('') + '</div>' + (NH.canEdit() ? '<button class="btn primary" data-newvisit>+ New visit</button>' : '') + '</div></div>';
    h += '<div class="kpis k6">' +
      kpi('Visits', V.length, delta(V.length, PV.length, lab)) +
      kpi('Sales from visits', sale, delta(sale, psale, lab)) +
      kpi('Visit to sale rate', conv + '%', V.length ? sale + ' of ' + V.length + ' visits' : '') +
      kpi('Quotations issued', Q.length, delta(Q.length, PQ.length, lab)) +
      kpi('Quoted value', '<small>PKR</small>' + NHC.short(qv), delta(qv, pqv, lab), 'key', 'PKR ' + fmt(qv)) +
      kpi('Won value', '<small>PKR</small>' + NHC.short(won), Q.length ? (function (n) { return n + ' won quotation' + (n === 1 ? '' : 's'); })(Q.filter(function (q) { return q.status === 'Won'; }).length) : '', '', 'PKR ' + fmt(won)) + '</div>';
    h += '<div class="grid g21"><div class="card"><h2>Visits over time</h2><div class="legend">' + [['Visit only', 'var(--c-visit)'], ['Follow-up', 'var(--c-follow)'], ['Sample', 'var(--c-sample)'], ['Sale', 'var(--c-sale)']].map(function (s) { return '<span><i style="background:' + s[1] + '"></i>' + s[0] + '</span>'; }).join('') + '</div><div class="chart" id="ch-visits"></div></div>' +
      '<div class="card"><h2>Visit outcomes</h2><div class="donutwrap"><div class="chart" id="ch-donut"></div><div class="dl" id="dl-donut"></div></div></div></div>';
    h += '<div class="grid g21"><div class="card"><h2>Quoted value over time <small>PKR</small></h2><div class="legend">' + [['Open', 'var(--c-open)'], ['Won', 'var(--c-won)'], ['Lost', 'var(--c-lost)']].map(function (s) { return '<span><i style="background:' + s[1] + '"></i>' + s[0] + '</span>'; }).join('') + '</div><div class="chart" id="ch-quotes"></div></div>' +
      '<div class="card"><h2>Follow-ups waiting</h2>' + followList(V) + '</div></div>';
    h += '<div class="card" style="margin-bottom:14px"><h2>Sales team</h2>' + teamTable(V, Q) + '</div>';
    h += '<div class="grid g3"><div class="card"><h2>Top locations</h2>' + bars(count(V, function (v) { return v.location; }), 7) + '</div><div class="card"><h2>Where clients come from</h2>' + bars(count(V, function (v) { return v.reference; }), 7) + '</div><div class="card"><h2>Latest quotations</h2>' + recentQuotes() + '</div></div>';
    $('v-dashboard').innerHTML = h;
    drawCharts();
  }
  function followList(V) {
    var f = V.filter(function (v) { return v.status === 'Follow-up' || v.status === 'Sample'; }).sort(function (x, y) { return x.date < y.date ? 1 : -1; }).slice(0, 5);
    if (!f.length) return '<div class="empty">Nothing waiting in this period.</div>';
    return '<ul class="fu">' + f.map(function (v) { return '<li>' + pill(v.status) + '<div><b>' + esc(v.client) + '</b><div class="meta">' + dShort(v.date) + (v.salesperson ? ' · ' + esc(v.salesperson) : '') + '</div><div>' + esc(v.remarks || v.interest || '') + '</div></div></li>'; }).join('') + '</ul>';
  }
  function bars(list, n) {
    if (!list.length) return '<div class="empty">No data in this period.</div>';
    var max = list[0][1];
    return list.slice(0, n).map(function (x) { return '<div class="bar"><span title="' + esc(x[0]) + '">' + esc(x[0]) + '</span><span class="t"><i style="width:' + Math.max(4, x[1] / max * 100) + '%"></i></span><b>' + x[1] + '</b></div>'; }).join('');
  }
  function recentQuotes() {
    var q = state.quotes.slice().sort(function (x, y) { return x.date < y.date ? 1 : x.date > y.date ? -1 : (y.updated || 0) - (x.updated || 0); }).slice(0, 6);
    if (!q.length) return '<div class="empty">No quotations yet.</div>';
    return '<ul class="fu">' + q.map(function (x) { return '<li><div style="flex:1;min-width:0"><b>#' + esc(x.no) + ' ' + esc(x.client || 'No client') + '</b><div class="meta">' + dShort(x.date) + ' · PKR ' + fmt(x.total) + '</div></div>' + pill(x.status) + '</li>'; }).join('') + '</ul>';
  }
  function teamTable(V, Q) {
    var m = {};
    function g(k) { return m[k] || (m[k] = { v: 0, s: 0, q: 0, qv: 0, won: 0 }); }
    V.forEach(function (v) { var r = g(spKey(v.salesperson)); r.v++; if (v.status === 'Sale') r.s++; });
    Q.forEach(function (q) { var r = g(spKey(q.sales)); r.q++; r.qv += q.total; if (q.status === 'Won') r.won += q.total; });
    var rows = Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return (b[1].v + b[1].q) - (a[1].v + a[1].q); });
    if (!rows.length) return '<div class="empty">No data in this period.</div>';
    return '<div class="tw"><table><thead><tr><th>Sales person</th><th class="r">Visits</th><th class="r">Sales</th><th>Visit to sale</th><th class="r">Quotations</th><th class="r">Quoted (PKR)</th><th class="r">Won (PKR)</th></tr></thead><tbody>' + rows.map(function (r) {
      var c = r[1].v ? Math.round(r[1].s / r[1].v * 100) : 0;
      return '<tr><td><b>' + esc(spName(r[0])) + '</b></td><td class="r">' + r[1].v + '</td><td class="r">' + r[1].s + '</td><td><div class="cb"><i style="width:' + Math.round(c * 0.8) + 'px"></i><span class="num">' + c + '%</span></div></td><td class="r">' + r[1].q + '</td><td class="r">' + fmt(r[1].qv) + '</td><td class="r">' + fmt(r[1].won) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  function buckets(a, b) {
    var span = diffDays(a, b) + 1, mode = span <= 14 ? 'day' : span <= 100 ? 'week' : 'month', keys = [], labels = [], seen = {};
    function key(d) { return mode === 'day' ? d : mode === 'week' ? weekStart(d) : d.slice(0, 7); }
    for (var d = a; d <= b; d = addDays(d, 1)) {
      var k = key(d); if (seen[k]) continue; seen[k] = 1; keys.push(k);
      labels.push(mode === 'month' ? parse(k + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : mode === 'day' ? parse(k).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : dShort(k));
    }
    return { mode: mode, keys: keys, labels: labels, key: key, tip: function (i) { return mode === 'week' ? 'Week of ' + dShort(keys[i]) : mode === 'month' ? labels[i] : dDay(keys[i]); } };
  }
  function drawCharts() {
    var rb = rangeBounds(), a = rb[0], b = rb[1], V = inR(state.visits, a, b), Q = inR(state.quotes, a, b), bk = buckets(a, b);
    var vs = [['Visit only', 'var(--c-visit)'], ['Follow-up', 'var(--c-follow)'], ['Sample', 'var(--c-sample)'], ['Sale', 'var(--c-sale)']];
    var idx = {}; bk.keys.forEach(function (k, i) { idx[k] = i; });
    var ser = vs.map(function (s) { return { name: s[0], color: s[1], values: bk.keys.map(function () { return 0; }) }; });
    V.forEach(function (v) { var i = idx[bk.key(v.date)], k = STATUSES.indexOf(v.status); if (i != null && k >= 0) ser[k].values[i]++; });
    var e1 = $('ch-visits'); if (e1) NHC.stacked(e1, { labels: bk.labels, series: ser, tipTitle: bk.tip, label: 'Visits over time by outcome', fmt: function (v) { return String(v); } });
    var qs = [['Open', 'var(--c-open)'], ['Won', 'var(--c-won)'], ['Lost', 'var(--c-lost)']].map(function (s) { return { name: s[0], color: s[1], values: bk.keys.map(function () { return 0; }) }; });
    Q.forEach(function (q) { var i = idx[bk.key(q.date)], k = ['Open', 'Won', 'Lost'].indexOf(q.status); if (i != null && k >= 0) qs[k].values[i] += q.total; });
    var e2 = $('ch-quotes'); if (e2) NHC.stacked(e2, { labels: bk.labels, series: qs, tipTitle: bk.tip, label: 'Quoted value over time by status', fmt: function (v) { return 'PKR ' + fmt(v); }, axis: NHC.short });
    var segs = ser.map(function (s) { return { name: s.name, color: s.color, value: s.values.reduce(function (x, y) { return x + y; }, 0) }; });
    var e3 = $('ch-donut'); if (e3) NHC.donut(e3, { segments: segs, big: String(V.length), small: 'visits', label: 'Visit outcomes' });
    var dl = $('dl-donut'); if (dl) dl.innerHTML = V.length ? segs.slice().reverse().map(function (s) { return '<div><i style="background:' + s.color + '"></i>' + s.name + '<b>' + s.value + '</b><span class="p">' + Math.round(s.value / V.length * 100) + '%</span></div>'; }).join('') : '';
  }

  /* ---------- daily report ---------- */
  function range() {
    var d = state.date;
    if (state.period === 'day') return [d, d];
    if (state.period === 'week') { var s = weekStart(d); return [s, addDays(s, 6)]; }
    var dd = parse(d); return [ymd(new Date(dd.getFullYear(), dd.getMonth(), 1)), ymd(new Date(dd.getFullYear(), dd.getMonth() + 1, 0))];
  }
  function sorted(list) { return list.slice().sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : (x.created || 0) - (y.created || 0); }); }
  function periodLabel(a, b) {
    if (state.period === 'day') return dLong(a);
    if (state.period === 'week') return dShort(a) + ' – ' + dShort(b) + ' ' + parse(b).getFullYear();
    return parse(a).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  function stats(list) { var c = function (s) { return list.filter(function (v) { return v.status === s; }).length; }; return { total: list.length, sale: c('Sale'), fu: c('Follow-up'), sample: c('Sample'), arch: list.filter(function (v) { return v.architect && v.architect !== 'No'; }).length }; }
  function reportText(list, Q, a, b) {
    var s = stats(list), L = [], qv = Q.reduce(function (t, q) { return t + q.total; }, 0);
    L.push('*Nord Home – Daily Report – ' + periodLabel(a, b) + '*', '');
    L.push('Walk-in visits: ' + s.total + '  |  Sales: ' + s.sale + '  |  Follow-ups: ' + s.fu + '  |  Samples: ' + s.sample);
    L.push('With architect / designer: ' + s.arch);
    L.push('Quotations issued: ' + Q.length + (Q.length ? '  |  Value: PKR ' + fmt(qv) : ''));
    var sp = count(list, function (v) { return spName(spKey(v.salesperson)); });
    if (sp.length) L.push('By salesperson: ' + sp.map(function (x) { return x[0] + ' ' + x[1]; }).join(', '));
    L.push('');
    if (!list.length) L.push('No visits recorded.');
    list.forEach(function (v, i) {
      var line = (i + 1) + '. ' + v.client + (v.location ? ' (' + v.location + ')' : '') + ' – ' + v.status + (v.salesperson ? ' – ' + v.salesperson : '') + (v.reference ? ' – ref: ' + v.reference : '');
      L.push(line); var d = [v.interest, v.remarks].filter(Boolean).join(' | '); if (d) L.push('   ' + d);
    });
    if (Q.length) { L.push('', '*Quotations*'); Q.forEach(function (q) { L.push('• #' + q.no + ' ' + (q.client || '-') + ' – PKR ' + fmt(q.total) + ' – ' + q.status + (q.sales ? ' (' + q.sales + ')' : '')); }); }
    var f = list.filter(function (v) { return v.status === 'Follow-up' || v.status === 'Sample'; });
    if (f.length) { L.push('', '*Follow-ups needed*'); f.forEach(function (v) { L.push('• ' + v.client + ' – ' + (v.remarks || v.interest || v.status) + (v.salesperson ? ' (' + v.salesperson + ')' : '')); }); }
    return L.join('\n');
  }
  function renderReport() {
    var r = range(), list = sorted(inR(state.visits, r[0], r[1])), Q = sorted(inR(state.quotes, r[0], r[1])), s = stats(list), qv = Q.reduce(function (t, q) { return t + q.total; }, 0);
    var h = '<div class="ph"><div><h1>Daily report</h1><p>Review a day, week or month, then copy it for management.</p></div><div class="acts"><button class="btn primary" data-copy>Copy report text</button></div></div>';
    h += '<div class="row" style="margin-bottom:6px"><div class="seg" role="group" aria-label="Period">' + ['day', 'week', 'month'].map(function (p) { return '<button data-period="' + p + '" class="' + (state.period === p ? 'on' : '') + '">' + { day: 'Day', week: 'Week', month: 'Month' }[p] + '</button>'; }).join('') + '</div><button class="btn sm" data-step="-1" aria-label="Previous">‹</button><input class="inp" type="date" id="repdate" value="' + state.date + '"><button class="btn sm" data-step="1" aria-label="Next">›</button><button class="btn sm" data-today>Today</button></div>';
    h += '<h2 style="font-size:19px;font-weight:650;margin:16px 0 0;text-transform:none;letter-spacing:-.01em">' + esc(periodLabel(r[0], r[1])) + '</h2>';
    h += '<div class="kpis k6" style="margin-top:12px"><div class="kpi"><div class="l">Visits</div><div class="n">' + s.total + '</div></div><div class="kpi"><div class="l">Sales</div><div class="n" style="color:var(--good)">' + s.sale + '</div></div><div class="kpi"><div class="l">Follow-ups</div><div class="n">' + s.fu + '</div></div><div class="kpi"><div class="l">Samples</div><div class="n">' + s.sample + '</div></div><div class="kpi"><div class="l">With architect / designer</div><div class="n">' + s.arch + '</div></div><div class="kpi key"><div class="l">Quotations</div><div class="n">' + Q.length + '</div><div class="d">' + (Q.length ? 'PKR ' + fmt(qv) : '') + '</div></div></div>';
    if (!list.length && !Q.length) {
      h += '<div class="card empty">No visits recorded for this ' + state.period + '.' + (NH.canEdit() ? '<br><button class="btn primary" style="margin-top:12px" data-newvisit>Add a visit</button>' : '') + '</div>';
    } else {
      if (list.length) h += visitTable(list, { dates: state.period !== 'day', actions: true });
      var f = list.filter(function (v) { return v.status === 'Follow-up' || v.status === 'Sample'; });
      h += '<div class="grid g21" style="margin-top:14px"><div class="card"><h2>Message to management</h2><pre class="share" id="sharetxt">' + esc(reportText(list, Q, r[0], r[1])) + '</pre><div class="note" style="margin-top:8px">Formatted for WhatsApp or email. Copy it, then paste.</div></div><div class="card"><h2>Follow-ups needed</h2>' + (f.length ? '<ul class="fu">' + f.map(function (v) { return '<li>' + pill(v.status) + '<div><b>' + esc(v.client) + '</b>' + (v.salesperson ? ' <span class="meta">· ' + esc(v.salesperson) + '</span>' : '') + '<div>' + esc(v.remarks || v.interest || '') + '</div></div></li>'; }).join('') + '</ul>' : '<div class="empty">Nothing pending.</div>') + '</div></div>';
    }
    $('v-report').innerHTML = h;
  }

  /* ---------- visits ---------- */
  function visitTable(list, o) {
    o = o || {}; var ed = NH.canEdit();
    var h = '<div class="tw"><table><thead><tr>' + (o.dates ? '<th>Date</th>' : '<th class="r">#</th>') + '<th>Client</th><th>Location</th><th>Reference</th><th>Architect</th><th>Sales person</th><th>Status</th><th>Products / remarks</th>' + (o.actions ? '<th></th>' : '') + '</tr></thead><tbody>';
    list.forEach(function (v, i) {
      h += '<tr>' + (o.dates ? '<td class="num" style="white-space:nowrap">' + esc(dDay(v.date)) + '</td>' : '<td class="r">' + (i + 1) + '</td>') + '<td><b>' + esc(v.client) + '</b>' + (v.phone ? '<div class="mono muted">' + esc(v.phone) + '</div>' : '') + '</td><td>' + esc(v.location) + '</td><td>' + esc(v.reference) + '</td><td>' + esc(v.architect) + (v.dealer ? '<div class="muted">' + esc(v.dealer) + '</div>' : '') + '</td><td>' + esc(v.salesperson) + '</td><td>' + pill(v.status) + '</td><td class="rem">' + (v.interest ? '<div class="mono">' + esc(v.interest) + '</div>' : '') + esc(v.remarks) + '</td>';
      if (o.actions) h += '<td style="white-space:nowrap">' + (ed ? (state.confirmDel === v.id ? '<button class="btn sm danger" data-del="' + v.id + '">Delete?</button> <button class="btn sm" data-cancel-del>No</button>' : '<button class="btn sm" data-quote="' + v.id + '">Quote</button> <button class="btn sm" data-edit="' + v.id + '">Edit</button> <button class="btn sm danger" data-askdel="' + v.id + '" aria-label="Delete visit">✕</button>') : '') + '</td>';
      h += '</tr>';
    });
    return h + '</tbody></table></div>';
  }
  function uniq(k) { return Array.from(new Set(state.visits.map(function (v) { return v[k]; }).filter(Boolean))).sort(); }
  function renderVisits() {
    var f = state.filter, q = f.q.toLowerCase();
    var list = state.visits.filter(function (v) {
      if (f.sp && spKey(v.salesperson) !== f.sp) return false;
      if (f.status && v.status !== f.status) return false;
      if (f.month && v.date.slice(0, 7) !== f.month) return false;
      return !q || [v.client, v.phone, v.location, v.reference, v.remarks, v.interest, v.dealer].join(' ').toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.created || 0) - (a.created || 0); });
    var sps = Array.from(new Set(state.visits.map(function (v) { return spKey(v.salesperson); }).filter(Boolean))).sort(), months = Array.from(new Set(state.visits.map(function (v) { return v.date.slice(0, 7); }))).sort().reverse();
    function o(arr, val, all, lab) { return '<option value="">' + all + '</option>' + arr.map(function (x) { return '<option value="' + esc(x) + '"' + (x === val ? ' selected' : '') + '>' + esc(lab ? lab(x) : x) + '</option>'; }).join(''); }
    var h = '<div class="ph"><div><h1>Visits</h1><p>Every walk-in client, newest first.</p></div><div class="acts"><button class="btn" data-csv>Download Excel (CSV)</button>' + (NH.canEdit() ? '<button class="btn primary" data-newvisit>+ New visit</button>' : '') + '</div></div>';
    if (!state.visits.length) {
      return void ($('v-visits').innerHTML = h + '<div class="card empty"><b>No visits saved yet.</b><br>' + (NH.canEdit() ? 'Load the 176 visits from your Excel sheet, or add your first visit.<div class="row" style="justify-content:center;margin-top:14px"><button class="btn primary" data-seed>Load existing visits</button><button class="btn" data-newvisit>Add a visit</button></div>' : 'Ask an editor to add visits.') + '</div>');
    }
    h += '<div class="row" style="margin-bottom:12px"><input class="inp" id="q" type="search" placeholder="Search name, phone, remarks…" value="' + esc(f.q) + '" style="min-width:220px;flex:1;max-width:320px"><select class="sel" id="fsp">' + o(sps, f.sp, 'All sales persons', spName) + '</select><select class="sel" id="fst">' + o(STATUSES, f.status, 'All statuses') + '</select><select class="sel" id="fmo">' + o(months, f.month, 'All months', function (m) { return parse(m + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }) + '</select><span class="note">' + list.length + ' of ' + state.visits.length + '</span></div>';
    h += list.length ? visitTable(list.slice(0, 300), { dates: true, actions: true }) : '<div class="card empty">No visits match.</div>';
    if (list.length > 300) h += '<div class="note" style="margin-top:8px">Showing the latest 300. Narrow the filters to see others.</div>';
    $('v-visits').innerHTML = h;
  }

  /* visit dialog */
  function openVisit(v) {
    var e = v || null, f = e || { date: state.view === 'report' ? state.date : today(), status: 'Visit only' };
    state.editing = e ? e.id : null;
    function sel(arr, val) { return arr.map(function (x) { return '<option' + (x === val ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join(''); }
    function inp(id, label, val, extra) { return '<label class="field">' + label + '<input id="f-' + id + '" value="' + esc(val || '') + '" ' + (extra || '') + '></label>'; }
    var dl = function (id, k) { return '<datalist id="' + id + '">' + uniq(k).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>'; };
    $('vdlg').innerHTML = '<div class="dh"><h2 id="vdlgT">' + (e ? 'Edit visit' : 'New visit') + '</h2><button type="button" data-closedlg aria-label="Close">×</button></div><div class="db"><form id="vform" autocomplete="off"><div class="form">' +
      '<label class="field">Date<input type="date" id="f-date" required value="' + esc(f.date) + '"></label>' + inp('client', 'Client name *', f.client, 'required') + inp('phone', 'Mobile number', f.phone, 'inputmode="tel"') + inp('location', 'Location / area', f.location, 'list="dl-loc"') + inp('reference', 'Reference (who referred)', f.reference, 'list="dl-ref"') +
      '<label class="field">Architect / designer<select id="f-architect">' + sel(ARCH, f.architect || '') + '</select></label>' + inp('dealer', 'Dealer / firm', f.dealer) + inp('salesperson', 'Sales person', f.salesperson, 'list="dl-sp"') +
      '<label class="field">Status<select id="f-status">' + sel(STATUSES, f.status || 'Visit only') + '</select></label>' +
      '<label class="field full">Products / sheets of interest<input id="f-interest" placeholder="e.g. NH-2112, NH-4601, Striped Cheva" value="' + esc(f.interest || '') + '"></label>' +
      '<label class="field full">Remarks<textarea id="f-remarks" placeholder="Payment received, samples issued, call back date…">' + esc(f.remarks || '') + '</textarea></label></div>' +
      dl('dl-loc', 'location') + dl('dl-ref', 'reference') + dl('dl-sp', 'salesperson') +
      '<div class="row" style="margin-top:16px"><button class="btn primary" type="submit" id="vsave">' + (e ? 'Save changes' : 'Save visit') + '</button><button type="button" class="btn" data-closedlg>Cancel</button><span class="note">Sale = order booked or payment received · Follow-up = needs a call or return visit · Sample = samples issued or returned.</span></div></form></div>';
    $('vdlg').showModal();
    $('f-client').focus();
  }
  NH.openVisit = openVisit;

  function seed() {
    toast('Loading existing visits…');
    fetch('/seed.json').then(function (r) { return r.json(); }).then(function (arr) {
      var chunks = []; for (var i = 0; i < arr.length; i += 100) chunks.push(arr.slice(i, i + 100));
      return chunks.reduce(function (p, c) { return p.then(function () { return api('POST', '/api/visits', c); }); }, Promise.resolve());
    }).then(function () { toast('Existing visits loaded'); return load(); }, function () { toast('Could not load existing visits'); });
  }
  function csvCell(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportCsv() {
    var cols = ['date', 'client', 'phone', 'location', 'reference', 'architect', 'dealer', 'salesperson', 'status', 'interest', 'remarks'];
    var head = ['Date', 'Client Name', 'Mob Number', 'Location', 'Reference', 'Architect', 'Dealer', 'Sales Person', 'Status', 'Products', 'Remarks'];
    var rows = sorted(state.visits).map(function (v) { return cols.map(function (c) { return csvCell(v[c]); }).join(','); });
    var blob = new Blob(['﻿' + head.join(',') + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'nord-home-visits-' + today() + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  }
  function copyText(txt, el) {
    function fb() { if (el) { var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } toast('Text selected. Press Ctrl+C to copy.'); }
    try { navigator.clipboard.writeText(txt).then(function () { toast('Report copied'); }, fb); } catch (x) { fb(); }
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return; var d = t.dataset;
    if (d.range) { state.range = d.range === 'all' ? 'all' : +d.range; renderDashboard(); return; }
    if (t.hasAttribute('data-newvisit')) { openVisit(null); return; }
    if (t.hasAttribute('data-closedlg')) { $('vdlg').close(); return; }
    if (d.period) { state.period = d.period; renderReport(); return; }
    if (d.step !== undefined) { var n = +d.step; state.date = addDays(state.date, state.period === 'day' ? n : state.period === 'week' ? 7 * n : n * 30); if (state.period === 'month') { var dd = parse(state.date); dd.setDate(15); state.date = ymd(dd); } renderReport(); return; }
    if (t.hasAttribute('data-today')) { state.date = today(); renderReport(); return; }
    if (t.hasAttribute('data-copy')) { var el = $('sharetxt'); copyText(el ? el.textContent : '', el); return; }
    if (d.edit) { var v = state.visits.filter(function (x) { return x.id === d.edit; })[0]; if (v) openVisit(v); return; }
    if (d.quote) { var vq = state.visits.filter(function (x) { return x.id === d.quote; })[0]; if (vq && NH.quote) NH.quote.fromVisit(vq); return; }
    if (d.askdel) { state.confirmDel = d.askdel; render(); return; }
    if (t.hasAttribute('data-cancel-del')) { state.confirmDel = null; render(); return; }
    if (d.del) { state.confirmDel = null; api('DELETE', '/api/visits?id=' + encodeURIComponent(d.del)).then(function () { toast('Visit deleted'); load(); }, function (er) { toast(er.status === 403 ? 'Your account is view-only.' : 'Could not delete'); }); return; }
    if (t.hasAttribute('data-csv')) { exportCsv(); return; }
    if (t.hasAttribute('data-seed')) { seed(); return; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'repdate' && t.value) { state.date = t.value; renderReport(); }
    if (t.id === 'fsp') { state.filter.sp = t.value; renderVisits(); }
    if (t.id === 'fst') { state.filter.status = t.value; renderVisits(); }
    if (t.id === 'fmo') { state.filter.month = t.value; renderVisits(); }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'q') { state.filter.q = e.target.value; renderVisits(); var q = $('q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'vform') return;
    e.preventDefault();
    function g(id) { return $('f-' + id).value.trim(); }
    var rec = { date: g('date'), client: g('client'), phone: g('phone'), location: g('location'), reference: g('reference'), architect: g('architect'), dealer: g('dealer'), salesperson: g('salesperson'), status: g('status'), interest: g('interest'), remarks: g('remarks') };
    if (!rec.client || !rec.date) return;
    var btn = $('vsave'); btn.disabled = true;
    var p;
    if (state.editing) { var old = state.visits.filter(function (v) { return v.id === state.editing; })[0]; rec.created = old && old.created || Date.now(); p = api('PUT', '/api/visits?id=' + encodeURIComponent(state.editing), rec); }
    else { rec.created = Date.now(); p = api('POST', '/api/visits', rec); }
    p.then(function () {
      toast(state.editing ? 'Changes saved' : 'Visit saved'); $('vdlg').close();
      if (state.view === 'report') state.date = rec.date;
      state.editing = null; return load();
    }, function (er) { btn.disabled = false; toast(er.status === 403 ? 'Your account is view-only.' : 'Could not save. Check your connection and try again.'); });
  });
  $('vdlg').addEventListener('click', function (e) { if (e.target === $('vdlg')) $('vdlg').close(); });

  if (NH.quote) NH.quote.init();
  boot();
})();
