# BFR Deck redesign: visual direction

Status legend: everything here is a **recommendation** unless marked "the author decided". The author decided (from his request and the project CLAUDE.md): Brave Frontier style and palette, modernized; clean, few tabs, beautiful; keep the scrolling featured-units marquee. Layout and information architecture belong to the separate UX brief.

Sources read: current `style.css`, screenshots `docked.png` and `home.png` (the real game next to the app). No web research was needed; the docked screenshot is the primary reference. Contrast ratios below are hand-computed from the WCAG 2.x relative-luminance formula (no tool run), so treat them as +/- 0.1.

## 1. Direction: "Midnight Gilt"

Midnight Gilt keeps Brave Frontier's identity of deep indigo panels, a gold-trimmed frame and crimson as the call-to-action accent, but reduces the game's heavy bevelled borders to a single gold hairline with a faint inner echo line. Surfaces are calm navy planes with almost no texture, so the loud unit sprites, banners and element colours are the only saturated things on screen. Ornament appears only at structural points (panel corners, section dividers, the header crest, rarity frames), and all body content sits in plain, generously spaced, readable type.

The current app is neutral grey-black with a yellow accent. The shift is: grey becomes indigo-navy, yellow becomes antique gold, and crimson is added for primary danger and primary action emphasis.

## 2. Design tokens

```css
:root {
  /* Surfaces: three levels plus the page. Indigo-navy, never pure black. */
  --bg:        #0b0d1a;  /* page, behind everything */
  --surface-1: #121528;  /* panels / tiles */
  --surface-2: #1a1e38;  /* raised: cards, inputs, table header */
  --surface-3: #232848;  /* hover, pressed, selected row, chips */

  /* Lines */
  --line:       #2c3158;               /* default hairline, neutral */
  --line-soft:  rgba(140,146,200,.14); /* table rows, dividers inside panels */
  --line-gold:  rgba(217,169,60,.55);  /* panel frames */
  --line-gold-strong: #d9a93c;         /* focus, selected */

  /* Text */
  --ink:   #ece8dc;  /* primary, warm off-white */
  --ink-2: #a9aac3;  /* secondary */
  --ink-3: #8b8dab;  /* tertiary: captions, units, disabled labels */

  /* Gold */
  --gold:       #d9a93c;  /* base: accents, active tab, numbers */
  --gold-light: #f2d27a;  /* highlights, gradient top, 7* stars */
  --gold-dark:  #8f6a1e;  /* gradient bottom, bar fills, borders on gold-tinted bg */
  --gold-wash:  rgba(217,169,60,.10); /* tinted backgrounds for "on" states */
  --on-gold:    #1a1204;  /* text on gold buttons */

  /* Crimson */
  --crimson:      #b42334;  /* fills: alert badge, destructive button, notification dot */
  --crimson-deep: #7d1624;  /* gradient bottom */
  --crimson-text: #f0707e;  /* crimson used as text/icon on dark surfaces */

  /* Elements (1 Fire, 2 Water, 3 Earth, 4 Thunder, 5 Light, 6 Dark) */
  --el1: #ee5a3c;
  --el2: #3d9be9;
  --el3: #5fbf5a;
  --el4: #f0c63a;
  --el5: #f4ecd2;
  --el6: #a46ae6;

  /* Rarity */
  --r5:    #b9c3d9;  /* 5 star: silver */
  --r6:    #e6a24a;  /* 6 star: amber bronze */
  --r7:    #f6d878;  /* 7 star: bright gold (glow, see section 4) */
  --rOmni: conic-gradient(from 200deg, #f6d878, #f08fb4, #a46ae6, #5fd0f0, #f6d878); /* Omni: prismatic, used as border/gradient only */
  --rOmni-text: #f6e7ff;  /* Omni label text */

  /* Status */
  --success: #5fcf8a;
  --warning: #f0a43a;
  --danger:  #f0707e;   /* same as --crimson-text */

  /* Shape and shadow */
  --r-sm: 6px; --r-md: 10px; --r-lg: 14px;
  --shadow-1: 0 1px 0 rgba(255,255,255,.03) inset, 0 6px 18px rgba(2,3,12,.45);
  --shadow-2: 0 12px 36px rgba(2,3,12,.65);
}
```

### Contrast (WCAG 2.x, computed)

Surface luminances: bg 0.0043, surface-1 0.0082, surface-2 0.0143, surface-3 0.0235.

| Foreground | on bg | on surface-1 | on surface-2 | on surface-3 | Verdict |
|---|---|---|---|---|---|
| `--ink` #ece8dc (body) | 17.4 | 14.7 | 12.9 | 11.7 | AAA |
| `--ink-2` #a9aac3 | 9.4 | 7.9 | 7.0 | 6.3 | AA/AAA |
| `--ink-3` #8b8dab | 6.6 | 5.6 | 5.1 | 4.4 | AA on bg, s1, s2; below 4.5 on surface-3, so do not use `--ink-3` for small text on surface-3 |
| `--gold` #d9a93c (accent text) | 9.8 | 8.3 | 7.5 | 6.6 | AAA |
| `--crimson-text` #f0707e | 7.4 | 6.3 | 5.6 | 5.0 | AA |
| `--success` #5fcf8a | 10.9 | 9.3 | 8.3 | 7.4 | AAA |
| `--warning` #f0a43a | 10.2 | 8.7 | 7.8 | 6.9 | AAA |

Other pairs: `--on-gold` #1a1204 on gold base 8.6, on gold-light 12.6, on the darker button stop #b98a2a 5.9. White on `--crimson` #b42334 is 6.5. Plain `--crimson` as text on dark surfaces is about 2.4, so it is **fill only**; use `--crimson-text` for text.

Element colours are for borders, glows, dots and icons (non-text, need 3:1): all six are at least 4.9 on surface-1 (Fire 5.3, Dark 5.0, Water 6.1, Earth 7.8; Thunder and Light are higher) and at least 3.9 on surface-3. Never rely on element or rarity colour alone: pair with the element icon or star count (colour-blind safety, especially Fire vs Earth and 6 vs 7 star).

## 3. Typography

**Recommendation: no downloads by default.**

```css
--font-body:    "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif;   /* keep: already in use, excellent legibility at 13-15px */
--font-display: "Constantia", "Palatino Linotype", Georgia, serif;             /* shipped with Windows; fantasy-tinged serif for titles only */
--font-num:     "Segoe UI Variable Display", "Segoe UI", sans-serif;           /* with font-variant-numeric: tabular-nums */
```

Optional upgrade (the author's call): bundle **Cinzel** (SIL OFL, free to embed) as a local `woff2` for the app name and h1 only. It is the closest free match to the game's engraved capitals and costs about 25 KB, but it is caps-only in feel, so it must never be used for body text, numbers or long titles. Constantia is the zero-risk default; the app works offline either way because the file would be local.

Scale (base raised from 13.5px to 14px for readability beside the game; German runs about 30% longer, so no title may rely on a fixed width):

| Role | Font | Size | Weight | Notes |
|---|---|---|---|---|
| Display / h1 | display | 1.5rem (21px) | 600 | letter-spacing .02em |
| Section title (panel header) | display | 1.0625rem (15px) | 600 | gold-light, letter-spacing .06em, uppercase optional for EN only |
| h3 / card title | body | .95rem | 600 | ink |
| Body | body | 1rem (14px) | 400 | line-height 1.5 |
| Secondary | body | .875rem | 400 | ink-2 |
| Caption / label | body | .75rem | 500 | ink-3, letter-spacing .05em, uppercase only for short labels |
| Big number (gems, zel) | num | 1.35rem | 700 | tabular-nums, ink |
| Percent / odds | num | inherit | 600 | gold |

Minimum text size 11px (.75rem at 14px base is 10.5px; set caption floor to `max(.75rem, 11px)`).

## 4. Surfaces and ornament

Principle: one gold hairline plus one inner echo line is the whole "frame". Heavy bevel, thick gradients and drop shadows on every element are the clutter being removed.

```css
/* Page: calm vertical wash, no texture */
body { background: radial-gradient(120% 60% at 50% -10%, #171b3a 0%, var(--bg) 60%); }

/* Panel / tile: the signature frame */
.tile, .box, .panel {
  position: relative;
  background: linear-gradient(180deg, var(--surface-1) 0%, #0f1224 100%);
  border: 1px solid var(--line-gold);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-1);
  padding: 14px 16px;
}
.tile::before, .box::before, .panel::before {      /* inner echo line */
  content: ""; position: absolute; inset: 3px; border-radius: 7px;
  border: 1px solid rgba(217,169,60,.12); pointer-events: none;
}
/* corner ornament, only on .panel.ornate (one or two per screen, not every tile) */
.panel.ornate { background-image: url(img/corner.png), url(img/corner.png), url(img/corner.png), url(img/corner.png), linear-gradient(180deg, var(--surface-1), #0f1224);
  background-repeat: no-repeat; background-size: 22px 22px; background-position: left 4px top 4px, right 4px top 4px, left 4px bottom 4px, right 4px bottom 4px, 0 0; }
.panel.ornate::before { display: none; }   /* corners replace the echo line */

/* Panel header: title with a fading gold rule, not a filled bar */
.panel-h { display:flex; align-items:center; gap:10px; margin:0 0 10px;
  font: 600 1.0625rem var(--font-display); letter-spacing:.06em; color: var(--gold-light); }
.panel-h::after { content:""; flex:1; height:1px; background: linear-gradient(90deg, var(--line-gold), transparent); }

/* Tab bar: flat, gold underline on the active tab, crest left (see artwork) */
#nav { background: linear-gradient(180deg, #10132a, var(--surface-1)); border-bottom: 1px solid var(--line-gold); padding: 0 10px; gap: 4px; }
#nav a { position: relative; color: var(--ink-2); padding: 11px 12px; border-radius: 0; font-weight: 500; }
#nav a:hover { color: var(--ink); }
#nav a.on { color: var(--gold-light); }
#nav a.on::after { content:""; position:absolute; left:10px; right:10px; bottom:-1px; height:2px; border-radius:2px;
  background: linear-gradient(90deg, transparent, var(--gold), transparent); box-shadow: 0 0 10px rgba(217,169,60,.55); }

/* Buttons */
button { font: inherit; border-radius: var(--r-sm); padding: 6px 14px; cursor: pointer; transition: border-color .12s ease-out, background .12s ease-out, transform .12s ease-out; }
.btn-primary, button.primary {                      /* gold: one per view */
  color: var(--on-gold); font-weight: 600;
  background: linear-gradient(180deg, var(--gold-light) 0%, var(--gold) 55%, #b98a2a 100%);
  border: 1px solid #f7e3a0; box-shadow: 0 1px 0 rgba(255,255,255,.35) inset, 0 4px 12px rgba(217,169,60,.25); }
.btn-primary:hover { filter: brightness(1.06); transform: translateY(-1px); }
.btn-primary:active { transform: translateY(0); filter: brightness(.96); }
.btn-secondary, button {                            /* default */
  color: var(--ink); background: var(--surface-2); border: 1px solid var(--line-gold); }
.btn-secondary:hover, button:hover { background: var(--surface-3); border-color: var(--gold); }
.btn-quiet { color: var(--ink-2); background: transparent; border: 1px solid transparent; }
.btn-quiet:hover { color: var(--gold-light); background: var(--gold-wash); }
.btn-danger { color: #fff; background: linear-gradient(180deg, var(--crimson), var(--crimson-deep)); border: 1px solid #d4505f; }
:focus-visible { outline: 2px solid var(--gold-light); outline-offset: 2px; }   /* keep visible focus everywhere */

/* Chips: filters and toggles */
.chip { background: var(--surface-2); border: 1px solid var(--line); border-radius: 999px; padding: 2px 11px; font-size: .8125rem; color: var(--ink-2); }
.chip:hover { border-color: var(--gold-dark); color: var(--ink); }
.chip[aria-pressed=true], .chip.on { color: var(--gold-light); background: var(--gold-wash); border-color: var(--gold); }

/* Cards (unit tile): calm plate, element shown by a 3px top edge and a faint glow, not a fill */
.card { background: var(--surface-2); border: 1px solid var(--line); border-top: 3px solid var(--el, var(--line)); border-radius: var(--r-md);
  transition: border-color .15s, box-shadow .15s, transform .15s; }
.card:hover { border-color: var(--gold-dark); border-top-color: var(--el, var(--gold)); box-shadow: 0 8px 22px rgba(2,3,12,.55), 0 0 0 1px rgba(217,169,60,.18); transform: translateY(-2px); }
.card img { background: radial-gradient(circle at 50% 40%, #232848, #0b0d1a); }   /* never pure #000 behind sprites */

/* Rarity frame: applied to the sprite portrait */
.rf { border-radius: 10px; padding: 2px; background: var(--rc, var(--r5)); }   /* 2px metallic ring */
.rf.r5 { --rc: linear-gradient(160deg, #e3e9f5, #8794ad); }
.rf.r6 { --rc: linear-gradient(160deg, #f3c27c, #a8692a); }
.rf.r7 { --rc: linear-gradient(160deg, #fff0b0, #d9a93c 55%, #8f6a1e); box-shadow: 0 0 12px rgba(246,216,120,.35); }
.rf.omni { --rc: var(--rOmni); box-shadow: 0 0 14px rgba(164,106,230,.35); }
.rf > img { display:block; border-radius: 8px; }
.stars.r5 { color: var(--r5); } .stars.r6 { color: var(--r6); } .stars.r7 { color: var(--r7); text-shadow: 0 0 6px rgba(246,216,120,.5); }
.stars.omni { background: var(--rOmni); -webkit-background-clip: text; background-clip: text; color: transparent; }   /* label always also says "Omni" in text */

/* Progress bars: gold fill, never the old orange-to-gold on every bar */
.bar { height: 10px; background: var(--bg); border: 1px solid var(--line); border-radius: 999px; overflow: hidden; }
.bar .fill { background: linear-gradient(90deg, var(--gold-dark), var(--gold) 70%, var(--gold-light)); }

/* Modal */
.overlay { background: rgba(5,6,16,.72); backdrop-filter: blur(3px); }
.modal { background: linear-gradient(180deg, #151934, var(--surface-1)); border: 1px solid var(--line-gold-strong); border-radius: var(--r-lg);
  box-shadow: var(--shadow-2), 0 0 0 4px rgba(217,169,60,.06); padding: 18px 20px; }

/* Inputs */
input, select { background: var(--bg); border: 1px solid var(--line); border-radius: var(--r-sm); color: var(--ink); padding: 6px 10px; }
input:focus, select:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(217,169,60,.18); outline: none; }

/* Status stripes (replace the green stripe tiles): success/warning/danger */
.tile.stripe::before { width: 3px; background: var(--success); } .tile.stripe.warn::before { background: var(--warning); } .tile.stripe.bad::before { background: var(--crimson-text); }

/* Alert dot, echoing the game's red notification badge */
.dot-alert { min-width: 18px; height: 18px; border-radius: 999px; background: var(--crimson); color: #fff; font: 700 .7rem/18px var(--font-num); text-align: center; box-shadow: 0 0 0 2px var(--surface-1); }
```

Where crimson goes (keep it rare so it stays meaningful): alert and notification dots, destructive buttons, the "live" recording state, limited-time or ending-soon tags. It is not a general accent; gold is.

## 5. Motion

Calm and short; the sprites already provide the movement.

1. **Hover and press**: 120 ms `ease-out` for colour, border and background; cards lift 2 px over 150 ms; buttons lift 1 px, press returns to 0.
2. **View and panel enter**: on tab change, panels fade in and rise 6 px, 220 ms `cubic-bezier(.2,.7,.2,1)`, staggered 40 ms per panel up to four panels, then no stagger.
3. **Active tab underline**: slides to the new tab in 180 ms `cubic-bezier(.4,0,.2,1)` (single absolutely positioned gold bar, not a per-tab fade).
4. **Marquee (kept)**: linear, constant 30 px/s, pauses on hover and drag (existing behaviour), 6% edge fade mask retained; edge-mask colour should fade to `--surface-1`.
5. **Prestige shimmer**: 7-star and Omni frames get one soft light sweep across the frame, 1.6 s `ease-in-out`, repeating every 9 s; Omni border hue rotates slowly. Nothing else on screen shimmers.
6. **Accessibility**: under `prefers-reduced-motion: reduce`, disable lift, stagger, shimmer and hue rotation; marquee becomes a manual horizontal scroll strip. Progress bars animate width over 300 ms ease-out on change only.

## 6. Artwork (gpt-image-2)

Principle: do most ornament in CSS and inline SVG (hairlines, gradients, star glyphs). Generate only four items where hand-drawn finish adds real value. All are small. Ask for transparent PNG output; keep them in `wwwroot/img/`. The game's own gem, zel and karma icons stay as they are. Prompts deliberately avoid the Brave Frontier logo, characters and any trademarked text; the result is "inspired by", not a copy, so the app does not ship lookalike trade dress (the existing CDN sprites and icons are Gumi/Alim Co. assets and should be noted as such in the app's credits, which is a licensing point for the author).

| # | Asset | Size | Used where | Prompt |
|---|---|---|---|---|
| A1 | Corner ornament | 256x256, transparent PNG, shown at 22px; one corner, mirrored by CSS if needed | `.panel.ornate` four corners (hero squad panel, modal) | "Single top-left corner flourish for a fantasy RPG interface frame, thin antique gold filigree with a small diamond jewel at the corner point, two fine curved lines extending along the edges, flat vector style, crisp 2px-equivalent strokes, gold gradient from #f2d27a to #8f6a1e, transparent background, no text, no shadow, centered on canvas, view from above" |
| A2 | Header crest | 512x192, transparent PNG, shown at about 40px tall, left of the tab bar | App nav bar, loading screen, first-start intro | "Small heraldic crest emblem for a fantasy mobile-game companion app: a stylised winged shield with a sword pointing upward, engraved antique gold on deep indigo, thin fine lines, minimal detail so it stays readable at 40px, symmetric, no letters, no text, transparent background, flat vector illustration with subtle gold gradient highlights" |
| A3 | Empty-state illustration | 768x512, transparent PNG, shown at about 200px wide | Empty squad slot area, empty collection, no-results search | "Empty ornate stone pedestal with a faint glowing gold ring above it, fantasy RPG style, soft indigo and gold palette, muted so it stays calm, a few drifting gold sparkles, no characters, no text, transparent background, painterly but clean, low contrast so it sits quietly on a dark navy panel" |
| A4 | Tab and section icon set | 1024x256 sprite sheet, 6 icons in a row (Home, Units, Tier, Summon, Quests, Team), transparent PNG; each cell 128px so it can be sliced | Nav tabs at 18-20px; section headers | "Set of six matching minimalist fantasy RPG menu icons in a row on a transparent background: a house/keep, a helmet, a laurel-wreath with a crown, a glowing summoning circle, a scroll with a sword, a shield with three small figures. Each icon is a single-colour antique gold line icon (#d9a93c), uniform 4px stroke, rounded joins, equal visual weight, generous padding, no text, no gradients" |

Optional A5 (only if the author wants it): a seamless 512x512 page texture at 4% opacity ("very subtle seamless indigo parchment grain, dark navy #0b0d1a base, barely visible fibres, no pattern, no gold") for the body background. Not recommended initially: gradients alone are cleaner.

Generate A4 icons as SVG if quality allows; line icons are better as vectors. If the model output is raster-only, trace them in the build step.

## 7. Do and don't

**Do**
1. Use one gold hairline (1px) plus the 3px inner echo line as the entire frame language.
2. Keep surfaces to the three navy levels; let sprites, banners and element colours be the only saturated areas.
3. Use gold for numbers, active states and section titles; use crimson only for alerts, destructive actions and "live".
4. Pair every element or rarity colour with an icon or star count, so colour is never the only signal.
5. Use the display serif only for the app name, h1 and panel titles; everything else stays in Segoe UI.
6. Leave 14-16 px panel padding and 10-12 px gaps; if a view feels dense, remove content before shrinking spacing.
7. Keep a visible gold focus ring and 4.5:1 text contrast everywhere; verify German strings do not overflow buttons and tabs (about 30% longer).
8. Reserve prestige effects (glow, shimmer, prismatic border) for 7 star and Omni so they stay special.

**Don't**
1. Don't recreate the game's thick bevelled, multi-layer gold borders or its chunky outlined fonts; modernized means thinner and quieter.
2. Don't put textured or high-contrast backgrounds behind unit sprites or banners; never pure `#000` behind sprites.
3. Don't use more than one gold primary button per view.
4. Don't use `--crimson` as text on dark surfaces (2.4:1); use `--crimson-text`.
5. Don't mix element colours as decorative fills; they mean Fire/Water/Earth/Thunder/Light/Dark only.
6. Don't animate anything beyond the marquee, hover lift, panel enter, tab underline and prestige shimmer.
7. Don't copy the Brave Frontier logo, characters or UI art into generated assets; do credit the game assets already in use.
8. Don't use `--ink-3` for small text on `--surface-3` (4.4:1); step up to `--ink-2`.

## Decisions for the author
1. Cinzel bundled for the app name and titles (about 25 KB, OFL), or Constantia-only with no new files. Default if no answer: Constantia-only.
2. Approve generating A1 to A4 with the OpenAI key (four images, small cost); A4 may be redrawn as SVG. Default: generate A1, A2, A3, draw A4 in SVG.
3. Raise base font size from 13.5px to 14px (affects the 600 px minimum width layout; UX brief should confirm).
4. Confirm gold-forward palette (indigo base) versus keeping the current near-neutral grey base with only gold and crimson added.
