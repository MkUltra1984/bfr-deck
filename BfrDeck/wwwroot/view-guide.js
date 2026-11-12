'use strict';
// Guide: a beginner path first (six first steps with checkboxes, the daily loop), then one card per topic that opens
// its own page. Content lives in guide.js. Search filters the topic cards.

function guideBody(entry) {
  if (typeof entry === 'string') return h('p', {}, entry);
  if (entry.h) return h('h3', {}, entry.h);
  if (entry.ul) return h('ul', {}, entry.ul.map(t => h('li', {}, t)));
  if (entry.kv) return h('table', { class: 'gkv' }, entry.kv.map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', { class: 'dim' }, v))));
  return null;
}
const guideText = s => norm([s.title, s.blurb || '', ...s.body.map(b => typeof b === 'string' ? b : b.h || (b.ul || []).join(' ') || (b.kv || []).flat().join(' '))].join(' '));
const utcDay = () => new Date().toISOString().slice(0, 10);

function renderGuide(view, id) {
  if (id && GUIDE.some(s => s.id === id)) return renderGuideTopic(view, id);
  const done = store.get('guideSteps', {});
  let daily = store.get('guideDaily', { day: '', done: {} }); if (daily.day !== utcDay()) daily = { day: utcDay(), done: {} };

  // --- first steps
  const progress = h('div', { class: 'gprog' });
  const stepsEl = h('div', { class: 'gsteps' });
  const drawSteps = () => {
    const n = GUIDE_STEPS.filter(s => done[s.id]).length;
    progress.replaceChildren(h('div', { class: 'bar' }, h('div', { class: 'fill', style: `width:${100 * n / GUIDE_STEPS.length}%` })),
      h('span', { class: 'num' }, n === GUIDE_STEPS.length ? 'All done. You are set up.' : `${n} of ${GUIDE_STEPS.length} done`));
    stepsEl.replaceChildren(...GUIDE_STEPS.map((s, i) => {
      const cb = h('input', { type: 'checkbox' }); cb.checked = !!done[s.id];
      cb.addEventListener('change', () => { done[s.id] = cb.checked; store.set('guideSteps', done); drawSteps(); });
      return h('label', { class: 'gstep' + (done[s.id] ? ' done' : '') }, cb,
        h('span', { class: 'gnum' }, String(i + 1)), h('span', { class: 'gicon' }, s.icon),
        h('span', { class: 'gtext' }, h('b', {}, s.title), h('span', {}, s.line),
          h('details', {}, h('summary', {}, 'Why and how'), h('p', {}, s.more))));
    }));
  };
  drawSteps();

  // --- daily loop (resets at 00:00 UTC)
  const dailyEl = h('div', { class: 'gdaily' });
  const drawDaily = () => {
    const n = GUIDE_DAILY.filter((_, i) => daily.done[i]).length;
    dailyEl.replaceChildren(h('div', { class: 'row', style: 'align-items:baseline' }, h('h2', { style: 'margin:0' }, 'Every day'), h('span', { class: 'faint grow' }, `${n}/${GUIDE_DAILY.length} today · resets 00:00 UTC`),
      h('a', { class: 'chip', href: '#/guide/daily' }, 'reset times')),
      h('div', { class: 'gchecks' }, GUIDE_DAILY.map((t, i) => { const cb = h('input', { type: 'checkbox' }); cb.checked = !!daily.done[i];
        cb.addEventListener('change', () => { daily.done[i] = cb.checked; store.set('guideDaily', daily); drawDaily(); });
        return h('label', { class: daily.done[i] ? 'done' : '' }, cb, h('span', {}, t)); })));
  };
  drawDaily();

  // --- topics
  const q = h('input', { type: 'search', placeholder: 'Search the guide… (frog, zel, selector, imp)', style: 'flex:1' });
  const cards = h('div', { class: 'gcards' });
  const drawCards = () => {
    const nq = norm(q.value);
    const hits = GUIDE.filter(s => !nq || guideText(s).includes(nq));
    cards.replaceChildren(...(hits.length ? hits.map(s => h('a', { class: 'gcard', href: `#/guide/${s.id}` },
      h('span', { class: 'gicon' }, s.icon), h('b', {}, s.title), h('span', { class: 'dim' }, s.blurb))) : [h('p', { class: 'dim' }, 'Nothing in the guide matches. Try another word.')]));
  };
  let t = 0; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(drawCards, 80); });
  drawCards();

  // --- notes and links, folded away
  const notes = h('textarea', { rows: 4, style: 'width:100%;background:var(--bg2);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:6px;font:inherit', placeholder: 'Your notes (friend IDs, squads, todo)…' });
  notes.value = store.get('notes', '');
  notes.addEventListener('input', () => store.set('notes', notes.value));
  const link = (label, href, key, note) => h('li', {}, siteLink(label, href, key), note ? h('span', { class: 'faint' }, ' · ' + note) : null);

  view.replaceChildren(h('div', { class: 'guide' },
    h('div', { class: 'ghero' }, h('h1', {}, 'New here? Start with these six.'), h('p', { class: 'dim' }, 'Brave Frontier Revived is a free fan server of the original game. Tick a step when it is done; the deck remembers.'), progress),
    stepsEl,
    dailyEl,
    h('div', { class: 'row', style: 'margin-top:22px;align-items:baseline' }, h('h2', { style: 'margin:0' }, 'Learn as you go'), q),
    cards,
    h('details', { class: 'cat', style: 'margin-top:18px' }, h('summary', {}, 'Your notes'), h('div', { class: 'catbody' }, notes)),
    h('details', { class: 'cat' }, h('summary', {}, 'Links and tools'), h('div', { class: 'catbody' }, h('ul', {},
      h('li', {}, h('a', { href: '#', onclick: e => { e.preventDefault(); host.browser(RULES.discord); } }, 'BF Revived Discord'), h('span', { class: 'faint' }, ' · APK, guide, summon-list, banner-rotation, tracker, patch-notes')),
      link('bfrevive.net', '/', undefined, 'units, items, gates, this week'),
      link('BF Companion (web)', 'https://bfcompanion.app/', 'companion', 'offline guide app, team builder, tier list'),
      link('Summoner EXP calculator', 'https://altivu.github.io/EXPCalc/', 'exp', 'Summoner’s Arc training EXP / STP'),
      link('Brave Frontier Multi-Tool', 'https://joshuacastor.me/bf-mt/#/', 'bfmt', 'original-game unit and item explorer'),
      link('Project Sparkle', 'https://joshuacastor.me/project-sparkle/', 'sparkle', 'spark order simulator'),
      link('Summoner’s Handbook', 'https://docs.google.com/document/d/16rQMn6TITW1MWWM_ple0M-l0w4Kykm6ImFbYqpGizSA/preview', 'handbook', 'what to buy first, where to get currencies, spheres, elgifs (original game)'),
      link('Resources Management Guide 2021', 'https://docs.google.com/document/d/1NlW8f8qVPJ6H1UwfNdAWuOl4gBDN4z1FPzzEYmt510Q/preview', 'resources', 'what to keep and what to sell'),
      link('Wiki: detailed buff lists', 'https://bravefrontierglobal.fandom.com/wiki/Category:Detailed_Buff_Lists', 'wiki')))),
    h('p', { class: 'faint', style: 'margin-top:14px' }, 'Written from the BF Revived Discord FAQ and beginner guide (Oct–Nov 2026). Live data: bfrevive.net. Not affiliated with the BFR team, gumi or Alim.'),
    updLine()));
}

// One topic on its own page: back link, title, the content, then the neighbouring topics.
function renderGuideTopic(view, id) {
  const i = GUIDE.findIndex(s => s.id === id); const s = GUIDE[i];
  const prev = GUIDE[(i + GUIDE.length - 1) % GUIDE.length], next = GUIDE[(i + 1) % GUIDE.length];
  view.replaceChildren(h('div', { class: 'guide topic' },
    backLink('#/guide'),
    h('h1', {}, h('span', { class: 'gicon' }, s.icon), ' ', s.title),
    s.blurb ? h('p', { class: 'dim lead' }, s.blurb) : null,
    h('div', { class: 'box gbody' }, s.body.map(guideBody)),
    h('div', { class: 'row', style: 'margin-top:14px;justify-content:space-between' },
      h('a', { class: 'chip', href: `#/guide/${prev.id}` }, '‹ ' + prev.title), h('a', { class: 'chip', href: `#/guide/${next.id}` }, next.title + ' ›'))));
}
