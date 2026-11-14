'use strict';
// The first-start tour: a welcome card, one card per part of the deck (shown over the tab it describes), and a last
// card that offers the sign-in.
// ---- first-start intro: four short screens, then straight into the scanner or the unit list.
function showIntro(force = false, startAt = 0) {
  if (!force && store.get('seenIntro', 0)) return;
  // A guided tour: the welcome card sits in the middle; the tour cards sit at the bottom while the tab they describe
  // is shown behind them; the last card offers the sign-in.
  // `focus` is a selector inside #view: that panel is scrolled into view and outlined while its card is shown.
  const pages = [
    { title: 'Welcome to BFR Deck', text: 'A read-only companion for Brave Frontier Revived. It reads the public data of bfrevive.net and, if you sign in, your own account from My Summoner. It never touches the game: no input, no memory, no network tricks, nothing the server rules forbid. Let me show you around.', centre: true },
    { title: 'Home: your header', route: '#/home', focus: '#home-top', text: 'Your name and level, how long the emulator has been running (with a warning past the three hours the server FAQ cautions about), and the dock and live buttons. Live reads your name, gems, Zel and Karma from the game header; it is off until you click it.' },
    { title: 'Home: your account, live', route: '#/home', focus: '.mspanel', text: 'Sign in with your game login and the deck reads your account from My Summoner (bfrevive.net): level, energy, arena orbs, gifts, your real squads and what to do next. Your login goes only to bfrevive.net, and the deck only reads; it never changes your account. Without signing in, everything else works as before.' },
    { title: 'My Account', route: '#/account', text: 'Once signed in: a to-do list, your squads with what each one covers and which of your spheres to put where, a team builder that picks from your box, what your units need to evolve with a shopping list, challenges, story progress, your collection, your items and your history.' },
    { title: 'Home: currencies and timers', route: '#/home', focus: '.tiles > .tile:nth-child(1)', text: 'Gems, Zel and Karma as read from the game, each with what it is for. Below them the three reset timers: dailies, the Vortex day switch and the weekly selector. The stripe turns yellow and red as a reset gets close.' },
    { title: 'Home: your squad', route: '#/home', focus: '.stagetile', text: 'Squad 1 on stage with the real battle sprites on element-lit platforms, its cost, elements and leader skill. Signed in, these are your real squads from the game, each with its check; otherwise click a slot to pick a unit. "edit" opens the Team Builder.' },
    { title: 'Home: Should I pull?', route: '#/home', focus: '.pulltile', text: 'Cycle through this week’s banners and the permanent gates. The verdict says how much of a pull is new to you and what a new unit costs in gems. "See odds and bars" opens the chance per rarity and how much of the gate you already own. "I pulled…" logs a summon session in one go.' },
    { title: 'Home: Meta Units', route: '#/home', focus: '.metabox', text: 'The five strongest units of the selected gate by the deck’s score. Click the dots or drag to browse; the title opens the Tier List.' },
    { title: 'Home: Featured this week', route: '#/home', focus: '.marquee', text: 'The collab and rate-up units of the week walk past; hold the mouse button to drag the strip. Below: this week’s banners with their price and time left, and what comes next week.' },
    { title: 'Home: Vortex Gate', route: '#/home', focus: '.vortextile', text: 'The week as day chips (click one to preview another day), a card per open dungeon with what it gives in plain words and its captures or drops as pictures, the running event and when it switches. A card opens the dungeon page.' },
    { title: 'Units', route: '#/units', focus: '.filters', text: 'Search every unit (typos are fine) with element, rarity and owned filters, as cards or as a table. Open a unit for its sprite, stats, skills, roles and where to get it. Mark units as owned (✔) or bookmarked (★).' },
    { title: 'Box', route: '#/units/box', focus: '.box', text: 'Your collection: progress per rarity and element, your owned units with their team labels and this tour. Signed in, the box is read from your account every time you start the deck.' },
    { title: 'Tier List', route: '#/tier', text: 'Every unit ranked S to C by the deck’s score: max stats against the best in the game plus the roles its skills cover. Filter by element, rarity, role or just the units you own; tiers fold. A guide for building, not gospel.' },
    { title: 'Summon', route: '#/summon', text: 'This week’s banners, next week’s, the always-open gates and the rotation with dates. A gate page lists its pool by rarity with every unit’s chance and tells you whether a pull is worth it against your box.' },
    { title: 'Quests', route: '#/quests', text: 'The whole Vortex Gate as a catalog, grouped like the in-game gate, with sub-tabs for Grand Quest, Story, Frontier Hunter, Frontier Gate and Trials. Each dungeon shows what it gives, its captures with their chance, drops, clear rewards and enemies.' },
    { title: 'Team Builder: slots', route: '#/team', focus: '.slots', text: 'Six slot cards: five units and the friend lead. ★ makes a unit the leader, ⇄ swaps it, ✕ removes it, drag a card onto another to reorder. The two circles are the sphere slots. Only the leader’s and the friend’s leader skills count.' },
    { title: 'Team Builder: totals and buffs', route: '#/team', focus: '.matrix', text: 'Cost, HP, ATK, DEF, REC and hit count for the squad (with or without imps), both leader skills side by side, and "Who brings what": which slot covers healing, mitigation, BB fill, buffs and so on. Effects not yet covered are marked.' },
    { title: 'Team Builder: fill the gaps and share', route: '#/team', focus: '.gaprow', text: 'For each effect not yet covered, the best units from your box; click one to put it in. At the bottom a team code you can copy and paste to share the squad with another BFR Deck user, plus export, import and the calculators.' },
    { title: 'Guide and glossary', route: '#/guide', text: 'Six first steps with a checkbox each, the daily loop that resets every day, and one card per topic (currencies, frogs, evolution, imps, spheres, farming days, summons). Everywhere in the deck, game terms carry a dotted underline: hover one for a plain-words explanation.' },
    { title: 'Dock and Pin', route: '#/home', text: 'In the title bar: Dock snaps the deck beside your emulator and keeps the two together when either window moves. Pin keeps the deck on top. The tabs next to the title open bfrevive.net and the wiki inside the deck.' },
    { title: 'Your units', route: '#/home', text: 'The deck gets useful once it knows your box: pull odds show what is new to you, the Tier List can show only what you own, and the Team Builder suggests from it. Sign in with your game login and the deck reads your box, squads and items from your account. Or skip it and tick units by hand.', centre: true, end: true },
  ];
  let i = Math.min(startAt, pages.length - 1);
  const title = h('h2', { style: 'margin:0 0 6px' }), body = h('p', {}); const dots = h('div', { class: 'dots' });
  const next = h('button', { class: 'primary' }); const back = h('button', {}, 'Back');
  const scanBtn = h('button', { class: 'primary', onclick: () => { close(); location.hash = '#/home'; msSignIn(() => { if (MS.redraw) MS.redraw(); }); } }, 'Sign in');
  const handBtn = h('button', { onclick: () => { close(); location.hash = '#/home'; } }, 'Later');
  const overlay = h('div', { class: 'overlay intro' }, h('div', { class: 'modal' }, h('img', { src: 'img/gem.png', alt: '', class: 'introgem' }), title, body, dots,
    h('div', { class: 'row', style: 'margin-top:12px' }, back, h('span', { class: 'grow' }), h('button', { class: 'icon', onclick: () => { close(); location.hash = '#/home'; } }, 'Skip tour'), next),
    h('div', { class: 'row introend', style: 'margin-top:10px;display:none' }, scanBtn, handBtn)));
  const close = () => { store.set('seenIntro', 1); overlay.remove(); for (const el of document.querySelectorAll('.tourfocus')) el.classList.remove('tourfocus'); };
  const draw = () => {
    const p = pages[i];
    title.textContent = p.title; body.textContent = p.text;
    dots.replaceChildren(...pages.map((_, k) => h('span', { class: k === i ? 'on' : '' })));
    overlay.classList.toggle('tour', !p.centre);
    back.style.visibility = i ? '' : 'hidden'; next.textContent = i === 0 ? 'Show me' : 'Next';
    overlay.querySelector('.introend').style.display = p.end ? '' : 'none';
    next.style.display = p.end ? 'none' : '';
    if (p.route && location.hash !== p.route) location.hash = p.route;
    for (const el of document.querySelectorAll('.tourfocus')) el.classList.remove('tourfocus');
    if (p.focus) { let tries = 0; const find = () => { const el = document.querySelector('#view ' + p.focus); if (el) { el.classList.add('tourfocus'); el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } else if (++tries < 20) setTimeout(find, 100); }; setTimeout(find, 150); }
    else $('view').scrollTop = 0;
  };
  next.onclick = () => { i++; draw(); }; back.onclick = () => { i--; draw(); };
  document.body.append(overlay); draw();
}
