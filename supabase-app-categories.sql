-- =====================================================================
-- TEN AI — 앱 16개에 분류·검색 키워드 한 번에 채우기 (선택)
-- ---------------------------------------------------------------------
-- 실행 순서
--   1) supabase-new-apps.sql 을 먼저 실행한다 (컬럼이 있어야 한다)
--   2) 이 파일을 SQL Editor 에 붙여넣고 Run
--        https://supabase.com/dashboard/project/pjulgdlbgaobyvnfjzhe/sql/new
--
-- 무엇을 바꾸나
--   category 와 keywords 두 컬럼만 채운다. 이름·소개·배지·링크 등
--   나머지 값은 건드리지 않는다. 여러 번 실행해도 같은 결과다.
--
-- 이 분류는 '초안'이다
--   각 앱의 이름과 한 줄 소개만 보고 정한 것이라, 실제 용도와 다를 수
--   있다. 마음에 안 드는 줄은 값을 고쳐서 실행하거나, 실행 후 관리자
--   콘솔에서 앱마다 바꾸면 된다.
--
-- 분류 id 는 data-store.js 의 APP_CATEGORIES 와 같다
--   automation 업무 자동화 · document 문서·글쓰기 · data 데이터·분석
--   esg 탄소·ESG · edu 교육·학습 · gov 정부지원·공모
--   biz 경영·금융 · tool 유틸리티
-- =====================================================================

update apps set category = 'tool',       keywords = '압축, 파일, zip, 용량 줄이기, 광고없는, 무료'                          where id = 'mtnvsy3j9acrh';  -- runiqzip
update apps set category = 'esg',        keywords = '탄소, 탄소발자국, 축제, 행사, 배출량, carbon, ESG'                      where id = 'mt5doy6k1bs0g';  -- Festival Carbon
update apps set category = 'document',   keywords = '집필, 글쓰기, 원고, 작문, 저술, 생성형 AI, 포털'                         where id = 'mt5dquaawu5j9';  -- 집필포털
update apps set category = 'gov',        keywords = '국비, 공모, 정부지원사업, 지원금, 보조금, 알림, 파인더'                   where id = 'mt5dv5os98x0v';  -- 국비공모파인더
update apps set category = 'biz',        keywords = 'M&A, 인수합병, 아카데미, 교육, 투자, 프론티어그룹'                        where id = 'mt5dyszoqxzbp';  -- M&A ACADEMY
update apps set category = 'tool',       keywords = '마스크, 필터, 수명, 계산기, 예측, 방진, 교체주기'                        where id = 'mrtvd8nlrj4gc';  -- 필터 수명 계산기
update apps set category = 'esg',        keywords = '탄소, 배출량, 측정, 행사, 다중이용시설, ESG, carbon, 리서치'             where id = 'mtnyuw0do0j7r';  -- 탄소리서치
update apps set category = 'tool',       keywords = '동영상, 영상, 재생기, 플레이어, 무료, video, player'                     where id = 'mttl79ca1ylby';  -- 동영상재생기
update apps set category = 'tool',       keywords = '영상, 인코더, 압축, 용량 줄이기, 변환, encoder, video'                   where id = 'mttug6y6gz5mb';  -- Runinq_incoder
update apps set category = 'document',   keywords = '문서, 검증, 팩트체크, 정합성, 사실확인, fact check, 교정'                where id = 'mu3mpl5l7mltr';  -- doc-fact_chacker
update apps set category = 'tool',       keywords = '홈페이지, 웹사이트, 빌더, 제작, 노코드, builder, 랜딩페이지'             where id = 'mu3mwoxy3t7ew';  -- runiq_builder
update apps set category = 'esg',        keywords = '나무, 식목, 캠페인, 그린, GREEN AX, 리본디어스, 탄소중립'               where id = 'mu3mz1mmrl215';  -- 내 나무 캠페인
update apps set category = 'esg',        keywords = 'TANSO, 탄소, 배출량, 측정기, 행사, 다중이용시설, ESG'                    where id = 'mu3n1c1dcpo4s';  -- TANSO
update apps set category = 'automation', keywords = '마케팅, 자동화, 비즈업, 광고, 캠페인, 마케팅OS'                          where id = 'mu3n3tyyevp2g';  -- 비즈업 마케팅 OS
update apps set category = 'biz',        keywords = '브랜딩, 고성, MVP, 랜딩페이지, 지역브랜드, 블랙뻑'                       where id = 'mu3n5h7659jsj';  -- 블랙뻑
update apps set category = 'gov',        keywords = '국비, 공모, 제안서, 함평군, 지자체, 정부지원, 작성'                      where id = 'mu3n7h4fpxy2q';  -- 국비공모제안서


-- ── 확인 ─────────────────────────────────────────────────────────────
-- 실행 후 아래 주석을 풀면 분류별로 몇 개씩 걸렸는지 한눈에 보인다.
--
-- select coalesce(nullif(category, ''), '(미분류)') as 분류,
--        count(*) as 앱수,
--        string_agg(name, ', ' order by name) as 앱목록
--   from apps
--  group by 1
--  order by 앱수 desc;
