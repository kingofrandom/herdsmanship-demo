/**
 * Herdsmanship PWA — Google Sheet backend
 * --------------------------------------------------------------
 * Paste this entire file into the Apps Script editor attached to
 * a Google Sheet in your Drive, then Deploy → New deployment →
 * "Web app" → Execute as: ME, Who has access: ANYONE.
 * Copy the Web App URL into the PWA's Setup → Cloud Sync field.
 *
 * The script auto-creates these tabs on first call:
 *   Clubs, Barns, Stalls, Barn Layout, Judges, Rubric, Species, Settings, Scores, Schedule
 * Edit Clubs/Barns/Stalls/Barn Layout/Judges/Rubric/Species on your laptop; PWA pulls on launch.
 */

const TABS = {
  CLUBS:    'Clubs',
  BARNS:    'Barns',
  STALLS:   'Stalls',
  BARN_LAYOUT: 'Barn Layout',
  JUDGES:   'Judges',
  RUBRIC:   'Rubric',
  SPECIES:  'Species',
  SETTINGS: 'Settings',
  SCORES:   'Scores',
  SCHEDULE: 'Schedule',
};

const META = {
  DATASET_ID: 'HSM_DATASET_ID',
  SCORE_GENERATION: 'HSM_SCORE_GENERATION',
  INITIAL_BOUNDARY: 'HSM_INITIAL_BOUNDARY',
  RESET_PENDING_ID: 'HSM_RESET_PENDING_ID',
  LAST_RESET_ID: 'HSM_LAST_RESET_ID',
};
const ID_RE = /^[a-z0-9_-]{1,50}$/;
const PASS_RE = /^d[1-4](am|pm)$/;

// ---------- HTTP entry points ----------
function doGet(e) {
  ensureSheets_();
  const action = (e && e.parameter && e.parameter.action) || 'config';
  if (action === 'config') return json_({ok:true, config: readConfig_()});
  if (action === 'state') return json_({ok:true, state:readState_()});
  if (action === 'scores') {
    const state = readState_();
    return json_({ok:true, scores:state.scores, datasetId:state.datasetId, generation:state.generation});
  }
  return json_({ok:false, error:'unknown_action'});
}

function doPost(e) {
  ensureSheets_();
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); }
  catch(err) { return json_({ok:false, error:'bad_json'}); }

  const action = body.action || '';
  if (action === 'snapshot' || action === 'updateSchedule') {
    return json_({ok:false, error:'client_upgrade_required'});
  }
  if (action === 'upsertScore') return json_(upsertScore_(body));
  if (action === 'upsertSchedule') return json_(upsertSchedule_(body));
  return json_({ok:false, error:'unknown_action'});
}

// Destructive shared resets are available only to a Sheet owner/editor through
// this menu. They are intentionally not exposed by doPost().
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Herdsmanship Admin')
    .addItem('Clear all scores…', 'resetAllScores').addToUi();
}

function resetAllScores() {
  ensureSheets_();
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert('Clear every Herdsmanship score?',
    'This resets shared scores for every judge. The schedule is preserved.',
    ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return {ok:false, cancelled:true};
  const result = resetAllScores_();
  ui.alert(`Cleared ${result.cleared} score row${result.cleared===1?'':'s'}.`);
  return result;
}

// ---------- Sheet bootstrap ----------
function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const seed = (name, headers, rows) => {
    let sh = ss.getSheetByName(name);
    if (sh) return sh;
    sh = ss.insertSheet(name);
    sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold').setBackground('#e6f2ea');
    if (rows && rows.length) sh.getRange(2,1,rows.length,headers.length).setValues(rows);
    sh.setFrozenRows(1);
    return sh;
  };

  seed(TABS.CLUBS, ['ID','Name','Leaders','Species (comma sep)','Notes'], [
    ['anthon',   'Anthon Advancers',         'Tim Hoy & Tyler H…',          'beef,sheep,swine,goat', ''],
    ['arlington','Arlington Future Farmers', 'Ashley McC…',                  'beef,swine,dairy,llama', ''],
    ['banner',   'Banner Boosters',          'Melissa Hoogendyk',            'sheep,goat,rabbit', ''],
    ['bgh',      'Boys & Girls Home',        'Christine Craig',              'rabbit,poultry', ''],
    ['bronson',  'Bronson Rustlers',         'Dee McKenna & Liz…',           'beef,sheep,swine,dairy,goat,horse', ''],
    ['bryant',   'Bryant 4-H Club',          'Christine Craig & Kay…',       'beef,swine,poultry', ''],
    ['goodluck', 'Good Luck Clovers',        'Cheryl Zobel & Ta…',           'sheep,goat,rabbit,poultry', ''],
    ['grant',    'Grant-Go-Getters',         'Jennifer Ankerstjer…',         'beef,swine', ''],
    ['loess',    'Loess Hills 4-H Club',     'Christine Craig & …',          'horse,goat', ''],
    ['lucky',    'Lucky Lassies & Lads',     'Kari Nelson & …',              'beef,sheep,horse', ''],
    ['pierson',  'Pierson 4-H Club',         'Lonnie Ploeger & L…',          'beef,sheep,swine,poultry', ''],
    ['pioneer',  'Pioneer Valley',           'Amiee Krogh',                  'dairy,goat', ''],
    ['rockbr',   'Rock Branch Producers',    'Karen Havli…',                 'beef,swine', ''],
    ['rockkee',  'Rock-Kee-Union',           'Nicole Huisinga, As…',         'sheep,swine,goat', ''],
    ['sunday',   'Sunday Funday',            'Christine Craig',              'rabbit,poultry', ''],
    ['willow',   'Willow Workers',           'Jamie Johnson & Ni…',          'beef,dairy,goat,horse,poultry,llama', ''],
    ['innov',    'Woodbury Innovators',      'Adrienne Dun…',                'swine,rabbit', ''],
    ['bronsonck','Bronson Rustlers Clover Kids','Dee M…',                    'rabbit,poultry', 'Clover Kids — non-competing']
  ]);

  seed(TABS.BARNS, ['Barn ID','Name','Species (comma sep)','Area / Building','Sort Order','Notes'], [
    ['beef-north','North Beef Barn','beef,dairy','North barn',10,'Main beef and dairy stalling'],
    ['sheep','Sheep Barn','sheep,goat','Small animal barn',20,'Sheep and goat pens'],
    ['swine','Swine Barn','swine','East barn',30,'Swine pens'],
    ['horse','Horse Barn','horse','Horse barn',40,'Horse stalls'],
    ['small-animal','Rabbit & Poultry Barn','rabbit,poultry','Small animal barn',50,'Rabbit and poultry cages']
  ]);

  seed(TABS.STALLS, ['Barn ID','Stall ID','Species','Label','Status','Notes'], [
    ['beef-north','A1','beef','A1','open','West aisle'],
    ['beef-north','A2','beef','A2','open','West aisle'],
    ['beef-north','A3','beef','A3','open','West aisle'],
    ['beef-north','A4','beef','A4','open','West aisle'],
    ['beef-north','B1','beef','B1','open','Center aisle'],
    ['beef-north','B2','beef','B2','open','Center aisle'],
    ['sheep','S1','sheep','S1','open','North wall'],
    ['sheep','S2','sheep','S2','open','North wall'],
    ['sheep','S3','sheep','S3','open','North wall'],
    ['swine','P1','swine','P1','open','West row'],
    ['swine','P2','swine','P2','open','West row'],
    ['swine','P3','swine','P3','open','West row']
  ]);

  seed(TABS.BARN_LAYOUT, ['Club ID','Species','Barn ID','Pen Count','Stalls Used','Location Notes'], [
    ['anthon','beef','beef-north',4,'A1–A4','West aisle'],
    ['arlington','beef','beef-north',3,'A5–A7','West aisle'],
    ['bronson','beef','beef-north',6,'B1–B6','Center aisle'],
    ['bryant','beef','beef-north',3,'B7–B9','Center aisle'],
    ['grant','beef','beef-north',2,'C1–C2','East aisle'],
    ['lucky','beef','beef-north',3,'C3–C5','East aisle'],
    ['pierson','beef','beef-north',4,'C6–C9','East aisle'],
    ['rockbr','beef','beef-north',2,'D1–D2','Overflow beef row'],
    ['willow','beef','beef-north',5,'D3–D7','Overflow beef row'],
    ['anthon','sheep','sheep',3,'S1–S3','North wall'],
    ['banner','sheep','sheep',3,'S4–S6','North wall'],
    ['bronson','sheep','sheep',4,'S7–S10','Center row'],
    ['goodluck','sheep','sheep',4,'S11–S14','Center row'],
    ['lucky','sheep','sheep',3,'S15–S17','South wall'],
    ['pierson','sheep','sheep',4,'S18–S21','South wall'],
    ['anthon','swine','swine',4,'P1–P4','West row'],
    ['arlington','swine','swine',3,'P5–P7','West row'],
    ['bronson','swine','swine',5,'P8–P12','Center row'],
    ['bryant','swine','swine',3,'P13–P15','Center row'],
    ['grant','swine','swine',2,'P16–P17','East row'],
    ['pierson','swine','swine',4,'P18–P21','East row'],
    ['rockbr','swine','swine',2,'P22–P23','East row'],
    ['rockkee','swine','swine',3,'P24–P26','East row']
  ]);

  seed(TABS.JUDGES, ['Name','Active (Y/N)','Notes'], [
    ['Pat M.','Y',''],
    ['Dana R.','Y',''],
    ['Sam K.','Y',''],
    ['Jamie J.','Y','Superintendent']
  ]);

  seed(TABS.RUBRIC, ['Key','Name','Weight','Hint'], [
    ['clean',   'Cleanliness of Alleys & Stalls/Pens', 20, 'Bedding adequate, bright, dry, clean and in place. Manure hauled out. Alleys swept clean.'],
    ['animals', 'Appearance of Animals',               20, 'Animals clean with grooming apparent.'],
    ['security','Security of Animals',                 15, 'Double-tied, gates across stalls, padlocks on rabbit & poultry cages.'],
    ['educ',    'Educational Effect / Stall Cards',    15, 'Each animal & exhibit identified by a stall card with exhibitor & club name.'],
    ['feed',    'Adequate Feed & Water',               10, 'Suitable feed in clean dish; access to clean fresh water in sanitary manner.'],
    ['exhib',   'Exhibitors — Conduct & Cooperation',  20, 'Courtesy, conduct, attitude and cooperation between all species.']
  ]);

  seed(TABS.SPECIES, ['ID','Name','Emoji'], [
    ['beef','Beef Cattle','🐄'],
    ['sheep','Sheep','🐑'],
    ['swine','Swine','🐖'],
    ['dairy','Dairy','🥛'],
    ['goat','Goat','🐐'],
    ['horse','Horse','🐴'],
    ['rabbit','Rabbit','🐇'],
    ['poultry','Poultry','🐓'],
    ['llama','Llama and Alpaca','🦙']
  ]);

  seed(TABS.SETTINGS, ['Key','Value'], [
    ['Fair Name','Woodbury County Fair'],
    ['Year','2026'],
    ['Inspections Per Day','2'],
    ['Days','3'],
    ['Premium 1st','$25'],
    ['Premium 2nd','$20'],
    ['Premium 3rd','$10'],
    ['Supt: Jamie Johnson','(712) 253-3336'],
    ['Supt: Dee McKenna','(712) 635-6868'],
    ['Supt: Ashley Diediker','(712) 253-5087']
  ]);

  seed(TABS.SCORES, ['Club','Species','Pass','Judge','Score','Clean','Animals','Security','Educ','Feed','Exhib','Note','LastUpdated','Revision','OpId'], []);
  seed(TABS.SCHEDULE, ['Pass','Species','Judge','Revision','OpId'], []);
  ensureColumns_(TABS.SCORES, ['Revision','OpId']);
  ensureColumns_(TABS.SCHEDULE, ['Revision','OpId']);
  syncMetadata_();
}

// ---------- Read ----------
function readConfig_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = (name) => {
    const sh = ss.getSheetByName(name); if (!sh) return [];
    const v = sh.getDataRange().getValues(); if (v.length < 2) return [];
    const head = v[0].map(String);
    return v.slice(1).filter(r => r.some(c => String(c).trim() !== ''))
            .map(r => Object.fromEntries(head.map((h,i)=>[h, r[i]])));
  };

  const clubs = rows(TABS.CLUBS).map(r => ({
    id: String(r.ID || '').trim(),
    name: String(r.Name || '').trim(),
    leaders: String(r.Leaders || '').trim(),
    species: String(r['Species (comma sep)'] || '').split(',').map(s=>s.trim()).filter(Boolean)
  })).filter(c => c.id && c.name);

  const barns = rows(TABS.BARNS).map(r => ({
    id: String(r['Barn ID'] || '').trim(),
    name: String(r.Name || '').trim(),
    species: String(r['Species (comma sep)'] || '').split(',').map(s=>s.trim()).filter(Boolean),
    area: String(r['Area / Building'] || '').trim(),
    sort: Number(r['Sort Order']) || 0,
    notes: String(r.Notes || '').trim()
  })).filter(b => b.id && b.name);

  const stalls = rows(TABS.STALLS).map(r => ({
    barnId: String(r['Barn ID'] || '').trim(),
    stallId: String(r['Stall ID'] || '').trim(),
    species: String(r.Species || '').trim(),
    label: String(r.Label || r['Stall ID'] || '').trim(),
    status: String(r.Status || '').trim(),
    notes: String(r.Notes || '').trim()
  })).filter(s => s.barnId && s.stallId);

  const barnLayout = rows(TABS.BARN_LAYOUT).map(r => ({
    clubId: String(r['Club ID'] || '').trim(),
    species: String(r.Species || '').trim(),
    barnId: String(r['Barn ID'] || '').trim(),
    pens: Number(r['Pen Count']) || 0,
    stalls: String(r['Stalls Used'] || '').trim(),
    location: String(r['Location Notes'] || '').trim()
  })).filter(r => r.clubId && r.species);

  const judges = rows(TABS.JUDGES)
    .filter(r => String(r['Active (Y/N)'] || 'Y').trim().toUpperCase() !== 'N')
    .map(r => String(r.Name || '').trim()).filter(Boolean);

  const rubric = rows(TABS.RUBRIC).map(r => ({
    key: String(r.Key || '').trim(),
    name: String(r.Name || '').trim(),
    wt: Number(r.Weight) || 0,
    hint: String(r.Hint || '').trim()
  })).filter(c => c.key && c.name);

  const species = rows(TABS.SPECIES).map(r => ({
    id: String(r.ID || '').trim(),
    name: String(r.Name || '').trim(),
    em: String(r.Emoji || '🐾').trim() || '🐾'
  })).filter(s => s.id && s.name);

  const settings = {};
  rows(TABS.SETTINGS).forEach(r => { if (r.Key) settings[String(r.Key)] = r.Value; });

  return { clubs, barns, stalls, barnLayout, judges, rubric, species, settings };
}

function readScores_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(TABS.SCORES); if (!sh) return {};
  const values = sh.getDataRange().getValues(); if (values.length < 2) return {};
  const out = {};
  for (let i=1; i<values.length; i++){
    const [club, sp, pass, judge, score, c1,c2,c3,c4,c5,c6, note, updated, revision] = values[i];
    if (!club || !sp || !pass) continue;
    out[`${club}|${sp}|${pass}`] = {
      r:{clean:+c1, animals:+c2, security:+c3, educ:+c4, feed:+c5, exhib:+c6},
      note:String(note||''),
      judge:String(judge||''),
      revision:String(revision || legacyRevision_(updated, i))
    };
  }
  return out;
}

function readSchedule_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(TABS.SCHEDULE); if (!sh) return {};
  const v = sh.getDataRange().getValues(); if (v.length < 2) return {};
  const out = {};
  for (let i=1; i<v.length; i++) {
    const [pass, sp, judge] = v[i];
    if (pass && sp && judge) out[`${pass}|${sp}`] = String(judge);
  }
  return out;
}

function readState_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    completePendingReset_();
    const meta = syncMetadata_();
    return {
      scores:readScores_(),
      schedule:readSchedule_(),
      datasetId:meta.datasetId,
      generation:meta.generation,
      lastResetId:meta.lastResetId
    };
  } finally {
    lock.releaseLock();
  }
}

// ---------- Write ----------
function upsertScore_(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    completePendingReset_();
    const meta = syncMetadata_();
    const identityError = validateIdentity_(body, meta, true);
    if (identityError) return identityError;
    const valid = validateScorePayload_(body);
    if (!valid.ok) return valid;

    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TABS.SCORES);
    const values = sh.getDataRange().getValues();
    const matches = [];
    for (let i=1; i<values.length; i++) {
      if (scoreKeyFromRow_(values[i]) === body.key) matches.push(i + 1);
    }
    const currentRow = matches.length ? values[matches[matches.length - 1] - 1] : null;
    if (currentRow && String(currentRow[14] || '') === body.opId) {
      return {ok:true, opId:body.opId, key:body.key, revision:String(currentRow[13] || '')};
    }

    const currentRevision = currentRow
      ? String(currentRow[13] || legacyRevision_(currentRow[12], matches[matches.length - 1] - 1))
      : null;
    const expectedRevision = body.expectedRevision == null ? null : String(body.expectedRevision);
    if (currentRevision !== expectedRevision) {
      return {ok:false, error:'score_conflict', key:body.key, currentRevision};
    }

    const revision = Utilities.getUuid();
    const row = scoreRow_(body.key, body.entry, valid.config.rubric, revision, body.opId);
    matches.sort((a,b)=>b-a).forEach(rowNumber=>sh.deleteRow(rowNumber));
    sh.appendRow(row);
    writeMeta_(body.entry.judge, valid.parts[2]);
    return {ok:true, opId:body.opId, key:body.key, revision,
      datasetId:meta.datasetId, generation:meta.generation};
  } finally {
    lock.releaseLock();
  }
}

function upsertSchedule_(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    completePendingReset_();
    const meta = syncMetadata_();
    const identityError = validateIdentity_(body, meta, false);
    if (identityError) return identityError;

    const parts = String(body.key || '').split('|');
    const config = readConfig_();
    const speciesIds = new Set(config.species.map(x=>x.id));
    const judge = String(body.judge || '');
    if (parts.length !== 2 || !PASS_RE.test(parts[0]) || !ID_RE.test(parts[1]) || !speciesIds.has(parts[1])) {
      return {ok:false, error:'invalid_schedule_key'};
    }
    if (judge && !config.judges.includes(judge)) return {ok:false, error:'invalid_judge'};

    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TABS.SCHEDULE);
    const values = sh.getDataRange().getValues();
    const matches = [];
    for (let i=1; i<values.length; i++) {
      if (`${values[i][0]}|${values[i][1]}` === body.key) matches.push(i + 1);
    }
    const currentRow = matches.length ? values[matches[matches.length - 1] - 1] : null;
    if (currentRow && String(currentRow[4] || '') === body.opId) {
      return {ok:true, opId:body.opId, key:body.key, revision:String(currentRow[3] || '')};
    }

    const revision = Utilities.getUuid();
    matches.sort((a,b)=>b-a).forEach(rowNumber=>sh.deleteRow(rowNumber));
    if (judge) sh.appendRow([parts[0], parts[1], judge, revision, body.opId]);
    writeMeta_('', parts[0]);
    return {ok:true, opId:body.opId, key:body.key, revision, datasetId:meta.datasetId};
  } finally {
    lock.releaseLock();
  }
}

function validateIdentity_(body, meta, requireGeneration) {
  if (!validOpId_(body.opId)) return {ok:false, error:'invalid_op_id'};
  if (String(body.datasetId || '') !== meta.datasetId) {
    return {ok:false, error:'wrong_dataset', datasetId:meta.datasetId, generation:meta.generation};
  }
  if (requireGeneration && Number(body.generation) !== meta.generation) {
    return {ok:false, error:'stale_generation', datasetId:meta.datasetId, generation:meta.generation};
  }
  return null;
}

function validateScorePayload_(body) {
  const parts = String(body.key || '').split('|');
  if (parts.length !== 3 || !parts.every(part=>ID_RE.test(part)) || !PASS_RE.test(parts[2])) {
    return {ok:false, error:'invalid_score_key'};
  }
  const config = readConfig_();
  const club = config.clubs.find(x=>x.id===parts[0]);
  const speciesIds = new Set(config.species.map(x=>x.id));
  const entry = body.entry || {};
  const note = String(entry.note || '');
  if (!club || !speciesIds.has(parts[1]) || !club.species.includes(parts[1])) {
    return {ok:false, error:'unknown_club_species'};
  }
  if (!config.judges.includes(String(entry.judge || ''))) return {ok:false, error:'invalid_judge'};
  if (note.length > 1000 || /^[=+@]/.test(note) || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(note)) {
    return {ok:false, error:'invalid_note'};
  }
  if (!entry.r || !config.rubric.every(item=>Number.isInteger(entry.r[item.key]) && entry.r[item.key]>=1 && entry.r[item.key]<=5)) {
    return {ok:false, error:'invalid_ratings'};
  }
  return {ok:true, parts, config};
}

function scoreRow_(key, entry, rubric, revision, opId) {
  const [club, sp, pass] = key.split('|');
  const r = entry.r;
  const total = Math.round(rubric.reduce((sum,item)=>sum + (r[item.key]/5)*item.wt, 0));
  return [club, sp, pass, entry.judge, total,
    r.clean, r.animals, r.security, r.educ, r.feed, r.exhib,
    String(entry.note||''), new Date(), revision, opId];
}

function resetAllScores_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const meta = syncMetadata_();
    const resetId = Utilities.getUuid();
    PropertiesService.getScriptProperties().setProperties({
      [META.RESET_PENDING_ID]:resetId,
      [META.SCORE_GENERATION]:String(meta.generation + 1),
      [META.INITIAL_BOUNDARY]:'owner-reset'
    });
    const cleared = completePendingReset_();
    const next = syncMetadata_();
    return {ok:true, cleared, datasetId:next.datasetId,
      generation:next.generation, resetId};
  } finally {
    lock.releaseLock();
  }
}

function completePendingReset_() {
  const props = PropertiesService.getScriptProperties();
  const resetId = props.getProperty(META.RESET_PENDING_ID);
  if (!resetId) return 0;
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TABS.SCORES);
  const cleared = Math.max(0, sh.getLastRow() - 1);
  if (cleared) sh.getRange(2,1,cleared,sh.getLastColumn()).clearContent();
  props.setProperty(META.LAST_RESET_ID, resetId);
  props.deleteProperty(META.RESET_PENDING_ID);
  setSetting_('Last Score Reset', new Date());
  return cleared;
}

function syncMetadata_() {
  const props = PropertiesService.getScriptProperties();
  let datasetId = props.getProperty(META.DATASET_ID);
  const hadDataset = !!datasetId;
  let initialBoundary = props.getProperty(META.INITIAL_BOUNDARY);
  let generation = Number(props.getProperty(META.SCORE_GENERATION));
  if (!datasetId) {
    datasetId = Utilities.getUuid();
    initialBoundary = 'fresh-dataset';
    props.setProperties({
      [META.DATASET_ID]:datasetId,
      [META.INITIAL_BOUNDARY]:initialBoundary
    });
  }
  if (!Number.isInteger(generation) || generation < 1) {
    generation = 1;
    props.setProperty(META.SCORE_GENERATION, '1');
  }

  // One-time upgrade for a dataset that existed before protected reset epochs.
  // It advances only when the score sheet is already empty, so it never clears
  // live work. Fresh datasets keep generation 1 for their first safe binding.
  if (hadDataset && !initialBoundary && generation === 1) {
    const scoreSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TABS.SCORES);
    if (scoreSheet && scoreSheet.getLastRow() <= 1) {
      generation = 2;
      initialBoundary = 'existing-empty-v1';
      props.setProperties({
        [META.SCORE_GENERATION]:'2',
        [META.INITIAL_BOUNDARY]:initialBoundary
      });
    }
  }
  return {datasetId, generation,
    lastResetId:props.getProperty(META.LAST_RESET_ID) || ''};
}

function ensureColumns_(sheetName, requiredHeaders) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const width = Math.max(1, sh.getLastColumn());
  const headers = sh.getRange(1,1,1,width).getValues()[0].map(String);
  requiredHeaders.forEach(header=>{
    if (!headers.includes(header)) {
      headers.push(header);
      sh.getRange(1,headers.length).setValue(header);
    }
  });
}

function scoreKeyFromRow_(row) { return `${row[0]}|${row[1]}|${row[2]}`; }
function validOpId_(value) { return /^[A-Za-z0-9_-]{8,100}$/.test(String(value || '')); }
function legacyRevision_(updated, index) {
  const stamp = updated instanceof Date ? updated.getTime() : new Date(updated || 0).getTime();
  return `legacy-${index}-${Number.isFinite(stamp) ? stamp : 0}`;
}

function setSetting_(key, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(TABS.SETTINGS);
  const data = sh.getDataRange().getValues();
  for (let i=1; i<data.length; i++) {
    if (String(data[i][0]) === key) {
      sh.getRange(i+1,2).setValue(value);
      return;
    }
  }
  sh.appendRow([key,value]);
}

function writeMeta_(judge, pass) {
  if (judge) setSetting_('Last Judge', judge);
  if (pass) setSetting_('Last Pass', pass);
  setSetting_('Last Sync', new Date());
}

// ---------- helpers ----------
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Run once from the editor to bootstrap tabs without waiting for an HTTP call:
function setupTabs() { ensureSheets_(); }
