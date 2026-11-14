'use strict';
// Home ("Command" layout): a tile grid you scan. Currencies and timers with state stripes, the squad with
// battle sprites, should-I-pull for the featured gate, the featured-units marquee, today's Vortex.

let homeTimer = 0;
let liveLast = null;   // last /api/status payload, shared by the header and the currency tiles

function nextReset(r, now) {
  const d = new Date(now * 1000);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), r.utcHour, 0, 0));
  if (r.weekday != null) t.setUTCDate(t.getUTCDate() + (r.weekday - t.getUTCDay() + 7) % 7);
  while (t.getTime() / 1000 <= now) t.setUTCDate(t.getUTCDate() + (r.weekday != null ? 7 : 1));
  return t.getTime() / 1000;
}

function renderHome(view, arg) {
  clearInterval(homeTimer);
  const now = Date.now() / 1000;
  if (arg && DATA.summons) { const want = Number(arg); pullGate = want || null; }
  const head = h('div', { class: 'top', id: 'home-top' });
  const tiles = h('div', { class: 'tiles' },
    tile('Gems', '—', 'sign in to see', 'gems'), tile('Zel', '—', '', 'zel'), tile('Karma', '—', '', 'karma'),
    timerTile(RULES.resets[0]), timerTile(RULES.resets[1]), timerTile(RULES.resets[2]),
    squadTile(view), pullTile(now), featuredTile(now), vortexTile(now));
  // the account panel (My Summoner) is the first tile; it redraws itself and the header after sign-in, refresh and sign-out
  const panel = msPanel(() => { if (panel.isConnected) renderHome(view, arg); });
  tiles.prepend(panel);
  view.replaceChildren(head, tiles);
  const tick = () => {
    const n = Date.now() / 1000;
    for (const r of RULES.resets) {
      const t = tiles.querySelector(`[data-k=${r.key}]`); if (!t) continue;
      const left = nextReset(r, n) - n;
      t.querySelector('.v').textContent = timeLeft(left);
      t.className = 'tile stripe ' + (left < 1800 ? 'bad' : left < 7200 ? 'warn' : 'good');
    }
  };
  tick(); homeTimer = setInterval(tick, 1000);
  refreshHead(head, tiles);
}

function tile(k, v, s, key) { return h('div', { class: 'tile', 'data-k': key }, h('div', { class: 'k' }, k), h('div', { class: 'v num' }, v), h('div', { class: 's' }, s)); }
function timerTile(r) { return h('div', { class: 'tile stripe good', 'data-k': r.key }, h('div', { class: 'k' }, r.label), h('div', { class: 'v num' }, '…'), h('div', { class: 's' }, r.note)); }

// ---- header: leader avatar, name/level (from live stats when on), BlueStacks session, dock / live buttons
async function refreshHead(head, tiles) {
  let s = null;
  try { s = await (await fetch(`${API}/api/status`)).json(); } catch { }
  liveLast = s;
  const lead = COLL.squad().units[0];
  const live = s && s.live;
  const started = s && s.startedUtc ? Date.parse(s.startedUtc) / 1000 : null; const hrs = started ? (Date.now() / 1000 - started) / 3600 : 0;
  const warn = hrs >= RULES.bluestacksWarnHours;
  // Name: what you typed, else the name read from the game's header while live is on, else "Summoner".
  const typed = store.get('profileName', '');
  if (!typed && live && live.name) store.set('liveName', live.name);
  const name = typed || (MS.home && MS.home.player && MS.home.player.name) || store.get('liveName', '') || 'Summoner';   // your account's name when signed in
  // Avatar: the selected squad's leader; Omni Vargas until one is set.
  const avatar = lead || 10017;
  head.replaceChildren(
    h('div', { class: 'ring' }, h('img', { src: unitIcon(avatar), alt: '', onerror: e => { e.target.style.visibility = 'hidden'; } })),
    h('div', {}, h('div', { class: 'name', title: 'Click to change the name (empty = read it from the game)', onclick: () => { const n = prompt('Your summoner name (leave empty to use the name of your account)', typed); if (n != null) { store.set('profileName', n.trim()); refreshHead(head, tiles); } } }, name,
        h('span', { class: 'sub' }, live && live.level ? ` Lv ${live.level}` : '')),
      h('div', { class: 'sub' }, !s ? 'desktop app only' : !s.bluestacks ? '' : [h('span', { class: warn ? 'red' : 'green' }, `BlueStacks ${timeLeft(Math.floor(hrs * 3600))}`), ''])),
    h('div', { class: 'right' }, h('button', { class: 'icon', title: 'Snap beside BlueStacks', onclick: () => host.send('dock') }, 'dock')));
  if (live) host.send('liveoff');   // the screen reader is retired: the account is the live source
  if (warn) head.append(h('div', { class: 'warnline' }, 'Over 3 h: the FAQ warns of a BlueStacks memory leak that can corrupt saves. Close it fully soon.'));
  for (const [key, val, sub] of [['gems', live && live.gems, 'summons, slots, revives'], ['zel', live && live.zel, 'Gold Valley on Thursday'], ['karma', live && live.karma, '1,000,000 per Omni evolution']]) {
    const t = tiles.querySelector(`[data-k=${key}]`); if (!t) continue;
    t.querySelector('.v').textContent = val != null ? fmt(val) : '—';
    t.querySelector('.s').textContent = val != null ? sub : 'sign in to see';
  }
  msTiles(tiles, head);   // signed in: currencies and level come from the account
  clearTimeout(head._t); head._t = setTimeout(() => { if (head.isConnected) refreshHead(head, tiles); }, 5000);
}

// ---- squad
function squadTile(view) {
  // signed in: Home shows only the squads that really exist in the account; plans made in the deck live in the Team Builder
  const onlyLive = COLL.squads.some(x => x.live);
  if (onlyLive && !COLL.squad().live) { COLL.active = COLL.squads.findIndex(x => x.live); COLL.save(); }
  const s = COLL.squad(); const si = COLL.active;
  const meta = h('span', {}, '…');
  const sq = h('div', { class: 'sq' }, s.units.map((id, slot) => {
    if (!id) return h('div', { class: 'u empty' }, h('button', { class: 'chip', onclick: async () => { const p = await pickUnit({ title: `Slot ${slot + 1}` }); if (p) { COLL.setSlot(si, slot, p); renderHome(view); } } }, '+'));
    return h('a', { class: `u el-${unitElement(id)}${slot === 0 ? ' lead' : ''}`, href: `#/units/${id}`, title: unitName(id) }, spriteCanvas(id, 170, { maxScale: 1.0, height: 80, mass: true, fitWidth: 88 }), h('span', { class: 'aname' }, shortUnitName(id)));
  }));
  analyseSquad(s.units).then(a => { meta.textContent = `cost ${a.cost} · ${a.elements.size} element${a.elements.size === 1 ? '' : 's'}${a.leader && a.leader.ls ? ' · LS ' + a.leader.ls.name : ''}`; });
  return h('div', { class: 'tile wide stagetile' }, h('h4', {}, h('span', { class: 'row' }, COLL.squads.map((x, i) => (onlyLive && !x.live ? null : h('button', { class: i === si ? 'chip on' : 'chip', onclick: () => { COLL.active = i; COLL.save(); renderHome(view); } }, onlyLive ? x.name.replace(/^Live /, '') : x.name))), h('a', { class: 'faint', href: '#/team' }, onlyLive ? 'plans ›' : 'edit ›')), meta), sq, liveVerdict(s), gearBlock(s));
}

// ---- should I pull: cycles through this week's banners (and the permanent gem gates); always shows the
// general odds, plus "new to you" when the box has units. A showcase on the right rotates the gate's top units.
let pullIdx = 0, pullGate = null, pullOpen = false;   // pullGate: a gate id requested via #/home/<gate>
function pullTile(now) {
  const S = DATA.summons; if (!S) return null;
  const W = weekState(now);
  const featured = W && !W.stale ? W.featured.map(b => S.gates.find(x => x.gate === b.gate)).filter(Boolean) : [];
  const gates = [...featured, ...S.gates.filter(g => !g.rotating && g.gems > 0 && !featured.includes(g))];
  if (!gates.length) return null;
  if (pullGate) { const k = gates.findIndex(g => g.gate === pullGate); if (k >= 0) pullIdx = k; pullGate = null; }
  pullIdx = ((pullIdx % gates.length) + gates.length) % gates.length;
  const g = gates[pullIdx];
  const pool = S.pools[String(g.gate)] || []; const total = pool.reduce((s, p) => s + p[1], 0) || 1;
  const byR = new Map();
  for (const [uid, c] of pool) { const r = Math.min((S.units[String(uid)] || [0, 0])[1], 8); byR.set(r, (byR.get(r) || 0) + c / total); }
  const top = [...byR.keys()].sort((a, b) => b - a)[0];
  const pTop = byR.get(top) || 0;
  const missing = pool.filter(([uid]) => !COLL.owned.has(Number(uid)));
  const pNew = missing.reduce((s, p) => s + p[1], 0) / total;
  const price = g.gems > 0 ? g.gems : 0;
  const atLeast = (p, n) => 1 - Math.pow(1 - p, n);
  const tile = h('div', { class: 'tile wide pulltile' });
  const chevron = dir => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 10 10'); s.innerHTML = dir < 0 ? '<path d="M6.5 1.5 3 5l3.5 3.5"/>' : '<path d="M3.5 1.5 7 5 3.5 8.5"/>'; return s; };
  const nav = h('div', { class: 'gatenav' },
    h('button', { class: 'arrow', title: 'Previous gate', onclick: () => { pullIdx--; tile.replaceWith(pullTile(Date.now() / 1000)); } }, chevron(-1)),
    h('a', { href: `#/gates/${g.gate}`, class: 'gtitle' }, g.title),
    h('span', { class: 'faint' }, `${pullIdx + 1}/${gates.length}`),
    h('button', { class: 'arrow', title: 'Next gate', onclick: () => { pullIdx++; tile.replaceWith(pullTile(Date.now() / 1000)); } }, chevron(1)));
  // Odds: one row per rarity, chance per pull and in 10 pulls.
  const rar = [...byR.keys()].sort((a, b) => b - a);
  const odds = h('table', { class: 'odds' }, h('tr', {}, h('th', {}, 'Rarity'), h('th', { class: 'r' }, 'Per pull'), h('th', { class: 'r' }, '≥1 in 10'), h('th', { class: 'r' }, 'Units')),
    rar.map(r => { const p = byR.get(r); const n = pool.filter(([uid]) => Math.min((S.units[String(uid)] || [0, 0])[1], 8) === r).length;
      return h('tr', {}, h('td', {}, stars(r)), h('td', { class: 'r num' }, pct(100 * p)), h('td', { class: 'r num ' + (atLeast(p, 10) > .5 ? 'green' : atLeast(p, 10) > .2 ? 'gold' : '') }, pct(100 * atLeast(p, 10))), h('td', { class: 'r num dim' }, n)); }));
  // Acquisition bars (EXP style): the gate's exclusive event heroes get one bar; whatever else is in the pool gets a
  // bar per rarity. A small collab pool (FFBE, DEEMO) is all heroes, so it shows the one bar only.
  const sortedC = [...pool].map(x => x[1]).sort((a, b) => a - b); const median = sortedC.length ? sortedC[Math.floor(sortedC.length / 2)] : 0;
  const collab = /collab|tokyo ghoul|deemo|vocaloid|chain chronicle|guilty gear|smt|kof|fairy tail|hero academia|trigun|brave exvius|ffbe/i.test(g.title);
  const isEvent = ([uid, c]) => collab && (pool.length <= 12 || c >= 3 * median);
  const heroes = pool.filter(isEvent); const rest = pool.filter(p => !isEvent(p));
  const bar = (label, got, all, cls) => h('div', { class: 'xp' }, h('div', { class: 'xpl' }, h('span', {}, label), h('span', { class: 'num' }, `${got} / ${all}`)),
    h('div', { class: 'bar ' + (cls || '') }, h('div', { class: 'fill', style: `width:${all ? 100 * got / all : 0}%` }), h('span', {}, all ? `${Math.round(100 * got / all)}%` : '')));
  const bars = h('div', { class: 'xps' },
    heroes.length ? bar(`Event heroes (${pct(100 * heroes.reduce((s, p) => s + p[1], 0) / total)} per pull)`, heroes.filter(([uid]) => COLL.owned.has(Number(uid))).length, heroes.length, 'gold') : null,
    rar.map(r => { const units = rest.filter(([uid]) => Math.min((S.units[String(uid)] || [0, 0])[1], 8) === r); if (!units.length) return null; const got = units.filter(([uid]) => COLL.owned.has(Number(uid))).length;
      return bar(rarityName(r), got, units.length); }));
  // After a summon session: tick what you pulled (pool units only) so the odds and bars stay current without a rescan.
  const pulled = h('button', { class: 'chip', title: 'Add the units you just pulled on this gate to your box', onclick: async () => {
    const got = await pickUnit({ title: `I pulled on ${g.title}`, ids: pool.map(([uid]) => Number(uid)), multi: true, hint: 'Tick every unit you got (dupes count once). Done adds them to your box.' });
    if (got && got.length) { for (const id of got) COLL.owned.add(Number(id)); COLL.save(); toast(`${got.length} unit${got.length === 1 ? '' : 's'} added to your box`); tile.replaceWith(pullTile(Date.now() / 1000)); }
  } }, 'I pulled…');
  const verdict = !COLL.owned.size ? 'Bars fill once you sign in, or as you mark units owned (✔ on unit cards).'
    : pNew === 0 ? 'You own everything on this gate.' : pNew > .5 ? `${pct(100 * pNew)} of pulls give something new. Good value${price ? `, about ${Math.ceil(price / pNew)} gems per new unit` : ''}.`
    : pNew > .2 ? `${pct(100 * pNew)} new per pull${price ? `, about ${Math.ceil(price / pNew)} gems per new unit` : ''}. Set a gem budget.` : `Only ${pct(100 * pNew)} new per pull: mostly dupes (5 SP each on Omnis). Pull for a specific unit only.`;
  // Redesign: the verdict is the headline; the odds table and the bars wait behind one click (state kept per session).
  // open by default (the author: "auto expand the part in should I pull"); it can still be folded away
  const more = h('details', { class: 'pullmore', open: true }, h('summary', {}, 'Odds and bars'), odds, bars);
  if (pullOpen) more.open = true;
  more.addEventListener('toggle', () => { pullOpen = more.open; });
  tile.append(h('h4', {}, 'Should I pull?', h('span', {}, gatePrice(g))),
    h('div', { class: 'pullgrid' }, h('div', {}, nav, h('p', { class: 'verdict' }, verdict),
      h('div', { class: 'row pullacts' }, h('span', { class: 'grow' }), pulled), more), metaBox(g, pool)));
  return tile;
}

// ---- Meta Units: the five strongest units on the selected gate, by the game's numbers (max stats against the
// best in the game, plus what the skills bring). Sprite and name only, one at a time every 5 s.
function metaBox(g, pool) {
  const M = DATA.meta; const top = (M && M.top) || [10800, 4000, 3725, 3650];
  const box = h('div', { class: 'metabox' }, h('div', { class: 'mtitle' }, 'Meta Units', h('a', { class: 'faint', href: '#/tier', style: 'font-weight:400;margin-left:6px' }, 'tier list ›')), h('div', { class: 'mstage' }, h('span', { class: 'dim' }, '…')));
  const stage = box.lastChild;
  const best = Math.max(0, ...pool.map(([uid]) => Math.min(unitRarity(Number(uid)), 8)));
  const cand = pool.map(([uid]) => Number(uid)).filter(id => Math.min(unitRarity(id), 8) === best && unitMeta(id))
    .map(id => { const m = unitMeta(id); return { id, s: (m[5] / top[0] + m[6] / top[1] + m[7] / top[2] + m[8] / top[3]) / 4 }; })
    .sort((a, b) => b.s - a.s).slice(0, 20);
  Promise.all(cand.map(async c => { const d = await unitDetail(c.id); const r = unitRoles(d); return { ...c, score: c.s + r.roles.size * 0.04 + Math.min(r.hits, 40) / 1000 }; })).then(list => {
    // Small collab pools get one meta pick; mid-size pools three; big pools five.
    const n = pool.length <= 12 ? 1 : pool.length <= 50 ? 3 : 5;
    const picks = list.sort((a, b) => b.score - a.score).slice(0, n);
    if (!picks.length) { stage.replaceChildren(h('span', { class: 'dim' }, 'no units')); return; }
    let i = 0;
    const draw = () => {
      const p = picks[i % picks.length];
      const chance = (pool.find(x => Number(x[0]) === p.id) || [0, 0])[1] / (pool.reduce((s, x) => s + x[1], 0) || 1);
      // The sprite grows with the box: a tall odds table (many rarities and bars) gives it more room.
      const room = Math.max(112, Math.min(240, (box.clientHeight || 0) - 78));
      stage.replaceChildren(h('a', { class: `actor el-${unitElement(p.id)}`, href: `#/units/${p.id}`, title: unitName(p.id) },
        spriteCanvas(p.id, 150, { maxScale: 3, height: room }), h('span', { class: 'aname one' }, unitName(p.id)), h('span', { class: 'pct', style: 'font-size:.85em' }, `${pct(100 * chance)} per pull`)),
        picks.length > 1 ? h('div', { class: 'dots' }, picks.map((p2, k) => h('button', { class: k === i % picks.length ? 'on' : '', title: unitName(p2.id), onclick: e => { e.stopPropagation(); i = k; draw(); arm(); } }))) : null);
      i++;
    };
    draw();
    let t = 0;
    const arm = () => { clearInterval(t); if (picks.length > 1) t = setInterval(() => { if (!stage.isConnected) { clearInterval(t); return; } draw(); }, 5000); };
    arm();
    // Hold the mouse button and drag left or right to walk through the picks by hand.
    swipe(stage, dir => { i = (i - 1 + dir + picks.length) % picks.length; draw(); arm(); });
  });
  return box;
}

// ---- featured units marquee (collab-only units first) + banners
function featuredTile(now) {
  const D = DATA.units, S = DATA.summons; if (!D || !S) return null;
  const W = weekState(now); if (!W || W.stale) return null;
  const featured = new Set(W.featured.map(b => b.gate));
  const permanent = new Set(S.gates.filter(g => !g.rotating).map(g => g.gate));
  const exclusive = id => { const s = unitSources(id); return !s.summon.some(([g]) => permanent.has(g)) && !s.enemy.some(r => r[2] === id && r[3] > 0) && !s.caught.some(r => r[3] > 0) && !s.reward.length; };
  // Collab gates: by title. Newest gate id first, so the latest collab leads the marquee.
  const COLLAB = /collab|tokyo ghoul|deemo|vocaloid|chain chronicle|guilty gear|smt|kof|fairy tail|hero academia|trigun|brave exvius|ffbe/i;
  const shortName = t => t.replace(/^Collab Summon:\s*/i, '').replace(/\s*PT\s*\d+$/i, '').replace(/^Final Fantasy Brave Exvius$/i, 'FFBE').replace(/^My Hero Academia$/i, 'MHA');
  const collabGates = S.gates.filter(g => featured.has(g.gate) && COLLAB.test(g.title)).sort((a, b) => b.gate - a.gate);
  // A collab character is a rate-up unit of a collab gate: its chance there is well above the pool's typical
  // chance (Kaneki 6% vs 0.8% filler in the 168-unit Tokyo Ghoul pool). Small pools (≤ 12) are all collab units.
  const typical = new Map(collabGates.map(g => { const p = (S.pools[String(g.gate)] || []).map(x => x[1]).sort((a, b) => a - b); return [g.gate, p.length ? p[Math.floor(p.length / 2)] : 0]; }));
  const collabOf = id => {
    const s = unitSources(id);
    for (const g of collabGates) {
      const hit = s.summon.find(([x]) => x === g.gate); if (!hit) continue;
      const pool = S.pools[String(g.gate)] || []; const mine = (pool.find(x => x[0] === id) || [0, 0])[1];
      if (pool.length <= 12 || mine >= 3 * (typical.get(g.gate) || 0)) return g;
    }
    return null;
  };
  // Every unit gets the label of where it comes from (the author: Yuuri and Phoena had none): its collab when it is in a
  // featured collab gate's pool, even if All Star or a Divine gate also has it (Chain Chronicle's Yuuri, Vocaloid's
  // Luka) or it can be captured (Deemo); otherwise the featured gate it is in. Units only this week's collab gates
  // give lead the marquee. Collab units always make the list (still picture or icon if no sprite); the rest need
  // animation data.
  const inPool = (id, g) => (S.pools[String(g.gate)] || []).some(x => x[0] === id);
  const originOf = id => collabGates.find(g => inPool(id, g)) || null;
  const gateOf = id => W.featured.map(b => S.gates.find(x => x.gate === b.gate)).find(g => g && inPool(id, g)) || null;
  const gateName = t => shortName(t).replace(/\s*Summon\s*/i, ' ').replace(/^(Rare|Divine|Featured)\s*:?\s*/i, '').trim() || t;
  const list = ((D.summon && D.summon.units) || []).filter(u => u.in.some(([g]) => featured.has(g))).map(u => u.id);
  const entries = [...new Set(list)].map(id => {
    const g = originOf(id), only = !!(g && exclusive(id) && collabOf(id) === g);
    return { id, g, src: g ? shortName(g.title) : (gateOf(id) ? gateName(gateOf(id).title) : ''), rank: g ? collabGates.indexOf(g) : 99, only, r: unitRarity(id) };
  })
    .filter(e => e.g || (unitMeta(e.id) && unitMeta(e.id)[10]))
    .sort((a, b) => a.rank - b.rank || b.only - a.only || b.r - a.r || b.id - a.id).slice(0, 40);
  if (!entries.length) return null;
  const actor = e => h('a', { class: `actor el-${unitElement(e.id)}`, href: `#/units/${e.id}`, title: unitName(e.id) + (COLL.owned.has(e.id) ? ' (owned)' : '') },
    spriteCanvas(e.id, 96, { maxScale: 1.6, height: 74 }),
    h('span', { class: 'aname one' }, COLL.owned.has(e.id) ? h('span', { class: 'own', title: 'You own this unit' }, '✓ ') : null, unitName(e.id)),
    h('span', { class: 'atag' }, e.src ? h('span', { class: e.g ? 'tag gold' : 'tag' }, e.src) :h('span', { class: 'tag' }, ' ')));
  const track = h('div', { class: 'track', style: `animation-duration:${Math.max(20, entries.length * 4)}s` }, entries.map(actor), entries.map(actor));
  const nCollab = entries.filter(e => e.g).length;
  const marquee = h('div', { class: 'marquee', title: 'Hold the mouse button and drag to scroll' }, track);
  dragMarquee(marquee, track);
  return h('div', { class: 'tile wide' },
    h('h4', {}, 'Featured this week', h('span', {}, `${nCollab} collab unit${nCollab === 1 ? '' : 's'} · until ${when(W.ends)}`)),
    marquee,
    h('div', { class: 'banners' }, W.featured.map(b => bannerCard(b, S, '', h('span', { class: 'tag green' }, timeLeft(W.ends - now))))),
    W.next.length ? h('div', { class: 'faint', style: 'margin-top:6px' }, 'Next week: ', W.next.map((b, i) => [i ? ', ' : '', h('a', { href: `#/gates/${b.gate}` }, b.title)])) : null);
}
function bannerCard(b, S, line, tag) {
  const g = S.gates.find(x => x.gate === b.gate);
  const img = b.art ? h('img', { src: CDN_GACHA + encodeURIComponent(b.art), alt: '', loading: 'lazy' }) : null;
  if (img) img.addEventListener('error', () => img.remove(), { once: true });
  return h('a', { class: 'banner', href: `#/gates/${b.gate}` }, img, h('div', { class: 't' }, b.title || (g && g.title) || `Gate ${b.gate}`, h('small', {}, g ? `${gatePrice(g)} · ${g.units} units ` : '', line, tag)));
}

// ---- Vortex Gate: the week as day chips (click one to preview another day), the open dungeons of that day as
// cards (what each gives, and its captures / drops as art), and the running event. Cards open the dungeon page.
let vortexDay = null;   // a previewed weekday (0 = Mon), null = today
function vortexTile(now) {
  const E = DATA.events; if (!E || now >= E.week.ends + 7 * 86400) return null;
  const rolled = now >= E.week.ends; const ev = rolled ? E.next_event : E.event; const ends = rolled ? E.week.ends + 7 * 86400 : E.week.ends;
  const days = Math.floor((now - E.monday) / 86400); const today = ((days % 7) + 7) % 7; const nextDay = E.monday + (days + 1) * 86400;
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const sel = vortexDay == null ? today : vortexDay;
  const tile = h('div', { class: 'tile wide vortextile' });
  const redraw = () => tile.replaceWith(vortexTile(Date.now() / 1000));
  const evArea = ev && DATA.units ? Object.entries(DATA.units.areas).find(([, a]) => norm(a[0]) === norm(ev.name)) : null;
  tile.append(
    h('h4', {}, 'Vortex Gate', h('span', {}, sel === today ? `switches ${fmtClock.format(new Date(nextDay * 1000))}` : [h('a', { href: '#', onclick: e => { e.preventDefault(); vortexDay = null; redraw(); } }, 'back to today')])),
    h('div', { class: 'row vdays' }, DAYS.map((d, i) => h('button', { class: `chip${i === sel ? ' on' : ''}${i === today ? ' today' : ''}`, title: i === today ? 'Today' : `Preview ${d}`, onclick: () => { vortexDay = i === today ? null : i; redraw(); } }, d))),
    vortexStrip(E, sel, today, DAYS),
    h('div', { class: 'vevent' }, h('span', { class: 'dim' }, rolled ? 'Next event' : 'Event'),
      ev ? [evArea ? h('a', { href: `#/vortex/area/${evArea[0]}` }, ev.name) : h('span', {}, ev.name), h('span', { class: 'tag green' }, timeLeft(ends - now))] : h('span', { class: 'dim' }, 'none'),
      h('span', { class: 'grow' }), h('a', { class: 'faint', href: '#/quests/vortex' }, 'all Vortex dungeons ›')));
  return tile;
}

// One card per open dungeon of the chosen day: that day's extras first (gold), then the every-day ones (green);
// when looking at today, tomorrow's extras follow dimmed. Hold and drag, wheel, or arrows to scroll.
function vortexStrip(E, sel, today, DAYS) {
  if (!DATA.units) return null;
  const seen = new Set(); const list = [];
  const add = (names, tag, cls) => { for (const n of names || []) { const d = dungeonByName(n); if (!d || seen.has(d.id)) continue; seen.add(d.id); list.push({ d, tag, cls }); } };
  add(E.vortex[sel], `${DAYS[sel]} only`, 'gold');
  add(E.every_day, 'every day', 'green');
  if (sel === today) add(E.vortex[(today + 1) % 7], 'tomorrow', 'dim');
  if (!list.length) return h('p', { class: 'dim' }, 'No Vortex dungeon listed for this day.');
  const strip = dragScroll(h('div', { class: 'vstrip' }, list.map(({ d, tag, cls }) => dungeonCard(d, h('span', { class: `tag ${cls === 'dim' ? '' : cls}` }, tag), cls === 'dim'))));
  const chevron = dir => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 10 10'); s.innerHTML = dir < 0 ? '<path d="M6.5 1.5 3 5l3.5 3.5"/>' : '<path d="M3.5 1.5 7 5 3.5 8.5"/>'; return s; };
  const by = dir => strip.scrollBy({ left: dir * Math.max(160, strip.clientWidth * 0.8), behavior: 'smooth' });
  return h('div', { class: 'vwrap' },
    h('div', { class: 'gatenav', style: 'margin:6px 0 2px' }, h('span', { class: 'gtitle faint', style: 'font-weight:400' }, `${list.filter(x => x.cls !== 'dim').length} open · drag to scroll`), h('span', { class: 'grow' }),
      h('button', { class: 'arrow', title: 'Scroll left', onclick: () => by(-1) }, chevron(-1)), h('button', { class: 'arrow', title: 'Scroll right', onclick: () => by(1) }, chevron(1))),
    strip);
}
// A dungeon card: art from what it gives (captures, then drops; a word badge such as "Karma" when the data lists
// enemies only), the name, a tag, and the one-line "gives" summary.
function dungeonCard(d, tag, later) {
  const loot = dungeonLoot(d); const gives = dungeonGives(d, loot);
  return h('a', { class: `vcard${later ? ' later' : ''}`, href: `#/vortex/${d.id}`, title: `${d.missions.length} level${d.missions.length === 1 ? '' : 's'}:\n${d.missions.map(m => m.name).join('\n')}` },
    h('div', { class: 'vart' }, rewardPics(loot, gives, 3)),
    h('div', { class: 'vt' }, d.name),
    h('div', { class: 'vs' }, tag, h('span', { class: 'faint' }, `${d.missions.length} lv`)),
    h('div', { class: 'vg' }, gives.text));
}
// Plain words for what a dungeon is for: the guide's table for the daily dungeons; else guaranteed rewards (a unit
// for clearing, clear-reward items), then the captures, then the drops.
function dungeonGives(d, loot) {
  const known = RULES.vortexGives[d.name];
  if (known) return { text: known.text, badge: known.badge || '★', pics: known.pics || null };
  const sure = [...loot.rewardUnits.map(u => unitName(u.id)), ...loot.clearItems.slice(0, 3).map(it => itemRow(it.id)[0] + (it.p > 1 ? ` ×${it.p}` : ''))];
  if (sure.length) return { text: `Reward: ${sure.join(', ')}`, badge: '★' };
  const names = loot.units.slice(0, 3).map(u => unitName(u.id));
  if (names.length) return { text: `Capture: ${names.join(', ')}`, badge: '★' };
  const items = loot.items.slice(0, 3).map(it => itemRow(it.id)[0]);
  return { text: items.length ? `Drops: ${items.join(', ')}` : 'No reward data', badge: items.length ? '•' : '?' };
}
// The pictures for a dungeon's reward: the guide's `pics` when set (currency art from wwwroot/img, falling back to a
// word badge while the file is missing; unit ids as icons), else the captures, then the drops.
function rewardPics(loot, gives, n) {
  const out = [];
  if (gives.pics) {
    for (const p of gives.pics.slice(0, n)) {
      if (typeof p === 'number') out.push(h('img', { src: unitIcon(p), alt: '', title: unitName(p), loading: 'lazy', onerror: e => { e.target.remove(); } }));
      else {
        // Prefer a PNG of the real in-game icon (img/<name>.png, dropped in by hand), then the SVG redraw, then the badge.
        const base = p.replace(/\.(png|svg)$/i, '');
        const img = h('img', { class: 'cur', src: `${base}.png`, alt: gives.badge, title: gives.badge });
        img.addEventListener('error', () => { if (img.src.endsWith('.png')) img.src = `${base}.svg`; else img.replaceWith(h('span', { class: 'badge' }, gives.badge)); });
        out.push(img);
      }
    }
    return out;
  }
  out.push(...loot.units.slice(0, n).map(u => h('img', { src: unitIcon(u.id), alt: '', title: `${unitName(u.id)} · ${u.p >= 100 && !loot.units.some(x => x.p < 100) ? 'reward' : `capture ${u.p}%`}`, loading: 'lazy', onerror: e => { e.target.remove(); } })));
  if (out.length < n) out.push(...loot.items.slice(0, n - out.length).map(it => h('img', { class: 'it', src: itemIcon(it.id), alt: '', title: `${itemRow(it.id)[0]} · ${it.p >= 100 ? 'clear reward' : pct(it.p)}`, loading: 'lazy', onerror: e => { e.target.remove(); } })));
  return out.length ? out : [h('span', { class: 'badge' }, gives.badge)];
}
