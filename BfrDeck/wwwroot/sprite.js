'use strict';
// Battle sprite animator. Data: /units/u/<id>.json "anim" = { cgg: [frame...], idle|move|atk: [[frame, dx, dy, ticks]...] }.
// A frame is a flat list of parts, 10 numbers each: x, y, flip, blend, opacity, rotate, src_x, src_y, w, h.
// Parts draw last to first from the CDN atlas unit_anime_<id>.png at 60 ticks a second.

const ATLAS = id => `${CDN_UNIT}unit_anime_${id}.png`;
const atlasCache = new Map();
// Atlases come through the host's disk cache (CORS headers), so the canvas stays readable for the mass measurement.
// At most ATLAS_MAX decoded atlases stay in memory (a few MB each); the least recently used is closed and dropped.
const ATLAS_MAX = 48;
function loadAtlas(id) {
  if (atlasCache.has(id)) { const v = atlasCache.get(id); atlasCache.delete(id); atlasCache.set(id, v); return v; }   // refresh LRU order
  const p = (async () => {
    try {
      const res = await fetch(`${API}/proxy?u=${encodeURIComponent(ATLAS(id))}`);
      if (!res.ok) throw new Error('atlas ' + id);
      return await createImageBitmap(await res.blob());
    } catch (e) { atlasCache.delete(id); throw e; }
  })();
  atlasCache.set(id, p);
  while (atlasCache.size > ATLAS_MAX) { const [oldId, oldP] = atlasCache.entries().next().value; atlasCache.delete(oldId); oldP.then(b => { try { b.close(); } catch { } }, () => { }); }
  return p;
}

function idleBounds(anim) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [f, dx, dy] of anim.idle || []) {
    const p = anim.cgg[f] || [];
    for (let i = 0; i < p.length; i += 10) {
      if (p[i + 3] === 1) continue;                       // additive glow parts don't count
      const x = p[i] + dx, y = p[i + 1] + dy, w = p[i + 8], hh = p[i + 9];
      const r = p[i + 5] % 180 ? Math.max(w, hh) : 0;
      x0 = Math.min(x0, x - r / 2); y0 = Math.min(y0, y - r / 2); x1 = Math.max(x1, x + w + r / 2); y1 = Math.max(y1, y + hh + r / 2);
    }
  }
  return isFinite(x0) ? { x0, y0, x1, y1 } : { x0: -60, y0: -120, x1: 60, y1: 10 };
}

class Sprite {
  constructor(canvas, opts = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.opts = opts;
    this.kind = opts.kind || 'idle'; this.raf = 0; this.visible = true; this.playing = true;
    this.io = new IntersectionObserver(es => { if (!canvas.isConnected) { this.destroy(); return; } this.visible = es[0].isIntersecting; if (this.visible) this.kick(); });
    this.io.observe(canvas);
  }
  async load(id, anim) {
    this.anim = anim; this.atlas = await loadAtlas(id);
    let b = idleBounds(anim); const pad = this.opts.room ?? .12;
    // Some animations come with their effects baked onto black (Crane Snow Miku draws as a dark box, on bfrevive.net
    // too). Mostly opaque near-black in the idle pose = broken; the caller then shows the artwork instead.
    if (this.darkShare(b) > 0.45) throw new Error('animation draws as a dark box');
    // opts.mass: size and centre by the sprite's visual mass (alpha-weighted pixels of the idle pose) instead of the
    // full animation box, so thin effects do not shrink a character and an off-centre pair sits in the middle.
    if (this.opts.mass) { const m = this.massBounds(b); if (m) b = m; }
    const w = b.x1 - b.x0, hh = b.y1 - b.y0;
    this.box = { x0: b.x0 - w * pad, y0: b.y0 - hh * pad, w: w * (1 + 2 * pad), h: hh * (1 + pad) + 6, cx: b.cx };
    this.resize(); this.set(this.kind);
  }
  // Render the first idle frame once, off screen, and take the bounds holding the central 94 % of the alpha mass in x
  // and 98 % in y (keeps the feet, trims a sword tip or wisp). cx = mass centroid in sprite units.
  massBounds(b) {
    try {
      const step = this.anim.idle && this.anim.idle[0]; if (!step) return null;
      const W = Math.ceil(b.x1 - b.x0), H = Math.ceil(b.y1 - b.y0); if (W < 4 || H < 4 || W > 2048 || H > 2048) return null;
      const off = document.createElement('canvas'); off.width = W; off.height = H;
      const c = off.getContext('2d', { willReadFrequently: true });
      c.setTransform(1, 0, 0, 1, -b.x0, -b.y0);
      this.drawParts(c, this.anim.cgg[step[0]] || [], step[1], step[2]);
      const d = c.getImageData(0, 0, W, H).data;
      const col = new Float64Array(W), row = new Float64Array(H); let total = 0, sx = 0;
      // Solid pixels (alpha > 0.3) count fully, faint glow hardly at all; the box keeps 99 % of that mass so only
      // stray specks are trimmed, and the centroid tells where the character really stands.
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = d[(y * W + x) * 4 + 3] / 255; const m = a > 0.3 ? 1 : a * a * 0.2; col[x] += m; row[y] += m; total += m; sx += m * x; }
      if (total < 1) return null;
      const span = (arr, keep) => { const cut = (1 - keep) / 2 * total; let lo = 0, hi = arr.length - 1, acc = 0; while (lo < hi && acc + arr[lo] < cut) acc += arr[lo++]; acc = 0; while (hi > lo && acc + arr[hi] < cut) acc += arr[hi--]; return [lo, hi + 1]; };
      const [x0, x1] = span(col, 0.99), [y0, y1] = span(row, 0.995);
      return { x0: b.x0 + x0, x1: b.x0 + x1, y0: b.y0 + y0, y1: b.y0 + y1, cx: b.x0 + sx / total };
    } catch { return null; }   // a tainted canvas or a huge frame: fall back to the plain bounds
  }
  // Share of the visible pixels of the first idle frame that are opaque and near-black (outlines of a normal sprite
  // stay well under a quarter). 0 when it cannot be measured.
  darkShare(b) {
    try {
      const step = this.anim.idle && this.anim.idle[0]; if (!step) return 0;
      const W = Math.ceil(b.x1 - b.x0), H = Math.ceil(b.y1 - b.y0); if (W < 4 || H < 4 || W > 2048 || H > 2048) return 0;
      const off = document.createElement('canvas'); off.width = W; off.height = H;
      const c = off.getContext('2d', { willReadFrequently: true });
      c.setTransform(1, 0, 0, 1, -b.x0, -b.y0);
      this.drawParts(c, this.anim.cgg[step[0]] || [], step[1], step[2]);
      const d = c.getImageData(0, 0, W, H).data; let seen = 0, dark = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 80) continue;
        seen++;
        if (d[i + 3] > 230 && d[i] + d[i + 1] + d[i + 2] < 60) dark++;
      }
      return seen > 200 ? dark / seen : 0;
    } catch { return 0; }
  }
  drawParts(ctx, p, dx, dy) {
    ctx.imageSmoothingQuality = 'high';
    for (let i = p.length - 10; i >= 0; i -= 10) {
      const x = p[i] + dx, y = p[i + 1] + dy, flip = p[i + 2], blend = p[i + 3], alpha = p[i + 4], rot = p[i + 5], sx = p[i + 6], sy = p[i + 7], w = p[i + 8], hh = p[i + 9];
      if (w <= 0 || hh <= 0) continue;
      ctx.save(); ctx.translate(x + w / 2, y + hh / 2);
      if (rot) ctx.rotate(rot * Math.PI / 180);
      if (flip) ctx.scale(flip & 1 ? -1 : 1, flip & 2 ? -1 : 1);
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha / 100)); ctx.globalCompositeOperation = blend === 1 ? 'lighter' : 'source-over';
      ctx.drawImage(this.atlas, sx, sy, w, hh, -w / 2, -hh / 2, w, hh); ctx.restore();
    }
  }
  resize() {
    if (!this.box) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = this.canvas.clientWidth || 160, ch = this.canvas.clientHeight || cw;
    // opts.spill lets a wide animation box exceed the canvas width by that factor (clipped at the edges) so the
    // character is sized by height like its neighbours instead of shrinking to fit a wide effect.
    // opts.fitWidth: the width the sprite may use regardless of the canvas width (the canvas can be wider so that
    // nothing is clipped while every slot keeps the same visual margin).
    const fitW = this.opts.fitWidth || cw * (this.opts.spill || 1);
    this.scale = Math.min(fitW / this.box.w, ch / this.box.h, this.opts.maxScale || 2);
    this.canvas.width = Math.round(cw * dpr); this.canvas.height = Math.round(ch * dpr);
    this.dpr = dpr; this.cw = cw; this.ch = ch; this.draw();
  }
  set(kind) {
    if (!this.anim) { this.kind = kind; return; }
    this.kind = this.anim[kind] ? kind : 'idle'; this.steps = this.anim[this.kind];
    this.total = this.steps.reduce((t, s) => t + Math.max(1, s[3]), 0); this.start = performance.now(); this.draw(); this.kick();
  }
  // Play one attack, then go back to idling.
  attack() {
    if (!this.anim || !this.anim.atk) return;
    this.set('atk'); const ms = this.total * 1000 / 60;
    clearTimeout(this.back); this.back = setTimeout(() => this.set('idle'), ms);
  }
  kick() {
    if (this.raf || !this.playing || !this.visible || !this.steps) return;
    const loop = () => { this.raf = 0; if (!this.canvas.isConnected) { this.destroy(); return; } if (!this.playing || !this.visible) return; this.draw(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  stepAt(ms) {
    let t = Math.floor(ms / (1000 / 60)) % this.total;
    for (const s of this.steps) { t -= Math.max(1, s[3]); if (t < 0) return s; }
    return this.steps[0];
  }
  draw() {
    const { ctx, atlas, steps } = this; if (!atlas || !steps) return;
    const [f, dx, dy] = this.stepAt(performance.now() - this.start);
    const p = this.anim.cgg[f] || [];
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    const s = this.scale * this.dpr;
    // Horizontal anchor: the mass centroid when known (so the character, not the animation box, is centred).
    let ox = this.box.cx != null ? this.cw * this.dpr / 2 - this.box.cx * s : (this.cw * this.dpr - this.box.w * s) / 2 - this.box.x0 * s;
    if (this.opts.fitWidth) {   // keep the whole mass box inside the slot's fixed width, whatever the centroid says
      const fw = this.opts.fitWidth * this.dpr, left = (this.cw * this.dpr - fw) / 2, bw = this.box.w * s;
      const minOx = left - this.box.x0 * s, maxOx = left + fw - bw - this.box.x0 * s;
      ox = Math.max(minOx, Math.min(maxOx, ox));
      // and clip anything that still sticks out (a faint aura) so the margin between slots stays clean
      ctx.beginPath(); ctx.rect(left - 3 * this.dpr, 0, fw + 6 * this.dpr, this.canvas.height); ctx.clip();
    }
    const oy = (this.ch * this.dpr - this.box.h * s) - this.box.y0 * s;
    ctx.setTransform(this.opts.mirror ? -s : s, 0, 0, s, this.opts.mirror ? this.cw * this.dpr - ox : ox, oy);
    this.drawParts(ctx, p, dx, dy);
    ctx.restore();
  }
  destroy() { this.playing = false; if (this.raf) cancelAnimationFrame(this.raf); clearTimeout(this.back); this.io.disconnect(); this.atlas = null; this.anim = null; }
}

// The unit's full artwork (unit_ills_full_<id>.png), what bfrevive.net shows on its unit pages ("Artwork"): the
// whole character on a transparent background. Units without a working animation get it instead of the round
// portrait. (unit_ills_battle is only a cropped bust or face, so it is not used.) A missing one is a 404 or a tiny
// placeholder; both count as none. Results are remembered for the session, so the marquee does not ask again.
const STILL = id => `${CDN_UNIT}unit_ills_full_${id}.png`;
const stillCache = new Map();
function stillOf(id) {
  if (!stillCache.has(id)) stillCache.set(id, new Promise(res => {
    const img = new Image();
    img.onload = () => res(img.naturalWidth > 16 && img.naturalHeight > 16 ? img.src : null);
    img.onerror = () => res(null);
    img.src = STILL(id);
  }));
  return stillCache.get(id);
}

// Helper: a canvas that animates unit `id`; clicking it plays the attack.
// No animation for this form (new collab units such as the Vocaloid Meiko, Kaito and Sakura Miku arrive without
// one)? Borrow the sprite of another form in the same evolution line, highest form first. No animation anywhere in
// the line, or one that draws as a dark box: the unit's full artwork (the author: "the still sprites instead of the
// character portraits"; "on the bfrevived wiki it looks better"), else another form's artwork. Nothing at all: the
// portrait stands on the stage as a framed medallion.
function spriteCanvas(id, size = 150, opts = {}) {
  const hgt = opts.height || size;
  const c = h('canvas', { class: 'sprite', width: size, height: hgt, style: `width:${size}px;height:${hgt}px`, title: unitName(id) });
  const medallion = () => { const s = Math.round(Math.min(size, hgt) * .62); c.replaceWith(h('img', { class: 'sprite-fallback', src: unitIcon(id), alt: '', title: unitName(id), style: `width:${s}px;height:${s}px` })); };
  const fallback = async u => {
    for (const other of [id, ...[...((u && u.evo) || [])].reverse().filter(x => x !== id)]) {
      const src = await stillOf(other);
      if (src) {
        const w = opts.fitWidth || size;
        c.replaceWith(h('span', { class: 'sprite-still', title: unitName(id), style: `width:${size}px;height:${hgt}px` },
          h('img', { src, alt: '', style: `max-width:${w}px;max-height:${hgt}px${opts.mirror ? ';transform:scaleX(-1)' : ''}` })));
        return;
      }
    }
    medallion();
  };
  unitDetail(id).then(async u => {
    if (!u) { fallback(null); return; }
    let animId = id, anim = u.anim;
    if (!anim) for (const other of [...(u.evo || [])].reverse()) {
      if (other === id) continue;
      const o = await unitDetail(other);
      if (o && o.anim) { animId = other; anim = o.anim; break; }
    }
    if (!anim) { fallback(u); return; }
    try { const p = new Sprite(c, opts); await p.load(animId, anim); c.addEventListener('click', () => p.attack()); c._sprite = p; }
    catch { fallback(u); }
  });
  return c;
}
