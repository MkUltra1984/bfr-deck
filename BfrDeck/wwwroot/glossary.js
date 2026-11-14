'use strict';
// Beginner glossary: game terms get a dotted underline wherever they appear in the deck; hovering one for a moment
// shows a short explanation. Terms are matched in text nodes after each render (and whenever a view adds content),
// never inside unit or item names, inputs, or links that are names.

const GLOSSARY = {
  'HP': ['HP', 'Hit points: how much damage a unit can take before it is knocked out. Healed by healers and HC (heart crystals).'],
  'ATK': ['Attack', 'Base attack power. Multiplied by buffs, spark and critical hits to produce damage.'],
  'DEF': ['Defence', 'Reduces the damage a unit takes from hits. Buffed by DEF buffs, cut by enemy DEF-down.'],
  'REC': ['Recovery', 'How much HP a unit gets back from heart crystals and most heals.'],
  'BB': ['Brave Burst', 'A unit\'s special attack or support skill. Fill its BB gauge by collecting BC (battle crystals) from your hits, then tap the unit to fire it.'],
  'SBB': ['Super Brave Burst', 'A stronger second burst that unlocks at higher levels. Needs a fuller gauge than BB. On this server only Burst Frogs raise BB and SBB levels.'],
  'UBB': ['Ultimate Brave Burst', 'The strongest burst, used from the Overdrive (OD) gauge. Big effects for a few turns.'],
  'LS': ['Leader skill', 'A passive effect the whole squad gets from the unit in slot 1 (and from the friend lead). Only those two leader skills count.'],
  'ES': ['Extra skill', 'A passive the unit itself always has, often with a condition like a sphere type or a partner in the squad.'],
  'Leader skill': ['Leader skill', 'A passive effect the whole squad gets from the unit in slot 1 (and from the friend lead). Only those two count.'],
  'Extra skill': ['Extra skill', 'A passive the unit itself always has, often with a condition like a sphere type or a partner in the squad.'],
  'BC': ['Battle crystals', 'Drop when you hit enemies and fill BB gauges. More hits and "BC drop rate" buffs mean faster bursts.'],
  'HC': ['Heart crystals', 'Drop from hits and heal the squad, scaled by REC.'],
  'OD': ['Overdrive', 'A squad-wide gauge filled by attacking. When full you can Overdrive and use UBB.'],
  'Overdrive': ['Overdrive', 'A squad-wide gauge filled by attacking. When full you can Overdrive and use UBB.'],
  'Spark': ['Spark', 'When two hits land on an enemy at the same moment they "spark" for bonus damage. Spark buffs and well-timed bursts make this huge.'],
  'Crit': ['Critical hit', 'A hit that deals extra damage by chance. Crit rate and crit damage buffs raise it.'],
  'critical': ['Critical hit', 'A hit that deals extra damage by chance. Crit rate and crit damage buffs raise it.'],
  'Mitigation': ['Mitigation', 'A buff that reduces all damage the squad takes, usually by 50 % for a turn. The key to surviving boss hits.'],
  'Healer': ['Healer', 'A unit whose burst or leader skill restores HP each turn or on use.'],
  'Cleanse': ['Cleanse', 'Removes status ailments (poison, paralysis, curse, …) or grants immunity to them.'],
  'ailments': ['Status ailments', 'Poison, weak, sick, injury, curse and paralysis. Cleanse removes them; immunity prevents them.'],
  'Angel Idol': ['Angel Idol', 'A buff that lets a unit survive one knock-out blow once.'],
  'Barrier': ['Barrier / shield', 'A pool of extra HP in front of the real HP; absorbs damage until it breaks.'],
  'Elemental damage': ['Elemental damage', 'Extra damage against the element you are strong against: Fire > Earth > Thunder > Water > Fire; Light and Dark beat each other.'],
  'Element': ['Element', 'Fire, Water, Earth, Thunder, Light, Dark. Fire > Earth > Thunder > Water > Fire; Light and Dark beat each other. Mixing elements helps a leader skill like "5 elements present".'],
  'Cost': ['Cost', 'Every unit has a cost; your squad\'s total cost cannot exceed your cost limit, which grows with your summoner level.'],
  'Rarity': ['Rarity', 'Stars from 1★ to 7★, then Omni. Higher rarity means higher stats and more skills. Units evolve to the next rarity with materials.'],
  'Omni': ['Omni', 'The top evolution. Costs 1,000,000 Karma and a Mecha God among other materials; Omnis also gain SP (skill points) from duplicates.'],
  'SP': ['Skill points', 'Omni units unlock extra enhancements with SP. Dupes give 5 SP, Omni Frogs 30 (Merit Shop 12,000).'],
  'Evolution': ['Evolution', 'Turning a unit into its next rarity with evolution materials (Nymphs, Totems, Mecha Gods …) and Zel. Levels reset; imps and spheres are kept.'],
  'Fusion': ['Fusion', 'Feeding units into another to give it EXP. Same-element food gives more. Costs Zel.'],
  'Imp': ['Imps', 'Fuse an Imp into a unit for a permanent stat bonus that survives evolution: Pakpak ATK, Ganju DEF, Fwahl REC, Molin HP, Arton all.'],
  'imps': ['Imps', 'Fuse an Imp into a unit for a permanent stat bonus that survives evolution: Pakpak ATK, Ganju DEF, Fwahl REC, Molin HP, Arton all.'],
  'Frog': ['Burst Frogs', 'Fused into a unit to raise its BB/SBB level (+1 Burst Frog, +5 Burst Emperor, +20 Burst Queen). The only way on this server.'],
  'Sphere Frog': ['Sphere Frog', 'Opens a unit\'s second sphere slot, once per unit. Merit Shop 8,000.'],
  'Sphere': ['Sphere', 'Equipment with a passive effect (ATK boost, mitigation, spark …). One per unit, two with a Sphere Frog; no two of the same type.'],
  'Spheres': ['Spheres', 'Equipment with a passive effect (ATK boost, mitigation, spark …). One per unit, two with a Sphere Frog; no two of the same type.'],
  'Elgif': ['Elgif', 'Tablets that give a unit an extra passive when fused.'],
  'Zel': ['Zel', 'The gold currency. Pays for evolutions, fusions and crafting. Farm it in the Thursday Vortex (Gold Valley) by selling Jewel units.'],
  'Karma': ['Karma', 'Currency for crafting spheres and for the Omni evolution (1,000,000). Farm it in the Souls dungeons.'],
  'Gems': ['Gems', 'Premium currency: 1 gem = a pull on the Rare Summon, more on collab gates; also unit slots and revives. From first clears, missions and the login spin.'],
  'Merit': ['Merit', 'Points from Daily Tasks and achievements, spent in the Merit Shop on Totems, Mecha Gods, frogs and imps.'],
  'Honor': ['Honor points', 'Earned from friends\' leads; spent on the Honor Summon (1★–3★ units, good fusion food).'],
  'Totem': ['Totems', 'Evolution material for 6★ and 7★: one per element from the Garden of God Vortex, plus the Miracle Totem.'],
  'Mecha God': ['Mecha Gods', 'Evolution material for 7★ and Omni, one per element. Merit Shop 1,000 or "The Mecha Gods Awaken" Vortex.'],
  'Mimic': ['Mimics', 'Evolution material (Mimic, Bat Mimic, Dragon Mimic, Metal Mimic) from the Wednesday Vortex "Box of Desires" or the Merit Shop.'],
  'Nymph': ['Nymphs, Spirits, Idols, Pots', 'Low-tier evolution materials, one per element, from the Tuesday and weekend Vortex (Faerie Paradise).'],
  'Vortex': ['Vortex Gate', 'The daily dungeons: materials, Zel and Karma farms, collab and event dungeons. The set changes at 15:00 UTC.'],
  'Summon gate': ['Summon gate', 'A banner you pull units from with gems or honor. Each gate has its own pool and odds; featured gates rotate weekly.'],
  'Rare Summon': ['Rare Summon', 'The permanent gem gate with the full pool. Collab gates cost more gems but have small, focused pools.'],
  'Arena': ['Arena', 'Auto-battles against other players\' squads for rank and rewards.'],
  'Raid': ['Raid', 'Multiplayer hunts for crafting materials.'],
  'Grand Quest': ['Grand Quest', 'Story chapters you play with fixed squads.'],
  'Frontier Hunter': ['Frontier Hunter', 'A ranked event mode with expedition dungeons.'],
  'hit count': ['Hit count', 'How many hits a burst deals. More hits drop more BC and HC and spark more often.'],
  'hits': ['Hits', 'Number of hits in a burst. More hits drop more BC and HC and spark more often.'],
  'combo': ['Combo', 'The number of hits in a burst ("16 combo attack"). More hits drop more crystals and spark more.'],
  'buff': ['Buff', 'A temporary boost from a burst or leader skill: ATK, DEF, REC, crit, spark, BB gauge and so on, usually for 3 turns.'],
  'turns': ['Turns', 'A buff "for 3 turns" lasts three of your attack rounds.'],
  'selector': ['Selector ticket', 'A ticket that lets you pick a unit from a roster. The weekly selector roster changes on Friday.'],
  'energy': ['Energy', 'Spent to enter quests; refills over time. Never spend gems on it here.'],
  'dupes': ['Duplicates', 'Extra copies of a unit. On Omnis each dupe gives 5 SP; otherwise they are fusion food or sellable.'],
  'friend lead': ['Friend lead', 'The sixth unit in a quest, borrowed from a friend. Only its leader skill applies to your squad.'],
  'Friend lead': ['Friend lead', 'The sixth unit in a quest, borrowed from a friend. Only its leader skill applies to your squad.'],
  'Friend leader skill': ['Friend leader skill', 'The leader skill of the borrowed friend unit. It stacks with your own leader\'s skill.'],
  // role tags (Tier List and Team Builder)
  'BB gauge filler': ['BB gauge filler', 'A unit whose skills fill the squad\'s BB gauges or raise BC drops, so everyone bursts every turn.'],
  'ATK buff': ['ATK buff', 'Raises the squad\'s attack for a few turns. Stack it with spark and crit buffs for damage.'],
  'DEF buff': ['DEF buff', 'Raises the squad\'s defence for a few turns. Softens hits but does not replace mitigation.'],
  'BB ATK buff': ['BB ATK buff', 'Raises the damage of Brave Bursts specifically. Most damage in a fight comes from bursts, so this is a big one.'],
  'OD gauge': ['Overdrive gauge', 'Fills as you attack. Skills that fill it let you Overdrive and use UBB sooner.'],
  'Angel Idol / survive': ['Angel Idol', 'A buff that lets a unit survive one knock-out blow once.'],
  'Shield / barrier': ['Shield / barrier', 'A pool of extra HP in front of the real HP; absorbs damage until it breaks.'],
  'Enemy ATK/DEF down': ['Enemy ATK/DEF down', 'Debuffs that lower the enemy\'s attack or defence. DEF down means your hits deal more.'],
  'Elemental damage / weakness': ['Elemental damage', 'Adds elements to the squad\'s attacks or raises damage against weak elements: Fire > Earth > Thunder > Water > Fire; Light and Dark beat each other.'],
  'Status cleanse / immunity': ['Cleanse / immunity', 'Removes status ailments (poison, paralysis, curse …) or prevents them.'],
  // unit types, scores, squad words
  'Type': ['Type', 'A unit\'s stat bias: Lord (balanced), Anima (more HP, less REC), Breaker (more ATK, less DEF), Guardian (more DEF, less ATK), Oracle (more REC, less HP). Fixed per copy of the unit.'],
  'Lord': ['Lord type', 'Balanced stats, no bonus or penalty.'],
  'Anima': ['Anima type', 'More HP, less REC.'],
  'Breaker': ['Breaker type', 'More ATK, less DEF. Good for attackers.'],
  'Guardian': ['Guardian type', 'More DEF, less ATK. Good for tanks and mitigators.'],
  'Oracle': ['Oracle type', 'More REC, less HP.'],
  'Tier': ['Tier', 'S, A, B, C: the deck\'s ranking of units by their max stats and the roles their skills cover. A guide, not gospel.'],
  'Score': ['Score', 'The deck\'s number for a unit: its max stats measured against the best in the game, plus points for each role its skills cover.'],
  'Stat score': ['Stat score', 'Max HP, ATK, DEF and REC measured against the best unit in the game. 100 would be best in every stat.'],
  'Roles': ['Roles', 'What a unit\'s skills do for the squad: healing, mitigation, BB filling, buffs and so on. Read from the skill text.'],
  'Role': ['Role', 'What a unit\'s skills do for the squad: healing, mitigation, BB filling, buffs and so on. Read from the skill text.'],
  'Squad': ['Squad', 'Your team of up to five units plus a friend lead. Slot 1 is the leader; only its leader skill applies.'],
  'Leader': ['Leader', 'The unit in slot 1. Its leader skill applies to the whole squad; the other four units\' leader skills do nothing.'],
  'Team code': ['Team code', 'A short text you can copy and paste to share this squad with someone else using BFR Deck.'],
  'Box': ['Box', 'All the units you own. The deck learns your box from your account when you sign in, or from ticking units owned.'],
  'Unit slots': ['Unit slots', 'How many units your box can hold. Expand with gems, or sell and fuse units you do not need.'],
  'Dupes': ['Duplicates', 'Extra copies of a unit. On Omnis each dupe gives 5 SP; otherwise they are fusion food or sellable.'],
  'Featured': ['Featured', 'Units with raised rates on a summon gate this week.'],
  'Pool': ['Pool', 'Every unit a summon gate can give, with its chance.'],
  'Step-up': ['Step-up', 'A summon gate where each step costs a set number of gems and later steps guarantee better pulls.'],
  'Honor Summon': ['Honor Summon', 'The free gate paid with honor points: 1★–3★ units, good fusion food and imps.'],
  'First clear': ['First clear', 'Clearing a dungeon for the first time gives a one-off reward, usually a gem.'],
  'Captures': ['Captures', 'Units that can join you when you clear the dungeon.'],
  'Drops': ['Drops', 'Materials and items a dungeon can give on clear.'],
  'Keys': ['Keys', 'Daily keys open the extra Vortex dungeons. They switch with the Vortex day at 15:00 UTC.'],
  'EXP': ['EXP', 'Experience: units level up from fusion and quests; your summoner level grows from quest EXP.'],
  'Cost limit': ['Cost limit', 'The total unit cost your squad may have. Grows with your summoner level.'],
  'Merit Shop': ['Merit Shop', 'Where Merit points are spent: Totems, Mecha Gods, frogs, imps.'],
  'Burst Frog': ['Burst Frog', 'Fused into a unit to raise its BB/SBB level by one. The only way to level bursts on this server.'],
  'Omni Frog': ['Omni Frog', 'Gives an Omni unit 30 SP. Merit Shop 12,000.'],
  'Jewel units': ['Jewel units', 'Sellable units from the Gold Valley Vortex. Sell them for Zel.'],
  'Metal units': ['Metal units', 'Fusion food from the Metal Parade Vortex: large EXP, best fused into a unit of the same element.'],
};

const glTip = { el: null, timer: 0 };
function glossaryInit() {
  glTip.el = h('div', { class: 'gltip', style: 'display:none' });
  document.body.append(glTip.el);
  const view = $('view');
  const pending = { t: 0 };
  const schedule = () => { clearTimeout(pending.t); pending.t = setTimeout(() => annotate(view), 80); };
  new MutationObserver(schedule).observe(view, { childList: true, subtree: true });
  document.addEventListener('mouseover', e => {
    const t = e.target.closest && e.target.closest('.gl'); if (!t) return;
    clearTimeout(glTip.timer);
    glTip.timer = setTimeout(() => showTip(t), 350);
  });
  document.addEventListener('mouseout', e => { if (e.target.closest && e.target.closest('.gl')) { clearTimeout(glTip.timer); glTip.el.style.display = 'none'; } });
  schedule();
}
function showTip(t) {
  const d = GLOSSARY[t.dataset.k]; if (!d) return;
  glTip.el.replaceChildren(h('b', {}, d[0]), h('div', {}, d[1]));
  glTip.el.style.display = '';
  const r = t.getBoundingClientRect(); const w = glTip.el.offsetWidth, hh = glTip.el.offsetHeight;
  let x = Math.min(window.innerWidth - w - 8, Math.max(8, r.left)); let y = r.bottom + 6; if (y + hh > window.innerHeight - 8) y = r.top - hh - 6;
  glTip.el.style.left = x + 'px'; glTip.el.style.top = y + 'px';
}
// Build one regex over all terms (longest first), word-bounded, case-sensitive for abbreviations.
const GL_TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
const GL_RE = new RegExp(`(?<![\\w-])(${GL_TERMS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w-])`, 'g');
const GL_SKIP = /^(SCRIPT|STYLE|INPUT|TEXTAREA|SELECT|CANVAS|IMG|BUTTON|OPTION)$/;
function annotate(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => {
    const p = n.parentElement; if (!p || GL_SKIP.test(p.tagName)) return NodeFilter.FILTER_REJECT;
    if (p.closest('.gl, .n, .aname, .gtitle, .name, .card, .mini, .tmlabel, .tag, .chip, .banner .t, h1, .utable a, .cand, .vt, .vg, summary, .modal, .gltip')) return NodeFilter.FILTER_REJECT;
    return n.nodeValue.length > 1 && GL_RE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
  } });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    GL_RE.lastIndex = 0; const text = n.nodeValue; const frag = document.createDocumentFragment(); let last = 0, m;
    while ((m = GL_RE.exec(text))) {
      if (m.index > last) frag.append(text.slice(last, m.index));
      frag.append(h('span', { class: 'gl', 'data-k': m[1] }, m[1]));
      last = m.index + m[1].length;
    }
    if (last < text.length) frag.append(text.slice(last));
    n.replaceWith(frag);
  }
  // Clickable chips, tags and table headers keep their look; when their whole text is a glossary term they get the
  // explanation as a native tooltip instead of the underline.
  for (const el of root.querySelectorAll('.chip, .tag, .fchips button, th, .slothead, .flabel, .xpl span:first-child')) {
    if (el.title || el.querySelector('.gl')) continue;
    const t = el.textContent.trim(); const k = GLOSSARY[t] ? t : Object.keys(GLOSSARY).find(x => x.toLowerCase() === t.toLowerCase());
    if (k) el.title = `${GLOSSARY[k][0]}: ${GLOSSARY[k][1]}`;
  }
}
