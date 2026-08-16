const { getPendingRequest, updateRequest, sha256 } = require('../lib/supabase');
const { disableExposeSending, createUnsubscribeActivity } = require('../lib/onoffice');
const { sendEmail } = require('../lib/resend');

const json = (res, status, body) => res.status(status).json(body);
const escapeHtml = value => String(value ?? '').replace(/[&<>\"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char]));

module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return json(res, 405, { message: 'Methode nicht erlaubt.' });
  const token = String((req.query && req.query.token) || (req.body && req.body.token) || '').trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) return json(res, 400, { message: 'Der Bestätigungslink ist nicht gültig.' });

  try {
    const request = await getPendingRequest(sha256(token));
    if (!request) return json(res, 410, { message: 'Der Bestätigungslink ist abgelaufen oder wurde bereits verwendet.' });

    await updateRequest(request.id, { status: 'processing' });
    try {
      await disableExposeSending(request.address_id);
      await createUnsubscribeActivity(request.address_id, request.email_normalized);
      await updateRequest(request.id, { status: 'confirmed', confirmed_at: new Date().toISOString() });
    } catch (error) {
      await updateRequest(request.id, { status: 'pending' }).catch(() => {});
      throw error;
    }

    const internalRecipient = process.env.RESEND_INTERNAL_NOTIFICATION_EMAIL || 'anfragen@immobilien-kaiserbaeder.de';
    const displayName = request.address_name || 'Kontakt';
    const internalHtml = `<div style="font-family:Arial,Helvetica,sans-serif;color:#2F343A"><p style="color:#A47D39;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Käufer-Speed-Dating</p><h2>Abmeldung bestätigt</h2><p><strong>Name:</strong> ${escapeHtml(displayName)}<br><strong>E-Mail:</strong> ${escapeHtml(request.email_normalized)}<br><strong>onOffice-Adresse:</strong> ${escapeHtml(request.address_id)}</p><p>Der automatische Immobilienvorschlagversand wurde beendet und die Abmeldung in onOffice dokumentiert.</p></div>`;
    const customerHtml = `<!doctype html><html lang="de"><body style="margin:0;background:#EEF0F1;color:#2F343A;font-family:Arial,Helvetica,sans-serif"><div style="max-width:600px;margin:24px auto;background:#fff;border-top:4px solid #C8A35A;padding:36px 30px"><p style="margin:0 0 12px;color:#A47D39;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:bold">immobilien contor hasbargen</p><h1 style="font-size:28px;line-height:1.2;margin:0 0 18px;color:#2F343A">Alles klar – deine Abmeldung ist bestätigt.</h1><p style="font-size:16px;line-height:1.7">Hallo ${escapeHtml(displayName.split(/\s+/)[0] || '')},</p><p style="font-size:16px;line-height:1.7">wir haben deine Abmeldung erhalten und senden dir künftig keine weiteren Immobilienvorschläge mehr.</p><p style="font-size:15px;line-height:1.7;color:#596067">Falls du später wieder auf die Suche gehen möchtest, sind wir natürlich gerne für dich da. Eine kurze Nachricht genügt.</p><p style="font-size:15px;line-height:1.7">Herzliche Grüße<br><strong>dein Team vom immobilien contor hasbargen</strong></p></div></body></html>`;

    const deliveries = await Promise.allSettled([
      sendEmail({ to: internalRecipient, subject: `Käufer-Speed-Dating – Abmeldung von ${displayName}`, html: internalHtml, replyTo: request.email_normalized }),
      sendEmail({ to: request.email_normalized, subject: 'Deine Abmeldung ist bestätigt', html: customerHtml })
    ]);
    deliveries.filter(result => result.status === 'rejected').forEach(result => console.error('Abmeldebestätigung-Mail', result.reason));

    return json(res, 200, { message: 'Alles klar – du bist abgemeldet. Wir senden dir künftig keine weiteren Immobilienvorschläge mehr.' });
  } catch (error) {
    console.error('abmeldung-bestaetigen', error);
    return json(res, 500, { message: 'Die Abmeldung konnte gerade nicht abgeschlossen werden. Bitte versuche es später noch einmal.' });
  }
};