'use strict';
// Plan: calculators built on this server's rules (evolution, BB/SBB frogs, SP, imps).

function renderPlan(view) {
  view.replaceChildren(h('div', {},
    h('h2', {}, 'Evolution'), evoPlanner(),
    h('h2', {}, 'BB / SBB levels'), bbPlanner(),
    h('h2', {}, 'SP (Omni)'), spPlanner(),
    h('h2', {}, 'Imps'), impPlanner()));
}

function numInput(id, value, min, max, step = 1) { return h('input', { type: 'number', id, value, min, max, step }); }
function field(label, input) { return h('div', { class: 'field' }, h('label', { for: input.id }, label), input); }

function evoPlanner() {
  const el = h('select', { id: 'evo-el' }, [1, 2, 3, 4, 5, 6].map(e => h('option', { value: e }, ELEMENTS[e])));
  const from = h('select', { id: 'evo-from' }, [2, 3, 4, 5, 6, 7].map(r => h('option', { value: r, selected: r === 6 ? true : null }, rarityName(r))));
  const to = h('select', { id: 'evo-to' }, [3, 4, 5, 6, 7, 8].map(r => h('option', { value: r, selected: r === 8 ? true : null }, rarityName(r))));
  const special = h('select', { id: 'evo-sp' }, h('option', { value: '' }, 'Normal'), h('option', { value: 'Atro' }, 'Atro / Magress (50,000 Zel at 2★→3★)'));
  const out = h('div', { class: 'result' });
  const box = h('div', { class: 'box' }, h('p', { class: 'faint' }, 'Starter-line recipes from the Discord guide. Other units follow the same ladder but may ask for Mimics or extra items: tap Evolve in game to see the exact list.'),
    h('div', { class: 'cols' }, field('Element', el), field('Special', special), field('From', from), field('To', to)), out);
  const draw = () => {
    const e = ELEMENTS[Number(el.value)]; const a = Number(from.value); const b = Number(to.value);
    if (b <= a) { out.replaceChildren(h('span', { class: 'dim' }, 'Pick a higher target rarity.')); return; }
    let zel = 0, karma = 0; const mats = new Map(); const steps = [];
    for (let r = a; r < b; r++) {
      let z = RULES.evoZel[r] || 0; if (r === 2 && special.value) z = RULES.evoSpecialZel.Atro;
      zel += z; karma += RULES.evoKarma[r] || 0;
      const list = (RULES.evoMaterials[r] || []).map(m => m.replace('{E}', e));
      for (const m of list) mats.set(m, (mats.get(m) || 0) + 1);
      steps.push(h('li', {}, h('b', {}, `${rarityName(r)} → ${rarityName(r + 1)}`), h('span', { class: 'faint' }, ` (unit must be Lv ${RULES.maxLevel[r]}) · ${fmt(z)} Zel${RULES.evoKarma[r] ? ` + ${fmt(RULES.evoKarma[r])} Karma` : ''}`), h('div', { class: 'dim' }, list.join(', '))));
    }
    const merit = [...mats].reduce((s, [m, c]) => s + c * meritFor(m), 0);
    out.replaceChildren(h('div', { class: 'kv' }, h('span', {}, 'Zel'), h('b', { class: 'num' }, fmt(zel)), h('span', {}, 'Karma'), h('b', { class: 'num' }, fmt(karma)),
      h('span', {}, 'If bought with Merit'), h('b', { class: 'num' }, `${fmt(merit)} Merit`)),
      h('h3', {}, 'Materials total'), h('ul', {}, [...mats].sort((x, y) => y[1] - x[1]).map(([m, c]) => { const id = DATA.items ? findItemByName(m) : null; const uid = DATA.units ? findUnitByName(m) : null;
        return h('li', {}, `${c}× `, id ? h('a', { href: `#/items/${id}` }, m) : uid ? h('a', { href: `#/units/${uid}` }, m) : m, meritFor(m) ? h('span', { class: 'faint' }, ` · ${fmt(meritFor(m))} Merit each`) : null); })),
      h('h3', {}, 'Steps'), h('ol', {}, steps),
      h('p', { class: 'faint' }, 'Evolving halves BB and SBB levels and keeps imps, 2nd sphere slot, spheres and SP. Favorited materials cannot be used.'));
  };
  for (const c of [el, from, to, special]) c.addEventListener('change', draw);
  draw();
  return box;
}
function meritFor(name) {
  if (/Miracle Totem/.test(name)) return 1000;
  if (/Mecha God/.test(name)) return 1000;
  if (/ Totem$/.test(name)) return 500;
  if (/Legend Stone/.test(name)) return 4000;
  if (/^Metal Mimic/.test(name)) return 500; if (/^Dragon Mimic/.test(name)) return 300; if (/^Bat Mimic/.test(name)) return 100; if (/^Mimic/.test(name)) return 50;
  return 0;
}

function bbPlanner() {
  const bb = numInput('bb-cur', 1, 1, 10), sbb = numInput('sbb-cur', 0, 0, 10);
  const tbb = numInput('bb-to', 10, 1, 10), tsbb = numInput('sbb-to', 10, 0, 10);
  const evolve = h('input', { type: 'checkbox', id: 'bb-evo' });
  const out = h('div', { class: 'result' });
  const box = h('div', { class: 'box' }, h('p', { class: 'faint' }, 'Only frogs raise BB here. Levels go into BB first; at BB 10 the SBB unlocks and the rest goes into SBB.'),
    h('div', { class: 'cols' }, field('BB now', bb), field('SBB now', sbb), field('BB target', tbb), field('SBB target', tsbb)),
    h('label', { class: 'row' }, evolve, 'Unit still has one evolution left (levels will be halved)'), out);
  const draw = () => {
    let cb = Number(bb.value), cs = Number(sbb.value);
    const warn = evolve.checked;
    if (warn) { cb = Math.max(1, Math.floor(cb / 2)); cs = Math.floor(cs / 2); }
    const need = Math.max(0, Number(tbb.value) - cb) + Math.max(0, Number(tsbb.value) - (cb >= 10 || Number(tbb.value) >= 10 ? cs : cs));
    const srcs = RULES.frogs.map(f => ({ name: f.name, value: f.bb, merit: f.merit }));
    const best = cheapestMerit(need, srcs);
    out.replaceChildren(h('div', { class: 'kv' }, h('span', {}, 'Levels needed'), h('b', { class: 'num' }, String(need)),
      h('span', {}, 'Cheapest with Merit'), h('b', { class: 'num' }, need ? `${fmt(best.merit)} Merit` : '0'),
      h('span', {}, 'Buy'), h('span', {}, need ? [...best.counts].map(([n, c]) => `${c}× ${n}`).join(', ') : '-')),
      warn ? h('p', { class: 'red' }, `After the evolution you start from BB ${cb} / SBB ${cs}. Feed frogs after the final evolution.`) : null,
      h('p', { class: 'faint' }, 'Burst Frog +1 (1,000) · Lawson Frog +2 (login/events) · Burst Emperor +5 (4,000) · Burst Queen +20 (10,000). Calendar days 14 and 22 give frogs.'));
  };
  for (const c of [bb, sbb, tbb, tsbb, evolve]) c.addEventListener('input', draw);
  draw();
  return box;
}

function spPlanner() {
  const cur = numInput('sp-cur', 0, 0, 100), target = numInput('sp-to', 100, 0, 100);
  const dupes = numInput('sp-dupes', 0, 0, 20), slot = h('input', { type: 'checkbox', id: 'sp-slot' });
  const out = h('div', { class: 'result' });
  const box = h('div', { class: 'box' }, h('p', { class: 'faint' }, 'Unlocks at Lv 150 with SBB 10. Max 100 SP. Reset costs 1 gem and refunds everything.'),
    h('div', { class: 'cols' }, field('SP now', cur), field('Target', target), field('Spare dupes', dupes)),
    h('label', { class: 'row' }, slot, '2nd sphere slot already open (Sphere Frog then gives 10 SP)'), out);
  const draw = () => {
    const fromDupes = Math.min(Number(dupes.value) * 5, Math.max(0, Number(target.value) - Number(cur.value)));
    const need = Math.max(0, Number(target.value) - Number(cur.value) - fromDupes);
    const srcs = [...RULES.frogs.map(f => ({ name: f.name, value: f.sp, merit: f.merit })), { name: 'Omni Frog', value: 30, merit: 12000 }];
    if (slot.checked) srcs.push({ name: 'Sphere Frog', value: 10, merit: 8000 });
    const best = cheapestMerit(need, srcs);
    out.replaceChildren(h('div', { class: 'kv' }, h('span', {}, 'From dupes'), h('b', { class: 'num' }, `${fromDupes} SP`), h('span', {}, 'Still needed'), h('b', { class: 'num' }, `${need} SP`),
      h('span', {}, 'Cheapest with Merit'), h('b', { class: 'num' }, need ? `${fmt(best.merit)} Merit` : '0'),
      h('span', {}, 'Buy'), h('span', {}, need ? [...best.counts].map(([n, c]) => `${c}× ${n}`).join(', ') : '-')),
      h('p', { class: 'faint' }, 'Omni Frog 30 SP (12,000) is the best Merit rate, then Burst Queen 20 (10,000). Normal units give 0 SP on this server.'));
  };
  for (const c of [cur, target, dupes, slot]) c.addEventListener('input', draw);
  draw();
  return box;
}

function impPlanner() {
  const rar = h('select', { id: 'imp-r' }, h('option', { value: 7 }, '7★ caps (1100 / 440)'), h('option', { value: 8, selected: true }, 'Omni caps (1500 / 600)'));
  const ins = { hp: numInput('imp-hp', 0, 0, 2000, 10), atk: numInput('imp-atk', 0, 0, 1000, 10), def: numInput('imp-def', 0, 0, 1000, 10), rec: numInput('imp-rec', 0, 0, 1000, 10) };
  const out = h('div', { class: 'result' });
  const box = h('div', { class: 'box' }, h('p', { class: 'faint' }, 'Enter the bonus the unit already has (View Unit shows it). Caps differ per unit; the unit page lists exact ones.'),
    field('Rarity', rar), h('div', { class: 'cols' }, field('HP bonus now', ins.hp), field('ATK bonus now', ins.atk), field('DEF bonus now', ins.def), field('REC bonus now', ins.rec)), out);
  const draw = () => {
    const caps = RULES.impCaps[Number(rar.value)];
    const rows = []; let merit = 0;
    for (const [stat, imp] of [['hp', RULES.imps[3]], ['atk', RULES.imps[0]], ['def', RULES.imps[1]], ['rec', RULES.imps[2]]]) {
      const left = Math.max(0, caps[stat] - Number(ins[stat].value));
      const n = Math.ceil(left / imp.val); merit += n * 500;
      rows.push(h('tr', {}, h('td', {}, stat.toUpperCase()), h('td', { class: 'r' }, fmt(left)), h('td', { class: 'r' }, n), h('td', { class: 'dim' }, imp.name)));
    }
    const artons = Math.ceil(Math.max(0, caps.hp - Number(ins.hp.value)) / RULES.arton.hp);
    out.replaceChildren(h('table', {}, h('tr', {}, h('th', {}, 'Stat'), h('th', { class: 'r' }, 'To cap'), h('th', { class: 'r' }, 'Imps'), h('th', {}, 'Which')), rows),
      h('p', {}, h('b', {}, `${fmt(merit)} Merit`), h('span', { class: 'faint' }, ' with basic imps at 500 each. '),
        `Arton (HP 150, others 60, 4,000 Merit): ${artons} would cap HP, giving +${artons * 60} to each other stat.`),
      h('p', { class: 'faint' }, 'Imps: Monday Vortex (Souls Training Ground), Merit Shop, Garden of Imps via Imp Keys (3/day).'));
  };
  for (const c of [rar, ...Object.values(ins)]) c.addEventListener('input', draw);
  draw();
  return box;
}
