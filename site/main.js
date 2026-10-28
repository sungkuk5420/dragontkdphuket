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

  /* ---------- 언어 ---------- */
  let lang = 'en';
  try { lang = localStorage.getItem('dgt-lang') === 'th' ? 'th' : 'en'; } catch { /* 저장소 차단 환경 */ }
  const qLang = new URLSearchParams(location.search).get('lang'); // ?lang=th 공유 링크용
  if (qLang === 'th' || qLang === 'en') lang = qLang;
  const t = (key) => (D.i18n[lang] && D.i18n[lang][key]) ?? D.i18n.en[key] ?? key;
  const L = (obj) => (obj && typeof obj === 'object' ? (obj[lang] ?? obj.en) : obj);

  function applyLang() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (el.dataset.i18nOrig === undefined) el.dataset.i18nOrig = el.innerHTML;
      if (lang === 'en') el.innerHTML = el.dataset.i18nOrig;
      else if (D.i18n.th[key] !== undefined) el.textContent = D.i18n.th[key];
    });
    $$('[data-i18n-ph]').forEach((el) => {
      const key = el.dataset.i18nPh;
      if (el.dataset.i18nOrig === undefined) el.dataset.i18nOrig = el.placeholder;
      el.placeholder = lang === 'en' ? el.dataset.i18nOrig : (D.i18n.th[key] ?? el.dataset.i18nOrig);
    });
    $$('[data-lang]').forEach((el) => el.classList.toggle('is-on', el.dataset.lang === lang));
    const tg = $('#langToggle');
    if (tg) tg.setAttribute('aria-pressed', String(lang === 'th'));
    // 언어 의존 렌더링 재실행
    renderBranches(); renderSchedule(); renderTrialOptions(); renderFooterBranches();
  }
  $('#langToggle')?.addEventListener('click', () => {
    lang = lang === 'en' ? 'th' : 'en';
    try { localStorage.setItem('dgt-lang', lang); } catch { /* 무시 */ }
    applyLang();
  });

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
  const mapsOpenUrl = (b) => `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}&query_place_id=${b.placeId}`;
  const mapsDirUrl = (b) => `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}&destination_place_id=${b.placeId}`;
  const embedUrl = (b) => `https://maps.google.com/maps?q=${b.lat},${b.lng}&z=16&hl=${lang}&output=embed`;

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
          <span class="branch__rating">★ ${b.rating.score.toFixed(1)} <small>(${b.rating.count} ${t('reviews')})</small></span>
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
    const posterBtn = $('#posterBtn');
    posterBtn.onclick = () => openLightbox(`${b.poster}.jpg`, `${L(b.name)} — ${t('sched.poster')}`);
  }
  setInterval(() => { renderSchedule(); renderBranches(); }, 60 * 1000);

  /* ---------- 페이스북 플러그인 / 릴스 ---------- */
  const fbPage = $('#fbPage');
  if (fbPage) {
    const load = () => {
      if (fbPage.dataset.loaded) return;
      fbPage.dataset.loaded = '1';
      const f = document.createElement('iframe');
      f.src = fbPage.dataset.src; f.title = 'Facebook page — Dragon Gym Taekwondo Phuket'; f.loading = 'lazy';
      f.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share');
      fbPage.appendChild(f);
    };
    new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { load(); io.disconnect(); } }, { rootMargin: '400px' }).observe(fbPage);
  }
  const reels = $('#reels');
  if (reels) {
    reels.innerHTML = D.reels.slice(0, 6).map((id, i) => `<div class="reel" data-id="${id}">
      <button class="reel__facade" type="button" aria-label="${t('loadReel')} ${i + 1}">
        <span class="reel__play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
        <span class="reel__label">Reel ${i + 1}</span>
      </button>
    </div>`).join('');
    const loadReel = (box) => {
      if (box.dataset.loaded) return; box.dataset.loaded = '1';
      const f = document.createElement('iframe');
      f.src = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(`https://www.facebook.com/reel/${box.dataset.id}/`)}&show_text=false&autoplay=true&mute=1`;
      f.title = 'Facebook reel'; f.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share'); f.allowFullscreen = true;
      box.innerHTML = ''; box.appendChild(f);
    };
    $$('.reel__facade', reels).forEach((btn) => btn.addEventListener('click', () => loadReel(btn.parentElement)));
  }

  /* ---------- 체험 문의 폼 ---------- */
  const form = $('#trialForm');
  function renderTrialOptions() {
    const bs = $('#fBranch'), ds = $('#fDay');
    if (!bs) return;
    const prevB = bs.value, prevD = ds.value;
    bs.innerHTML = D.branches.map((b) => `<option value="${b.id}">${L(b.name)}</option>`).join('');
    bs.value = prevB || activeBranch;
    const any = ds.querySelector('option[value=""]');
    ds.innerHTML = ''; ds.appendChild(any);
    DAYS.forEach((d) => { const o = document.createElement('option'); o.value = d; o.textContent = t('daysLong')[d]; ds.appendChild(o); });
    ds.value = prevD;
    const ph = $('#trialPhones');
    ph.innerHTML = D.branches.flatMap((b) => b.phones.filter((p, i) => i > 0 || b.main)).filter((p, i, a) => a.findIndex((x) => x.number === p.number) === i)
      .map((p) => `<a href="${telHref(p.number)}"><svg viewBox="0 0 24 24"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.6 3.6a1 1 0 0 1-.25 1l-2.25 2.2z"/></svg>${fmtPhone(p.number)} <small>${L(p.label)}</small></a>`).join('');
  }
  // 프로그램 카드 → 폼 메모 채우기
  $$('[data-program]').forEach((a) => a.addEventListener('click', () => { const n = $('#fNote'); const p = D.programs[a.dataset.program]; if (n && p) n.value = `${p.en} class`; }));
  let lastMsg = '';
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#fName').value.trim(), age = $('#fAge').value.trim();
    const err = $('#formError');
    $('#fName').setAttribute('aria-invalid', String(!name)); $('#fAge').setAttribute('aria-invalid', String(!age));
    if (!name || !age) { err.textContent = t('formNeed'); err.hidden = false; (!name ? $('#fName') : $('#fAge')).focus(); return; }
    err.hidden = true;
    const b = branchById($('#fBranch').value), day = $('#fDay').value, note = $('#fNote').value.trim();
    lastMsg = [t('msgIntro'), `${t('msgName')}: ${name}`, `${t('msgAge')}: ${age}`, `${t('msgBranch')}: ${L(b.name)}`, day ? `${t('msgDay')}: ${t('daysLong')[day]}` : null, note ? `${t('msgNote')}: ${note}` : null].filter(Boolean).join('\n');
    $('#outMsg').value = lastMsg;
    $('#btnMessenger').href = `${D.messengerUrl}?text=${encodeURIComponent(lastMsg)}`;
    const out = $('#formOut'); out.hidden = false; out.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  });
  const toast = (msg) => { const el = $('#formToast'); el.textContent = msg; setTimeout(() => { el.textContent = ''; }, 3000); };
  const copyMsg = async () => {
    try { await navigator.clipboard.writeText(lastMsg); toast(t('copied')); }
    catch { const ta = $('#outMsg'); ta.focus(); ta.select(); toast(t('copyFail')); }
  };
  $('#btnCopy')?.addEventListener('click', copyMsg);
  $('#btnLine')?.addEventListener('click', async () => { await copyMsg(); openLightbox('assets/line-qr.png', t('trial.lineHint')); });

  /* ---------- 라이트박스 / LINE ---------- */
  const lb = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCaption');
  let lastFocus = null;
  function openLightbox(src, caption) {
    lastFocus = document.activeElement;
    lbImg.src = src; lbImg.alt = caption; lbCap.textContent = caption;
    lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false'); $('#lbClose').focus();
  }
  function closeLightbox() { lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true'); lastFocus?.focus?.(); }
  $('#lbClose').addEventListener('click', closeLightbox);
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lb.classList.contains('is-open')) closeLightbox(); });
  const showLine = () => openLightbox('assets/line-qr.png', t('trial.lineHint'));
  $('#fab')?.addEventListener('click', showLine);
  $('#footerLine')?.addEventListener('click', showLine);

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
  initOverview();
})();
