const { sendEmail } = require('../lib/resend');

const json = (res, status, body) => res.status(status).json(body);
const escapeHtml = value => String(value ?? '').replace(/[&<>\"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char]));
const text = value => String(value ?? '').trim();
const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const labels = {
  object: 'Immobilienart', places: 'Region', maxPrice: 'Kaufpreis', minArea: 'Wohnfläche',
  minRooms: 'Zimmer', bedrooms: 'Schlafzimmer', outside: 'Außenfläche', buildingType: 'Bauart',
  use: 'Nutzung', atmosphere: 'Lebensgefühl', view: 'Ausblick', comfort: 'Komfort',
  condition: 'Veränderungsbereitschaft', musts: 'Wichtige Eigenschaften'
};

function valueToText(value) {
  if (Array.isArray(value)) return value.map(valueToText).filter(Boolean).join(', ');
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([key, item]) => `${labels[key] || key}: ${valueToText(item)}`).filter(Boolean).join(' · ');
  }
  return text(value);
}

function answerRows(answers, personKey) {
  const person = answers && answers[personKey] ? answers[personKey] : {};
  return Object.entries(person).map(([key, value]) => {
    const label = labels[key] || key;
    const answer = valueToText(value) || 'keine Angabe';
    return { label, answer };
  });
}

function renderRows(rows) {
  if (!rows.length) return '<p style="margin:0;color:#737A80">Noch keine Angaben.</p>';
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows.map(row => `<tr><td style="padding:7px 0;border-bottom:1px solid #E5E7E8;width:42%;vertical-align:top;font-size:13px;color:#737A80">${escapeHtml(row.label)}</td><td style="padding:7px 0;border-bottom:1px solid #E5E7E8;vertical-align:top;font-size:13px;color:#2F343A;font-weight:600">${escapeHtml(row.answer)}</td></tr>`).join('')}</table>`;
}

function renderSection(title, rows) {
  return `<h3 style="margin:26px 0 8px;color:#A47D39;font-size:13px;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(title)}</h3>${renderRows(rows)}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { message: 'Methode nicht erlaubt.' });

  const body = req.body || {};
  const name = text(body.name);
  const email = text(body.email).toLowerCase();
  const phone = text(body.phone);
  const note = text(body.note);
  const mode = body.mode === 'couple' ? 'zu zweit' : 'allein';
  const person1 = text(body.person1);
  const person2 = text(body.person2);
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};

  if (!name || !isEmail(email)) return json(res, 400, { message: 'Bitte prüfe Name und E-Mail-Adresse.' });

  const internalRecipient = process.env.PROFILE_INTERNAL_EMAIL || 'anfragen@immobilien-kaiserbaeder.de';
  const personRows = answerRows(answers, 'person_1');
  const secondRows = answerRows(answers, 'person_2');
  const customerName = name.split(/\s+/)[0] || name;
  const profileSummary = `${renderSection('Dein Suchprofil', personRows)}${mode === 'zu zweit' ? renderSection('Vorstellungen der zweiten Person', secondRows) : ''}`;
  const contactSummary = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:6px 0;color:#737A80;font-size:13px;width:35%">Name</td><td style="padding:6px 0;color:#2F343A;font-size:13px;font-weight:600">${escapeHtml(name)}</td></tr><tr><td style="padding:6px 0;color:#737A80;font-size:13px">E-Mail</td><td style="padding:6px 0;color:#2F343A;font-size:13px;font-weight:600">${escapeHtml(email)}</td></tr><tr><td style="padding:6px 0;color:#737A80;font-size:13px">Telefon</td><td style="padding:6px 0;color:#2F343A;font-size:13px;font-weight:600">${escapeHtml(phone || 'nicht angegeben')}</td></tr><tr><td style="padding:6px 0;color:#737A80;font-size:13px">Teilnahme</td><td style="padding:6px 0;color:#2F343A;font-size:13px;font-weight:600">${escapeHtml(mode)}</td></tr></table>`;

  const customerHtml = `<!doctype html><html lang="de"><body style="margin:0;background:#EEF0F1;color:#2F343A;font-family:Arial,Helvetica,sans-serif"><div style="max-width:620px;margin:24px auto;background:#fff;border-top:4px solid #C8A35A;padding:34px 30px"><p style="margin:0 0 12px;color:#A47D39;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:bold">immobilien contor hasbargen</p><h1 style="font-size:28px;line-height:1.2;margin:0 0 18px;color:#2F343A">Schön, dein Suchprofil ist angekommen.</h1><p style="font-size:16px;line-height:1.7">Hallo ${escapeHtml(customerName)},</p><p style="font-size:16px;line-height:1.7">vielen Dank, dass du dir die Zeit für unser Käufer-Speed-Dating genommen hast. Wir haben eure Vorstellungen erhalten und kümmern uns jetzt darum, passende Immobilien für euch zu finden.</p><div style="margin:24px 0;padding:20px;background:#F5F6F6;border-left:4px solid #C8A35A"><p style="margin:0 0 12px;font-size:14px;font-weight:bold;color:#2F343A">Deine Angaben im Überblick</p>${contactSummary}</div>${profileSummary}<p style="margin:26px 0 0;font-size:15px;line-height:1.7;color:#596067">Wenn sich bei euren Wünschen noch etwas ändert oder euch etwas besonders wichtig ist, antwortet einfach auf diese E-Mail. Je genauer wir euch kennen, desto besser können wir für euch suchen.</p><p style="font-size:15px;line-height:1.7">Herzliche Grüße<br><strong>dein Team vom immobilien contor hasbargen</strong></p></div></body></html>`;
  const internalHtml = `<!doctype html><html lang="de"><body style="margin:0;background:#EEF0F1;color:#2F343A;font-family:Arial,Helvetica,sans-serif"><div style="max-width:720px;margin:24px auto;background:#fff;border-top:4px solid #C8A35A;padding:30px"><p style="margin:0 0 10px;color:#A47D39;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:bold">Käufer-Speed-Dating</p><h1 style="font-size:26px;line-height:1.2;margin:0 0 20px">Neues Suchprofil von ${escapeHtml(name)}</h1><div style="padding:18px;background:#F5F6F6;border-left:4px solid #C8A35A">${contactSummary}${note ? `<p style="margin:16px 0 0;font-size:13px;color:#596067"><strong>Nachricht:</strong> ${escapeHtml(note)}</p>` : ''}</div>${profileSummary}<p style="margin:26px 0 0;font-size:13px;color:#737A80">Bitte Kontakt aufnehmen und die weitere Immobiliensuche unterstützen.</p></div></body></html>`;

  try {
    await Promise.all([
      sendEmail({ to: email, subject: 'Dein Suchprofil ist angekommen – jetzt suchen wir für dich', html: customerHtml }),
      sendEmail({ to: internalRecipient, subject: `Käufer-Speed-Dating – neues Suchprofil von ${name}`, html: internalHtml, replyTo: email })
    ]);
    return json(res, 200, { message: 'Schön – dein Suchprofil ist bei uns angekommen. Wir kümmern uns jetzt darum und haben dir eine Bestätigung geschickt.' });
  } catch (error) {
    console.error('suchprofil-senden', error);
    return json(res, 500, { message: 'Das Profil konnte gerade nicht vollständig versendet werden. Bitte versuche es noch einmal.' });
  }
};