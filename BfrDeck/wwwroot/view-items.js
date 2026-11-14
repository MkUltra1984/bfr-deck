'use strict';
// Items: search by name or type; an item page lists drops, clear rewards, shops, recipes and what it crafts.

const itemsState = { q: '', type: 0, limit: 80 };

function renderItems(view, id) {
  if (!DATA.items) { view.replaceChildren(h('p', { class: 'dim' }, 'Item data not loaded.')); return; }
  if (id) return renderItemPage(view, Number(id));
  const q = h('input', { type: 'search', placeholder: 'Search items, spheres, materials…', value: itemsState.q, style: 'flex:1' });
  const type = h('select', {}, h('option', { value: 0 }, 'Any type'), [2, 3, 6, 4, 5, 1].map(t => h('option', { value: t, selected: itemsState.type === t ? true : null }, ITEM_TYPES[t])));
  const status = h('p', { class: 'faint' });
  const results = h('div', {});
  let t = 0;
  q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { itemsState.q = q.value; itemsState.limit = 80; draw(); }, 100); });
  type.addEventListener('change', () => { itemsState.type = Number(type.value); itemsState.limit = 80; draw(); });
  function draw() {
    const r = searchItems(itemsState.q, { type: itemsState.type, limit: itemsState.limit });
    status.textContent = r.total ? `${fmt(r.total)} item${r.total === 1 ? '' : 's'}` : 'No item matches.';
    results.replaceChildren(h('ul', { class: 'itiles' }, r.ids.map(itemTile)),
      r.total > r.ids.length ? h('button', { class: 'more', onclick: () => { itemsState.limit += 160; draw(); } }, `Show more (${fmt(r.total - r.ids.length)} left)`) : null);
  }
  view.replaceChildren(h('div', { class: 'row' }, q, type), status, results);
  draw();
  q.focus();
}

function itemTile(id) {
  const it = itemRow(id);
  return h('li', {}, h('a', { class: 'itile', href: `#/items/${id}`, title: `${it[0]} · ${ITEM_TYPES[it[1]] || 'Item'}` },
    h('img', { src: itemIcon(id), alt: '', loading: 'lazy', onerror: e => { e.target.style.visibility = 'hidden'; } }), h('span', { class: 'n' }, it[0])));
}
function itemMini(id, count) {
  const it = itemRow(id);
  return h('span', { class: 'mini' }, h('img', { src: itemIcon(id), alt: '', loading: 'lazy' }), h('a', { href: `#/items/${id}` }, it[0]), count > 1 ? h('span', { class: 'faint' }, ` ×${count}`) : null);
}

function renderItemPage(view, id) {
  const D = DATA.items;
  const it = D.items[id];
  if (!it) { view.replaceChildren(h('p', { class: 'dim' }, 'That item is not in the game data. ', h('a', { href: '#/items' }, 'Back'))); return; }
  const s = itemSources(id);
  const out = h('div', {}, backLink('#/items'),
    h('div', { class: 'hero' }, h('img', { class: 'big', src: itemIcon(id), alt: '', onerror: e => { e.target.style.visibility = 'hidden'; } }),
      h('div', {}, h('h1', {}, it[0]), h('div', {}, h('span', { class: 'chip static' }, ITEM_TYPES[it[1]] || 'Item'), h('span', { class: 'chip static' }, `No. ${id}`), stockTag(id)),
        h('div', { class: 'row', style: 'margin-top:6px' }, siteLink('Open on bfrevive.net', `/items/#i=${id}`),
          h('a', { href: '#', onclick: ev => { ev.preventDefault(); host.open('wiki', `https://bravefrontierglobal.fandom.com/wiki/Special:Search?query=${encodeURIComponent(it[0])}`); } }, 'Wiki')))),
    it[4] ? h('p', { class: 'dim' }, it[4]) : null);
  const questRow = (m, value, extra) => { const info = missionInfo(D, m); return h('li', {}, h('span', { class: 'q' }, info.name), ' ', h('span', { class: 'pct' }, value), h('span', { class: 'path' }, info.path), h('div', { class: 'tags' }, extra)); };
  const boss = r => r[4] ? h('span', { class: 'tag red' }, 'Boss') : null;
  const byChance = rows => [...rows].sort((a, b) => b[2] - a[2] || a[1] - b[1]);
  let n = 0;
  const section = (title, rows) => { if (!rows.length) return; n++; out.append(h('h2', {}, title), h('ul', { class: 'rows' }, rows)); };
  section(`Treasure chests · ${s.chest.length} quest${s.chest.length === 1 ? '' : 's'}`, byChance(s.chest).map(r => questRow(r[1], `${r[2] / 10}% per kill`, [r[3] > 1 ? h('span', {}, `×${r[3]} each`) : null, boss(r)])));
  section(`Dropped on hit · ${s.hit.length} quest${s.hit.length === 1 ? '' : 's'}`, byChance(s.hit).map(r => questRow(r[1], `${r[2]}% per hit`, [h('span', {}, `up to ${r[3]} per enemy`), boss(r)])));
  section('Clear reward', [...s.clear].sort((a, b) => a[2] - b[2] || a[1] - b[1]).map(r => questRow(r[1], r[2] === 1 ? 'First clear' : 'Every clear', [r[3] > 1 ? h('span', {}, `×${r[3]}`) : null])));
  section('Shops', [...s.shop].sort((a, b) => a[1] - b[1] || a[3] - b[3]).map(r => h('li', {}, h('span', { class: 'q' }, r[1] === 1 ? `${r[2]} shop` : SHOP_NAMES[r[1]] || 'Shop'), ' ',
    h('span', { class: 'pct' }, `${fmt(r[3])} ${r[1] === 1 ? r[2] : r[1] === 4 ? 'Colosseum points' : r[2]}`),
    h('div', { class: 'tags' }, r[5] > 1 ? h('span', {}, `gives ${r[5]}`) : null, r[4] > 0 ? h('span', {}, `buy up to ${r[4]}`) : null))));
  section('Crafting', s.recipe.map(r => h('li', {}, h('span', { class: 'q' }, `Craft in town${r[4] > 1 ? ` (makes ${r[4]})` : ''}`), ' ', r[1] > 0 ? h('span', { class: 'pct' }, `${fmt(r[1])} Karma`) : null,
    h('div', { class: 'tags' }, materials(r[2]).map(([m, c]) => itemMini(m, c)), r[3] > 0 ? h('span', { class: 'faint' }, `craft ${r[3] === 1 ? 'once' : `up to ${r[3]} times`}`) : null))));
  if (!n) out.append(h('p', { class: 'dim' }, 'No live source right now: no quest, reward, shop or recipe gives it.'));
  if (s.usedIn.length) out.append(h('h2', {}, 'Used to craft'), h('ul', { class: 'rows' }, s.usedIn.map(m => h('li', {}, itemMini(m)))));
  view.replaceChildren(out);
}
