#!/usr/bin/env node
/**
 * 페이스북 페이지 최신 게시물 수집기 (비로그인 공개 화면 기준, API 키·토큰 불필요)
 *
 * 헤드리스 Chrome 을 CDP 로 띄워 https://www.facebook.com/<page>/ 를 스크롤하고,
 * 게시물마다 본문·날짜·사진(최대 5장 + "+n" 개수)·릴 영상 ID 를 뽑아
 *   site/feed.json           — 사이트가 읽는 데이터
 *   site/feed/img/*.jpg      — 사진 사본 (페이스북 이미지 URL 은 서명이 만료되므로 레포에 저장)
 * 로 쓴다. GitHub Actions(pages.yml)가 주기적으로 실행하고, 로컬에서도 그대로 돈다:
 *
 *   node scripts/fetch-fb-feed.mjs            # 기본 페이지 dragongymtaekwondo, 최대 12개
 *   CHROME_PATH=/usr/bin/google-chrome node scripts/fetch-fb-feed.mjs
 *
 * 실패(로그인 장벽·구조 변경으로 0건)하면 기존 feed.json 을 건드리지 않고 종료코드 1 을 낸다.
 * 의존성 없음 — Node 22+ 전역 WebSocket/fetch 사용.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = process.env.FB_PAGE || 'dragongymtaekwondo';
const MAX_POSTS = Number(process.env.FB_MAX_POSTS || 12);
const OUT_JSON = path.join(ROOT, 'site', 'feed.json');
const IMG_DIR = path.join(ROOT, 'site', 'feed', 'img');
const PORT = 9300 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[fb-feed]', ...a);

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cands = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  const hit = cands.find((p) => existsSync(p));
  if (!hit) throw new Error('Chrome 을 찾지 못했습니다. CHROME_PATH 를 지정하세요.');
  return hit;
}

/* ---------- 최소 CDP 클라이언트 ---------- */
async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* 아직 안 뜸 */ }
    await sleep(500);
  }
  throw new Error('Chrome DevTools 포트에 붙지 못했습니다');
}
function session(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } };
  const ready = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const n = ++id; const timer = setTimeout(() => rej(new Error(`CDP 시한 초과: ${method}`)), 30000);
    pending.set(n, (msg) => { clearTimeout(timer); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('페이지 평가 실패: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  return { ready, send, evaluate, close: () => ws.close() };
}

/* ---------- 페이지 안에서 실행할 추출기 ---------- */
const CLOSE_LOGIN = `(() => { document.querySelectorAll('[aria-label="Close"], [aria-label="닫기"]').forEach((b) => b.click()); return true; })()`;
const COUNT = `document.querySelectorAll('[role=article][aria-posinset]').length`;
const EXPAND = `(() => { let n = 0; document.querySelectorAll('[role=article] [role=button]').forEach((b) => { if (/^(See more|더 보기|ดูเพิ่มเติม)$/.test(b.innerText.trim())) { b.click(); n++; } }); return n; })()`;
const EXTRACT = `(() => {
  const posts = [...document.querySelectorAll('[role=article][aria-posinset]')].filter((p) => !p.parentElement.closest('[role=article]'));
  const timeRe = /^(\\d+\\s?[hmd]|\\d+\\s?(hrs?|mins?|days?)|Yesterday.*|(January|February|March|April|May|June|July|August|September|October|November|December) \\d{1,2}.*|\\d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December).*)$/;
  return posts.map((p) => {
    const msgEl = p.querySelector('[data-ad-preview="message"], [data-ad-comet-preview="message"]');
    const text = (msgEl ? msgEl.innerText : '').replace(/\\s*…?\\s*(See more|더 보기|ดูเพิ่มเติม)\\s*$/, '').trim();
    const hrefs = [...p.querySelectorAll('a[href]')].map((a) => a.href);
    const postUrl = (hrefs.find((h) => /\\/posts\\/|\\/permalink|story_fbid/.test(h)) || '').split('?')[0];
    const reel = hrefs.map((h) => h.match(/\\/(?:reel|videos)\\/(?:[^/]+\\/)?(\\d{6,})/)).find(Boolean);
    const imgs = [...p.querySelectorAll('img')]
      .filter((i) => /fbcdn|scontent/.test(i.src) && (i.naturalWidth || i.width) >= 150 && !i.closest('[role=article] [role=article]'))
      .map((i) => ({ src: i.currentSrc || i.src, w: i.naturalWidth, h: i.naturalHeight, alt: i.alt || '' }));
    const uniq = []; imgs.forEach((i) => { if (!uniq.some((u) => u.src === i.src)) uniq.push(i); });
    const plus = [...p.querySelectorAll('div, span')].map((d) => d.childElementCount === 0 ? d.innerText.trim() : '').find((t) => /^\\+\\s?\\d+$/.test(t));
    const time = [...p.querySelectorAll('a[href] span, a[aria-label]')].map((s) => (s.getAttribute('aria-label') || s.innerText || '').trim()).find((t) => timeRe.test(t)) || '';
    return {
      pos: Number(p.getAttribute('aria-posinset')),
      url: postUrl || (reel ? 'https://www.facebook.com/reel/' + reel[1] + '/' : ''),
      text, time,
      type: reel && !uniq.length ? 'video' : uniq.length ? 'photo' : 'text',
      videoId: reel ? reel[1] : null,
      images: uniq.slice(0, 5),
      more: plus ? Number(plus.replace(/\\D/g, '')) : 0,
    };
  });
})()`;

async function download(url) {
  const name = createHash('sha1').update(url.split('?')[0]).digest('hex').slice(0, 16) + '.jpg';
  const file = path.join(IMG_DIR, name);
  if (!existsSync(file)) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', referer: 'https://www.facebook.com/' } });
    if (!res.ok) throw new Error(`이미지 ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return name;
}

async function main() {
  const profile = mkdtempSync(path.join(tmpdir(), 'fbfeed-'));
  const chrome = spawn(findChrome(), [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--lang=en-US', '--no-sandbox',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--window-size=1400,2400',
    `https://www.facebook.com/${PAGE}/`,
  ], { stdio: 'ignore' });
  let cdp;
  try {
    cdp = session(await connect());
    await cdp.ready;
    await cdp.send('Runtime.enable');
    await sleep(8000);
    for (let i = 0; i < 14; i++) {
      await cdp.evaluate(CLOSE_LOGIN);
      if ((await cdp.evaluate(COUNT)) >= MAX_POSTS) break;
      await cdp.evaluate('window.scrollBy(0, 1600)');
      await sleep(2000);
    }
    await cdp.evaluate(CLOSE_LOGIN);
    await cdp.evaluate(EXPAND); await sleep(1200);
    // 사진이 lazy 로딩되도록 게시물마다 한 번씩 화면에 들인다
    await cdp.evaluate(`(async () => { for (const p of document.querySelectorAll('[role=article][aria-posinset]')) { p.scrollIntoView(); await new Promise((r) => setTimeout(r, 350)); } return 1; })()`);
    const raw = (await cdp.evaluate(EXTRACT)).filter((p) => p.url).sort((a, b) => a.pos - b.pos).slice(0, MAX_POSTS);
    log(`게시물 ${raw.length}건 추출`);
    if (!raw.length) throw new Error('게시물을 하나도 찾지 못했습니다 (로그인 장벽 또는 구조 변경)');

    mkdirSync(IMG_DIR, { recursive: true });
    const keep = new Set();
    const posts = [];
    for (const p of raw) {
      const images = [];
      for (const img of p.images) {
        try { const file = await download(img.src); keep.add(file); images.push({ src: `feed/img/${file}`, w: img.w, h: img.h, alt: img.alt }); }
        catch (e) { log('이미지 실패', e.message); }
      }
      posts.push({ url: p.url, type: p.type === 'photo' && !images.length ? 'text' : p.type, text: p.text, time: p.time, videoId: p.videoId, images, more: p.more });
    }
    // 더 이상 쓰지 않는 사진 정리 (feed/img 는 이 스크립트 전용 폴더)
    for (const f of readdirSync(IMG_DIR)) if (!keep.has(f)) rmSync(path.join(IMG_DIR, f));
    writeFileSync(OUT_JSON, JSON.stringify({ page: `https://www.facebook.com/${PAGE}`, updated: new Date().toISOString(), posts }, null, 2) + '\n');
    log(`저장: ${path.relative(ROOT, OUT_JSON)} (${posts.length}건, 사진 ${keep.size}장)`);
  } finally {
    try { cdp?.close(); } catch { /* 무시 */ }
    chrome.kill();
    await sleep(500);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* 윈도우 잠금 무시 */ }
  }
}

main().catch((e) => { console.error('[fb-feed] 실패:', e.message); process.exit(1); });
