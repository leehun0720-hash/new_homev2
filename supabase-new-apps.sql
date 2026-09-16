-- =====================================================================
-- TEN AI — 앱에 '신규(NEW) 표시' + '분류·검색 키워드' 컬럼 추가
-- ---------------------------------------------------------------------
-- 실행 방법
--   Supabase 대시보드 > SQL Editor > New query > 아래 전체 붙여넣기 > Run
--
-- 이 SQL 이 하는 일
--   apps 테이블에 컬럼 네 개와 인덱스 두 개를 더한다. 기존 데이터는
--   건드리지 않으며, 여러 번 실행해도 안전하다(add column if not exists).
--     1부 — 신규앱 안내판용 : is_new, released_at
--     2부 — 쇼케이스 검색용 : category, keywords
--
-- 홈페이지의 '신규앱 안내판'은 아래 두 값으로 노출 대상을 정한다.
--   1) is_new 가 true 인 앱         → 항상 NEW
--   2) released_at 이 최근 30일 이내 → 관리자가 잊어도 자동으로 NEW
--
-- 실행 전까지 안내판은 '새로 공개된 앱이 없습니다'로 조용히 비어 있고,
-- 검색은 이름·한 줄 소개만으로 동작한다. 사이트는 어느 쪽이든 정상이다.
-- =====================================================================


-- ═════════════════════════════════════════════════════════════════════
-- 1부 — 신규앱 안내판
-- ═════════════════════════════════════════════════════════════════════


-- ── 1) NEW 배지 고정 노출 여부 ────────────────────────────────────────
-- 관리자 콘솔의 'NEW 로 고정 노출' 체크박스가 이 값을 쓴다.
alter table apps
  add column if not exists is_new boolean not null default false;


-- ── 2) 공개일 (밀리초 단위 정수) ──────────────────────────────────────
-- 관리자 콘솔의 '공개일' 입력이 이 값을 쓴다.
-- 0 이면 '공개 준비 중'으로 표시되고, 값이 있으면 안내판 정렬 기준이 된다.
alter table apps
  add column if not exists released_at bigint not null default 0;


-- ── 3) 최신순 조회용 보조 인덱스 ──────────────────────────────────────
create index if not exists apps_released_at_idx on apps (released_at desc);


-- ═════════════════════════════════════════════════════════════════════
-- 2부 — 쇼케이스 검색
-- ═════════════════════════════════════════════════════════════════════

-- ── 4) 분류 ──────────────────────────────────────────────────────────
-- 쇼케이스 상단의 분류 칩과 관리자 콘솔의 '분류' 선택이 이 값을 쓴다.
-- 값은 data-store.js 의 APP_CATEGORIES 와 같은 id 를 쓴다.
--   automation 업무 자동화 · document 문서·글쓰기 · data 데이터·분석
--   esg 탄소·ESG · edu 교육·학습 · gov 정부지원·공모
--   biz 경영·금융 · tool 유틸리티
-- 빈 값이면 '미분류'로 두고 검색에는 그대로 잡힌다.
alter table apps
  add column if not exists category text not null default '';


-- ── 5) 검색 키워드 ───────────────────────────────────────────────────
-- 쉼표로 구분한 자유 입력. 앱 이름에 없는 말로도 찾게 해 준다.
-- 예: '탄소, 배출량, 계산기, carbon, LCA'
alter table apps
  add column if not exists keywords text not null default '';


-- ── 6) 분류별 조회용 보조 인덱스 ─────────────────────────────────────
create index if not exists apps_category_idx on apps (category);


-- =====================================================================
-- 여기까지가 필수. 아래는 선택 사항이다.
-- =====================================================================

-- ── (선택) 가장 최근에 등록한 앱 2개를 바로 NEW 로 걸어 두기 ──────────
-- 안내판이 어떻게 보이는지 즉시 확인하고 싶을 때 쓴다.
-- 공개일은 '오늘'로 넣으므로 30일 뒤 자동으로 NEW 가 내려간다.
-- 필요 없으면 이 블록은 건너뛰고, 관리자 콘솔에서 앱마다 지정하면 된다.
--
-- update apps
--    set is_new      = true,
--        released_at = (extract(epoch from now()) * 1000)::bigint
--  where id in (
--        select id from apps order by created_at desc limit 2
--  );


-- ── (확인) 실행이 잘 됐는지 보는 조회 ─────────────────────────────────
-- 아래를 실행하면 컬럼이 생겼는지, 어떤 앱이 NEW 로 걸렸는지 한눈에 보인다.
--
-- select id,
--        name,
--        coalesce(nullif(category, ''), '미분류') as 분류,
--        coalesce(nullif(keywords, ''), '(없음)') as 검색키워드,
--        is_new,
--        case when released_at = 0
--             then '미지정'
--             else to_char(to_timestamp(released_at / 1000), 'YYYY-MM-DD')
--        end as 공개일,
--        (is_new or (released_at > 0
--                    and released_at > (extract(epoch from now()) - 30*24*60*60) * 1000))
--            as 안내판_노출
--   from apps
--  order by released_at desc, created_at desc;
