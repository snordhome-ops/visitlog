// Shared helpers for the API functions (files starting with "_" are not exposed as routes).
const crypto = require('crypto');

const BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AUTH_KEY = process.env.SUPABASE_ANON_KEY || SERVICE_KEY; // key sent to Supabase Auth

function configured() { return !!(BASE && SERVICE_KEY); }

async function sb(path, opts = {}) {
  const r = await fetch(BASE + '/rest/v1/' + path, {
    ...opts,
    headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error('supabase ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function gotrue(path, opts = {}) {
  return fetch(BASE + '/auth/v1/' + path, {
    ...opts,
    headers: { apikey: AUTH_KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
}

const cache = new Map(); // token -> { user, exp }
function roleOf(u) { return (u && u.app_metadata && u.app_metadata.role === 'viewer') ? 'viewer' : 'editor'; }

// Returns { email, role } for a valid Supabase access token, otherwise null.
async function verify(req) {
  const h = String(req.headers.authorization || '');
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  const hit = cache.get(token);
  if (hit && hit.exp > Date.now()) return hit.user;
  const r = await gotrue('user', { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) { cache.delete(token); return null; }
  const u = await r.json();
  const user = { email: u.email || '', role: roleOf(u) };
  if (cache.size > 200) cache.clear();
  cache.set(token, { user, exp: Date.now() + 60000 });
  return user;
}

// Checks sign-in (and edit rights for writes). Sends the error response itself; returns the user or null.
async function guard(req, res, write) {
  res.setHeader('Cache-Control', 'no-store');
  if (!configured()) { res.status(500).json({ error: 'Supabase is not connected. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' }); return null; }
  const user = await verify(req);
  if (!user) { res.status(401).json({ error: 'unauthorized' }); return null; }
  if (write && user.role === 'viewer') { res.status(403).json({ error: 'read-only account' }); return null; }
  return user;
}

async function listAll(table, select, order) {
  const all = [];
  for (let off = 0; ; off += 1000) {
    const page = await sb(table + '?select=' + select + '&order=' + order + '&limit=1000&offset=' + off);
    all.push(...page);
    if (page.length < 1000) break;
  }
  return all;
}

const rid = () => 'v' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
module.exports = { sb, gotrue, guard, listAll, rid, configured };
