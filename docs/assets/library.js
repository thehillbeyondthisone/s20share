'use strict';
const state = {scans: [], query: '', sort: 'featured', fingerprint: ''};
const $ = id => document.getElementById(id);
const date = value => {const d = new Date(value + 'T12:00:00'); return Number.isNaN(d.getTime()) ? 'Date unavailable' : d.toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'});};
function el(tag, text, className) {const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;}
function relative(value) {if (typeof value !== 'string' || !value || value.includes('\\')) return null; const url = new URL(value, location.href); return url.origin === location.origin && url.pathname.startsWith(new URL('./', location.href).pathname) ? url.href : null;}
function toast(message) {$('toast').textContent = message; $('toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => {$('toast').hidden = true;}, 4500);}
async function copyLink(scan) {
  const url = relative(scan.viewer); if (!url) return;
  try {await navigator.clipboard.writeText(url); toast('Walkthrough link copied');}
  catch {const field = el('textarea'); field.value = url; field.style.position = 'fixed'; field.style.opacity = '0'; document.body.append(field); field.select(); const copied = document.execCommand('copy'); field.remove(); if (copied) toast('Walkthrough link copied'); else window.prompt('Copy the walkthrough link:', url);}
}
function metric(text, ready = false) {const span = el('span', undefined, 'metric'); if (ready) span.append(el('span', undefined, 'metric-dot')); span.append(document.createTextNode(text)); return span;}
function card(scan) {
  const featured = scan.milestone === 'first-successful';
  const article = el('article', undefined, 'card' + (featured ? ' featured' : ''));
  const viewer = relative(scan.viewer);
  const imageLink = el('a', undefined, 'card-image'); imageLink.href = viewer; imageLink.target = '_blank'; imageLink.rel = 'noopener'; imageLink.setAttribute('aria-label', 'Explore ' + scan.title + ' in 3D');
  const image = el('img'); image.src = relative(scan.cover) || relative('assets/space-placeholder.svg'); image.alt = '3D scan preview of ' + scan.title; image.loading = featured ? 'eager' : 'lazy'; image.width = 1280; image.height = 720;
  image.addEventListener('error', () => {image.src = relative('assets/space-placeholder.svg');}, {once:true});
  const imageAction = el('span', 'Explore in 3D ', 'image-action'); imageAction.append(el('span', '↗')); imageLink.append(image, imageAction);
  const body = el('div', undefined, 'card-body'), copy = el('div', undefined, 'card-copy');
  const kicker = el('div', undefined, 'card-kicker'); if (featured) kicker.append(el('span', '01', 'scan-number')); kicker.append(el('span', featured ? 'Our first successful scan' : scan.review === 'reviewed' ? 'Reviewed spatial capture' : 'Spatial capture · Preview'));
  copy.append(kicker, el('h2', scan.title), el('p', scan.description || 'Explore this captured space in an interactive 3D walkthrough.', 'card-description'));
  const metrics = el('div', undefined, 'card-metrics'); metrics.append(metric('Captured ' + date(scan.captured_date))); if (scan.viewpoints) metrics.append(metric(scan.viewpoints + ' viewpoints')); metrics.append(metric('Browser ready', true)); copy.append(metrics);
  const actions = el('div', undefined, 'card-actions');
  const open = el('a', undefined, 'button primary'); open.append(el('span', 'Enter the ' + (featured ? 'studio' : 'walkthrough')), el('span', '↗')); open.href = viewer; open.target = '_blank'; open.rel = 'noopener';
  const share = el('button', 'Copy walkthrough link', 'button secondary'); share.type = 'button'; share.setAttribute('aria-label', 'Copy link to ' + scan.title); share.addEventListener('click', () => copyLink(scan)); actions.append(open, share);
  const packageUrl = relative(scan.package); if (packageUrl) {const download = el('a', 'Download viewer · ' + (Number(scan.package_bytes || 0)/1e6).toFixed(1) + ' MB ↓', 'download-link'); download.href = packageUrl; download.download = (scan.capture_id || scan.id) + '.zip'; actions.append(download);}
  if (scan.review !== 'reviewed') actions.append(el('p', 'Available for walkthrough review.', 'card-footnote'));
  body.append(copy, actions); article.append(imageLink, body); return article;
}
function render() {
  const query = state.query.trim().toLocaleLowerCase();
  const scans = state.scans.filter(scan => [scan.title,scan.description,scan.capture_id,scan.captured_date,...(scan.tags || [])].join(' ').toLocaleLowerCase().includes(query));
  const newest = (a,b) => b.captured_date.localeCompare(a.captured_date) || String(b.published_at || '').localeCompare(String(a.published_at || ''));
  scans.sort(state.sort === 'title' ? (a,b) => a.title.localeCompare(b.title) : state.sort === 'featured' ? (a,b) => Number(b.milestone === 'first-successful') - Number(a.milestone === 'first-successful') || newest(a,b) : newest);
  $('cards').replaceChildren(...scans.map(card)); $('empty').hidden = scans.length !== 0;
  $('empty').querySelector('h2').textContent = 'No spaces found'; $('empty').querySelector('p').textContent = 'Try another search.';
  $('toolbar').hidden = state.scans.length <= 1;
}
async function refresh() {
  try {
    const response = await fetch('catalog.json?refresh=' + Math.floor(Date.now()/60000), {cache:'no-store'}); if (!response.ok) throw Error('Catalog unavailable');
    const data = await response.json(); if (data.schema_version !== '1.0' || !Array.isArray(data.scans)) throw Error('Catalog format unavailable');
    const valid = data.scans.filter(scan => typeof scan.title === 'string' && typeof scan.captured_date === 'string' && relative(scan.viewer));
    const fingerprint = JSON.stringify(data); if (fingerprint !== state.fingerprint) {state.scans = valid; state.fingerprint = fingerprint; render();}
    $('sync-status').textContent = state.scans.length + (state.scans.length === 1 ? ' space to explore' : ' spaces to explore');
  } catch {$('sync-status').textContent = state.scans.length ? 'Showing the last loaded collection' : 'Collection unavailable · retrying'; if (!state.scans.length) {$('empty').hidden = false; $('empty').querySelector('h2').textContent = 'The collection could not load'; $('empty').querySelector('p').textContent = 'We will try again automatically. You can also reload this page.';}}
}
$('search').addEventListener('input', event => {state.query = event.target.value; render();});
$('sort').addEventListener('change', event => {state.sort = event.target.value; render();});
$('reset').addEventListener('click', () => {state.query = ''; $('search').value = ''; render(); if (!$('toolbar').hidden) $('search').focus();});
refresh(); setInterval(refresh, 60000);
