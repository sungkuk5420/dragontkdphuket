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

2. feat(about): 소개 섹션 오른쪽에 SEA Games 2022 금메달리스트 타나끄릿 욧락 하이라이트 카드(경기 사진+GOLD 배지) 추가
   - 사진: Bangkok Post 2022-05-18 기사 이미지 4309642(Reuters, 캡션 "Thanakrit Yodrak celebrates winning the men's 58kg title"), OCA 프로필(소속 Dragon Gym 명시) 증명사진과 얼굴 대조. 처음 넣은 Bangkok Insight 경기 사진은 사용자 확인 결과 다른 선수였음 — 기사 본문 서술만 믿고 사진 캡션 없이 고른 게 원인. 보도사진 저작권 미확인.
   - 태국어 닉네임 표기("함만")는 확인 불가라 태국어 카드에선 이름만 표기.

2. fix(branches): 보트라군 지점 제거(도장 확인: 탈랑으로 이전), Srisoonthorn→탈랑 이름 변경, 본관 주소 4/1 ถ.วิรัชหงษ์หยก 로 갱신
   - 사용자가 준 구글맵 링크 ftid 가 기존 등록(본관 0x305031e7501a1d45, 탈랑 0x30503700427ab0bf)과 일치. 구글맵의 보트라군 등록은 아직 영업 중 표시라 도장 측 정보를 우선. 이어서 라임라이트 지점(Limelight Phuket 몰 2/23 Dibuk Rd, 단독 구글 등록 없어 몰 좌표) 추가 → 3개 지점. 포스터 배정은 추정: 라임라이트=빨강, 탈랑=노랑(도장 확인 필요).

3. chore(domain): GitHub Pages 커스텀 도메인 dragongymphuket.com 연결 (고대디 DNS, 사용자 설정)
   - 고대디 기본 `A @ Parked` 레코드가 남아 주차 페이지가 떴음 → 삭제 후 즉시 반영, http→https 301·https 200 확인.
   - site/ 의 canonical·OG·구조화데이터·sitemap·robots·data.js 주소를 새 도메인으로 치환. 다른 작업의 미커밋 변경과 섞여 있어 커밋 미실행.

3. feat(i18n): 언어 버튼 클릭 시 주소창에 ?lang= 동기화 (태국어는 파라미터 제거, history.replaceState)
   - ?lang= 로 열기는 원래 운영에서 동작했음(재현 확인). 빠진 건 버튼→URL 방향이라 보이는 언어 그대로 링크 공유가 안 됐던 것. 저장된 언어로 열릴 때도 주소에 반영.
   - 다른 세션이 나머지 변경을 먼저 커밋해 이 변경만 분리 커밋. 푸시 미실행.

4. fix(instagram): 인스타 연동 계정을 dragon_tkd_poomsae → dragon_gym_taekwondo 로 교체(사용자 지시), 비로그인 노출 최신 릴 3개 임베드. 커밋 이 항목 아래 해시 참조.
   - 이후 사용자가 직접 준 금메달 세리머니 사진(1020²)으로 다시 교체, 카드 비율 3:2→4:3 (얼굴·메달이 잘리지 않게).

3. feat(seo): 링크 미리보기 이미지를 시안 #1(실제 대회 점프킥 사진+타이포)로 교체, 하위 경로용 404.html 추가
   - 기존 og-image.jpg 는 AI 가공 느낌이라 교체. 페북·LINE 캐시를 피하려고 파일명을 og-cover.jpg 로 새로 둠(기존 파일은 삭제 확인 전이라 남겨둠). 높이 629→630.
   - 단일 페이지라 하위 라우트는 GitHub Pages 의 404.html 로 처리: 같은 OG 태그 + 홈으로 이동(쿼리·해시 유지). 404 상태라 일부 크롤러는 미리보기를 안 쓸 수 있음.

5. feat(team): 코치진(유영택 코치 경력 타임라인)·드래곤짐 출신 국가대표 5명 섹션 추가, 챔피언 카드를 SEA Games 2021·2023 금메달 2회로 수정
   - 도장 제공 이미지에서 사진 크롭(assets/team). 누칫 락 선수는 사용자 지시로 제외. 선수 영문·태국어 이름은 한국어 표기에서 옮긴 추정 표기라 도장 검수 필요.

6. feat(team): 코치 사진 인물 표시(왼쪽 최영석 감독·오른쪽 유영택 코치), 최영석(찻차이 최) 태국 국가대표팀 총감독 카드 추가
   - 이력은 사용자 제공 요약(위키백과·조선일보·YTN) 기준. 사용자가 오른쪽 인물을 "유영석"이라 적었으나 도장 이미지·기사 모두 유영택이라 유지(확인 요청).
