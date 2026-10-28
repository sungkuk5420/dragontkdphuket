# 작업 로그

## 2026-10-28 (수)

1. docs(estimate): Dragon Gym Taekwondo 공식 사이트 제작 일본어 見積書 작성 (`docs/estimate_ja.html`, 합계 ¥100,000)
   - 12개 항목(기획·디자인/페이지 6+1/타이어 다국어/CMS/SEO/도메인·호스팅 1년/공개·1개월 서포트)으로 정확히 10만엔 배분.
   - 소비세는 국외 역무제공 불과세로 0 처리. 일본 사업자 명의로 발행 시 세별 ¥100,000 + 10% 로 바꿔야 함(보류).
   - 발행자 정보는 공란. main 브랜치라 커밋 미실행(untracked 유지). 아티팩트: https://claude.ai/artifact/GrVCL97mMCQ6bArZ8rtAXx
   - 사용자 지시로 한국어로 전환, 도메인·서버 비용은 별도(고객 카드 직접 청구)로 빼고 12,000 을 UI/하위페이지/CMS/SEO/오픈작업에 재배분해 합계 ¥100,000 유지.

2. feat(site): Dragon Gym Taekwondo Phuket 원페이지 사이트 신규 제작 (`site/`, GitHub Pages 워크플로, 브랜치 `feat/site`, 커밋 257f181)
   - ReizTaekwondo 와 같은 무빌드 정적 구성(GSAP+Lenis, 구글맵 output=embed 키 없음)에 Leaflet+OSM 개요지도·EN/TH 토글·실시간 시간표 하이라이트를 추가. DB 불필요라 Supabase 미도입(문의는 LINE QR·Messenger·전화 링크).
   - 지점 3곳은 구글맵 등록 확인(Suan Luang=Dragon Taekwondo @ Phuket Town 4.8★16, Boat Lagoon 5.0★2, Srisoonthorn 5.0★5). 2022 기사의 Limelight Avenue 지점은 구글맵에 없어 제외. 지점명 없는 포스터 2장은 Boat Lagoon(빨강)/Srisoonthorn(노랑)으로 추정 배정 — 도장 확인 필요. 태국어 문구는 초안(원어민 검수 필요).
   - 레포가 private 이라 무료 Pages 불가 → 사용자가 public 전환 + Pages Source=GitHub Actions 설정해야 배포됨. CARTO 타일은 키 요구로 OSM 표준 타일 사용. 헤드리스 Chrome 최소 폭 500px 라 모바일 캡처는 500px 기준.

3. feat(i18n): 기본 언어 태국어 + ไทย/EN/한국어 전환 버튼(`?lang=ko` 도 지원)
   - HTML 원문을 태국어로 바꾸고(SEO·첫 화면 깜빡임 방지) 영어·한국어는 `data.js` 사전으로 치환. 영어 사전은 기존 HTML 영문에서 스크립트로 추출.
   - 한국어 표시 서체는 Black Han Sans 를 큰 제목에만, 숫자(시간·통계)는 언어 무관 Bebas Neue 로 고정 — 전체 적용 시 탭·시간이 거칠고 줄바꿈됐음.
   - 한국어·태국어 문구 모두 초안. 커밋 미실행 시점에 기록, 아래 커밋 해시 참조.
