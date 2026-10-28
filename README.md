https://www.facebook.com/dragongymtaekwondo/reels/

# Dragon Gym Taekwondo Phuket — 공식 사이트

푸켓 태권도장 **Dragon Gym Taekwondo**(ดราก้อนยิม เทควันโด ภูเก็ต) 의 원페이지 사이트.
빌드 없는 정적 HTML/CSS/JS 이고 GitHub Pages 에 무료로 배포한다. DB·서버 없음.

- 운영 URL(예정): https://sungkuk5420.github.io/dragontkdphuket/
- 페이스북: https://www.facebook.com/dragongymtaekwondo · 인스타: https://www.instagram.com/dragon_gym_taekwondo/
- 본점: Suan Luang(사이트의 메인 체육관). 지점: Boat Lagoon(Ko Kaeo), Srisoonthorn(Thalang)

## 구성

```
site/
  index.html        원페이지(히어로·소개·프로그램·지점+지도·시간표·페이스북·체험문의·FAQ) + JSON-LD
  styles.css        디자인 토큰(금/검/적), 섹션 스타일, 리빌 애니메이션
  main.js           인터랙션(GSAP·Lenis·커서·틸트·시간표 실시간 하이라이트·지도·폼·언어 전환 ไทย/EN/한국어)
  data.js           지점·좌표·전화·시간표·릴스 ID·인스타 코드·LINE/WhatsApp 링크·영어/한국어 번역
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

- 시간표·전화·주소·좌표: `site/data.js` 의 `branches`. 포스터 이미지는 `assets/schedule-*.jpg|webp`.
- 릴스: 페이스북 페이지 `/reels/` 에서 릴 URL 의 숫자 ID 를 `data.js` 의 `reels` 에 넣는다(앞 6개 표시).
- 문구: HTML 원문이 태국어(기본). 영어·한국어는 `data.js` 의 `i18n.en` / `i18n.ko` (키는 HTML 의 `data-i18n`).
  태국어 문구를 고치면 `index.html` 을, 영어·한국어는 `data.js` 를 고친다.
- CSS/JS 를 고치면 `index.html` 의 `?v=` 캐시버스팅 숫자를 올린다.

## 확인 필요 (도장 측)

- Boat Lagoon / Srisoonthorn 시간표는 지점명이 없는 포스터 2장을 추정 배정한 것. 뒤바뀌었으면
  `data.js` 에서 두 지점의 `poster` 와 `schedule` 을 맞바꾼다.
- 2022년 기사에 있던 Limelight Avenue 지점은 구글맵에 없어 제외했다.
- LINE 공식계정은 QR 만 있고 ID 를 모른다. ID 를 받으면 `https://line.me/R/ti/p/@ID` 링크로 바꿀 수 있다.
