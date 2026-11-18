// Quotations: list, save (create or replace by quotation number), delete. Table "quotations".
const { sb, guard, listAll } = require('./_lib');

const STATUSES = ['Open', 'Won', 'Lost'];
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };
const str = (v, n) => String(v == null ? '' : v).slice(0, n);

function clean(b) {
  if (!b || typeof b !== 'object') return null;
  const no = str(b.no, 40).trim();
  if (!no || /[\/?#%]/.test(no)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str(b.date, 10))) return null;
  if (!Array.isArray(b.items) || b.items.length > 200) return null;
  const items = b.items.map((i) => ({ t: i.t === 'R' ? 'R' : 'S', p: str(i.p, 300), u: str(i.u, 40), q: str(i.q, 30), l: str(i.l, 30), r: str(i.r, 30) }));
  let total = 0;
  for (const i of items) {
    const v = num(i.q) * (i.r.trim() !== '' ? num(i.r) : num(i.l));
    total += i.t === 'R' ? -v : v;
  }
  total += num(b.freight) - num(b.discount);
  const data = {
    no, date: b.date, client: str(b.client, 200), contact: str(b.contact, 60), sales: str(b.sales, 120), scontact: str(b.scontact, 60),
    items, freight: str(b.freight, 30), discount: str(b.discount, 30), advance: str(b.advance, 30), terms: str(b.terms, 12000),
  };
  return {
    id: no, date: data.date, client: data.client, sales: data.sales, contact: data.contact,
    total: Math.round(total * 100) / 100, status: STATUSES.includes(b.status) ? b.status : 'Open', data, updated: Date.now(),
  };
}

module.exports = async (req, res) => {
  const write = req.method !== 'GET';
  if (!(await guard(req, res, write))) return;
  try {
    if (req.method === 'GET') {
      const rows = await listAll('quotations', 'id,date,client,sales,contact,total,status,data,updated', 'date.desc,updated.desc');
      return res.status(200).json(rows.map((r) => ({ ...r.data, no: r.id, status: r.status, total: Number(r.total), updated: r.updated })));
    }
    if (req.method === 'PUT') {
      const row = clean(req.body);
      if (!row) return res.status(400).json({ error: 'invalid quotation' });
      await sb('quotations?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) });
      return res.status(200).json({ ok: true, no: row.id, total: row.total });
    }
    if (req.method === 'DELETE') {
      const id = req.query && req.query.id ? String(req.query.id).slice(0, 60) : '';
      if (!id) return res.status(400).json({ error: 'id required' });
      await sb('quotations?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, PUT, DELETE');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
};
