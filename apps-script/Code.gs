const SHEET_NAME = 'Ledger';
const COLS = ['id','bucket','date','type','payee','amount','serviceMonth','cleared','note','active','updatedAt'];

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return json({ error: 'bad json' }); }

  const expected = PropertiesService.getScriptProperties().getProperty('PASSPHRASE_HASH');
  if (!expected || body.auth !== expected) return json({ error: 'unauthorized' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    switch (body.action) {
      case 'list':   return json({ entries: readAll() });
      case 'create': return json({ entry: create(body.entry) });
      case 'update': return json({ entry: update(body.entry) });
      case 'delete': return json({ entry: setActive(body.id, false) });   // soft delete
      default:       return json({ error: 'unknown action' });
    }
  } catch (err) {
    return json({ error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// GET is intentionally a no-op so hitting the URL in a browser reveals nothing.
function doGet() { return json({ ok: true }); }

function sheet() { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME); }

function readAll() {
  const s = sheet();
  if (s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, COLS.length).getValues()
    .map(rowToEntry)
    .filter(e => e.id);
}

function create(entry) {
  const now = new Date().toISOString();
  const e = normalize({ ...entry, id: Utilities.getUuid(), active: true, updatedAt: now });
  sheet().appendRow(entryToRow(e));
  return e;
}

function update(entry) {
  const row = findRow(entry.id);
  if (!row) throw new Error('not found');
  const e = normalize({ ...entry, updatedAt: new Date().toISOString() });
  sheet().getRange(row, 1, 1, COLS.length).setValues([entryToRow(e)]);
  return e;
}

function setActive(id, active) {
  const row = findRow(id);
  if (!row) throw new Error('not found');
  const current = rowToEntry(sheet().getRange(row, 1, 1, COLS.length).getValues()[0]);
  return update({ ...current, active });
}

function findRow(id) {
  const s = sheet();
  if (s.getLastRow() < 2) return null;
  const ids = s.getRange(2, 1, s.getLastRow() - 1, 1).getValues().flat();
  const idx = ids.indexOf(id);
  return idx === -1 ? null : idx + 2;
}

function normalize(e) {
  return {
    id: String(e.id),
    bucket: e.bucket === 'unrestricted' ? 'unrestricted' : 'restricted',
    date: toDateString(e.date),
    type: e.type === 'deposit' ? 'deposit' : 'payment',
    payee: String(e.payee || '').trim(),
    amount: Math.round(Number(e.amount) * 100) / 100,
    serviceMonth: toMonthString(e.serviceMonth),
    cleared: e.cleared === true || e.cleared === 'TRUE',
    note: String(e.note || ''),
    active: e.active !== false && e.active !== 'FALSE',
    updatedAt: String(e.updatedAt || ''),
  };
}

function rowToEntry(r) { return normalize(Object.fromEntries(COLS.map((c, i) => [c, r[i]]))); }
function entryToRow(e) { return COLS.map(c => e[c]); }

// Sheets may hand back Date objects even for text columns; coerce defensively.
function toDateString(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '').slice(0, 10);
}
function toMonthString(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM');
  return String(v || '').slice(0, 7);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
