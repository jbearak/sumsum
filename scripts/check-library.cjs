#!/usr/bin/env node
'use strict';
// Dependency-free application smoke checks. This small DOM double exercises
// user actions and rendered output; browser layout/accessibility QA is separate.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const htmlPath = process.argv[2] || path.resolve(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const dataText = html.match(/<script id="library-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
const appSource = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert(dataText && appSource, 'HTML contains embedded data and the application');
const payload = JSON.parse(dataText), records = payload.records;
const ids = {}, storage = new Map(), downloads = [], blobs = new Map();
let document, blobNumber = 0;
class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toLowerCase(); this.children = []; this.attributes = {};
    this.listeners = {}; this.style = { setProperty() {} }; this.dataset = {};
    this.value = ''; this.hidden = false; this.disabled = false; this.checked = false;
    this.files = []; this._text = ''; this.parentElement = null;
  }
  append(...nodes) {
    for (const node of nodes) {
      if (node?.tagName === '#fragment') { this.append(...node.children); continue; }
      this.children.push(node); if (node && typeof node === 'object') node.parentElement = this;
      if (this.tagName === 'select' && node?.tagName === 'option' && this.children.length === 1) this.value = node.value;
    }
  }
  replaceChildren(...nodes) { for (const child of this.children) child.parentElement = null; this.children = []; this._text = ''; this.append(...nodes); }
  set textContent(value) { this.replaceChildren(); this._text = String(value); }
  get textContent() { return this._text + this.children.map(node => typeof node === 'string' ? node : node.textContent).join(''); }
  set innerHTML(value) { this._html = value; }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'id') { this.id = value; ids[value] = this; }
    if (name === 'value') this.value = value;
    if (name === 'class') this.className = value;
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    if (['lang', 'dir', 'type', 'href'].includes(name)) this[name] = value;
    if (['hidden', 'disabled', 'checked'].includes(name)) this[name] = true;
  }
  getAttribute(name) { return this.attributes[name]; }
  addEventListener(name, callback) { (this.listeners[name] ??= []).push(callback); }
  add(option) { this.append(option); }
  async fire(name, extra = {}) { for (const callback of this.listeners[name] || []) await callback({ target: this, preventDefault() {}, ...extra }); }
  async click() {
    assert(!this.disabled, 'The chosen control must be operable');
    if (this.tagName === 'a' && this.download) downloads.push({ name: this.download, url: this.href });
    await this.fire('click');
  }
  focus() { document.activeElement = this; }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); }
  scrollIntoView() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
}
const descendants = (node, predicate) => [ ...(predicate(node) ? [node] : []), ...node.children.filter(child => child instanceof Element).flatMap(child => descendants(child, predicate)) ];
const decode = text => text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, value) => value[0] === '#' ? String.fromCodePoint(value[1].toLowerCase() === 'x' ? parseInt(value.slice(2), 16) : Number(value.slice(1))) : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[value.toLowerCase()]);
// Parse the static markup so translated labels and options remain attached to
// the controls they describe. Script/style contents are handled separately.
const tree = new Element('#document'), stack = [tree];
const markup = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, '$1$2');
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
for (const token of markup.match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>]*>|[^<]+/gi) || []) {
  if (token.startsWith('<!')) continue;
  if (token.startsWith('</')) {
    const tag = token.match(/^<\/([^\s>]+)/)[1].toLowerCase();
    const index = stack.findLastIndex(node => node.tagName === tag);
    if (index > 0) stack.length = index;
  } else if (token.startsWith('<')) {
    const tag = token.match(/^<([^\s/>]+)/)[1].toLowerCase(), node = new Element(tag);
    const attrs = token.slice(tag.length + 1, token.endsWith('/>') ? -2 : -1);
    for (const match of attrs.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) node.setAttribute(match[1], decode(match[2] ?? match[3] ?? match[4] ?? ''));
    stack.at(-1).append(node);
    if (!voidTags.has(tag) && !token.endsWith('/>')) stack.push(node);
  } else {
    const node = new Element('#text'); node.textContent = decode(token); stack.at(-1).append(node);
  }
}
document = {
  getElementById: id => ids[id] || null,
  createElement: tag => new Element(tag),
  createTextNode: text => { const node = new Element('#text'); node.textContent = text; return node; },
  createDocumentFragment: () => new Element('#fragment'),
  querySelectorAll: selector => descendants(tree, node => selector.startsWith('[data-') && node.getAttribute(selector.slice(1, -1)) !== undefined),
  documentElement: descendants(tree, node => node.tagName === 'html')[0],
  body: descendants(tree, node => node.tagName === 'body')[0]
};
ids['library-data'].textContent = dataText;
class TestURL extends URL {}
TestURL.createObjectURL = blob => { const url = 'blob:library-test-' + ++blobNumber; blobs.set(url, blob); return url; };
TestURL.revokeObjectURL = () => {};
const context = {
  document, localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  Option: function (label, value) { const option = new Element('option'); option.textContent = label; option.value = value; return option; },
  URL: TestURL, Blob, console, setTimeout: () => 1, clearTimeout() {}, Set, Map, Date, JSON, Intl
};
vm.runInNewContext(appSource, context, { filename: htmlPath });
const $ = id => { assert(ids[id], 'Control exists: ' + id); return ids[id]; };
const number = text => Number(String(text).replace(/[^\d]/g, ''));
const accessibleName = node => node.getAttribute('aria-label') || node.textContent.trim();
const namedButton = (within, label) => {
  const button = descendants(within, node => node.tagName === 'button').find(node => accessibleName(node).replace(/\s*[\d,]+$/, '').trim() === label);
  assert(button, 'Button is available by its label: ' + label); return button;
};
const click = (group, label) => namedButton($(group), label).click();
const facetCount = (group, label) => {
  const text = namedButton($(group), label).textContent;
  assert(/[\d,]+$/.test(text), 'Facet includes a result count'); return number(text.match(/[\d,]+$/)[0]);
};
const resultCount = () => number(descendants($('count'), node => node.tagName === 'strong')[0].textContent);
const cards = () => $('grid').children.filter(node => node.tagName === 'article');
const cardTitle = card => descendants(card, node => node.tagName === 'h2')[0].textContent;
const watchLink = card => descendants(card, node => node.tagName === 'a').find(node => /^(Watch on |צפייה ב־)/.test(node.textContent));
const setSearch = async text => { $('search').value = text; await $('search').fire('input'); };
const selectLabel = async (id, label) => {
  const option = $(id).children.find(node => node.tagName === 'option' && node.textContent.split(' · ')[0] === label);
  assert(option, 'Select option is available by its label: ' + label); $(id).value = option.value; await $(id).fire('change');
};
const selectCount = (id, label) => {
  const option = $(id).children.find(node => node.tagName === 'option' && node.textContent.split(' · ')[0] === label);
  assert(option, 'Counted option remains available: ' + label); return number(option.textContent.split(' · ')[1]);
};
const setSavedOnly = async checked => { $('favorites-only').checked = checked; await $('favorites-only').fire('change'); };
const clear = () => $('clear').click();

async function run() {
  assert.equal(records.length, 700, 'All source links remain embedded');
  assert.equal(records.filter(record => record.directLinkProvenance).length, 185, 'All recovered Vimeo links remain');
  assert.equal(records.filter(record => record.playbackVerified && record.playbackWithoutVpn).length, 1, 'Only the observed sample claims playback outside VPN');
  assert.equal(resultCount(), 700); assert.equal(cards().length, 60, 'Initial results load a manageable batch');
  await $('load-more').click(); assert.equal(cards().length, 120);
  assert.equal(document.getElementById('direct-only'), null, 'Redundant direct-link filter is absent');
  assert.equal(facetCount('series-filters', 'Modern Rechov Sumsum'), 209);
  for (const [label, count] of [['Full episodes', 42], ['Short-form episodes', 16], ['Clips', 494], ['Collections', 8], ['Unconfirmed episodes', 140]]) assert.equal(facetCount('kind-filters', label), count);
  assert(!descendants($('kind-filters'), node => node.tagName === 'button').some(node => /Everything/.test(node.textContent)));
  assert($('kind-help').textContent.includes('Select none to include all types.'));

  await click('series-filters', 'Modern Rechov Sumsum'); assert.equal(resultCount(), 209);
  for (const [label, count] of [['Full episodes', 0], ['Short-form episodes', 16], ['Clips', 155], ['Collections', 2], ['Unconfirmed episodes', 36]]) assert.equal(facetCount('kind-filters', label), count);
  assert.equal(facetCount('series-filters', 'All series'), 700, 'Series counts ignore the current series selection');
  await click('kind-filters', 'Short-form episodes'); assert.equal(resultCount(), 16);
  assert(cards().every(card => card.textContent.includes('Word of the day 2023')));
  assert.equal(facetCount('series-filters', 'Modern Rechov Sumsum'), 16, 'Series counts include the selected type');
  assert.equal(facetCount('series-filters', 'Classic Rechov Sumsum'), 0);
  assert.equal(facetCount('kind-filters', 'Clips'), 155, 'Type counts ignore the current type selection');
  await click('kind-filters', 'Short-form episodes'); assert.equal(resultCount(), 209, 'Selecting no types includes all types');
  await click('kind-filters', 'Full episodes'); assert.equal(resultCount(), 0, 'Short series do not count as full core episodes');
  assert.equal(namedButton($('kind-filters'), 'Full episodes').getAttribute('aria-pressed'), 'true');
  await click('kind-filters', 'Full episodes'); assert.equal(resultCount(), 209, 'A selected zero-result option can be deselected');

  await clear(); await setSearch('Hanukkah'); assert.equal(resultCount(), 23);
  for (const [label, count] of [['Classic Rechov Sumsum', 8], ['Classic Shalom Sesame', 4], ['Modern Shalom Sesame', 11], ['Modern Rechov Sumsum', 0]]) assert.equal(facetCount('series-filters', label), count);
  assert.equal(descendants($('kind-filters'), node => node.tagName === 'button').reduce((sum, button) => sum + number(button.textContent.match(/[\d,]+$/)[0]), 0), 23, 'Search refreshes every type count');
  await setSearch('Chanukah'); assert.equal(resultCount(), 23, 'Holiday spelling alias works');
  await clear(); await selectLabel('theme', 'Hanukkah'); assert.equal(resultCount(), 23, 'Theme selection refreshes counts and results');
  assert.equal(facetCount('series-filters', 'Modern Shalom Sesame'), 11);
  await clear(); await selectLabel('character', 'Avigail'); assert.equal(resultCount(), 14);
  assert.equal(facetCount('series-filters', 'Modern Rechov Sumsum'), 10);
  assert.equal(facetCount('series-filters', 'Modern Shalom Sesame'), 4);
  await click('series-filters', 'Modern Rechov Sumsum'); assert.equal(resultCount(), 10);
  assert.equal(facetCount('kind-filters', 'Clips'), 4); assert.equal(facetCount('kind-filters', 'Unconfirmed episodes'), 6);
  await click('kind-filters', 'Clips'); assert.equal(resultCount(), 4);
  assert.equal(facetCount('series-filters', 'All series'), 8, 'Other series counts remain reachable under type and character constraints');
  await selectLabel('theme', 'Hanukkah'); assert.equal(resultCount(), 0);
  assert.equal(selectCount('theme', 'Hanukkah'), 0, 'A selected zero-count theme is retained');
  assert.equal(selectCount('character', 'Avigail'), 0, 'A selected zero-count character is retained');
  await clear(); assert.equal(resultCount(), 700); assert.equal($('theme').value, ''); assert.equal($('character').value, '');
  assert(descendants($('kind-filters'), node => node.tagName === 'button').every(button => button.getAttribute('aria-pressed') === 'false'));
  await setSearch('Avigail'); assert.equal(resultCount(), 14); await setSearch('Abigail'); assert.equal(resultCount(), 14);

  await clear(); await selectLabel('sort', 'Length: longest first');
  assert.equal(cardTitle(cards()[0]), 'Word of the day: All episodes in a row', 'The known 47:23 compilation sorts first');
  let batches = 0; while (!$('load-more-row').hidden) { assert(++batches < 20); await $('load-more').click(); }
  assert.equal(cards().length, 700);
  const byWatchUrl = new Map(records.flatMap(record => [record.directUrl, record.url].filter(Boolean).map(url => [url, record])));
  let previous = Infinity, unknownSeen = false, unknownCount = 0;
  for (const card of cards()) {
    const record = byWatchUrl.get(watchLink(card)?.href); assert(record, 'Every watch button targets an indexed host URL');
    const seconds = Number(record.durationSeconds);
    if (!Number.isFinite(seconds) || seconds <= 0) { unknownSeen = true; unknownCount++; continue; }
    assert(!unknownSeen, 'Known runtimes precede missing runtimes'); assert(seconds <= previous, 'Runtime order descends'); previous = seconds;
  }
  // All current catalog runtimes are populated. The loop also rejects known
  // runtimes placed after missing values if future records introduce them.

  await clear(); await setSearch('Word of the day: All episodes in a row'); assert.equal(resultCount(), 1);
  const collection = cards()[0]; const saveButton = descendants(collection, node => node.tagName === 'button').find(node => accessibleName(node).startsWith('Save video:'));
  assert(saveButton); await saveButton.click(); await setSavedOnly(true); await setSearch(''); assert.equal(resultCount(), 1);
  assert.equal(facetCount('series-filters', 'Modern Rechov Sumsum'), 1); assert.equal(facetCount('kind-filters', 'Collections'), 1); assert.equal(facetCount('kind-filters', 'Clips'), 0);
  await setSavedOnly(false); assert.equal(facetCount('kind-filters', 'Clips'), 494, 'Saved-only changes refresh both facets');
  await clear(); await setSavedOnly(true); assert.equal(resultCount(), 1, 'Clearing filters preserves the saved list'); await clear();

  await setSearch('A hug'); const hug = cards().find(card => cardTitle(card) === 'A hug'); assert(hug);
  const vimeo = watchLink(hug); assert.equal(vimeo.textContent, 'Watch on Vimeo'); assert.equal(vimeo.target, '_blank');
  const hopPage = descendants(hug, node => node.tagName === 'a' && node.textContent === 'Hop page')[0]; assert(hopPage && !hopPage.href.includes('/wp-json/'));
  const metadata = descendants(hug, node => node.tagName === 'a' && String(node.href).includes('/wp-json/'))[0]; assert(metadata, 'API provenance remains in Details');
  assert(descendants(hug, node => node.tagName === 'summary').some(node => node.textContent === 'Details'));
  await namedButton(hug, 'Save Vimeo link').click();
  $('vimeo-url').value = 'https://example.org/123'; await $('mapping-form').fire('submit'); assert($('mapping-dialog').open && $('mapping-error').textContent, 'Invalid host is rejected');
  const exactUrl = 'https://vimeo.com/916707529/6cdb440a7c?share=copy#t=14s'; $('vimeo-url').value = exactUrl; await $('mapping-form').fire('submit'); assert(!$('mapping-dialog').open);
  await $('export-mappings').click(); const backup = JSON.parse(await blobs.get(downloads.at(-1).url).text());
  assert.equal(Object.values(backup.mappings)[0].url, exactUrl, 'Backup preserves privacy hash, query, and fragment'); assert.equal(backup.favorites.length, 1, 'Backup includes saved videos');
  const sample = records.find(record => record.id === 'hop-8864');
  $('import-mappings').files = [{ size: 1000, text: async () => JSON.stringify({ records: [{ id: sample.id, url: sample.url, directUrl: sample.directUrl }], completedAt: '2026-10-17' }) }];
  await $('import-mappings').fire('change'); assert.equal(JSON.parse(storage.get('sumsum-vimeo-mappings'))[sample.id].url, sample.directUrl, 'Collector report imports directly');

  await $('language').click(); assert.equal(document.documentElement.dir, 'rtl'); assert.equal(document.documentElement.lang, 'he');
  assert($('kind-help').textContent.includes('ללא בחירה יוצגו כל הסוגים.'));
  await clear(); await click('kind-filters', 'פרקים בסדרות קצרות'); assert.equal(resultCount(), 16);
  assert(cards().every(card => card.textContent.includes('מילת היום 2023')));
  assert(cards().some(card => watchLink(card)?.textContent === 'צפייה ב־Vimeo')); assert(cards().some(card => watchLink(card)?.textContent === 'צפייה ב־YouTube'));
  await selectLabel('sort', 'משך: מהארוך לקצר'); await clear(); assert.equal(resultCount(), 700);
  assert(!$('favorites-only').checked); assert.equal($('search').value, '');
  await $('export-library').click(); const exported = JSON.parse(await blobs.get(downloads.at(-1).url).text()); assert.equal(exported.records.length, 700);
  console.log('PASS: dynamic facets, zero-result selections, multi-select/clear, longest-first sort with unknown runtimes last, host/source actions, bilingual UI, favorites, exact Vimeo URL backups/imports, and all 700 catalog links.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
