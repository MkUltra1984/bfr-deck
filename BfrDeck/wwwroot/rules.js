'use strict';
// Server-specific rules, as posted in the BF Revived Discord beginner guide (October / November 2026).
// These differ from the original game; update here when the balancers change them.

const RULES = {
  resets: [
    { key: 'daily', label: 'Dailies', note: 'Daily tasks, login spin, calendar, slot medals, friend gifts', utcHour: 0 },
    { key: 'vortex', label: 'Vortex day + keys', note: 'Weekday dungeon and daily keys switch', utcHour: 15 },
    { key: 'weekly', label: 'Weekly selector', note: 'New roster of 10 and new banner week', utcHour: 0, weekday: 5 }, // Friday
  ],
  checklist: [
    'Open the gift box (presents, calendar prizes, 120 slot medals)',
    'Daily Login Spin',
    'Collect keys at the Summoners’ Hall office (3 Metal, 3 Jewel, 3 Imp)',
    'Daily Tasks (3 per day, pay Brave Points)',
    'Run today’s Vortex dungeon',
    'Use friend helpers for Honor; add good leaders',
    'Spin Brave Slots with the free medals',
    'Out of energy? Refill for free',
  ],
  frogs: [
    { name: 'Burst Frog', bb: 1, sp: 1, merit: 1000 },
    { name: 'Lawson Frog', bb: 2, sp: 2, merit: 0 },
    { name: 'Burst Emperor', bb: 5, sp: 5, merit: 4000 },
    { name: 'Burst Queen', bb: 20, sp: 20, merit: 10000 },
  ],
  spExtra: [
    { name: 'Duplicate of the unit (any form)', sp: 5, merit: 0 },
    { name: 'Omni Frog', sp: 30, merit: 12000 },
    { name: 'Sphere Frog (only if the 2nd slot is already open)', sp: 10, merit: 8000 },
  ],
  maxLevel: { 1: 15, 2: 30, 3: 40, 4: 60, 5: 80, 6: 100, 7: 120, 8: 150 },
  evoZel: { 2: 2500, 3: 100000, 4: 200000, 5: 500000, 6: 1500000, 7: 3000000 },   // from rarity N to N+1
  evoKarma: { 7: 1000000 },
  evoSpecialZel: { 'Atro': 50000, 'Magress': 50000 },  // 2★→3★ for these starters
  // Starter-line recipes, by element. {E} is the element name.
  evoMaterials: {
    2: ['{E} Nymph'],
    3: ['{E} Idol', '{E} Spirit'],
    4: ['{E} Totem', '{E} Idol', '{E} Spirit', '{E} Nymph', '{E} Nymph'],
    5: ['Miracle Totem', '{E} Totem', '{E} Idol', '{E} Spirit', '{E} Nymph'],
    6: ['{E} Mecha God', 'Miracle Totem', '{E} Totem', '{E} Idol', 'Legend Stone'],
    7: ['{E} Mecha God', '{E} Mecha God', 'Miracle Totem', '{E} Totem', '{E} Idol', '{E} Spirit', '{E} Nymph', 'Legend Stone'],
  },
  meritShop: [
    ['Miracle Totem', 1000], ['Mecha God (any element)', 1000], ['Element Totem', 500],
    ['Mimic', 50], ['Bat Mimic', 100], ['Dragon Mimic', 300], ['Metal Mimic', 500],
    ['Legend Stone', 4000], ['Burst Frog', 1000], ['Burst Emperor', 4000], ['Burst Queen', 10000],
    ['Sphere Frog', 8000], ['Omni Frog', 12000], ['Basic Imp (each)', 500], ['Almighty Imp Arton', 4000],
  ],
  imps: [
    { name: 'Power Imp Pakpak', stat: 'atk', val: 20 }, { name: 'Guard Imp Ganju', stat: 'def', val: 20 },
    { name: 'Healing Imp Fwahl', stat: 'rec', val: 20 }, { name: 'Vigor Imp Molin', stat: 'hp', val: 50 },
  ],
  arton: { name: 'Almighty Imp Arton', hp: 150, atk: 60, def: 60, rec: 60, merit: 4000 },
  impCaps: { 7: { hp: 1100, atk: 440, def: 440, rec: 440 }, 8: { hp: 1500, atk: 600, def: 600, rec: 600 } },
  gatePrices: [
    ['Rare Summon: All Star', '1 gem (5★ 5.9% / 4★ 31.9% / 3★ 62.2%)'], ['Honor Summon', '200 Honor'],
    ['Legacy / Veteran Summon', '10 gems, 199 different 7★ equally likely'],
    ['DEEMO', '3 gems'], ['Chain Chronicle, Collab Mix', '5 gems'], ['Vocaloid, FFBE, Guilty Gear, SMT IV', '10 gems'],
    ['KOF, Fairy Tail, My Hero Academia, Tokyo Ghoul, Trigun', '15 gems'],
  ],
  gemUses: [
    ['Unit space', '+20 slots per gem (text says +5)'], ['Friend space', '+5 per gem'], ['Revive in a quest', '1 gem'],
    ['SP reset', '1 gem'], ['Energy', 'free, never spend gems'], ['Arena orbs', 'free refill'],
  ],
  // What the Enhancement (daily) Vortex dungeons are for. From the server data (captures / drops) and the Discord
  // guide where the data has no rows (the two Souls dungeons only list enemies: they are Karma runs).
  // `pics`: what to draw on the card: unit ids (their icons), or an image under wwwroot/img/. The currency art is
  // redrawn as SVG (gem.svg, zel.svg, karma.svg) in the look of the in-game HUD; a missing image falls back to the badge.
  vortexGives: {
    'Gathering of Souls': { text: 'Karma farm (Sacred Land of the Souls)', badge: 'Karma', pics: ['img/karma.svg'] },
    'Souls Training Ground': { text: 'Karma farm · basic Imps per the guide', badge: 'Karma', pics: ['img/karma.svg', 10452, 20442, 30432] },
    'Faerie Paradise': { text: 'Nymphs, Spirits, Idols, Pots' },
    'Cave of Greed': { text: 'Mimic, Bat Mimic, Dragon Mimic' },
    'Garden of God': { text: 'Element Totems · Miracle Totem (Lv4)' },
    'The Mecha Gods Awaken': { text: 'Mecha Gods' },
    'Remains of Eternity': { text: 'Spirits (Lv5) · Burst Frogs · crafting materials' },
    'Golden Slumberland': { text: 'Jewel Ghost / King / God: sell for Zel', badge: 'Zel', pics: ['img/zel.svg', 50133] },
    'Guardians of Lore': { text: 'Imps (Lv7) · Elgif tablets', pics: [10452, 20442, 30432, 40432] },
    'Hall of Melody': { text: 'Tones · Burst Frog · Metal God' },
    'Bulb Haven': { text: 'Element Bulbs · Miracle Bulb' },
  },
  // Curated tier overrides for the Tier list page: unit ids per tier (from community guides). Empty until filled;
  // the formula ranks everything else.
  tierCurated: { S: [], A: [], B: [], C: [] },
  // Unit › Unit List layout in game pixels (1080 wide). Columns are fixed; the list scrolls vertically, so the
  // scanner sweeps each column from yFrom to yTo. Measured from a BlueStacks capture on 2026-11-08.
  // Refined 2026-11-08 by maximising correlation with known units on a real frame (ncc 0.97–0.99 at these values).
  unitList: { x0: 44.6, w: 173.5, pitchX: 207.8, cols: 5, h: 173.5, pitchY: 198.5, yFrom: 440, yTo: 1688 },   // every row that is fully visible (ends above yTo) counts; a clipped one waits for the next frame
  vortexWeek: [
    ['Monday', 'Gathering of Souls › Souls Training Ground: Soul Sanctuary Lv1-4 (basic Imps)'],
    ['Tuesday', 'Faerie Paradise (Nymphs, Spirits, Idols, Pots)'],
    ['Wednesday', 'Cave of Greed › The Box of Desires (Mimic, Bat Mimic, Dragon Mimic)'],
    ['Thursday', 'Golden Slumberland › Gold Valley Lv1-3 (Jewel Ghost/King/God: sell for Zel)'],
    ['Friday', 'Remains of Eternity › The Wandering Spirit (Spirits; only Lv5 has drops)'],
    ['Saturday', 'Garden of God › Ruins of each element (Totems) + Ruins of Miracles (Miracle Totem)'],
    ['Sunday', 'Garden of God › Ruins of each element (Totems) + Ruins of Miracles (Miracle Totem)'],
  ],
  tips: [
    'Only Burst Frogs raise BB level here. Feeding same-BB units does nothing.',
    'Evolving halves BB and SBB levels. Feed frogs after the final evolution.',
    'Levels go to BB first; at BB 10 the SBB unlocks and the rest goes to SBB.',
    'Normal units give 0 SP on this server. Dupes give 5.',
    'Imp a unit at its final form; the cap is highest there.',
    'Materials marked favorite cannot be used in evolution.',
    'Legend Stone never drops; Merit Shop only (4,000).',
    'Squad 10 with all units favorited lets you use your own units as a friend lead.',
    'Link your account now: MENU > Account > email + code. One device per account at a time.',
    'BlueStacks memory leak: play 3-4 h, close it fully, reopen.',
  ],
  bluestacksWarnHours: 3,
  discord: 'https://discord.gg/EmKEcR3ju4',
};

// Cheapest Merit cost to obtain at least `need` points using the given sources (unbounded knapsack).
function cheapestMerit(need, sources) {
  const srcs = sources.filter(s => s.merit > 0 && s.value > 0);
  const max = need + 40;
  const best = Array(max + 1).fill(Infinity); const pick = Array(max + 1).fill(null);
  best[0] = 0;
  for (let n = 1; n <= max; n++) for (const s of srcs) {
    const prev = Math.max(0, n - s.value);
    if (best[prev] + s.merit < best[n]) { best[n] = best[prev] + s.merit; pick[n] = s; }
  }
  let bestN = need; for (let n = need; n <= max; n++) if (best[n] < best[bestN]) bestN = n;
  const counts = new Map(); let n = bestN;
  while (n > 0 && pick[n]) { const s = pick[n]; counts.set(s.name, (counts.get(s.name) || 0) + 1); n = Math.max(0, n - s.value); }
  return { merit: best[bestN], got: bestN, counts };
}
