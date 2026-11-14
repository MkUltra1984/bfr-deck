'use strict';
// Router and data bootstrap.

const VIEWS = { home: renderHome, account: renderAccount, units: renderUnits, items: renderItems, summon: renderGates, gates: renderGates, team: renderTeam, guide: renderGuide, quests: renderQuests, vortex: renderVortex, gq: renderGrandQuest, scan: renderScan, tier: renderTier };
const NAV_OF = { items: 'units', gates: 'summon', scan: 'units', vortex: 'quests', gq: 'quests' };
let ready = false;

function route() {
  const m = location.hash.match(/^#\/(\w+)(?:\/(\w+))?(?:\/([\w-]+))?/);
  const name = m && VIEWS[m[1]] ? m[1] : 'home';
  const arg = m ? m[2] : null;
  if (name === 'home' && arg === 'reset' && m[3]) {   // #/home/reset/box | all: support route for a fresh start (caches are kept)
    const keep = ['unitHashes', 'roleCache2'];
    if (m[3] === 'box') { COLL.owned = new Set(); COLL.marks = new Set(); COLL.squads = [{ name: 'Squad 1', units: [null, null, null, null, null], friend: null, spheres: {} }]; COLL.active = 0; COLL.save(); for (const k of ['unitCounts', 'boxTotal', 'boxScannedAt']) localStorage.removeItem(k); }
    else if (m[3] === 'all') { for (const k of Object.keys(localStorage)) if (!keep.includes(k)) localStorage.removeItem(k); }
    location.replace(location.pathname + '#/home'); location.reload(); return;
  }
  if (name === 'home' && arg === 'setsquad1' && m[3]) {   // #/home/setsquad1/<id-id-id-id-id>: restore Squad 1 (support)
    COLL.squads[0].units = m[3].split('-').map(x => x === '0' ? null : Number(x)).slice(0, 5); while (COLL.squads[0].units.length < 5) COLL.squads[0].units.push(null); COLL.save(); location.hash = '#/home'; return;
  }
  if (name === 'scan' && arg === 'debug') {   // #/scan/debug/10312-30131: log those cells' badge crops during the next scans (support); #/scan/debug/off clears
    store.set('scanDebugIds', m[3] && m[3] !== 'off' ? m[3].replace(/-/g, ',') : ''); toast(m[3] && m[3] !== 'off' ? `Badge crops logged for ${m[3].split('-').length} unit(s)` : 'Badge crop logging off'); location.hash = '#/scan'; return;
  }
  if (name === 'home' && arg === 'intro' && ready) {   // #/home/intro[/N]: replay the introduction, optionally at tour card N (support / screenshots)
    for (const a of document.querySelectorAll('#nav a')) a.classList.toggle('on', a.dataset.v === 'home');
    renderHome($('view')); location.replace(location.pathname + '#/home'); showIntro(true, Number(m[3]) || 0); return;
  }
  if (name === 'home' && arg === 'pulled' && ready) {   // #/home/pulled: open the "I pulled…" picker of the current gate (support / screenshots)
    for (const a of document.querySelectorAll('#nav a')) a.classList.toggle('on', a.dataset.v === 'home');
    renderHome($('view'), m[3] || null); setTimeout(() => { const b = [...document.querySelectorAll('.pulltile .chip')].find(x => x.textContent.startsWith('I pulled')); if (b) b.click(); }, 1200); return;
  }
  if (name === 'vortex' && arg === 'area' && m[3]) {   // #/vortex/area/<areaId>
    for (const a of document.querySelectorAll('#nav a')) a.classList.toggle('on', a.dataset.v === 'quests');
    if (ready) { renderArea($('view'), Number(m[3])); $('view').scrollTop = 0; }
    return;
  }
  for (const a of document.querySelectorAll('#nav a')) a.classList.toggle('on', a.dataset.v === (NAV_OF[name] || name));
  const view = $('view');
  if (!ready) { view.replaceChildren(h('p', { class: 'dim' }, 'Loading game data…')); return; }
  if (name !== 'home') clearInterval(homeTimer);
  VIEWS[name](view, arg);
  view.scrollTop = 0;
  if (name === 'home' && m && m[3] && /^\d+$/.test(m[3])) { const y = Number(m[3]); view.scrollTop = y; setTimeout(() => { view.scrollTop = y; }, 1500); }   // #/home/<gate>/<px>: start scrolled (support / screenshots)
}

function showAge() {
  const el = $('dataAge');
  if (!DATA.builtAt) { el.textContent = ''; return; }
  const age = Date.now() / 1000 - DATA.builtAt;
  el.textContent = (DATA.stale ? 'offline copy · ' : '') + 'data ' + (age < 3600 ? `${Math.floor(age / 60)}m` : `${Math.floor(age / 3600)}h`) + ' old';
  el.title = `Game data built ${when(DATA.builtAt)}`;
}

async function boot(fresh) {
  const errors = await loadAll(fresh);
  ready = !!(DATA.units || DATA.items || DATA.summons);
  showAge();
  if (errors.length) toast(ready ? `Some data failed: ${errors.join(', ')}` : 'Could not load game data. Is bfrevive.net reachable?');
  route();
  if (ready && !fresh && (!location.hash || /^#\/home\/?$/.test(location.hash))) showIntro();   // first start only, and not over a deep link
}

glossaryInit();
msBoot();   // My Summoner: a remembered login reads the account at start
$('refresh').addEventListener('click', async () => { $('refresh').disabled = true; await boot(true); $('refresh').disabled = false; toast('Game data refreshed'); });
window.addEventListener('hashchange', route);
setInterval(showAge, 60000);
// Re-pull the feeds every 3 hours while the deck stays open (the host pushes twice a day).
setInterval(() => boot(true), 3 * 3600 * 1000);
boot(false);
