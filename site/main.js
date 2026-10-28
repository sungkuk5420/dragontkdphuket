/* Dragon Gym Taekwondo Phuket — 인터랙션
 * 외부 라이브러리(GSAP/ScrollTrigger/Lenis/Leaflet)는 CDN 에서 defer 로 받는다. 하나라도 못 받으면
 * 해당 효과만 빼고 내용은 전부 읽히도록 분기한다. 데이터는 data.js 의 window.DGT.
 */
(() => {
  'use strict';
  const D = window.DGT;
  if (!D) { console.error('[DGT] data.js 가 로드되지 않았습니다'); return; }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined';
  const hasST = hasGsap && typeof window.ScrollTrigger !== 'undefined';
  if (hasST) gsap.registerPlugin(ScrollTrigger);
  if (reduceMotion || !hasGsap) document.documentElement.classList.add('no-motion');

  /* ---------- 언어: 기본 태국어, 버튼·?lang= 으로 en/ko ---------- */
  const LANGS = ['th', 'en', 'ko'];
  const BASE = 'th'; // HTML 원문 언어. 다른 언어는 data.js 사전으로 치환
  let lang = BASE;
  try { const s = localStorage.getItem('dgt-lang'); if (LANGS.includes(s)) lang = s; } catch { /* 저장소 차단 환경 */ }
  const qLang = new URLSearchParams(location.search).get('lang'); // ?lang=ko 공유 링크용
  if (LANGS.includes(qLang)) lang = qLang;
  const t = (key) => (D.i18n[lang] && D.i18n[lang][key]) ?? D.i18n[BASE][key] ?? key;
  const L = (obj) => (obj && typeof obj === 'object' ? (obj[lang] ?? obj[BASE] ?? obj.en) : obj);

  function applyLang() {
    document.documentElement.lang = lang;
    const dict = D.i18n[lang] || {};
    $$('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (el.dataset.i18nOrig === undefined) el.dataset.i18nOrig = el.innerHTML;
      if (lang === BASE || dict[key] === undefined) el.innerHTML = el.dataset.i18nOrig;
      else el.textContent = dict[key];
    });
    $$('[data-i18n-ph]').forEach((el) => {
      const key = el.dataset.i18nPh;
      if (el.dataset.i18nOrig === undefined) el.dataset.i18nOrig = el.placeholder;
      el.placeholder = (lang !== BASE && dict[key]) || el.dataset.i18nOrig;
    });
    $$('[data-set-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)));
    // 언어 의존 렌더링 재실행
    renderBranches(); renderSchedule(); renderTrialOptions(); renderFooterBranches(); renderFeed(); renderFeedUpdated(); renderTeam();
  }
  // 주소창을 현재 언어와 맞춘다: 태국어(기본)는 파라미터 없이, en/ko 는 ?lang= 을 붙여 그대로 공유 가능하게
  function syncLangUrl() {
    const url = new URL(location.href);
    if (lang === BASE) url.searchParams.delete('lang');
    else url.searchParams.set('lang', lang);
    if (url.href !== location.href) history.replaceState(history.state, '', url);
  }
  $$('[data-set-lang]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.setLang === lang) return;
    lang = b.dataset.setLang;
    try { localStorage.setItem('dgt-lang', lang); } catch { /* 무시 */ }
    applyLang();
    syncLangUrl();
  }));

  /* ---------- 태국 시간 ---------- */
  function bangkokNow() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: D.timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
    const wd = get('weekday').toLowerCase().slice(0, 3);
    const h = Number(get('hour')) % 24, m = Number(get('minute'));
    return { day: DAYS.includes(wd) ? wd : 'mon', minutes: h * 60 + m };
  }
  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

  /* 지점별 요일 영업시간 (시간표에서 유도) */
  function hoursFor(branch, day) {
    const slots = branch.schedule.filter((s) => s.d === day);
    if (!slots.length) return null;
    const open = slots.reduce((a, s) => (toMin(s.s) < toMin(a) ? s.s : a), slots[0].s);
    const close = slots.reduce((a, s) => (toMin(s.e) > toMin(a) ? s.e : a), slots[0].e);
    return { open, close };
  }
  const fmtPhone = (n) => n.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3');
  const telHref = (n) => 'tel:+66' + n.replace(/^0/, '');

  /* ---------- 내비 ---------- */
  const nav = $('#nav'), burger = $('#burger'), navLinks = $('#navLinks');
  const onScrollNav = () => nav.classList.toggle('is-solid', window.scrollY > 40);
  onScrollNav();
  window.addEventListener('scroll', onScrollNav, { passive: true });
  burger?.addEventListener('click', () => {
    const open = navLinks.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  $$('a', navLinks).forEach((a) => a.addEventListener('click', () => { navLinks.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); }));
  // 보이는 섹션에 따라 활성 링크
  const sectionIds = $$('a[href^="#"]', navLinks).map((a) => a.getAttribute('href').slice(1));
  const activeIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      $$('a', navLinks).forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sectionIds.forEach((id) => { const el = document.getElementById(id); if (el) activeIO.observe(el); });

  /* ---------- 진행바 ---------- */
  const progress = $('.progress span');
  const onProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
  };
  onProgress();
  window.addEventListener('scroll', onProgress, { passive: true });

  /* ---------- 커스텀 커서 + 마그네틱 ---------- */
  if (finePointer && !reduceMotion) {
    const cursor = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring');
    let mx = -100, my = -100, rx = -100, ry = -100;
    window.addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`; }, { passive: true });
    const loop = () => { rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18; ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`; requestAnimationFrame(loop); };
    loop();
    document.addEventListener('pointerover', (e) => { if (e.target.closest('a, button, [data-tilt], .slot')) document.body.classList.add('is-hovering'); });
    document.addEventListener('pointerout', (e) => { if (e.target.closest('a, button, [data-tilt], .slot')) document.body.classList.remove('is-hovering'); });
    cursor.style.display = 'block';

    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.25, dy = (e.clientY - (r.top + r.height / 2)) * 0.35;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- 히어로 파티클 캔버스 ---------- */
  (function heroCanvas() {
    const cv = $('#heroCanvas');
    if (!cv || reduceMotion) return;
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, pts = [], px = -1e4, py = -1e4, raf = 0, running = true;
    const resize = () => {
      const r = cv.parentElement.getBoundingClientRect();
      w = cv.width = Math.floor(r.width * Math.min(devicePixelRatio, 2)); h = cv.height = Math.floor(r.height * Math.min(devicePixelRatio, 2));
      const n = Math.min(140, Math.floor((r.width * r.height) / 9000));
      pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .35, vy: -Math.random() * .5 - .15, r: Math.random() * 2.2 + .6, a: Math.random() * .6 + .2 }));
    };
    resize();
    window.addEventListener('resize', resize);
    cv.parentElement.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); px = (e.clientX - r.left) * (w / r.width); py = (e.clientY - r.top) * (h / r.height); });
    cv.parentElement.addEventListener('pointerleave', () => { px = py = -1e4; });
    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        const dx = p.x - px, dy = p.y - py, d2 = dx * dx + dy * dy;
        if (d2 < 160 * 160 * (w / 1400)) { const f = 1 - Math.sqrt(d2) / (160 * Math.sqrt(w / 1400)); p.vx += (dx / Math.sqrt(d2 || 1)) * f * .9; p.vy += (dy / Math.sqrt(d2 || 1)) * f * .9; }
        p.vx *= .985; p.vy = p.vy * .985 - .004;
        p.x += p.vx; p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; p.vy = -Math.random() * .5 - .15; }
        if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * devicePixelRatio, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(244, 180, 0, ${p.a})`; ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    // 히어로가 화면 밖이면 멈춘다
    new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running && !raf) draw(); if (!running) { cancelAnimationFrame(raf); raf = 0; } }).observe(cv);
  })();

  /* ---------- 히어로 인트로 + 패럴랙스 + 카운터 ---------- */
  $$('.hero__line').forEach((line) => { const s = document.createElement('span'); s.innerHTML = line.innerHTML; line.innerHTML = ''; line.appendChild(s); });
  if (hasGsap && !reduceMotion) {
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.from('.stroke', { scaleX: 0, duration: 1.1, stagger: .12, ease: 'expo.out' }, 0)
      .from('.hero__kicker', { y: 20, opacity: 0, duration: .6 }, .3)
      .from('.hero__line > span', { yPercent: 110, duration: .9, stagger: .1 }, .35)
      .from('.hero__thai, .hero__lead, .hero__cta', { y: 24, opacity: 0, duration: .7, stagger: .08 }, .8)
      .from('.stats li', { y: 20, opacity: 0, duration: .6, stagger: .08 }, 1)
      .from('.hero__dragon', { xPercent: 20, opacity: 0, duration: 1.6, ease: 'expo.out' }, .2);
    const dragon = $('.hero__dragon');
    $('#hero').addEventListener('pointermove', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      gsap.to(dragon, { x: x * -40, y: y * -30 - 0, duration: .8, ease: 'power2.out' });
      gsap.to('.stroke--1', { x: x * 24, y: y * 14, duration: 1, ease: 'power2.out' });
      gsap.to('.stroke--2', { x: x * -30, y: y * -16, duration: 1, ease: 'power2.out' });
    });
  }
  // 숫자 카운터 (GSAP 없으면 즉시 표시)
  $$('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count), suffix = el.dataset.suffix || '';
    const set = (v) => { el.textContent = Math.round(v) + suffix; };
    if (!hasGsap || reduceMotion) { set(target); return; }
    const obj = { v: 0 };
    gsap.to(obj, { v: target, duration: 1.4, delay: 1.1, ease: 'power3.out', onUpdate: () => set(obj.v) });
  });

  /* ---------- 스크롤 리빌 ---------- */
  if (hasST && !reduceMotion) {
    $$('[data-reveal]').forEach((el) => gsap.to(el, { opacity: 1, y: 0, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true } }));
    $$('[data-reveal-group]').forEach((g) => gsap.to(g.children, { opacity: 1, y: 0, duration: .7, stagger: .09, ease: 'back.out(1.4)', scrollTrigger: { trigger: g, start: 'top 85%', once: true } }));
  } else {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-revealed'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
    $$('[data-reveal], [data-reveal-group] > *').forEach((el) => io.observe(el));
  }

  /* ---------- 카드 3D 틸트 ---------- */
  if (finePointer && !reduceMotion) {
    $$('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        card.style.transform = `rotateX(${(-y * 10).toFixed(2)}deg) rotateY(${(x * 12).toFixed(2)}deg) translateY(-6px)`;
        card.style.boxShadow = `${8 - x * 10}px ${8 + y * 10}px 0 var(--black)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; card.style.boxShadow = ''; });
    });
  }

  /* ---------- 지점 + 지도 ---------- */
  let activeBranch = D.branches[0].id;
  let overview = null, markers = {};
  const branchById = (id) => D.branches.find((b) => b.id === id);
  // placeId 가 없는 지점(몰 안 도장 등)은 장소 검색어로 연다
  const mapsOpenUrl = (b) => b.mapsUrl || (b.placeId
    ? `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}&query_place_id=${b.placeId}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.mapsQuery || `${b.lat},${b.lng}`)}`);
  const mapsDirUrl = (b) => `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}${b.placeId ? `&destination_place_id=${b.placeId}` : ''}`;
  const embedUrl = (b) => `https://maps.google.com/maps?q=${b.lat},${b.lng}&z=16&hl=${lang}&output=embed`; // hl 은 th/en/ko 모두 지원

  function renderBranches() {
    const list = $('#branchList');
    if (!list) return;
    const now = bangkokNow();
    list.innerHTML = D.branches.map((b) => {
      const hrs = hoursFor(b, now.day);
      const isOpen = hrs && now.minutes >= toMin(hrs.open) && now.minutes < toMin(hrs.close);
      const hoursTxt = hrs ? `${t('openHours')} ${hrs.open}–${hrs.close}` : t('closedDay');
      // 카드 안에 링크(전화·길찾기)가 있어 button 대신 div[role=tab] + 키보드 처리
      return `<div class="branch${b.id === activeBranch ? ' is-active' : ''}" role="tab" tabindex="0" aria-selected="${b.id === activeBranch}" data-branch="${b.id}" id="branch-${b.id}">
        <div class="branch__head"><span class="branch__name">${L(b.name)}</span>${b.main ? `<span class="branch__badge">${t('mainBadge')}</span>` : ''}</div>
        <p class="branch__addr">${L(b.address)}</p>
        <div class="branch__meta">
          <span class="${isOpen ? 'open' : 'closed'}">${t('today')}: ${hoursTxt}</span>
          ${b.rating ? `<span class="branch__rating">★ ${b.rating.score.toFixed(1)} <small>(${b.rating.count} ${t('reviews')})</small></span>` : ''}
        </div>
        <div class="branch__actions">
          <a href="${telHref(b.phones[0].number)}">${t('call')} ${fmtPhone(b.phones[0].number)}</a>
          <a href="${mapsDirUrl(b)}" target="_blank" rel="noopener">${t('directions')}</a>
          <a href="${mapsOpenUrl(b)}" target="_blank" rel="noopener">${t('openMaps')}</a>
        </div>
      </div>`;
    }).join('');
    $$('.branch', list).forEach((card) => {
      card.addEventListener('click', (e) => { if (e.target.closest('a')) return; selectBranch(card.dataset.branch, true); });
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectBranch(card.dataset.branch, true); } });
    });
    const frame = $('#branchMap');
    const b = branchById(activeBranch);
    if (frame && frame.dataset.for !== activeBranch + lang) { frame.src = embedUrl(b); frame.dataset.for = activeBranch + lang; frame.title = `Google Map — ${L(b.name)}`; }
    // getElement() 는 divIcon 래퍼라 안쪽 .dg-marker 에 토글한다
    Object.entries(markers).forEach(([id, m]) => m.getElement()?.querySelector('.dg-marker')?.classList.toggle('is-active', id === activeBranch));
  }

  function selectBranch(id, fly) {
    activeBranch = id;
    renderBranches();
    if (overview && fly) { const b = branchById(id); overview.flyTo([b.lat, b.lng], 14, { duration: .8 }); markers[id]?.openPopup(); }
    // 시간표 탭도 같은 지점으로
    schedBranch = id; renderSchedule();
  }

  function initOverview() {
    const el = $('#overviewMap');
    if (!el || typeof window.L === 'undefined') { if (el) el.innerHTML = `<p style="padding:16px">${D.branches.map((b) => L(b.name)).join(' · ')}</p>`; return; }
    overview = window.L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
    // OSM 표준 타일: 키 불필요, 저트래픽 사이트에 허용 (출처 표기 필수)
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(overview);
    D.branches.forEach((b, i) => {
      const icon = window.L.divIcon({ className: '', html: `<div class="dg-marker${b.id === activeBranch ? ' is-active' : ''}"><span>${i + 1}</span></div>`, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -20] });
      const m = window.L.marker([b.lat, b.lng], { icon, title: L(b.name) }).addTo(overview).bindPopup(L(b.name));
      m.on('click', () => selectBranch(b.id, false));
      markers[b.id] = m;
    });
    overview.fitBounds(D.branches.map((b) => [b.lat, b.lng]), { padding: [40, 40] });
  }

  /* ---------- 시간표 ---------- */
  let schedBranch = D.branches[0].id;
  let schedDay = bangkokNow().day;
  function renderSchedule() {
    const b = branchById(schedBranch);
    const now = bangkokNow();
    const bt = $('#schedBranches'), dt = $('#schedDays'), list = $('#schedList'), status = $('#schedStatus'), legend = $('#legend');
    if (!bt) return;
    bt.innerHTML = D.branches.map((x) => `<button class="tab" role="tab" aria-selected="${x.id === schedBranch}" data-b="${x.id}">${L(x.name)}</button>`).join('');
    $$('.tab', bt).forEach((el) => el.addEventListener('click', () => { schedBranch = el.dataset.b; renderSchedule(); }));
    dt.innerHTML = DAYS.map((d) => {
      const off = !b.schedule.some((s) => s.d === d);
      return `<button class="tab tab--day${d === now.day ? ' is-today' : ''}${off ? ' is-off' : ''}" role="tab" aria-selected="${d === schedDay}" data-d="${d}" title="${t('daysLong')[d]}">${t('days')[d]}</button>`;
    }).join('');
    $$('.tab', dt).forEach((el) => el.addEventListener('click', () => { schedDay = el.dataset.d; renderSchedule(); }));

    const slots = b.schedule.filter((s) => s.d === schedDay).sort((a, c) => toMin(a.s) - toMin(c.s) || toMin(a.e) - toMin(c.e));
    const isToday = schedDay === now.day;
    let nextFound = false, nowCount = 0;
    list.innerHTML = slots.length ? slots.map((s) => {
      const p = D.programs[s.p];
      let state = '', cls = '';
      if (isToday) {
        if (now.minutes >= toMin(s.s) && now.minutes < toMin(s.e)) { state = t('nowClass'); cls = ' is-now'; nowCount++; }
        else if (now.minutes >= toMin(s.e)) cls = ' is-past';
        else if (!nextFound) { state = t('nextClass'); cls = ' is-next'; nextFound = true; }
      }
      return `<li class="slot slot--${p.color}${cls}">
        <span class="slot__time">${s.s} – ${s.e}</span>
        <span class="slot__name">${p[lang] ?? p.en}${s.note ? `<span class="slot__note">${s.note}</span>` : ''}</span>
        ${state ? `<span class="slot__state">${state}</span>` : '<span></span>'}
      </li>`;
    }).join('') : `<li class="sched__empty">${t('closed')}</li>`;

    if (isToday && slots.length) {
      const upcoming = slots.find((s) => toMin(s.s) > now.minutes);
      status.innerHTML = nowCount ? `<span class="dot"></span>${t('nowClass')} · ${L(b.name)}` : upcoming ? `${t('nextOn')}: ${upcoming.s} ${D.programs[upcoming.p][lang] ?? D.programs[upcoming.p].en}` : t('noUpcoming');
    } else status.textContent = '';

    legend.innerHTML = Object.values(D.programs).map((p) => `<li style="--c: var(--p-${p.color})"><i></i>${p[lang] ?? p.en} <small>(${p.age})</small></li>`).join('');
    // 포스터는 항상 보이고, 누르면 라이트박스로 확대
    const posterImg = $('#schedPoster'), posterWebp = $('#schedPosterWebp');
    if (posterImg && posterImg.dataset.src !== b.poster) {
      posterImg.dataset.src = b.poster;
      posterWebp.srcset = `${b.poster}.webp`; posterImg.src = `${b.poster}.jpg`;
    }
    if (posterImg) posterImg.alt = `${L(b.name)} — ${t('sched.poster')}`;
    $('#posterBtn').onclick = () => openLightbox(`${b.poster}.jpg`, `${L(b.name)} — ${t('sched.poster')}`);
  }
  setInterval(() => { renderSchedule(); renderBranches(); }, 60 * 1000);

  /* ---------- 페이스북 최신 게시물 피드 ----------
   * feed.json 은 scripts/fetch-fb-feed.mjs 가 공개 페이지에서 수집한다(GitHub Actions 주기 실행).
   * 사진 게시물: 대표 1장 + 썸네일, 남은 장수는 "+n". 영상(릴): 화면 근처에서 플레이어 자동 로드.
   * feed.json 을 못 읽으면 data.js 의 릴스 ID 로 영상 카드만 보여준다. */
  const feedEl = $('#feed');
  const FEED_MAX = 9;
  let feedPosts = [];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtText = (s) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
  const ICON_FB = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-2.8 0-4 1.8-4 4v2H7v4h3v6h4v-6h3l1-4h-4V8.5c0-.3.2-.5.5-.5z"/></svg>';
  const PLAY = '<span class="reel__play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>';
  // 페이스북 날짜("October 18 at 8:23 PM" / "September 28")를 현재 언어로
  function fmtFbTime(raw) {
    const m = String(raw || '').match(/^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2})(?:, (\d{4}))?/);
    if (!m) return raw || '';
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const d = new Date(Number(m[3] || new Date().getFullYear()), months.indexOf(m[1]), Number(m[2]));
    const loc = { th: 'th-TH', en: 'en-US', ko: 'ko-KR' }[lang];
    return d.toLocaleDateString(loc, { month: 'long', day: 'numeric', ...(m[3] ? { year: 'numeric' } : {}) });
  }
  function photoGrid(p, pi) {
    const imgs = p.images, total = imgs.length + (p.more || 0);
    const shown = imgs.slice(0, imgs.length >= 3 ? 3 : imgs.length);
    const rest = total - shown.length;
    return `<div class="post__photos post__photos--${shown.length}">${shown.map((im, k) => `
      <button type="button" class="post__ph" data-post="${pi}" data-idx="${k}" aria-label="${esc(t('fb.openPhoto'))} ${k + 1}/${total}">
        <img src="${im.src}" alt="${esc(im.alt || '')}" loading="lazy" decoding="async"${k === 0 && im.w ? ` width="${im.w}" height="${im.h}"` : ''}>
        ${k === shown.length - 1 && rest > 0 ? `<span class="post__more">+${rest}</span>` : ''}
      </button>`).join('')}</div>`;
  }
  function postCard(p, pi) {
    const media = p.type === 'video' && p.videoId
      ? `<div class="post__video" data-video="${p.videoId}"><button type="button" class="reel__facade" aria-label="${esc(t('loadReel'))}">${PLAY}</button></div>`
      : p.type === 'photo' && p.images.length ? photoGrid(p, pi) : '';
    const long = (p.text || '').length > 160 || (p.text || '').split('\n').length > 4;
    return `<article class="post">
      <header class="post__head">
        <img src="assets/logo.png" alt="" width="40" height="40" loading="lazy">
        <div><strong>ดราก้อนยิม เทควันโด ภูเก็ต</strong><small>${esc(fmtFbTime(p.time))}</small></div>
        <a class="post__fb" href="${esc(p.url)}" target="_blank" rel="noopener" aria-label="Facebook">${ICON_FB}</a>
      </header>
      ${p.text ? `<div class="post__text${long ? ' is-clamped' : ''}">${fmtText(p.text)}</div>${long ? `<button type="button" class="post__toggle">${esc(t('fb.seeMore'))}</button>` : ''}` : ''}
      ${media}
      <a class="post__link" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(t('fb.viewPost'))} →</a>
    </article>`;
  }
  const loadVideo = (box) => {
    if (box.dataset.loaded) return; box.dataset.loaded = '1';
    const f = document.createElement('iframe');
    f.src = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(`https://www.facebook.com/reel/${box.dataset.video}/`)}&show_text=false&mute=1`;
    f.title = 'Facebook video'; f.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share'); f.allowFullscreen = true;
    box.innerHTML = ''; box.appendChild(f);
  };
  function renderFeed() {
    if (!feedEl || !feedPosts.length) return;
    feedEl.innerHTML = feedPosts.slice(0, FEED_MAX).map(postCard).join('');
    $$('.post__toggle', feedEl).forEach((b) => b.addEventListener('click', () => {
      const txt = b.previousElementSibling; const open = txt.classList.toggle('is-clamped') === false;
      b.textContent = open ? t('fb.seeLess') : t('fb.seeMore');
    }));
    $$('.post__ph', feedEl).forEach((b) => b.addEventListener('click', () => {
      const p = feedPosts[Number(b.dataset.post)];
      openGallery(p.images.map((im) => im.src), Number(b.dataset.idx), p.url);
    }));
    const vIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { loadVideo(e.target); vIO.unobserve(e.target); } }), { rootMargin: '400px' });
    $$('.post__video', feedEl).forEach((v) => { vIO.observe(v); v.querySelector('button')?.addEventListener('click', () => loadVideo(v)); });
  }
  if (feedEl) {
    fetch('feed.json', { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((data) => {
        feedPosts = Array.isArray(data.posts) ? data.posts : [];
        const up = $('#feedUpdated');
        if (up && data.updated) up.dataset.updated = data.updated;
        renderFeed(); renderFeedUpdated();
      })
      .catch((err) => {
        console.warn('[feed] feed.json 을 읽지 못해 릴스 목록으로 대체합니다', err);
        feedPosts = D.reels.slice(0, 6).map((id) => ({ type: 'video', videoId: id, url: `https://www.facebook.com/reel/${id}/`, text: '', time: '', images: [] }));
        renderFeed();
      });
  }
  function renderFeedUpdated() {
    const up = $('#feedUpdated');
    if (!up || !up.dataset.updated) return;
    const d = new Date(up.dataset.updated);
    up.textContent = `${t('fb.updated')} ${d.toLocaleString({ th: 'th-TH', en: 'en-US', ko: 'ko-KR' }[lang], { dateStyle: 'medium', timeStyle: 'short', timeZone: D.timeZone })}`;
  }

  /* ---------- 인스타그램 임베드 (iframe, 키 불필요). 섹션 근처에서 로드 ---------- */
  const igGrid = $('#igGrid');
  if (igGrid && Array.isArray(D.instagram)) {
    igGrid.innerHTML = D.instagram.slice(0, 3).map((code) => `<div class="ig__item" data-code="${code}"><a href="https://www.instagram.com/p/${code}/" target="_blank" rel="noopener">Instagram</a></div>`).join('');
    const igIO = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      igIO.unobserve(e.target);
      const f = document.createElement('iframe');
      f.src = `https://www.instagram.com/p/${e.target.dataset.code}/embed/`;
      f.title = 'Instagram post — dragon_gym_taekwondo'; f.loading = 'lazy'; f.setAttribute('scrolling', 'no'); f.allowTransparency = true;
      e.target.innerHTML = ''; e.target.appendChild(f);
    }), { rootMargin: '500px' });
    $$('.ig__item', igGrid).forEach((el) => igIO.observe(el));
  }

  /* ---------- 코치진·대표선수 (data.js team) ---------- */
  function renderTeam() {
    const tl = $('#coachTimeline'), list = $('#athleteList'), mi = $('#mentorItems');
    if (!tl || !list || !D.team) return;
    if (mi && D.team.mentor) mi.innerHTML = D.team.mentor.items.map((r) => `<li>${esc(r[lang] ?? r.en)}</li>`).join('');
    tl.innerHTML = D.team.coach.timeline.map((r) => `<li class="timeline__item${r.now ? ' is-now' : ''}">
      <span class="timeline__year">${esc(r.y)}${r.now ? `<small>${esc(t('team.now'))}</small>` : ''}</span>
      <span class="timeline__text">${esc(r[lang] ?? r.en)}</span></li>`).join('');
    list.innerHTML = D.team.athletes.map((a) => `<li class="athlete${a.gold ? ' athlete--gold' : ''}">
      <picture class="athlete__photo"><source srcset="assets/team/${a.img}.webp" type="image/webp"><img src="assets/team/${a.img}.jpg" alt="${esc(a.name.en)}" width="300" height="300" loading="lazy" decoding="async"></picture>
      <div class="athlete__body"><h4 class="athlete__name">${esc(a.name[lang] ?? a.name.en)}</h4>
        <ul class="athlete__items">${(a.items[lang] ?? a.items.en).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></li>`).join('');
    if (list.dataset.revealed) $$('.athlete', list).forEach((el) => el.classList.add('is-revealed'));
  }

  /* ---------- 체험 문의: 전화번호 목록 (채팅은 HTML 의 LINE/WhatsApp 링크) ---------- */
  function renderTrialOptions() {
    const ph = $('#trialPhones');
    if (!ph) return;
    ph.innerHTML = D.branches.flatMap((b) => b.phones.filter((p, i) => i > 0 || b.main)).filter((p, i, a) => a.findIndex((x) => x.number === p.number) === i)
      .map((p) => `<a href="${telHref(p.number)}"><svg viewBox="0 0 24 24"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.6 3.6a1 1 0 0 1-.25 1l-2.25 2.2z"/></svg>${fmtPhone(p.number)} <small>${L(p.label)}</small></a>`).join('');
  }

  /* ---------- 라이트박스 (포스터 확대) ---------- */
  const lb = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCaption');
  let lastFocus = null;
  // 갤러리 상태: 피드 사진은 좌우로 넘겨 본다
  let gallery = null; // { list, idx, url }
  function openLightbox(src, caption) {
    if (!lb.classList.contains('is-open')) lastFocus = document.activeElement;
    lbImg.src = src; lbImg.alt = caption; lbCap.textContent = caption;
    const multi = !!(gallery && gallery.list.length > 1);
    $('#lbPrev').hidden = !multi; $('#lbNext').hidden = !multi;
    lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false'); $('#lbClose').focus();
  }
  function showGallery() {
    const { list, idx } = gallery;
    openLightbox(list[idx], `${idx + 1} / ${list.length}`);
    lbCap.innerHTML = `${idx + 1} / ${list.length} · <a href="${esc(gallery.url)}" target="_blank" rel="noopener">${esc(t('fb.viewPost'))}</a>`;
  }
  function openGallery(list, idx, url) { gallery = { list, idx, url }; showGallery(); }
  const stepGallery = (d) => { if (!gallery) return; gallery.idx = (gallery.idx + d + gallery.list.length) % gallery.list.length; showGallery(); };
  $('#lbPrev').addEventListener('click', () => stepGallery(-1));
  $('#lbNext').addEventListener('click', () => stepGallery(1));
  function closeLightbox() { lastFocus?.focus?.(); if (lb.contains(document.activeElement)) document.activeElement.blur(); lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true'); gallery = null; }
  $('#lbClose').addEventListener('click', closeLightbox);
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') stepGallery(-1);
    else if (e.key === 'ArrowRight') stepGallery(1);
  });

  /* ---------- 푸터 ---------- */
  function renderFooterBranches() {
    const ul = $('#footerBranches'); if (!ul) return;
    ul.innerHTML = D.branches.map((b) => `<li><a href="${mapsOpenUrl(b)}" target="_blank" rel="noopener">${L(b.name)}</a></li>`).join('');
  }
  $('#year').textContent = String(new Date().getFullYear());

  /* ---------- Lenis 스무스 스크롤 ---------- */
  if (!reduceMotion && typeof window.Lenis === 'function' && hasGsap) {
    const lenis = new window.Lenis({ lerp: .1, smoothWheel: true });
    lenis.on('scroll', () => { if (hasST) ScrollTrigger.update(); });
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    document.documentElement.classList.add('lenis');
    $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const id = a.getAttribute('href'); if (id.length < 2) return;
      const target = document.querySelector(id); if (!target) return;
      e.preventDefault(); lenis.scrollTo(target, { offset: -64 }); history.replaceState(null, '', id);
    }));
  }

  /* ---------- 초기화 ---------- */
  applyLang();
  syncLangUrl(); // 저장된 언어로 열렸을 때도 주소에 반영
  initOverview();
})();
