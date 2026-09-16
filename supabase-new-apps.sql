-- =====================================================================
-- TEN AI — 앱에 '신규(NEW) 표시' 컬럼 추가
-- 실행 방법: Supabase 대시보드 > SQL Editor > 새 쿼리 > 붙여넣기 > Run
-- (관리자 콘솔에서 앱마다 NEW 배지와 공개일을 지정할 수 있게 됩니다)
--
-- 홈페이지의 '신규앱 안내판'은 아래 두 값으로 노출 대상을 정합니다.
--   1) is_new 가 true 인 앱            → 항상 NEW
--   2) released_at 이 최근 30일 이내    → 관리자가 잊어도 자동으로 NEW
-- =====================================================================

alter table apps
  add column if not exists is_new boolean not null default false;

alter table apps
  add column if not exists released_at bigint not null default 0;

-- 공개일이 있는 앱을 최신순으로 뽑을 때 쓰는 보조 인덱스
create index if not exists apps_released_at_idx on apps (released_at desc);

-- 기존 예시 데이터에 신규 표시를 달아 두고 싶다면 아래 주석을 풀어 실행하세요.
-- update apps set is_new = true, released_at = (extract(epoch from now()) * 1000)::bigint
--   where id in ('a3', 'a4');
