'use strict';
// Beginner guide for BF Revived, written from the Discord FAQ and beginner guide (Oct–Nov 2026).
// Each section: what it is, where to find it in the game, what to do with it.
// Body entries: a string is a paragraph; {ul:[...]} a list; {kv:[[k,v],...]} a two-column table; {h:'...'} a sub-heading.

// The landing page: six first steps with a checkbox each, the daily loop, then one card per topic below.
const GUIDE_STEPS = [
  { id: 'link', icon: '🔗', title: 'Link your account', line: 'MENU › Account › your email › enter the code from the mail. This protects your save.', more: 'Without the link a crash or a reinstall can lose everything. One device per account; to switch devices use title screen › Log in with the same email.' },
  { id: 'gems', icon: '💎', title: 'Claim 30 free gems', line: 'In the Discord channel gem-gift-ign type /claim and your friend ID.', more: 'Your ID is on the title screen and under Social. Once per account. Gems cannot be bought on this server, so every one counts.' },
  { id: 'story', icon: '🗺️', title: 'Play the story', line: 'Home › Quests. First clears pay gems, and levels unlock everything else.', more: 'Energy refills are free here. Never spend gems on energy.' },
  { id: 'select', icon: '🎁', title: 'Pick strong units from the selectors', line: 'Summon › 50 Gem Selector, plus the weekly 10-unit selector ticket from your gift box.', more: 'Tap and hold a unit to read it before you choose. Aim for 6★ or better units that cover healing, mitigation and BB fill. The Team Builder in this deck shows what your squad still lacks.' },
  { id: 'team', icon: '⚔️', title: 'Build one team and finish it', line: 'Fuse same-element food, evolve, then frogs and imps. One strong squad beats five half-done ones.', more: 'Frogs only after the final evolution (evolving halves BB levels). Imps at the final form, where the caps are highest. Spend Merit on Miracle Totems, Mecha Gods, Legend Stones and frogs.' },
  { id: 'daily', icon: '📅', title: 'Make the daily loop a habit', line: 'Gift box, login spin, keys, three Daily Tasks, today’s Vortex, Brave Slots. Ten minutes.', more: 'Dailies reset at 00:00 UTC, the Vortex day switches at 15:00 UTC. The Home tab counts down to both.' },
];
const GUIDE_DAILY = [
  'Open the gift box: calendar prize and 120 free Brave Slot medals',
  'Daily Login Spin',
  'Summoners’ Hall office: collect 3 Metal, 3 Jewel and 3 Imp keys',
  'Do the three Daily Tasks',
  'Run today’s Vortex dungeon (the Home tab says what it gives)',
  'Use friend helpers for Honor points',
  'Spin Brave Slots with the free medals',
];

const GUIDE = [
  { id: 'start', title: 'Account, rules and reroll', icon: '🛡️', blurb: 'Linking, one device per account, what gets you banned, how to reset.', body: [
    'BF Revived (BFR) is a fan-run revival of Brave Frontier Global on a private server. It is free and has no real-money shop.',
    { h: 'Do this first' },
    { ul: [
      'Link your account: MENU > Account > type your email > enter the code from your mail. Without this a crash or reinstall can lose your save.',
      'Claim 30 free gems: in the Discord channel gem-gift-ign, use /claim followed by your friend ID (ID is on the title screen and under Social).',
      'One device may be logged in to one account at a time. To move devices: title screen > Log in > email + code.',
      'On BlueStacks, play 3-4 hours at a time and close it fully in between: the FAQ warns of a memory leak that can corrupt data.',
    ] },
    { h: 'Rules that get you banned' },
    'Macros, auto-clickers, modded APKs, modified emulators, cheat engines and injections. V20 locks out old or modified clients. This deck only reads public website data and never touches the game.',
    { h: 'Reset / reroll your account' },
    'Menu > Reset Account > keep the 6-digit code > Social > Add Friend > enter the code > confirm > close the game. Wait 2-5 minutes, reopen, and the tutorial restarts.',
  ] },

  { id: 'screen', title: 'Where everything is', icon: '🧭', blurb: 'The six tabs of the game and where the gift box, keys and achievements hide.', body: [
    'The bottom bar has six tabs. Most things you will look for live here:',
    { kv: [
      ['Home', 'Quests (story), Vortex Gate (daily dungeons, collabs, Seasons Past), Arena, Raid, Frontier Hunter, Summoners’ Hall, banners.'],
      ['Unit', 'Your box: View Unit (stats, imp bonus, favorite), Fuse (level up, frogs, imps), Evolve, Spheres, Squads (Squad 10 = your own helper, see Squads).'],
      ['Town', 'Crafting (Sphere House in Imperial Capital Randall, item synthesis), harvest spots, Event Bazaars.'],
      ['Shop', 'Merit Shop (evolution materials, frogs, imps, Legend Stone), Trade (units/Zel/Karma for Merit), unit and item slot expansion with gems.'],
      ['Summon', 'All gates: Rare Summon All Star, Honor Summon, Legacy/Veteran, collab gates, the 50-gem Selector and the weekly 10-unit Selector.'],
      ['Social', 'Friends, friend requests, your ID, helpers, guild.'],
    ] },
    { kv: [
      ['Presents / gift box', 'Home screen, top. Calendar prizes, gems from the server, 120 daily Brave Slot medals (labelled "Daily Raid Medals"), weekly selector tickets.'],
      ['Summoners’ Hall office', 'Home > Summoners’ Hall. Daily keys: 3 Metal, 3 Jewel, 3 Imp. "Receive All" works.'],
      ['Mission Record / achievements', 'Menu. Claiming achievements gives Merit Points.'],
      ['Administration Office > Records > Units', 'Field Guide entries (unit collection achievements).'],
      ['Daily Login Spin, Brave Slots', 'Home screen buttons. Both are free daily.'],
      ['Data Update', 'Options. Installing a newer APK over the old one keeps your account.'],
    ] },
  ] },

  { id: 'currency', title: 'Currencies', icon: '💰', blurb: 'Zel, Karma, gems, Merit, Honor: what each buys and where it comes from.', body: [
    { kv: [
      ['Zel', 'Buys evolutions, fusions, crafting. From quests; selling units. Jewel Ghost / King / God (Thursday Vortex "Gold Valley") sell for the most.'],
      ['Karma', 'Crafting spheres and the 7★ → Omni evolution (1,000,000). From quests (Soul Sanctuary Lv4 is a good source).'],
      ['Gems', 'Summons, slot expansion, revives, SP reset. From first-time quest clears, the present box, login calendar (odd days), Discord /claim (30 once), Arena, Raids, Frontier content. Buying gems is turned off on purpose.'],
      ['Merit Points', 'The Merit Shop currency. From claiming achievements (Mission Record) and Trade (spare units, Zel or Karma for Merit; daily limit; 2★-or-lower, fusion and evolution units cannot be traded).'],
      ['Honor Points', 'Honor Summon (200 per pull). From using friend helpers, friends, login calendar.'],
      ['Brave Points', 'From Daily Tasks (3 per day). Milestones pay gems.'],
      ['Event tokens', 'From featured event missions; spent in that event’s Bazaar.'],
    ] },
    { h: 'Good uses for gems' },
    { kv: [['Summons', 'see Summons'], ['Unit space', '+20 slots per gem (the text says +5)'], ['Friend space', '+5 per gem'], ['Revive in a quest', '1 gem'], ['SP reset', '1 gem'], ['Energy', 'free, never spend gems'], ['Arena / Frontier / Raid orbs', 'free refills, 2x faster than the original game']] },
  ] },

  { id: 'units', title: 'Units, levels and skills', icon: '🧩', blurb: 'Elements, rarity, max levels, fusing, what LS, ES, BB, SBB and UBB mean.', body: [
    'Every unit has an element (Fire > Earth > Thunder > Water > Fire; Light and Dark beat each other), a rarity (1★ to 7★, then Omni), a cost (squad cost limit grows with your level) and four stats: HP, ATK, DEF, REC.',
    { kv: [['Max level by rarity', '1★ 10-15 · 2★ 30 · 3★ 40 · 4★ 60 · 5★ 80 · 6★ 100 · 7★ 120 · Omni 150']] },
    { h: 'Leveling (Fuse)' },
    'Unit > Fuse. Feed units to gain EXP; same-element food gives more. Fusion costs Zel. Save Burst Frogs and Imps for units you actually use.',
    { h: 'Skills' },
    { kv: [
      ['LS (Leader Skill)', 'Active only when the unit is the squad leader (or the friend lead).'],
      ['ES (Extra Skill)', 'Passive; some need a specific sphere equipped.'],
      ['BB / SBB / UBB', 'Brave Burst, Super BB, Ultimate BB. Fill the BB gauge with Battle Crystals (BC). SBB unlocks at BB level 10; UBB needs the Overdrive gauge.'],
    ] },
    { h: 'Squads and friend leads' },
    'You can use your own units as a friend lead: put them in Squad 10 and favorite every unit there (View Unit). The same unit cannot be both in your active squad and the friend lead; the quest will bounce you back to mission select.',
  ] },

  { id: 'bb', title: 'Frogs: BB and SBB levels', icon: '🐸', blurb: 'Only frogs raise burst levels here. Which frog gives what, and when to feed them.', body: [
    'On this server only Burst Frogs raise BB level. Feeding units with the same BB does not.',
    { kv: [['Burst Frog', '+1 (Merit Shop 1,000)'], ['Lawson Frog', '+2 (events, calendar)'], ['Burst Emperor', '+5 (Merit Shop 4,000)'], ['Burst Queen', '+20 (Merit Shop 10,000)']] },
    { ul: [
      'Levels go into BB first. At BB 10 the SBB unlocks and the rest goes into SBB (max 10).',
      'Evolving halves BB and SBB levels (rounded down, minimum 1). Feed frogs AFTER the final evolution or half of them are wasted.',
      'Frogs: Merit Shop, login calendar days 14 and 22, and the "Heavenly Paradise" Vortex.',
      'Sphere Frog (8,000 Merit): opens a 2nd sphere slot once per unit; it stays after evolving. Extra Sphere Frogs only give EXP (or 10 SP on Omnis).',
    ] },
    'The Team Builder has a frog calculator that finds the cheapest Merit mix for the levels you need.',
  ] },

  { id: 'evolve', title: 'Evolution', icon: '⭐', blurb: 'Requirements, what is kept, Zel per step and every material explained.', body: [
    'Unit > Evolve turns a unit into its next form (more stars, higher max level, better skills). Requirements:',
    { ul: ['The unit at MAX level (the server refuses otherwise).', 'The exact material units and items shown in the recipe (tap Evolve on the unit).', 'Zel, plus Karma for 7★ → Omni.', 'Materials marked favorite cannot be used. Unfavorite them first.'] },
    { h: 'What happens' },
    { ul: ['Spheres on materials come back to you.', 'Imp bonuses, the 2nd sphere slot, equipped spheres and Omni SP are kept.', 'BB and SBB levels are halved.'] },
    { h: 'Zel on the starter lines' },
    { kv: [['2★ → 3★', '2,500 (50,000 for Atro and Magress)'], ['3★ → 4★', '100,000'], ['4★ → 5★', '200,000'], ['5★ → 6★', '500,000'], ['6★ → 7★', '1,500,000'], ['7★ → Omni', '3,000,000 Zel + 1,000,000 Karma']] },
    { h: 'Materials: what they are' },
    { kv: [
      ['Nymph 1★, Spirit 2★, Idol 3★, Pot 3★, Totem 4★', 'One of each per element. Tuesday and weekend Vortex, Merit Shop (Totem 500).'],
      ['Mecha God 5★', 'One per element. Needed for 7★ and Omni. Merit Shop 1,000; "The Mecha Gods Awaken" Vortex.'],
      ['Miracle Totem 5★', 'Universal top material, in most 6★+ recipes. Never sell or fuse. Merit Shop 1,000; weekend "Ruins of Miracles"; calendar days 2, 8, 16, 18.'],
      ['Mimic 3★, Bat Mimic 4★, Dragon Mimic 5★, Metal Mimic 5★', 'Used by many rarer units. Wednesday Vortex "The Box of Desires"; Merit Shop 50 / 100 / 300 / 500.'],
      ['Legend Stone (item)', 'Needed for 7★ and Omni. Never drops. Merit Shop 4,000.'],
    ] },
    'The Team Builder’s evolution calculator lists the full ladder for a starter-line unit of any element with the total Zel, Karma and Merit.',
  ] },

  { id: 'imps', title: 'Imps', icon: '👹', blurb: 'Permanent stat boosts: the five imps, the caps, and where to farm them.', body: [
    'Fuse an Imp into a unit for a permanent stat bonus that survives evolution.',
    { kv: [['Power Imp Pakpak', 'ATK +20'], ['Guard Imp Ganju', 'DEF +20'], ['Healing Imp Fwahl', 'REC +20'], ['Vigor Imp Molin', 'HP +50'], ['Almighty Imp Arton', 'HP +150, ATK/DEF/REC +60 (Merit Shop 4,000)']] },
    { ul: [
      'Every unit has its own caps per stat; extra imps past the cap are wasted. Common caps: 7★ HP 1100 / others 440; Omni HP 1500 / others 600. The unit page in this deck shows the exact caps.',
      'Imp at the final form, where the cap is highest. Do not imp units you will use as material.',
      'Where: Monday Vortex (Souls Training Ground), Merit Shop (500 each), Imp Keys (3 per day at the Summoners’ Hall office) open the Garden of Imps.',
    ] },
  ] },

  { id: 'spheres', title: 'Spheres', icon: '🔮', blurb: 'Equipment with a passive. Crafting in Randall, harvest spots, two slots with a Sphere Frog.', body: [
    'Spheres are equipment. One slot per unit, two with a Sphere Frog. 12 sphere types; you cannot equip two of the same type on one unit.',
    { ul: [
      'Craft them in Town at the Sphere House (Imperial Capital Randall) with materials + Karma. Upgrading the Sphere House unlocks more recipes.',
      'Harvest spots in Randall give materials. They only refill after a restart or a quest.',
      'Units › Items in this deck shows every recipe and where each material drops.',
    ] },
  ] },

  { id: 'sp', title: 'SP for Omni units', icon: '✨', blurb: 'Skill points on Omni units: what gives SP and what to leave alone.', body: [
    'Unlocks when an Omni unit is Lv 150 with SBB 10. Spend SP (max 100 per unit) to unlock skill upgrades; some need others first. Resetting costs 1 gem and refunds everything, so experiment.',
    { h: 'How to get SP (fuse these into the Omni)' },
    { kv: [['Burst Frog', '1'], ['Lawson Frog', '2'], ['Burst Emperor', '5'], ['Burst Queen', '20'], ['A duplicate of the unit (any form)', '5'], ['Omni Frog', '30 (Merit Shop 12,000)'], ['Sphere Frog', '10, only if the 2nd slot is already open'], ['Normal units', '0']] },
    'Keep Elemental Shards, Tomes and Amber Butterflies: they are for the Omni+ Boost later on.',
  ] },

  { id: 'farm', title: 'Farming: Vortex days and Merit Shop', icon: '🌀', blurb: 'Which dungeon is open on which day, and what the Merit Shop charges.', body: [
    'Home > Vortex Gate. Daily dungeons switch at 00:00 Japan time = 15:00 UTC the day before. The Vortex Gate tile on Home shows what is open now and what it gives.',
    { kv: [
      ['Monday', 'Gathering of Souls › Souls Training Ground: Soul Sanctuary Lv1-4 (the 4 basic Imps)'],
      ['Tuesday', 'Faerie Paradise (Nymphs, Spirits, Idols, Pots)'],
      ['Wednesday', 'Cave of Greed › The Box of Desires (Mimic, Bat Mimic, Dragon Mimic). Confirmed working.'],
      ['Thursday', 'Golden Slumberland › Gold Valley Lv1-3 (Jewel Ghost/King/God: sell for Zel)'],
      ['Friday', 'Remains of Eternity › The Wandering Spirit (Spirits; only Lv5 has drops)'],
      ['Sat + Sun', 'Garden of God › Ruins of each element (Totems) + Ruins of Miracles (Miracle Totem)'],
      ['Every day', 'The Mecha Gods Awaken (Mecha Gods); Ruins of Light and Dark (Light/Dark Totems)'],
    ] },
    'Many Vortex fights are rebuilt on this server, so difficulty and drops can differ from the original game. Use Units › Items in this deck for live drop rates.',
    { h: 'Merit Shop prices' },
    { kv: [['Miracle Totem', '1,000'], ['Mecha God (any element)', '1,000'], ['Element Totem', '500'], ['Mimic / Bat / Dragon / Metal', '50 / 100 / 300 / 500'], ['Legend Stone', '4,000'], ['Burst Frog / Emperor / Queen', '1,000 / 4,000 / 10,000'], ['Sphere Frog', '8,000'], ['Omni Frog', '12,000'], ['Basic Imp', '500'], ['Almighty Imp Arton', '4,000']] },
    'Spend Merit on Miracle Totems, Mecha Gods, Legend Stones and frogs first.',
  ] },

  { id: 'summon', title: 'Summons and selectors', icon: '🎰', blurb: 'Every gate and its price, the 50-gem selector and the weekly ticket.', body: [
    { kv: [
      ['Rare Summon "All Star"', '1 gem per pull, up to 10 at once (no discount). Summon Tickets work here. 5★ 5.9%, 4★ 31.9%, 3★ 62.2%.'],
      ['Honor Summon', '200 Honor per pull.'],
      ['Legacy Summon ("Veteran Summon" tile)', '10 gems per pull. 199 different 7★ units, all equally likely.'],
      ['Collab gates', 'DEEMO 3 · Chain Chronicle, Collab Mix 5 · Vocaloid, FFBE, Guilty Gear, SMT IV 10 · KOF, Fairy Tail, MHA, Tokyo Ghoul, Trigun 15 gems. Some art still shows old prices.'],
      ['50 Gem Selector', 'Pick from 4 rarity tiers (1-4, 5-6, 7, Omni), each with all 6 elements. Tap and hold a unit to read it. Summon three times to confirm; this removes all 50-gem selector gates.'],
      ['Weekly 10-unit Selector', 'A ticket arrives weekly in the present box after enough play time (tickets stack). Opens a gate with 10 units; the roster changes every Friday 00:00 UTC. Back out and wait if nothing fits.'],
    ] },
    { ul: ['The Summon tab shows what is featured this week, every gate’s pool and the exact odds per unit.', 'The Discord bot answers /unit <name> with the same banner info.', 'A gate that "breaks" from 3★ to 4★ can stay white until you tap. Just tap.'] },
  ] },

  { id: 'daily', title: 'Reset times and priorities', icon: '⏰', blurb: 'When things reset, and what to do first as a beginner.', body: [
    { ul: [
      'Open the gift box: calendar prizes and 120 free Brave Slot medals arrive daily.',
      'Daily Login Spin (free).',
      'Collect keys at the Summoners’ Hall office: 3 Metal, 3 Jewel, 3 Imp.',
      'Daily Tasks: 3 per day (fuse 5 units, evolve 1, clear 3 missions, 1 Vortex mission, craft 5, win 3 Arena fights...).',
      'Run today’s Vortex dungeon.',
      'Use friend helpers for Honor; add friends with good leaders.',
      'Spin Brave Slots with the free medals.',
      'Out of energy? Refill for free.',
    ] },
    { kv: [['Daily Tasks, spin, calendar, medals, friend gifts', '09:00 JST = 00:00 UTC'], ['Vortex day and daily keys', '00:00 JST = 15:00 UTC the day before'], ['Weekly selector roster', 'Friday 00:00 UTC']] },
    { h: 'Beginner priorities' },
    { ul: ['Clear story quests: levels, unlocks, first-clear gems.', 'Pick strong 6★ units from the selectors.', 'Evolve and max your core team before spreading out.', 'Fuse with same-element food. Save frogs for units you use, after the final evolution.', 'Spend Merit on Miracle Totems, Mecha Gods, Legend Stones and frogs.'] },
  ] },

  { id: 'help', title: 'Getting help', icon: '💬', blurb: 'The Discord channels and slash commands that answer questions and take bug reports.', body: [
    { kv: [
      ['help-general', 'Any question.'], ['/bugreport', 'What you did, what happened, what you expected. Add a screenshot.'],
      ['/qol', 'Small annoyance or improvement.'], ['/suggest', 'Bigger idea.'], ['/status', 'Is the server down?'],
      ['/unit <name>', 'Which banner has a unit (only you see the answer).'], ['/claim <ID>', 'The one-time 30 gems in gem-gift-ign.'],
      ['suggestions-and-reports', 'Bugs, exploits, ban appeals.'], ['missing-content', 'Data or assets you have for missing content.'],
      ['friend-codes', 'Post your ID there, not in general chat. Many players add their ID to their nickname: /nick name | ID.'],
    ] },
  ] },
];
