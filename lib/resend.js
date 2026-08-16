async function sendEmail({ to, subject, html, replyTo }) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new Error('Fehlende Resend-Konfiguration.');
  }
  const payload = { from: process.env.RESEND_FROM_EMAIL, to: [to], subject, html };
  if (replyTo) payload.reply_to = replyTo;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Resend-Fehler ${response.status}: ${body && body.message ? body.message : 'Unbekannte Antwort'}`);
  return body;
}

module.exports = { sendEmail };