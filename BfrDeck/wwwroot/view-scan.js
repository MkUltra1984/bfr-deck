'use strict';
// Unit scanner and first-start intro.
//
// Scanner: while you scroll through the in-game unit list, the deck takes screenshots of the emulator (the same
// read-only adb screencap the live reader uses), sweeps each column of the list for unit icons, fingerprints them
// (dHash) and matches them against the fingerprints of all unit thumbnails from the CDN. Nothing is sent to the game.
// The list's columns are fixed in game pixels (RULES.unitList); only the scroll position changes, so no calibration.

const SCAN = { hashes: null, running: false, found: new Map(), mainParty: new Set(), otherParty: new Set(), frames: 0, timer: 0,
  rows: [],        // the physical rows of the list in order, each { ids: [5], counts: [5] } (counts from the ×N badges)
  pendingOcr: 0 };

function renderScan(view, mode) {
  if (!DATA.units) { view.replaceChildren(h('p', { class: 'dim' }, 'Unit data not loaded.')); return; }
  SCAN.running = false; clearTimeout(SCAN.timer);
  const replay = mode === 'replay';   // #/scan/replay: match the last saved frame a few times (offline test), no emulator needed
  const auto = replay || mode === 'auto';   // #/scan/auto: start on the live window at once, stop after 10 s (unattended test)
  const out = h('div', { class: 'scan' }, backLink('#/units/box'), h('h1', {}, 'Scan your units'));
  const steps = h('ol', { class: 'steps' },
    h('li', {}, 'Have the game open in your emulator window (visible on screen, not minimised). Dock first for best results.'),
    h('li', {}, 'In the game open ', h('b', {}, 'Unit › Unit List'), '.'),
    h('li', {}, 'Press ', h('b', {}, 'Start'), ' and scroll the list slowly from top to bottom. Units appear here as they are recognised.'),
    h('li', {}, 'Press ', h('b', {}, 'Stop'), ' and choose whether the scan replaces your box or is added to it.'));
  const status = h('p', { class: 'dim' }, 'Ready.'); let warnEl = null;
  const preview = h('canvas', { class: 'frame', width: 270, height: 480 });
  const foundGrid = h('ul', { class: 'grid' });
  const counts = h('span', { class: 'faint' });
  const start = h('button', { class: 'primary', onclick: () => startScan() }, 'Start');
  const stop = h('button', { disabled: true, onclick: () => stopScan() }, 'Stop');
  const dbg = h('button', { class: 'icon', title: 'Toggle saving every captured frame to %LOCALAPPDATA%\\BfrDeck\\frame-last.png (for support)', onclick: () => { host.send('debugframes'); toast('Debug frames toggled'); } }, 'debug frames');
  // Reset: throw the current scan away; with Shift held, also empty the box and squads for a clean retest.
  const reset = h('button', { class: 'icon', title: 'Discard this scan and start over. Shift+click also empties your box, counts and squads.', onclick: e => {
    SCAN.running = false; clearTimeout(SCAN.timer); SCAN.found.clear(); SCAN.mainParty.clear(); SCAN.otherParty.clear(); SCAN.rows = []; SCAN.segments = []; SCAN.lastPos = null; SCAN.pendingOcr = 0; SCAN.gaps = 0; SCAN.frames = 0; SCAN.badgesRead = 0; SCAN.badgesTried = 0;
    if (e.shiftKey && confirm('Also empty your box, duplicate counts and squads?')) { COLL.owned = new Set(); COLL.squads = [{ name: 'Squad 1', units: [null, null, null, null, null], friend: null, spheres: {} }]; COLL.active = 0; COLL.save(); for (const k of ['unitCounts', 'boxTotal', 'boxScannedAt']) localStorage.removeItem(k); toast('Box and squads emptied'); }
    host.send('cleanframes'); renderScan(view);
  } }, 'reset');
  const controls = h('div', { class: 'row', style: 'margin:8px 0' }, start, stop, reset, h('span', { class: 'grow' }), counts, dbg);
  const finish = h('div', { class: 'row', style: 'margin:8px 0;display:none' },
    h('button', { class: 'primary', onclick: () => apply(true) }, 'Replace my box with the scan'),
    h('button', { onclick: () => apply(false) }, 'Add to my box'),
    h('button', { onclick: () => { SCAN.found.clear(); foundGrid.replaceChildren(); finish.style.display = 'none'; status.textContent = 'Discarded.'; } }, 'Discard'));
  out.append(steps, controls, status, h('div', { class: 'scanrow' }, preview, h('div', { class: 'grow' }, h('h3', {}, 'Recognised units ', counts), foundGrid)), finish);
  view.replaceChildren(out);
  drawFound();

  if (auto) setTimeout(() => { startScan(); setTimeout(stopScan, replay ? 12000 : 10000); if (!replay) setTimeout(() => { if (SCAN.found.size) apply(false); }, 17000); }, 800);
  let lastSave = 0;
  async function frame() {
    // save=1 (at most every 3 s): the host keeps the latest scan frame as %LOCALAPPDATA%\BfrDeck\scan-last.png, one
    // file, overwritten, for tuning. Nothing else is written to disk while scanning.
    const save = !replay && Date.now() - lastSave > 3000; if (save) lastSave = Date.now();
    const res = await fetch(`${API}/api/frame?${replay ? 'src=file' : (save ? 'save=1' : 'src=window')}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(await res.text());
    return createImageBitmap(await res.blob());
  }
  function showFrame(bmp, cells) {
    const g = preview.getContext('2d'); const s = Math.min(preview.width / bmp.width, preview.height / bmp.height);
    g.clearRect(0, 0, preview.width, preview.height); g.drawImage(bmp, 0, 0, bmp.width * s, bmp.height * s);
    if (cells) { g.lineWidth = 2; for (const c of cells) { g.strokeStyle = c.id ? 'rgba(111,201,138,.95)' : 'rgba(255,255,255,.35)'; g.strokeRect(c.x * s, c.y * s, c.w * s, c.h * s); } }
  }
  function drawFound() {
    const ids = [...SCAN.found.keys()].sort((a, b) => unitRarity(b) - unitRarity(a) || b - a);
    const ribbon = id => SCAN.mainParty.has(id) ? h('span', { class: 'tm' }, h('span', { class: 'tmlabel', style: '--c:#e0b24a' }, 'MAIN')) : null;   // blue (other party) ribbons are tracked but not shown
    foundGrid.replaceChildren(...ids.map(id => h('li', { class: COLL.owned.has(id) ? 'owned' : '' }, h('a', { class: `card el-${unitElement(id)}`, href: `#/units/${id}` },
      h('img', { src: unitIcon(id), alt: '', loading: 'lazy' }), stars(unitRarity(id)), h('span', { class: 'n' }, unitName(id))), ribbon(id),
      h('button', { class: 'mark own on', title: 'Not right? Click to drop it from the scan', onclick: () => { SCAN.found.delete(id); drawFound(); } }, '✕'))));
    drawCounts();
  }
  function drawCounts() {
    const t = totalUnits();
    const gaps = (SCAN.segments || []).length > 1 ? (SCAN.segments.length - 1) : 0;
    warnEl && (warnEl.style.display = gaps ? '' : 'none', warnEl.textContent = gaps ? `Scrolled too fast: ${gaps} gap${gaps === 1 ? '' : 's'} ${gapHints()}. Scroll back over it and the rows join up by themselves.` : '');
    counts.textContent = `${SCAN.found.size} unique units · ${SCAN.rows.length} rows${gaps ? ` · ${gaps} gap${gaps === 1 ? '' : 's'}` : ''}${SCAN.mainParty.size ? ` · ${SCAN.mainParty.size} in main party` : ''}`;
  }
  // Physical rows: a frame's rows are aligned with the rows already known (the list only scrolls, so consecutive
  // frames overlap), new rows are added once, and each cell's ×N badge is read once. Rows live in segments; a
  // segment boundary is a gap (the user outran the capture). Frames may extend a segment at either end, and two
  // segments merge as soon as they overlap, so scrolling back over a gap heals it without any button.
  // Rows match when their recognised cells agree (all but one). Evolution forms of one unit count as equal: a cell
  // read as 10131 in one frame and 10132 in the next is the same physical cell.
  const sameRow = (a, b) => { let m = 0, n = 0; for (let i = 0; i < a.length; i++) { if (a[i] && b[i]) { n++; if (a[i] === b[i] || unitLine(a[i]) === unitLine(b[i])) m++; } } return n >= 2 && m >= n - 1; };
  function addRows(bmp, cells) {
    const L = RULES.unitList; const rows = [];
    for (let i = 0; i < cells.length; i += L.cols) {
      const r = cells.slice(i, i + L.cols); if (r.length < L.cols) break;
      rows.push({ ids: r.map(c => c.id), cells: r, y: r[0].y });
    }
    if (!rows.length) return;
    if (!SCAN.segments) SCAN.segments = [];
    const segs = SCAN.segments;
    // Primary anchor: the scroll position. Between two frames the list moves by far less than half a row, so the
    // change of the row phase gives the exact shift in rows; each frame row then has an absolute index and runs
    // of identical rows (six Fire Spirits) stay six rows. Falls back to id matching when the shift is ambiguous.
    const fp = SCAN.framePhase; let anchored = false;
    if (fp && SCAN.scroll && segs.length) {
      // The phase only tells the shift modulo one row. The candidate shifts are the fractional move plus 0, ±1, ±2,
      // ±3 whole rows, tried nearest to the recent scroll speed first; the first candidate whose rows agree with the
      // ids already known wins. That covers up to about three rows per frame (45 rows a second).
      let d = (SCAN.scroll.phase - fp.phase) / fp.pitch; d -= Math.round(d);
      const whole0 = Math.round((SCAN.scroll.phase - fp.phase) / fp.pitch - d);
      const S = segs[SCAN.scroll.si]; const v = SCAN.scroll.v || 0;
      const shifts = [0, 1, -1, 2, -2, 3, -3].sort((a, b) => Math.abs((-whole0 + a) - v) - Math.abs((-whole0 + b) - v));
      for (const sft of shifts) {
        let first = SCAN.scroll.first - whole0 + sft;
        let agree = 0, dis = 0, known = 0;
        for (let i = 0; i < rows.length; i++) { const at = first + i; if (at >= 0 && at < S.length && !S[at].pending) { known++; if (sameRow(rows[i].ids, S[at].ids)) agree++; else if (rows[i].ids.filter(Boolean).length >= 2 && S[at].ids.filter(Boolean).length >= 2) dis++; } }
        if (dis > 0) continue;
        if (known > 0 && agree === 0) continue;            // overlaps known rows but matches none: wrong shift
        if (known === 0 && sft !== 0) continue;             // no evidence for a jump: only the plain phase move is trusted
        {
          // rows above the segment's first row (the user scrolled back up) extend it upward
          if (first < 0) { const pad = -first; for (let k = 0; k < pad; k++) S.unshift({ ids: [null, null, null, null, null], counts: [0, 0, 0, 0, 0], pending: true }); first = 0; }
          for (let i = 0; i < rows.length; i++) {
            const at = first + i;
            while (S.length <= at) S.push({ ids: [null, null, null, null, null], counts: [0, 0, 0, 0, 0], pending: true });
            if (S[at].pending) S[at] = { ids: rows[i].ids, counts: rows[i].ids.map(id => id ? 1 : 0) };
            else for (let c = 0; c < L.cols; c++) if (!S[at].ids[c] && rows[i].ids[c]) { S[at].ids[c] = rows[i].ids[c]; S[at].counts[c] = 1; }
            readBadges(bmp, rows[i].cells, S[at]);   // every frame votes; the count is the majority read
          }
          SCAN.scroll = { si: SCAN.scroll.si, first, phase: fp.phase, v: first - SCAN.scroll.first };
          anchored = true;
          break;
        }
      }
    }
    if (anchored) { const before = segs.length; mergeSegments(); if (segs.length !== before) { SCAN.scroll = null; console.warn(`scan: segments merged (${before} -> ${segs.length})`); } return; }
    if (segs.length && SCAN.frames % 5 === 0) console.warn(`scan: frame ${SCAN.frames} not anchored by scroll (phase ${fp && fp.phase}, prev ${SCAN.scroll && SCAN.scroll.phase}), falling back to id alignment`);
    const idRows = rows.filter(r => r.ids.filter(Boolean).length >= 2);   // id alignment needs anchored rows
    if (!idRows.length) return;
    rows.length = 0; rows.push(...idRows);
    // Best alignment over all segments: offset p may be negative (frame starts above the segment's first row).
    // Ties (a block of identical rows, e.g. thirty copies of one unit) go to the alignment nearest the previous
    // frame's position, which follows the direction the user is scrolling.
    let best = null; const prev = SCAN.lastPos || { si: 0, p: 0 };
    for (let si = 0; si < segs.length; si++) {
      const S = segs[si];
      for (let p = -rows.length + 1; p <= S.length - 1; p++) {
        let ok = true, matched = 0;
        for (let i = 0; i < rows.length; i++) { const at = p + i; if (at < 0 || at >= S.length) continue; if (sameRow(rows[i].ids, S[at].ids)) matched++; else { ok = false; break; } }
        if (!ok || matched === 0) continue;
        const dist = (si === prev.si ? Math.abs(p - prev.p) : 1000);
        if (!best || matched > best.matched || (matched === best.matched && dist < best.dist)) best = { si, p, matched, dist };
      }
    }
    if (!best) {   // nothing known matches: first frame, or a gap after scrolling too fast
      if (segs.length) { SCAN.gaps = (SCAN.gaps || 0) + 1; console.warn(`scan: new segment at frame ${SCAN.frames} (gap). frame rows: ${rows.map(r => r.ids.filter(Boolean).slice(0, 2).join('/')).join(' | ')}`); }
      segs.push([]); best = { si: segs.length - 1, p: 0, matched: 0 };
    }
    const S = segs[best.si];
    const newRow = i => { const row = { ids: rows[i].ids, counts: rows[i].ids.map(id => id ? 1 : 0) }; readBadges(bmp, rows[i].cells, row); return row; };
    // rows above the segment start are prepended, rows beyond its end appended, overlapping ones fill blanks
    const before = []; for (let i = 0; i < rows.length; i++) { const at = best.p + i; if (at < 0) before.push(newRow(i)); }
    if (before.length) { S.unshift(...before); best.p += before.length; }
    for (let i = 0; i < rows.length; i++) {
      const at = best.p + i; if (at < 0) continue;
      if (at < S.length) { for (let c = 0; c < L.cols; c++) if (!S[at].ids[c] && rows[i].ids[c]) S[at].ids[c] = rows[i].ids[c]; if (at >= before.length) readBadges(bmp, rows[i].cells, S[at]); }
      else S.push(newRow(i));
    }
    SCAN.lastPos = { si: best.si, p: best.p };
    if (SCAN.framePhase) SCAN.scroll = { si: best.si, first: best.p, phase: SCAN.framePhase.phase };   // re-anchor the scroll tracker here
    mergeSegments();
  }
  // Two segments merge when the tail of one overlaps the head of another by at least one matching row.
  function mergeSegments() {
    const segs = SCAN.segments; let merged = true;
    while (merged) {
      merged = false;
      outer: for (let a = 0; a < segs.length; a++) for (let b = 0; b < segs.length; b++) {
        if (a === b) continue; const A = segs[a], B = segs[b];
        for (let k = 1; k <= Math.min(A.length, B.length); k++) {   // k = overlap length: A's last k rows == B's first k rows
          let ok = true; for (let i = 0; i < k; i++) { const a = A[A.length - k + i], b = B[i]; if (a.pending || b.pending || !sameRow(a.ids, b.ids)) { ok = false; break; } }
          if (ok) { for (let i = 0; i < k; i++) for (let c = 0; c < B[i].ids.length; c++) if (!A[A.length - k + i].ids[c]) A[A.length - k + i].ids[c] = B[i].ids[c]; A.push(...B.slice(k)); segs.splice(b, 1); SCAN.gaps = Math.max(0, (SCAN.gaps || 0) - 1); merged = true; break outer; }
        }
      }
    }
    SCAN.rows = segs.flat();
  }
  // Where the remaining gaps are, in words, so the user knows where to scroll back to.
  function gapHints() {
    const segs = SCAN.segments || []; if (segs.length < 2) return '';
    return segs.slice(0, -1).map((S, i) => { const last = S[S.length - 1], next = segs[i + 1][0]; const nm = r => r.ids.filter(Boolean).slice(0, 2).map(id => shortUnitName(id)).join(', '); return `between "${nm(last)}" and "${nm(next)}"`; }).join('; ');
  }
  // The ×N badge: white digits on a dark disc in the bottom-right quarter of a cell. Cropped, enlarged and sent to
  // the host's OCR; "×4" → 4. Cells without a badge read as empty and keep count 1.
  // The ×N badge is read by matching the game's own number font (img/num32_font.png from the client) against the
  // badge area; Windows OCR could not read these stylised glyphs. Synchronous: the frame bitmap is closed right
  // after this frame, so the crops are taken now and matched now.
  // Every frame in which a row is visible votes for each cell: the number read (or "no badge"). A single frame can
  // misread a badge while the list is in motion (blur turns ×13 into ×130), the majority over the frames does not.
  function readBadges(bmp, cells, row) {
    if (!GLYPHS.ready) return;
    row.bv = row.bv || cells.map(() => new Map());
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c]; if (!cell.id) continue;
      const sx = cell.x + cell.w * 0.50, sy = cell.y + cell.h * 0.42, sw = cell.w * 0.44, sh = cell.h * 0.40;   // badge rows sit at 48–75 % of the cell; stops before the right frame edge
      const probe = document.createElement('canvas'); probe.width = 96; probe.height = 48; const pg = probe.getContext('2d');
      pg.imageSmoothingQuality = 'high'; pg.drawImage(bmp, sx, sy, sw, sh, 0, 0, 96, 48);
      let n = 1;
      if (looksLikeBadge(pg)) { SCAN.badgesTried = (SCAN.badgesTried || 0) + 1; SCAN.lastBadgeDebug = ''; const r = readBadgeNumber(bmp, sx, sy, sw, sh, cell.h); if (r != null && r >= 2 && r <= 999) n = r;
        if (SCAN.debugIds && SCAN.debugIds.has(cell.id) && (SCAN.debugDumps = (SCAN.debugDumps || 0) + 1) <= 40) console.warn(`badgecrop ${cell.id}=${r == null ? '-' : r}${SCAN.lastBadgeDebug} ${probe.toDataURL('image/png')}`); }
      const v = row.bv[c]; v.set(n, (v.get(n) || 0) + 1);
      // majority: the most voted number wins once it has at least two votes and more than every other reading together
      let bestN = 1, bestV = 0, sum = 0; for (const [k, cnt] of v) { sum += cnt; if (cnt > bestV) { bestV = cnt; bestN = k; } }
      const decided = bestN !== 1 && bestV >= 2 && bestV * 2 > sum ? bestN : (bestN === 1 ? 1 : row.counts[c] || 1);
      if (decided !== row.counts[c]) { if (decided > 1) SCAN.badgesRead = (SCAN.badgesRead || 0) + 1; else if (row.counts[c] > 1) SCAN.badgesRead = Math.max(0, (SCAN.badgesRead || 0) - 1); row.counts[c] = decided; if (SCAN.frames <= 400) console.warn(`badge: ${cell.id} -> ${decided} (votes ${[...v].map(([k, cnt]) => `${k}:${cnt}`).join(' ')})`); }
    }
  }
  // A badge has a bright (white) cluster on a dark background; plain artwork rarely does in that corner.
  function looksLikeBadge(g) {
    const d = g.getImageData(0, 0, 96, 48).data; let white = 0, dark = 0;
    for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; if (v > 225 && Math.abs(d[i] - d[i + 2]) < 30) white++; else if (v < 70) dark++; }
    const n = d.length / 4; return white > n * 0.04;   // light artwork (e.g. Fire Spirit) can fill the corner, so no dark-background requirement; the glyph matcher rejects non-badges
  }
  function totalUnits() {
    let total = 0; const perId = new Map();
    for (const r of SCAN.rows) for (let c = 0; c < r.ids.length; c++) if (r.ids[c]) { total += r.counts[c]; perId.set(r.ids[c], (perId.get(r.ids[c]) || 0) + r.counts[c]); }
    return { total, perId };
  }
  async function startScan() {
    start.disabled = true; stop.disabled = false; finish.style.display = 'none'; SCAN.running = true; SCAN.frames = 0; SCAN.debugDumps = 0;
    SCAN.debugIds = new Set((store.get('scanDebugIds', '') || '').split(',').map(Number).filter(Boolean));   // support: localStorage scanDebugIds="10312,30131" logs those cells' badge crops
    SCAN.found.clear(); SCAN.mainParty.clear(); SCAN.otherParty.clear(); SCAN.votes = new Map(); SCAN.rows = []; SCAN.segments = []; SCAN.lastPos = null; SCAN.scroll = null; SCAN.framePhase = null; SCAN.pendingOcr = 0; SCAN.gaps = 0; SCAN.badgesRead = 0; SCAN.badgesTried = 0; foundGrid.replaceChildren();
    try {
      status.textContent = 'Preparing unit fingerprints…';
      await ensureHashes(p => { status.textContent = `Preparing unit fingerprints… ${p}`; });
      status.textContent = 'Scanning. Scroll the unit list in the game; press Stop at the end.';
      let lastSig = '';
      const warn = h('div', { class: 'scanwarn', style: 'display:none' }); warnEl = warn;
      status.after(warn);
      const loop = async () => {
        if (!SCAN.running) return;
        const t0 = performance.now();
        try {
          const bmp = await frame();
          const sig = await frameSignature(bmp);
          if (sig !== lastSig || replay) {   // only work on frames that changed
            lastSig = sig; SCAN.frames++;
            const { cells, hits, phase, pitch } = matchFrame(bmp);
            showFrame(bmp, cells);
            SCAN.framePhase = { phase, pitch };
            // Ribbons over time: the main-party ribbon blinks, so its yellowness swings (max − min large) while
            // artwork and blue ribbons stay steady. Decided per unit once it has been seen in a few frames.
            SCAN.votes = SCAN.votes || new Map();
            // Ribbon votes only from frames in which the list stands still (same rows at the same phase as the frame
            // before): while the list moves, a cell's ribbon band samples the neighbouring artwork and the resulting
            // colour swing looks exactly like the blink.
            const still = `${Math.round(phase)}|${rowSignatures(hits).join('|')}`; const isStill = still === SCAN.lastStill; SCAN.lastStill = still;
            let added = 0; for (const { id, party } of hits) {
              if (!SCAN.found.has(id)) { SCAN.found.set(id, SCAN.frames); added++; }
              if (party && isStill) { const v = SCAN.votes.get(id) || { n: 0, ymin: 999, ymax: 0, bsum: 0 }; v.n++; v.ymin = Math.min(v.ymin, party.yel); v.ymax = Math.max(v.ymax, party.yel); v.bsum += party.blu; SCAN.votes.set(id, v);
                if (v.n >= 4) {
                  const swing = v.ymax - v.ymin, bmean = v.bsum / v.n;
                  if (swing >= 30 && v.ymax >= 45 && bmean < 25) { SCAN.mainParty.add(id); SCAN.otherParty.delete(id); }
                  else if (bmean >= 45 && !SCAN.mainParty.has(id)) SCAN.otherParty.add(id);
                } }
            }
            addRows(bmp, cells);
            const partyKey = `${SCAN.mainParty.size}/${SCAN.otherParty.size}`;
            if (added || partyKey !== SCAN.lastPartyKey) { SCAN.lastPartyKey = partyKey; drawFound(); } else drawCounts();
          } else showFrame(bmp, null);
          bmp.close();
        } catch (e) { status.textContent = `Capture failed: ${e.message}`; }
        // As fast as capture + matching allow (about 15 frames a second), so normal scrolling never skips a row.
        SCAN.timer = setTimeout(loop, Math.max(10, 66 - (performance.now() - t0)));
      };
      loop();
    } catch (e) { status.textContent = `Could not prepare: ${e.message}`; start.disabled = false; stop.disabled = true; SCAN.running = false; }
  }
  function stopScan() {
    SCAN.running = false; clearTimeout(SCAN.timer); start.disabled = false; stop.disabled = true;
    host.send('cleanframes');   // no frame stays on disk after a scan
    // Units seen in fewer than 4 changed frames (the emulator paused its rendering, or a very short scan) never got
    // a blink decision. The blue ribbon is steady, so it can still be decided from one frame; the yellow one cannot
    // (warm artwork looks the same as a faded yellow ribbon in a single frame), so main-party stays undecided.
    for (const [id, v] of (SCAN.votes || new Map())) {
      if (v.n >= 4 || SCAN.mainParty.has(id) || SCAN.otherParty.has(id)) continue;
      if (v.bsum / v.n >= 45) SCAN.otherParty.add(id);
    }
    // A main party has five units; if more were marked, keep the five whose blink was clearest.
    const mainAll = [...SCAN.mainParty].map(id => { const v = SCAN.votes.get(id); return `${id}:y${Math.round(v.ymin)}-${Math.round(v.ymax)}/b${Math.round(v.bsum / v.n)}/n${v.n}`; }).join(' ');
    if (SCAN.mainParty.size > 5) { const ranked = [...SCAN.mainParty].sort((a, b) => { const va = SCAN.votes.get(a), vb = SCAN.votes.get(b); return (vb.ymax - vb.ymin) - (va.ymax - va.ymin); }); SCAN.mainParty = new Set(ranked.slice(0, 5)); }
    console.warn(`scan main candidates: ${mainAll}`);
    drawFound();   // the result list and the status line reflect the final decisions
    const tt = totalUnits(); console.warn(`scan summary: ${SCAN.frames} frames, ${SCAN.rows.length} rows in ${(SCAN.segments || []).length} segment(s), ${SCAN.rows.reduce((s, r) => s + r.ids.filter(Boolean).length, 0)} cells, ${tt.total} units incl. dupes, ${SCAN.found.size} unique, badges read ${SCAN.badgesRead || 0}/${SCAN.badgesTried || 0}, main ${SCAN.mainParty.size}, other ${SCAN.otherParty.size}; ribbons ${[...(SCAN.votes || new Map()).entries()].slice(0, 30).map(([id, v]) => `${id}:y${Math.round(v.ymin)}-${Math.round(v.ymax)}/b${Math.round(v.bsum / v.n)}`).join(' ')}`);
    const t = totalUnits(); const gaps = (SCAN.segments || []).length > 1 ? SCAN.segments.length - 1 : 0;
    status.textContent = SCAN.found.size ? `Scan finished: ${SCAN.found.size} unique units in ${SCAN.rows.length} rows${gaps ? `, ${gaps} gap${gaps === 1 ? '' : 's'} left` : ''}. Choose below what to do with them.` : 'Nothing recognised. Is the Unit List open in the game?';
    if (SCAN.found.size) finish.style.display = '';
  }
  function apply(replace) {
    if (replace) COLL.owned = new Set(SCAN.found.keys()); else for (const id of SCAN.found.keys()) COLL.owned.add(id);
    // Main party (yellow PARTY ribbons) becomes Squad 1. The list does not show slot order, so the leader is unknown:
    // existing slot order is kept where the units match, new ones fill the free slots.
    // Only a complete main party (5 yellow ribbons) replaces Squad 1; fewer found units fill its empty slots only.
    if (SCAN.mainParty.size) {
      const s = COLL.squads[0]; const found = [...SCAN.mainParty];
      if (found.length >= 5) { const keep = s.units.map(u => SCAN.mainParty.has(u) ? u : null); const rest = found.filter(u => !keep.includes(u)); for (let i = 0; i < 5 && rest.length; i++) if (!keep[i]) keep[i] = rest.shift(); s.units = keep; }
      else { const rest = found.filter(u => !s.units.includes(u)); for (let i = 0; i < 5 && rest.length; i++) if (!s.units[i]) s.units[i] = rest.shift(); }
    }
    // Per-unit counts (with duplicates) for the box page and the cleanup suggestions.
    const t = totalUnits(); const prev = replace ? {} : store.get('unitCounts', {});
    for (const [id, n] of t.perId) prev[id] = n;
    store.set('unitCounts', prev); store.set('boxTotal', t.total);
    COLL.save(); store.set('boxScannedAt', Math.floor(Date.now() / 1000));
    toast(`${COLL.owned.size} units in your box${SCAN.mainParty.size ? `, main party set (${SCAN.mainParty.size})` : ''}`); location.hash = '#/units/box';
  }

}

// ---- fingerprints
// Fingerprint of an icon's face (x 12–88 %, y 10–66 %: inside the rarity frame, above the "Lv.1" band the game
// paints at the bottom). Two parts: a 256-bit dHash (16 rows × 16 gradients) for fast candidate search, and a
// 12×12 normalised greyscale patch for a correlation check between the best candidates. The in-game list draws
// the CDN thumbnail 1:1 inside the frame (verified on a real frame), so the same crop applies to both.
// y starts at 22 % so the "PARTY" ribbon the game paints along the top of squad members stays out of the fingerprint.
const FACE = { x: 0.12, y: 0.22, w: 0.76, h: 0.46 };
const DH = 17, DV = 16, GP = 12;
const dCanvas = (() => { const c = document.createElement('canvas'); c.width = DH; c.height = DV; return c; })();
const gCanvas = (() => { const c = document.createElement('canvas'); c.width = GP; c.height = GP; return c; })();
function fingerprint(img, sx, sy, sw, sh) {
  const fx = sx + sw * FACE.x, fy = sy + sh * FACE.y, fw = sw * FACE.w, fh = sh * FACE.h;
  const g = dCanvas.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(img, fx, fy, fw, fh, 0, 0, DH, DV);
  const d = g.getImageData(0, 0, DH, DV).data;
  const bits = new Uint32Array(8); let sum = 0, sq = 0;
  for (let y = 0; y < DV; y++) {
    let row = 0;
    for (let x = 0; x < DH - 1; x++) {
      const a = d[(y * DH + x) * 4] * .299 + d[(y * DH + x) * 4 + 1] * .587 + d[(y * DH + x) * 4 + 2] * .114;
      const b = d[(y * DH + x + 1) * 4] * .299 + d[(y * DH + x + 1) * 4 + 1] * .587 + d[(y * DH + x + 1) * 4 + 2] * .114;
      row = (row << 1) | (a > b ? 1 : 0); sum += a; sq += a * a;
    }
    bits[y >> 1] |= (y & 1) ? (row >>> 0) : ((row << 16) >>> 0);
  }
  const n = DV * (DH - 1); const mean = sum / n, variance = sq / n - mean * mean;
  const g2 = gCanvas.getContext('2d', { willReadFrequently: true });
  g2.imageSmoothingEnabled = true; g2.imageSmoothingQuality = 'high';
  g2.drawImage(img, fx, fy, fw, fh, 0, 0, GP, GP);
  const p = g2.getImageData(0, 0, GP, GP).data; const gray = new Float32Array(GP * GP); let m = 0, R = 0, G = 0, B = 0, ns = 0;
  for (let i = 0; i < gray.length; i++) {
    const r = p[i * 4], gg = p[i * 4 + 1], b = p[i * 4 + 2];
    gray[i] = r * .299 + gg * .587 + b * .114; m += gray[i];
    // chroma from the saturated pixels only: element recolours (Fire vs Thunder Spirit) differ in their accents,
    // while most of the portrait is white and grey and would wash the difference out
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); if (mx > 40 && (mx - mn) / mx > 0.3) { R += r; G += gg; B += b; ns++; }
  }
  m /= gray.length; let v = 0; for (let i = 0; i < gray.length; i++) { gray[i] -= m; v += gray[i] * gray[i]; }
  const sd = Math.sqrt(v / gray.length) || 1; for (let i = 0; i < gray.length; i++) gray[i] /= sd;
  const s = (R + G + B) || 1; const chroma = ns >= 4 ? [R / s, G / s, B / s] : [1 / 3, 1 / 3, 1 / 3];
  return { bits, gray, chroma, variance };
}
const chromaDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const popcount = n => { n = n - ((n >>> 1) & 0x55555555); n = (n & 0x33333333) + ((n >>> 2) & 0x33333333); return (((n + (n >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; };
function hamming(a, b) { let d = 0; for (let i = 0; i < 8; i++) d += popcount((a[i] ^ b[i]) >>> 0); return d; }
function ncc(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s / a.length; }

// Fingerprints of every unit thumbnail, built once (through the host's disk cache) and kept in localStorage.
async function ensureHashes(progress) {
  if (SCAN.hashes) return SCAN.hashes;
  const saved = store.get('unitHashes', null);
  const ids = DATA.unitNames.map(e => e.id).filter(id => id >= 10000 && id < 990000);
  const h = saved && saved.v === 7 ? saved.h : {};   // v7: chroma from saturated pixels only
  const todo = ids.filter(id => !h[id]);
  let done = 0; const start = Date.now();
  const pack = f => [Array.from(f.bits), btoa(String.fromCharCode(...Array.from(f.gray, v => Math.max(0, Math.min(255, Math.round(v * 40 + 128)))))), f.chroma.map(c => Math.round(c * 1000) / 1000)];
  const worker = async () => {
    while (todo.length) {
      const id = todo.shift();
      try {
        const res = await fetch(`${API}/proxy?u=${encodeURIComponent(unitIcon(id))}`);
        if (res.ok) { const bmp = await createImageBitmap(await res.blob()); h[id] = pack(fingerprint(bmp, 0, 0, bmp.width, bmp.height)); bmp.close(); } else h[id] = null;
      } catch { h[id] = null; }
      if (++done % 25 === 0) { progress && progress(`${done} / ${done + todo.length}`); store.set('unitHashes', { v: 7, h }); }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  store.set('unitHashes', { v: 7, h });
  if (done) console.log(`unit fingerprints: ${done} built in ${((Date.now() - start) / 1000).toFixed(0)} s`);
  const unpack = s => { const a = atob(s); const g = new Float32Array(a.length); for (let i = 0; i < a.length; i++) g[i] = (a.charCodeAt(i) - 128) / 40; return g; };
  SCAN.hashes = Object.entries(h).filter(([, v]) => v).map(([id, v]) => ({ id: Number(id), bits: Uint32Array.from(v[0]), gray: unpack(v[1]), chroma: v[2] || [1 / 3, 1 / 3, 1 / 3] }));
  return SCAN.hashes;
}
// Best unit for one window: dHash picks the 10 nearest, correlation decides. Returns null when nothing is convincing.
// A correctly placed cell correlates at 0.9+ with its thumbnail; wrong units stay below ~0.7. Evolution forms of one
// unit (ids that differ only in the last digit) share the portrait, so the runner-up margin is only enforced against
// candidates from another unit line; within a line the best-scoring form wins.
const MATCH = { minVar: 60, maxDist: 110, minNcc: 0.70, margin: 0.04, topK: 20 };
const unitLine = id => Math.floor(id / 10);
function bestUnit(f) {
  if (f.variance < MATCH.minVar) return null;
  const top = [];
  for (const u of SCAN.hashes) {
    const d = hamming(f.bits, u.bits);
    if (top.length < MATCH.topK || d < top[top.length - 1].d) { top.push({ u, d }); top.sort((a, b) => a.d - b.d); if (top.length > MATCH.topK) top.pop(); }
  }
  if (!top.length || top[0].d > MATCH.maxDist) { SCAN.lastReject = `d${top.length ? top[0].d : '-'}`; return null; }
  // Score: greyscale correlation minus a chroma penalty (an element recolour of the same portrait loses ~0.1–0.2).
  const scored = top.map(t => ({ id: t.u.id, c: ncc(f.gray, t.u.gray) - 2.5 * chromaDist(f.chroma, t.u.chroma), d: t.d })).sort((a, b) => b.c - a.c);
  const best = scored[0]; const rival = scored.find(s => unitLine(s.id) !== unitLine(best.id));
  const second = rival ? rival.c : -1;
  SCAN.lastReject = `${best.id}:${best.c.toFixed(2)}/${second.toFixed(2)} d${top[0].d}`;
  if (best.c < MATCH.minNcc || best.c - second < MATCH.margin) return null;
  return { id: best.id, score: best.c, d: best.d };
}
// Cheap change detector: a 16x16 grey thumbnail of the frame.
async function frameSignature(bmp) {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16; const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, 16, 16);
  const d = g.getImageData(0, 0, 16, 16).data; let s = '';
  for (let i = 0; i < d.length; i += 4) s += String.fromCharCode(32 + ((d[i] + d[i + 1] + d[i + 2]) / 3 >> 3));
  return s;
}
// The "PARTY" ribbon along the top of an icon: yellow text = main party, blue text = another party, none = no party.
// Samples the top 16 % of the cell and counts yellow vs blue pixels.
// The text has a white outline, so a ribbon is present when the band holds both outline pixels and one text colour;
// the rarity frame (gold, blue, …) sits at the cell edges and is kept out by sampling the middle 60 % only.
const ribbonCanvas = (() => { const c = document.createElement('canvas'); c.width = 24; c.height = 6; return c; })();
function partyRibbon(img, x, y, w, h) {
  const g = ribbonCanvas.getContext('2d', { willReadFrequently: true });
  // Band y 5–15 %: below the rarity frame's top edge (gold frames were read as yellow text before), inside the ribbon.
  g.drawImage(img, x + w * 0.2, y + h * 0.05, w * 0.6, h * 0.10, 0, 0, 24, 6);
  // Two colour measures of the band: yellowness = mean(R − B), blueness = mean(B − R). The main-party ribbon fades
  // in and out, so its yellowness swings between frames; a blue ribbon is steady; artwork is steady too.
  const d = g.getImageData(0, 0, 24, 6).data; let yel = 0, blu = 0; const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { const r = d[i], b = d[i + 2]; yel += Math.max(0, r - b); blu += Math.max(0, b - r); }
  yel /= n; blu /= n;
  SCAN.lastRibbon = `y${Math.round(yel)} b${Math.round(blu)}`;
  return { yel, blu };
}

// ---- badge digits: templates from the game's number atlas (0-9 then × / ! ·), matched by normalised correlation
const GLYPHS = { ready: false, src: null, runs: [[1, 24], [29, 48], [53, 76], [80, 101], [106, 127], [132, 153], [158, 179], [183, 206], [210, 231], [235, 258], [262, 283]], chars: '0123456789×', cache: new Map() };
(function loadGlyphs() {
  const img = new Image(); img.onload = () => { GLYPHS.src = img; GLYPHS.ready = true; }; img.src = 'img/num32_font.png';
})();
// Templates at a given glyph height (px): gray arrays with mean removed, plus a mask of the glyph's own pixels.
function glyphTemplates(hpx) {
  const key = Math.round(hpx * 10); if (GLYPHS.cache.has(key)) return GLYPHS.cache.get(key);
  const out = [];
  GLYPHS.runs.forEach(([x0, x1], i) => {
    const sw = x1 - x0 + 1, sh = 32; const w = Math.max(3, Math.round(sw * hpx / sh)), hh = Math.max(4, Math.round(hpx));
    const c = document.createElement('canvas'); c.width = w; c.height = hh; const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high'; g.drawImage(GLYPHS.src, x0, 0, sw, sh, 0, 0, w, hh);
    const d = g.getImageData(0, 0, w, hh).data; const gray = new Float32Array(w * hh); const mask = new Uint8Array(w * hh); let s = 0, n = 0;
    for (let k = 0; k < w * hh; k++) { const a = d[k * 4 + 3]; if (a > 60) { mask[k] = 1; gray[k] = (d[k * 4] + d[k * 4 + 1] + d[k * 4 + 2]) / 3; s += gray[k]; n++; } }
    const m = n ? s / n : 0; let v = 0; for (let k = 0; k < w * hh; k++) if (mask[k]) { gray[k] -= m; v += gray[k] * gray[k]; }
    const sd = Math.sqrt(v / Math.max(1, n)) || 1; for (let k = 0; k < w * hh; k++) if (mask[k]) gray[k] /= sd;
    out.push({ ch: GLYPHS.chars[i], w, h: hh, gray, mask, n });
  });
  GLYPHS.cache.set(key, out); return out;
}
// Reads "×N" in the badge area of a cell. The glyphs are white with a dark outline, so the white pixels are
// segmented into blobs first; blobs of glyph height are classified by comparing their shape with each digit of the
// game's font scaled to the blob's own box (overlap of white pixels). The × must be the leftmost glyph.
const GLYPH_SHAPES = new Map();   // ch -> { w, h, white: Uint8Array } at atlas size
function glyphShape(i) {
  const ch = GLYPHS.chars[i]; if (GLYPH_SHAPES.has(ch)) return GLYPH_SHAPES.get(ch);
  const [x0, x1] = GLYPHS.runs[i]; const w = x1 - x0 + 1, h = 32;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(GLYPHS.src, x0, 0, w, h, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data; const white = new Uint8Array(w * h);
  let top = h, bot = -1, left = w, right = -1;
  for (let k = 0; k < w * h; k++) if (d[k * 4 + 3] > 60 && Math.min(d[k * 4], d[k * 4 + 1], d[k * 4 + 2]) > 150) { white[k] = 1; const y = (k / w) | 0, x = k % w; if (y < top) top = y; if (y > bot) bot = y; if (x < left) left = x; if (x > right) right = x; }
  // trim to the white part's box so blobs (white only) compare like with like
  const bw = right - left + 1, bh = bot - top + 1; const tw = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) tw[y * bw + x] = white[(top + y) * w + left + x];
  const shape = { ch, w: bw, h: bh, white: tw }; GLYPH_SHAPES.set(ch, shape); return shape;
}
function readBadgeNumber(bmp, sx, sy, sw, sh, cellH) {
  const W = Math.round(sw), H = Math.round(sh);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, sx, sy, sw, sh, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data; const white = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) white[k] = Math.min(d[k * 4], d[k * 4 + 1], d[k * 4 + 2]) > 165 ? 1 : 0;
  // connected components (4-neighbour) of white pixels
  const label = new Int32Array(W * H).fill(-1); const blobs = []; const stack = [];
  for (let k = 0; k < W * H; k++) {
    if (!white[k] || label[k] >= 0) continue;
    const id = blobs.length; const b = { x0: W, y0: H, x1: -1, y1: -1, n: 0, px: [] }; blobs.push(b); stack.push(k); label[k] = id;
    while (stack.length) { const q = stack.pop(); const x = q % W, y = (q / W) | 0; b.n++; b.px.push(q); if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const nk = ny * W + nx; if (white[nk] && label[nk] < 0) { label[nk] = id; stack.push(nk); } } }
  }
  const expH = cellH * 0.16;   // glyph height in the badge, about 16 % of the cell
  for (const b of blobs) b.set = new Set(b.px);
  // glyphs that touch (× and the digit, or two digits) form one wide blob: split it at the thinnest column
  const split = [];
  for (const b of blobs) {
    const bh = b.y1 - b.y0 + 1, bw = b.x1 - b.x0 + 1;
    if (bh < expH * 0.55 || bh > expH * 1.5 || b.n < 6) continue;
    if (bw <= expH * 1.15) { split.push(b); continue; }
    const parts = Math.min(3, Math.round(bw / (expH * 0.8))); if (parts < 2) { split.push(b); continue; }
    const cols = new Int32Array(bw); for (const q of b.px) cols[q % W - b.x0]++;
    let cuts = [0]; for (let p = 1; p < parts; p++) { const centre = Math.round(bw * p / parts); let bestC = centre, bestV = 1e9; for (let x = centre - 2; x <= centre + 2; x++) if (x > 0 && x < bw - 1 && cols[x] < bestV) { bestV = cols[x]; bestC = x; } cuts.push(bestC); } cuts.push(bw);
    for (let p = 0; p < parts; p++) { const sub = { x0: b.x0 + cuts[p], x1: b.x0 + cuts[p + 1] - 1, y0: H, y1: -1, n: 0, set: new Set() };
      for (const q of b.px) { const x = q % W; if (x >= sub.x0 && x <= sub.x1) { sub.set.add(q); sub.n++; const y = (q / W) | 0; if (y < sub.y0) sub.y0 = y; if (y > sub.y1) sub.y1 = y; } }
      if (sub.n >= 4) split.push(sub); }
  }
  // glyph blobs are at least a third of the glyph height wide (the game's "1" is 0.6 of its height): thin slivers
  // from a frame edge are not glyphs
  const cand = split.filter(b => b.x1 - b.x0 + 1 >= expH * 0.33).sort((a, b) => a.x0 - b.x0);
  // classify each blob: overlap score against every glyph shape scaled to the blob's box
  const score = (b, shape) => { const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1; let inter = 0, uni = 0;
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const on = b.set.has((b.y0 + y) * W + b.x0 + x) ? 1 : 0; const tx = Math.min(shape.w - 1, (x * shape.w / bw) | 0), ty = Math.min(shape.h - 1, (y * shape.h / bh) | 0); const t = shape.white[ty * shape.w + tx]; if (on && t) inter++; if (on || t) uni++; }
    return uni ? inter / uni : 0; };
  const read = cand.map(b => { let best = null; for (let i = 0; i < 11; i++) { const s = score(b, glyphShape(i)); if (!best || s > best.s) best = { ch: GLYPHS.chars[i], s }; } return { ...best, b }; });
  const str = read.map(r => r.ch).join('');
  SCAN.lastBadgeDebug = (SCAN.lastBadgeDebug || '') + ` "${str}" ${read.map(r => r.s.toFixed(2)).join('/')}`;
  if (!read.length || read[0].ch !== '×' || read[0].s < 0.5) return null;
  // Digits follow the × on one baseline, at full glyph height, with no wide gaps. Anything after the first glyph that
  // breaks the line (a blurred frame edge, a stray dot) ends the number instead of extending it.
  let num = ''; let prev = read[0].b, base = null;
  for (const r of read.slice(1)) {
    const b = r.b, bh = b.y1 - b.y0 + 1;
    if (!/\d/.test(r.ch) || r.s < 0.45) break;
    if (bh < expH * 0.8 || bh > expH * 1.35) break;
    if (base != null && Math.abs(b.y1 - base) > expH * 0.2) break;
    if (b.x0 - prev.x1 > expH * 0.6) break;
    if (base == null) base = b.y1;
    num += r.ch; prev = b;
    if (num.length === 3) break;
  }
  SCAN.lastBadgeDebug += ` → "${num}"`;
  if (!num) return null;
  return Number(num);
}

// Rows of a frame as strings "id,id,id" (ids sorted), grouping hits whose y is within half an icon of each other.
function rowSignatures(hits) {
  const rows = []; const sorted = [...hits].sort((a, b) => a.y - b.y);
  for (const hit of sorted) { const r = rows.find(x => Math.abs(x.y - hit.y) < hit.h * 0.5); if (r) r.ids.push(hit.id); else rows.push({ y: hit.y, ids: [hit.id] }); }
  return rows.filter(r => r.ids.length >= 2).map(r => r.ids.sort((a, b) => a - b).join(','));
}

// One frame: (1) find the row phase: sweep the first two columns in coarse steps, and the positions that match a
// unit well vote for a vertical offset modulo the row pitch; (2) snap a fixed grid to that phase; (3) evaluate every
// grid cell once (with a ±3 px refinement). Returns the grid cells, each with its unit when recognised, so the
// preview can draw stable rows instead of free-floating boxes.
function matchFrame(bmp) {
  const L = RULES.unitList; const k = bmp.width / 1080;
  const w = L.w * k, hh = L.h * k, pitch = L.pitchY * k;
  const yTop = L.yFrom * k, yEnd = Math.min(L.yTo * k, bmp.height) - hh;
  // (1) phase votes
  const votes = new Float32Array(Math.ceil(pitch)); let windows = 0;
  for (let col = 0; col < Math.min(2, L.cols); col++) {
    const x = (L.x0 + col * L.pitchX) * k;
    for (let y = yTop; y <= yEnd; y += Math.max(3, 6 * k)) {
      windows++;
      const m = bestUnit(fingerprint(bmp, x, y, w, hh));
      if (m) { const ph = Math.round((y - yTop) % pitch) % votes.length; votes[ph] += m.score; votes[(ph + 1) % votes.length] += m.score / 2; votes[(ph + votes.length - 1) % votes.length] += m.score / 2; }
    }
  }
  let phase = -1, bestV = 0; for (let i = 0; i < votes.length; i++) if (votes[i] > bestV) { bestV = votes[i]; phase = i; }
  const cells = [];
  if (phase < 0) { console.warn(`scan frame: ${windows} windows, no row phase found`); return { cells, hits: [] }; }
  // (2)+(3) grid at that phase, refined per cell; at most L.rows rows from the top
  let rowsDone = 0;
  for (let y = yTop + phase - pitch; y <= yEnd && rowsDone < (L.rows || 99); y += pitch) {
    if (y < yTop - 2) continue;
    rowsDone++;
    for (let col = 0; col < L.cols; col++) {
      const x = (L.x0 + col * L.pitchX) * k; if (x + w > bmp.width) break;
      let best = null;
      for (const dy of [0, -2 * k, 2 * k, -4 * k, 4 * k]) for (const dx of [0, -2 * k, 2 * k]) {
        const m = bestUnit(fingerprint(bmp, x + dx, y + dy, w, hh));
        if (m && (!best || m.score > best.score)) best = m;
      }
      const party = best ? partyRibbon(bmp, x, y, w, hh) : null;
      cells.push({ x, y, w, h: hh, col, id: best ? best.id : null, score: best ? best.score : 0, why: best ? '' : SCAN.lastReject, party, ribbon: best ? SCAN.lastRibbon : '' });
    }
  }
  const hits = cells.filter(c => c.id);
  // One diagnostic line per 25 frames (the host writes console warnings to log.txt; one per frame would bloat it).
  if (SCAN.frames % 25 === 1) console.warn(`scan frame ${SCAN.frames}: phase ${phase}, ${cells.length} cells, ${hits.length} recognised, scores ${hits.map(h => h.score.toFixed(2)).slice(0, 8).join(',')} (${hits.map(x => x.id).join(',')}); rejected: ${cells.filter(c => !c.id).map(c => c.why).slice(0, 16).join(' | ')}`);
  return { cells, hits, phase, pitch, firstY: yTop + phase - pitch < yTop - 2 ? yTop + phase : yTop + phase - pitch };
}

// ---- first-start intro: four short screens, then straight into the scanner or the unit list.
function showIntro(force = false, startAt = 0) {
  if (!force && store.get('seenIntro', 0)) return;
  // A guided tour: the welcome card sits in the middle; the tour cards sit at the bottom while the tab they describe
  // is shown behind them; the last card offers the unit scan.
  // `focus` is a selector inside #view: that panel is scrolled into view and outlined while its card is shown.
  const pages = [
    { title: 'Welcome to BFR Deck', text: 'A read-only companion for Brave Frontier Revived. It reads the public data of bfrevive.net and, if you allow it, a picture of your emulator window. It never touches the game: no input, no memory, no network tricks, nothing the server rules forbid. Let me show you around.', centre: true },
    { title: 'Home: your header', route: '#/home', focus: '#home-top', text: 'Your name and level, how long the emulator has been running (with a warning past the three hours the server FAQ cautions about), and the dock and live buttons. Live reads your name, gems, Zel and Karma from the game header; it is off until you click it.' },
    { title: 'Home: your account, live', route: '#/home', focus: '.mspanel', text: 'Sign in with your game login and the deck reads your account from My Summoner (bfrevive.net): level, energy, arena orbs, gifts, your real squads and what to do next. Your login goes only to bfrevive.net, and the deck only reads; it never changes your account. Without signing in, everything else works as before.' },
    { title: 'My Account', route: '#/account', text: 'Once signed in: a to-do list, your squads with what each one covers and which of your spheres to put where, a team builder that picks from your box, what your units need to evolve with a shopping list, challenges, story progress, your collection, your items and your history.' },
    { title: 'Home: currencies and timers', route: '#/home', focus: '.tiles > .tile:nth-child(1)', text: 'Gems, Zel and Karma as read from the game, each with what it is for. Below them the three reset timers: dailies, the Vortex day switch and the weekly selector. The stripe turns yellow and red as a reset gets close.' },
    { title: 'Home: your squad', route: '#/home', focus: '.stagetile', text: 'Squad 1 on stage with the real battle sprites on element-lit platforms, its cost, elements and leader skill. Click a slot to pick a unit; "edit" opens the Team Builder. The unit scan fills this with your main party.' },
    { title: 'Home: Should I pull?', route: '#/home', focus: '.pulltile', text: 'Cycle through this week’s banners and the permanent gates. The verdict says how much of a pull is new to you and what a new unit costs in gems. "See odds and bars" opens the chance per rarity and how much of the gate you already own. "I pulled…" logs a summon session in one go.' },
    { title: 'Home: Meta Units', route: '#/home', focus: '.metabox', text: 'The five strongest units of the selected gate by the deck’s score. Click the dots or drag to browse; the title opens the Tier List.' },
    { title: 'Home: Featured this week', route: '#/home', focus: '.marquee', text: 'The collab and rate-up units of the week walk past; hold the mouse button to drag the strip. Below: this week’s banners with their price and time left, and what comes next week.' },
    { title: 'Home: Vortex Gate', route: '#/home', focus: '.vortextile', text: 'The week as day chips (click one to preview another day), a card per open dungeon with what it gives in plain words and its captures or drops as pictures, the running event and when it switches. A card opens the dungeon page.' },
    { title: 'Units', route: '#/units', focus: '.filters', text: 'Search every unit (typos are fine) with element, rarity and owned filters, as cards or as a table. Open a unit for its sprite, stats, skills, roles and where to get it. Mark units as owned (✔) or bookmarked (★).' },
    { title: 'Box', route: '#/units/box', focus: '.box', text: 'Your collection: progress per rarity and element, your owned units with their team labels, the rescan button and this tour. After selling or fusing units, rescan from here.' },
    { title: 'Tier List', route: '#/tier', text: 'Every unit ranked S to C by the deck’s score: max stats against the best in the game plus the roles its skills cover. Filter by element, rarity, role or just the units you own; tiers fold. A guide for building, not gospel.' },
    { title: 'Summon', route: '#/summon', text: 'This week’s banners, next week’s, the always-open gates and the rotation with dates. A gate page lists its pool by rarity with every unit’s chance and tells you whether a pull is worth it against your box.' },
    { title: 'Quests', route: '#/quests', text: 'The whole Vortex Gate as a catalog, grouped like the in-game gate, with sub-tabs for Grand Quest, Story, Frontier Hunter, Frontier Gate and Trials. Each dungeon shows what it gives, its captures with their chance, drops, clear rewards and enemies.' },
    { title: 'Team Builder: slots', route: '#/team', focus: '.slots', text: 'Six slot cards: five units and the friend lead. ★ makes a unit the leader, ⇄ swaps it, ✕ removes it, drag a card onto another to reorder. The two circles are the sphere slots. Only the leader’s and the friend’s leader skills count.' },
    { title: 'Team Builder: totals and buffs', route: '#/team', focus: '.matrix', text: 'Cost, HP, ATK, DEF, REC and hit count for the squad (with or without imps), both leader skills side by side, and "Who brings what": which slot covers healing, mitigation, BB fill, buffs and so on. Effects not yet covered are marked.' },
    { title: 'Team Builder: fill the gaps and share', route: '#/team', focus: '.gaprow', text: 'For each effect not yet covered, the best units from your box; click one to put it in. At the bottom a team code you can copy and paste to share the squad with another BFR Deck user, plus export, import and the calculators.' },
    { title: 'Guide and glossary', route: '#/guide', text: 'Six first steps with a checkbox each, the daily loop that resets every day, and one card per topic (currencies, frogs, evolution, imps, spheres, farming days, summons). Everywhere in the deck, game terms carry a dotted underline: hover one for a plain-words explanation.' },
    { title: 'Dock and Pin', route: '#/home', text: 'In the title bar: Dock snaps the deck beside your emulator and keeps the two together when either window moves. Pin keeps the deck on top. The tabs next to the title open bfrevive.net and the wiki inside the deck.' },
    { title: 'Your units', route: '#/home', text: 'The deck gets useful once it knows your box: pull odds show what is new to you, the Tier List can show only what you own, and the Team Builder suggests from it. Scan your unit list now (open Unit › Unit List in the game and scroll through it), or mark units by hand later.', centre: true, end: true },
  ];
  let i = Math.min(startAt, pages.length - 1);
  const title = h('h2', { style: 'margin:0 0 6px' }), body = h('p', {}); const dots = h('div', { class: 'dots' });
  const next = h('button', { class: 'primary' }); const back = h('button', {}, 'Back');
  const scanBtn = h('button', { class: 'primary', onclick: () => { close(); location.hash = '#/scan'; } }, 'Scan my units');
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
