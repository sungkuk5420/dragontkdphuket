https://www.facebook.com/dragongymtaekwondo/reels/

# Dragon Gym Taekwondo Phuket — 공식 사이트

푸켓 태권도장 **Dragon Gym Taekwondo**(ดราก้อนยิม เทควันโด ภูเก็ต) 의 원페이지 사이트.
빌드 없는 정적 HTML/CSS/JS 이고 GitHub Pages 에 무료로 배포한다. DB·서버 없음.

- 운영 URL: https://dragongymphuket.com/ (GitHub Pages 커스텀 도메인, 기존 sungkuk5420.github.io/dragontkdphuket 은 자동 이동)
- 페이스북: https://www.facebook.com/dragongymtaekwondo · 인스타: https://www.instagram.com/dragon_gym_taekwondo/
- 본점: Suan Luang(사이트의 메인 체육관). 지점: Limelight(올드타운 Limelight 몰), Thalang(Srisoonthorn Rd). 보트라군은 탈랑으로 이전

## 구성

```
site/
  index.html        원페이지(히어로·소개·프로그램·지점+지도·시간표·페이스북·체험문의·FAQ) + JSON-LD
  styles.css        디자인 토큰(금/검/적), 섹션 스타일, 리빌 애니메이션
  main.js           인터랙션(GSAP·Lenis·커서·틸트·시간표 실시간 하이라이트·지도·폼·언어 전환 ไทย/EN/한국어)
  data.js           프로그램 정의·영어/한국어 번역 + content/*.json 로더(window.DGT_READY)
  content/          관리자 페이지가 편집하는 데이터: branches.json(지점·시간표) team.json(코치진·선수) social.json(인스타·릴스) contact.json(LINE·WhatsApp·Messenger)
  admin/            자체 관리자 화면(빌드 없음): index.html·admin.css·app.js(화면) auth.js(비밀번호 잠금) repo.js(GitHub API)
  feed.json, feed/img/  페이스북 최신 게시물(자동 수집 결과 — 손으로 고치지 않는다)
scripts/fetch-fb-feed.mjs   공개 페이스북 페이지 → feed.json 수집기 (헤드리스 Chrome, 키 불필요)
  assets/           로고(포스터에서 추출)·LINE QR·시간표 포스터(webp/jpg)·OG 이미지
  robots.txt sitemap.xml site.webmanifest .nojekyll
.github/workflows/pages.yml   main push·6시간마다: 페이스북 피드 수집 → 커밋 → site/ 를 GitHub Pages 로 배포
```

외부 의존: Google Fonts, GSAP 3.13 + ScrollTrigger, Lenis 1.3, Leaflet 1.9(개요 지도, OpenStreetMap 타일),
Google Maps `output=embed` iframe(키 불필요), Facebook page/video 플러그인 iframe(앱 ID 불필요).

## 로컬 실행

```bash
cd site
python -m http.server 5190     # http://127.0.0.1:5190/
```

언어: 기본 태국어. 상단 버튼(ไทย / EN / 한국어)으로 전환하며 선택은 브라우저에 저장된다.
공유 링크는 `?lang=en`, `?lang=ko` 로 언어를 지정할 수 있다.

## 배포 (GitHub Pages, 무료)

1. 레포를 **public** 으로 전환한다(무료 플랜은 private 레포에 Pages 를 허용하지 않는다).
2. Settings → Pages → Source 를 **GitHub Actions** 로 선택한다.
3. `main` 에 push 하면 `.github/workflows/pages.yml` 이 `site/` 를 올린다.
4. 커스텀 도메인을 붙이면 `index.html`(canonical/OG/JSON-LD), `robots.txt`, `sitemap.xml`, `data.js` 의
   `siteUrl` 을 함께 바꾼다.

## 내용 바꾸기

- 페이스북 피드는 자동이다. 바로 갱신하려면 Actions 에서 워크플로를 수동 실행하거나 로컬에서 `node scripts/fetch-fb-feed.mjs` 후 커밋한다.

- **관리자 페이지 `https://dragongymphuket.com/admin/`** (자체 화면, DB·서버 없음, tkd.reizwings.jp 관리자와 같은 구성):
  지점별 주간 시간표·포스터·주소·구글맵 좌표(링크 붙여넣기로 자동 입력)·전화, 심사위원·코치진·선수(사진), 수석 코치 경력,
  LINE·WhatsApp QR·링크, 인스타·릴스. 편집은 화면 안에만 반영되고 아래 [저장] 한 번에 바뀐 JSON 과 새 이미지가
  GitHub API(Git Data)로 `main` 에 커밋 하나로 올라간다 → `pages.yml` 이 1~2분 뒤 재배포.
  이미지는 브라우저에서 webp 로 줄여(인물 600px 정사각, 포스터 1600px, QR 은 PNG) `site/assets/uploads/` 에 저장.
  - 로그인: 관리자 비밀번호. 처음 한 번 "관리자 초기 설정" 화면에서 GitHub 토큰(Fine-grained, 이 레포만 ·
    Contents **Read and write**)과 비밀번호(10자 이상)를 넣으면 토큰을 비밀번호로 암호화(PBKDF2 60만 회 + AES-GCM)해
    `site/admin/auth.json` 으로 커밋한다. 이후에는 비밀번호만 입력. "로그인 유지" 를 켜면 그 브라우저는 다시 묻지 않는다.
    비밀번호 변경·분실 재설정은 로그인 화면 아래 링크. 레포가 공개라 암호문도 공개이므로 비밀번호가 곧 보안이다.
    옛 암호문은 git 기록에 남으니, 비밀번호 유출이 의심되면 비밀번호가 아니라 **토큰을 폐기·재발급**하고 재설정한다.
  - 로컬 `http://127.0.0.1:5190/admin/` 도 같은 화면이지만 저장은 GitHub `main` 으로 바로 간다(로컬 파일은 안 바뀜).
  - 편집 대상 파일: `site/content/branches.json`, `team.json`, `social.json`, `contact.json`(LINE·WhatsApp·Messenger 링크와 QR) (화면·검증은 `site/admin/app.js`).
    손으로 고쳐도 되지만 JSON 문법이 깨지면 지점·시간표·코치진이 통째로 안 나온다.
  - **관원 · 회비** (왼쪽 맨 위): 관원 등록·퇴원, 연도별 12개월 납부표(✓ 납부 · 미납 · 휴원), 고른 달의 재원·납부·미납·수납액과 미납자 목록, 지점·이름 검색, 엑셀(.xlsx) 내려받기.
    여러 명은 [엑셀 양식]을 받아 채운 뒤 [엑셀 업로드] → 확인 창(추가·이미 있음·오류 줄) → [저장]. 엑셀 처리는 `site/admin/vendor/xlsx.mini.min.js`
    (SheetJS 0.20.3, Apache-2.0, cdn.sheetjs.com 공식 배포본 사본)를 쓸 때만 불러온다.
    레포가 공개라 장부는 `admin-data/members.enc.json` 에 **암호문으로만** 둔다(site/ 밖 — 배포·재배포 없음). 장부 키는 무작위 AES-256 이고
    관리자 비밀번호와 **복구 코드**(장부를 처음 만들 때 한 번 보여 줌)로 각각 감싸 `auth.json` 의 `ledger` 에 둔다. 비밀번호 변경은 키를 다시 감싸고,
    "비밀번호를 잊었어요" 재설정은 복구 코드가 있어야 장부를 살린다(없으면 장부는 못 연다). 커밋 메시지에는 관원 정보를 넣지 않는다.
- 관리자 페이지에 없는 것: 문구·번역(`data.js` 의 `i18n`, `index.html`),
  프로그램 정의(`data.js` 의 `programs`), JSON-LD 의 지점 정보(`index.html`).
- 문구: HTML 원문이 태국어(기본). 영어·한국어는 `data.js` 의 `i18n.en` / `i18n.ko` (키는 HTML 의 `data-i18n`).
  태국어 문구를 고치면 `index.html` 을, 영어·한국어는 `data.js` 를 고친다.
- CSS/JS 를 고치면 `index.html` 의 `?v=` 캐시버스팅 숫자를 올린다.

## 확인 필요 (도장 측)

- Boat Lagoon / Srisoonthorn 시간표는 지점명이 없는 포스터 2장을 추정 배정한 것. 뒤바뀌었으면
  `data.js` 에서 두 지점의 `poster` 와 `schedule` 을 맞바꾼다.
- 2022년 기사에 있던 Limelight Avenue 지점은 구글맵에 없어 제외했다.
- LINE 공식계정은 QR 만 있고 ID 를 모른다. ID 를 받으면 `https://line.me/R/ti/p/@ID` 링크로 바꿀 수 있다.
