'use strict';
// Units: search with filters, owned / bookmark marks, Pokédex-style progress, bookmarks list, unit page.

const unitsState = { q: '', elements: new Set(), rarities: new Set(), owned: 'all', limit: 60, mode: 'units', view: 'cards', sort: 'default', dir: -1 };

function renderUnits(view, id) {
  if (!DATA.units) { view.replaceChildren(h('p', { class: 'dim' }, 'Unit data not loaded.')); return; }
  if (id === 'box') return renderBox(view);
  if (id === 'marks') return renderMarks(view);
  if (id) return renderUnitPage(view, Number(id));
  const q = h('input', { type: 'search', placeholder: 'Search units… (typos ok)', value: unitsState.q, style: 'flex:1' });
  // Filters, one labelled row each: where to go, element, rarity, owned. Same gap and alignment throughout.
  const chipBtn = (set, v, label) => h('button', { class: 'chip', 'aria-pressed': set.has(v), onclick: ev => { if (set.has(v)) set.delete(v); else set.add(v); ev.currentTarget.setAttribute('aria-pressed', set.has(v)); unitsState.limit = 60; draw(); } }, label);
  const clearBtn = h('button', { class: 'chip faintchip', title: 'Clear all filters', onclick: () => { unitsState.elements.clear(); unitsState.rarities.clear(); unitsState.owned = 'all'; unitsState.q = ''; renderUnits(view); } }, 'clear');
  const filters = h('div', { class: 'filters' },
    h('span', { class: 'flabel' }, 'Go to'), h('div', { class: 'fchips' }, h('a', { class: 'chip', href: '#/units/box' }, `Box · ${COLL.owned.size} owned`), h('a', { class: 'chip', href: '#/units/marks' }, `Bookmarks · ${COLL.marks.size}`), h('a', { class: 'chip', href: '#/tier' }, 'Tier list ›'), h('a', { class: 'chip', href: '#/items' }, 'Items & spheres ›')),
    h('span', { class: 'flabel' }, 'View'), h('div', { class: 'fchips' }, ['cards', 'table'].map(v => h('button', { class: 'chip', 'aria-pressed': unitsState.view === v, onclick: () => { unitsState.view = v; renderUnits(view); } }, v))),
    h('span', { class: 'flabel' }, 'Element'), h('div', { class: 'fchips' }, [1, 2, 3, 4, 5, 6].map(e => chipBtn(unitsState.elements, e, [h('img', { src: elIcon(e), width: 14, height: 14, style: 'vertical-align:-2px;margin-right:3px' }), ELEMENTS[e]]))),
    h('span', { class: 'flabel' }, 'Rarity'), h('div', { class: 'fchips' }, [8, 7, 6, 5, 4].map(r => chipBtn(unitsState.rarities, r, rarityName(r)))),
    h('span', { class: 'flabel' }, 'Owned'), h('div', { class: 'fchips' }, ['all', 'owned', 'missing'].map(v => h('button', { class: 'chip', 'aria-pressed': unitsState.owned === v, onclick: () => { unitsState.owned = v; unitsState.limit = 60; renderUnits(view); } }, v === 'all' ? 'all units' : v === 'owned' ? 'owned' : 'not owned')), clearBtn));
  const status = h('p', { class: 'faint' }); const results = h('div', {});
  let t = 0; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { unitsState.q = q.value; unitsState.limit = 60; draw(); }, 100); });
  function draw() {
    let r = searchUnits(unitsState.q, { elements: unitsState.elements, rarities: unitsState.rarities, limit: 5000 });
    let ids = r.ids;
    if (unitsState.owned === 'owned') ids = ids.filter(i => COLL.owned.has(i)); else if (unitsState.owned === 'missing') ids = ids.filter(i => !COLL.owned.has(i));
    // Table view: sort by a stat column (click a header; again to flip).
    if (unitsState.view === 'table' && unitsState.sort !== 'default') {
      const col = { hp: 5, atk: 6, def: 7, rec: 8, cost: 0, lv: 9 }[unitsState.sort];
      const val = id => { const m = unitMeta(id); if (unitsState.sort === 'name') return unitName(id); if (unitsState.sort === 'rarity') return unitRarity(id); if (unitsState.sort === 'element') return unitElement(id); return m ? m[col] : -1; };
      ids = [...ids].sort((a, b) => { const x = val(a), y = val(b); return (typeof x === 'string' ? x.localeCompare(y) : x - y) * -unitsState.dir; });
    }
    const total = ids.length; ids = ids.slice(0, unitsState.limit);
    status.textContent = total ? `${fmt(total)} unit${total === 1 ? '' : 's'}` : 'No unit matches.';
    const more = total > ids.length ? h('button', { class: 'more', onclick: () => { unitsState.limit += 120; draw(); } }, `Show more (${fmt(total - ids.length)} left)`) : null;
    results.replaceChildren(unitsState.view === 'table' ? unitTable(ids) : h('ul', { class: 'grid' }, ids.map(unitCard)), more, otherMatches(unitsState.q));
  }
  // Sortable stats table (click a header to sort, again to flip). "Best" = the stat where the unit ranks highest.
  function unitTable(ids) {
    const top = (DATA.meta && DATA.meta.top) || [10800, 4000, 3725, 3650];
    const th = (key, label, cls) => h('th', { class: `${cls || ''} sortable${unitsState.sort === key ? ' on' : ''}`, onclick: () => { if (unitsState.sort === key) unitsState.dir = -unitsState.dir; else { unitsState.sort = key; unitsState.dir = -1; } draw(); } }, label, unitsState.sort === key ? (unitsState.dir < 0 ? ' ▾' : ' ▴') : '');
    const best = m => { if (!m) return ''; const r = [['HP', m[5] / top[0]], ['ATK', m[6] / top[1]], ['DEF', m[7] / top[2]], ['REC', m[8] / top[3]]].sort((a, b) => b[1] - a[1]); return r[0][0]; };
    return h('table', { class: 'utable' }, h('tr', {}, th('rarity', 'Rarity'), th('element', 'El.'), th('name', 'Name'), th('hp', 'HP', 'r'), th('atk', 'ATK', 'r'), th('def', 'DEF', 'r'), th('rec', 'REC', 'r'), th('cost', 'Cost', 'r'), h('th', {}, 'Best'), h('th', {}, '')),
      ids.map(id => { const m = unitMeta(id) || []; const owned = COLL.owned.has(id);
        return h('tr', { class: owned ? 'owned' : '' }, h('td', {}, stars(unitRarity(id))), h('td', {}, h('img', { src: elIcon(unitElement(id)), width: 14, height: 14, alt: ELEMENTS[unitElement(id)] })),
          h('td', {}, h('a', { class: 'row', href: `#/units/${id}`, style: 'gap:6px;flex-wrap:nowrap' }, h('img', { class: 'tthumb', src: unitIcon(id), alt: '', loading: 'lazy' }), unitName(id), teamBadgeInline(id))),
          h('td', { class: 'r num' }, m[5] != null ? fmt(m[5]) : ''), h('td', { class: 'r num' }, m[6] != null ? fmt(m[6]) : ''), h('td', { class: 'r num' }, m[7] != null ? fmt(m[7]) : ''), h('td', { class: 'r num' }, m[8] != null ? fmt(m[8]) : ''), h('td', { class: 'r num' }, m[0] != null ? m[0] : ''),
          h('td', { class: 'dim' }, best(m)), h('td', {}, h('button', { class: owned ? 'mark own on static' : 'mark own static', title: owned ? 'Owned' : 'Mark as owned', onclick: e => { COLL.toggleOwned(id); draw(); } }, '✔'))); }));
  }
  function teamBadgeInline(id) { const sq = squadsOf(id); return sq.length ? h('span', { class: 'tmlabel', style: `--c:${SQUAD_COLORS[sq[0].i % SQUAD_COLORS.length]}` }, sq[0].name.replace(/^Squad\s+/i, 'T')) : null; }
  view.replaceChildren(h('div', { class: 'row' }, q), filters, status, results);
  draw(); q.focus();
}

// The unit search also finds dungeons, areas and summon gates by name, so one box answers "where is X".
function otherMatches(q) {
  const nq = norm(q); if (nq.length < 3 || !DATA.units) return null;
  const D = DATA.units, S = DATA.summons; const out = [];
  for (const [id, d] of Object.entries(D.dungeons)) if (d[0] && norm(d[0]).includes(nq)) { out.push(h('a', { class: 'chip', href: `#/vortex/${id}` }, `⚔ ${d[0]}`)); if (out.length >= 8) break; }
  for (const [id, a] of Object.entries(D.areas)) if (a[0] && norm(a[0]).includes(nq) && out.length < 12) out.push(h('a', { class: 'chip', href: `#/vortex/area/${id}` }, `▦ ${a[0]}`));
  if (S) for (const g of S.gates) if (norm(g.title).includes(nq) && out.length < 16) out.push(h('a', { class: 'chip', href: `#/gates/${g.gate}` }, `✦ ${g.title}`));
  return out.length ? h('div', { class: 'box', style: 'margin-top:10px' }, h('div', { class: 'faint', style: 'margin-bottom:4px' }, 'Dungeons, areas and gates matching your search'), h('div', { class: 'row' }, out)) : null;
}

function unitCard(id) {
  const owned = COLL.owned.has(id), marked = COLL.marks.has(id);
  const card = h('li', { class: owned ? 'owned' : '' }, h('a', { class: `card el-${unitElement(id)} r${Math.min(unitRarity(id), 8)}`, href: `#/units/${id}` },
    h('img', { src: unitIcon(id), alt: '', loading: 'lazy', onerror: e => { e.target.style.visibility = 'hidden'; } }),
    stars(unitRarity(id)), h('span', { class: 'n' }, unitName(id))), teamBadge(id),
    h('button', { class: owned ? 'mark own on' : 'mark own', title: owned ? 'Owned (click to remove from box)' : 'Mark as owned', onclick: e => { COLL.toggleOwned(id); card.replaceWith(unitCard(id)); } }, '✔'),
    h('button', { class: marked ? 'mark star on' : 'mark star', title: 'Bookmark', onclick: e => { COLL.toggleMark(id); card.replaceWith(unitCard(id)); } }, '★'));
  return card;
}
function unitMini(id) { return h('a', { class: 'mini', href: `#/units/${id}` }, h('img', { src: unitIcon(id), alt: '', loading: 'lazy' }), unitName(id)); }

// Pokédex: what you own, by rarity and element.
function renderBox(view) {
  const st = collectionStats();
  const bar = (o, t) => h('div', { class: 'bar' }, h('div', { class: 'fill', style: `width:${t ? (100 * o / t) : 0}%` }), h('span', {}, `${o} / ${t}`));
  const scannedAt = store.get('boxScannedAt', 0); const boxTotal = store.get('boxTotal', 0);
  view.replaceChildren(h('div', {}, backLink('#/units'), h('h1', {}, 'Your box'), msBoxList(),
    h('div', { class: 'box' }, h('div', { class: 'row' }, h('b', {}, `${st.owned} of ${st.total} units`), h('span', { class: 'faint' }, `${(100 * st.owned / Math.max(1, st.total)).toFixed(1)}% of the collection`),
      h('span', { class: 'grow' }), MS.profile ? h('span', { class: 'faint' }, `read from your account ${when(scannedAt)}`) : h('button', { class: 'chip', onclick: () => msSignIn(() => renderBox(view)) }, 'Sign in to read my box'), MS.profile ? null : h('span', { class: 'faint' }, 'or tick ✔ on unit cards'),
      h('button', { class: 'chip', title: 'Show the first-start introduction again', onclick: () => showIntro(true) }, 'intro')), bar(st.owned, st.total),
      h('p', { class: 'faint', style: 'margin:6px 0 0' }, 'Keeping the box current: signed in, the deck reads it from your account at every start. Without signing in, use "I pulled…" on the Home tile after a summon session and tick ✔ on unit cards. Squad members carry a coloured team label on their icon.')),
    h('h2', {}, 'By rarity'), h('div', { class: 'cols' }, [8, 7, 6, 5, 4, 3, 2, 1].filter(r => st.by.rarity[r]).map(r => h('div', { class: 'box' }, h('div', { class: 'row' }, stars(r), h('span', { class: 'grow' })), bar(st.by.rarity[r].o, st.by.rarity[r].t)))),
    h('h2', {}, 'By element'), h('div', { class: 'cols' }, [1, 2, 3, 4, 5, 6].filter(e => st.by.element[e]).map(e => h('div', { class: 'box' }, h('div', { class: 'row' }, h('img', { src: elIcon(e), width: 16, height: 16 }), ELEMENTS[e]), bar(st.by.element[e].o, st.by.element[e].t)))),
    h('h2', {}, 'Owned units'), COLL.owned.size ? h('ul', { class: 'grid' }, [...COLL.owned].sort((a, b) => unitRarity(b) - unitRarity(a) || b - a).map(unitCard)) : h('p', { class: 'dim' }, 'Nothing yet. Tick the ✔ on any unit card to add it to your box. Export / import lives in the Team tab.')));
}

// Bookmarks: pinned units with a short where-to-get summary.
function renderMarks(view) {
  const D = DATA.units;
  const gates = new Map(((D.summon && D.summon.gates) || []).map(g => [g.gate, g]));
  const rows = [...COLL.marks].sort((a, b) => unitRarity(b) - unitRarity(a) || b - a).map(id => {
    const s = unitSources(id); const bits = [];
    for (const [g, p] of [...s.summon].sort((a, b) => b[1] - a[1]).slice(0, 3)) { const gate = gates.get(g); bits.push(h('a', { href: `#/gates/${g}` }, gate ? gate.title : `Gate ${g}`), h('span', { class: 'pct' }, ` ${p}% `)); }
    const cap = s.enemy.filter(r => r[2] === id && r[3] > 0).sort((a, b) => b[3] - a[3])[0];
    if (cap) bits.push(h('span', {}, `capture ${cap[3]}% in ${missionInfo(D, cap[1]).name}`));
    const rw = s.reward[0]; if (rw) bits.push(h('span', {}, `clear reward: ${missionInfo(D, rw[1]).name}`));
    if (!bits.length) bits.push(h('span', { class: 'faint' }, 'no live source right now'));
    return h('li', {}, h('div', { class: 'row' }, unitMini(id), stars(unitRarity(id)), COLL.owned.has(id) ? h('span', { class: 'tag green' }, 'owned') : null, h('span', { class: 'grow' }), h('button', { class: 'icon', onclick: () => { COLL.toggleMark(id); renderMarks(view); } }, '✕')), h('div', { class: 'tags' }, bits));
  });
  view.replaceChildren(h('div', {}, backLink('#/units'), h('h1', {}, 'Bookmarks'),
    rows.length ? h('ul', { class: 'rows' }, rows) : h('p', { class: 'dim' }, 'Star a unit on its card or page to pin it here with how to get it.')));
}

async function renderUnitPage(view, id) {
  const m = unitMeta(id), e = unitElement(id);
  const marks = () => h('div', { class: 'row', style: 'margin-top:6px' },
    h('button', { class: COLL.owned.has(id) ? 'chip on' : 'chip', onclick: ev => { COLL.toggleOwned(id); ev.currentTarget.replaceWith(marks()); } }, COLL.owned.has(id) ? '✔ owned' : 'mark owned'),
    h('button', { class: COLL.marks.has(id) ? 'chip on' : 'chip', onclick: ev => { COLL.toggleMark(id); ev.currentTarget.parentElement.replaceWith(marks()); } }, COLL.marks.has(id) ? '★ bookmarked' : '☆ bookmark'),
    siteLink('bfrevive.net', `/units/#u=${id}`), h('a', { href: '#', onclick: ev => { ev.preventDefault(); host.open('wiki', `https://bravefrontierglobal.fandom.com/wiki/${encodeURIComponent(unitName(id).replace(/ /g, '_'))}`); } }, 'wiki'));
  const head = h('div', {}, backLink('#/units'),
    h('div', { class: 'hero' }, h('div', { class: 'herosprite' }, spriteCanvas(id, 150, { maxScale: 1.8 })),
      h('div', {}, h('h1', {}, e ? h('img', { class: 'big-el', src: elIcon(e), alt: ELEMENTS[e] }) : null, unitName(id)),
        h('div', {}, stars(unitRarity(id)), h('span', { class: 'chip static' }, `No. ${id}`), m ? h('span', { class: 'chip static' }, `Cost ${m[0]}`) : null, m ? h('span', { class: 'chip static' }, `Lv ${m[9]}`) : null), marks())));
  const body = h('div', {}, h('p', { class: 'dim' }, 'Loading skills…'));
  view.replaceChildren(head, body);
  if (m) head.append(h('div', { class: 'stats' }, ['HP', 'ATK', 'DEF', 'REC'].map((k, i) => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, fmt(m[5 + i])), h('div', { class: 's' }, `Lv1 ${fmt(m[1 + i])}`)))));
  const u = await unitDetail(id);
  body.replaceChildren();
  const copies = copiesSection(id); if (copies) body.append(copies);   // signed in to My Summoner: your own copies of this unit
  // the evolution line (the author: "does our unit viewer include evolution lines?"): every form in order, this one
  // highlighted, each a link to its page, like bfrevive.net's unit pages
  if (u && u.evo && u.evo.length > 1) head.append(h('div', { class: 'evoline' }, h('span', { class: 'k' }, 'Evolution'),
    u.evo.map((x, i) => [i ? h('span', { class: 'arrow', 'aria-hidden': 'true' }, '›') : null,
      h('a', { class: 'evo' + (x === id ? ' on' : ''), href: `#/units/${x}`, title: `${unitName(x)}${x === id ? ' (this unit)' : ''}` },
        h('img', { src: unitIcon(x), alt: unitName(x) }), stars(unitRarity(x)), COLL.owned.has(x) ? h('span', { class: 'own', title: 'You own this form' }, '✓') : null)])));
  if (u) {
    const r = unitRoles(u);
    body.append(h('div', { class: 'row' }, [...r.roles].map(k => h('span', { class: 'chip static on' }, ROLE_DEFS.find(d => d.key === k).label)), r.hits ? h('span', { class: 'chip static' }, `${r.hits} hits`) : null));
    // A unit you own (signed in): My Summoner's advice is the answer. Otherwise the deck's own picks, marked as an estimate.
    const advice = msAdvice(id);
    if (advice) body.append(advice, deckEstimate(spSection(id, u), 'My Summoner gives no SP build'));
    else body.append(deckEstimate(sphereSection(id, u), 'you do not own this unit, so My Summoner has no advice for it'), deckEstimate(spSection(id, u), 'you do not own this unit'));
    const skill = (label, s) => s && s.name ? h('div', { class: 'skill' }, h('b', {}, label + ' '), h('span', { class: 'nm' }, s.name), s.bc ? h('span', { class: 'faint' }, ` · ${s.bc[0]} BC`) : null, h('p', {}, s.desc)) : null;
    body.append(h('h2', {}, 'Skills'), skill('LS', u.ls), skill('ES', u.es), skill('BB', u.bb), skill('SBB', u.sbb), skill('UBB', u.ubb));
    if (u.imps) body.append(h('p', { class: 'faint' }, `Imp caps: HP ${u.imps[0]} · ATK ${u.imps[1]} · DEF ${u.imps[2]} · REC ${u.imps[3]}`));
    if (u.lore) body.append(h('details', {}, h('summary', {}, 'Lore'), h('p', { class: 'dim' }, u.lore)));
  } else body.append(h('p', { class: 'faint' }, 'No skill data on record for this unit.'));
  body.append(h('h2', {}, 'Where to get'), ...whereToGetUnit(id));
}

function whereToGetUnit(id) {
  const D = DATA.units; const s = unitSources(id); const out = [];
  const section = (title, rows) => { if (rows.length) out.push(h('h3', {}, title), h('ul', { class: 'rows' }, rows)); };
  const gates = new Map(((D.summon && D.summon.gates) || []).map(g => [g.gate, g]));
  section('Summon gates', [...s.summon].sort((a, b) => b[1] - a[1]).map(([g, p]) => { const gate = gates.get(g) || { title: `Gate ${g}` };
    return h('li', {}, h('a', { class: 'q', href: `#/gates/${g}` }, gate.title), h('div', { class: 'tags' }, h('span', {}, h('span', { class: 'pct' }, `${p}%`), ' per pull'), gate.rotating ? h('span', { class: 'faint' }, gate.featured ? 'featured this week' : 'rotating gate') : null)); }));
  const questRow = (r, extra) => { const info = missionInfo(D, r[1]); return h('li', {}, h('span', { class: 'q' }, info.name), h('span', { class: 'path' }, info.path), h('div', { class: 'tags' }, extra)); };
  const capTags = (r, self) => [r[3] > 0 ? h('span', {}, 'Capture ', h('span', { class: 'pct' }, `${r[3]}%`)) : h('span', { class: 'faint' }, 'Not capturable'), r[2] && r[2] !== self ? h('span', {}, 'joins as ', unitMini(r[2])) : null, r[6] ? h('span', { class: 'tag red' }, 'Boss') : null, r[5] > 1 ? h('span', { class: 'faint' }, `×${r[5]} in this quest`) : null, r[4] < 100 ? h('span', { class: 'faint' }, `appears in ${r[4]}% of runs`) : null];
  const sortRows = rows => [...rows].sort((a, b) => b[3] - a[3] || a[1] - b[1]);
  section(`Fights as an enemy in ${s.enemy.length} quest${s.enemy.length === 1 ? '' : 's'}`, sortRows(s.enemy).map(r => questRow(r, capTags(r, id))));
  section(`Joins from another enemy in ${s.caught.length} quest${s.caught.length === 1 ? '' : 's'}`, sortRows(s.caught).map(r => questRow(r, [h('span', {}, 'from ', unitMini(r[0])), ...capTags(r, r[2]).slice(0, 1)])));
  section('Clear reward', [...s.reward].sort((a, b) => a[2] - b[2] || a[1] - b[1]).map(r => questRow([r[0], r[1]], [h('span', {}, r[2] === 1 ? 'First clear' : 'Every clear'), r[3] > 1 ? h('span', { class: 'faint' }, `×${r[3]}`) : null])));
  section('Event shops', s.shop.map(r => h('li', {}, h('span', { class: 'q' }, `${D.tokens[r[1]] || 'Event token'} shop`), h('div', { class: 'tags' }, h('span', {}, `${r[2]} ${D.tokens[r[1]] || 'tokens'}${r[4] > 1 ? ` for ${r[4]}` : ''}`), h('span', { class: 'faint' }, `buy up to ${r[3]}`)))));
  if (!out.length) out.push(h('p', { class: 'dim' }, 'No quest, reward, shop or summon gate lists this unit right now. It may come from a selector ticket or by evolving another unit.'));
  return out;
}
