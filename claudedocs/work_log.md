# 작업 로그

## 2026-10-28 (수)

1. docs(estimate): Dragon Gym Taekwondo 공식 사이트 제작 일본어 見積書 작성 (`docs/estimate_ja.html`, 합계 ¥100,000)
   - 12개 항목(기획·디자인/페이지 6+1/타이어 다국어/CMS/SEO/도메인·호스팅 1년/공개·1개월 서포트)으로 정확히 10만엔 배분.
   - 소비세는 국외 역무제공 불과세로 0 처리. 일본 사업자 명의로 발행 시 세별 ¥100,000 + 10% 로 바꿔야 함(보류).
   - 발행자 정보는 공란. main 브랜치라 커밋 미실행(untracked 유지). 아티팩트: https://claude.ai/artifact/GrVCL97mMCQ6bArZ8rtAXx
   - 사용자 지시로 한국어로 전환, 도메인·서버 비용은 별도(고객 카드 직접 청구). 이후 항목별 금액을 없애고 작업 목록 + 일괄 ¥100,000 형식으로 변경, 납기 1주일·납품 후 지불로 수정.

2. feat(site): Dragon Gym Taekwondo Phuket 원페이지 사이트 신규 제작 (`site/`, GitHub Pages 워크플로, 브랜치 `feat/site`, 커밋 257f181)
   - ReizTaekwondo 와 같은 무빌드 정적 구성(GSAP+Lenis, 구글맵 output=embed 키 없음)에 Leaflet+OSM 개요지도·EN/TH 토글·실시간 시간표 하이라이트를 추가. DB 불필요라 Supabase 미도입(문의는 LINE QR·Messenger·전화 링크).
   - 지점 3곳은 구글맵 등록 확인(Suan Luang=Dragon Taekwondo @ Phuket Town 4.8★16, Boat Lagoon 5.0★2, Srisoonthorn 5.0★5). 2022 기사의 Limelight Avenue 지점은 구글맵에 없어 제외. 지점명 없는 포스터 2장은 Boat Lagoon(빨강)/Srisoonthorn(노랑)으로 추정 배정 — 도장 확인 필요. 태국어 문구는 초안(원어민 검수 필요).
   - 레포가 private 이라 무료 Pages 불가 → 사용자가 public 전환 + Pages Source=GitHub Actions 설정해야 배포됨. CARTO 타일은 키 요구로 OSM 표준 타일 사용. 헤드리스 Chrome 최소 폭 500px 라 모바일 캡처는 500px 기준.

3. feat(i18n): 기본 언어 태국어 + ไทย/EN/한국어 전환 버튼(`?lang=ko` 도 지원)
   - HTML 원문을 태국어로 바꾸고(SEO·첫 화면 깜빡임 방지) 영어·한국어는 `data.js` 사전으로 치환. 영어 사전은 기존 HTML 영문에서 스크립트로 추출.
   - 한국어 표시 서체는 Black Han Sans 를 큰 제목에만, 숫자(시간·통계)는 언어 무관 Bebas Neue 로 고정 — 전체 적용 시 탭·시간이 거칠고 줄바꿈됐음.
   - 한국어·태국어 문구 모두 초안. 커밋 미실행 시점에 기록, 아래 커밋 해시 참조.

4. chore(deploy): feat/site 푸시 → 원격 main 생성(API, 5d6bdca) → 사용자가 레포 public 전환 → Pages(Actions) 활성화·첫 배포 성공 (run 40712525136)
   - 운영 URL https://sungkuk5420.github.io/dragontkdphuket/ 응답 확인. 레포 공개 전환 명령은 자동 모드가 막아 사용자가 직접 실행.

## 2026-10-29 (목)

1. feat(site): 페이스북 최신 게시물 피드·인스타 임베드·포스터 상시 노출·LINE/WhatsApp 직접 연결, 이메일 없는 문의폼 제거
   - 페이지 플러그인 타임라인은 비로그인에도 게시물을 안 그려서 버림. 대신 scripts/fetch-fb-feed.mjs(헤드리스 Chrome+CDP, 의존성 없음)가 공개 페이지를 읽어 site/feed.json+site/feed/img 저장, pages.yml 이 6시간마다 수집·커밋·배포. CI IP 가 로그인 장벽에 막히면 마지막 커밋 피드로 배포(실패 허용).
   - LINE(line.me/ti/p/K2-bgRDOkr)·WhatsApp(wa.me/qr/YKCJST5QMUUOA1) 링크는 사용자가 준 QR 을 OpenCV 로 디코드. 인스타 dragon_tkd_poomsae 게시물은 2020년 것 4개뿐(프로필 최신분). String.replace 치환문자열의 $$→$ 변환으로 main.js 가 깨졌던 사고 있음 — 치환은 함수로 넘길 것.
   - CI 첫 수집은 로그인 장벽으로 1건만 읽혀 12건 피드를 덮어씀 → 교체 대신 병합(새 글 앞, 기존 글 유지, 최대 12건)으로 수정하고 로컬 수집으로 12건 복구.
