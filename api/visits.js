// Vercel serverless function: stores visits in a Supabase table named "visits".
// Environment variables (Vercel > Settings > Environment Variables):
//   SUPABASE_URL                e.g. https://abcdxyz.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   Supabase > Project Settings > API > service_role (keep secret)
//   APP_PASSWORD                the team password for the app

const crypto = require('crypto');

const BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FIELDS = ['date', 'client', 'phone', 'location', 'reference', 'architect', 'dealer', 'salesperson', 'status', 'interest', 'remarks'];
const STATUSES = ['Visit only', 'Follow-up', 'Sample', 'Sale'];

async function sb(path, opts = {}) {
  const r = await fetch(BASE + '/rest/v1/' + path, {
    ...opts,
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error('supabase ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

function clean(b) {
  const o = {};
  for (const f of FIELDS) o[f] = String((b && b[f]) != null ? b[f] : '').trim().slice(0, 2000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date) || !o.client) return null;
  if (!STATUSES.includes(o.status)) o.status = 'Visit only';
  o.created = Number(b.created) > 0 ? Math.floor(Number(b.created)) : Date.now();
  return o;
}

function authorized(req) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return true; // no password configured: open (set APP_PASSWORD!)
  const a = crypto.createHash('sha256').update(String(req.headers['x-app-key'] || '')).digest();
  const b = crypto.createHash('sha256').update(pw).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!BASE || !KEY) return res.status(500).json({ error: 'Supabase is not connected. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  try {
    const id = req.query && req.query.id ? String(req.query.id).slice(0, 60) : '';
    if (req.method === 'GET') {
      const all = [];
      for (let off = 0; ; off += 1000) {
        const page = await sb('visits?select=*&order=date.asc,created.asc&limit=1000&offset=' + off);
        all.push(...page);
        if (page.length < 1000) break;
      }
      return res.status(200).json(all);
    }
    if (req.method === 'POST') {
      const items = Array.isArray(req.body) ? req.body.slice(0, 500) : [req.body];
      const rows = [];
      for (const it of items) {
        const rec = clean(it);
        if (rec) rows.push({ id: 'v' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'), ...rec });
      }
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
