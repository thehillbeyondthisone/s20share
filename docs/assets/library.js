'use strict';
const state = {scans: [], filter: 'all', query: '', sort: 'newest', fingerprint: ''};
const $ = id => document.getElementById(id);
const date = value => { const d = new Date(value + 'T12:00:00'); return Number.isNaN(d.getTime()) ? 'Date unavailable' : d.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}); };
function el(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
function relative(value) { if (typeof value !== 'string' || !value || value.includes('\\')) return null; const url = new URL(value, location.href); return url.origin === location.origin && url.pathname.startsWith(new URL('./', location.href).pathname) ? url.href : null; }
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => {$('toast').hidden = true;}, 4500); }
async function copyLink(scan) { const url = relative(scan.viewer); if (!url) return; try { await navigator.clipboard.writeText(url); toast('Walkthrough link copied'); } catch { const field = el('textarea'); field.value = url; field.style.position = 'fixed'; field.style.opacity = '0'; document.body.append(field); field.select(); const copied = document.execCommand('copy'); field.remove(); if (copied) toast('Walkthrough link copied'); else { window.prompt('Copy the walkthrough link:', url); } } }
function card(scan) {
  const article = el('article', undefined, 'card');
  const viewer = relative(scan.viewer), cover = relative(scan.cover) || relative('assets/space-placeholder.svg');
  const imageLink = el('a', undefined, 'card-image'); imageLink.style.display = 'block'; imageLink.href = viewer; imageLink.target = '_blank'; imageLink.rel = 'noopener'; imageLink.setAttribute('aria-label', 'Open ' + scan.title);
  const image = el('img'); image.src = cover; image.alt = 'Preview of ' + scan.title; image.loading = 'lazy'; image.addEventListener('error', () => { image.src = relative('assets/space-placeholder.svg'); }, {once:true});
  imageLink.append(image, el('span', scan.review === 'reviewed' ? 'Reviewed' : 'Preview', 'badge ' + (scan.review === 'reviewed' ? 'reviewed' : '')), el('span', '↗', 'card-view-icon'));
  const body = el('div', undefined, 'card-body'); body.append(el('div', 'Captured ' + date(scan.captured_date), 'card-date'), el('h3', scan.title), el('p', scan.description || 'An interactive 3D walkthrough of this captured space.', 'card-description'));
  const tags = el('div', undefined, 'tags'); for (const tag of scan.tags || []) tags.append(el('span', tag, 'tag')); body.append(tags);
  const metrics = el('div', undefined, 'card-metrics'); if (scan.photos) metrics.append(el('span', Number(scan.photos).toLocaleString() + ' photos')); if (scan.viewpoints) metrics.append(el('span', scan.viewpoints + ' viewpoints')); if (scan.viewer_bytes) metrics.append(el('span', (scan.viewer_bytes / 1e6).toFixed(1) + ' MB')); body.append(metrics);
  const actions = el('div', undefined, 'card-actions'); const open = el('a', 'Open walkthrough ↗', 'button primary'); open.href = viewer; open.target = '_blank'; open.rel = 'noopener'; const copy = el('button', '⧉', 'copy-button'); copy.type = 'button'; copy.setAttribute('aria-label', 'Copy link to ' + scan.title); copy.title = 'Copy walkthrough link'; copy.addEventListener('click', () => copyLink(scan)); actions.append(open, copy); body.append(actions);
  const packageUrl = relative(scan.package); if (packageUrl) { const download = el('a', '↓ Download HTML package · ' + (Number(scan.package_bytes || 0) / 1e6).toFixed(1) + ' MB', 'download-link'); download.href = packageUrl; download.download = (scan.capture_id || scan.id) + '.zip'; body.append(download); }
  if (scan.review !== 'reviewed') body.append(el('p', 'Available for walkthrough review.', 'card-footnote'));
  article.append(imageLink, body); return article;
}
function render() {
  const query = state.query.trim().toLocaleLowerCase();
  const scans = state.scans.filter(scan => (state.filter === 'all' || scan.review === state.filter) && [scan.title,scan.description,scan.capture_id,scan.captured_date,...(scan.tags || [])].join(' ').toLocaleLowerCase().includes(query));
  scans.sort(state.sort === 'title' ? (a,b) => a.title.localeCompare(b.title) : (a,b) => b.captured_date.localeCompare(a.captured_date) || b.published_at.localeCompare(a.published_at));
  $('cards').replaceChildren(...scans.map(card)); $('empty').hidden = scans.length !== 0; $('result-count').textContent = scans.length;
  $('empty').querySelector('h3').textContent = 'No spaces found'; $('empty').querySelector('p').textContent = 'Try a different search or filter.';
}
function overview(data) {
  $('available-count').textContent = state.scans.length;
  $('photo-count').textContent = state.scans.reduce((sum,scan) => sum + Number(scan.photos || 0), 0).toLocaleString();
  const latest = [...state.scans].sort((a,b) => b.captured_date.localeCompare(a.captured_date))[0];
  $('latest-date').textContent = latest ? new Date(latest.captured_date + 'T12:00:00').toLocaleDateString('en-US', {month:'short',day:'numeric'}) : '—';
  if (latest) { $('hero-image').src = relative(latest.cover) || relative('assets/space-placeholder.svg'); $('hero-name').textContent = latest.title; $('hero-detail').textContent = 'Captured ' + date(latest.captured_date) + ' · ' + (latest.viewpoints || 4) + ' viewpoints'; }
  $('sync-status').textContent = 'Library updated ' + new Date(data.updated_at).toLocaleDateString('en-US', {month:'short',day:'numeric'});
}
async function refresh() {
  try {
    const response = await fetch('catalog.json?refresh=' + Math.floor(Date.now()/60000), {cache:'no-store'}); if (!response.ok) throw Error('Catalog unavailable');
    const data = await response.json(); if (data.schema_version !== '1.0' || !Array.isArray(data.scans)) throw Error('Catalog format unavailable');
    const valid = data.scans.filter(scan => typeof scan.title === 'string' && typeof scan.captured_date === 'string' && relative(scan.viewer));
    const fingerprint = JSON.stringify(data); if (fingerprint !== state.fingerprint) {state.scans = valid; state.fingerprint = fingerprint; overview(data); render();}
  } catch (error) { $('sync-status').textContent = state.scans.length ? 'Showing the last loaded library' : 'Library could not load · retrying'; if (!state.scans.length) { $('empty').hidden = false; $('empty').querySelector('h3').textContent = 'The library is temporarily unavailable'; $('empty').querySelector('p').textContent = 'We will try again automatically. You can also reload this page.'; } }
}
$('search').addEventListener('input', event => {state.query = event.target.value; render();});
for (const button of document.querySelectorAll('.filter')) button.addEventListener('click', () => {state.filter = button.dataset.filter; for (const item of document.querySelectorAll('.filter')) {item.classList.toggle('selected', item === button); item.setAttribute('aria-pressed', String(item === button));} render();});
$('sort').addEventListener('change', event => {state.sort = event.target.value; render();});
$('reset').addEventListener('click', () => {state.query = ''; state.filter = 'all'; $('search').value = ''; document.querySelector('[data-filter="all"]').click(); $('search').focus();});
$('year').textContent = new Date().getFullYear(); refresh(); setInterval(refresh, 60000);
