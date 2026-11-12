'use strict';
// In-app update. The host (Updater.cs) asks the GitHub releases page and does the download; this file shows the bar
// under the tabs: "version x is ready" with Update / Later, the progress, and an error with a way out.
// A web-only update reloads the deck in place; a full one restarts the program. Both are started by the user.
//   #/home/doupdate   support route: applies an available update without a click (tests)
let UPD = null, updTimer = 0;
const updSize = n => (n >= 1048576 ? `${(n / 1048576).toFixed(n >= 10485760 ? 0 : 1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
async function updGet(path = '') {
  try { const r = await fetch(`${API}/api/update${path}`, { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch { return null; }
}

function updDraw() {
  const bar = $('updbar'), s = UPD;
  if (!bar) return;
  const show = (cls, ...kids) => { bar.className = cls; bar.hidden = false; bar.replaceChildren(...kids); };
  if (!s || !s.supported) { bar.hidden = true; return; }
  if (s.busy) {
    const p = s.progress, part = p && p.total > 0 ? Math.min(1, p.done / p.total) : 0;
    show('busy', h('b', {}, `Updating to ${s.version}`), h('div', { class: 'bar' }, h('div', { class: 'fill', style: `width:${Math.round(100 * part)}%` })),
      h('span', { class: 'faint num' }, p && p.total > 0 ? `${updSize(p.done)} of ${updSize(p.total)}` : 'Starting…'));
  } else if (s.error) {
    show('bad', h('b', {}, 'Update failed'), h('span', { class: 'grow msg' }, s.error),
      h('button', { onclick: updApply }, 'Try again'), h('button', { onclick: () => host.browser(s.page) }, 'Download page'),
      h('button', { class: 'icon', title: 'Hide', 'aria-label': 'Hide', onclick: () => { UPD.error = null; updDraw(); } }, '✕'));
  } else if (s.available && sessionStorage.getItem('updLater') !== s.version) {
    const full = s.kind === 'full';
    show('', h('b', {}, `Version ${s.version} is ready`), h('span', { class: 'grow msg', title: s.notes }, s.notes || `You have ${s.current}.`),
      h('span', { class: 'faint num' }, updSize(s.size)),
      h('button', { class: 'primary', title: full ? 'Downloads the new version and restarts the deck. Your box, squads and notes stay.' : 'Downloads the new version and reloads the deck. Your box, squads and notes stay.', onclick: updApply }, full ? 'Update and restart' : 'Update'),
      h('button', { onclick: () => { sessionStorage.setItem('updLater', s.version); updDraw(); } }, 'Later'));
  } else bar.hidden = true;
}

async function updApply() {
  const s = await updGet('/apply');
  if (s) { UPD = s; UPD.busy = true; updDraw(); }
  clearInterval(updTimer);
  updTimer = setInterval(async () => {   // the page is reloaded (or the deck restarted) by the host when it is done
    const n = await updGet(); if (!n) return;
    UPD = n; updDraw();
    if (!n.busy) clearInterval(updTimer);
  }, 400);
}

async function updCheck(manual) {
  const s = await updGet('/check');
  if (!s) return;
  UPD = s;
  if (manual) { sessionStorage.removeItem('updLater'); toast(!s.supported ? 'This build does not update itself' : s.available ? `Version ${s.version} is ready` : `You have the newest version (${s.current})`); }
  if (s.updated && sessionStorage.getItem('updToast') !== s.updated) { sessionStorage.setItem('updToast', s.updated); setTimeout(() => toast(`Updated to version ${s.updated}`), 1200); }
  updDraw();
  for (const el of document.querySelectorAll('.updver')) el.textContent = s.current;
  if (!manual && s.available && location.hash === '#/home/doupdate') updApply();
}

// "BFR Deck 1.2.0 · Check for updates": the line at the bottom of the Guide
function updLine() {
  return h('p', { class: 'faint updline' }, 'BFR Deck ', h('span', { class: 'updver' }, UPD ? UPD.current : ''), ' · ',
    h('a', { href: '#', onclick: e => { e.preventDefault(); updCheck(true); } }, 'Check for updates'));
}

updCheck(false);
setInterval(() => updCheck(false), 6 * 3600 * 1000);
