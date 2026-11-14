# Changelog

## 1.3.1 (2026-11-14)

- **The unit scanner is gone.** Signing in reads your box from your account, exactly and in a second, so the screen scan is no longer needed. Without signing in, tick the units you own by hand. The first-start tour now ends with the sign-in.

## 1.3.0 (2026-11-14)

- **Your account, live.** Sign in with your game login and the deck reads your account from My Summoner (bfrevive.net/my-summoner), with the BFR team's agreement. Read-only: the login goes only to bfrevive.net and nothing in your account is changed. "Stay signed in" keeps the login protected by Windows for your user.
- **Home:** level, energy, arena orbs, gifts, unit box and cost cap in one row, "What next" as three short steps with the reason behind "Why?", today's pointers, and your real squads with their check.
- **My Account (new tab):** to do, squads (what each covers, who is not ready, sphere plan, friend leader try-out, share as text), build a team from your box by theme or around one unit, evolve with a shopping list for the units you pick, challenges, story, collection, items with your stock, history and profile.
- **Units:** a unit you own shows My Summoner's advice (tier and rank among your units, which of your spheres suit it, what to improve); your box lists every copy by power, level or rarity. Where My Summoner has no answer (units you do not own, SP builds, squads planned in the deck) the deck's own result stays and is marked as an estimate.
- Without signing in, the deck works as before.

## 1.2.4 (2026-11-12)

- **Easy to get early:** under the two best spheres, unit pages show two that a new player can get: at most 5 stars, dropped in quests or crafted in town from materials that drop.

## 1.2.3 (2026-11-12)

- **Suggestions tuned against players' builds.** Compared on a dozen well-known units with the players' SP builds from the wiki and BF Companion's sphere picks. SP builds now take the SBB's extra attack and the cheap stat, spark and elemental options first, keep leader skill options for lead builds, and skip PvP-only options. Sphere picks no longer overrate effects that only count at low HP or that are described with a big word instead of a number.

## 1.2.2 (2026-11-12)

- **Sphere suggestions only name spheres you can really get.** A recipe counts only when every material can be had in Revived in the needed amount (first-clear rewards and shop limits are added up, recipes followed down). The card says where from: quest drop, clear reward, which shop and the price, or craft in town.
- **SP builds follow the usual rules:** BB cost reduction first, spark and elemental damage before crit (crit damage is capped), a higher Atk limit for damage dealers, squad buffs before self buffs.
- **Team Builder: squad check.** Damage (spark, elemental, crit, BB Atk, recast, extra action), Survival (mitigation, evasion, KO resistance, revive, healing; two or three wanted) and Support (BB gauge, OD gauge, status cleanse), each with what the squad covers. New rows for revive, evasion, recast and extra action. The structure follows the community guide "Brave Frontier Unit Viability & Squad Building" by WhiteHikari.

## 1.2.1 (2026-11-12)

- **Suggested spheres.** Every unit page shows two spheres picked by the deck: a sphere its Extra Skill names comes first (it switches the ES on), the rest are chosen by what the unit does (attack, spark, crit, BB gauge, survival), only from spheres with a known source in Revived, each with a short reason and how to get it. When the Extra Skill asks for a sphere type (\"Spark sphere\"), the best sphere of that type leads, and the two picks are never of one type, as in the game. In the Team Builder the new ✦ button next to the two sphere slots fills the empty ones with the suggestion.
- **Suggested SP build** on Omni unit pages: the unit's SP options scored by what the unit does, the best set within 100 SP.
- Unit pages link to the unit's page on BF Companion (spheres and players' SP builds). The sphere types come from BF Companion's data; thank you.

## 1.2.0 (2026-11-12)

- **The deck updates itself.** On start (and every six hours while open) it asks the GitHub releases page for a newer version. When there is one, a bar under the tabs names it, says what is new and how big the download is, with **Update** and **Later**. Most updates only touch the deck's pages: those are under 1 MB, install in a second and reload the deck in place. When the program itself changed, the button reads **Update and restart**: the new `BfrDeck.exe` is downloaded, checked against its checksum, swapped in and started. A failed download changes nothing and offers "Try again" or the download page. Your box, squads and notes are never touched. The Guide's last line shows the version with "Check for updates". Versions before 1.2.0 need this one download by hand.
- **New look, "Midnight Gilt"**: Brave Frontier style, modernized. Indigo-navy panels with a thin gold frame, gold for highlights, crimson only for alerts, serif titles, a crest in the tab bar, 14 px body text with readable label sizes, currency icons on the Gems, Zel and Karma tiles, star ratings coloured by rarity with a soft glow on 7★ and Omni cards, and a pedestal picture in empty squad slots. Window frame and title bar match.
- **Should I pull?** leads with the verdict; the odds table and the ownership bars open under "See odds and bars".
- Team Builder says "not yet covered" instead of a red "missing".
- The squad stage keeps both names of "X and Y" units ("Deemo & the Girl" instead of "Girl").
- Units without a battle animation on bfrevive.net (new collab units such as the Vocaloid Meiko, Kaito and Sakura Miku) borrow the sprite of another form in their evolution line when one has it; otherwise their portrait stands on the stage as a gold-ringed medallion instead of a plain square icon.
- Removed leftover status remarks (pity rewards, arena rules, raid notes).

## 1.1.0 (2026-11-08)

- Download: one self-contained `BfrDeck.exe` (no .NET install needed), source on GitHub under the MIT license, illustrated README in English and German.
- First start: a guided tour. A welcome card, then one card per tab shown over that tab (Home, Units and Box, Tier List, Summon, Quests, Team Builder, Guide and glossary, Dock / Pin / Live), ending with the offer to scan your units. Replay it from the Box page (`intro`), or open `#/home/intro`.
- **Unit scanner** (`Box › Scan my units`): while you scroll the in-game unit list, the deck grabs the emulator window from the desktop about 15 times a second (any emulator, no adb needed), snaps a fixed 5-column grid to the list's rows and matches every icon against the unit thumbnails (256-bit fingerprint, then greyscale correlation plus a colour check; evolution forms of one unit are treated as a family). No calibration. Rows are tracked by scroll position, so a row is never counted twice and a row you scroll back to fills a gap; a red banner warns while a gap is open. The **×N** count badge is read with the game's own number font, so stacked materials count fully, and the result shows **units including duplicates** next to the unique count to compare with the game's own total. PARTY ribbons are read too: the blinking yellow ribbon marks the main party, which becomes Squad 1; blue ribbons show a PARTY badge. Reset restarts a scan; no captured frame stays on disk. Finish with "replace my box" or "add to my box". Verified on a real first screen: 30 of 30 cells, 27 unique, 45 including duplicates, badges ×4 ×5 ×9, main party 5 of 5.
- **Tier List** tab: every unit ranked S/A/B/C by the deck's score (max stats against the best in the game plus the roles its skills cover), filter by element, rarity, role and "owned only", tiers collapse. The same score drives the Meta Units box.
- **Quests** tab groups Vortex, Grand Quest, Story, Frontier Hunter, Frontier Gate and Trials with one catalog style.
- **Team Builder** (was Team): six slot cards (five units plus the friend lead) with portrait, leader star, swap, remove and drag-to-reorder; two spheres per slot; totals with an imps toggle; the leader and friend leader skills side by side; a buff matrix that shows which slot brings healing, mitigation, BB fill, buffs and so on; gap suggestions from your box; a copyable team code to share a squad.
- **Guide tab rebuilt as a beginner path**: six first steps with a checkbox each and a progress bar (link account, claim gems, story, selectors, one finished team, the daily loop), an "Every day" checklist that resets at 00:00 UTC, then one card per topic that opens its own page with previous / next links. Notes and links are folded away at the bottom. Search filters the topic cards. The "what works and what to avoid" list and the "sends you Home" notes in the Quests catalog are gone: the content works.
- **Beginner glossary**: game terms (HP, BB, SBB, spark, mitigation, Omni, SP, Vortex, Merit, every role tag, unit types, …) get a dotted underline wherever they appear; hover one for a plain-words explanation. Chips, tags and table headers show the same explanation as a tooltip.
- Window: resizable on every edge; minimum size 600×640 so content never needs a horizontal scrollbar; the squad stage sizes and centres sprites by their visual mass.
- Housekeeping: the disk cache is capped at 300 MB with a 14-day image life, the log is trimmed at 2 MB, debug frames are deleted on start and when a scan stops.
- Team labels: units that sit in a squad carry a small coloured label (one colour per squad) on their icon in the unit list, the box, the picker and the scan results.
- Should I pull: an **"I pulled…"** button opens a multi-select of the gate's pool so a summon session can be logged in one go, keeping the odds and bars current without a rescan.
- App icon: Phaedra (`tools/make-icon.ps1 -Unit <id>` rebuilds `app.ico` from any unit thumbnail).
- Live header: the summoner name is read from the game and shown instead of "Summoner" (type your own to override); gems and level read reliably now (the OCR reads whole panels instead of tiny crops). `--debugframes` keeps the captured frame and OCR crops in `%LOCALAPPDATA%\BfrDeck` for tuning.

- Home: the Today's Vortex table is now the **Vortex Gate** tile: the week as day chips (click a day to preview it), one card per open dungeon with what it gives in plain words (Karma farm, Mimics, Totems, Jewel units for Zel…) and its captures or drops as art, the running event, and a link to the full catalog. Cards scroll with the wheel, the arrows, or by holding the left button and dragging; a card opens the dungeon page (levels, captures with chance, drops, clear rewards, enemies).
- Tabs: **Gates** is now **Summon**. New **Vortex** tab: every Vortex dungeon in the game data grouped like the in-game gate (Enhancement, Travellers, Vortex Trials, Seasons Past, Special Quests, …, plus limited and event dungeons), each with its reward summary and icons, "today" and "event running" tags. New **Grand Quest** tab: the chapters and episodes with their clear rewards. Area pages at `#/vortex/area/<id>`.
- Home: the featured-units marquee and the Meta Units box can be dragged with the mouse (hold the left button and move; the marquee resumes from where you let go, Meta Units walks through its picks).
- Dock: after docking, the two windows stay together. The deck follows every step of an emulator drag or resize (window event hook, no polling lag); dragging the deck carries the emulator along. Works with BlueStacks, LDPlayer, Nox, MEmu, MuMu, GameLoop, the Android Studio emulator and Google Play Games by process name; for anything else (or with Shift held) click Dock and then click the emulator window. Click **Docked** to undock; the dock also ends when the emulator window closes.
- Meta Units: the dots are buttons; click one to jump to that unit.
- Vortex cards: reward pictures come from the guide table where it names them (Imp and Jewel God unit icons). Karma, Zel and gems use clean 256 px redraws of the in-game HUD icons (`wwwroot/img/karma.png`, `zel.png`, `gem.png`, made from a screenshot with `tools/redraw-currency-icons.ps1`); SVG fallbacks of the same three stay next to them.
- Unit picker (squad slots on Home and Team): the list keeps growing as you scroll instead of stopping at 48 results.

## 1.0.0 (2026-11-07)

First release. A read-only desktop companion for Brave Frontier Revived.

- Home: leader portrait (Omni Vargas until a squad leader is set), live gems / Zel / Karma read from the emulator (optional, off by default), reset timers with state stripes, squad stage with battle sprites, Should-I-pull with per-rarity odds and EXP-style acquisition bars, Meta Units for the selected gate, featured-units marquee (newest collab first), banners, today's Vortex.
- Units: search with element / rarity / owned filters, owned and bookmark marks, box page with collection progress, bookmarks with where-to-get, unit pages with sprites, skills, roles, where-to-get.
- Items: search, drops, clear rewards, shops, recipes.
- Gates: featured / permanent / rotation, per-gate pools and odds, Should-I-pull.
- Team: squad editor, "what a good team needs" checklist, export / import, calculators (evolution, frogs, SP, imps).
- Guide: the Discord beginner guide, searchable.
- Shell: custom dark title bar, tabs for bfrevive.net and the wiki, dock beside BlueStacks (`--dock`), pin on top, disk cache for the feeds, `--deck <route>` and `--ocrtest <png>` switches.

Known: the live-stats level box reads empty (gems, Zel, Karma work).
