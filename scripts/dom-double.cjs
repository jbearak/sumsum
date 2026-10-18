'use strict';
// Dependency-free DOM double for scripts/check-library.cjs. It parses the static markup of a built library,
// runs the application script in a VM context and fakes only the browser APIs the application uses:
// createElement, append, replaceChildren, textContent, attributes, events, localStorage, focus, isConnected, timers,
// window.location (hash routing), window scrolling, Blob downloads and Option. Image src/loading assignments keep their
// order. Events reach only the element's own listeners (fire, click) unless dispatched with dispatch(), which bubbles to
// the ancestors and then to the document's listeners (document.addEventListener) like a browser event. Browser layout and
// rendering QA are separate.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const decode = text => text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, value) => value[0] === '#'
  ? String.fromCodePoint(value[1].toLowerCase() === 'x' ? parseInt(value.slice(2), 16) : Number(value.slice(1)))
  : ({amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '})[value.toLowerCase()]);
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function readLibrary(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const dataText = html.match(/<script id="library-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  const appSource = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
  assert(dataText && appSource, 'HTML contains embedded data and the application');
  return {html, dataText, appSource};
}

// options.payload(payload) may return a changed payload (for example without a guide);
// options.storage shares a Map between boots (persistence across reloads);
// options.htmlAttrs sets attributes on <html> before start (data-start-lang, data-start-view, ...);
// options.hash is the initial location hash.
function boot(htmlPath, options = {}) {
  const {html, dataText, appSource} = readLibrary(htmlPath);
  let payload = JSON.parse(dataText);
  if (options.payload) payload = options.payload(payload) || payload;
  // Elements by id are held weakly, like a browser's id lookup: a detached element is not kept alive by its id.
  // `ids` reads through to the element for callers that use the map directly.
  const idRefs = new Map(), ids = new Proxy({}, {get: (_, k) => idRefs.get(k)?.deref(), has: (_, k) => !!idRefs.get(k)?.deref()});
  const storage = options.storage || new Map(), downloads = [], blobs = new Map();
  const timers = new Map();
  let document, blobNumber = 0, timerId = 0;

  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toLowerCase(); this.children = []; this.attributes = {};
      this.listeners = {}; this.style = {setProperty() {}}; this.dataset = {};
      this.value = ''; this.hidden = false; this.disabled = false; this.checked = false;
      this.files = []; this._text = ''; this.parentElement = null;
    }
    append(...nodes) {
      for (const node of nodes) {
        if (node?.tagName === '#fragment') { this.append(...node.children); node.children = []; continue; }
        if (node && typeof node === 'object' && node.parentElement && node.parentElement !== this) node.remove();
        this.children.push(node); if (node && typeof node === 'object') node.parentElement = this;
        if (this.tagName === 'select' && node?.tagName === 'option' && this.children.length === 1) this.value = node.value;
      }
    }
    replaceChildren(...nodes) {
      for (const child of this.children) if (child && typeof child === 'object') child.parentElement = null;
      this.children = []; this._text = ''; this.append(...nodes);
    }
    set textContent(value) { this.replaceChildren(); this._text = String(value); }
    get textContent() { return this._text + this.children.map(node => typeof node === 'string' ? node : node.textContent).join(''); }
    set innerHTML(value) { this.replaceChildren(); this._html = String(value); }
    get innerHTML() { return this._html || ''; }
    set className(value) { this.attributes.class = String(value); }
    get className() { return this.attributes.class || ''; }
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === 'id') { this.id = value; idRefs.set(value, new WeakRef(this)); }
      if (name === 'value') this.value = value;
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      if (['lang', 'dir', 'type', 'href'].includes(name)) this[name] = value;
      if (['hidden', 'disabled', 'checked', 'open'].includes(name)) this[name] = true;
    }
    getAttribute(name) { return this.attributes[name]; }
    addEventListener(name, callback) { (this.listeners[name] ??= []).push(callback); }
    add(option) { this.append(option); }
    async fire(name, extra = {}) {
      let prevented = false;
      for (const callback of this.listeners[name] || []) {
        await callback({target: this, currentTarget: this, preventDefault() { prevented = true; }, ...extra});
      }
      return prevented;
    }
    // A bubbling event: the target's listeners, then each ancestor's, with event.target kept on the original element.
    async dispatch(name, extra = {}) {
      let prevented = false;
      for (let n = this; n; n = n.parentElement) {
        for (const callback of n.listeners[name] || []) {
          await callback({target: this, currentTarget: n, preventDefault() { prevented = true; }, ...extra});
        }
      }
      return prevented;
    }
    async click() {
      assert(!this.disabled, 'The chosen control must be operable');
      if (this.tagName === 'a' && this.download) downloads.push({name: this.download, url: this.href});
      await this.fire('click', {button: 0});
    }
    get isConnected() { let n = this; while (n.parentElement) n = n.parentElement; return n === tree; }
    contains(node) { for (let n = node; n; n = n.parentElement) if (n === this) return true; return false; }
    focus() { document.activeElement = this; }
    remove() {
      if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this);
      this.parentElement = null;
    }
    scrollIntoView() {}
  }
  // src and loading record the order they were assigned in (_order): an image must be lazy before its src is set.
  for (const prop of ['src', 'loading']) {
    Object.defineProperty(Element.prototype, prop, {
      configurable: true,
      get() { return this['_' + prop] ?? ''; },
      set(value) { this['_' + prop] = String(value); (this._order ??= []).push(prop); }
    });
  }
  const descendants = (node, predicate) => [...(predicate(node) ? [node] : []),
    ...node.children.filter(child => child instanceof Element).flatMap(child => descendants(child, predicate))];

  // Parse the static markup so translated labels stay attached to their controls. Script and style
  // contents are handled separately.
  const tree = new Element('#document'), stack = [tree];
  const markup = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, '$1$2');
  for (const token of markup.match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>]*>|[^<]+/gi) || []) {
    if (token.startsWith('<!')) continue;
    if (token.startsWith('</')) {
      const tag = token.match(/^<\/([^\s>]+)/)[1].toLowerCase();
      const index = stack.findLastIndex(node => node.tagName === tag);
      if (index > 0) stack.length = index;
    } else if (token.startsWith('<')) {
      const tag = token.match(/^<([^\s/>]+)/)[1].toLowerCase(), node = new Element(tag);
      const attrs = token.slice(tag.length + 1, token.endsWith('/>') ? -2 : -1);
      for (const match of attrs.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
        node.setAttribute(match[1], decode(match[2] ?? match[3] ?? match[4] ?? ''));
      }
      stack.at(-1).append(node);
      if (!VOID_TAGS.has(tag) && !token.endsWith('/>')) stack.push(node);
    } else {
      const node = new Element('#text'); node.textContent = decode(token); stack.at(-1).append(node);
    }
  }
  document = {
    title: '', activeElement: null,
    getElementById: id => {
      const node = ids[id];
      // Detached nodes keep their id in the map; report only connected ones, like a browser.
      if (!node) return null;
      let n = node; while (n.parentElement) n = n.parentElement;
      return n === tree ? node : null;
    },
    createElement: tag => new Element(tag),
    createTextNode: text => { const node = new Element('#text'); node.textContent = text; return node; },
    createDocumentFragment: () => new Element('#fragment'),
    // Document listeners sit on the root of the tree, so a dispatched event reaches them after every ancestor.
    addEventListener: (name, callback) => tree.addEventListener(name, callback),
    querySelectorAll: selector => descendants(tree, node => selector.startsWith('[data-') && node.getAttribute(selector.slice(1, -1)) !== undefined),
    documentElement: descendants(tree, node => node.tagName === 'html')[0],
    body: descendants(tree, node => node.tagName === 'body')[0]
  };
  for (const [name, value] of Object.entries(options.htmlAttrs || {})) document.documentElement.setAttribute(name, value);
  ids['library-data'].textContent = options.payload ? JSON.stringify(payload) : dataText;

  // window.location: assignments to hash are pushes, replace() replaces. Neither fires hashchange; tests call navigate().
  const history = [];
  const location = {
    _hash: options.hash || '',
    get hash() { return this._hash; },
    set hash(value) { this._hash = String(value); history.push({type: 'push', hash: this._hash}); },
    replace(value) { this._hash = String(value); history.push({type: 'replace', hash: this._hash}); }
  };
  // Scrolling: scrollY holds the last position, and every scrollTo call is recorded in window.scrolls.
  const windowListeners = {};
  const window = {
    location, scrollX: 0, scrollY: 0, scrolls: [],
    addEventListener(name, callback) { (windowListeners[name] ??= []).push(callback); },
    scrollTo(x, y) {
      const to = typeof x === 'object' && x ? {x: x.left ?? this.scrollX, y: x.top ?? this.scrollY} : {x: Number(x) || 0, y: Number(y) || 0};
      this.scrolls.push(to); this.scrollX = to.x; this.scrollY = to.y;
    },
    async fire(name) { for (const callback of windowListeners[name] || []) await callback({}); }
  };
  class TestURL extends URL {}
  TestURL.createObjectURL = blob => { const url = 'blob:library-test-' + ++blobNumber; blobs.set(url, blob); return url; };
  TestURL.revokeObjectURL = () => {};
  const context = {
    document, window, localStorage: {
      getItem: key => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => { if (options.failStorage) throw new Error('quota'); storage.set(key, String(value)); }
    },
    Option: function Option(label, value) { const option = new Element('option'); option.textContent = label; option.value = value; return option; },
    URL: TestURL, Blob, console, Set, Map, Date, JSON, Intl,
    setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout: id => { timers.delete(id); }
  };
  vm.runInNewContext(appSource, context, {filename: htmlPath});

  const flushTimers = () => {
    let guard = 0;
    while (timers.size) {
      assert(++guard < 10000, 'Timers settle');
      const [id, fn] = timers.entries().next().value; timers.delete(id); fn();
    }
  };
  // Route like a browser: set the hash and dispatch hashchange.
  const navigate = async route => { location._hash = '#/' + route; history.push({type: 'nav', hash: location._hash}); await window.fire('hashchange'); };
  return {document, ids, tree, descendants, storage, downloads, blobs, context, payload, window, location, history,
    flushTimers, navigate, appSource, html};
}

module.exports = {boot, readLibrary};
