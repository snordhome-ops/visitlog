// Sign in with a Supabase Auth account (email + password) and refresh sessions.
const { gotrue, configured } = require('./_lib');

function pack(d) {
  const u = d.user || {};
  const role = u.app_metadata && u.app_metadata.role === 'viewer' ? 'viewer' : 'editor';
  return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600), email: u.email || '', role };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!configured()) return res.status(500).json({ error: 'Supabase is not connected. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
  const b = req.body || {};
  try {
    let r;
    if (b.action === 'login') {
      const email = String(b.email || '').trim().slice(0, 200), password = String(b.password || '').slice(0, 200);
      if (!email || !password) return res.status(400).json({ error: 'Enter your email and password.' });
      r = await gotrue('token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (!r.ok) return res.status(401).json({ error: 'Incorrect email or password.' });
    } else if (b.action === 'refresh') {
      r = await gotrue('token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: String(b.refresh_token || '') }) });
      if (!r.ok) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    } else {
      return res.status(400).json({ error: 'bad request' });
    }
    return res.status(200).json(pack(await r.json()));
  } catch (e) {
    return res.status(500).json({ error: 'Could not reach the sign-in service.' });
  }
};
