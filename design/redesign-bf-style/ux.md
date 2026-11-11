# BFR Deck redesign: UX spec ("Brave Frontier, but modern and calm")

Status: reference spec for the trial build in `BfrDeck-redesign`. Wireframes are ASCII sketches, not production. No colours, fonts or art are chosen here; that belongs to the creative-director brief. This file states what the visuals must *do* (needs), not what they look like.

Basis: all 16 screenshots in `Brave Frontier\docs\img\` were viewed, plus the CSS rule list of `wwwroot\style.css` (class names such as `.tile`, `.card`, `.chip`, `.tag`, `.box`, `.grid`, `.stat`, `.banner`, `.pullgrid`, `.metabox`, `.marquee`, `.xp .bar`). The `view-*.js` files were NOT read in detail, so wave-1 feasibility below is a design assumption to be checked by the Developer (see Risks).

Goals of the redesign
1. Feel like Brave Frontier: chunky framed unit art, rarity you can read at a glance, element colour coding, golden "primary action" feel, ornate-but-restrained section headers. Not a copy of the game's chrome.
2. Modern and clean: fewer boxes inside boxes, more air, one clear thing per screen section, text in plain language.
3. Not overwhelming: every screen answers one question, leads with the answer, and hides detail behind one click.
4. Works at 600 px wide (docked beside BlueStacks) as the primary layout. Wider windows add columns; they never add new content.

Fixed constraints (from the author): few tabs, plain-language explanations, keep the continuously scrolling featured-units marquee, check a screenshot before showing a layout change (CSS class collisions have wrecked layouts before; see wave-1 rules).

---

## 1. Audit: the 10 most important problems

Each is tied to a screenshot in `Brave Frontier\docs\img\`.

1. **Home opens with six stat tiles before anything actionable** (`home.png`). Three currency tiles plus three timer tiles take the whole first screen at 600 px. Timer sub-lines are cut off ("Daily tasks, login spin, calendar, slot me..."). The squad, the actual hero of a Brave Frontier app, starts 280 px down. Primary question "what should I do now?" is not answered.
2. **"Should I pull?" is the densest block in the app and sits in the middle of Home** (`home.png`, `home-bottom.png`). A 4-column odds table, four progress bars with different meanings (event heroes, Omni, 7 star, 5 star), a prose sentence, a "I pulled..." button and a 160 px Meta Units column are squeezed into one box. The verdict ("about 12 gems per new unit") is a small grey line at the bottom instead of the headline.
3. **Home repeats the Summon tab** (`home-bottom.png` vs `summon.png`). Featured marquee, the same four banners (Tokyo Ghoul PT 1 and PT 2 even use an identical image), and "Next week" links appear on both. Home scrolls past two screens; the same content costs the user a second read on the Summon tab.
4. **Rarity is not a visual signal** (`units.png`). All 2,281 cards show the same small "OMNI" micro-label in orange at roughly 9 px under a near-identical purple frame; nothing distinguishes Omni from 7 star at a glance, which is the single most important axis in this game. The owned check badge fights the frame for the same corner.
5. **Units filter panel pushes the list down and mixes navigation with filters** (`units.png`). Five rows of chips (GO TO, VIEW, ELEMENT, RARITY, OWNED) take about 150 px before the first unit. "GO TO" holds links (Box, Bookmarks, Tier list, Items & spheres) styled exactly like filters, so pressing "Tier list" navigates away while "Fire" filters. Items live under the Units tab with no visible sign (`items.png` shows Units tab active and no hint you are in Items).
6. **Two navigation levels and an ambiguous status area** (`docked.png`). Host row "Deck / BFRevived / Wiki / Dock / Pinned" sits above the tab strip, with "data 9h old" plus an unlabelled circular refresh arrow at the right of the tabs. Seven tabs leave no room for German labels (about 30 % longer). Tier List and Units are the same objects (units) with two entry points.
7. **Tier List repeats the filter-heavy pattern and hides its own explanation** (`tier.png`). 20 chips in four rows, a three-line grey paragraph above them, S/A/B/C collapsible sections with a tiny "S" badge, and per-card "#N" and "OMNI" labels at about 9 px. The tier letter, the real point of the screen, is the smallest heading on the page.
8. **Team Builder shouts "missing" 11 times** (`team.png`). The 13-row "Who brings what" matrix shows a red "missing" tag on most rows for a normal half-built team, which reads as an error state. Each slot card carries six tiny controls (two sphere circles, star, swap, remove); the totals box, leader-skill panels and matrix all compete at the same visual weight. The helpful part ("Fill the gaps from your box") is below the fold.
9. **Detail pages are walls of equal-weight text and chips** (`unit-page.png`, `dungeon-page.png`, `gate-page.png`). Unit page: art is small, internal skill names ("8Mavis_LS") are shown, all five skills are full paragraphs at equal weight, "Where to get" is at the bottom. Dungeon page: capture and drop lists repeat a red "Boss" tag after every entry, and there is no summary of what the dungeon is good for beyond one gold line. The glossary's dotted underlines appear on dozens of words per page, which reads as visual noise and as broken links.
10. **Scan and tour are instruction-heavy, button-flat** (`scan.png`, `tour.png`). Scan: a four-step numbered list sits above four equal-weight buttons (Start, Stop, reset, "debug frames"), with a developer-facing "debug frames" button always visible. Results hide the one decision (replace vs add vs discard) at the bottom. Tour card: a long paragraph in a floating card that covers the page below the highlighted block, 19 dots as the only progress cue, "Skip tour" and "Next" at the same visual weight.

Cross-cutting (applies to all screens): small text is used for primary information (many labels at 9 to 11 px, `.72em` to `.8em` in the CSS); dim grey on dark for explanatory text is low contrast; headings in gold, links in blue and chips in gold compete as three accent roles; cards, tiles, boxes and chips all use similar rounded-rectangle borders, so nothing reads as "more important".

---

## 2. Information architecture

### 2.1 Tabs

| Today (7) | Proposed (6) | Why |
|---|---|---|
| Home | **Home** | Keep. Becomes "today" dashboard. |
| Units | **Units** | Absorbs Tier List and Items as views inside one screen (section 3.2). |
| Tier List | (merged into Units, view "Ranked") | Same objects, one entry point. Saves a tab. |
| Summon | **Summon** | Keep. Owns all banners; Home only teases. |
| Quests | **Quests** | Keep name (matches in-game Quests). Vortex, Grand Quest, Story etc. stay as the segmented control inside. |
| Team Builder | **Team** | Shorter label; German "Team" needs no change, avoids "Team-Zusammenstellung" overflow. |
| Guide | **Guide** | Keep. |

Option B for the author to decide (see Unresolved questions): reach 5 tabs by moving Guide to a "?" icon button at the right end of the tab strip (opens the same Guide screen). Not recommended as default because Guide is the beginner entry point and an icon is less discoverable.

Tab strip rules
- Labels are one word, 4 to 8 letters in English. German budget: tab label up to 11 characters ("Rangliste" appears only inside Units, so it is not a tab).
- Six tabs at 600 px: each tab about 80 to 90 px wide, 14 px text. The right-hand cluster ("data 9h old" and refresh) is removed from the tab strip so tabs get the whole row (see 2.3).
- Active tab: filled/underlined and `aria-current="page"`; never rely on colour alone (use an underline bar or a filled pill).
- Tabs are real buttons or links in a `nav`; keyboard: Left/Right moves, Enter activates.

### 2.2 What Home leads with (in this order)

1. **Greeting strip** (avatar, name, level, "live" status): one line, 56 px high.
2. **Today strip**: the three things that change today as a single horizontal card, not three tiles: Daily reset in, Vortex today (dungeon names), Weekly selector in. One line each, never truncated (wrap instead).
3. **Squad stage** (the squad art row). This is the "Brave Frontier moment" and stays large.
4. **Featured marquee** (kept, continuously scrolling), with a single "See all banners" link to Summon.
5. **Should I pull?** as a compact answer card: one headline verdict ("About 12 gems per new unit"), the current gate switcher, and a "Details" button; the odds table and bars go behind the click.
6. **Currency** (gems, Zel, Karma) as a slim row near the greeting or at the bottom of the Today strip, not three large tiles.

Moves lower or behind a click
- Odds table, the four progress bars, Meta Units column: behind "Details" on the pull card (expands in place, or opens the gate page, which already exists).
- Banner grid (the four big banner images) and "Next week" list: removed from Home; live on Summon only. Home keeps the marquee as the teaser.
- Vortex day chips and dungeon strip: Home shows only today's open dungeons as 2 to 4 compact rows with a "All dungeons" link; the Mon..Sun chips move to Quests.
- Raw support routes and debug items (`debug frames`, scan debug): behind a "More" disclosure on the Scan screen.

### 2.3 Global chrome

- The WPF host draws the title bar and tab strip. The host row "Deck / BFRevived / Wiki / Dock / Pinned" is a second navigation level; recommendation: visually demote it (smaller, dimmer) so the tabs are clearly the primary navigation. This is a host (XAML) change, not wave 1.
- Data freshness: change "data 9h old" plus bare refresh arrow into one labelled control "Updated 9 h ago, Refresh" placed at the top right of Home only (and in an "About data" popover elsewhere). Needs the host or Home template; for the trial it can stay but must have a text label or `aria-label`/tooltip.
- Language switcher: bilingual app (English and German, persistent preference). Place a compact "EN | DE" control in the host title row next to "Pinned", or in Home's header. The Guide text is English only today; German version is pending and must be flagged in the UI ("Guide in German is coming") rather than silently mixed.

---

## 3. Per-screen layout spec (600 px wide)

Global layout: content column with 16 px side padding, 12 to 16 px vertical gap between sections, max content width 1100 px centred above 900 px window width. Section header pattern: title (left), optional one-line plain-language subtitle under it, optional "See all" link (right). Every screen has exactly one primary action, named below.

Wireframe key: `[ ]` button, `( )` chip, `<img>` art, `###` progress bar, `..` truncated.

### 3.1 Home
Purpose: "What should I do today, and is it worth pulling?" Primary action: **Open the pull details / start today's checklist** (the pull card's "Details" button).

```
+------------------------------------------------------------------+
| (av) Summoner Lv 95   BlueStacks connected . live           [Scan]  |  greeting strip
+------------------------------------------------------------------+
| TODAY                                                              |
|  Daily reset   5 h 42 m   |  Vortex   Faerie Paradise, Garden of..|  today strip
|  Selector      4 d 5 h    |  Gems 640   Zel 8.0M   Karma 919k     |  (wraps, never cut)
+------------------------------------------------------------------+
|  Squad 1  (edit)                   LS: Five Light's Force . cost 72|
|   <art>      <art>      <art>      <art>      <art>                |  squad stage
|  Lucina*     Sola      Mifune     Girl     Gemini II               |
+------------------------------------------------------------------+
| Featured this week                                    See all >    |
| <u> <u> <u> <u> <u> <u> <u> <u>  ... scrolling marquee ...        |  marquee (kept)
+------------------------------------------------------------------+
| Should I pull?   < Tokyo Ghoul PT 1 >                    5 gems/pull|
|  About 12 gems per new unit.   42% of this gate is new to you.      |  verdict first
|  [ See odds and bars ]                          [ I pulled... ]     |
+------------------------------------------------------------------+
| Vortex today                                       All dungeons >   |
|  (icons) Faerie Paradise      Nymphs, Spirits, Idols, Pots   4 lv   |
|  (icons) Garden of God        Element Totems                 7 lv   |
+------------------------------------------------------------------+
```

Components: greeting strip (avatar, name, level, connection status, "Scan" ghost button), today strip (3 stat tiles in a compact group), squad stage (existing `.tile.stagetile`, sprite canvases), marquee, pull card (headline verdict, gate switcher, details disclosure), dungeon rows.
States: no squad (empty stage with "Pick your squad in Team"); not connected (greeting shows "Not connected, units from your saved box"); no box scanned (pull card verdict becomes "Scan your box to see what is new to you" with a primary Scan button); data stale (small "Updated 9 h ago" text, amber only after 24 h); loading (skeleton blocks of the same height as the final blocks to avoid layout jump).
First-visit: tour (3.10) runs from the existing intro hook.

### 3.2 Units (browse, ranked, box, items in one screen)
Purpose: "Find a unit, see how good it is, see if I own it." Primary action: **Search / open a unit**.

```
+------------------------------------------------------------------+
| [ Search units...  (typos ok)                               ]    |
| ( Browse ) ( Ranked ) ( My box 303 ) ( Items )     segmented ctrl |
| Filters:  (Element v) (Rarity v) (Owned v)        2,281 units  x  |
+------------------------------------------------------------------+
|  +------+ +------+ +------+ +------+ +------+ +------+            |
|  |[Fi] 8| |[Wa] 8| |      | |      | |      | |      |  corner    |
|  | art  | | art  | |      | |      | |      | |      |  badges:   |
|  |******| |******| |      | |      | |      | |      |  element   |
|  | Name | | Name | |      | |      | |      | |      |  + rarity  |
|  | [v]  | |      | |      | |      | |      | |      |  + owned   |
|  +------+ +------+ +------+ +------+ +------+ +------+            |
+------------------------------------------------------------------+
```

- Top: search first, then a segmented control for the *view* (Browse, Ranked, My box, Items). This replaces the "GO TO" row, Tier List tab, and Items link; the old "cards / table" toggle becomes a small icon pair right of the filters.
- Filters collapse into three dropdown/popover chips (Element, Rarity, Owned), showing the active choice ("Element: Fire"), with one "Clear" action. The role filters from Tier List move into a "More filters" popover (Role, Box). Filter popovers are real menus with keyboard support.
- Grid: 5 columns at 600 px, 6 at 700 px, `minmax(96px, 1fr)`. Card details in 4.1.
- Ranked view: S/A/B/C sections as large letter badges (the letter is the heading); tier explanation moves to an "i" popover: "Ranked by max HP, ATK, DEF and REC plus skills. A formula, not a verdict."
- Items view: same grid but item tiles (4.1), with a type dropdown and the search box reused, and a visible "Items" selected segment.
- Empty: "No units match these filters. [Clear filters]". Loading: card skeletons. Error (data failed): "Could not load units. [Retry]".
- Long list: keep "Show more" or switch to virtual scroll later; "Show more" must show how many remain.

### 3.3 Unit page
Purpose: "Everything about one unit, answer first." Primary action: **Mark owned / Bookmark** (one toggle each).

```
+------------------------------------------------------------------+
| < Back                                                            |
|  +-----------+   [Light]  *8 Mavis                                |
|  |           |   OMNI badge   No. 850638 . Cost 54 . Lv 150       |
|  |  big art  |   [ Mark owned ]  [ Bookmark ]   bfrevive . wiki   |
|  |           |                                                    |
|  +-----------+   Good for: Healer . BB filler . Mitigation  +3    |
+------------------------------------------------------------------+
|  HP 8,300    ATK 3,300    DEF 3,300    REC 3,300                  |
|  (Lv1 5,810)  (Lv1 2,310) ...                                     |
+------------------------------------------------------------------+
|  ( Skills ) ( Where to get ) ( Lore )        tabs inside the page  |
|  Leader Skill  "80% boost to all parameters ..."                  |
|  Extra Skill   ...  [ Show more ]                                 |
|  Burst  BB 25 BC  |  Super  SBB 25 BC  |  Ultimate  UBB 30 BC     |
+------------------------------------------------------------------+
```

Changes: larger art (about 160 px), rarity and element as badges, "Good for" chips are the role tags shortened to the top 3 with "+N", four stat tiles stay, skills use plain names (Leader Skill, Extra Skill, Burst, Super Burst, Ultimate Burst) with the technical code (LS, ES, BB...) as a small suffix; internal names such as "8Mavis_LS" are removed. Each skill is a collapsed paragraph (first two lines visible) with "Show more". "Where to get" and "Lore" become in-page sections via an in-page segmented control, so detail does not push everything down.
Empty: no skill text: "No skill data for this unit yet." Unowned: owned toggle reads "Mark as owned".
Accessibility: art `alt` is the unit name; stat tiles are a `dl`.

### 3.4 Tier List (as the "Ranked" view of Units)
Purpose: "Which units are best?" Primary action: **Open a unit**.

```
+------------------------------------------------------------------+
| ( Browse ) (Ranked*) ( My box ) ( Items )                         |
| What is this? (i)     Filters: (Element v) (Role v) (Box v)       |
+------------------------------------------------------------------+
| [ S ]  Top 8%   38 units   Gods, Boltstriker, ...          [ v ]  |
|  grid of unit cards with rank number #1.. in a corner chip        |
|  [ Show more (8 left in S) ]                                      |
| [ A ]  Next 17%   ...                                       [ > ] |
+------------------------------------------------------------------+
```

Letter badge is the heading (large). Rank number is a corner chip, 11 px minimum. Owned filter defaults to "all". Only S is expanded on first load. A "Rarity" filter exists only if more than Omni and 7 star appear (keep).

### 3.5 Summon
Purpose: "What can I summon right now and is it worth it?" Primary action: **Open a gate**.

```
+------------------------------------------------------------------+
| Featured this week                                                |
| +------------------------+ +------------------------+            |
| | banner image           | | banner image           |            |
| | Name              Open | | Name              Open |            |
| | 5 gems . 8 units . 13h | | ...                    |            |
| +------------------------+ +------------------------+            |
| ( This week ) ( Next week )  <- segmented, replaces 2 headings    |
| Always open                                                       |
| Name                          Price       Units        >          |
| ...rows full width, whole row clickable, 44 px high               |
+------------------------------------------------------------------+
```

Changes: "Next week" becomes a segmented switch (This week / Next week) instead of a second long section; duplicate banners (PT 1 and PT 2 same art) show a small "PT 1 / PT 2" label and a "Part" badge so they are distinguishable; "Always open" table rows become fully clickable list rows with a chevron, not only the blue link text; "In the rotation" heading stays last.
Gate page (`gate-page.png`): lead with the "Should I pull?" verdict card (a single headline sentence plus three numbers), then "Chances per pull" as bars (rarity badge, percent, units), then the unit grid with the owned badge. Primary action there: **I pulled...**.
Empty: "No banners this week." Loading: banner skeletons at the 4:1 ratio.

### 3.6 Quests
Purpose: "Where do I farm what, and what is open today?" Primary action: **Open today's dungeon**.

```
+------------------------------------------------------------------+
| ( Vortex* ) ( Grand Quest ) ( Story ) ( Hunter ) ( Gate ) ( Trials)|
| Open today:  [Faerie Paradise] [Garden of God] [Souls Training]   |
| Mon Tue Wed Thu Fri Sat Sun   (today highlighted)                  |
| > Gathering of Souls            1 dungeon                          |
| v Enhancement                  10 dungeons                         |
|   (icons)  Souls Training Ground  [today]   Karma farm     4 lv > |
|   ...                                                              |
+------------------------------------------------------------------+
```

The six modes remain a segmented control (that is a "few tabs" win already). Add a top "Open today" strip so the common question is answered first; day chips move here from Home. Accordion headers get counts and a clear chevron. Dungeon page (`dungeon-page.png`): headline "Gives:" summary becomes a prominent summary card; capture and drop lists become compact two-column lists with a single "Boss" legend instead of a "Boss" tag per entry (a small badge only on entries that differ); drop chances shown as small bars or "7%" text, not "7% per kill" repeated.
Empty: "Nothing open today in this mode."

### 3.7 Team Builder (tab label: Team)
Purpose: "Build one squad that has no gaps." Primary action: **Add a unit to the first empty slot** (or "Fill the gaps" suggestions).

```
+------------------------------------------------------------------+
| (Squad 1*) (+ squad)                               [ name field ] |
| +------+ +------+ +------+ +------+ +------+  +-----------+      |
| | art  | | art  | | art  | | art  | | art  |  |  + friend  |      |
| |LEADER| | 2    | | 3    | | 4    | | 5    |  |   lead     |      |
| | name | | name | | name | | name | | name |  +-----------+      |
| | (o)(o)| spheres (visible on hover/focus and when set)          |
| |  ...  | per-slot menu "..." : Make leader / Swap / Remove       |
| +------+ ...                                                      |
+------------------------------------------------------------------+
| Squad check:  8 of 13 roles covered         [ Show all 13 ]       |
|  Healer ok | BB filler ok | ATK buff ok | Spark ok                |
|  Missing (5):  Crit, Mitigation, ...     [ Fill the gaps ]        |
+------------------------------------------------------------------+
| Totals   Cost 72 | HP 24,863 | ATK 8,943 | DEF 7,571 | REC 7,613  |
| Leader skill: Five Light's Force  - plain-language line           |
+------------------------------------------------------------------+
| Fill the gaps from your box (suggestions, one row per role)        |
+------------------------------------------------------------------+
```

Changes: the 13-row matrix collapses to a summary ("8 of 13 roles covered"), with the full matrix behind "Show all 13"; "missing" is expressed neutrally ("Not yet covered") with a soft marker, not red error tags; "Fill the gaps" moves up beside the summary. Slot card controls: star, swap, remove move into one "..." menu (still keyboard reachable) so each card shows art, name, element and two sphere slots only. Drag-to-reorder stays; add a visible drag handle and a keyboard alternative (Move left / Move right in the menu).
States: empty squad ("Pick a leader first. [Choose unit]"), full squad, friend lead empty (dashed slot), no box (suggestions explain "Scan your box for personal suggestions").
Team code `BFR1:...` becomes a labelled "Share code" button.

### 3.8 Guide
Purpose: "I am new, what do I do first?" Primary action: **Tick the next step**.

```
+------------------------------------------------------------------+
| New here? Start with these six.                    2 of 6 done    |
| ##########--------------------------------------------            |
| ( ) 1  Link your account          One line.                [ > ]   |
| (x) 2  Claim 30 free gems         ...                              |
|  Next up:  3  Play the story  [ Open step ]   (highlighted)        |
+------------------------------------------------------------------+
| Every day  3/7  resets 00:00 UTC                  [ Reset times ] |
|  checklist in two columns                                           |
+------------------------------------------------------------------+
| Topics (2 per row)   <icon> Title / one-line blurb                 |
| > Your notes    > Links and tools                                  |
+------------------------------------------------------------------+
```

Changes: show the *next* step prominently and collapse completed steps to one line; "Why and how" opens in place (already a `details`). Keep the topic cards (they work well in `guide-cards.png`: icon, bold title, one-line blurb). Language: mark German status explicitly ("German guide: coming").

### 3.9 Scan
Purpose: "Add my units from the game's Unit List." Primary action: **Start**.

```
+------------------------------------------------------------------+
| < Back     Scan your units                                         |
| Open Unit > Unit List in the game, press Start, scroll slowly.     |
|  (i) More help (collapsed: 4 steps, dock tip)                      |
| [ Start ]   (Stop and Reset appear only while/after scanning)      |
| status line: "Scanning... 27 units, 6 rows"                        |
| +--------------+  Recognised units  45 incl. duplicates            |
| | live preview |  [unit tiles with x to remove]                   |
| +--------------+                                                   |
| ------------------------------------------------------------------ |
| After scanning:  [ Replace my box ]  [ Add to my box ]  [ Discard ]|
+------------------------------------------------------------------+
| > More (debug frames)                                              |
```

Changes: a single primary Start; Stop replaces Start while running; Reset appears only when there is something to reset; "debug frames" moves under a collapsed "More" disclosure. Instructions shrink to two lines plus an expandable "More help". Result decision bar becomes sticky at the bottom once a scan finishes. Replace is the primary visual button but, because it overwrites the box, it asks for confirmation ("Replace 303 units with 45? [Replace] [Cancel]").
States: idle, scanning (with progress count, "no new frames, touch the game to resume" hint when only one frame), finished, error ("Could not see the game window. Make sure it is visible, not minimised.").

### 3.10 Tour card (first-start tour)
Purpose: "Show me around without getting in my way." Primary action: **Next**.

```
+--------------------------------------------------+
| Home: Should I pull?                    3 of 19   |
| Cycle through banners and gates. The bar shows    |
| how much you already own; the verdict says what a |
| new unit costs.                                   |
|   ( Skip tour )     [ Back ]       [ Next > ]      |
+--------------------------------------------------+
```

Changes: text limited to about 160 characters (two to three short sentences), "3 of 19" replaces 19 dots (or dots plus count), **Next** is the only filled button, Skip is a text link, the card is placed on the opposite half of the screen from the highlighted element so it never covers it, the highlighted element keeps its outline (`.tourfocus`), Escape closes, focus moves into the card on open and returns to the page on close, `role="dialog"` with an accessible label. Consider cutting 19 cards to about 8 for first start with the rest as "Tour: more" on demand (open question).

---

## 4. Component inventory

All sizes are guidelines; the creative-director brief sets final tokens. Spacing scale: 4, 8, 12, 16, 24. Radius: two sizes (small for chips and inputs, large for cards). Minimum text size 12 px for labels, 14 px body; nothing at 9 to 11 px carries essential information. Hit target at least 32 px high.

### 4.1 Cards
| Component | Anatomy | States |
|---|---|---|
| **Unit card** (`.card`) | Art in a framed square, element badge top-left, rarity badge (strong visual signal, see 4.3) top-right or as a coloured ribbon, owned badge bottom-right, name (max 2 lines, `title` tooltip for full name) | default, hover (lift/outline), focus-visible (clear ring), owned (badge plus check, not just tint), bookmarked (star), selected (in team picker), unavailable/greyed (not released), loading skeleton |
| **Item tile** (`.itile`) | Icon, name (2 lines) | default, hover, focus, selected |
| **Banner card** (`.banner`) | 4:1 image, title, price, unit count, status chip (Open / Soon / Ends in) | default, hover, focus, ended (muted), loading skeleton |
| **Section card** (`.box`, `.tile`) | Title row, optional subtitle, body | default, collapsed/expanded (with chevron, `aria-expanded`), warn, danger |
| **Result card** (`.result`) | Verdict headline plus 2 to 3 supporting numbers | good / neutral / caution (icon plus text, never colour only) |

### 4.2 Stat tiles
`.stat` (unit stats), `.timer` and `.tile` (Home). Anatomy: label (12 px, sentence case, no all-caps tracking), value (large, tabular numbers), optional sub-line (wraps, no ellipsis for meaning). States: default, loading ("--"), stale (small "updated 9 h ago"), warning (icon plus text). Numbers: format per language (EN `8,048,080`; DE `8.048.080`); use `Intl.NumberFormat` with the user's language.

### 4.3 Rarity and element badges
- **Rarity needs a strong visual signal** that works in a grid of hundreds of same-rarity cards and also works without colour (colour-blind safe): a distinct shape or ribbon plus the star count or "Omni" mark, large enough to read at card size, consistent top-right position. Omni, 7 star, 6 star, 5 star, 4 star each need a clearly different treatment (not just a colour shift). The old orange 9 px "OMNI" text is retired.
- **Element badge**: icon plus a short text label available to screen readers and tooltip ("Fire"); frame/border colour accent per element stays (`el-1` to `el-6`) but the icon carries the meaning so the colour is not the only cue.
- Role tags (`.tag`, `.chip.static`): neutral style, max three shown then "+N".
States: default, on a filter chip (active), hover tooltip with glossary text.

### 4.4 Chips and filters (`.chip`)
Variants: filter chip (toggle, `aria-pressed`), dropdown chip (shows current choice, opens menu), static tag, count chip. One accent role only for "selected". Minimum 28 px high at 600 px. Clear-all action is always visible when any filter is active. Do not use chips as navigation (current "GO TO" row).

### 4.5 Buttons
| Type | Use | Rule |
|---|---|---|
| Primary (`button.primary`) | One per screen/section | Filled, golden feel as in the game |
| Secondary | Other actions | Outlined |
| Ghost / link | Tertiary (Skip, See all) | Text only, underline on hover and focus |
| Icon button (`button.icon`) | Refresh, arrows, "..." | Always has `aria-label` and tooltip |
| Destructive | Replace box, Reset | Needs a confirm step |
States for all: default, hover, active (pressed), focus-visible, disabled (explained by tooltip, not only dimmed), loading (spinner plus label).

### 4.6 Tabs and segmented controls
- Primary tabs (host strip): 6 items, underline or filled pill for active, `aria-current`.
- Segmented control (Units views, Quests modes, Summon this/next week): same visual family as the primary tabs but smaller; arrow-key navigation; selected state with a non-colour cue.
- In-page tabs (Unit page): same segmented control.

### 4.7 Progress bars (`.xp .bar`)
Anatomy: label (left), "34 / 63" (right), bar with percentage inside only when wide enough (the 50 % label inside the fill at a narrow width is hard to read in `home.png`; place text outside). One bar style, three states: normal, complete (100 %, check icon), empty. Always pair colour with a number. `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`. Used for: gate ownership, guide progress, scan progress.

### 4.8 Marquee (kept)
Continuously scrolling featured units. Spec: constant slow speed, pauses on hover and on focus, drag to scroll (`dragMarquee` already exists), clicking a unit opens the unit page, bottom accent in the unit's element colour. Accessibility: respect `prefers-reduced-motion` (stop animation and show a plain horizontally scrollable row), content is duplicated for the loop so the duplicate set must be `aria-hidden`, and the first set stays tab-reachable. Add a visible "pause" control for keyboard and screen-reader users (WCAG 2.2.2 moving content). Fade the left and right edges instead of hard-clipping unit art (`home.png` shows cut-off sprites at the edges).

### 4.9 Modals, popovers and toasts
| Component | Use | Rules |
|---|---|---|
| Modal (intro, "I pulled...", confirm) | Needs a decision | Focus trap, Escape closes, focus returns to trigger, `role="dialog"`, one primary button, backdrop dims |
| Popover (filters, info "i") | Contextual choice or help | Opens under trigger, Escape closes, no focus trap for info |
| Tooltip (`.gltip`) | Glossary | Shown on hover and focus, not hover only; see glossary note |
| Toast (`.toast`) | Confirmation ("Box saved") | Auto-dismiss 4 s, `role="status"`, never the only place an error appears |
| Tour card | See 3.10 | |

Glossary annotation: the dotted-underline treatment is applied to very many words. Spec: underline only the first occurrence of a term per section, never inside headings or buttons, and use a softer underline so a page is not covered in them; the glossary stays English only today (German pending).

### 4.10 Other
- **Table** (`table.odds`, `table.utable`): numeric columns right-aligned with tabular numbers; header row sticky in long tables; at 600 px prefer row cards or hide the least important column rather than horizontal scroll.
- **Empty state**: icon or art, one sentence, one action.
- **Skeleton loaders**: same dimensions as final content.
- **Error state**: plain language, what happened, what to do, one retry button; no raw codes.
- **Disclosure** (`details.cat`, "Show more"): chevron plus text; remaining count shown.

---

## 5. Cross-cutting notes

### 5.1 Accessibility
- Contrast: text at least 4.5:1, large text and UI borders at least 3:1. The "dim" grey and "faint" grey text classes are the likeliest to fail; the creative-director palette must be checked against them (QA to measure).
- Colour is never the only signal for rarity, element, owned or status (use icon plus text).
- Keyboard: every interactive element reachable in a logical order; visible `:focus-visible` ring on all of them; Escape closes modals and popovers; cards are links or buttons, not clickable divs; drag-reorder has a keyboard alternative.
- Screen readers: `aria-label` on icon buttons, tab strip `nav` with `aria-current`, progress bars with values, art `alt` equals unit name, decorative art `alt=""`, live regions for scan progress and toasts.
- Motion: respect `prefers-reduced-motion`; marquee has a pause control.
- Text: base 14 px, allow user zoom to 200 % without loss; no information at under 12 px.

### 5.2 Bilingual (English and German)
- All new UI strings go through the localisation layer (`locales/en.json`, `locales/de.json` per the language policy) with no string built by concatenating fragments; the existing code may have English strings inline (not verified), so the Developer must check.
- Budget 30 % extra length: tab labels, button labels, chips and table headers must wrap or shorten gracefully; no fixed-width containers for text; avoid truncating essential content with ellipsis (use two lines).
- Dates and numbers via `Intl` for the selected language (DE: `9. Nov., 09:00`, `8.048.080`); countdowns "5 h 42 m" become "5 Std. 42 Min.".
- Language switcher visible without opening a menu ("EN | DE"), preference persisted per user (localStorage key e.g. `lang`), applied before first paint to avoid flashing.
- Glossary and Guide are English only today: show a small notice in German mode rather than silently mixing languages. German UI text is a separate deliverable and is pending (not produced in this spec).

### 5.3 Responsive behaviour
| Width | Layout |
|---|---|
| 600 to 700 px (docked, primary) | Single column; grids 5 to 6 unit columns; two-column banners; tab strip six tabs, no right cluster |
| 700 to 1000 px | Same content, 7 to 8 unit columns, Home pull card shows odds table beside verdict |
| over 1000 px | Content capped at about 1100 px and centred; Home may place Today and Squad side by side; no extra content |
Rules: never horizontal-scroll the page at 600 px (the current `min-width: 520px` rule on `.slots.six, table.matrix, table.utable` is the exception to remove or reflow); no text smaller than 12 px at any width.

### 5.4 Copy tone
Plain language, sentence case, no jargon without a hint (LS, ES, BB, SBB, UBB shown as "Leader Skill", "Extra Skill", "Burst" with the code in small text). Per the author: no "what works / what is broken" content, no "not confirmed" remarks; "missing" style negatives are replaced with neutral "not yet covered".

---

## 6. Prioritised build list

### Wave 1: CSS and markup classes, no JS logic changes (trial build)
Safety rules (a past class collision wrecked the layout): add new classes rather than changing the behaviour of generic ones (`.box`, `.tile`, `.card` are shared across views); scope with a view-level wrapper class (for example `.v-home`, `.v-units`) and capture a 600 px screenshot of every screen after each step.

1. **Typography and spacing tokens**: raise minimum text sizes (replace the `.72em`-`.8em` essentials), line-height, spacing scale, two radii; headings get one consistent style. (CSS only.)
2. **Unit card redesign**: rarity badge and element badge as corner elements, owned badge, hover and focus states, 5-column grid at 600 px. Needs a class per rarity on the card; if the card template does not already emit a rarity class, this is a one-line markup change (template string), not logic.
3. **Tab strip and chrome**: remove the "data 9h old" cluster from the tab row via CSS or relocate it, active-tab style, 6 tabs fit at 600 px. Host-drawn parts in `MainWindow.xaml` are wave 3.
4. **Home hierarchy by CSS**: reorder sections with CSS `order` where the markup container is a flex or grid; compact the three currency tiles and the three timer tiles into one grouped strip; hide the banner grid and "Next week" on Home with a class (the content is already on Summon); soften the Should-I-pull box (verdict line emphasised using existing elements).
5. **Units filter panel**: restyle rows into a compact toolbar; lay chips out as one wrapped row per group with smaller labels (full dropdown conversion is wave 2).
6. **Progress bars, chips, buttons, tags**: unified states (hover, focus-visible, disabled, pressed); text outside narrow bars; "Boss" tags de-emphasised via CSS; drop-list tags smaller.
7. **Glossary underline softening** (CSS only on `.gl`) and tooltip focus styling.
8. **Marquee polish**: edge fade, hover and focus pause, `prefers-reduced-motion` rule (CSS animation-play-state and media query; if the marquee is driven by JS, pause control is wave 2).
9. **Tour card styling**: size, placement offsets, button hierarchy (Next filled, Skip as link); progress "3 of 19" needs a small markup edit if absent.
10. **Team slot and totals polish**: neutral "not yet covered" styling for `.tag.red` inside the matrix via a scoped class; slot cards visually quieter.
11. **Focus rings and contrast pass** across all of the above (QA check).

### Wave 2: small markup and light JS (no data logic)
- Merge Tier List and Items into the Units view with the segmented control (routes `#/tier` and items keep working, they open Units with the view preselected; `view-units.js` render calls are reused, not rewritten).
- Filters as dropdown chips and a "More filters" popover; sticky "Clear".
- Home: collapse "Should I pull?" to verdict card with "See odds" disclosure; Today strip as one component; remove Home banner grid in markup instead of by CSS.
- Unit page: plain skill names, collapsed skill paragraphs, in-page segmented control, role chips limited to three with "+N".
- Team: roles summary with "Show all 13", slot "..." menu, drag handle.
- Scan: single Start/Stop button logic by class toggle, "More" disclosure for debug, confirm for Replace.
- Quests: "Open today" strip; Summon "This week / Next week" segmented control.
- Tour: shorten copy, count indicator, dialog semantics.
- Localisation layer for new strings, language switcher, `Intl` formats.

### Wave 3: needs host or larger change
- Demote or merge the host row (Deck / BFRevived / Wiki / Dock / Pinned) in `MainWindow.xaml`; move language switcher and data-freshness control into host chrome if desired.
- Virtual scroll for the 2,281-unit list.
- Skeleton loaders everywhere; empty and error states audit.
- Reduce the tour to about 8 cards with an on-demand extended tour.
- German Guide and glossary text; full German QA pass (layout overflow).

---

## Risks
- Wave-1 estimates assume the markup already exposes enough hooks (classes) per view. Not verified against `view-*.js`; Developer to confirm in a half-day spike before committing to the wave split.
- The Units merge (Tier + Items) touches routing (`#/tier`, items route); keep old hashes working so the guide, tour and README links do not break.
- CSS reordering with `order` only works if section containers are flex or grid; otherwise it needs markup moves.
- Hiding banners on Home by CSS leaves the data in the DOM (cheap, but remove in wave 2).
- Removing the "data age" cluster from the tab strip changes host-visible layout; the host may also need an adjustment.
- Rarity treatment depends on the creative-director brief; until it lands, wave-1 item 2 can ship only a placeholder shape-plus-text version.
- All claims about current screens come from the screenshots, which were captured before this redesign worktree; the redesign worktree may already differ.
- Contrast ratios were not measured; QA must measure with the final palette.

## Unresolved questions for the author
1. Tabs: go with **6 tabs** (Tier List merged into Units), or **5** by moving Guide behind a "?" icon (Option B)?
2. Should "Should I pull?" stay on Home as a verdict card (recommended), or move entirely to Summon so Home becomes purely "today"?
3. Is it acceptable to merge Items into Units as a view (items.png shows it already lives there informally)?
4. Language switcher: in the host title row (needs XAML) or inside Home's header (CSS/JS only)?
5. Tour length: keep 19 cards, or cut to about 8 for first start?
6. Team tab: is the full role matrix (13 rows) valuable to the author daily, or is a covered/not-covered summary with an expand enough?
7. Rarity signal: The author's preference between a corner ribbon/shape and a frame treatment (to hand to the creative director); no colour decision requested here.
8. Scope of German for this trial: UI chrome only, or also Guide and glossary (currently English only)?
