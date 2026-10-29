/* Dragon Gym 관리자 화면. 레이아웃은 tkd.reizwings.jp 관리자와 같은 "왼쪽 목록 + 오른쪽 카드 편집".
 * 편집은 메모리의 data 에만 반영하고, 아래 저장 바의 [저장] 한 번에 바뀐 JSON·새 이미지를 커밋 하나로 올린다.
 * 입력칸은 data-bind="파일.경로" 로 data 에 바로 묶는다 (예: branches.branches.0.name.ko). */
import { createRepo, REPO, BRANCH, SITE_DIR } from './repo.js';
import * as auth from './auth.js';

const FILES = {
  branches: { path: 'site/content/branches.json', label: '지점·시간표' },
  team: { path: 'site/content/team.json', label: '코치진·선수' },
  contact: { path: 'site/content/contact.json', label: '문의 채널' },
  social: { path: 'site/content/social.json', label: 'SNS' },
};
const DAYS = [['mon', '월'], ['tue', '화'], ['wed', '수'], ['thu', '목'], ['fri', '금'], ['sat', '토'], ['sun', '일']];
const PROGRAMS = {
  kids: { name: '키즈 스포츠', c: 'var(--p-kids)' },
  basic: { name: '기본반', c: 'var(--p-basic)' },
  acro: { name: '아크로바틱', c: 'var(--p-acro)' },
  athlete: { name: '선수반', c: 'var(--p-athlete)' },
};
const LANGS = [['th', 'ไทย'], ['en', 'EN'], ['ko', '한국어']];
const TEAM = {
  judges: { title: '승단 심사위원진', one: '심사위원', lead: '사이트의 "승단 심사위원진" 패널. 순서대로 표시됩니다.' },
  staff: { title: '코치진', one: '코치', lead: '사이트의 코치진 카드. 사진 위 배지와 경력 목록을 함께 보여줍니다.' },
  athletes: { title: '드래곤짐 출신 국가대표', one: '선수', lead: '대표 선수 목록. 금메달 강조를 켜면 금색 테두리가 붙습니다.' },
};
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
  $('#saveText').textContent = keys.length ? `저장 안 한 변경: ${keys.map((k) => FILES[k].label).join(', ')}` : '';
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
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 올릴 수 있습니다.');
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { throw new Error('읽을 수 없는 이미지입니다 (아이폰 HEIC 는 JPEG 로 바꿔 올려 주세요).'); }
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
function imageField({ path, value, kind, variant = '', title = '사진 바꾸기', help = '탭하거나 끌어다 놓기 · JPG/PNG/WebP', opts = {} }) {
  return `<div class="imgfield ${variant ? `imgfield--${variant}` : ''}">
    <div class="imgfield__preview">${imgTag(value) || '<span class="hint">사진 없음</span>'}${pending.has(value) ? '<span class="badge pending">저장 전</span>' : ''}</div>
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
    toast('사진을 바꿨습니다. [저장]을 눌러야 사이트에 반영됩니다.');
  } catch (e) { toast(e.message, true); }
}

/* ================= 다이얼로그 ================= */
// 초안(draft)을 편집하다 [적용] 하면 onApply(draft). 입력은 data-d="경로" 로 초안에 묶는다.
function openDialog({ title, draft, body, onApply, onDelete, applyLabel = '적용' }) {
  const dlg = $('#dlg'), form = $('#dlgForm');
  const dget = (p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), draft);
  const dset = (p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((o, k) => o[k], draft)[last] = v; };
  const paint = () => {
    form.innerHTML = `<div class="dlg__head"><h2>${esc(title)}</h2><button class="iconbtn" type="button" data-close aria-label="닫기">${ICON.x}</button></div>
      <div class="dlg__body">${body(draft, { dget })}</div>
      <div class="dlg__foot">${onDelete ? '<button class="btn btn--danger" type="button" data-del>삭제</button>' : ''}
        <button class="btn btn--ghost" type="button" data-close>취소</button><button class="btn btn--gold" type="submit">${esc(applyLabel)}</button></div>`;
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
    else if (t.hasAttribute('data-del')) { if (confirm('삭제할까요? [저장]을 눌러야 사이트에서 사라집니다.')) { onDelete(); dlg.close(); changed(); renderMain(); } }
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
function navItem(href, icon, title, meta, extra = '') {
  return `<li><a href="#${href}" class="${route === href ? 'is-active' : ''}"><span class="nav__icon">${icon}</span>
    <span class="nav__text"><span class="nav__title">${esc(title)} ${extra}</span><span class="nav__meta">${esc(meta)}</span></span></a></li>`;
}
function renderSide() {
  if (!data.branches) return;
  const b = data.branches.branches, t = data.team;
  const photo = (list) => (list[0] && list[0].img ? imgTag(list[0].img) : ICON.people);
  $('#side').innerHTML = `
    <h3>지점 · 시간표</h3>
    <ul class="nav">${b.map((x, i) => navItem(`b/${i}`, ICON.pin, x.name.ko || x.name.th || '새 지점', `수업 ${x.schedule.length}개`, x.main ? '<span class="badge">본관</span>' : '')).join('')}</ul>
    <button class="btn btn--ghost btn--sm btn--block" type="button" id="addBranch">＋ 새 지점</button>
    <h3>코치진 · 선수</h3>
    <ul class="nav">
      ${navItem('team/judges', photo(t.judges), TEAM.judges.title, `${t.judges.length}명`)}
      ${navItem('team/staff', photo(t.staff), TEAM.staff.title, `${t.staff.length}명`)}
      ${navItem('team/timeline', ICON.clock, '수석 코치 경력', `${t.coach.timeline.length}줄`)}
      ${navItem('team/athletes', photo(t.athletes), TEAM.athletes.title, `${t.athletes.length}명`)}
    </ul>
    <h3>문의 · SNS</h3>
    <ul class="nav">
      ${navItem('contact', data.contact.line.qr ? imgTag(data.contact.line.qr) : ICON.chat, 'LINE · WhatsApp · Messenger', '채팅 링크와 QR 코드')}
      ${navItem('social', ICON.insta, '인스타그램 · 페이스북 릴스', `게시물 ${data.social.instagram.length} · 릴스 ${data.social.reels.length}`)}
    </ul>`;
  $('#addBranch').onclick = addBranch;
}

/* ================= 페이지: 지점 ================= */
function pageBranch(i) {
  const b = data.branches.branches[i];
  if (!b) return '<div class="empty">지점을 찾을 수 없습니다.</div>';
  const P = `branches.branches.${i}`;
  const rating = b.rating || {};
  const byDay = (d) => b.schedule.map((s, j) => ({ ...s, j })).filter((s) => s.d === d).sort((a, c) => toMin(a.s) - toMin(c.s) || toMin(a.e) - toMin(c.e));
  return `
  <div class="page-head"><div><h1>${esc(b.name.ko || b.name.th || '새 지점')}</h1><p>지점 정보와 주간 시간표. 바꾼 뒤 아래 [저장]을 누르세요.</p></div></div>

  <section class="card">
    <div class="card__head"><div><h2>주간 시간표</h2><p>수업을 누르면 수정, 요일 아래 ＋ 로 추가. 사이트에서는 시작 시각 순으로 보입니다.</p></div></div>
    <div class="week">${DAYS.map(([d, label]) => `<div class="day"><div class="day__name">${label}</div>
      ${byDay(d).map((s) => `<button class="slot" type="button" style="--c:${PROGRAMS[s.p] ? PROGRAMS[s.p].c : 'var(--ink)'}" data-slot="${s.j}">
        <b>${esc(s.s)}–${esc(s.e)}</b>${esc(PROGRAMS[s.p] ? PROGRAMS[s.p].name : s.p)}${s.note ? `<br><small>${esc(s.note)}</small>` : ''}</button>`).join('')}
      <button class="day__add" type="button" data-add-slot="${d}">＋ 수업</button></div>`).join('')}</div>
    <div class="legend">${Object.values(PROGRAMS).map((p) => `<span><i style="--c:${p.c}"></i>${p.name}</span>`).join('')}</div>
  </section>

  <section class="card">
    <div class="card__head"><div><h2>시간표 포스터</h2><p>시간표 옆에 보이고 누르면 크게 열리는 세로 포스터</p></div></div>
    ${imageField({ path: `${P}.poster`, value: b.poster, kind: `poster-${b.id}`, variant: 'poster', title: '포스터 바꾸기', opts: { max: 1600 } })}
  </section>

  <section class="card">
    <div class="card__head"><div><h2>기본 정보</h2></div></div>
    <div class="field"><span class="label">지점 이름</span>${triInputs(`${P}.name`)}</div>
    <div class="field"><span class="label">지역</span>${triInputs(`${P}.area`)}</div>
    <label class="check"><input type="checkbox" data-bind="${P}.main" ${b.main ? 'checked' : ''}> 본관(메인 지점) 표시</label>
  </section>

  <section class="card">
    <div class="card__head"><div><h2>위치 · 구글맵</h2><p>구글맵 링크를 붙여 넣으면 좌표를 자동으로 채웁니다</p></div></div>
    <div class="field"><span class="label">주소</span>${triInputs(`${P}.address`)}</div>
    <div class="map">
      <div>
        <div class="field"><span class="label">구글맵 링크 붙여넣기</span>
          <div class="paste"><input class="input" id="mapsPaste" placeholder="https://www.google.com/maps/… 또는 7.88, 98.37"><button class="btn btn--ink" type="button" id="mapsApply">적용</button></div>
          <p class="hint">구글맵에서 장소를 연 뒤 주소창의 긴 주소를 복사하세요. 장소를 우클릭해 나오는 좌표 숫자도 됩니다.</p></div>
        <div class="row">
          <label class="field"><span>위도</span>${bindInput(`${P}.lat`, 'data-type="num" inputmode="decimal"')}</label>
          <label class="field"><span>경도</span>${bindInput(`${P}.lng`, 'data-type="num" inputmode="decimal"')}</label>
        </div>
        <label class="field"><span>'구글맵에서 열기' 링크 (선택)</span>${bindInput(`${P}.mapsUrl`, 'data-type="opt" placeholder="비우면 좌표로 엽니다"')}</label>
        <label class="field"><span>구글 place_id (선택)</span>${bindInput(`${P}.placeId`, 'data-type="opt" placeholder="ChIJ…"')}</label>
      </div>
      <iframe id="mapPreview" title="지도 미리보기" loading="lazy" src="${mapEmbed(b)}"></iframe>
    </div>
  </section>

  <section class="card">
    <div class="card__head"><div><h2>전화번호</h2><p>첫 번째 번호가 지점 카드의 [전화] 버튼이 됩니다</p></div>
      <button class="btn btn--ghost btn--sm" type="button" data-list-add="${P}.phones" data-tpl='{"number":"","label":{"th":"","en":"","ko":""}}'>＋ 번호 추가</button></div>
    ${b.phones.map((ph, j) => `<div class="phone">
      ${bindInput(`${P}.phones.${j}.number`, 'inputmode="tel" placeholder="0869515115" aria-label="번호"')}
      <div class="tri">${LANGS.map(([k, label]) => `<label><span class="lang">${label}</span>${bindInput(`${P}.phones.${j}.label.${k}`, `aria-label="이름 ${label}"`)}</label>`).join('')}</div>
      <div class="line__ctl"><button class="iconbtn" type="button" data-list-move="${P}.phones" data-i="${j}" data-dir="-1" ${j === 0 ? 'disabled' : ''} aria-label="위로">${ICON.up}</button>
        <button class="iconbtn" type="button" data-list-del="${P}.phones" data-i="${j}" aria-label="삭제">${ICON.x}</button></div>
    </div>`).join('')}
  </section>

  <section class="card">
    <div class="card__head"><div><h2>구글 평점</h2><p>구글맵 리뷰가 없으면 비워 두세요 (사이트에서 숨김)</p></div></div>
    <div class="row">
      <label class="field"><span>평점 (0~5)</span><input class="input" data-rating="score" data-i="${i}" inputmode="decimal" value="${esc(rating.score ?? '')}"></label>
      <label class="field"><span>리뷰 수</span><input class="input" data-rating="count" data-i="${i}" inputmode="numeric" value="${esc(rating.count ?? '')}"></label>
    </div>
  </section>

  <section class="card card--danger">
    <div class="card__head"><div><h2>지점 삭제</h2><p>이 지점과 시간표가 사이트에서 사라집니다</p></div>
      <button class="btn btn--danger btn--sm" type="button" id="delBranch">지점 삭제</button></div>
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
    if (r.lat == null && !r.url) { toast('구글맵 링크나 "위도, 경도" 형식이 아닙니다.', true); return; }
    if (r.url) setPath(`${P}.mapsUrl`, r.url);
    if (r.lat != null) { setPath(`${P}.lat`, r.lat); setPath(`${P}.lng`, r.lng); }
    changed(); renderMain();
    toast(r.lat != null ? '좌표와 링크를 채웠습니다. 지도 미리보기를 확인하세요.'
      : '링크만 넣었습니다. 짧은 링크(maps.app.goo.gl)는 좌표가 없어, 링크를 브라우저에서 연 뒤 주소창의 긴 주소를 붙여 넣으세요.', r.lat == null);
  };
  $$('[data-slot]').forEach((el) => { el.onclick = () => editSlot(i, Number(el.dataset.slot)); });
  $$('[data-add-slot]').forEach((el) => { el.onclick = () => editSlot(i, -1, el.dataset.addSlot); });
  $('#delBranch').onclick = () => {
    if (data.branches.branches.length <= 1) { toast('지점은 최소 1개가 있어야 합니다.', true); return; }
    if (!confirm(`'${b.name.ko || b.name.th}' 지점을 삭제할까요? [저장]을 눌러야 사이트에서 사라집니다.`)) return;
    data.branches.branches.splice(i, 1);
    changed(); go('b/0');
  };
}

function editSlot(bi, j, day) {
  const sched = data.branches.branches[bi].schedule;
  const isNew = j < 0;
  const draft = isNew ? { d: day, s: '16:00', e: '17:00', p: 'basic', note: '' } : { note: '', ...clone(sched[j]) };
  openDialog({
    title: isNew ? '수업 추가' : '수업 수정',
    draft,
    body: (d) => `
      <div class="field"><span class="label">요일</span><div class="seg">${DAYS.map(([k, l]) => `<label><input type="radio" name="d" data-d="d" value="${k}" ${d.d === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
      <div class="row"><label class="field"><span>시작</span>${dInput(d, 's', 'type="time" step="300" required')}</label>
        <label class="field"><span>종료</span>${dInput(d, 'e', 'type="time" step="300" required')}</label></div>
      <div class="field"><span class="label">프로그램</span><div class="seg seg--4">${Object.entries(PROGRAMS).map(([k, p]) => `<label><input type="radio" name="p" data-d="p" value="${k}" ${d.p === k ? 'checked' : ''}><span><i style="--c:${p.c}"></i>${p.name}</span></label>`).join('')}</div></div>
      <label class="field"><span>메모 (선택)</span>${dInput(d, 'note', 'placeholder="예: 3–5 y, Lv 1–2 — 모든 언어에 그대로 표시"')}</label>`,
    onApply: (d) => {
      if (!TIME_RE.test(d.s) || !TIME_RE.test(d.e)) throw new Error('시각을 HH:MM 으로 입력하세요.');
      if (toMin(d.e) <= toMin(d.s)) throw new Error('종료 시각이 시작보다 늦어야 합니다.');
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
    name: { th: '', en: '', ko: '새 지점' }, area: { th: '', en: '', ko: '' }, address: { th: '', en: '', ko: '' },
    lat: first.lat, lng: first.lng, placeId: null,
    phones: [clone(first.phones[0])], rating: null, poster: first.poster, schedule: [],
  });
  changed(); go(`b/${list.length - 1}`);
  toast('새 지점을 만들었습니다. 이름·주소·좌표·포스터를 채운 뒤 저장하세요.');
}

/* ================= 페이지: 코치진·선수 ================= */
function pagePeople(key) {
  const meta = TEAM[key], list = data.team[key];
  return `<div class="page-head"><div><h1>${meta.title}</h1><p>${meta.lead} 사진이나 [수정]을 누르면 편집합니다.</p></div></div>
  <section class="card"><div class="people">
    ${list.map((p, i) => `<article class="person">
      <button class="person__photo" type="button" data-edit="${i}" aria-label="${esc(p.name.ko)} 수정">${imgTag(p.img, p.name.ko)}</button>
      <div class="person__body"><div class="person__name">${esc(p.name.ko || p.name.en)} ${p.gold ? '<span class="badge">금메달</span>' : ''}</div>
        <div class="person__role">${esc(p.role ? p.role.ko : (p.items && p.items.ko ? p.items.ko[0] : '') || '')}</div></div>
      <div class="person__bar">
        <button class="iconbtn" type="button" data-move="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="앞으로">${ICON.left}</button>
        <button class="btn btn--ghost btn--sm" type="button" data-edit="${i}">수정</button>
        <button class="iconbtn" type="button" data-move="${i}" data-dir="1" ${i === list.length - 1 ? 'disabled' : ''} aria-label="뒤로">${ICON.right}</button>
      </div></article>`).join('')}
    <button class="add-tile" type="button" id="addPerson">＋ ${meta.one} 추가</button>
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
    title: `${TEAM[key].one} ${isNew ? '추가' : '수정'}`,
    draft,
    body: (d) => `
      <div class="field"><span class="label">사진 (가운데를 정사각형으로 자릅니다)</span>
        ${imageField({ path: 'draft:img', value: d.img, kind: key, opts: { square: true, max: 600 } })}</div>
      <div class="field"><span class="label">이름</span>${dTri(d, 'name')}</div>
      ${d.role ? `<div class="field"><span class="label">직함</span>${dTri(d, 'role')}</div>` : ''}
      ${d.note ? `<div class="field"><span class="label">한 줄 소개</span>${dTri(d, 'note')}</div>` : ''}
      ${key === 'staff' ? `<label class="field"><span>사진 위 배지 (선택)</span>${dInput(d, 'tag', 'placeholder="예: 7th DAN"')}</label>
        <div class="field"><span class="label">경력</span><div class="lines">${d.items.map((_, j) => `<div class="line">${dTri(d, `items.${j}`)}
          <div class="line__ctl"><button class="iconbtn" type="button" data-act="up" data-list="items" data-i="${j}" ${j === 0 ? 'disabled' : ''} aria-label="위로">${ICON.up}</button>
          <button class="iconbtn" type="button" data-act="del" data-list="items" data-i="${j}" aria-label="삭제">${ICON.x}</button></div></div>`).join('')}</div>
          <button class="btn btn--ghost btn--sm" type="button" data-act="add" data-list="items" data-tpl='${lineTpl}' style="margin-top:10px">＋ 경력 추가</button></div>` : ''}
      ${key === 'athletes' ? `<label class="check"><input type="checkbox" data-d="gold" ${d.gold ? 'checked' : ''}> 금메달 강조 (금색 테두리)</label>
        <div class="field"><span class="label">경력 — 한 줄에 하나씩</span><div class="tri">${LANGS.map(([k, label]) => `<label><span class="lang">${label}</span>
          <textarea class="input" data-d-lines="items.${k}" aria-label="경력 ${label}">${esc(d.items[k].join('\n'))}</textarea></label>`).join('')}</div></div>` : ''}`,
    onApply: (d) => {
      if (!d.img) throw new Error('사진을 올려 주세요.');
      if (!d.name.ko.trim() && !d.name.th.trim()) throw new Error('이름(한국어 또는 태국어)을 입력하세요.');
      if (key === 'staff') d.items = d.items.filter((x) => x.th || x.en || x.ko);
      if (isNew) list.push(d); else list[i] = d;
    },
    onDelete: isNew ? null : () => list.splice(i, 1),
  });
}

function pageTimeline() {
  const P = 'team.coach.timeline';
  const list = data.team.coach.timeline;
  return `<div class="page-head"><div><h1>수석 코치 경력</h1><p>사이트 코치진 섹션 왼쪽의 연도별 타임라인. 위에서 아래 순서로 표시됩니다.</p></div>
    <button class="btn btn--ghost btn--sm" type="button" data-list-add="${P}" data-tpl='{"y":"","th":"","en":"","ko":""}'>＋ 경력 추가</button></div>
  <section class="card"><div class="lines">${list.map((r, j) => `<div class="line line--year">
    <div>${bindInput(`${P}.${j}.y`, 'placeholder="2019 / 2011–" aria-label="연도"')}
      <label class="check"><input type="checkbox" data-bind="${P}.${j}.now" ${r.now ? 'checked' : ''}> 현재</label></div>
    ${triInputs(`${P}.${j}`)}
    <div class="line__ctl"><button class="iconbtn" type="button" data-list-move="${P}" data-i="${j}" data-dir="-1" ${j === 0 ? 'disabled' : ''} aria-label="위로">${ICON.up}</button>
      <button class="iconbtn" type="button" data-list-move="${P}" data-i="${j}" data-dir="1" ${j === list.length - 1 ? 'disabled' : ''} aria-label="아래로">${ICON.down}</button>
      <button class="iconbtn" type="button" data-list-del="${P}" data-i="${j}" aria-label="삭제">${ICON.x}</button></div>
  </div>`).join('')}</div></section>`;
}

/* ================= 페이지: 문의 채널 ================= */
function pageContact() {
  const c = data.contact;
  const channel = (key, name, urlHint) => `<section class="card">
    <div class="card__head"><div><h2>${name}</h2><p>링크와 QR 은 같은 계정이어야 합니다 — 하나를 바꾸면 다른 하나도 바꾸세요</p></div>
      <a class="btn btn--ghost btn--sm" href="${esc(c[key].url)}" target="_blank" rel="noopener">링크 열어보기</a></div>
    <label class="field"><span>${name} 링크</span>${bindInput(`contact.${key}.url`, `placeholder="${urlHint}"`)}</label>
    <div class="field"><span class="label">QR 코드</span>${imageField({ path: `contact.${key}.qr`, value: c[key].qr, kind: `${key}-qr`, variant: 'qr', title: 'QR 바꾸기', help: 'QR 이 선명하게 보이는 정사각형 이미지', opts: { max: 800, type: 'image/png' } })}</div>
  </section>`;
  return `<div class="page-head"><div><h1>LINE · WhatsApp · Messenger</h1><p>체험 문의 섹션의 채팅 버튼·QR, 하단 링크, 화면 오른쪽 아래 떠 있는 버튼에 함께 반영됩니다.</p></div></div>
    ${channel('line', 'LINE', 'https://line.me/ti/p/…')}
    ${channel('whatsapp', 'WhatsApp', 'https://wa.me/66…')}
    <section class="card"><div class="card__head"><div><h2>Facebook Messenger</h2></div>
      <a class="btn btn--ghost btn--sm" href="${esc(c.messenger.url)}" target="_blank" rel="noopener">링크 열어보기</a></div>
      <label class="field"><span>Messenger 링크</span>${bindInput('contact.messenger.url', 'placeholder="https://m.me/…"')}</label></section>`;
}

/* ================= 페이지: SNS ================= */
function pageSocial() {
  const s = data.social;
  return `<div class="page-head"><div><h1>인스타그램 · 페이스북 릴스</h1></div></div>
  <section class="card"><div class="card__head"><div><h2>인스타그램 게시물</h2><p>최신이 위. 앞 3개가 사이트에 보입니다.</p></div></div>
    <label class="field"><span>게시물 주소 또는 코드 — 한 줄에 하나</span><textarea class="input" data-lines="social.instagram" data-ig>${esc(s.instagram.join('\n'))}</textarea></label>
    <p class="hint">instagram.com/p/<b>코드</b>/ 주소를 통째로 붙여 넣어도 코드만 저장됩니다.</p></section>
  <section class="card"><div class="card__head"><div><h2>페이스북 릴스 ID (예비)</h2><p>페이스북 자동 수집이 실패했을 때만 쓰이는 목록입니다.</p></div></div>
    <label class="field"><span>릴스 주소 또는 숫자 ID — 한 줄에 하나</span><textarea class="input" data-lines="social.reels" data-reel>${esc(s.reels.join('\n'))}</textarea></label></section>`;
}

/* ================= 라우팅·렌더 ================= */
function renderMain() {
  const main = $('#main');
  const [kind, arg] = route.split('/');
  let html = '', wire = () => {};
  if (kind === 'b') { html = pageBranch(Number(arg)); wire = () => wireBranch(Number(arg)); }
  else if (kind === 'team' && TEAM[arg]) { html = pagePeople(arg); wire = () => wirePeople(arg); }
  else if (kind === 'team' && arg === 'timeline') html = pageTimeline();
  else if (kind === 'contact') html = pageContact();
  else if (kind === 'social') html = pageSocial();
  else html = '<div class="empty">왼쪽에서 편집할 항목을 고르세요.</div>';
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
    if (/\.name\.(ko|th)$/.test(el.dataset.bind) && route.startsWith('b/')) $('.page-head h1').textContent = getPath(el.dataset.bind.replace(/\.(ko|th)$/, '.ko')) || '새 지점';
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
    if (btn.dataset.listDel.endsWith('.phones') && list.length <= 1) { toast('전화번호는 최소 1개가 있어야 합니다.', true); return; }
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
    const nm = b.name.ko || b.name.th || b.id;
    if (!b.name.th.trim() && !b.name.ko.trim()) return `지점 이름을 입력하세요 (${b.id}).`;
    if (ids.has(b.id)) return `지점 ID 가 겹칩니다: ${b.id}`;
    ids.add(b.id);
    if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return `${nm}: 위도·경도를 확인하세요.`;
    if (!b.phones.length || b.phones.some((p) => !/^0\d{8,9}$/.test(p.number))) return `${nm}: 전화번호는 0 으로 시작하는 9~10자리 숫자로 입력하세요.`;
    if (!b.poster) return `${nm}: 시간표 포스터를 올려 주세요.`;
  }
  for (const k of ['line', 'whatsapp', 'messenger']) if (!/^https:\/\//.test(data.contact[k].url)) return `${k} 링크는 https:// 로 시작해야 합니다.`;
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
  btn.disabled = true; btn.textContent = '저장 중…';
  try {
    const imgs = usedPending();
    const files = [
      ...keys.map((k) => ({ path: FILES[k].path, text: `${JSON.stringify(data[k], null, 2)}\n` })),
      ...imgs.map((p) => ({ path: SITE_DIR + p, base64: pending.get(p).base64 })),
    ];
    await repo.commitFiles(files, `content: 관리자 페이지에서 ${keys.map((k) => FILES[k].label).join('·')} 수정${imgs.length ? ` (이미지 ${imgs.length}장)` : ''}`);
    keys.forEach((k) => { snap[k] = JSON.stringify(data[k]); });
    // 올린 이미지는 이제 레포에 있다 — 배포 전엔 사이트 경로가 404 라 imgTag 의 레포 원본 대체가 보여 준다
    imgs.forEach((p) => pending.delete(p));
    toast('저장했습니다. 1~2분 뒤 사이트에 반영됩니다.');
    changed(); renderMain();
  } catch (e) {
    console.error(e);
    toast(e.status === 403 ? '토큰에 쓰기 권한이 없습니다. GitHub 토큰의 Contents 권한을 "Read and write" 로 바꿔 주세요.'
      : e.status === 401 ? '토큰이 만료되었습니다. 로그아웃 후 "비밀번호를 잊었어요"에서 새 토큰으로 재설정하세요.'
        : `저장하지 못했습니다: ${e.message}`, true);
  } finally { btn.disabled = false; btn.textContent = '저장'; }
}
function discard() {
  if (!confirm('저장하지 않은 변경을 모두 되돌릴까요?')) return;
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
    $('#main').innerHTML = `<div class="empty">데이터를 불러오지 못했습니다: ${esc(e.message)}</div>`;
    return;
  }
  $('#main').addEventListener('input', onMainInput);
  $('#main').addEventListener('change', onMainInput);
  $('#main').addEventListener('click', onMainClick);
  $('#saveBtn').onclick = save;
  $('#discardBtn').onclick = discard;
  $('#backBtn').onclick = () => { history.replaceState(null, '', location.pathname); onRoute(); };
  $('#logoutBtn').onclick = () => {
    if (dirtyKeys().length && !confirm('저장하지 않은 변경이 있습니다. 로그아웃할까요?')) return;
    auth.session.clear(); location.hash = ''; location.reload();
  };
  window.addEventListener('beforeunload', (e) => { if (dirtyKeys().length) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('hashchange', onRoute);
  onRoute();
}

/* ---------- 로그인 화면 ---------- */
let authFile = null;
function gateSay(text, kind = 'err') { const m = $('#gateMsg'); m.textContent = text; m.className = `msg ${kind}`; }
function gateShow(view) {
  ['formUnlock', 'formSetup', 'formChange'].forEach((id) => { $(`#${id}`).hidden = true; });
  gateSay('', '');
  const first = !authFile;
  if (view === 'setup' || first) {
    $('#gateTitle').textContent = first ? '관리자 초기 설정' : '비밀번호 재설정';
    $('#gateLead').textContent = first ? 'GitHub 토큰을 한 번 입력하고 관리자 비밀번호를 정하세요. 토큰은 비밀번호로 암호화되어 레포에 저장됩니다.'
      : '레포 쓰기 권한이 있는 GitHub 토큰으로 새 비밀번호를 정합니다.';
    $('#setupNav').hidden = first;
    $('#formSetup').hidden = false; $('#tok').focus();
  } else if (view === 'change') {
    $('#gateTitle').textContent = '비밀번호 변경'; $('#gateLead').textContent = '';
    $('#formChange').hidden = false; $('#opw').focus();
  } else {
    $('#gateTitle').textContent = '관리자 로그인'; $('#gateLead').textContent = 'Dragon Gym Taekwondo Phuket';
    $('#formUnlock').hidden = false; $('#pw').focus();
  }
}
const gateRoute = () => gateShow({ '#change': 'change', '#reset': 'setup' }[location.hash] || 'unlock');
const busy = (form, on) => { $('button[type=submit]', form).disabled = on; };

$('#formUnlock').addEventListener('submit', async (e) => {
  e.preventDefault(); busy(e.target, true); gateSay('확인 중…', 'ok');
  try {
    const token = await auth.decryptToken(authFile, $('#pw').value);
    auth.session.set(token, $('#remember').checked);
    window.removeEventListener('hashchange', gateRoute);
    history.replaceState(null, '', location.pathname);
    startApp(token);
  } catch (err) { gateSay(err.message); busy(e.target, false); }
});
$('#formSetup').addEventListener('submit', async (e) => {
  e.preventDefault(); busy(e.target, true); gateSay('토큰 확인 중…', 'ok');
  try {
    const token = $('#tok').value.trim();
    const pw = auth.checkNewPassword($('#npw1').value, $('#npw2').value);
    await auth.checkToken(token);
    gateSay('암호화해서 레포에 저장 중…', 'ok');
    await auth.saveAuthFile(token, await auth.encryptToken(token, pw), authFile ? 'chore(admin): 관리자 비밀번호 재설정' : 'chore(admin): 관리자 비밀번호 초기 설정');
    auth.session.set(token, false);
    window.removeEventListener('hashchange', gateRoute);
    history.replaceState(null, '', location.pathname);
    startApp(token);
  } catch (err) { gateSay(err.message); busy(e.target, false); }
});
$('#formChange').addEventListener('submit', async (e) => {
  e.preventDefault(); busy(e.target, true); gateSay('확인 중…', 'ok');
  try {
    const token = await auth.decryptToken(authFile, $('#opw').value);
    const pw = auth.checkNewPassword($('#cpw1').value, $('#cpw2').value);
    const next = await auth.encryptToken(token, pw);
    await auth.saveAuthFile(token, next, 'chore(admin): 관리자 비밀번호 변경');
    authFile = next; // 배포 반영 전에도 새 비밀번호로 열리게
    location.hash = ''; gateShow('unlock');
    gateSay('비밀번호를 바꿨습니다. 새 비밀번호로 로그인하세요.', 'ok');
  } catch (err) { gateSay(err.message); } finally { busy(e.target, false); }
});

(async () => {
  const token = auth.session.get();
  if (token) { startApp(token); return; }
  $('#gate').hidden = false;
  window.addEventListener('hashchange', gateRoute);
  try { authFile = await auth.loadAuthFile(); gateRoute(); }
  catch (err) { gateShow('unlock'); gateSay(err.message); }
})();
