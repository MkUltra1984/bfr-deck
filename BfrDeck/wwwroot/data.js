'use strict';
// Loads the public bfrevive.net feeds through the host's disk cache and builds lookup indexes.
// units.json / items.json / summons.json / events.json are pushed by the game host twice a day;
// meta.json and u/<id>.json are static (stats, skills, animation frames).

const DATA = {
  units: null, meta: null, items: null, summons: null, events: null,
  unitIndex: null, itemIndex: null, unitNames: [], itemNames: [], builtAt: 0, stale: false,
  unitDetail: new Map(),
};

async function proxyJson(path, fresh) {
  const url = path.startsWith('http') ? path : SITE + path;
  const res = await fetch(`${API}/proxy?u=${encodeURIComponent(url)}${fresh ? '&fresh=1' : ''}`);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  if (res.headers.get('X-Stale') === '1') DATA.stale = true;
  return res.json();
}

async function loadAll(fresh = false) {
  DATA.stale = false;
  const [units, meta, items, summons, events] = await Promise.allSettled([
    proxyJson('/data/units.json', fresh), proxyJson('/units/meta.json', fresh), proxyJson('/data/items.json', fresh),
    proxyJson('/data/summons.json', fresh), proxyJson('/data/events.json', fresh),
  ]);
  const ok = r => r.status === 'fulfilled' ? r.value : null;
  DATA.units = ok(units); DATA.meta = ok(meta); DATA.items = ok(items); DATA.summons = ok(summons); DATA.events = ok(events);
  const errors = [units, meta, items, summons, events].filter(r => r.status === 'rejected').map(r => r.reason && r.reason.message);
  if (DATA.units) buildUnitIndex();
  if (DATA.items) buildItemIndex();
  DATA.builtAt = Math.max(...[DATA.units, DATA.items, DATA.summons, DATA.events].filter(Boolean).map(d => d.built || 0), 0);
  return errors;
}

// ------------------------------------------------------------------ units
const NAME_FIX = { 820157: 'Egg Seeking Cotton', 820158: 'Autonomous Cotton', 810767: 'Juzo Suzuya', 810768: 'Juzo Suzuya', 830798: "S'eljah, Queen in Cobalt" };

const unitRow = id => (DATA.units && DATA.units.units[id]) || [`Unit ${id}`, 0, 0];
const unitName = id => unitRow(id)[0];
const unitRarity = id => unitRow(id)[1];
const unitElement = id => unitRow(id)[2];
const unitMeta = id => (DATA.meta && DATA.meta.units[id]) || null;   // [cost, hp1, atk1, def1, rec1, hp, atk, def, rec, maxlv, anim]
// One word for tight labels: BF names are "Title Name" (Sightless Light Phaedra → Phaedra); collab characters
// (ids 800000+) are "First Last" (Natsu Dragneel → Natsu). "Gemini II & Mina" style keeps the last word.
function shortUnitName(id) {
  const full = unitName(id).replace(/[★☆]\d*\s*/g, '').trim().replace(/\s+and\s+/i, ' & ');
  if (/&/.test(full)) return full;   // a pair ("Gemini II & Mina", "Deemo and the Girl" -> "Deemo & the Girl") keeps both names
  const words = full.split(/\s+/);
  if (words.length === 1) return words[0];
  if (id >= 800000 && words.length === 2) return words[0];
  return words[words.length - 1];
}

function areaChain(D, areaId) {
  const out = []; const seen = new Set();
  for (let a = areaId; a && D.areas[a] && !seen.has(a); a = D.areas[a][1]) { seen.add(a); out.unshift(a); }
  return out;
}
function missionInfo(D, m) {
  const mi = D.missions[m] || ['Quest ' + m, 0];
  const dg = D.dungeons[mi[1]] || ['', 0];
  const chain = areaChain(D, dg[1]);
  return { name: mi[0] || 'Quest ' + m, dungeon: dg[0], chain, path: [...chain.map(a => D.areas[a][0]), dg[0]].filter(Boolean).join(' › ') };
}

function buildUnitIndex() {
  const D = DATA.units;
  for (const [id, name] of Object.entries(NAME_FIX)) if (D.units[id]) D.units[id] = [name, ...D.units[id].slice(1)];
  const idx = {};
  const get = id => (idx[id] ||= { enemy: [], caught: [], reward: [], shop: [], summon: [] });
  for (const r of D.enemy) { get(r[0]).enemy.push(r); if (r[2] && r[2] !== r[0]) get(r[2]).caught.push(r); }
  for (const r of D.reward) get(r[0]).reward.push(r);
  for (const r of D.shop) get(r[0]).shop.push(r);
  for (const u of (D.summon && D.summon.units) || []) get(u.id).summon = u.in;
  DATA.unitIndex = idx;
  DATA.unitNames = Object.entries(D.units).map(([id, u]) => { const n = norm(u[0]); return { id: Number(id), norm: n, tokens: n.split(' ') }; });
}
const EMPTY_U = { enemy: [], caught: [], reward: [], shop: [], summon: [] };
const unitSources = id => (DATA.unitIndex && DATA.unitIndex[id]) || EMPTY_U;

async function unitDetail(id) {
  if (DATA.unitDetail.has(id)) return DATA.unitDetail.get(id);
  try { const d = await proxyJson(`/units/u/${id}.json`); DATA.unitDetail.set(id, d); return d; }
  catch { DATA.unitDetail.set(id, null); return null; }
}

function searchUnits(q, { elements = new Set(), rarities = new Set(), limit = 60 } = {}) {
  const nq = norm(q); const qt = nq.split(' ').filter(Boolean);
  const hits = [];
  for (const e of DATA.unitNames) {
    if (elements.size && !elements.has(unitElement(e.id))) continue;
    if (rarities.size && !rarities.has(Math.min(unitRarity(e.id), 8))) continue;
    const s = nq ? matchScore(nq, qt, e) : 1;
    if (s > 0) hits.push({ id: e.id, s });
  }
  const late = id => (!unitMeta(id) || id >= 990000) ? 1 : 0;
  hits.sort((a, b) => (nq ? b.s - a.s : 0) || late(a.id) - late(b.id) || unitRarity(b.id) - unitRarity(a.id) || b.id - a.id);
  return { total: hits.length, ids: hits.slice(0, limit).map(x => x.id) };
}

// ------------------------------------------------------------------ items
const ITEM_TYPES = { 1: 'Consumable', 2: 'Material', 3: 'Sphere', 4: 'Evolution item', 5: 'Booster', 6: 'LS Sphere' };
const SHOP_NAMES = { 1: 'Event shop', 2: 'Merit Shop', 3: 'Guild Exchange', 4: 'Colosseum Exchange' };
const itemRow = id => (DATA.items && DATA.items.items[id]) || [`Item ${id}`, 0, 0, '', ''];
const itemIcon = id => CDN_ITEM + encodeURIComponent(itemRow(id)[3] || '');
const materials = list => (list || '').split(',').filter(Boolean).map(p => p.split(':').map(Number));

function buildItemIndex() {
  const D = DATA.items;
  const idx = {};
  const get = id => (idx[id] ||= { chest: [], hit: [], clear: [], shop: [], recipe: [], usedIn: [] });
  for (const r of D.chest) get(r[0]).chest.push(r);
  for (const r of D.hit) get(r[0]).hit.push(r);
  for (const r of D.clear) get(r[0]).clear.push(r);
  for (const r of D.shop) get(r[0]).shop.push(r);
  for (const r of D.recipe) { get(r[0]).recipe.push(r); for (const [mat] of materials(r[2])) if (!get(mat).usedIn.includes(r[0])) get(mat).usedIn.push(r[0]); }
  DATA.itemIndex = idx;
  DATA.itemNames = Object.entries(D.items).map(([id, it]) => { const n = norm(it[0]); return { id: Number(id), norm: n, tokens: n.split(' ') }; });
}
const EMPTY_I = { chest: [], hit: [], clear: [], shop: [], recipe: [], usedIn: [] };
const itemSources = id => (DATA.itemIndex && DATA.itemIndex[id]) || EMPTY_I;

function searchItems(q, { type = 0, limit = 80 } = {}) {
  const nq = norm(q); const qt = nq.split(' ').filter(Boolean);
  const hits = [];
  for (const e of DATA.itemNames) {
    if (type && itemRow(e.id)[1] !== type) continue;
    const s = nq ? matchScore(nq, qt, e) : 1;
    if (s > 0) hits.push({ id: e.id, s, n: e.norm });
  }
  hits.sort(nq ? (a, b) => b.s - a.s || a.n.localeCompare(b.n) : (a, b) => a.id - b.id);
  return { total: hits.length, ids: hits.slice(0, limit).map(x => x.id) };
}

// Items whose name matches (used by the planner to show live sources for evolution materials).
function findItemByName(name) {
  const n = norm(name);
  const e = DATA.itemNames.find(x => x.norm === n);
  return e ? e.id : null;
}
function findUnitByName(name) {
  const n = norm(name);
  const e = DATA.unitNames.find(x => x.norm === n);
  return e ? e.id : null;
}

// ------------------------------------------------------------------ dungeons (Vortex)
// Rows of units.json / items.json keyed by mission, built on first use. Used by the Vortex strip and dungeon page.
function missionIndex() {
  if (DATA.byMission) return DATA.byMission;
  const idx = {};
  const get = m => (idx[m] ||= { enemy: [], chest: [], hit: [], clear: [], reward: [] });
  const U = DATA.units, I = DATA.items;
  if (U) { for (const r of U.enemy || []) get(r[1]).enemy.push(r); for (const r of U.reward || []) get(r[1]).reward.push(r); }
  if (I) { for (const r of I.chest || []) get(r[1]).chest.push(r); for (const r of I.hit || []) get(r[1]).hit.push(r); for (const r of I.clear || []) get(r[1]).clear.push(r); }
  return DATA.byMission = idx;
}
const EMPTY_M = { enemy: [], chest: [], hit: [], clear: [], reward: [] };
const missionRows = m => missionIndex()[m] || EMPTY_M;

// A dungeon by name (events.json names Vortex dungeons, units.json knows their ids and missions).
function dungeonByName(name) {
  const D = DATA.units; if (!D) return null;
  const n = norm(name);
  for (const [id, dg] of Object.entries(D.dungeons)) if (norm(dg[0]) === n) return dungeonInfo(Number(id));
  return null;
}
function dungeonInfo(id) {
  const D = DATA.units; const dg = D.dungeons[id]; if (!dg) return null;
  const missions = Object.entries(D.missions).filter(([, m]) => m[1] === id).map(([mid, m]) => ({ id: Number(mid), name: m[0] })).sort((a, b) => a.id - b.id);
  const chain = areaChain(D, dg[1]);
  // Some Grand Quest episodes have a blank dungeon name; the single mission's name is the episode title.
  const name = dg[0] || (missions.length === 1 ? missions[0].name : `Dungeon ${id}`);
  return { id, name, missions, path: chain.map(a => D.areas[a][0]).filter(Boolean).join(' › ') };
}
// What a dungeon gives: capturable units (distinct, best capture chance) and item drops (distinct, best chance), for its cards.
function dungeonLoot(info) {
  const units = new Map(), items = new Map(), foes = new Map(), rewardUnits = new Map(), clearItems = new Map();
  for (const m of info.missions) {
    const r = missionRows(m.id);
    for (const e of r.enemy) if (e[2] && e[3] > 0) { const id = e[2]; if (!units.has(id) || units.get(id) < e[3]) units.set(id, e[3]); } else if (!foes.has(e[0]) || foes.get(e[0]) < m.id) foes.set(e[0], m.id);
    for (const e of r.reward) { rewardUnits.set(e[0], 100); if (!units.has(e[0])) units.set(e[0], 100); }
    for (const c of r.chest) { const p = c[2] / 10; if (!items.has(c[0]) || items.get(c[0]) < p) items.set(c[0], p); }
    for (const c of r.hit) { if (!items.has(c[0]) || items.get(c[0]) < c[2]) items.set(c[0], c[2]); }
    for (const c of r.clear) { clearItems.set(c[0], (clearItems.get(c[0]) || 0) + (c[3] || 1)); if (!items.has(c[0])) items.set(c[0], 100); }
  }
  const by = m => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([id, p]) => ({ id, p }));
  // units / items: everything, best chance first (clear rewards count as 100). rewardUnits / clearItems: guaranteed
  // rewards only. foes: enemies you fight but cannot capture, highest level first.
  return { units: by(units), items: by(items), foes: by(foes), rewardUnits: by(rewardUnits), clearItems: by(clearItems) };
}

// ------------------------------------------------------------------ summons / week
function weekState(now) {
  const S = DATA.summons;
  if (!S) return null;
  if (now >= S.week.ends + 7 * 86400) return { featured: [], ends: 0, next: [], nextStarts: 0, stale: true };
  const rolled = now >= S.week.ends;
  return { featured: rolled ? S.next : S.featured, ends: rolled ? S.week.ends + 7 * 86400 : S.week.ends, next: rolled ? [] : S.next, nextStarts: S.week.ends, stale: false };
}
function gateStatus(g, W, now) {
  if (!g.rotating) return { open: true, text: 'Always open' };
  if (!W || W.stale) return { open: false, text: 'In the weekly rotation' };
  if (W.featured.some(f => f.gate === g.gate)) return { open: true, text: `Featured until ${when(W.ends)}` };
  if (W.next.some(f => f.gate === g.gate)) return { open: false, text: `Featured from ${when(W.nextStarts)}` };
  if (g.next > now) return { open: false, text: `Back ${when(g.next)}` };
  return { open: false, text: 'In the rotation, no date yet' };
}
const gatePrice = g => g.gems > 0 ? `${g.gems} gem${g.gems === 1 ? '' : 's'} a pull` : g.honor > 0 ? `${g.honor} honor a pull` : 'Free';
