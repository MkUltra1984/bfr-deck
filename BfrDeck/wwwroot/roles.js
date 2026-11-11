'use strict';
// Reads a unit's skill text and tags what it brings to a squad. Heuristic, but the game's skill
// descriptions use fixed phrases, so it is reliable for the common roles.

const ROLE_DEFS = [
  { key: 'heal', label: 'Healer', re: /\b(heals?|recovers?|restores?)\b[^.,;&]*\bHP\b|HP recovery|gradual HP|heals? all allies/i, not: /drain|HP drain/i },
  { key: 'bc', label: 'BB gauge filler', re: /fills? (own |allies' )?BB gauge|boosts? BB gauge|BB gauge (fill|boost)|BC drop rate|boosts? BC (drop|efficacy)|BB gauge each turn/i },
  { key: 'mitig', label: 'Mitigation', re: /reduces? damage taken|damage reduction|mitigat|reduces? (all )?damage (by|taken)|% damage reduction/i },
  { key: 'cleanse', label: 'Status cleanse / immunity', re: /removes? (all )?(status )?ailments|negates? (all )?status ailments|immunity to status|removes? all debuffs|negates? (all )?stat reduction/i },
  { key: 'atk', label: 'ATK buff', re: /boosts? Atk\b|boost to Atk\b|Atk (up|boost)/i },
  { key: 'def', label: 'DEF buff', re: /boosts? Def\b|boost to Def\b|Def (up|boost)/i },
  { key: 'crit', label: 'Crit', re: /critical (hit|damage|rate)/i },
  { key: 'spark', label: 'Spark', re: /spark/i },
  { key: 'elem', label: 'Elemental damage / weakness', re: /elemental (damage|weakness)|adds? [a-z, ]*element/i },
  { key: 'bbatk', label: 'BB ATK buff', re: /BB Atk/i },
  { key: 'od', label: 'OD gauge', re: /OD gauge|Overdrive/i },
  { key: 'angel', label: 'Angel Idol / survive', re: /Angel Idol|survive (a )?(fatal|one) |revive/i },
  { key: 'shield', label: 'Shield / barrier', re: /shield|barrier/i },
  { key: 'bbdef', label: 'Enemy ATK/DEF down', re: /(Atk|Def|Rec) reduction|reduces? (foes'?|enemy) (Atk|Def)/i },
];
// Whether a checklist item is important for a general-purpose squad.
const TEAM_CHECK = [
  ['heal', 'A healer (HP recovery each turn or on BB)'],
  ['bc', 'BB gauge support (so everyone can burst every turn)'],
  ['mitig', 'Damage mitigation (the squad survives big hits)'],
  ['cleanse', 'Status cleanse or immunity'],
  ['atk', 'ATK buff'],
  ['def', 'DEF buff'],
  ['spark', 'Spark damage (units hitting together)'],
  ['elem', 'Elemental damage or weakness (hit harder)'],
];

function unitRoles(u) {
  const text = ['ls', 'es', 'bb', 'sbb', 'ubb'].map(k => u && u[k] ? `${u[k].desc || ''}` : '').join(' | ');
  const roles = new Set();
  for (const d of ROLE_DEFS) if (d.re.test(text) && !(d.not && d.not.test(text))) roles.add(d.key);
  const hits = Math.max(0, ...['bb', 'sbb'].map(k => { const m = u && u[k] && /(\d+) combo/.exec(u[k].desc || ''); return m ? Number(m[1]) : 0; }));
  return { roles, hits };
}

// Analyse a squad (array of unit ids or null). Needs unit details; async.
async function analyseSquad(ids) {
  const units = (await Promise.all(ids.map(async id => id ? { id, d: await unitDetail(id) } : null))).filter(Boolean);
  const cover = {};   // role -> [unit ids]
  let cost = 0; const elements = new Set();
  for (const u of units) {
    const m = unitMeta(u.id); if (m) cost += m[0];
    elements.add(unitElement(u.id));
    const r = unitRoles(u.d); for (const k of r.roles) (cover[k] ||= []).push(u.id);
  }
  const leader = units[0] ? units[0].d : null;
  return { units, cover, cost, elements, leader };
}
