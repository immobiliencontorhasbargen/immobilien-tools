const { getPendingRequest, updateRequest } = require('../lib/supabase');
const { disableExposeSending, createUnsubscribeActivity } = require('../lib/onoffice');
const { sendEmail } = require('../lib/resend');
const { sha256 } = require('../lib/supabase');

const json = (res, status, body) => res.status(status).json(body);

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

    const internalRecipient = process.env.RESEND_INTERNAL_NOTIFICATION_EMAIL;
    if (internalRecipient) {
      await sendEmail({
        to: internalRecipient,
        subject: `Abmeldung Immobilienvorschläge: ${request.address_name || request.email_normalized}`,
        html: `<p>Eine Abmeldung wurde über das Käufer-Speed-Dating bestätigt.</p><p><strong>Name:</strong> ${request.address_name || 'unbekannt'}<br><strong>E-Mail:</strong> ${request.email_normalized}<br><strong>onOffice-Adresse:</strong> ${request.address_id}</p><p>Der automatische Exposéversand wurde beendet und die Aktivität in onOffice dokumentiert.</p>`
      });
    }

    return json(res, 200, { message: 'Alles klar – du bist abgemeldet. Wir senden dir künftig keine weiteren Immobilienvorschläge mehr.' });
  } catch (error) {
    console.error('abmeldung-bestaetigen', error);
    return json(res, 500, { message: 'Die Abmeldung konnte gerade nicht abgeschlossen werden. Bitte versuche es später noch einmal.' });
  }
};