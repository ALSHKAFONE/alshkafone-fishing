'use strict';

/*
 * Socket-free fallback for environments where Chromium cannot start.
 * Runs the same integration scenarios as vk-persistence.cjs against:
 *   - actual index.html normalise/loadState/save/carry functions;
 *   - actual installNextCore, applyState/applyCloudState, and profile cleaner;
 *   - actual cloud-save.js, including boot gate and VK chunk transactions.
 *
 * DOM paint operations, animation, audio/portrait presentation helpers and
 * the outer boot callback are small stubs. This does not claim visual/browser
 * coverage. No copy of the cloud controller or persistence logic is used.
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const suite = require('./vk-persistence.cjs');

const ROOT = path.resolve(__dirname, '..');
const TIMEOUT = Number(process.env.AF_TEST_TIMEOUT_MS || 25000);
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cloudCode = fs.readFileSync(path.join(ROOT, 'cloud-save.js'), 'utf8');

function between(start, end) {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a + start.length);
  if (a < 0 || b < 0 || b <= a) throw new Error('Source extraction marker missing: ' + start);
  return html.slice(a, b);
}

function exactLine(start) {
  const index = html.indexOf(start);
  if (index < 0) throw new Error('Source line not found: ' + start);
  return html.slice(index, html.indexOf('\n', index));
}

// Read every persistence function directly from the deliverable under test.
const source = [
  between("const VERSION=", 'const seasonArt='),
  between('const ITEMS=[', '__af33InitData();'),
  between('const QUESTS=[', 'const PATHS='),
  between('window.AF34_DATA={', 'function __af34InitData'),
  between('window.AF36_DATA=(()=>{', 'function __af36Carry'),
  between('function __afMigrate32(', 'function __afInstall32('),
  between('function __af321Carry(', 'function __afInstall321('),
  between('function __af33Carry(', 'function __afInstall33('),
  between('function __af34Carry(', 'function __af34Economy('),
  between('function __af36Carry(', 'function __af36Core('),
  between('function careerRead(', 'function careerQuote('),
  between('function __afQACarry(', 'function __afInstallQA('),
  exactLine('function forestStops('),
  exactLine('function knownWater('),
  between('function nextCatchContext3613(', 'function installNextCore('),
  between('function nextProfile3617(', 'function installNextProfile('),
  between('function installNextProfile(', '/* 3.6.21 fishing extension.'),
  between('const launchID=', 'function log(text)'),
  'let view=S.profile.done?"base":"creator",draft=S.profile.done?null:JSON.parse(JSON.stringify(S.profile));',
  'let F={phase:"idle"},importedState=null;',
  'function activeCast(){return F.phase!=="idle"&&F.phase!=="result";}',
  'function render(){__renderCount++;__creatorRendered=!S.profile.done;}',
  'function route(id){view=id;render();}',
  'function foot(){return "";}',
  'function showCatch(){} function resolveCatch(){} function travel(){} function failCast(){}',
  'function settingsModal(){} function importSave(){} function updateTop(){}',
  between('function installNextCore()', '/* 3.6.17 — bounded character appearance'),
  'S=normalise(S); installNextCore(); installNextProfile();',
  cloudCode,
  'installNextCloud();',
  'void AFNext.cloud.start(()=>{__bootCount++;render();});'
].join('\n');

function makeStorage(initial, rejectWrites) {
  const data = new Map(Object.entries(initial));
  const methods = {
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) {
      if (rejectWrites) throw new DOMException('Injected local storage failure', 'QuotaExceededError');
      data.set(String(key), String(value));
    },
    removeItem(key) { data.delete(String(key)); },
    clear() { data.clear(); },
    key(index) { return [...data.keys()][index] ?? null; }
  };
  return new Proxy(methods, {
    get(target, key) {
      if (key === 'length') return data.size;
      return key in target ? target[key] : data.get(key);
    },
    ownKeys() { return [...data.keys()]; },
    getOwnPropertyDescriptor(_target, key) {
      return data.has(key) ? { configurable: true, enumerable: true, value: data.get(key) } : undefined;
    }
  });
}

function makeDocument() {
  const nodes = new Map();
  const listeners = new Map();
  function node(tag) {
    let identifier = '', markup = '';
    const element = {
      tagName: tag.toUpperCase(), style: {}, dataset: {}, textContent: '',
      classList: { add() {}, remove() {}, toggle() {} },
      setAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; },
      append(child) { if (child.id) nodes.set(child.id, child); },
      appendChild(child) { this.append(child); },
      insertAdjacentHTML() {}, focus() {},
      remove() { if (identifier) nodes.delete(identifier); }
    };
    Object.defineProperty(element, 'id', {
      get: () => identifier,
      set(value) { identifier = value; nodes.set(value, element); }
    });
    Object.defineProperty(element, 'innerHTML', {
      get: () => markup,
      set(value) { markup = String(value); }
    });
    return element;
  }
  const body = node('body');
  for (const id of ['screen', 'appNav', 'ncSaveStatus']) {
    const element = node('div');
    element.id = id;
    body.append(element);
  }
  return {
    body, hidden: false, referrer: 'https://vk.com/app7777777',
    createElement: node,
    getElementById(id) { return nodes.get(id) || null; },
    querySelector(selector) { return selector.startsWith('#') ? nodes.get(selector.slice(1)) || null : null; },
    querySelectorAll() { return []; },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    __nodes: nodes,
    __listeners: listeners
  };
}

async function openGame(options = {}) {
  const {
    backend = new suite.VKBackend(), uid = '99001001', storage = {},
    vk = true, rejectStorageWrites = false, ready = true
  } = options;
  const timers = new Set();
  const windowListeners = new Map();
  const document = makeDocument();
  if (!vk) document.referrer = '';
  const url = new URL('http://127.0.0.1:8765/index.html' +
    (vk ? '?vk_user_id=' + uid + '&vk_app_id=7777777&vk_platform=desktop_web' : ''));
  const context = {
    console, URL, URLSearchParams, TextEncoder, TextDecoder, Blob,
    CompressionStream, DecompressionStream, AbortController,
    DOMException, Response, crypto: webcrypto, performance,
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    document,
    localStorage: makeStorage(storage, rejectStorageWrites),
    location: {
      href: url.href, search: url.search, origin: url.origin,
      protocol: url.protocol, ancestorOrigins: vk ? ['https://vk.com'] : [],
      reload() { context.__reloads++; }
    },
    fetch: async () => new Response('No API on static hosting', {
      status: 404, headers: { 'content-type': 'text/html' }
    }),
    setTimeout(fn, delay, ...args) {
      const id = setTimeout(() => { timers.delete(id); fn(...args); }, delay);
      timers.add(id);
      return id;
    },
    clearTimeout(id) { timers.delete(id); clearTimeout(id); },
    addEventListener(type, listener) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(listener);
    },
    scrollTo() {},
    PierSoundtrack: { defaultTrack: 'pier', normalize: value => value || 'pier' },
    PierCreator: { extra: () => ({}) },
    AF34: { step() {} },
    art366: { fishing: '' },
    I: () => '', heading: () => '',
    toast() {}, closeModal() {}, openModal() {}, downloadBlob() {}, confirmImport() {},
    __bootCount: 0, __renderCount: 0, __creatorRendered: false, __reloads: 0
  };
  context.window = context;
  context.globalThis = context;
  if (vk) {
    context.vkBridge = {
      isEmbedded: () => true, isWebView: () => false,
      subscribe() {}, send: (name, args) => backend.send(uid, name, args)
    };
  }
  vm.createContext(context);
  const errors = [];
  const run = (code, arg) => {
    context.__argument = arg;
    return vm.runInContext(code, context, { timeout: 10000, filename: 'actual-game-persistence.js' });
  };
  const session = {
    uid, backend, errors,
    page: {
      async evaluate(fn, arg) {
        const result = await run('(' + fn.toString() + ')(__argument)', arg);
        return result === undefined ? undefined : JSON.parse(JSON.stringify(result));
      },
      locator(selector) {
        return {
          async isVisible() {
            if (selector === '#playerName') return context.__creatorRendered === true;
            return !!document.querySelector(selector);
          }
        };
      }
    },
    context: {
      async close() { for (const timer of timers) clearTimeout(timer); timers.clear(); }
    }
  };
  suite.sessions.add(session);
  try {
    run(source);
    if (ready) {
      await Promise.race([
        context.AFNext.cloud.ready,
        new Promise((_, reject) => context.setTimeout(
          () => reject(new Error('VM cloud.ready timed out')), TIMEOUT
        ))
      ]);
    }
  } catch (error) {
    errors.push(error.message);
    throw error;
  }
  return session;
}

suite.configureDriver({ openGame });
suite.runSuite().catch(error => {
  console.error(error.stack);
  process.exitCode = 1;
});
