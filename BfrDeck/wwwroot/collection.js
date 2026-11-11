'use strict';
// Your collection, stored locally: owned units (the "box"), bookmarks, and squads of 5.

const COLL = {
  owned: new Set(store.get('owned', [])),
  marks: new Set(store.get('marks', [])),
  squads: store.get('squads', [{ name: 'Squad 1', units: [null, null, null, null, null] }]),
  active: store.get('activeSquad', 0),
  save() { store.set('owned', [...this.owned]); store.set('marks', [...this.marks]); store.set('squads', this.squads); store.set('activeSquad', this.active); },
  toggleOwned(id) { id = Number(id); if (this.owned.has(id)) this.owned.delete(id); else this.owned.add(id); this.save(); },
  toggleMark(id) { id = Number(id); if (this.marks.has(id)) this.marks.delete(id); else this.marks.add(id); this.save(); },
  squad() { return this.squads[this.active] || this.squads[0]; },
  setSlot(si, slot, id) { this.squads[si].units[slot] = id == null ? null : Number(id); this.save(); },
  addSquad() { this.squads.push({ name: `Squad ${this.squads.length + 1}`, units: [null, null, null, null, null], friend: null, spheres: {} }); this.active = this.squads.length - 1; this.save(); },
  removeSquad(i) { if (this.squads.length <= 1) return; this.squads.splice(i, 1); this.active = Math.min(this.active, this.squads.length - 1); this.save(); },
  export() { return JSON.stringify({ owned: [...this.owned], marks: [...this.marks], squads: this.squads, notes: store.get('notes', '') }, null, 1); },
  import(text) {
    const d = JSON.parse(text);
    if (Array.isArray(d.owned)) this.owned = new Set(d.owned.map(Number));
    if (Array.isArray(d.marks)) this.marks = new Set(d.marks.map(Number));
    if (Array.isArray(d.squads) && d.squads.length) this.squads = d.squads.map(s => ({ name: String(s.name || 'Squad'), units: Array.from({ length: 5 }, (_, i) => s.units && s.units[i] != null ? Number(s.units[i]) : null), friend: s.friend ? Number(s.friend) : null, spheres: s.spheres && typeof s.spheres === 'object' ? s.spheres : {} }));
    if (typeof d.notes === 'string') store.set('notes', d.notes);
    this.active = 0; this.save();
  },
};

// Which squads a unit is in: [{ i, name }]. Squad i gets colour SQUAD_COLORS[i % 6] everywhere (cards, picker, scan).
const SQUAD_COLORS = ['#e0b24a', '#6fa8dc', '#6fc98a', '#e06c6c', '#a06fe0', '#f0a35e'];
function squadsOf(id) { id = Number(id); return COLL.squads.map((s, i) => ({ i, name: s.name, slot: s.units.indexOf(id) })).filter(x => x.slot >= 0); }
// The small team label drawn over a unit icon. One label per squad the unit is in (usually one).
function teamBadge(id) {
  const sq = squadsOf(id); if (!sq.length) return null;
  return h('span', { class: 'tm' }, sq.map(x => h('span', { class: 'tmlabel', style: `--c:${SQUAD_COLORS[x.i % SQUAD_COLORS.length]}`, title: `${x.name}, slot ${x.slot + 1}${x.slot === 0 ? ' (leader)' : ''}` }, x.name.replace(/^Squad\s+/i, 'T'))));
}

// Collection progress: how many units of each rarity / element you own (Pokédex style).
function collectionStats() {
  const by = { rarity: {}, element: {} }; let total = 0, owned = 0;
  for (const e of DATA.unitNames) {
    const id = e.id; if (id >= 990000 || id < 10000) continue;   // skip Forge customs and the Summoner
    const r = Math.min(unitRarity(id), 8), el = unitElement(id);
    total++; const o = COLL.owned.has(id);
    if (o) owned++;
    (by.rarity[r] ||= { t: 0, o: 0 }).t++; if (o) by.rarity[r].o++;
    (by.element[el] ||= { t: 0, o: 0 }).t++; if (o) by.element[el].o++;
  }
  return { total, owned, by };
}

// Shared unit picker: a small search box with a grid; resolves with a unit id or null.
// Options: onlyOwned (checkbox preset), ids (restrict to these units, e.g. a gate's pool), multi (toggle several,
// resolve with an array on Done), hint (one line under the title).
function pickUnit({ title = 'Pick a unit', onlyOwned = false, ids: restrict = null, multi = false, hint = '' } = {}) {
  return new Promise(resolve => {
    const q = h('input', { type: 'search', placeholder: 'Type a name…', style: 'flex:1' });
    const grid = h('ul', { class: 'grid' });
    const own = h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: onlyOwned ? true : null }), 'only units I own');
    const picked = new Set();
    const close = v => { overlay.remove(); resolve(v); };
    const done = multi ? h('button', { class: 'primary', onclick: () => close([...picked]) }, 'Done (0)') : null;
    const overlay = h('div', { class: 'overlay', onclick: e => { if (e.target === overlay) close(multi ? [...picked] : null); } },
      h('div', { class: 'modal' }, h('div', { class: 'row' }, h('b', {}, title), h('span', { class: 'grow' }), done, h('button', { class: 'icon', onclick: () => close(multi ? [...picked] : null) }, '✕')),
        hint ? h('p', { class: 'faint', style: 'margin:2px 0 6px' }, hint) : null,
        h('div', { class: 'row' }, q, restrict ? null : own), grid));
    // The list grows as you scroll (48 cards at a time) instead of stopping at the first page.
    const PAGE = 48; let ids = [], shown = 0;
    const card = id => { const li = h('li', { class: picked.has(id) ? 'picked' : '' }, h('a', { class: `card el-${unitElement(id)}`, href: '#', onclick: e => {
        e.preventDefault();
        if (!multi) return close(id);
        if (picked.has(id)) picked.delete(id); else picked.add(id);
        li.classList.toggle('picked', picked.has(id)); done.textContent = `Done (${picked.size})`;
      } },
      h('img', { src: unitIcon(id), alt: '', loading: 'lazy' }), stars(unitRarity(id)), h('span', { class: 'n' }, unitName(id))), teamBadge(id), COLL.owned.has(id) ? h('span', { class: 'tag green ownedtag' }, 'owned') : null); return li; };
    const more = () => { const next = ids.slice(shown, shown + PAGE); shown += next.length; grid.append(...next.map(card)); };
    const draw = () => {
      const only = !restrict && own.firstChild.checked;
      ids = searchUnits(q.value, { limit: 10000 }).ids;
      if (restrict) { const ok = new Set(restrict.map(Number)); ids = ids.filter(id => ok.has(id)); }
      if (only) ids = ids.filter(id => COLL.owned.has(id));
      grid.replaceChildren(); shown = 0; modal.scrollTop = 0; more();
    };
    const modal = overlay.firstChild;
    modal.addEventListener('scroll', () => { if (shown < ids.length && modal.scrollTop + modal.clientHeight > modal.scrollHeight - 300) more(); });
    let t = 0; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(draw, 100); }); own.addEventListener('change', draw);
    document.body.append(overlay); draw(); q.focus();
  });
}
