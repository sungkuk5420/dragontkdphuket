# 작업 로그

## 2026-10-28 (수)

1. docs(estimate): Dragon Gym Taekwondo 공식 사이트 제작 일본어 見積書 작성 (`docs/estimate_ja.html`, 합계 ¥100,000)
   - 12개 항목(기획·디자인/페이지 6+1/타이어 다국어/CMS/SEO/도메인·호스팅 1년/공개·1개월 서포트)으로 정확히 10만엔 배분.
   - 소비세는 국외 역무제공 불과세로 0 처리. 일본 사업자 명의로 발행 시 세별 ¥100,000 + 10% 로 바꿔야 함(보류).
   - 발행자 정보는 공란. main 브랜치라 커밋 미실행(untracked 유지). 아티팩트: https://claude.ai/artifact/GrVCL97mMCQ6bArZ8rtAXx

2. feat(site): Dragon Gym Taekwondo Phuket 원페이지 사이트 신규 제작 (`site/`, GitHub Pages 워크플로, 브랜치 `feat/site`, 커밋 257f181)
   - ReizTaekwondo 와 같은 무빌드 정적 구성(GSAP+Lenis, 구글맵 output=embed 키 없음)에 Leaflet+OSM 개요지도·EN/TH 토글·실시간 시간표 하이라이트를 추가. DB 불필요라 Supabase 미도입(문의는 LINE QR·Messenger·전화 링크).
   - 지점 3곳은 구글맵 등록 확인(Suan Luang=Dragon Taekwondo @ Phuket Town 4.8★16, Boat Lagoon 5.0★2, Srisoonthorn 5.0★5). 2022 기사의 Limelight Avenue 지점은 구글맵에 없어 제외. 지점명 없는 포스터 2장은 Boat Lagoon(빨강)/Srisoonthorn(노랑)으로 추정 배정 — 도장 확인 필요. 태국어 문구는 초안(원어민 검수 필요).
   - 레포가 private 이라 무료 Pages 불가 → 사용자가 public 전환 + Pages Source=GitHub Actions 설정해야 배포됨. CARTO 타일은 키 요구로 OSM 표준 타일 사용. 헤드리스 Chrome 최소 폭 500px 라 모바일 캡처는 500px 기준.
