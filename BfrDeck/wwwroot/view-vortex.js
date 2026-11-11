'use strict';
// Vortex and Grand Quest: a catalog of every dungeon the game data knows, grouped the way the in-game gate is,
// with what each gives; an area page; and the dungeon page (levels, captures, drops, rewards, enemies).

const GQ_ROOT = id => id >= 5000000 && id < 5200000;
const VORTEX_ROOT = id => id >= 100000 && id < 200000;
// Top-level areas that are not Vortex: story regions, Frontier Hunter, Trial Test, Strategy Zone, Frontier Gate, Grand Quest.
const NOT_VORTEX = id => id < 100000 || (id >= 1000000 && id < 1100000) || id === 2000000 || id === 2100000 || id === 3000000 || id === 3000001 || GQ_ROOT(id);
const NOT_LIVE = {};   // sections that need a red note in the catalog; none at the moment

function areaTree() {
  if (DATA.areaTree) return DATA.areaTree;
  const D = DATA.units; const kids = {}, dgs = {};
  for (const [id, a] of Object.entries(D.areas)) (kids[a[1]] ||= []).push(Number(id));
  for (const [id, d] of Object.entries(D.dungeons)) (dgs[d[1]] ||= []).push(Number(id));
  for (const k of Object.keys(kids)) kids[k].sort((a, b) => a - b);
  for (const k of Object.keys(dgs)) dgs[k].sort((a, b) => a - b);
  return DATA.areaTree = { kids, dgs };
}
function rootOf(areaId) { const D = DATA.units; let a = areaId, n = 0; while (D.areas[a] && D.areas[a][1] && n++ < 20) a = D.areas[a][1]; return a; }

// Names open today (every day + today's extras) and the running event, for the "today" / "event" tags.
function vortexToday() {
  const E = DATA.events, now = Date.now() / 1000; const out = { open: new Set(), event: null };
  if (!E || now >= E.week.ends + 7 * 86400) return out;
  const days = Math.floor((now - E.monday) / 86400); const today = ((days % 7) + 7) % 7;
  for (const n of [...(E.every_day || []), ...(E.vortex[today] || [])]) out.open.add(norm(n));
  const ev = now >= E.week.ends ? E.next_event : E.event; out.event = ev ? norm(ev.name) : null;
  return out;
}

// The game modes, each a set of top-level areas in units.json. The Quests tab shows them as sub-tabs.
const MODES = [
  { key: 'vortex', label: 'Vortex', title: 'Vortex Gate', intro: 'Every Vortex dungeon in the game data, grouped like the in-game gate. Tags show what is open today. Click a dungeon for its levels, captures and drops.' },
  { key: 'gq', label: 'Grand Quest', title: 'Grand Quest', intro: 'Story chapters with fixed squads. Each chapter lists its episodes and what clearing them gives.' },
  { key: 'story', label: 'Story', title: 'Quests', intro: 'The main story regions, in order. Each region lists its dungeons with the units that join and the materials that drop. First clears give gems.' },
  { key: 'fh', label: 'Frontier Hunter', title: 'Frontier Hunter', intro: 'The expedition dungeons with their captures and drops.' },
  { key: 'fg', label: 'Frontier Gate', title: 'Frontier Gate', intro: 'The Frontier Spire sectors with their captures and drops.' },
  { key: 'trials', label: 'Trials', title: 'Trials and training', intro: 'Trial Test, Strategy Zone, Summoners\' Training Camp and the chapter trials.' },
];
const MODE_OF = {
  vortex: id => !NOT_VORTEX(id),
  gq: id => GQ_ROOT(id),
  story: id => id < 100000,
  fh: id => id >= 1000000 && id < 1100000,
  fg: id => id === 3000000 || id === 3000001,
  trials: id => id === 2000000 || id === 2100000 || id === 500000 || id === 600000,
};
function modeRoots(key) {
  return Object.entries(DATA.units.areas).filter(([, a]) => !a[1]).map(([aid]) => Number(aid)).filter(MODE_OF[key]).sort((a, b) => a - b);
}
function modeTabs(active) {
  return h('div', { class: 'row modetabs' }, MODES.map(m => h('a', { class: m.key === active ? 'chip on' : 'chip', href: `#/quests/${m.key}` }, m.label)));
}
// #/quests/<mode>; #/vortex and #/gq stay as aliases.
function renderQuests(view, mode) {
  if (!DATA.units) { view.replaceChildren(h('p', { class: 'dim' }, 'Unit data not loaded.')); return; }
  const m = MODES.find(x => x.key === mode) || MODES[0];
  const roots = modeRoots(m.key); let sections = [];
  if (m.key === 'vortex') {
    for (const aid of roots.filter(VORTEX_ROOT)) {   // same-named roots (the two "Seasons Past" lists) become one section
      const title = DATA.units.areas[aid][0]; const s = sections.find(x => x.title === title);
      if (s) s.areas.push(aid); else sections.push({ title, areas: [aid], open: aid === 100001 });
    }
    const limited = roots.filter(aid => !VORTEX_ROOT(aid));
    if (limited.length) sections.push({ title: 'Limited and event dungeons', areas: limited, note: 'Opened by the event schedule. The running event is tagged.' });
  } else sections = roots.map((aid, i) => ({ title: DATA.units.areas[aid][0], areas: [aid], open: i === 0 && roots.length <= 6 }));
  renderCatalog(view, m.title, m.intro, sections, modeTabs(m.key));
}
function renderVortex(view, id) {
  if (!DATA.units) { view.replaceChildren(h('p', { class: 'dim' }, 'Unit data not loaded.')); return; }
  if (id === 'area') return;   // handled by the router with the extra argument (see renderArea)
  if (id) return renderDungeonPage(view, Number(id));
  renderQuests(view, 'vortex');
}
function renderGrandQuest(view) { renderQuests(view, 'gq'); }
// Which mode a root area belongs to (for Back links).
function modeOfRoot(root) { for (const k of Object.keys(MODE_OF)) if (MODE_OF[k](root)) return k; return 'vortex'; }

function renderCatalog(view, title, intro, sections, tabs) {
  const T = areaTree(); const today = vortexToday();
  const out = h('div', {}, tabs || null, h('h1', {}, title), h('p', { class: 'dim' }, intro));
  for (const s of sections) {
    const det = h('details', { open: s.open ? true : null, class: 'cat' });
    const count = s.areas.reduce((n, a) => n + countDungeons(a, T), 0);
    const live = NOT_LIVE[s.title];
    det.append(h('summary', {}, s.title, h('span', { class: 'faint' }, ` ${count} dungeon${count === 1 ? '' : 's'}`), live ? h('span', { class: 'tag red' }, live) : null));
    if (s.note) det.append(h('p', { class: 'faint' }, s.note));
    const body = h('div', { class: 'catbody' }); det.append(body);
    const merged = s.areas.length > 1 && s.areas.every(a => DATA.units.areas[a][0] === s.title);   // merged roots: no repeated heading
    const fill = () => { if (body.childElementCount) return; for (const a of s.areas) body.append(...areaBlock(a, T, today, s.areas.length > 1 && !merged)); };
    if (s.open) fill(); else det.addEventListener('toggle', fill, { once: true });
    out.append(det);
  }
  view.replaceChildren(out);
}
function countDungeons(areaId, T) { return (T.dgs[areaId] || []).length + (T.kids[areaId] || []).reduce((n, k) => n + countDungeons(k, T), 0); }
// An area: its own dungeons as rows, then each sub-area under a small heading (recursively).
function areaBlock(areaId, T, today, heading, depth = 0) {
  const D = DATA.units; const name = D.areas[areaId][0]; const out = [];
  const isEvent = today.event && norm(name) === today.event;
  if (heading) out.push(h('h3', { class: depth ? 'sub' : '', style: depth ? `margin-left:${Math.min(depth, 3) * 10}px` : '' }, h('a', { href: `#/vortex/area/${areaId}` }, name), isEvent ? h('span', { class: 'tag green' }, 'event running') : null, h('span', { class: 'faint' }, ` ${countDungeons(areaId, T)}`)));
  const rows = (T.dgs[areaId] || []).map(did => dungeonRow(did, today));
  if (rows.length) out.push(h('ul', { class: 'rows drows', style: depth ? `margin-left:${Math.min(depth, 3) * 10}px` : '' }, rows));
  for (const k of T.kids[areaId] || []) out.push(...areaBlock(k, T, today, true, depth + 1));
  return out;
}
function dungeonRow(did, today) {
  const d = dungeonInfo(did); if (!d) return null;
  const loot = dungeonLoot(d); const gives = dungeonGives(d, loot);
  const open = today.open.has(norm(d.name));
  return h('li', {}, h('a', { class: 'drow', href: `#/vortex/${d.id}` },
    h('span', { class: 'dicons' }, rewardPics(loot, gives, 4)),
    h('span', { class: 'dmain' }, h('span', { class: 'q' }, d.name, open ? h('span', { class: 'tag green' }, 'today') : null), h('span', { class: 'path' }, gives.text)),
    h('span', { class: 'faint num' }, `${d.missions.length} lv`)));
}

function renderArea(view, areaId) {
  const D = DATA.units; if (!D || !D.areas[areaId]) { view.replaceChildren(h('p', { class: 'dim' }, 'That area is not in the game data. ', h('a', { href: '#/vortex' }, 'Vortex'))); return; }
  const T = areaTree(); const root = rootOf(areaId); const mk = modeOfRoot(root); const mode = MODES.find(x => x.key === mk);
  const chain = areaChain(D, areaId).map(a => D.areas[a][0]);
  view.replaceChildren(h('div', {}, backLink(`#/quests/${mk}`),
    h('h1', {}, D.areas[areaId][0]), h('p', { class: 'faint' }, chain.slice(0, -1).join(' › ') || mode.title),
    ...areaBlock(areaId, T, vortexToday(), false)));
}

function renderDungeonPage(view, id) {
  const D = DATA.units;
  const info = dungeonInfo(id);
  if (!info) { view.replaceChildren(h('p', { class: 'dim' }, 'That dungeon is not in the game data. ', h('a', { href: '#/vortex' }, 'Vortex'))); return; }
  const mk = modeOfRoot(rootOf(D.dungeons[id][1])); const gq = mk === 'gq'; const mode = MODES.find(x => x.key === mk);
  const E = DATA.events; const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  let open = null;
  if (E && mk === 'vortex') {
    const n = norm(info.name);
    if ((E.every_day || []).some(x => norm(x) === n)) open = 'Open every day';
    else { const days = DAYS.filter((_, i) => (E.vortex[i] || []).some(x => norm(x) === n)); if (days.length) open = `Open on ${days.join(', ')}`; }
  }
  const gives = dungeonGives(info, dungeonLoot(info));
  const guide = RULES.vortexWeek.find(([, t]) => norm(t).includes(norm(info.name)));
  const parent = D.dungeons[id][1];
  const out = h('div', {}, backLink(`#/quests/${mk}`),
    h('h1', {}, info.name), h('p', { class: 'faint' }, [info.path ? [h('a', { href: `#/vortex/area/${parent}` }, info.path)] : mode.title, open ? ` · ${open}` : '']),
    h('p', { class: 'gives' }, h('b', {}, 'Gives: '), gives.text),
    guide ? h('p', { class: 'dim' }, `${guide[0]}: ${guide[1]}`) : null);
  const byChance = rows => [...rows].sort((a, b) => b[3] - a[3] || a[0] - b[0]);
  for (const m of info.missions) {
    const r = missionRows(m.id);
    const caps = byChance(r.enemy.filter(e => e[2] && e[3] > 0));
    const foes = r.enemy.filter(e => !(e[2] && e[3] > 0));
    const drops = [...r.chest.map(c => ({ id: c[0], p: c[2] / 10, how: `${c[2] / 10}% per kill`, boss: c[4] })), ...r.hit.map(c => ({ id: c[0], p: c[2], how: `${c[2]}% per hit`, boss: c[4] }))].sort((a, b) => b.p - a.p);
    out.append(h('h2', {}, m.name),
      caps.length ? h('div', { class: 'vrow' }, h('span', { class: 'dim' }, 'Capture'), h('span', { class: 'row' }, caps.map(e => [unitMini(e[2]), h('span', { class: 'pct' }, `${e[3]}%`), e[6] ? h('span', { class: 'tag red' }, 'Boss') : null]))) : null,
      r.reward.length ? h('div', { class: 'vrow' }, h('span', { class: 'dim' }, 'Unit reward'), h('span', { class: 'row' }, r.reward.map(e => [unitMini(e[0]), h('span', { class: 'faint' }, e[2] === 1 ? 'first clear' : 'every clear')]))) : null,
      drops.length ? h('div', { class: 'vrow' }, h('span', { class: 'dim' }, 'Drops'), h('span', { class: 'row' }, drops.slice(0, 12).map(d => [itemMini(d.id), h('span', { class: 'pct' }, d.how), d.boss ? h('span', { class: 'tag red' }, 'Boss') : null]))) : null,
      r.clear.length ? h('div', { class: 'vrow' }, h('span', { class: 'dim' }, 'Clear reward'), h('span', { class: 'row' }, r.clear.map(c => [itemMini(c[0], c[3]), h('span', { class: 'faint' }, c[2] === 1 ? 'first clear' : 'every clear')]))) : null,
      foes.length ? h('div', { class: 'vrow' }, h('span', { class: 'dim' }, 'Enemies'), h('span', { class: 'row' }, foes.map(e => [unitMini(e[0]), e[6] ? h('span', { class: 'tag red' }, 'Boss') : null]))) : null,
      !caps.length && !drops.length && !r.clear.length && !foes.length && !r.reward.length ? h('p', { class: 'faint' }, 'No enemy or drop data on record for this level.') : null);
  }
  view.replaceChildren(out);
}
