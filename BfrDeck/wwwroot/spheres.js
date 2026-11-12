'use strict';
// Suggested spheres: two per unit, worked out by the deck (no curated list).
//   1. A sphere the unit's Extra Skill names ("... when Oracle Bangles is equipped") comes first: it switches the ES on.
//   2. The rest by fit: every sphere's effect text is read into a few strengths (attack, spark, crit, BB gauge,
//      survival ...), and the unit's skills say how much each of them is worth to it (unitRoles in roles.js).
//   3. Only spheres with a known way to get them in Revived (drop, clear reward, shop, recipe), unless the ES names one.
//   4. The second sphere must do something else than the first (the game also forbids two spheres of one type).
// Sphere types (Spark, Atk Boosting, ...) come from sphere-types.js: an ES that asks for a type gets the best sphere
// of that type first, and the two picks are never of one type (the game forbids it).
// Shown on the unit page (sphereSection) and offered in the Team Builder (suggestSpheres).
// Suggested SP build (suggestSp, spSection): the unit's SP options scored the same way, the best set within 100 SP.

const SPH_WORDS = [['slightly', 20], ['considerably', 40], ['greatly', 50], ['hugely', 75], ['massively', 75], ['enormously', 100], ['fully', 100]];
const SPH_LABEL = { atk: 'attack', spark: 'spark damage', crit: 'critical hits', elem: 'elemental damage', bbatk: 'BB attack', bulk: 'HP and defence', mitig: 'damage reduction', bb: 'BB gauge', heal: 'healing', guard: 'ailment and KO protection', od: 'OD gauge' };
const SPH_ELEMENTS = ['fire', 'water', 'earth', 'thunder', 'light', 'dark'];
// how an Extra Skill words a sphere type -> the type's name in sphere-types.js
const SPH_TYPE_WORDS = [[/spark/i, 'Spark'], [/atk boost|attack boost/i, 'Atk Boosting'], [/critical/i, 'Critical'], [/damage reduc/i, 'Damage Reduction'], [/BB gauge/i, 'BB Gauge'], [/HP recovery/i, 'HP Recovery'],
  [/status boost/i, 'Status Boost'], [/ailment resist/i, 'Ailment Resist'], [/status ailment|ailment inflict/i, 'Status Ailment'], [/drop/i, 'Drop'], [/def(ense)? ignor/i, 'Def Ignore'], [/reflect/i, 'Damage Reflect'], [/target/i, 'Expose Target']];
let sphereCache = null;

// a sphere's effect text as strengths, e.g. { atk: 2, spark: 4, bb: 1 }; `only` lists elements it is limited to
function sphereParts(desc) {
  const f = {}, add = (k, v) => { if (v > 0) f[k] = (f[k] || 0) + v; };
  let only = null;
  for (const raw of String(desc).split(/,|&|\band\b(?! Rec| Def| max| HP| Atk)/i)) {
    const c = raw.trim(); if (!c) continue;
    const lim = /\(([^)]*)\)/.exec(c);
    if (lim) { const els = lim[1].toLowerCase().split(/[\s,\/]+/).filter(x => SPH_ELEMENTS.includes(x)); if (els.length) only = (only || []).concat(els); }
    const num = /(\d+)\s*%/.exec(c), word = SPH_WORDS.find(([w]) => new RegExp('\\b' + w + '\\b', 'i').test(c));
    let pct = num ? Number(num[1]) : word ? word[1] : 30;
    if (/\bwhen\b|\bif\b|first \d+ turns|for \d+ turns? when|chance|may\b|probab/i.test(c)) pct *= 0.7;   // only some of the time
    if (/\b(lowers?|reduces?) (own )?(Atk|Def|Rec|max HP)/i.test(c)) continue;
    const reduction = /reduction|reduces?|mitigat|decreases?/i.test(c);
    if (/spark/i.test(c)) { if (reduction) add('bulk', 0.2); else if (/BB gauge|BC|HC|HP/i.test(c)) add(/HP|HC/i.test(c) && !/BB|BC/i.test(c) ? 'heal' : 'bb', pct / 40); else add('spark', pct / 50); continue; }
    if (/critical/i.test(c)) { if (reduction || /negat|null/i.test(c)) add('bulk', 0.2); else if (/BB gauge|BC/i.test(c)) add('bb', pct / 40); else add('crit', /rate/i.test(c) ? pct / 60 : pct / 50); if (/elemental/i.test(c) && !reduction) add('elem', pct / 50); continue; }
    if (/elemental (damage|weakness)/i.test(c)) { if (reduction || /negat|null/i.test(c)) add('bulk', 0.2); else add('elem', pct / 50); continue; }
    if (/BB Atk/i.test(c)) { add('bbatk', pct / 100); continue; }
    if (/OD gauge|Overdrive/i.test(c)) { add('od', pct / 40); continue; }
    if (/BB gauge|\bBC\b|BB fill/i.test(c)) { add('bb', (pct / 30) * (/each turn/i.test(c) ? 1.5 : 1)); if (/\bHP\b|\bHC\b/i.test(c)) add('heal', pct / 40); continue; }
    if (/(restores?|recovers?|heals?|absorbs?|drains?)[^.]*\bHP\b|\bHP\b[^.]*each turn|\bHC\b/i.test(c)) { add('heal', pct / 30); continue; }
    if (/KO resistance|Angel Idol|survive|revive/i.test(c)) { add('guard', 1.5); continue; }
    if (/negates?|nullif|immun|resist/i.test(c)) { add('guard', /all status|all ailments/i.test(c) ? 1.2 : 0.6); continue; }
    if (/damage (reduction|taken)|reduces? damage|mitigat|decreases? .*damage/i.test(c)) { add('mitig', /(fire|water|earth|thunder|light|dark)\b/i.test(c) && !/all/i.test(c) ? pct / 60 : pct / 10); continue; }
    if (/ignor/i.test(c)) { add('atk', 0.5); continue; }
    if (/damage (against|to|dealt)|normal hit|hit count/i.test(c)) { add('atk', pct / 100); continue; }
    if (/all (parameters|stats)/i.test(c)) { add('atk', pct / 50); add('bulk', pct / 30); continue; }
    if (/\bAtk\b/i.test(c)) add('atk', pct / 50);
    if (/\bDef\b/i.test(c)) add('bulk', pct / 80);
    if (/\bRec\b/i.test(c)) add('bulk', pct / 120);
    if (/\bHP\b/i.test(c)) add('bulk', pct / 60);
  }
  return { f, only };
}

function sphereList() {
  if (sphereCache) return sphereCache;
  const out = [];
  for (const [id, it] of Object.entries((DATA.items && DATA.items.items) || {})) {
    if (it[1] !== 3 || !it[2] || !it[4] || /[぀-ヿ一-鿿]/.test(it[4]) || /-\d+%/.test(it[4])) continue;
    const src = itemSources(Number(id));
    const how = src.recipe.length ? 'craft' : src.shop.length ? 'shop' : src.clear.length ? 'clear reward' : src.chest.length || src.hit.length ? 'quest drop' : '';
    const p = sphereParts(it[4]);
    out.push({ id: Number(id), name: it[0], rarity: it[2], desc: it[4], f: p.f, only: p.only, how, type: SPHERE_TYPE[id] || '' });
  }
  return sphereCache = out;
}

// how much each strength is worth to a unit, from what its skills do
function sphereFocus(u) {
  const r = unitRoles(u), has = k => r.roles.has(k);
  const support = ['heal', 'mitig', 'cleanse', 'shield', 'angel'].filter(has).length, offense = ['spark', 'crit', 'elem', 'bbatk', 'atk'].filter(has).length;
  const w = { atk: 1 + 0.2 * offense, spark: (has('spark') ? 1.5 : 0.6) + (r.hits >= 20 ? 0.3 : 0), crit: has('crit') ? 1.3 : 0.4, elem: has('elem') ? 1.2 : 0.5, bbatk: 0.8,
    bulk: 0.5 + 0.3 * support, mitig: 0.5 + 0.25 * support, bb: 1 + 0.3 * support, heal: 0.4 + 0.2 * support, guard: 0.5 + 0.2 * support, od: 0.3 };
  const pure = support >= 2 && offense <= 1;
  if (pure) for (const k of ['atk', 'spark', 'crit', 'elem', 'bbatk']) w[k] *= 0.5;
  return { w, label: pure ? 'support' : support >= 2 ? 'damage and support' : 'damage' };
}

// what the Extra Skill asks for: { ids: spheres it names, types: sphere types it names (text) }
function esSphereNeeds(u) {
  const ids = [], types = [];
  const text = (u && u.es && u.es.desc) || '';
  for (const m of text.matchAll(/when ([^,&]*?) (?:is|are) equipped/gi)) {
    for (let part of m[1].split(/\s+or\s+/i)) {
      part = part.replace(/^(an?|the)\s+/i, '').trim(); if (!part) continue;
      const n = norm(part.replace(/\s+sphere$/i, '')), hit = sphereList().find(s => norm(s.name) === n || norm(s.name) === norm(part));
      if (hit) ids.push(hit.id);
      else if (/sphere/i.test(part)) { const t = SPH_TYPE_WORDS.find(([re]) => re.test(part)); types.push(t ? t[1] : part); }
    }
  }
  return { ids: [...new Set(ids)], types: [...new Set(types)] };
}

// { picks: [{ sphere, why: [labels], es: bool }], wish, needs, focus }: two spheres for the unit (detail `u` from unitDetail)
function suggestSpheres(id, u) {
  const all = sphereList(), focus = sphereFocus(u), needs = esSphereNeeds(u), el = (ELEMENTS[unitElement(id)] || '').toLowerCase();
  const fit = s => { if (s.only && el && !s.only.includes(el)) return 0; let t = 0; for (const [k, v] of Object.entries(s.f)) t += v * (focus.w[k] || 0); return t; };
  const why = s => Object.entries(s.f).map(([k, v]) => [k, v * (focus.w[k] || 0)]).sort((a, b) => b[1] - a[1]).slice(0, 2).filter(x => x[1] > 0).map(x => SPH_LABEL[x[0]]);
  const main = s => (Object.entries(s.f).map(([k, v]) => [k, v * (focus.w[k] || 0)]).sort((a, b) => b[1] - a[1])[0] || [''])[0];
  const picks = [];
  // the ES sphere leads when Revived gives it; one that cannot be had yet is only mentioned (`wish`)
  const esOnes = needs.ids.map(i => all.find(s => s.id === i)).filter(Boolean).sort((a, b) => fit(b) - fit(a));
  const named = esOnes.find(s => s.how), wishS = named ? null : esOnes[0];
  const wish = wishS ? { sphere: wishS, why: why(wishS), es: true } : null;
  if (named) picks.push({ sphere: named, why: why(named), es: true });
  const pool = all.filter(s => s.how && (!named || s.id !== named.id)).map(s => [s, fit(s)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1] || b[0].rarity - a[0].rarity || a[0].id - b[0].id);
  // no named sphere to be had, but the ES accepts a type: the best sphere of that type switches it on
  if (!named && needs.types.length) { const t = pool.find(([s]) => needs.types.includes(s.type)); if (t) picks.push({ sphere: t[0], why: why(t[0]), es: true }); }
  const sameType = (a, b) => a.type && a.type === b.type;
  for (const [s] of pool) {
    if (picks.length >= 2) break;
    if (picks.some(p => p.sphere.id === s.id || p.sphere.name === s.name || sameType(p.sphere, s) || (!s.type && main(p.sphere) === main(s)))) continue;
    picks.push({ sphere: s, why: why(s), es: false });
  }
  for (const [s] of pool) { if (picks.length >= 2) break; if (!picks.some(p => p.sphere.id === s.id || sameType(p.sphere, s))) picks.push({ sphere: s, why: why(s), es: false }); }
  return { picks, wish, needs, focus };
}

// the block on a unit's page
function sphereSection(id, u) {
  const r = suggestSpheres(id, u);
  if (!r.picks.length) return null;
  const card = p => h('a', { class: 'sphcard', href: `#/items/${p.sphere.id}`, title: p.sphere.desc },
    h('img', { src: itemIcon(p.sphere.id), alt: '', width: 40, height: 40, loading: 'lazy' }),
    h('div', {}, h('div', { class: 'nm' }, p.sphere.name, h('span', { class: 'tag' }, `★${p.sphere.rarity}`), p.sphere.type ? h('span', { class: 'tag' }, p.sphere.type) : null, p.es ? h('span', { class: 'tag gold' }, 'switches on its ES') : null),
      h('div', { class: 'faint' }, [p.why.join(' · '), p.sphere.how || 'not obtainable in Revived yet'].filter(Boolean).join(' · ')),
      h('p', {}, p.sphere.desc)));
  return h('div', { class: 'sphbox' },
    h('h2', {}, 'Suggested spheres'),
    h('p', { class: 'faint', style: 'margin:0 0 8px' }, `Picked by the deck for what this unit does (${r.focus.label}), from spheres you can get in Revived.`),
    r.needs.types.length ? h('p', { class: 'sphneed' }, 'Its Extra Skill needs a ', h('b', {}, r.needs.types.join(' or ')), ' sphere.') : null,
    h('div', { class: 'sphcards' }, r.picks.map(card), r.wish ? card(r.wish) : null),
    h('p', { style: 'margin:8px 0 0' }, h('a', { href: '#', onclick: e => { e.preventDefault(); host.open('site', `https://bfcompanion.app/#/unit/${id}`); } }, 'Spheres and SP builds on BF Companion ›'), h('span', { class: 'faint' }, ' · sphere types from BF Companion')));
}

// ---- SP build -------------------------------------------------------------------------------------------------
// The unit's SP options (unitDetail().sp) scored like a sphere's effect text, by what the unit does; an effect added
// to a BB/SBB/UBB or the leader skill counts more than a passive, because the whole squad gets it. The best set within
// 100 SP wins (fewer SP on a tie); an option that needs another one (`needs`) only comes together with it.
const SP_BUDGET = 100;
function suggestSp(id, u) {
  const opts = [];
  for (const cat of (u && u.sp) || []) for (const s of cat.skills || []) opts.push({ id: s.id, cat: cat.cat, name: s.name, desc: s.desc || '', sp: s.sp || 0, needs: s.needs });
  if (!opts.length || opts.length > 22) return null;
  const focus = sphereFocus(u);
  for (const o of opts) {
    const text = `${o.name} ${o.desc}`, f = sphereParts(text).f;
    let v = 0; for (const [k, x] of Object.entries(f)) v += Math.min(x, 6) * (focus.w[k] || 0);
    if (/\b(BB|SBB|UBB|LS|Leader Skill)\b/.test(text)) v *= 1.4;
    o.value = Math.max(v, 0.3);
    o.why = (Object.entries(f).map(([k, x]) => [k, x * (focus.w[k] || 0)]).sort((a, b) => b[1] - a[1])[0] || [])[0];
  }
  const index = new Map(opts.map((o, i) => [String(o.id), i]));
  const need = opts.map(o => [].concat(o.needs == null ? [] : o.needs).map(x => index.get(String(x))).filter(x => x != null));
  let best = 0, bestV = -1, bestSp = 0;
  for (let mask = 1; mask < (1 << opts.length); mask++) {
    let sp = 0, v = 0, ok = true;
    for (let i = 0; i < opts.length && ok; i++) if (mask & (1 << i)) { sp += opts[i].sp; v += opts[i].value; if (sp > SP_BUDGET || need[i].some(j => !(mask & (1 << j)))) ok = false; }
    if (ok && (v > bestV + 1e-9 || (Math.abs(v - bestV) < 1e-9 && sp < bestSp))) { best = mask; bestV = v; bestSp = sp; }
  }
  return { picks: opts.filter((_, i) => best & (1 << i)), sp: bestSp, total: opts.length };
}
function spSection(id, u) {
  const r = suggestSp(id, u);
  if (!r || !r.picks.length) return null;
  return h('div', { class: 'spbox' },
    h('h2', {}, 'Suggested SP build'),
    h('p', { class: 'faint', style: 'margin:0 0 8px' }, `${r.sp} of ${SP_BUDGET} SP · ${r.picks.length} of its ${r.total} options, picked by the deck for what this unit does. Players' own builds: BF Companion link above.`),
    h('ul', { class: 'splist' }, r.picks.map(o => h('li', { title: o.desc || o.name }, h('span', { class: 'spc' }, `${o.sp} SP`), h('span', { class: 'grow' }, o.name), h('span', { class: 'faint' }, o.cat)))));
}
