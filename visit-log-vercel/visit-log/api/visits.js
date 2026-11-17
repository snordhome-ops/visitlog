// Vercel serverless function: stores visits in Redis (Upstash) as one hash, field = visit id.
// Env vars (added automatically when you connect Upstash Redis from the Vercel Marketplace):
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN   (or KV_REST_API_URL / KV_REST_API_TOKEN)
// You add this one yourself:
//   APP_PASSWORD  - the team password for the app

const crypto = require('crypto');

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const HASH = 'visits';
const FIELDS = ['date', 'client', 'phone', 'location', 'reference', 'architect', 'dealer', 'salesperson', 'status', 'interest', 'remarks'];
const STATUSES = ['Visit only', 'Follow-up', 'Sample', 'Sale'];

async function redis(cmds) {
  const r = await fetch(URL_ + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  const out = await r.json();
  const bad = out.find((x) => x.error);
  if (bad) throw new Error(bad.error);
  return out.map((x) => x.result);
}

function clean(b) {
  const o = {};
  for (const f of FIELDS) o[f] = String(b && b[f] != null ? b[f] : '').trim().slice(0, 2000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date) || !o.client) return null;
  if (!STATUSES.includes(o.status)) o.status = 'Visit only';
  o.created = Number(b.created) > 0 ? Number(b.created) : Date.now();
  return o;
}

function authorized(req) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return true; // no password configured: open (set APP_PASSWORD!)
  const given = String(req.headers['x-app-key'] || '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(pw).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(500).json({ error: 'Database not connected. Add Upstash Redis in Vercel > Storage.' });
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  try {
    const id = req.query && req.query.id ? String(req.query.id).slice(0, 60) : '';
    if (req.method === 'GET') {
      const [flat] = await redis([['HGETALL', HASH]]);
      const list = [];
      for (let i = 0; i < flat.length; i += 2) {
        try { list.push({ ...JSON.parse(flat[i + 1]), id: flat[i] }); } catch (e) { /* skip bad row */ }
      }
      return res.status(200).json(list);
    }
    if (req.method === 'POST') {
      const items = Array.isArray(req.body) ? req.body.slice(0, 500) : [req.body];
      const cmds = [];
      const ids = [];
      for (const it of items) {
        const rec = clean(it);
        if (!rec) continue;
        const nid = 'v' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
        ids.push(nid);
        cmds.push(['HSET', HASH, nid, JSON.stringify(rec)]);
      }
      if (!cmds.length) return res.status(400).json({ error: 'invalid visit' });
      await redis(cmds);
      return res.status(200).json({ ok: true, ids });
    }
    if (req.method === 'PUT') {
      const rec = clean(req.body);
      if (!id || !rec) return res.status(400).json({ error: 'invalid visit' });
      await redis([['HSET', HASH, id, JSON.stringify(rec)]]);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'id required' });
      await redis([['HDEL', HASH, id]]);
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
};
