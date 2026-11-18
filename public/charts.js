/* Small dependency-free SVG charts: stacked bars and a donut, with hover tooltips. */
(function () {
  'use strict';
  var C = window.NHC = {};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function niceStep(raw) { var p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
  C.short = function (n) {
    var a = Math.abs(n), s = n < 0 ? '-' : '';
    if (a >= 1e9) return s + +(a / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return s + +(a / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return s + +(a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k';
    return s + Math.round(a * 100) / 100;
  };
  function topRound(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
  }
  /* o: {labels[], series:[{name,color,values[]}], fmt(v), tipTitle(i), height} */
  C.stacked = function (el, o) {
    var labels = o.labels, ser = o.series, fmt = o.fmt || String;
    var totals = labels.map(function (_, i) { return ser.reduce(function (a, s) { return a + (s.values[i] || 0); }, 0); });
    var max = Math.max.apply(null, totals.concat([0]));
    if (!max) { el.innerHTML = '<div class="empty">No data in this period.</div>'; return; }
    var w = Math.max(240, el.clientWidth || 600), h = o.height || 240;
    var step = niceStep(max / 4), top = Math.ceil(max / step) * step, ticks = [];
    for (var v = 0; v <= top + 1e-9; v += step) ticks.push(v);
    var ml = Math.max.apply(null, ticks.map(function (t) { return (o.axis || fmt)(t).length; })) * 6.4 + 12, mr = 6, mt = 8, mb = 26;
    var pw = w - ml - mr, ph = h - mt - mb, n = labels.length, band = pw / n, bw = Math.min(band * 0.68, 46);
    var Y = function (v) { return mt + ph - v / top * ph; };
    var out = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(o.label || 'Chart') + '">';
    ticks.forEach(function (t) {
      out += '<line x1="' + ml + '" x2="' + (w - mr) + '" y1="' + Y(t) + '" y2="' + Y(t) + '" class="grid"/><text x="' + (ml - 8) + '" y="' + (Y(t) + 4) + '" text-anchor="end" class="ax">' + esc((o.axis || fmt)(t)) + '</text>';
    });
    var every = Math.max(1, Math.ceil(50 / band));
    labels.forEach(function (lb, i) {
      var cx = ml + band * i + band / 2;
      if (i % every === 0) out += '<text x="' + cx + '" y="' + (h - 8) + '" text-anchor="middle" class="ax">' + esc(lb) + '</text>';
    });
    labels.forEach(function (lb, i) {
      var x = ml + band * i + (band - bw) / 2, acc = 0, tip = [(o.tipTitle ? o.tipTitle(i) : lb)];
      var lastNonZero = -1; ser.forEach(function (s, k) { if (s.values[i]) lastNonZero = k; });
      var segs = '';
      ser.forEach(function (s, k) {
        var v = s.values[i] || 0; if (!v) return;
        tip.push(s.name + ': ' + fmt(v));
        var y1 = Y(acc + v), y0 = Y(acc), hh = y0 - y1 - (acc ? 2 : 0);
        if (hh < 1) hh = 1;
        var yy = y1;
        segs += k === lastNonZero ? '<path d="' + topRound(x, yy, bw, hh, 4) + '" style="fill:' + s.color + '"/>' : '<rect x="' + x + '" y="' + yy + '" width="' + bw + '" height="' + hh + '" style="fill:' + s.color + '"/>';
        acc += v;
      });
      if (ser.length > 1) tip.push('Total: ' + fmt(totals[i]));
      out += '<g class="mark">' + segs + '<rect x="' + (ml + band * i) + '" y="' + mt + '" width="' + band + '" height="' + ph + '" fill="transparent" data-tip="' + esc(tip.join('\n')) + '"/></g>';
    });
    el.innerHTML = out + '</svg>';
  };
  /* o: {segments:[{name,color,value}], big, small} */
  C.donut = function (el, o) {
    var tot = o.segments.reduce(function (a, s) { return a + s.value; }, 0);
    if (!tot) { el.innerHTML = '<div class="empty">No data in this period.</div>'; return; }
    var size = 176, r = 70, sw = 26, c = 2 * Math.PI * r, gap = o.segments.filter(function (s) { return s.value; }).length > 1 ? 3 : 0, acc = 0;
    var out = '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="' + esc(o.label || 'Chart') + '"><g transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')">';
    o.segments.forEach(function (s) {
      if (!s.value) return;
      var len = s.value / tot * c, d = Math.max(len - gap, 1);
      out += '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke-width="' + sw + '" style="stroke:' + s.color + '" stroke-dasharray="' + d + ' ' + (c - d) + '" stroke-dashoffset="' + (-acc) + '" data-tip="' + esc(s.name + ': ' + s.value + ' (' + Math.round(s.value / tot * 100) + '%)') + '"/>';
      acc += len;
    });
    out += '</g><text x="50%" y="48%" text-anchor="middle" class="dbig">' + esc(o.big) + '</text><text x="50%" y="60%" text-anchor="middle" class="dsm">' + esc(o.small) + '</text></svg>';
    el.innerHTML = out;
  };
  /* tooltip: one floating box for every [data-tip] element */
  var tip;
  function show(e) {
    var t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { if (tip) tip.hidden = true; return; }
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; document.body.appendChild(tip); }
    var lines = t.getAttribute('data-tip').split('\n');
    tip.innerHTML = '<b>' + esc(lines[0]) + '</b>' + lines.slice(1).map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('');
    tip.hidden = false;
    var x = e.clientX + 14, y = e.clientY + 14, w = tip.offsetWidth, h = tip.offsetHeight;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
  }
  document.addEventListener('mousemove', show);
  document.addEventListener('click', show);
  document.addEventListener('scroll', function () { if (tip) tip.hidden = true; }, true);
})();
