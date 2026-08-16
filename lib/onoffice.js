const crypto = require('crypto');

const API_URL = process.env.ONOFFICE_API_URL || 'https://api.onoffice.de/api/stable/api.php';
const ACTION_GET = 'urn:onoffice-de-ns:smart:2.5:smartml:action:get';
const ACTION_MODIFY = 'urn:onoffice-de-ns:smart:2.5:smartml:action:modify';
const ACTION_CREATE = 'urn:onoffice-de-ns:smart:2.5:smartml:action:create';

function config() {
  if (!process.env.ONOFFICE_API_TOKEN || !process.env.ONOFFICE_API_SECRET) {
    throw new Error('Fehlende onOffice-Konfiguration.');
  }
  return { token: process.env.ONOFFICE_API_TOKEN, secret: process.env.ONOFFICE_API_SECRET };
}

function action(resourceType, actionId, resourceId, parameters) {
  const { token, secret } = config();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const hmac = crypto.createHmac('sha256', secret).update(`${timestamp}${token}${resourceType}${actionId}`).digest('base64');
  return {
    actionid: actionId,
    resourceid: resourceId,
    resourcetype: resourceType,
    identifier: '',
    timestamp,
    hmac,
    hmac_version: '2',
    parameters
  };
}

async function call(actions) {
  const { token } = config();
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, request: { actions } })
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`onOffice HTTP-Fehler ${response.status}`);
  const result = body && body.response && body.response.results && body.response.results[0];
  if (!result || (result.status && Number(result.status.errorcode) !== 0)) {
    throw new Error(`onOffice-Fehler: ${result && result.status ? result.status.message : 'Unbekannte Antwort'}`);
  }
  return result;
}

function normalize(value) { return String(value || '').trim().toLowerCase(); }
function extractRecords(result) { return result && result.data && Array.isArray(result.data.records) ? result.data.records : []; }

async function findAddressByEmail(email) {
  const result = await call([action('search', ACTION_GET, 'address', {
    input: email,
    includecontactdata: false,
    listlimit: 20
  })]);
  const exact = extractRecords(result).filter(record => {
    const elements = record.elements || {};
    const candidates = [elements.primaryEmail, ...(Array.isArray(elements.emailaddress) ? elements.emailaddress : [])];
    return candidates.some(candidate => normalize(candidate) === normalize(email));
  });
  if (exact.length !== 1) return null;
  const record = exact[0];
  const elements = record.elements || {};
  return {
    id: Number(record.id),
    firstName: elements.firstname || '',
    lastName: elements.surname || '',
    email: elements.primaryEmail || email
  };
}

async function disableExposeSending(addressId) {
  await call([action('address', ACTION_MODIFY, Number(addressId), { autoExposeVersand: false })]);
}

async function createUnsubscribeActivity(addressId, email) {
  const parameters = {
    datetime: new Date().toISOString().slice(0, 19).replace('T', ' '),
    addressids: [Number(addressId)],
    actionkind: 'Email',
    actiontype: 'Eingang',
    note: `Abmeldung vom automatischen Immobilienvorschlagversand über Käufer-Speed-Dating bestätigt. E-Mail: ${email}`
  };
  if (process.env.ONOFFICE_USER_ID) parameters.userid = Number(process.env.ONOFFICE_USER_ID);
  await call([action('agentslog', ACTION_CREATE, '', parameters)]);
}

module.exports = { findAddressByEmail, disableExposeSending, createUnsubscribeActivity };