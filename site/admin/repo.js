/* 관리자 페이지 ↔ GitHub 레포. 데이터는 site/content/*.json, 이미지는 site/assets/uploads/ (DB 없음).
 * 읽기는 Contents API(raw), 저장은 Git Data API 로 바뀐 JSON·이미지를 커밋 하나로 묶는다(중간 상태가 배포되지 않게).
 * main 에 커밋되면 .github/workflows/pages.yml 이 사이트를 다시 배포한다. */
import { t } from './i18n.js';

export const REPO = 'sungkuk5420/dragontkdphuket';
export const BRANCH = 'main';
export const SITE_DIR = 'site/';
export const AUTH_PATH = 'site/admin/auth.json';

const API = `https://api.github.com/repos/${REPO}`;

export function createRepo(token) {
  async function call(path, init = {}) {
    const r = await fetch(`${API}${path}`, {
      ...init,
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
    if (!r.ok) {
      let msg = '';
      try { msg = (await r.json()).message || ''; } catch { /* 본문 없음 */ }
      const err = new Error(`GitHub ${r.status} ${msg}`.trim());
      err.status = r.status;
      throw err;
    }
    return r.status === 204 ? null : r.json();
  }

  /** 레포의 JSON 파일을 main 최신본으로 읽는다 (사이트 배포본은 수 분 늦을 수 있다) */
  async function readJson(path) {
    const r = await fetch(`${API}/contents/${path}?ref=${BRANCH}`, {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github.raw+json', Authorization: `Bearer ${token}` },
    });
    if (!r.ok) { const err = new Error(t('repo.readFail', { path, status: r.status })); err.status = r.status; throw err; }
    return JSON.parse(await r.text());
  }

  /**
   * 파일 여러 개를 커밋 하나로 저장한다.
   * files: [{ path, text }] 또는 [{ path, base64 }] (이미지)
   * 그 사이 main 이 움직였으면(피드 봇 커밋 등) 최신 기준으로 한 번 다시 시도한다.
   */
  async function commitFiles(files, message) {
    const blobs = await Promise.all(files.map(async (f) => {
      const body = f.base64 != null ? { content: f.base64, encoding: 'base64' } : { content: f.text, encoding: 'utf-8' };
      const blob = await call('/git/blobs', { method: 'POST', body: JSON.stringify(body) });
      return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
    }));
    for (let attempt = 0; attempt < 2; attempt++) {
      const ref = await call(`/git/ref/heads/${BRANCH}`);
      const parent = await call(`/git/commits/${ref.object.sha}`);
      const tree = await call('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: parent.tree.sha, tree: blobs }) });
      const commit = await call('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: tree.sha, parents: [ref.object.sha] }) });
      try {
        await call(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
        return commit.sha;
      } catch (e) {
        if (e.status !== 422 || attempt === 1) throw e; // 422 = fast-forward 아님 → 최신 기준으로 재시도
      }
    }
    throw new Error('저장 충돌'); // 도달하지 않음
  }

  /** 최근 배포 상태 (Actions 읽기 권한이 없으면 null) */
  async function lastDeploy() {
    try {
      const runs = await call(`/actions/runs?branch=${BRANCH}&per_page=1`);
      return runs.workflow_runs[0] || null;
    } catch { return null; }
  }

  return { call, readJson, commitFiles, lastDeploy };
}
