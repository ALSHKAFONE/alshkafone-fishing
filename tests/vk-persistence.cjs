'use strict';

/*
 * Integration tests for the actual game page and cloud-save.js.
 *
 * Run a static server at the repository root, then:
 *   node tests/vk-persistence.cjs
 *
 * Optional: AF_TEST_BASE_URL, AF_TEST_ONLY (regular expression),
 * AF_TEST_TIMEOUT_MS, AF_TEST_CHROMIUM.
 *
 * Only the VK transport and browser storage availability are mocked.
 * The real game normaliser, snapshot, save functions, cloud controller, gzip
 * payload, manifest validation and restoration code are exercised.
 * All VK storage is an in-memory Map; no real VK account or network is used.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const zlib = require('node:zlib');
const { chromium } = require('playwright');

const BASE = (process.env.AF_TEST_BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const TIMEOUT = Number(process.env.AF_TEST_TIMEOUT_MS || 25000);
const MANIFEST = 'af_bf_manifest_v1';
const CAREER_PREFIX = 'alshkafone_fishing_career:v1:';
const APP = 'alshkafone-fishing';
const clone = value => JSON.parse(JSON.stringify(value));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let generation = 0;
let browser;
const sessions = new Set();

async function eventually(read, predicate, message, timeout = TIMEOUT) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = await read();
    if (predicate(last)) return last;
    await wait(80);
  }
  throw new Error(message + '; last=' + JSON.stringify(last));
}

function gate() {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return { promise, release };
}

function careerKey(uid) {
  return CAREER_PREFIX + (uid ? 'vk:' + uid : 'local');
}

class VKBackend {
  constructor() {
    this.accounts = new Map();
    this.calls = [];
    this.commits = [];
    this.failGets = 0;
    this.failPartSetAt = 0;
    this.partSets = 0;
    this.failedParts = 0;
    this.readGate = null;
  }

  store(uid) {
    if (!this.accounts.has(uid)) this.accounts.set(uid, new Map());
    return this.accounts.get(uid);
  }

  async send(uid, name, args = {}) {
    this.calls.push({
      uid, name, key: args.key || '', keys: args.keys || [],
      length: typeof args.value === 'string' ? args.value.length : 0,
      at: Date.now()
    });
    if (name === 'VKWebAppInit') return { result: true };
    if (name === 'VKWebAppGetUserInfo') {
      return { id: Number(uid), first_name: 'Сергей', last_name: 'Проверка' };
    }
    if (name === 'VKWebAppStorageGet') {
      if (this.readGate) await this.readGate.promise;
      if (this.failGets > 0) {
        this.failGets--;
        throw new Error('Injected transient VK read failure');
      }
      const store = this.store(uid);
      return { keys: args.keys.map(key => ({ key, value: store.get(key) || '' })) };
    }
    if (name === 'VKWebAppStorageSet') {
      if (args.key !== MANIFEST && args.value) {
        this.partSets++;
        if (this.failPartSetAt && this.partSets === this.failPartSetAt) {
          this.failedParts++;
          throw new Error('Injected failure after a staged VK chunk');
        }
      }
      this.store(uid).set(args.key, args.value);
      if (args.key === MANIFEST && args.value) {
        this.commits.push({ uid, raw: args.value, state: this.read(uid), at: Date.now() });
      }
      return { result: true };
    }
    throw new Error('Unexpected VK bridge method: ' + name);
  }

  seed(uid, state, version = '3.6.39') {
    const store = this.store(uid);
    const previousRaw = store.get(MANIFEST);
    const previous = previousRaw ? JSON.parse(previousRaw) : null;
    if (previous) delete previous.previous;
    const bytes = Buffer.from(JSON.stringify({ app: APP, version, state }), 'utf8');
    const data = zlib.gzipSync(bytes).toString('base64');
    const parts = data.match(/.{1,3000}/g);
    const gen = 'integration_' + String(++generation).padStart(8, '0');
    const meta = {
      app: APP, schema: 1, version, generation: gen,
      count: parts.length, bytes: bytes.length, encoding: 'gzip-base64',
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
      updatedAt: Date.now() + generation,
      ...(previous ? { previous } : {})
    };
    parts.forEach((part, index) => store.set('af_bf_g_' + gen + '_' + index, part));
    store.set(MANIFEST, JSON.stringify(meta));
    return meta;
  }

  read(uid) {
    const store = this.store(uid);
    const raw = store.get(MANIFEST);
    if (!raw) return null;
    const meta = JSON.parse(raw);
    const data = Array.from({ length: meta.count }, (_, index) =>
      store.get('af_bf_g_' + meta.generation + '_' + index) || ''
    ).join('');
    assert.equal(
      crypto.createHash('sha256').update(data).digest('hex'), meta.sha256,
      'Committed manifest must point to complete, unmodified chunks'
    );
    const compressed = Buffer.from(data, 'base64');
    const bytes = meta.encoding === 'gzip-base64' ? zlib.gunzipSync(compressed) : compressed;
    assert.equal(bytes.length, meta.bytes, 'Committed payload byte length');
    const envelope = JSON.parse(bytes.toString('utf8'));
    assert.equal(envelope.app, APP);
    return envelope.state;
  }
}

async function openGame(options = {}) {
  const {
    backend = new VKBackend(), uid = '99001001', storage = {},
    vk = true, rejectStorageWrites = false, ready = true
  } = options;
  const context = await browser.newContext({
    viewport: { width: 1100, height: 780 },
    reducedMotion: 'reduce'
  });
  const errors = [];
  await context.exposeBinding('__vkPersistenceTransport', async (_source, name, args) =>
    backend.send(uid, name, args)
  );
  await context.addInitScript(({ uid, storage, vk, rejectStorageWrites }) => {
    for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value);
    if (rejectStorageWrites) {
      Storage.prototype.setItem = function () {
        throw new DOMException('Storage writes disabled by integration test', 'QuotaExceededError');
      };
    }
    if (vk) {
      const mock = {
        isEmbedded: () => true,
        isWebView: () => false,
        isIframe: () => true,
        isStandalone: () => false,
        supports: () => true,
        supportsAsync: async () => true,
        subscribe: () => {},
        unsubscribe: () => {},
        send: (name, args = {}) => window.__vkPersistenceTransport(name, args)
      };
      // The actual bundled bridge also assigns window.vkBridge. Keep only its
      // transport mocked while retaining all real game/controller code.
      Object.defineProperty(window, 'vkBridge', {
        configurable: true, get: () => mock, set: () => {}
      });
    }
    window.__vkPersistenceTest = { uid, vk, rejectStorageWrites };
  }, { uid, storage, vk, rejectStorageWrites });
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(BASE + '/') || /^(data:|blob:)/.test(url)) return route.continue();
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const session = { context, page, backend, uid, errors };
  sessions.add(session);
  const query = vk ? '?vk_user_id=' + uid + '&vk_app_id=7777777&vk_platform=desktop_web' : '';
  await page.goto(BASE + '/index.html' + query, {
    waitUntil: 'domcontentloaded', timeout: TIMEOUT,
    ...(vk ? { referer: 'https://vk.com/app7777777' } : {})
  });
  await page.waitForFunction(() => window.AFNext && window.AFNext.cloud, null, { timeout: TIMEOUT });
  if (ready) await waitReady(session);
  return session;
}

async function waitReady(session) {
  await session.page.evaluate(async timeout => {
    const cloud = window.AFNext.cloud;
    if (!cloud.ready || typeof cloud.ready.then !== 'function') {
      throw new Error('Integration tests require the new AFNext.cloud.ready boot contract');
    }
    await Promise.race([
      cloud.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('cloud.ready timed out')), timeout))
    ]);
  }, TIMEOUT);
  return session;
}

async function closeGame(session) {
  sessions.delete(session);
  await session.context.close();
}

async function storageOf(session) {
  return session.page.evaluate(() => Object.fromEntries(
    Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])
  ));
}

async function snapshotOf(session) {
  return session.page.evaluate(() => window.AFNext.snapshot());
}

function projection(state) {
  const profile = state.profile || {};
  return {
    profile: Object.fromEntries(
      ['name', 'gender', 'age', 'face', 'skin', 'hair', 'hairColor', 'eyeColor', 'beard', 'done']
        .map(key => [key, profile[key]])
    ),
    level: state.level,
    xp: state.xp,
    coins: state.coins,
    tokens: state.tokens,
    stats: state.stats,
    owned: [...(state.owned || [])].sort(),
    equip: state.equip,
    baits: state.baits,
    bag: (state.bag || []).map(row => ({
      id: row.id, species: row.species, weight: row.weight, length: row.length
    })),
    records: state.records,
    quests: state.quests,
    visited: state.visited,
    forestPhotos: state.forest && state.forest.photos,
    forestGear: state.forest && state.forest.gear,
    homes: state.v34 && state.v34.homes,
    garages: state.v34 && state.v34.garages,
    boatGear: state.v34 && state.v34.boatGear,
    homeMemories: (state.next?.home?.memories || []).map(row => ({
      id: row.id, species: row.species, weight: row.weight, note: row.note,
      profileName: row.profile && row.profile.name, equip: row.equip
    })),
    waterPhotos: (state.next?.waters?.photos || []).map(row => ({
      id: row.id, title: row.title, source: row.source,
      profile: row.profile, equip: row.equip, layers: row.layers
    })),
    storyJournal: (state.next?.stories?.journal || []).map(row => ({
      id: row.id, species: row.species, weight: row.weight, note: row.note, action: row.action
    })),
    extensionBranch: state.next && state.next.persistenceProof
  };
}

async function buildFixture() {
  const session = await openGame({ vk: false, uid: '' });
  try {
    const state = await session.page.evaluate(() => {
      const s = window.AFNext.snapshot();
      s.profile = {
        ...s.profile, name: 'Сергей Тест', gender: 'male', age: 37,
        face: 2, hairColor: 1, done: true
      };
      s.level = 7;
      s.xp = 34;
      s.coins = 48765;
      s.tokens = 29;
      s.stats = { caught: 11, sold: 3, released: 2, trophies: 1, earned: 1900 };
      s.owned = [...new Set([...s.owned, 'rod_taiga', 'reel_titan', 'boat_air'])];
      s.equip.rod = 'rod_taiga';
      s.equip.reel = 'reel_titan';
      s.equip.boat = 'boat_air';
      s.v34.homes = AF34_DATA.homes.slice(0, 2).map(row => row.id);
      s.v34.garages = AF34_DATA.garages.slice(0, 2).map(row => row.id);
      s.v34.gear = ['sonar'];
      s.v34.boatGear.boat_air = ['sonar'];
      s.baits.worm = 37;
      s.baits.spinner = 1;
      s.records.perch = { count: 8, weight: 1.25, length: 33 };
      s.quests = ['first', 'five'];
      s.visited = ['pine', 'river'];
      const fish = {
        id: 'persistence-catch-001', species: 'perch', name: 'Окунь',
        weight: 1.25, length: 33, value: 150, xp: 20,
        trophy: true, location: 'pine', date: 1770000000000
      };
      s.bag = [fish];
      s.pending = null;
      s.settings.reduced = true;
      s.settings.ambience = false;
      s.settings.effects = false;
      s.next.meta.careerEpoch = 'integration-career-sergey-001';
      s.next.meta.seq = 17;
      s.next.meta.modifiedAt = 1770000000000;
      s.next.persistenceProof = {
        schema: 1, route: ['pine', 'river', 'home'],
        nested: { keepsFalse: false, count: 23, note: 'Ветка сохранения целиком' }
      };
      s.next.home.memories = [{
        ...fish, note: 'Трофей после долгой проводки',
        profile: { ...s.profile }, equip: { ...s.equip }, outcome: 'keep', period: 2
      }];
      s.next.home.seeded = true;
      s.next.waters = {
        ...(s.next.waters || {}),
        photos: [{
          id: 'persistence-water-photo-001', at: 1770000000000,
          title: 'У причала', location: 'pine', place: 'Причал', areaName: 'Камыши',
          source: { set: 'next', path: ['fishing'] }, scene: 'water',
          profile: { ...s.profile }, equip: { ...s.equip }, layers: []
        }]
      };
      s.next.stories.journal = [{
        ...fish, at: fish.date, note: 'Проверяем дневник', action: 'keep'
      }];
      s.forest.photos = [{
        animal: AF36_DATA.animals[0].id, season: 1, biome: 'pine', day: 9
      }];
      s.forest.gear = AF36_DATA.gear.slice(0, 2).map(row => row.id);
      window.AFNext.applyState(s, 'Integration fixture');
      return window.AFNext.snapshot();
    });
    assert.equal(state.level, 7);
    assert.equal(state.xp, 34);
    assert.equal(state.coins, 48765);
    assert.equal(state.tokens, 29);
    assert.ok(state.owned.includes('boat_air'), 'Fixture must retain its purchased boat');
    assert.equal(state.v34.homes.length, 2, 'Fixture must retain a purchased home');
    assert.equal(state.v34.garages.length, 2, 'Fixture must retain a purchased garage');
    assert.equal(state.next.home.memories.length, 1);
    assert.equal(state.next.waters.photos.length, 1);
    return state;
  } finally {
    await closeGame(session);
  }
}

async function synced(session, expectedCoins) {
  return eventually(
    async () => ({
      cloud: await session.page.evaluate(() => window.AFNext.cloud.state),
      saved: session.backend.read(session.uid)
    }),
    value => value.saved && value.saved.coins === expectedCoins &&
      !value.cloud.busy && value.cloud.status === 'synced',
    'Automatic cloud synchronization did not complete'
  );
}

async function startSynced(backend, uid, fixture) {
  const session = await openGame({
    backend, uid, storage: { [careerKey(uid)]: JSON.stringify(fixture) }
  });
  await synced(session, fixture.coins);
  return session;
}

function editStoredCareer(storage, uid, edit) {
  const out = { ...storage };
  const state = JSON.parse(out[careerKey(uid)]);
  edit(state);
  state.next.meta.seq = (state.next.meta.seq || 0) + 1;
  state.next.meta.modifiedAt = Date.now();
  out[careerKey(uid)] = JSON.stringify(state);
  return out;
}

const tests = [];
function test(name, run) { tests.push({ name, run }); }

test('first automatic upload and complete restoration after browser storage loss', async fixture => {
  const backend = new VKBackend(), uid = '99001001';
  const first = await startSynced(backend, uid, fixture);
  const expected = projection(await snapshotOf(first));
  assert.deepEqual(projection(backend.read(uid)), expected);
  const writesBeforeLoss = backend.commits.length;
  assert.ok(writesBeforeLoss > 0, 'The first upload must happen automatically');
  await closeGame(first);
  const restored = await openGame({ backend, uid });
  assert.deepEqual(projection(await snapshotOf(restored)), expected);
  assert.equal((await snapshotOf(restored)).profile.done, true);
  assert.ok(backend.commits.every(row => row.state.profile.done && row.state.level >= 7),
    'A blank career must never replace the cloud career');
  await closeGame(restored);
});

test('dirty local continuation automatically resumes saving after reopen', async fixture => {
  const backend = new VKBackend(), uid = '99001002';
  const first = await startSynced(backend, uid, fixture);
  const storage = await storageOf(first);
  await closeGame(first);
  const dirty = editStoredCareer(storage, uid, state => {
    state.coins += 111;
    state.stats.earned += 111;
  });
  const resumed = await openGame({ backend, uid, storage: dirty });
  await synced(resumed, fixture.coins + 111);
  await resumed.page.evaluate(() => {
    S.coins += 13;
    S.stats.earned += 13;
    save();
  });
  await synced(resumed, fixture.coins + 124);
  await closeGame(resumed);
});

test('unchanged stale local copy restores newer cloud revision automatically', async fixture => {
  const backend = new VKBackend(), uid = '99001003';
  const first = await startSynced(backend, uid, fixture);
  const storage = await storageOf(first);
  const advanced = clone(backend.read(uid));
  await closeGame(first);
  advanced.coins += 500;
  advanced.level = 8;
  advanced.xp = 41;
  advanced.stats.caught += 3;
  advanced.next.meta.seq++;
  backend.seed(uid, advanced);
  const marker = backend.commits.length;
  const reopened = await openGame({ backend, uid, storage });
  const snapshot = await snapshotOf(reopened);
  assert.equal(snapshot.coins, advanced.coins);
  assert.equal(snapshot.level, 8);
  assert.equal(snapshot.xp, 41);
  assert.equal(snapshot.stats.caught, advanced.stats.caught);
  assert.ok(backend.commits.slice(marker).every(row => row.state.coins === advanced.coins),
    'Stale local data must not overwrite the advanced cloud revision');
  await closeGame(reopened);
});

test('true diverged local and cloud branches require an explicit choice', async fixture => {
  const backend = new VKBackend(), uid = '99001004';
  const first = await startSynced(backend, uid, fixture);
  const storage = await storageOf(first);
  const advanced = clone(backend.read(uid));
  await closeGame(first);
  const dirty = editStoredCareer(storage, uid, state => {
    state.coins += 200;
    state.stats.earned += 200;
  });
  advanced.coins += 900;
  advanced.stats.earned += 900;
  advanced.next.meta.seq += 2;
  backend.seed(uid, advanced);
  const marker = backend.commits.length;
  const conflict = await openGame({ backend, uid, storage: dirty });
  assert.equal(await conflict.page.evaluate(() => window.AFNext.cloud.status), 'choice');
  assert.equal((await snapshotOf(conflict)).coins, fixture.coins + 200);
  assert.equal(backend.commits.length, marker, 'A conflict must not write either branch automatically');
  await conflict.page.evaluate(() => window.AFNext.cloud.useCloud());
  assert.equal((await snapshotOf(conflict)).coins, advanced.coins);
  assert.equal((await snapshotOf(conflict)).stats.earned, advanced.stats.earned);
  await closeGame(conflict);
});

test('delayed first cloud read neither reveals the creator nor writes a blank career', async fixture => {
  const backend = new VKBackend(), uid = '99001005';
  backend.seed(uid, fixture);
  const hold = gate();
  backend.readGate = hold;
  let session;
  try {
    session = await openGame({ backend, uid, ready: false });
    await eventually(
      () => backend.calls.some(call => call.name === 'VKWebAppStorageGet'),
      value => value,
      'Boot never requested the cloud save'
    );
    const creatorVisible = await session.page.locator('#playerName').isVisible();
    assert.equal(creatorVisible, false, 'Do not show the character creator before initial restore finishes');
    assert.equal(backend.commits.length, 0);
  } finally {
    backend.readGate = null;
    hold.release();
  }
  await waitReady(session);
  assert.equal((await snapshotOf(session)).level, 7);
  assert.equal((await snapshotOf(session)).coins, fixture.coins);
  assert.ok(backend.commits.every(row => row.state.level >= 7));
  await closeGame(session);
});

test('transient initial read error preserves cloud and can restore on retry', async fixture => {
  const backend = new VKBackend(), uid = '99001006';
  backend.seed(uid, fixture);
  backend.failGets = 1;
  const session = await openGame({ backend, uid });
  assert.ok(backend.commits.every(row => row.state.profile.done && row.state.coins === fixture.coins),
    'A transient read failure must never upload an empty replacement');
  await session.page.evaluate(() => window.AFNext.cloud.refresh());
  await eventually(
    () => snapshotOf(session),
    state => state.profile.done && state.coins === fixture.coins,
    'Cloud restoration did not resume after a successful retry'
  );
  assert.equal(backend.read(uid).coins, fixture.coins);
  await closeGame(session);
});

test('failed staged chunk upload keeps the old committed cloud copy intact', async fixture => {
  const backend = new VKBackend(), uid = '99001007';
  const session = await startSynced(backend, uid, fixture);
  const oldManifest = backend.store(uid).get(MANIFEST);
  const oldState = backend.read(uid);
  backend.partSets = 0;
  backend.failPartSetAt = 2;
  const noise = crypto.randomBytes(3000).toString('hex');
  await session.page.evaluate(noise => {
    S.coins += 1234;
    S.next.persistenceProof.stagedPayload = noise;
    save();
  }, noise);
  await session.page.evaluate(() => window.AFNext.cloud.sync());
  await eventually(() => backend.failedParts, count => count === 1, 'No staged-part failure was exercised');
  assert.equal(backend.store(uid).get(MANIFEST), oldManifest,
    'The manifest must not move after a partial upload');
  assert.deepEqual(backend.read(uid), oldState);
  await closeGame(session);
  backend.failPartSetAt = 0;
  const restored = await openGame({ backend, uid });
  assert.equal((await snapshotOf(restored)).coins, oldState.coins);
  await closeGame(restored);
});

test('legacy 3.6.39 gzip envelope and manifest restore in the upgraded build', async fixture => {
  const backend = new VKBackend(), uid = '99001008';
  const legacy = clone(fixture);
  legacy.release = '3.6.39';
  backend.seed(uid, legacy, '3.6.39');
  const session = await openGame({ backend, uid });
  assert.deepEqual(projection(await snapshotOf(session)), projection(fixture));
  assert.notEqual(await session.page.evaluate(() => window.AFNext.cloud.status), 'error');
  await closeGame(session);
});

test('ordinary standalone page remains usable with local persistence and no VK', async fixture => {
  const backend = new VKBackend();
  const first = await openGame({ backend, vk: false, uid: '' });
  await first.page.evaluate(state => window.AFNext.applyState(state, 'Standalone integration fixture'), fixture);
  const stored = await storageOf(first);
  assert.equal(JSON.parse(stored[careerKey('')]).coins, fixture.coins);
  await closeGame(first);
  const reloaded = await openGame({ backend, vk: false, uid: '', storage: stored });
  assert.deepEqual(projection(await snapshotOf(reloaded)), projection(fixture));
  assert.equal(backend.calls.length, 0, 'Standalone pages must not issue VK storage operations');
  await closeGame(reloaded);
});

test('cloud page renders before character registration', async () => {
  const session = await openGame({ vk: false, uid: '' });
  const result = await session.page.evaluate(() => {
    const before = window.AFNext.snapshot();
    // This is the real route wrapper installed by installNextCore. It permits
    // the cloud route before registration; the real render wrapper must agree.
    route('cloud');
    return {
      doneBefore: before.profile.done,
      doneAfter: window.AFNext.snapshot().profile.done,
      view,
      html: document.getElementById('screen').innerHTML
    };
  });
  assert.equal(result.doneBefore, false, 'Use a genuinely unregistered profile');
  assert.equal(result.doneAfter, false, 'Opening saves must not register a character');
  assert.equal(result.view, 'cloud', 'The cloud route must be selected');
  assert.match(result.html, /class="nc-hero"/,
    'The real render wrapper must render the cloud page before registration');
  assert.match(result.html, /nc-local-tools/,
    'The cloud page must include its save/import controls');
  await closeGame(session);
});

test('cloud career restores in memory even when localStorage writes are unavailable', async fixture => {
  const backend = new VKBackend(), uid = '99001009';
  backend.seed(uid, fixture);
  const session = await openGame({ backend, uid, rejectStorageWrites: true });
  assert.deepEqual(projection(await snapshotOf(session)), projection(fixture));
  assert.equal(backend.read(uid).coins, fixture.coins);
  assert.ok(backend.commits.every(row => row.state.profile.done && row.state.coins === fixture.coins),
    'Local storage failure must not erase the cloud career');
  await closeGame(session);
});

async function runSuite() {
  let failed = 0;
  try {
    const fixture = await buildFixture();
    const filter = process.env.AF_TEST_ONLY ? new RegExp(process.env.AF_TEST_ONLY, 'i') : null;
    const selected = tests.filter(entry => !filter || filter.test(entry.name));
    if (!selected.length) throw new Error('AF_TEST_ONLY did not match any tests');
    for (const entry of selected) {
      const at = Date.now();
      try {
        await entry.run(clone(fixture));
        console.log('PASS ' + entry.name + ' (' + (Date.now() - at) + ' ms)');
      } catch (error) {
        failed++;
        console.error('FAIL ' + entry.name + '\n' + error.stack);
        for (const session of sessions) {
          try {
            console.error('Diagnostics ' + JSON.stringify({
              uid: session.uid,
              pageErrors: session.errors.slice(-8),
              cloud: await session.page.evaluate(() => window.AFNext?.cloud?.state),
              lastCalls: session.backend.calls.slice(-8)
            }));
          } catch (_) {}
        }
      } finally {
        for (const session of [...sessions]) await closeGame(session).catch(() => {});
      }
    }
    console.log('RESULT ' + JSON.stringify({
      total: selected.length, passed: selected.length - failed, failed
    }));
    if (failed) process.exitCode = 1;
  } finally {
    for (const session of [...sessions]) await closeGame(session).catch(() => {});
  }
}

async function main() {
  const custom = process.env.AF_TEST_CHROMIUM;
  const executablePath = custom || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({
    headless: true, ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader']
  });
  try { await runSuite(); } finally { await browser.close(); }
}

module.exports = {
  VKBackend, projection, sessions, runSuite,
  configureDriver(driver) { openGame = driver.openGame; }
};
if (require.main === module) {
  main().catch(error => {
    console.error(error.stack);
    process.exitCode = 1;
  });
}
