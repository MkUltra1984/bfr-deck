'use strict';
// Small DOM and formatting helpers shared by every view.

const $ = id => document.getElementById(id);

// Views build trees with conditional children (`cond ? node : null`) and arrays of nodes. The DOM
// methods would print "null" and "[object ...]" for those, so make them skip null/false and flatten.
for (const name of ['append', 'prepend', 'replaceChildren']) {
  const orig = Element.prototype[name];
  Element.prototype[name] = function (...kids) { return orig.apply(this, kids.flat(Infinity).filter(k => k != null && k !== false)); };
}
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}
const fmt = n => Number(n || 0).toLocaleString('en-US');
const pct = x => (x < 0.01 ? '<0.01' : x < 10 ? Number(x).toFixed(2) : Number(x).toFixed(1)) + '%';
const ELEMENTS = ['', 'Fire', 'Water', 'Earth', 'Thunder', 'Light', 'Dark'];
const SITE = 'https://bfrevive.net';
const API = 'https://api.bfrdeck';   // served by the WPF host (cache proxy + status)
const CDN_UNIT = 'https://cdn.bfrevive.net/content/unit/img/';
const CDN_ITEM = 'https://cdn.bfrevive.net/content/item/';
const CDN_GACHA = 'https://cdn.bfrevive.net/content/gacha/';
const unitIcon = id => `${CDN_UNIT}unit_ills_thum_${id}.png`;
const elIcon = e => `${SITE}/units/art/el-${e}.png`;

const norm = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/['’]/g, '').replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();

// Typo-tolerant ranking: exact > prefix > substring > every word close to a word of the name.
function osa(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const c = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[m][n];
}
function matchScore(q, qt, entry) {
  if (entry.norm === q) return 100;
  const at = entry.norm.indexOf(q);
  if (at === 0) return 90;
  if (at > 0) return 80 - Math.min(at, 20) / 2;
  let total = 0;
  for (const t of qt) {
    const allow = t.length <= 3 ? 0 : t.length <= 6 ? 1 : 2;
    let best = 9;
    for (const w of entry.tokens) {
      if (w.startsWith(t)) { best = 0; break; }
      best = Math.min(best, osa(t, w), w.length > t.length ? osa(t, w.slice(0, t.length)) : 9);
    }
    if (best > allow) return 0;
    total += best;
  }
  return 60 - total * 5;
}

function stars(r) {
  if (r >= 8) return h('span', { class: 'stars r8', title: 'Omni' }, 'OMNI');
  return h('span', { class: `stars r${Math.max(r, 0)}`, title: `${r} stars` }, '★'.repeat(Math.max(r, 0)));
}
const rarityName = r => r >= 8 ? 'Omni' : `${r}★`;

function timeLeft(seconds) {
  if (seconds <= 0) return 'now';
  const d = Math.floor(seconds / 86400), hh = Math.floor((seconds % 86400) / 3600), mm = Math.floor((seconds % 3600) / 60), ss = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${hh}h ${mm}m`;
  if (hh > 0) return `${hh}h ${String(mm).padStart(2, '0')}m`;
  return `${mm}m ${String(ss).padStart(2, '0')}s`;
}
const fmtWhen = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const when = t => fmtWhen.format(new Date(t * 1000));
const fmtClock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

// Host bridge (WPF). Falls back to normal links when run in a plain browser.
const host = {
  open(tab, url) {
    if (window.chrome && window.chrome.webview) window.chrome.webview.postMessage({ cmd: 'open', tab, url });
    else window.open(url, '_blank');
  },
  browser(url) {
    if (window.chrome && window.chrome.webview) window.chrome.webview.postMessage({ cmd: 'browser', url });
    else window.open(url, '_blank');
  },
  send(cmd) { if (window.chrome && window.chrome.webview) window.chrome.webview.postMessage({ cmd }); },
};
// The top-left "← Back" line of a sub-page: goes back in history when the deck has one, else to the given route.
function backLink(fallback, label = '← Back') {
  const a = h('a', { href: fallback, onclick: e => { if (history.length > 1 && window.navCount > 0) { e.preventDefault(); history.back(); } } }, label);
  return h('p', { class: 'back' }, a);
}
window.navCount = 0; window.addEventListener('hashchange', () => { window.navCount++; });
function siteLink(label, path, tab = 'site') {
  return h('a', { href: '#', onclick: e => { e.preventDefault(); host.open(tab, path.startsWith('http') ? path : SITE + path); } }, label);
}

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
};
// Mouse drag on a horizontal strip: hold the left button and move to scroll (touch-style). A drag longer than a
// few pixels swallows the click that would follow, so a card is only opened by a clean click.
function dragScroll(el) {
  let down = null, moved = false;
  el.addEventListener('dragstart', e => e.preventDefault());   // links and images would start a native drag instead
  el.addEventListener('pointerdown', e => { if (e.button !== 0) return; down = { x: e.clientX, left: el.scrollLeft }; moved = false; el.classList.add('dragging'); });
  el.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - down.x;
    if (!moved && Math.abs(dx) > 5) { moved = true; try { el.setPointerCapture(e.pointerId); } catch { } }
    if (moved) el.scrollLeft = down.left - dx;
  });
  const end = () => { down = null; el.classList.remove('dragging'); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  el.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  return el;
}
// Drag on a CSS-animated marquee: freezes the animation at its current offset while the button is held, follows
// the mouse (wrapping around the duplicated track), then resumes from where it was let go.
function dragMarquee(marquee, track) {
  let down = null, moved = false, tx = 0;
  const half = () => track.scrollWidth / 2 || 1;
  marquee.addEventListener('dragstart', e => e.preventDefault());
  marquee.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const m = new DOMMatrixReadOnly(getComputedStyle(track).transform); tx = m.m41 || 0;
    down = { x: e.clientX, tx }; moved = false; marquee.classList.add('dragging');
    track.style.animationName = 'none'; track.style.transform = `translateX(${tx}px)`;
  });
  marquee.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - down.x;
    if (!moved && Math.abs(dx) > 5) { moved = true; try { marquee.setPointerCapture(e.pointerId); } catch { } }
    if (!moved) return;
    tx = down.tx + dx; const w = half();
    while (tx > 0) tx -= w; while (tx < -w) tx += w;
    track.style.transform = `translateX(${tx}px)`;
  });
  const end = () => {
    if (!down) return; down = null; marquee.classList.remove('dragging');
    const dur = parseFloat(getComputedStyle(track).animationDuration) || 20;
    track.style.animationDelay = `${-(-tx / half()) * dur}s`;   // negative delay = start this far in
    track.style.transform = ''; track.style.animationName = '';
  };
  marquee.addEventListener('pointerup', end); marquee.addEventListener('pointercancel', end); marquee.addEventListener('lostpointercapture', end);
  marquee.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  return marquee;
}
// Hold and drag left/right on an element to step through items: onStep(-1 | 1) fires every `step` pixels while the
// button is held, so one long drag walks through several items. Clicks after a drag are swallowed.
function swipe(el, onStep, step = 70) {
  let down = null, moved = false, acc = 0;
  el.addEventListener('dragstart', e => e.preventDefault());
  el.addEventListener('pointerdown', e => { if (e.button === 0) { down = e.clientX; acc = 0; moved = false; el.classList.add('dragging'); } });
  el.addEventListener('pointermove', e => {
    if (down == null) return;
    const dx = e.clientX - down;
    if (!moved && Math.abs(dx) > 5) { moved = true; try { el.setPointerCapture(e.pointerId); } catch { } }
    acc = dx;
    while (acc >= step) { onStep(-1); down += step; acc -= step; }
    while (acc <= -step) { onStep(1); down -= step; acc += step; }
  });
  const end = e => { if (down == null) return; const dx = e.clientX - down; down = null; el.classList.remove('dragging'); if (moved && Math.abs(dx) > 25 && Math.abs(dx) < step) onStep(dx < 0 ? 1 : -1); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', () => { down = null; el.classList.remove('dragging'); });
  el.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  return el;
}

let toastTimer = 0;
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = h('div', { class: 'toast' }); document.body.append(t); }
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2500);
}
