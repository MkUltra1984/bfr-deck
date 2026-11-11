# BFR Deck redesign: review of ux.md and visual.md

Reviewer: Quality Controller (independent), 2026-11-09. Saved by the orchestrator (the reviewer had no Write tool). No code was run during the review.

## Verdict: build with changes

The direction (Midnight Gilt, verdict-first Home, marquee kept) fits the request. Blocking issues and the corrected wave-1 scope below replace ux.md section 6 for the trial build.

## Blocking issues (all addressed in the build)

1. visual.md's token block drops `--dim`, `--faint`, `--bg2`, `--bg3`, `--red`, `--green`, `--blue` (109 uses in style.css, one inline in view-guide.js). Keep them as aliases of the new tokens.
2. A `.tile::before` echo line collides with `.tile.stripe::before` (timer stripe, rewritten every second by `tick()`). Use an inset box-shadow instead; target timer tiles by `[data-k]`.
3. `button:hover` after `button.primary` turns gold buttons navy on hover. Give `button.primary` its own hover/active rules; no `.btn-*` classes.
4. `#dataAge` and `#refresh` must stay in the DOM (app.js binds them at boot). Restyle or hide only.
5. Seven tabs plus wide padding overflow 588 px. Tight tab padding, no crest or icons inside `#nav`.
6. Paid image generation needs the author's yes. (the author answered yes in the popup: "Generated ornaments".)

## Main non-blocking issues

- Only the title row is XAML; the seven tabs are `#nav` in index.html.
- Host `Background` and `Bar` colours must follow the new palette, or a grey 6 px seam shows.
- Rarity: one signal only. The CDN icons already carry the game frame, so no extra ring; style `.stars` per rarity and tint the card via a rarity class.
- Card corners are taken (owned top-left, bookmark top-right, team label bottom-left, tier rank bottom-right). Rarity stays under the art.
- No panel-enter animation (re-renders on every click and traps `.tourfocus` stacking).
- Nested em sizes produce 6 to 9 px labels; use absolute floors (12 px, 11 px only for tiny badges).
- Two banned remarks exist: guide.js "Pity rewards ... do not work yet" and glossary.js "partly unconfirmed". Remove.
- Marquee must keep running; no reduced-motion stop unless the author asks.
- No blur on the tour overlay (`.overlay.intro.tour`).
- Default buttons keep a neutral border; gold is rare.
- All new strings are English only; a German edition is pending before any merge to main.

## The author's decisions (popup, 2026-11-09)

Indigo + gold palette; keep all 7 tabs (no Team rename); short "Should I pull?" verdict with odds behind a click; generated ornaments (corner, crest, empty state); body text 14 px. Not chosen: Cinzel font, shorter tour. Not asked, kept as today: Home banner grid, marquee behaviour, no German-status notice.

## Selectors that must keep matching

Tour focus targets `#home-top`, `.tiles > .tile:nth-child(1)`, `.stagetile`, `.pulltile`, `.metabox`, `.marquee`, `.vortextile`, `.filters`, `.box`, `.slots`, `.matrix`, `.gaprow`; `#/home/pulled` needs `.pulltile .chip` starting "I pulled"; glossary skip/annotate classes (`.chip`, `.tag`, `.fchips button`, `.slothead`, `.flabel`, `.xpl span:first-child`, `.n`, `.aname`, `.card`); routes `#/tier`, `#/items`, `#/gates`, `#/units/box|marks`, `#/scan`.
