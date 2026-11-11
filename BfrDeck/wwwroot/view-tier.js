'use strict';
// Tier list: every Omni and 7★ unit ranked by the deck's own formula (the one Meta Units uses): max stats against
// the best in the game, plus what the skills bring (roles read from the skill text, hit count). Tiers are
// percentiles of that score. A curated list (RULES.tierCurated) overrides the formula where it names a unit.
// Skill data is fetched per unit through the disk cache; roles are remembered in localStorage so the second
// visit is instant.

const TIER = { roles: store.get('roleCache', { v: 1, r: {} }), running: false };

function statScore(id) {
  const m = unitMeta(id), top = (DATA.meta && DATA.meta.top) || [10800, 4000, 3725, 3650];
  return m ? (m[5] / top[0] + m[6] / top[1] + m[7] / top[2] + m[8] / top[3]) / 4 : 0;
}
function fullScore(id) {
  const r = TIER.roles.r[id];
  return statScore(id) + (r ? r.roles.length * 0.04 + Math.min(r.hits, 40) / 1000 : 0);
}
const tierOf = (rank, n) => rank < n * 0.08 ? 'S' : rank < n * 0.25 ? 'A' : rank < n * 0.55 ? 'B' : 'C';

function renderTier(view, arg) {
  if (!DATA.units || !DATA.meta) { view.replaceChildren(h('p', { class: 'dim' }, 'Unit data not loaded.')); return; }
  const st = TIER.state || (TIER.state = { rarity: 8, elements: new Set(), role: '', owned: false, q: '' });
  if (/^[1-6]$/.test(arg || '')) { st.elements = new Set([Number(arg)]); st.open = { S: true, A: true, B: false, C: false }; }   // #/tier/<1-6>: one element, S and A open (deep link / screenshots)
  const out = h('div', { class: 'tier' }, h('h1', {}, 'Tier list'),
    h('p', { class: 'dim' }, 'Ranked by the game\'s numbers: max HP, ATK, DEF and REC against the best unit in each stat, plus what the skills bring (healing, mitigation, BB fill, buffs, cleanse, hit count). S is the top 8 %, A the next 17 %, B the next 30 %. A formula, not a verdict: a unit with a niche leader skill can matter more than its tier says.'));
  const chip = (on, label, fn) => h('button', { class: on ? 'chip on' : 'chip', onclick: fn }, label);
  const filters = h('div', { class: 'filters' },
    h('span', { class: 'flabel' }, 'Rarity'), h('div', { class: 'fchips' }, [8, 7].map(r => chip(st.rarity === r, rarityName(r), () => { st.rarity = r; renderTier(view); }))),
    h('span', { class: 'flabel' }, 'Element'), h('div', { class: 'fchips' }, [1, 2, 3, 4, 5, 6].map(e => chip(st.elements.has(e), [h('img', { src: elIcon(e), width: 14, height: 14, style: 'vertical-align:-2px;margin-right:3px' }), ELEMENTS[e]], () => { if (st.elements.has(e)) st.elements.delete(e); else st.elements.add(e); renderTier(view); }))),
    h('span', { class: 'flabel' }, 'Role'), h('div', { class: 'fchips' }, chip(!st.role, 'any', () => { st.role = ''; renderTier(view); }), ROLE_DEFS.map(d => chip(st.role === d.key, d.label, () => { st.role = st.role === d.key ? '' : d.key; renderTier(view); }))),
    h('span', { class: 'flabel' }, 'Box'), h('div', { class: 'fchips' }, chip(!st.owned, 'all units', () => { st.owned = false; renderTier(view); }), chip(st.owned, 'owned only', () => { st.owned = true; renderTier(view); })));
  const status = h('p', { class: 'faint' });
  const list = h('div', {});
  out.append(filters, status, list);
  view.replaceChildren(out);

  const ids = DATA.unitNames.map(e => e.id).filter(id => id >= 10000 && id < 990000 && Math.min(unitRarity(id), 8) === st.rarity && unitMeta(id));
  const draw = () => {
    const ranked = ids.map(id => ({ id, s: fullScore(id) })).sort((a, b) => b.s - a.s);
    const n = ranked.length; ranked.forEach((x, i) => { x.tier = tierOf(i, n); x.rank = i + 1; });
    const curated = RULES.tierCurated || {};
    for (const x of ranked) for (const t of ['S', 'A', 'B', 'C']) if ((curated[t] || []).includes(x.id)) x.tier = t, x.curated = true;
    let shown = ranked.filter(x => (!st.elements.size || st.elements.has(unitElement(x.id))) && (!st.owned || COLL.owned.has(x.id)) && (!st.role || (TIER.roles.r[x.id] && TIER.roles.r[x.id].roles.includes(st.role))));
    const missing = ids.filter(id => !TIER.roles.r[id]).length;
    status.textContent = `${shown.length} of ${n} ${rarityName(st.rarity)} units${missing ? ` · reading skills for ${missing} more… (ranks settle as they arrive)` : ''}`;
    // Each tier is a collapsible section (S open, the rest closed) and shows 30 cards at a time.
    st.open = st.open || { S: true, A: false, B: false, C: false }; st.limit = st.limit || {};
    const card = x => { const r = TIER.roles.r[x.id]; const li = unitCard(x.id);
      li.append(h('span', { class: 'trank', title: `rank ${x.rank} of ${n} · score ${x.s.toFixed(3)}${x.curated ? ' · curated' : ''}` }, `#${x.rank}`));
      if (r && r.roles.length) li.querySelector('.card').title = r.roles.map(k => (ROLE_DEFS.find(d => d.key === k) || {}).label).filter(Boolean).join(', ');
      return li; };
    list.replaceChildren(...['S', 'A', 'B', 'C'].map(t => { const grp = shown.filter(x => x.tier === t); if (!grp.length) return null;
      const lim = st.limit[t] || 30; const det = h('details', { class: `cat tiergrp t-${t}`, open: st.open[t] ? true : null });
      det.addEventListener('toggle', () => { st.open[t] = det.open; });
      det.append(h('summary', {}, h('span', { class: 'tbadge' }, t), h('span', { class: 'faint' }, ` ${grp.length} unit${grp.length === 1 ? '' : 's'}${grp.length ? ` · ${shortUnitName(grp[0].id)}${grp.length > 1 ? `, ${shortUnitName(grp[1].id)}` : ''}${grp.length > 2 ? ', …' : ''}` : ''}`)),
        h('div', { class: 'catbody' }, h('ul', { class: 'grid' }, grp.slice(0, lim).map(card)),
          grp.length > lim ? h('button', { class: 'more', onclick: () => { st.limit[t] = lim + 60; draw(); } }, `Show more (${grp.length - lim} left in ${t})`) : null));
      return det; }));
  };
  draw();
  // Fill in roles for units we have not read yet, best stats first, a few at a time; redraw as they land.
  if (!TIER.running) {
    TIER.running = true;
    (async () => {
      const todo = ids.filter(id => !TIER.roles.r[id]).sort((a, b) => statScore(b) - statScore(a));
      let since = 0;
      const worker = async () => { while (todo.length) { const id = todo.shift(); const u = await unitDetail(id); const r = u ? unitRoles(u) : { roles: new Set(), hits: 0 }; TIER.roles.r[id] = { roles: [...r.roles], hits: r.hits }; if (++since % 20 === 0) { store.set('roleCache', TIER.roles); if (view.isConnected && TIER.state === st) draw(); } } };
      await Promise.all([worker(), worker(), worker(), worker()]);
      store.set('roleCache', TIER.roles); TIER.running = false;
      if (view.isConnected) draw();
    })();
  }
}
