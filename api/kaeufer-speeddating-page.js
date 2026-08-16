const json = (res, status, body) => res.status(status).json(body);

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { message: 'Methode nicht erlaubt.' });

  const forwardedProto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || 'tools.immobilien-kaiserbaeder.de';
  const baseUrl = process.env.PUBLIC_BASE_URL || `${forwardedProto}://${host}`;
  const sourceUrl = `${baseUrl.replace(/\/$/, '')}/kaeufer-speeddating/index.html`;

  try {
    const sourceResponse = await fetch(sourceUrl);
    if (!sourceResponse.ok) throw new Error(`Speed-Dating-Datei konnte nicht geladen werden (${sourceResponse.status}).`);
    let html = await sourceResponse.text();

    const startMarker = "const mailto='mailto:anfragen@immobilien-kaiserbaeder.de?bcc='";
    const endMarker = "st.textContent='Die Mail-App wurde geöffnet. Bitte prüfe die Mail und tippe noch auf „Senden“.'";
    const start = html.indexOf(startMarker);
    const endStart = start >= 0 ? html.indexOf(endMarker, start) : -1;
    if (start < 0 || endStart < 0) throw new Error('Der bestehende Profilversand wurde nicht gefunden.');
    const end = endStart + endMarker.length;

    const replacement = "const payload={name,email,phone:$('#phone').value.trim(),note:$('#note').value.trim(),mode,person1:$('#p1').value.trim(),person2:$('#p2').value.trim(),answers};st.textContent='Profil wird gesendet …';fetch('/api/suchprofil-senden',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Das Profil konnte gerade nicht gesendet werden.');st.style.color='var(--ok)';st.textContent=data.message||'Danke – dein Suchprofil ist bei uns angekommen.'}).catch(error=>{st.style.color='var(--bad)';st.textContent=error.message||'Das Profil konnte gerade nicht gesendet werden.'})";
    html = html.slice(0, start) + replacement + html.slice(end);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (error) {
    console.error('kaeufer-speeddating-page', error);
    return json(res, 500, { message: 'Die Speed-Dating-Seite konnte gerade nicht geladen werden.' });
  }
};