-- =====================================================================
-- TEN AI — 핸드북에 '연결 링크' 컬럼 추가
-- 실행 방법: Supabase 대시보드 > SQL Editor > 새 쿼리 > 붙여넣기 > Run
-- (관리자 콘솔에서 핸드북마다 이동할 URL을 입력할 수 있게 됩니다)
-- =====================================================================

alter table handbooks
  add column if not exists link_url text not null default '';

alter table handbooks
  add column if not exists link_target text not null default '_blank';

alter table handbooks drop constraint if exists handbooks_link_target_check;
alter table handbooks
  add constraint handbooks_link_target_check
  check (link_target in ('_blank', '_self'));
