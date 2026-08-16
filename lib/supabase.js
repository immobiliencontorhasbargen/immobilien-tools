const crypto = require('crypto');

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const config = () => {
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) throw new Error(`Fehlende Supabase-Konfiguration: ${missing.join(', ')}`);
  return { url: process.env.SUPABASE_URL.replace(/\/$/, ''), key: process.env.SUPABASE_SERVICE_ROLE_KEY };
};

async function request(path, options = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(`Supabase-Fehler ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

async function insertRequest(row) {
  return request('unsubscribe_requests', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
}

async function getPendingRequest(tokenHash) {
  const params = new URLSearchParams({
    select: 'id,status,expires_at,address_id,address_name,email_normalized',
    token_hash: `eq.${tokenHash}`,
    status: 'in.(pending,processing)',
    limit: '1'
  });
  const rows = await request(`unsubscribe_requests?${params.toString()}`, { method: 'GET' });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await updateRequest(row.id, { status: 'expired' }).catch(() => {});
    return null;
  }
  if (row.status === 'processing') return null;
  return row;
}

async function updateRequest(id, values) {
  return request(`unsubscribe_requests?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(values)
  });
}

module.exports = { sha256, insertRequest, getPendingRequest, updateRequest };