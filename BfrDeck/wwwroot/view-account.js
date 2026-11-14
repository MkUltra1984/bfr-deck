'use strict';
// "My Account": what the live account (My Summoner, see summoner.js) knows beyond the Home strip, in four sub-tabs:
//   To do       the full "what next" list
//   Evolve      per unit: target form, materials needed and held, Zel and Karma; and a shopping list
//   Challenges  suggested missions with rules, a proposed squad and the reason
//   History     login and play streak, clears per mode, most-played missions, activity per day
// Each sub-tab asks the host for its own part when opened (kept for a minute by the host).

const ACCOUNT_TABS = [['todo', 'To do'], ['squads', 'Squads'], ['build', 'Build a team'], ['evolve', 'Evolve'], ['challenges', 'Challenges'], ['story', 'Story'], ['collection', 'Collection'], ['items', 'Items'], ['history', 'History'], ['profile', 'Profile']];
const ACC = { evoFilter: 'all', evoView: 'units', evoShown: 40, chFilter: '', squad: '', theme: '', friend: 0, buildUnit: 0, targets: new Set() };

async function renderAccount(view, arg) {
  if (arg === 'probe') return accProbe(view);
  if (arg === 'selftest') return accSelfTest(view);   // #/account/selftest: support, tries the buttons and writes the outcome to the log   // #/account/probe: support, writes the shape of the less known parts to the log
  const tab = ACCOUNT_TABS.some(t => t[0] === arg) ? arg : 'todo';
  const head = h('div', {}, h('h1', {}, 'My Account'));
  if (!(MS.home && MS.home.player)) {
    view.replaceChildren(head, h('div', { class: 'box' }, h('p', {}, MS.busy ? 'Reading your account…' : 'Sign in to see what to do next, what your units need to evolve, suggested challenges and your play history.'),
      h('p', { class: 'faint' }, 'Experimental and read-only: BFR Deck reads your account from My Summoner and never changes it.'),
      MS.busy ? null : h('button', { class: 'primary', onclick: () => msSignIn(() => renderAccount(view, tab)) }, 'Sign in')));
    return;
  }
  const tabs = h('div', { class: 'row seg' }, ACCOUNT_TABS.map(([k, label]) => h('a', { class: k === tab ? 'chip on' : 'chip', href: `#/account/${k}` }, label)),
    h('span', { class: 'grow' }), h('span', { class: 'faint' }, `updated ${fmtClock.format(new Date(MS.at * 1000))}`));
  const body = h('div', { class: 'accbody' }, h('p', { class: 'dim' }, 'Reading your account…'));
  view.replaceChildren(head, tabs, body);
  try {
    if (tab === 'todo') accTodo(body, await msPart('next'));
    else if (tab === 'evolve') accEvolve(body, await msPart('evolutions'));
    else if (tab === 'challenges') accChallenges(body, await msPart('challenges'));
    else if (tab === 'squads') await accSquads(body);
    else if (tab === 'build') await accBuild(body);
    else if (tab === 'story') accStory(body, await msPart('progress'));
    else if (tab === 'collection') accCollection(body, await msPart('collection'));
    else if (tab === 'items') accItems(body);
    else if (tab === 'profile') accProfile(body);
    else accHistory(body, await msPart('history'));
  } catch (e) {
    body.replaceChildren(h('div', { class: 'box' }, h('p', { class: 'red' }, e.status === 401 ? 'You are signed out.' : 'Could not reach your account. ' + (e.message || '')),
      h('button', { class: 'chip', onclick: () => renderAccount(view, tab) }, 'Try again')));
  }
}

// ---- To do
function accTodo(body, d) {
  const items = (d && d.items) || [];
  body.replaceChildren(h('p', { class: 'faint' }, 'What My Summoner suggests for your account, most useful first.'),
    items.length ? h('div', { class: 'box' }, items.map((n, i) => h('div', { class: 'nextrow full' + (i === 0 ? ' first' : '') }, h('span', { class: 'n' }, String(n.rank || i + 1)),
      h('div', {}, h('b', {}, n.title), h('p', { class: 'dim' }, n.reason || ''))))) : h('p', { class: 'dim' }, 'Nothing pressing right now.'));
}

// ---- Evolve
function accEvolve(body, d) {
  const units = (d && d.units) || [], counts = (d && d.counts) || {};
  const draw = () => {
    const chip = (key, label) => h('button', { class: ACC.evoFilter === key ? 'chip on' : 'chip', onclick: () => { ACC.evoFilter = key; ACC.evoShown = 40; draw(); } }, label);
    const viewChip = (key, label) => h('button', { class: ACC.evoView === key ? 'chip on' : 'chip', onclick: () => { ACC.evoView = key; draw(); } }, label);
    const bar = h('div', { class: 'row' }, chip('all', `All ${counts.total ?? units.length}`), chip('ready', `Ready ${counts.ready ?? 0}`), chip('short', `Short ${counts.short ?? 0}`), counts.blocked ? chip('blocked', `Blocked ${counts.blocked}`) : null,
      h('span', { class: 'grow' }), viewChip('units', 'By unit'), viewChip('shop', 'Shopping list'));
    const hint = h('p', { class: 'faint' }, 'Plan to evolve your units. Green means you can do it now.');
    if (ACC.evoView === 'shop') {
      const box = h('div', {}), mine = ACC.targets.size;
      const note = h('p', { class: 'faint' }, mine ? `For the ${mine} unit${mine === 1 ? '' : 's'} you picked. ` : 'For the units in your squads. Pick your own in "By unit" with the + list button (up to 20). ', mine ? h('button', { class: 'chip', onclick: () => { ACC.targets.clear(); draw(); } }, 'clear my picks') : null);
      body.replaceChildren(hint, bar, note, box);
      if (mine) { box.append(h('p', { class: 'dim' }, 'Adding it up…')); msPart('evolutions?targets=' + [...ACC.targets].join(',')).then(x => box.replaceChildren(evoShopping(x && x.shopping_list))).catch(e => box.replaceChildren(h('p', { class: 'red' }, 'No shopping list: ' + e.message))); }
      else box.append(evoShopping(d && d.shopping_list));
      return;
    }
    const list = units.filter(u => ACC.evoFilter === 'all' || u.status === ACC.evoFilter)
      .sort((a, b) => (a.status === 'ready' ? 0 : 1) - (b.status === 'ready' ? 0 : 1) || (a.short_by || 0) - (b.short_by || 0) || (b.rarity || 0) - (a.rarity || 0) || (b.level || 0) - (a.level || 0));
    const have = (need, held) => h('span', { class: held >= need ? 'green' : 'red' }, `${fmt(held)} / ${fmt(need)}`);
    const row = u => h('details', { class: 'evorow' },
      h('summary', {}, h('img', { src: unitIcon(Number(u.unit_id)), alt: '', width: 36, height: 36, loading: 'lazy' }),
        h('span', { class: 'grow' }, h('b', {}, u.name), h('span', { class: 'dim' }, ` → ${(u.target && u.target.name) || '?'} ${(u.target && u.target.rarity_label) || ''}`), h('span', { class: 'faint' }, ` · Lv ${u.level}/${u.max_level}`)),
        h('button', { class: ACC.targets.has(u.user_unit_id) ? 'chip on' : 'chip', title: 'Put this unit on your shopping list', onclick: e => { e.preventDefault(); e.stopPropagation(); if (ACC.targets.has(u.user_unit_id)) ACC.targets.delete(u.user_unit_id); else if (ACC.targets.size < 20) ACC.targets.add(u.user_unit_id); else toast('The shopping list takes up to 20 units'); e.currentTarget.className = ACC.targets.has(u.user_unit_id) ? 'chip on' : 'chip'; e.currentTarget.textContent = ACC.targets.has(u.user_unit_id) ? '✓ on list' : '+ list'; } }, ACC.targets.has(u.user_unit_id) ? '✓ on list' : '+ list'),
        h('span', { class: 'tag ' + (u.status === 'ready' ? 'green' : u.status === 'short' ? 'gold' : 'red') }, u.status === 'ready' ? 'Ready' : u.status === 'short' ? `Short: ${u.short_by || '?'}` : 'Blocked')),
      h('div', { class: 'evobody' }, h('p', {}, u.reason || ''),
        (u.materials || []).map(m => h('div', { class: 'kvrow' }, h('span', {}, m.name), have(m.need, m.usable ?? m.held), m.where && m.where.text ? h('span', { class: 'faint' }, m.where.text) : null)),
        h('div', { class: 'kvrow' }, h('span', {}, 'Zel'), have(u.zel.need, u.zel.have)), u.karma && u.karma.need ? h('div', { class: 'kvrow' }, h('span', {}, 'Karma'), have(u.karma.need, u.karma.have)) : null,
        h('p', {}, h('a', { href: `#/units/${Number(u.unit_id)}` }, 'Open this unit ›'))));
    const shown = list.slice(0, ACC.evoShown);
    body.replaceChildren(hint, bar, list.length ? h('div', { class: 'box evolist' }, shown.map(row)) : h('p', { class: 'dim' }, 'Nothing in this group.'),
      list.length > shown.length ? h('button', { class: 'chip', onclick: () => { ACC.evoShown += 60; draw(); } }, `Show more (${list.length - shown.length} left)`) : null,
      (d && d.notes || []).length ? h('details', { class: 'cat' }, h('summary', {}, 'How this is counted'), d.notes.map(n => h('p', { class: 'faint' }, n))) : null);
  };
  draw();
}
function evoShopping(s) {
  if (!s || !(s.materials || []).length) return h('p', { class: 'dim' }, 'Nothing to buy or farm for your squads right now.');
  const money = (label, m) => (m && m.need ? h('tr', {}, h('td', {}, label), h('td', { class: 'num' }, fmt(m.need)), h('td', { class: 'num' }, fmt(m.have)), h('td', { class: 'num ' + (m.short > 0 ? 'red' : 'green') }, m.short > 0 ? fmt(m.short) : '0'), h('td', {})) : null);
  return h('div', { class: 'box' }, h('p', { class: 'faint' }, `For ${s.basis || 'your squads'}.`),
    h('table', { class: 'plain shop' }, h('tr', {}, h('th', {}, 'Item'), h('th', {}, 'Need'), h('th', {}, 'Have'), h('th', {}, 'Missing'), h('th', {}, 'Where')),
      s.materials.map(m => h('tr', {}, h('td', {}, m.name), h('td', { class: 'num' }, fmt(m.need)), h('td', { class: 'num' }, fmt(m.have)), h('td', { class: 'num ' + (m.buy > 0 ? 'red' : 'green') }, fmt(m.buy || 0)), h('td', { class: 'faint' }, (m.where && m.where.text) || ''))),
      money('Zel', s.zel), money('Karma', s.karma)));
}

// ---- Challenges
function accChallenges(body, d) {
  const G = (d && d.groups) || {}, groups = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['brutal', 'Brutal']].map(([k, label]) => [k, label, G[k] || []]);
  groups.push(['later', 'Later', (d && d.later) || []]);
  if (!ACC.chFilter || !groups.some(g => g[0] === ACC.chFilter && g[2].length)) ACC.chFilter = (groups.find(g => g[2].length) || ['easy'])[0];
  const draw = () => {
    const list = (groups.find(g => g[0] === ACC.chFilter) || [0, 0, []])[2];
    const card = c => h('details', { class: 'evorow' },
      h('summary', {}, h('span', { class: 'grow' }, h('b', {}, c.title), c.mission ? h('span', { class: 'dim' }, ` · ${c.mission.name}`) : null), h('span', { class: 'tag' }, c.difficulty || '')),
      h('div', { class: 'evobody' }, c.flavour ? h('p', { class: 'dim' }, c.flavour) : null,
        (c.rules || []).length ? h('ul', {}, c.rules.map(r => h('li', {}, r))) : null,
        c.mission ? h('p', { class: 'faint' }, [c.mission.area_name, c.mission.energy != null ? `${c.mission.energy} energy` : '', c.mission.text].filter(Boolean).join(' · ')) : null,
        c.squad && (c.squad.units || []).length ? h('div', {}, h('b', {}, 'Proposed squad'), h('span', { class: 'faint' }, c.squad.cost != null ? ` · cost ${c.squad.cost} / ${c.squad.cap ?? c.squad.player_cap ?? '?'}` : ''),
          c.squad.units.map(u => h('div', { class: 'kvrow' }, h('a', { href: `#/units/${Number(u.unit_id)}` }, u.name), h('span', { class: 'faint' }, `Lv ${u.level}/${u.max_level}`), (u.needs || []).length ? h('span', { class: 'gold' }, u.needs.join(', ')) : h('span', { class: 'green' }, 'ready')))) : null,
        c.why ? h('p', {}, c.why) : null));
    body.replaceChildren(h('p', { class: 'faint' }, 'Missions My Summoner suggests as a challenge for the units you own. Tap one for its rules and a squad.'),
      h('div', { class: 'row' }, groups.filter(g => g[2].length).map(([k, label, l]) => h('button', { class: ACC.chFilter === k ? 'chip on' : 'chip', onclick: () => { ACC.chFilter = k; draw(); } }, `${label} ${l.length}`))),
      list.length ? h('div', { class: 'box evolist' }, list.map(card)) : h('p', { class: 'dim' }, 'No challenges in this group.'));
  };
  draw();
}

// ---- History
function accHistory(body, d) {
  const L = (d && d.login) || {}, top = ((d && d.top_missions && d.top_missions.all_time) || []).slice(0, 5), days = ((d && d.activity && d.activity.days) || []).slice(-14);
  const max = Math.max(1, ...days.map(x => x.runs || 0)), topMax = Math.max(1, ...top.map(x => x.clears || 0));
  const big = (k, v, s) => h('div', { class: 'box bigstat' }, h('div', { class: 'k' }, k), h('div', { class: 'v num' }, v), h('div', { class: 'faint' }, s || ''));
  body.replaceChildren(
    h('div', { class: 'cols' }, big('Login streak', `${L.streak ?? 0} days`, `${L.login_days ?? 0} login days in total`), big('Play streak', `${L.play_streak ?? 0} days`, 'days in a row with a battle')),
    h('h2', {}, 'Last 14 days'), days.length ? h('div', { class: 'box daybars' }, days.map(x => h('div', { class: 'daybar', title: `${fmtWhen.format(new Date(x.day * 1000)).split(',')[0]}: ${x.runs} runs` }, h('i', { style: `height:${Math.round(100 * (x.runs || 0) / max)}%` }), h('span', {}, String(x.runs || 0))))) : h('p', { class: 'dim' }, 'No play history yet.'),
    h('h2', {}, 'Most played'), top.length ? h('div', { class: 'box' }, top.map(m => h('div', { class: 'kvrow' }, h('span', {}, m.name, h('span', { class: 'faint' }, m.area_name ? ` · ${m.area_name}` : '')), h('span', { class: 'bar' }, h('span', { class: 'fill', style: `width:${Math.round(100 * m.clears / topMax)}%` }), h('span', {}, `${fmt(m.clears)} clears`))))) : h('p', { class: 'dim' }, 'No play history yet.'),
    accHistoryMore(d),
    h('h2', {}, 'By mode'), h('div', { class: 'box' }, ((d && d.modes) || []).map(m => h('div', { class: 'kvrow' }, h('span', {}, m.label), h('span', {}, `${fmt(m.quests_cleared)} quests cleared`), h('span', { class: 'faint' }, `${fmt(m.runs_90_days)} runs in 90 days`)))));
}

// ---- shared: what a squad covers (mitigation, healing, status, gauge ...), as the service rates it
const COV_CLASS = { none: 'red', light: 'gold' };
function covRows(coverage) {
  const list = Object.values(coverage || {}).filter(c => c && c.label);
  if (!list.length) return null;
  return h('div', { class: 'box evolist' }, list.map(c => h('details', { class: 'evorow' },
    h('summary', {}, h('span', { class: 'grow' }, h('b', {}, c.label), h('span', { class: 'dim' }, c.basis ? ` · ${c.basis}` : '')), h('span', { class: 'tag ' + (COV_CLASS[c.level] || 'green') }, c.level || '?')),
    h('div', { class: 'evobody' }, c.why_it_matters ? h('p', { class: 'dim' }, `Why it matters: ${c.why_it_matters}.`) : null,
      (c.providers || []).length ? h('p', {}, 'Brought by: ', c.providers.map(p => p.name + (p.label ? ` (${p.label})` : '')).join(', ')) : h('p', { class: 'red' }, 'Nobody in this squad brings it.')))));
}

// ---- Squads: one of your real squads looked at closely, with the service's sphere plan
async function accSquads(body) {
  const all = ((MS.squads && MS.squads.squads) || []).filter(s => (s.members || []).length >= 1);
  const key = s => `${s.kind_param}.${s.number}`;
  const set = all.filter(s => (s.members || []).length >= 2 || (s.deck_type === 1 && s.number === MS.squads.active));
  if (!set.length) { body.replaceChildren(h('p', { class: 'dim' }, 'No squad with units in it yet.')); return; }
  if (!set.some(s => key(s) === ACC.squad)) ACC.squad = key(set.find(s => s.deck_type === 1 && s.number === MS.squads.active) || set[0]);
  const s = set.find(x => key(x) === ACC.squad);
  const chips = h('div', { class: 'row' }, set.map(x => h('button', { class: key(x) === ACC.squad ? 'chip on' : 'chip', onclick: () => { ACC.squad = key(x); ACC.friend = 0; accSquads(body); } }, x.label)));
  const out = h('div', {}, h('p', { class: 'dim' }, 'Reading this squad…'));
  body.replaceChildren(h('p', { class: 'faint' }, 'Your squads as they are in the game: what each one covers, who is not ready, and which of your spheres to put where.'), chips, out);
  const q = `?kind=${encodeURIComponent(s.kind_param)}`, friend = ACC.friend;
  const [d, plan] = await Promise.all([msPart(`squads/${s.number}${q}${friend ? '&friend=' + friend : ''}`), msPart(`squads/${s.number}/spheres${q}`).catch(() => null)]);
  if (ACC.squad !== key(s) || ACC.friend !== friend) return;
  // try a friend leader (My Summoner works the squad out again with that unit as friend), and share the squad as text
  const tools = h('div', { class: 'row' },
    h('button', { class: 'chip', onclick: async () => { const id = await pickUnit({ title: 'Friend leader to try', hint: 'Any unit: My Summoner checks the squad again with it as your friend leader.' }); if (id) { ACC.friend = id; accSquads(body); } } }, friend ? 'try another friend leader' : 'try a friend leader'),
    friend ? h('span', { class: 'tag gold' }, `with friend: ${unitName(friend)}`) : null, friend ? h('button', { class: 'chip', onclick: () => { ACC.friend = 0; accSquads(body); } }, 'without friend') : null,
    h('span', { class: 'grow' }),
    h('button', { class: 'chip', title: 'Copy this squad as text, to paste into Discord', onclick: async () => { const lines = [`${s.label} · cost ${s.cost}/${s.cap}`, ...(d.members || []).map(m => `${m.leader ? '★' : '·'} ${m.name} (Lv ${m.readiness ? m.readiness.level + '/' + m.readiness.max_level : '?'}${m.tier ? ', tier ' + m.tier : ''})`), friend ? `Friend: ${unitName(friend)}` : '', s.line || ''].filter(Boolean);
      try { await navigator.clipboard.writeText(lines.join('\n')); toast('Squad copied as text'); } catch { toast('Could not copy to the clipboard'); } } }, 'share my squad'));
  const member = m => h('div', { class: 'kvrow' }, h('a', { href: `#/units/${Number(m.unit_id)}` }, m.name, m.leader ? h('span', { class: 'tag gold' }, 'leader') : null),
    h('span', {}, m.tier ? h('span', { class: 'tag' }, `tier ${m.tier}`) : null, m.readiness && m.readiness.ready ? h('span', { class: 'tag green' }, 'ready') : h('span', { class: 'tag gold' }, 'not ready')),
    h('span', { class: 'faint' }, ((m.readiness && m.readiness.notes) || []).join(' · ')));
  out.replaceChildren(tools,
    h('h2', {}, 'What it covers'), covRows(d.coverage) || h('p', { class: 'dim' }, 'No rating for this squad.'),
    h('h2', {}, 'Members'), h('div', { class: 'box' }, (d.members || []).map(member)),
    h('h2', {}, 'Sphere plan'), plan && (plan.moves || []).length ? h('div', { class: 'box' }, h('p', { class: 'faint' }, [plan.within, plan.notice].filter(Boolean).join(' ')),
      h('ol', { class: 'moves' }, plan.moves.map(m => h('li', {}, m.text))), (plan.notes || []).map(n => h('p', { class: 'faint' }, n))) : h('p', { class: 'dim' }, plan ? 'Nothing to change: the spheres already sit where they fit best.' : 'No sphere plan for this squad.'));
}

// ---- Build a team: the service picks a squad from your box for a theme
async function accBuild(body) {
  const T = ((await msPart('builder')).themes || []);
  const free = T.filter(t => !t.needs_unit);
  if (!T.some(t => t.theme === ACC.theme)) ACC.theme = (free[0] || T[0] || {}).theme || '';
  const cur = T.find(t => t.theme === ACC.theme) || {};
  // a theme that starts from one of your units asks which one (your best copy of the unit you pick)
  const pickAround = async () => { const id = await pickUnit({ title: 'Build around which unit?', onlyOwned: true, hint: 'One of your units; the team is built to make the most of it.' }); if (!id) return false; const c = (MS.byUnit.get(Number(id)) || []).slice().sort((a, b) => b.level - a.level)[0]; if (!c) { toast('You do not own that unit'); return false; } ACC.buildUnit = c.user_unit_id; ACC.buildName = c.name; return true; };
  const chips = h('div', { class: 'row' }, T.map(t => h('button', { class: t.theme === ACC.theme ? 'chip on' : 'chip', onclick: async () => { if (t.needs_unit && !(await pickAround())) return; ACC.theme = t.theme; accBuild(body); } }, t.label)));
  const out = h('div', {}, h('p', { class: 'dim' }, 'Building…'));
  body.replaceChildren(h('p', { class: 'faint' }, 'Pick what the team is for; My Summoner builds it from the units you own and says why each one is in.'), chips, out);
  if (!ACC.theme) { out.replaceChildren(h('p', { class: 'dim' }, 'No team themes available.')); return; }
  if (cur.needs_unit && !ACC.buildUnit) { out.replaceChildren(h('button', { class: 'primary', onclick: async () => { if (await pickAround()) accBuild(body); } }, 'Pick the unit to build around')); return; }
  const theme = ACC.theme, d = await msPart('builder/' + theme + (cur.needs_unit ? '?unit=' + ACC.buildUnit : ''));
  if (ACC.theme !== theme) return;
  const who = (m, lead) => h('div', { class: 'buildrow' }, h('a', { href: `#/units/${Number(m.unit_id)}` }, h('img', { src: unitIcon(Number(m.unit_id)), alt: '', width: 40, height: 40, loading: 'lazy' })),
    h('div', {}, h('b', {}, m.name), lead ? h('span', { class: 'tag gold' }, 'leader') : null, h('span', { class: 'faint' }, ` Lv ${m.level}/${m.max_level}`), m.ready ? null : h('span', { class: 'tag gold' }, 'not levelled'),
      h('p', {}, m.why || ''), (m.alternates || []).length ? h('p', { class: 'faint' }, 'Could also be: ' + m.alternates.map(a => a.name).join(', ')) : null));
  const team = [d.leader, ...(d.members || []).filter(m => !d.leader || m.user_unit_id !== d.leader.user_unit_id)].filter(Boolean);
  out.replaceChildren(
    h('div', { class: 'row' }, cur.needs_unit ? [h('span', { class: 'tag gold' }, `around ${ACC.buildName || 'your unit'}`), h('button', { class: 'chip', onclick: async () => { if (await pickAround()) accBuild(body); } }, 'another unit')] : null, h('span', { class: 'grow' }),
      team.length ? h('button', { class: 'chip', title: 'Put this team into the Team Builder as a plan you can change', onclick: () => { const name = `Plan: ${d.label || cur.label || 'team'}`; const units = team.slice(0, 5).map(m => Number(m.unit_id)); while (units.length < 5) units.push(null);
        const i = COLL.squads.findIndex(x => !x.live && x.name === name); const sq = { name, units, friend: null, spheres: {} }; if (i >= 0) COLL.squads[i] = sq; else COLL.squads.push(sq); COLL.active = i >= 0 ? i : COLL.squads.length - 1; COLL.save(); location.hash = '#/team'; } }, 'open in Team Builder') : null),
    d.status && d.status !== 'ok' ? h('p', { class: 'red' }, d.missing || `This team cannot be built from your box (${d.status}).`) : null,
    h('div', { class: 'box' }, d.leader ? who(d.leader, true) : null, (d.members || []).filter(m => !d.leader || m.user_unit_id !== d.leader.user_unit_id).map(m => who(m, false))),
    d.friend_tip && (d.friend_tip.why || d.friend_tip.look_for) ? h('p', { class: 'sphneed' }, h('b', {}, 'Friend leader: '), [d.friend_tip.look_for, d.friend_tip.why].filter(Boolean).join(' ')) : null,
    h('h2', {}, 'What it covers'), covRows(d.coverage) || h('p', { class: 'dim' }, 'No rating.'));
}

// ---- Story: where you are and what comes next
function accStory(body, d) {
  const S = (d && d.story) || {}, n = S.next, bar = (o, t) => h('div', { class: 'bar' }, h('div', { class: 'fill', style: `width:${t ? 100 * o / t : 0}%` }), h('span', {}, `${fmt(o)} / ${fmt(t)}`));
  body.replaceChildren(
    h('div', { class: 'box' }, h('div', { class: 'row' }, h('b', {}, `Story: ${S.percent ?? 0}% done`), h('span', { class: 'faint' }, S.current_area ? `you are in ${S.current_area.name}` : '')), bar(S.cleared || 0, S.total || 0)),
    n ? h('div', { class: 'box' }, h('div', { class: 'k faint' }, 'NEXT STORY QUEST'), h('p', {}, h('b', {}, n.name), h('span', { class: 'dim' }, ` · ${n.area_name || ''}${n.dungeon_name ? ' › ' + n.dungeon_name : ''}`)),
      h('p', { class: 'dim' }, [n.energy_text, n.why].filter(Boolean).join(' '))) : S.next_missing_why ? h('p', { class: 'dim' }, S.next_missing_why) : null,
    (S.worlds || []).length ? [h('h2', {}, 'Worlds'), h('div', { class: 'box' }, S.worlds.map(w => h('div', { class: 'kvrow' }, h('span', {}, w.name), bar(w.cleared || 0, w.total || 0), h('span', { class: 'faint' }, `${w.percent ?? 0}%`))))] : null,
    h('h2', {}, 'Other modes'), h('div', { class: 'box' }, Object.values((d && d.modes) || {}).map(m => h('div', { class: 'kvrow' }, h('span', {}, m.label), bar(m.cleared || 0, m.total || 0), h('span', { class: 'faint' }, m.last_cleared ? `last: ${m.last_cleared.name}` : '')))));
}

// ---- Collection: how much of the unit list you own, and the easiest additions
function accCollection(body, d) {
  const bar = (o, t) => h('div', { class: 'bar' }, h('div', { class: 'fill', style: `width:${t ? 100 * o / t : 0}%` }), h('span', {}, `${fmt(o)} / ${fmt(t)}`));
  const group = (title, list) => ((list || []).length ? [h('h2', {}, title), h('div', { class: 'box' }, list.map(x => h('div', { class: 'kvrow' }, h('span', {}, String(x.label).replace('â˜…', '★')), bar(x.owned || 0, x.total || 0), h('span', { class: 'faint' }, `${x.percent ?? 0}%`))))] : null);
  const L = (d && d.lines) || {};
  body.replaceChildren(
    h('div', { class: 'box' }, h('div', { class: 'row' }, h('b', {}, `${fmt(d.owned || 0)} of ${fmt(d.total || 0)} units`), h('span', { class: 'faint' }, `${d.percent ?? 0}% of everything playable · ${L.completed ?? 0} evolution lines finished, ${L.started ?? 0} started`)), bar(d.owned || 0, d.total || 0)),
    (d.easy_gets || []).length ? [h('h2', {}, 'Easy to add'), h('div', { class: 'box' }, d.easy_gets.map(e => h('div', { class: 'nextrow full' }, h('img', { src: unitIcon(Number(e.unit_id)), alt: '', width: 36, height: 36, loading: 'lazy' }), h('div', {}, h('b', {}, e.name), h('p', { class: 'dim' }, e.reason || '')))))] : null,
    group('By element', d.by_element), group('By rarity', d.by_rarity), group('By region', d.by_region));
}

function accHistoryMore(d) {
  const T = (d && d.top_missions) || {}, m30 = (T.last_30_days || []).slice(0, 5), w = T.last_7_days || {}, rec = (w.cleared_recently || []).slice(0, 6), old = ((d && d.longest_serving && d.longest_serving.rows) || []).slice(0, 5);
  return [
    m30.length ? [h('h2', {}, 'Last 30 days'), h('div', { class: 'box' }, m30.map(m => h('div', { class: 'kvrow' }, h('span', {}, m.name), h('span', {}, `${fmt(m.runs ?? m.clears ?? 0)} runs`), h('span', { class: 'faint' }, m.area_name || ''))))] : null,
    rec.length ? [h('h2', {}, `Cleared in the last 7 days (${fmt(w.runs || 0)} runs)`), h('div', { class: 'box' }, rec.map(m => h('div', { class: 'kvrow' }, h('span', {}, m.name), h('span', { class: 'faint' }, m.area_name || ''), h('span', { class: 'faint' }, m.last_cleared_at ? when(m.last_cleared_at) : ''))))] : null,
    old.length ? [h('h2', {}, 'With you the longest'), h('div', { class: 'box' }, old.map(u => h('div', { class: 'kvrow' }, h('a', { href: `#/units/${Number(u.unit_id)}` }, u.name), h('span', {}, `Lv ${u.level}`), h('span', {}))))] : null];
}

// ---- Items: what is in your item box
function accItems(body) {
  const items = ((MS.profile && MS.profile.items) || []).slice().sort((a, b) => a.type - b.type || String(a.name).localeCompare(String(b.name)));
  const P = (MS.profile && MS.profile.player) || {}, byType = {};
  for (const i of items) (byType[i.type] ||= []).push(i);
  body.replaceChildren(h('p', { class: 'faint' }, `Your item box: ${fmt((P.item_box || {}).used || items.length)} of ${fmt((P.item_box || {}).capacity || 0)} kinds. "Worn" means equipped on a unit right now.`),
    Object.entries(byType).map(([t, list]) => [h('h2', {}, (ITEM_TYPES[t] || 'Item') + (list.length ? ` (${list.length})` : '')),
      h('div', { class: 'box' }, list.map(i => h('div', { class: 'itemrow' }, h('img', { src: itemIcon(i.item_id), alt: '', width: 32, height: 32, loading: 'lazy' }), h('a', { href: `#/items/${i.item_id}` }, i.name),
        h('span', { class: 'num' }, `× ${fmt(i.owned ?? i.stock)}`), h('span', { class: 'faint' }, i.worn ? `${i.worn} worn, ${fmt(i.stock)} free` : ''))))]),
    items.length ? null : h('p', { class: 'dim' }, 'Your item box is empty.'));
}

// ---- Profile: the account itself
function accProfile(body) {
  const P = (MS.profile && MS.profile.player) || {}, C = (MS.profile && MS.profile.currencies) || {}, L = (MS.profile && MS.profile.login) || {};
  const kv = (k, v) => (v == null || v === '' ? null : h('div', { class: 'kvrow two' }, h('span', { class: 'dim' }, k), h('span', {}, v)));
  const day = t => (t ? fmtWhen.format(new Date(t * 1000)) : null), of = o => (o ? `${fmt(o.used ?? o.count ?? o.now ?? 0)} / ${fmt(o.capacity ?? o.max ?? 0)}` : null);
  const label = k => k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  const money = Object.entries(C).map(([k, v]) => typeof v === 'number' ? kv(label(k), fmt(v)) : v && typeof v === 'object' && !Array.isArray(v) && v.available != null ? kv(label(k), `${fmt(v.available)} free of ${fmt(v.total)}`) : null);
  const tokens = [...(C.event_tokens || []).map(t => kv(t.name, fmt(t.count))), ...(C.summon_tickets || []).map(t => kv(t.name || `Summon ticket ${t.id}`, fmt(t.count))), ...(C.selector_tickets || []).map(t => kv(t.name || `Selector ticket ${t.id}`, fmt(t.count)))];
  body.replaceChildren(
    h('h2', {}, 'Summoner'), h('div', { class: 'box' }, kv('Name', P.name), kv('Level', P.level != null ? `${P.level} · ${fmt(P.exp_to_next)} EXP to next` : null), kv('Friend ID', P.friend_id), kv('Playing since', day(P.joined_at)), kv('Last login', day(P.last_login_at)),
      kv('Hunter rank', P.hunter_rank), kv('Guild', P.guild ? (P.guild.name || 'yes') : 'none'), kv('Unit box', of(P.unit_box)), kv('Item box', of(P.item_box)), kv('Friends', of(P.friends)), kv('Squad cost cap', P.deck_cost_cap)),
    h('h2', {}, 'Currencies'), h('div', { class: 'box' }, money),
    tokens.length ? [h('h2', {}, 'Tokens and tickets'), h('div', { class: 'box' }, tokens)] : null,
    h('h2', {}, 'Lifetime'), h('div', { class: 'box' }, kv('Login days', L.login_days), kv('Login streak', L.streak), kv('Quest wins', fmt(L.quest_wins || 0)), kv('Units fused', fmt(L.units_fused || 0)), kv('Units evolved', fmt(L.units_evolved || 0)), kv('Best spark count', fmt(L.best_sparks || 0))));
}

// Support: the shape (keys and types, no values) of the account parts that have no page yet, written to the log.
async function accProbe(view) {
  const shape = (o, d = 0) => Array.isArray(o) ? (o.length ? [`${o.length} x`, shape(o[0], d + 1)] : []) : o && typeof o === 'object' ? (d > 4 ? '{..}' : Object.fromEntries(Object.entries(o).slice(0, 40).map(([k, v]) => [k, shape(v, d + 1)]))) : (typeof o === 'string' ? `str:${o.slice(0, 60)}` : o);
  const first = (MS.profile && MS.profile.units || []).slice().sort((a, b) => b.level - a.level)[0];
  const parts = ['progress', 'collection', 'builder', 'squads/1', 'squads/1/spheres', first ? `units/${first.user_unit_id}` : null, first ? `box/${first.user_unit_id}` : null].filter(Boolean);
  const out = h('pre', { class: 'faint' }); view.replaceChildren(h('h1', {}, 'Probe'), out);
  for (const p of parts) {
    try { const d = await msPart(p); console.warn('msprobe ' + p + ' ' + JSON.stringify(shape(d)).slice(0, 6000)); out.append(`${p}: ok\n`); }
    catch (e) { console.warn('msprobe ' + p + ' ERROR ' + e.status + ' ' + e.message); out.append(`${p}: ${e.status} ${e.message}\n`); }
  }
  try { const b = await msPart('builder'); const t = (b.themes || [])[0]; if (t && !t.needs_unit) { const d = await msPart('builder/' + t.theme); console.warn('msprobe builder/' + t.theme + ' ' + JSON.stringify(shape(d)).slice(0, 6000)); } } catch (e) { console.warn('msprobe builder-theme ERROR ' + e.message); }
  out.append('done\n');
}

// Support: tries what a user would tap (through the same functions and buttons) and logs each outcome as "mstest ...".
async function accSelfTest(view) {
  if (!MS.profile || accSelfTest.running) return; accSelfTest.running = true;   // once, and only after the account has loaded
  const log = (name, ok, info) => console.warn(`mstest ${ok ? 'OK  ' : 'FAIL'} ${name} ${info == null ? '' : String(info).slice(0, 300)}`);
  const step = async (name, fn) => { try { log(name, true, await fn()); } catch (e) { log(name, false, `${e.status || ''} ${e.message}`); } };
  const wait = ms => new Promise(r => setTimeout(r, ms)), byText = (root, re) => [...root.querySelectorAll('button, a')].find(b => re.test(b.textContent));
  const top = ((MS.profile && MS.profile.units) || []).slice().sort((a, b) => b.level - a.level)[0];
  let themes = [];
  await step('builder themes', async () => { themes = (await msPart('builder')).themes || []; return themes.map(t => t.theme + (t.needs_unit ? '*' : '')).join(','); });
  const around = themes.find(t => t.needs_unit);
  await step('build around a unit', async () => { const d = await msPart(`builder/${around.theme}?unit=${top.user_unit_id}`); return `${around.theme} status=${d.status} members=${(d.members || []).length}`; });
  await step('friend leader try-out', async () => { const a = await msPart('squads/1?kind=squad'), b = await msPart('squads/1?kind=squad&friend=850858'); return `friend=${b.friend ? b.friend.name || 'set' : 'null'}; coverage changed=${JSON.stringify(a.coverage) !== JSON.stringify(b.coverage)}`; });
  await step('evolution targets', async () => { const ev = ((await msPart('evolutions')).units || [])[0]; const d = await msPart(`evolutions?targets=${ev.user_unit_id}`); return `targets=${JSON.stringify(d.shopping_list && d.shopping_list.targets)} materials=${((d.shopping_list || {}).materials || []).length}`; });
  await step('Evolve: + list, then shopping list', async () => { await renderAccount(view, 'evolve'); const b = byText(view, /^\+ list$/); b.click(); const on = b.textContent; byText(view, /^Shopping list$/).click(); await wait(2500); return `button now "${on}", picked=${ACC.targets.size}, table rows=${view.querySelectorAll('table.shop tr').length}`; });
  ACC.targets.clear();
  await step('Squads: share', async () => { await renderAccount(view, 'squads'); await wait(1500); const b = byText(view, /share my squad/); b.click(); await wait(300); return 'clicked without error'; });
  await step('Squads: friend button present', async () => (byText(view, /try a friend leader/) ? 'yes' : 'missing'));
  await step('Build: open in Team Builder', async () => { ACC.theme = (themes.find(t => !t.needs_unit) || {}).theme; await renderAccount(view, 'build'); await wait(2500); const n = COLL.squads.length; byText(view, /open in Team Builder/).click(); await wait(300); const made = COLL.squads.find(x => /^Plan: /.test(x.name));
    const info = `squads ${n} -> ${COLL.squads.length}, plan="${made && made.name}", units=${made && made.units.filter(Boolean).length}, hash=${location.hash}`; if (made) { COLL.squads.splice(COLL.squads.indexOf(made), 1); COLL.active = 0; COLL.save(); } return info; });
  await step('item stock tag', async () => { const it = (MS.profile.items || [])[0]; const el = stockTag(it.item_id); return el && el.textContent; });
  await step('unit page advice', async () => { const el = msAdvice(Number(top.unit_id)); await wait(2500); return el ? el.textContent.slice(0, 160) : 'none'; });
  console.warn('mstest DONE');
  view.replaceChildren(h('p', {}, 'Self-test finished; see the log.'));
}
