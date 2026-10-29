/* 관리자 비밀번호 잠금. GitHub 토큰을 비밀번호로 암호화(PBKDF2-SHA256 60만 회 → AES-GCM)해 auth.json 으로 레포에 둔다.
 * 레포는 공개라 암호문도 공개다 — 비밀번호가 곧 보안이므로 10자 이상을 강제한다.
 * 풀린 토큰은 이 탭(sessionStorage) 또는 '로그인 유지' 시 이 기기(localStorage)에만 둔다. */
import { REPO, BRANCH, AUTH_PATH } from './repo.js?v=3';
import { t } from './i18n.js?v=3';

const ITER = 600000;
const TOKEN_KEY = 'dgt-admin.token';
const LEDGER_KEY = 'dgt-admin.ledgerKey';
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (buf) => { // 큰 장부도 되게 조각내서 (전개 인자 수 한도)
  const u = new Uint8Array(buf); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const safe = (fn) => { try { return fn(); } catch { return null; } }; // 저장소 차단 환경

async function deriveKey(password, salt, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptToken(token, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITER);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(token));
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

export async function decryptToken(data, password) {
  const key = await deriveKey(password, unb64(data.salt), data.iter);
  try {
    return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(data.iv) }, key, unb64(data.ct)));
  } catch { throw new Error(t('auth.wrongPw')); }
}

/* ---------- 관원 장부 키 ----------
 * 관원 장부(이름·연락처·회비)는 공개 레포에 암호문으로만 둔다. 장부는 무작위 키(AES-256)로 암호화하고,
 * 그 키를 관리자 비밀번호와 복구 코드로 각각 감싸 auth.json 의 ledger 에 둔다.
 * 비밀번호를 잊어 재설정할 때는 복구 코드로 키를 꺼내 새 비밀번호로 다시 감싼다(코드도 없으면 장부는 못 연다). */
async function seal(bytes, secret) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(secret, salt, ITER);
  return { iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes)) };
}
async function unseal(box, secret, errText) {
  const key = await deriveKey(secret, unb64(box.salt), box.iter);
  try { return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct))); }
  catch { throw new Error(errText); }
}
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0·O·1·I 제외, 32자라 바이트 % 32 가 고르다
const normCode = (code) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** 새 복구 코드(XXXXX-XXXXX-XXXXX-XXXXX, 100비트)로 키를 감싼다. 코드는 화면에 한 번만 보여 준다. */
export async function newRecoveryCode(raw) {
  const chars = Array.from(crypto.getRandomValues(new Uint8Array(20)), (n) => CODE_CHARS[n % 32]).join('');
  const code = chars.match(/.{5}/g).join('-');
  return { code, rc: await seal(raw, normCode(code)) };
}
export async function createLedgerKey(password) {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const { code, rc } = await newRecoveryCode(raw);
  return { raw, code, wrap: { pw: await seal(raw, password), rc } };
}
export const openLedgerKey = (wrap, password) => unseal(wrap.pw, password, t('auth.wrongPw'));
export const recoverLedgerKey = (wrap, code) => unseal(wrap.rc, normCode(code), t('auth.wrongCode'));
export async function rewrapLedgerKey(raw, password, wrap) { return { ...wrap, pw: await seal(raw, password) }; }

const importLedgerKey = (raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
export async function encryptLedger(raw, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await importLedgerKey(raw), enc.encode(JSON.stringify(obj)));
  return { v: 1, alg: 'AES-GCM', iv: b64(iv), ct: b64(ct) };
}
export async function decryptLedger(raw, box) {
  try { return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, await importLedgerKey(raw), unb64(box.ct)))); }
  catch { throw new Error(t('auth.ledger')); }
}

export function checkNewPassword(a, b) {
  if (a.length < 10) throw new Error(t('auth.pwShort'));
  if (a !== b) throw new Error(t('auth.pwMismatch'));
  return a;
}

/** 사이트에 배포된 auth.json (없으면 null = 초기 설정 전) */
export async function loadAuthFile() {
  const r = await fetch('auth.json', { cache: 'no-cache' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(t('auth.loadFail', { status: r.status }));
  return r.json();
}

const gh = (token, path, init = {}) => fetch(`https://api.github.com/repos/${REPO}${path}`, {
  ...init, cache: 'no-store',
  headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
});

/** 토큰이 이 레포에 닿는지 (쓰기 권한은 레포 API 가 계정 권한만 알려줘 저장 시 403 으로 드러난다) */
export async function checkToken(token) {
  const r = await gh(token, '');
  if (r.status === 401) throw new Error(t('auth.tokenBad'));
  if (!r.ok) throw new Error(t('auth.tokenNoRepo', { status: r.status }));
  const repo = await r.json();
  if (!repo.permissions || !repo.permissions.push) throw new Error(t('auth.noPush'));
}

/** 레포 main 의 최신 auth.json (사이트 배포본은 몇 분 늦을 수 있어, 덮어쓰기 전엔 이걸 기준으로 한다) */
export async function loadAuthLatest(token) {
  const r = await gh(token, `/contents/${AUTH_PATH}?ref=${BRANCH}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(t('auth.loadFail', { status: r.status }));
  return JSON.parse(await r.text());
}

export async function saveAuthFile(token, data, message) {
  const cur = await gh(token, `/contents/${AUTH_PATH}?ref=${BRANCH}`);
  const sha = cur.ok ? (await cur.json()).sha : undefined;
  const body = { message, branch: BRANCH, content: btoa(JSON.stringify(data, null, 2) + '\n'), ...(sha ? { sha } : {}) };
  const r = await gh(token, `/contents/${AUTH_PATH}`, { method: 'PUT', body: JSON.stringify(body) });
  if (r.status === 403) throw new Error(t('auth.save403'));
  if (!r.ok) throw new Error(t('auth.saveFail', { status: r.status }));
}

export const session = {
  get: () => safe(() => sessionStorage.getItem(TOKEN_KEY)) || safe(() => localStorage.getItem(TOKEN_KEY)),
  set(token, remember) {
    safe(() => sessionStorage.setItem(TOKEN_KEY, token));
    if (remember) safe(() => localStorage.setItem(TOKEN_KEY, token));
  },
  // 장부 키는 토큰과 같은 곳에 둔다 (로그인 유지면 이 기기에도)
  getKey() { const s = safe(() => sessionStorage.getItem(LEDGER_KEY)) || safe(() => localStorage.getItem(LEDGER_KEY)); return s ? unb64(s) : null; },
  setKey(raw) {
    safe(() => sessionStorage.setItem(LEDGER_KEY, b64(raw)));
    if (safe(() => localStorage.getItem(TOKEN_KEY))) safe(() => localStorage.setItem(LEDGER_KEY, b64(raw)));
  },
  clear() {
    safe(() => sessionStorage.removeItem(TOKEN_KEY));
    safe(() => localStorage.removeItem(TOKEN_KEY));
    safe(() => sessionStorage.removeItem(LEDGER_KEY));
    safe(() => localStorage.removeItem(LEDGER_KEY));
    safe(() => localStorage.removeItem('sveltia-cms.user')); // 예전 Sveltia 로그인 흔적
  },
};
