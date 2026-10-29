/* 관리자 비밀번호 잠금. GitHub 토큰을 비밀번호로 암호화(PBKDF2-SHA256 60만 회 → AES-GCM)해 auth.json 으로 레포에 둔다.
 * 레포는 공개라 암호문도 공개다 — 비밀번호가 곧 보안이므로 10자 이상을 강제한다.
 * 풀린 토큰은 이 탭(sessionStorage) 또는 '로그인 유지' 시 이 기기(localStorage)에만 둔다. */
import { REPO, BRANCH, AUTH_PATH } from './repo.js';
import { t } from './i18n.js';

const ITER = 600000;
const TOKEN_KEY = 'dgt-admin.token';
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
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
  clear() {
    safe(() => sessionStorage.removeItem(TOKEN_KEY));
    safe(() => localStorage.removeItem(TOKEN_KEY));
    safe(() => localStorage.removeItem('sveltia-cms.user')); // 예전 Sveltia 로그인 흔적
  },
};
