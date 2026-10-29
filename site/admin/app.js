/* Dragon Gym 관리자 화면. 레이아웃은 tkd.reizwings.jp 관리자와 같은 "왼쪽 목록 + 오른쪽 카드 편집".
 * 편집은 메모리의 data 에만 반영하고, 아래 저장 바의 [저장] 한 번에 바뀐 JSON·새 이미지를 커밋 하나로 올린다.
 * 입력칸은 data-bind="파일.경로" 로 data 에 바로 묶는다 (예: branches.branches.0.name.ko). */
import { createRepo, REPO, BRANCH, SITE_DIR } from './repo.js';
import * as auth from './auth.js';
import { t, lang, applyStatic, onLangChange } from './i18n.js';

// 화면 이름표는 t(key) 로 그때그때 (언어 전환), 커밋 메시지는 한국어로 고정
const FILES = {
  branches: { path: 'site/content/branches.json', key: 'file.branches' },
  team: { path: 'site/content/team.json', key: 'file.team' },
  contact: { path: 'site/content/contact.json', key: 'file.contact' },
  social: { path: 'site/content/social.json', key: 'file.social' },
};
const fileLabel = (k, as) => t(FILES[k].key, {}, as);
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const PROGRAMS = { kids: 'var(--p-kids)', basic: 'var(--p-basic)', acro: 'var(--p-acro)', athlete: 'var(--p-athlete)' };
const progName = (p) => (PROGRAMS[p] ? t(`prog.${p}`) : p);
// 사이트 내용의 언어 칸(관리 화면 언어와 별개)
const LANGS = [['th', 'ไทย'], ['en', 'EN'], ['ko', '한국어']];
const TEAM = ['judges', 'staff', 'athletes'];
const team = (key, f) => t(`team.${key}.${f}`);
// 내용의 3개 국어 칸 중 화면 언어 → 한국어 → 태국어 → 영어 순으로 비어 있지 않은 것
const pick = (tri) => (tri ? tri[lang()] || tri.ko || tri.th || tri.en || '' : '');
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${SITE_DIR}`;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const ICON = {
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg>',
  insta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

/* ================= 상태 ================= */
let repo = null;
const data = {};          // 파일 키 → 편집 중인 JSON
const snap = {};          // 파일 키 → 마지막으로 불러온/저장한 JSON 문자열 (변경 감지)
const pending = new Map(); // 'assets/uploads/…' → { base64, url } 아직 커밋 안 된 새 이미지
let route = '';

const dirtyKeys = () => Object.keys(FILES).filter((k) => data[k] && JSON.stringify(data[k]) !== snap[k]);

/* ================= 공통 UI ================= */
let toastTimer = 0;
function toast(text, isErr = false) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.toggle('is-err', isErr);
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), isErr ? 6000 : 2600);
}

function refreshSavebar() {
  const keys = dirtyKeys();
  $('#savebar').classList.toggle('is-on', keys.length > 0);
  $('#saveText').textContent = keys.length ? t('save.unsaved', { list: keys.map((k) => fileLabel(k)).join(', ') }) : '';
}
function changed() { refreshSavebar(); renderSide(); }

// 이미지: 새로 올린 건 미리보기 URL, 기존 건 사이트 경로. 방금 커밋돼 아직 배포 전이면 레포 원본으로 대체.
const imgSrc = (path) => (!path ? '' : pending.has(path) ? pending.get(path).url : `../${path}`);
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName !== 'IMG' || img.dataset.fallback || !img.dataset.path) return;
  img.dataset.fallback = '1';
  img.src = RAW + img.dataset.path;
}, true);
const imgTag = (path, alt = '') => (path ? `<img src="${esc(imgSrc(path))}" data-path="${esc(path)}" alt="${esc(alt)}" loading="lazy">` : '');

// data-bind 경로 읽기/쓰기
const getPath = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), data);
function setPath(path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const obj = keys.reduce((o, k) => o[k], data);
  obj[last] = value;
}
const bindInput = (path, attrs = '') => `<input class="input" data-bind="${path}" value="${esc(getPath(path))}" ${attrs}>`;
function triInputs(path, placeholder = '') {
  return `<div class="tri">${LANGS.map(([k, label]) => `<label><span class="lang">${label}</span>${bindInput(`${path}.${k}`, `aria-label="${label}" placeholder="${esc(placeholder)}"`)}</label>`).join('')}</div>`;
}

/* ================= 이미지 처리 ================= */
// 브라우저에서 줄이고(긴 변 max) webp 로 바꿔 레포 용량을 아낀다. square 면 가운데를 정사각형으로 자른다.
async function processImage(file, { kind, max = 1600, square = false, type = 'image/webp', quality = 0.86 }) {
  if (!file.type.startsWith('image/')) throw new Error(t('img.onlyImage'));
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { throw new Error(t('img.unreadable')); }
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  if (square) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s; }
  const scale = Math.min(1, max / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d');
  if (type === 'image/png') ctx.imageSmoothingEnabled = false; // QR 은 선명하게
  else { ctx.imageSmoothingQuality = 'high'; }
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((ok) => canvas.toBlob(ok, type, quality));
  const base64 = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const path = `assets/uploads/${kind}-${stamp}-${Math.random().toString(36).slice(2, 6)}.${type === 'image/png' ? 'png' : 'webp'}`;
  pending.set(path, { base64, url: URL.createObjectURL(blob) });
  return path;
}

// 이미지 칸: 미리보기 + 드롭존. data-img="data 경로" 또는 data-img-draft (다이얼로그 초안)
function imageField({ path, value, kind, variant = '', title = t('img.change'), help = t('img.help'), opts = {} }) {
  return `<div class="imgfield ${variant ? `imgfield--${variant}` : ''}">
    <div class="imgfield__preview">${imgTag(value) || `<span class="hint">${t('img.none')}</span>`}${pending.has(value) ? `<span class="badge pending">${t('img.pending')}</span>` : ''}</div>
    <label class="drop" data-drop>
      <input type="file" accept="image/*" data-img="${esc(path)}" data-kind="${kind}" data-opts='${esc(JSON.stringify(opts))}'>
      ${ICON.upload}<b>${title}</b><span>${help}</span>
    </label>
  </div>`;
}
function wireDrops(root) {
  $$('[data-drop]', root).forEach((zone) => {
    const input = $('input', zone);
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault(); zone.classList.remove('is-over');
      if (e.dataTransfer.files[0]) handleImage(input, e.dataTransfer.files[0]);
    });
    input.addEventListener('change', () => { if (input.files[0]) handleImage(input, input.files[0]); input.value = ''; });
  });
}
let draftImageSink = null; // 다이얼로그가 열려 있으면 그 초안에 이미지 경로를 넣는다
async function handleImage(input, file) {
  try {
    const path = await processImage(file, { kind: input.dataset.kind, ...JSON.parse(input.dataset.opts || '{}') });
    const target = input.dataset.img;
    if (target.startsWith('draft:')) draftImageSink(target.slice(6), path);
    else { setPath(target, path); changed(); renderMain(); }
    toast(t('img.changed'));
  } catch (e) { toast(e.message, true); }
}

/* ================= 다이얼로그 ================= */
// 초안(draft)을 편집하다 [적용] 하면 onApply(draft). 입력은 data-d="경로" 로 초안에 묶는다.
function openDialog({ title, draft, body, onApply, onDelete, applyLabel = t('dlg.apply') }) {
  const dlg = $('#dlg'), form = $('#dlgForm');
  const dget = (p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), draft);
  const dset = (p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((o, k) => o[k], draft)[last] = v; };
  const paint = () => {
    form.innerHTML = `<div class="dlg__head"><h2>${esc(title)}</h2><button class="iconbtn" type="button" data-close aria-label="${t('dlg.close')}">${ICON.x}</button></div>
      <div class="dlg__body">${body(draft, { dget })}</div>
      <div class="dlg__foot">${onDelete ? `<button class="btn btn--danger" type="button" data-del>${t('dlg.delete')}</button>` : ''}
        <button class="btn btn--ghost" type="button" data-close>${t('dlg.cancel')}</button><button class="btn btn--gold" type="submit">${esc(applyLabel)}</button></div>`;
    wireDrops(form);
  };
  draftImageSink = (p, path) => { dset(p, path); paint(); };
  paint();
  form.oninput = (e) => {
    const el = e.target;
    if (el.dataset.d) dset(el.dataset.d, el.type === 'checkbox' ? el.checked : el.value);
    if (el.dataset.dLines) dset(el.dataset.dLines, el.value.split('\n').map((s) => s.trim()).filter(Boolean));
  };
  form.onchange = form.oninput;
  form.onclick = (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.hasAttribute('data-close')) dlg.close();
    else if (t.hasAttribute('data-del')) { if (confirm(t('dlg.delConfirm'))) { onDelete(); dlg.close(); changed(); renderMain(); } }
    else if (t.dataset.act) dialogAct(t, draft, dget, dset, paint);
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    try { onApply(draft); } catch (err) { toast(err.message, true); return; }
    dlg.close(); changed(); renderMain();
  };
  dlg.onclose = () => { draftImageSink = null; };
  dlg.showModal();
}
// 다이얼로그 안의 줄 목록(경력 등) 추가·삭제·이동
function dialogAct(btn, draft, dget, dset, paint) {
  const list = dget(btn.dataset.list);
  const i = Number(btn.dataset.i);
  if (btn.dataset.act === 'add') list.push(JSON.parse(btn.dataset.tpl));
  if (btn.dataset.act === 'del') list.splice(i, 1);
  if (btn.dataset.act === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
  if (btn.dataset.act === 'down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
  paint();
}
const dInput = (draft, p, attrs = '') => `<input class="input" data-d="${p}" value="${esc(p.split('.').reduce((o, k) => (o == null ? o : o[k]), draft))}" ${attrs}>`;
const dTri = (draft, p) => `<div class="tri">${LANGS.map(([k, label]) => `<label><span class="lang">${label}</span>${dInput(draft, `${p}.${k}`, `aria-label="${label}"`)}</label>`).join('')}</div>`;

/* ================= 왼쪽 목록 ================= */
// 지점 이름은 화면 언어 → 한국어 → 태국어 순으로 비어 있지 않은 것
const branchName = (b) => pick(b.name) || t('side.newBranchName');
function navItem(href, icon, title, meta, extra = '') {
  return `<li><a href="#${href}" class="${route === href ? 'is-active' : ''}"><span class="nav__icon">${icon}</span>
    <span class="nav__text"><span class="nav__title">${esc(title)} ${extra}</span><span class="nav__meta">${esc(meta)}</span></span></a></li>`;
}
function renderSide() {
  if (!data.branches) return;
  const b = data.branches.branches;
  const photo = (list) => (list[0] && list[0].img ? imgTag(list[0].img) : ICON.people);
  const tm = data.team;
  $('#side').innerHTML = `
    <h3>${t('side.branches')}</h3>
    <ul class="nav">${b.map((x, i) => navItem(`b/${i}`, ICON.pin, branchName(x), t('side.classes', { n: x.schedule.length }), x.main ? `<span class="badge">${t('side.main')}</span>` : '')).join('')}</ul>
    <button class="btn btn--ghost btn--sm btn--block" type="button" id="addBranch">${t('side.addBranch')}</button>
    <h3>${t('side.team')}</h3>
    <ul class="nav">
      ${navItem('team/judges', photo(tm.judges), team('judges', 'title'), t('side.people', { n: tm.judges.length }))}
      ${navItem('team/staff', photo(tm.staff), team('staff', 'title'), t('side.people', { n: tm.staff.length }))}
      ${navItem('team/timeline', ICON.clock, t('side.timeline'), t('side.lines', { n: tm.coach.timeline.length }))}
      ${navItem('team/athletes', photo(tm.athletes), team('athletes', 'title'), t('side.people', { n: tm.athletes.length }))}
    </ul>
    <h3>${t('side.contactSocial')}</h3>
    <ul class="nav">
      ${navItem('contact', data.contact.line.qr ? imgTag(data.contact.line.qr) : ICON.chat, 'LINE · WhatsApp · Messenger', t('side.contactMeta'))}
      ${navItem('social', ICON.insta, t('side.social'), t('side.socialMeta', { ig: data.social.instagram.length, reels: data.social.reels.length }))}
    </ul>`;
  $('#addBranch').onclick = addBranch;
}

/* ================= 페이지: 지점 ================= */
function pageBranch(i) {
  const b = data.branches.branches[i];
  if (!b) return `<div class="empty">${t('br.notFound')}</div>`;
  const P = `branches.branches.${i}`;
  const rating = b.rating || {};
  const byDay = (d) => b.schedule.map((s, j) => ({ ...s, j })).filter((s) => s.d === d).sort((a, c) => toMin(a.s) - toMin(c.s) || toMin(a.e) - toMin(c.e));
  return `
  <div class="page-head"><div><h1>${esc(branchName(b))}</h1><p>${t('br.lead')}</p></div></div>

  <section class="card">
    <div class="card__head"><div><h2>${t('br.week')}</h2><p>${t('br.weekLead')}</p></div></div>
    <div class="week">${DAYS.map((d) => `<div class="day"><div class="day__name">${t(`day.${d}`)}</div>
      ${byDay(d).map((s) => `<button class="slot" type="button" style="--c:${PROGRAMS[s.p] || 'var(--ink)'}" data-slot="${s.j}">
        <b>${esc(s.s)}–${esc(s.e)}</b>${esc(progName(s.p))}${s.note ? `<br><small>${esc(s.note)}</small>` : ''}</button>`).join('')}
      <button class="day__add" type="button" data-add-slot="${d}">${t('br.addSlot')}</button></div>`).join('')}</div>
    <div class="legend">${Object.entries(PROGRAMS).map(([k, c]) => `<span><i style="--c:${c}"></i>${progName(k)}</span>`).join('')}</div>
  </section>

  <section class="card">
    <div class="card__head"><div><h2>${t('br.poster')}</h2><p>${t('br.posterLead')}</p></div></div>
    ${imageField({ path: `${P}.poster`, value: b.poster, kind: `poster-${b.id}`, variant: 'poster', title: t('br.posterChange'), opts: { max: 1600 } })}
  </section>

  <section class="card">
    <div class="card__head"><div><h2>${t('br.basic')}</h2></div></div>
    <div class="field"><span class="label">${t('br.name')}</span>${triInputs(`${P}.name`)}</div>
    <div class="field"><span class="label">${t('br.area')}</span>${triInputs(`${P}.area`)}</div>
    <label class="check"><input type="checkbox" data-bind="${P}.main" ${b.main ? 'checked' : ''}> ${t('br.main')}</label>
  </section>

  <section class="card">
    <div class="card__head"><div><h2>${t('br.location')}</h2><p>${t('br.locationLead')}</p></div></div>
    <div class="field"><span class="label">${t('br.address')}</span>${triInputs(`${P}.address`)}</div>
    <div class="map">
      <div>
        <div class="field"><span class="label">${t('br.paste')}</span>
          <div class="paste"><input class="input" id="mapsPaste" placeholder="${esc(t('br.pastePh'))}"><button class="btn btn--ink" type="button" id="mapsApply">${t('dlg.apply')}</button></div>
          <p class="hint">${t('br.pasteHint')}</p></div>
        <div class="row">
          <label class="field"><span>${t('br.lat')}</span>${bindInput(`${P}.lat`, 'data-type="num" inputmode="decimal"')}</label>
          <label class="field"><span>${t('br.lng')}</span>${bindInput(`${P}.lng`, 'data-type="num" inputmode="decimal"')}</label>
        </div>
        <label class="field"><span>${esc(t('br.mapsUrl'))}</span>${bindInput(`${P}.mapsUrl`, `data-type="opt" placeholder="${esc(t('br.mapsUrlPh'))}"`)}</label>
        <label class="field"><span>${t('br.placeId')}</span>${bindInput(`${P}.placeId`, 'data-type="opt" placeholder="ChIJ…"')}</label>
      </div>
      <iframe id="mapPreview" title="${t('br.mapPreview')}" loading="lazy" src="${mapEmbed(b)}"></iframe>
    </div>
  </section>

  <section class="card">
    <div class="card__head"><div><h2>${t('br.phones')}</h2><p>${t('br.phonesLead')}</p></div>
      <button class="btn btn--ghost btn--sm" type="button" data-list-add="${P}.phones" data-tpl='{"number":"","label":{"th":"","en":"","ko":""}}'>${t('br.addPhone')}</button></div>
    ${b.phones.map((ph, j) => `<div class="phone">
      ${bindInput(`${P}.phones.${j}.number`, `inputmode="tel" placeholder="0869515115" aria-label="${t('br.number')}"`)}
      <div class="tri">${LANGS.map(([k, label]) => `<label><span class="lang">${label}</span>${bindInput(`${P}.phones.${j}.label.${k}`, `aria-label="${t('br.phoneLabel', { lang: label })}"`)}</label>`).join('')}</div>
      <div class="line__ctl"><button class="iconbtn" type="button" data-list-move="${P}.phones" data-i="${j}" data-dir="-1" ${j === 0 ? 'disabled' : ''} aria-label="${t('ctl.up')}">${ICON.up}</button>
        <button class="iconbtn" type="button" data-list-del="${P}.phones" data-i="${j}" aria-label="${t('ctl.del')}">${ICON.x}</button></div>
    </div>`).join('')}
  </section>

  <section class="card">
    <div class="card__head"><div><h2>${t('br.rating')}</h2><p>${t('br.ratingLead')}</p></div></div>
    <div class="row">
      <label class="field"><span>${t('br.score')}</span><input class="input" data-rating="score" data-i="${i}" inputmode="decimal" value="${esc(rating.score ?? '')}"></label>
      <label class="field"><span>${t('br.count')}</span><input class="input" data-rating="count" data-i="${i}" inputmode="numeric" value="${esc(rating.count ?? '')}"></label>
    </div>
  </section>

  <section class="card card--danger">
    <div class="card__head"><div><h2>${t('br.delete')}</h2><p>${t('br.deleteLead')}</p></div>
      <button class="btn btn--danger btn--sm" type="button" id="delBranch">${t('br.delete')}</button></div>
  </section>`;
}
const mapEmbed = (b) => `https://maps.google.com/maps?q=${encodeURIComponent(`${b.lat},${b.lng}`)}&z=16&output=embed`;

// 구글맵 링크/좌표 문자열 → { lat, lng, url }. !3d!4d(장소 자체) > @(화면 중심) > q=/ll= > "lat, lng"
function parseMaps(text) {
  const s = text.trim();
  const num = '(-?\\d{1,3}\\.\\d+)';
  const pick = [new RegExp(`!3d${num}!4d${num}`), new RegExp(`@${num},${num}`), new RegExp(`[?&](?:q|query|ll|destination)=${num},\\s*${num}`), new RegExp(`^${num}\\s*,\\s*${num}$`)];
  for (const re of pick) { const m = s.match(re); if (m) return { lat: Number(m[1]), lng: Number(m[2]), url: /^https?:\/\//.test(s) ? s : null }; }
  return { lat: null, lng: null, url: /^https?:\/\//.test(s) ? s : null };
}

function wireBranch(i) {
  const P = `branches.branches.${i}`;
  const b = data.branches.branches[i];
  $('#mapsApply').onclick = () => {
    const r = parseMaps($('#mapsPaste').value);
    if (r.lat == null && !r.url) { toast(t('br.badMaps'), true); return; }
    if (r.url) setPath(`${P}.mapsUrl`, r.url);
    if (r.lat != null) { setPath(`${P}.lat`, r.lat); setPath(`${P}.lng`, r.lng); }
    changed(); renderMain();
    toast(r.lat != null ? t('br.mapsFilled') : t('br.mapsLinkOnly'), r.lat == null);
  };
  $$('[data-slot]').forEach((el) => { el.onclick = () => editSlot(i, Number(el.dataset.slot)); });
  $$('[data-add-slot]').forEach((el) => { el.onclick = () => editSlot(i, -1, el.dataset.addSlot); });
  $('#delBranch').onclick = () => {
    if (data.branches.branches.length <= 1) { toast(t('br.minOne'), true); return; }
    if (!confirm(t('br.delConfirm', { name: branchName(b) }))) return;
    data.branches.branches.splice(i, 1);
    changed(); go('b/0');
  };
}

function editSlot(bi, j, day) {
  const sched = data.branches.branches[bi].schedule;
  const isNew = j < 0;
  const draft = isNew ? { d: day, s: '16:00', e: '17:00', p: 'basic', note: '' } : { note: '', ...clone(sched[j]) };
  openDialog({
    title: isNew ? t('slot.add') : t('slot.edit'),
    draft,
    body: (d) => `
      <div class="field"><span class="label">${t('slot.day')}</span><div class="seg">${DAYS.map((k) => `<label><input type="radio" name="d" data-d="d" value="${k}" ${d.d === k ? 'checked' : ''}><span>${t(`day.${k}`)}</span></label>`).join('')}</div></div>
      <div class="row"><label class="field"><span>${t('slot.start')}</span>${dInput(d, 's', 'type="time" step="300" required')}</label>
        <label class="field"><span>${t('slot.end')}</span>${dInput(d, 'e', 'type="time" step="300" required')}</label></div>
      <div class="field"><span class="label">${t('slot.program')}</span><div class="seg seg--4">${Object.entries(PROGRAMS).map(([k, c]) => `<label><input type="radio" name="p" data-d="p" value="${k}" ${d.p === k ? 'checked' : ''}><span><i style="--c:${c}"></i>${progName(k)}</span></label>`).join('')}</div></div>
      <label class="field"><span>${t('slot.note')}</span>${dInput(d, 'note', `placeholder="${esc(t('slot.notePh'))}"`)}</label>`,
    onApply: (d) => {
      if (!TIME_RE.test(d.s) || !TIME_RE.test(d.e)) throw new Error(t('slot.badTime'));
      if (toMin(d.e) <= toMin(d.s)) throw new Error(t('slot.endAfter'));
      const slot = { d: d.d, s: d.s, e: d.e, p: d.p };
      if (d.note.trim()) slot.note = d.note.trim();
      if (isNew) sched.push(slot); else sched[j] = slot;
    },
    onDelete: isNew ? null : () => sched.splice(j, 1),
  });
}

function addBranch() {
  const list = data.branches.branches;
  let n = list.length + 1;
  while (list.some((b) => b.id === `branch${n}`)) n++;
  const first = list[0];
  list.push({
    id: `branch${n}`,
    name: { th: '', en: '', ko: t('side.newBranchName', {}, 'ko') }, area: { th: '', en: '', ko: '' }, address: { th: '', en: '', ko: '' },
    lat: first.lat, lng: first.lng, placeId: null,
    phones: [clone(first.phones[0])], rating: null, poster: first.poster, schedule: [],
  });
  changed(); go(`b/${list.length - 1}`);
  toast(t('br.created'));
}

/* ================= 페이지: 코치진·선수 ================= */
function pagePeople(key) {
  const list = data.team[key];
  return `<div class="page-head"><div><h1>${team(key, 'title')}</h1><p>${team(key, 'lead')} ${t('ppl.lead')}</p></div></div>
  <section class="card"><div class="people">
    ${list.map((p, i) => `<article class="person">
      <button class="person__photo" type="button" data-edit="${i}" aria-label="${esc(t('ppl.editAria', { name: pick(p.name) }))}">${imgTag(p.img, pick(p.name))}</button>
      <div class="person__body"><div class="person__name">${esc(pick(p.name))} ${p.gold ? `<span class="badge">${t('ppl.gold')}</span>` : ''}</div>
        <div class="person__role">${esc(p.role ? pick(p.role) : (p.items && p.items.ko ? (p.items[lang()] || [])[0] || p.items.ko[0] : '') || '')}</div></div>
      <div class="person__bar">
        <button class="iconbtn" type="button" data-move="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="${t('ctl.prev')}">${ICON.left}</button>
        <button class="btn btn--ghost btn--sm" type="button" data-edit="${i}">${t('ctl.edit')}</button>
        <button class="iconbtn" type="button" data-move="${i}" data-dir="1" ${i === list.length - 1 ? 'disabled' : ''} aria-label="${t('ctl.next')}">${ICON.right}</button>
      </div></article>`).join('')}
    <button class="add-tile" type="button" id="addPerson">${t('ppl.add', { one: team(key, 'one') })}</button>
  </div></section>`;
}
function wirePeople(key) {
  const list = data.team[key];
  $$('[data-edit]').forEach((el) => { el.onclick = () => editPerson(key, Number(el.dataset.edit)); });
  $$('[data-move]').forEach((el) => {
    el.onclick = () => {
      const i = Number(el.dataset.move), k = i + Number(el.dataset.dir);
      [list[i], list[k]] = [list[k], list[i]];
      changed(); renderMain();
    };
  });
  $('#addPerson').onclick = () => editPerson(key, -1);
}
const emptyTri = () => ({ th: '', en: '', ko: '' });
function editPerson(key, i) {
  const list = data.team[key];
  const isNew = i < 0;
  const tpl = { judges: { img: '', name: emptyTri(), role: emptyTri(), note: emptyTri() },
    staff: { img: '', tag: '', name: emptyTri(), role: emptyTri(), items: [] },
    athletes: { img: '', name: emptyTri(), gold: false, items: { th: [], en: [], ko: [] } } }[key];
  const draft = isNew ? tpl : { ...clone(tpl), ...clone(list[i]) };
  const lineTpl = JSON.stringify(emptyTri());
  openDialog({
    title: t(isNew ? 'ppl.dlgAdd' : 'ppl.dlgEdit', { one: team(key, 'one') }),
    draft,
    body: (d) => `
      <div class="field"><span class="label">${t('ppl.photo')}</span>
        ${imageField({ path: 'draft:img', value: d.img, kind: key, opts: { square: true, max: 600 } })}</div>
      <div class="field"><span class="label">${t('ppl.name')}</span>${dTri(d, 'name')}</div>
      ${d.role ? `<div class="field"><span class="label">${t('ppl.role')}</span>${dTri(d, 'role')}</div>` : ''}
      ${d.note ? `<div class="field"><span class="label">${t('ppl.note')}</span>${dTri(d, 'note')}</div>` : ''}
      ${key === 'staff' ? `<label class="field"><span>${t('ppl.tag')}</span>${dInput(d, 'tag', `placeholder="${esc(t('ppl.tagPh'))}"`)}</label>
        <div class="field"><span class="label">${t('ppl.career')}</span><div class="lines">${d.items.map((_, j) => `<div class="line">${dTri(d, `items.${j}`)}
          <div class="line__ctl"><button class="iconbtn" type="button" data-act="up" data-list="items" data-i="${j}" ${j === 0 ? 'disabled' : ''} aria-label="${t('ctl.up')}">${ICON.up}</button>
          <button class="iconbtn" type="button" data-act="del" data-list="items" data-i="${j}" aria-label="${t('ctl.del')}">${ICON.x}</button></div></div>`).join('')}</div>
          <button class="btn btn--ghost btn--sm" type="button" data-act="add" data-list="items" data-tpl='${lineTpl}' style="margin-top:10px">${t('ppl.addCareer')}</button></div>` : ''}
      ${key === 'athletes' ? `<label class="check"><input type="checkbox" data-d="gold" ${d.gold ? 'checked' : ''}> ${t('ppl.goldCheck')}</label>
        <div class="field"><span class="label">${t('ppl.careerLines')}</span><div class="tri">${LANGS.map(([k, label]) => `<label><span class="lang">${label}</span>
          <textarea class="input" data-d-lines="items.${k}" aria-label="${t('ppl.careerAria', { lang: label })}">${esc(d.items[k].join('\n'))}</textarea></label>`).join('')}</div></div>` : ''}`,
    onApply: (d) => {
      if (!d.img) throw new Error(t('ppl.needPhoto'));
      if (!d.name.ko.trim() && !d.name.th.trim()) throw new Error(t('ppl.needName'));
      if (key === 'staff') d.items = d.items.filter((x) => x.th || x.en || x.ko);
      if (isNew) list.push(d); else list[i] = d;
    },
    onDelete: isNew ? null : () => list.splice(i, 1),
  });
}

function pageTimeline() {
  const P = 'team.coach.timeline';
  const list = data.team.coach.timeline;
  return `<div class="page-head"><div><h1>${t('tl.title')}</h1><p>${t('tl.lead')}</p></div>
    <button class="btn btn--ghost btn--sm" type="button" data-list-add="${P}" data-tpl='{"y":"","th":"","en":"","ko":""}'>${t('tl.add')}</button></div>
  <section class="card"><div class="lines">${list.map((r, j) => `<div class="line line--year">
    <div>${bindInput(`${P}.${j}.y`, `placeholder="2019 / 2011–" aria-label="${t('tl.year')}"`)}
      <label class="check"><input type="checkbox" data-bind="${P}.${j}.now" ${r.now ? 'checked' : ''}> ${t('tl.now')}</label></div>
    ${triInputs(`${P}.${j}`)}
    <div class="line__ctl"><button class="iconbtn" type="button" data-list-move="${P}" data-i="${j}" data-dir="-1" ${j === 0 ? 'disabled' : ''} aria-label="${t('ctl.up')}">${ICON.up}</button>
      <button class="iconbtn" type="button" data-list-move="${P}" data-i="${j}" data-dir="1" ${j === list.length - 1 ? 'disabled' : ''} aria-label="${t('ctl.down')}">${ICON.down}</button>
      <button class="iconbtn" type="button" data-list-del="${P}" data-i="${j}" aria-label="${t('ctl.del')}">${ICON.x}</button></div>
  </div>`).join('')}</div></section>`;
}

/* ================= 페이지: 문의 채널 ================= */
function pageContact() {
  const c = data.contact;
  const channel = (key, name, urlHint) => `<section class="card">
    <div class="card__head"><div><h2>${name}</h2><p>${t('ct.pairLead')}</p></div>
      <a class="btn btn--ghost btn--sm" href="${esc(c[key].url)}" target="_blank" rel="noopener">${t('ct.open')}</a></div>
    <label class="field"><span>${t('ct.link', { name })}</span>${bindInput(`contact.${key}.url`, `placeholder="${urlHint}"`)}</label>
    <div class="field"><span class="label">${t('ct.qr')}</span>${imageField({ path: `contact.${key}.qr`, value: c[key].qr, kind: `${key}-qr`, variant: 'qr', title: t('ct.qrChange'), help: t('ct.qrHelp'), opts: { max: 800, type: 'image/png' } })}</div>
  </section>`;
  return `<div class="page-head"><div><h1>LINE · WhatsApp · Messenger</h1><p>${t('ct.lead')}</p></div></div>
    ${channel('line', 'LINE', 'https://line.me/ti/p/…')}
    ${channel('whatsapp', 'WhatsApp', 'https://wa.me/66…')}
    <section class="card"><div class="card__head"><div><h2>Facebook Messenger</h2></div>
      <a class="btn btn--ghost btn--sm" href="${esc(c.messenger.url)}" target="_blank" rel="noopener">${t('ct.open')}</a></div>
      <label class="field"><span>${t('ct.link', { name: 'Messenger' })}</span>${bindInput('contact.messenger.url', 'placeholder="https://m.me/…"')}</label></section>`;
}

/* ================= 페이지: SNS ================= */
function pageSocial() {
  const s = data.social;
  return `<div class="page-head"><div><h1>${t('sn.title')}</h1></div></div>
  <section class="card"><div class="card__head"><div><h2>${t('sn.ig')}</h2><p>${t('sn.igLead')}</p></div></div>
    <label class="field"><span>${t('sn.igField')}</span><textarea class="input" data-lines="social.instagram" data-ig>${esc(s.instagram.join('\n'))}</textarea></label>
    <p class="hint">${t('sn.igHint')}</p></section>
  <section class="card"><div class="card__head"><div><h2>${t('sn.reels')}</h2><p>${t('sn.reelsLead')}</p></div></div>
    <label class="field"><span>${t('sn.reelsField')}</span><textarea class="input" data-lines="social.reels" data-reel>${esc(s.reels.join('\n'))}</textarea></label></section>`;
}

/* ================= 라우팅·렌더 ================= */
function renderMain() {
  const main = $('#main');
  const [kind, arg] = route.split('/');
  let html = '', wire = () => {};
  if (kind === 'b') { html = pageBranch(Number(arg)); wire = () => wireBranch(Number(arg)); }
  else if (kind === 'team' && TEAM.includes(arg)) { html = pagePeople(arg); wire = () => wirePeople(arg); }
  else if (kind === 'team' && arg === 'timeline') html = pageTimeline();
  else if (kind === 'contact') html = pageContact();
  else if (kind === 'social') html = pageSocial();
  else html = `<div class="empty">${t('main.pick')}</div>`;
  const y = window.scrollY;
  main.innerHTML = html;
  wireDrops(main);
  try { wire(); } catch (e) { console.error(e); }
  window.scrollTo(0, y);
}
function go(r) { if (location.hash.slice(1) === r) onRoute(); else location.hash = r; }
function onRoute() {
  const h = location.hash.slice(1);
  const mobile = matchMedia('(max-width: 820px)').matches;
  route = h || (mobile ? '' : 'b/0');
  $('#app').classList.toggle('is-editing', Boolean(h));
  document.body.classList.toggle('is-editing', Boolean(h)); // 모바일 상단바의 ← 뒤로 버튼
  renderSide(); renderMain();
  if (h) window.scrollTo(0, 0);
}

// 입력칸 → data
let mapTimer = 0;
function onMainInput(e) {
  const el = e.target;
  if (el.dataset.bind) {
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.type === 'num') {
      const n = Number(v.trim());
      el.classList.toggle('is-bad', v.trim() === '' || !Number.isFinite(n));
      if (v.trim() === '' || !Number.isFinite(n)) return; // 숫자가 될 때까지 data 는 그대로
      v = n;
    } else if (el.dataset.type === 'opt') v = v.trim() || null;
    setPath(el.dataset.bind, v);
    if (/\.(lat|lng)$/.test(el.dataset.bind)) {
      clearTimeout(mapTimer);
      mapTimer = setTimeout(() => { const b = data.branches.branches[Number(route.split('/')[1])]; if ($('#mapPreview') && b) $('#mapPreview').src = mapEmbed(b); }, 600);
    }
    if (/\.name\.(ko|th|en)$/.test(el.dataset.bind) && route.startsWith('b/')) $('.page-head h1').textContent = branchName(data.branches.branches[Number(route.split('/')[1])]);
    changed();
  } else if (el.dataset.rating) {
    const b = data.branches.branches[Number(el.dataset.i)];
    const score = $('[data-rating="score"]').value.trim(), count = $('[data-rating="count"]').value.trim();
    const sOk = score === '' || (Number.isFinite(Number(score)) && Number(score) >= 0 && Number(score) <= 5);
    const cOk = count === '' || /^\d+$/.test(count);
    $('[data-rating="score"]').classList.toggle('is-bad', !sOk);
    $('[data-rating="count"]').classList.toggle('is-bad', !cOk);
    if (!sOk || !cOk) return;
    b.rating = score === '' && count === '' ? null : { score: Number(score || 0), count: Number(count || 0) };
    changed();
  } else if (el.dataset.lines) {
    let lines = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
    if (el.hasAttribute('data-ig')) lines = lines.map((s) => (s.match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel)\/([\w-]+)/) || [, s])[1]);
    if (el.hasAttribute('data-reel')) lines = lines.map((s) => (s.match(/(?:reel|videos?)\/(\d+)/) || [, s])[1]);
    setPath(el.dataset.lines, lines);
    changed();
  }
}
function onMainClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.listAdd) { getPath(btn.dataset.listAdd).push(JSON.parse(btn.dataset.tpl)); changed(); renderMain(); }
  else if (btn.dataset.listDel) {
    const list = getPath(btn.dataset.listDel);
    if (btn.dataset.listDel.endsWith('.phones') && list.length <= 1) { toast(t('br.phoneMin'), true); return; }
    list.splice(Number(btn.dataset.i), 1); changed(); renderMain();
  } else if (btn.dataset.listMove) {
    const list = getPath(btn.dataset.listMove), i = Number(btn.dataset.i), k = i + Number(btn.dataset.dir);
    if (k < 0 || k >= list.length) return;
    [list[i], list[k]] = [list[k], list[i]]; changed(); renderMain();
  }
}

/* ================= 저장 ================= */
function validate() {
  const ids = new Set();
  for (const b of data.branches.branches) {
    const nm = b.name[lang()] || b.name.ko || b.name.th || b.id;
    if (!b.name.th.trim() && !b.name.ko.trim()) return t('v.branchName', { id: b.id });
    if (ids.has(b.id)) return t('v.dupId', { id: b.id });
    ids.add(b.id);
    if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return t('v.latlng', { name: nm });
    if (!b.phones.length || b.phones.some((p) => !/^0\d{8,9}$/.test(p.number))) return t('v.phone', { name: nm });
    if (!b.poster) return t('v.poster', { name: nm });
  }
  for (const k of ['line', 'whatsapp', 'messenger']) if (!/^https:\/\//.test(data.contact[k].url)) return t('v.https', { k });
  return '';
}
// data 안에서 쓰이는 새 이미지만 올린다 (바꿨다 되돌린 이미지는 버린다)
function usedPending() {
  const text = JSON.stringify(data);
  return [...pending.keys()].filter((p) => text.includes(`"${p}"`));
}
async function save() {
  const keys = dirtyKeys();
  if (!keys.length) return;
  const bad = validate();
  if (bad) { toast(bad, true); return; }
  const btn = $('#saveBtn');
  btn.disabled = true; btn.textContent = t('save.saving');
  try {
    const imgs = usedPending();
    const files = [
      ...keys.map((k) => ({ path: FILES[k].path, text: `${JSON.stringify(data[k], null, 2)}\n` })),
      ...imgs.map((p) => ({ path: SITE_DIR + p, base64: pending.get(p).base64 })),
    ];
    await repo.commitFiles(files, `content: 관리자 페이지에서 ${keys.map((k) => fileLabel(k, 'ko')).join('·')} 수정${imgs.length ? ` (이미지 ${imgs.length}장)` : ''}`);
    keys.forEach((k) => { snap[k] = JSON.stringify(data[k]); });
    // 올린 이미지는 이제 레포에 있다 — 배포 전엔 사이트 경로가 404 라 imgTag 의 레포 원본 대체가 보여 준다
    imgs.forEach((p) => pending.delete(p));
    toast(t('save.done'));
    changed(); renderMain();
  } catch (e) {
    console.error(e);
    toast(e.status === 403 ? t('save.403') : e.status === 401 ? t('save.401') : t('save.fail', { msg: e.message }), true);
  } finally { btn.disabled = false; btn.textContent = t('save.save'); }
}
function discard() {
  if (!confirm(t('save.discardConfirm'))) return;
  Object.keys(FILES).forEach((k) => { data[k] = JSON.parse(snap[k]); });
  pending.clear();
  changed(); renderMain();
}

/* ================= 시작 ================= */
async function startApp(token) {
  repo = createRepo(token);
  $('#gate').hidden = true;
  $('#shell').hidden = false;
  try {
    await Promise.all(Object.entries(FILES).map(async ([k, f]) => { data[k] = await repo.readJson(f.path); snap[k] = JSON.stringify(data[k]); }));
  } catch (e) {
    if (e.status === 401) { auth.session.clear(); location.reload(); return; }
    $('#main').innerHTML = `<div class="empty">${esc(t('load.fail', { msg: e.message }))}</div>`;
    return;
  }
  $('#main').addEventListener('input', onMainInput);
  $('#main').addEventListener('change', onMainInput);
  $('#main').addEventListener('click', onMainClick);
  $('#saveBtn').onclick = save;
  $('#discardBtn').onclick = discard;
  $('#backBtn').onclick = () => { history.replaceState(null, '', location.pathname); onRoute(); };
  $('#logoutBtn').onclick = () => {
    if (dirtyKeys().length && !confirm(t('save.logoutConfirm'))) return;
    auth.session.clear(); location.hash = ''; location.reload();
  };
  window.addEventListener('beforeunload', (e) => { if (dirtyKeys().length) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('hashchange', onRoute);
  onRoute();
}

/* ---------- 로그인 화면 ---------- */
let authFile = null;
function gateSay(text, kind = 'err') { const m = $('#gateMsg'); m.textContent = text; m.className = `msg ${kind}`; }
let gateView = 'unlock';
// 제목·안내문만 (언어 전환 때 입력값·메시지는 그대로 두고 이것만 다시 쓴다)
function gateLabels() {
  const first = !authFile;
  const [title, lead] = gateView === 'setup' || first ? [first ? 'gate.setup' : 'gate.reset', first ? 'gate.setupLead' : 'gate.resetLead']
    : gateView === 'change' ? ['gate.change', null] : ['gate.login', null];
  $('#gateTitle').textContent = t(title);
  $('#gateLead').textContent = lead ? t(lead) : gateView === 'unlock' && !first ? 'Dragon Gym Taekwondo Phuket' : '';
}
function gateShow(view) {
  ['formUnlock', 'formSetup', 'formChange'].forEach((id) => { $(`#${id}`).hidden = true; });
  gateSay('', '');
  const first = !authFile;
  gateView = first ? 'setup' : view;
  gateLabels();
  if (gateView === 'setup') {
    $('#setupNav').hidden = first;
    $('#formSetup').hidden = false; $('#tok').focus();
  } else if (gateView === 'change') {
    $('#formChange').hidden = false; $('#opw').focus();
  } else {
    $('#formUnlock').hidden = false; $('#pw').focus();
  }
}
const gateRoute = () => gateShow({ '#change': 'change', '#reset': 'setup' }[location.hash] || 'unlock');
const busy = (form, on) => { $('button[type=submit]', form).disabled = on; };

$('#formUnlock').addEventListener('submit', async (e) => {
  e.preventDefault(); busy(e.target, true); gateSay(t('gate.checking'), 'ok');
  try {
    const token = await auth.decryptToken(authFile, $('#pw').value);
    auth.session.set(token, $('#remember').checked);
    window.removeEventListener('hashchange', gateRoute);
    history.replaceState(null, '', location.pathname);
    startApp(token);
  } catch (err) { gateSay(err.message); busy(e.target, false); }
});
$('#formSetup').addEventListener('submit', async (e) => {
  e.preventDefault(); busy(e.target, true); gateSay(t('gate.checkingToken'), 'ok');
  try {
    const token = $('#tok').value.trim();
    const pw = auth.checkNewPassword($('#npw1').value, $('#npw2').value);
    await auth.checkToken(token);
    gateSay(t('gate.encrypting'), 'ok');
    await auth.saveAuthFile(token, await auth.encryptToken(token, pw), authFile ? 'chore(admin): 관리자 비밀번호 재설정' : 'chore(admin): 관리자 비밀번호 초기 설정');
    auth.session.set(token, false);
    window.removeEventListener('hashchange', gateRoute);
    history.replaceState(null, '', location.pathname);
    startApp(token);
  } catch (err) { gateSay(err.message); busy(e.target, false); }
});
$('#formChange').addEventListener('submit', async (e) => {
  e.preventDefault(); busy(e.target, true); gateSay(t('gate.checking'), 'ok');
  try {
    const token = await auth.decryptToken(authFile, $('#opw').value);
    const pw = auth.checkNewPassword($('#cpw1').value, $('#cpw2').value);
    const next = await auth.encryptToken(token, pw);
    await auth.saveAuthFile(token, next, 'chore(admin): 관리자 비밀번호 변경');
    authFile = next; // 배포 반영 전에도 새 비밀번호로 열리게
    location.hash = ''; gateShow('unlock');
    gateSay(t('gate.changed'), 'ok');
  } catch (err) { gateSay(err.message); } finally { busy(e.target, false); }
});

// 언어 전환: 정적 문구는 i18n.applyStatic 이, 그려 놓은 화면은 여기서 다시 그린다 (편집 중인 data 는 그대로)
applyStatic();
onLangChange(() => {
  if (!$('#gate').hidden) gateLabels();
  if (data.branches) { refreshSavebar(); renderSide(); renderMain(); }
});

(async () => {
  const token = auth.session.get();
  if (token) { startApp(token); return; }
  $('#gate').hidden = false;
  window.addEventListener('hashchange', gateRoute);
  try { authFile = await auth.loadAuthFile(); gateRoute(); }
  catch (err) { gateShow('unlock'); gateSay(err.message); }
})();
