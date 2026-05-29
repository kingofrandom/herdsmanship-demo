/**
 * Herdsmanship PWA — Google Sheet backend
 * --------------------------------------------------------------
 * Paste this entire file into the Apps Script editor attached to
 * a Google Sheet in your Drive, then Deploy → New deployment →
 * "Web app" → Execute as: ME, Who has access: ANYONE.
 * Copy the Web App URL into the PWA's Setup → Cloud Sync field.
 *
 * The script auto-creates these tabs on first call:
 *   Clubs, Judges, Rubric, Species, Settings, Scores, Schedule
 * Edit Clubs/Judges/Rubric on your laptop; PWA pulls on launch.
 */

const TABS = {
  CLUBS:    'Clubs',
  JUDGES:   'Judges',
  RUBRIC:   'Rubric',
  SPECIES:  'Species',
  SETTINGS: 'Settings',
  SCORES:   'Scores',
  SCHEDULE: 'Schedule',
};

// ---------- HTTP entry points ----------
function doGet(e) {
  ensureSheets_();
  const action = (e && e.parameter && e.parameter.action) || 'config';
  if (action === 'config') return json_({ok:true, config: readConfig_()});
  if (action === 'scores') return json_({ok:true, scores: readScores_()});
  return json_({ok:false, error:'unknown action'});
}

function doPost(e) {
  ensureSheets_();
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); }
  catch(err) { return json_({ok:false, error:'bad json'}); }
  const action = body.action || 'snapshot';
  if (action === 'snapshot') {
    writeScores_(body.scores || {});
    writeSchedule_(body.schedule || {});
    writeMeta_(body.judge, body.pass);
    return json_({ok:true, wrote: Object.keys(body.scores||{}).length});
  }
  return json_({ok:false, error:'unknown action'});
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
    ['arlington','Arlington Future Farmers', 'Ashley McC…',                  'beef,swine,dairy', ''],
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
    ['willow',   'Willow Workers',           'Jamie Johnson & Ni…',          'beef,dairy,goat,horse,poultry', ''],
    ['innov',    'Woodbury Innovators',      'Adrienne Dun…',                'swine,rabbit', ''],
    ['bronsonck','Bronson Rustlers Clover Kids','Dee M…',                    'rabbit,poultry', 'Clover Kids — non-competing']
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
    ['poultry','Poultry','🐓']
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

  seed(TABS.SCORES, ['Club','Species','Pass','Judge','Score','Clean','Animals','Security','Educ','Feed','Exhib','Note','LastUpdated'], []);
  seed(TABS.SCHEDULE, ['Pass','Species','Judge'], []);
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

  const judges = rows(TABS.JUDGES)
    .filter(r => String(r['Active (Y/N)'] || 'Y').trim().toUpperCase() !== 'N')
    .map(r => String(r.Name || '').trim()).filter(Boolean);

  const rubric = rows(TABS.RUBRIC).map(r => ({
    key: String(r.Key || '').trim(),
    name: String(r.Name || '').trim(),
    wt: Number(r.Weight) || 0,
    hint: String(r.Hint || '').trim()
  })).filter(c => c.key && c.name);

  const settings = {};
  rows(TABS.SETTINGS).forEach(r => { if (r.Key) settings[String(r.Key)] = r.Value; });

  return { clubs, judges, rubric, settings };
}

function readScores_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(TABS.SCORES); if (!sh) return {};
  const v = sh.getDataRange().getValues(); if (v.length < 2) return {};
  const out = {};
  for (let i=1; i<v.length; i++){
    const [club, sp, pass, judge, score, c1,c2,c3,c4,c5,c6, note] = v[i];
    if (!club || !sp || !pass) continue;
    out[`${club}|${sp}|${pass}`] = {
      r:{clean:+c1, animals:+c2, security:+c3, educ:+c4, feed:+c5, exhib:+c6},
      note: String(note||''),
      judge: String(judge||'')
    };
  }
  return out;
}

// ---------- Write ----------
function writeScores_(scores) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(TABS.SCORES);
  const now = new Date();
  const rows = [];
  Object.keys(scores).forEach(k => {
    const [club, sp, pass] = k.split('|');
    const e = scores[k] || {}; const r = e.r || {};
    const total = Math.round(
      ((r.clean||0)/5)*20 + ((r.animals||0)/5)*20 + ((r.security||0)/5)*15 +
      ((r.educ||0)/5)*15 + ((r.feed||0)/5)*10 + ((r.exhib||0)/5)*20
    );
    rows.push([club, sp, pass, e.judge||'', total,
      r.clean||'', r.animals||'', r.security||'', r.educ||'', r.feed||'', r.exhib||'',
      e.note||'', now]);
  });
  // overwrite — sheet is a mirror, PWA is source of truth for scores
  if (sh.getLastRow() > 1) sh.getRange(2,1,sh.getLastRow()-1, sh.getLastColumn()).clearContent();
  if (rows.length) sh.getRange(2,1,rows.length, rows[0].length).setValues(rows);
}

function writeSchedule_(schedule) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(TABS.SCHEDULE);
  const rows = [];
  Object.keys(schedule).forEach(k => {
    const [pass, sp] = k.split('|');
    rows.push([pass, sp, schedule[k] || '']);
  });
  if (sh.getLastRow() > 1) sh.getRange(2,1,sh.getLastRow()-1, sh.getLastColumn()).clearContent();
  if (rows.length) sh.getRange(2,1,rows.length, rows[0].length).setValues(rows);
}

function writeMeta_(judge, pass) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(TABS.SETTINGS);
  const setKV = (k, v) => {
    const data = sh.getDataRange().getValues();
    for (let i=1; i<data.length; i++) if (data[i][0] === k) { sh.getRange(i+1,2).setValue(v); return; }
    sh.appendRow([k,v]);
  };
  if (judge) setKV('Last Judge', judge);
  if (pass)  setKV('Last Pass',  pass);
  setKV('Last Sync', new Date());
}

// ---------- helpers ----------
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Run once from the editor to bootstrap tabs without waiting for an HTTP call:
function setupTabs() { ensureSheets_(); }
