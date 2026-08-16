const crypto = require('crypto');
const { findAddressByEmail } = require('../lib/onoffice');
const { insertRequest, updateRequest, sha256 } = require('../lib/supabase');
const { sendEmail } = require('../lib/resend');

const json = (res, status, body) => res.status(status).json(body);
const normalizeEmail = value => String(value || '').trim().toLowerCase();
const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const escapeHtml = value => String(value ?? '').replace(/[&<>\"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '\"': '&quot;',
  "'": '&#39;'
}[char]));

function getBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

function logFailure(stage, error, context = {}) {
  console.error('abmeldung-anfordern', JSON.stringify({
    stage,
    message: error && error.message ? error.message : String(error),
    ...context
  }));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { message: 'Methode nicht erlaubt.' });

  const body = getBody(req);
  const email = normalizeEmail(body.email);
  if (!isEmail(email)) return json(res, 400, { message: 'Bitte gib eine gültige E-Mail-Adresse ein.' });

  let requestId = '';
  let stage = 'onoffice-search';

  try {
    const address = await findAddressByEmail(email);

    // Do not reveal whether an address exists. This prevents address enumeration.
    if (!address) {
      return json(res, 200, {
        message: 'Wenn die Adresse bei uns hinterlegt ist, erhältst du gleich eine E-Mail mit dem Bestätigungslink.'
      });
    }

    stage = 'token-storage';
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const firstName = address.firstName || '';
    const addressName = [firstName, address.lastName].filter(Boolean).join(' ');
    const inserted = await insertRequest({
      token_hash: tokenHash,
      email_normalized: email,
      address_id: address.id,
      address_name: addressName,
      status: 'pending',
      expires_at: expiresAt
    });
    requestId = inserted && inserted[0] && inserted[0].id ? String(inserted[0].id) : '';

    stage = 'email-delivery';
    const baseUrl = process.env.PUBLIC_BASE_URL || 'https://tools.immobilien-kaiserbaeder.de';
    const confirmationUrl = `${baseUrl.replace(/\/$/, '')}/abmelden/?token=${encodeURIComponent(token)}`;
    const name = firstName ? ` ${escapeHtml(firstName)}` : '';

    try {
      await sendEmail({
        to: email,
        subject: 'Bitte bestätige deine Abmeldung',
        html: `<!doctype html><html lang="de"><body style="margin:0;background:#EEF0F1;color:#2F343A;font-family:Arial,Helvetica,sans-serif"><div style="max-width:600px;margin:24px auto;background:#fff;border-top:4px solid #C8A35A;padding:36px 30px"><p style="margin:0 0 12px;color:#A47D39;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:bold">immobilien contor hasbargen</p><h1 style="font-size:28px;line-height:1.2;margin:0 0 18px;color:#2F343A">Bitte bestätige deine Abmeldung</h1><p style="font-size:16px;line-height:1.7">Hallo${name},</p><p style="font-size:16px;line-height:1.7">klicke bitte auf den Button, wenn du keine weiteren Immobilienvorschläge von uns erhalten möchtest.</p><p style="margin:28px 0"><a href="${confirmationUrl}" style="display:inline-block;background:#C8A35A;color:#fff;text-decoration:none;padding:14px 20px;border-radius:6px;font-weight:bold">Abmeldung bestätigen</a></p><p style="font-size:13px;line-height:1.6;color:#737A80">Der Link ist 15 Minuten gültig. Wenn du die Abmeldung nicht angefordert hast, kannst du diese E-Mail einfach ignorieren.</p><p style="font-size:14px;line-height:1.6">Herzliche Grüße<br>dein Team vom immobilien contor hasbargen</p></div></body></html>`
      });
    } catch (error) {
      if (requestId) await updateRequest(requestId, { status: 'email_failed' }).catch(updateError => logFailure('email-failed-status', updateError, { requestId }));
      throw error;
    }

    return json(res, 200, { message: 'Bitte prüfe jetzt dein Postfach. Wir haben dir einen Bestätigungslink geschickt.' });
  } catch (error) {
    logFailure(stage, error, { email, requestId });
    if (stage === 'onoffice-search') {
      return json(res, 502, { message: 'Die E-Mail-Adresse konnte gerade nicht geprüft werden. Bitte versuche es später noch einmal.' });
    }
    if (stage === 'token-storage') {
      return json(res, 503, { message: 'Die Abmeldung konnte gerade nicht vorbereitet werden. Bitte versuche es später noch einmal.' });
    }
    return json(res, 502, { message: 'Der Bestätigungslink konnte gerade nicht versendet werden. Bitte versuche es später noch einmal.' });
  }
};
