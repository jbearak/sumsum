#!/usr/bin/env node
'use strict';
// Dependency-free application checks for a built library (default: index.html).
//   node scripts/check-library.cjs [path/to/index.html]
// Every expectation is computed from the embedded payload, so the same checks run against any build: the real build
// (index.html, with data/episode-guide.json) or another build given on the command line. The given file is booted as built,
// with its guide removed (guide-absent mode), with shared storage (persistence), and with the fixtures of edgePayload() added
// (contract and edge cases every build gets). The builder checks run the builder on fixture inputs in a temporary directory.
// The DOM double lives in scripts/dom-double.cjs; browser layout and visual QA are separate.
const path = require('node:path');
const vm = require('node:vm');
const fs = require('node:fs');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const assert = require('node:assert/strict');
const {boot, readLibrary} = require('./dom-double.cjs');

const htmlPath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const {appSource} = readLibrary(htmlPath);
const passed = [];
const ok = label => { passed.push(label); if (process.env.CHECK_TRACE) { if (global.gc) global.gc(); } if (process.env.CHECK_TRACE) console.error('ok ' + passed.length + ' ' + label.slice(0, 90) + ' ' + Math.round(process.memoryUsage().heapUsed / 1e6) + 'MB'); };

// ---------------------------------------------------------------- string table (EN/HE)
const strStart = appSource.indexOf('/* strings:begin */'), strEnd = appSource.indexOf('/* strings:end */');
assert(strStart > 0 && strEnd > strStart, 'String table markers found');
const L = vm.runInNewContext(appSource.slice(strStart, strEnd).replace('const L =', 'var L =') + ';L');
const tr = (lang, key, vars) => {
  let s = L[lang][key] ?? L.en[key]; assert(typeof s === 'string', 'String exists: ' + key);
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return s;
};
const PLACEHOLDERS = new Set(Object.values(L.en).flatMap(s => (s.match(/\{\w+\}/g) || [])));
// The editorial tag names (EN, HE) from the embedded vocabulary (data/vocabulary.json), as a null-prototype table like the app's.
const NAMES = Object.assign(Object.create(null), JSON.parse(readLibrary(htmlPath).dataText).vocabulary?.tags || {});

// ---------------------------------------------------------------- independent model of the data
// The series registry (payload.series, from data/series.json): set from each booted payload by model(), like the services.
// The rules below (what counts as core, how productions rank) are the checker's own; the registry supplies the facts.
let SERIES = [], GOAL = [], FAMILY_ORDER = [], FAMILY_OF = {};
const useSeries = payload => {
  const reg = payload && payload.series && typeof payload.series === 'object' ? payload.series : {};
  const list = v => (Array.isArray(v) ? v.filter(x => x && typeof x.id === 'string') : []);
  SERIES = list(reg.series).map(x => x.id);
  FAMILY_OF = Object.fromEntries(list(reg.series).map(x => [x.id, x.family]));
  FAMILY_ORDER = list(reg.families).map(x => x.id);
  GOAL = (Array.isArray(reg.goal) ? reg.goal : []).filter(x => x && SERIES.includes(x.series));
};
const KINDS = ['episode', 'short-episode', 'unverified', 'clip', 'collection'];
const ROLES = ['whole-candidate', 'alternate-edition', 'part', 'excerpt'];
const EVS = ['metadata-checked', 'playback-started', 'complete-playback-reviewed', 'reference-compared'];
const NUMBERINGS = ['documented', 'provisional', 'inferred', 'uploader'];
const DOMAINS = {vimeo: ['vimeo.com'], youtube: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'], hop: ['hop.co.il'],
  archive: ['archive.org'], dailymotion: ['dailymotion.com', 'dai.ly'], facebook: ['facebook.com', 'fb.watch'],
  kan: ['kan.org.il'], okru: ['ok.ru']};
const GROUP = {played: 'direct', local: 'direct', vimeo: 'direct', public: 'public', web: 'web', hop: 'vpn', licensed: 'lic-other',
  restricted: 'vpn', unavailable: 'unavailable'};
// Licensed services (payload.services, from data/licensed-services.json): a licensed record is matched to a service by its
// link's hostname or a parent domain. The models, free first, order the access filters and break Watch ties.
const LIC_MODELS = ['library-card', 'subscription', 'free-with-ads', 'purchase-or-rent'];
let SVC = [];
// Set from each booted payload by model(), so the expectations follow the variant under test (services removed, fixtures).
const useServices = payload => {
  const list = payload && payload.services && Array.isArray(payload.services.services) ? payload.services.services : [];
  SVC = list.filter(x => x && typeof x.name === 'string' && x.name && LIC_MODELS.includes(x.model) && Array.isArray(x.hosts) && x.hosts.length);
  const lp = payload && payload.linkPriority && Array.isArray(payload.linkPriority.tiers) ? payload.linkPriority.tiers : [];
  TIER_ORDER = [...new Set([...lp.filter(x => TIERS.includes(x)), ...TIERS])];
};
// The link order the user set (data/link-priority.json): every link falls in one tier; links that failed a check come after
// every tier. Licensed listings go by their service, links needing the Israel VPN are 'vpn', region-limited free streams rank
// with 'free-with-ads', and every other link goes by its host.
const TIERS = ['archive', 'youtube', 'subscribed', 'vimeo', 'other-free', 'vpn', 'library-card', 'free-with-ads', 'paid'];
let TIER_ORDER = TIERS;
const subscribed = x => !!x && x.model === 'subscription' && x.subscribed === true;
function expectTier(r, local = '') {
  const a = expectAccess(r, local);
  if (a === 'unavailable') return 'failed';
  if (a === 'licensed') { const x = expectSvc(r, local); return subscribed(x) ? 'subscribed' : x && ['library-card', 'free-with-ads'].includes(x.model) ? x.model : 'paid'; }
  if (a === 'hop' || a === 'restricted') return 'vpn';
  if (checkOf(r) === 'region-limited') return 'free-with-ads';
  const k = hostKind(expectDest(r, local));
  return ['archive', 'youtube', 'vimeo'].includes(k) ? k : 'other-free';
}
const tierNo = (r, local = '') => { const k = expectTier(r, local); return k === 'failed' ? TIERS.length : TIER_ORDER.indexOf(k); };
// An episode's copies: usable before failed; whole and alternate, then parts, then excerpts; then the tier; official first;
// then the part number.
const ROLE_CLASS = {'whole-candidate': 0, 'alternate-edition': 0, part: 1, excerpt: 2, possible: 3};
// Within a role class, a copy of the episode alone, then one inside a compilation, then a service listing (each record's worst
// counted link; model() fills CONT for its payload's records).
const CONT = new WeakMap(), CONT_CLASS = {compilation: 1, listing: 2};
const copyKey = (r, role, partNo, local = '') => [tierNo(r, local) === TIERS.length ? 1 : 0, ROLE_CLASS[role] ?? 3, CONT.get(r) || 0,
  tierNo(r, local), r.sourceType === 'official' ? 0 : 1, partNo || 0];
const cmpKeys = (x, y) => { for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
const svcOfUrl = url => { const h = hostname(url); return (h && SVC.find(x => x.hosts.some(d => h === d || h.endsWith('.' + d)))) || null; };
const EP_FORMATS = ['core', 'short-series', 'talk-show', 'home-video', 'related-series'];
const safe = v => {
  if (!v || typeof v !== 'string') return '';
  try { const u = new URL(v); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
};
const hostname = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const hostKind = url => {
  const h = hostname(url);
  for (const [k, ds] of Object.entries(DOMAINS)) if (ds.some(d => h === d || h.endsWith('.' + d))) return k;
  return 'web';
};
const kindOf = r => (r.kind === 'episode' && r.programFormat === 'short-form' ? 'short-episode' :
  r.kind === 'episode' && r.completenessStatus === 'runtime-inferred' ? 'unverified' : r.kind);
// A recorded availability check: the string form or the object form's status (the free text is for people).
const checkOf = r => {
  const c = r.availabilityCheck;
  return typeof c === 'string' ? c : c && typeof c === 'object' && typeof c.status === 'string' ? c.status : '';
};
// A failed check recorded only as free text: these words in a result mean the upload failed outside Israel, unless the same
// result records a later request that succeeded.
const FAILED_CHECK = /This video is not available|Video unavailable|blocked due to the claimed content|has not made this video available/;
const failedText = r => {
  const c = r.availabilityCheck, res = c && typeof c === 'object' && typeof c.result === 'string' ? c.result : '';
  return FAILED_CHECK.test(res) && !/without a playability error/.test(res);
};
// Playback evidence belongs to the exact URL checked: 'played' needs a playbackUrl equal to the destination.
function expectAccess(r, local = '') {
  const dest = local || safe(r.directUrl) || safe(r.url) || safe(r.sourceUrl), k = hostKind(dest);
  if (r.playbackVerified === true && r.playbackWithoutVpn === true && !!r.playbackUrl && safe(r.playbackUrl) === dest) return 'played';
  if (local) return 'local';
  if (r.access === 'unavailable' || checkOf(r) === 'unavailable') return 'unavailable';
  if (k === 'hop') return 'hop';
  if (r.access === 'vpn-required' || checkOf(r) === 'country-restricted') return 'restricted';
  if (r.access === 'licensed') return 'licensed';
  if (k === 'vimeo') return 'vimeo';
  return ['youtube', 'archive', 'dailymotion'].includes(k) ? 'public' : 'web';
}
const expectDest = (r, local = '') => local || safe(r.directUrl) || safe(r.url) || safe(r.sourceUrl);
// Videos the library offers unasked (Up next, Home's generated shelves, Surprise): not marked as needing a VPN, a card or a
// purchase, and not failed or region-limited in a check.
// A service the user subscribes to (subscribed: true) is offered like a free link.
const OFFER_RANK = {played: 0, local: 1, vimeo: 2, public: 3};
const offerable = (r, local = '') => !!expectDest(r, local) && checkOf(r) !== 'region-limited' &&
  (expectAccess(r, local) in OFFER_RANK || (expectAccess(r, local) === 'licensed' && subscribed(expectSvc(r, local))));
// Up next's copy of an episode: its best offered whole or alternate copy (best access, then whole before alternate).
function nextCopyM(M, e, local = () => '') {
  let best = null, score = Infinity;
  for (const u of M.ups.get(e.id) || []) {
    if (!['whole-candidate', 'alternate-edition'].includes(u.role) || !offerable(u.r, local(u.r))) continue;
    const sc = copyKey(u.r, u.role, 0, local(u.r));
    if (score === Infinity || cmpKeys(sc, score) < 0) { score = sc; best = u; }
  }
  return best;
}
// A record's pasted Vimeo link in the test storage, if any.
const localIn = H => r => {
  const m = JSON.parse(H.storage.get('sumsum-vimeo-mappings') || '{}')[r.id];
  return m ? safe(typeof m === 'string' ? m : m && m.url) || '' : '';
};
// The service of a licensed record's link (its name labels the host), and of a listing whose access is licensed.
const expectRecSvc = (r, local = '') => (r.access === 'licensed' ? svcOfUrl(expectDest(r, local)) : null);
const expectSvc = (r, local = '') => (expectAccess(r, local) === 'licensed' ? expectRecSvc(r, local) : null);
// "Where it plays": recorded playback is about one URL, so a played upload stays in its host's group.
const hostGroup = k => (k === 'vimeo' ? 'direct' : ['youtube', 'archive', 'dailymotion'].includes(k) ? 'public' : k === 'hop' ? 'vpn' : 'web');
const expectGroup = (r, local = '') => {
  const a = expectAccess(r, local); if (a === 'played') return hostGroup(hostKind(expectDest(r, local)));
  if (a === 'licensed') { const x = expectSvc(r, local); return x ? 'lic-' + x.model : 'lic-other'; }
  return GROUP[a];
};
const expectHostLabel = (r, lang, local = '') => {
  const x = expectRecSvc(r, local); if (x) return x.name;
  const d = expectDest(r, local), k = hostKind(d);
  return k === 'web' ? hostname(d) || tr(lang, 'host_web') : tr(lang, 'host_' + k);
};
function expectAccessText(r, lang, local = '') {
  const a = expectAccess(r, local), host = expectHostLabel(r, lang, local);
  if (a === 'restricted' && checkOf(r) !== 'country-restricted') return tr(lang, 'acc_vpnListed', {host});
  if (a === 'unavailable' && checkOf(r) !== 'unavailable') return tr(lang, 'acc_unavailListed', {host});
  if (['web', 'public'].includes(a) && checkOf(r) === 'region-limited') return tr(lang, 'acc_regionLimited', {host});
  const x = expectSvc(r, local);
  if (x) return tr(lang, 'acc_licSvc', {service: x.name, req: tr(lang, 'lic_' + x.model)});
  return tr(lang, 'acc_' + a, {host}) + (a === 'played' && r.playbackVerifiedAt ?
    ' · ' + tr(lang, 'checkedOn', {d: String(r.playbackVerifiedAt).slice(0, 10)}) : '');
}
// The licensed note under an access line: the service's model note, or the generic one for an undescribed service.
const expectLicNote = (r, lang, local = '') => {
  const x = expectSvc(r, local); return x ? tr(lang, 'licNote_' + x.model, {service: x.name}) : tr(lang, 'licensedNote');
};
// Every licensed note the page could show (for "only the right one" checks).
const allLicNotes = lang => [tr(lang, 'licensedNote'), ...SVC.map(x => tr(lang, 'licNote_' + x.model, {service: x.name}))];

// The note under the episode hero's access line: Hop pages need the VPN; restricted uploads say whether a check failed.
function expectHeroNote(r, acc, lang, local = '') {
  if (acc === 'hop') return tr(lang, 'vpnNote');
  if (acc === 'licensed') return expectLicNote(r, lang, local);
  if (['web', 'public'].includes(acc) && checkOf(r) === 'region-limited') return tr(lang, 'regionNote');
  if (acc === 'restricted') return tr(lang, ['country-restricted', 'unavailable'].includes(checkOf(r)) ? 'ytNote' : 'vpnListedNote');
  return '';
}
const recTitleEn = r => r.titleEn || r.titleHe || r.title || r.originalTitle || L.en.untitled;
// titleHeEditorial: our Hebrew translation for an item with no published Hebrew title. Hebrew titles fall back to it before the
// English title; English titles never use it, and a published titleHe (on an episode, storyHe too) comes first.
const heEdOf = x => (typeof x.titleHeEditorial === 'string' && x.titleHeEditorial.trim() ? x.titleHeEditorial : '');
const recTitleIn = (r, lang) => (lang === 'he' ? r.titleHe || heEdOf(r) || r.titleEn : r.titleEn || r.titleHe) || r.title ||
  r.originalTitle || tr(lang, 'untitled');
// The tile's short Watch label: a licensed listing names its service and need ("hoopla · library card"; "Licensed" without a
// described service), else the host word; parts and excerpts say so, and so does a link that failed an availability check
// (R4-01), except on the phone List label (list), which has no room for it.
const expectLicWatch = (r, lang, short, local = '') => {
  const x = expectSvc(r, local);
  return x ? tr(lang, (short ? 'twLic_' : 'watchLic_') + x.model, {service: x.name}) :
    short ? tr(lang, 'tw_licensed') : tr(lang, 'watchLicensed', {host: expectHostLabel(r, lang, local)});
};
function expectWatchShort(b, lang, list = false) {
  const base = b.acc === 'licensed' ? expectLicWatch(b.r, lang, true) : tr(lang, 'tw_' + hostKind(expectDest(b.r)));
  const q = b.role === 'part' ? [b.n > 1 ? tr(lang, 'twPart', {i: b.i.toLocaleString(), n: b.n.toLocaleString()}) : tr(lang, 'role_part')] :
    b.role === 'excerpt' ? [tr(lang, 'twExcerpt')] : [];
  if (b.acc === 'unavailable' && !list) q.push(tr(lang, 'tw_unavailable'));
  return [base, ...q].join(' · ');
}
// The long Watch label: a licensed listing names its service and need; otherwise the host's "Watch on ...".
const expectWatchBase = (r, lang, local = '') => (expectAccess(r, local) === 'licensed' ?
  expectLicWatch(r, lang, false, local) : tr(lang, 'watchOn_' + hostKind(expectDest(r, local))));
// The whole long label (List rows, pages): the base, then the part or excerpt, then "Unavailable" for a failed link.
function expectWatchLong(b, lang, local = '') {
  const q = b.role === 'part' ? [b.n > 1 ? tr(lang, 'partOf', {i: b.i.toLocaleString(), n: b.n.toLocaleString()}) : tr(lang, 'role_part')] :
    b.role === 'excerpt' ? [tr(lang, 'excerptQ')] : [];
  if (b.acc === 'unavailable') q.push(tr(lang, 'unavailableQ'));
  return [expectWatchBase(b.r, lang, local), ...q].join(' · ');
}
// A Watch link for a failed link: the 'bad' class (no VPN or licensed shape) and one hidden failed-check mark.
function assertFailedMark(H, w, failed, where) {
  const marks = H.byClass('acc-bad', w);
  assert.equal(H.cls(w).includes('bad'), failed, where + ': the bad class marks exactly the failed links');
  assert.equal(marks.length, failed ? 1 : 0, where + ': the failed-check mark appears exactly on failed links');
  if (failed) {
    assert(!H.cls(w).includes('vpn') && !H.cls(w).includes('lic'), where + ': a failed link has no other access shape');
    assert.equal(marks[0].getAttribute('aria-hidden'), 'true', where + ': the mark is hidden from assistive technology');
  }
}

function model(payload) {
  useServices(payload); useSeries(payload);
  const records = payload.records, recById = new Map(records.map(r => [r.id, r]));
  const g = payload.guide && Array.isArray(payload.guide.productions) ? payload.guide : {productions: [], episodes: [], unidentified: {}};
  const prods = [...g.productions].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const prodById = new Map(prods.map(p => [p.id, p]));
  const num = v => (v === null || v === undefined ? Infinity : Number(v));
  const eps = (g.episodes || []).filter(e => prodById.has(e.production));
  // Counted uploads (coverage, evidence, Watch) and possible copies (identity unresolved; never counted).
  const posInt = v => (Number.isInteger(v) && v > 0 ? v : null);
  const ups = new Map(eps.map(e => [e.id, (e.uploads || []).filter(u => recById.has(u.recordId) && ROLES.includes(u.role))
    .map(u => ({r: recById.get(u.recordId), role: u.role, part: u.role === 'part' ? posInt(u.part) : null}))]));
  for (const e of eps) for (const u of e.uploads || []) {
    const r = recById.get(u.recordId), c = CONT_CLASS[u.container] || 0;
    if (r && ROLES.includes(u.role) && c > (CONT.get(r) || 0)) CONT.set(r, c);
  }
  const poss = new Map(eps.map(e => [e.id, (e.uploads || []).filter(u => recById.has(u.recordId) && u.role === 'possible')
    .map(u => ({r: recById.get(u.recordId), role: 'possible'}))]));
  const linked = new Set([...ups.values()].flat().map(u => u.r.id));
  const possibleIds = new Set([...poss.values()].flat().map(u => u.r.id));
  const queued = new Map();
  for (const [pid, ids] of Object.entries(g.unidentified || {})) {
    if (!prodById.has(pid)) continue;
    for (const id of ids || []) if (recById.has(id) && !linked.has(id) && !queued.has(id)) queued.set(id, pid);
  }
  const guideStatus = r => (linked.has(r.id) ? 'matched' : queued.has(r.id) ? 'queue' : possibleIds.has(r.id) ? 'possible' : 'none');
  // A record's guide links in guide order, sorted by role (whole and alternate, part, excerpt, possible); ties keep guide order.
  const LINK_RANK = {'whole-candidate': 0, 'alternate-edition': 1, part: 2, excerpt: 3, possible: 4};
  const recLinks = new Map();
  for (const e of eps) {
    for (const u of [...ups.get(e.id), ...poss.get(e.id)]) {
      if (!recLinks.has(u.r.id)) recLinks.set(u.r.id, []);
      recLinks.get(u.r.id).push({e, role: u.role});
    }
  }
  for (const l of recLinks.values()) l.sort((a, b) => LINK_RANK[a.role] - LINK_RANK[b.role]);
  // Parts by explicit number, then position; shown as "Part {no} of {of}" (of: the highest number, at least the count).
  const partsOf = e => {
    const ps = ups.get(e.id).filter(x => x.role === 'part').map((u, k) => ({u, no: u.part ?? k + 1, k}))
      .sort((a, b) => a.no - b.no || a.k - b.k);
    const of = Math.max(ps.length, ...ps.map(x => x.no));
    return ps.map(x => ({...x, of}));
  };
  const cov = e => {
    const u = ups.get(e.id); if (!u.length) return 'missing';
    if (u.some(x => x.role === 'whole-candidate' || x.role === 'alternate-edition')) return 'whole-candidate';
    return u.some(x => x.role === 'part') ? 'parts-only' : 'excerpt-only';
  };
  // A level 3 or 4 detail counts only when it agrees with the stated evidence, names a whole (or, without one, any)
  // linked upload, one of that upload's own URLs, and an ISO date.
  const pool = e => { const u = ups.get(e.id), whole = u.filter(x => x.role === 'whole-candidate' || x.role === 'alternate-edition');
    return whole.length ? whole : u; };
  const evDetail = e => {
    const d = e.evidenceDetail; if (!d || typeof d !== 'object') return null;
    const k = EVS.indexOf(d.level); if (k < 2 || d.level !== e.evidence) return null;
    const x = pool(e).find(y => y.r.id === d.recordId); if (!x) return null;
    const urls = ['url', 'directUrl', 'playerUrl', 'playbackUrl', 'sourceUrl', 'hopUrl'].map(f => safe(x.r[f])).filter(Boolean);
    if (!safe(d.url) || !urls.includes(safe(d.url))) return null;
    if (typeof d.checkedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(d.checkedAt)) return null;
    return {k, level: d.level, r: x.r, url: safe(d.url), checkedAt: d.checkedAt.slice(0, 10), noteEn: d.noteEn || ''};
  };
  const ev = e => {
    const p = pool(e); if (!p.length) return null;
    let best = Math.max(...p.map(x => (x.r.playbackVerified === true ? 1 : 0)));
    const d = evDetail(e); if (d && d.k > best) best = d.k;
    return EVS[best];
  };
  const evSource = e => { const d = evDetail(e); return d && EVS.indexOf(ev(e)) === d.k ? d : null; };
  // The Watch link: the first copy in link order (copyKey), part 1 of the best parts.
  const best = (e, locals = {}) => {
    const u = ups.get(e.id), parts = partsOf(e);
    let pickU = null, score = null;
    for (const x of u) {
      const loc = locals[x.r.id] || '';
      if (!expectDest(x.r, loc)) continue;
      const px = parts.find(y => y.u === x), s = copyKey(x.r, x.role, px ? px.no : 0, loc);
      if (!score || cmpKeys(s, score) < 0) { score = s; pickU = x; }
    }
    const bp = pickU && parts.find(x => x.u === pickU);
    return pickU && {r: pickU.r, role: pickU.role, acc: expectAccess(pickU.r, locals[pickU.r.id] || ''), i: bp ? bp.no : 0, n: bp ? bp.of : 0};
  };
  // Codes: a production's own number label ("IETV no. 31"), else season and episode codes.
  const label = (p, lang) => {
    const en = typeof p.numberLabelEn === 'string' ? p.numberLabelEn.trim() : '', he = typeof p.numberLabelHe === 'string' ? p.numberLabelHe.trim() : '';
    return lang === 'he' ? he || en : en || he;
  };
  const fmtNum = (n, lang) => Number(n).toLocaleString(lang === 'he' ? 'he-IL' : 'en-US');
  // An episode number as its production writes it: zero-padded to numberWidth digits, never grouped.
  const fmtId = (p, n, lang) => (p && Number.isInteger(p.numberWidth) && p.numberWidth >= 1 && p.numberWidth <= 6 ?
    String(n).padStart(p.numberWidth, '0') : fmtNum(n, lang));
  const codeOf = (p, season, n, lang = 'en') => {
    if (n == null) return '';
    if (label(p, lang)) return tr(lang, 'codeLabel', {label: label(p, lang), n: fmtId(p, n, lang)});
    return season != null ? tr(lang, 'codeSE', {s: fmtNum(season, lang), n: fmtId(p, n, lang)}) : tr(lang, 'codeN', {n: fmtId(p, n, lang)});
  };
  const code = (e, lang = 'en') => codeOf(prodById.get(e.production), e.season, e.number, lang);
  // The code with an already formatted number part ("IETV no. 133 or 178").
  const codeText = (p, season, nText, lang = 'en') => (label(p, lang) ? tr(lang, 'codeLabel', {label: label(p, lang), n: nText}) :
    season != null ? tr(lang, 'codeSE', {s: fmtNum(season, lang), n: nText}) : tr(lang, 'codeN', {n: nText}));
  const nounOf = p => ({'short-series': 'installment', 'talk-show': 'program', 'home-video': 'tape'}[p.format] || 'episode');
  // A Hebrew story name from another source (storyHe) heads the episode in Hebrew; English keeps the editorial titleEn. Without a
  // published Hebrew title, Hebrew headings use the editorial Hebrew title (titleHeEditorial).
  const storyOf = e => (typeof e.storyHe === 'string' && e.storyHe.trim() ? e.storyHe : '');
  const epTitle = (e, lang = 'en') => {
    const p = prodById.get(e.production), tt = lang === 'he' ? storyOf(e) || e.titleHe || heEdOf(e) || e.titleEn : e.titleEn || e.titleHe;
    if (tt) return tt;
    if (e.number == null) return tr(lang, 'untitled');
    if (label(p, lang)) return code(e, lang);
    const noun = tr(lang, 'noun_' + nounOf(p)), n = fmtId(p, e.number, lang);
    return e.season != null ? tr(lang, 'untitledSE', {s: fmtNum(e.season, lang), noun, n}) : tr(lang, 'untitledN', {noun, n});
  };
  // The upload card's guide tag: the best-role link, with every same-role link of the same production and season when all
  // are numbered ("IETV no. 133 or 178 · Possible copy"); further links are counted ("+2 more").
  const linkTag = (r, lang = 'en') => {
    const links = recLinks.get(r.id); if (!links) return null;
    const {e, role} = links[0], p = prodById.get(e.production), pos = role === 'possible';
    const same = links.filter(l => l.role === role && l.e.production === e.production && (l.e.season ?? null) === (e.season ?? null));
    let text = code(e, lang) || epTitle(e, lang), rest = links.length - 1;
    if (same.length > 1 && same.every(l => Number.isInteger(l.e.number))) {
      text = codeText(p, e.season ?? null, same.map(l => fmtId(p, l.e.number, lang)).join(pos ? tr(lang, 'orSep') : ', '), lang);
      rest = links.length - same.length;
    } else if (same.length > 1 && pos) {
      text = same.map(l => code(l.e, lang) || epTitle(l.e, lang)).join(tr(lang, 'orSep')); rest = links.length - same.length;
    }
    return text + ' · ' + tr(lang, 'role_' + role) + (rest ? ' ' + tr(lang, 'moreLinks', {n: fmtNum(rest, lang)}) : '');
  };
  const altLabels = e => (Array.isArray(e.altLabels) ? e.altLabels : []).filter(a => a && typeof a === 'object')
    .map(a => ({text: a.labelEn || a.labelHe || a.label || '', labelHe: a.labelHe, labelEn: a.labelEn, source: a.sourceLabel || '',
      url: safe(a.url)}))
    .filter(a => typeof a.text === 'string' && a.text.trim());
  const altText = (e, lang = 'en') => altLabels(e).map(a => (lang === 'he' ? a.labelHe || a.labelEn : a.labelEn || a.labelHe) || a.text).join(' · ');
  const fmt = p => p.format;
  const goalSeries = GOAL.map(x => x.series);
  const isCoreRechov = p => p.format === 'core' && goalSeries.includes(p.series);
  // Core Rechov, then the goal series' queue, their other formats, then each other family in registry order; unregistered last.
  const famRank = p => {
    if (isCoreRechov(p)) return 0;
    if (goalSeries.includes(p.series)) return p.format === 'queue' ? 1 : 2;
    const i = FAMILY_ORDER.indexOf(FAMILY_OF[p.series]); return i < 0 ? FAMILY_ORDER.length + 2 : i + 2;
  };
  const epsOf = new Map(prods.map(p => [p.id, eps.filter(e => e.production === p.id)
    .sort((a, b) => num(a.season) - num(b.season) || num(a.number) - num(b.number) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))]));
  const prodModel = p => {
    const all = epsOf.get(p.id);
    const ts = Number.isInteger(p.expectedTotal) ? 'known' :
      (p.totalsEvidence || []).filter(x => x.confidence === 'conflicting').length >= 2 ? 'contested' : 'unknown';
    const defs = p.seasons || [], keys = defs.map(s => s.season ?? null);
    // A season's cells cover first .. last: firstNumber (default 1) to the highest known number or firstNumber + expected - 1.
    const groupsIn = defs.map(s => [s, s.season ?? null]);
    for (const e of all) if (!keys.includes(e.season ?? null)) { keys.push(e.season ?? null); groupsIn.push([null, e.season ?? null]); }
    const groups = groupsIn.map(([def, season]) => {
      const ge = all.filter(e => (e.season ?? null) === season), byNum = new Map();
      for (const e of ge) if (Number.isInteger(e.number) && e.number > 0 && !byNum.has(e.number)) byNum.set(e.number, e);
      const max = Math.max(0, ...byNum.keys()), exp = def && Number.isInteger(def.expectedEpisodes) ? def.expectedEpisodes : null;
      const conf = ge.filter(e => Number.isInteger(e.number)).map(e => e.confidence);
      const derived = conf.length && conf.every(c => c === 'documented') ? 'documented' :
        conf.length && conf.every(c => c === 'uploader-label') ? 'uploader' : 'provisional';
      const numbering = byNum.size ? (def && NUMBERINGS.includes(def.numbering) ? def.numbering : derived) : null;
      const first0 = def && Number.isInteger(def.firstNumber) && def.firstNumber > 0 ? def.firstNumber : 1;
      // excludedNumbers are not episodes: no cell, gap or expected place; the season's exp-th number skips them.
      const excluded = new Set((def && Array.isArray(def.excludedNumbers) ? def.excludedNumbers : [])
        .flatMap(x => Array.from({length: x.to - x.from + 1}, (_, k) => x.from + k)));
      let expLast = 0;
      if (exp) { let k = 0, n = first0 - 1; while (k < exp) { n++; if (!excluded.has(n)) k++; } expLast = n; }
      const first = byNum.size ? Math.min(first0, ...byNum.keys()) : first0;
      const last = byNum.size ? Math.min(first + 399 + excluded.size, Math.max(max, expLast)) : first - 1;
      let len = 0, gaps = 0, expCells = 0; const slotNs = [];
      for (let n = first; n <= last; n++) {
        if (excluded.has(n)) continue;
        len++; if (!byNum.has(n)) { slotNs.push(n); if (n <= max) gaps++; else expCells++; }
      }
      return {def, season, eps: ge, byNum, max, first, last, exp, numbering, len, gaps, expCells, slotNs, excluded,
        slots: exp != null ? Math.max(0, exp - ge.length) : 0};
    });
    const exp = ts === 'known' ? p.expectedTotal : null;
    // Episodes outside the declared seasons may be any declared season's unidentified episodes: they fill the expected
    // places (season slots, then documented gaps of declared seasons) instead of being counted on top of them.
    const outside = defs.length ? groups.filter(x => !x.def).reduce((s, x) => s + x.eps.length, 0) : 0;
    const openSlots = groups.reduce((s, x) => s + x.slots, 0);
    let docOpen = 0, docDeclared = 0, inferredGaps = 0;
    if (ts !== 'known') {
      for (const x of groups) if (x.exp == null) {
        if (x.numbering === 'documented') { docOpen += x.gaps; if (x.def) docDeclared += x.gaps; } else inferredGaps += x.gaps;
      }
    }
    const a1 = Math.min(outside, openSlots), a2 = Math.min(outside - a1, docDeclared);
    let left = a1; for (const x of groups) { const take = Math.min(left, x.slots); x.open = x.slots - take; left -= take; }
    const seasonSlots = openSlots - a1, docGaps = docOpen - a2;
    const restSlots = exp != null ? Math.max(0, exp - all.length - seasonSlots) : 0;
    const slots = exp != null ? Math.max(0, exp - all.length) : seasonSlots + docGaps;
    const knownFloor = ts === 'known' ? Math.max(exp, all.length) : all.length + seasonSlots + docGaps;
    return {all, ts, exp, groups, seasonSlots, restSlots, docGaps, inferredGaps, slots, outside, absorbed: a1 + a2,
      knownFloor, numberingFloor: knownFloor + inferredGaps};
  };
  // The long coverage label: whole links stay "(unverified)" until complete playback is recorded.
  const covLong = (e, lang) => {
    const c = cov(e); if (c !== 'whole-candidate') return tr(lang, 'cov_' + c);
    const f = prodById.get(e.production).format, ff = EP_FORMATS.includes(f) ? f : 'core';
    return tr(lang, (EVS.indexOf(ev(e)) >= 2 ? 'covWholeChecked_' : 'covWhole_') + ff);
  };
  // Access filters: one licensed group per model the services describe, and 'lic-other' for listings no service describes
  // (every licensed listing without services data).
  const licGroups = LIC_MODELS.filter(m => SVC.some(x => x.model === m)).map(m => 'lic-' + m);
  const licOther = !licGroups.length || records.some(r => r.access === 'licensed' && !svcOfUrl(safe(r.directUrl) || safe(r.url) || safe(r.sourceUrl)));
  const agroups = ['direct', 'public', 'web', 'vpn', ...licGroups, ...(licOther ? ['lic-other'] : []), 'unavailable'];
  // Entries (one per episode or video, what Browse, Starred, Home and Surprise list): an episode's counted copies (whole,
  // alternate, part) whose record is a counted copy of no other episode; every other record its own entry, joined by records
  // that are the same video (the same host video id in the record's own link).
  const COUNTED = ['whole-candidate', 'alternate-edition', 'part'];
  const countedIn = new Map();
  for (const e of eps) for (const x of ups.get(e.id)) if (COUNTED.includes(x.role)) countedIn.set(x.r.id, [...(countedIn.get(x.r.id) || []), e.id]);
  const vidKey = r => {
    const u = safe(r.directUrl) || safe(r.url); if (!u) return '';
    const k = hostKind(u), url = new URL(u), seg = url.pathname.split('/').filter(Boolean), dec = x => { try { return decodeURIComponent(x); } catch { return x; } };
    if (k === 'youtube') {
      const id = url.hostname.endsWith('youtu.be') ? seg[0] : url.searchParams.get('v') || (['shorts', 'embed', 'live', 'v'].includes(seg[0]) ? seg[1] : '');
      if (/^[\w-]{11}$/.test(id || '')) return 'youtube:' + id;
      return /^[\w-]+$/.test(url.searchParams.get('list') || '') ? 'youtube-list:' + url.searchParams.get('list') : '';
    }
    if (k === 'vimeo') { const id = seg.find(x => /^\d{5,}$/.test(x)); return id ? 'vimeo:' + id : ''; }
    if (k === 'dailymotion') { const i = seg.indexOf('video'), id = url.hostname === 'dai.ly' ? seg[0] : i >= 0 ? seg[i + 1] : ''; return id ? 'dailymotion:' + id.split('_')[0].toLowerCase() : ''; }
    if (k === 'archive' && ['details', 'embed', 'download', 'stream'].includes(seg[0]) && seg[1]) {
      const file = seg.slice(2).map(dec).join('/'); return 'archive:' + dec(seg[1]) + (file ? '/' + file : '');
    }
    if (k === 'okru') { const i = seg.findIndex(x => x === 'video' || x === 'videoembed'); return i >= 0 && /^\d+$/.test(seg[i + 1] || '') ? 'okru:' + seg[i + 1] : ''; }
    if (k === 'facebook') { const i = seg.findIndex(x => x === 'videos' || x === 'reel'); const id = url.searchParams.get('v') || (i >= 0 ? seg[i + 1] : '') || (url.hostname === 'fb.watch' ? seg[0] : ''); return id ? 'facebook:' + id : ''; }
    return '';
  };
  const entries = [], entryOf = new Map(), byVid = new Map(), roleIn = new Map();
  for (const p of prods) for (const e of eps.filter(x => x.production === p.id)
    .sort((a, b) => num(a.season) - num(b.season) || num(a.number) - num(b.number) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const mem = ups.get(e.id).filter(x => COUNTED.includes(x.role) && countedIn.get(x.r.id).length === 1);
    for (const x of mem) roleIn.set(x.r.id, x.role);
    const members = [...new Set(mem.map(x => x.r))];
    if (!members.length) continue;
    const en = {id: 'ep:' + e.id, key: 'ep:' + e.id, e, members}; entries.push(en); for (const r of members) entryOf.set(r.id, en);
  }
  for (const en of entries) for (const r of en.members) { const v = vidKey(r); if (v && !byVid.has(v)) byVid.set(v, r); }
  for (const r of records) {
    if (entryOf.has(r.id)) continue;
    const v = vidKey(r), twin = v ? byVid.get(v) : null;
    if (twin) { const en = entryOf.get(twin.id); en.members.push(r); entryOf.set(r.id, en); if (roleIn.has(twin.id)) roleIn.set(r.id, roleIn.get(twin.id)); continue; }
    const en = {id: r.id, key: r.id || r.url, e: null, members: [r]}; entries.push(en); entryOf.set(r.id, en); if (v) byVid.set(v, r);
  }
  // An entry's members in link order, and the one a card shows: the first with a link that passes `ok`.
  const memberB = (en, r) => {
    const role = en.e ? roleIn.get(r.id) || 'whole-candidate' : 'whole-candidate', px = en.e ? partsOf(en.e).find(x => x.u.r === r) : null;
    return {r, role, i: px ? px.no : 0, n: px ? px.of : 0};
  };
  const rankedOf = (en, locals = {}) => en.members.map(r => [r, memberB(en, r)])
    .sort((a, b) => cmpKeys(copyKey(a[0], a[1].role, a[1].i, locals[a[0].id] || ''), copyKey(b[0], b[1].role, b[1].i, locals[b[0].id] || '')) ||
      (a[0].id < b[0].id ? -1 : a[0].id > b[0].id ? 1 : 0)).map(x => x[0]);
  const shownOf = (en, ok = () => true, locals = {}) => { const rs = rankedOf(en, locals);
    return rs.find(r => expectDest(r, locals[r.id] || '') && ok(r)) || rs.find(ok) || rs[0]; };
  const entryTitleOf = (en, r, lang = 'en') => (en.e ? epTitle(en.e, lang) : recTitleIn(r || rankedOf(en)[0], lang));
  // A production with more than eight seasons shows one season at a time: the chosen one, else the season of its earliest
  // episode with a whole link that is not marked watched.
  const paged = p => Array.isArray(p.seasons) && p.seasons.length > 8;
  const pageGroup = (p, watchedIds = new Set(), want = null) => {
    const m = prodModel(p), g = want != null && m.groups.find(x => x.season === want); if (g) return g;
    const next = m.all.find(e => cov(e) === 'whole-candidate' && !watchedIds.has(e.id));
    return (next && m.groups.find(x => x.season === (next.season ?? null))) || m.groups.find(x => x.eps.length) || m.groups[0];
  };
  // Browse counts entries: one counts when some member passes.
  const countE = pred => entries.filter(en => en.members.some(pred)).length;
  const entryStarredIn = (en, favs) => favs.has(en.key) || en.members.some(r => favs.has(r.id || r.url));
  return {records, recById, guide: g, prods, prodById, eps, ups, poss, linked, possibleIds, queued, guideStatus, recLinks, linkTag, partsOf,
    entries, entryOf, countE, memberB, rankedOf, shownOf, entryTitleOf, entryStarredIn, fmtId, paged, pageGroup, cov, ev, evSource, covLong, best, fmt, isCoreRechov, famRank, epsOf, prodModel, label, codeOf, codeText, code, epTitle, storyOf, altLabels,
    altText, hasGuide: prods.length > 0, services: SVC, licGroups, licOther, agroups};
}

// Checks of the page shell (language and theme boot, stored values, start routes) do not read the data, so they boot a light
// copy: the data without the large series (US Sesame Street), which every other check covers. A payload function still applies.
const LIGHT_SERIES = new Set(['sesame-street']);
function lightPayload(p) {
  p.records = p.records.filter(r => !LIGHT_SERIES.has(r.series));
  if (p.guide && Array.isArray(p.guide.productions)) {
    const drop = new Set(p.guide.productions.filter(x => LIGHT_SERIES.has(x.series)).map(x => x.id));
    p.guide.productions = p.guide.productions.filter(x => !drop.has(x.id));
    p.guide.episodes = p.guide.episodes.filter(e => !drop.has(e.production));
    for (const id of drop) delete p.guide.unidentified[id];
  }
  return p;
}
const bootLight = (htmlPath, o = {}) => boot(htmlPath, {...o, payload: q => { const r = lightPayload(q); return o.payload ? o.payload(r) || r : r; }});

// The Browse card of an upload: its entry's card (an episode's copies share one).
const cardKey = (M, rid) => 'card-' + (M.entryOf.get(rid) || {id: rid}).id;
// Its title: the episode's for an episode entry, else the upload's.
const cardTitle = (M, rid, lang = 'en') => { const en = M.entryOf.get(rid); return M.entryTitleOf(en, M.shownOf(en), lang); };

// ---------------------------------------------------------------- harness helpers
function harness(app) {
  const {document, ids, descendants, tree} = app;
  const $ = id => { const n = document.getElementById(id); assert(n, 'Element exists: ' + id); return n; };
  const view = () => $('view');
  const cls = n => String(n.className || '').split(' ');
  const find = (pred, within = view()) => descendants(within, pred);
  const byClass = (c, within) => find(n => cls(n).includes(c), within);
  const fkAll = (key, within = tree) => descendants(within, n => n.getAttribute && n.getAttribute('data-fk') === key);
  const fk = (key, within) => { const n = fkAll(key, within)[0]; assert(n, 'Control exists: ' + key); return n; };
  const has = (key, within) => fkAll(key, within).length > 0;
  const number = s => Number(String(s).replace(/[^\d]/g, ''));
  const chipCount = b => number(b.children.find(c => c.className === 'count').textContent);
  const text = () => view().textContent;
  const h1 = () => document.getElementById('view-title');
  const count = () => number(descendants($('count'), n => n.tagName === 'strong')[0].textContent);
  const setValue = async (id, value, event = 'change') => { const n = $(id); n.value = value; await n.fire(event); };
  const blobJson = async () => JSON.parse(await app.blobs.get(app.downloads.at(-1).url).text());
  const extLinks = within => descendants(within, n => n.tagName === 'a' && n.target === '_blank');
  // Switch the interface language as a user does: activate the unchecked option of the radio group.
  const flipLang = () => [$('lang-en'), $('lang-he')].find(o => o.getAttribute('aria-checked') !== 'true').dispatch('click');
  return {...app, $, view, cls, find, byClass, fk, fkAll, has, number, chipCount, text, h1, count, setValue, blobJson, extLinks, ids, flipLang};
}
function assertSafeLinks(H, where) {
  for (const a of H.extLinks(H.tree)) {
    const u = safe(a.href);
    assert(u, `${where}: external link has a safe http(s) URL: ${a.href}`);
    assert.equal(a.rel, 'noopener noreferrer', `${where}: external link uses rel=noopener noreferrer`);
  }
}
// Accessible name as the double can compute it: aria-label, else text outside aria-hidden parts.
function accName(n) {
  if (n.getAttribute && n.getAttribute('aria-label') !== undefined) return n.getAttribute('aria-label');
  const walk = x => (x.getAttribute && x.getAttribute('aria-hidden') === 'true' ? '' :
    (x._text || '') + x.children.map(c => (typeof c === 'string' ? c : walk(c))).join(''));
  return walk(n);
}
const connected = (H, n) => { let x = n; while (x && x.parentElement) x = x.parentElement; return !!n && x === H.tree; };
// Language of parts (WCAG 3.1.2): Hebrew text is always inside lang="he"; in the Hebrew UI, English data text (titles,
// uploaders: dir="auto" and <bdi> parts) is inside lang="en". Subtrees named by aria-label are skipped (the label wins).
const HEB_RE = /[\u0590-\u05FF]/, LAT_RE = /[A-Za-z]/;
function langIssues(root, uiLang) {
  const out = [];
  const walk = (n, eff, inData) => {
    if (!n || typeof n !== 'object' || !n.getAttribute) return;
    if (n.getAttribute('aria-hidden') === 'true' || n.getAttribute('aria-label') !== undefined) return;
    const l = n.getAttribute('lang') || eff, own = n._text || '';
    const data = inData || n.getAttribute('dir') === 'auto' || n.tagName === 'bdi';
    if (own && HEB_RE.test(own) && l !== 'he') out.push('Hebrew text outside lang="he": ' + own.slice(0, 50));
    if (uiLang === 'he' && data && own && LAT_RE.test(own) && !HEB_RE.test(own) && l !== 'en') {
      out.push('English data text outside lang="en": ' + own.slice(0, 50));
    }
    for (const c of n.children) walk(c, l, data);
  };
  walk(root, uiLang, false);
  return out;
}
// The visible label of a checked or cited URL: host, then path, query and fragment, decoded for reading.
function urlLabelOf(url) {
  const u = new URL(url), rest = u.pathname + u.search + u.hash;
  let shown = rest; try { shown = decodeURI(rest); } catch { /* keep escapes */ }
  return u.hostname.replace(/^www\./, '') + (shown === '/' ? '' : shown);
}
// Heading levels never skip (h1, then h2, ...); aria-hidden subtrees are ignored.
function headingIssues(root) {
  const out = [], levels = [];
  const walk = n => {
    if (!n || typeof n !== 'object' || !n.getAttribute || n.getAttribute('aria-hidden') === 'true') return;
    const m = /^h([1-6])$/.exec(n.tagName); if (m) levels.push([Number(m[1]), n.textContent.slice(0, 40)]);
    for (const c of n.children) walk(c);
  };
  walk(root);
  levels.forEach(([lv, text], i) => {
    const prev = i ? levels[i - 1][0] : 0;
    if (lv > prev + 1) out.push(`h${lv} "${text}" follows h${prev || 'nothing'}`);
  });
  return out;
}
function assertCleanText(H, where) {
  const s = H.text();
  assert(!/\bundefined\b|\bNaN\b|\[object Object\]/.test(s), `${where}: no undefined/NaN in rendered text`);
  for (const ph of PLACEHOLDERS) assert(!s.includes(ph), `${where}: no unfilled placeholder ${ph}`);
}
// The value of a facts row (record facts, the episode identity card) labelled with a string key, or null.
function factIn(H, lang, key) {
  const dt = H.find(n => n.tagName === 'dt' && n.textContent === tr(lang, key))[0], kids = dt && dt.parentElement.children;
  return dt ? kids[kids.indexOf(dt) + 1] : null;
}
// titleHeEditorial has its own labelled row ("Editorial Hebrew title") whenever it exists, in both languages. In English it is
// never the heading, the second line or another title row, so it is never taken for an original or alternate title. (A research
// note may quote the same words; checkEditorialTitles() checks on unique fixture values that it appears nowhere else.)
function assertEditorialRow(H, value, lang, where) {
  const dd = factIn(H, lang, 'heEdTitle');
  assert.equal(dd ? dd.textContent : '', value, where + ': the editorial Hebrew title row, only with titleHeEditorial');
  if (!value || lang !== 'en') return;
  const rows = dd.parentElement.children.filter(n => n.tagName === 'dd' && n !== dd);
  const shown = [H.h1(), ...H.byClass('lede', H.byClass('hero')[0]), ...rows].filter(n => n.textContent === value);
  assert.deepEqual(shown.map(n => n.tagName), [], where + ': in English the editorial Hebrew title is not a heading, second line or other row');
}

// ---------------------------------------------------------------- uploads (both modes)
async function checkUploads(H, M) {
  // Browse lists entries (one per episode or video); a facet counts an entry once when some member passes, and a
  // combination of filters needs one member that passes them all.
  const {records} = M, E = M.entries, N = E.length;
  const countE = (pred, es = E) => es.filter(en => en.members.some(pred)).length;
  const lang = 'en';
  await H.navigate('browse');
  assert.equal(H.h1().textContent, L.en.browseTitle);
  assert.equal(H.document.title, L.en.browseTitle + ' · ' + L.en.appName, 'document.title per view');
  assert.equal(H.count(), N, 'Every entry is listed');
  assert.equal(new Set(E.flatMap(en => en.members)).size, records.length, 'Every record belongs to exactly one entry');
  assert.equal(H.$('grid').children.length, Math.min(48, N), 'The first page holds 48 cards');
  assert(!H.byClass('tab-count', H.fk('tab-browse')).length && H.fk('tab-browse').textContent === L.en.navBrowse + L.en.navBrowseShort,
    'The Browse tab is named Browse and carries no count');
  const bySeries = k => countE(r => r.series === k);
  const byKind = (k, pred = () => true) => countE(r => kindOf(r) === k && pred(r));
  assert.equal(H.chipCount(H.fk('fs-all')), N);
  for (const k of SERIES) assert.equal(H.chipCount(H.fk('fs-' + k)), bySeries(k), 'Series count ' + k);
  for (const k of KINDS) assert.equal(H.chipCount(H.fk('fk-' + k)), byKind(k), 'Type count ' + k);
  const shownGroups = H.find(n => /^fa-/.test(n.getAttribute?.('data-fk') || '')).map(n => n.getAttribute('data-fk').slice(3));
  assert.deepEqual(shownGroups, M.agroups, 'Access filters: the fixed groups, one per described licensed model, then the rest');
  for (const g of M.agroups) {
    assert.equal(H.chipCount(H.fk('fa-' + g)), countE(r => expectGroup(r) === g), 'Access count ' + g);
  }
  assert.equal(records.filter(r => !M.agroups.includes(expectGroup(r))).length, 0, 'Every record is in one shown access group');
  if (M.hasGuide) {
    assert.equal(H.chipCount(H.fk('fg-matched')), countE(r => M.linked.has(r.id)), 'Matched count');
    assert.equal(H.chipCount(H.fk('fg-queue')), countE(r => M.queued.has(r.id)), 'Queue count');
    // A record linked only as a possible copy is neither matched nor "not in the guide".
    for (const k of ['matched', 'queue', 'possible', 'none']) {
      assert.equal(H.chipCount(H.fk('fg-' + k)), countE(r => M.guideStatus(r) === k), 'Guide status count ' + k);
    }
  } else assert(!H.has('fg-matched'), 'Without a guide there is no "In the guide" facet');
  assert(H.$('kind-help').textContent.includes(L.en.kindHelp.split('. ').at(-1)), 'Type help says selecting none includes all');
  // The cards (h3) have a results heading of their own: on phones the facet h2s are in the collapsed Filters panel.
  assert.equal(H.$('grid').getAttribute('aria-labelledby'), 'results-h'); assert.equal(H.$('results-h').tagName, 'h2');
  const withoutFacets = H.find(n => n.tagName === 'main', H.tree)[0];
  const facetsAside = H.byClass('filters')[0], kept = facetsAside.children; facetsAside.children = [];
  assert.deepEqual(headingIssues(withoutFacets), [], 'Heading levels do not skip when the Filters panel is collapsed');
  facetsAside.children = kept;
  ok('uploads facet counts derived from data');

  // Counts ignore their own facet; other facets follow the selection.
  const big = [...SERIES].sort((a, b) => bySeries(b) - bySeries(a))[0], inBig = r => r.series === big;
  await H.fk('fs-' + big).click();
  assert.equal(H.count(), bySeries(big));
  assert.equal(H.chipCount(H.fk('fs-all')), N, 'Series counts ignore the series selection');
  for (const k of SERIES) assert.equal(H.chipCount(H.fk('fs-' + k)), bySeries(k));
  for (const k of KINDS) assert.equal(H.chipCount(H.fk('fk-' + k)), byKind(k, inBig), 'Type counts follow the series selection');
  await H.fk('fs-all').click(); assert.equal(H.count(), N);
  // Selected zero-count options stay operable.
  let zero = null;
  for (const s of SERIES) for (const k of KINDS) {
    if (!zero && bySeries(s) && byKind(k) && !byKind(k, r => r.series === s)) zero = [s, k];
  }
  if (zero) {
    await H.fk('fs-' + zero[0]).click(); await H.fk('fk-' + zero[1]).click();
    assert.equal(H.count(), 0, `No ${zero[1]} in ${zero[0]}`);
    assert.equal(H.fk('fk-' + zero[1]).getAttribute('aria-pressed'), 'true', 'A zero-count selection stays visible and pressed');
    assert.equal(H.chipCount(H.fk('fk-' + zero[1])), 0);
    await H.fk('fk-' + zero[1]).click(); assert.equal(H.count(), bySeries(zero[0]), 'A selected zero option can be deselected');
    await H.fk('fs-all').click();
  }
  // Full episodes and short-series installments are separate categories.
  const shortOnly = SERIES.find(s => byKind('short-episode', r => r.series === s) && !byKind('episode', r => r.series === s));
  if (shortOnly) {
    await H.fk('fs-' + shortOnly).click(); await H.fk('fk-episode').click();
    assert.equal(H.count(), 0, 'Short-series installments do not count as full episodes');
    await H.fk('fk-episode').click(); await H.fk('fk-short-episode').click();
    assert.equal(H.count(), byKind('short-episode', r => r.series === shortOnly));
    await H.fk('fk-short-episode').click(); await H.fk('fs-all').click();
  }
  // Multi-select types; selecting none includes all.
  const two = KINDS.filter(k => byKind(k)).slice(0, 2);
  for (const k of two) await H.fk('fk-' + k).click();
  assert.equal(H.count(), countE(r => two.includes(kindOf(r))), 'Type multi-select adds categories');
  for (const k of two) await H.fk('fk-' + k).click();
  assert.equal(H.count(), N, 'Selecting no types includes all types');
  ok('counts ignore their own facet; zero-count selections retained; full vs short-series separate; multi-select');

  // Spoken: from the recorded language; a mixed value counts in each group it names; empty and 'und' are Not recorded.
  // Length: one choice at a time, up to N minutes; unknown durations pass only under Any.
  const spokenOf = r => {
    const parts = String(r.language ?? '').toLowerCase().split(/[^a-z]+/).filter(x => x && x !== 'und');
    return parts.length ? [...new Set(parts.map(x => (x === 'he' || x === 'en' ? x : 'other')))] : ['none'];
  };
  const lenOk = (r, n) => Number(r.durationSeconds) > 0 && Number(r.durationSeconds) <= n * 60;
  const SP = ['he', 'en', 'other', 'none'];
  assert.equal(H.chipCount(H.fk('fsp-all')), N, 'All languages counts every upload');
  for (const g of SP) assert.equal(H.chipCount(H.fk('fsp-' + g)), countE(r => spokenOf(r).includes(g)), 'Spoken count ' + g);
  assert(SP.reduce((n, g) => n + H.chipCount(H.fk('fsp-' + g)), 0) >= N, 'Every upload is in at least one language group');
  assert.equal(H.chipCount(H.fk('fl-any')), N);
  for (const n of [5, 10, 20, 30]) assert.equal(H.chipCount(H.fk('fl-' + n)), countE(r => lenOk(r, n)), 'Length count ' + n);
  await H.fk('fsp-he').click(); await H.fk('fsp-en').click();
  const heEnR = r => spokenOf(r).some(g => g === 'he' || g === 'en'), heEnN = countE(heEnR);
  assert.equal(H.count(), heEnN, 'Spoken choices add up (either language)');
  await H.fk('fl-10').click(); await H.fk('fl-5').click();
  assert.equal(H.fk('fl-10').getAttribute('aria-pressed'), 'false', 'Length is one choice at a time');
  assert.equal(H.count(), countE(r => heEnR(r) && lenOk(r, 5)), 'Length narrows the result (one member passes both)');
  assert(/[?&]spoken=he%2Cen(&|$)/.test(H.location.hash) && /[?&]len=5(&|$)/.test(H.location.hash), 'Spoken and length are in the hash: ' + H.location.hash);
  for (const k of [5, 10, 20, 30]) assert.equal(H.chipCount(H.fk('fl-' + k)), countE(r => heEnR(r) && lenOk(r, k)), 'Length counts ignore the length choice');
  assert.equal(H.chipCount(H.fk('fsp-other')), countE(r => lenOk(r, 5) && spokenOf(r).includes('other')), 'Spoken counts follow the length');
  assert(H.has('ux-sp-he') && H.has('ux-len'), 'Removable chips for both');
  await H.fk('ux-len').click(); assert.equal(H.count(), heEnN, 'Removing the length chip clears it');
  await H.navigate('browse?spoken=none,bogus&len=7');
  assert.equal(H.count(), countE(r => spokenOf(r).includes('none')), 'Unknown values in the hash are dropped');
  await H.fk('fsp-all').click(); assert.equal(H.count(), N, 'All languages clears the spoken choice');
  // An empty result shows the bin and one button per active filter group, each with what clearing it alone would show.
  const lone = SERIES.map(sr => [sr, SP.find(g => records.some(r => spokenOf(r).includes(g)) &&
    !records.some(r => r.series === sr && spokenOf(r).includes(g)))]).find(([, g]) => g);
  if (lone) {
    await H.fk('fs-' + lone[0]).click(); await H.fk('fsp-' + lone[1]).click();
    assert.equal(H.count(), 0, 'No ' + lone[1] + ' uploads in ' + lone[0]);
    const empty = H.byClass('empty')[0];
    assert(!empty.hidden && H.byClass('bin', empty).length === 1 && H.byClass('bin', empty)[0].getAttribute('aria-hidden') === 'true', 'The bin, hidden from assistive technology');
    assert.equal(H.fk('relax-series').textContent, tr('en', 'relaxFilter', {name: L.en.fSeries,
      n: countE(r => spokenOf(r).includes(lone[1])).toLocaleString('en-US')}), 'Clearing the series would show the language');
    assert.equal(H.fk('relax-spoken').textContent, tr('en', 'relaxFilter', {name: L.en.fSpoken, n: bySeries(lone[0]).toLocaleString('en-US')}));
    await H.fk('relax-spoken').click(); assert.equal(H.count(), bySeries(lone[0]), 'A relax button clears its group');
    await H.fk('fs-all').click();
  }
  assert.equal(H.count(), N);
  ok('spoken and length filters: counts from the recorded language and duration, mixed languages in each group, one length at a time, hash, chips, the bin and its relax buttons');

  // Search: debounced typing, aliases, pasted links by hostname.
  const typed = async q => { H.$('u-search').value = q; await H.$('u-search').fire('input'); H.flushTimers(); return H.count(); };
  H.$('u-search').value = 'zzqx-no-such-upload'; await H.$('u-search').fire('input');
  assert.equal(H.count(), N, 'Typing is debounced');
  H.flushTimers(); assert.equal(H.count(), 0, 'The debounced search runs');
  assert.equal(await typed('Chanukah'), await typed('Hanukkah'), 'Holiday spelling alias');
  assert.equal(await typed('Abigail'), await typed('Avigail'), 'Name alias');
  // Plene and defective Hebrew spellings of the Elmo show's name find the same uploads.
  const elmoN = countE(r => r.series === 'elmo');
  assert.equal(await typed('תוכנית האירוח של אלמו'), await typed('תכנית האירוח של אלמו'), 'Plene spelling תוכנית folds to תכנית');
  if (elmoN) assert(H.count() >= elmoN, 'The Elmo show name finds every Elmo upload');
  // change after the debounced render has run does not re-render (the next click must reach its target).
  await typed('a');
  const firstCard = H.$('grid').children[0];
  await H.$('u-search').fire('change');
  assert.equal(H.$('grid').children[0], firstCard, 'change after a finished search keeps the rendered cards');
  H.$('u-search').value = 'zzqx-flush'; await H.$('u-search').fire('input');
  assert.equal(H.$('grid').children[0], firstCard, 'Typing is still pending');
  await H.$('u-search').fire('change');
  assert.equal(H.count(), 0, 'change (Enter or blur) flushes a pending search at once');
  const cardIds = () => H.$('grid').children.map(li => H.find(n => /^card-/.test(n.getAttribute?.('data-fk') || ''), li)[0].getAttribute('data-fk').slice(5));
  const samples = new Map();
  for (const r of records) {
    const k = hostKind(r.url);
    if (!samples.has(k)) samples.set(k, r);
    if (r.directUrl && !samples.has('direct:' + hostKind(r.directUrl))) samples.set('direct:' + hostKind(r.directUrl), r);
  }
  for (const [k, r] of samples) {
    const url = k.startsWith('direct:') ? r.directUrl : r.url;
    await typed(url);
    assert(cardIds().includes(M.entryOf.get(r.id).id), `Pasted ${k} link finds its upload's entry: ${url}`);
    assert(H.text().includes(L.en.urlHit), 'Banner says the video is already in the library');
  }
  assert.equal(await typed('https://youtu.be/AAAAAAAAAAA'), countE(r => [r.url, r.directUrl, r.sourceUrl]
    .some(u => hostKind(u) === 'youtube' && /AAAAAAAAAAA/.test(u))), 'YouTube ids match by hostname only');
  if (H.count() === 0) assert(H.text().includes(tr('en', 'urlMiss', {id: 'AAAAAAAAAAA'})), 'Unknown video id banner');
  await typed('');
  ok('search: debounce, aliases, pasted links for ' + [...samples.keys()].join(', '));

  // Theme and character selects: counts, and selected zero-count options retained.
  const options = id => H.$(id).children.filter(n => n.tagName === 'option');
  const optCount = o => H.number(o.textContent.split(' · ').at(-1));
  const select = async (id, value) => { H.$(id).value = value; await H.$(id).fire('change'); };
  const themeOpts = options('theme').slice(1);
  if (themeOpts.length) {
    const top = [...themeOpts].sort((a, b) => optCount(b) - optCount(a))[0];
    await select('theme', top.value); assert.equal(H.count(), optCount(top), 'Theme count matches its results');
    await select('theme', '');
    const global = new Map(options('theme').map(o => [o.value, optCount(o)]));
    const chars = options('character').slice(1).sort((a, b) => optCount(b) - optCount(a));
    let done = false;
    for (const c of chars.slice(0, 8)) {
      await select('character', c.value);
      assert.equal(options('theme').length, global.size, 'Theme options stay listed (with zero counts) under other filters');
      const z = options('theme').slice(1).find(o => optCount(o) === 0 && global.get(o.value) > 0);
      if (!z) continue;
      await select('theme', z.value); assert.equal(H.count(), 0);
      assert.equal(optCount(options('theme').find(o => o.value === z.value)), 0, 'A selected zero-count theme is retained');
      assert.equal(H.$('theme').value, z.value);
      assert.equal(optCount(options('character').find(o => o.value === c.value)), 0, 'A selected zero-count character is retained');
      done = true; break;
    }
    await H.fk('f-clear').click();
    assert.equal(H.count(), N); assert.equal(H.$('theme').value, ''); assert.equal(H.$('character').value, '');
    ok('theme and character options' + (done ? ' keep selected zero counts' : ' (no zero combination in this data)'));
  }

  // Longest first, unknown runtimes last; every card's watch link, host label and access line.
  await select('u-sort', 'longest');
  // "Show more" appends: the cards already shown are the same nodes, and focus moves to the first new card.
  const pageOne = [...H.$('grid').children];
  let pages = 0; while (H.has('more', H.view())) {
    assert(++pages <= Math.ceil(N / 48), 'Paging ends');
    const before = H.$('grid').children.length; await H.fk('more').click();
    assert.equal(H.document.activeElement, H.find(n => /^card-/.test(n.getAttribute?.('data-fk') || ''), H.$('grid').children[before])[0],
      'Show more focuses the first new card');
  }
  assert.equal(H.$('grid').children.length, N, 'All cards load in pages of 48');
  pageOne.forEach((li, i) => assert.equal(H.$('grid').children[i], li, 'Show more keeps the cards already shown'));
  const secs = r => { const s = Number(r.durationSeconds); return Number.isFinite(s) && s > 0 ? s : -1; };
  let prev = Infinity, unknown = false, played = 0;
  const enById = new Map(E.map(en => [en.id, en])), shownIds = new Set();
  for (const li of H.$('grid').children) {
    const id = H.find(n => /^card-/.test(n.getAttribute?.('data-fk') || ''), li)[0].getAttribute('data-fk').slice(5);
    const en = enById.get(id), r = M.shownOf(en), s = secs(r); shownIds.add(r.id);
    // The card shows the entry's first member in link order, and names the episode for an episode entry.
    assert.equal(H.fk('card-' + id, li).textContent, M.entryTitleOf(en, r), 'Card title: ' + id);
    if (en.members.length > 1) {
      const also = [...new Set(M.rankedOf(en).filter(m => m !== r).map(m => expectHostLabel(m, lang)))].filter(h => h !== expectHostLabel(r, lang));
      const al = H.byClass('u-also', li);
      assert.equal(al.length ? al[0].textContent : '', also.length ? tr('en', 'alsoOn', {hosts: also.join(', ')}) : '', 'Other hosts named: ' + id);
    } else assert(!H.byClass('u-also', li).length, 'A single copy names no other host: ' + id);
    if (s < 0) unknown = true; else { assert(!unknown, 'Known runtimes precede unknown ones'); assert(s <= prev, 'Runtime order descends'); prev = s; }
    const links = H.extLinks(li); assert.equal(links.length, 1, 'One watch link per card');
    assert.equal(links[0].href, expectDest(r), 'Watch link targets the indexed host URL: ' + id);
    assert(links[0].textContent.startsWith(expectWatchBase(r, lang)), 'Watch label names the host, or says licensed: ' + links[0].textContent);
    assert(links[0].getAttribute('aria-label').includes(M.entryTitleOf(en, r)), 'Card watch links name their entry: ' + id);
    assert.equal(H.byClass('u-host', li)[0].textContent, expectHostLabel(r, lang), 'Host label by hostname: ' + id);
    const access = H.byClass('u-access', li)[0].textContent;
    assert.equal(access, expectAccessText(r, lang), 'Access line: ' + id);
    if (access.startsWith(L.en.acc_played)) played++;
  }
  const claimed = records.filter(r => r.playbackVerified === true && r.playbackWithoutVpn === true && shownIds.has(r.id));
  assert.equal(played, claimed.length, 'Only records with recorded playback outside the VPN claim it');
  if (H.payload.meta && 'playerLinksDiscovered' in H.payload.meta) {
    assert.equal(records.filter(r => r.directLinkProvenance).length, H.payload.meta.playerLinksDiscovered, 'All discovered Vimeo links remain');
  }
  ok('longest-first sort with unknown last; titles, other hosts, watch links, host labels and access lines for all ' + N + ' cards (entries)');

  // Starred entries: star, starred-only, clear keeps the starred list, Starred tab.
  const longest = enById.get(cardIds()[0]);
  const star = H.fk('star-' + longest.id), starName = star.getAttribute('aria-label');
  assert.equal(starName, tr('en', 'starAria', {title: M.entryTitleOf(longest, M.shownOf(longest))}));
  assert.equal(star.getAttribute('aria-pressed'), 'false', 'The star is a toggle button (aria-pressed)');
  const shownBefore = [...H.$('grid').children];
  await star.click();
  assert.equal(H.fk('star-' + longest.id).getAttribute('aria-pressed'), 'true');
  assert.equal(H.fk('star-' + longest.id), star, 'A star toggle updates the button in place');
  assert.deepEqual([...H.$('grid').children], shownBefore, 'A star toggle in Browse does not rebuild the cards');
  assert.equal(H.$('toast').textContent, L.en.starredToast, 'Starring says the star stays in this browser');
  assert.equal(H.chipCount(H.fk('f-starred')), 1, 'The Starred only count follows the star');
  assert.equal(H.byClass('lbl', H.fk('f-starred'))[0].textContent, L.en.starredOnly);
  assert.equal(H.fk('star-' + longest.id).getAttribute('aria-label'), starName, 'Star keeps a stable name');
  assert.equal(H.number(H.byClass('tab-count', H.fk('tab-starred'))[0].textContent), 1);
  assert.equal(H.fk('tab-starred').href, '#/starred', 'The Starred tab opens #/starred');
  assert(H.byClass('long', H.fk('tab-starred'))[0].textContent === L.en.navStarred &&
    H.byClass('short', H.fk('tab-starred'))[0].textContent === L.en.navStarredShort, 'The Starred tab is named Starred');
  await select('u-sort', 'series');
  assert.equal(H.$('grid').children.length, Math.min(48, N), 'Changing the sort shows the first page again');
  await H.fk('f-starred').click(); assert.equal(H.count(), 1);
  await H.fk('f-clear').click(); assert.equal(H.count(), N);
  await H.fk('f-starred').click(); assert.equal(H.count(), 1, 'Clearing filters preserves the starred list');
  // "Starred only" carried into Starred: no phantom active filter, no starred=1 in the hash.
  await H.fk('tab-starred').click();
  assert.equal(H.h1().textContent, L.en.starredTitle);
  assert.equal(H.document.title, L.en.starredTitle + ' · ' + L.en.appName, 'document.title names the Starred view');
  assert.equal(H.location.hash, '#/starred', 'The Starred view is #/starred');
  assert.equal(accName(H.fk('filters-toggle')), L.en.filters, 'Starred does not count a carried-over "Starred only" flag');
  assert(!H.has('f-clear', H.view()) && !/starred=1|saved=1/.test(H.location.hash), 'Starred has no hidden filter: ' + H.location.hash);
  await H.fk('tab-browse').click();
  assert.equal(H.fk('f-starred').getAttribute('aria-pressed'), 'true', 'Back in Browse, "Starred only" is still on');
  assert(H.location.hash.includes('starred=1') && !H.location.hash.includes('saved=1'), 'The filter is written as starred=1');
  await H.fk('f-clear').click();
  await H.navigate('starred'); assert.equal(H.h1().textContent, L.en.starredTitle); assert.equal(H.count(), 1);
  // Old bookmarks: #/saved and ?saved=1 land on the Starred view and filter, and the hash is rewritten to the new names.
  await H.navigate('saved');
  assert(H.h1().textContent === L.en.starredTitle && H.count() === 1 && H.location.hash === '#/starred', '#/saved opens Starred: ' + H.location.hash);
  await H.navigate('uploads?saved=1');
  assert(H.fk('f-starred').getAttribute('aria-pressed') === 'true' && H.count() === 1, '?saved=1 turns on Starred only');
  assert.equal(H.location.hash, '#/browse?starred=1', 'The old view and filter names are rewritten');
  await H.fk('f-clear').click();
  await H.navigate('starred');
  ok('stars: toggle with stable name, Starred only, clear filters, Starred view (#/starred; #/saved and #/uploads?saved=1 still land there); ' +
    'star, paging and sort without rebuilding shown cards');
  return longest;
}

async function checkVimeoAndBackups(H, M, starredEntry) {
  const hop = M.records.filter(r => hostKind(r.url) === 'hop' && r.directUrl && expectAccess(r) === 'vimeo');
  if (hop.length) {
    const r = hop[0];
    await H.navigate('record/' + r.id);
    assert.equal(H.fk('rec-access').textContent, expectAccessText(r, 'en'));
    assert(H.has('rec-hop'), 'Hop page action is offered alongside the direct link');
    const form = H.find(n => n.tagName === 'form')[0];
    for (const bad of ['https://example.org/123', 'http://vimeo.com/123456', 'https://user:pw@vimeo.com/123456']) {
      H.$('vimeo-url').value = bad; await form.fire('submit');
      assert.equal(H.$('vimeo-err').textContent, L.en.invalidVimeo, 'Rejected: ' + bad);
    }
    assert(!H.storage.get('sumsum-vimeo-mappings') || !JSON.parse(H.storage.get('sumsum-vimeo-mappings'))[r.id]);
    const exact = 'https://vimeo.com/916707529/6cdb440a7c?share=copy#t=14s';
    H.$('vimeo-url').value = exact; await H.find(n => n.tagName === 'form')[0].fire('submit');
    const stored = JSON.parse(H.storage.get('sumsum-vimeo-mappings'))[r.id];
    assert.equal(stored.url, exact, 'A pasted link keeps its privacy hash, query and fragment');
    assert(stored.sourceUrl && stored.savedAt && 'titleHe' in stored, 'Mapping entry shape {url, sourceUrl, titleHe, savedAt}');
    assert.equal(H.fk('rec-watch').href, exact, 'The pasted Vimeo link wins over the discovered one');
    assert.equal(H.fk('rec-access').textContent, L.en.acc_local);
    await H.$('export-mappings').click();
    const backup = await H.blobJson();
    assert.equal(backup.format, 'sumsum-direct-links-v1');
    assert.equal(backup.mappings[r.id].url, exact);
    assert.deepEqual(backup.favorites, [starredEntry.key], 'Backup includes stars (the favorites list, as before), keyed by entry');
    assert(Array.isArray(backup.watched), 'Backup carries watched marks');
    ok('Vimeo link validation, exact URL preservation, sumsum-direct-links-v1 backup');
    // Recorded playback belongs to an exact URL: a different pasted link is "your pasted link", not "played".
    const playedHop = M.records.find(x => hostKind(x.url) === 'hop' && expectAccess(x) === 'played');
    if (playedHop) {
      await H.navigate('record/' + playedHop.id);
      assert(H.fk('rec-access').textContent.startsWith(L.en.acc_played));
      H.$('vimeo-url').value = 'https://vimeo.com/123456789/0000000000'; await H.find(n => n.tagName === 'form')[0].fire('submit');
      assert.equal(H.fk('rec-access').textContent, L.en.acc_local, 'Playback evidence does not transfer to another URL');
      await H.fk('map-remove').click();
      assert(H.fk('rec-access').textContent.startsWith(L.en.acc_played), 'Removing the pasted link restores the checked URL');
      assert(!JSON.parse(H.storage.get('sumsum-vimeo-mappings'))[playedHop.id]);
    }
    if (hop[1]) {
      const r2 = hop[1];
      H.$('import-mappings').files = [{size: 1000, text: async () => JSON.stringify({records: [{id: r2.id, url: r2.url, directUrl: r2.directUrl}],
        completedAt: '2026-10-17'})}];
      await H.$('import-mappings').fire('change');
      assert.equal(JSON.parse(H.storage.get('sumsum-vimeo-mappings'))[r2.id].url, r2.directUrl, 'Collector report imports');
      assert.equal(H.$('toast').textContent, tr('en', 'imported', {n: '1', f: '0', w: '0', o: '0', s: '0'}));
    }
  }
  const importJson = async (value, size = 1000) => {
    H.$('import-mappings').files = [{size, text: async () => (typeof value === 'string' ? value : JSON.stringify(value))}];
    await H.$('import-mappings').fire('change');
  };
  await importJson({'bare-key': 'https://vimeo.com/123456789/abcdef1234'});
  assert(JSON.parse(H.storage.get('sumsum-vimeo-mappings'))['bare-key'], 'Bare mapping object imports');
  await importJson({format: 'sumsum-direct-links-v1', mappings: {'old-key': {url: 'https://vimeo.com/22222222/abcd'}}, favorites: [starredEntry.key]});
  assert(JSON.parse(H.storage.get('sumsum-vimeo-mappings'))['old-key'], 'Backups without watched marks still import');
  // A backup's stars and watched marks import on their own (review round 1): no mappings, two records not starred yet and one
  // watched mark, so the import can succeed only through the favorites and watched lists. Stars keep their backup field
  // (`favorites`), so older backups load.
  const favsBefore = JSON.parse(H.storage.get('sumsum-favorites') || '[]'), watchedBefore = JSON.parse(H.storage.get('sumsum-watched') || '[]');
  // Two records of two entries that are not starred yet (an old backup holds record keys; each stars its entry).
  const freshEns = M.entries.filter(en => !M.entryStarredIn(en, new Set(favsBefore))).slice(0, 2);
  const newStars = freshEns.map(en => en.members[0].id);
  const newWatch = (M.eps.find(e => !watchedBefore.includes(e.id)) || {}).id;
  if (newStars.length === 2 && newWatch) {
    await importJson({format: 'sumsum-direct-links-v1', mappings: {}, favorites: newStars, watched: [newWatch]});
    assert.equal(H.$('toast').textContent, tr('en', 'imported', {n: '0', f: '2', w: '1', o: '0', s: '0'}), 'A stars-only backup reports its stars and watched mark');
    const favsAfter = JSON.parse(H.storage.get('sumsum-favorites'));
    assert(newStars.every(id => favsAfter.includes(id)) && favsBefore.every(id => favsAfter.includes(id)), 'Imported stars join the stored ones');
    assert(JSON.parse(H.storage.get('sumsum-watched')).includes(newWatch), 'The imported watched mark is stored');
    await H.navigate('starred');
    for (const en of freshEns) assert(H.has('card-' + en.id, H.view()), 'Starred lists an imported star\'s entry: ' + en.id);
    assert.equal(H.number(H.byClass('tab-count', H.fk('tab-starred'))[0].textContent),
      M.entries.filter(en => M.entryStarredIn(en, new Set(favsAfter))).length, 'The Starred count includes them (entries)');
    // Undo them through the page, so the later checks see the earlier state.
    for (const id of newStars) { await H.navigate('record/' + encodeURIComponent(id)); await H.fk('rec-star').click(); }
    await H.navigate('episode/' + encodeURIComponent(newWatch)); await H.fk('watch-toggle').click();
    assert.deepEqual(JSON.parse(H.storage.get('sumsum-favorites')), favsBefore, 'The imported stars are removed again');
    assert.deepEqual(JSON.parse(H.storage.get('sumsum-watched')), watchedBefore, 'and the watched mark');
  }
  // Opens and the queue (sumsum-opened, sumsum-sitting) import on their own; each entry is checked, a merge keeps the higher
  // count and the later date, and importing the same backup twice changes nothing.
  {
    const [r1, r2, r3] = M.records, k1 = r1.id || r1.url, k2 = r2.id || r2.url, k3 = r3.id || r3.url;
    const before = JSON.parse(H.storage.get('sumsum-opened') || '{}'), sitBefore = JSON.parse(H.storage.get('sumsum-sitting') || '[]');
    const value = {format: 'sumsum-direct-links-v1', opened: {[k1]: {n: 3, last: '2026-10-01T10:00:00.000Z'},
      [k2]: {n: 0, last: '2026-10-01'}, [k3]: {n: 2, last: 'not a date'}, constructor: {n: 4, last: '2026-10-01'}}, sitting: [k2, k1, k2, 7]};
    await importJson(value);
    assert.equal(H.$('toast').textContent, tr('en', 'imported', {n: '0', f: '0', w: '0', o: '1', s: '2'}),
      'A backup holding only opens and a queue imports, and malformed entries are dropped one by one');
    let opened = JSON.parse(H.storage.get('sumsum-opened'));
    assert.deepEqual(opened[k1], before[k1] ? {n: Math.max(3, before[k1].n), last: before[k1].last > value.opened[k1].last ? before[k1].last : value.opened[k1].last} :
      {n: 3, last: '2026-10-01T10:00:00.000Z'}, 'An imported open count is stored');
    assert(!(k2 in opened && !(k2 in before)) && !(k3 in opened && !(k3 in before)) && !Object.hasOwn(opened, 'constructor'),
      'A count under 1, a bad date and a prototype key are dropped');
    const sit = JSON.parse(H.storage.get('sumsum-sitting'));
    assert.deepEqual(sit, [...new Set([...sitBefore, k2, k1])], 'Queued items are appended in order, without repeats');
    const snapshot = [H.storage.get('sumsum-opened'), H.storage.get('sumsum-sitting')];
    await importJson(value);
    assert.deepEqual([H.storage.get('sumsum-opened'), H.storage.get('sumsum-sitting')], snapshot, 'Importing the same backup twice changes nothing');
    await importJson({format: 'sumsum-direct-links-v1', opened: {[k1]: {n: 1, last: '2027-01-01T00:00:00.000Z'}}});
    opened = JSON.parse(H.storage.get('sumsum-opened'));
    assert.deepEqual(opened[k1], {n: Math.max(3, before[k1] ? before[k1].n : 0), last: '2027-01-01T00:00:00.000Z'},
      'A merge keeps the higher count and the later date');
    await H.$('export-mappings').click();
    const out = await H.blobJson();
    assert.deepEqual(out.opened, opened, 'The backup carries the opens');
    assert.deepEqual(out.sitting, sit, 'and the queue, in order');
    await importJson({format: 'sumsum-direct-links-v1', opened: {[k1]: {n: 'x'}}, sitting: [7]});
    assert.equal(H.$('toast').textContent, L.en.invalidImport, 'A backup with nothing valid is refused');
    // A Watch link on a viewing surface (a Browse card) counts an open on a primary or middle click, never on another button,
    // and stays in the page after its click (a link removed during its own click does not navigate). A record page's link is
    // for checking and does not count.
    await H.navigate('browse');
    const card = H.byClass('ucard').find(c => H.byClass('u-actions', c)[0] && H.extLinks(H.byClass('u-actions', c)[0]).length);
    const w = H.extLinks(H.byClass('u-actions', card)[0])[0];
    const rid = H.find(n => n.getAttribute && (n.getAttribute('data-fk') || '').startsWith('card-'), card)[0].getAttribute('data-fk').slice(5);
    const rec = M.shownOf(M.entries.find(en => en.id === rid)), key = rec.id || rec.url, nOf = () => (JSON.parse(H.storage.get('sumsum-opened') || '{}')[key] || {n: 0}).n;
    const n0 = nOf();
    await w.click(); assert(w.isConnected, 'The clicked Watch link is still in the page'); H.flushTimers();
    assert.equal(nOf(), n0 + 1, 'A click on a card\'s Watch link counts an open');
    await w.fire('auxclick', {button: 1}); assert.equal(nOf(), n0 + 2, 'A middle click counts too');
    await w.fire('auxclick', {button: 2}); await w.fire('click', {button: 2}); assert.equal(nOf(), n0 + 2, 'Another button does not');
    await H.navigate('record/' + encodeURIComponent(rec.id));
    if (H.has('rec-watch')) { await H.fk('rec-watch').click(); H.flushTimers(); assert.equal(nOf(), n0 + 2, 'A record page\'s Watch link does not count'); }
    ok('opens and queue: backup export and import (only these fields, malformed entries, merge, idempotent); opens counted from viewing surfaces only');
  }
  await importJson('{"__proto__": "https://vimeo.com/33333333"}');
  assert.equal(H.$('toast').textContent, L.en.invalidImport, 'Prototype keys are refused');
  assert(!Object.hasOwn(JSON.parse(H.storage.get('sumsum-vimeo-mappings')), '__proto__'));
  await importJson('{}', 6000000); assert.equal(H.$('toast').textContent, L.en.invalidImport, 'Files over 5 MB are refused');
  await importJson('not json'); assert.equal(H.$('toast').textContent, L.en.invalidImport);
  await H.$('export-library').click();
  const lib = await H.blobJson();
  assert.equal(lib.records.length, M.records.length, 'Library export carries every record');
  assert(lib.guide && Array.isArray(lib.guide.productions), 'Library export carries the guide');
  assert.equal(lib.guide.episodes.length, M.guide.episodes.length);
  assert.deepEqual(lib.guide, H.payload.guide, 'Library export writes the embedded guide with all its keys');
  assert.deepEqual(lib.meta, H.payload.meta);
  ok('imports: collector report, bare mapping, old backup; refusals; library export');
}

// ---------------------------------------------------------------- guide (sample build, or real data once it exists)
async function checkGuide(H, M) {
  const {prods, eps, cov, ev} = M;
  const name = p => p.nameEn || p.nameHe;
  await H.navigate('guide');
  assert.equal(H.h1().textContent, L.en.guideTitle);
  assert.equal(H.document.title, L.en.guideTitle + ' · ' + L.en.appName);
  assert(!/\d\s?%/.test(H.text()), 'No percentage in the guide');
  // Goal panel: core Rechov only, floors from data.
  const goal = H.byClass('goal')[0];
  if (prods.some(M.isCoreRechov)) {
    assert(goal, 'Goal panel present');
    for (const {series, en: label} of GOAL) {
      const ps = prods.filter(p => p.series === series && M.isCoreRechov(p)); if (!ps.length) continue;
      const ms = ps.map(M.prodModel);
      const known = ms.reduce((s, m) => s + m.knownFloor, 0), inferred = ms.reduce((s, m) => s + m.numberingFloor, 0);
      const whole = ps.reduce((s, p) => s + M.epsOf.get(p.id).filter(e => cov(e) === 'whole-candidate').length, 0);
      const row = H.byClass('goal-row', goal).find(n => n.children[0].textContent === label);
      assert(row, 'Goal row for ' + series);
      assert(row.textContent.includes(tr('en', 'goalKnown', {n: known.toLocaleString('en-US')})), `${series} known floor ${known}`);
      assert.equal(row.textContent.includes(tr('en', 'goalInferred', {n: inferred.toLocaleString('en-US')})), inferred > known,
        `${series} numbering inference ${inferred} shown only above the known floor`);
      assert.equal(H.number(H.byClass('goal-big', row)[0].children[0].textContent), whole, `${series} whole count`);
    }
    for (const p of prods.filter(p => !M.isCoreRechov(p))) assert(goal.textContent.includes(name(p)), 'Counted separately: ' + name(p));
    // Related series are labelled as such under "Counted separately" and never enter the core floors above.
    const sep = H.byClass('sep-list', goal)[0];
    for (const p of prods.filter(p => p.format === 'related-series')) {
      const li = sep.children.find(n => n.textContent.includes(name(p)));
      assert(li && li.textContent.includes(L.en['fs_related-series']), 'Related series labelled under "Counted separately": ' + name(p));
    }
    // Each entry states its identified and whole counts, and a known total with them ("0 of 20 identified").
    const f = n => n.toLocaleString('en-US');
    for (const p of prods.filter(q => !M.isCoreRechov(q) && q.format !== 'queue')) {
      const m = M.prodModel(p), li = sep.children.find(n => n.children[0] && n.children[0].textContent === name(p));
      const whole = M.epsOf.get(p.id).filter(e => cov(e) === 'whole-candidate').length;
      const want = m.ts === 'known' ? tr('en', 'sepStatOf', {known: f(m.all.length), total: f(m.exp), whole: f(whole)}) :
        tr('en', 'sepStat', {known: f(m.all.length), whole: f(whole)});
      assert(li && li.textContent.endsWith(want), `"Counted separately" states ${want}: ${li && li.textContent}`);
    }
    ok('goal panel counts core Rechov only; floors and inference from data; separate entries state known totals');
  }
  for (const p of prods) {
    const m = M.prodModel(p);
    if (m.ts === 'known') assert(m.all.length + m.slots <= Math.max(m.exp, m.all.length), 'Identified plus expected stay within ' + p.id);
  }
  // Strips: every numbered episode has a cell; gaps and expected cells match the model; inferred marking. A paged production
  // (one season at a time) draws no strip on the all-productions guide; its seasons are checked on its own page below.
  const cells = H.find(n => n.tagName === 'a' && H.cls(n).includes('cell'));
  let gaps = 0, exps = 0, total = 0;
  const flat = prods.filter(p => !M.paged(p));
  for (const p of flat) for (const g of M.prodModel(p).groups) {
    total += g.len; gaps += g.gaps; exps += g.expCells;
    for (const e of g.byNum.values()) assert(cells.some(c => c.href === '#/episode/' + e.id), 'Strip cell for ' + e.id);
  }
  assert.equal(cells.length, total, 'Strip cells drawn up to the highest number or season total');
  assert.equal(cells.filter(c => H.cls(c).includes('gap')).length, gaps, 'Gap cells');
  assert.equal(cells.filter(c => H.cls(c).includes('exp')).length, exps, 'Expected cells');
  const strips = H.find(n => n.tagName === 'ul' && H.cls(n).includes('strip'));
  const numberings = flat.flatMap(p => M.prodModel(p).groups.filter(g => g.len).map(g => g.numbering));
  assert.equal(strips.length, numberings.length);
  strips.forEach((s, i) => assert.equal(H.cls(s).includes('inferred'), numberings[i] !== 'documented', 'Strip numbering marking'));
  for (const p of flat) {
    const m = M.prodModel(p);
    for (const g of m.groups) if (!g.len && g.open) assert(H.text().includes(tr('en', 'slotsCaption', {n: g.open.toLocaleString('en-US')})));
  }
  // Tile budget in the all-productions album: twelve per production, from the season a paged production shows first.
  const tiles = () => H.byClass('tile'), watchedNow = () => new Set(JSON.parse(H.storage.get('sumsum-watched') || '[]'));
  assert.equal(tiles().length, prods.reduce((s, p) => s + Math.min(12, M.paged(p) ? M.pageGroup(p, watchedNow()).eps.length : M.epsOf.get(p.id).length), 0),
    'Twelve tiles per production');
  // "Show all" counts what it reveals: for a paged production, the episodes of the season it shows, not of every season.
  for (const p of prods.filter(M.paged)) {
    const n = M.pageGroup(p, watchedNow()).eps.length;
    if (n > 12) assert.equal(H.fk('more-' + p.id).textContent, tr('en', 'showAllEps', {n: n.toLocaleString('en-US')}), 'Show all counts one season: ' + p.id);
  }
  // A paged production: every season on its own page (?season=N), with its strip (excluded numbers skipped) and every tile.
  let pagedSeasons = 0;
  for (const p of prods.filter(M.paged)) {
    for (const g of M.prodModel(p).groups) {
      await H.navigate('guide/' + encodeURIComponent(p.id) + '?season=' + g.season);
      assert.equal(H.location.hash, '#/guide/' + encodeURIComponent(p.id) + '?season=' + g.season, 'The season is in the route');
      assert.equal(H.$('season-pick').value, String(g.season), 'The select shows the season');
      const sc = H.find(n => n.tagName === 'a' && H.cls(n).includes('cell'));
      assert.equal(sc.length, g.len, `Season ${g.season}: one cell per number, excluded numbers skipped`);
      for (const n of g.excluded) assert(!H.has('cell-' + p.id + '-' + g.season + '-' + n), 'No cell for excluded number ' + n);
      for (const e of g.byNum.values()) assert(sc.some(c => c.href === '#/episode/' + e.id && c.textContent === M.fmtId(p, e.number)), 'Padded cell for ' + e.id);
      assert.equal(tiles().length, g.eps.length, `Season ${g.season}: every tile`);
      pagedSeasons++;
    }
    // The select changes the season and keeps focus on itself.
    const two = M.prodModel(p).groups[1];
    await H.navigate('guide/' + encodeURIComponent(p.id));
    H.$('season-pick').value = String(two.season); await H.$('season-pick').fire('change');
    assert(H.location.hash.endsWith('?season=' + two.season) && H.document.activeElement === H.$('season-pick'), 'The select picks a season');
    // A search spans every season, without strips.
    const last = M.prodModel(p).groups.at(-1).eps[0];
    await H.navigate('guide/' + encodeURIComponent(p.id) + '?season=' + two.season + '&q=' + encodeURIComponent(M.code(last))); H.flushTimers();
    assert(H.has('ep-' + last.id, H.view()) && !H.find(n => n.tagName === 'ul' && H.cls(n).includes('strip')).length,
      'A search finds an episode of another season, without strips');
  }
  await H.navigate('guide');
  ok(`strips: ${total} cells, ${gaps} gaps, ${exps} expected; numbering marked; tile budget; ${pagedSeasons} seasons of paged productions ` +
    'on their own pages (route, select, padded cells, excluded numbers, every tile), searches across seasons');
  await checkNumbering(H, M);

  // Coverage chips: counts ignore their own selection; scope in the status line; hash replace.
  const covCount = c => eps.filter(e => cov(e) === c).length;
  for (const c of ['whole-candidate', 'parts-only', 'excerpt-only', 'missing']) assert.equal(H.chipCount(H.fk('cov-' + c)), covCount(c));
  const someCov = ['missing', 'parts-only', 'excerpt-only'].find(covCount) || 'whole-candidate';
  await H.fk('cov-' + someCov).click();
  assert.equal(H.fk('cov-' + someCov).getAttribute('aria-pressed'), 'true');
  assert.equal(tiles().length, prods.reduce((s, p) => s + Math.min(12, M.epsOf.get(p.id).filter(e => cov(e) === someCov).length), 0));
  for (const c of ['whole-candidate', 'parts-only']) assert.equal(H.chipCount(H.fk('cov-' + c)), covCount(c), 'Coverage counts ignore their own selection');
  assert(H.text().includes(tr('en', 'statusScope', {scope: L.en.scopeAll})), 'The status line states its scope');
  assert.equal(H.history.at(-1).type, 'replace'); assert(H.history.at(-1).hash.includes('cov=' + someCov), 'Filters live in the hash (replace)');
  await H.fk('cov-' + someCov).click();
  // Format filter rescopes every count.
  await H.fk('more-btn').click(); assert.equal(H.fk('more-btn').getAttribute('aria-expanded'), 'true');
  const fmtCount = f => eps.filter(e => M.prodById.get(e.production).format === f);
  const otherFmt = ['short-series', 'talk-show', 'home-video'].find(f => fmtCount(f).length);
  if (otherFmt) {
    await H.fk('fmt-' + otherFmt).click();
    assert.equal(H.chipCount(H.fk('cov-whole-candidate')), fmtCount(otherFmt).filter(e => cov(e) === 'whole-candidate').length, 'Format rescopes coverage counts');
    assert(H.text().includes(tr('en', 'scopeFormats', {list: L.en['fs_' + otherFmt]})), 'Format scope stated');
    await H.fk('fmt-' + otherFmt).click();
  }
  // A format filter scopes whole productions: their expected-slot and gap placeholders stay counted and undimmed.
  await H.fk('more-btn').click();
  const status = () => H.byClass('status-line')[0].textContent;
  const sum = (ps, f) => ps.reduce((n, p) => n + M.prodModel(p)[f], 0);
  const core = prods.filter(p => p.format === 'core');
  if (core.length) {
    await H.navigate('guide?fmt=core');
    const slots = sum(core, 'slots'), gaps = sum(core, 'inferredGaps');
    if (slots) assert(status().includes(tr('en', 'statusSlots', {n: slots.toLocaleString('en-US')})), 'fmt=core keeps expected slots: ' + status());
    if (gaps) assert(status().includes(tr('en', 'statusGaps', {n: gaps.toLocaleString('en-US')})), 'fmt=core keeps number gaps: ' + status());
    assert.equal(H.find(n => H.cls(n).includes('dim')).length, 0, 'A format filter dims no placeholder cells');
    const withSlots = core.find(p => M.prodModel(p).slots || M.prodModel(p).inferredGaps);
    if (withSlots) {
      await H.navigate('guide/' + encodeURIComponent(withSlots.id)); const plain = status().split(' · ').slice(-2).join(' · ');
      await H.navigate('guide/' + encodeURIComponent(withSlots.id) + '?fmt=core');
      assert(status().endsWith(plain), 'A production scope keeps its placeholder counts under its own format filter');
    }
    await H.navigate('guide?fmt='); await H.navigate('guide');
  }
  await H.fk('more-btn').click();
  for (const k of ['none', ...EVS]) {
    const n = eps.filter(e => (ev(e) || 'none') === k).length, chip = H.fk('ev-' + k);
    assert.equal(H.chipCount(chip), n, 'Derived evidence count ' + k);
    if (!n) assert(H.cls(chip).includes('zero'), 'Zero evidence levels stay listed');
  }
  for (const k of ['documented', 'provisional', 'uploader-label']) assert.equal(H.chipCount(H.fk('conf-' + k)), eps.filter(e => e.confidence === k).length);
  assert(H.has('mine-unwatched'), '"Not watched yet" is its own group');
  await H.fk('more-btn').click();
  ok('coverage, format, evidence and identity chips with self-ignoring counts; scoped status line');

  // Search: title, id, pasted links, aliases.
  const titled = eps.find(e => e.titleEn && M.ups.get(e.id).length) || eps.find(e => e.titleEn);
  // A browser fires input while typing, then change on Enter or blur; change flushes the pending render.
  const search = async q => { H.$('g-search').value = q; await H.$('g-search').fire('input'); await H.$('g-search').fire('change'); };
  if (titled) { await search(titled.titleEn); assert(H.has('ep-' + titled.id, H.view()), 'Title search finds ' + titled.id); }
  // Leaving the box (change) after the debounced render has run keeps the rendered tiles, so the click lands.
  if (titled) {
    const tile = H.fk('ep-' + titled.id), chip = H.fk('cov-whole-candidate');
    await H.$('g-search').fire('change');
    assert.equal(H.fk('ep-' + titled.id), tile, 'change after a finished search does not re-render the tiles');
    assert.equal(H.fk('cov-whole-candidate'), chip, 'or the coverage chips');
  }
  const withUp = eps.find(e => M.ups.get(e.id).length);
  if (withUp) {
    await search(M.ups.get(withUp.id)[0].r.url);
    assert(H.text().includes(L.en.urlHit)); assert(H.has('ep-' + withUp.id, H.view()), 'Pasted link finds its episode');
  }
  await search('https://youtu.be/AAAAAAAAAAA');
  assert(H.text().includes(tr('en', 'urlMiss', {id: 'AAAAAAAAAAA'})), 'Unknown link banner');
  await search('chanukah'); const chan = tiles().length; await search('hanukkah'); assert.equal(tiles().length, chan, 'Alias in guide search');
  H.$('g-search').value = 'zzqx'; await H.$('g-search').fire('input'); H.flushTimers();
  assert(H.text().includes(L.en.noMatchesGuide), 'No-results state'); await H.fk('empty-clear').click();
  assert.equal(H.document.activeElement, H.$('g-search'), 'Clear filters returns focus to the search box');
  ok('guide search: title, pasted links, unknown links, aliases, no-results state');

  // Layouts.
  await H.fk('layout-numbers').click();
  assert.equal(tiles().length, 0); assert(H.byClass('strip').length > 0); assert.equal(H.storage.get('sumsum-guide-layout'), '"numbers"');
  for (const u of H.byClass('unnum')) {
    assert.equal(u.getAttribute('role'), 'group', 'Unnumbered episodes form a group');
    assert.equal(H.$(u.getAttribute('aria-labelledby')).textContent, L.en.unnumbered, 'labelled by a visible heading');
  }
  await H.fk('layout-list').click(); assert(H.byClass('eptable').length > 0, 'List layout renders tables');
  await H.fk('layout-album').click();
  ok('album, numbers and list layouts; stored layout');

  // Up next, on Home: the next core episode not marked watched, with its best offered whole or alternate copy, so a copy that
  // is not offered (a Hop page, a licensed listing, a blocked or region-limited upload) never hides one that is.
  await H.navigate('home');
  const local = localIn(H), seen = new Set(JSON.parse(H.storage.get('sumsum-watched') || '[]'));
  const cands = prods.filter(M.isCoreRechov).flatMap(p => M.epsOf.get(p.id))
    .filter(e => cov(e) === 'whole-candidate' && !seen.has(e.id) && nextCopyM(M, e, local));
  assert(cands.length && H.has('next-watch', H.view()), 'Up next has candidates');
  if (cands.length) {
    const c0 = nextCopyM(M, cands[0], local).r;
    assert.equal(H.fk('next-watch').href, expectDest(c0, local(c0)));
    assert(H.fk('next-watch').textContent.startsWith(L.en['watchOn_' + hostKind(expectDest(c0, local(c0)))]));
    // "Another one" cycles through exactly the candidates, each with its chosen copy.
    const shown = new Set();
    for (let k = 0; k < cands.length; k++) {
      shown.add(H.fk('next-ep').href);
      const ec = eps.find(e => '#/episode/' + encodeURIComponent(e.id) === H.fk('next-ep').href), cc = ec && nextCopyM(M, ec, local);
      assert(cc && H.fk('next-watch').href === expectDest(cc.r, local(cc.r)), 'Up next links the chosen copy of ' + (ec && ec.id));
      // The candidate's code: the production's number label where it has one ("IETV no. 1"), never S·E codes for it.
      const ce = eps.find(e => '#/episode/' + encodeURIComponent(e.id) === H.fk('next-ep').href), cp = M.prodById.get(ce.production);
      assert.equal(H.byClass('note', H.byClass('next')[0])[0].textContent, [name(cp), M.code(ce)].filter(Boolean).join(' · '),
        'Up next names the production and the episode code');
      if (cands.length > 1) await H.fk('next-skip').click();
    }
    assert.deepEqual([...shown].sort(), cands.map(e => '#/episode/' + encodeURIComponent(e.id)).sort(), 'Up next offers exactly the candidates');
  }
  // The family switch: Sesame Street walks its own core episodes, earliest unwatched with an offered copy first; the choice is
  // stored and focus stays on it. Without a stored choice, All starts on Rechov Sumsum and English Spoken on Sesame Street.
  const ssProds = prods.filter(p => p.format === 'core' && FAMILY_OF[p.series] === 'sesame-street');
  if (ssProds.length && cands.length) {
    const rechov = FAMILY_OF[GOAL[0].series], epHref = e => '#/episode/' + encodeURIComponent(e.id);
    assert(H.has('next-fam-sesame-street', H.view()) && H.has('next-fam-' + rechov, H.view()), 'Up next has a family switch');
    assert.equal(H.fk('next-fam-' + rechov).getAttribute('aria-pressed'), 'true', 'Rechov Sumsum is the default under All');
    if (H.has('next-skip', H.view())) await H.fk('next-skip').click();
    await H.fk('next-fam-sesame-street').click();
    assert.equal(H.storage.get('sumsum-upnext'), '"sesame-street"', 'The family choice is stored');
    assert.equal(H.document.activeElement, H.fk('next-fam-sesame-street'), 'Focus stays on the switch');
    assert.equal(H.fk('next-fam-sesame-street').getAttribute('aria-pressed'), 'true');
    const s0 = [...ssProds].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).flatMap(p => M.epsOf.get(p.id))
      .find(e => cov(e) === 'whole-candidate' && !seen.has(e.id) && nextCopyM(M, e, local));
    assert.equal(H.fk('next-ep').href, epHref(s0), 'Sesame Street Up next starts at its earliest unwatched episode (Another one resets)');
    assert.equal(H.fk('next-watch').href, expectDest(nextCopyM(M, s0, local).r, local(nextCopyM(M, s0, local).r)), 'with its chosen copy');
    await H.fk('next-fam-' + rechov).click();
    assert.equal(H.fk('next-ep').href, epHref(cands[0]), 'Back to Rechov Sumsum');
    H.storage.delete('sumsum-upnext'); await H.fk('pref-spoken-en').click();
    assert.equal(H.fk('next-fam-sesame-street').getAttribute('aria-pressed'), 'true', 'English Spoken starts on Sesame Street');
    // Sesame Street chosen with Spoken Hebrew: nothing in it fits, so Rechov Sumsum is shown, pressed, with a line saying so.
    await H.fk('next-fam-sesame-street').click(); await H.fk('pref-spoken-he').click();
    const ssHe = ssProds.flatMap(p => M.epsOf.get(p.id)).some(e => cov(e) === 'whole-candidate' && !seen.has(e.id) &&
      M.ups.get(e.id).some(u => ['whole-candidate', 'alternate-edition'].includes(u.role) && offerable(u.r) && spokenOfM(u.r).includes('he')));
    if (!ssHe) {
      assert.equal(H.fk('next-fam-' + rechov).getAttribute('aria-pressed'), 'true', 'The family shown is the one pressed');
      assert.equal(H.fk('next-fam-sesame-street').getAttribute('aria-pressed'), 'false');
      assert.equal(H.byClass('fam-none')[0]?.textContent, tr('en', 'upNextNone', {name: 'Sesame Street'}), 'and a line says the chosen one has nothing');
    }
    H.storage.delete('sumsum-upnext');
    await H.fk('pref-spoken-all').click();
    assert.equal(H.fk('next-fam-' + rechov).getAttribute('aria-pressed'), 'true');
    assert(!H.byClass('fam-none').length, 'No fallback line when the chosen family is shown');
    ok('Up next family switch: Rechov Sumsum or Sesame Street, stored, earliest unwatched first, English Spoken defaults to Sesame Street');
  }
  // Strip keyboard: one tab stop, arrows by reading direction, Home/End.
  const strip0 = H.byClass('strip')[0];
  if (strip0) {
    const c = strip0.children.map(li => li.children[0]);
    assert.equal(c[0].tabIndex, 0); if (c[1]) assert.equal(c[1].tabIndex, -1);
    if (c[1]) { await c[0].fire('keydown', {key: 'ArrowRight'}); assert.equal(H.document.activeElement, c[1]); assert.equal(c[1].tabIndex, 0); }
    await c[0].fire('keydown', {key: 'End'}); assert.equal(H.document.activeElement, c.at(-1));
    await c.at(-1).fire('keydown', {key: 'Home'}); assert.equal(H.document.activeElement, c[0]);
  }
  ok('up next; strip keyboard');

  // Every tile's visible Watch label: the short host word, "Licensed" for a licensed listing, and Part or Excerpt.
  let tileLabels = 0;
  for (const p of prods) {
    const withBest = M.epsOf.get(p.id).filter(e => M.best(e)); if (!withBest.length) continue;
    for (const lang of withBest.some(e => M.best(e).acc === 'licensed') ? ['en', 'he'] : ['en']) {
      if (lang === 'he') await H.flipLang();
      await H.navigate('guide/' + encodeURIComponent(p.id) + '?layout=album');
      for (const e of withBest) {
        if (!H.has('w-' + e.id, H.view())) continue;
        assert.equal(H.byClass('wl', H.fk('w-' + e.id))[0].textContent, expectWatchShort(M.best(e), lang), `Tile Watch label (${lang}): ${e.id}`);
        assertFailedMark(H, H.fk('w-' + e.id), M.best(e).acc === 'unavailable', `Tile (${lang}) ${e.id}`);
        tileLabels++;
      }
      if (lang === 'he') await H.flipLang();
    }
  }
  assert(tileLabels > 0 || !eps.some(e => M.best(e)), 'Tile Watch labels were checked');
  // Album tiles and List rows have no access line, so a best link that failed an availability check is marked on the
  // Watch link itself (R4-01): the 'bad' class, the legend's failed-check mark, "unavailable" in the label and its name.
  const failedEps = eps.filter(e => M.best(e) && M.best(e).acc === 'unavailable');
  let failedLinks = 0;
  for (const lang of ['en', 'he']) {
    if (lang === 'he') await H.flipLang();
    for (const e of failedEps) {
      const b = M.best(e), where = `${e.id} (${lang})`;
      // The layout is stored, so album comes last and the checks after this block see tiles again.
      for (const layout of ['list', 'album']) {
        await H.navigate('guide/' + encodeURIComponent(e.production) + '?layout=' + layout + '&q=' + encodeURIComponent(e.id)); H.flushTimers();
        const w = layout === 'album' ? H.fk('w-' + e.id) : H.extLinks(H.fk('row-' + e.id).parentElement.parentElement)[0];
        assert(w, `${where}: the ${layout} view offers the Watch link`);
        assertFailedMark(H, w, true, `${where} ${layout}`);
        if (layout === 'album') assert.equal(H.byClass('wl', w)[0].textContent, expectWatchShort(b, lang), where + ': tile label says unavailable');
        else {
          assert.equal(H.byClass('wl-long', w)[0].textContent, expectWatchLong(b, lang), where + ': List label says unavailable');
          // The phone List label keeps the host word, struck through on phones (checkCss).
          assert.equal(H.byClass('wl-short', w)[0].textContent, expectWatchShort(b, lang, true), where + ': phone List label');
        }
        assert(w.getAttribute('aria-label').startsWith(expectWatchLong(b, lang) + ', '), where + ': the link name says unavailable: ' +
          w.getAttribute('aria-label'));
        failedLinks++;
      }
    }
    if (lang === 'he') await H.flipLang();
  }
  await H.navigate('guide?layout=album'); await search('');
  ok(`failed links marked: ${failedEps.length} episodes whose best link failed a check, ${failedLinks} tile and List links (EN, HE)`);
  // Tile watch labels say Part or Excerpt.
  for (const c of ['parts-only', 'excerpt-only']) {
    const e = eps.find(x => cov(x) === c && M.best(x)); if (!e) continue;
    await H.navigate('guide/' + e.production);
    await search(e.id);
    const w = H.fk('w-' + e.id), b = M.best(e);
    const want = b.role === 'part' ? (b.n > 1 ? tr('en', 'partOf', {i: b.i, n: b.n}) : L.en.role_part) : L.en.excerptQ;
    assert(w.getAttribute('aria-label').includes(' · ' + want), 'Partial coverage is in the watch label: ' + w.getAttribute('aria-label'));
    assert.equal(w.href, expectDest(b.r));
    await search('');
  }
  // Slot pages from gap cells, with the right numbering wording.
  await H.navigate('guide');
  for (const doc of [false, true]) {
    const p = prods.find(q => M.prodModel(q).groups.some(g => g.gaps && (g.numbering === 'documented') === doc)); if (!p) continue;
    const g = M.prodModel(p).groups.find(x => x.gaps && (x.numbering === 'documented') === doc), n = g.slotNs[0];
    await H.navigate('slot/' + encodeURIComponent(p.id) + '/' + (g.season ?? '-') + '/' + n);
    assert(H.text().includes(doc ? L.en.slotGapDoc : tr('en', 'slotGapInf', {kind: L.en['inferKind_' + g.numbering]})), 'Slot wording, documented=' + doc);
    assert(H.text().includes(L.en.evNoneLong));
  }
  for (const expP of [prods.find(q => !M.label(q, 'en') && M.prodModel(q).groups.some(g => g.expCells)),
    prods.find(q => M.label(q, 'en') && M.prodModel(q).groups.some(g => g.expCells))].filter(Boolean)) {
    const g = M.prodModel(expP).groups.find(x => x.expCells);
    await H.navigate('slot/' + encodeURIComponent(expP.id) + '/' + (g.season ?? '-') + '/' + g.last);
    assert.equal(H.h1().textContent, expectSlotTitle(M, expP, g, g.last, 'en'), 'Expected-slot titles name their season and number label');
  }
  ok(`tile watch labels (${tileLabels} tiles; licensed ones say so) for parts and excerpts; slot pages`);

  // Episode pages.
  const missing = eps.find(e => cov(e) === 'missing');
  if (missing) {
    await H.navigate('episode/' + missing.id);
    assert(H.fk('ep-ev').textContent.includes(L.en.ev_none), 'No evidence without uploads');
    assert(!H.byClass('ladder')[0].children.some(li => H.cls(li).includes('done')), 'No completed evidence step');
    assert(!H.has('watch-toggle', H.view()), 'No watched toggle without anything to watch');
  }
  const multi = eps.find(e => M.ups.get(e.id).length > 1);
  if (multi) {
    await H.navigate('episode/' + multi.id);
    assert(H.text().includes(L.en.compareTitle), 'Compare uploads');
    await H.fk('watch-toggle').click();
    assert.equal(H.fk('watch-toggle').getAttribute('aria-pressed'), 'true');
    assert(JSON.parse(H.storage.get('sumsum-watched')).includes(multi.id));
    const before = H.location.hash, hist = H.history.length;
    await H.$('skip').click();
    assert.equal(H.document.activeElement, H.$('main'), 'Skip link focuses main');
    assert.equal(H.location.hash, before); assert.equal(H.history.length, hist, 'Skip link keeps the route');
  }
  // Queue records render heterogeneous suggestions.
  for (const id of M.queued.keys()) { await H.navigate('record/' + id); assert(H.text().includes(L.en.suggestTitle)); }
  ok('episode pages: no-upload evidence, compare, watched toggle, skip link; queue suggestions');

  // Episode rows (Missing episodes, and whole links to check on the research to-do list) name the episode by its code (the
  // number label where the production has one) and its coverage. checkBrowsePages checks the pages themselves.
  let todoRows = 0;
  for (const route of ['browse/missing', 'todo']) {
    await H.navigate(route);
    for (const a of H.find(n => n.tagName === 'a' && /^td-/.test(n.getAttribute('data-fk') || ''))) {
      const e = M.eps.find(x => x.id === a.getAttribute('data-fk').slice(3)); if (!e) continue;
      const sub = H.byClass('trow-sub', a.parentElement)[0].textContent;
      assert(sub.startsWith([M.code(e), tr('en', 'cov_' + cov(e))].filter(Boolean).join(' · ')), `${route} row code: ${e.id}: ${sub}`);
      todoRows++;
    }
  }
  assert.equal(H.h1().textContent, L.en.todoTitle);
  await H.fk('td-export').click();
  const todo = await H.blobJson();
  assert.equal(todo.format, 'sumsum-to-find-v1');
  assert.equal(todo.missing.length, eps.filter(e => cov(e) === 'missing').length);
  assert.equal(todo.partsOnly.length, eps.filter(e => cov(e) === 'parts-only').length);
  assert.equal(todo.excerptOnly.length, eps.filter(e => cov(e) === 'excerpt-only').length);
  // The export's list is the Videos to identify list: queued uploads and uploads linked only as possible copies, which name
  // the episodes they may hold.
  const {waitingIds: todoWaiting} = menuModel(M);
  assert.deepEqual(todo.unidentified.map(x => x.recordId).sort(), [...todoWaiting].sort(), 'The export lists every upload to identify');
  for (const x of todo.unidentified) {
    const poss = M.guideStatus(M.recById.get(x.recordId)) === 'possible' ? M.recLinks.get(x.recordId).map(l => l.e.id) : [];
    assert.deepEqual(x.possibleCopyOf || [], poss, 'A possible-only upload names its candidate episodes in the export: ' + x.recordId);
  }
  assert.equal(todo.wholeLinksToCheck.length, eps.filter(e => cov(e) === 'whole-candidate' && ev(e) === 'metadata-checked').length);
  // YouTube searches name the series once and drop the catalogue's "<N>"; a catalogue title that is only the series name and a
  // number, with no story name, searches by the production's Hebrew number label (R3-01).
  const searchPx = ['רחוב סומסום', 'תכנית האירוח של אלמו', 'Shalom Sesame', 'Sesame'];
  const searchQ = url => new URL(url).searchParams.get('search_query');
  const bareTitle = e => !(typeof e.storyHe === 'string' && e.storyHe.trim()) && /^רחוב סומסום\s*<\s*\d+\s*>$/.test((e.titleHe || '').trim());
  let searches = 0, bareSearches = 0;
  for (const row of [...todo.missing, ...todo.partsOnly, ...todo.excerptOnly, ...todo.wholeLinksToCheck]) {
    const q = searchQ(row.search), e = M.eps.find(x => x.id === row.id), p = e && M.prodById.get(e.production);
    assert(!/<\s*\d+\s*>/.test(q), `The YouTube search drops the catalogue's <N>: ${row.id}: ${q}`);
    assert(!searchPx.some(px => q.startsWith(px + ' ' + px)), `The YouTube search names the series once: ${row.id}: ${q}`);
    if (e && bareTitle(e) && p && p.numberLabelHe) {
      assert.equal(q, 'רחוב סומסום ' + p.numberLabelHe + ' ' + e.number, `A title without a story searches by number: ${row.id}`);
      bareSearches++;
    }
    searches++;
  }
  const bareEp = eps.find(e => bareTitle(e) && cov(e) !== 'whole-candidate' && (M.prodById.get(e.production) || {}).numberLabelHe);
  if (bareEp) {
    await H.navigate('episode/' + bareEp.id);
    const yt = H.find(n => n.tagName === 'a' && /^https:\/\/www\.youtube\.com\/results\?/.test(n.href));
    assert(yt.length && yt.every(a => searchQ(a.href) === 'רחוב סומסום ' + M.prodById.get(bareEp.production).numberLabelHe + ' ' +
      bareEp.number), `The episode page of ${bareEp.id} searches YouTube by its number label: ${yt.map(a => searchQ(a.href)).join(' | ')}`);
    await H.navigate('todo');
  }
  for (const row of todo.notIdentified) {
    const m = M.prodModel(M.prodById.get(row.production));
    assert.equal(row.expectedNotIdentified, m.slots); assert.equal(row.numberingGapsInferred, m.inferredGaps);
  }
  ok(`research to-do and Missing episodes: ${todoRows} episode rows named by their code; export counts from data; ${searches} YouTube searches ` +
    `name the series once without "<N>" (${bareSearches} untitled numbers by their number label${bareEp ? ', and ' + bareEp.id + "'s page" : ''})`);
}

// Slot titles: seasoned, and named by the production's number label when it has one ("Season 2, IETV no. 98").
function expectSlotTitle(M, p, g, n, lang) {
  const f = (x) => Number(x).toLocaleString(lang === 'he' ? 'he-IL' : 'en-US');
  const code = M.label(p, lang) ? M.codeOf(p, g.season, n, lang) : '', s = g.season != null ? f(g.season) : '', gap = n <= g.max;
  const noun = tr(lang, 'noun_' + ({'short-series': 'installment', 'talk-show': 'program', 'home-video': 'tape'}[p.format] || 'episode'));
  if (code) return gap ? (s ? tr(lang, 'slotTitleSL', {s, code}) : code) : s ? tr(lang, 'slotExpTitleSL', {s, code}) : tr(lang, 'slotExpTitleL', {code});
  return gap ? (s ? tr(lang, 'untitledSE', {s, noun, n: f(n)}) : tr(lang, 'slotTitleN', {n: f(n)})) :
    s ? tr(lang, 'slotExpTitleS', {s, n: f(n)}) : tr(lang, 'slotExpTitle', {n: f(n)});
}
// The app's search normalization, enough for codes and labels: case, niqqud, punctuation.
const normalizeQ = v => String(v ?? '').normalize('NFKD').replace(/[֑-ׇ̀-ͯ]/g, '').toLocaleLowerCase()
  .replace(/[’'"״׳‘“”\-–—_.,:;!?()[\]]/g, ' ').replace(/\s+/g, ' ').trim();

// Number labels, firstNumber, alternate labels (data-derived; edgePayload() adds fixtures for each, see checkContractEdges).
async function checkNumbering(H, M) {
  const {prods} = M;
  let strips = 0, labelledCells = 0;
  for (const p of prods) {
    // A paged production draws only the season it shows first on its own page.
    const ws = new Set(JSON.parse(H.storage.get('sumsum-watched') || '[]'));
    const groups = (M.paged(p) ? [M.pageGroup(p, ws)] : M.prodModel(p).groups).filter(g => g.len); if (!groups.length) continue;
    await H.navigate('guide/' + encodeURIComponent(p.id) + '?layout=numbers');
    const uls = H.find(n => n.tagName === 'ul' && H.cls(n).includes('strip'));
    assert.equal(uls.length, groups.length, 'One strip per numbered season: ' + p.id);
    uls.forEach((ul, i) => {
      const g = groups[i], cells = ul.children.map(li => li.children[0]), key = n => 'cell-' + p.id + '-' + (g.season ?? '-') + '-' + n;
      assert.equal(cells.length, g.len, 'Strip length: ' + p.id);
      assert.equal(cells[0].getAttribute('data-fk'), key(g.first), `The strip starts at the season's first number ${g.first}: ${p.id}`);
      assert.equal(cells.at(-1).getAttribute('data-fk'), key(g.last), `and ends at ${g.last}`);
      if (g.def && Number.isInteger(g.def.firstNumber) && g.first === g.def.firstNumber) {
        assert(!cells.some(c => Number(c.getAttribute('data-fk').split('-').at(-1)) < g.def.firstNumber), 'No cells below firstNumber');
      }
      if (M.label(p, 'en')) {
        for (const c of cells) {
          const n = Number(c.getAttribute('data-fk').split('-').at(-1));
          assert(c.getAttribute('aria-label').startsWith(M.codeOf(p, g.season, n) + ':'),
            'Labelled cells use the number label: ' + c.getAttribute('aria-label'));
          labelledCells++;
        }
      }
      strips++;
    });
  }
  const search = async q => {
    await H.navigate('guide?layout=album'); H.$('g-search').value = q; await H.$('g-search').fire('input'); await H.$('g-search').fire('change');
  };
  const status = () => H.byClass('status-line')[0].textContent;
  const labelled = prods.filter(p => M.label(p, 'en') && M.epsOf.get(p.id).some(e => Number.isInteger(e.number)));
  for (const p of labelled.slice(0, 2)) {
    const e = M.epsOf.get(p.id).find(x => Number.isInteger(x.number));
    for (const [q, lab] of [[M.label(p, 'en') + ' ' + e.number, normalizeQ(M.label(p, 'en'))], ['<' + e.number + '>', '']]) {
      const want = M.eps.filter(x => x.number === e.number && M.label(M.prodById.get(x.production), 'en') &&
        (!lab || [M.prodById.get(x.production).numberLabelEn, M.prodById.get(x.production).numberLabelHe].some(y => normalizeQ(y) === lab)));
      await search(q);
      assert(status().startsWith(tr('en', 'statusLine', {n: want.length.toLocaleString('en-US')})), `Code search "${q}" finds ${want.length}: ${status()}`);
      for (const x of want) assert(H.has('ep-' + x.id, H.view()), `Code search "${q}" finds ${x.id}`);
    }
    assert(H.fk('ep-' + e.id).getAttribute('aria-label').startsWith(M.code(e) + '. '), 'Tiles name labelled episodes by their code');
    if (p.numberLabelHe) {
      await search(p.numberLabelHe + ' ' + e.number);
      assert(H.has('ep-' + e.id, H.view()), 'The Hebrew number label finds the episode too');
    }
  }
  // A label that is also a plain word ("פרק", Sesame Street's) keeps finding unlabelled productions' episodes by their text
  // ("פרק 5" was found through their own "פרק 5" token before any production used the label).
  const shared = labelled.find(p => normalizeQ(p.numberLabelHe || '') === normalizeQ('פרק'));
  const plainEp = shared && M.eps.find(e => Number.isInteger(e.number) && e.number < 10 && !M.label(M.prodById.get(e.production), 'en') &&
    M.eps.some(x => x.production === shared.id && x.number === e.number));
  if (plainEp) {
    await search('פרק ' + plainEp.number);
    assert(H.has('ep-' + plainEp.id, H.view()), `"פרק ${plainEp.number}" still finds ${plainEp.id}, an unlabelled production's episode`);
    const own = M.eps.find(x => x.production === shared.id && x.number === plainEp.number);
    assert(H.has('ep-' + own.id, H.view()), `and ${own.id}, by its number label`);
  }
  // "<n>" must be a code search, not text search: take a labelled number that other episodes' notes or titles quote, so
  // the plain text fallback would find more episodes than the code does (real data: <133> is quoted by <148> and <178>).
  const quoted = M.eps.find(e => Number.isInteger(e.number) && M.label(M.prodById.get(e.production), 'en') &&
    M.eps.some(x => x.number !== e.number && [x.noteEn, x.noteHe, x.titleEn, x.titleHe].some(s => typeof s === 'string' && s.includes('<' + e.number + '>'))));
  if (quoted) {
    const want = M.eps.filter(x => x.number === quoted.number && M.label(M.prodById.get(x.production), 'en'));
    await search('<' + quoted.number + '>');
    assert(status().startsWith(tr('en', 'statusLine', {n: want.length.toLocaleString('en-US')})),
      `"<${quoted.number}>" finds exactly the ${want.length} labelled episodes with that number, not the notes that quote it: ${status()}`);
    for (const x of M.eps.filter(y => y.number !== quoted.number)) assert(!H.has('ep-' + x.id, H.view()), `"<${quoted.number}>" does not find ${x.id}`);
  }
  const withAlt = M.eps.filter(e => M.altLabels(e).length);
  for (const e of withAlt.slice(0, 3)) {
    await search(M.altLabels(e)[0].text);
    assert(H.has('ep-' + e.id, H.view()), 'An alternate label finds its episode: ' + M.altLabels(e)[0].text);
    const a = H.fk('ep-' + e.id);
    assert(a.getAttribute('aria-label').includes(tr('en', 'alsoLabelled') + ': ' + M.altText(e)), 'The tile name includes its alternate labels');
    assert.equal(H.byClass('tile-alt', a.parentElement)[0].textContent.replace(/\u00A0/g, ' '), M.altText(e), 'The tile shows its alternate labels');
  }
  await search('');
  // The code each episode shows (its kicker, tile and To find code) finds that episode in its production, and only the
  // episodes that show the same code: "No. 12" must not match "2012", "IETV no. 12" only number 12. Every numbered episode in
  // English; three per production in Hebrew.
  let codeSearches = 0;
  const scoped = async (p, q) => {
    await H.navigate('guide/' + encodeURIComponent(p.id) + '?layout=list&q=' + encodeURIComponent(q)); H.flushTimers();
  };
  for (const lang of ['en', 'he']) {
    if (lang === 'he') await H.flipLang();
    for (const p of M.prods) {
      const numbered = M.epsOf.get(p.id).filter(e => Number.isInteger(e.number));
      for (const e of lang === 'en' ? numbered : numbered.slice(0, 3)) {
        const code = M.code(e, lang), want = numbered.filter(x => M.code(x, lang) === code);
        await scoped(p, code);
        const rows = H.find(n => /^row-/.test(n.getAttribute?.('data-fk') || '')).map(n => n.getAttribute('data-fk').slice(4));
        assert(rows.includes(e.id), `Searching the shown code "${code}" (${lang}) finds ${e.id}`);
        assert.deepEqual(rows.filter(id => !want.some(x => x.id === id)), [], `"${code}" (${lang}) finds only episodes with that code`);
        codeSearches++;
      }
    }
    if (lang === 'he') await H.flipLang();
  }
  // Unscoped, a shown code finds that code in every production and nothing else: "No. 12" is not IETV no. 12 or S1 · E12.
  for (const e of M.eps.filter(x => Number.isInteger(x.number) && !M.label(M.prodById.get(x.production), 'en')).slice(0, 2)) {
    const code = M.code(e), want = M.eps.filter(x => Number.isInteger(x.number) && M.code(x) === code).map(x => x.id).sort();
    await H.navigate('guide?layout=list&q=' + encodeURIComponent(code)); H.flushTimers();
    const rows = H.find(n => /^row-/.test(n.getAttribute?.('data-fk') || '')).map(n => n.getAttribute('data-fk').slice(4)).sort();
    assert.deepEqual(rows, want, `"${code}" across all productions finds exactly the episodes that show it`);
  }
  // List rows carry the alternate labels as a secondary line, in both languages; tiles keep the page direction (dir=auto
  // would lay a Hebrew label that starts with a Latin word, "hoopla עונה 2, פרק 1", out left to right).
  for (const lang of ['en', 'he']) {
    if (lang === 'he') await H.flipLang();
    for (const p of M.prods.filter(q => M.epsOf.get(q.id).some(e => M.altLabels(e).length))) {
      await H.navigate('guide/' + encodeURIComponent(p.id) + '?layout=list');
      // A paged production lists the season it shows first.
      const shownEps = M.paged(p) ? M.pageGroup(p, new Set(JSON.parse(H.storage.get('sumsum-watched') || '[]'))).eps : M.epsOf.get(p.id);
      for (const e of shownEps.filter(x => M.altLabels(x).length)) {
        const al = H.byClass('altlab', H.fk('row-' + e.id).parentElement)[0];
        assert(al, `The list row of ${e.id} has its alternate labels`);
        assert.equal(al.textContent, tr(lang, 'alsoLabelled') + ': ' + M.altText(e, lang), `List row alternate labels (${lang}): ${e.id}`);
      }
      await H.navigate('guide/' + encodeURIComponent(p.id) + '?layout=album');
      for (const ta of H.byClass('tile-alt')) assert.equal(ta.getAttribute('dir'), undefined, `Tile alternate labels keep the page direction (${lang})`);
    }
    if (lang === 'he') await H.flipLang();
  }
  await search('');
  ok(`numbering: ${strips} strips start at their season's first number; ${labelledCells} cells and ${labelled.length} productions use their number ` +
    `label; code search; ${codeSearches} searches for a shown code; ${withAlt.length} episodes with alternate labels on tiles and list rows`);
}

// ---------------------------------------------------------------- Hebrew
// The episode page's "About this episode": the quoted summary (English in both languages) with its source and revision link, the
// sponsors in words, word on the street and guest stars; container labels and extent notes on upload rows.
async function checkEpisodeAbout(H, M) {
  const e = M.eps.find(x => typeof x.summaryEn === 'string' && x.sponsors && (x.sponsors.letters || []).length > 1 &&
    (x.sponsors.numbers || []).length && (x.guestStars || []).length);
  if (!e) return;
  const list = (xs, ui) => (ui === 'he' ? xs.join(', ') : xs.length > 1 ? xs.slice(0, -1).join(', ') + ' and ' + xs.at(-1) : xs[0]);
  const src = e.summarySource || {}, site = String(src.label || '').split(',')[0].trim();
  const page = src.url || ((e.sources || []).find(x => x && x.url && String(x.label || '').startsWith(site)) || {}).url;
  const rev = Number.isInteger(src.revisionId) ? page + (page.includes('?') ? '&' : '?') + 'oldid=' + src.revisionId : page;
  for (const ui of ['en', 'he']) {
    if (ui === 'he') await H.flipLang();
    await H.navigate('episode/' + encodeURIComponent(e.id));
    const sec = H.byClass('ep-about')[0]; assert(sec, 'An episode with a summary has an About section (' + ui + ')');
    assert.equal(H.byClass('sec-h', sec)[0].textContent, L[ui].aboutEpisode);
    const sum = H.byClass('ep-summary', sec)[0];
    assert(sum.textContent === e.summaryEn.trim() && sum.getAttribute('lang') === 'en', 'The summary is quoted verbatim, marked English (' + ui + ')');
    const at = H.byClass('ep-attrib', sec)[0], links = H.find(n => n.tagName === 'a', at);
    assert.equal(links[0].href, rev, 'The summary links its source revision');
    assert(at.textContent.startsWith(L[ui].summaryFrom.split('{src}')[0]) && at.textContent.includes(src.label), 'The source is named (' + ui + ')');
    if (/muppet\.fandom\.com/.test(page)) assert(links.some(a => a.textContent.startsWith('CC BY-SA') && a.href === 'https://www.fandom.com/licensing'), 'Muppet Wiki text carries its licence');
    const dd = label => { const dl = H.byClass('facts', sec)[0], k = dl.children.findIndex(d => d.tagName === 'dt' && d.textContent === label); return k < 0 ? null : dl.children[k + 1]; };
    const sp = e.sponsors, letters = tr(ui, 'sponsorLetters', {x: list(sp.letters, ui)});
    const nums = tr(ui, sp.numbers.length > 1 ? 'sponsorNumbers' : 'sponsorNumber', {x: list(sp.numbers, ui)});
    assert.equal(dd(L[ui].broughtBy).textContent, tr(ui, 'sponsorBoth', {a: letters, b: nums}), 'Brought to you by (' + ui + ')');
    assert.equal(dd(L[ui].guestStars).textContent, e.guestStars.join(', '), 'Guest stars (' + ui + ')');
    if (ui === 'he') await H.flipLang();
  }
  const word = M.eps.find(x => typeof x.wordOnTheStreet === 'string' && x.wordOnTheStreet.trim());
  if (word) {
    await H.navigate('episode/' + encodeURIComponent(word.id));
    const dl = H.byClass('facts', H.byClass('ep-about')[0])[0], i = dl.children.findIndex(d => d.tagName === 'dt' && d.textContent === L.en.wordStreet);
    assert(i >= 0 && dl.children[i + 1].textContent === word.wordOnTheStreet.trim(), 'Word on the street');
  }
  // A copy inside a compilation (or a service listing) says so on its row, with its extent note.
  for (const c of ['compilation', 'listing']) {
    const hit = M.eps.find(x => (x.uploads || []).some(u => u.container === c && u.role !== 'possible' && M.recById.get(u.recordId)));
    if (!hit) continue;
    const u = hit.uploads.find(v => v.container === c && v.role !== 'possible' && M.recById.get(v.recordId));
    await H.navigate('episode/' + encodeURIComponent(hit.id));
    let row = H.fk('ur-' + u.recordId); while (row && !(row.className || '').split(' ').includes('urow')) row = row.parentElement;
    assert.equal(H.byClass('u-cont', row)[0]?.textContent, L.en['container_' + c], 'A ' + c + ' copy is labelled on its row');
    if (u.extentNoteEn) assert(row.textContent.includes(u.extentNoteEn), 'with its extent note');
  }
  // A copy of the episode alone outranks a compilation on the same host; an episode whose only whole copy is a compilation
  // still has a star and a "+" that act on what Watch opens (the compilation's entry), and "+" toggles.
  const W = ['whole-candidate', 'alternate-edition'];
  const usable = (e, f) => (e.uploads || []).filter(u => W.includes(u.role) && M.recById.get(u.recordId) && f(u));
  const mixed = M.eps.find(e => { const d = usable(e, u => !u.container), c = usable(e, u => u.container === 'compilation');
    return d.length && c.length && c.some(cu => d.some(du => tierNo(M.recById.get(du.recordId)) === tierNo(M.recById.get(cu.recordId)))); });
  if (mixed) {
    await H.navigate('episode/' + encodeURIComponent(mixed.id));
    const watch = H.fk('ep-watch').href, comp = usable(mixed, u => u.container === 'compilation').map(u => expectDest(M.recById.get(u.recordId)));
    assert(!comp.includes(watch), 'Watch opens a copy of the episode alone before a compilation on the same host: ' + mixed.id);
  }
  const compOnly = M.eps.find(e => usable(e, () => true).length && usable(e, () => true).every(u => u.container === 'compilation') &&
    (e.uploads || []).every(u => u.role !== 'part'));
  if (compOnly) {
    await H.navigate('episode/' + encodeURIComponent(compOnly.id));
    assert(H.has('ep-star', H.view()), 'A compilation-only episode can be starred: ' + compOnly.id);
    const q = () => H.fk('ep-q'), before = H.storage.get('sumsum-sitting') || '[]';
    await q().click(); H.flushTimers();
    assert.equal(q().getAttribute('aria-pressed'), 'true', 'Its "+" shows the compilation queued');
    await q().click(); H.flushTimers();
    assert.equal(q().getAttribute('aria-pressed'), 'false', 'and a second press takes it off the queue');
    assert.deepEqual(JSON.parse(H.storage.get('sumsum-sitting') || '[]'), JSON.parse(before));
  }
  // A record whose completenessStatus names a shared note shows that note, not its file's default note.
  const std = (H.payload.meta || {}).standardCompletenessNotes || {};
  const noted = M.records.find(r => typeof r.completenessStatus === 'string' && Object.prototype.hasOwnProperty.call(std, r.completenessStatus) &&
    r.completenessNote && r.completenessNote !== std[r.completenessStatus]);
  if (noted) {
    await H.navigate('record/' + encodeURIComponent(noted.id));
    assert(H.text().includes(std[noted.completenessStatus]) && !H.text().includes(noted.completenessNote),
      'A record page shows the shared note its status names, not the default note: ' + noted.id);
  }
  ok('episode About: the quoted summary with its source revision and licence, sponsors, word on the street and guest stars (EN, HE); compilation and listing rows labelled');
}
async function checkHebrew(H, M) {
  await H.navigate('browse');
  // After "Show more", the language toggle starts the list again from its first page (rebuilding every shown card in the other
  // language would block the page for seconds); focus stays on the toggle.
  for (let k = 0; k < 2 && H.has('more', H.view()); k++) await H.fk('more').click();
  const paged = H.$('grid').children.length;
  await H.flipLang();
  assert.equal(H.$('grid').children.length, Math.min(48, paged), 'The language toggle shows the first 48 cards again');
  assert.equal(H.document.activeElement, H.$('lang-he'), 'Focus stays on the language toggle (its checked option)');
  assert.equal(H.document.documentElement.dir, 'rtl'); assert.equal(H.document.documentElement.lang, 'he');
  assert.equal(H.storage.get('sumsum-language'), '"he"');
  assert.equal(H.h1().textContent, L.he.browseTitle);
  assert.equal(H.$('kind-help').textContent, L.he.kindHelp);
  assert.equal(H.byClass('lbl', H.fk('fk-short-episode'))[0].textContent, L.he.kShort);
  for (const li of H.$('grid').children) {
    const id = H.find(n => /^card-/.test(n.getAttribute?.('data-fk') || ''), li)[0].getAttribute('data-fk').slice(5);
    const maps = JSON.parse(H.storage.get('sumsum-vimeo-mappings') || '{}'), locals = Object.fromEntries(Object.entries(maps).map(([k, v]) => [k, (v || {}).url || '']));
    const r = M.shownOf(M.entries.find(en => en.id === id), () => true, locals), local = locals[r.id] || '';
    const w = H.extLinks(li)[0];
    assert(w.textContent.startsWith(expectWatchBase(r, 'he', local)), 'Hebrew watch label: ' + w.textContent);
    assert.equal(H.byClass('u-access', li)[0].textContent, expectAccessText(r, 'he', local));
  }
  assert(H.document.title.endsWith(L.he.appName));
  if (M.hasGuide) {
    const open = M.prods.find(p => (p.totalsEvidence || []).some(x => /^\s*>\s*\d+$/.test(String(x.value))));
    if (open) {
      await H.navigate('guide/' + open.id);
      const v = String(open.totalsEvidence.find(x => /^\s*>\s*\d+$/.test(String(x.value))).value).replace(/\D/g, '');
      assert(H.text().includes(tr('he', 'claimMore', {n: Number(v).toLocaleString('he-IL')})), 'Open-ended total in Hebrew words');
      assert(!H.text().includes('>' + v), 'No inequality symbol on the page');
      assert(H.find(n => n.getAttribute && n.getAttribute('lang') === 'en', H.byClass('ev-list')[0]).length, 'English source text tagged lang=en');
      // The separator sits between the scope and the source, outside the English isolate.
      for (const li of H.byClass('ev-list')[0].children) {
        for (const n of H.find(x => x.getAttribute && x.getAttribute('lang') === 'en', li)) {
          assert(!/·\s*$/.test(n.textContent), 'No separator inside an English isolate: ' + n.textContent);
        }
      }
    }
    const strip0 = (await H.navigate('guide'), H.byClass('strip')[0]);
    if (strip0 && strip0.children[1]) {
      const c = strip0.children.map(li => li.children[0]);
      await c[0].fire('keydown', {key: 'ArrowLeft'}); assert.equal(H.document.activeElement, c[1], 'RTL arrows follow reading direction');
    }
    // "269 or more" is words in Hebrew: no '+' that the bidi algorithm would move in front of the digits.
    await H.navigate('browse/missing');
    const counts = [...H.byClass('count'), ...H.byClass('tcount')].map(n => n.textContent);
    assert(counts.length && counts.every(c => !/\d\+/.test(c)), 'Hebrew Missing episodes counts have no trailing plus: ' + counts.join(' | '));
    const openTotal = M.prods.some(p => !['queue', 'home-video'].includes(p.format) && M.prodModel(p).ts !== 'known');
    if (openTotal) assert(counts.some(c => c.endsWith(tr('he', 'countOpen', {n: ''}).trim())), 'Open-ended Missing episodes count in words');
    await H.navigate('todo');
    const sum = H.byClass('todo-help', H.$('td-missing'))[0].textContent;
    assert(!/\d\+/.test(sum) && (!openTotal || sum.includes(tr('he', 'countOpen', {n: ''}).trim())), 'Hebrew to-do summary: ' + sum);
    // Number ranges in Hebrew data notes ("ממוספרות 1–70", "1–65, 66–130 ו־131–198") are left-to-right isolates, like the
    // season labels and years: in a Hebrew paragraph the en dash would otherwise put the second number first.
    // "#1–#12" (Shalom Sesame 2010) counts too (R4-04).
    for (const p of M.prods.filter(q => /\d>?\s*–\s*[#<]?\d/.test(q.expectedTotalNoteHe || ''))) {
      await H.navigate('guide/' + encodeURIComponent(p.id));
      const ranges = H.find(n => n.getAttribute && n.getAttribute('dir') === 'ltr').map(n => n.textContent);
      for (const r of p.expectedTotalNoteHe.match(/[#<]?\d+>?\s*–\s*[#<]?\d+>?/g)) {
        assert(ranges.includes(r), `The range "${r}" in ${p.id}'s Hebrew note is an LTR isolate`);
      }
    }
    await H.navigate('guide');
    const ranged = M.prods.find(p => /\d\s*–\s*\d/.test(p.years || ''));
    if (ranged) {
      const [a, b] = ranged.years.match(/\d+/g);
      assert(H.byClass('rail')[0].textContent.includes('⁦' + a + '–' + b + '⁩'), 'Year ranges are isolated left-to-right in Hebrew');
    }
  }
  ok('Hebrew: RTL, stored language, first page after the toggle, Hebrew labels, watch labels and access lines' +
    (M.hasGuide ? ', open totals in words, RTL strip keys, isolated number ranges in data notes' : ''));
}

// ---------------------------------------------------------------- crash sweep
async function sweep(H, M) {
  const routes = ['home', 'guide', 'todo', 'browse', 'browse/identified', 'browse/unidentified', 'browse/missing', 'starred'];
  for (const p of M.prods) {
    routes.push('guide/' + encodeURIComponent(p.id));
    for (const g of M.prodModel(p).groups) for (const n of g.slotNs) routes.push('slot/' + encodeURIComponent(p.id) + '/' + (g.season ?? '-') + '/' + n);
  }
  for (const e of M.eps) routes.push('episode/' + encodeURIComponent(e.id));
  for (const r of M.records) routes.push('record/' + encodeURIComponent(r.id));
  const locals = JSON.parse(H.storage.get('sumsum-vimeo-mappings') || '{}');
  const localOf = r => safe((locals[r.id] || locals[r.url] || {}).url || '');
  let visited = 0, tilesChecked = 0;
  for (const lang of ['he', 'en']) {
    if (H.document.documentElement.lang !== lang) await H.flipLang();
    const slotTitles = new Map();
    for (const route of routes) {
      await H.navigate(route); visited++;
      const where = lang + ' #/' + route, head = H.h1();
      assert(head && head.textContent.trim(), where + ': the view has an H1');
      assert(H.document.title.startsWith(head.textContent) && H.document.title.endsWith(' · ' + L[lang].appName), where + ': document.title');
      assertCleanText(H, where); assertSafeLinks(H, where); assertNav(H, route, where);
      assert.deepEqual(langIssues(H.view(), lang).slice(0, 3), [], where + ': language of parts');
      assert.deepEqual(headingIssues(H.view()).slice(0, 3), [], where + ': heading levels do not skip');
      if (route.startsWith('slot/')) {
        assert(!slotTitles.has(H.document.title), `${where}: slot title is unique (also on ${slotTitles.get(H.document.title)})`);
        slotTitles.set(H.document.title, route);
      }
      if (route.startsWith('guide')) assert(!/\d\s?%/.test(H.text()), where + ': no percentage');
      assertNoBars(H, where);
      // Every tile shows an evidence badge exactly when its episode's level is above the baseline (request 06).
      if (route.startsWith('guide')) {
        for (const a of H.find(n => H.cls(n).includes('tile-title'))) {
          const e = M.eps.find(x => x.id === a.getAttribute('data-fk').slice(3)), lv = M.ev(e), b = H.byClass('ev-badge', a.parentElement.parentElement);
          assert.deepEqual(b.map(x => x.textContent), EVS.indexOf(lv) >= 1 ? [tr(lang, 'ev_' + lv)] : [], `${where}: tile ${e.id} evidence badge`);
          tilesChecked++;
        }
      }
      if (route.startsWith('guide/')) {
        // Totals evidence: scope and source are one left-to-right isolate, so a wrapped Hebrew row cannot interleave them.
        const p = M.prodById.get(decodeURIComponent(route.split('/')[1]));
        const rows = H.byClass('ev-list').flatMap(ul => ul.children);
        assert.equal(rows.length, (p.totalsEvidence || []).length, where + ': one row per total claim');
        rows.forEach((li, k) => {
          const body = li.children[1], gap = body.children[1], src = body.children[2], x = p.totalsEvidence[k];
          assert(body.children.length === 3 && H.cls(src).includes('ev-src') && src.getAttribute('dir') === 'ltr',
            where + ': totals evidence scope and source are one LTR isolate');
          // The pill does not wrap, so a space must separate it from the scope's first word (R4-03).
          assert(gap.tagName === '#text' && gap.textContent === ' ', where + ': a breakable space follows the confidence pill');
          if (x.scope) assert(src.textContent.startsWith(x.scope + ' · '), where + ': the isolate holds the scope, then the source');
        });
      }
      const [kind, rawId] = route.split('/'), id = rawId && decodeURIComponent(rawId);
      if (kind === 'episode') {
        const e = M.eps.find(x => x.id === id), b = M.best(e, Object.fromEntries(M.ups.get(e.id).map(u => [u.r.id, localOf(u.r)])));
        assert.equal(H.fk('ep-ev').textContent, (M.ev(e) ? tr(lang, 'ev_' + M.ev(e)) : tr(lang, 'ev_none')), where + ': derived evidence');
        assert.equal(H.fk('ep-cov').textContent, M.covLong(e, lang), where + ': whole links stay unverified until watched in full');
        if (b) {
          const w = H.fk('ep-watch'), vpn = ['hop', 'restricted'].includes(b.acc), note = expectHeroNote(b.r, b.acc, lang, localOf(b.r));
          assert.equal(w.href, expectDest(b.r, localOf(b.r)), where + ': access-ranked best link');
          assert.equal(H.cls(w).includes('vpn'), vpn, where + ': VPN links are marked');
          assert(w.textContent.startsWith(expectWatchBase(b.r, lang, localOf(b.r))), where + ': Watch label (licensed says so): ' + w.textContent);
          if (b.role === 'part') {
            const q = b.n > 1 ? tr(lang, 'partOf', {i: b.i.toLocaleString(), n: b.n.toLocaleString()}) : tr(lang, 'role_part');
            assert(w.textContent.includes(' · ' + q), where + ': the Watch label names the part: ' + w.textContent);
          }
          for (const k of [...['vpnNote', 'ytNote', 'vpnListedNote', 'regionNote'].map(x => tr(lang, x)), ...allLicNotes(lang)]) {
            assert.equal(H.text().includes(k), note === k, where + ': access note states only recorded checks (' + k.slice(0, 40) + ')');
          }
        } else assert(!H.has('ep-watch', H.view()), where + ': no watch link without uploads');
        // A Watch link on a described service with steps (hoopla) brings its how-to box; no other episode page has one.
        const bs = b && b.acc === 'licensed' ? expectSvc(b.r, localOf(b.r)) : null;
        assertHowTo(H, bs && bs.howTo ? bs : null, lang, where);
        // Codes: the production's number label, else season and episode; never both.
        const p = M.prodById.get(e.production), pname = (lang === 'he' ? p.nameHe || p.nameEn : p.nameEn || p.nameHe) || p.id;
        const numDt = H.find(n => n.tagName === 'dt' && n.textContent === tr(lang, 'numberLbl'));
        assert.equal(numDt.length, e.number != null ? 1 : 0, where + ': a Number fact only for numbered episodes');
        if (numDt.length) {
          const dd = numDt[0].parentElement.children[numDt[0].parentElement.children.indexOf(numDt[0]) + 1];
          assert.equal(dd.textContent, M.label(p, lang) ? M.code(e, lang) : e.number.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US'),
            where + ': the Number fact uses the number label');
        }
        assert.equal(H.byClass('kicker', H.byClass('hero')[0])[0].textContent, [pname, M.code(e, lang)].filter(Boolean).join(' · '),
          where + ': episode code in the kicker');
        // The heading is the Hebrew story name (storyHe) in Hebrew and the editorial English title in English. The identity card
        // keeps the verbatim catalogue title, adds the story name with its source, and keeps "(editorial)" on the English title.
        assert.equal(head.textContent, M.epTitle(e, lang), where + ': episode heading');
        const factOf = key => {
          const dt = H.find(n => n.tagName === 'dt' && n.textContent === tr(lang, key))[0], kids = dt && dt.parentElement.children;
          return dt ? kids[kids.indexOf(dt) + 1] : null;
        };
        const story = M.storyOf(e), heFact = factOf(story ? 'catTitle' : 'hebTitle'), sf = factOf('storyName');
        assert.equal(heFact ? heFact.textContent : '', e.titleHe || '', where + ': the Hebrew title fact (the catalogue title with storyHe)');
        assert.equal(factOf(story ? 'hebTitle' : 'catTitle'), null, where + ': one Hebrew title fact, named by whether storyHe is used');
        assert.equal(!!sf, !!story, where + ': a Story name fact only with storyHe');
        if (sf) {
          const trim = v => (typeof v === 'string' ? v.trim() : ''), [a, b] = [trim(e.storySourceEn), trim(e.storySourceHe)];
          const src = lang === 'he' ? b || a : a || b;
          assert.equal(sf.textContent, story + (src ? tr(lang, 'storySource', {src}) : ''), where + ': story name and its source');
        }
        const enFact = factOf('engTitle');
        assert.equal(enFact ? enFact.textContent : '', e.titleEn || '', where + ': the English title fact, labelled editorial');
        assertEditorialRow(H, heEdOf(e), lang, where);
        // Alternate labels: in the hero and, with their sources, in the identity card.
        const alts = M.altLabels(e);
        assert.equal(H.byClass('alsolab').length, alts.length ? 1 : 0, where + ': "Also labelled" only with alternate labels');
        if (alts.length) {
          assert.equal(H.byClass('alsolab')[0].textContent, tr(lang, 'alsoLabelled') + ': ' + M.altText(e, lang), where + ': alternate labels');
          const items = H.byClass('altlab-item');
          assert.equal(items.length, alts.length, where + ': one identity-card item per alternate label');
          alts.forEach((a, k) => {
            if (a.source) assert(items[k].textContent.includes(a.source), where + ': alternate label source');
            assert.equal(H.extLinks(items[k]).length, a.url ? 1 : 0, where + ': an alternate label links only with a url');
          });
        }
        // Identity-card lists keep the page direction (bullets on the start edge); each item's text is a dir=auto isolate.
        for (const li of [...H.byClass('altlab-item'), ...H.byClass('src-item')]) {
          assert.equal(li.getAttribute('dir'), undefined, where + ': identity list items keep the page direction');
          assert(li.children.length === 1 && li.children[0].getAttribute('dir') === 'auto', where + ': and isolate their text');
        }
        assert.equal(H.byClass('src-item').length, (e.sources || []).filter(s => s && typeof s === 'object').length, where + ': one item per source');
        // Sources: a source without a url is plain text.
        for (const src of e.sources || []) {
          if (src && src.label) assert(H.text().includes(src.label), where + ': source label shown');
          if (src && !safe(src.url) && src.label) {
            assert(!H.extLinks(H.view()).some(a => a.textContent.startsWith(src.label)), where + ': a source without a url is not a link');
          }
        }
        // Research note: an English note is lang="en" (its Hebrew quotations are lang="he" parts); a Hebrew note is lang="he".
        const noteText = (lang === 'he' ? e.noteHe || e.noteEn : e.noteEn || e.noteHe) || '';
        if (noteText) {
          const callout = H.byClass('callout', H.view())[0], span = callout && callout.children[1];
          const want = noteText === e.noteEn && LAT_RE.test(noteText) ? 'en' : HEB_RE.test(noteText) ? 'he' : LAT_RE.test(noteText) ? 'en' : lang;
          assert(span && span.textContent === noteText, where + ': research note shown');
          assert.equal(span.getAttribute('lang') || lang, want, where + ': research note language');
          if (want === 'he') {
            const parts = span.children.filter(c => c.getAttribute && c.getAttribute('lang') === 'en' && c.getAttribute('dir') === 'ltr');
            for (const id of noteText.match(/\b(?:yt|ia|hop|web|fb|dm)-[\w-]*\w/g) || []) {
              assert(parts.some(c => c.textContent.includes(id)), where + ': a record id in a Hebrew note is an LTR English part: ' + id);
            }
          }
        }
        // Possible copies: their own group, never counted, never the Watch link.
        const pc = M.poss.get(e.id);
        assert.equal(H.text().includes(tr(lang, 'rolePl_possible')), pc.length > 0, where + ': possible copies listed apart');
        for (const u of pc) {
          const body = H.fk('ur-' + u.r.id).parentElement.parentElement, list = body.parentElement.parentElement;
          assert(H.cls(list).includes('possible') && body.textContent.includes(tr(lang, 'role_possible')), where + ': possible row');
          if (b) assert.notEqual(b.r.id, u.r.id, where + ': a possible copy is never the Watch link');
        }
        // Parts: numbered by their explicit part number (else position), "Part 2 of 3".
        const parts = M.partsOf(e), explicit = parts.some(x => x.u.part != null);
        for (const x of parts) {
          const shown = parts.length > 1 || (explicit && x.of > 1), link = H.fk('ur-' + x.u.r.id);
          const label = tr(lang, 'partOf', {i: x.no.toLocaleString(), n: x.of.toLocaleString()}) + ' · ';
          assert.equal(link.textContent.startsWith(label), shown, where + ': part label ' + label + ' on ' + x.u.r.id);
        }
        // A recorded "watched in full" or "compared" result shows its URL, date and note, and names its upload.
        const src = M.evSource(e), recorded = tr(lang, 'evRecorded', {d: '\u0000'}).split('\u0000')[0];
        const epCheck = tr(lang, 'upEpCheck', {level: '\u0000'}).split('\u0000')[0];
        assert.equal(H.text().includes(recorded), !!src, where + ': evidence detail shown only when it sets the level');
        if (src) {
          assert(H.text().includes(tr(lang, 'evRecorded', {d: src.checkedAt})), where + ': check date shown');
          assert(H.extLinks(H.view()).some(a => a.href === src.url && a.textContent.startsWith(urlLabelOf(src.url))),
            where + ': checked URL linked and labelled with its query: ' + urlLabelOf(src.url));
          if (src.noteEn) assert(H.text().includes(src.noteEn), where + ': evidence note shown');
          const row = H.fk('ur-' + src.r.id).parentElement.parentElement;
          assert(row.textContent.includes(tr(lang, 'upEpCheck', {level: tr(lang, 'ev_' + src.level)})), where + ': the named upload carries the check');
        } else assert(!H.text().includes(epCheck), where + ': no episode check without a detail');
      }
      if (kind === 'record') {
        const r = M.recById.get(id), a = expectAccess(r, localOf(r));
        // The heading: the published Hebrew title, else the editorial Hebrew title, else the English title in Hebrew; never the
        // editorial Hebrew title in English, where it has only its labelled row.
        assert.equal(head.textContent, recTitleIn(r, lang), where + ': record heading');
        assertEditorialRow(H, heEdOf(r), lang, where);
        const checked = ['country-restricted', 'unavailable'].includes(checkOf(r));
        assert.equal(H.fk('rec-host').textContent, expectHostLabel(r, lang, localOf(r)), where + ': host label');
        assert.equal(H.fk('rec-access').textContent, expectAccessText(r, lang, localOf(r)), where + ': access line');
        assert.equal(H.text().includes(tr(lang, 'ytNote')), checked && ['restricted', 'unavailable'].includes(a), where + ': failed-check note');
        assert.equal(H.text().includes(tr(lang, 'vpnListedNote')), a === 'restricted' && !checked, where + ': listed-only note');
        const licNote = a === 'licensed' ? expectLicNote(r, lang, localOf(r)) : '';
        for (const n of allLicNotes(lang)) assert.equal(H.text().includes(n), n === licNote, where + ': licensed-listing note');
        const rs = expectSvc(r, localOf(r));
        assertHowTo(H, rs && rs.howTo ? rs : null, lang, where);
        assert.equal(H.text().includes(tr(lang, 'regionNote')), ['web', 'public'].includes(a) && checkOf(r) === 'region-limited',
          where + ': region-limited note');
        // A failed check is never shown as an open link, and the page shows the recorded check itself.
        if (failedText(r)) assert(['restricted', 'unavailable'].includes(a), where + ': a recorded failed check is not public: ' + a);
        const ck = r.availabilityCheck;
        if (ck && typeof ck === 'object' && typeof ck.result === 'string') {
          assert(H.text().includes(tr(lang, 'availCheck') + ': ') && H.text().includes(ck.result), where + ': the availability check is shown');
        }
        if (M.hasGuide) {
          assert.equal(H.text().includes(tr(lang, 'possibleRecord')), M.guideStatus(r) !== 'matched' && M.possibleIds.has(r.id),
            where + ': linked only as a possible copy');
          // The breadcrumb follows the best-role link (a whole tape, not an excerpt of a programme on it); a record that is only
          // a possible copy and still queued is filed under its queue.
          const links = M.recLinks.get(r.id) || [], qp = M.queued.get(r.id), nav = H.byClass('crumbs')[0];
          const hrefs = H.find(n => n.tagName === 'a', nav).map(a => a.href);
          if (links.length && (M.linked.has(r.id) || !qp)) {
            assert.equal(hrefs.at(-1), '#/episode/' + encodeURIComponent(links[0].e.id), where + ': breadcrumb names the best-role episode');
          } else if (qp) assert.equal(hrefs.at(-1), '#/guide/' + encodeURIComponent(qp), where + ': breadcrumb names the queue');
          // The record page lists every guide link, best role first.
          // The guide card is the first card after the how-to box (which a hoopla listing has above it).
          const ul = H.byClass('card').filter(c => !H.cls(c).includes('howto'))[0].children.find(n => n.tagName === 'ul' && !H.cls(n).includes('sugg'));
          const anchors = ul ? H.find(a => a.tagName === 'a' && /^#\/episode\//.test(a.href || ''), ul) : [];
          assert.deepEqual(anchors.map(a => a.href), links.map(l => '#/episode/' + encodeURIComponent(l.e.id)), where + ': every guide link, by role');
          // Each link names the production, the episode code (the number label where there is one) and the title.
          anchors.forEach((a, k) => {
            const le = links[k].e, lp = M.prodById.get(le.production);
            const pn = (lang === 'he' ? lp.nameHe || lp.nameEn : lp.nameEn || lp.nameHe) || lp.id;
            assert.equal(a.textContent, [pn, M.code(le, lang)].filter(Boolean).join(' · ') + ' · ' + M.epTitle(le, lang),
              where + ': guide link names the episode code');
          });
        }
        if (expectDest(r, localOf(r))) assert.equal(H.fk('rec-watch').href, expectDest(r, localOf(r)));
        const src = safe(r.sourceUrl);
        if (src && src !== expectDest(r, localOf(r))) {
          assert(H.extLinks(H.view()).some(a => a.href === src && a.textContent.startsWith(urlLabelOf(src))), where + ': metadata source label');
        }
      }
    }
  }
  assert(tilesChecked > 0, 'The sweep checked guide tiles');
  ok(`crash sweep: ${visited} routes (${routes.length} per language); heading order; unique slot titles; URL labels; no evidence bars; ` +
    `${tilesChecked} tiles with an evidence badge exactly above the baseline`);
}

// ---------------------------------------------------------------- guide-absent mode
// A sixth series in a family of its own, with a core production that comes first in production order: the registry alone
// gives it a Browse chip, a rail heading after the others and its YouTube search terms, and it never counts as core
// Rechov Sumsum (not in the goal rows or the separate list's exclusions, never Up next's preferred episode).
async function checkSeriesRegistry(htmlPath) {
  const url = 'https://www.youtube.com/watch?v=TestStreet01';
  const H = harness(boot(htmlPath, {payload: p => {
    p.series.families.push({id: 'test-fam', en: 'Test family', he: 'משפחת בדיקה'});
    p.series.series.push({id: 'test-street', en: 'Test Street', he: 'רחוב בדיקה', family: 'test-fam', searchPrefix: 'Test Street',
      searchLanguage: 'en'});
    p.records.push({id: 'test-rec-1', url, series: 'test-street', kind: 'episode', titleEn: 'Test Street: The Big Test',
      durationSeconds: 1500, themes: [], characters: []});
    p.guide.productions.push({id: 'test-core', series: 'test-street', format: 'core', order: -1, years: '2026', nameEn: 'Test Street core',
      nameHe: 'רחוב בדיקה, הפקה', expectedTotal: 2, seasons: [{season: 1, numbering: 'documented', expectedEpisodes: 2}], totalsEvidence: []});
    p.guide.episodes.push({id: 'test-ep-1', production: 'test-core', season: 1, number: 1, confidence: 'documented',
      titleEn: 'The Big Test', titleHe: 'הבדיקה הגדולה', uploads: [{recordId: 'test-rec-1', role: 'whole-candidate'}]},
    {id: 'test-ep-2', production: 'test-core', season: 1, number: 2, confidence: 'documented', titleEn: 'The Missing Test',
      titleHe: 'הבדיקה החסרה', uploads: []});
    return p;
  }}));
  // The panel has a row for each goal series with a core production in this build's guide (none: no panel).
  const goalLabels = H.payload.series.goal.filter(g => H.payload.guide.productions.some(p => p.series === g.series && p.format === 'core'))
    .map(g => g.en);
  await H.navigate('browse');
  const chips = H.fkAll('fs-test-street');
  assert.equal(chips.length, 1, 'A registered series gets a Browse chip'); assert.equal(H.chipCount(chips[0]), 1);
  assert.equal(chips[0].parentElement.children.filter(c => /^fs-/.test(c.getAttribute?.('data-fk') || '')).at(-1), chips[0],
    'Series chips follow the registry order');
  await H.navigate('record/test-rec-1'); assert(H.text().includes('Test Street'), 'Record pages name the series from the registry');
  await H.navigate('guide');
  const fams = H.byClass('rail-fam', H.tree).map(n => n.textContent);
  assert.equal(fams.at(-1), 'Test family', 'A new family is a rail heading after the registered ones');
  assert(H.has('rail-test-core'), 'Its production is on the rail');
  assert.deepEqual(H.byClass('goal-row').map(r => r.children[0].textContent), goalLabels, 'The goal panel keeps only the goal series rows');
  if (goalLabels.length) assert(H.byClass('sep-list').some(l => l.textContent.includes('Test Street core')), 'A non-goal core production is counted separately');
  for (const lang of ['en', 'he']) {
    if (H.document.documentElement.lang !== lang) await H.flipLang();
    await H.navigate('episode/test-ep-2');
    const search = H.find(n => n.tagName === 'a' && String(n.href).startsWith('https://www.youtube.com/results'));
    assert(search.length && search.every(a => a.href.includes(encodeURIComponent('Test Street') + '%20') && /Missing/.test(decodeURIComponent(a.href))),
      `${lang}: YouTube searches use the series' prefix and English title words`);
  }
  await H.flipLang();
  await H.navigate('home');
  // Without a core Rechov episode to offer, Up next may offer any video, this one included.
  if (goalLabels.length) assert.notEqual(H.fk('next-watch').href, url, 'Up next prefers core Rechov Sumsum, not a core production of another series');
  ok('series registry: a new series and family get a Browse chip, a rail heading and their own search terms, and stay out of core Rechov Sumsum');
}

async function checkWithoutGuide(htmlPath) {
  const H = harness(boot(htmlPath, {payload: p => { delete p.guide; return p; }}));
  const M = model(H.payload);
  assert.equal(H.h1().textContent, L.en.browseTitle, 'Without a guide the library opens on Browse');
  assert.equal(H.history[0]?.hash, '#/browse');
  assert.equal(H.count(), M.entries.length);
  assert(!H.has('fg-matched'), 'No guide facet without a guide');
  await H.navigate('guide');
  assert.equal(H.h1().textContent, L.en.guideTitle);
  assert(H.text().includes(L.en.guideEmpty), 'Guide tab explains the missing guide');
  assert(!H.byClass('goal').length && !H.byClass('rail').length);
  await H.navigate('todo'); assert(H.text().includes(L.en.guideEmpty));
  // Nothing is identified or awaiting identification without a guide: no Browse menu, and its pages explain why.
  assert(!H.has('browse-more') && !H.document.getElementById('browse-menu'), 'Without a guide Browse has no menu');
  for (const [route, key] of [['browse/identified', 'identifiedTitle'], ['browse/unidentified', 'unidentifiedTitle'], ['browse/missing', 'missingTitle']]) {
    await H.navigate(route);
    assert(H.h1().textContent === L.en[key] && H.text().includes(L.en.guideEmpty), route + ' explains the missing guide');
    assert.equal(H.find(n => n.tagName === 'a' && n.href === '#/browse').length, 1, route + ' links to Browse');
  }
  await H.navigate('record/' + encodeURIComponent(M.records[0].id)); assert(H.text().includes(L.en.recordNoGuide));
  await H.navigate('episode/does-not-exist'); assert.equal(H.h1().textContent, L.en.guideTitle, 'Unknown episode ids fall back to the guide');
  ok('guide-absent mode: Browse first, no Browse menu, honest empty guide, Browse pages and research to-do');
}

async function checkPersistence(htmlPath, storage, starredRecord) {
  const H = harness(boot(htmlPath, {storage}));
  assert.equal(H.document.documentElement.lang, storage.get('sumsum-language') === '"he"' ? 'he' : 'en', 'Language persists');
  await H.navigate('starred');
  assert.equal(H.count(), 1, 'Stars persist across reloads (the sumsum-favorites key)');
  assert(H.has('card-' + starredRecord.id, H.view()));
  ok('persistence across reloads: language and stars');
}

function checkStrings() {
  const ek = Object.keys(L.en).sort(), hk = Object.keys(L.he).sort();
  assert.deepEqual(ek.filter(k => !hk.includes(k)), [], 'Every English string has a Hebrew string');
  assert.deepEqual(hk.filter(k => !ek.includes(k)), [], 'Every Hebrew string has an English string');
  const ph = s => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const k of ek) assert.equal(ph(L.he[k]), ph(L.en[k]), 'Placeholders match: ' + k);
  // One observed startup does not verify every Vimeo link (AGENTS.md): untested links make no playback claim.
  for (const k of ['acc_vimeo', 'accessLegend_ok', 'about4']) {
    assert(!/usually play|מתנגנ?ים? בדרך כלל/.test(L.en[k] + ' ' + L.he[k]), 'No general playback claim in ' + k);
  }
  assert(/not tested/.test(L.en.acc_vimeo) && /לא נבדק/.test(L.he.acc_vimeo), 'Untested Vimeo links say so');
  // Labels fixed by the guide contract.
  // The licensed labels name the service and what it needs (checkLicensed); the generic ones, for a service the data does not
  // describe, say "licensed listing".
  for (const [k, en, he] of [['fs_related-series', 'Related series', 'סדרה קשורה'], ['agLicensed', 'Licensed listings', 'רישומים ברישיון']]) {
    assert.equal(L.en[k], en, 'Contract label ' + k); assert.equal(L.he[k], he, 'Contract label (Hebrew) ' + k);
  }
  for (const k of ['acc_licensed', 'watchLicensed', 'tw_licensed', 'agLicOther', 'licensedNote']) {
    assert(/licensed/i.test(L.en[k]) && /רישיון/.test(L.he[k]), 'Generic licensed labels say "licensed": ' + k);
  }
  // Queues hold whole episodes, parts and segments (Hop! 2009 story files run 3-6 minutes): no "long uploads" wording.
  for (const k of ['queueLink', 'queueTitle', 'queueHelp', 'slotQueue', 'tdQueueHelp', 'unidentifiedLede', 'navUnidentified']) {
    assert(!/\blong\b/i.test(L.en[k]) && !/ארוכ/.test(L.he[k]), 'Queue wording makes no length claim: ' + k);
  }
  // "Not matched to an episode", not "to one episode" (the user's wording, October 18), in both languages.
  for (const k of ek) {
    assert(!/matched to one episode|not matched to one\b/i.test(L.en[k]) && !/הותאמו לפרק אחד/.test(L.he[k]), 'No "matched to one episode" wording: ' + k);
  }
  // The two Browse pages are described from the guide data (AGENTS.md): Identified videos are matched or catalogued outside the
  // guide; Videos to identify are queued or possible-only. "Not matched to an episode" would also describe 1,585 identified
  // uploads that are not in the guide (review round 1).
  assert(L.en.unidentifiedLede.startsWith("Uploads in a production's identification queue, and uploads linked only as a possible copy") &&
    L.he.unidentifiedLede.startsWith('העלאות שבתור הזיהוי של הפקה, והעלאות שקושרו רק כעותק אפשרי'),
    'Videos to identify: the lede gives the definition in both languages');
  for (const k of ['identifiedNote', 'unidentifiedLede']) {
    assert(!/not matched to an episode/i.test(L.en[k]) && !/לא הותאמו לפרק/.test(L.he[k]), 'Defined from the guide data, not "not matched": ' + k);
  }
  // One term, one count: the facet chip names the queue (44 in the data), "awaiting identification" is queue plus possible-only.
  assert.equal(L.en.gsQueue, 'In an identification queue'); assert.equal(L.he.gsQueue, 'בתור לזיהוי');
  assert(/1/.test(L.en.queueLinkOne) === false && /^One upload awaits/.test(L.en.queueLinkOne) && /^העלאה אחת ממתינה/.test(L.he.queueLinkOne),
    'A singular queue link in both languages');
  assert(!/whole episodes of/.test(L.en.queueHelp) && /segments/.test(L.en.queueHelp) && /קטעים/.test(L.he.queueHelp),
    'The queue help names parts and segments, not only possible whole episodes');
  // The core headline's scope sentence names every kind that is counted separately, related series included.
  assert(/related series/.test(L.en.goalHelp) && /סדרות קשורות/.test(L.he.goalHelp), 'goalHelp names related series');
  // Stars, not "saved": nothing the user does saves a video to disk. Stars, pasted links and watched marks are stored in
  // this browser. The Hebrew footer's "הזכויות שמורות" (rights reserved) is not about saving.
  for (const k of ek) {
    assert(!/\bsav(?:e|ed|es|ing)\b/i.test(L.en[k]), 'No "save" wording in English: ' + k + ': ' + L.en[k]);
    if (k !== 'footer') assert(!/נשמר|שמירה|ששמרתם|שמרתם|שמור/.test(L.he[k]), 'No "save" wording in Hebrew: ' + k + ': ' + L.he[k]);
  }
  for (const [k, en, he] of [['navStarred', 'Starred', 'מסומנים בכוכב'], ['navStarredShort', 'Starred', 'מסומנים'],
    ['starredTitle', 'Starred uploads', 'העלאות מסומנות בכוכב'], ['starredOnly', 'Starred only', 'מסומנים בכוכב בלבד'],
    ['starAria', 'Star {title}', 'סימון בכוכב: {title}'], ['langLabel', 'Interface language', 'שפת הממשק'],
    ['themeLabel', 'Theme', 'ערכת צבעים'], ['appearanceLabel', 'Appearance', 'מראה'], ['appSystem', 'System', 'לפי המערכת'],
    ['appLight', 'Light', 'בהיר'], ['appDark', 'Dark', 'כהה']]) {
    assert.equal(L.en[k], en, 'Label ' + k); assert.equal(L.he[k], he, 'Label (Hebrew) ' + k);
  }
  // Palette names: English in English, Hebrew in Hebrew (the theme picker's options).
  for (const k of ek.filter(x => x.startsWith('pal_'))) {
    assert(/^[A-Z][a-z]+$/.test(L.en[k]) && /^[\u0590-\u05FF][\u0590-\u05FF ]*$/.test(L.he[k]), 'Palette name in each language: ' + k);
  }
  assert(/this browser only/.test(L.en.themeNote) && /רק בדפדפן הזה/.test(L.he.themeNote), 'The theme note says the choice stays in this browser');
  // Editorial Hebrew titles are labelled as ours wherever their row appears, and About says that both editorial title languages are ours.
  assert.equal(L.en.heEdTitle, 'Editorial Hebrew title', 'Label heEdTitle');
  assert.equal(L.he.heEdTitle, 'כותרת עברית (תרגום מערכת)', 'Label (Hebrew) heEdTitle');
  assert(/^English titles, Hebrew titles where no Hebrew title was published, .* are editorial\./.test(L.en.about3) &&
    /^הכותרות באנגלית, הכותרות בעברית במקום שלא פורסמה כותרת בעברית, .* הן עריכה שלנו\./.test(L.he.about3) && /published title/.test(L.en.about3),
    'About says that the English titles and the Hebrew titles where none was published are editorial');
  assert(/^Starred\b/.test(L.en.starredToast) && /this browser only/.test(L.en.starredToast) && /^סומן בכוכב/.test(L.he.starredToast) &&
    /רק בדפדפן הזה/.test(L.he.starredToast), 'The star toast says the star stays in this browser');
  assert(/star/i.test(L.en.unstarredToast) && /כוכב/.test(L.he.unstarredToast), 'The unstar toast names the star');
  assert(/\{f\} starred/.test(L.en.imported) && /\{f\} מסומנים בכוכב/.test(L.he.imported), 'The import summary counts stars');
  assert(/stars/i.test(L.en.about5) && /stored in this browser only/.test(L.en.about5) && /כוכבים/.test(L.he.about5), 'About names stars');
  for (const k of ['navSaved', 'savedTitle', 'savedOnly', 'saveAria', 'savedToast', 'langSwitch', 'brandCaption', 'navUploads', 'navUploadsShort',
    'navTodo', 'navTodoShort', 'uploadsTitle', 'uploadsLede', 'tdQueue', 'tdMissing', 'tdSlots', 'tdPartsHelp', 'tdExcerptHelp',
    'browseMenu', 'descIdentified', 'descUnidentified', 'descMissing']) {
    assert(!(k in L.en) && !(k in L.he), 'Retired string key ' + k);
  }
  // Browse and the pages under it; the research to-do list. "All uploads" and "To find" are gone from both languages.
  for (const [k, en, he] of [['navBrowse', 'Browse', 'עיון'], ['navBrowseShort', 'Browse', 'עיון'], ['navIdentified', 'Identified videos', 'סרטונים מזוהים'],
    ['navUnidentified', 'Videos to identify', 'סרטונים לזיהוי'], ['navMissing', 'Missing episodes', 'פרקים חסרים'],
    ['identifiedTitle', 'Identified videos', 'סרטונים מזוהים'], ['unidentifiedTitle', 'Videos to identify', 'סרטונים לזיהוי'],
    ['missingTitle', 'Missing episodes', 'פרקים חסרים'], ['todoTitle', 'Research to-do', 'משימות מחקר'],
    ['todoLink', 'Full research to-do list', 'רשימת משימות המחקר המלאה']]) {
    assert.equal(L.en[k], en, 'Label ' + k); assert.equal(L.he[k], he, 'Label (Hebrew) ' + k);
  }
  for (const k of ek) {
    assert(!/All uploads|To find/.test(L.en[k]), 'No "All uploads" or "To find" wording: ' + k);
    // In Hebrew both phrases are also ordinary prose ("כל ההעלאות עדיין מופיעות", "מה חסר"), so only names of views and links are checked.
    if (/^nav|Title$|^todoLink$|^notFound$/.test(k)) assert(!/כל ההעלאות|מה חסר/.test(L.he[k]), 'No "כל ההעלאות" or "מה חסר" view name: ' + k);
  }
  ok(ek.length + ' EN/HE string pairs with matching placeholders; stars, not "saved", in both languages');
}

function checkData(M, payload) {
  const ids = new Set(), urls = new Set();
  for (const r of M.records) {
    assert(safe(r.url), 'Record URL is a public http(s) URL: ' + r.id);
    for (const f of ['directUrl', 'sourceUrl']) if (r[f]) assert(safe(r[f]), `${r.id}: ${f} is safe`);
    assert(!ids.has(r.id), 'Record ids are unique: ' + r.id); ids.add(r.id);
    const key = safe(r.url).replace(/\/$/, ''); assert(!urls.has(key), 'Records are merged by (serialized) URL: ' + r.id); urls.add(key);
    if (r.directLinkProvenance) {
      const pv = r.directLinkProvenance;
      assert(hostKind(r.directUrl) === 'vimeo' && hostKind(r.url) === 'hop', 'Discovered links pair a Hop page with Vimeo');
      // Provenance names the run that read this page, not every run (review round 1), and says when its time is only the
      // run's completion time; a re-read carries its own date, method and attempts.
      assert(!/IL#\d+[^;]*IL#\d+/.test(pv.collectionMethod || ''), r.id + ': the provenance names one collection run');
      if (pv.collectedAtIs) assert(/when its collection run completed/.test(r.verification || ''), r.id + ': a run completion time is said to be one');
      if (pv.recheckedAt) assert(Array.isArray(pv.recheckAttempts) && pv.recheckMethod, r.id + ': a re-read keeps its method and attempts');
    }
  }
  assert(!/__LIBRARY_DATA__/.test(JSON.stringify(payload)), 'Data marker replaced');
  // A check that failed outside Israel (recorded only as text) must carry a status the app reads: never "public".
  let failed = 0;
  for (const r of M.records) {
    if (!failedText(r)) continue;
    failed++;
    assert(['restricted', 'unavailable'].includes(expectAccess(r)), `${r.id}: a recorded failed check is not shown as ${expectAccess(r)}`);
  }
  // Every theme and character resolves to an English and a Hebrew name (else the Hebrew UI shows the English key).
  const tags = new Set();
  for (const r of M.records) for (const f of ['themes', 'characters']) for (const v of r[f] || []) if (typeof v === 'string' && v) tags.add(v);
  for (const v of tags) {
    const pair = NAMES[v.toLowerCase()] || NAMES[normalizeQ(v)];
    assert(pair && typeof pair[0] === 'string' && pair[0].trim() && typeof pair[1] === 'string' && /[\u0590-\u05FF]/.test(pair[1]),
      'Tag has an EN/HE name pair: ' + v);
  }
  if (M.hasGuide && payload.meta?.guideCounts) {
    const gc = payload.meta.guideCounts;
    assert.equal(gc.episodes, M.eps.length); assert.equal(gc.productions, M.prods.length);
    // The builder's printed summary (core Rechov Sumsum separately) agrees with the independent model.
    const buckets = core => {
      const c = {};
      for (const e of M.eps) if (M.isCoreRechov(M.prodById.get(e.production)) === core) c[M.cov(e)] = (c[M.cov(e)] || 0) + 1;
      return c;
    };
    assert.deepEqual(gc.coreRechovCoverage, buckets(true), 'meta.guideCounts.coreRechovCoverage counts core Rechov Sumsum only');
    assert.deepEqual(gc.otherCoverage, buckets(false), 'meta.guideCounts.otherCoverage counts every other production');
    assert.equal(gc.queue, M.queued.size, 'meta.guideCounts.queue');
    assert.equal(gc.possibleCopies, [...M.poss.values()].reduce((s, l) => s + l.length, 0), 'meta.guideCounts.possibleCopies');
  }
  ok(`data: ${M.records.length} records, ${M.hasGuide ? M.eps.length + ' guide episodes' : 'no guide'}; ${failed} failed checks ` +
    `not public; ${tags.size} tags with EN/HE names`);
}

// ---------------------------------------------------------------- edge cases the next data integration may bring
// Records without ids (the builder uses the URL), ids with / ? # % and spaces, title-only records, note-only terms,
// access listings without a check, playback evidence without playbackUrl, odd tags, a 30-upload holding queue and
// evidence details that do and do not agree. Injected into a copy of the payload, so both builds exercise them.
const EDGE = {idless: 'https://www.youtube.com/watch?v=EdgeCase001', weird: 'ia/RS%20S03E50#x?y', prod: 'edge/prod?x#1 y',
  ep1: 'edge/ep?s=1#e1 %', ep3: 'edge-ep-3', seasons: 'edge-seasons', known: 'edge-seasons-known', noname: 'edge-noname',
  iaSpace: 'https://archive.org/details/edge-item-2/Rechov Sumsum 001.mp4', ietv: 'edge-ietv', related: 'edge-related', story: 'edge-story',
  edited: 'edge-edited', editedShalom: 'edge-edited-shalom', evidence: 'edge-evidence'};
function edgePayload(p) {
  const add = r => { p.records.push({themes: [], characters: [], ...r}); return p.records.at(-1); };
  const idless = add({id: EDGE.idless, url: EDGE.idless, series: 'classic', kind: 'episode', title: 'Edge title-only programme 42',
    notes: 'zqnotetoken appears only in this note', durationSeconds: 1500, themes: ['constructor', '__proto__']});
  const ia = add({id: EDGE.weird, url: 'https://archive.org/details/edge-item/RS_S03E50.mp4', series: 'classic', kind: 'episode',
    titleEn: 'Edge archive episode', titleHe: 'פרק ארכיון לבדיקה', uploader: 'משתמש בדיקה',
    notes: {en: 'zqnoteen marker; the host lists the Hebrew title "פרק ארכיון לבדיקה" here'}});
  add({id: 'edge-vpn-listed', url: 'https://www.youtube.com/watch?v=EdgeVpnLst1', series: 'classic', kind: 'clip',
    titleEn: 'Edge VPN listed', access: 'vpn-required'});
  add({id: 'edge-unavail-listed', url: 'https://www.youtube.com/watch?v=EdgeUnavai1', series: 'classic', kind: 'clip',
    titleEn: 'Edge unavailable listed', access: 'unavailable'});
  add({id: 'edge-played-nourl', url: 'https://vimeo.com/123456789/abcdef0123', series: 'modern', kind: 'clip',
    titleEn: 'Edge played without URL', playbackVerified: true, playbackWithoutVpn: true});
  add({id: 'edge-playlist', url: 'https://www.youtube.com/playlist?list=PLedgeAAAA', series: 'classic', kind: 'collection',
    titleEn: 'Edge playlist'});
  add({id: 'edge-kan-item', url: 'https://www.kan.org.il/item/?itemId=1', series: 'classic', kind: 'episode', titleEn: 'Edge Kan item'});
  add({id: 'edge-null-tag', url: 'https://www.youtube.com/watch?v=EdgeNullTg1', series: 'modern', kind: 'clip', titleEn: 'Edge null tag',
    themes: [null, 'Zoe'], characters: [null]});
  // Availability checks in the object form {method, checkedAt, status, result}: the status is what ranks and labels the link.
  const chk = (status, result) => ({method: 'Edge probe (metadata only)', checkedAt: '2026-10-18', status, result});
  add({id: 'edge-check-country', url: 'https://www.youtube.com/watch?v=EdgeChkCty1', series: 'classic', kind: 'clip',
    titleEn: 'Edge object check country', access: 'vpn-required',
    availabilityCheck: chk('country-restricted', 'yt-dlp: The uploader has not made this video available in your country')});
  add({id: 'edge-check-unavail', url: 'https://www.youtube.com/watch?v=EdgeChkUna1', series: 'classic', kind: 'clip',
    titleEn: 'Edge object check unavailable', availabilityCheck: chk('unavailable', 'yt-dlp: It was blocked due to the claimed content by Edge.')});
  add({id: 'edge-check-region', url: 'https://www.example-broadcaster.org/program/edge/', series: 'shalom-modern', kind: 'episode',
    titleEn: 'Edge region-limited stream', availabilityCheck: chk('region-limited', 'page listed; video needs a qualifying location')});
  const queue = [];
  for (let i = 1; i <= 30; i++) {
    const n = String(i).padStart(2, '0');
    queue.push(add({id: 'edge-q-' + n, url: 'https://www.youtube.com/watch?v=EdgeQueue' + n, series: 'classic', kind: 'unverified',
      titleEn: 'Edge queue upload ' + n, durationSeconds: 3000 - i * 10}).id);
  }
  const g = p.guide && Array.isArray(p.guide.productions) ? p.guide : (p.guide = {productions: [], episodes: [], unidentified: {}});
  g.episodes = g.episodes || []; g.unidentified = g.unidentified || {};
  g.productions.push({id: EDGE.prod, series: 'classic', format: 'core', order: 0, years: '1983–1987', nameEn: 'Edge production',
    nameHe: 'הפקת בדיקה', expectedTotal: null, seasons: [{season: 1, numbering: 'documented'}], totalsEvidence: []});
  g.episodes.push({id: EDGE.ep1, production: EDGE.prod, season: 1, number: 1, confidence: 'documented', titleEn: 'Edge episode one',
    titleHe: 'פרק בדיקה אחד', uploads: [{recordId: idless.id, role: 'whole-candidate'}], evidence: 'complete-playback-reviewed',
    evidenceDetail: {level: 'complete-playback-reviewed', recordId: idless.id, url: idless.url, checkedAt: '2026-10-01',
      noteEn: 'Edge evidence note zq'}},
  // The builder rejects this disagreement; the app must not show the stronger level either.
  {id: EDGE.ep3, production: EDGE.prod, season: 1, number: 3, confidence: 'documented', titleEn: 'Edge episode three',
    uploads: [{recordId: ia.id, role: 'whole-candidate'}], evidence: 'metadata-checked',
    evidenceDetail: {level: 'reference-compared', recordId: ia.id, url: ia.url, checkedAt: '2026-10-01'}});
  g.unidentified[EDGE.prod] = queue;
  // Declared seasons with expected counts (3 and 2; season 2 without labels) plus identified episodes outside them
  // (season null, and an undeclared season 9): the outside episodes fill expected places, never on top of them.
  for (const [id, total] of [[EDGE.seasons, null], [EDGE.known, 5]]) {
    g.productions.push({id, series: 'modern', format: 'core', order: 1, years: '2001', nameEn: 'Edge seasons ' + (total ?? 'open'),
      nameHe: 'עונות בדיקה', expectedTotal: total, totalsEvidence: [],
      seasons: [{season: 1, expectedEpisodes: 3, labelEn: 'Edge season one', labelHe: 'עונה אחת לבדיקה', numbering: 'documented'},
        {season: 2, expectedEpisodes: 2}]});
    for (const [k, season, number] of [['a', 1, 1], ['b', 2, 1], ['c', null, null], ['d', 9, null]]) {
      g.episodes.push({id: id + '-' + k, production: id, season, number, confidence: 'provisional', titleEn: `Edge ${id} ${k}`, uploads: []});
    }
  }
  // The declared season key is null but the episodes say season 1 (the builder warns): no placeholders on top of them.
  g.productions.push({id: 'edge-mismatch', series: 'elmo', format: 'talk-show', order: 3, nameEn: 'Edge mismatch', expectedTotal: 2,
    totalsEvidence: [], seasons: [{season: null, expectedEpisodes: 2, labelEn: 'Season 1', labelHe: 'עונה 1'}]});
  for (const k of ['a', 'b']) {
    g.episodes.push({id: 'edge-mismatch-' + k, production: 'edge-mismatch', season: 1, number: null, confidence: 'provisional',
      titleEn: 'Edge mismatch ' + k, uploads: []});
  }
  // A production with neither name (the builder refuses it; the app must still show a heading).
  g.productions.push({id: EDGE.noname, series: 'elmo', format: 'talk-show', order: 2, expectedTotal: null, totalsEvidence: [], seasons: []});
  g.episodes.push({id: 'edge-noname-1', production: EDGE.noname, season: null, number: 1, confidence: 'provisional', titleEn: 'Edge nameless',
    uploads: []});
  // An Internet Archive file whose stored URL has a literal space; one with recorded playback; a '__proto__' record id.
  add({id: 'edge-ia-space', url: EDGE.iaSpace, series: 'classic', kind: 'episode', titleEn: 'Edge archive with space'});
  add({id: 'edge-ia-played', url: 'https://archive.org/details/edge-item-3/file.mp4', series: 'classic', kind: 'episode',
    titleEn: 'Edge archive played zqiaplayed', playbackVerified: true, playbackWithoutVpn: true,
    playbackUrl: 'https://archive.org/details/edge-item-3/file.mp4', playbackVerifiedAt: '2026-10-17'});
  add({id: '__proto__', url: 'https://hop.co.il/show/edge-proto/', series: 'modern', kind: 'clip', titleEn: 'Edge proto id'});
  // Contract additions: a number label with seasons starting at 1 and 66, licensed listings ranked between a Hop page and a
  // blocked upload, a possible copy shared by two episodes (and still queued), explicit part numbers listed out of order,
  // alternate labels with and without a url, a source without a url, and a related series.
  const lic = add({id: 'edge-licensed', url: 'https://www.hoopladigital.com/title/edge0001', series: 'classic', kind: 'episode',
    titleEn: 'Edge licensed listing zqlic', access: 'licensed', durationSeconds: 1700});
  const lic2 = add({id: 'edge-licensed-2', url: 'https://tv.apple.com/us/episode/edge-0002', series: 'classic', kind: 'episode',
    titleEn: 'Edge licensed second zqlic', access: 'licensed'});
  // A licensed listing on a host no service describes: generic labels and the "Other licensed listings" group.
  add({id: 'edge-licensed-other', url: 'https://www.vudu.com/content/movies/details/edge-0003', series: 'classic', kind: 'clip',
    titleEn: 'Edge licensed other zqlic', access: 'licensed'});
  const hopE = add({id: 'edge-hop-page', url: 'https://hop.co.il/shows/edge-hop-page/', series: 'classic', kind: 'episode',
    titleEn: 'Edge Hop page', access: 'vpn-required'});
  const blocked = add({id: 'edge-blocked', url: 'https://www.youtube.com/watch?v=EdgeBlock01', series: 'classic', kind: 'episode',
    titleEn: 'Edge blocked upload', access: 'vpn-required', availabilityCheck: 'country-restricted'});
  const poss = add({id: 'edge-possible', url: 'https://archive.org/details/edge-item-4/S3E34.mp4', series: 'classic', kind: 'episode',
    titleEn: 'Edge possible copy', durationSeconds: 1690});
  const parts = [1, 2, 3].map(i => add({id: 'edge-part-' + i, url: 'https://www.youtube.com/watch?v=EdgePart00' + i, series: 'classic',
    kind: 'clip', titleEn: 'Edge part ' + i, durationSeconds: 600}));
  // Review round 1: a record that is an excerpt of one episode and the whole candidate of a later one (its card tag and
  // breadcrumb follow the whole link); an episode with only parts 2 and 3 ("Part 2 of 3"); a possible copy that is not queued;
  // queued uploads whose S1E9 or S1E8 matches the alternate labels of 4 or 8 episodes equally; a note that quotes "<3>".
  const tape = add({id: 'edge-tape', url: 'https://www.youtube.com/watch?v=EdgeTape001', series: 'modern', kind: 'collection',
    titleEn: 'Edge tape zqtape', durationSeconds: 2400});
  const gp = [2, 3].map(i => add({id: 'edge-gp-' + i, url: 'https://www.youtube.com/watch?v=EdgeGapPt0' + i, series: 'modern',
    kind: 'clip', titleEn: 'Edge gapped part ' + i, durationSeconds: 500}));
  const poss2 = add({id: 'edge-possible-free', url: 'https://archive.org/details/edge-item-5/free.mp4', series: 'modern', kind: 'episode',
    titleEn: 'Edge unqueued possible zqposs', durationSeconds: 1500});
  const tied = add({id: 'edge-tied', url: 'https://archive.org/details/edge-item-6/S1E9.mp4', series: 'modern', kind: 'episode',
    titleEn: 'Edge tied S1E9 upload', durationSeconds: 1600});
  const crowd = add({id: 'edge-crowd', url: 'https://archive.org/details/edge-item-6/S1E8.mp4', series: 'modern', kind: 'episode',
    titleEn: 'Edge crowd S1E8 upload', durationSeconds: 1590});
  g.productions.push({id: EDGE.ietv, series: 'classic', format: 'core', order: 0, years: '1983', nameEn: 'Edge IETV', nameHe: 'חינוכית לבדיקה',
    numberLabelEn: 'Edge no.', numberLabelHe: 'מס׳ בדיקה', expectedTotal: 6, totalsEvidence: [],
    seasons: [{season: 1, expectedEpisodes: 3, numbering: 'documented'}, {season: 2, firstNumber: 66, expectedEpisodes: 3, numbering: 'documented'}]});
  const ietv = (n, season, uploads, extra = {}) => g.episodes.push({id: EDGE.ietv + '-' + n, production: EDGE.ietv, season, number: n,
    confidence: 'documented', titleEn: 'Edge IETV programme ' + n, uploads, ...extra});
  ietv(1, 1, [{recordId: lic2.id, role: 'whole-candidate'}, {recordId: hopE.id, role: 'whole-candidate'}, {recordId: blocked.id, role: 'whole-candidate'},
    {recordId: tape.id, role: 'excerpt'}]);
  ietv(3, 1, [{recordId: parts[2].id, role: 'part', part: 3}, {recordId: parts[0].id, role: 'part', part: 1}, {recordId: parts[1].id, role: 'part', part: 2}]);
  ietv(66, 2, [{recordId: poss.id, role: 'possible'}], {
    altLabels: [{labelEn: 'Edge S2E20', labelHe: 'בדיקה עונה 2 פרק 20', sourceLabel: 'Edge uploader', url: 'https://archive.org/details/edge-item-4'},
      {labelEn: 'Edge tape 7', sourceLabel: 'Edge tape label'}],
    sources: [{label: 'Edge printed catalogue, no url'}, {label: 'קטלוג מודפס לבדיקה'}],
    noteEn: 'Edge research note: the catalogue cross-references <3>, which is another programme.'});
  // The Apple TV listing comes before the hoopla one: the free model (library card) still wins the Watch link.
  ietv(68, 2, [{recordId: poss.id, role: 'possible'}, {recordId: blocked.id, role: 'alternate-edition'},
    {recordId: lic2.id, role: 'whole-candidate'}, {recordId: lic.id, role: 'whole-candidate'}]);
  g.unidentified[EDGE.ietv] = [poss.id];
  // Eight labelled episodes: 1-4 carry the alternate label S1E9 and all eight S1E8.
  g.productions.push({id: 'edge-tie', series: 'modern', format: 'short-series', order: 7, years: '2011', nameEn: 'Edge tie series',
    nameHe: 'סדרת שוויון לבדיקה', numberLabelEn: 'Tie no.', numberLabelHe: 'מס׳ שוויון', expectedTotal: null, totalsEvidence: [], seasons: []});
  for (let n = 1; n <= 8; n++) {
    g.episodes.push({id: 'edge-tie-' + n, production: 'edge-tie', season: null, number: n, confidence: 'documented', titleEn: 'Edge tie ' + n,
      ...(n === 1 ? {titleHeEditorial: 'Edge (שוויון 1–2) זקשוויון'} : {}),
      uploads: [], altLabels: [...(n <= 4 ? [{labelEn: 'Edge S1E9', sourceLabel: 'Edge uploader'}] : []),
        {labelEn: 'Edge S1E8', sourceLabel: 'Edge uploader'}]});
  }
  g.unidentified['edge-tie'] = [tied.id, crowd.id];
  // An untitled labelled number without uploads: its To find search uses the Hebrew number label.
  g.episodes.push({id: 'edge-tie-9', production: 'edge-tie', season: null, number: 9, confidence: 'documented', uploads: []});
  // Catalogue titles in the IETV form: only the series name and "<n>" (with an editorial English title, which the Hebrew search
  // does not use), and the series name, "<n>" and a story.
  g.episodes.push({id: 'edge-tie-10', production: 'edge-tie', season: null, number: 10, confidence: 'documented',
    titleHe: 'רחוב סומסום <10>', titleEn: 'Edge tie bare ten', uploads: []});
  g.episodes.push({id: 'edge-tie-11', production: 'edge-tie', season: null, number: 11, confidence: 'documented',
    titleHe: 'רחוב סומסום <11> - סיפור שוויון', uploads: []});
  // Numbered 66-70 (firstNumber 66, five expected) with only 66 and 67 identified: 68-70 are expected cells past the highest number.
  g.productions.push({id: 'edge-first', series: 'modern', format: 'short-series', order: 8, years: '2012', nameEn: 'Edge first-number series',
    nameHe: 'סדרת מספר פתיחה לבדיקה', expectedTotal: null,
    seasons: [{season: 1, numbering: 'documented'}, {season: 3, firstNumber: 66, expectedEpisodes: 5, numbering: 'documented'}],
    totalsEvidence: [{value: 5, confidence: 'primary', scope: 'season 3', sourceLabel: 'Edge printed catalogue zqnourl'}]});
  for (const n of [66, 67]) {
    g.episodes.push({id: 'edge-first-' + n, production: 'edge-first', season: 3, number: n, confidence: 'documented',
      titleEn: 'Edge first-number episode ' + n, uploads: [],
      altLabels: [{labelEn: 'hoopla Season 2, Episode ' + n, labelHe: 'hoopla עונה 2, פרק ' + n, sourceLabel: 'Edge distributor'}]});
  }
  for (const n of [1, 10]) {
    g.episodes.push({id: 'edge-first-s1-' + n, production: 'edge-first', season: 1, number: n, confidence: 'documented',
      titleEn: 'Edge first-number season one ' + n, uploads: []});
  }
  g.productions.push({id: 'edge-gapped', series: 'modern', format: 'short-series', order: 6, years: '2010', nameEn: 'Edge gapped series',
    nameHe: 'סדרת בדיקה עם פערים', expectedTotal: null, totalsEvidence: [], seasons: []});
  const gapped = (n, titleEn, uploads) => g.episodes.push({id: 'edge-gapped-' + n, production: 'edge-gapped', season: null, number: n,
    confidence: 'documented', titleEn, uploads});
  gapped(1, 'Edge gapped one', [{recordId: gp[1].id, role: 'part', part: 3}, {recordId: gp[0].id, role: 'part', part: 2}]);
  gapped(2, 'Edge gapped two', [{recordId: poss2.id, role: 'possible'}]);
  gapped(3, 'Edge gapped tape', [{recordId: tape.id, role: 'whole-candidate'}]);
  g.productions.push({id: EDGE.related, series: 'modern', format: 'related-series', order: 5, years: '2003', nameEn: 'Edge related series',
    nameHe: 'סדרה קשורה לבדיקה', expectedTotal: 4, totalsEvidence: [], seasons: []});
  g.episodes.push({id: EDGE.related + '-1', production: EDGE.related, season: null, number: 1, confidence: 'documented',
    titleEn: 'Edge related episode', uploads: []});
  // Its second episode's only link failed an availability check, so every build has a tile and a List row to mark (R4-01).
  g.episodes.push({id: EDGE.related + '-2', production: EDGE.related, season: null, number: 2, confidence: 'documented',
    titleEn: 'Edge related failed link', uploads: [{recordId: 'edge-check-unavail', role: 'whole-candidate'}]});
  // Story names: catalogue titles without a story name ("<n>") and a Hebrew story name quoted from another source (storyHe).
  // 1 has an editorial English title, sources in both languages and an upload; 2 has no English title and an English source
  // name only; 3's blank storyHe (the builder refuses it) is ignored.
  const storyRec = add({id: 'edge-story-upload', url: 'https://archive.org/details/edge-item-7/S1E44.mp4', series: 'classic',
    kind: 'episode', titleEn: 'Edge story upload zqrecord', durationSeconds: 1780});
  g.productions.push({id: EDGE.story, series: 'classic', format: 'core', order: 0.5, years: '1983', nameEn: 'Edge story series',
    nameHe: 'סדרת סיפורים לבדיקה', numberLabelEn: 'Story no.', numberLabelHe: 'מס׳ סיפור', expectedTotal: 3, totalsEvidence: [], seasons: []});
  const story = (n, extra) => g.episodes.push({id: EDGE.story + '-' + n, production: EDGE.story, season: null, number: n,
    confidence: 'documented', titleHe: 'סדרת סיפורים <' + n + '>', uploads: [], ...extra});
  story(1, {titleEn: 'Edge story basketball', storyHe: 'משחק כדורסל zqstory', storySourceEn: "Edge archive file label (uploader's wording)",
    storySourceHe: 'תווית קובץ בארכיון לבדיקה (ניסוח המעלה)', uploads: [{recordId: storyRec.id, role: 'whole-candidate'}]});
  story(2, {storyHe: 'סיפור בלי כותרת באנגלית', storySourceEn: "Edge archive file label 'עונה 1 פרק 45'"});
  story(3, {titleEn: 'Edge story blank', storyHe: '  ', storySourceEn: 'Edge ignored source'});
  // Editorial Hebrew titles (titleHeEditorial): our translation for an item with no published Hebrew title. Episode 1 has an upload
  // with one, 2 has no English title, 3 and 4 have a published titleHe or storyHe beside one (the builder refuses that; the app
  // shows the published title), and 5's is blank (refused too; ignored). The Shalom Sesame episode is searched by its English
  // title. Each value has a nonsense word (זק...) that occurs nowhere else, for search and for "shown nowhere else" checks.
  // Episode 2's value and the edge-ed-latin clip's start with a Latin word or bracket and have a number range (laid out RTL); so
  // do the upload, the queued upload, episode 1 and the unnumbered episodes, so that every place that shows an editorial title
  // (queue items, Videos to identify rows, upload rows, Up next, record links, suggestions, the pasted-link banner, unnumbered
  // links) can tell RTL from dir=auto and an isolated range from a bare one (review round 1).
  const edRec = add({id: 'edge-ed-rec', url: 'https://www.youtube.com/watch?v=EdgeHeEdRc1', series: 'classic', kind: 'episode',
    titleEn: 'Edge editorial upload', originalTitle: 'Edge Upload As Published', titleHeEditorial: 'Edge (העלאה בעריכת המערכת 1–3) זקהעלאה',
    durationSeconds: 1610, production: EDGE.edited, guideEpisodeId: EDGE.edited + '-1'});
  add({id: 'edge-ed-clip', url: 'https://www.youtube.com/watch?v=EdgeHeEdCl1', series: 'shalom-modern', kind: 'clip',
    titleEn: 'Edge editorial clip', titleHeEditorial: 'קטע בעריכת המערכת זקקטע', durationSeconds: 95});
  add({id: 'edge-ed-pub', url: 'https://www.youtube.com/watch?v=EdgeHeEdPb1', series: 'classic', kind: 'clip',
    titleEn: 'Edge editorial beside published', titleHe: 'כותרת שפורסמה להעלאה', titleHeEditorial: 'זקמוסתר העלאה'});
  add({id: 'edge-ed-blank', url: 'https://www.youtube.com/watch?v=EdgeHeEdBl1', series: 'classic', kind: 'clip',
    titleEn: 'Edge editorial blank', titleHeEditorial: '   '});
  const edQueued = add({id: 'edge-ed-queued', url: 'https://www.youtube.com/watch?v=EdgeHeEdQu1', series: 'classic', kind: 'unverified',
    titleEn: 'Edge editorial queued', titleHeEditorial: '[VHS] העלאה ממתינה בעריכת המערכת 2–4 זקתור', durationSeconds: 1500});
  add({id: 'edge-ed-latin', url: 'https://www.youtube.com/watch?v=EdgeHeEdLt1', series: 'shalom-modern', kind: 'clip',
    titleEn: 'Edge editorial Latin first', titleHeEditorial: 'Edgemaster (תכניות 1–5) זקלטיני', durationSeconds: 80});
  // A Vimeo upload (its link in a search shows the pasted-link banner) that is an excerpt of the two unnumbered episodes.
  const edVimeo = add({id: 'edge-ed-vimeo', url: 'https://vimeo.com/987650001', series: 'classic', kind: 'clip', titleEn: 'Edge editorial Vimeo',
    titleHeEditorial: 'Vimeo (קטע בעריכה 3–4) זקוימאו', durationSeconds: 200, production: EDGE.edited, guideEpisodeId: EDGE.edited + '-6'});
  // Search: letter names with gershayim, ט״ו and plene spellings, found when typed without them (review round 1).
  for (const [k, he] of [['shin', 'לומדים את האות שי״ן זקאות'], ['menorah', 'חנוכה: החנוכייה שנעלמה זקחנוכה'],
    ['mitzvah', 'מצווה ברחוב זקמצווה'], ['shvat', 'ט״ו בשבט זקשבט']]) {
    add({id: 'edge-ed-' + k, url: 'https://www.youtube.com/watch?v=EdgeHeSr' + k.slice(0, 3), series: 'shalom-modern', kind: 'clip',
      titleEn: 'Edge search ' + k, titleHeEditorial: he, durationSeconds: 60});
  }
  // A Hop page with an editorial title: a pasted Vimeo link stores only the published Hebrew title (none here).
  add({id: 'edge-ed-hop', url: 'https://hop.co.il/shows/edge-ed-hop/', series: 'modern', kind: 'clip', titleEn: 'Edge editorial Hop',
    titleHeEditorial: 'Edge (הופ בעריכה 5–6) זקהופ', access: 'vpn-required', durationSeconds: 90});
  // Title sort: the English and the editorial titles sort in opposite orders.
  add({id: 'edge-sort-a', url: 'https://www.youtube.com/watch?v=EdgeSortA01', series: 'classic', kind: 'clip', titleEn: 'Edge sort Alpha zqsort',
    titleHeEditorial: 'תמר זקמיון', durationSeconds: 70});
  add({id: 'edge-sort-b', url: 'https://www.youtube.com/watch?v=EdgeSortB01', series: 'classic', kind: 'clip', titleEn: 'Edge sort Zulu zqsort',
    titleHeEditorial: 'אגס זקמיון', durationSeconds: 70});
  g.productions.push({id: EDGE.edited, series: 'classic', format: 'core', order: 0.6, years: '1984', nameEn: 'Edge edited series',
    nameHe: 'סדרה בעריכה לבדיקה', expectedTotal: 7, totalsEvidence: [], seasons: []});
  const edited = (n, extra) => g.episodes.push({id: EDGE.edited + '-' + n, production: EDGE.edited, season: null, number: n,
    confidence: 'documented', uploads: [], ...extra});
  edited(1, {titleEn: 'Edge edited episode', titleHeEditorial: 'Edge (פרק בעריכת המערכת 1–2) זקפרק',
    uploads: [{recordId: edRec.id, role: 'whole-candidate'}]});
  edited(2, {titleHeEditorial: '[VHS] פרק בלי כותרת באנגלית 1–5 זקבלי'});
  edited(3, {titleEn: 'Edge edited published', titleHe: 'כותרת שפורסמה לפרק', titleHeEditorial: 'זקמוסתר פרק'});
  edited(4, {titleEn: 'Edge edited story', titleHe: 'סדרה בעריכה <4>', storyHe: 'סיפור שפורסם לבדיקה', storySourceEn: 'Edge file label',
    titleHeEditorial: 'זקמוסתר סיפור'});
  edited(5, {titleEn: 'Edge edited blank', titleHeEditorial: '  '});
  // Two unnumbered episodes, each with an editorial title, sharing one excerpt (the card's tag names both in its tooltip).
  for (const [n, he] of [[6, 'Edge (פרק בלי מספר 7–8) זקשישה'], [7, 'Edge (פרק נוסף בלי מספר 9–10) זקשבעה']]) {
    g.episodes.push({id: EDGE.edited + '-' + n, production: EDGE.edited, season: null, number: null, confidence: 'documented',
      titleEn: 'Edge edited unnumbered ' + n, titleHeEditorial: he, uploads: [{recordId: edVimeo.id, role: 'excerpt'}]});
  }
  g.unidentified[EDGE.edited] = [edQueued.id];
  g.productions.push({id: EDGE.editedShalom, series: 'shalom-classic', format: 'core', order: 12.5, years: '1986',
    nameEn: 'Edge edited Shalom Sesame', nameHe: 'שלום סומסום בעריכה לבדיקה', expectedTotal: 1, totalsEvidence: [], seasons: []});
  g.episodes.push({id: EDGE.editedShalom + '-1', production: EDGE.editedShalom, season: null, number: 1, confidence: 'documented',
    titleEn: 'Edge Shalom edited', titleHeEditorial: 'שלום בעריכת המערכת זקשלום', uploads: []});
  // Evidence in words (request 06): one episode at each level, from nothing linked to compared with a reference.
  const evRec = (k, extra = {}) => add({id: 'edge-ev-' + k, url: 'https://archive.org/details/edge-ev/' + k + '.mp4', series: 'modern',
    kind: 'episode', titleEn: 'Edge evidence upload ' + k, durationSeconds: 1500, ...extra});
  const evB = evRec('base'), evF = evRec('full'), evR = evRec('ref'), evP = evRec('played', {playbackVerified: true,
    playbackUrl: 'https://archive.org/details/edge-ev/played.mp4', playbackVerifiedAt: '2026-10-17'});
  g.productions.push({id: EDGE.evidence, series: 'modern', format: 'short-series', order: 9, years: '2013', nameEn: 'Edge evidence series',
    nameHe: 'סדרת ראיות לבדיקה', expectedTotal: 5, totalsEvidence: [], seasons: []});
  const evEp = (n, uploads, extra = {}) => g.episodes.push({id: EDGE.evidence + '-' + n, production: EDGE.evidence, season: null, number: n,
    confidence: 'documented', titleEn: 'Edge evidence ' + n, uploads, ...extra});
  const stated = (r, level, checkedAt) => ({evidence: level, evidenceDetail: {level, recordId: r.id, url: r.url, checkedAt}});
  evEp(1, []); evEp(2, [{recordId: evB.id, role: 'whole-candidate'}]); evEp(3, [{recordId: evP.id, role: 'whole-candidate'}]);
  evEp(4, [{recordId: evF.id, role: 'whole-candidate'}], stated(evF, 'complete-playback-reviewed', '2026-10-02'));
  evEp(5, [{recordId: evR.id, role: 'whole-candidate'}], stated(evR, 'reference-compared', '2026-10-03'));
  // Entries and link order: one episode with whole copies on four hosts and a failed one; one with two parts only; one whose
  // only copy is on a subscribed service; a record counted whole in two episodes (an entry of its own); and two Hop pages that
  // embed the same Vimeo video (one entry).
  const svcList = p.services && Array.isArray(p.services.services) ? p.services.services : null;
  if (svcList) svcList.push({id: 'edge-stream', name: 'Edge Stream', model: 'subscription', subscribed: true, hosts: ['edgestream.example'],
    summary: {en: 'Edge Stream, a subscription the user has.', he: 'שירות בדיקה במנוי.'}, sources: [{id: 'edge-src', kind: 'user-observation',
      checkedAt: '2026-10-19', title: 'Edge', finding: 'Edge'}]});
  const ord = (id, url, extra = {}) => add({id, url, series: 'modern', kind: 'episode', titleEn: 'Edge order copy ' + id + ' zqorder', durationSeconds: 1500, ...extra});
  ord('edge-ord-yt', 'https://www.youtube.com/watch?v=EdgeOrderYt1');
  ord('edge-ord-ia', 'https://archive.org/details/edge-order/one.mp4');
  ord('edge-ord-ia-bad', 'https://archive.org/details/edge-order/bad.mp4', {availabilityCheck: chk('unavailable', 'item dark')});
  ord('edge-ord-sub', 'https://play.edgestream.example/episode/1', {access: 'licensed'});
  ord('edge-ord-vm', 'https://vimeo.com/555666777');
  ord('edge-ord-p1', 'https://www.youtube.com/watch?v=EdgeOrderP01', {kind: 'clip', durationSeconds: 700});
  ord('edge-ord-p2', 'https://www.youtube.com/watch?v=EdgeOrderP02', {kind: 'clip', durationSeconds: 800});
  ord('edge-ord-only-sub', 'https://play.edgestream.example/episode/3', {access: 'licensed'});
  ord('edge-ord-comp', 'https://archive.org/details/edge-order/compilation.mp4', {kind: 'collection', durationSeconds: 3600});
  ord('edge-ord-ia6', 'https://archive.org/details/edge-order/six.mp4');
  ord('edge-ord-bad7', 'https://archive.org/details/edge-order/seven.mp4', {availabilityCheck: chk('unavailable', 'item dark')});
  ord('edge-ord-ex7', 'https://www.youtube.com/watch?v=EdgeOrderX07', {kind: 'clip', durationSeconds: 300});
  add({id: 'edge-twin-a', url: 'https://hop.co.il/shows/edge-twin-a/', directUrl: 'https://vimeo.com/987654321/aaaa', series: 'modern', kind: 'clip',
    titleEn: 'Edge twin A zqtwin'});
  add({id: 'edge-twin-b', url: 'https://hop.co.il/music/edge-twin-b/', directUrl: 'https://vimeo.com/987654321/aaaa', series: 'modern', kind: 'clip',
    titleEn: 'Edge twin B zqtwin'});
  g.productions.push({id: 'edge-order', series: 'modern', format: 'core', order: 0, years: '2026', nameEn: 'Edge order', nameHe: 'סדר בדיקה',
    expectedTotal: 7, totalsEvidence: [], seasons: []});
  const oe = (n, uploads) => g.episodes.push({id: 'edge-order-' + n, production: 'edge-order', season: null, number: n, confidence: 'documented',
    titleEn: 'Edge order episode ' + n, uploads});
  oe(1, ['edge-ord-yt', 'edge-ord-ia-bad', 'edge-ord-sub', 'edge-ord-vm', 'edge-ord-ia'].map(recordId => ({recordId, role: 'whole-candidate'})));
  // A summary whose source has no url of its own, on an episode whose first source is another site (a title listing).
  Object.assign(g.episodes.at(-1), {summaryEn: 'Edge summary sentence.', summarySource: {label: 'Muppet Wiki, first scene', revisionId: 7},
    sources: [{label: 'Prime Video, edge season', url: 'https://www.primevideo.com/detail/EDGE'}, {label: 'Muppet Wiki, Episode Edge', url: 'https://muppet.fandom.com/wiki/Edge'}]});
  oe(2, [{recordId: 'edge-ord-p2', role: 'part', part: 2}, {recordId: 'edge-ord-p1', role: 'part', part: 1}]);
  oe(3, [{recordId: 'edge-ord-only-sub', role: 'whole-candidate'}]);
  const comp = {recordId: 'edge-ord-comp', role: 'whole-candidate', container: 'compilation', extentNoteEn: 'Edge order episodes 4, 5 and 6.'};
  oe(4, [comp]);
  oe(5, [comp]);
  // Listed first, the compilation still ranks after the episode's own copy on the same host.
  oe(6, [comp, {recordId: 'edge-ord-ia6', role: 'whole-candidate'}]);
  // Every whole copy failed: Watch opens the usable excerpt, which is outside the episode's entry.
  oe(7, [{recordId: 'edge-ord-bad7', role: 'whole-candidate'}, {recordId: 'edge-ord-ex7', role: 'excerpt'}]);
  return p;
}

// Evidence in words (request 06: "I don't understand what these cellular signal strength bars are supposed to mean"). No bar
// glyph or other unlabelled evidence graphic anywhere; tiles and compact List rows show a text badge only above the baseline
// (details checked, which every linked episode has); the List's Evidence column and the episode page's tag name every level in
// words; the ladder, the production summary (words and counts) and the legend (one line per level) use the same words.
function assertNoBars(H, where) {
  assert(!H.find(n => H.cls(n).some(c => /^pips?$/.test(c))).length, where + ': no evidence bar glyph');
}
async function checkEvidenceWords(H, M) {
  const enc = encodeURIComponent, eps = [1, 2, 3, 4, 5].map(n => M.eps.find(e => e.id === EDGE.evidence + '-' + n));
  const levels = eps.map(e => M.ev(e)), name = (lang, lv) => tr(lang, lv ? 'ev_' + lv : 'ev_none');
  assert.deepEqual(levels, [null, ...EVS], 'One fixture episode at each evidence level');
  const hiddenUpTo = (n, stop) => { for (let x = n; x && x !== stop; x = x.parentElement) if (x.getAttribute?.('aria-hidden') === 'true') return true; return false; };
  for (const lang of ['en', 'he']) {
    if (H.document.documentElement.lang !== lang) await H.flipLang();
    await H.navigate('guide/' + EDGE.evidence + '?layout=album'); assertNoBars(H, lang + ' tiles');
    eps.forEach((e, k) => {
      const a = H.fk('ep-' + e.id), tile = a.parentElement.parentElement, lv = levels[k], where = `${lang} tile ${e.id} (${lv})`;
      const badges = H.byClass('ev-badge', tile), strong = EVS.indexOf(lv) >= 1, meta = H.byClass('tile-meta', tile)[0];
      assert.equal(badges.length, strong ? 1 : 0, where + ': a badge only above the baseline');
      if (strong) {
        assert.equal(badges[0].textContent, name(lang, lv), where + ': the badge says the level in words');
        assert(!hiddenUpTo(badges[0], tile), where + ': the badge is real text, not aria-hidden');
        assert.equal(badges[0].getAttribute('title'), tr(lang, 'evLong_' + lv), where + ': its hint explains the level');
      }
      // The link's name keeps the code, title and coverage; the evidence is the badge's text, read once.
      assert(EVS.every(x => !a.getAttribute('aria-label').includes(tr(lang, 'ev_' + x))), where + ': the link name does not repeat the evidence');
      assert.notEqual(meta.getAttribute('aria-hidden'), 'true', where + ': the meta row is not hidden as a whole');
      const hidden = H.find(n => n !== meta && n.getAttribute?.('aria-hidden') === 'true', meta);
      assert(hidden.every(n => H.cls(n).includes('glyph') || H.cls(n).includes('cov-word')), where + ': no other unlabelled graphic in the meta row');
    });
    await H.navigate('guide/' + EDGE.evidence + '?layout=list'); assertNoBars(H, lang + ' list');
    eps.forEach((e, k) => {
      const row = H.fk('row-' + e.id).parentElement.parentElement, cell = H.byClass('c-ev', row)[0], lv = levels[k], where = `${lang} row ${e.id}`;
      assert.equal(cell.textContent, name(lang, lv), where + ': the Evidence column names every level, the baseline too');
      assert(!cell.children.some(c => c && c.tagName && c.tagName !== '#text'), where + ': in text only');
      const inline = H.byClass('ev-inline', row);
      assert.equal(inline.length, EVS.indexOf(lv) >= 1 ? 1 : 0, where + ': a compact row badge only above the baseline');
      if (inline.length) assert.equal(inline[0].textContent, name(lang, lv), where + ': the compact badge in words');
    });
    for (const [k, e] of eps.entries()) {
      await H.navigate('episode/' + enc(e.id)); assertNoBars(H, `${lang} episode ${e.id}`);
      const lv = levels[k], tag = H.fk('ep-ev');
      assert.equal(tag.textContent, name(lang, lv), `${lang} episode ${e.id}: the tag names the level`);
      assert.equal(tag.getAttribute('title'), lv ? tr(lang, 'evLong_' + lv) : tr(lang, 'evNoneLong'), `${lang} episode ${e.id}: its hint`);
      const steps = H.byClass('ladder')[0].children;
      steps.forEach((li, i) => {
        const strong = H.find(n => n.tagName === 'strong', li)[0], now = H.byClass('nowtag', li).length > 0;
        assert(strong.textContent.startsWith(tr(lang, 'ev_' + EVS[i])), `${lang} episode ${e.id}: ladder step ${i + 1} uses the same words`);
        assert.equal(now, EVS[i] === lv, `${lang} episode ${e.id}: "Now" marks the level`);
      });
    }
    await H.navigate('guide/' + EDGE.evidence);
    const es = H.byClass('evsum')[0], want = tr(lang, 'evSummary') + ':' + ['none', ...EVS].map(x => tr(lang, 'ev_' + x) + ': 1').join('');
    assert.equal(es.textContent, want, lang + ': the production summary gives words and counts');
    const col = H.byClass('legend-body')[0].children.find(c => c.children[0]?.textContent === tr(lang, 'legendEvidence'));
    const dl = col.children[1], dts = dl.children.filter(c => c.tagName === 'dt'), dds = dl.children.filter(c => c.tagName === 'dd');
    assert.deepEqual(dts.map(d => d.textContent), EVS.map(x => tr(lang, 'ev_' + x)), lang + ': the legend names each level in words');
    assert(dts.every(d => d.children.every(c => c.tagName === '#text')), lang + ': with no mark beside it');
    assert.deepEqual(dds.map(d => d.textContent), EVS.map((x, i) => tr(lang, 'evLong_' + x) + (i ? '' : ' ' + tr(lang, 'evTileNote'))),
      lang + ': one line each, the baseline saying tiles show no badge for it');
  }
  if (H.document.documentElement.lang !== 'en') await H.flipLang();
  // The words never read like the user's own Watched marks.
  for (const lang of ['en', 'he']) {
    for (const k of ['none', ...EVS]) {
      for (const v of [tr(lang, 'ev_' + k), k === 'none' ? tr(lang, 'evNoneLong') : tr(lang, 'evLong_' + k)]) {
        assert(!/watch/i.test(v) && !/צפ/.test(v), `${lang} evidence wording does not say "watched": ${v}`);
      }
    }
  }
  assert(EVS.every(x => tr('en', 'ev_' + x) !== L.en.seenBadge && tr('he', 'ev_' + x) !== L.he.seenBadge), 'Evidence labels differ from Watched by you');
  ok('evidence in words: no bars; tile and compact-row badges only above the baseline, as real text with a hint; the List column ' +
    'and episode tag name every level; the ladder, the production summary (words and counts) and the legend use the same ' +
    'words, never "watched" (EN, HE)');
}

async function checkEdgeCases(htmlPath) {
  const H = harness(boot(htmlPath, {payload: edgePayload})), M = model(H.payload), N = M.records.length;
  const enc = encodeURIComponent, domId = s => String(s).replace(/\s/g, '_');
  const qitems = within => H.byClass('qitem', within).length;
  // Encoded routes: ids that are URLs or contain / ? # % open from the rendered links and from their hrefs.
  for (const [id, title, q] of [[EDGE.idless, 'Edge title-only programme 42', 'Edge title-only'], [EDGE.weird, 'Edge archive episode', 'Edge archive']]) {
    // An upload that is a copy of an episode is listed under its episode in Browse; Identified videos lists it on its own.
    await H.navigate((M.entryOf.get(id).id === id ? 'browse' : 'browse/identified') + '?q=' + enc(q));
    const card = H.fk('card-' + id);
    assert.equal(card.href, '#/record/' + enc(id), 'Record links encode their id: ' + id);
    await card.click();
    assert.equal(H.h1().textContent, title, 'The record page opens from its card: ' + id);
    assert.equal(H.document.title, title + ' · ' + L.en.appName);
    await H.navigate('browse'); await H.navigate(card.href.slice(2));
    assert.equal(H.h1().textContent, title, 'The record page opens from its href (new tab, hashchange): ' + id);
  }
  await H.navigate(M.hasGuide ? 'guide/' + enc(EDGE.prod) : 'guide');
  assert.equal(H.h1().textContent, 'Edge production', 'A production id with / ? # and a space opens');
  assert(H.$('prod-' + domId(EDGE.prod)), 'DOM ids derived from data ids have no spaces');
  await H.fk('ep-' + EDGE.ep1).click();
  assert.equal(H.h1().textContent, 'Edge episode one', 'An episode id with / ? # % opens from its tile');
  await H.navigate('guide/' + enc(EDGE.prod) + '?layout=numbers');
  await H.fk('cell-' + EDGE.prod + '-1-1').click();
  assert.equal(H.h1().textContent, 'Edge episode one', 'and from its strip cell');
  await H.find(n => n.tagName === 'a' && n.href === '#/guide/' + enc(EDGE.prod))[0].click();
  assert.equal(H.h1().textContent, 'Edge production', 'Breadcrumbs encode production ids');
  await H.navigate('guide/' + enc(EDGE.prod));
  ok('encoded routes: record, episode and production ids with / ? # % and spaces open from links and hrefs');

  // Title-only records, note-only terms, odd tags.
  const count = async q => { await H.navigate('browse?q=' + enc(q)); return H.count(); };
  assert.equal(await count('Edge title-only programme'), 1, 'A title-only record is found by its title');
  await H.navigate('record/' + enc(EDGE.idless)); assert.notEqual(H.h1().textContent, L.en.untitled);
  assert.equal(await count('zqnotetoken'), 1, 'Research notes (string) are searchable');
  assert.equal(await count('zqnoteen'), 1, 'Research notes ({en, he}) are searchable');
  assert.equal(await count('constructor'), 1, "A 'constructor' tag does not break search");
  assert(await count('elmo') >= 0);
  await H.navigate('record/edge-null-tag');
  assert.equal(H.h1().textContent, 'Edge null tag', 'A null tag does not break the record page');
  ok('title-only records, note-only search terms, prototype-named and null tags');

  // Pasted links whose identity is in the query string (playlists, Kan item pages) match only the same query.
  for (const [url, hit] of [['https://www.youtube.com/playlist?list=PLedgeZZZZ', ''], ['https://www.youtube.com/playlist?list=PLedgeAAAA', 'edge-playlist'],
    ['https://www.kan.org.il/item/?itemId=999999', ''], ['https://www.kan.org.il/item/?itemId=1&utm_source=x', 'edge-kan-item']]) {
    assert.equal(await count(url), hit ? 1 : 0, 'Pasted link query decides the match: ' + url);
    assert(H.text().includes(hit ? L.en.urlHit : tr('en', 'urlMiss', {id: '\u0000'}).split('\u0000')[0]), 'Banner for ' + url);
    if (hit) assert(H.has(cardKey(M, hit), H.view()));
  }
  ok('pasted links: the query string identifies playlists and item pages');

  // Access lines and notes state only what the data records; playback evidence needs the exact checked URL.
  const recordAccess = async id => { await H.navigate('record/' + enc(id)); return H.fk('rec-access').textContent; };
  assert.equal(await recordAccess('edge-vpn-listed'), tr('en', 'acc_vpnListed', {host: L.en.host_youtube}));
  assert(H.text().includes(L.en.vpnListedNote) && !H.text().includes(L.en.ytNote), 'A VPN listing without a check does not claim a failed check');
  assert.equal(await recordAccess('edge-unavail-listed'), tr('en', 'acc_unavailListed', {host: L.en.host_youtube}));
  assert(!H.text().includes(L.en.ytNote), 'An unavailable listing without a check does not claim one');
  assert.equal(await recordAccess('edge-played-nourl'), L.en.acc_vimeo, 'Playback evidence without playbackUrl does not count as played');
  // The object form of a check: its status is a recorded failed check (country restriction or unavailable), or a free
  // broadcaster stream limited to its service area. The check itself is shown on the record page.
  assert.equal(await recordAccess('edge-check-country'), tr('en', 'acc_restricted', {host: L.en.host_youtube}));
  assert(H.text().includes(L.en.ytNote) && !H.text().includes(L.en.vpnListedNote), 'A recorded country restriction says the check failed');
  assert(H.text().includes(L.en.availCheck + ': 2026-10-18, Edge probe (metadata only): yt-dlp: The uploader'), 'The check is shown');
  assert.equal(await recordAccess('edge-check-unavail'), L.en.acc_unavailable, 'A failed check without an access listing is unavailable');
  assert(H.text().includes(L.en.ytNote), 'and says the check failed');
  assert.equal(await recordAccess('edge-check-region'), tr('en', 'acc_regionLimited', {host: 'example-broadcaster.org'}));
  assert(H.text().includes(L.en.regionNote) && !H.text().includes(L.en.licensedNote), 'A region-limited stream is not a licensed listing');
  for (const [id, a] of [['edge-check-country', 'restricted'], ['edge-check-unavail', 'unavailable'], ['edge-check-region', 'web']]) {
    assert.equal(expectAccess(M.recById.get(id)), a, 'The model agrees: ' + id);
  }
  // A failed or unavailable-listed link is marked on its Watch link too (R4-01); a restricted one is not.
  for (const id of ['edge-check-unavail', 'edge-unavail-listed', 'edge-check-country']) {
    await H.navigate('record/' + enc(id));
    const w = H.fk('rec-watch'), failed = id !== 'edge-check-country';
    assertFailedMark(H, w, failed, 'Record ' + id);
    const want = L.en.watchOn_youtube + (failed ? ' · ' + L.en.unavailableQ : '');
    assert.equal(H.byClass('wl', w)[0].textContent, want, 'Record Watch label: ' + id);
    assert(w.getAttribute('aria-label').startsWith(want + ', '), 'Record Watch link name: ' + id);
  }
  ok('access: listed-only VPN and unavailable states; played needs playbackUrl; object-form checks rank and label by status; ' +
    'failed links marked on their Watch link');

  // Evidence details: shown with URL, date and note when they agree; ignored when they disagree with the stated level.
  await H.navigate('episode/' + enc(EDGE.ep1));
  assert.equal(H.fk('ep-ev').textContent, L.en['ev_complete-playback-reviewed']);
  assert.equal(H.fk('ep-cov').textContent, L.en.covWholeChecked_core, 'A whole link watched in full is no longer "(unverified)"');
  assert(H.text().includes(tr('en', 'evRecorded', {d: '2026-10-01'})) && H.text().includes('Edge evidence note zq'));
  assert(H.extLinks(H.view()).some(a => a.href === EDGE.idless && a.textContent.startsWith('youtube.com/watch?v=EdgeCase001')),
    'The checked URL is linked and labelled with its query (the video id)');
  assert(H.text().includes(tr('en', 'upEpCheck', {level: L.en['ev_complete-playback-reviewed']})));
  // The watched toggle keeps its name; aria-pressed carries the state.
  const before = accName(H.fk('watch-toggle'));
  await H.fk('watch-toggle').click();
  assert.equal(H.fk('watch-toggle').getAttribute('aria-pressed'), 'true');
  assert.equal(accName(H.fk('watch-toggle')), before, 'The watched toggle keeps a stable accessible name');
  await H.navigate('episode/' + enc(EDGE.ep3));
  assert.equal(H.fk('ep-ev').textContent, L.en['ev_metadata-checked'], 'A detail that disagrees with the stated level is ignored');
  assert.equal(H.fk('ep-cov').textContent, L.en.covWhole_core);
  await H.navigate('record/' + enc(EDGE.idless));
  assert(H.text().includes(tr('en', 'upEpCheck', {level: L.en['ev_complete-playback-reviewed']})), 'The record page names the episode check');
  ok('evidence details: URL, date and note shown; disagreeing details ignored; stable watched-toggle name');

  // Queue budgets per scope; queues in List layout; "Show all" on Videos to identify focuses the first new row.
  const sec = () => H.$('prod-' + domId(EDGE.prod));
  await H.navigate('guide/' + enc(EDGE.prod));
  assert.equal(qitems(), 24, 'A production scope shows 24 queued uploads');
  await H.fk('qmore-' + EDGE.prod).click(); assert.equal(qitems(), 30);
  await H.navigate('guide'); assert.equal(qitems(sec()), 6, 'A scope\'s "Show all" does not expand the all-productions album');
  await H.navigate('guide/' + enc(EDGE.prod) + '?layout=list');
  assert.equal(qitems(), 30, 'List layout keeps the unidentified-upload queue');
  await H.navigate('guide/' + enc(EDGE.prod) + '?layout=album');
  await H.navigate('browse/unidentified');
  const ordered = [...M.queued].filter(([, pid]) => pid === EDGE.prod).map(([id]) => M.recById.get(id))
    .sort((a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0));
  const more = H.fk('more-id-queue:' + EDGE.prod);
  more.focus(); await more.click();
  assert.equal(H.document.activeElement.getAttribute('data-fk'), 'tq-' + ordered[25].id, '"Show all" focuses the first new row');
  assert(connected(H, H.document.activeElement));
  ok('queue budgets per scope, queue in List layout, Videos to identify "Show all" focus');

  // Focus never falls to <body> when the activated control disappears.
  await H.navigate('guide?cov=missing,whole-candidate');
  H.fk('x-cov-missing').focus(); await H.fk('x-cov-missing').click();
  assert.equal(H.document.activeElement.getAttribute('data-fk'), 'x-cov-whole-candidate', 'Removing a filter chip focuses the next chip');
  await H.fk('x-cov-whole-candidate').click();
  assert.equal(H.document.activeElement, H.$('g-search'), 'Removing the last chip focuses the search box');
  await H.navigate('browse?kind=clip,episode');
  H.fk('ux-k-clip').focus(); await H.fk('ux-k-clip').click();
  assert.equal(H.document.activeElement.getAttribute('data-fk'), 'ux-k-episode');
  await H.fk('ux-k-episode').click();
  assert.equal(H.document.activeElement, H.$('u-search'), 'Removing the last upload filter chip focuses the search box');
  ok('focus after removing filter chips');

  // A debounced search typed just before navigating does not render into the old view.
  await H.navigate('browse'); const oldCount = H.$('count'), shown = oldCount.textContent;
  H.$('u-search').value = 'zzqx'; await H.$('u-search').fire('input');
  await H.navigate('record/' + enc(EDGE.idless)); H.flushTimers();
  assert.equal(oldCount.textContent, shown, 'Navigation cancels a pending debounced search');
  ok('pending debounced search cancelled on navigation');

  // Record-page tags are links to a filtered list, not toggle buttons.
  await H.navigate('record/edge-null-tag');
  const tag = H.fk('tag-themes' + 'zoe');
  assert.equal(tag.tagName, 'a'); assert.equal(tag.getAttribute('aria-pressed'), undefined, 'Tag links are not toggle buttons');
  assert.equal(tag.href, '#/browse?theme=zoe');
  await tag.click();
  assert.equal(H.$('theme').value, 'zoe');
  const opt = H.$('theme').children.find(o => o.value === 'zoe');
  assert.equal(H.count(), H.number(opt.textContent.split(' · ').at(-1)), 'The tag link opens the filtered uploads');
  ok('record tags are navigation links');

  // Toast: a persistent live region, visually hidden while empty.
  const toastEl = H.$('toast');
  assert.equal(toastEl.getAttribute('hidden'), undefined, 'The toast region is never display:none');
  assert.equal(toastEl.getAttribute('role'), 'status');
  await H.navigate('browse'); await H.find(n => H.cls(n).includes('star'))[0].click();
  assert.equal(toastEl.className, 'toast show'); assert.equal(toastEl.textContent, L.en.starredToast);
  H.flushTimers(); assert.equal(toastEl.className, 'toast'); assert.equal(toastEl.textContent, '');
  ok('toast is a persistent live region');

  // The More filters panel turns the sticky toolbar static.
  await H.navigate('guide');
  await H.fk('more-btn').click();
  assert(H.byClass('toolbar')[0].className.includes('more-open'), 'Toolbar is static while More filters is open');
  await H.fk('more-btn').click();
  assert(!H.byClass('toolbar')[0].className.includes('more-open'));
  ok('toolbar is not sticky while More filters is open');

  // Episodes outside the declared seasons are not counted twice; unlabeled seasons and nameless productions get names.
  for (const [id, total] of [[EDGE.seasons, null], [EDGE.known, 5]]) {
    const m = M.prodModel(M.prodById.get(id));
    assert.equal(m.outside, 2); assert.equal(m.slots, 1, 'Two outside episodes fill two of the three open places: ' + id);
    if (total === null) assert.equal(m.knownFloor, 5, 'The known floor is the declared 3 + 2, not 4 identified + 3 open places');
    await H.navigate('guide/' + enc(id));
    const st = H.byClass('status-line')[0].textContent;
    assert(st.includes(tr('en', 'statusSlots', {n: '1'})), 'Status line: 1 expected, not identified: ' + st);
    assert.equal(H.byClass('prod-meter')[0].getAttribute('aria-label'), tr('en', 'segMissing') + ': 4, ' + tr('en', 'segSlots') + ': 1' +
      (total === null ? ', ' + L.en.segOpen : ''), 'The meter has as many segments as the production has episodes');
    assert(H.text().includes(tr('en', 'outsideLine', {n: '2'})), 'The outside episodes are explained');
    const heads = H.byClass('season-h').map(h => h.textContent);
    assert(heads.some(h => h.startsWith('Edge season one')) && heads.some(h => h.startsWith(L.en.seasonLbl + ' 2')),
      'A season without labels is named "Season 2": ' + heads.join(' | '));
    assert(H.byClass('strip').every(u => !/^:/.test(u.getAttribute('aria-label'))), 'Strips have a season name');
  }
  await H.navigate('guide/edge-mismatch');
  assert(!H.byClass('status-line')[0].textContent.includes(tr('en', 'statusSlots', {n: '\u0000'}).split('\u0000')[1]) &&
    !H.byClass('slots').length, 'Episodes under an undeclared season key leave no placeholders: ' + H.byClass('status-line')[0].textContent);
  assert.equal(H.byClass('prod-meter')[0].getAttribute('aria-label'), tr('en', 'segMissing') + ': 2');
  await H.navigate('guide/' + enc(EDGE.noname));
  assert.equal(H.h1().textContent, EDGE.noname, 'A production without names is headed by its id');
  assert(H.document.title.startsWith(EDGE.noname + ' · '));
  await H.navigate('guide');
  assert(H.find(n => H.cls(n).includes('ri-name')).every(n => n.textContent.trim()), 'Every rail item has a name');
  ok('outside-season episodes fill expected places; unlabeled seasons and nameless productions are named');

  // A stored URL with a literal space is indexed by its serialized (%20) form; the item URL finds its files.
  for (const q of [EDGE.iaSpace.replace(/ /g, '%20'), 'https://archive.org/details/edge-item-2']) {
    assert.equal(await count(q), 1, 'Pasted archive link finds the upload stored with a space: ' + q);
    assert(H.has('card-edge-ia-space', H.view()) && H.text().includes(L.en.urlHit));
  }
  // Recorded playback on an Internet Archive file: listed with public pages, not under "Vimeo direct". The search narrows
  // the list to the fixture, so the result does not depend on which page of a large group the card would fall on.
  const playedQ = '&q=zqiaplayed';
  await H.navigate('browse?ag=direct' + playedQ); assert(!H.has('card-edge-ia-played', H.view()), 'A played archive file is not "Vimeo direct"');
  await H.navigate('browse?ag=public' + playedQ); assert(H.has('card-edge-ia-played', H.view()), 'A played archive file is with public pages');
  assert.equal(H.count(), 1);
  const playedCard = H.fk('card-edge-ia-played').parentElement.parentElement.parentElement;
  assert(H.byClass('u-access', playedCard)[0].textContent.startsWith(L.en.acc_played));
  assert(H.byClass('acc-public', playedCard).length === 1, 'Its access mark is the public-page shape');
  // A record whose id is '__proto__' keeps a pasted Vimeo link like any other.
  await H.navigate('record/__proto__');
  H.$('vimeo-url').value = 'https://vimeo.com/123456789/abcdef1234'; await H.find(n => n.tagName === 'form')[0].fire('submit');
  assert(Object.hasOwn(JSON.parse(H.storage.get('sumsum-vimeo-mappings')), '__proto__'), "A '__proto__' record id is an ordinary key");
  assert.equal(H.fk('rec-watch').href, 'https://vimeo.com/123456789/abcdef1234');
  ok('pasted links for stored URLs with spaces; played uploads stay in their host group; prototype-named record ids');

  // Language of parts on edge records (Hebrew uploader and title in the English UI; a Hebrew title quoted in an
  // English note).
  await H.navigate('browse?q=' + enc('Edge archive'));
  assert.deepEqual(langIssues(H.view(), 'en'), [], 'Hebrew data text is tagged lang="he" in the English UI');
  await H.navigate('record/' + enc(EDGE.weird));
  assert.deepEqual(langIssues(H.view(), 'en'), [], 'A Hebrew quote inside an English note is tagged lang="he"');
  await checkContractEdges(H, M);
  await checkStoryNames(H, M);
  await checkEditorialTitles(H, M);
  await checkEvidenceWords(H, M);
  return N;
}

// The contract additions on fixed fixtures (every build gets them through edgePayload).
async function checkContractEdges(H, M) {
  const enc = encodeURIComponent, id = n => EDGE.ietv + '-' + n, status = () => H.byClass('status-line')[0].textContent;
  // firstNumber: season 2 is numbered 66-68, so it has no cells (and no false gaps) for 1-65; cells use the number label.
  await H.navigate('guide/' + EDGE.ietv + '?layout=numbers');
  const keys = H.find(n => n.tagName === 'a' && H.cls(n).includes('cell')).map(c => c.getAttribute('data-fk'));
  assert.deepEqual(keys, [1, 2, 3].map(n => 'cell-edge-ietv-1-' + n).concat([66, 67, 68].map(n => 'cell-edge-ietv-2-' + n)),
    'Strips cover 1-3 and 66-68: ' + keys.join(' '));
  assert.equal(H.fk('cell-edge-ietv-2-67').getAttribute('aria-label'), tr('en', 'cellGapDocL', {code: 'Edge no. 67'}));
  assert(H.fk('cell-edge-ietv-2-66').getAttribute('aria-label').startsWith('Edge no. 66: '), 'Episode cells use the number label');
  assert(status().includes(tr('en', 'statusSlots', {n: '2'})), 'Two documented numbers are unidentified: ' + status());
  await H.navigate('slot/' + EDGE.ietv + '/2/67');
  assert.equal(H.h1().textContent, tr('en', 'slotTitleSL', {s: '2', code: 'Edge no. 67'}), 'Slot titles use the number label');
  assert(!H.has('cell-edge-ietv-2-1'));
  // A season numbered from 66 with five expected and only 66-67 identified: the strip runs to 70, and 68-70 are expected cells.
  await H.navigate('guide/edge-first?layout=numbers');
  const fkeys = H.find(n => n.tagName === 'a' && H.cls(n).includes('cell')).map(c => c.getAttribute('data-fk'))
    .filter(k => k.startsWith('cell-edge-first-3-'));
  assert.deepEqual(fkeys, [66, 67, 68, 69, 70].map(n => 'cell-edge-first-3-' + n), 'The strip ends at firstNumber + expected - 1: ' + fkeys.join(' '));
  for (const n of [68, 69, 70]) assert.equal(H.fk('cell-edge-first-3-' + n).getAttribute('aria-label'), tr('en', 'cellExp', {n: String(n)}));
  // A totals claim without a url names its source as plain text (no link to the page itself).
  await H.navigate('guide/edge-first');
  const evli = H.byClass('ev-list')[0].children.find(li => li.textContent.includes('Edge printed catalogue zqnourl'));
  assert(evli && !H.extLinks(evli).length && !H.find(a => a.tagName === 'a', evli).length, 'A totals claim without a url is plain text');
  // A season-and-episode code is matched exactly: "S1 · E1" is not "S1 · E10" (as text it would be).
  for (const [lang, q] of [['en', 'S1 · E1'], ['he', 'עונה 1 · פרק 1']]) {
    if (lang === 'he') await H.flipLang();
    await H.navigate('guide/edge-first?layout=list&q=' + encodeURIComponent(q)); H.flushTimers();
    const rows = H.find(n => /^row-/.test(n.getAttribute?.('data-fk') || '')).map(n => n.getAttribute('data-fk').slice(4));
    assert.deepEqual(rows, ['edge-first-s1-1'], `"${q}" finds S1 · E1 only: ${rows.join(' ')}`);
    if (lang === 'he') await H.flipLang();
  }
  ok('firstNumber: a season numbered 66-68 has no gap cells for 1-65; one numbered 66-70 has expected cells 68-70; cells and slot ' +
    'titles use the number label; a totals claim without a url is plain text; season and episode codes match exactly');

  // The link order the user set: links that need the VPN (a Hop page, an upload blocked outside Israel) come before library-card
  // and paid listings; a licensed listing's labels name the service and its need.
  await H.navigate('episode/' + id(1));
  assert.equal(H.fk('ep-watch').href, 'https://hop.co.il/shows/edge-hop-page/', 'A Hop page outranks a licensed listing');
  assert(H.cls(H.fk('ep-watch')).includes('vpn'));
  assert.equal(H.byClass('kicker', H.byClass('hero')[0])[0].textContent, 'Edge IETV · Edge no. 1', 'The episode code uses the number label');
  const m1 = M.best(M.eps.find(e => e.id === id(1)));
  assert.equal(m1.r.id, 'edge-hop-page', 'The independent model agrees');
  await H.navigate('episode/' + id(68));
  let w = H.fk('ep-watch');
  const hs = M.services.find(x => x.hosts.includes('hoopladigital.com')), b68 = M.best(M.eps.find(e => e.id === id(68)));
  assert(w.href === expectDest(b68.r) && expectTier(b68.r) === 'vpn', 'An upload that needs the VPN outranks the licensed listings: ' + w.href);
  assert(H.cls(w).includes('vpn') && !H.has('howto', H.view()), 'with the VPN shape, and no how-to box for a service it does not open');
  // Among the licensed listings, the library-card one ranks before the buy-or-rent one listed before it.
  const lics = ['edge-licensed', 'edge-licensed-2'].map(x => M.recById.get(x)).filter(Boolean);
  if (hs && hs.model === 'library-card' && lics.length === 2) {
    const [a, b] = lics.map(r => [r, copyKey(r, 'whole-candidate', 0)]).sort((x, y) => cmpKeys(x[1], y[1])).map(x => x[0]);
    assert.equal(expectDest(a), 'https://www.hoopladigital.com/title/edge0001', 'The library-card listing ranks before the paid one');
    const rows = H.find(n => /^ur-edge-licensed/.test(n.getAttribute?.('data-fk') || '')).map(n => n.getAttribute('data-fk').slice(3));
    assert.deepEqual(rows.filter(x => x === a.id || x === b.id), [a.id, b.id], 'and the episode page lists them in that order');
  }
  const licRec = lics.find(r => hs && expectSvc(r) === hs) || lics[0];
  await H.navigate('record/' + encodeURIComponent(licRec.id)); w = H.fk('rec-watch');
  if (hs) {
    assert(w.textContent.startsWith(tr('en', 'watchLic_' + hs.model, {service: hs.name})), 'The Watch label names the service: ' + w.textContent);
    assert(H.text().includes(tr('en', 'licNote_' + hs.model, {service: hs.name})) &&
      H.text().includes(tr('en', 'acc_licSvc', {service: hs.name, req: tr('en', 'lic_' + hs.model)})), 'The service note and access line');
    assert.equal(H.has('howto', H.view()), !!hs.howTo, 'The how-to box follows the Watch link');
  } else {
    const host = hostname(expectDest(licRec));
    assert(w.textContent.startsWith(tr('en', 'watchLicensed', {host})), 'The Watch label says licensed: ' + w.textContent);
    assert(H.text().includes(L.en.licensedNote) && H.text().includes(tr('en', 'acc_licensed', {host})));
  }
  assert(H.cls(w).includes('lic') && !H.cls(w).includes('vpn'));
  await H.navigate('episode/' + id(68));
  assert.equal(H.fk('ep-cov').textContent, L.en.covWhole_core, 'A licensed listing of the whole programme is a whole link');
  assert(H.text().includes(L.en.rolePl_possible) && H.text().includes(L.en.possibleHelp), 'Possible copies are listed apart');
  await H.navigate('browse?ag=licensed&q=zqlic');
  assert.equal(H.count(), 3, 'Licensed listings have their own access groups; ?ag=licensed selects them all');
  assert(H.byClass('acc-lic').length >= 3, 'with their own access mark');
  // The undescribed host: generic labels, its own group, no how-to box.
  await H.navigate('browse?q=zqlic');
  assert(M.agroups.includes('lic-other') && H.has('fa-lic-other'), 'An undescribed licensed host has its own group');
  assert.equal(H.byClass('lbl', H.fk('fa-lic-other'))[0].textContent, M.licGroups.length ? L.en.agLicOther : L.en.agLicensed);
  assert.equal(H.chipCount(H.fk('fa-lic-other')), M.licGroups.length ? 1 : 3, 'Only the undescribed host is "other" (all three without services)');
  await H.navigate('record/edge-licensed-other');
  assert(H.fk('rec-watch').textContent.startsWith(tr('en', 'watchLicensed', {host: 'vudu.com'})), 'Generic licensed Watch label');
  assert.equal(H.fk('rec-access').textContent, tr('en', 'acc_licensed', {host: 'vudu.com'}));
  assert(H.text().includes(L.en.licensedNote) && !H.has('howto', H.view()), 'Generic note, no how-to box');
  // Up next never offers a licensed listing.
  await H.navigate('home');
  if (H.has('next-watch', H.view())) assert(!/hoopladigital|tv\.apple/.test(H.fk('next-watch').href));
  ok('licensed listings: after links that need the VPN, library card before paid; licensed Watch label, access line, note and group');

  // Possible copies: never counted; the episode stays missing; the record still awaits identification.
  await H.navigate('episode/' + id(66));
  assert.equal(H.fk('ep-cov').textContent, L.en.cov_missing, 'A possible copy does not count toward coverage');
  assert(!H.has('ep-watch', H.view()) && H.text().includes(L.en.noUploadsPossible), 'and never becomes the Watch link');
  assert(H.fk('ep-ev').textContent === L.en.ev_none, 'nor evidence');
  await H.navigate('record/edge-possible');
  assert(H.text().includes(L.en.possibleRecord) && H.text().includes(L.en.gsQueue), 'The record is a possible copy and still queued');
  for (const n of [66, 68]) {
    assert(H.find(a => a.tagName === 'a' && a.href === '#/episode/' + id(n)).length, 'It links to each episode it may be: ' + n);
  }
  assert.equal(H.find(a => a.tagName === 'a' && a.href === '#/guide/' + EDGE.ietv).length >= 1, true,
    'A record that is only a possible copy is filed under its queue, not under an episode');
  await H.navigate('guide/' + EDGE.ietv + '?q=' + enc('Edge possible copy'));
  assert(H.has('q-edge-possible', H.view()), 'It stays in the unidentified queue');
  await H.navigate('guide?q=' + enc('https://archive.org/details/edge-item-4/S3E34.mp4'));
  assert(H.has('ep-' + id(66), H.view()) && H.has('ep-' + id(68), H.view()), 'A pasted link finds the episodes it may be');
  ok('possible copies: listed apart, not counted, never the Watch link, still queued, found by a pasted link');

  // Explicit part numbers: listed out of order, shown and ranked by number.
  await H.navigate('episode/' + id(3));
  assert.equal(H.fk('ep-watch').href, 'https://www.youtube.com/watch?v=EdgePart001', 'Part 1 is the Watch link');
  assert(H.fk('ep-watch').textContent.includes(' · ' + tr('en', 'partOf', {i: '1', n: '3'})));
  for (const i of [1, 2, 3]) {
    assert(H.fk('ur-edge-part-' + i).textContent.startsWith(tr('en', 'partOf', {i: String(i), n: '3'}) + ' · '), 'Part ' + i + ' of 3');
  }
  const order = H.find(n => /^ur-edge-part-/.test(n.getAttribute?.('data-fk') || '')).map(n => n.getAttribute('data-fk'));
  assert.deepEqual(order, ['ur-edge-part-1', 'ur-edge-part-2', 'ur-edge-part-3'], 'Parts are listed by part number');
  ok('explicit part numbers: displayed, ordered and ranked by number');

  // Alternate labels and a source without a url.
  await H.navigate('episode/' + id(66));
  assert.equal(H.byClass('alsolab')[0].textContent, L.en.alsoLabelled + ': Edge S2E20 · Edge tape 7');
  const items = H.byClass('altlab-item');
  assert.equal(H.extLinks(items[0])[0].href, 'https://archive.org/details/edge-item-4', 'An alternate label links to its source');
  assert.equal(H.extLinks(items[1]).length, 0, 'An alternate label without a url is plain text');
  assert(H.text().includes('Edge printed catalogue, no url') && !H.extLinks(H.view()).some(a => a.textContent.includes('Edge printed')),
    'A source without a url is plain text');
  assert.deepEqual(langIssues(H.view(), 'en'), [], 'A Hebrew source without a url is tagged lang="he"');
  await H.flipLang();
  assert.equal(H.byClass('alsolab')[0].textContent, L.he.alsoLabelled + ': בדיקה עונה 2 פרק 20 · Edge tape 7');
  assert.equal(H.byClass('kicker', H.byClass('hero')[0])[0].textContent, 'חינוכית לבדיקה · מס׳ בדיקה 66');
  assert.deepEqual(langIssues(H.view(), 'he'), [], 'An English source without a url is tagged lang="en"');
  await H.flipLang();
  const search = async q => {
    await H.navigate('guide?layout=album'); H.$('g-search').value = q; await H.$('g-search').fire('input'); H.flushTimers();
  };
  await search('Edge S2E20'); assert(H.has('ep-' + id(66), H.view()), 'An alternate label is searchable');
  assert.equal(H.byClass('tile-alt', H.fk('ep-' + id(66)).parentElement)[0].textContent, 'Edge S2E20 · Edge tape\u00A07',
    'Tile labels keep a number with the word before it');
  await search('Edge no. 66');
  assert(H.has('ep-' + id(66), H.view()) && status().startsWith(tr('en', 'statusLine', {n: '1'})), 'A code search names one episode: ' + status());
  await search('<68>'); assert(H.has('ep-' + id(68), H.view()), '"<68>" finds the labelled episode');
  await search('מס׳ בדיקה 1'); assert(H.has('ep-' + id(1), H.view()) && !H.has('ep-' + id(3), H.view()), 'The Hebrew label finds one number');
  await search('s2e66'); assert(!H.has('ep-' + id(66), H.view()), 'A labelled production has no S·E codes to confuse');
  await search('');
  ok('alternate labels shown, linked and searchable; sources without a url are plain text in both languages; code search');

  // Review round 1. A "<n>" search is a code search: a note that quotes "<3>" does not bring its episode in.
  await search('<3>');
  const want3 = M.eps.filter(x => x.number === 3 && M.label(M.prodById.get(x.production), 'en'));
  assert(status().startsWith(tr('en', 'statusLine', {n: want3.length.toLocaleString('en-US')})) && H.has('ep-' + id(3), H.view()) &&
    !H.has('ep-' + id(66), H.view()), '"<3>" finds the labelled number 3 only, not a note that quotes it: ' + status());
  await search('');
  ok('a "<n>" search matches the number, not notes that quote it');

  // Card tags and breadcrumbs follow the best role; a record's other links are named or counted.
  const cardTag = rid => H.byClass('u-tags', H.fk('card-' + rid).parentElement.parentElement)[0].children[1];
  // A copy of an episode is listed under its episode in Browse; Identified videos lists each upload with its own tag.
  const listOf = rid => (M.entryOf.get(rid).id === rid ? 'browse' : 'browse/identified');
  assert.equal(M.linkTag(M.recById.get('edge-tape')), 'No. 3 · ' + L.en['role_whole-candidate'] + ' ' + tr('en', 'moreLinks', {n: '1'}));
  assert.equal(M.linkTag(M.recById.get('edge-possible')), 'Edge no. 66' + L.en.orSep + '68 · ' + L.en.role_possible);
  for (const [q, rid] of [['zqtape', 'edge-tape'], ['Edge possible copy', 'edge-possible'], ['zqposs', 'edge-possible-free'],
    ['Edge blocked upload', 'edge-blocked']]) {
    await H.navigate(listOf(rid) + '?q=' + enc(q));
    assert.equal(cardTag(rid).textContent, M.linkTag(M.recById.get(rid)), 'Card tag of ' + rid);
  }
  await H.flipLang(); await H.navigate(listOf('edge-tape') + '?q=zqtape');
  assert.equal(cardTag('edge-tape').textContent, M.linkTag(M.recById.get('edge-tape'), 'he'), 'Hebrew card tag');
  await H.navigate('browse?q=' + enc('Edge possible copy'));
  assert.equal(cardTag('edge-possible').textContent, 'מס׳ בדיקה 66' + L.he.orSep + '68 · ' + L.he.role_possible, 'Hebrew possible-copy tag');
  await H.flipLang();
  await H.navigate('record/edge-tape');
  const crumbHrefs = H.find(n => n.tagName === 'a', H.byClass('crumbs')[0]).map(a => a.href);
  assert.equal(crumbHrefs.at(-1), '#/episode/edge-gapped-3', 'The breadcrumb follows the whole link, not the earlier excerpt link');
  ok('card tags and breadcrumbs follow the best-role link; possible copies of two episodes name both');

  // Parts numbered 2 and 3 only: "Part 2 of 3" and "Part 3 of 3", and part 2 is the Watch link.
  await H.navigate('episode/edge-gapped-1');
  const bg = M.best(M.eps.find(e => e.id === 'edge-gapped-1'));
  assert(bg.r.id === 'edge-gp-2' && bg.i === 2 && bg.n === 3, 'The model ranks part 2 of 3 first');
  assert.equal(H.fk('ep-watch').href, 'https://www.youtube.com/watch?v=EdgeGapPt02');
  assert(H.fk('ep-watch').textContent.includes(' · ' + tr('en', 'partOf', {i: '2', n: '3'})), 'Watch label: ' + H.fk('ep-watch').textContent);
  for (const i of [2, 3]) assert(H.fk('ur-edge-gp-' + i).textContent.startsWith(tr('en', 'partOf', {i: String(i), n: '3'}) + ' · '), 'Part ' + i + ' of 3');
  ok('gapped explicit part numbers: "Part 2 of 3", counted from the highest number');

  // A possible copy that is not queued: guide status "possible", never matched, never the Watch link.
  assert.equal(M.guideStatus(M.recById.get('edge-possible-free')), 'possible');
  const nPossible = M.records.filter(r => M.guideStatus(r) === 'possible').length;
  await H.navigate('browse?sort=series'); // any query resets the other filters
  assert.equal(H.chipCount(H.fk('fg-possible')), nPossible, 'Unqueued possible copies are counted under "Possible copy only"');
  await H.navigate('browse?gs=possible');
  assert(H.count() === nPossible && H.has('card-edge-possible-free'), 'The possible-copy filter lists the unqueued copy');
  await H.navigate('episode/edge-gapped-2');
  assert(!H.has('ep-watch', H.view()) && H.fk('ep-cov').textContent === L.en.cov_missing, 'and it never counts or becomes the Watch link');
  await H.navigate('record/edge-possible-free');
  assert(H.text().includes(L.en.possibleRecord), 'Its record page says it is not counted');
  // It is awaiting identification, so every count of Videos to identify includes it (review round 1): the episode page's link
  // for its production, the guide headline's link and the to-do export, which names its candidate episode.
  await H.navigate('episode/edge-gapped-1');
  const gl = H.find(a => a.tagName === 'a' && a.href === '#/browse/unidentified?prod=edge-gapped')[0];
  assert(gl && gl.textContent === L.en.queueLinkOne, 'An episode page counts its production\'s possible-only upload: ' + (gl && gl.textContent));
  const {counts: edgeCounts} = menuModel(M);
  await H.navigate('guide');
  const hl = H.find(a => a.tagName === 'a' && a.href === '#/browse/unidentified', H.byClass('goal')[0])[0];
  assert.equal(hl.textContent, tr('en', 'queueLink', {n: edgeCounts.unidentified.toLocaleString('en-US')}), 'The guide headline counts possible-only uploads too');
  await H.navigate('todo'); await H.fk('td-export').click();
  const free = (await H.blobJson()).unidentified.find(x => x.recordId === 'edge-possible-free');
  assert(free && free.production === 'edge-gapped' && JSON.stringify(free.possibleCopyOf) === '["edge-gapped-2"]',
    'The to-do export lists the possible-only upload with its candidate episode');
  ok('an unqueued possible copy has its own guide status and is never counted; it is counted as awaiting identification everywhere');

  // Equally likely matches are never cut arbitrarily: four tied matches are all shown; eight show three and count the rest.
  // A possible copy names every episode it may be (Videos to identify).
  await H.navigate('browse/unidentified');
  const rowText = rid => H.fk('tq-' + rid).parentElement.parentElement.textContent;
  const tie = ns => ns.map(n => 'Tie no. ' + n).join(', ');
  assert(rowText('edge-tied').includes(L.en.suggestTitle + ': ' + L.en.sgOneOf + ' ' + tie([1, 2, 3, 4])), 'Four tied matches: ' + rowText('edge-tied'));
  assert(rowText('edge-crowd').includes(L.en.suggestTitle + ': ' + L.en.sgOneOf + ' ' + tie([1, 2, 3]) + ' ' + tr('en', 'sgMoreTied', {n: '5'})),
    'Eight tied matches: ' + rowText('edge-crowd'));
  assert(rowText('edge-possible').includes(L.en.possibleCopyOf + ': Edge no. 66' + L.en.orSep + 'Edge no. 68'), 'Possible copy: ' + rowText('edge-possible'));
  const suggs = async rid => { await H.navigate('record/' + rid); return H.byClass('sugg')[0].children.map(li => li.children[0].href); };
  assert.deepEqual(await suggs('edge-tied'), [1, 2, 3, 4].map(n => '#/episode/edge-tie-' + n), 'The record page lists all four tied matches');
  assert.deepEqual(await suggs('edge-crowd'), [1, 2, 3].map(n => '#/episode/edge-tie-' + n), 'Eight tied matches: three are listed');
  assert(H.text().includes(tr('en', 'sgMoreTied', {n: '5'})), 'and the rest are counted');
  ok('equally likely suggestions are all shown or counted; possible copies name every episode they may be');

  // A related series: counted separately, labelled as such.
  await H.navigate('guide');
  const sep = H.byClass('sep-list')[0], li = sep.children.find(n => n.textContent.includes('Edge related series'));
  assert(li && li.textContent.includes(L.en['fs_related-series']), 'A related series is listed under "Counted separately"');
  assert(!H.byClass('goal-row').some(r => r.textContent.includes('Edge related series')), 'and stays out of the core rows');
  await H.navigate('guide/' + EDGE.related);
  assert(H.text().includes(L.en['fmt_related-series']), 'Its production page names the format');
  await H.navigate('guide?fmt=related-series');
  assert(H.has('ep-' + EDGE.related + '-1', H.view()) && !H.has('ep-' + id(1), H.view()), 'The format filter selects related series');
  ok('related series: counted separately with its own label and format filter');

  // A best link that failed an availability check is marked on its album tile and List row (R4-01), in both languages.
  const failedId = EDGE.related + '-2';
  for (const lang of ['en', 'he']) {
    if (lang === 'he') await H.flipLang();
    for (const layout of ['list', 'album']) {
      await H.navigate('guide/' + EDGE.related + '?layout=' + layout);
      const w = layout === 'album' ? H.fk('w-' + failedId) : H.extLinks(H.fk('row-' + failedId).parentElement.parentElement)[0];
      const where = `Edge failed link, ${layout} (${lang})`;
      assertFailedMark(H, w, true, where);
      const short = tr(lang, 'tw_youtube') + ' · ' + tr(lang, 'tw_unavailable'), long = tr(lang, 'watchOn_youtube') + ' · ' + tr(lang, 'unavailableQ');
      if (layout === 'album') assert.equal(H.byClass('wl', w)[0].textContent, short, where + ': tile label');
      else {
        assert.equal(H.byClass('wl-long', w)[0].textContent, long, where + ': List label');
        assert.equal(H.byClass('wl-short', w)[0].textContent, tr(lang, 'tw_youtube'), where + ': phone List label (the mark shows the failure)');
      }
      assert(w.getAttribute('aria-label').startsWith(long + ', Edge related failed link'), where + ': link name ' + w.getAttribute('aria-label'));
    }
    if (lang === 'he') await H.flipLang();
  }
  ok('a best link that failed a check is marked on its tile and List row (EN, HE)');

  // An untitled labelled number is searched on YouTube by its Hebrew number label, and Missing episodes names it by its code.
  await H.navigate('browse/missing');
  const tie9 = H.fk('td-edge-tie-9');
  assert.equal(tie9.textContent, 'Tie no. 9', 'An untitled labelled episode is titled by its code');
  assert(H.byClass('trow-sub', tie9.parentElement)[0].textContent.startsWith('Tie no. 9 · ' + L.en.cov_missing));
  const find9 = H.extLinks(tie9.parentElement.parentElement)[0];
  assert.equal(find9.href, 'https://www.youtube.com/results?search_query=' + encodeURIComponent('רחוב סומסום מס׳ שוויון 9'),
    'The YouTube search uses the Hebrew number label: ' + find9.href);
  // IETV-form catalogue titles: the series name once, no "<n>"; a title that is only the series name and a number searches by the
  // number label, on the Missing episodes row and the episode page.
  for (const [n, words] of [[10, 'מס׳ שוויון 10'], [11, 'סיפור שוויון']]) {
    const want = 'https://www.youtube.com/results?search_query=' + encodeURIComponent('רחוב סומסום ' + words);
    assert.equal(H.extLinks(H.fk('td-edge-tie-' + n).parentElement.parentElement)[0].href, want, `Missing episodes search for edge-tie-${n}`);
  }
  await H.navigate('episode/edge-tie-10');
  const ytEp = H.find(n => n.tagName === 'a' && /^https:\/\/www\.youtube\.com\/results\?/.test(n.href)).map(a => a.href);
  assert.deepEqual(ytEp, ['https://www.youtube.com/results?search_query=' + encodeURIComponent('רחוב סומסום מס׳ שוויון 10')],
    'The episode page searches a "<series> <n>" title by its number label, not its English title');
  await H.navigate('browse/missing');
  // In Hebrew, an alternate label that starts with a Latin word keeps the page direction on the tile.
  await H.flipLang(); await H.navigate('guide/edge-first?layout=album');
  const ta = H.byClass('tile-alt', H.fk('ep-edge-first-66').parentElement)[0];
  assert.equal(ta.textContent, 'hoopla עונה\u00A02, פרק\u00A066');
  assert.equal(ta.getAttribute('dir'), undefined, 'The tile label takes the page direction (no dir=auto)');
  await H.flipLang();
  ok('Missing episodes: untitled labelled numbers named and searched by their number label; "<series> <n>" catalogue titles searched ' +
    'without the series name twice or "<n>"; Latin-first Hebrew tile labels keep RTL');
}

// Story names (storyHe) on fixed fixtures. Hebrew headings, tiles, list rows, Missing episodes rows and record links use the story name;
// English keeps the editorial English title (else the catalogue title) with the story name beside it. The identity card keeps the
// verbatim catalogue title and names the story's source; search finds the story name; the YouTube search and the export use it.
async function checkStoryNames(H, M) {
  const enc = encodeURIComponent, sid = n => EDGE.story + '-' + n, ep = n => M.eps.find(e => e.id === sid(n));
  const [e1, e2, e3] = [1, 2, 3].map(ep);
  const factOf = (lang, key) => {
    const dt = H.find(n => n.tagName === 'dt' && n.textContent === tr(lang, key))[0], kids = dt && dt.parentElement.children;
    return dt ? kids[kids.indexOf(dt) + 1] : null;
  };
  const lede = () => H.byClass('lede', H.byClass('hero')[0])[0];
  const rowAlt = n => H.byClass('alt', H.fk('row-' + sid(n)).parentElement)[0];
  assert.equal(M.epTitle(e1, 'he'), e1.storyHe, 'The model heads a storyHe episode with the story name in Hebrew');
  assert.equal(M.epTitle(e3, 'he'), e3.titleHe, 'and ignores a blank storyHe');
  // English: the editorial English title (or, without one, the catalogue title as before); the story name is the second line.
  await H.navigate('episode/' + sid(1));
  assert.equal(H.h1().textContent, e1.titleEn, 'English heading: the editorial English title');
  assert(H.document.title.startsWith(e1.titleEn + ' · '), 'document.title follows the heading');
  assert.equal(lede().textContent, e1.storyHe, 'The Hebrew story name is shown under the English title');
  assert.equal(lede().getAttribute('lang'), 'he', 'and tagged as Hebrew');
  assert.equal(factOf('en', 'catTitle').textContent, e1.titleHe, 'The identity card keeps the verbatim catalogue title');
  assert.equal(factOf('en', 'hebTitle'), null, 'named "Catalogue title" when a story name is used');
  assert.equal(factOf('en', 'storyName').textContent, e1.storyHe + tr('en', 'storySource', {src: e1.storySourceEn}),
    'The Story name fact names its source');
  assert(/editorial/.test(L.en.engTitle) && factOf('en', 'engTitle').textContent === e1.titleEn, 'The English title stays labelled editorial');
  assert.deepEqual(langIssues(H.view(), 'en'), [], 'Story names are tagged lang="he" in the English UI');
  await H.navigate('episode/' + sid(2));
  assert.equal(H.h1().textContent, e2.titleHe, 'Without an English title, the English heading is the catalogue title');
  assert.equal(lede().textContent, e2.storyHe, 'with the story name under it');
  await H.navigate('episode/' + sid(3));
  assert.equal(lede().textContent, e3.titleHe, 'A blank storyHe is ignored: the catalogue title is the second line');
  assert(factOf('en', 'hebTitle') && !factOf('en', 'catTitle') && !factOf('en', 'storyName'), 'and the identity card has no story name');
  await H.navigate('guide/' + EDGE.story + '?layout=list');
  assert.equal(H.fk('row-' + sid(1)).textContent, e1.titleEn); assert.equal(rowAlt(1).textContent, e1.storyHe, 'List rows show the story name');
  assert.equal(H.fk('row-' + sid(2)).textContent, e2.titleHe); assert.equal(rowAlt(2).textContent, e2.storyHe);
  // Search: the guide finds the story name in either language; an upload is found by its episode's story name.
  for (const [q, n] of [['zqstory', 1], ['סיפור בלי כותרת', 2]]) {
    await H.navigate('guide?layout=album&q=' + enc(q)); H.flushTimers();
    assert(H.has('ep-' + sid(n), H.view()), `The guide search finds the story name "${q}"`);
  }
  await H.navigate('browse?q=zqstory'); H.flushTimers();
  assert(H.has(cardKey(M, 'edge-story-upload'), H.view()), 'An upload is found by its episode\'s story name');
  // Missing episodes: the YouTube search uses the story name, not "<series> <n>"; the to-do export carries storyHe.
  await H.navigate('browse/missing');
  const td2 = H.fk('td-' + sid(2)), find2 = H.extLinks(td2.parentElement.parentElement)[0];
  assert.equal(td2.textContent, e2.titleHe, 'English Missing episodes rows follow the English heading');
  assert.equal(find2.href, 'https://www.youtube.com/results?search_query=' + enc('רחוב סומסום ' + e2.storyHe),
    'The YouTube search uses the story name: ' + find2.href);
  await H.navigate('todo'); await H.fk('td-export').click();
  const todo = await H.blobJson(), row = id => todo.missing.find(x => x.id === id);
  assert.equal(row(sid(2)).storyHe, e2.storyHe, 'The to-do export carries storyHe');
  assert.equal(row(sid(3)).storyHe, null, 'and null for a blank one');
  // Hebrew: the story name heads the episode, its tile, row, Missing episodes row and record link; the identity card is unchanged.
  await H.flipLang();
  await H.navigate('episode/' + sid(1));
  assert.equal(H.h1().textContent, e1.storyHe, 'Hebrew heading: the story name');
  assert(H.document.title.startsWith(e1.storyHe + ' · '), 'document.title follows the Hebrew heading');
  assert.equal(lede().textContent, e1.titleEn, 'The editorial English title is the second line');
  assert.equal(factOf('he', 'catTitle').textContent, e1.titleHe, 'The Hebrew identity card keeps the catalogue title');
  assert.equal(factOf('he', 'storyName').textContent, e1.storyHe + tr('he', 'storySource', {src: e1.storySourceHe}),
    'with the Hebrew source name');
  assert.equal(factOf('he', 'engTitle').textContent, e1.titleEn, 'and the English title labelled editorial');
  assert.deepEqual(langIssues(H.view(), 'he'), [], 'Language of parts on a story-name episode in Hebrew');
  await H.navigate('episode/' + sid(2));
  assert.equal(H.h1().textContent, e2.storyHe, 'A story name without an English title heads the Hebrew page');
  const src2 = H.byClass('story-src')[0], en2 = src2 && src2.children.find(c => c.getAttribute && c.getAttribute('lang') === 'en');
  assert(en2 && en2.textContent === e2.storySourceEn, 'An English-only source name is an English part in Hebrew');
  assert(en2.getAttribute('dir'), 'and is isolated');
  assert.deepEqual(langIssues(H.view(), 'he'), [], 'Language of parts with an English source name');
  await H.navigate('episode/' + sid(3));
  assert.equal(H.h1().textContent, e3.titleHe, 'A blank storyHe leaves the catalogue title as the Hebrew heading');
  await H.navigate('guide/' + EDGE.story + '?layout=album');
  assert.equal(H.fk('ep-' + sid(1)).textContent, e1.storyHe, 'Hebrew tiles use the story name');
  await H.navigate('guide/' + EDGE.story + '?layout=list');
  assert.equal(H.fk('row-' + sid(2)).textContent, e2.storyHe, 'Hebrew list rows use the story name');
  await H.navigate('browse/missing');
  assert.equal(H.fk('td-' + sid(2)).textContent, e2.storyHe, 'Hebrew Missing episodes rows use the story name');
  await H.navigate('record/edge-story-upload');
  const recLinks = H.find(a => a.tagName === 'a' && a.href === '#/episode/' + sid(1)).map(a => a.textContent);
  assert(recLinks.length && recLinks.every(x => x.endsWith(e1.storyHe)), 'The record page names its episode by the story name in Hebrew: ' +
    recLinks.join(' | '));
  await H.flipLang();
  ok('story names: Hebrew headings, tiles, rows, Missing episodes rows and record links use storyHe; English keeps titleEn; the identity card keeps ' +
    'the catalogue title and names the source; search, YouTube search and export use it; blank values ignored');
}

// Editorial Hebrew titles (titleHeEditorial) on fixed fixtures. In Hebrew, headings, document.title, tiles and their labels, list
// rows, Missing episodes and to-do rows, Videos to identify, upload cards and rows, record links, Up next, Starred and star labels
// use them where there is no published Hebrew title; a published titleHe or storyHe comes first and a blank value is ignored. In
// English they appear only in the labelled row on the record page and the identity card. Search finds them in both languages;
// the published-title lines and the YouTube search words leave them out; the to-do export names the field.
async function checkEditorialTitles(H, M) {
  const enc = encodeURIComponent, eid = n => EDGE.edited + '-' + n, ep = id => M.eps.find(e => e.id === id);
  const [e1, e2, e3, e4, e5] = [1, 2, 3, 4, 5].map(n => ep(eid(n))), es = ep(EDGE.editedShalom + '-1');
  const [rec, clip, pubRec, blankRec, queued] = ['edge-ed-rec', 'edge-ed-clip', 'edge-ed-pub', 'edge-ed-blank', 'edge-ed-queued']
    .map(id => M.recById.get(id));
  const eps = [e1, e2, e3, e4, e5, es], recs = [rec, clip, pubRec, blankRec, queued];
  const lede = () => H.byClass('lede', H.byClass('hero')[0])[0];
  const pub = r => r.originalTitle || r.titleHe || r.titleEn || r.title || '';
  const ytHref = (p, words) => 'https://www.youtube.com/results?search_query=' + enc(p + ' ' + words);
  // The model: the published Hebrew title, else the editorial one, else English, in Hebrew only; a blank value is ignored.
  assert.deepEqual(eps.map(e => M.epTitle(e, 'he')), [e1.titleHeEditorial, e2.titleHeEditorial, e3.titleHe, e4.storyHe, e5.titleEn,
    es.titleHeEditorial], 'The model heads Hebrew episodes with the published, else the editorial, else the English title');
  assert.equal(M.epTitle(e2, 'en'), tr('en', 'untitledN', {noun: tr('en', 'noun_episode'), n: '2'}), 'and never with the editorial one in English');
  assert.deepEqual(recs.map(r => recTitleIn(r, 'he')), [rec.titleHeEditorial, clip.titleHeEditorial, pubRec.titleHe, blankRec.titleEn,
    queued.titleHeEditorial], 'Hebrew record titles: published, else editorial, else English');
  const pages = async lang => {
    for (const e of eps) {
      await H.navigate('episode/' + enc(e.id)); const where = lang + ' editorial episode ' + e.id, title = M.epTitle(e, lang);
      assert.equal(H.h1().textContent, title, where + ': heading');
      assert(H.document.title.startsWith(title + ' · '), where + ': document.title follows the heading');
      assertEditorialRow(H, heEdOf(e), lang, where);
      // The second line is the other language's title: a published Hebrew title in English (never the editorial one), the
      // English title in Hebrew.
      const alt = lang === 'he' ? e.titleEn : (e.storyHe || e.titleHe);
      assert.equal(lede() ? lede().textContent : undefined, alt && alt !== title ? alt : undefined, where + ': second line');
      assert.deepEqual(langIssues(H.view(), lang), [], where + ': language of parts');
    }
    for (const r of recs) {
      await H.navigate('record/' + enc(r.id)); const where = lang + ' editorial record ' + r.id, title = recTitleIn(r, lang);
      assert.equal(H.h1().textContent, title, where + ': heading');
      assert(H.document.title.startsWith(title + ' · '), where + ': document.title follows the heading');
      assertEditorialRow(H, heEdOf(r), lang, where);
      // The published title keeps its line and its row; neither ever shows the editorial title.
      assert.equal(lede() ? lede().textContent : undefined, pub(r) !== title ? pub(r) : undefined, where + ': the published title line');
      assert.equal(factIn(H, lang, 'origTitle').textContent, pub(r), where + ': the "Title as published" row');
      assert.equal(H.fk('rec-star').getAttribute('aria-label'), tr(lang, 'starAria', {title}), where + ': the star label');
      assert.deepEqual(langIssues(H.view(), lang), [], where + ': language of parts');
    }
  };
  // An editorial Hebrew title is written for a right-to-left line: the element showing it is RTL even when the title starts with
  // a Latin word or a bracket (dir=auto would lay it out left to right), and a number range in it is an LTR isolate, as in Hebrew
  // notes; its text is unchanged. Published titles keep dir=auto.
  const latin = M.recById.get('edge-ed-latin');
  const edSpan = dd => dd && dd.children.find(c => c && c.tagName === 'span');
  const rtlTitle = (n, value, where) => {
    assert(n, where + ': shown');
    assert.equal(n.textContent, value, where + ': text');
    assert.equal(n.getAttribute('dir'), 'rtl', where + ': laid out right to left');
    const range = (value.match(/\d+\s*–\s*\d+/) || [])[0];
    const iso = n.children.filter(c => c && c.getAttribute && c.getAttribute('dir') === 'ltr').map(c => c.textContent);
    assert.deepEqual(iso, range ? [range] : [], where + ': its number range is an LTR isolate');
  };
  // English: the English titles everywhere; the editorial Hebrew title only in its labelled row.
  await pages('en');
  for (const [route, x] of [['record/' + enc(latin.id), latin], ['episode/' + enc(e2.id), e2]]) {
    await H.navigate(route); const span = edSpan(factIn(H, 'en', 'heEdTitle'));
    rtlTitle(span, x.titleHeEditorial, 'en #/' + route + ': the editorial Hebrew title row');
    assert.equal(span.getAttribute('lang'), 'he', 'en #/' + route + ': and is Hebrew');
    assert.notEqual(H.h1().getAttribute('dir'), 'rtl', 'en #/' + route + ': the English heading keeps dir=auto');
  }
  const marks = recs.concat(eps).map(heEdOf).filter(Boolean);
  for (const route of ['guide/' + EDGE.edited + '?layout=album', 'guide/' + EDGE.edited + '?layout=list', 'guide/' + EDGE.editedShalom,
    'browse?q=Edge%20editorial', 'browse/missing', 'browse/unidentified', 'todo']) {
    await H.navigate(route); const attrs = H.find(n => n.getAttribute).flatMap(n => ['aria-label', 'title'].map(a => n.getAttribute(a) || ''));
    for (const m of marks) {
      assert(!H.text().includes(m) && !attrs.some(a => a.includes(m)) && !H.document.title.includes(m),
        `en #/${route}: the editorial Hebrew title "${m}" is not shown in English`);
    }
  }
  // Search finds editorial Hebrew titles: uploads by their own or their episode's, episodes by their own or an upload's.
  for (const [q, id] of [['זקהעלאה', rec.id], ['זקקטע', clip.id], ['זקפרק', rec.id], ['זקתור', queued.id]]) {
    await H.navigate('browse?q=' + enc(q)); H.flushTimers();
    assert(H.has(cardKey(M, id), H.view()), `Browse search finds the editorial Hebrew title "${q}"`);
    assert.equal(H.fk(cardKey(M, id)).textContent, cardTitle(M, id), 'and the English card keeps the English title');
  }
  for (const [q, id] of [['זקפרק', e1.id], ['זקבלי', e2.id], ['זקהעלאה', e1.id], ['זקשלום', es.id]]) {
    await H.navigate('guide?layout=album&q=' + enc(q)); H.flushTimers();
    assert(H.has('ep-' + id, H.view()), `The guide search finds the editorial Hebrew title "${q}"`);
  }
  // Missing episodes: the YouTube search uses the published or English title, else the number, never the editorial title.
  await H.navigate('browse/missing');
  const finds = () => [e2, es].map(e => H.extLinks(H.fk('td-' + e.id).parentElement.parentElement)[0].href);
  const want = [ytHref('רחוב סומסום', 'פרק 2'), ytHref('Shalom Sesame', es.titleEn)];
  assert.deepEqual(finds(), want, 'The YouTube search leaves the editorial Hebrew title out');
  await H.navigate('todo'); await H.fk('td-export').click();
  const todo = await H.blobJson(), row = id => todo.missing.find(x => x.id === id);
  assert.deepEqual([row(e2.id).titleHeEditorial, row(e2.id).titleHe, row(e5.id).titleHeEditorial, row(e3.id).titleHe],
    [e2.titleHeEditorial, null, null, e3.titleHe], 'The to-do export names titleHeEditorial apart from titleHe (null for a blank one)');
  assert.equal(row(e2.id).search, want[0], 'and its search link leaves it out');
  // The title sort follows the shown title: in English the English titles (Alpha before Zulu).
  const sortIds = () => H.find(n => /^card-/.test(n.getAttribute?.('data-fk') || '')).map(n => n.getAttribute('data-fk').slice(5));
  await H.navigate('browse?q=zqsort&sort=title'); H.flushTimers();
  assert.deepEqual(sortIds(), ['edge-sort-a', 'edge-sort-b'], 'English title sort uses the English titles');
  // Hebrew: the editorial titles head and name the items with no published Hebrew title.
  await H.flipLang();
  await pages('he');
  await H.navigate('episode/' + enc(e2.id)); rtlTitle(H.h1(), e2.titleHeEditorial, 'Hebrew bracket-first editorial heading');
  rtlTitle(edSpan(factIn(H, 'he', 'heEdTitle')), e2.titleHeEditorial, 'and its labelled row');
  await H.navigate('episode/' + enc(e1.id)); rtlTitle(H.h1(), e1.titleHeEditorial, 'Hebrew Latin-first editorial heading with a range');
  await H.navigate('episode/' + enc(e3.id));
  assert.equal(H.h1().getAttribute('dir'), 'auto', 'A published Hebrew title heading keeps dir=auto');
  await H.navigate('record/' + enc(latin.id)); rtlTitle(H.h1(), latin.titleHeEditorial, 'Hebrew Latin-first editorial record heading');
  await H.navigate('browse?q=' + enc('זקלטיני')); H.flushTimers();
  rtlTitle(H.fk(cardKey(M, latin.id)), latin.titleHeEditorial, 'Hebrew Latin-first editorial upload card');
  await H.navigate('guide/' + EDGE.edited + '?layout=album');
  rtlTitle(H.fk('ep-' + e2.id), e2.titleHeEditorial, 'Hebrew editorial tile');
  assert.equal(H.fk('ep-' + e3.id).getAttribute('dir'), 'auto', 'A published Hebrew title tile keeps dir=auto');
  await H.navigate('guide/' + EDGE.edited + '?layout=list'); rtlTitle(H.fk('row-' + e2.id), e2.titleHeEditorial, 'Hebrew editorial list row');
  await H.navigate('browse/missing'); rtlTitle(H.fk('td-' + e2.id), e2.titleHeEditorial, 'Hebrew editorial Missing episodes row');
  await H.navigate('guide/' + EDGE.edited + '?layout=album');
  for (const e of [e1, e2, e3, e4, e5]) {
    const a = H.fk('ep-' + e.id); assert.equal(a.textContent, M.epTitle(e, 'he'), 'Hebrew tiles: ' + e.id);
    assert(a.getAttribute('aria-label').includes(M.epTitle(e, 'he')), 'and their labels: ' + e.id);
  }
  await H.navigate('guide/' + EDGE.edited + '?layout=list');
  for (const e of [e1, e2, e3]) assert.equal(H.fk('row-' + e.id).textContent, M.epTitle(e, 'he'), 'Hebrew list rows: ' + e.id);
  await H.navigate('browse/missing');
  for (const e of [e2, es]) assert.equal(H.fk('td-' + e.id).textContent, e.titleHeEditorial, 'Hebrew Missing episodes rows: ' + e.id);
  assert.deepEqual(finds(), want, 'The Hebrew page searches YouTube with the same words');
  await H.navigate('todo');
  assert.equal(H.fk('td-' + e1.id).textContent, e1.titleHeEditorial, 'Hebrew to-do rows (whole links to check)');
  await H.navigate('browse/unidentified');
  assert.equal(H.fk('tq-' + queued.id).textContent, queued.titleHeEditorial, 'Hebrew Videos to identify rows');
  await H.navigate('guide/' + EDGE.edited);
  assert.equal(H.fk('q-' + queued.id).textContent, queued.titleHeEditorial, 'Hebrew queue items on the production page');
  await H.navigate('episode/' + enc(e1.id));
  assert(H.fk('ur-' + rec.id).textContent.endsWith(rec.titleHeEditorial), 'Hebrew upload rows on the episode page');
  assert(H.fk('ep-watch').getAttribute('aria-label').includes(', ' + e1.titleHeEditorial + ' ('), 'and the Watch link names the episode by it');
  await H.navigate('browse?q=' + enc('זקהעלאה')); H.flushTimers();
  const card = H.fk(cardKey(M, rec.id)), body = card.parentElement.parentElement;
  assert.equal(card.textContent, cardTitle(M, rec.id, 'he'), 'Hebrew upload cards');
  if (M.entryOf.get(rec.id).id === rec.id) assert.equal(H.byClass('u-pub', body)[0].textContent, rec.originalTitle, 'with the published title under it');
  else assert(!H.byClass('u-pub', body).length, 'An episode card is headed by the episode, with no upload title under it');
  await H.navigate('record/' + enc(rec.id));
  const links = H.find(a => a.tagName === 'a' && a.href === '#/episode/' + enc(e1.id)).map(a => a.textContent);
  assert(links.length && links.every(x => x.endsWith(e1.titleHeEditorial)),
    'The record page names its episode by the editorial title: ' + links.join(' | '));
  await H.fk('rec-star').click(); await H.navigate('starred');
  assert.equal(H.fk(cardKey(M, rec.id)).textContent, cardTitle(M, rec.id, 'he'), 'Hebrew Starred cards');
  await H.navigate('record/' + enc(rec.id)); await H.fk('rec-star').click();
  // Up next offers core episodes with an offered whole copy; the edited episode is one of them.
  await H.navigate('home');
  const nextIs = () => H.has('next-ep', H.view()) && H.fk('next-ep').href === '#/episode/' + enc(e1.id);
  for (let k = 0; k < 2000 && H.has('next-skip', H.view()) && !nextIs(); k++) await H.fk('next-skip').click();
  rtlTitle(H.fk('next-ep'), e1.titleHeEditorial, 'Hebrew Up next');
  assert(H.fk('next-watch').getAttribute('aria-label').includes(', ' + e1.titleHeEditorial + ' ('), 'and its Watch label');
  for (const [q, id] of [['זקהעלאה', rec.id], ['זקפרק', rec.id]]) {
    await H.navigate('browse?q=' + enc(q)); H.flushTimers();
    assert(H.has(cardKey(M, id), H.view()), `Hebrew browse search finds "${q}"`);
  }
  await H.navigate('guide?layout=album&q=' + enc('זקבלי')); H.flushTimers();
  assert(H.has('ep-' + e2.id, H.view()), 'Hebrew guide search finds an editorial title');
  // Every other place that shows an editorial title lays it out RTL with its ranges isolated too (review round 1: these were
  // checked by their text only, so dir=auto or a bare range there passed).
  const [e6, e7] = [6, 7].map(n => ep(eid(n))), vimeoRec = M.recById.get('edge-ed-vimeo'), tie1 = ep('edge-tie-1');
  const linkTo = (route, within = H.view()) => H.find(a => a.tagName === 'a' && a.href === '#/' + route, within);
  const bdiIn = a => a && a.children.find(c => c && c.tagName === 'bdi' && c.getAttribute('dir') === 'rtl');
  await H.navigate('guide/' + EDGE.edited + '?layout=album');
  rtlTitle(H.fk('q-' + queued.id), queued.titleHeEditorial, 'Hebrew queue item');
  await H.navigate('browse/unidentified');
  rtlTitle(H.fk('tq-' + queued.id), queued.titleHeEditorial, 'Hebrew Videos to identify row');
  // A tied candidate's compact link (its code) names it by the editorial title in its hint.
  const tieRow = H.fk('tq-edge-tied').parentElement.parentElement, tieLink = linkTo('episode/edge-tie-1', tieRow)[0];
  assert.equal(tieLink && tieLink.getAttribute('title'), tie1.titleHeEditorial, 'Hebrew compact suggestion hint');
  await H.navigate('record/edge-tied');
  rtlTitle(bdiIn(linkTo('episode/edge-tie-1', H.byClass('sugg')[0])[0]), tie1.titleHeEditorial, 'Hebrew suggestion title');
  await H.navigate('episode/' + enc(e1.id));
  const ur = H.fk('ur-' + rec.id);
  assert.equal(ur.getAttribute('dir'), 'rtl', 'Hebrew upload row: laid out right to left');
  rtlTitle(ur.children.find(c => c && c.tagName === 'span'), rec.titleHeEditorial, 'Hebrew upload row title');
  const urWatch = H.extLinks(ur.parentElement.parentElement.parentElement)[0];
  assert(urWatch.getAttribute('aria-label').includes(', ' + rec.titleHeEditorial + ' ('), 'Hebrew upload row Watch label: ' + urWatch.getAttribute('aria-label'));
  await H.navigate('record/' + enc(rec.id));
  rtlTitle(linkTo('episode/' + enc(e1.id), H.byClass('crumbs')[0])[0], e1.titleHeEditorial, 'Hebrew record breadcrumb');
  const cardLinks = linkTo('episode/' + enc(e1.id)).filter(a => !H.byClass('crumbs')[0].contains(a));
  assert(cardLinks.length, 'The record page links its episode');
  for (const a of cardLinks) rtlTitle(bdiIn(a), e1.titleHeEditorial, 'Hebrew record guide card');
  assert(H.fk('rec-watch').getAttribute('aria-label').includes(', ' + rec.titleHeEditorial + ' ('), 'Hebrew record Watch label');
  await H.navigate('guide/' + EDGE.edited + '?layout=numbers');
  const un6 = H.find(a => a.tagName === 'a' && a.href === '#/episode/' + enc(e6.id) && H.cls(a.parentElement).includes('unnum'))[0];
  rtlTitle(un6 && un6.children.find(c => c && c.tagName === 'span' && !H.cls(c).includes('glyph')), e6.titleHeEditorial, 'Hebrew unnumbered episode link');
  assert(un6.getAttribute('aria-label').startsWith(e6.titleHeEditorial + '. '), 'Hebrew unnumbered link name');
  const cell1 = H.find(a => a.tagName === 'a' && a.href === '#/episode/' + enc(e1.id) && H.cls(a).includes('cell'))[0];
  assert(cell1.getAttribute('aria-label').includes(': ' + e1.titleHeEditorial + '. ') && cell1.getAttribute('title') === cell1.getAttribute('aria-label'),
    'Hebrew Numbers grid cell name and hint');
  await H.navigate('guide/' + EDGE.edited + '?layout=list');
  const listWatch = H.extLinks(H.fk('row-' + e1.id).parentElement.parentElement)[0];
  assert(listWatch.getAttribute('aria-label').includes(', ' + e1.titleHeEditorial + ' ('), 'Hebrew List row Watch label');
  await H.navigate('guide/' + EDGE.edited + '?layout=album');
  const findE2 = H.extLinks(H.fk('ep-' + e2.id).parentElement.parentElement)[0];
  assert(findE2.getAttribute('aria-label').includes(e2.titleHeEditorial), 'Hebrew tile Find on YouTube label: ' + findE2.getAttribute('aria-label'));
  // An episode with both an English and an editorial title: the Hebrew label uses the editorial one.
  await H.navigate('guide/' + EDGE.editedShalom + '?layout=album');
  const findEs = H.extLinks(H.fk('ep-' + es.id).parentElement.parentElement)[0];
  assert(findEs.getAttribute('aria-label').includes(es.titleHeEditorial) && !findEs.getAttribute('aria-label').includes(es.titleEn),
    'Hebrew tile Find on YouTube label names the episode by its editorial title: ' + findEs.getAttribute('aria-label'));
  // The record page keeps the English title row in Hebrew; a pasted Vimeo link stores only a published Hebrew title.
  await H.navigate('record/' + enc(rec.id));
  assert.equal(factIn(H, 'he', 'engTitle').textContent, rec.titleEn, 'The Hebrew record page keeps the English title row');
  await H.navigate('record/edge-ed-hop');
  H.$('vimeo-url').value = 'https://vimeo.com/123456780/abcdef1234'; await H.find(n => n.tagName === 'form')[0].fire('submit');
  assert.equal(JSON.parse(H.storage.get('sumsum-vimeo-mappings'))['edge-ed-hop'].titleHe, '', 'A pasted link never stores the editorial title as titleHe');
  await H.fk('map-remove').click();
  await H.navigate('episode/' + enc(e2.id));
  assert.equal(H.fk('prev').getAttribute('aria-label'), L.he.prevEp + ': ' + e1.titleHeEditorial, 'Hebrew previous-episode link name');
  await H.navigate('episode/' + enc(e6.id));
  assert.equal(H.fk('next').getAttribute('aria-label'), L.he.nextEp + ': ' + e7.titleHeEditorial, 'Hebrew next-episode link name');
  // The pasted-link banner names the uploads with that Vimeo video.
  await H.navigate('browse?q=' + enc(vimeoRec.url)); H.flushTimers();
  rtlTitle(linkTo('record/' + vimeoRec.id, H.byClass('banner')[0])[0], vimeoRec.titleHeEditorial, 'Hebrew pasted-link banner');
  await H.navigate('browse?q=' + enc('זקוימאו')); H.flushTimers();
  const vBody = H.fk(cardKey(M, vimeoRec.id)).parentElement.parentElement, tagTip = H.find(n => n.getAttribute && n.getAttribute('title') &&
    H.cls(n).includes('tag'), vBody)[0];
  assert(tagTip && [e6, e7].every(e => tagTip.getAttribute('title').includes(e.titleHeEditorial)), 'Hebrew card tag hint names the episodes');
  assert(H.extLinks(vBody.parentElement)[0].getAttribute('aria-label').includes(', ' + vimeoRec.titleHeEditorial + ' ('), 'Hebrew card Watch label');
  // The title sort follows the shown title: in Hebrew the editorial titles (אגס before תמר).
  await H.navigate('browse?q=' + enc('זקמיון') + '&sort=title'); H.flushTimers();
  assert.deepEqual(sortIds(), ['edge-sort-b', 'edge-sort-a'], 'Hebrew title sort uses the editorial titles');
  // Search: gershayim, a geresh or quote between letters, and plene doubled letters are not needed (review round 1).
  for (const [q, id] of [['האות שין', 'edge-ed-shin'], ['האות שי"ן', 'edge-ed-shin'], ['האות שי״ן', 'edge-ed-shin'], ['חנוכיה', 'edge-ed-menorah'],
    ['החנוכיה שנעלמה', 'edge-ed-menorah'], ['החנוכייה', 'edge-ed-menorah'], ['מצוה', 'edge-ed-mitzvah'], ['טו בשבט', 'edge-ed-shvat'],
    ["ט'ו בשבט", 'edge-ed-shvat']]) {
    await H.navigate('browse?q=' + enc(q)); H.flushTimers();
    assert(H.has(cardKey(M, id), H.view()), `Hebrew search "${q}" finds ${id}`);
  }
  await H.flipLang();
  ok('editorial Hebrew titles: Hebrew headings, document.title, tiles, rows, Missing episodes, to-do and Videos to identify rows, upload ' +
    'cards and rows, record links, Up next, Starred and star labels use titleHeEditorial without a published Hebrew title; titleHe and ' +
    'storyHe come first; blank values ignored; English shows it only in the labelled row; search finds it; the published-title ' +
    'lines and YouTube search words leave it out; the export names it; it is laid out RTL, also when it starts with a Latin word ' +
    'or bracket, with its number ranges as LTR isolates, while published titles keep dir=auto');
}

// Starred counts include only stars that match a record; unknown values in the hash are dropped; old #/saved links work.
// Entries and link order on the fixtures of edgePayload(): one entry per episode with its copies in the user's order; a failed
// copy last and never the Watch link; a compilation counted in two episodes is an entry of its own; one video on two pages is
// one entry; stars on any member star the entry and unstarring clears them; the queue keeps the exact part; a subscribed service
// is offered by Up next.
async function checkEntries(htmlPath) {
  const st = new Map([['sumsum-favorites', JSON.stringify(['edge-ord-yt'])], ['sumsum-sitting', JSON.stringify(['edge-ord-p2'])]]);
  const H = harness(boot(htmlPath, {payload: edgePayload, storage: st})), M = model(H.payload);
  const en1 = M.entries.find(en => en.id === 'ep:edge-order-1');
  assert(en1 && en1.members.length === 5, 'The five copies of one episode are one entry');
  assert.deepEqual(M.rankedOf(en1).map(r => r.id), ['edge-ord-ia', 'edge-ord-yt', 'edge-ord-sub', 'edge-ord-vm', 'edge-ord-ia-bad'],
    'The model orders them archive.org, YouTube, the subscribed service, Vimeo, then the failed copy');
  await H.navigate('browse?q=zqorder');
  const cards = H.find(n => /^card-/.test(n.getAttribute?.('data-fk') || '')).map(n => n.getAttribute('data-fk').slice(5));
  assert.deepEqual([...cards].sort(), ['edge-ord-comp', 'ep:edge-order-1', 'ep:edge-order-2', 'ep:edge-order-3', 'ep:edge-order-6', 'ep:edge-order-7', 'edge-ord-ex7'].sort(),
    'Browse lists one card per episode, and the compilation counted in two episodes as a card of its own: ' + cards.join(' '));
  const card = H.fk('card-ep:edge-order-1').parentElement.parentElement.parentElement;
  assert.equal(H.extLinks(card)[0].href, 'https://archive.org/details/edge-order/one.mp4', 'The card opens the archive.org copy');
  assert.equal(H.fk('card-ep:edge-order-1').href, '#/episode/edge-order-1', 'and its title opens the episode');
  assert.equal(H.byClass('u-also', card)[0].textContent, tr('en', 'alsoOn', {hosts: [L.en.host_youtube, 'Edge Stream', L.en.host_vimeo].join(', ')}),
    'It names the other places it was found, in order, once each');
  assert.equal(H.fk('star-ep:edge-order-1').getAttribute('aria-pressed'), 'true', 'A star on a lower-ranked copy stars the entry');
  // Filters need one copy that passes them all: a Vimeo filter shows the entry through its Vimeo copy.
  await H.navigate('browse?q=zqorder&ag=direct');
  const vcard = H.fk('card-ep:edge-order-1').parentElement.parentElement.parentElement;
  assert.equal(H.extLinks(vcard)[0].href, 'https://vimeo.com/555666777', 'Under a filter the card shows the copy that passes it');
  await H.navigate('browse?q=zqtwin');
  assert.equal(H.count(), 1, 'Two pages with the same video are one entry');
  // The episode page: the Watch link is the first copy; the rows follow the link order, the failed copy last.
  await H.navigate('episode/edge-order-1');
  assert.equal(H.fk('ep-watch').href, 'https://archive.org/details/edge-order/one.mp4', 'The episode opens archive.org first');
  const rows = H.find(n => /^ur-edge-ord-/.test(n.getAttribute?.('data-fk') || '')).map(n => n.getAttribute('data-fk').slice(3));
  assert.deepEqual(rows, M.rankedOf(en1).map(r => r.id), 'The episode page lists the copies in link order');
  assert.equal(H.fk('ep-star').getAttribute('aria-pressed'), 'true', 'The episode page stars the entry');
  await H.fk('ep-star').click();
  const favs = JSON.parse(st.get('sumsum-favorites'));
  assert(!favs.includes('edge-ord-yt') && !favs.includes('ep:edge-order-1'), 'Unstarring the entry clears the copy\'s star too: ' + favs.join(' '));
  await H.fk('ep-star').click();
  assert(JSON.parse(st.get('sumsum-favorites')).includes('ep:edge-order-1'), 'Starring an entry stores the episode key');
  await H.fk('ep-star').click();
  // The queue keeps the exact link: an old queued part 2 still opens part 2, named by its episode.
  await H.navigate('home');
  assert.equal(H.fk('home-open').href, 'https://www.youtube.com/watch?v=EdgeOrderP02', 'A queued part opens that part');
  assert.equal(H.fk('home-qt-edge-ord-p2').textContent, 'Edge order episode 2', 'and is named by its episode');
  assert(H.byClass('qcard')[0].textContent.includes(tr('en', 'partOf', {i: '2', n: '2'})), 'with its part');
  // Adding an episode entry queues its first copy; removing it takes every copy out.
  await H.navigate('episode/edge-order-1'); await H.fk('ep-q').click(); H.flushTimers();
  assert.deepEqual(JSON.parse(st.get('sumsum-sitting')), ['edge-ord-p2', 'edge-ord-ia'], 'The episode queues its first copy');
  await H.fk('ep-q').click(); H.flushTimers();
  assert.deepEqual(JSON.parse(st.get('sumsum-sitting')), ['edge-ord-p2'], 'and leaves the queue as one');
  // A summary without its own url links the source named like it (Muppet Wiki), not the episode's first source.
  const attrib = H.byClass('ep-attrib')[0], alinks = H.find(n => n.tagName === 'a', attrib);
  assert.equal(alinks[0].href, 'https://muppet.fandom.com/wiki/Edge?oldid=7', 'The summary links its own source\'s revision, not the first source');
  assert(alinks.some(a => a.href === 'https://www.fandom.com/licensing'), 'with the Muppet Wiki licence');
  // A copy of the episode alone outranks a compilation on the same host, wherever the guide lists it.
  await H.navigate('episode/edge-order-6');
  assert.equal(H.fk('ep-watch').href, 'https://archive.org/details/edge-order/six.mp4', 'The episode\'s own copy before the compilation');
  // An episode whose only whole copy is a compilation (no entry of its own): star and "+" act on the compilation's entry.
  await H.navigate('episode/edge-order-4');
  assert.equal(H.fk('ep-watch').href, 'https://archive.org/details/edge-order/compilation.mp4');
  assert(H.has('ep-star', H.view()), 'A compilation-only episode can be starred');
  await H.fk('ep-q').click(); H.flushTimers();
  assert.equal(H.fk('ep-q').getAttribute('aria-pressed'), 'true', 'Its "+" shows the compilation queued');
  assert.deepEqual(JSON.parse(st.get('sumsum-sitting')), ['edge-ord-p2', 'edge-ord-comp']);
  await H.fk('ep-q').click(); H.flushTimers();
  assert.deepEqual(JSON.parse(st.get('sumsum-sitting')), ['edge-ord-p2'], 'and a second press takes it off');
  // When Watch opens a copy outside the episode's entry, the star stores that copy, as "+" queues it.
  await H.navigate('episode/edge-order-7');
  assert.equal(H.fk('ep-watch').href, 'https://www.youtube.com/watch?v=EdgeOrderX07', 'A usable excerpt before a failed whole copy');
  await H.fk('ep-star').click();
  assert(JSON.parse(st.get('sumsum-favorites')).includes('edge-ord-ex7'), 'The star stores the copy Watch opens');
  await H.fk('ep-star').click();
  assert(!JSON.parse(st.get('sumsum-favorites')).includes('edge-ord-ex7'), 'and unstarring clears it');
  // A subscribed service is offered unasked: Up next reaches the episode whose only copy is on it.
  const sub = 'https://play.edgestream.example/episode/3';
  assert(offerable(M.recById.get('edge-ord-only-sub')), 'The model offers a subscribed listing');
  let found = false; await H.navigate('home');
  for (let k = 0; k < 3000 && H.has('next-watch', H.view()); k++) {
    if (H.fk('next-watch').href === sub) { found = true; break; }
    if (!H.has('next-skip', H.view())) break; await H.fk('next-skip').click();
  }
  assert(found, 'Up next offers an episode whose copy is on a subscribed service');
  ok('entries: one per episode with its copies in the user\'s link order (archive.org, YouTube, subscribed, Vimeo; failed last), ' +
    'the other places named once, a filter shown through the copy that passes it; a compilation and a shared video each one entry; ' +
    'stars on any copy, unstarring clears them; the queue keeps the exact part; subscribed services offered');
}

async function checkStarredAndHash(htmlPath, M) {
  // Stars are stored per key and counted per entry: a record's star stars its entry.
  const real = M.records[0].id, N = M.entries.length, oneEach = M.entries.map(en => en.members[0].id);
  let H = harness(boot(htmlPath, {storage: new Map([['sumsum-favorites', JSON.stringify([real, 'removed-record-id', 'https://example.org/gone'])]])}));
  assert.equal(H.number(H.byClass('tab-count', H.fk('tab-starred'))[0].textContent), 1, 'Starred tab counts only stars that match a record');
  // Over 99 stars the phone badge reads "99+" (review round 1: "1,200" ran over the theme button or off the page); the full
  // count is the text assistive technology reads, and wider screens show it.
  if (N > 99) {
    const many = oneEach.slice(0, Math.min(N, 150));
    const S = harness(boot(htmlPath, {storage: new Map([['sumsum-favorites', JSON.stringify(many)]])}));
    const badge = S.byClass('tab-count', S.fk('tab-starred'))[0], full = S.byClass('cnt-full', badge)[0], short = S.byClass('cnt-short', badge)[0];
    assert(S.cls(badge).includes('capped') && full && short, 'A count over 99 has a capped badge');
    assert.equal(full.textContent, many.length.toLocaleString('en-US'), 'with the full count');
    assert(short.textContent === '99+' && short.getAttribute('aria-hidden') === 'true' && short.getAttribute('dir') === 'ltr',
      'and a short "99+" that is hidden from assistive technology and laid out left to right');
    assert(accName(S.fk('tab-starred')).endsWith(many.length.toLocaleString('en-US')), 'The tab is named with the full count');
    await S.flipLang();
    const hb = S.byClass('tab-count', S.fk('tab-starred'))[0];
    assert.equal(S.byClass('cnt-short', hb)[0].textContent, '99+', 'Hebrew keeps "99+"');
  }
  const small = H.byClass('tab-count', H.fk('tab-starred'))[0];
  assert(!H.cls(small).includes('capped') && !small.children.some(c => c && c.tagName === 'span'), 'A count up to 99 is the number alone');
  await H.navigate('starred'); assert.equal(H.count(), 1);
  assert(H.$('count').textContent.includes(tr('en', 'countUploads', {n: '1', total: '1'}).split(' ').at(-1)));
  assert.equal(H.$('count').textContent.replace(/\D+/g, ' ').trim(), '1 1', 'Starred total ignores stale stars');
  H = harness(boot(htmlPath, {storage: new Map([['sumsum-favorites', JSON.stringify(['removed-record-id'])]])}));
  await H.navigate('starred');
  assert(H.text().includes(L.en.starredEmpty), 'Only stale stars: "No stars yet"');
  // Unstarring in Starred moves focus to the next card, then to the count.
  const two = oneEach.slice(0, 2);
  H = harness(boot(htmlPath, {storage: new Map([['sumsum-favorites', JSON.stringify(two)]])}));
  await H.navigate('starred');
  const order = H.$('grid').children.map(li => H.find(n => /^card-/.test(n.getAttribute?.('data-fk') || ''), li)[0].getAttribute('data-fk').slice(5));
  H.fk('star-' + order[0]).focus(); await H.fk('star-' + order[0]).click();
  assert.equal(H.$('toast').textContent, L.en.unstarredToast);
  assert.equal(H.document.activeElement.getAttribute('data-fk'), 'card-' + order[1], 'Unstarring in Starred focuses the next card');
  H.fk('star-' + order[1]).focus(); await H.fk('star-' + order[1]).click();
  assert.equal(H.document.activeElement, H.$('count'), 'Unstarring the last card focuses the count');
  // Old bookmarks and start attributes: #/saved, ?saved=1 and data-start-view="saved" open the Starred view or filter, in
  // both languages, and the hash is rewritten to #/starred and starred=1.
  for (const ui of ['en', 'he']) {
    H = harness(boot(htmlPath, {hash: '#/saved', htmlAttrs: {'data-start-lang': ui}, storage: new Map([['sumsum-favorites', JSON.stringify(two)]])}));
    assert(H.h1().textContent === L[ui].starredTitle && H.count() === 2, `#/saved opens Starred at start (${ui})`);
    assert.equal(H.location.hash, '#/starred', `#/saved is rewritten at start (${ui})`);
    assert.equal(H.document.title, L[ui].starredTitle + ' · ' + L[ui].appName, `document.title (${ui})`);
    assert.equal(H.fk('tab-starred').getAttribute('aria-current'), 'page');
    assert.equal(H.byClass('long', H.fk('tab-starred'))[0].textContent, L[ui].navStarred);
    assert.equal(H.byClass('lede', H.view())[0].textContent, L[ui].starredLede);
    H = harness(boot(htmlPath, {hash: '#/uploads?saved=1&sort=title', htmlAttrs: {'data-start-lang': ui},
      storage: new Map([['sumsum-favorites', JSON.stringify(two)]])}));
    assert(H.fk('f-starred').getAttribute('aria-pressed') === 'true' && H.count() === 2, `?saved=1 turns on Starred only at start (${ui})`);
    assert.equal(H.location.hash, '#/browse?starred=1&sort=title', `#/uploads?saved=1 is rewritten to Browse at start (${ui})`);
    assert.equal(H.byClass('lbl', H.fk('f-starred'))[0].textContent, L[ui].starredOnly);
  }
  H = harness(boot(htmlPath, {htmlAttrs: {'data-start-view': 'saved'}}));
  assert(H.h1().textContent === L.en.starredTitle && H.location.hash === '#/starred', 'data-start-view="saved" opens Starred');
  ok('starred counts ignore stale stars; focus after unstarring in Starred; #/saved, ?saved=1 and data-start-view="saved" open ' +
    'Starred and are rewritten (EN, HE)');

  H = harness(boot(htmlPath, {hash: '#/browse?theme=no-such-theme&character=nobody'}));
  assert.equal(H.location.hash, '#/browse', 'Unknown theme and character values are dropped from the hash');
  assert.equal(H.count(), N); assert.equal(H.$('theme').value, '');
  const theme = H.$('theme').children.slice(1)[0];
  if (theme) {
    H = harness(boot(htmlPath, {hash: '#/browse?theme=' + encodeURIComponent(theme.value)}));
    assert.equal(H.$('theme').value, theme.value, 'Known theme values are kept');
  }
  ok('hash: unknown theme and character values dropped');
}

// Stored values that name Object.prototype members, lazy images, detached nodes released, search box direction and
// distinct link names.
async function checkRobustness(htmlPath, M) {
  for (const value of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    const H = harness(bootLight(htmlPath, {storage: new Map([['sumsum-language', JSON.stringify(value)]])}));
    assert.equal(H.document.documentElement.lang, 'en', `A stored language '${value}' falls back to English`);
    assert(H.h1().textContent.trim(), 'and the app renders');
  }
  ok("stored language 'constructor', '__proto__' or 'toString' falls back to English");

  const H = harness(boot(htmlPath, {payload: edgePayload}));
  const images = () => H.find(n => n.tagName === 'img', H.tree);
  const lazyFirst = where => {
    for (const img of images()) {
      const o = img._order || [];
      assert(o.includes('src') && o.indexOf('loading') >= 0 && o.indexOf('loading') < o.indexOf('src'), where + ': loading is set before src');
    }
  };
  await H.navigate('browse'); lazyFirst('browse');
  await H.navigate('guide'); lazyFirst('guide');
  for (const route of ['todo', 'browse/unidentified', 'browse/missing', 'browse/identified']) { await H.navigate(route); lazyFirst(route); }
  ok('images are lazy before their src is set (a re-render does not fetch deferred thumbnails)');

  // Detached cards are released after in-view re-renders (the focus map keeps only connected nodes).
  const v8 = require('node:v8'); v8.setFlagsFromString('--expose-gc'); const gc = vm.runInNewContext('gc');
  // Collected before leaving the view: a route change clears the focus map anyway.
  const released = async (route, box, cls, queries) => {
    await H.navigate(route);
    const refs = H.byClass(cls).slice(0, 5).map(n => new WeakRef(n));
    for (const q of queries) { H.$(box).value = q; await H.$(box).fire('input'); H.flushTimers(); }
    H.$(box).focus(); await new Promise(resolve => setImmediate(resolve)); gc();
    return refs.every(r => r.deref() === undefined);
  };
  assert(await released('browse', 'u-search', 'ucard', ['zzqx-none']), 'Replaced upload cards are not retained');
  assert(await released('guide', 'g-search', 'tile', ['zzqx-none']), 'Replaced guide tiles are not retained');
  ok('detached cards and tiles are released after in-view re-renders');

  for (const id of ['u-search', 'g-search']) {
    await H.navigate(id === 'u-search' ? 'browse' : 'guide');
    assert.equal(H.$(id).getAttribute('dir'), 'auto', id + ': a pasted link keeps its own direction (dir=auto)');
  }
  // Watch and search links in lists name what they open.
  for (const [route, sec] of [['browse/unidentified', 'id-queue'], ['browse/missing', 'ms-slots'], ['browse/missing', 'ms-missing'],
    ['todo', 'td-check']]) {
    await H.navigate(route);
    const names = H.extLinks(H.$(sec)).map(a => a.getAttribute('aria-label') || accName(a));
    assert.equal(new Set(names).size, names.length, sec + ': link names are distinct: ' + names.slice(0, 4).join(' | '));
  }
  ok('search boxes use dir=auto; list-page links have distinct names');
}

// Masthead: the brand is gone; the language toggle is a two-option radiogroup whose state, names and focus follow the
// interface language; filter DOM order.
// ---------------------------------------------------------------- licensed services
// The "How to watch on <service>" box: present exactly when expected, with the data's headline, steps and links in the
// interface language, the date the facts were checked and one item per source (a user observation is not a link).
function assertHowTo(H, svc, lang, where) {
  const boxes = H.fkAll('howto', H.view());
  assert.equal(boxes.length, svc ? 1 : 0, where + ': how-to box ' + (svc ? 'shown' : 'absent'));
  if (!svc) return;
  const box = boxes[0], text = box.textContent, pickL = p => (lang === 'he' ? p.he || p.en : p.en || p.he);
  const h2 = box.children[0];
  assert(h2.tagName === 'h2' && h2.textContent === tr(lang, 'howToTitle', {service: svc.name}), where + ': how-to heading');
  assert.equal(box.getAttribute('aria-labelledby'), h2.getAttribute('id'), where + ': the box is named by its heading');
  const steps = [svc.howTo.headline, ...(svc.howTo.steps || [])];
  assert(H.cls(box.children[1]).includes('howto-lead') && box.children[1].textContent.startsWith(pickL(svc.howTo.headline)),
    where + ': the headline comes first');
  for (const step of steps) {
    assert(text.includes(pickL(step)), where + ': how-to step: ' + pickL(step).slice(0, 60));
    if (step.link) {
      assert(H.extLinks(box).some(a => a.href === safe(step.link.url) && a.textContent.startsWith(pickL(step.link.label))),
        where + ': how-to link ' + step.link.url);
    }
  }
  assert(text.includes(tr(lang, 'howToChecked', {d: H.payload.services.checkedAt})), where + ': the check date');
  const det = H.find(n => n.tagName === 'details', box)[0];
  assert(det && H.cls(det).includes('howto-src'), where + ': the sources disclosure');
  const items = H.find(n => n.tagName === 'li', det);
  assert.equal(det.children[0].textContent, tr(lang, 'howToSources', {n: svc.sources.length.toLocaleString('en-US')}), where + ': sources');
  assert.equal(items.length, svc.sources.length, where + ': one item per source');
  svc.sources.forEach((x, k) => {
    const links = H.extLinks(items[k]), user = x.kind === 'user-observation';
    assert.equal(links.length, user ? 0 : 1, where + ': a source links its page; a user observation does not');
    if (!user) assert.equal(links[0].href, safe(x.url), where + ': source url');
    assert(items[k].textContent.startsWith(user ? tr(lang, 'srcUser') : x.title) && items[k].textContent.includes(x.checkedAt) &&
      items[k].textContent.endsWith(x.finding), where + ': source title, date and finding');
  });
}
// Licensed listings name their service and what it needs, in every place they are offered, in EN and HE; the filters, the
// access legend and About say the same; without services data, every label falls back to "licensed listing".
async function checkLicensed(htmlPath, H, M) {
  const lic = M.records.filter(r => expectAccess(r) === 'licensed');
  const pickL = (p, lang) => (lang === 'he' ? p.he || p.en : p.en || p.he);
  // Strings: no catch-all "account or library card"; one label per model in each place, naming the service.
  for (const lang of ['en', 'he']) {
    for (const k of Object.keys(L[lang])) {
      assert(!/account or library card|account, a purchase or a library card|חשבון או כרטיס ספרייה|חשבון, רכישה או כרטיס/.test(L[lang][k]),
        `No catch-all licensed wording (${lang}): ${k}`);
    }
    for (const m of LIC_MODELS) {
      for (const k of ['agLic_', 'lic_', 'twLic_', 'watchLic_', 'licNote_']) assert(typeof L[lang][k + m] === 'string', `String ${k + m} (${lang})`);
      for (const k of ['twLic_', 'watchLic_', 'licNote_']) assert(L[lang][k + m].includes('{service}'), `${k + m} names the service (${lang})`);
      assert(L[lang]['agLic_' + m].includes('{services}'), `agLic_${m} names the services (${lang})`);
    }
  }
  assert(/library card/.test(L.en['watchLic_library-card']) && /כרטיס ספרייה/.test(L.he['watchLic_library-card']), 'hoopla Watch label names the card');
  assert(/buy or rent/i.test(L.en['watchLic_purchase-or-rent']) && /קנייה או השכרה/.test(L.he['watchLic_purchase-or-rent']),
    'Store Watch label says buy or rent');
  if (!M.services.length) { ok('licensed listings: no services data in this build'); return; }
  const data = H.payload.services;
  assert(data && typeof data.checkedAt === 'string', 'Services data embedded with its check date');
  assert.equal(H.payload.meta.servicesFile, 'licensed-services.json', 'meta names the services file');
  // Every licensed record in the real data is described by a service.
  for (const r of lic) assert(expectSvc(r), 'A licensed listing has a described service: ' + r.id);
  const hoopla = M.services.find(x => x.model === 'library-card' && x.howTo);
  for (const lang of ['en', 'he']) {
    if (H.document.documentElement.lang !== lang) await H.flipLang();
    // Filters: one chip per model, named by its services, with its count; the removable chip has the same name.
    await H.navigate('browse');
    for (const g of M.licGroups) {
      const m = g.slice(4), label = tr(lang, 'agLic_' + m, {services: M.services.filter(x => x.model === m).map(x => x.name).join(', ')});
      assert.equal(H.byClass('lbl', H.fk('fa-' + g))[0].textContent, label, `Filter label (${lang}) ${g}`);
      await H.fk('fa-' + g).click();
      assert.equal(H.count(), M.countE(r => expectGroup(r) === g), `Filter count (${lang}) ${g}`);
      assert.equal(H.fk('ux-a-' + g).getAttribute('aria-label'), tr(lang, 'removeFilter', {name: label}), `Active filter name (${lang}) ${g}`);
      await H.fk('fa-' + g).click();
    }
    // Links written before the split: ?ag=licensed selects every licensed group.
    await H.navigate('browse?ag=licensed');
    assert.equal(H.count(), M.countE(r => lic.includes(r)), `?ag=licensed lists every entry with a licensed listing (${lang})`);
    assert.deepEqual(M.licGroups.map(g => H.fk('fa-' + g).getAttribute('aria-pressed')), M.licGroups.map(() => 'true'), 'and presses each group');
    await H.navigate('browse?q='); assert.equal(H.count(), M.entries.length, 'Filters cleared');
    // The access legend: the licensed entry lists each service's summary, then the rule that a listing is not evidence.
    await H.navigate('guide');
    if (H.byClass('legend').length) {
      const dt = H.find(n => n.tagName === 'dt' && n.textContent === tr(lang, 'legendLicensed'))[0];
      assert(dt, `Legend names licensed listings (${lang})`);
      const dd = dt.parentElement.children[dt.parentElement.children.indexOf(dt) + 1];
      const lines = H.find(n => n.tagName === 'li', dd).map(n => n.textContent);
      assert.deepEqual(lines, M.services.map(x => x.name + ': ' + pickL(x.summary, lang)), `Legend: one line per service (${lang})`);
      assert(dd.textContent.endsWith(tr(lang, 'accessLegend_lic')), `Legend: not a free upload or playback evidence (${lang})`);
    }
    // About: the same summaries after its licensed paragraph.
    const ap = H.fk('about-lic'), ul = ap.parentElement.children[ap.parentElement.children.indexOf(ap) + 1];
    assert.equal(ap.textContent, tr(lang, 'aboutLicensed'), `About: licensed paragraph (${lang})`);
    assert.deepEqual(H.find(n => n.tagName === 'li', ul).map(n => n.textContent), M.services.map(x => x.name + ': ' + pickL(x.summary, lang)),
      `About: one line per service (${lang})`);
    // Each licensed record page: its service's labels, note and (hoopla) the how-to box; an episode whose Watch link is hoopla.
    for (const r of lic) {
      await H.navigate('record/' + encodeURIComponent(r.id));
      const x = expectSvc(r), where = `${lang} record ${r.id}`;
      assert(H.fk('rec-watch').textContent.startsWith(tr(lang, 'watchLic_' + x.model, {service: x.name})), where + ': Watch label');
      assert.equal(H.fk('rec-host').textContent, x.name, where + ': the host chip names the service');
      assert.equal(H.fk('rec-access').textContent, tr(lang, 'acc_licSvc', {service: x.name, req: tr(lang, 'lic_' + x.model)}), where + ': access');
      assert(H.text().includes(tr(lang, 'licNote_' + x.model, {service: x.name})), where + ': note');
      assert.equal(H.has('howto', H.view()), !!x.howTo, where + ': how-to box');
    }
    const hooplaEps = M.eps.filter(e => { const b = M.best(e); return b && b.acc === 'licensed' && expectSvc(b.r) === hoopla; });
    if (hoopla) assert(hooplaEps.length || !lic.some(r => expectSvc(r) === hoopla && M.linked.has(r.id)), 'Some episode watches on hoopla');
    for (const e of hooplaEps) {
      await H.navigate('episode/' + encodeURIComponent(e.id));
      assert(H.fk('ep-watch').textContent.startsWith(tr(lang, 'watchLic_library-card', {service: hoopla.name})), `${lang} ${e.id}: Watch on hoopla`);
      assertHowTo(H, hoopla, lang, `${lang} episode ${e.id}`);
    }
  }
  await H.flipLang(); assert.equal(H.document.documentElement.lang, 'en');
  // Without services data: generic licensed labels, one "Licensed listings" group, no how-to box, no summaries.
  const H0 = harness(boot(htmlPath, {payload: p => { delete p.services; return p; }})), M0 = model(H0.payload);
  try {
    assert.deepEqual(M0.licGroups, []); assert(M0.agroups.includes('lic-other'));
    await H0.navigate('browse');
    assert.equal(H0.byClass('lbl', H0.fk('fa-lic-other'))[0].textContent, L.en.agLicensed, 'Without services: one "Licensed listings" filter');
    assert.equal(H0.chipCount(H0.fk('fa-lic-other')), M0.countE(r => lic.some(x => x.id === r.id)));
    assert(!H0.has('fa-lic-library-card', H0.view()), 'Without services: no per-model filter');
    await H0.navigate('browse?ag=licensed'); assert.equal(H0.count(), M0.countE(r => lic.some(x => x.id === r.id)), 'Without services: ?ag=licensed still lists them');
    for (const r of lic.slice(0, 3)) {
      await H0.navigate('record/' + encodeURIComponent(r.id));
      const host = hostname(expectDest(r));
      assert(H0.fk('rec-watch').textContent.startsWith(tr('en', 'watchLicensed', {host})), 'Without services: generic Watch label');
      assert.equal(H0.fk('rec-access').textContent, tr('en', 'acc_licensed', {host}), 'Without services: generic access line');
      assert(H0.text().includes(L.en.licensedNote) && !H0.has('howto', H0.view()), 'Without services: generic note, no how-to box');
    }
    assert(!H0.has('about-lic'), 'Without services: no About summaries');
    await H0.navigate('guide');
    if (H0.byClass('legend').length) assert(!H0.byClass('lic-svcs').length, 'Without services: no legend summaries');
  } finally { useServices(H.payload); }
  ok(`licensed listings (${lic.length}): service names and needs on Watch labels, host chips, access lines, notes, filters and ` +
    `active filters (EN, HE); ?ag=licensed; legend and About summaries; how-to box on ${lic.filter(r => expectSvc(r)?.howTo).length} ` +
    'record pages and the episodes that watch on hoopla; generic labels without services data');
}
async function checkMasthead(H) {
  await H.navigate('browse');
  // No brand: no link, sign or caption in the markup, no caption string, and the header holds the views nav and the controls.
  assert(!H.ids.brand && !H.find(n => ['brand', 'sign', 'brand-cap'].some(c => H.cls(n).includes(c)), H.tree).length,
    'The masthead brand (sign and caption) is gone');
  assert(!('brandCaption' in L.en) && !('brandCaption' in L.he), 'No brand caption string');
  const header = H.find(n => n.tagName === 'header', H.tree)[0], mast = header.children.find(c => H.cls(c).includes('mast'));
  assert.deepEqual(mast.children.filter(c => c.tagName !== '#text').map(c => c.id), ['tabs', 'mast-tools'],
    'The masthead holds the views nav, then the control group');
  assert.deepEqual(H.$('mast-tools').children.filter(c => c.tagName !== '#text').map(c => c.id),
    ['surprise-btn', 'queue-btn', 'theme-picker', 'lang', 'lang-boot'],
    'The control group holds Surprise, the queue, the theme picker, then the language toggle (at the right edge), then the toggle\'s inline script');
  assert.equal(H.$('lang-boot').tagName, 'script', 'The language toggle is followed by its inline script');
  assert.equal(H.find(n => n.tagName === 'a' && n.href === '#/guide', header).length, 1, 'One link to the guide in the masthead: its tab');
  const opts = () => H.$('lang').children.filter(c => c.getAttribute && c.getAttribute('role') === 'radio');
  const expectToggle = (ui, where) => {
    const g = H.$('lang'), [en, he] = opts(), kids = g.children.filter(c => c.tagName !== '#text');
    assert(g.tagName === 'div' && g.getAttribute('role') === 'radiogroup' && g.getAttribute('dir') === 'ltr', where + ': a radiogroup laid out LTR');
    assert.equal(g.getAttribute('aria-label'), L[ui].langLabel, where + ': the group is named "' + L[ui].langLabel + '"');
    assert.equal(g.getAttribute('title'), L[ui].langLabel, where + ': its hint says what it does');
    assert.equal(opts().length, 2, where + ': two options');
    assert(en.getAttribute('lang') === 'en' && accName(en) === 'English' && he.getAttribute('lang') === 'he' && accName(he) === 'עברית' &&
      he.getAttribute('dir') === 'rtl', where + ': English first (left), עברית second, each named in its own language');
    for (const [o, short] of [[en, 'EN'], [he, 'עב']]) {
      assert(o.tagName === 'button' && o.type === 'button', where + ': options are buttons (Space and Enter click them)');
      assert.equal(H.byClass('lang-short', o)[0].textContent, short, where + ': visible short label ' + short);
      assert(accName(o).startsWith(short === 'EN' ? 'En' : short), where + ': the name starts with the visible label');
      const on = o.getAttribute('lang') === ui;
      assert.equal(o.getAttribute('aria-checked'), String(on), where + ': aria-checked on the ' + (on ? 'interface' : 'other') + ' language');
      assert.equal(o.getAttribute('tabindex'), on ? '0' : '-1', where + ': only the checked option is in the tab order');
    }
    // The thumb follows aria-checked through a sibling selector, so it comes after the options.
    assert(H.cls(kids.at(-1)).includes('lang-thumb') && kids.at(-1).getAttribute('aria-hidden') === 'true', where + ': the thumb follows the options');
    assert.equal(H.document.documentElement.lang, ui); assert.equal(H.document.documentElement.dir, ui === 'he' ? 'rtl' : 'ltr');
  };
  const other = ui => (ui === 'en' ? 'he' : 'en');
  for (const ui of ['en', 'he']) {
    if (H.document.documentElement.lang !== ui) await H.flipLang();
    expectToggle(ui, ui.toUpperCase());
    assert.equal(H.$('tabs').getAttribute('aria-label'), L[ui].navLabel, 'The views nav is named in ' + ui);
  }
  // Every way of switching flips the state, moves focus to the newly checked option and keeps the scroll position.
  let ui = H.document.documentElement.lang;
  const flipped = async (how, act) => {
    H.window.scrollY = 640; H.window.scrolls.length = 0;
    await act(); ui = other(ui);
    expectToggle(ui, how);
    assert.equal(H.document.activeElement, H.$('lang-' + ui), how + ': focus moves to the checked option');
    assert(H.window.scrollY === 640 && !H.window.scrolls.some(x => x.y !== 640), how + ': the page keeps its scroll position');
    assert.equal(H.storage.get('sumsum-language'), JSON.stringify(ui), how + ': the language is stored');
  };
  await flipped('click on the unchecked option', () => H.$('lang-' + other(ui)).dispatch('click'));
  // A radio group: activating the checked option (a click, or Space or Enter, which click a button) and a click on the rim
  // between the options change nothing: not the language, the focus, the stored value or the scroll position.
  for (const [how, act] of [['click on the checked option', () => H.$('lang-' + ui).dispatch('click')],
    ['Space or Enter on the checked option', () => H.$('lang-' + ui).dispatch('click', {detail: 0})],
    ['click on the checked option\'s label', () => H.byClass('lang-long', H.$('lang-' + ui))[0].dispatch('click')],
    ['click on the rim', () => H.$('lang').click()]]) {
    H.$('lang-' + ui).focus(); H.window.scrollY = 640; H.window.scrolls.length = 0;
    const stored = H.storage.get('sumsum-language'); await act();
    expectToggle(ui, how);
    assert.equal(H.document.activeElement, H.$('lang-' + ui), how + ': focus stays on the checked option');
    assert(H.window.scrollY === 640 && !H.window.scrolls.length, how + ': nothing re-renders or scrolls');
    assert.equal(H.storage.get('sumsum-language'), stored, how + ': the stored language is unchanged');
  }
  await flipped('click on the unchecked option\'s label', () => H.byClass('lang-short', H.$('lang-' + other(ui)))[0].dispatch('click'));
  for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']) {
    let prevented = false;
    await flipped(key, async () => { prevented = await H.document.activeElement.dispatch('keydown', {key}); });
    assert(prevented, key + ' does not also scroll the page');
  }
  for (const key of ['Tab', 'Home', 'a']) {
    const before = ui; await H.document.activeElement.dispatch('keydown', {key});
    assert.equal(H.document.documentElement.lang, before, key + ' does not switch the language');
  }
  if (H.document.documentElement.lang !== 'en') await H.flipLang();
  const aside = H.byClass('filters')[0];
  assert(H.cls(aside.children[0]).includes('search') && H.cls(aside.children[1]).includes('filters-toggle'),
    'Search precedes the Filters toggle in DOM (and visual) order');
  ok('masthead: no brand; language radiogroup named in the UI language, options named in their own language, aria-checked, ' +
    'one tab stop; the unchecked option (click, Space, Enter) and arrows switch, focus the checked option and keep the scroll ' +
    'position; the checked option and the rim change nothing; ' +
    'filter DOM order');
}

// The toggle's inline script (#lang-boot) checks the stored language before the application script, which comes after the
// embedded data, so a Hebrew page never first draws English checked and then slides the thumb over (review round 1). It makes
// the application's choice: data-start-lang, else the stored value; anything but Hebrew keeps the markup's English. The
// application then keeps the same state.
async function checkLangBoot(htmlPath) {
  const cases = [['stored Hebrew', {'sumsum-language': '"he"'}, {}, 'he'], ['stored English', {'sumsum-language': '"en"'}, {}, 'en'],
    ['nothing stored', {}, {}, 'en'], ['a stored unknown language', {'sumsum-language': '"fr"'}, {}, 'en'],
    ['a stored prototype key', {'sumsum-language': '"constructor"'}, {}, 'en'], ['broken JSON', {'sumsum-language': '{he'}, {}, 'en'],
    ['a bare unquoted he', {'sumsum-language': 'he'}, {}, 'en'],
    ['data-start-lang he', {'sumsum-language': '"en"'}, {'data-start-lang': 'he'}, 'he'],
    ['data-start-lang en over stored Hebrew', {'sumsum-language': '"he"'}, {'data-start-lang': 'en'}, 'en']];
  for (const [label, stored, htmlAttrs, want] of cases) {
    let early = null;
    const app = bootLight(htmlPath, {storage: new Map(Object.entries(stored)), htmlAttrs, onLangBoot: doc => {
      early = ['lang-en', 'lang-he'].map(id => [doc.getElementById(id).getAttribute('aria-checked'), doc.getElementById(id).getAttribute('tabindex')]);
    }});
    const expect = want === 'en' ? [['true', '0'], ['false', '-1']] : [['false', '-1'], ['true', '0']];
    assert.deepEqual(early, expect, `${label}: the toggle shows ${want} before the application starts`);
    const late = ['lang-en', 'lang-he'].map(id => [app.ids[id].getAttribute('aria-checked'), app.ids[id].getAttribute('tabindex')]);
    assert.deepEqual(late, expect, `${label}: the application keeps that state`);
    assert.equal(app.document.documentElement.lang, want, `${label}: the page language agrees`);
  }
  const noScript = bootLight(htmlPath, {storage: new Map([['sumsum-language', '"he"']]), noLangBoot: true});
  assert.equal(noScript.ids['lang-he'].getAttribute('aria-checked'), 'true', 'Without the inline script the application still checks Hebrew');
  ok(`language toggle before the first paint: #lang-boot checks the stored language (${cases.length} cases) and the application agrees`);
}

// ---------------------------------------------------------------- theme picker and preferences
// The preferences script applies the stored palette and appearance before the app starts (defaults: terracotta, System),
// reads a palette id from before 2026-10-18 as the palette that replaced it, falls back to the defaults for any other stored
// value, follows the system scheme only under System, and keeps the color-scheme meta in step. The picker is a disclosure
// (button: aria-expanded, aria-controls) holding two radio groups named by their visible headings, translated, with roving
// tabindex; arrows (mirrored in Hebrew), Home, End and clicks choose and store; Escape, an outside click, focus leaving and a
// route change close it; the choice persists across reloads.
const APP_KEY = {system: 'appSystem', light: 'appLight', dark: 'appDark'};
// The default palette: the bare :root rule and its swatch, PALETTES[0] in #prefs-boot and the first pal_* string.
const DEFAULT_PALETTE = 'terracotta';
// Palette ids before 2026-10-18 and the palette each became (RENAMED in #prefs-boot), so a stored choice survives the change.
const RENAMED_PALETTES = Object.freeze({green: 'sage', blue: 'sea', plum: 'kippi', sunny: 'stone', graphite: 'bauhaus'});
async function checkThemePicker(htmlPath) {
  const prefs = H => { const de = H.document.documentElement; return ['palette', 'appearance', 'scheme'].map(k => de.getAttribute('data-' + k)); };
  const metaScheme = H => H.$('meta-color-scheme').getAttribute('content');
  const booted = H => { assert(H.h1() && H.h1().textContent.trim(), 'The app renders'); return H; };
  let H = booted(harness(bootLight(htmlPath)));
  const P = [...H.window.sumsumTheme.palettes], A = [...H.window.sumsumTheme.appearances];
  assert.deepEqual(prefs(H), [DEFAULT_PALETTE, 'system', 'light'], `Defaults: ${DEFAULT_PALETTE} and System (here a light system scheme)`);
  assert.equal(metaScheme(H), 'light dark', 'Under System the page offers both schemes');
  const pals = () => H.$('tp-pal').children.filter(c => c.tagName !== '#text'), apps = () => H.$('tp-app').children.filter(c => c.tagName !== '#text');
  const open = () => !H.$('theme-pop').hidden;
  const expectPicker = (ui, where) => {
    const b = H.$('theme-btn'), [pal, app] = prefs(H);
    assert(b.tagName === 'button' && b.type === 'button', where + ': the theme control is a button (Enter and Space open it)');
    assert.equal(b.getAttribute('aria-label'), L[ui].themeLabel, where + ': the button is named "' + L[ui].themeLabel + '"');
    assert.equal(b.getAttribute('title'), L[ui].themeLabel, where + ': its hint says what it does');
    assert.equal(b.getAttribute('aria-controls'), 'theme-pop', where + ': it controls the popover');
    assert.equal(b.getAttribute('aria-expanded'), String(open()), where + ': aria-expanded follows the popover');
    assert(b.children.filter(c => c.tagName === 'svg').every(c => c.getAttribute('aria-hidden') === 'true'), where + ': the icon is hidden');
    assert.equal(H.$('tp-pal-h').textContent, L[ui].themeLabel, where + ': the palette group heading');
    assert.equal(H.$('tp-app-h').textContent, L[ui].appearanceLabel, where + ': the appearance group heading');
    assert.equal(H.byClass('tp-note', H.$('theme-pop'))[0].textContent, L[ui].themeNote, where + ': the note');
    for (const [g, h] of [['tp-pal', 'tp-pal-h'], ['tp-app', 'tp-app-h']]) {
      assert(H.$(g).getAttribute('role') === 'radiogroup' && H.$(g).getAttribute('aria-labelledby') === h, where + ': ' + g + ' is a radiogroup named by its heading');
    }
    assert.deepEqual(pals().map(o => o.getAttribute('data-value')), P, where + ': one option per palette, in order');
    assert.deepEqual(pals().map(accName), P.map(p => L[ui]['pal_' + p]), where + ': palette names in ' + ui);
    assert.deepEqual(apps().map(accName), A.map(a => L[ui][APP_KEY[a]]), where + ': appearance names in ' + ui);
    for (const [list, cur] of [[pals(), pal], [apps(), app]]) {
      for (const o of list) {
        const on = o.getAttribute('data-value') === cur;
        assert(o.tagName === 'button' && o.type === 'button' && o.getAttribute('role') === 'radio', where + ': options are radio buttons');
        assert.equal(o.getAttribute('aria-checked'), String(on), where + ': aria-checked on ' + o.getAttribute('data-value'));
        assert.equal(o.getAttribute('tabindex'), on ? '0' : '-1', where + ': only the checked option is in the tab order');
      }
    }
    for (const o of pals()) {
      const [sw, , ck] = o.children;
      assert(H.cls(sw).includes('tp-sw-' + o.getAttribute('data-value')) && sw.getAttribute('aria-hidden') === 'true' &&
        ck.getAttribute('aria-hidden') === 'true', where + ': each palette shows its own swatch and a hidden check mark');
    }
  };
  for (const ui of ['en', 'he']) {
    if (H.document.documentElement.lang !== ui) await H.flipLang();
    assert(!open(), ui + ': the popover starts closed'); expectPicker(ui, ui + ' closed');
    H.window.scrollY = 200; H.window.scrolls.length = 0; const hash = H.location.hash;
    await H.$('theme-btn').click();
    assert(open(), ui + ': the button opens the popover'); expectPicker(ui, ui + ' open');
    assert.equal(H.document.activeElement, H.$('tp-pal-' + prefs(H)[0]), ui + ': opening focuses the checked palette');
    const press = key => H.document.activeElement.dispatch('keydown', {key});
    const fwd = ui === 'he' ? 'ArrowLeft' : 'ArrowRight', back = ui === 'he' ? 'ArrowRight' : 'ArrowLeft';
    let i = P.indexOf(prefs(H)[0]);
    for (const [key, step] of [[fwd, 1], ['ArrowDown', 1], [back, -1], ['ArrowUp', -1], ['ArrowUp', -1], ['End', null], [fwd, 1], ['Home', 0], [back, -1]]) {
      const prevented = await press(key);
      i = step === null ? P.length - 1 : key === 'Home' ? 0 : (i + step + P.length) % P.length;
      assert(prevented, `${ui}: ${key} is prevented`);
      assert.equal(prefs(H)[0], P[i], `${ui}: ${key} chooses ${P[i]}`);
      assert.equal(H.document.activeElement, H.$('tp-pal-' + P[i]), `${ui}: focus moves with the choice (${key})`);
      assert.equal(H.storage.get('sumsum-theme'), JSON.stringify(P[i]), `${ui}: ${key} stores the palette`);
      expectPicker(ui, `${ui} ${key}`);
    }
    for (const key of ['a', 'PageDown', 'Tab']) {
      const before = prefs(H)[0]; await press(key);
      assert.equal(prefs(H)[0], before, `${ui}: ${key} does not choose`);
    }
    await H.$('tp-pal-kippi').click();
    assert(prefs(H)[0] === 'kippi' && H.document.activeElement === H.$('tp-pal-kippi') && H.storage.get('sumsum-theme') === '"kippi"',
      ui + ': a click chooses, focuses and stores a palette');
    // The appearance group: System, Light, Dark; data-scheme and the color-scheme meta follow.
    H.$('tp-app-' + prefs(H)[1]).focus();
    for (const [a, scheme, metaValue] of [['light', 'light', 'light'], ['dark', 'dark', 'dark'], ['system', 'light', 'light dark']]) {
      assert(await press(fwd), `${ui}: arrows move in the appearance group`);
      assert.deepEqual(prefs(H), ['kippi', a, scheme], `${ui}: the next appearance is ${a}`);
      assert.equal(metaScheme(H), metaValue, `${ui}: color-scheme meta under ${a}`);
      assert.equal(H.storage.get('sumsum-appearance'), JSON.stringify(a), `${ui}: the appearance is stored`);
      assert.equal(H.document.activeElement, H.$('tp-app-' + a)); expectPicker(ui, `${ui} appearance ${a}`);
    }
    H.media.set(true); assert.equal(prefs(H)[2], 'dark', ui + ': under System the page follows a switch to a dark system scheme');
    H.media.set(false); assert.equal(prefs(H)[2], 'light', ui + ': and back to light');
    await H.$('tp-app-dark').click(); H.media.set(false);
    assert.equal(prefs(H)[2], 'dark', ui + ': an explicit Dark ignores the system scheme');
    H.media.set(true); await H.$('tp-app-light').click();
    assert.equal(prefs(H)[2], 'light', ui + ': an explicit Light ignores a dark system scheme'); H.media.set(false);
    assert(H.window.scrollY === 200 && !H.window.scrolls.length && H.location.hash === hash, ui + ': choosing keeps the scroll position and the route');
    // Closing: Escape inside returns focus to the button; Escape on the button keeps it there; a click on the button,
    // an outside click, Escape elsewhere, focus leaving and a route change close it. A click inside keeps it open.
    assert(await press('Escape') && !open() && H.document.activeElement === H.$('theme-btn'), ui + ': Escape closes and returns focus to the button');
    expectPicker(ui, ui + ' after Escape');
    assert(await H.$('theme-btn').dispatch('keydown', {key: 'ArrowDown'}) && open() && H.document.activeElement === H.$('tp-pal-kippi'),
      ui + ': ArrowDown on the button opens it on the checked palette');
    H.$('theme-btn').focus(); await H.$('theme-btn').dispatch('keydown', {key: 'Escape'});
    assert(!open() && H.document.activeElement === H.$('theme-btn'), ui + ': Escape on the button closes it');
    await H.$('theme-btn').click(); await H.$('theme-btn').click(); assert(!open(), ui + ': the button toggles the popover');
    await H.$('theme-btn').click(); await H.$('tp-pal-sea').dispatch('click');
    assert(open() && prefs(H)[0] === 'sea', ui + ': a click inside chooses and keeps the popover open');
    await H.view().dispatch('click'); assert(!open(), ui + ': an outside click closes it');
    await H.$('theme-btn').click(); await H.view().dispatch('keydown', {key: 'Escape'}); assert(!open(), ui + ': Escape elsewhere closes it');
    await H.$('theme-btn').click();
    await H.$('tp-pal-sea').dispatch('focusout', {relatedTarget: H.$('tp-app-light')}); assert(open(), ui + ': focus moving inside keeps it open');
    await H.$('tp-pal-sea').dispatch('focusout', {relatedTarget: null}); assert(open(), ui + ': focus going nowhere keeps it open');
    await H.$('tp-pal-sea').dispatch('focusout', {relatedTarget: H.$('lang-en')}); assert(!open(), ui + ': focus leaving the control closes it');
    await H.$('theme-btn').click(); await H.navigate(ui === 'en' ? 'starred' : 'browse'); assert(!open(), ui + ': a route change closes it');
    // The masthead's ids are unique on a page with the filters (whose theme select is #theme).
    const ids = H.find(n => n.getAttribute && n.getAttribute('id') !== undefined, H.tree).map(n => n.getAttribute('id'));
    for (const id of ['theme-picker', 'theme-btn', 'theme-pop', 'tp-pal', 'tp-app', 'tp-pal-h', 'tp-app-h', ...P.map(p => 'tp-pal-' + p), ...A.map(a => 'tp-app-' + a)]) {
      assert.equal(ids.filter(x => x === id).length, 1, ui + ': one element has the id ' + id);
    }
    expectPicker(ui, ui + ' closed again');
    await H.$('tp-pal-' + DEFAULT_PALETTE).click(); await H.$('tp-app-system').click();
  }
  if (H.document.documentElement.lang !== 'en') await H.flipLang();
  // Persistence: a reload with the same storage applies the stored choice before the app starts (a palette other than the
  // default, so that nothing stored would fail).
  const storage = H.storage;
  await H.$('tp-pal-sage').click(); await H.$('tp-app-dark').click();
  H = booted(harness(bootLight(htmlPath, {storage})));
  assert.deepEqual(prefs(H), ['sage', 'dark', 'dark'], 'The palette and the appearance persist across reloads');
  assert(H.$('tp-pal-sage').getAttribute('aria-checked') === 'true' && H.$('tp-app-dark').getAttribute('aria-checked') === 'true',
    'The picker shows the stored choice');
  assert.equal(metaScheme(H), 'dark');
  // Start attributes take the place of the stored values (an invalid one gives the default, not the stored value).
  H = booted(harness(bootLight(htmlPath, {storage, htmlAttrs: {'data-start-palette': 'stone', 'data-start-appearance': 'light'}})));
  assert.deepEqual(prefs(H), ['stone', 'light', 'light'], 'data-start-palette and data-start-appearance win over storage');
  H = booted(harness(bootLight(htmlPath, {storage, htmlAttrs: {'data-start-palette': 'constructor', 'data-start-appearance': '__proto__'}})));
  assert.deepEqual(prefs(H), [DEFAULT_PALETTE, 'system', 'light'], 'An invalid start attribute gives the default');
  // The system scheme, with and without matchMedia.
  assert.deepEqual(prefs(booted(harness(bootLight(htmlPath, {prefersDark: true})))), [DEFAULT_PALETTE, 'system', 'dark'], 'System follows a dark system scheme at start');
  assert.deepEqual(prefs(booted(harness(bootLight(htmlPath, {prefersDark: true, noMatchMedia: true})))), [DEFAULT_PALETTE, 'system', 'light'],
    'Without matchMedia, System is light');
  // Hostile or broken stored values fall back to the defaults and the app still starts; an old id that is not exactly one
  // ('GREEN', 'blue ', one inside an object or an array) is not migrated.
  const hostile = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', 'GREEN', 'Dark', 'dark', 'blue ', 'olive', 'system'].map(v => JSON.stringify(v))
    .concat(['{', 'undefined', '42', '{}', '[]', 'null', '"', 'true', '{"__proto__":"blue"}', '["blue"]']);
  for (const raw of hostile) {
    const h = booted(harness(bootLight(htmlPath, {storage: new Map([['sumsum-theme', raw], ['sumsum-appearance', raw === '"system"' ? '"blue"' : raw]])})));
    const [pal, app] = prefs(h);
    assert.equal(pal, DEFAULT_PALETTE, `A stored palette ${raw} falls back to ${DEFAULT_PALETTE}`);
    assert.equal(app, raw === '"dark"' ? 'dark' : 'system', `A stored appearance ${raw} falls back to System unless it is one`);
    assert(h.$('tp-pal-' + DEFAULT_PALETTE).getAttribute('aria-checked') === 'true', `The picker marks ${DEFAULT_PALETTE} after a stored ${raw}`);
  }
  // Migration: a stored id from before 2026-10-18 boots into the palette that replaced it, which the picker marks, and is read
  // only: storage keeps the old id until the next choice. data-start-palette is read the same way. A stored default stays.
  const migrated = Object.entries(RENAMED_PALETTES);
  for (const [old, now] of migrated) {
    assert(!P.includes(old) && P.includes(now) && now !== DEFAULT_PALETTE, `"${old}" is an old id and ${now} a palette other than the default`);
    const st = new Map([['sumsum-theme', JSON.stringify(old)], ['sumsum-appearance', '"dark"']]), h = booted(harness(bootLight(htmlPath, {storage: st})));
    assert.deepEqual(prefs(h), [now, 'dark', 'dark'], `A stored "${old}" boots into ${now}`);
    assert(h.$('tp-pal-' + now).getAttribute('aria-checked') === 'true' && h.$('tp-pal-' + DEFAULT_PALETTE).getAttribute('aria-checked') === 'false',
      `The picker marks ${now} after a stored "${old}"`);
    assert.equal(st.get('sumsum-theme'), JSON.stringify(old), `A stored "${old}" stays in storage until the next choice`);
    assert.equal(prefs(booted(harness(bootLight(htmlPath, {htmlAttrs: {'data-start-palette': old}}))))[0], now, `data-start-palette="${old}" gives ${now}`);
  }
  {
    const st = new Map([['sumsum-theme', JSON.stringify(DEFAULT_PALETTE)]]);
    assert.equal(prefs(booted(harness(bootLight(htmlPath, {storage: st}))))[0], DEFAULT_PALETTE, 'A stored default stays');
    st.set('sumsum-theme', JSON.stringify(migrated[0][0]));
    const h = booted(harness(bootLight(htmlPath, {storage: st})));
    await h.$('theme-btn').click(); await h.$('tp-pal-kippi').click();
    assert.equal(st.get('sumsum-theme'), '"kippi"', 'A choice after a migrated boot stores the new id');
    assert.equal(prefs(booted(harness(bootLight(htmlPath, {storage: st}))))[0], 'kippi', 'and the next boot keeps it');
  }
  // Without the preferences script the control is hidden and the default palette stays.
  H = booted(harness(bootLight(htmlPath, {noBoot: true})));
  assert(H.$('theme-picker').hidden && !H.document.documentElement.getAttribute('data-palette'), 'Without the preferences script the theme control is hidden');
  ok(`theme picker: defaults (${DEFAULT_PALETTE}, System), the system scheme and its changes, color-scheme meta; button and radio groups named ` +
    'in EN and HE, roving tabindex, arrows (mirrored in Hebrew), Home, End and clicks choose and store; Escape returns focus; outside ' +
    'click, Escape elsewhere, focus leaving and route change close; persistence, start attributes, hostile stored values ' +
    `(${hostile.length}), old palette ids read as their new palettes (${migrated.map(([o, n]) => o + ' to ' + n).join(', ')}) and a build without the script`);
}

// ---------------------------------------------------------------- Browse menu and its pages
const MENU = ['identified', 'unidentified', 'missing'];
// The independent model's counts: identified uploads are neither queued nor linked only as a possible copy; the uploads to
// identify are the rest; missing episodes are the documented episodes without a whole copy.
function menuModel(M) {
  const waiting = M.records.filter(r => ['queue', 'possible'].includes(M.guideStatus(r)));
  const waitingIds = new Set(waiting.map(r => r.id));
  return {waitingIds, identifiedIds: new Set(M.records.filter(r => !waitingIds.has(r.id)).map(r => r.id)),
    counts: {identified: M.records.length - waiting.length, unidentified: waiting.length,
      missing: M.eps.filter(e => M.cov(e) !== 'whole-candidate').length}};
}
// ---------------------------------------------------------------- Home, the queue and Surprise
// The recorded spoken language and length, as the app reads them (Browse's facets and Home's preferences).
const spokenOfM = r => {
  const parts = String(r.language ?? '').toLowerCase().split(/[^a-z]+/).filter(x => x && x !== 'und');
  return parts.length ? [...new Set(parts.map(x => (x === 'he' || x === 'en' ? x : 'other')))] : ['none'];
};
const lenOkM = (r, n) => !n || (Number(r.durationSeconds) > 0 && Number(r.durationSeconds) <= Number(n) * 60);
const tagKeyM = v => normalizeQ((NAMES[String(v).toLowerCase()] || NAMES[normalizeQ(v)] || [v])[0]);
async function checkHome(htmlPath, M) {
  const H = harness(boot(htmlPath, {htmlAttrs: {'data-start-seed': '11'}})), {records} = M, keyOf = r => r.id || r.url;
  const byId = new Map(records.map(r => [r.id, r]));
  assert.equal(H.location.hash, '#/home', 'Home is the start view');
  const prefs = () => ({spoken: JSON.parse(H.storage.get('sumsum-spoken') || '"all"'), len: JSON.parse(H.storage.get('sumsum-length') || '""')});
  const prefOk = r => { const p = prefs(); return (p.spoken === 'all' || spokenOfM(r).includes(p.spoken)) && lenOkM(r, p.len); };
  const pickable = r => offerable(r) && prefOk(r);
  // Home's cards are entries; each shows its first member (in link order) that the shelf or Surprise offers.
  const enById = new Map(M.entries.map(en => [en.id, en]));
  const isMusic = r => (r.themes || []).some(t => tagKeyM(t) === tagKeyM('music')), musicPick = r => isMusic(r) && pickable(r);
  const cardEn = (n, prefix) => enById.get(n.getAttribute('data-fk').slice(prefix.length));
  const cardRec = (n, prefix, ok = pickable) => M.shownOf(cardEn(n, prefix), ok);
  // A card's entry and the member it queues: [entry, record].
  const cardPair = (n, prefix, ok) => { const en = cardEn(n, prefix); return Object.assign(M.shownOf(en, ok), {en}); };
  const shelfCards = id => H.find(n => (n.getAttribute?.('data-fk') || '').startsWith('s' + id + '-card-'));
  // Preferences: stored, pressed, applied to Home; a Browse hash never changes them.
  assert.equal(H.fk('pref-spoken-all').getAttribute('aria-pressed'), 'true'); assert.equal(H.fk('pref-len-any').getAttribute('aria-pressed'), 'true');
  await H.fk('pref-len-5').click();
  assert.equal(H.storage.get('sumsum-length'), '"5"', 'Length is stored');
  assert.equal(H.fk('pref-len-5').getAttribute('aria-pressed'), 'true');
  const music = shelfCards('music');
  assert(music.length && music.every(a => musicPick(cardRec(a, 'smusic-card-', musicPick))),
    'The music shelf holds entries shown through an offered music video within the preferences');
  assert.equal(H.fk('see-music').href, '#/browse?theme=' + encodeURIComponent(tagKeyM('music')) + '&len=5', 'See all opens the same query in Browse');
  assert.equal(H.number(H.fk('see-music').textContent), M.countE(r => isMusic(r) && prefOk(r)), 'See all counts what Browse will show');
  await H.navigate('browse?len=10'); assert.equal(H.storage.get('sumsum-length'), '"5"', 'A Browse hash does not change the Home preference');
  await H.navigate('home');
  await H.fk('pref-spoken-en').click(); assert.equal(H.storage.get('sumsum-spoken'), '"en"');
  const hero = H.fk('next-watch'), heroRec = records.find(r => expectDest(r) === hero.href && pickable(r));
  assert(heroRec, 'Up next offers an offered video within the preferences: ' + hero.href);
  await H.fk('pref-spoken-all').click(); await H.fk('pref-len-any').click();
  assert.deepEqual(prefs(), {spoken: 'all', len: ''});
  // The characters: twelve, ranked by entries in the Spoken language; under All the Hebrew side (everything not English-only)
  // and the English side take turns. Each opens Browse filtered by that character, with its count within the preferences.
  const sideOfM = r => (spokenOfM(r).includes('en') && !spokenOfM(r).includes('he') ? 'en' : 'he');
  const charRankM = keep => {
    const m = new Map();
    for (const en of M.entries) for (const k of new Set(en.members.filter(keep).flatMap(r => (r.characters || []).map(tagKeyM)))) m.set(k, (m.get(k) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
  };
  const alternateM = (lists, max) => {
    const out = [];
    for (let i = 0; out.length < max && lists.some(l => i < l.length); i++) for (const l of lists) if (l[i] && !out.includes(l[i]) && out.length < max) out.push(l[i]);
    return out;
  };
  const tokKeys = () => H.find(n => (n.getAttribute?.('data-fk') || '').startsWith('tok-')).map(a => a.getAttribute('data-fk').slice(4));
  assert.deepEqual(tokKeys(), alternateM([charRankM(r => sideOfM(r) === 'he'), charRankM(r => sideOfM(r) === 'en')], 12),
    'Under All, the Hebrew and English character rankings take turns');
  for (const g of ['he', 'en']) {
    await H.fk('pref-spoken-' + g).click();
    assert.deepEqual(tokKeys(), charRankM(r => spokenOfM(r).includes(g)).slice(0, 12), 'The character row follows Spoken: ' + g);
  }
  await H.fk('pref-spoken-all').click();
  const tokens = H.find(n => (n.getAttribute?.('data-fk') || '').startsWith('tok-'));
  const charN = new Map();
  for (const en of M.entries) for (const k of new Set(en.members.flatMap(r => (r.characters || []).map(tagKeyM)))) charN.set(k, (charN.get(k) || 0) + 1);
  assert.equal(tokens.length, Math.min(12, charN.size), 'Twelve characters (or all there are)');
  for (const a of tokens) {
    const k = a.getAttribute('data-fk').slice(4);
    assert.equal(a.href, '#/browse?character=' + encodeURIComponent(k), 'A character opens Browse filtered by it: ' + k);
    assert.equal(H.number(H.byClass('tok-n', a)[0].textContent), charN.get(k), 'Character count: ' + k);
  }
  await tokens[0].click(); assert.equal(H.count(), charN.get(tokens[0].getAttribute('data-fk').slice(4)), 'Browse shows the character\'s videos');
  await H.navigate('home');
  // The queue: "+" adds, the masthead counts, rows move and go, Clear can be undone, Open next opens the first and removes it.
  const [c1, c2, c3] = shelfCards('music').slice(0, 3).map(a => cardPair(a, 'smusic-card-', musicPick));
  for (const r of [c1, c2, c3]) { await H.fk('smusic-q-' + r.en.id).click(); H.flushTimers(); }
  assert.deepEqual(JSON.parse(H.storage.get('sumsum-sitting')), [c1, c2, c3].map(keyOf), 'Queued in order');
  assert.equal(H.$('queue-btn').getAttribute('aria-label'), tr('en', 'queueN', {n: '3'}), 'The masthead counts the queue');
  assert.equal(H.fk('smusic-q-' + c1.en.id).getAttribute('aria-pressed'), 'true', 'A queued card\'s + is pressed');
  await H.fk('home-down-' + c1.id).click(); H.flushTimers();
  assert.deepEqual(JSON.parse(H.storage.get('sumsum-sitting')), [c2, c1, c3].map(keyOf), 'Move down');
  assert.equal(H.document.activeElement.getAttribute('data-fk'), 'home-down-' + c1.id, 'Focus stays on the moved row\'s control');
  await H.fk('home-up-' + c1.id).click(); H.flushTimers();
  assert.deepEqual(JSON.parse(H.storage.get('sumsum-sitting')), [c1, c2, c3].map(keyOf), 'Move up');
  await H.fk('home-rm-' + c3.id).click(); H.flushTimers();
  assert.deepEqual(JSON.parse(H.storage.get('sumsum-sitting')), [c1, c2].map(keyOf), 'Remove');
  await H.fk('home-clear').click(); H.flushTimers();
  assert.deepEqual(JSON.parse(H.storage.get('sumsum-sitting')), [], 'Clear');
  await H.fk('home-undo').click(); H.flushTimers();
  assert.deepEqual(JSON.parse(H.storage.get('sumsum-sitting')), [c1, c2].map(keyOf), 'Undo brings the queue back');
  // Focus after a change removes the focused control: a moved-to-the-end row's other arrow, the neighbouring row, Undo after
  // Clear, Open next after Undo, the queue heading when it empties.
  H.fk('home-down-' + c1.id).focus(); await H.fk('home-down-' + c1.id).click(); H.flushTimers();
  assert.equal(H.document.activeElement.getAttribute('data-fk'), 'home-up-' + c1.id, 'A row moved to the end keeps focus on its other arrow');
  H.fk('home-up-' + c1.id).focus(); await H.fk('home-up-' + c1.id).click(); H.flushTimers();
  H.fk('home-clear').focus(); await H.fk('home-clear').click(); H.flushTimers();
  assert.equal(H.document.activeElement.getAttribute('data-fk'), 'home-undo', 'Clear moves focus to Undo');
  await H.fk('home-undo').click(); H.flushTimers();
  assert.equal(H.document.activeElement.getAttribute('data-fk'), 'home-open', 'Undo moves focus to Open next');
  assert.deepEqual(JSON.parse(H.storage.get('sumsum-sitting')), [c1, c2].map(keyOf));
  const open = H.fk('home-open');
  assert.equal(open.href, expectDest(c1), 'Open next links the first video');
  assert(open.target === '_blank' && /noopener/.test(open.rel), 'in a new tab');
  await open.click(); assert(open.isConnected, 'The Open next link is still in the page after its click');
  H.flushTimers();
  assert.deepEqual(JSON.parse(H.storage.get('sumsum-sitting')), [keyOf(c2)], 'Open next takes the first video off the queue');
  assert.equal(JSON.parse(H.storage.get('sumsum-opened'))[keyOf(c1)].n, 1, 'and counts an open');
  // Opening the last queued video moves focus to the queue heading.
  H.fk('home-open').focus(); await H.fk('home-open').click(); H.flushTimers();
  assert.deepEqual(JSON.parse(H.storage.get('sumsum-sitting')), [], 'The last video leaves the queue');
  assert.equal(H.document.activeElement.getAttribute('data-fk'), 'home-qh', 'and focus moves to the queue heading');
  await H.fk('smusic-q-' + c2.en.id).click(); H.flushTimers();
  // Again: the opened entry, with its count, reopening the member opened; the hero offers it again when Up next is something else.
  assert(H.has('ag-w-' + c1.en.id) && H.fk('ag-w-' + c1.en.id).href === expectDest(c1), 'Again lists the opened entry and reopens the member opened');
  assert(H.byClass('again')[0].textContent.includes('×1'), 'with how often it was opened');
  if (H.fk('next-watch').href !== expectDest(c2)) assert.equal(H.fk('again-hero').href, expectDest(c2), 'The hero offers the last video opened again');
  await H.fk('ag-w-' + c1.en.id).click(); H.flushTimers();
  assert.equal(JSON.parse(H.storage.get('sumsum-opened'))[keyOf(c1)].n, 2, 'Again counts another open');
  // Stickers: ×N for opens; ✓ only on a video that is the one whole or alternate copy of a watched episode.
  const soloRec = records.find(r => (M.recLinks.get(r.id) || []).length === 1 && M.recLinks.get(r.id)[0].role === 'whole-candidate');
  const solo = soloRec && M.recLinks.get(soloRec.id)[0].e;
  // A part of a watched episode never shows it.
  const partRec = records.find(r => (M.recLinks.get(r.id) || []).length === 1 && M.recLinks.get(r.id)[0].role === 'part');
  if (solo) {
    const r = soloRec;
    await H.navigate('record/' + encodeURIComponent(r.id)); await H.fk('rec-star').click();
    await H.navigate('episode/' + encodeURIComponent(solo.id)); await H.fk('watch-toggle').click();
    await H.navigate('home');
    const cardOf = rid => H.fk('sstarred-card-' + M.entryOf.get(rid).id).parentElement.parentElement.parentElement;
    assert.equal(H.byClass('s-seen', cardOf(r.id)).length, 1, 'The ✓ sticker shows on the watched episode\'s entry');
    if (partRec) {
      const pe = M.recLinks.get(partRec.id)[0].e;
      await H.navigate('record/' + encodeURIComponent(partRec.id)); await H.fk('rec-star').click();
      if (pe.id !== solo.id) { await H.navigate('episode/' + encodeURIComponent(pe.id)); await H.fk('watch-toggle').click(); }
      await H.navigate('home');
      // A part is a copy of its episode's entry, so the entry shows the episode's mark.
      assert.equal(H.byClass('s-seen', cardOf(partRec.id)).length, M.entryOf.get(partRec.id).e ? 1 : 0, 'A part\'s entry shows its episode\'s ✓');
      if (pe.id !== solo.id) { await H.navigate('episode/' + encodeURIComponent(pe.id)); await H.fk('watch-toggle').click(); }
      await H.navigate('record/' + encodeURIComponent(partRec.id)); await H.fk('rec-star').click();
    }
    await H.navigate('episode/' + encodeURIComponent(solo.id)); await H.fk('watch-toggle').click();
    await H.navigate('record/' + encodeURIComponent(r.id)); await H.fk('rec-star').click();
  }
  // Surprise: a popover named and focused, holding an offered video; Another, Previous; Escape, outside clicks and route
  // changes close it and focus returns to its button.
  await H.navigate('home');
  const sb = H.$('surprise-btn'), pop = H.$('surprise-pop');
  await sb.click();
  assert(!pop.hidden && sb.getAttribute('aria-expanded') === 'true' && pop.getAttribute('role') === 'dialog' &&
    pop.getAttribute('aria-labelledby') === 'surprise-h' && H.document.activeElement === H.$('surprise-h'), 'Surprise opens, named and focused');
  const picked = () => { const a = H.find(n => (n.getAttribute?.('data-fk') || '').startsWith('sp-card-'), pop)[0]; return a && cardEn(a, 'sp-card-'); };
  const seenPicks = [];
  for (let k = 0; k < 25; k++) {
    const r = picked(); assert(r && pickable(M.shownOf(r, pickable)), 'Surprise picks an entry with an offered video within the preferences: ' + (r && r.id)); seenPicks.push(r);
    // A bubbling click, as in a browser: Another redraws the card during its own click and must not count as an outside click.
    if (k < 24) { await H.fk('sp-another').dispatch('click'); assert(!pop.hidden, 'Another keeps Surprise open'); }
  }
  assert(new Set(seenPicks).size > 1, 'Another picks again');
  await H.fk('sp-prev').dispatch('click'); assert(!pop.hidden && picked() === seenPicks.at(-2), 'Previous goes back, and Surprise stays open');
  await H.document.activeElement.dispatch('keydown', {key: 'Escape'});
  assert(pop.hidden && sb.getAttribute('aria-expanded') === 'false' && H.document.activeElement === sb, 'Escape closes it and focus returns');
  await sb.click(); await H.$('view').dispatch('click');
  assert(pop.hidden && H.document.activeElement === sb, 'A click on nothing in particular closes it and returns focus to its button');
  await sb.click(); H.fk('tab-home').focus(); await H.fk('tab-home').dispatch('click', {button: 1});
  assert(pop.hidden && H.document.activeElement === H.fk('tab-home'), 'A click on another control closes it and keeps that control\'s focus');
  await sb.click(); await H.navigate('browse'); assert(pop.hidden, 'A route change closes it');
  // The star inside the Surprise card: the popover stays open with focus on the star.
  await H.navigate('home'); await sb.click();
  { const r = picked(), st = () => H.fk('sp-star-' + r.id); st().focus(); await st().dispatch('click'); H.flushTimers();
    assert(!pop.hidden && picked() === r && st().getAttribute('aria-pressed') === 'true' && H.document.activeElement === st(),
      'Starring a Surprise pick keeps it open, pressed and focused');
    await st().click(); await H.fk('surprise-close').click(); }
  // "+" inside the Surprise card queues the pick in place: the popover stays open and the button shows it.
  await H.navigate('home'); await sb.click();
  const pr = picked(), qb = () => H.fk('sp-q-' + pr.id), wasQ = JSON.parse(H.storage.get('sumsum-sitting') || '[]').some(k => pr.members.some(m => keyOf(m) === k));
  await qb().dispatch('click'); H.flushTimers();
  assert(!pop.hidden && picked() === pr && qb().getAttribute('aria-pressed') === String(!wasQ), 'Queueing from Surprise keeps it open and updates its +');
  await qb().click(); H.flushTimers(); await H.fk('surprise-close').click();
  // A shuffled shelf keeps its order when Home is drawn again (a star or the queue), until the next shuffle.
  const order = () => shelfCards('music').map(a => a.getAttribute('data-fk'));
  await H.fk('shuf-music').click(); const shuffledOrder = order();
  await H.fk('smusic-q-' + cardEn(shelfCards('music')[0], 'smusic-card-').id).click(); H.flushTimers();
  assert.deepEqual(order(), shuffledOrder, 'A queue change does not reshuffle the shelf');
  await H.fk('smusic-q-' + cardEn(shelfCards('music')[0], 'smusic-card-').id).click(); H.flushTimers();
  // On Browse it picks from the list on screen.
  const cls = 'classic';
  await H.navigate('browse?series=' + cls);
  await sb.click();
  for (let k = 0; k < 10; k++) {
    const en = picked(), r = en && M.shownOf(en, x => offerable(x) && x.series === cls);
    assert(r && r.series === cls && offerable(r), 'On Browse, Surprise picks from the filtered list'); await H.fk('sp-another').click();
  }
  // A Surprise pick that is also a card on screen: starring either shows on both.
  {
    for (let k = 0; k < 200 && !H.has('star-' + picked().id); k++) await H.fk('sp-another').dispatch('click');
    const r = picked(), card = () => H.fk('star-' + r.id), inPop = () => H.fk('sp-star-' + r.id);
    assert(H.has('star-' + r.id), 'Surprise picked a video shown on the page');
    {
      const was = card().getAttribute('aria-pressed');
      await inPop().dispatch('click'); H.flushTimers();
      assert(!pop.hidden && inPop().getAttribute('aria-pressed') !== was && card().getAttribute('aria-pressed') === inPop().getAttribute('aria-pressed'),
        'Starring a Surprise pick updates the same video\'s card star');
      await inPop().dispatch('click'); H.flushTimers();
      assert.equal(card().getAttribute('aria-pressed'), was, 'and unstarring it too');
    }
  }
  await H.fk('surprise-close').click(); assert(pop.hidden && H.document.activeElement === sb, 'The close button closes it');
  const kippi = [...charN].find(([k]) => /kippi/.test(k));
  if (kippi) {
    await H.navigate('browse?character=' + encodeURIComponent(kippi[0])); await sb.click();
    assert(H.$('surprise-h').textContent.endsWith(tr('en', 'charPicks', {name: ''}).trim()) || H.$('surprise-h').textContent.includes('Kippi'),
      'With a character chosen, the character picks');
    await H.fk('surprise-close').click();
  }
  // The parts train: one car per numbered part with a link, in part order; a car opens its part and counts an open, and a car
  // you opened says so (yours, not evidence).
  const trainEp = M.eps.find(e => M.partsOf(e).filter(x => expectDest(x.u.r)).length >= 2);
  if (trainEp) {
    await H.navigate('episode/' + encodeURIComponent(trainEp.id));
    const ps = M.partsOf(trainEp).filter(x => expectDest(x.u.r)), cars = H.find(n => (n.getAttribute?.('data-fk') || '').startsWith('car-'));
    assert.deepEqual(cars.map(c => c.href), ps.map(x => expectDest(x.u.r)), 'The train has a car per part, in order');
    assert.deepEqual(cars.map(c => H.byClass('car-no', c)[0].textContent), ps.map(x => String(x.no)), 'Each car shows its part number');
    assert(cars.every((c, k) => c.getAttribute('aria-label').includes(tr('en', 'partOf', {i: String(ps[k].no), n: String(ps[k].of)}))),
      'Each car is named by its part');
    const r0 = ps[0].u.r, n0 = (JSON.parse(H.storage.get('sumsum-opened') || '{}')[keyOf(r0)] || {n: 0}).n;
    await cars[0].click(); H.flushTimers();
    assert.equal(JSON.parse(H.storage.get('sumsum-opened'))[keyOf(r0)].n, n0 + 1, 'A car counts an open');
    const c0 = H.fk('car-' + r0.id);
    assert(H.cls(c0).includes('opened') && c0.getAttribute('aria-label').includes(', ' + L.en.openedCar + ' ('), 'An opened car says so');
  }
  // Removing the focused row moves focus to its neighbour, and the last one to the queue heading.
  await H.navigate('home');
  if (H.has('home-clear')) { await H.fk('home-clear').click(); H.flushTimers(); }
  const [d1, d2] = shelfCards('music').slice(0, 2).map(a => cardPair(a, 'smusic-card-', musicPick));
  await H.fk('smusic-q-' + d1.en.id).click(); H.flushTimers(); await H.fk('smusic-q-' + d2.en.id).click(); H.flushTimers();
  H.fk('home-rm-' + d1.id).focus(); await H.fk('home-rm-' + d1.id).click(); H.flushTimers();
  assert.equal(H.document.activeElement.getAttribute('data-fk'), 'home-rm-' + d2.id, 'Removing a row focuses the next one');
  await H.fk('home-rm-' + d2.id).click(); H.flushTimers();
  assert.equal(H.document.activeElement.getAttribute('data-fk'), 'home-qh', 'Removing the last row focuses the queue heading');
  await H.fk('smusic-q-' + d1.en.id).click(); H.flushTimers();
  // Surprise opened from the phone bar stays bound to its button when Home is drawn again.
  await H.fk('tab-surprise').click();
  const p2 = picked(); await H.fk('sp-q-' + p2.id).click(); H.flushTimers();
  assert(!pop.hidden && H.fk('tab-surprise').getAttribute('aria-expanded') === 'true', 'The redrawn phone Surprise button still shows it is open');
  await H.document.activeElement.dispatch('keydown', {key: 'Escape'});
  assert(pop.hidden && H.document.activeElement === H.fk('tab-surprise'), 'Escape returns focus to the redrawn phone button');
  await H.fk('home-rm-' + p2.id).click(); H.flushTimers();
  // The queue opened from the phone bar: when the last video goes, the bar goes, and focus returns to the masthead's Queue button.
  if (!H.has('qbar-more')) { await H.fk('smusic-q-' + shelfCards('music').map(a => cardRec(a, 'smusic-card-'))[0].id).click(); H.flushTimers(); }
  await H.fk('qbar-more').click();
  assert(!H.$('queue-pop').hidden, 'The phone bar opens the queue');
  await H.fk('qp-clear').dispatch('click'); H.flushTimers();
  assert(!H.$('queue-pop').hidden && H.$('queue-btn').getAttribute('aria-expanded') === 'true', 'The popover stays open, now bound to the Queue button');
  await H.document.activeElement.dispatch('keydown', {key: 'Escape'});
  assert(H.$('queue-pop').hidden && H.document.activeElement === H.$('queue-btn'), 'Escape returns focus to the Queue button');
  await H.$('queue-btn').click(); await H.fk('qp-undo').dispatch('click'); H.flushTimers();
  await H.document.activeElement.dispatch('keydown', {key: 'Escape'});
  // In the queue popover, removing or opening the last video moves focus to the popover's own (visible) heading.
  for (const how of ['rm', 'open']) {
    if (H.has('home-clear')) { await H.fk('home-clear').click(); H.flushTimers(); }
    const v = cardRec(shelfCards('music')[0], 'smusic-card-');
    await H.fk('smusic-q-' + v.id).click(); H.flushTimers();
    await H.$('queue-btn').click();
    const ctl = H.fk(how === 'rm' ? 'qp-rm-' + v.id : 'qp-open'); ctl.focus(); await ctl.dispatch('click'); H.flushTimers();
    assert(!H.$('queue-pop').hidden && H.document.activeElement === H.$('qp-h'), 'The last video ' + (how === 'rm' ? 'removed' : 'opened') +
      ' in the queue popover: focus on its heading');
    await H.document.activeElement.dispatch('keydown', {key: 'Escape'});
  }
  await H.fk('smusic-q-' + d1.en.id).click(); H.flushTimers();
  // The queue popover from the masthead holds the same queue.
  await H.$('queue-btn').click();
  assert(!H.$('queue-pop').hidden && H.has('qp-open') && H.fk('qp-open').href === expectDest(d1), 'The queue popover offers the next video');
  await H.document.activeElement.dispatch('keydown', {key: 'Escape'}); assert(H.$('queue-pop').hidden);
  // Unstarring a card from the Starred shelf hands focus to its neighbour's star, and the last one to the page heading. On
  // Starred, Surprise picks only what is still starred.
  {
    const st = new Map([['sumsum-favorites', JSON.stringify([c1, c3].map(keyOf))]]), H3 = harness(boot(htmlPath, {storage: st}));
    const first = H3.find(n => (n.getAttribute?.('data-fk') || '').startsWith('sstarred-star-')).map(n => n.getAttribute('data-fk'));
    assert.equal(first.length, 2, 'Two starred cards');
    H3.fk(first[0]).focus(); await H3.fk(first[0]).click();
    assert.equal(H3.document.activeElement.getAttribute('data-fk'), first[1], 'Unstarring a shelf card focuses the next one');
    await H3.fk(first[1]).click();
    assert.equal(H3.document.activeElement, H3.h1(), 'Unstarring the last one focuses the page heading');
    st.set('sumsum-favorites', JSON.stringify([c1, c3].map(keyOf)));
    const H4 = harness(boot(htmlPath, {storage: st, hash: '#/starred'})), pop4 = H4.$('surprise-pop');
    await H4.$('surprise-btn').click();
    const pick4 = () => { const a = H4.find(n => (n.getAttribute?.('data-fk') || '').startsWith('sp-card-'), pop4)[0]; return a && a.getAttribute('data-fk').slice(8); };
    const p1 = pick4(); assert([c1.en.id, c3.en.id].includes(p1), 'Surprise on Starred picks a starred entry');
    await H4.fk('sp-star-' + p1).dispatch('click'); H4.flushTimers();
    H4.fk('sp-another').focus(); await H4.fk('sp-another').dispatch('click');
    assert(H4.document.activeElement.isConnected && pop4.contains(H4.document.activeElement), 'Focus stays in Surprise when Another goes');
    const p2 = pick4(); assert(p2 && p2 !== p1 && [c1.en.id, c3.en.id].includes(p2), 'After unstarring, Another picks only what is still starred');
    await H4.fk('sp-star-' + p2).dispatch('click'); H4.flushTimers();
    assert(!H4.has('sp-another'), 'Nothing left to pick: no Another');
  }
  // A production with no documented episode and no queued upload (known only by its total) is not offered where you browse:
  // no door on Home, no rail entry or section in the guide. Its route still opens, and the coverage summary still names it.
  {
    const qOf = p => ((M.guide.unidentified || {})[p.id] || []).filter(id => records.some(r => r.id === id)).length;
    const empty = M.prods.filter(p => !(M.epsOf.get(p.id) || []).length && !qOf(p));
    await H.navigate('home');
    for (const p of M.prods) {
      if (p.format === 'queue') continue;
      assert.equal(H.has('door-' + p.id), !empty.includes(p), 'Home door for ' + p.id + (empty.includes(p) ? ' is hidden' : ''));
    }
    await H.navigate('guide');
    for (const p of empty) {
      assert(!H.has('rail-' + p.id), 'No guide rail entry for ' + p.id);
      assert(!H.find(n => n.tagName === 'h2' && n.textContent.includes(M.prodById.get(p.id).nameEn || p.id), H.byClass('sections')[0]).length,
        'No guide section for ' + p.id);
      assert(H.byClass('goal')[0].textContent.includes(M.prodById.get(p.id).nameEn || p.id), 'The coverage summary still names ' + p.id);
      await H.navigate('guide/' + encodeURIComponent(p.id)); assert(H.has('rail-' + p.id), 'Its own route still opens and is marked');
      await H.navigate('guide');
    }
  }
  // A stored queue key that matches no record stays stored and unseen, and moving a row swaps it with the next row shown.
  {
    const [kA, kB] = [c1, c3].map(keyOf), st = new Map([['sumsum-sitting', JSON.stringify([kA, 'zz-no-such-record', kB])]]);
    const H2 = harness(boot(htmlPath, {storage: st}));
    assert(H2.has('home-down-' + c1.id) && !H2.has('home-rm-zz-no-such-record'), 'The unknown key is not shown');
    await H2.fk('home-down-' + c1.id).click(); H2.flushTimers();
    assert.deepEqual(JSON.parse(st.get('sumsum-sitting')), [kB, 'zz-no-such-record', kA], 'Move down swaps with the next shown row');
  }
  ok('Home: stored Spoken and Length that Browse hashes never change; offered videos only in Up next, the music shelf and ' +
    'Surprise; See all opens the same query with its count; twelve characters opening Browse with their counts; the queue (add, ' +
    'move, remove, clear and undo, Open next taking the first and counting an open, its link still in the page); Again with counts; ' +
    'the ✓ sticker rule; the parts train; Surprise and the queue popover (named, focused, Escape, outside click, route change, focus return; picks ' +
    'from the Browse list; a character\'s pick)');
}

// What the nav marks on a route: the tab of the page (aria-current="page"), the tab a page sits under ("true"; the pages under
// Browse are Missing episodes, Videos to identify, Identified videos and record pages), and the footer's Not found link.
function expectNav(route) {
  const path = route.split('?')[0], [k, sub] = path.split('/');
  const page = k === 'browse' && MENU.includes(sub) ? sub : k;
  return {home: page === 'home' ? 'page' : undefined, guide: page === 'guide' ? 'page' : ['episode', 'slot'].includes(page) ? 'true' : undefined,
    browse: page === 'browse' ? 'page' : MENU.includes(page) || page === 'record' ? 'true' : undefined,
    starred: page === 'starred' ? 'page' : undefined, missing: page === 'missing'};
}
function assertNav(H, route, where) {
  const want = expectNav(route);
  for (const tab of ['home', 'guide', 'browse', 'starred']) {
    if (tab === 'home' && !H.has('tab-home')) continue;
    assert.equal(H.fk('tab-' + tab).getAttribute('aria-current'), want[tab], `${where}: the ${tab} tab's aria-current`);
  }
  assert(!H.find(n => n.id === 'browse-more' || n.id === 'browse-menu', H.tree).length, where + ': no Browse menu');
  if (H.has('foot-missing')) {
    assert.equal(H.fk('foot-missing').getAttribute('aria-current'), want.missing ? 'page' : undefined, where + ': the footer Not found link');
    assert.equal(H.fk('foot-missing').href, '#/browse/missing', where + ': the footer links Missing episodes');
  }
  for (const id of ['surprise-pop', 'queue-pop']) assert.equal(H.$(id).hidden, true, where + ': ' + id + ' is closed after a route change');
}

// The views nav: Home, Episode guide, Surprise (phones show it in the bottom bar), Browse and Starred. The pages that used to
// sit in Browse's menu are quiet: one footer link to Missing episodes, which links on to the other research pages.
async function checkNav(H, M) {
  const {counts} = menuModel(M), N = M.records.length;
  assert.equal(counts.identified + counts.unidentified, N, 'Identified and to-identify uploads make up every upload');
  const active = () => H.document.activeElement;
  for (const ui of ['en', 'he']) {
    if (H.document.documentElement.lang !== ui) await H.flipLang();
    await H.navigate('home');
    const lis = H.$('tabs').children.find(c => c.tagName === 'ul').children;
    assert.deepEqual(lis.map(li => li.children[0].getAttribute('data-fk')), ['tab-home', 'tab-guide', 'tab-surprise', 'tab-browse', 'tab-starred'],
      ui + ': Home, Guide, Surprise, Browse, Starred');
    for (const [v, key] of [['home', 'navHome'], ['guide', 'navGuide'], ['browse', 'navBrowse'], ['starred', 'navStarred']]) {
      const a = H.fk('tab-' + v);
      assert.equal(a.href, '#/' + v, ui + ': the ' + v + ' tab opens #/' + v);
      assert(H.byClass('long', a)[0].textContent === L[ui][key] && H.byClass('short', a)[0].textContent === L[ui][key + 'Short'], ui + ': ' + v + ' labels');
    }
    const sp = H.fk('tab-surprise');
    assert(sp.tagName === 'button' && sp.getAttribute('aria-controls') === 'surprise-pop' && sp.getAttribute('aria-expanded') === 'false',
      ui + ': Surprise in the nav is a button controlling the Surprise popover');
    assert.equal(H.cls(lis[2]).includes('tab-pick'), true, ui + ': its item is marked for phones only (CSS)');
    assert(!H.find(n => n.tagName === 'a' && /^#\/(?:todo|uploads|browse\/)/.test(n.href || ''), H.$('tabs')).length, ui + ': no research pages in the nav');
    assertNav(H, 'home', ui + ' #/home');
    // The footer's one quiet link: what is not found, counted.
    const f = H.fk('foot-missing');
    assert.equal(f.textContent, tr(ui, 'notFound', {n: counts.missing.toLocaleString('en-US')}), ui + ': the footer link counts the missing episodes');
    assert(!/מה חסר/.test(f.textContent), ui + ': plain wording');
    await f.click();
    assert(H.location.hash === '#/browse/missing' && H.h1().textContent === L[ui].missingTitle && active() === H.h1(), ui + ': it opens Missing episodes');
    assertNav(H, 'browse/missing', ui + ' #/browse/missing');
    // Missing episodes links on, quietly, to the other research pages.
    for (const [k, route, title] of [['ms-unidentified', 'browse/unidentified', 'unidentifiedTitle'], ['ms-identified', 'browse/identified', 'identifiedTitle'],
      ['todo-link', 'todo', 'todoTitle']]) {
      await H.navigate('browse/missing'); await H.fk(k).click();
      assert(H.location.hash.split('?')[0] === '#/' + route && H.h1().textContent === L[ui][title], ui + ': Missing episodes links ' + route);
      assertNav(H, route, ui + ' #/' + route);
    }
    for (const route of ['guide', 'browse', 'starred']) { await H.fk('tab-' + route).click(); assertNav(H, route, ui + ' #/' + route); }
  }
  if (H.document.documentElement.lang !== 'en') await H.flipLang();
  ok(`nav (EN, HE): Home, Guide, Surprise (a popover button), Browse, Starred; no Browse menu; the footer's Not found link ` +
    `(${counts.missing} missing episodes) opens Missing episodes, which links Videos to identify, Identified videos and the research ` +
    'to-do list; aria-current on every route; popovers closed after route changes');
}

async function checkBrowsePages(H, M) {
  const {counts, waitingIds, identifiedIds} = menuModel(M), enc = encodeURIComponent;
  const name = p => p.nameEn || p.nameHe || p.id;
  const expandAll = async prefix => {
    for (let k = 0; k < 200; k++) {
      const more = H.find(n => n.tagName === 'button' && (n.getAttribute('data-fk') || '').startsWith('more-' + prefix))[0];
      if (!more) return; await more.click();
    }
  };
  const tcount = n => H.byClass('tcount', n)[0].textContent;
  // Identified videos: the Browse list and filters for every upload not awaiting identification.
  await H.navigate('browse/identified?sort=series'); // any query resets the other filters
  assert.equal(H.h1().textContent, L.en.identifiedTitle);
  assert.equal(H.fk('id-to-identify').href, '#/browse/unidentified', 'Identified videos points to the uploads still to identify');
  assert.equal(H.count(), counts.identified, 'Identified videos lists every identified upload');
  const idN = counts.identified.toLocaleString('en-US');
  assert.equal(H.$('count').textContent, tr('en', 'countUploads', {n: idN, total: idN}), 'Its total is the identified count');
  assert(!H.has('fg-queue', H.view()) && !H.has('fg-possible', H.view()), 'Identified videos offers only the statuses it lists');
  assert.equal(H.chipCount(H.fk('fg-matched')) + H.chipCount(H.fk('fg-none')), counts.identified, 'matched + catalogued = identified');
  assert.equal(H.chipCount(H.fk('fs-all')), counts.identified, 'Series counts are scoped to identified uploads');
  for (const k of SERIES) {
    assert.equal(H.chipCount(H.fk('fs-' + k)), M.records.filter(r => identifiedIds.has(r.id) && r.series === k).length, 'Identified series count ' + k);
  }
  // Every page when the list is short; otherwise the first ten pages, each card an identified upload, and the count above.
  const pages = Math.ceil(identifiedIds.size / 48), full = pages <= 60;
  for (let k = 0; k < (full ? pages : 10) && H.has('more', H.view()); k++) await H.fk('more').click();
  const shown = new Set(H.$('grid').children.map(li => H.find(n => /^card-/.test(n.getAttribute?.('data-fk') || ''), li)[0].getAttribute('data-fk').slice(5)));
  if (full) assert.deepEqual([...shown].sort(), [...identifiedIds].sort(), 'Identified videos shows exactly the identified uploads');
  else assert(shown.size === Math.min(identifiedIds.size, 11 * 48) && [...shown].every(id => identifiedIds.has(id)), 'Identified videos shows identified uploads');
  // Statuses outside the page, carried over from Browse or written in the hash, are dropped rather than emptying the list.
  await H.navigate('browse?gs=queue'); await H.navigate('browse/identified');
  assert(H.count() === counts.identified && !/gs=/.test(H.location.hash), 'A carried-over "Awaiting identification" filter is dropped');
  await H.navigate('browse/identified?gs=queue,matched');
  assert.equal(H.location.hash, '#/browse/identified?gs=matched', 'Only listed statuses stay in the hash');
  assert.equal(H.count(), M.records.filter(r => M.guideStatus(r) === 'matched').length);
  await H.navigate('browse?gs=');
  ok(`Identified videos: ${counts.identified} uploads (matched or catalogued), scoped counts and filters, other statuses dropped`);

  // Videos to identify: the queues and the possible copies, grouped by production, core Rechov Sumsum first.
  await H.navigate('browse/unidentified');
  assert.equal(H.h1().textContent, L.en.unidentifiedTitle);
  assert(H.text().includes(L.en.tdQueueHelp), 'The queue explanation is kept');
  assert.equal(H.number(H.byClass('results-count', H.view())[0].children.find(c => c.tagName === 'strong').textContent), counts.unidentified);
  assert.equal(H.fk('todo-link').href, '#/todo', 'Videos to identify links the full research to-do list');
  await expandAll('id-queue:');
  const groups = H.byClass('tgroup', H.$('id-queue')), rankByName = new Map(M.prods.map(p => [name(p), M.famRank(p)]));
  const ranks = groups.map(g => rankByName.get(g.children[0].textContent));
  for (let i = 1; i < ranks.length; i++) assert(ranks[i] >= ranks[i - 1], 'Core Rechov groups come first on Videos to identify');
  const homeOf = id => (M.queued.has(id) ? M.queued.get(id) : M.recLinks.get(id)[0].e.production);
  const rows = H.find(n => /^tq-/.test(n.getAttribute?.('data-fk') || ''), H.$('id-queue')).map(n => n.getAttribute('data-fk').slice(3));
  assert.deepEqual([...rows].sort(), [...waitingIds].sort(), 'Videos to identify lists exactly the uploads awaiting identification');
  for (const id of rows) assert(!identifiedIds.has(id), 'No upload is both identified and to identify: ' + id);
  for (const g of groups) {
    const p = M.prods.find(q => name(q) === g.children[0].textContent);
    const want = [...waitingIds].filter(id => homeOf(id) === p.id).length;
    assert.equal(H.number(tcount(g)), want, 'Group count for ' + p.id);
  }
  for (const id of rows) {
    const row = H.fk('tq-' + id).parentElement.parentElement, possible = (M.recLinks.get(id) || []).filter(l => l.role === 'possible');
    assert.equal(row.textContent.includes(L.en.possibleCopyOf + ': '), possible.length > 0, 'A possible copy names its candidate episode: ' + id);
    for (const l of possible) assert(H.find(a => a.tagName === 'a' && a.href === '#/episode/' + enc(l.e.id), row).length, 'Candidate link ' + l.e.id);
  }
  // One production's uploads (?prod=), from episode and slot pages; an unknown production shows them all.
  const byHome = new Map(); for (const id of waitingIds) byHome.set(homeOf(id), (byHome.get(homeOf(id)) || 0) + 1);
  const [pid, pn] = [...byHome].sort((a, b) => b[1] - a[1])[0] || [];
  if (pid) {
    await H.navigate('browse/unidentified?prod=' + enc(pid));
    assert.equal(H.location.hash, '#/browse/unidentified?prod=' + enc(pid));
    const gs = H.byClass('tgroup', H.$('id-queue'));
    assert(gs.length === 1 && gs[0].children[0].textContent === name(M.prodById.get(pid)), '?prod= shows one production');
    assert(H.text().includes(tr('en', 'onlyProd', {name: name(M.prodById.get(pid))})) && H.fk('id-all').href === '#/browse/unidentified');
    assert.equal(H.byClass('results-count', H.view())[0].textContent, tr('en', 'countUploads', {n: pn.toLocaleString('en-US'),
      total: counts.unidentified.toLocaleString('en-US')}), 'The count names the production\'s share');
    assertNav(H, 'browse/unidentified', '?prod=');
  }
  await H.navigate('browse/unidentified?prod=no-such-production');
  assert.equal(H.location.hash, '#/browse/unidentified', 'An unknown production is dropped from the hash');
  const qEp = M.eps.find(e => M.cov(e) !== 'whole-candidate' && [...M.queued.values()].includes(e.production));
  if (qEp) {
    await H.navigate('episode/' + enc(qEp.id));
    assert(H.find(a => a.tagName === 'a' && a.href === '#/browse/unidentified?prod=' + enc(qEp.production)).length,
      'The episode page links its production\'s uploads to identify');
  }
  // The link's number is what the page it opens lists for that production (queued and possible-only), in the singular for one.
  for (const [home, n] of byHome) {
    const e = M.eps.find(x => x.production === home && M.cov(x) !== 'whole-candidate'); if (!e) continue;
    await H.navigate('episode/' + enc(e.id));
    const a = H.find(x => x.tagName === 'a' && x.href === '#/browse/unidentified?prod=' + enc(home))[0];
    assert(a, 'The episode page links its production\'s uploads to identify: ' + e.id);
    assert.equal(a.textContent, n === 1 ? L.en.queueLinkOne : tr('en', 'queueLink', {n: n.toLocaleString('en-US')}),
      `The link counts the production's uploads to identify (${home}: ${n})`);
  }
  const qSlot = M.prods.find(p => [...M.queued.values()].includes(p.id) && M.prodModel(p).groups.some(g => g.slotNs.length));
  if (qSlot) {
    const g = M.prodModel(qSlot).groups.find(x => x.slotNs.length);
    await H.navigate('slot/' + enc(qSlot.id) + '/' + (g.season ?? '-') + '/' + g.slotNs[0]);
    assert(H.find(a => a.tagName === 'a' && a.href === '#/browse/unidentified?prod=' + enc(qSlot.id)).length, 'The slot page links them too');
  }
  await H.navigate('guide');
  const queueTail = tr('en', 'queueLink', {n: '\u0000'}).split('\u0000')[1];
  for (const a of H.find(n => n.tagName === 'a' && (n.textContent === L.en.queueLinkOne || (n.textContent || '').endsWith(queueTail)),
    H.byClass('goal')[0] || H.view())) {
    assert.equal(a.href, '#/browse/unidentified', 'The core headline links Videos to identify');
    // Its number is the page's (queued plus possible-only), in one term with one count.
    assert.equal(a.textContent, counts.unidentified === 1 ? L.en.queueLinkOne : tr('en', 'queueLink', {n: counts.unidentified.toLocaleString('en-US')}),
      'The headline link counts what Videos to identify lists');
  }
  ok(`Videos to identify: ${counts.unidentified} uploads in ${groups.length} production groups, core Rechov first, group counts, ` +
    'possible copies name their candidates; ?prod= from episode and slot pages; identified and to-identify are disjoint and complete');

  // Missing episodes: no upload, then no complete copy (parts, excerpts), then the expected places; counts are the guide's.
  await H.navigate('browse/missing');
  assert.equal(H.h1().textContent, L.en.missingTitle);
  assert.deepEqual(H.byClass('page-sec').map(s => s.id), ['ms-missing', 'ms-partial', 'ms-slots'], 'Missing first, then partial, then slots');
  const ranked = [...M.prods].sort((a, b) => M.famRank(a) - M.famRank(b) || (a.order ?? 99) - (b.order ?? 99));
  const covList = c => ranked.flatMap(p => M.epsOf.get(p.id).filter(e => M.cov(e) === c));
  const lists = {'ms-missing': covList('missing'), 'ms-parts': covList('parts-only'), 'ms-excerpt': covList('excerpt-only')};
  assert.equal(H.number(tcount(H.$('ms-missing'))), lists['ms-missing'].length, 'Missing count is the guide\'s');
  assert.equal(H.number(tcount(H.$('ms-partial'))), lists['ms-parts'].length + lists['ms-excerpt'].length, 'No complete copy yet: parts + excerpts');
  assert.equal(lists['ms-missing'].length + lists['ms-parts'].length + lists['ms-excerpt'].length, counts.missing, 'The sections add up to the menu count');
  for (const id of ['ms-parts', 'ms-excerpt']) assert.equal(H.number(tcount(H.$(id + '-h'))), lists[id].length, id + ' count');
  // A production with many seasons is folded: one heading per season with its count and a Show button, no rows until opened.
  const pagedMissing = lists['ms-missing'].filter(e => M.paged(M.prodById.get(e.production)));
  if (pagedMissing.length) {
    const e0 = pagedMissing[0], p0 = M.prodById.get(e0.production);
    assert(!H.has('td-' + e0.id, H.$('ms-missing')), 'Seasons of ' + p0.id + ' start folded');
    const g0 = H.byClass('tgroup', H.$('ms-missing')).find(g => g.children[0].textContent === name(p0) + ' · ' + L.en.seasonLbl + ' ' + e0.season);
    assert(g0, 'Each season is its own group, named by production and season');
    await H.fk('more-ms-missing:' + p0.id + ':' + e0.season).click();
    assert.equal(H.document.activeElement, H.fk('td-' + e0.id), 'Opening a season moves focus to its first episode');
  }
  for (const id of ['ms-missing', 'ms-parts', 'ms-excerpt']) await expandAll(id + ':');
  const listOf = (secId, ulPred) => {
    const sec = H.$(secId), uls = H.find(n => n.tagName === 'ul' && H.cls(n).includes('tlist') && ulPred(n), sec);
    return uls.flatMap(ul => H.find(n => n.tagName === 'a' && /^td-/.test(n.getAttribute('data-fk') || ''), ul).map(a => a.getAttribute('data-fk').slice(3)));
  };
  const shownLists = {'ms-missing': listOf('ms-missing', () => true),
    'ms-parts': listOf('ms-partial', ul => ul.getAttribute('aria-labelledby') === 'ms-parts-h'),
    'ms-excerpt': listOf('ms-partial', ul => ul.getAttribute('aria-labelledby') === 'ms-excerpt-h')};
  for (const [id, want] of Object.entries(lists)) {
    assert.deepEqual(shownLists[id], want.map(e => e.id), id + ': every episode, core Rechov first, in episode order');
  }
  for (const sec of ['ms-missing', 'ms-partial']) {
    for (const g of H.byClass('tgroup', H.$(sec))) {
      const head = g.children[0].textContent, sep = ' · ' + L.en.seasonLbl + ' ';
      const p = M.prods.find(q => name(q) === head || (M.paged(q) && head.startsWith(name(q) + sep))), ul = g.parentElement;
      const season = M.paged(p) ? Number(head.slice(name(p).length + sep.length).replace(/,/g, '')) : null;
      const c = ul.getAttribute('aria-labelledby') === 'ms-parts-h' ? 'parts-only' : ul.getAttribute('aria-labelledby') === 'ms-excerpt-h' ?
        'excerpt-only' : 'missing';
      assert.equal(H.number(tcount(g)), M.epsOf.get(p.id).filter(e => M.cov(e) === c && (season === null || e.season === season)).length,
        `${sec} group count ${p.id}${season === null ? '' : ' season ' + season} (${c})`);
    }
  }
  // Expected places: one row per production with open places, gaps or an open total, its numbers linked to their slot pages.
  const slotProds = ranked.filter(p => !['queue', 'home-video'].includes(p.format)).filter(p => {
    const m = M.prodModel(p); return m.slots || m.inferredGaps || m.ts !== 'known';
  });
  const slotN = slotProds.reduce((s, p) => s + M.prodModel(p).slots + M.prodModel(p).inferredGaps, 0);
  const open = slotProds.some(p => M.prodModel(p).ts !== 'known');
  assert.equal(tcount(H.$('ms-slots')), open ? tr('en', 'countOpen', {n: slotN.toLocaleString('en-US')}) : slotN.toLocaleString('en-US'),
    'Expected-not-identified count: slots plus inferred gaps (or more with an open total)');
  const slotRows = H.find(n => /^sp-/.test(n.getAttribute?.('data-fk') || ''), H.$('ms-slots')).map(n => n.getAttribute('data-fk').slice(3));
  assert.deepEqual(slotRows, slotProds.map(p => p.id), 'One expected-places row per production, core Rechov first');
  let numLinks = 0, visitedSlot = null;
  for (const p of slotProds) {
    const m = M.prodModel(p), cells = m.groups.flatMap(g => g.slotNs.map(n => [g, n]));
    const links = H.find(n => n.tagName === 'a' && /^sn-/.test(n.getAttribute('data-fk') || '') && n.getAttribute('data-fk').startsWith('sn-' + p.id + '-'),
      H.fk('sp-' + p.id).parentElement);
    assert.deepEqual(links.map(a => a.href), cells.slice(0, 24).map(([g, n]) => '#/slot/' + enc(p.id) + '/' + (g.season ?? '-') + '/' + n),
      'Numbered places link their slot pages: ' + p.id);
    links.forEach((a, k) => assert.equal(a.textContent, M.codeOf(p, cells[k][0].season, cells[k][1]), 'Slot link code ' + p.id));
    const all = H.find(n => n.tagName === 'a' && n.href === '#/guide/' + enc(p.id) + '?layout=numbers', H.fk('sp-' + p.id).parentElement);
    assert.equal(all.length, cells.length > 24 ? 1 : 0, 'Over 24 numbers: a link to the production\'s numbers: ' + p.id);
    numLinks += links.length; if (!visitedSlot && cells.length) visitedSlot = [p, ...cells[0]];
  }
  const stats = H.byClass('ms-stats')[0].children.map(li => li.textContent);
  assert.equal(stats[0], lists['ms-missing'].length.toLocaleString('en-US') + ' ' + L.en.cov_missing, 'The summary starts with the missing count');
  // The expected places keep the open-total mark of their section heading ("73+").
  const slotStat = stats.find(x => x.endsWith(' ' + L.en.segSlots)), placeN = slotProds.reduce((s, p) => s + M.prodModel(p).slots, 0);
  if (placeN) assert.equal(slotStat, (open ? tr('en', 'countOpen', {n: placeN.toLocaleString('en-US')}) : placeN.toLocaleString('en-US')) + ' ' + L.en.segSlots,
    'The summary marks an open total as the heading does');
  assert.equal(H.fk('todo-link').href, '#/todo', 'Missing episodes links the full research to-do list');
  if (visitedSlot) {
    const [p, g, n] = visitedSlot;
    await H.fk('sn-' + p.id + '-' + (g.season ?? '-') + '-' + n).click();
    assert.equal(H.h1().textContent, expectSlotTitle(M, p, g, n, 'en'), 'A numbered place opens its slot page');
  }
  ok(`Missing episodes: ${lists['ms-missing'].length} missing, ${lists['ms-parts'].length} parts only, ${lists['ms-excerpt'].length} excerpts ` +
    `only (= ${counts.missing}), ${slotN}${open ? '+' : ''} expected in ${slotProds.length} rows with ${numLinks} numbered slot links; ` +
    'guide counts per section and production, core Rechov first, episode order');

  // Research to-do: links to the two pages with their counts (not copies of them), whole links to check, export.
  await H.navigate('todo');
  assert.equal(H.fk('td-identify').href, '#/browse/unidentified'); assert.equal(H.number(tcount(H.$('td-identify'))), counts.unidentified);
  assert.equal(H.fk('td-missing').href, '#/browse/missing'); assert.equal(H.number(tcount(H.$('td-missing'))), counts.missing);
  assert.equal(H.byClass('todo-help', H.$('td-missing'))[0].textContent, tr('en', 'tdMissingSum', {missing: lists['ms-missing'].length.toLocaleString('en-US'),
    parts: lists['ms-parts'].length.toLocaleString('en-US'), excerpt: lists['ms-excerpt'].length.toLocaleString('en-US'),
    slots: open ? tr('en', 'countOpen', {n: slotN.toLocaleString('en-US')}) : slotN.toLocaleString('en-US')}));
  assert(!H.find(n => /^(?:tq-|sp-|sn-)/.test(n.getAttribute?.('data-fk') || '')).length && !H.document.getElementById('ms-missing') && !H.document.getElementById('id-queue'),
    'The research to-do list does not repeat the pages it links');
  assert(H.$('td-check').tagName === 'details' && H.$('td-check').open === true, 'Whole links to check are open on the research to-do list');
  await expandAll('td-check:');
  const check = H.$('td-check');
  const toCheck = M.eps.filter(e => M.cov(e) === 'whole-candidate' && M.ev(e) === 'metadata-checked');
  assert.equal(H.number(tcount(check)), toCheck.length);
  assert.deepEqual(H.find(n => n.tagName === 'a' && /^td-/.test(n.getAttribute('data-fk') || ''), check).map(a => a.getAttribute('data-fk').slice(3)).sort(),
    toCheck.map(e => e.id).sort(), 'Every whole link to check is listed');
  assert(H.has('td-export'), 'The research to-do list keeps its export');
  ok(`research to-do: links to Videos to identify (${counts.unidentified}) and Missing episodes (${counts.missing}) instead of copies, ` +
    `${toCheck.length} whole links to check, export`);
}

// Old routes and start views: #/uploads (All uploads) lands on Browse with its filters; unknown Browse pages are Browse.
async function checkRouteAliases(htmlPath, M) {
  const classic = M.countE(r => r.series === 'classic');
  for (const ui of ['en', 'he']) {
    let H = harness(bootLight(htmlPath, {hash: '#/uploads', htmlAttrs: {'data-start-lang': ui}}));
    assert(H.h1().textContent === L[ui].browseTitle && H.location.hash === '#/browse', `#/uploads opens Browse at start (${ui})`);
    assert.equal(H.document.title, L[ui].browseTitle + ' · ' + L[ui].appName);
    assertNav(H, 'browse', '#/uploads (' + ui + ')');
    H = harness(bootLight(htmlPath, {hash: '#/uploads?series=classic&sort=longest', htmlAttrs: {'data-start-lang': ui}}));
    assert(H.location.hash === '#/browse?series=classic&sort=longest' && H.count() === classic && H.$('u-sort').value === 'longest',
      `#/uploads keeps its filters (${ui}): ` + H.location.hash);
    H = harness(bootLight(htmlPath, {htmlAttrs: {'data-start-lang': ui, 'data-start-view': 'uploads'}}));
    assert(H.h1().textContent === L[ui].browseTitle && H.location.hash === '#/browse', `data-start-view="uploads" opens Browse (${ui})`);
    H = harness(bootLight(htmlPath, {hash: '#/todo', htmlAttrs: {'data-start-lang': ui}}));
    assert(H.h1().textContent === L[ui].todoTitle && H.location.hash === '#/todo', `#/todo still works (${ui})`);
    assertNav(H, 'todo', '#/todo (' + ui + ')');
  }
  const H = harness(bootLight(htmlPath));
  await H.navigate('uploads?kind=clip');
  assert(H.location.hash === '#/browse?kind=clip' && H.count() === model(H.payload).countE(r => kindOf(r) === 'clip'), 'A followed #/uploads link keeps its filter');
  await H.navigate('browse/no-such-page');
  assert(H.h1().textContent === L.en.browseTitle && H.location.hash.split('?')[0] === '#/browse', 'An unknown Browse page is Browse: ' + H.location.hash);
  await H.navigate('identified'); assert.equal(H.h1().textContent, L.en.guideTitle, 'Browse pages live under #/browse/');
  if (M.hasGuide) {
    await H.navigate('uploads/missing'); assert.equal(H.location.hash, '#/browse/missing', 'An old #/uploads/ path reaches the Browse page');
  }
  ok('route aliases (EN, HE): #/uploads with its filters, data-start-view="uploads", #/todo; unknown Browse pages; pages only under #/browse/');
}

// Stylesheet rules that the DOM double cannot render.
// ---------------------------------------------------------------- theme tokens and contrast
// Colours are custom properties on <html> (library.template.html, "tokens"): a scheme layer (rules that set color-scheme:
// the shared semantic colours, light on :root and dark on :root[data-scheme=dark]) and a palette layer (the default on :root
// and :root[data-scheme=dark]; another palette NAME on :root[data-palette=NAME] and :root[data-palette=NAME][data-scheme=dark];
// each palette's rules are shared with its picker swatch .tp-sw-NAME, which names the default). themeTokens() reads those
// rules from the top level of the stylesheet and resolves a palette and scheme the way the cascade does: of the rules whose
// attribute selectors all match, more attributes win, then the later rule. .sweep/titles-he/theme/contrast.cjs prints the
// contrast table from the same functions.
const hex6 = h => (h.length === 4 || h.length === 5 ? '#' + h.slice(1).split('').map(x => x + x).join('') : h).toLowerCase();
const rgbOf = h => hex6(h).slice(1).match(/../g).map(x => parseInt(x, 16));
// An alpha colour composited over an opaque one.
const blendOver = (fg, bg) => {
  const f = rgbOf(fg), b = rgbOf(bg), a = f.length > 3 ? f[3] / 255 : 1;
  return '#' + [0, 1, 2].map(i => Math.round(f[i] * a + b[i] * (1 - a)).toString(16).padStart(2, '0')).join('');
};
const luminance = h => {
  const [r, g, b] = rgbOf(h).slice(0, 3).map(x => x / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// Top-level statements of a stylesheet: {sel, body} rules and {at, text} blocks (@media, @keyframes), comments removed.
// cssRules() also lists the rules inside the blocks.
const cssRules = css => cssTop(css).flatMap(r => (r.at ? cssRules(r.text) : [r]));
function cssTop(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, ''), out = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i); if (open < 0) break;
    const head = src.slice(i, open).trim(); let depth = 1, j = open + 1;
    while (j < src.length && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
    if (head.startsWith('@')) out.push({at: head, text: src.slice(open + 1, j - 1)});
    else out.push({sel: head, body: src.slice(open + 1, j - 1)});
    i = j;
  }
  return out;
}
function themeTokens(css) {
  const top = cssTop(css), rules = [];
  top.forEach((r, order) => {
    if (!r.sel) return;
    const sels = r.sel.split(',').map(x => x.trim()), roots = sels.filter(x => x.startsWith(':root'));
    if (!roots.length) return;
    assert.equal(roots.length, 1, 'One :root selector per token rule: ' + r.sel);
    const m = /^:root((?:\[data-(?:palette|scheme)=[\w-]+\])*)$/.exec(roots[0]);
    assert(m, 'Token rules select :root by data-palette and data-scheme only: ' + roots[0]);
    const attrs = Object.fromEntries([...m[1].matchAll(/\[data-(palette|scheme)=([\w-]+)\]/g)].map(a => [a[1], a[2]]));
    const tokens = Object.fromEntries([...r.body.matchAll(/--([\w-]+):([^;]+)/g)].map(d => [d[1], d[2].trim()]));
    rules.push({sel: r.sel, body: r.body, sels, attrs, tokens, order, scheme: /(?:^|;)\s*color-scheme:/.test(r.body), others: sels.filter(x => x !== roots[0])});
  });
  // The default palette is the one whose swatch shares the bare :root rule (no data-palette, no color-scheme).
  const bare = rules.find(r => !r.scheme && !Object.keys(r.attrs).length);
  const dflt = ((bare ? bare.others : []).map(x => /^\.tp-sw-([\w-]+)$/.exec(x)).find(Boolean) || [])[1];
  assert(dflt, 'The default palette rule (:root) names its swatch, .tp-sw-NAME');
  const palettes = [...new Set([dflt, ...rules.map(r => r.attrs.palette).filter(Boolean)])];
  const resolve = (palette, scheme) => {
    const out = {}, from = {};
    const hits = rules.filter(r => (!r.attrs.palette || r.attrs.palette === palette) && (!r.attrs.scheme || r.attrs.scheme === scheme))
      .sort((a, b) => Object.keys(a.attrs).length - Object.keys(b.attrs).length || a.order - b.order);
    for (const r of hits) for (const [k, v] of Object.entries(r.tokens)) { out[k] = v; from[k] = r; }
    return {tokens: out, from};
  };
  const block = (palette, scheme) => rules.find(r => !r.scheme && (r.attrs.palette || dflt) === palette &&
    (palette === dflt ? !r.attrs.palette : true) && (r.attrs.scheme || 'light') === scheme);
  return {rules, top, palettes, default: dflt, resolve, block, schemeLight: rules.find(r => r.scheme && !r.attrs.scheme && !r.attrs.palette),
    schemeDark: rules.find(r => r.scheme && r.attrs.scheme === 'dark' && !r.attrs.palette)};
}
// A colour expression in the pairs below: a token, a token composited over another ('mast-ctl@brand'), or over a literal
// thumbnail colour ('scrim@#ffffff').
function colourOf(t, expr) {
  // 'a@b@c' is a over b over c (a hovered tab's count: the chip over the hover tint over the masthead).
  const layers = expr.split('@'), val = k => {
    const v = k.startsWith('#') ? k : t[k];
    assert(typeof v === 'string' && /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v), `Token --${k} is a hex colour (${v})`);
    return hex6(v);
  };
  // What a colour sits on is opaque at the bottom; a translucent colour is named with what it is composited over.
  const base = layers.at(-1);
  assert(layers.length > 1 || val(base).length === 7, `--${base} is opaque, or the pair names what it is composited over (${expr})`);
  assert(layers.length === 1 || val(base).length === 7, `--${base} is opaque (${expr})`);
  return layers.slice(0, -1).reduceRight((under, k) => blendOver(val(k), under), val(base));
}
// The key pairs, in every palette and scheme: text and its background need 4.5:1 (WCAG 1.4.3), marks, rings, outlines and
// the toggle thumb 3:1 against what they sit on (WCAG 1.4.11).
const CONTRAST_PAIRS = [
  ['body text on the page', 'ink', 'bg', 4.5], ['body text on cards', 'ink', 'surface', 4.5], ['body text on raised rows', 'ink', 'surface-2', 4.5],
  ['muted text on the page', 'muted', 'bg', 4.5], ['muted text on cards', 'muted', 'surface', 4.5], ['muted text on raised rows', 'muted', 'surface-2', 4.5],
  ['links on the page', 'link', 'bg', 4.5], ['links on cards', 'link', 'surface', 4.5],
  ['button text', 'primary-ink', 'primary', 4.5], ['button text, hovered', 'primary-ink', 'primary-hover', 4.5],
  ['pressed chips, the checked appearance, toasts', 'bg', 'ink', 4.5], ['chip text', 'chip-ink', 'chip', 4.5],
  ...['whole', 'parts', 'excerpt', 'missing', 'unknown'].map(c => [`tag text on the ${c} tint`, 'chip-ink', c + '-bg', 4.5]),
  ['strip numbers: whole', 'whole-ink', 'whole', 4.5], ['strip numbers: parts', 'ink', 'parts-bg', 4.5], ['strip numbers: excerpts', 'ink', 'excerpt-bg', 4.5],
  ['strip numbers: expected', 'muted', 'unknown-bg', 4.5], ['missing numbers and errors on the page', 'missing', 'bg', 4.5],
  ['missing numbers and errors on cards', 'missing', 'surface', 4.5],
  ['host chip on a dark thumbnail', 'host-ink', 'host-bg@#000000', 4.5], ['duration on a white thumbnail', 'scrim-ink', 'scrim@#ffffff', 4.5],
  ['masthead text', 'mast-ink', 'brand', 4.5], ['tab labels', 'mast-ink-soft', 'brand', 4.5], ['hovered tab labels', 'mast-ink-soft', 'mast-hover@brand', 4.5],
  ['tab counts', 'mast-ink-soft', 'mast-chip@brand', 4.5], ['tab counts, hovered', 'mast-ink-soft', 'mast-chip@mast-hover@brand', 4.5], ['the current tab and the checked language', 'mast-current-ink', 'mast-current', 4.5],
  ['the current tab\'s count', 'mast-current', 'mast-current-ink', 4.5], ['the unchecked language and the theme icon', 'mast-ink-soft', 'mast-ctl@brand', 4.5],
  ['the open theme button\'s icon', 'mast-current-ink', 'mast-current', 3],
  ['focus ring on the page', 'focus', 'bg', 3], ['focus ring on cards and the popovers', 'focus', 'surface', 3], ['focus ring on raised rows', 'focus', 'surface-2', 3],
  ['masthead focus ring', 'mast-focus', 'brand', 3], ['toggle and theme button outline', 'mast-ctl-line@brand', 'brand', 3],
  ['the toggle thumb on its track', 'mast-current', 'mast-ctl@brand', 3], ['Surprise and queue labels', 'mast-ink', 'mast-ctl@brand', 4.5],
  ['buttons on panels', 'primary', 'surface-2', 3], ['buttons on cards', 'primary', 'surface', 3],
  ...['whole', 'parts', 'excerpt', 'missing', 'unknown'].flatMap(c => [[`${c} marks on cards`, c, 'surface', 3], [`${c} marks on the ${c} tint`, c, c + '-bg', 3]]),
  ...['ok', 'public', 'vpn', 'lic', 'bad'].map(c => [`access mark: ${c}`, 'acc-' + c, 'surface', 3]), ['the star', 'star-ink', 'surface', 3]
];
// Each series kicker colour (--ser-ID, one per registered series; checkThemeTokens ties them to the registry).
const seriesPairs = T => Object.keys(T.schemeLight.tokens).filter(k => k.startsWith('ser-'))
  .map(k => [`series kicker: ${k.slice(4)}`, k, 'surface', 4.5]);
function contrastRows(T) {
  const rows = [], pairs = [...CONTRAST_PAIRS, ...seriesPairs(T)];
  for (const palette of T.palettes) for (const scheme of ['light', 'dark']) {
    const t = T.resolve(palette, scheme).tokens;
    for (const [label, fg, bg, min] of pairs) {
      const r = contrast(colourOf(t, fg), colourOf(t, bg));
      rows.push({palette, scheme, label, fg, bg, min, ratio: r, ok: r >= min});
    }
  }
  return rows;
}

// Theme tokens: every colour in the stylesheet is a custom property of the token rules; every palette defines every palette
// token (light) and at least the default's dark tokens; the palette lists of the stylesheet, the preferences script and the
// strings agree; and the key pairs reach their contrast in every palette and scheme.
function checkThemeTokens(html, theme, seriesIds) {
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1], T = themeTokens(css);
  // Every registered series has a kicker colour in both schemes and a .ser-ID class bound to it; no colour is left over.
  const serOf = r => Object.keys(r.tokens).filter(k => k.startsWith('ser-')).map(k => k.slice(4)).sort();
  assert.deepEqual(serOf(T.schemeLight), [...seriesIds].sort(), 'The light scheme rule has a --ser-ID colour for each registered series, and no other');
  assert.deepEqual(serOf(T.schemeDark), [...seriesIds].sort(), 'The dark scheme rule has a --ser-ID colour for each registered series, and no other');
  for (const id of seriesIds) {
    assert(T.top.some(r => r.sel && r.sel.split(',').map(x => x.trim()).includes('.ser-' + id) &&
      r.body.replace(/\s/g, '').includes(`--series-ink:var(--ser-${id})`)), `.ser-${id} sets --series-ink to var(--ser-${id})`);
  }
  // Colour literals appear only in token rules (forced colours use system colours).
  const literal = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(|(?<![\w-])(?:white|black|red|green|blue|yellow|orange|purple|pink|brown|gr[ae]y|silver|navy|teal|maroon|olive|lime|aqua|fuchsia)(?![\w-])/i;
  const walk = (list, where) => {
    for (const r of list) {
      if (r.at) { walk(cssTop(r.text), r.at); continue; }
      if (where === '' && T.rules.some(x => x.sel === r.sel)) continue;
      assert(!literal.test(r.body), `Colours are custom properties: ${where ? where + ' ' : ''}${r.sel} {${r.body.slice(0, 80)}}`);
    }
  };
  walk(T.top, '');
  // Token rules stay at the top level: no scheme media query (data-scheme carries the system scheme) and no data-theme.
  for (const r of T.top.filter(x => x.at)) assert(!/:root/.test(r.text), 'No token rule inside ' + r.at);
  assert(!/data-theme|prefers-color-scheme/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'The scheme comes from data-scheme, not data-theme or a media query');
  // Layers: one scheme rule per scheme (dark sets only what changes), then the palettes.
  assert(T.schemeLight && T.schemeDark && T.rules.filter(r => r.scheme).length === 2, 'One scheme rule for light (:root) and one for dark');
  assert(/color-scheme:light(?:;|$)/.test(T.schemeLight.body) && /color-scheme:dark(?:;|$)/.test(T.schemeDark.body), 'color-scheme follows data-scheme');
  const S = new Set(Object.keys(T.schemeLight.tokens)), keys = r => new Set(Object.keys(r.tokens));
  for (const k of Object.keys(T.schemeDark.tokens)) assert(S.has(k), 'The dark scheme rule sets only shared tokens: --' + k);
  assert.equal(T.default, DEFAULT_PALETTE, `The default palette (:root) is ${DEFAULT_PALETTE}`);
  const dflt = T.block(T.default, 'light'), dfltDark = T.block(T.default, 'dark');
  assert(dflt && dfltDark, `${T.default}, the default palette, has a light and a dark rule`);
  const P = keys(dflt), D = keys(dfltDark);
  for (const k of P) assert(!S.has(k), 'A token is either shared or a palette token: --' + k);
  for (const k of D) assert(P.has(k), 'The default dark rule sets only palette tokens: --' + k);
  // Every custom property the stylesheet uses is defined (locals are set by rules or, --tb-h, by the script with a fallback).
  const used = new Set([...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/var\(--([\w-]+)/g)].map(m => m[1]));
  const local = new Set([...cssRules(css).filter(r => !T.rules.some(x => x.sel === r.sel))
    .flatMap(r => [...r.body.matchAll(/--([\w-]+):/g)].map(m => m[1])), 'tb-h']);
  for (const k of used) assert(S.has(k) || P.has(k) || local.has(k), 'Token defined: --' + k);
  for (const k of [...S, ...P]) assert(used.has(k), 'Token used: --' + k);
  // Palettes: the stylesheet, the preferences script (the picker's list) and the strings name the same palettes, in order.
  assert.deepEqual([...theme.palettes], T.palettes, 'The preferences script lists the stylesheet\'s palettes');
  assert.deepEqual([...theme.appearances], ['system', 'light', 'dark'], 'Appearances: System, Light, Dark');
  for (const lg of ['en', 'he']) assert.deepEqual(Object.keys(L[lg]).filter(k => k.startsWith('pal_')).map(k => k.slice(4)), T.palettes, 'Palette names: ' + lg);
  assert(T.palettes.length >= 6 && T.palettes[0] === DEFAULT_PALETTE && theme.palettes[0] === DEFAULT_PALETTE &&
    Object.keys(L.en).find(k => k.startsWith('pal_')) === 'pal_' + DEFAULT_PALETTE, `At least six palettes, ${DEFAULT_PALETTE} first (the default)`);
  for (const p of T.palettes) {
    const lt = T.block(p, 'light'), dk = T.block(p, 'dark');
    assert(lt && dk, `Palette ${p} has a light and a dark rule`);
    for (const k of P) assert(k in lt.tokens, `Palette ${p} (light) defines --${k}`);
    for (const k of D) assert(k in dk.tokens, `Palette ${p} (dark) defines --${k}`);
    for (const k of keys(dk)) assert(P.has(k) || S.has(k), `Palette ${p} (dark) sets only known tokens: --${k}`);
    for (const k of keys(lt)) assert(P.has(k) || S.has(k), `Palette ${p} (light) sets only known tokens: --${k}`);
    // A shared colour a palette overrides in light is overridden in dark too, or the light value would show in dark.
    for (const k of keys(lt)) if (k in T.schemeDark.tokens) assert(k in dk.tokens, `Palette ${p} overrides --${k} in dark too`);
    // Its picker swatch shares both rules.
    assert(lt.others.includes('.tp-sw-' + p) && dk.others.includes('[data-scheme=dark] .tp-sw-' + p), `The ${p} swatch takes the ${p} tokens`);
    // Resolved like the cascade: every used token has a value, and a palette token comes from the palette's own rules.
    for (const sc of ['light', 'dark']) {
      const {tokens, from} = T.resolve(p, sc);
      for (const k of used) if (!local.has(k)) assert(k in tokens, `${p} ${sc}: --${k} resolves`);
      for (const k of P) assert(p === T.default || from[k].attrs.palette === p, `${p} ${sc}: --${k} comes from the ${p} rules`);
      for (const k of D) assert(from[k].attrs.scheme === sc || sc === 'light', `${p} ${sc}: --${k} comes from the ${sc} rule`);
    }
  }
  // The toolbar colour before the script runs: the default masthead.
  assert.equal((html.match(/<meta name="theme-color" content="([^"]*)" id="meta-theme-color">/) || [])[1], T.resolve(T.default, 'light').tokens.brand,
    'theme-color starts as the default masthead colour');
  assert(/<meta name="color-scheme" content="light dark" id="meta-color-scheme">/.test(html), 'color-scheme starts as "light dark" (System)');
  const rows = contrastRows(T), bad = rows.filter(r => !r.ok);
  assert.deepEqual(bad.map(r => `${r.palette} ${r.scheme}: ${r.label} (--${r.fg} on --${r.bg}) ${r.ratio.toFixed(2)} < ${r.min}`), [],
    'Contrast in every palette and scheme');
  ok(`theme tokens: ${T.palettes.length} palettes (${T.palettes.join(', ')}; ${T.default} the default) define ${P.size} palette tokens, light and dark, over ${S.size} shared ` +
    `ones; colours only in tokens; ${rows.length} contrast pairs pass (${CONTRAST_PAIRS.length + seriesPairs(T).length} per palette and scheme)`);
  return T;
}

// Every CSS rule with the @media (or other at-rule) prelude it sits in ('' at the top level), whatever the line layout.
const cssRulesIn = (css, media = '') => cssTop(css).flatMap(r => (r.at ? cssRulesIn(r.text, r.at.replace(/^@media\s*/, '')) :
  [{media, sel: r.sel, body: r.body}]));
function checkCss(html) {
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({sel: m[1].trim(), body: m[2]}));
  for (const r of rules) {
    if (/overflow(?:-[xy])?:(?:auto|scroll)/.test(r.body)) {
      assert(/position:(?:relative|absolute|fixed|sticky)/.test(r.body), `Scroll container is positioned (sr-only text cannot escape): ${r.sel}`);
    }
    for (const m of r.body.matchAll(/content:("(?:[^"\\]|\\.)+")(?!\s*\/)/g)) {
      assert(r.body.includes('content:' + m[1] + ' / ""'), `Generated content ${m[1]} has empty alt text: ${r.sel}`);
    }
  }
  assert(/\.prod-kicker \.fmt\{white-space:normal/.test(css), 'Long format labels in the kicker wrap');
  // Tile alternate labels wrap to two lines: a long Hebrew source prefix ('ארכיון האינטרנט') must not hide the season and episode.
  const tileAlt = rules.find(r => r.sel === '.tile-alt');
  assert(tileAlt && /-webkit-line-clamp:2/.test(tileAlt.body) && !/white-space:nowrap/.test(tileAlt.body), '.tile-alt wraps to two lines');
  assert(!/\.strip\.inferred \.cell\.gap\{[^}]*opacity/.test(css), 'Inferred gap numbers are not faded');
  assert(/\.toolbar\.more-open\{position:static\}/.test(css) && /scroll-padding-top:calc\(var\(--tb-h/.test(css),
    'Focus scrolling leaves room for the sticky toolbar');
  // Strip number contrast (WCAG 1.4.3) in every palette, light and dark.
  const TT = themeTokens(css), schemes = TT.palettes.flatMap(p => ['light', 'dark'].map(sc => [p + ' ' + sc, TT.resolve(p, sc).tokens]));
  const ratio = (a, b) => contrast(hex6(a).slice(0, 7), hex6(b).slice(0, 7));
  const cell = sel => rules.find(r => r.sel === sel).body;
  assert(/color:var\(--whole-ink\)/.test(cell('.cell.cov-whole')) && /color:var\(--muted\)/.test(cell('.cell.exp')));
  for (const [name, t] of schemes) {
    for (const [fg, bg] of [['whole-ink', 'whole'], ['muted', 'unknown-bg'], ['muted', 'bg'], ['missing', 'bg']]) {
      assert(ratio(t[fg], t[bg]) >= 4.5, `${name}: strip numbers --${fg} on --${bg} reach 4.5:1 (${ratio(t[fg], t[bg]).toFixed(2)})`);
    }
  }
  // Focus rings (3px, offset 2px) are not clipped: containers of controls do not hide overflow, and the scrolling rail
  // and the to-do summaries draw the ring inside.
  const body = sel => (rules.find(r => r.sel === sel) || {body: ''}).body;
  for (const sel of ['.seg-toggle', '.todo-sec', '.chips', '.tb-row', '.toolbar', '.fpills', '.tile-act', '.u-actions', '.trow-act',
    '.primary', '.next-act', '.find-links', '.tools', '.todo-jump', '.active-row', '.tagbtns', '.unnum', '.strip']) {
    for (const r of rules.filter(x => x.sel.split(',').map(y => y.trim()).includes(sel))) {
      assert(!/overflow(?:-[xy])?:(?:hidden|clip)/.test(r.body), `${sel} does not clip its controls' focus rings`);
    }
  }
  assert(/outline-offset:-[3-9]px/.test(body('.todo-sec>summary:focus-visible')), 'To-do summaries draw their focus ring inside');
  assert(/outline-offset:-1px/.test(body('.rail-item:focus-visible')) && /padding:4px/.test(body('.rail')), 'Rail rings fit its padding');
  assert(/position:relative;z-index:1/.test(body('.seg-toggle button:focus-visible')), 'A focused layout button paints above its neighbours');
  assert(!/margin:-/.test(body('.todo-help')), 'The help line does not slide under the summary ring');
  // Forced colors: current tab, current rail item and pressed layout button have a non-colour indicator.
  const forced = css.match(/@media \(forced-colors:active\)\{([\s\S]*?)\n\}/)[1];
  const forcedRules = [...forced.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({sels: m[1].split(',').map(x => x.trim()), body: m[2]}));
  for (const sel of ['.tab[aria-current]', '.rail-item[aria-current=true]', '.seg-toggle button[aria-pressed=true]']) {
    assert(forcedRules.some(r => r.sels.some(x => x.startsWith(sel) && !x.includes(':focus')) &&
      /underline|outline:\d|border(?:-inline-start)?:\d/.test(r.body)), 'Forced colors mark ' + sel + ' without colour');
  }
  assert(/\.seg-toggle button\[aria-pressed=true\]\{outline:2px solid CanvasText;outline-offset:-4px/.test(forced),
    'The pressed layout outline is inside the button');
  // Tile watch labels wrap instead of being clipped; the play icon never shrinks.
  assert(!/white-space:nowrap|overflow:hidden|text-overflow/.test(body('.tbtn')) && /flex:none/.test(body('.tbtn svg')) &&
    /flex-wrap:wrap/.test(body('.tbtn')) && /min-width:0/.test(body('.tbtn .wl')),
    'Tile watch labels wrap and keep their icon');
  // Search inputs: dir=auto content, padding (and the icon) by page direction.
  assert(/padding:0 38px 0 10px/.test(body('html[dir=rtl] .search input')) && /padding:0 10px 0 38px/.test(body('.search input')),
    'Search box padding follows the page direction, not the typed text');
  // Phones (320-390 px): long Watch labels in upload rows and the hero wrap, record notes break long URLs, host chips are cut
  // with an ellipsis, and List rows show the short Watch label beside a title column that keeps its width.
  const has = (sel, re) => rules.some(r => r.sel.split(',').map(x => x.trim()).includes(sel) && re.test(r.body));
  assert(has('.btn.big', /white-space:normal/) && has('.btn.big', /max-width:100%/), 'Big Watch buttons wrap their label');
  assert(has('.urow-actions>.btn', /white-space:normal/) && /flex-wrap:wrap/.test(body('.urow-actions')) && /min-width:0/.test(body('.urow-actions')),
    'Upload-row actions wrap');
  // List rows: "Watch on YouTube · Unavailable" is wider than a 320 px row, so the button wraps its label (R4-01).
  assert(has('.trow-act>.btn', /white-space:normal/) && has('.trow-act>.btn', /max-width:100%/), 'List-row Watch buttons wrap their label');
  assert(/overflow-wrap:anywhere/.test(body('.research p')), 'Record notes break long URLs');
  assert(/text-overflow:ellipsis/.test(body('.u-host')) && /max-width:calc\(100% - 12px\)/.test(body('.u-host')), 'Host chips fit their thumbnail');
  // A guide tag wider than its upload card wraps inside the pill instead of being clipped by the card (R3-06).
  assert(['display:inline-block', 'max-width:100%', 'overflow-wrap:anywhere'].every(d => body('.u-tags .tag').includes(d)) &&
    /margin-inline-end:\d+px/.test(body('.u-tags .tag .glyph')), 'Guide tags on upload cards wrap inside their pill');
  // Long uploader names (an archive.org account plus the original YouTube uploader) wrap instead of being clipped (R4-02).
  assert(/overflow-wrap:anywhere/.test(body('.u-by')), 'Uploader names on upload cards wrap');
  // A number range isolated in a Hebrew note ("#1–#12") is not split after its dash (R4-04).
  assert(/white-space:nowrap/.test(body('.num-range')), 'Number ranges in Hebrew notes stay on one line');
  // A Watch link that failed a check is styled apart from working links on tiles and buttons (R4-01).
  assert(has('.tbtn.bad', /background:transparent/) && has('.btn.bad', /background:transparent/) &&
    has('.btn.bad', /color:var\(--muted\)/), 'Failed Watch links are styled apart');
  assert(/display:none/.test(body('.wl-short')), 'The short List label is hidden by default');
  const phone = css.match(/@media \(max-width:480px\)\{([\s\S]*?)\n\}/)[1];
  assert(/\.eptable \.wl-long\{display:none\}/.test(phone) && /\.eptable \.wl-short\{display:inline\}/.test(phone) &&
    /\.eptable \.c-title\{min-width:\d+px\}/.test(phone), 'Phones show the short List Watch label and keep the title column');
  const phoneRules = [...phone.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({sels: m[1].split(',').map(x => x.trim()), body: m[2]}));
  for (const sel of ['.eptable .c-act', '.eptable .c-act .btn', '.eptable .c-cov']) {
    assert(phoneRules.some(r => r.sels.includes(sel) && /white-space:normal/.test(r.body)), 'Phones let List cells wrap: ' + sel);
  }
  // A failed link's phone List label: the mark is hidden like the icon and the host word is struck through, so the
  // label is no wider than a working link's and the table still fits at 320 px (R4-01).
  assert(phoneRules.some(r => r.sels.includes('.eptable .c-act .btn .acc-bad') && /display:none/.test(r.body)) &&
    phoneRules.some(r => r.sels.includes('.eptable .c-act .btn.bad .wl-short') && /text-decoration:line-through/.test(r.body)),
    'Phones strike through a failed link\'s List label instead of widening it');
  // A long word in an English title ("Thunderclaps") breaks inside the title column, so the table fits at 320 px (R3-02).
  assert(phoneRules.some(r => r.sels.includes('.eptable .c-title a') && /overflow-wrap:anywhere/.test(r.body)),
    'Phones break long List titles inside the title column');
  // Masthead: no brand rules; a physical grid (views nav, then the control group at the right edge) in both directions, and
  // one row on phones; the toggle's thumb is placed physically and follows aria-checked; masthead colours are tokens with
  // enough contrast on the masthead colour in every palette and scheme; the thumb slides only without reduced motion.
  assert(!rules.some(r => /\.(?:brand|sign|brand-cap)\b/.test(r.sel)), 'No brand rules');
  assert(/display:grid/.test(body('.mast')) && /grid-template-columns:minmax\(0,1fr\) auto/.test(body('.mast')) &&
    /direction:ltr/.test(body('.mast')), 'The masthead is a left-to-right grid: the views nav, then the control group on the right');
  assert(/direction:rtl/.test(body('html[dir=rtl] .tabs')), 'The views nav takes the page direction back');
  assert(/grid-template-columns:1fr 1fr/.test(body('.lang')), 'The two language options are equally wide');
  assert(/left:var\(--lang-pad\)/.test(body('.lang-thumb')) && !/inset-inline|right:/.test(body('.lang-thumb')) &&
    /width:calc\(50% - var\(--lang-pad\)\)/.test(body('.lang-thumb')), 'The thumb is placed physically over the left option');
  assert(/transform:translateX\(100%\)/.test(body('.lang-opt[lang=he][aria-checked=true]~.lang-thumb')),
    'The thumb moves under עב when עב is checked');
  assert(/color:var\(--mast-current-ink\)/.test(body('.lang-opt[aria-checked=true]')), 'The checked option is drawn on the thumb');
  const mastRules = rules.filter(r => /\.(?:masthead|mast|mast-tools|tabs?|tab-[\w-]+|lang(?:-[\w-]+)?)\b/.test(r.sel));
  for (const r of mastRules) assert(!/#[0-9a-f]{3,8}\b/i.test(r.body), 'Masthead colours are custom properties: ' + r.sel);
  const motion = css.match(/@media \(prefers-reduced-motion:no-preference\)\{([\s\S]*?)\n\}/)[1];
  assert(/\.lang-thumb\{transition:transform \.\d+s/.test(motion) && rules.filter(r => r.sel === '.lang-thumb' && /transition/.test(r.body)).length === 1,
    'The thumb slides only when reduced motion is not requested');
  assert(forcedRules.some(r => r.sels.includes('.lang-thumb') && /background:Highlight/.test(r.body)) &&
    forcedRules.some(r => r.sels.includes('.lang-thumb') && /forced-color-adjust:none/.test(r.body)) &&
    forcedRules.some(r => r.sels.includes('.lang-opt[aria-checked=true]') && /color:HighlightText/.test(r.body)),
    'Forced colors keep the thumb as a system highlight under the checked option');
  const phone760 = css.match(/@media \(max-width:760px\)\{([\s\S]*?)\n\}/)[1];
  const p760 = sel => [...phone760.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => m[1].trim() === sel).map(m => m[2]).join(';');
  // Phones: the views nav is a bar fixed to the bottom, five tabs sharing the width, Surprise among them (the masthead's
  // Surprise pill is hidden); the page keeps room for the bar so the footer and focused controls stay in view.
  assert(/position:fixed/.test(p760('.tabs')) && /bottom:0/.test(p760('.tabs')) && /inset-inline:0/.test(p760('.tabs')) &&
    /safe-area-inset-bottom/.test(p760('.tabs')), 'Phones fix the views nav to the bottom, inside the safe area');
  assert(/display:flex/.test(body('.tabs>ul')) && !/flex-wrap/.test(body('.tabs>ul')) && /flex:1 1 0/.test(p760('.tabs>ul>li')),
    'The bottom bar\'s tabs share its width on one row');
  assert(/display:none/.test(body('.tab-pick')) && /display:block/.test(p760('.tab-pick')) && /display:none/.test(p760('.surprise-btn')),
    'Surprise is in the bottom bar on phones and in the masthead on wider screens, never both');
  assert(/padding-bottom:calc\(\d+px/.test(p760('body')) && /scroll-padding-bottom/.test(p760('html')) &&
    /bottom:calc\(\d+px/.test(p760('.toast')), 'The bar never covers the footer, a focused control or a toast');
  assert(/grid-column:2/.test(p760('.mast-tools')), 'The controls keep the masthead\'s right edge');
  assert(!rules.some(r => /\.(?:tab-split|tab-more|bmenu|bm-[\w-]+)\b/.test(r.sel)), 'No Browse menu rules');
  // Popovers (Surprise, the queue): placed by logical properties, above the sticky toolbar and the bottom bar; a sheet above the
  // bar on phones. Their controls and the queue's are 44 px targets.
  const pop = body('.pop'), pz = Number((pop.match(/z-index:(\d+)/) || [])[1]), barZ = Number((p760('.tabs').match(/z-index:(\d+)/) || [])[1]);
  assert(/position:fixed/.test(pop) && /inset-inline-end:16px/.test(pop) && !/(?:^|;)(?:left|right):/.test(pop) && pz > barZ && barZ > 4,
    'Popovers are placed logically, above the toolbar and the bottom bar');
  assert(/inset-inline:8px/.test(p760('.pop')) && /bottom:calc/.test(p760('.pop')), 'On phones a popover is a sheet above the bottom bar');
  // The queue, Again and the queue bar use their own classes: the identification queues' .qtext links stretch over their item.
  assert(/position:relative/.test(body('.srow,.arow')) && !/\b(?:qtext|qthumb|qlist)\b/.test(rules.filter(r => /\.(?:srow|arow|slist|alist|qbar)/.test(r.sel)).map(r => r.sel).join(' ')),
    'Queue and Again rows contain their links');
  for (const sel of ['.qadd', '.qbtn', '.pop-x']) assert(/width:44px/.test(body(sel)) && /height:44px/.test(body(sel)), sel + ' is a 44 px target');
  assert(css.includes('@media (pointer:coarse) and (min-width:761px){.tab{min-height:44px}}'), 'On wide touch screens the tabs are 44 px targets');
  for (const r of rules.filter(x => /\.(?:mbtn|qcount|pop|qbar|foot-links)\b/.test(x.sel))) assert(!/#[0-9a-f]{3,8}\b/i.test(r.body), 'Colours are custom properties: ' + r.sel);
  const blend = (fg, bg) => blendOver(hex6(fg), hex6(bg).slice(0, 7));
  const six = hex6;
  for (const [name, t] of schemes) {
    const T = k => six(t[k]), track = blend(t['mast-ctl'], T('brand'));
    for (const [what, fg, bg, min] of [['tab labels', T('mast-ink-soft'), T('brand'), 4.5],
      ['the unchecked language', T('mast-ink-soft'), track, 4.5], ['the checked language and the current tab', T('mast-current-ink'), T('mast-current'), 4.5],
      ['the toggle outline', blend(t['mast-ctl-line'], T('brand')), T('brand'), 3], ['the thumb', T('mast-current'), track, 3],
      ['the focus ring', T('mast-focus'), T('brand'), 3], ['the Surprise and queue labels', T('mast-ink'), track, 4.5],
      ['an open Surprise or queue button', T('mast-current-ink'), T('mast-current'), 4.5],
      ['the popover focus ring', T('focus'), T('surface'), 3]]) {
      assert(ratio(fg, bg) >= min, `${name}: ${what} reach ${min}:1 on the masthead (${ratio(fg, bg).toFixed(2)})`);
    }
  }
  // The theme picker: a fixed-size round button (no text, so the same box in both languages), a popover pinned to the control
  // group's right edge (the group is pinned right in both directions) below the band, above the sticky toolbar, with the
  // page direction and the page focus ring; the popover fades in only without reduced motion; forced colours mark the open
  // button and the checked options without colour and keep the swatches as samples.
  assert(/position:relative/.test(body('.mast-tools')) && /align-self:stretch/.test(body('.mast-tools')), 'The control group is positioned and spans the band');
  const tbtn = body('.theme-btn'), tpop = body('.tp'), tz = Number((tpop.match(/z-index:(\d+)/) || [])[1]);
  assert(/(?:^|;)width:40px/.test(tbtn) && /(?:^|;)height:40px/.test(tbtn) && /\.theme-btn\{width:36px;height:36px\}/.test(phone),
    'The theme button is 40 px, 36 px at 480 px and below');
  assert(/position:absolute/.test(tpop) && /(?:^|;)right:0(?:;|$)/.test(tpop) && !/inset-inline|(?:^|;)left:/.test(tpop) && tz > 4 &&
    /top:calc\(100% \+ \d+px\)/.test(tpop) && /width:min\(\d+px,calc\(100vw - \d+px\)\)/.test(tpop), 'The popover drops from the right edge of the controls');
  assert(/top:calc\(100% \+ \d+px\)/.test(p760('.tp')), 'On phones the popover clears the band too');
  assert(/direction:rtl/.test(body('html[dir=rtl] .tp')), 'The popover takes the page direction');
  assert(/outline-color:var\(--focus\)/.test(body('.masthead .tp :focus-visible')), 'The popover uses the page focus ring');
  assert(/\.tp\{animation:tp-in/.test(motion) && rules.filter(r => r.sel === '.tp' && /animation/.test(r.body)).length === 1, 'The popover fades in only without reduced motion');
  assert(/min-height:44px/.test(body('.tp-pal')), 'Palette options are 44 px targets');
  assert(forcedRules.some(r => r.sels.includes('.theme-btn[aria-expanded=true]') && /outline:\d/.test(r.body)) &&
    forcedRules.some(r => r.sels.includes('.tp-pal[aria-checked=true]') && /outline:\d/.test(r.body)) &&
    forcedRules.some(r => r.sels.includes('.tp-app[aria-checked=true]') && /outline:\d/.test(r.body)) &&
    forcedRules.some(r => r.sels.includes('.tp-pal[aria-checked=true] .tp-name') && /underline/.test(r.body)) &&
    forcedRules.some(r => r.sels.includes('.tp-sw') && /forced-color-adjust:none/.test(r.body)), 'Forced colours mark the theme picker\'s state');
  assert(/visibility:visible/.test(body('.tp-pal[aria-checked=true] .tp-check')) && /visibility:hidden/.test(body('.tp-check')),
    'The checked palette has a check mark, not only a colour');
  // Every rule with its @media context (also a block added on one line), for the checks that must see all of them.
  const ctxRules = cssRulesIn(css);
  const inPhone = r => /max-width:480px/.test(r.media), inBase = r => !r.media;
  // Review round 1: the masthead controls keep one box in English and Hebrew. No rule scoped by the page's direction or language
  // styles them (only the views nav takes the page direction back, and the popover's content its direction); the checked or
  // focused option changes no font, padding, spacing or width; phones keep the short labels.
  const MAST_CTL = /\.(?:mast|mast-tools|theme|theme-btn|lang|lang-opt|lang-thumb|lang-long|lang-short|tabs?|tab-[\w-]+)(?![\w-])/;
  const ALLOWED_SCOPED = ['html[dir=rtl] .tabs', '.lang-opt[lang=he][aria-checked=true]~.lang-thumb'];
  for (const r of ctxRules) {
    for (const sel of r.sel.split(',').map(x => x.trim())) {
      if (/\[dir|:dir\(|:lang\(|\[lang/.test(sel) && MAST_CTL.test(sel) && !ALLOWED_SCOPED.includes(sel)) {
        assert.fail(`A masthead control is styled by the page's direction or language (${r.media || 'all'}): ${sel}`);
      }
      if (/\.lang-opt/.test(sel) && /\[aria-checked|:focus|:hover|:active/.test(sel)) {
        assert(!/(?:^|;)\s*(?:font[\w-]*|padding[\w-]*|letter-spacing|(?:min-|max-)?width|margin[\w-]*|border(?:-width)?)\s*:/.test(r.body),
          'A checked, focused or hovered language option keeps its box: ' + sel + '{' + r.body + '}');
      }
    }
  }
  const langLabelRules = ctxRules.filter(r => /\.lang-(?:long|short)(?![\w-])/.test(r.sel));
  assert.deepEqual(langLabelRules.map(r => [r.media, r.sel, r.body]), [['', '.lang-short', 'display:none'],
    ['(max-width:480px)', '.lang-long', 'display:none'], ['(max-width:480px)', '.lang-short', 'display:inline']],
    'Phones show only the short language labels, and nothing else changes them');
  assert(/(?:^|;)direction:ltr/.test(ctxRules.filter(r => r.sel === '.mast').map(r => r.body).join(';')) &&
    ctxRules.filter(r => r.sel.split(',').some(x => /\.mast(?![\w-])/.test(x)) && /grid-template-columns|direction/.test(r.body)).every(r =>
      r.sel === '.mast' && inBase(r)), 'Only the base rule sets the masthead grid and its direction');
  // The focus ring of a phone-width language option stays clear of the other option's label.
  const phoneRing = ctxRules.find(r => inPhone(r) && r.sel === '.lang-opt:focus-visible');
  assert(phoneRing && Number((phoneRing.body.match(/outline-offset:(-?\d+)px/) || [])[1]) <= 0, 'At 480 px and below the language ring is drawn close in');
  // The theme popover on phones is placed from the band, whose box leaves out a classic scrollbar, so it stays on screen.
  const phoneTp = ctxRules.filter(r => inPhone(r) && r.sel === '.tp').map(r => r.body).join(';');
  assert(ctxRules.some(r => inPhone(r) && r.sel === '.mast-tools' && /position:static/.test(r.body)) && /(?:^|;)left:10px/.test(phoneTp) &&
    /(?:^|;)right:10px/.test(phoneTp) && /(?:^|;)width:auto/.test(phoneTp) && /max-width:360px/.test(phoneTp) && !/100vw/.test(phoneTp),
    'At 480 px and below the popover spans the band between 10 px insets, not 100vw');
  // The phone Starred badge sits on the icon's corner and is capped at "99+", the full count visually hidden but read.
  assert(/inset-inline-start:calc\(50% \+ 2px\)/.test(p760('.tab-count')) && /display:none/.test(body('.tab-count .cnt-short')) &&
    /display:inline/.test(p760('.tab-count .cnt-short')) && /clip:rect\(0,0,0,0\)/.test(p760('.tab-count .cnt-full')) &&
    !/display:none/.test(p760('.tab-count .cnt-full')), 'Phones show a capped Starred badge on the icon, with the full count still read');
  assert(/scrollbar-gutter:stable/.test(body('html')), 'The scrollbar gutter is kept on short pages, so the masthead does not move between routes');
  // Evidence in words (request 06): no bar glyph rules; the badge is a chip in the chip colours; compact List rows show it only
  // where the Evidence column is hidden.
  assert(!ctxRules.some(r => /\.pips?(?![\w-])/.test(r.sel)), 'No evidence bar glyph rules');
  assert(/background:var\(--chip\)/.test(body('.ev-badge')) && /color:var\(--chip-ink\)/.test(body('.ev-badge')) &&
    !/aria-hidden|content:/.test(body('.ev-badge')), 'The evidence badge is text on a chip');
  assert(/display:none/.test(body('.eptable .c-title .ev-inline')) && /display:(?:table|inline-block|block|inline-flex)/.test(p760('.eptable .c-title .ev-inline')) &&
    /display:none/.test(p760('.eptable .c-ev,.eptable .c-links')), 'The compact List badge shows only where the Evidence column is hidden');
  ok('CSS: positioned scroll containers, alt-free generated glyphs, wrapping kicker labels, strip contrast, toolbar room, unclipped ' +
    'focus rings, forced-colors state marks, wrapping tile labels, search box padding, phone-width Watch labels, notes and host chips, ' +
    'wrapping guide tags on upload cards, breaking List titles, wrapping uploader names, failed Watch links, unbroken number ranges; ' +
    'masthead without brand rules, a physical layout, a thumb that follows aria-checked, token colours with masthead contrast, ' +
    'motion only without reduced motion, forced-colors thumb; on phones a bottom views bar with Surprise in it, room kept for it, the ' +
    'controls on the right; no Browse menu rules; popovers placed logically above the bar, a sheet on phones, 44 px controls; ' +
    'no direction- or language-scoped masthead control rules, option states that keep their box, phone-only short ' +
    'labels, a close phone focus ring, a band-placed phone popover, a stable scrollbar gutter, a capped phone Starred badge; ' +
    'evidence badges as text, no bar glyph rules');
}

// Builder validation, run against fixture inputs in a temporary directory (never the project's index.html).
function checkBuilder() {
  const builder = path.join(__dirname, 'build-library.py');
  if (!fs.existsSync(builder)) return;
  const py = spawnSync('python3', ['--version']); if (py.status !== 0) { ok('builder checks skipped (python3 not found)'); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sumsum-builder-'));
  // The temporary directory is removed whether the checks pass or fail.
  try { builderChecks(builder, dir); } finally { fs.rmSync(dir, {recursive: true, force: true}); }
}
function builderChecks(builder, dir) {
  const write = (name, value) => { const f = path.join(dir, name); fs.writeFileSync(f, typeof value === 'string' ? value : JSON.stringify(value)); return f; };
  const guideFile = write('empty-guide.json', {productions: [], episodes: [], unidentified: {}});
  const rec = (id, url, extra = {}) => ({id, url, series: 'classic', kind: 'episode', titleEn: 'Fixture ' + id, ...extra});
  const run = (records, {guide = guideFile, keep = false, services = null, series = null, vocabulary = null, priority = null, parts = []} = {}) => {
    const input = write('fixture-records.json', typeof records === 'string' ? records : {records});
    const out = path.join(dir, 'out.html'); if (!keep) fs.writeFileSync(out, 'KEEP');
    const r = spawnSync('python3', [builder, input, '--guide', guide, ...(services ? ['--services', services] : []),
      ...(series ? ['--series', series] : []), ...(vocabulary ? ['--vocabulary', vocabulary] : []),
      ...(priority ? ['--link-priority', priority] : []), ...parts.flatMap(x => ['--guide-part', x]), '--output', out],
      {encoding: 'utf8'});
    return {status: r.status, text: (r.stdout || '') + (r.stderr || ''), out: fs.readFileSync(out, 'utf8')};
  };
  const fails = (res, pattern, label) => {
    assert.notEqual(res.status, 0, 'Builder refuses: ' + label);
    if (process.env.CHECK_TRACE && /TypeError/.test(res.text)) console.error(res.text);
    assert(!/TypeError|Traceback \(most recent call last\):[\s\S]*TypeError/.test(res.text), 'Clear error, not a TypeError: ' + label);
    assert(pattern.test(res.text), `Builder error names the problem (${label}): ${res.text.split('\n').filter(Boolean).at(-1)}`);
    assert.equal(res.out, 'KEEP', 'A failed build leaves the previous output untouched: ' + label);
  };
  const okBuild = run([rec('fx-a', 'https://www.youtube.com/watch?v=AAAAAAAAAA1'), {url: 'https://archive.org/details/fx/file.mp4',
    series: 'classic', kind: 'episode', title: 'Title-only fixture'}]);
  assert.equal(okBuild.status, 0, okBuild.text);
  const built = JSON.parse(okBuild.out.match(/<script id="library-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert(built.records.some(r => r.id === 'https://archive.org/details/fx/file.mp4' && r.title === 'Title-only fixture'),
    'A record without an id gets its URL as id; title-only records are accepted');
  fails(run([rec('fx-dup', 'https://www.youtube.com/watch?v=AAAAAAAAAA1'), rec('fx-dup', 'https://www.youtube.com/watch?v=AAAAAAAAAA2')]),
    /fx-dup.*AAAAAAAAAA1.*fixture-records\.json, entry 1.*AAAAAAAAAA2.*entry 2/s, 'one id for two URLs');
  fails(run('{"records": [{"id": "fx-s", "url": "https://www.youtube.com/watch?v=AAAAAAAAAA1", "series": "classic", ' +
    '"kind": "episode", "titleEn": "Cut \\ud83d"}]}'), /fixture-records\.json, entry 1.*lone surrogate/, 'lone surrogate');
  fails(run('{"records": [,]}'), /fixture-records\.json: invalid JSON/, 'invalid JSON');
  fails(run([rec('fx-n', 'https://www.youtube.com/watch?v=AAAAAAAAAA1', {themes: [null]})]), /themes entries/, 'null tag');
  for (const bad of ['https://www.youtube.com:99999/watch?v=x', 'https://www.you tube.com/watch?v=x', 'https://exa%zzmple.com/x']) {
    fails(run([rec('fx-u', bad)]), /valid public url required/, 'URL the browser rejects: ' + bad);
  }
  fails(run([rec('fx-k', 'https://www.youtube.com/watch?v=AAAAAAAAAA1', {series: ['classic']})]), /unknown series/, 'list-valued series');
  // The series registry: a series added there is accepted and embedded; a malformed registry is refused.
  const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'series.json'), 'utf8'));
  const withSeries = edit => { const reg = JSON.parse(JSON.stringify(registry)); edit(reg); return write('series.json', reg); };
  const usSeries = {id: 'us-street', en: 'US street', he: 'רחוב אמריקאי', family: 'us', searchPrefix: 'Street', searchLanguage: 'en'};
  const addUs = reg => { reg.families.push({id: 'us', en: 'US', he: 'אמריקאי'}); reg.series.push({...usSeries}); };
  const usBuild = run([rec('fx-us', 'https://www.youtube.com/watch?v=AAAAAAAAAA1', {series: 'us-street'})], {series: withSeries(addUs)});
  assert.equal(usBuild.status, 0, usBuild.text);
  const usPayload = JSON.parse(usBuild.out.match(/<script id="library-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(usPayload.series.series.at(-1), usSeries, 'The registry is embedded with the added series');
  // The tag vocabulary: embedded as given; malformed names are refused.
  const vocab = tags => write('vocabulary.json', {tags});
  const vocabBuild = run([rec('fx-v', 'https://www.youtube.com/watch?v=AAAAAAAAAA1')], {vocabulary: vocab({'big bird': ['Big Bird', 'ציפורת']})});
  assert.equal(vocabBuild.status, 0, vocabBuild.text);
  assert.deepEqual(JSON.parse(vocabBuild.out.match(/<script id="library-data" type="application\/json">([\s\S]*?)<\/script>/)[1]).vocabulary,
    {tags: {'big bird': ['Big Bird', 'ציפורת']}}, 'The vocabulary is embedded as given');
  for (const [label, tags, pattern] of [['capital key', {'Big Bird': ['Big Bird', 'ציפורת']}, /tag 'Big Bird': keys are non-empty lowercase/],
    ['one name', {'elmo': ['Elmo']}, /tag 'elmo': expected \[English, Hebrew\] names/],
    ['Hebrew name in Latin letters', {'elmo': ['Elmo', 'Elmo']}, /the Hebrew name has no Hebrew letters/],
    ['reserved key', {'constructor': ['Constructor', 'בנאי']}, /tag 'constructor': keys are non-empty lowercase tags.*\(not a reserved name\)/],
    ['padded key', {' elmo': ['Elmo', 'אלמו']}, /without outer spaces/],
    ['empty table', {}, /non-empty tags object/]]) {
    fails(run([rec('fx-v', 'https://www.youtube.com/watch?v=AAAAAAAAAA1')], {vocabulary: vocab(tags)}), pattern, 'vocabulary: ' + label);
  }
  fails(run([rec('fx-v', 'https://www.youtube.com/watch?v=AAAAAAAAAA1')],
    {vocabulary: write('vocabulary.json', '{"tags": {"bert": ["Bert", "בנץ"], "bert": ["Bert", "ברט"]}}')}),
  /vocabulary\.json: key 'bert' appears twice in one object/, 'vocabulary: a repeated key');
  for (const [flag, name] of [['series', 'missing-series.json'], ['vocabulary', 'missing-vocabulary.json']]) {
    fails(run([rec('fx-v', 'https://www.youtube.com/watch?v=AAAAAAAAAA1')], {[flag]: path.join(dir, name)}),
      new RegExp(name.replace('.', '\\.') + ': not found'), `a missing ${flag} file`);
  }
  fails(run([rec('fx-us', 'https://www.youtube.com/watch?v=AAAAAAAAAA1', {series: 'us-street'})]), /unknown series 'us-street'.*series\.json/,
    'a series missing from the registry');
  for (const [label, edit, pattern] of [
    ['duplicate series id', reg => reg.series.push({...reg.series[0]}), /series 'modern': duplicate or reserved series id/],
    ['unknown family', reg => reg.series.push({...usSeries}), /series 'us-street': family 'us' is not listed in families/],
    ['list-valued family', reg => reg.series.push({...usSeries, family: ['us']}), /family \['us'\] is not listed/],
    ['Hebrew label without Hebrew', reg => { addUs(reg); reg.series.at(-1).he = 'US'; }, /series 'us-street'\.he has no Hebrew letters/],
    ['search language', reg => { addUs(reg); reg.series.at(-1).searchLanguage = 'fr'; }, /searchLanguage must be 'he' or 'en'/],
    ['goal across families', reg => { addUs(reg); reg.goal.push({series: 'us-street', en: 'US', he: 'אמריקאי'}); }, /goal series must belong to one family/],
    ['goal series listed twice', reg => reg.goal.push({...reg.goal[0]}), /goal row 3: series 'classic' is listed twice/],
    ['goal row without labels', reg => reg.goal.push({series: 'elmo'}), /goal row 3 must be \{en, he\}/],
    ['all-digit id', reg => reg.series.push({...usSeries, id: '1969', family: 'rechov'}), /series '1969': an id needs a letter/],
    ['empty families', reg => { reg.families = []; }, /families must be a non-empty array/]]) {
    fails(run([rec('fx-r', 'https://www.youtube.com/watch?v=AAAAAAAAAA1')], {series: withSeries(edit)}), pattern, 'series registry: ' + label);
  }
  const verified = run([rec('fx-p', 'https://www.youtube.com/watch?v=AAAAAAAAAA1', {playbackVerified: true, playbackWithoutVpn: true})]);
  assert.equal(verified.status, 0); assert(/playbackVerified without playbackUrl/.test(verified.text), 'Playback evidence without playbackUrl is reported');
  // Guide validation: malformed values and evidence details that the app would ignore.
  const recs = [rec('fx-w', 'https://www.youtube.com/watch?v=AAAAAAAAAA1'), rec('fx-x', 'https://www.youtube.com/watch?v=AAAAAAAAAA2')];
  const guide = (episode, prod = {}) => write('fixture-guide.json', {productions: [{id: 'fx-prod', series: 'classic', format: 'core',
    nameEn: 'Fixture production', expectedTotal: null, seasons: [], totalsEvidence: [], ...prod}],
    episodes: [{id: 'fx-ep', production: 'fx-prod', season: 1, number: 1,
    confidence: 'documented', uploads: [{recordId: 'fx-w', role: 'whole-candidate'}, {recordId: 'fx-x', role: 'excerpt'}], ...episode}],
    unidentified: {}});
  const detail = (extra = {}) => ({level: 'complete-playback-reviewed', recordId: 'fx-w', url: 'https://www.youtube.com/watch?v=AAAAAAAAAA1',
    checkedAt: '2026-10-17', ...extra});
  assert.equal(run(recs, {guide: guide({evidence: 'complete-playback-reviewed', evidenceDetail: detail()})}).status, 0, 'A valid evidence detail builds');
  const crossed = run(recs, {guide: guide({}, {series: 'modern'})});
  assert.equal(crossed.status, 0, crossed.text);
  assert(/2 uploads belong to a production of another series: fx-w \(classic, in fx-prod\); fx-x \(classic, in fx-prod\)/.test(crossed.text),
    'An upload linked to a production of another series is reported');
  assert(!/production of another series/.test(run(recs, {guide: guide({})}).text), 'Uploads of the production\'s own series are not reported');
  for (const [label, episode, pattern] of [
    ['level disagrees', {evidence: 'metadata-checked', evidenceDetail: detail({level: 'reference-compared'})}, /disagrees with the episode's evidence/],
    ['level missing', {evidence: 'reference-compared', evidenceDetail: detail({level: undefined})}, /level must be one of/],
    ['excerpt while a whole upload exists', {evidence: 'complete-playback-reviewed', evidenceDetail: detail({recordId: 'fx-x',
      url: 'https://www.youtube.com/watch?v=AAAAAAAAAA2'})}, /is a excerpt, but the episode has whole/],
    ['URL of another video', {evidence: 'complete-playback-reviewed', evidenceDetail: detail({url: 'https://example.com/other'})}, /is not one of record/],
    ['no ISO date', {evidence: 'complete-playback-reviewed', evidenceDetail: detail({checkedAt: 'yesterday'})}, /checkedAt must be an ISO date/],
    ['no detail', {evidence: 'reference-compared'}, /needs evidenceDetail/],
    ['list-valued confidence', {confidence: ['documented']}, /confidence must be one of/],
    ['object recordId', {uploads: [{recordId: {id: 'fx-w'}, role: 'whole-candidate'}]}, /is not in the records/],
    ['list-valued production', {production: ['fx-prod']}, /unknown production/]]) {
    fails(run(recs, {guide: guide(episode)}), pattern, 'guide: ' + label);
  }
  fails(run(recs, {guide: guide({}, {series: ['classic']})}), /unknown series/, 'guide: list-valued series');
  const queueGuide = JSON.parse(fs.readFileSync(guide({uploads: []})));
  queueGuide.unidentified = {'fx-prod': ['fx-w', ['fx-x']]};
  fails(run(recs, {guide: write('queue-guide.json', queueGuide)}), /unidentified\['fx-prod'\]: record \['fx-x'\] does not exist/,
    'guide: list-valued queue entry');
  fails(run(recs, {guide: write('bad-guide.json', '{"productions": [,]}')}), /bad-guide\.json: invalid JSON/, 'guide: invalid JSON');
  // Values the browser's JSON.parse rejects (NaN, Infinity, 1e999) would leave a blank page: refused, with a line.
  const raw = extra => '{"records": [{"id": "fx-nan", "url": "https://www.youtube.com/watch?v=AAAAAAAAAA1", "series": "classic", ' +
    '"kind": "episode", "titleEn": "A"' + extra + '}]}';
  fails(run(raw(', "durationSeconds": NaN')), /fixture-records\.json, line 1: NaN is not a JSON number/, 'NaN');
  fails(run(raw(', "durationSeconds": -Infinity')), /-Infinity is not a JSON number/, 'Infinity');
  fails(run(raw(', "durationSeconds": 1e999')), /number 1e999 is too large/, '1e999');
  const nanGuide = JSON.stringify(JSON.parse(fs.readFileSync(guide({})))).replace('"expectedTotal":null', '"expectedTotal":null,"order":NaN');
  fails(run(recs, {guide: write('nan-guide.json', nanGuide)}), /nan-guide\.json, line 1: NaN/, 'guide: NaN');
  // Exact, copyable URLs: a literal space is refused with a fix; reserved ids; display fields must be text.
  fails(run([rec('fx-sp', 'https://archive.org/details/item/Rechov Sumsum 001.mp4')]), /percent-encode spaces as %20/, 'space in a URL');
  fails(run([rec('__proto__', 'https://www.youtube.com/watch?v=AAAAAAAAAA1')]), /record id '__proto__' is reserved/, 'reserved id');
  fails(run([rec('fx-o', 'https://www.youtube.com/watch?v=AAAAAAAAAA1', {titleEn: {en: 'Object title'}})]),
    /entry 1: titleEn must be a string or null/, 'object title');
  fails(run([rec('fx-o', 'https://www.youtube.com/watch?v=AAAAAAAAAA1', {uploader: ['x']})]), /uploader must be a string/, 'list uploader');
  fails(run(recs, {guide: guide({}, {nameEn: undefined})}), /production 'fx-prod': nameEn or nameHe required/, 'guide: nameless production');
  fails(run(recs, {guide: guide({}, {seasons: [{season: 1, labelEn: {en: 'Season 1'}}]})}), /season 1: labelEn must be a string/,
    'guide: object season label');
  fails(run(recs, {guide: guide({titleEn: {en: 'x'}})}), /episode 'fx-ep': titleEn must be a string/, 'guide: object episode title');
  fails(run(recs, {guide: guide({sources: [{label: 5}]})}), /source 1: label must be a string/, 'guide: number source label');
  // One URL in two spellings is one upload; an evidence URL in the other spelling is accepted (the app compares them so).
  const ia = 'https://archive.org/details/rs-1984/רחוב_001.mp4', iaEnc = 'https://archive.org/details/rs-1984/%D7%A8%D7%97%D7%95%D7%91_001.mp4';
  const merged = run([rec('fx-r', ia), rec('fx-e', iaEnc), rec('fx-y1', 'https://www.youtube.com/watch?v=pOZMqQkshT8'),
    rec('fx-y2', 'https://WWW.YouTube.com/watch?v=pOZMqQkshT8')]);
  assert.equal(merged.status, 0, merged.text);
  const mergedIds = JSON.parse(merged.out.match(/<script id="library-data" type="application\/json">([\s\S]*?)<\/script>/)[1]).records.map(r => r.id);
  assert.deepEqual(mergedIds, ['fx-r', 'fx-y1'], 'Raw and percent-encoded spellings of one URL merge');
  const evRecs = [rec('fx-w', ia), rec('fx-x', 'https://www.youtube.com/watch?v=AAAAAAAAAA2')];
  assert.equal(run(evRecs, {guide: guide({evidence: 'complete-playback-reviewed', evidenceDetail: detail({url: iaEnc})})}).status, 0,
    'An evidence URL in the percent-encoded spelling of the record URL is accepted');
  // Warnings: episodes outside the declared seasons; one video under two URLs.
  const outside = run(recs, {guide: guide({season: null}, {seasons: [{season: 1, expectedEpisodes: 2}]})});
  assert.equal(outside.status, 0); assert(/1 episodes have a season \(null\) that is not declared in seasons\[\] \(1\)/.test(outside.text),
    'Episodes outside the declared seasons are reported: ' + outside.text);
  const twice = run([rec('fx-t1', 'https://youtu.be/pOZMqQkshT8'), rec('fx-t2', 'https://www.youtube.com/watch?v=pOZMqQkshT8')]);
  assert.equal(twice.status, 0); assert(/youtube:pOZMqQkshT8: fx-t1, fx-t2/.test(twice.text), 'One video under two URLs is reported');
  // Contract additions: new enum values are accepted, unknown ones refused with located messages.
  const builds = (label, res, warn) => {
    assert.equal(res.status, 0, label + ': ' + res.text);
    if (warn) assert(warn.test(res.text), `${label}: warning ${warn}: ${res.text}`);
  };
  builds('licensed access', run([rec('fx-l', 'https://www.hoopladigital.com/title/1', {access: 'licensed'})]));
  fails(run([rec('fx-l', 'https://www.hoopladigital.com/title/1', {access: 'paid'})]), /entry 1: access must be one of .*'paid'/,
    'unknown access value');
  fails(run([rec('fx-l', 'https://www.hoopladigital.com/title/1', {access: ['licensed']})]), /access must be one of/, 'list-valued access');
  // Licensed services: a valid file builds and is embedded; a malformed entry fails with a located message and keeps the
  // previous output; a licensed record no service describes, and a service without records, are warnings.
  const svcOk = () => ({format: 'sumsum-licensed-services-v1', checkedAt: '2026-10-18', services: [{id: 'fx-lib', name: 'Fixture Library',
    hosts: ['hoopladigital.com'], model: 'library-card', summary: {en: 'Free with a card.', he: 'חינם עם כרטיס.'},
    howTo: {headline: {en: 'Get a Fixture Public Library card.', he: 'משיגים כרטיס של ספרייה.', libraries: ['l1'], participates: true, sources: ['s1']},
      steps: [{en: 'Sign in.', he: 'מתחברים.', sources: ['s1', 'u1'], link: {url: 'https://www.hoopladigital.com/register', label: {en: 'Find', he: 'חיפוש'}}}]},
    lookupUrl: 'https://www.hoopladigital.com/register',
    libraries: [{id: 'l1', name: {en: 'Fixture Public Library', he: 'ספרייה'}, participates: true, sources: ['s1', 'u1']}],
    sources: [{id: 's1', kind: 'library-page', title: 'Page', url: 'https://example.org/p', checkedAt: '2026-10-18', finding: 'Says so.'},
      {id: 'u1', kind: 'user-observation', title: 'Observation', checkedAt: '2026-10-18', finding: 'Reported.'}]}]});
  const licRecs = [rec('fx-l', 'https://www.hoopladigital.com/title/1', {access: 'licensed'})];
  const svcRun = (data, records = licRecs) => run(records, {services: write('fixture-services.json', data)});
  const svcGood = svcRun(svcOk());
  builds('licensed services', svcGood);
  const svcBuilt = JSON.parse(svcGood.out.match(/<script id="library-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(svcBuilt.services.services[0].id, 'fx-lib', 'The services file is embedded');
  assert.equal(svcBuilt.meta.servicesFile, 'fixture-services.json', 'meta names the services file');
  builds('licensed record without a service', svcRun(svcOk(), [rec('fx-v', 'https://www.vudu.com/x/1', {access: 'licensed'})]),
    /licensed record 'fx-v' \(www\.vudu\.com\) matches no service[\s\S]*service 'fx-lib' in fixture-services\.json has no licensed record/);
  fails(run(licRecs, {services: path.join(dir, 'no-such-services.json')}), /Licensed services file not found/, 'explicit missing services file');
  const svcBad = (label, change, pattern) => { const d = svcOk(); change(d, d.services[0]); fails(svcRun(d), pattern, 'services: ' + label); };
  svcBad('empty list', d => { d.services = []; }, /fixture-services\.json: expected an object with a non-empty services list/);
  svcBad('no check date', d => { delete d.checkedAt; }, /fixture-services\.json: checkedAt must be a date/);
  svcBad('unknown model', (d, x) => { x.model = 'rental'; }, /service 'fx-lib': model must be one of .*'rental'/);
  svcBad('subscribed on a library-card service', (d, x) => { x.subscribed = true; }, /service 'fx-lib': subscribed may only be true, on a subscription service/);
  // The link order: every tier exactly once.
  const tiers = ['archive', 'youtube', 'subscribed', 'vimeo', 'other-free', 'vpn', 'library-card', 'free-with-ads', 'paid'];
  const prio = t => write('fixture-priority.json', {tiers: t});
  const recOnly = [rec('fx-o', 'https://www.youtube.com/watch?v=AAAAAAAAAA1')];
  assert.equal(run(recOnly, {priority: prio([...tiers].reverse())}).status, 0, 'A reordered link priority builds');
  for (const [label, t] of [['missing tier', tiers.slice(1)], ['repeated tier', [...tiers.slice(1), 'youtube']], ['unknown tier', [...tiers, 'kanopy']]]) {
    fails(run(recOnly, {priority: prio(t)}), /fixture-priority\.json: tiers must list each of/, 'link priority: ' + label);
  }
  fails(run(recOnly, {priority: path.join(dir, 'no-such-priority.json')}), /no-such-priority\.json: not found/, 'missing link priority file');
  svcBad('duplicate id', d => { d.services.push({...d.services[0], hosts: ['tv.apple.com']}); }, /service 2: duplicate service id 'fx-lib'/);
  svcBad('host with a scheme', (d, x) => { x.hosts = ['https://hoopladigital.com']; }, /host 'https:\/\/hoopladigital\.com' must be a bare lowercase hostname/);
  svcBad('host claimed twice', d => { d.services.push({...d.services[0], id: 'fx-two'}); }, /service 'fx-two': host 'hoopladigital\.com' is already claimed by service 'fx-lib'/);
  svcBad('missing Hebrew', (d, x) => { x.summary.he = ''; }, /service 'fx-lib': summary must be \{en, he\}/);
  svcBad('Hebrew without Hebrew letters', (d, x) => { x.howTo.steps[0].he = 'Sign in.'; }, /howTo step 1\.he has no Hebrew letters/);
  svcBad('step without sources', (d, x) => { delete x.howTo.headline.sources; }, /howTo headline: sources must name at least one source id/);
  svcBad('unknown source', (d, x) => { x.howTo.steps[0].sources = ['nope']; }, /howTo step 1: unknown source id 'nope'/);
  svcBad('bad link', (d, x) => { x.howTo.steps[0].link.url = 'javascript:alert(1)'; }, /howTo step 1: link must be \{url, label\}/);
  svcBad('source date', (d, x) => { x.sources[0].checkedAt = '18 October 2026'; }, /source 's1': checkedAt must be a date/);
  svcBad('source kind', (d, x) => { x.sources[0].kind = 'blog'; }, /source 's1': kind must be one of/);
  svcBad('page without url', (d, x) => { delete x.sources[0].url; }, /source 's1': a library-page needs a valid public url/);
  svcBad('source without finding', (d, x) => { x.sources[1].finding = ' '; }, /source 'u1': title and finding must be non-empty strings/);
  svcBad('no lookup url', (d, x) => { delete x.lookupUrl; }, /a library-card service needs a valid lookupUrl/);
  svcBad('no libraries', (d, x) => { x.libraries = []; }, /a library-card service needs a libraries list/);
  svcBad('participates not a boolean', (d, x) => { x.libraries[0].participates = 'yes'; }, /library 'l1': participates must be true or false/);
  svcBad('no participating library', (d, x) => { x.libraries[0].participates = false; }, /name at least one participating library/);
  svcBad('library without sources', (d, x) => { x.libraries[0].sources = []; }, /library 'l1': sources must name at least one source id/);
  svcBad('library-card without how-to', (d, x) => { delete x.howTo; }, /a library-card service with libraries needs howTo/);
  // A library-card service may be only a lookup link (Kanopy): no libraries, no how-to, but then a valid lookupUrl.
  builds('a lookup-only library-card service', svcRun((() => { const d = svcOk(); delete d.services[0].howTo; delete d.services[0].libraries; return d; })()));
  svcBad('a lookup-only service without its lookup URL', (d, x) => { delete x.howTo; delete x.libraries; delete x.lookupUrl; }, /needs howTo, or at least a valid lookupUrl/);
  // The how-to box shows the steps' prose, so the structured facts must agree with it (review round 1): each library is listed
  // by a step that names it in both languages and says whether its cards work; the lookup URL is a step's link; no fact is
  // checked after the build date.
  const noCards = {id: 'l2', name: {en: 'Other City Library', he: 'ספריית העיר האחרת'}, participates: false, sources: ['u1']};
  const noStep = {en: 'Other City Library cards do not work.', he: 'כרטיסים של ספריית העיר האחרת אינם עובדים.', libraries: ['l2'],
    participates: false, sources: ['u1']};
  builds('a non-participating library with its step', svcRun((() => { const d = svcOk(); d.services[0].libraries.push(noCards);
    d.services[0].howTo.steps.push(noStep); return d; })()));
  svcBad('no steps', (d, x) => { x.howTo.steps = []; }, /service 'fx-lib': a library-card service needs at least one howTo step/);
  svcBad('a library no step lists', (d, x) => { x.libraries.push(noCards); }, /library 'l2' is not listed by any howTo step/);
  svcBad('participation that disagrees with the step', (d, x) => { x.libraries.push({...noCards, participates: true}); x.howTo.steps.push(noStep); },
    /howTo step 2: says library 'l2' does not participate, but its libraries entry has participates true/);
  svcBad('a step that does not name its library', (d, x) => { x.libraries.push(noCards); x.howTo.steps.push({...noStep, he: 'הכרטיסים אינם עובדים.'}); },
    /howTo step 2: lists library 'l2' but its he text does not name it/);
  svcBad('an unknown library id', (d, x) => { x.howTo.steps[0].libraries = ['nope']; x.howTo.steps[0].participates = true; },
    /howTo step 1: unknown library id 'nope'/);
  svcBad('libraries without participates', (d, x) => { delete x.howTo.headline.participates; },
    /howTo headline: a step that lists libraries says whether their cards work/);
  svcBad('participates without libraries', (d, x) => { x.howTo.steps[0].participates = true; },
    /howTo step 1: participates describes the libraries listed in libraries, which is absent/);
  svcBad('a lookup URL that no step links', (d, x) => { x.lookupUrl = 'https://example.org/'; },
    /lookupUrl 'https:\/\/example\.org\/' is not the link of any howTo step/);
  svcBad('a source checked in the future', (d, x) => { x.sources[0].checkedAt = '2999-01-01'; }, /source 's1' checkedAt 2999-01-01 is after the build date/);
  svcBad('a file checked in the future', d => { d.checkedAt = '2999-01-01'; }, /fixture-services\.json: checkedAt 2999-01-01 is after the build date/);
  svcBad('a lead checked in the future', (d, x) => { x.leads = [{url: 'https://example.org/lead', checkedAt: '2999-01-01', note: 'Unconfirmed.'}]; },
    /lead 1 checkedAt 2999-01-01 is after the build date/);
  fails(svcRun('{"services": [,]}'), /fixture-services\.json: invalid JSON/, 'services: invalid JSON');
  builds('related-series format', run(recs, {guide: guide({}, {format: 'related-series'})}));
  fails(run(recs, {guide: guide({}, {format: 'related'})}), /production 'fx-prod': format must be one of .*'related'/, 'guide: unknown format');
  const possibleOnly = {uploads: [{recordId: 'fx-x', role: 'possible'}]};
  builds('possible role', run(recs, {guide: guide({uploads: [{recordId: 'fx-w', role: 'whole-candidate'}, {recordId: 'fx-x', role: 'possible'}]})}));
  builds('possible-only episode stated missing', run(recs, {guide: guide({...possibleOnly, coverage: 'missing'})}));
  fails(run(recs, {guide: guide({...possibleOnly, coverage: 'excerpt-only'})}), /stated coverage 'excerpt-only' disagrees .*'missing'/,
    'guide: a possible copy counted toward coverage');
  fails(run(recs, {guide: guide({uploads: [{recordId: 'fx-w', role: 'probable'}]})}), /episode 'fx-ep': unknown upload role 'probable'/,
    'guide: unknown role');
  fails(run(recs, {guide: guide({...possibleOnly, evidence: 'complete-playback-reviewed', evidenceDetail: detail({recordId: 'fx-x',
    url: 'https://www.youtube.com/watch?v=AAAAAAAAAA2'})})}), /evidenceDetail recordId 'fx-x' is a possible copy/, 'guide: evidence on a possible copy');
  const queuedPossible = JSON.parse(fs.readFileSync(guide(possibleOnly))); queuedPossible.unidentified = {'fx-prod': ['fx-x']};
  builds('a possible copy may stay queued', run(recs, {guide: write('queue-possible.json', queuedPossible)}));
  const partUps = extra => ({uploads: [{recordId: 'fx-w', role: 'part', ...extra}, {recordId: 'fx-x', role: 'part', part: 1}]});
  builds('explicit part numbers', run(recs, {guide: guide(partUps({part: 2}))}));
  for (const bad of [0, '2', 1.5]) {
    fails(run(recs, {guide: guide(partUps({part: bad}))}), /upload 'fx-w': part must be a positive integer/, 'guide: part ' + JSON.stringify(bad));
  }
  builds('part on an excerpt', run(recs, {guide: guide({uploads: [{recordId: 'fx-w', role: 'excerpt', part: 2}]})}), /only parts show a part number/);
  builds('repeated part numbers', run(recs, {guide: guide(partUps({part: 1}))}), /part numbers repeat/);
  builds('firstNumber', run(recs, {guide: guide({number: 66}, {seasons: [{season: 1, firstNumber: 66, expectedEpisodes: 65}]})}));
  for (const bad of [0, '66', -1]) {
    fails(run(recs, {guide: guide({}, {seasons: [{season: 1, firstNumber: bad}]})}), /season 1: firstNumber must be a positive integer/,
      'guide: firstNumber ' + JSON.stringify(bad));
  }
  builds('episode below firstNumber', run(recs, {guide: guide({number: 3}, {seasons: [{season: 1, firstNumber: 66, expectedEpisodes: 65}]})}),
    /1 numbered episodes fall outside their season's firstNumber range: fx-ep \(3; season 1 covers 66–130\)/);
  builds('number labels', run(recs, {guide: guide({}, {numberLabelEn: 'IETV no.', numberLabelHe: 'מס׳ חינוכית'})}));
  fails(run(recs, {guide: guide({}, {numberLabelEn: ' '})}), /numberLabelEn must not be empty/, 'guide: empty number label');
  fails(run(recs, {guide: guide({}, {numberLabelHe: {he: 'x'}})}), /numberLabelHe must be a string or null/, 'guide: object number label');
  const alt = altLabels => guide({altLabels});
  builds('alternate labels', run(recs, {guide: alt([{labelEn: 'archive.org S2E20', labelHe: 'עונה 2 פרק 20', sourceLabel: 'archive.org',
    url: 'https://archive.org/details/x'}, {labelEn: 'Tape 7', sourceLabel: 'Tape label'}])}));
  builds('draft alternate labels', run(recs, {guide: alt([{label: 'archive.org S1E44', season: 1, episode: 44}])}), /draft altLabels shape/);
  for (const [label, value, pattern] of [['not an array', {labelEn: 'x'}, /altLabels must be an array/],
    ['no label', [{sourceLabel: 'x'}], /altLabels 1: labelEn required/], ['no source', [{labelEn: 'S2E20'}], /altLabels 1: sourceLabel required/],
    ['bad url', [{labelEn: 'S2E20', sourceLabel: 'x', url: 'javascript:alert(1)'}], /altLabels 1: url must be a public/],
    ['object label', [{labelEn: {en: 'x'}, sourceLabel: 'x'}], /altLabels 1: labelEn must be a string/],
    ['not an object', ['S2E20'], /altLabels 1: expected an object/]]) {
    fails(run(recs, {guide: alt(value)}), pattern, 'guide: alternate labels, ' + label);
  }
  // Story names: storyHe and its source names are non-empty text, storyHe needs storySourceEn, and a source needs storyHe.
  const storyEp = extra => guide({titleHe: 'רחוב סומסום <1>', storyHe: 'משחק כדורסל', storySourceEn: "archive.org file label (uploader's wording)",
    storySourceHe: 'תווית הקובץ בארכיון האינטרנט', ...extra});
  builds('a story name with its source', run(recs, {guide: storyEp({})}));
  builds('a story name with an English source name only', run(recs, {guide: storyEp({storySourceHe: undefined})}));
  for (const [label, extra, pattern] of [['no source', {storySourceEn: undefined}, /episode 'fx-ep': storyHe needs storySourceEn/],
    ['a Hebrew source only', {storySourceEn: undefined, storySourceHe: 'תווית'}, /storyHe needs storySourceEn/],
    ['empty story', {storyHe: ''}, /episode 'fx-ep': storyHe must be a non-empty string/],
    ['blank story', {storyHe: '  '}, /storyHe must be a non-empty string/],
    ['object story', {storyHe: {he: 'x'}}, /storyHe must be a non-empty string/],
    ['blank source', {storySourceEn: ' '}, /storySourceEn must be a non-empty string/],
    ['number source', {storySourceHe: 5}, /storySourceHe must be a non-empty string/],
    ['a source without a story', {storyHe: undefined}, /storySourceEn\/storySourceHe name the source of storyHe, which is absent/]]) {
    fails(run(recs, {guide: storyEp(extra)}), pattern, 'guide: story name, ' + label);
  }
  builds('a story name repeating the title', run(recs, {guide: storyEp({titleHe: 'משחק כדורסל'})}), /storyHe need a look.*fx-ep \(storyHe repeats titleHe\)/);
  builds('a title that has the story', run(recs, {guide: storyEp({titleHe: 'רחוב סומסום <1> - משחק כדורסל'})}),
    /fx-ep \(titleHe already contains storyHe\)/);
  builds('a story name without a catalogue title', run(recs, {guide: storyEp({titleHe: undefined})}), /fx-ep \(no titleHe\)/);
  // Editorial Hebrew titles (titleHeEditorial): non-empty text without surrounding whitespace, on a record or episode with no
  // published Hebrew title (titleHe; on an episode, storyHe too). null is absent; a value with no Hebrew letter is a warning.
  const edYt = 'https://www.youtube.com/watch?v=AAAAAAAAAA1', edBad = [['empty', ''], ['blank', '  '], ['padded', ' כותרת בעריכה'],
    ['trailing newline', 'כותרת בעריכה\n'], ['number', 5], ['object', {he: 'כותרת'}], ['list', ['כותרת']], ['false', false]];
  const edOk = run([rec('fx-ed', edYt, {titleHeEditorial: 'כותרת בעריכה'}), rec('fx-ed0', 'https://www.youtube.com/watch?v=AAAAAAAAAA2',
    {titleHeEditorial: null})]);
  assert.equal(edOk.status, 0, edOk.text); assert(!/no Hebrew letter/.test(edOk.text), 'No warning for a Hebrew editorial title');
  const edBuilt = JSON.parse(edOk.out.match(/<script id="library-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(edBuilt.records.find(r => r.id === 'fx-ed').titleHeEditorial, 'כותרת בעריכה', 'The builder embeds titleHeEditorial');
  for (const [label, value] of edBad) {
    fails(run([rec('fx-ed', edYt, {titleHeEditorial: value})]),
      /fixture-records\.json, entry 1: titleHeEditorial must be a non-empty string without leading or trailing whitespace/,
      'record titleHeEditorial: ' + label);
    fails(run(recs, {guide: guide({titleEn: 'Fixture episode', titleHeEditorial: value})}),
      /episode 'fx-ep': titleHeEditorial must be a non-empty string without leading or trailing whitespace/, 'episode titleHeEditorial: ' + label);
  }
  fails(run([rec('fx-ed', edYt, {titleHe: 'כותרת שפורסמה', titleHeEditorial: 'כותרת בעריכה'})]),
    /entry 1: titleHeEditorial fills only a missing published Hebrew title, but this item has titleHe;/, 'record titleHeEditorial beside titleHe');
  // Entries for one URL merge, so one entry's editorial title must not meet another's published one.
  fails(run([rec('fx-ed', edYt, {titleHeEditorial: 'כותרת בעריכה'}), rec('fx-ed', edYt, {titleHe: 'כותרת שפורסמה'})]),
    /record 'fx-ed': fixture-records\.json, entry 1 has titleHeEditorial and fixture-records\.json, entry 2 \(the same URL, merged into one upload\) has titleHe\. titleHeEditorial fills only a missing published.*remove titleHeEditorial from fixture-records\.json, entry 1$/m,
    'record titleHeEditorial merged with a titleHe');
  // Across files, in either order, the refusal names the entry with each field (not only the first entry for the URL).
  const edFiles = {a: write('a-records.json', {records: [rec('fx-pub', edYt, {titleHe: 'כותרת שפורסמה'})]}),
    b: write('b-records.json', {records: [rec('fx-pub', edYt, {titleHeEditorial: 'כותרת בעריכה'})]})};
  for (const order of [['a', 'b'], ['b', 'a']]) {
    const out = path.join(dir, 'out.html'); fs.writeFileSync(out, 'KEEP');
    const r = spawnSync('python3', [builder, ...order.map(k => edFiles[k]), '--guide', guideFile, '--output', out], {encoding: 'utf8'});
    fails({status: r.status, text: (r.stdout || '') + (r.stderr || ''), out: fs.readFileSync(out, 'utf8')},
      /record 'fx-pub': b-records\.json, entry 1 has titleHeEditorial and a-records\.json, entry 1 \(the same URL, merged into one upload\) has titleHe\..*remove titleHeEditorial from b-records\.json, entry 1$/m,
      'record titleHeEditorial merged with a titleHe from another file, files ' + order.join(','));
  }
  builds('a record titleHeEditorial without a Hebrew letter', run([rec('fx-ed', edYt, {titleHeEditorial: 'Elmo 2'})]),
    /Warning: 1 records have a titleHeEditorial with no Hebrew letter.*: fx-ed/);
  builds('an episode titleHeEditorial', run(recs, {guide: guide({titleEn: 'Fixture episode', titleHeEditorial: 'פרק בעריכה'})}),
    /Editorial Hebrew titles \(titleHeEditorial\): 1 episodes/);
  builds('an episode titleHeEditorial beside a blank titleHe', run(recs, {guide: guide({titleHe: '', titleHeEditorial: 'פרק בעריכה'})}));
  for (const [label, extra, pattern] of [['titleHe', {titleHe: 'כותרת שפורסמה'}, /this item has titleHe;/],
    ['storyHe', {titleHe: undefined}, /this item has storyHe;/], ['titleHe and storyHe', {}, /this item has titleHe and storyHe;/]]) {
    const episode = label === 'titleHe' ? guide({...extra, titleHeEditorial: 'פרק בעריכה'}) : storyEp({...extra, titleHeEditorial: 'פרק בעריכה'});
    fails(run(recs, {guide: episode}), new RegExp("episode 'fx-ep': titleHeEditorial fills only a missing published Hebrew title, but " +
      pattern.source), 'episode titleHeEditorial beside ' + label);
  }
  builds('an episode titleHeEditorial without a Hebrew letter', run(recs, {guide: guide({titleHeEditorial: '1986'})}),
    /1 episodes have a titleHeEditorial with no Hebrew letter.*: fx-ep/);
  builds('a source without a url', run(recs, {guide: guide({sources: [{label: 'Printed catalogue'}]})}));
  fails(run(recs, {guide: guide({sources: [{label: ' '}]})}), /source 1: a source without a url needs a label/, 'guide: empty source');
  // A url that is present must be renderable, in sources and totals evidence as in altLabels ('' and non-strings included).
  for (const [label, url, pattern] of [['javascript:', 'javascript:alert(1)', /not an http\(s\) URL/], ['number', 0, /not a string/],
    ['false', false, /not a string/], ['list', [], /not a string/], ['empty', '', /not an http\(s\) URL/]]) {
    fails(run(recs, {guide: guide({sources: [{label: 'x', url}]})}), new RegExp("source 1: url must be a public http\\(s\\) URL[\\s\\S]*" +
      pattern.source), 'guide: source url ' + label);
    fails(run(recs, {guide: guide({}, {totalsEvidence: [{value: 1, confidence: 'primary', url}]})}),
      /totalsEvidence 1: url must be a public http\(s\) URL/, 'guide: totals evidence url ' + label);
  }
  builds('a source with a null url', run(recs, {guide: guide({sources: [{label: 'Printed catalogue', url: null}]})}));
  // A totals claim cites a url or, without one, a source label (a printed catalogue).
  builds('a totals claim with a label only', run(recs, {guide: guide({}, {totalsEvidence: [{value: 1, confidence: 'primary',
    sourceLabel: 'Printed catalogue'}]})}));
  fails(run(recs, {guide: guide({}, {totalsEvidence: [{value: 65, confidence: 'primary'}]})}),
    /totalsEvidence 1: a claim without a url needs a sourceLabel/, 'guide: totals claim without a source');
  // A malformed season key (a list or an object) is a located error, never a TypeError from the firstNumber ranges.
  for (const bad of [[1], {}]) {
    fails(run(recs, {guide: guide({season: bad, number: 1})}), /episode 'fx-ep': season must be an integer or null/,
      'guide: episode season ' + JSON.stringify(bad));
    fails(run(recs, {guide: guide({}, {seasons: [{season: bad, firstNumber: 66, expectedEpisodes: 65}]})}),
      /season 1: season must be an integer or null/, 'guide: seasons[] key ' + JSON.stringify(bad));
  }
  // Availability checks: a known string, or an object whose optional status is known.
  const yt1 = 'https://www.youtube.com/watch?v=AAAAAAAAAA1';
  // Sesame Street fields: numberWidth pads numbers; excludedNumbers marks numbers in a season's range that are not episodes;
  // a summary needs its source; sponsors, guest stars and upload containers have fixed shapes.
  builds('numberWidth', run(recs, {guide: guide({}, {numberWidth: 4})}));
  for (const w of [0, 7, '4', 2.5]) fails(run(recs, {guide: guide({}, {numberWidth: w})}), /numberWidth must be an integer from 1 to 6/, 'numberWidth ' + JSON.stringify(w));
  const season = extra => ({seasons: [{season: 1, firstNumber: 1, expectedEpisodes: 3, ...extra}]});
  builds('excludedNumbers', run(recs, {guide: guide({}, season({excludedNumbers: [{from: 2, to: 3, sourceLabel: 'Muppet Wiki', noteEn: 'Repeats.'}]}))}));
  for (const bad of [{from: 2, to: 3}, 3, 'x', true]) {
    fails(run(recs, {guide: guide({}, season({excludedNumbers: bad}))}), /excludedNumbers must be an array/, 'excludedNumbers ' + JSON.stringify(bad));
  }
  for (const bad of [3, null, [2, 3], {from: '2', to: 3}]) {
    fails(run(recs, {guide: guide({}, season({excludedNumbers: [bad]}))}), /excludedNumbers 1: expected \{from, to\}/, 'excludedNumbers entry ' + JSON.stringify(bad));
  }
  fails(run(recs, {guide: guide({}, season({excludedNumbers: [{from: 3, to: 2, sourceLabel: 'x'}]}))}), /excludedNumbers 1: expected \{from, to\} with 1 <= from <= to/, 'excludedNumbers reversed');
  fails(run(recs, {guide: guide({}, season({excludedNumbers: [{from: 2, to: 3}]}))}), /excludedNumbers 1: sourceLabel required/, 'excludedNumbers without a source');
  fails(run(recs, {guide: guide({}, season({excludedNumbers: [{from: 1, to: 1, sourceLabel: 'x'}]}))}), /episode 'fx-ep': number 1 is listed in its season's excludedNumbers/, 'an episode on an excluded number');
  builds('a summary with its source', run(recs, {guide: guide({summaryEn: 'Big Bird sings.', summarySource: {label: 'Muppet Wiki', url: 'https://muppet.fandom.com/wiki/Episode_0001', revisionId: 5}})}));
  fails(run(recs, {guide: guide({summaryEn: 'Big Bird sings.'})}), /summaryEn needs summarySource with a label/, 'summary without a source');
  fails(run(recs, {guide: guide({summarySource: {label: 'Muppet Wiki'}})}), /summarySource without summaryEn/, 'source without a summary');
  fails(run(recs, {guide: guide({summaryEn: 'x', summarySource: ['Muppet Wiki']})}), /summarySource/, 'summary source as a list');
  fails(run(recs, {guide: guide({summaryEn: 'x', summarySource: {label: 'M', url: 'javascript:alert(1)'}})}), /summarySource url must be a public http\(s\) URL/, 'summary source url');
  builds('sponsors and guest stars', run(recs, {guide: guide({sponsors: {letters: ['W', 'S'], numbers: ['2']}, guestStars: ['Carol Burnett'], wordOnTheStreet: 'Hug'})}));
  for (const [label, sp] of [['both empty', {letters: [], numbers: []}], ['unknown key', {colours: ['red']}], ['long value', {letters: ['ABCDEFGHIJKLMN']}], ['a string', 'W']]) {
    fails(run(recs, {guide: guide({sponsors: sp})}), /sponsors must be \{letters: \[\.\.\.\], numbers: \[\.\.\.\]\}/, 'sponsors: ' + label);
  }
  fails(run(recs, {guide: guide({guestStars: []})}), /guestStars must be a non-empty array of names/, 'empty guest stars');
  const contained = c => guide({uploads: [{recordId: 'fx-w', role: 'whole-candidate', container: c, extentNoteEn: 'Episodes 1 and 2.'}]});
  builds('a compilation copy', run(recs, {guide: contained('compilation')}));
  fails(run(recs, {guide: contained('playlist')}), /upload 'fx-w': container must be one of \['compilation', 'listing'\]/, 'unknown container');
  // Guide parts merge into the guide and are validated with it: a part's episode builds, an id repeated across files and a
  // malformed base or part are refused with the file named (never a TypeError from the merge).
  const partOf = (name, value) => write(name, {productions: [], episodes: [], unidentified: {}, ...value});
  const partEp = {id: 'fx-ep2', production: 'fx-prod', season: 1, number: 2, confidence: 'documented', uploads: [{recordId: 'fx-x', role: 'whole-candidate'}]};
  const partOut = run(recs, {guide: guide({uploads: [{recordId: 'fx-w', role: 'whole-candidate'}]}), parts: [partOf('fixture-part.json', {episodes: [partEp]})]});
  builds('a guide part', partOut);
  const partPayload = JSON.parse(partOut.out.match(/<script id="library-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(partPayload.guide.episodes.map(e => e.id).sort(), ['fx-ep', 'fx-ep2'], 'A part\'s episodes join the guide');
  assert.deepEqual(partPayload.meta.guideParts, ['fixture-part.json'], 'meta names the parts');
  fails(run(recs, {guide: guide({}), parts: [partOf('fixture-part.json', {episodes: [{...partEp, id: 'fx-ep'}]})]}), /duplicate|already/i, 'an episode id repeated across parts');
  fails(run(recs, {guide: guide({}), parts: [partOf('fixture-part.json', {unidentified: []})]}), /fixture-part\.json: unidentified must be an object/, 'a part with a list of queues');
  for (const [k, v] of [['productions', null], ['unidentified', null], ['unidentified', []], ['episodes', {}]]) {
    const base = write('fixture-base.json', {productions: [], episodes: [], unidentified: {}, [k]: v});
    fails(run(recs, {guide: base, parts: [partOf('fixture-part.json', {})]}), new RegExp('fixture-base\\.json: ' + k + ' must be'), `a base guide with ${k} ${JSON.stringify(v)}`);
  }
  fails(run(recs, {guide: guide({}), parts: [path.join(dir, 'no-such-part.json')]}), /Guide part not found/, 'a missing guide part');
  // Record-file defaults: filled in for validation, left out of the embedded record (its "_d" names them); unknown default keys,
  // a record that sets "_d" and a malformed completeness-note table are refused.
  const withDefaults = (d, records, extra = {}) => JSON.stringify({defaults: d, records, ...extra});
  const dOut = run(withDefaults({language: 'en', sourceType: 'community'}, [rec('fx-d1', yt1), rec('fx-d2', 'https://www.youtube.com/watch?v=AAAAAAAAAA2', {language: 'he'})]));
  builds('record defaults', dOut);
  const dPayload = JSON.parse(dOut.out.match(/<script id="library-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(dPayload.recordDefaults, [{language: 'en', sourceType: 'community'}], 'The defaults are embedded once');
  const d1 = dPayload.records.find(r => r.id === 'fx-d1'), d2 = dPayload.records.find(r => r.id === 'fx-d2');
  assert(d1._d === 0 && !('language' in d1) && !('sourceType' in d1), 'A record leaves out the fields equal to its defaults');
  assert(d2.language === 'he' && !('sourceType' in d2), 'and keeps its own values');
  fails(run(withDefaults({kind: 'clip'}, [rec('fx-d1', yt1)])), /defaults may set only .* not 'kind'/, 'a default outside the list');
  fails(run(withDefaults({}, [rec('fx-d1', yt1)])), /defaults must be a non-empty object/, 'empty defaults');
  fails(run([rec('fx-d1', yt1, {_d: 0})]), /entry 1: _d is reserved/, 'a record that sets _d');
  fails(run(withDefaults({language: 'en'}, [rec('fx-d1', yt1)], {completenessNotes: {'ss-01': ''}})), /completenessNotes must map status codes to non-empty notes/, 'an empty completeness note');
  builds('object availability check', run([rec('fx-c', yt1, {access: 'unavailable', availabilityCheck: {method: 'yt-dlp', checkedAt: '2026-10-18',
    status: 'unavailable', result: 'Video unavailable'}})]));
  builds('string availability check', run([rec('fx-c', yt1, {access: 'vpn-required', availabilityCheck: 'country-restricted'})]));
  for (const [label, check] of [['unknown string', 'blocked'], ['unknown status', {status: 'gone', result: 'x'}], ['list', ['unavailable']],
    ['object result', {status: 'unavailable', result: {en: 'x'}}]]) {
    fails(run([rec('fx-c', yt1, {availabilityCheck: check})]), /entry 1[:,] availabilityCheck/, 'availability check: ' + label);
  }
  // The embedded data block is escaped: a title with "</script", "<!--", "<script>" or "&" can neither end the block (a blank
  // page) nor inject markup, and U+2028/2029 are escaped too. The exact title survives JSON.parse.
  const nasty = 'Elmo </script x <!--<script>&amp; \u2028\u2029 "q" </SCRIPT>';
  const esc = run([rec('fx-esc', 'https://www.youtube.com/watch?v=AAAAAAAAAA1', {titleEn: nasty})]);
  assert.equal(esc.status, 0, esc.text);
  const block = esc.out.match(/<script id="library-data" type="application\/json">([\s\S]*?)<\/script>/)[1];
  assert(!/[<>&\u2028\u2029]/.test(block), 'The embedded data block has no raw <, >, &, U+2028 or U+2029');
  assert.equal(JSON.parse(block).records.find(r => r.id === 'fx-esc').titleEn, nasty, 'An escaped title round-trips exactly');
  const template = fs.readFileSync(path.join(path.dirname(builder), '..', 'library.template.html'), 'utf8');
  const closers = s => (s.match(/<\/script/gi) || []).length;
  assert.equal(closers(esc.out), closers(template), 'A data title adds no </script sequence to the page');
  ok('builder: duplicate ids, lone surrogates, invalid JSON, NaN and Infinity, unrenderable tags and URLs, URLs with spaces, ' +
    'reserved ids, non-text display fields, nameless productions, guide value types and evidence details refused with located ' +
    'messages; one URL in two spellings merges; outside-season and same-video warnings; failed builds keep the previous output; ' +
    'access, format and role values, part numbers, firstNumber, number labels, alternate labels, story names, editorial Hebrew titles ' +
    '(text without padding, never beside a published Hebrew title, also after a merge) and source and totals URLs ' +
    'validated; ' +
    'availability checks, malformed season keys and totals claims without a source refused; the embedded data is escaped; ' +
    'licensed services embedded, and malformed services files (models, hosts, EN/HE text, links, sources and their dates, ' +
    'libraries, lookup URL) refused with located messages; services facts tied to the shown steps (listed libraries, participation, ' +
    'names in both languages, the lookup link, no future check dates); a merge refusal names the entry with each field');
}

async function run() {
  // CHECK_ONLY=builder runs only the builder tests (a quick loop while editing the builder).
  if (process.env.CHECK_ONLY === 'builder') { checkBuilder(); console.log('PASS builder:'); for (const line of passed) console.log('  - ' + line); return; }
  const app = boot(htmlPath);
  const H = harness(app), M = model(app.payload);
  checkStrings();
  checkData(M, app.payload);
  assert.equal(H.document.documentElement.dir, 'ltr', 'English is the default');
  assert.equal(H.h1().textContent, M.hasGuide ? L.en.homeTitle : L.en.browseTitle, 'Start view');
  assert.equal(H.location.hash, M.hasGuide ? '#/home' : '#/browse', 'Start route');
  // Between groups the event loop runs, so pages and harnesses of finished checks can be collected (see navigate in dom-double).
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const starred = await checkUploads(H, M);
  await checkVimeoAndBackups(H, M, starred);
  if (M.hasGuide) await checkGuide(H, M);
  if (M.hasGuide) await checkEpisodeAbout(H, M);
  await checkHebrew(H, M);
  await checkPersistence(htmlPath, app.storage, starred);
  await checkMasthead(H);
  await tick(); await checkLangBoot(htmlPath);
  await tick(); await checkThemePicker(htmlPath);
  await tick(); await checkLicensed(htmlPath, H, M);
  if (M.hasGuide) { await checkNav(H, M); await checkBrowsePages(H, M); await checkHome(htmlPath, M); }
  await sweep(H, M);
  await tick(); await checkWithoutGuide(htmlPath);
  await tick(); await checkEdgeCases(htmlPath);
  if (M.hasGuide) await checkEntries(htmlPath);
  await checkStarredAndHash(htmlPath, M);
  await checkRouteAliases(htmlPath, M);
  await checkRobustness(htmlPath, M);
  if (M.hasGuide) await checkSeriesRegistry(htmlPath);
  checkCss(app.html);
  checkThemeTokens(app.html, app.window.sumsumTheme, (app.payload.series?.series || []).map(x => x.id));
  checkBuilder();
  console.log(`PASS ${path.basename(htmlPath)} (${M.hasGuide ? 'with episode guide' : 'no episode guide'}):`);
  for (const line of passed) console.log('  - ' + line);
}
// Required as a module (.sweep/titles-he/theme/contrast.cjs), it runs nothing and lends its theme-token functions.
if (require.main === module) {
  run().catch(error => {
    console.error(`FAIL ${path.basename(htmlPath)} after ${passed.length} passing groups:`);
    for (const line of passed) console.error('  - ' + line);
    console.error(error); process.exitCode = 1;
  });
}
module.exports = {themeTokens, contrastRows, CONTRAST_PAIRS, contrast, cssTop};
