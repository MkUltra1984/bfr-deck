'use strict';
// Gates: what is featured, what is always open, what is in rotation, and the pool and odds of each gate.

function renderGates(view, id) {
  const S = DATA.summons;
  if (!S) { view.replaceChildren(h('p', { class: 'dim' }, 'Summon data not loaded.')); return; }
  const now = Date.now() / 1000;
  if (id) return renderGatePage(view, Number(id), now);
  const W = weekState(now);
  const out = h('div', {});
  if (W.stale) out.append(h('p', { class: 'dim' }, 'Banner data is out of date, so this week’s featured gates are unknown.'));
  else {
    out.append(h('h2', {}, 'Featured this week'), W.featured.length ? h('div', { class: 'banners' }, W.featured.map(b => bannerCard(b, S, `until ${when(W.ends)}`, h('span', { class: 'tag green' }, 'Open')))) : h('p', { class: 'dim' }, 'None.'));
    if (W.next.length) out.append(h('h2', {}, 'Next week'), h('div', { class: 'banners' }, W.next.map(b => bannerCard(b, S, `from ${when(W.nextStarts)}`, h('span', { class: 'tag' }, 'Soon')))));
  }
  const table = (gates, statusOf) => h('table', {}, h('tr', {}, h('th', {}, 'Gate'), statusOf ? h('th', {}, 'When') : null, h('th', {}, 'Price'), h('th', { class: 'r' }, 'Units')),
    gates.map(g => h('tr', {}, h('td', {}, h('a', { href: `#/gates/${g.gate}` }, g.title)), statusOf ? h('td', { class: 'dim' }, statusOf(g)) : null, h('td', {}, gatePrice(g)), h('td', { class: 'r' }, g.units))));
  out.append(h('h2', {}, 'Always open'), table(S.gates.filter(g => !g.rotating)));
  const later = S.gates.filter(g => g.rotating && !(W.featured || []).some(f => f.gate === g.gate)).sort((a, b) => (a.next || 9e12) - (b.next || 9e12) || a.title.localeCompare(b.title));
  if (later.length) out.append(h('h2', {}, 'In the rotation'), table(later, g => gateStatus(g, W, now).text));
  out.append(h('h2', {}, 'Prices per the Discord guide'), h('table', {}, RULES.gatePrices.map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', { class: 'dim' }, v)))));
  view.replaceChildren(out);
}

// "Should I pull?": chance of at least one unit you don't own, per pull and per 10 / 30 pulls, from your box.
function shouldIPull(g, pool, total) {
  const missing = pool.filter(([uid]) => !COLL.owned.has(Number(uid)));
  const pNew = missing.reduce((s, p) => s + p[1], 0) / total;
  const atLeastOne = n => 1 - Math.pow(1 - pNew, n);
  const price = g.gems > 0 ? g.gems : 0;
  const wantMissing = missing.filter(([uid]) => COLL.marks.has(Number(uid)));
  const pWant = wantMissing.reduce((s, p) => s + p[1], 0) / total;
  const box = h('div', { class: 'box pull' }, h('h3', { style: 'margin-top:0' }, 'Should I pull?'));
  if (!COLL.owned.size) { box.append(h('p', { class: 'dim' }, 'Mark the units you own (✔ on unit cards) and this tells you the odds of pulling something new here.')); return box; }
  box.append(h('div', { class: 'kv' },
    h('span', {}, 'New to you'), h('span', {}, `${missing.length} of ${pool.length} units (${pct(100 * pNew)} per pull)`),
    h('span', {}, '≥1 new in 10 pulls'), h('b', { class: pNew > .5 ? 'green' : pNew > .2 ? 'gold' : 'red' }, pct(100 * atLeastOne(10))),
    h('span', {}, '≥1 new in 30 pulls'), h('b', {}, pct(100 * atLeastOne(30))),
    price ? h('span', {}, 'Gems per new unit') : null, price ? h('b', {}, pNew > 0 ? `≈ ${Math.ceil(price / pNew)} gems` : 'never') : null,
    wantMissing.length ? h('span', {}, 'Bookmarked here') : null, wantMissing.length ? h('span', {}, `${wantMissing.map(([uid]) => unitName(uid)).join(', ')} · ${pct(100 * pWant)} per pull, ≥1 in 30: ${pct(100 * (1 - Math.pow(1 - pWant, 30)))}`) : null),
    h('p', { class: 'faint' }, pNew === 0 ? 'You own everything on this gate.' : pNew > .5 ? 'Most pulls give something new. Good value.' : pNew > .2 ? 'Decent odds; set a gem budget.' : 'Mostly dupes (5 SP each on Omnis). Only pull for a specific unit.'));
  return box;
}

function renderGatePage(view, id, now) {
  const S = DATA.summons;
  const g = S.gates.find(x => x.gate === id);
  const out = h('div', {}, backLink('#/summon'));
  if (!g) { out.append(h('p', { class: 'dim' }, 'This gate is not offered in the game right now.')); view.replaceChildren(out); return; }
  const W = weekState(now);
  const st = gateStatus(g, W, now);
  const pool = S.pools[String(id)] || [];
  const total = pool.reduce((s, p) => s + p[1], 0) || 1;
  const groups = new Map();
  for (const [uid, chance] of pool) {
    const u = S.units[String(uid)] || [`Unit ${uid}`, 0, 0];
    const r = Math.min(u[1], 8);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push({ uid, name: u[0], el: u[2] || 0, chance: (100 * chance) / total });
  }
  const order = [...groups.keys()].sort((a, b) => b - a);
  const art = [...S.featured, ...S.next].find(b => b.gate === id && b.art);
  out.append(h('h1', {}, g.title), art ? h('img', { src: CDN_GACHA + encodeURIComponent(art.art), alt: '', style: 'width:100%;border-radius:8px;display:block;margin:6px 0' }) : null,
    h('div', { class: 'kv box' }, h('span', {}, 'Status'), h('span', { class: st.open ? 'green' : '' }, st.text), h('span', {}, 'Price'), h('span', {}, gatePrice(g)), h('span', {}, 'Units'), h('span', {}, String(pool.length))),
    shouldIPull(g, pool, total),
    h('h2', {}, 'Chances per pull'),
    h('table', {}, h('tr', {}, h('th', {}, 'Rarity'), h('th', { class: 'r' }, 'Chance'), h('th', { class: 'r' }, 'Units'), h('th', { class: 'r' }, 'Each')),
      order.map(r => { const us = groups.get(r); const lo = Math.min(...us.map(u => u.chance)), hi = Math.max(...us.map(u => u.chance));
        return h('tr', {}, h('td', {}, stars(r)), h('td', { class: 'r pct' }, pct(us.reduce((s, u) => s + u.chance, 0))), h('td', { class: 'r' }, us.length), h('td', { class: 'r dim' }, lo === hi ? pct(lo) : `${pct(lo)}–${pct(hi)}`)); })));
  for (const r of order) {
    const us = groups.get(r).sort((a, b) => a.name.localeCompare(b.name));
    const mixed = new Set(us.map(u => pct(u.chance))).size > 1;
    out.append(h('h3', {}, stars(r), h('span', { class: 'faint' }, ` ${us.length} unit${us.length === 1 ? '' : 's'}`)),
      h('ul', { class: 'grid' }, us.map(u => h('li', { class: COLL.owned.has(Number(u.uid)) ? 'owned' : '' }, h('a', { class: `card el-${u.el}`, href: `#/units/${u.uid}` },
        h('img', { src: unitIcon(u.uid), alt: '', loading: 'lazy', onerror: e => { e.target.style.visibility = 'hidden'; } }),
        h('span', { class: 'n' }, u.name), mixed ? h('span', { class: 's' }, pct(u.chance)) : null, COLL.owned.has(Number(u.uid)) ? h('span', { class: 'tag green' }, 'owned') : null)))));
  }
  view.replaceChildren(out);
}
