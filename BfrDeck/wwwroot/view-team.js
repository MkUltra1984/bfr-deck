'use strict';
// Team Builder: five units plus a friend lead, spheres, totals, the two leader skills side by side, a buff matrix
// (which skill of which unit brings each effect), gap suggestions from your own box, team codes to share, drag
// to reorder, make-leader, and the calculators.

const SKILL_KEYS = [['ls', 'LS'], ['es', 'ES'], ['bb', 'BB'], ['sbb', 'SBB'], ['ubb', 'UBB']];

function squadFix(s) {   // older saves lack friend / spheres
  if (!('friend' in s)) s.friend = null;
  if (!s.spheres) s.spheres = {};
  return s;
}
// Which skills of a unit match a role regex: ['LS','BB'] etc.
function roleSources(u, def) {
  if (!u) return [];
  return SKILL_KEYS.filter(([k]) => u[k] && u[k].desc && def.re.test(u[k].desc) && !(def.not && def.not.test(u[k].desc))).map(([, label]) => label);
}
function spheresOf(type) { return DATA.itemNames.filter(e => { const t = itemRow(e.id)[1]; return t === 3 || t === 6; }).map(e => e.id); }
// Sphere picker: search by name or effect text; resolves with an item id or null.
function pickSphere(title = 'Pick a sphere') {
  return new Promise(resolve => {
    const q = h('input', { type: 'search', placeholder: 'Sphere name or effect (e.g. "spark", "mitigation")…', style: 'flex:1' });
    const list = h('ul', { class: 'rows' });
    const close = v => { overlay.remove(); resolve(v); };
    const overlay = h('div', { class: 'overlay', onclick: e => { if (e.target === overlay) close(null); } },
      h('div', { class: 'modal' }, h('div', { class: 'row' }, h('b', {}, title), h('span', { class: 'grow' }), h('button', { class: 'icon', onclick: () => close(null) }, '✕')), h('div', { class: 'row' }, q), list));
    const all = spheresOf();
    const draw = () => {
      const nq = norm(q.value);
      const ids = all.filter(id => { const it = itemRow(id); return !nq || norm(it[0]).includes(nq) || norm(it[4] || '').includes(nq); }).slice(0, 60);
      list.replaceChildren(...ids.map(id => { const it = itemRow(id); return h('li', {}, h('a', { href: '#', class: 'row', style: 'align-items:flex-start;flex-wrap:nowrap', onclick: e => { e.preventDefault(); close(id); } },
        h('img', { src: itemIcon(id), width: 32, height: 32, alt: '', loading: 'lazy' }), h('span', {}, h('span', { class: 'q' }, it[0], h('span', { class: 'tag' }, it[1] === 6 ? 'LS sphere' : `★${it[2]}`)), h('span', { class: 'path' }, it[4] || '')))); }),
        ids.length ? null : h('li', { class: 'dim' }, 'No sphere matches.'));
    };
    let t = 0; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(draw, 100); });
    document.body.append(overlay); draw(); q.focus();
  });
}
// Team code: squad as a short string. "BFR1:" + 5 slot ids ("0" for empty) + "/" + friend + "/" + spheres per slot.
function teamCode(s) {
  const sp = s.units.map((_, i) => (s.spheres[i] || []).filter(Boolean).join('+')).join(',');
  return `BFR1:${s.units.map(u => u || 0).join('-')}/${s.friend || 0}/${sp}`;
}
function parseTeamCode(code) {
  const m = /BFR1:([\d-]+)\/(\d+)\/(.*)$/.exec((code || '').trim()); if (!m) return null;
  const units = m[1].split('-').slice(0, 5).map(x => Number(x) || null); while (units.length < 5) units.push(null);
  const spheres = {}; m[3].split(',').forEach((x, i) => { const ids = x.split('+').map(Number).filter(Boolean); if (ids.length) spheres[i] = ids.slice(0, 2); });
  return { units, friend: Number(m[2]) || null, spheres };
}

function renderTeam(view) {
  const si = COLL.active; const s = squadFix(COLL.squad());
  const name = h('input', { value: s.name, style: 'width:140px' }); name.addEventListener('change', () => { s.name = name.value || 'Squad'; COLL.save(); renderTeam(view); });
  const tabs = h('div', { class: 'row' }, COLL.squads.map((sq, i) => h('button', { class: i === si ? 'chip on' : 'chip', style: `--c:${SQUAD_COLORS[i % SQUAD_COLORS.length]}`, onclick: () => { COLL.active = i; COLL.save(); renderTeam(view); } }, sq.name)),
    h('button', { class: 'chip', onclick: () => { COLL.addSquad(); renderTeam(view); } }, '+ squad'), h('span', { class: 'grow' }), name,
    COLL.squads.length > 1 ? h('button', { class: 'icon', title: 'Delete this squad', onclick: () => { if (confirm(`Delete ${s.name}?`)) { COLL.removeSquad(si); renderTeam(view); } } }, '🗑') : null);

  // ---- slots (drag to reorder, make leader, swap, remove, spheres) + friend lead
  const setSlot = (slot, id) => { s.units[slot] = id; COLL.save(); renderTeam(view); };
  const move = (from, to) => { if (from === to) return; const u = s.units.splice(from, 1)[0]; s.units.splice(to, 0, u); const sp = s.spheres[from]; const arr = Object.entries(s.spheres).map(([k, v]) => [Number(k), v]).sort((a, b) => a[0] - b[0]); const ordered = s.units.map((_, i) => null); for (const [k, v] of arr) ordered[k] = v; const moved = ordered.splice(from, 1)[0]; ordered.splice(to, 0, moved); s.spheres = {}; ordered.forEach((v, i) => { if (v) s.spheres[i] = v; }); COLL.save(); renderTeam(view); };
  let dragFrom = null;
  const slotCell = (id, slot) => {
    const cell = h('div', { class: id ? `slot el-${unitElement(id)}` : 'slot empty', draggable: id ? true : null,
      ondragstart: e => { dragFrom = slot; e.dataTransfer.effectAllowed = 'move'; cell.classList.add('dragging'); },
      ondragend: () => cell.classList.remove('dragging'),
      ondragover: e => { e.preventDefault(); cell.classList.add('over'); }, ondragleave: () => cell.classList.remove('over'),
      ondrop: e => { e.preventDefault(); cell.classList.remove('over'); if (dragFrom != null) move(dragFrom, slot); dragFrom = null; } });
    // Every card has the same five rows (header, portrait, name, spheres, actions) so the six line up.
    cell.append(h('div', { class: 'slothead' }, slot === 0 ? h('span', { class: 'gold' }, '★ Leader') : `Slot ${slot + 1}`));
    if (id) {
      const m = unitMeta(id) || [];
      const sphereBtn = k => { const sid = (s.spheres[slot] || [])[k];
        return h('button', { class: sid ? 'sph on' : 'sph', title: sid ? `${itemRow(sid)[0]}: ${itemRow(sid)[4] || ''}\nClick to change · right-click to clear` : `Sphere ${k + 1}${k === 1 ? ' (second slot needs a Sphere Frog in game)' : ''}: click to pick`,
          onclick: async () => { const p = await pickSphere(`Sphere ${k + 1} for ${unitName(id)}`); if (p) { const arr = s.spheres[slot] || [null, null]; arr[k] = p; s.spheres[slot] = arr; COLL.save(); renderTeam(view); } },
          oncontextmenu: e => { e.preventDefault(); const arr = s.spheres[slot] || [null, null]; arr[k] = null; s.spheres[slot] = arr; COLL.save(); renderTeam(view); } },
          sid ? h('img', { src: itemIcon(sid), alt: '', width: 22, height: 22 }) : h('span', { class: 'plus' }, '+')); };
      cell.append(h('a', { class: 'portrait', href: `#/units/${id}`, title: `${unitName(id)} · cost ${m[0] ?? '?'} · ${rarityName(Math.min(unitRarity(id), 8))}` }, h('img', { src: unitIcon(id), alt: '' })),
        h('div', { class: 'n' }, unitName(id)),
        h('div', { class: 'spheres' }, h('span', { class: 'faint' }, 'spheres'), sphereBtn(0), sphereBtn(1),
          // fills the empty sphere slots with the deck's two suggestions for this unit (spheres.js)
          h('button', { class: 'sph sug', title: 'Suggest spheres for this unit (fills the empty slots)', 'aria-label': 'Suggest spheres', onclick: async () => {
            const r = suggestSpheres(id, await unitDetail(id)), arr = s.spheres[slot] || [null, null], free = r.picks.map(p => p.sphere.id).filter(x => !arr.includes(x));
            if (!free.length || (arr[0] && arr[1])) { toast(arr[0] && arr[1] ? 'Both slots are filled. Right-click a sphere to clear it.' : 'No suggestion for this unit'); return; }
            for (let k = 0; k < 2; k++) if (!arr[k] && free.length) arr[k] = free.shift();
            s.spheres[slot] = arr; COLL.save(); renderTeam(view); toast(`Suggested: ${arr.filter(Boolean).map(x => itemRow(x)[0]).join(' + ')}`); } }, '✦')),
        h('div', { class: 'actions' },
          h('button', { class: 'act', disabled: slot === 0 ? true : null, title: slot === 0 ? 'This unit is the leader' : 'Make leader', onclick: () => move(slot, 0) }, '★'),
          h('button', { class: 'act', title: 'Swap for another unit', onclick: async () => { const p = await pickUnit({ title: `Slot ${slot + 1}` }); if (p) setSlot(slot, p); } }, '⇄'),
          h('button', { class: 'act', title: 'Remove from squad', onclick: () => setSlot(slot, null) }, '✕')));
    } else cell.append(h('button', { class: 'portrait add', title: 'Pick a unit', onclick: async () => { const p = await pickUnit({ title: `Slot ${slot + 1}` }); if (p) setSlot(slot, p); } }, '+'), h('div', { class: 'n dim' }, 'empty'), h('div', { class: 'spheres' }), h('div', { class: 'actions' }));
    return cell;
  };
  const friendCell = () => {
    const id = s.friend; const cell = h('div', { class: id ? `slot friend el-${unitElement(id)}` : 'slot friend empty' });
    cell.append(h('div', { class: 'slothead' }, 'Friend lead'));
    if (id) cell.append(h('a', { class: 'portrait', href: `#/units/${id}`, title: unitName(id) }, h('img', { src: unitIcon(id), alt: '' })), h('div', { class: 'n' }, unitName(id)), h('div', { class: 'spheres' }, h('span', { class: 'faint' }, 'leader skill only')),
      h('div', { class: 'actions' }, h('button', { class: 'act', disabled: true }, '★'), h('button', { class: 'act', title: 'Change friend lead', onclick: async () => { const p = await pickUnit({ title: 'Friend lead' }); if (p) { s.friend = p; COLL.save(); renderTeam(view); } } }, '⇄'), h('button', { class: 'act', title: 'Remove friend lead', onclick: () => { s.friend = null; COLL.save(); renderTeam(view); } }, '✕')));
    else cell.append(h('button', { class: 'portrait add', title: 'Pick a friend lead', onclick: async () => { const p = await pickUnit({ title: 'Friend lead' }); if (p) { s.friend = p; COLL.save(); renderTeam(view); } } }, '+'), h('div', { class: 'n dim' }, 'friend'), h('div', { class: 'spheres' }), h('div', { class: 'actions' }));
    return cell;
  };
  const slots = h('div', { class: 'slots six' }, s.units.map(slotCell), friendCell());
  const help = h('p', { class: 'faint', style: 'margin:0 0 8px' }, 'Drag a card onto another to reorder. ★ makes a unit the leader, ⇄ swaps it, ✕ removes it. The two circles are its sphere slots, ✦ fills them with a suggestion. The friend lead only contributes its leader skill.');

  // ---- analysis (async): totals, leader skills, buff matrix, gaps + suggestions
  const analysis = h('div', { class: 'box' }, h('span', { class: 'dim' }, 'Reading skills…'));
  (async () => {
    const ids = s.units.filter(Boolean); const all = [...ids, ...(s.friend ? [s.friend] : [])];
    const details = {}; await Promise.all([...new Set(all)].map(async id => { details[id] = await unitDetail(id); }));
    const withImps = store.get('teamImps', true);
    let cost = 0, hp = 0, atk = 0, def = 0, rec = 0, hits = 0; const elements = new Set();
    for (const id of ids) { const m = unitMeta(id); if (!m) continue; cost += m[0]; const imp = withImps && details[id] && details[id].imps ? details[id].imps : [0, 0, 0, 0]; hp += m[5] + imp[0]; atk += m[6] + imp[1]; def += m[7] + imp[2]; rec += m[8] + imp[3]; elements.add(unitElement(id)); hits += unitRoles(details[id]).hits; }
    const stat = (k, v) => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, typeof v === 'number' ? fmt(v) : v));
    const totals = h('div', { class: 'stats six' }, stat('Cost', cost), stat('HP', hp), stat('ATK', atk), stat('DEF', def), stat('REC', rec), stat('Hits (BB/SBB)', hits));
    const impsToggle = h('label', { class: 'row faint', style: 'gap:4px' }, h('input', { type: 'checkbox', checked: withImps ? true : null, onchange: e => { store.set('teamImps', e.target.checked); renderTeam(view); } }), 'count max imps');
    const lsBox = (label, id) => { const d = id && details[id]; return h('div', { class: 'lsbox' }, h('div', { class: 'faint' }, label), id ? [h('b', {}, d && d.ls ? d.ls.name : unitName(id)), h('p', { class: 'dim', style: 'margin:2px 0 0' }, d && d.ls ? d.ls.desc : 'No leader skill data.')] : h('span', { class: 'dim' }, label === 'Leader skill' ? 'Put a unit in slot 1.' : 'Pick a friend lead to see the combined effect.')); };
    // Buff matrix: ROLE_DEFS × units (+ friend), cell = skill labels that bring it
    const cols = [...s.units.map((id, i) => ({ id, label: id ? shortUnitName(id) : `Slot ${i + 1}`, friend: false })), { id: s.friend, label: s.friend ? shortUnitName(s.friend) : 'Friend', friend: true }];
    const matrix = h('table', { class: 'matrix' }, h('tr', {}, h('th', {}, 'Effect'), cols.map(c => h('th', { class: c.friend ? 'friendcol' : '' }, c.id ? h('img', { src: unitIcon(c.id), alt: c.label, title: unitName(c.id), width: 26, height: 26 }) : h('span', { class: 'faint' }, '—')))),
      ROLE_DEFS.map(d => { const cells = cols.map(c => c.id ? roleSources(details[c.id], d) : []); const any = cells.some(x => x.length);
        return h('tr', { class: any ? '' : 'missing' }, h('td', {}, d.label, any ? null : h('span', { class: 'tag red' }, 'not yet covered')), cells.map((x, i) => h('td', { class: cols[i].friend ? 'friendcol' : '' }, x.length ? x.map(l => h('span', { class: `sk ${l.toLowerCase()}` }, l)) : ''))); }));
    // Gaps and suggestions from the box
    const covered = new Set(); for (const d of ROLE_DEFS) for (const c of cols) if (c.id && roleSources(details[c.id], d).length) covered.add(d.key);
    const gaps = TEAM_CHECK.filter(([k]) => !covered.has(k));
    const sugg = h('div', {});
    if (gaps.length && COLL.owned.size) {
      sugg.append(h('h3', {}, 'Fill the gaps from your box'), h('p', { class: 'faint' }, 'Best owned units for each effect not yet covered, by the tier-list score. Click one to put it in the first empty slot (or replace the weakest non-leader).'));
      const roles = store.get('roleCache2', { v: 1, r: {} }).r;
      const owned = [...COLL.owned].filter(id => !all.includes(id));
      // make sure the owned units' roles are known (cached through the disk cache)
      const todo = owned.filter(id => !roles[id]).sort((a, b) => statScore(b) - statScore(a)).slice(0, 120);
      await Promise.all(todo.map(async id => { const u = await unitDetail(id); const r = u ? unitRoles(u) : { roles: new Set(), hits: 0 }; roles[id] = { roles: [...r.roles], hits: r.hits }; }));
      if (todo.length) store.set('roleCache2', { v: 1, r: roles });
      const place = id => { let slot = s.units.indexOf(null); if (slot < 0) { let worst = -1, ws = 9; s.units.forEach((u, i) => { if (i && statScore(u) < ws) { ws = statScore(u); worst = i; } }); slot = worst; } if (slot >= 0) setSlot(slot, id); };
      for (const [k, label] of gaps) {
        const cands = owned.filter(id => roles[id] && roles[id].roles.includes(k)).sort((a, b) => fullScore(b) - fullScore(a)).slice(0, 4);
        sugg.append(h('div', { class: 'gaprow' }, h('span', { class: 'gaplabel' }, label), cands.length ? h('span', { class: 'row', style: 'gap:6px' }, cands.map(id => h('button', { class: 'cand', title: `${unitName(id)} · add to squad`, onclick: () => place(id) }, h('img', { src: unitIcon(id), alt: '', width: 30, height: 30 }), shortUnitName(id)))) : h('span', { class: 'faint' }, 'none in your box')));
      }
    } else if (gaps.length) sugg.append(h('p', { class: 'faint' }, `Missing: ${gaps.map(g => g[1]).join('; ')}. Sign in or mark your units and the deck suggests who could fill these.`));
    analysis.replaceChildren(
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', {}, 'Totals'), h('span', { class: 'faint' }, `${elements.size} element${elements.size === 1 ? '' : 's'}: ${[...elements].filter(Boolean).map(e => ELEMENTS[e]).join(', ') || '—'}`), impsToggle), totals,
      h('div', { class: 'cols', style: 'margin-top:8px' }, lsBox('Leader skill', s.units[0]), lsBox('Friend leader skill', s.friend)),
      h('h3', {}, 'Squad check'),
      h('div', { class: 'sqcheck' }, TEAM_GROUPS.map(([name, hint, keys]) => { const n = keys.filter(k => covered.has(k)).length;
        return h('div', { class: 'sqg' }, h('div', { class: 'sqh' }, h('b', {}, name), h('span', { class: 'faint' }, `${n} of ${keys.length}${hint ? ' · ' + hint : ''}`)),
          h('div', { class: 'row' }, keys.map(k => h('span', { class: covered.has(k) ? 'chip static on' : 'chip static off' }, (covered.has(k) ? '✓ ' : '✗ ') + ROLE_DEFS.find(d => d.key === k).label)))); })),
      h('p', { class: 'faint', style: 'margin:4px 0 0' }, 'Squad structure after the community guide "Brave Frontier Unit Viability & Squad Building" by WhiteHikari. No squad fits every fight.'),
      h('h3', {}, 'Who brings what'), h('p', { class: 'faint', style: 'margin-top:0' }, 'LS/ES count in the squad only for the leader and the friend; BB, SBB and UBB count for everyone. Read from the skill text.'), matrix, sugg);
  })();

  // ---- share, export/import
  const code = h('input', { readonly: true, value: teamCode(s), style: 'flex:1;font-family:ui-monospace,Consolas,monospace;font-size:.8em' });
  const share = h('div', { class: 'row', style: 'margin-top:8px' }, h('span', { class: 'faint' }, 'Team code'), code,
    h('button', { class: 'icon', onclick: () => { navigator.clipboard.writeText(code.value); toast('Team code copied'); } }, 'copy'),
    h('button', { class: 'icon', onclick: async () => { const t = prompt('Paste a team code (BFR1:…)'); const p = parseTeamCode(t); if (!p) { if (t != null) toast('Not a team code'); return; } Object.assign(s, p); COLL.save(); renderTeam(view); toast('Team imported'); } }, 'paste a code'),
    h('span', { class: 'grow' }),
    h('button', { class: 'icon', onclick: () => { navigator.clipboard.writeText(COLL.export()); toast('Collection copied to clipboard'); } }, 'export all'),
    h('button', { class: 'icon', onclick: async () => { try { COLL.import(await navigator.clipboard.readText()); toast('Imported'); renderTeam(view); } catch (e) { toast('Clipboard has no valid export'); } } }, 'import all'));
  view.replaceChildren(h('div', { class: 'teambuilder' }, tabs, slots, help, s.live ? msSquadBox(s) : deckEstimate(analysis, 'this squad was planned here and is not in your account'), share,
    h('details', {}, h('summary', {}, 'Calculators: evolution, frogs, SP, imps'), h('div', { class: 'calc' }, h('h2', {}, 'Evolution'), evoPlanner(), h('h2', {}, 'BB / SBB levels'), bbPlanner(), h('h2', {}, 'SP (Omni)'), spPlanner(), h('h2', {}, 'Imps'), impPlanner()))));
}
