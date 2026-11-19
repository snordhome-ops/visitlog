// Visits: list, add (one or many), edit, delete. Stored in the Supabase table "visits".
const { sb, guard, listAll, rid } = require('./_lib');

const FIELDS = ['date', 'client', 'phone', 'location', 'reference', 'architect', 'dealer', 'salesperson', 'status', 'interest', 'remarks'];

function clean(b) {
  const o = {};
  for (const f of FIELDS) o[f] = String((b && b[f]) != null ? b[f] : '').trim().slice(0, 2000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date) || !o.client) return null;
  o.status = o.status.slice(0, 60) || 'Visit only'; // the list of statuses lives in public/statuses.js
  o.created = Number(b.created) > 0 ? Math.floor(Number(b.created)) : Date.now();
  return o;
}

module.exports = async (req, res) => {
  const write = req.method !== 'GET';
  if (!(await guard(req, res, write))) return;
  try {
    const id = req.query && req.query.id ? String(req.query.id).slice(0, 60) : '';
    if (req.method === 'GET') return res.status(200).json(await listAll('visits', '*', 'date.asc,created.asc'));
    if (req.method === 'POST') {
      const items = Array.isArray(req.body) ? req.body.slice(0, 500) : [req.body];
      const rows = [];
      for (const it of items) { const rec = clean(it); if (rec) rows.push({ id: rid(), ...rec }); }
      if (!rows.length) return res.status(400).json({ error: 'invalid visit' });
      await sb('visits', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
      return res.status(200).json({ ok: true, ids: rows.map((r) => r.id) });
    }
    if (req.method === 'PUT') {
      const rec = clean(req.body);
      if (!id || !rec) return res.status(400).json({ error: 'invalid visit' });
      await sb('visits?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rec) });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'id required' });
      await sb('visits?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
};
