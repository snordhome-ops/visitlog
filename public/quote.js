/* Quotation maker (A4 sheet, print / PDF, Excel, copy as text) with quotations saved in the database. */
(function () {
  'use strict';
  var NH = window.NH = window.NH || {};
  var $ = function (id) { return document.getElementById(id); };
  var TERMS = "1. TERMS FOR SALE\nPaid invoices will not be cancelled or refunded.\nSale prices are only for the sale period; after that it will not be offered in any case.\nWithout 100% payment in advance, no booking will be done. Verbal commitments are not valid unless full payment is received in the system.\nInstallation Charges are separate. Providing a plumber & electrician facility is the client's responsibility during installation.\nReturn will be acceptable at the price at which the product has been sold. NOT the current product price.\nFlexible pipe for Hood will be charged separately. M.S frames for ISLAND Hoods will be charged separately.\n2. TERMS FOR RETURN AND REFUND\nDamaged/Without packing/Open material return will not be acceptable.\nOut station return will be self-dropped by the client at the warehouse.\nReturn will not be accepted at any showrooms, only at warehouse.\nNot responsible for any damages to Out Station Deliveries.\nRefund amount against return will be paid within 4 working days.\nThe company has a strict policy for No Return / Exchange after the delivery of products.\nPaid Sales Order cannot be refunded or cancelled.\n3. TERMS FOR ORDER DELIVERY\nDelivery will be made within a week for ensuring every item before proceeding the delivery by QA\nGoods will always be delivered on the ground floor of the house / apartment building\nOrder will be reserved/hold for only 60 Days at warehouse after that 1% will be charged on pending invoices\nPlease always sign the Delivery Order after thoroughly checking the products upon delivery. No claim shall be entertained after receiving the DO.\nPlease do not contact technician directly for any Bookings/Complaints/Enquiries. In case of any incident Company will not be responsible\n4. TERMS FOR PAYMENT\nCross Cheques will be made in favor of EL Abrar.\n2% will be charged for Credit/Debit Card Payments.\nTax will not be deducted by the client during payment, as we are a Commercial Importer.";
  function store(k, v) { try { if (v === undefined) { var s = localStorage.getItem('nhq_' + k); return s ? JSON.parse(s) : null; } localStorage.setItem('nhq_' + k, JSON.stringify(v)); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isNaN(n) ? 0 : n; }
  function fmt(n) { return n.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dmy(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + '-' + m[2] + '-' + m[1].slice(2) : (iso || ''); }
  function toast(m) { NH.toast(m); }
  function blankItem() { return { t: 'S', p: '', u: 'Sheet', q: '', l: '', r: '' }; }
  function isRet(i) { return i.t === 'R'; }
  function lineTotal(i) { var v = num(i.q) * (String(i.r).trim() !== '' ? num(i.r) : num(i.l)); return isRet(i) ? -v : v; }
  function saved() { return (NH.state && NH.state.quotes) || []; }

  var defaults = store('defaults') || { sales: 'Mr. Kamran Akbar', scontact: '' };
  var S = null, tab = 'edit', confirmDel = null, filter = { q: '', status: '' };
  var FIELDS = ['no', 'date', 'client', 'contact', 'sales', 'scontact', 'freight', 'discount', 'advance', 'terms'];

  function nextNo() {
    var n = store('lastNo') || 5771;
    saved().forEach(function (q) { var x = parseInt(q.no, 10); if (x && x > n) n = x; });
    return String(n + 1);
  }
  function newQuote() { return { no: nextNo(), date: today(), client: '', contact: '', sales: defaults.sales, scontact: defaults.scontact, items: [blankItem()], freight: '', discount: '', advance: '', terms: TERMS, status: 'Open' }; }
  function totals() {
    var sales = 0, ret = 0; S.items.forEach(function (i) { var v = lineTotal(i); if (v < 0) ret -= v; else sales += v; });
    var total = sales - ret + num(S.freight) - num(S.discount);
    return { sales: sales, ret: ret, sub: sales - ret, total: total, bal: total - num(S.advance) };
  }

  function init() {
    S = store('draft') || newQuote();
    S.items = S.items && S.items.length ? S.items : [blankItem()];
    if (!S.status) S.status = 'Open';
    $('v-quotes').innerHTML =
      '<div class="ph"><div><h1>Quotations</h1><p>Fill in the details. The quotation updates as you type.</p></div><div class="acts">' +
      '<button class="btn" id="bNew">New quotation</button><button class="btn primary" id="bSave">Save</button><button class="btn" id="bCopy">Copy as text</button><button class="btn" id="bPrint">Print / Save PDF</button><button class="btn" id="bXlsx">Download Excel</button></div></div>' +
      '<div class="tabs" id="qtabs"><button data-qt="edit" class="on">Editor</button><button data-qt="list">All quotations <span class="muted" id="qcount"></span></button></div>' +
      '<div class="qapp" id="q-edit"><div class="qcol">' +
      '<section class="card"><h2>Quotation details</h2><div class="g2">' +
      '<label class="field">Quotation / Invoice no.<input id="f_no" inputmode="numeric"></label><label class="field">Date<input id="f_date" type="date"></label>' +
      '<label class="field">Client name<input id="f_client" autocomplete="off"></label><label class="field">Client contact no.<input id="f_contact" inputmode="tel"></label>' +
      '<label class="field">Sales person<input id="f_sales"></label><label class="field">Sales person contact<input id="f_scontact" inputmode="tel"></label>' +
      '<label class="field w">Status<select id="f_status"><option>Open</option><option>Won</option><option>Lost</option></select></label></div></section>' +
      '<section class="card"><h2>Items</h2><div id="items" style="display:flex;flex-direction:column;gap:10px"></div><div style="margin-top:10px"><button class="btn" id="bAdd">+ Add item</button></div>' +
      '<p class="note" style="margin-top:8px">Qty × Rate gives the price. If Rate is empty, Unit Price is used. Choose Return for returned goods: they are deducted from the total, and the quotation shows a refund if the client is owed money.</p>' +
      '<datalist id="dl_p"></datalist><datalist id="dl_u"><option>Sheet</option><option>Pcs</option><option>Set</option><option>Meter</option><option>Roll</option><option>Box</option><option>Delivered</option><option>Return</option></datalist></section>' +
      '<section class="card"><h2>Charges and payments</h2><div class="g2"><label class="field">Freight (PKR)<input id="f_freight" inputmode="decimal"></label><label class="field">Discount (PKR)<input id="f_discount" inputmode="decimal"></label>' +
      '<label class="field w">Advance payment received (PKR)<input id="f_advance" inputmode="decimal"></label></div>' +
      '<div style="margin-top:12px"><div class="sum"><span>Sales subtotal</span><span id="t_sub"></span></div><div class="sum" id="r_ret" hidden><span>Less: returns</span><span id="t_ret"></span></div>' +
      '<div class="sum big"><span>Total amount</span><span id="t_total"></span></div><div class="sum"><span id="t_ballab">Balance payable</span><span id="t_bal"></span></div></div></section>' +
      '<section class="card"><h2>Terms and conditions</h2><textarea id="f_terms" rows="8" class="inp" style="width:100%"></textarea><p class="note" style="margin-top:8px"><button class="btn sm" id="bTermsReset">Restore standard terms</button></p></section>' +
      '</div><div class="prevwrap"><div class="sheet" id="sheet"></div></div></div>' +
      '<div id="q-list" hidden></div>';
    fillForm(); renderItems(); renderSheet(); wire();
  }

  function renderItems() {
    $('items').innerHTML = S.items.map(function (it, k) {
      return '<div class="item" data-k="' + k + '">' +
        '<label class="k">Type<select data-f="t"><option value="S"' + (isRet(it) ? '' : ' selected') + '>Sale</option><option value="R"' + (isRet(it) ? ' selected' : '') + '>Return</option></select></label>' +
        '<label class="p">Product name and model<input data-f="p" list="dl_p" value="' + esc(it.p) + '"></label>' +
        '<label class="u">Unit<input data-f="u" list="dl_u" value="' + esc(it.u) + '"></label>' +
        '<label class="n">Qty<input data-f="q" inputmode="decimal" value="' + esc(it.q) + '"></label>' +
        '<label class="l">Unit price<input data-f="l" inputmode="decimal" value="' + esc(it.l) + '"></label>' +
        '<label class="r">Rate<input data-f="r" inputmode="decimal" value="' + esc(it.r) + '"></label>' +
        '<div class="tot">Price<b data-lt>' + fmt(lineTotal(it)) + '</b></div>' +
        '<button class="btn x" data-del="' + k + '">Remove</button></div>';
    }).join('');
  }

  function renderSheet() {
    var t = totals();
    var rows = S.items.map(function (it, k) {
      var l = String(it.l).trim() !== '' ? fmt(num(it.l)) : '', r = String(it.r).trim() !== '' ? fmt(num(it.r)) : '';
      return '<tr><td>' + (k + 1) + '</td><td class="pn">' + esc(it.p) + (isRet(it) ? ' <b>(RETURN)</b>' : '') + '</td><td>' + esc(it.u) + '</td><td>' + esc(it.q) + '</td><td class="num">' + l + '</td><td class="num">' + r + '</td><td class="num">' + (isRet(it) ? '- ' : '') + fmt(Math.abs(lineTotal(it))) + '</td></tr>';
    }).join('');
    function xr(label, val, cls) { return '<tr class="x ' + (cls || '') + '"><td colspan="6" class="lab">' + label + '</td><td class="val">' + val + '</td></tr>'; }
    var ex = '';
    if (t.ret) ex += xr('Sales Total', fmt(t.sales)) + xr('Less: Returns', '- ' + fmt(t.ret));
    if (num(S.freight)) ex += xr('Freight', fmt(num(S.freight)));
    if (num(S.discount)) ex += xr('Discount', '- ' + fmt(num(S.discount)));
    ex += xr('Total Amount', fmt(t.total), 'tt');
    if (num(S.advance) || t.bal < 0) { ex += xr('Advance Payment', fmt(num(S.advance))); ex += xr(t.bal < 0 ? 'Refund Payable to Client' : 'Balance Payment', fmt(Math.abs(t.bal)), 'tt'); }
    $('sheet').innerHTML =
      '<div class="s-head"><span style="width:130px"></span><h3>Quotation</h3><img src="/logo.png" alt="Nord Home"></div>' +
      '<div class="s-meta"><span>Company Name: Nord Home powered by H-Verse.</span><span>Invoice No. ' + esc(S.no) + '</span>' +
      '<span>Sales Person: ' + esc(S.sales) + (S.scontact ? ' &nbsp;|&nbsp; ' + esc(S.scontact) : '') + '</span><span>Date: ' + esc(dmy(S.date)) + '</span>' +
      '<span>Client Contact No. ' + esc(S.contact) + '</span><span>Client Name: ' + esc(S.client) + '</span></div>' +
      '<table class="s-tbl"><colgroup><col style="width:7%"><col style="width:33%"><col style="width:11%"><col style="width:8%"><col style="width:13%"><col style="width:13%"><col style="width:15%"></colgroup>' +
      '<thead><tr><th>Sr. No</th><th>Product Name and Model</th><th>Unit</th><th>Qty</th><th>Unit Price</th><th>Rate (PKR)</th><th>Price (PKR)</th></tr></thead><tbody>' + rows + ex + '</tbody></table>' +
      '<div class="s-terms-h">TERMS AND CONDITIONS</div><div class="s-terms">' + esc(S.terms) + '</div>' +
      '<div class="s-foot"><b>NORD HOMES</b>LAHORE | ISLAMABAD | KARACHI</div>';
    $('t_sub').textContent = 'PKR ' + fmt(t.sales);
    $('r_ret').hidden = !t.ret; $('t_ret').textContent = '- PKR ' + fmt(t.ret);
    $('t_ballab').textContent = t.bal < 0 ? 'Refund payable to client' : 'Balance payable';
    $('t_total').textContent = 'PKR ' + fmt(t.total);
    $('t_bal').textContent = 'PKR ' + fmt(Math.abs(t.bal));
    fit();
  }

  function fit() {
    var sh = $('sheet'), w = sh.parentNode.clientWidth - 28;
    if (w <= 0) return;
    var z = Math.min(1, w / 794);
    sh.style.width = z < 1 ? '794px' : ''; sh.style.minWidth = z < 1 ? '794px' : ''; sh.style.zoom = z < 1 ? String(Math.max(z, 0.4)) : '';
  }
  window.addEventListener('resize', function () { if (S && !$('q-edit').hidden) fit(); });
  function fileName() { return ('Quotation ' + (S.no || '') + ' - ' + (S.client || 'Client') + ' - ' + dmy(S.date)).replace(/[\\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim(); }
  function persist() { store('draft', S); defaults = { sales: S.sales, scontact: S.scontact }; store('defaults', defaults); }
  function refresh() { renderSheet(); persist(); }
  function fillForm() { FIELDS.forEach(function (k) { $('f_' + k).value = S[k] || ''; }); $('f_status').value = S.status || 'Open'; }
  function products() {
    var prods = {}; saved().concat([S]).forEach(function (q) { (q.items || []).forEach(function (i) { if (i.p) prods[i.p] = 1; }); });
    $('dl_p').innerHTML = Object.keys(prods).map(function (p) { return '<option value="' + esc(p) + '">'; }).join('');
  }
  function perms() { var ed = NH.canEdit(); $('bSave').hidden = !ed; $('bNew').hidden = !ed; }
  function setTab(t) {
    tab = t; $('q-edit').hidden = t !== 'edit'; $('q-list').hidden = t !== 'list';
    document.querySelectorAll('#qtabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-qt') === t); });
    if (t === 'list') renderList();
  }

  function put(q) { return NH.api('PUT', '/api/quotations', q); }
  function saveQ() {
    if (!S.client.trim() && !S.items.some(function (i) { return i.p; })) { toast('Add a client name or an item first'); return; }
    var b = $('bSave'); b.disabled = true;
    put(S).then(function () {
      var n = parseInt(S.no, 10); if (n && n > (store('lastNo') || 0)) store('lastNo', n);
      toast('Saved quotation #' + S.no); return NH.reload();
    }, function (e) { toast(e.status === 403 ? 'Your account is view-only.' : 'Could not save. Check your connection and try again.'); }).then(function () { b.disabled = false; });
  }

  function renderList() {
    var q = filter.q.toLowerCase();
    var list = saved().filter(function (x) { return (!filter.status || x.status === filter.status) && (!q || [x.no, x.client, x.sales, x.contact].join(' ').toLowerCase().indexOf(q) >= 0); })
      .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (parseInt(b.no, 10) || 0) - (parseInt(a.no, 10) || 0); });
    var ed = NH.canEdit(), total = list.reduce(function (s, x) { return s + x.total; }, 0);
    var h = '<div class="row" style="margin-bottom:12px"><input class="inp" id="qsearch" type="search" placeholder="Search number, client, sales person…" value="' + esc(filter.q) + '" style="min-width:220px;flex:1;max-width:320px"><select class="sel" id="qfstatus"><option value="">All statuses</option>' + ['Open', 'Won', 'Lost'].map(function (s) { return '<option' + (filter.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select><span class="note">' + list.length + ' quotations · PKR ' + fmt(total) + '</span></div>';
    if (!saved().length) h += '<div class="card empty"><b>No saved quotations yet.</b><br>Fill in a quotation and press Save. It will appear here for everyone on your team.</div>';
    else if (!list.length) h += '<div class="card empty">No quotations match.</div>';
    else h += '<div class="tw"><table><thead><tr><th>No.</th><th>Date</th><th>Client</th><th>Sales person</th><th class="r">Total (PKR)</th><th>Status</th><th></th></tr></thead><tbody>' + list.map(function (x) {
      return '<tr><td><b>#' + esc(x.no) + '</b></td><td class="num" style="white-space:nowrap">' + esc(dmy(x.date)) + '</td><td>' + esc(x.client || '—') + (x.contact ? '<div class="mono muted">' + esc(x.contact) + '</div>' : '') + '</td><td>' + esc(x.sales) + '</td><td class="r">' + fmt(x.total) + '</td><td>' +
        (ed ? '<select class="sel" data-qstatus="' + esc(x.no) + '" style="padding:4px 8px">' + ['Open', 'Won', 'Lost'].map(function (s) { return '<option' + (x.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' : '<span class="pill p-' + esc(x.status) + '">' + esc(x.status) + '</span>') +
        '</td><td style="white-space:nowrap"><button class="btn sm" data-qopen="' + esc(x.no) + '">Open</button> ' + (ed ? (confirmDel === x.no ? '<button class="btn sm danger" data-qdel="' + esc(x.no) + '">Delete?</button> <button class="btn sm" data-qcancel>No</button>' : '<button class="btn sm danger" data-qask="' + esc(x.no) + '">Delete</button>') : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
    $('q-list').innerHTML = h;
  }

  function wire() {
    FIELDS.forEach(function (k) { $('f_' + k).addEventListener('input', function (e) { S[k] = e.target.value; refresh(); }); });
    $('f_status').addEventListener('change', function (e) { S.status = e.target.value; persist(); });
    $('items').addEventListener('input', function (e) {
      var f = e.target.getAttribute('data-f'); if (!f) return;
      var box = e.target.closest('.item'), it = S.items[+box.getAttribute('data-k')];
      it[f] = e.target.value; box.querySelector('[data-lt]').textContent = fmt(lineTotal(it)); refresh();
    });
    $('items').addEventListener('click', function (e) {
      var d = e.target.getAttribute('data-del'); if (d == null) return;
      S.items.splice(+d, 1); if (!S.items.length) S.items.push(blankItem()); renderItems(); refresh();
    });
    $('bAdd').onclick = function () { S.items.push(blankItem()); renderItems(); refresh(); var ins = $('items').querySelectorAll('.item'); ins[ins.length - 1].querySelector('input').focus(); };
    $('bTermsReset').onclick = function () { S.terms = TERMS; fillForm(); refresh(); };
    $('bSave').onclick = saveQ;
    $('bNew').onclick = function () { S = newQuote(); fillForm(); renderItems(); refresh(); setTab('edit'); toast('New quotation #' + S.no); $('f_client').focus(); };
    $('qtabs').addEventListener('click', function (e) { var t = e.target.closest('button'); if (t) setTab(t.getAttribute('data-qt')); });
    $('q-list').addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return; var d = t.dataset;
      if (d.qopen != null) { var q = saved().filter(function (x) { return x.no === d.qopen; })[0]; if (q) { S = JSON.parse(JSON.stringify(q)); delete S.total; delete S.updated; fillForm(); renderItems(); refresh(); setTab('edit'); window.scrollTo(0, 0); toast('Opened #' + S.no); } }
      if (d.qask != null) { confirmDel = d.qask; renderList(); }
      if (t.hasAttribute('data-qcancel')) { confirmDel = null; renderList(); }
      if (d.qdel != null) { confirmDel = null; NH.api('DELETE', '/api/quotations?id=' + encodeURIComponent(d.qdel)).then(function () { toast('Deleted #' + d.qdel); return NH.reload(); }, function () { toast('Could not delete'); }); }
    });
    $('q-list').addEventListener('change', function (e) {
      var no = e.target.getAttribute('data-qstatus'); if (no == null) return;
      var q = saved().filter(function (x) { return x.no === no; })[0]; if (!q) return;
      var c = JSON.parse(JSON.stringify(q)); c.status = e.target.value;
      put(c).then(function () { toast('#' + no + ' marked ' + c.status); return NH.reload(); }, function () { toast('Could not update status'); });
    });
    $('q-list').addEventListener('input', function (e) {
      if (e.target.id === 'qsearch') { filter.q = e.target.value; renderList(); var s = $('qsearch'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
    });
    $('q-list').addEventListener('change', function (e) { if (e.target.id === 'qfstatus') { filter.status = e.target.value; renderList(); } });
    $('bCopy').onclick = function () {
      var t = totals(), L = ['*Nord Home Quotation*', 'Invoice No. ' + S.no + '  |  Date: ' + dmy(S.date), 'Client: ' + S.client + (S.contact ? ' (' + S.contact + ')' : ''), 'Sales Person: ' + S.sales, ''];
      S.items.forEach(function (it, k) { if (!it.p && !it.q) return; L.push((k + 1) + '. ' + (isRet(it) ? '[RETURN] ' : '') + it.p + ' - ' + it.q + ' ' + it.u + ' x ' + fmt(num(it.r) || num(it.l)) + ' = PKR ' + (isRet(it) ? '-' : '') + fmt(Math.abs(lineTotal(it)))); });
      L.push(''); if (num(S.freight)) L.push('Freight: PKR ' + fmt(num(S.freight))); if (num(S.discount)) L.push('Discount: PKR ' + fmt(num(S.discount)));
      if (t.ret) L.push('Returns deducted: PKR ' + fmt(t.ret)); L.push('*Total: PKR ' + fmt(t.total) + '*'); if (num(S.advance) || t.bal < 0) { L.push('Advance: PKR ' + fmt(num(S.advance))); L.push('*' + (t.bal < 0 ? 'Refund due to client: PKR ' : 'Balance: PKR ') + fmt(Math.abs(t.bal)) + '*'); }
      var txt = L.join('\n');
      function fb() { var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Copied'); } catch (e) { toast('Copy not available'); } ta.remove(); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast('Copied. Paste into WhatsApp or email.'); }, fb); else fb();
    };
    var oldTitle = document.title;
    $('bPrint').onclick = function () { setTab('edit'); oldTitle = document.title; document.title = fileName(); toast('Save the PDF as: ' + fileName()); window.print(); };
    window.addEventListener('afterprint', function () { document.title = oldTitle; });
    $('bXlsx').onclick = function () {
      fetch('/logo.png').then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
        var b = buildXlsx(new Uint8Array(buf)), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fileName() + '.xlsx';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); toast('Excel file downloaded: ' + fileName() + '.xlsx');
      }, function () { toast('Could not create the Excel file'); });
    };
  }

  /* ---- Excel export: minimal .xlsx writer (no libraries, works offline) ---- */
var CRC=(function(){var t=[],c,n,k;for(n=0;n<256;n++){c=n;for(k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(b){var c=0xFFFFFFFF;for(var i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
function u8(s){return new TextEncoder().encode(s)}
function zip(files){
  var parts=[],cen=[],off=0;
  files.forEach(function(f){
    var nm=u8(f.n),d=f.d,crc=crc32(d),h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint16(10,0,true);h.setUint16(12,0x21,true);
    h.setUint32(14,crc,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,nm.length,true);h.setUint16(28,0,true);
    parts.push(new Uint8Array(h.buffer),nm,d);
    var c=new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);c.setUint16(12,0,true);c.setUint16(14,0x21,true);
    c.setUint32(16,crc,true);c.setUint32(20,d.length,true);c.setUint32(24,d.length,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
    cen.push(new Uint8Array(c.buffer),nm);
    off+=30+nm.length+d.length;
  });
  var csz=0;cen.forEach(function(x){csz+=x.length});
  var e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,csz,true);e.setUint32(16,off,true);
  return new Blob(parts.concat(cen,[new Uint8Array(e.buffer)]),{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function xe(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]}).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'')}
function buildXlsx(logoBytes){
  var t=totals(),rows={},heights={},merges=[],r=0;
  function cell(ref,v,st,f){
    var rn=+ref.replace(/\D/g,'');(rows[rn]=rows[rn]||[]).push({ref:ref,v:v,st:st,f:f});
  }
  function blanks(row,cols,st){cols.forEach(function(c){cell(c+row,'',st)})}
  // styles: 1 title,2 meta,3 header,4 center,5 left wrap,6 number,7 label,8 value,9 total label,10 total value,11 terms,12 terms head,13 footer
  r=1;cell('A1','Quotation',1);blanks(1,'BCDEFG'.split(''),1);merges.push('A1:G1');heights[1]=38;
  cell('A2','Company Name: Nord Home powered by H-Verse.',2);blanks(2,['B','C'],2);merges.push('A2:C2');
  cell('D2','Invoice No. '+S.no,2);blanks(2,['E','F','G'],2);merges.push('D2:G2');
  cell('A3','Sales Person: '+S.sales+(S.scontact?'  |  '+S.scontact:''),2);blanks(3,['B','C'],2);merges.push('A3:C3');
  cell('D3','Date: '+dmy(S.date),2);blanks(3,['E','F','G'],2);merges.push('D3:G3');
  cell('A4','Client Contact No. '+S.contact,2);blanks(4,['B','C'],2);merges.push('A4:C4');
  cell('D4','Client Name: '+S.client,2);blanks(4,['E','F','G'],2);merges.push('D4:G4');
  ['Sr. No','Product Name and Model','Unit','Qty','Unit Price','Rate (PKR)','Price (PKR)'].forEach(function(h,i){cell('ABCDEFG'[i]+'6',h,3)});heights[6]=22;
  var first=7,row=first;
  S.items.forEach(function(it,k){
    var hasR=String(it.r).trim()!=='',hasL=String(it.l).trim()!=='';
    cell('A'+row,k+1,4);cell('B'+row,it.p+(isRet(it)?' (RETURN)':''),5);cell('C'+row,it.u,4);cell('D'+row,String(it.q).trim()===''?'':num(it.q),4);
    cell('E'+row,hasL?num(it.l):'',6);cell('F'+row,hasR?num(it.r):'',6);
    cell('G'+row,lineTotal(it),6,(isRet(it)?'-':'')+'D'+row+'*'+(hasR?'F':'E')+row);
    row++;
  });
  var last=row-1,rng='G'+first+':G'+last;
  function lab(text,val,f,big){cell('A'+row,text,big?9:7);blanks(row,['B','C','D','E','F'],big?9:7);merges.push('A'+row+':F'+row);cell('G'+row,val,big?10:8,f);if(big)heights[row]=22;row++}
  if(t.ret){lab('Sales Total',t.sales,'SUMIF('+rng+',">0")');lab('Less: Returns',-t.ret,'SUMIF('+rng+',"<0")')}
  var fRow=null,dRow=null;
  if(num(S.freight)){fRow=row;lab('Freight',num(S.freight))}
  if(num(S.discount)){dRow=row;lab('Discount',-num(S.discount))}
  var tRow=row;
  var tf='SUM('+rng+')'+(fRow?'+G'+fRow:'')+(dRow?'+G'+dRow:'');
  lab('Total Amount',t.total,tf,true);
  if(num(S.advance)||t.bal<0){var aRow=row;lab('Advance Payment',num(S.advance));lab(t.bal<0?'Refund Payable to Client':'Balance Payment',Math.abs(t.bal),(t.bal<0?'-':'')+'(G'+tRow+'-G'+aRow+')',true)}
  row++;
  cell('A'+row,'TERMS AND CONDITIONS',12);blanks(row,['B','C','D','E','F','G'],12);merges.push('A'+row+':G'+row);row++;
  var tl=String(S.terms||'').split('\n'),est=0;tl.forEach(function(x){est+=Math.max(1,Math.ceil(x.length/140))});
  cell('A'+row,S.terms||'',11);blanks(row,['B','C','D','E','F','G'],11);merges.push('A'+row+':G'+row);heights[row]=Math.min(409,est*12+8);row+=2;
  cell('A'+row,'NORD HOMES\nLAHORE | ISLAMABAD | KARACHI',13);blanks(row,['B','C','D','E','F','G'],13);merges.push('A'+row+':G'+row);heights[row]=34;
  var maxRow=row,sd='';
  Object.keys(rows).map(Number).sort(function(a,b){return a-b}).forEach(function(rn){
    sd+='<row r="'+rn+'"'+(heights[rn]?' ht="'+heights[rn]+'" customHeight="1"':'')+'>';
    rows[rn].sort(function(a,b){return a.ref<b.ref?-1:1}).forEach(function(c){
      var a=' r="'+c.ref+'" s="'+c.st+'"';
      if(typeof c.v==='number')sd+='<c'+a+'>'+(c.f?'<f>'+xe(c.f)+'</f>':'')+'<v>'+c.v+'</v></c>';
      else if(c.v==='')sd+='<c'+a+'/>';
      else sd+='<c'+a+' t="inlineStr"><is><t xml:space="preserve">'+xe(c.v)+'</t></is></c>';
    });sd+='</row>';
  });
  var NS='xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',RN='xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',H='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  var sheet=H+'<worksheet '+NS+' '+RN+'><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols><col min="1" max="1" width="7" customWidth="1"/><col min="2" max="2" width="38" customWidth="1"/><col min="3" max="3" width="12" customWidth="1"/><col min="4" max="4" width="8" customWidth="1"/><col min="5" max="6" width="13" customWidth="1"/><col min="7" max="7" width="16" customWidth="1"/></cols><sheetData>'+sd+'</sheetData><mergeCells count="'+merges.length+'">'+merges.map(function(m){return '<mergeCell ref="'+m+'"/>'}).join('')+'</mergeCells><pageMargins left="0.4" right="0.4" top="0.4" bottom="0.4" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/><drawing r:id="rId1"/></worksheet>';
  var bd='<border><left style="thin"><color rgb="FF222222"/></left><right style="thin"><color rgb="FF222222"/></right><top style="thin"><color rgb="FF222222"/></top><bottom style="thin"><color rgb="FF222222"/></bottom><diagonal/></border>';
  function xf(font,fill,border,nf,h,v,wrap){return '<xf numFmtId="'+nf+'" fontId="'+font+'" fillId="'+fill+'" borderId="'+border+'" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="'+h+'" vertical="'+v+'"'+(wrap?' wrapText="1"':'')+'/></xf>'}
  var styles=H+'<styleSheet '+NS+'><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts><fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="16"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><sz val="9"/><name val="Calibri"/></font></fonts>'+
   '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDBE8F6"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE9F0F9"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8E8E8"/></patternFill></fill></fills>'+
   '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>'+bd+'</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="14">'+
   xf(0,0,0,0,'general','bottom')+xf(2,2,1,0,'center','center')+xf(1,3,1,0,'left','center')+xf(1,2,1,0,'center','center',1)+xf(0,0,1,0,'center','center')+xf(0,0,1,0,'left','center',1)+xf(0,0,1,164,'right','center')+
   xf(0,0,0,0,'right','center')+xf(0,0,0,164,'right','center')+xf(3,0,1,0,'right','center')+xf(3,0,1,164,'right','center')+xf(4,0,1,0,'left','top',1)+xf(1,4,1,0,'left','center')+xf(1,4,1,0,'center','center',1)+
   '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  var lb=logoBytes;
  var drawing=H+'<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:oneCellAnchor><xdr:from><xdr:col>4</xdr:col><xdr:colOff>120000</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>60000</xdr:rowOff></xdr:from><xdr:ext cx="2000000" cy="306000"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="2000000" cy="306000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>';
  var RT='http://schemas.openxmlformats.org/officeDocument/2006/relationships/',PR='xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';
  return zip([
   {n:'[Content_Types].xml',d:u8(H+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>')},
   {n:'_rels/.rels',d:u8(H+'<Relationships '+PR+'><Relationship Id="rId1" Type="'+RT+'officeDocument" Target="xl/workbook.xml"/></Relationships>')},
   {n:'xl/workbook.xml',d:u8(H+'<workbook '+NS+' '+RN+'><sheets><sheet name="Quotation" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>')},
   {n:'xl/_rels/workbook.xml.rels',d:u8(H+'<Relationships '+PR+'><Relationship Id="rId1" Type="'+RT+'worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="'+RT+'styles" Target="styles.xml"/></Relationships>')},
   {n:'xl/styles.xml',d:u8(styles)},
   {n:'xl/worksheets/sheet1.xml',d:u8(sheet)},
   {n:'xl/worksheets/_rels/sheet1.xml.rels',d:u8(H+'<Relationships '+PR+'><Relationship Id="rId1" Type="'+RT+'drawing" Target="../drawings/drawing1.xml"/></Relationships>')},
   {n:'xl/drawings/drawing1.xml',d:u8(drawing)},
   {n:'xl/drawings/_rels/drawing1.xml.rels',d:u8(H+'<Relationships '+PR+'><Relationship Id="rId1" Type="'+RT+'image" Target="../media/image1.png"/></Relationships>')},
   {n:'xl/media/image1.png',d:lb}
  ]);
}


  NH.quote = {
    init: init,
    show: function () { perms(); products(); renderSheet(); if (tab === 'list') renderList(); },
    dataChanged: function () { var c = $('qcount'); if (c) c.textContent = saved().length ? '(' + saved().length + ')' : ''; perms(); products(); if (tab === 'list' && NH.state.view === 'quotes') renderList(); },
    fromVisit: function (v) {
      S = newQuote(); S.client = v.client || ''; S.contact = v.phone || ''; if (v.salesperson) S.sales = v.salesperson; if (v.interest) S.items[0].p = v.interest;
      fillForm(); renderItems(); refresh(); setTab('edit'); NH.go('quotes'); toast('New quotation #' + S.no + ' for ' + S.client);
    }
  };
})();
