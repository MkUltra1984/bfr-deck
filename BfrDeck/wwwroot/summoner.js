'use strict';
// My Summoner: the player's own account, read live from bfrevive.net/my-summoner through the host (Summoner.cs).
// EXPERIMENTAL, own account only; not part of the public release until the BFR team agrees to it.
//   /api/ms/state                      { signedIn, name, saved }
//   POST /api/ms/login                 { email, password, remember } -> { ok, code, message, state }
//   POST /api/ms/logout[?forget=1]
//   /api/ms/<part>[?fresh=1]           home | profile | box | squads | evolutions | challenges | history | next,
//                                      each the service's own reply { ok, data, error }
// What it feeds: the Home panel (level, energy, currencies, main squad verdict, what next), the box (owned units and
// duplicate counts replace the scan while signed in) and "Your copies" on a unit page (level, BB, imps, spheres, SP).

const MS = { state: null, home: null, profile: null, box: null, squads: null, at: 0, error: '', busy: false, byUnit: new Map() };

async function msCall(path, opts) {
  const res = await fetch(`${API}/api/ms/${path}`, opts);
  let body = null; try { body = await res.json(); } catch { }
  if (!res.ok) { const e = new Error((body && (body.error && (body.error.message || body.error)) ) || `My Summoner answered ${res.status}`); e.status = res.status; throw e; }
  return body;
}
const msPart = async (part, fresh) => { const r = await msCall(part + (fresh ? '?fresh=1' : '')); return r && r.data !== undefined ? r.data : r; };

// Reads the account and puts it where the pages look: owned units and counts into the collection, copies per unit here.
async function msLoad(fresh) {
  if (MS.busy) return; MS.busy = true; MS.error = '';
  try {
    MS.state = await msCall('state');
    if (!MS.state.signedIn && !MS.state.saved) { MS.home = MS.profile = MS.box = null; return; }
    const [home, profile, box, squads] = await Promise.all([msPart('home', fresh), msPart('profile', fresh), msPart('box', fresh), msPart('squads', fresh)]);
    MS.home = home; MS.profile = profile; MS.box = box; MS.squads = squads; MS.at = Date.now() / 1000;
    MS.state = await msCall('state');
    msApply();
  } catch (e) {
    MS.error = e.status === 401 ? '' : e.message;
    if (e.status === 401) { MS.home = MS.profile = MS.box = MS.squads = null; try { MS.state = await msCall('state'); } catch { } }
  } finally { MS.busy = false; }
}
function msApply() {
  const units = (MS.profile && MS.profile.units) || [];
  // tier and power come with the compact box (columns named by the service)
  const extra = new Map();
  if (MS.box && MS.box.columns && MS.box.rows) { const c = MS.box.columns, iu = c.indexOf('user_unit_id'), ip = c.indexOf('power'), it = c.indexOf('tier'); for (const r of MS.box.rows) extra.set(r[iu], { power: ip >= 0 ? r[ip] : null, tier: it >= 0 ? r[it] : null }); }
  MS.items = new Map(((MS.profile && MS.profile.items) || []).map(i => [Number(i.item_id), i]));
  MS.byUnit = new Map(); const counts = {};
  for (const u of units) { const id = Number(u.unit_id); if (!id) continue; counts[id] = (counts[id] || 0) + 1; if (!MS.byUnit.has(id)) MS.byUnit.set(id, []); MS.byUnit.get(id).push({ ...u, ...(extra.get(u.user_unit_id) || {}) }); }
  if (!units.length) return;
  // the first time the live box replaces the scanned one, the scanned box is kept so signing out can bring it back
  if (!store.get('ownedBeforeLive', null)) store.set('ownedBeforeLive', { owned: [...COLL.owned], counts: store.get('unitCounts', {}), total: store.get('boxTotal', 0), at: store.get('boxScannedAt', 0) });
  COLL.owned = new Set(Object.keys(counts).map(Number)); COLL.save();
  store.set('unitCounts', counts); store.set('boxTotal', units.length); store.set('boxScannedAt', Math.floor(MS.at));
  msSquads();
}
// The account's real squads, shown beside the ones planned in the deck. Only squads that are really set up come in
// (two or more members, or the active one); they are named "Live ...", carry the service's verdict in `live`, and
// are read again on every refresh, so an edit to one of them is a what-if that the next refresh undoes.
function msSquads() {
  const S = MS.squads; if (!S || !Array.isArray(S.squads)) return;
  const was = COLL.squad(), wasKey = was && (was.live ? 'L' + was.live.key : 'P' + COLL.squads.filter(s => !s.live).indexOf(was));
  const live = S.squads.filter(s => (s.members || []).length >= 2 || (s.deck_type === 1 && s.number === S.active && (s.members || []).length)).map(s => {
    const m = [...s.members].sort((a, b) => (b.leader ? 1 : 0) - (a.leader ? 1 : 0)).map(x => Number(x.unit_id) || null).slice(0, 5); while (m.length < 5) m.push(null);
    return { name: 'Live ' + String(s.label || `${s.kind} ${s.number}`).replace(/ squad /i, ' '), units: m, friend: null, spheres: {},
      live: { key: `${s.deck_type}.${s.number}`, kind: s.kind_param, number: s.number, line: s.line || '', flags: s.red_flags || [], cost: s.cost, cap: s.cap, over: !!s.over_cap, power: s.power && s.power.total, active: s.deck_type === 1 && s.number === S.active } };
  });
  const planned = COLL.squads.filter(s => !s.live);
  COLL.squads = [...live, ...(planned.length ? planned : live.length ? [] : [{ name: 'Squad 1', units: [null, null, null, null, null], friend: null, spheres: {} }])];
  // the selected squad stays selected; the very first time, the account's active squad is shown
  let idx = wasKey ? COLL.squads.findIndex(s => (s.live ? 'L' + s.live.key : 'P' + planned.indexOf(s)) === wasKey) : -1;
  if (!store.get('liveSquadsSeen', false)) { const a = COLL.squads.findIndex(s => s.live && s.live.active); if (a >= 0) idx = a; store.set('liveSquadsSeen', true); }
  COLL.active = idx >= 0 ? idx : 0; COLL.save();
}
// The service's verdict on a live squad, for the Home tile and the Team Builder.
function liveVerdict(s) {
  if (!s || !s.live) return null;
  const flags = s.live.flags, help = h('div', { class: 'flaghelp', hidden: '' }, flags.map(f => h('p', {}, h('b', {}, (MS_FLAGS[f] || f.replace(/_/g, ' ')) + ': '), MS_FLAG_HELP[f] || '')));
  const more = flags.length ? h('button', { class: 'chip', 'aria-expanded': 'false', onclick: e => { help.hidden = !help.hidden; e.currentTarget.setAttribute('aria-expanded', String(!help.hidden)); } }, flags.length > 2 ? `+${flags.length - 2} more · what does this mean?` : 'what does this mean?') : null;
  return h('div', { class: 'livesq' }, h('span', { class: 'tag gold' }, 'from your account'), ' ', s.live.line, ' ', h('span', { class: 'faint' }, `cost ${s.live.cost} / ${s.live.cap}`),
    flags.length ? h('div', {}, flags.slice(0, 2).map(f => h('span', { class: 'tag red' }, MS_FLAGS[f] || f.replace(/_/g, ' '))), more) : null, help);
}
function msRestoreScan() {
  const b = store.get('ownedBeforeLive', null); if (!b) return;
  COLL.owned = new Set(b.owned.map(Number)); COLL.squads = COLL.squads.filter(s => !s.live); if (!COLL.squads.length) COLL.squads = [{ name: 'Squad 1', units: [null, null, null, null, null], friend: null, spheres: {} }]; COLL.active = 0; localStorage.removeItem('liveSquadsSeen'); COLL.save(); store.set('unitCounts', b.counts || {}); store.set('boxTotal', b.total || 0); store.set('boxScannedAt', b.at || 0);
  localStorage.removeItem('ownedBeforeLive');
}

// ------------------------------------------------------------------ sign in
function msSignIn(onDone) {
  const email = h('input', { type: 'email', placeholder: 'Email of your game account', autocomplete: 'username', style: 'width:100%' });
  const pass = h('input', { type: 'password', placeholder: 'Password', autocomplete: 'current-password', style: 'width:100%' });
  const remember = h('input', { type: 'checkbox' });
  const msg = h('p', { class: 'red', style: 'min-height:1.2em;margin:6px 0' });
  const go = h('button', { class: 'primary' }, 'Sign in');
  const close = () => overlay.remove();
  const submit = async () => {
    if (!email.value.trim() || !pass.value) { msg.textContent = 'Enter your email and password.'; return; }
    go.disabled = true; msg.textContent = '';
    try {
      const r = await msCall('login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.value.trim(), password: pass.value, remember: remember.checked }) });
      pass.value = '';
      if (!r.ok) { msg.textContent = r.message || 'Sign-in failed.'; go.disabled = false; return; }
      close(); await msLoad(true); if (onDone) onDone();
    } catch (e) { msg.textContent = e.message; go.disabled = false; }
  };
  for (const el of [email, pass]) el.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  go.addEventListener('click', submit);
  const overlay = h('div', { class: 'overlay', onclick: e => { if (e.target === overlay) close(); } },
    h('div', { class: 'modal msmodal' }, h('div', { class: 'row' }, h('b', {}, 'Sign in to My Summoner'), h('span', { class: 'grow' }), h('button', { class: 'icon', onclick: close }, '✕')),
      h('p', { class: 'faint' }, 'The same login as the game and bfrevive.net/my-summoner. It is sent only to bfrevive.net. BFR Deck reads your account and never changes it.'),
      email, h('div', { style: 'height:6px' }), pass,
      h('label', { class: 'row', style: 'margin-top:8px' }, remember, 'Stay signed in on this PC (kept by Windows for your user only)'),
      msg, h('div', { class: 'row' }, h('span', { class: 'grow' }), go)));
  document.body.append(overlay); email.focus();
}
async function msSignOut(onDone) {
  try { await msCall('logout?forget=1', { method: 'POST' }); } catch { }
  MS.home = MS.profile = MS.box = MS.squads = null; MS.byUnit = new Map(); MS.state = { signedIn: false, saved: false };
  if (confirm('Signed out. Bring back the box you had before signing in and remove the squads read from your account? (Cancel keeps what was read.)')) msRestoreScan(); else localStorage.removeItem('ownedBeforeLive');
  if (onDone) onDone();
}

// ------------------------------------------------------------------ Home panel
const MS_FLAGS = { no_mitigator: 'no damage mitigation', no_healer: 'no healer', no_status_answer: 'no answer to status ailments', no_bb_fill: 'no BB gauge support', unlevelled: 'units not levelled', over_cap: 'over the cost cap' };
const MS_FLAG_HELP = { no_mitigator: 'Nobody in this squad reduces the damage the squad takes, so a boss\'s big attack hits in full.', no_healer: 'Nobody in this squad restores HP, so long fights get risky.',
  no_status_answer: 'Nobody cures or blocks poison, paralysis and the like.', no_bb_fill: 'Nobody helps fill the Brave Burst gauges, so the strong attacks come slowly.', unlevelled: 'Some units are far below their maximum level.', over_cap: 'The squad costs more than your level allows.' };
// The account on Home (design: projects/bfr-deck/my-summoner-ui-spec.md): one strip of eight numbers and "What next"
// as three short rows whose reasons open with a tap. Refresh and sign out sit in the header (msTiles).
function msPanel(redraw) {
  MS.redraw = redraw;
  const box = h('div', { class: 'tile wide mspanel' });
  const H = MS.home, P = H && H.player;
  if (!P) {
    box.append(h('div', { class: 'row' }, h('span', { class: 'dim grow' }, MS.busy ? 'Reading your account…' : MS.error || 'Sign in to see your level, energy and next steps, straight from your account.'),
      MS.busy ? null : h('button', { class: 'primary', onclick: () => msSignIn(redraw) }, 'Sign in')));
    return box;
  }
  const stat = (k, v, sub, cls) => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v num' + (cls ? ' ' + cls : '') }, v), sub ? h('div', { class: 's' + (cls ? ' ' + cls : '') }, sub) : null);
  const over = P.unit_box.used > P.unit_box.capacity;
  const full = P.energy.full_at ? `full ${fmtClock.format(new Date(P.energy.full_at * 1000))}` : 'full';
  const next = (H.next && H.next.items) || [], all = next.length + ((H.next && H.next.more) || 0);
  const rows = next.slice(0, 3).map((n, i) => {
    const why = h('p', { class: 'why dim', hidden: '' }, n.reason || '');
    const btn = h('button', { class: 'row-btn', 'aria-expanded': 'false', onclick: () => { const open = why.hidden; for (const w of box.querySelectorAll('.why')) w.hidden = true; for (const b of box.querySelectorAll('.row-btn')) b.setAttribute('aria-expanded', 'false'); why.hidden = !open; btn.setAttribute('aria-expanded', String(open)); } }, 'Why?');
    return h('div', { class: 'nextrow' + (i === 0 ? ' first' : '') }, h('span', { class: 'n' }, String(i + 1)), h('b', { class: 'grow' }, n.title), n.reason ? btn : null, why);
  });
  box.append(
    h('div', { class: 'strip' }, stat('Level', fmt(P.level), `${fmt(P.exp_to_next)} EXP to next`), stat('Energy', `${P.energy.now} / ${P.energy.max}`, full), stat('Arena orbs', `${P.arena_orbs.now} / ${P.arena_orbs.max}`), stat('Gifts', fmt(P.presents_waiting), P.presents_waiting ? 'waiting' : ''),
      stat('Unit box', `${fmt(P.unit_box.used)} / ${fmt(P.unit_box.capacity)}`, over ? 'Full' : '', over ? 'red' : ''), stat('Cost cap', fmt(P.deck_cost_cap))),
    next.length ? h('div', { class: 'msnext' }, h('div', { class: 'row' }, h('span', { class: 'k grow' }, 'What next'), h('a', { class: 'faint', href: '#/account/todo' }, `See all ${all} ›`)), rows) : null,
    msToday(H));
  return box;
}
// Header buttons and compact tiles while signed in (called by refreshHead every few seconds).
function msTiles(tiles, head) {
  const P = MS.home && MS.home.player;
  if (!P) return;
  // the existing Gems, Zel and Karma tiles keep their look and get their numbers from the account
  for (const [key, val] of [['gems', P.gems], ['zel', P.zel], ['karma', P.karma]]) { const t = tiles.querySelector(`[data-k=${key}]`); if (!t) continue; t.querySelector('.v').textContent = fmt(val); t.querySelector('.s').textContent = 'from your account'; }
  const sub = head.querySelector('.name .sub'); if (sub && !sub.textContent.trim()) sub.textContent = ` Lv ${P.level}`;
  const right = head.querySelector('.right');
  if (right && !right.querySelector('.msbtn')) right.append(
    h('button', { class: 'icon msbtn', title: `Read your account again (updated ${fmtClock.format(new Date(MS.at * 1000))})`, onclick: async e => { e.currentTarget.disabled = true; await msLoad(true); if (MS.redraw) MS.redraw(); } }, 'refresh'),
    h('button', { class: 'icon msbtn', title: 'Sign out of My Summoner', onclick: () => msSignOut(MS.redraw) }, 'sign out'));
}

// ------------------------------------------------------------------ unit page: your copies of this unit
function copiesSection(id) {
  const list = MS.byUnit.get(Number(id)); if (!list || !list.length) return null;
  const sphereName = s => (s && (s.name || (s.item_id && itemRow(s.item_id)[0]))) || String(s);
  const best = [...list].sort((a, b) => b.level - a.level || b.bb_level - a.bb_level), top = best[0];
  const row = u => h('div', { class: 'mscopy' },
    h('b', {}, `Lv ${u.level} / ${u.max_level}`), u.maxed ? h('span', { class: 'tag green' }, 'max level') : null, u.locked ? h('span', { class: 'tag' }, 'locked') : null,
    u.tier ? h('span', { class: 'tag gold', title: 'Tier given by My Summoner' }, `tier ${u.tier}`) : null,
    h('span', { class: 'dim' }, ` ${u.type || ''} · BB ${u.bb_level}${u.sbb_level ? ` · SBB ${u.sbb_level}` : ''}`),
    u.imps && (u.imps.hp || u.imps.atk || u.imps.def || u.imps.rec) ? h('span', { class: 'dim' }, ` · imps HP ${u.imps.hp} ATK ${u.imps.atk} DEF ${u.imps.def} REC ${u.imps.rec}`) : null,
    h('div', { class: 'faint' }, `Spheres: ${(u.spheres || []).length ? u.spheres.map(sphereName).join(', ') : `none equipped (${u.sphere_slots || 0} slot${u.sphere_slots === 1 ? '' : 's'})`}`,
      u.sp ? ` · SP ${u.sp.spent} spent, ${u.sp.available} free of ${u.sp.max}` : ''),
    (u.extra_skills || []).length ? h('div', { class: 'faint' }, 'Extra skills: ' + u.extra_skills.map(x => (x && (x.name || x.desc)) || String(x)).join(' · ')) : null,
    u.sp && (u.sp.options || []).length ? h('div', { class: 'faint' }, 'SP bought: ' + u.sp.options.map(x => (x && (x.name || x.desc)) || String(x)).join(' · ')) : null,
    copyReport(u.user_unit_id));
  // one line at a glance; every copy behind a tap
  return h('details', { class: 'box mscopies' },
    h('summary', {}, h('b', {}, `You own ${list.length} cop${list.length === 1 ? 'y' : 'ies'}`), h('span', { class: 'dim' }, ` · best Lv ${top.level}/${top.max_level} · BB ${top.bb_level} · ${(top.spheres || []).length} sphere${(top.spheres || []).length === 1 ? '' : 's'} equipped${top.sp ? ` · ${top.sp.available} SP free` : ''}`),
      top.tier ? h('span', { class: 'tag gold', title: 'Tier given by My Summoner' }, `tier ${top.tier}`) : null, h('span', { class: 'faint showmore' }, 'show copies')),
    best.slice(0, 8).map(row), best.length > 8 ? h('p', { class: 'faint' }, `and ${best.length - 8} more`) : null);
}

// ------------------------------------------------------------------ advice on the gear you really own
// Spheres in your item box: id -> { owned, worn } (worn = equipped on some unit right now).
function msOwnedSpheres() {
  const m = new Map();
  for (const i of (MS.profile && MS.profile.items) || []) if ((i.type === 3 || i.type === 6) && i.owned > 0) m.set(Number(i.item_id), { owned: i.owned, worn: i.worn || 0 });
  return m;
}
// The best of your own spheres for a unit, scored like the deck's suggestions (what the unit's skills do). `used`
// (sphere id -> how many are already given away) lets a squad share a limited stock; n = how many to pick.
function ownedSpherePicks(id, u, n = 2, used = null) {
  const own = msOwnedSpheres(); if (!own.size || !u) return [];
  const focus = sphereFocus(u), el = (ELEMENTS[unitElement(id)] || '').toLowerCase();
  const fit = s => { if (s.only && el && !s.only.includes(el)) return 0; let t = 0; for (const [k, v] of Object.entries(s.f)) t += v * (focus.w[k] || 0); return t; };
  const why = s => Object.entries(s.f).map(([k, v]) => [k, v * (focus.w[k] || 0)]).sort((a, b) => b[1] - a[1]).slice(0, 2).filter(x => x[1] > 0).map(x => SPH_LABEL[x[0]]);
  const left = s => own.get(s.id).owned - ((used && used.get(s.id)) || 0);
  const pool = sphereList().filter(s => own.has(s.id) && left(s) > 0).map(s => [s, fit(s)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1] || b[0].rarity - a[0].rarity);
  const picks = [];
  for (const [s] of pool) { if (picks.length >= n) break; if (picks.some(p => p.sphere.name === s.name || (p.sphere.type && p.sphere.type === s.type))) continue; picks.push({ sphere: s, why: why(s), have: own.get(s.id) }); }
  return picks;
}
// A small tag for a suggested sphere: do you own it, and is a copy free?
function ownTag(sphereId) {
  if (!MS.profile) return null;
  const o = msOwnedSpheres().get(Number(sphereId));
  return o ? h('span', { class: 'tag green' }, o.owned - o.worn > 0 ? `you own ${o.owned}${o.worn ? `, ${o.owned - o.worn} free` : ''}` : `you own ${o.owned}, all equipped`) : h('span', { class: 'tag' }, 'not owned');
}
// Unit page: the best spheres from your own box for this unit (card = the page's sphere card).
function ownedSphereBlock(id, u, card) {
  if (!MS.profile) return null;
  const own = msOwnedSpheres();
  if (!own.size) return [h('h3', { class: 'spheasy' }, 'From your own spheres'), h('p', { class: 'faint' }, 'Your account has no spheres yet.')];
  const copies = MS.byUnit.get(Number(id)) || [], slots = Math.max(1, ...copies.map(c => c.sphere_slots || 1));
  const picks = ownedSpherePicks(id, u, Math.max(2, slots));
  if (!picks.length) return [h('h3', { class: 'spheasy' }, 'From your own spheres'), h('p', { class: 'faint' }, `None of your ${own.size} kinds of spheres fits what this unit does.`)];
  return [h('h3', { class: 'spheasy' }, 'From your own spheres'),
    h('p', { class: 'faint', style: 'margin:0 0 8px' }, `The best of the ${own.size} kinds of spheres in your item box for this unit${copies.length ? ` (your copy has ${slots} sphere slot${slots === 1 ? '' : 's'})` : ''}.`),
    h('div', { class: 'sphcards' }, picks.map(card))];
}
// Unit page: your copy's SP against the suggested build (r = suggestSp result).
function spOwnLine(id, r) {
  const copies = MS.byUnit.get(Number(id)) || [], c = copies.filter(x => x.sp).sort((a, b) => b.level - a.level)[0];
  if (!c) return null;
  const free = c.sp.available || 0; let sum = 0; const can = [];
  for (const o of [...r.picks].sort((a, b) => (b.value / Math.max(1, b.sp)) - (a.value / Math.max(1, a.sp)))) if (sum + o.sp <= free) { sum += o.sp; can.push(o.name); }
  return h('p', { class: 'sphneed' }, h('b', {}, 'Your copy: '), `${c.sp.spent} SP spent, ${free} free of ${c.sp.max}. `,
    free >= r.sp ? 'That is enough for the whole build below.' : can.length ? `With ${free} SP, start with: ${can.join('; ')}.` : 'Not enough free SP for any of these yet.');
}
// Home squad tile, folded: which spheres to put on this squad. A squad from your account gets My Summoner's own
// sphere plan (the companion's advice comes first); a squad planned in the deck gets the deck's sharing-out of the
// spheres you own (limited stock, best fit first).
function gearBlock(s) {
  if (!MS.profile || !s) return null;
  const own = msOwnedSpheres(); if (!own.size) return null;
  const list = h('div', { class: 'gearlist' }, h('span', { class: 'faint' }, 'working it out…'));
  const box = h('details', { class: 'livesq gear' }, h('summary', {}, h('b', {}, 'Best spheres for this squad '), h('span', { class: 'faint' }, s.live ? "My Summoner's plan, within what you own" : `BFR Deck's estimate for a squad planned here, from the ${own.size} kinds you own`)), list);
  box.open = store.get('gearOpen', false); box.addEventListener('toggle', () => store.set('gearOpen', box.open));
  (async () => {
    if (s.live) {
      try {
        const plan = await msPart(`squads/${s.live.number}/spheres?kind=${encodeURIComponent(s.live.kind || 'squad')}`);
        list.replaceChildren((plan.moves || []).length ? h('ol', { class: 'moves' }, plan.moves.map(m => h('li', {}, m.text))) : h('span', { class: 'faint' }, 'Nothing to change: the spheres already sit where they fit best.'),
          h('a', { class: 'faint', href: '#/account/squads' }, 'Whole squad report ›'));
        return;
      } catch { /* fall back to the deck's own sharing-out below */ }
    }
    const used = new Map(), rows = [];
    for (const id of s.units) {
      if (!id) continue;
      const u = await unitDetail(id); const copies = MS.byUnit.get(Number(id)) || [], slots = Math.max(1, ...copies.map(c => c.sphere_slots || 1));
      const picks = ownedSpherePicks(id, u, slots, used);
      for (const p of picks) used.set(p.sphere.id, (used.get(p.sphere.id) || 0) + 1);
      rows.push(h('div', { class: 'gearrow' }, h('a', { href: `#/units/${id}` }, shortUnitName(id)), h('span', {}, picks.length ? picks.map(p => [h('a', { href: `#/items/${p.sphere.id}`, title: p.sphere.desc }, p.sphere.name), h('span', { class: 'faint' }, ` (${p.why.join(', ') || 'general'})`)]) : h('span', { class: 'faint' }, 'nothing fitting left'))));
    }
    list.replaceChildren(...rows);
  })();
  return box;
}

// My Summoner's report on one of your copies, written into `out`: its tier and rank among your units, what it does,
// which of YOUR spheres suit it, what to improve, where it fits. This is the main advice on a unit page.
async function renderReport(out, userUnitId) {
  out.replaceChildren(h('span', { class: 'faint' }, 'Reading My Summoner…'));
  try {
    const [r, b] = await Promise.all([msPart(`units/${userUnitId}`), msPart(`box/${userUnitId}`).catch(() => null)]);
    const P = (b && b.power) || {}, imp = r.improve || {};
    const line = (label, items) => (items && items.length ? h('p', {}, h('b', {}, label + ': '), items.join(' · ')) : null);
    out.replaceChildren(
      P.tier || P.rank ? h('p', {}, h('span', { class: 'tag gold' }, `tier ${P.tier || '?'}`), P.rank ? ` #${P.rank.place} of ${P.rank.of} of your units` : '', r.power && r.power.explain ? h('span', { class: 'dim' }, ` · ${r.power.explain}`) : null) : null,
      h('h3', { class: 'spheasy' }, 'Spheres for this unit'),
      (imp.spheres || []).length ? h('div', { class: 'sphcards' }, imp.spheres.map(x => h('a', { class: 'sphcard', href: `#/items/${x.item_id}` }, h('img', { src: itemIcon(x.item_id), alt: '', width: 40, height: 40, loading: 'lazy' }),
        h('div', {}, h('div', { class: 'nm' }, x.name, h('span', { class: 'tag green' }, x.state || 'yours')), h('p', {}, (x.why || []).join(' · '))))))
        : h('p', { class: 'dim' }, 'None of the spheres you own stands out for this unit.'),
      line('What it does', (r.roles || []).map(x => `${x.label} (${x.reason})`)),
      line('Among your units', (r.standing || []).map(x => x.text)),
      line('Strong', P.strong), line('Weak', P.weak), line('Still missing', P.lacks), line('To improve', imp.steps),
      line('In squads', r.in_squads), line('Fits team themes', (r.fits || []).map(x => x.label)));
    return true;
  } catch (e) { out.replaceChildren(h('span', { class: 'red' }, 'No report from My Summoner: ' + e.message)); return false; }
}
// The same report for another copy, behind a button (the copies list).
function copyReport(userUnitId) {
  const out = h('div', { class: 'copyreport' });
  const btn = h('button', { class: 'chip', onclick: async () => { btn.disabled = true; if (await renderReport(out, userUnitId)) btn.remove(); else btn.disabled = false; } }, 'report from My Summoner');
  return h('div', {}, btn, out);
}
// Unit page, a unit you own: My Summoner's advice for your best copy, shown at once.
function msAdvice(id) {
  const list = MS.byUnit.get(Number(id)); if (!list || !list.length) return null;
  const top = [...list].sort((a, b) => b.level - a.level || b.bb_level - a.bb_level)[0];
  const out = h('div', { class: 'copyreport' });
  renderReport(out, top.user_unit_id);
  return h('div', { class: 'sphbox' }, h('h2', {}, "My Summoner's advice"), h('p', { class: 'faint', style: 'margin:0 0 8px' }, `For your ${list.length > 1 ? 'best ' : ''}copy (Lv ${top.level}/${top.max_level}), worked out by My Summoner from your own account. `,
    h('a', { href: '#/account/build', onclick: () => { ACC.buildUnit = top.user_unit_id; ACC.buildName = top.name; ACC.theme = 'build_around'; } }, 'Build a team around it ›')), out);
}
// A block the deck works out itself gets a clear mark while you are signed in: it is not from My Summoner.
function deckEstimate(el, why) {
  if (!el || !MS.profile) return el;
  return h('div', { class: 'estimate' }, h('p', { class: 'estnote' }, h('span', { class: 'tag' }, "BFR Deck's estimate"), ` Not from My Summoner${why ? ': ' + why : '.'}`), el);
}
// Team Builder, a squad from your account: My Summoner's own check and sphere plan instead of the deck's.
function msSquadBox(s) {
  const out = h('div', {}, h('p', { class: 'dim' }, 'Reading My Summoner…'));
  (async () => {
    try {
      const q = `?kind=${encodeURIComponent(s.live.kind || 'squad')}`;
      const [d, plan] = await Promise.all([msPart(`squads/${s.live.number}${q}`), msPart(`squads/${s.live.number}/spheres${q}`).catch(() => null)]);
      out.replaceChildren(h('h2', {}, 'What it covers'), covRows(d.coverage) || h('p', { class: 'dim' }, 'No rating for this squad.'),
        h('h2', {}, 'Sphere plan'), plan && (plan.moves || []).length ? h('div', { class: 'box' }, h('ol', { class: 'moves' }, plan.moves.map(m => h('li', {}, m.text)))) : h('p', { class: 'dim' }, 'Nothing to change.'),
        h('p', {}, h('a', { href: '#/account/squads' }, 'Whole squad report ›')));
    } catch (e) { out.replaceChildren(h('p', { class: 'red' }, 'No squad check from My Summoner: ' + e.message)); }
  })();
  return h('div', { class: 'sphbox' }, h('p', { class: 'faint' }, h('span', { class: 'tag gold' }, 'from your account'), ' This squad is read from the game; its check and sphere plan come from My Summoner. Changes you make here are a what-if and are undone by the next refresh.'), out);
}
// Tier List page: your own units by the tier My Summoner gives them (strongest first in each tier).
function msTierBlock() {
  const B = MS.box; if (!B || !B.columns || !B.rows) return null;
  const c = B.columns, iu = c.indexOf('unit_id'), it = c.indexOf('tier'), ip = c.indexOf('power'), il = c.indexOf('level');
  const by = {}; for (const r of B.rows) { const t = r[it]; if (!t) continue; (by[t] ||= []).push(r); }
  const tiers = ['S', 'A', 'B', 'C', 'D'].filter(t => by[t]);
  if (!tiers.length) return null;
  return h('div', { class: 'box mstier' }, h('div', { class: 'row' }, h('b', {}, 'Your units by tier'), h('span', { class: 'grow' }), h('span', { class: 'faint' }, 'tiers from My Summoner')),
    tiers.map(t => { const rows = by[t].sort((a, b) => (b[ip] || 0) - (a[ip] || 0)), seen = new Set(), ids = [];
      for (const r of rows) { const id = Number(r[iu]); if (!seen.has(id)) { seen.add(id); ids.push([id, r[ip], r[il]]); } }
      return h('details', { class: 'evorow', open: t === 'S' || t === 'A' ? '' : null }, h('summary', {}, h('span', { class: 'tag gold' }, `tier ${t}`), h('span', { class: 'grow dim' }, ` ${ids.length} unit${ids.length === 1 ? '' : 's'}`)),
        h('div', { class: 'tierunits' }, ids.slice(0, 40).map(([id, pw, lv]) => h('a', { class: 'mini', href: `#/units/${id}`, title: `${unitName(id)} · power ${pw} · Lv ${lv}` }, h('img', { src: unitIcon(id), alt: unitName(id), width: 44, height: 44, loading: 'lazy' }))), ids.length > 40 ? h('span', { class: 'faint' }, ` +${ids.length - 40} more`) : null)); }));
}

// Home, one row under "What next": today's pointers from My Summoner (an evolution that is ready, a challenge, story).
function msToday(H) {
  const T = (H && H.today) || {}, S = (H && H.story) || {}, chips = [];
  if (T.evolution && T.evolution.ready) chips.push(h('a', { class: 'chip', href: '#/account/evolve', title: T.evolution.unit ? `${T.evolution.unit.name}: ${T.evolution.unit.reason}` : '' }, `Evolve: ${T.evolution.ready} ready`));
  if (T.challenge && T.challenge.pick) chips.push(h('a', { class: 'chip', href: '#/account/challenges', title: T.challenge.pick.why || '' }, `Challenge: ${T.challenge.pick.title}`));
  if (S.percent != null) chips.push(h('a', { class: 'chip', href: '#/account/story', title: S.quest ? `Next: ${S.quest.name} (${S.quest.area_name})` : '' }, `Story ${S.percent}%`));
  return chips.length ? h('div', { class: 'row mstoday' }, h('span', { class: 'k' }, 'Today'), chips) : null;
}
// Item pages: how many of this item your account holds.
function stockTag(id) {
  if (!MS.profile) return null;
  const i = MS.items && MS.items.get(Number(id));
  return i ? h('span', { class: 'tag green' }, `you have ${fmt(i.owned ?? i.stock)}${i.worn ? `, ${i.worn} worn` : ''}`) : h('span', { class: 'tag' }, 'you have none');
}
// Units > Your box: every copy you own with My Summoner's tier and power, sortable and filterable.
const BOXLIST = { sort: 'power', tier: '', shown: 60 };
function msBoxList() {
  const B = MS.box; if (!B || !B.columns || !B.rows) return null;
  const c = B.columns, col = k => c.indexOf(k), I = { uu: col('user_unit_id'), id: col('unit_id'), rar: col('rarity'), lv: col('level'), max: col('max_level'), pow: col('power'), tier: col('tier'), bb: col('bb_level'), lock: col('locked') };
  const box = h('div', { class: 'box msboxlist' });
  const draw = () => {
    const keyOf = { power: r => r[I.pow] || 0, level: r => r[I.lv] || 0, rarity: r => r[I.rar] || 0 }[BOXLIST.sort];
    const rows = B.rows.filter(r => !BOXLIST.tier || r[I.tier] === BOXLIST.tier).sort((a, b) => keyOf(b) - keyOf(a) || (b[I.pow] || 0) - (a[I.pow] || 0));
    const chip = (on, label, fn) => h('button', { class: on ? 'chip on' : 'chip', onclick: fn }, label);
    box.replaceChildren(h('div', { class: 'row' }, h('b', {}, `Your ${fmt(B.rows.length)} units`), h('span', { class: 'faint' }, 'tier and power from My Summoner'), h('span', { class: 'grow' }),
        h('span', { class: 'faint' }, 'sort'), ['power', 'level', 'rarity'].map(k => chip(BOXLIST.sort === k, k, () => { BOXLIST.sort = k; draw(); }))),
      h('div', { class: 'row' }, h('span', { class: 'faint' }, 'tier'), chip(!BOXLIST.tier, 'all', () => { BOXLIST.tier = ''; BOXLIST.shown = 60; draw(); }), ['S', 'A', 'B', 'C', 'D'].map(t => chip(BOXLIST.tier === t, t, () => { BOXLIST.tier = t; BOXLIST.shown = 60; draw(); }))),
      rows.slice(0, BOXLIST.shown).map(r => h('a', { class: 'boxrow', href: `#/units/${Number(r[I.id])}` }, h('img', { src: unitIcon(Number(r[I.id])), alt: '', width: 32, height: 32, loading: 'lazy' }), h('span', { class: 'grow' }, unitName(Number(r[I.id]))),
        h('span', { class: 'faint' }, `Lv ${r[I.lv]}/${r[I.max]} · BB ${r[I.bb]}`), h('span', { class: 'tag gold' }, `tier ${r[I.tier] || '-'}`), h('span', { class: 'num' }, `power ${r[I.pow] ?? '-'}`))),
      rows.length > BOXLIST.shown ? h('button', { class: 'chip', onclick: () => { BOXLIST.shown += 100; draw(); } }, `Show more (${rows.length - BOXLIST.shown} left)`) : null);
  };
  draw(); return box;
}

// Start: read the account if a login is remembered or a session is open; redraw Home when it arrives.
async function msBoot() {
  await msLoad(false);
  // the page that is open was drawn before the account arrived: draw it again (not while a dialog is open)
  if (MS.home && typeof route === 'function' && typeof ready !== 'undefined' && ready && !document.querySelector('.overlay')) route();
}
