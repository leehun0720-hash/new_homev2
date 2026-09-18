-- =====================================================================
-- TEN AI — 홍보 팝업 배너
-- ---------------------------------------------------------------------
-- 실행 위치 (바로 열기):
--   https://supabase.com/dashboard/project/pjulgdlbgaobyvnfjzhe/sql/new
--   대시보드 > SQL Editor > New query > 아래 전체 붙여넣기 > Run
--
-- 실행 후 확인:
--   Table Editor  https://supabase.com/dashboard/project/pjulgdlbgaobyvnfjzhe/editor
--   Storage       https://supabase.com/dashboard/project/pjulgdlbgaobyvnfjzhe/storage/buckets
--
-- ---------------------------------------------------------------------
-- 이 스크립트가 데이터에 미치는 영향
--
--   구분                         | 영향
--   ---------------------------- | -----------------------------------
--   banners 테이블               | 새로 생성 (없을 때만)
--   Storage 'banners' 버킷       | 새로 생성 (없을 때만). 공개 읽기
--   기존 테이블 전부             | 건드리지 않음
--   초기 배너 1건                | runiq space 오픈 홍보 (활성 상태)
--
--   여러 번 실행해도 안전합니다 (if not exists / on conflict do nothing).
-- =====================================================================

-- ---------- 1) 배너 테이블 ----------
create table if not exists banners (
  id          text primary key,
  title       text not null default '',
  body        text not null default '',        -- 본문. 줄바꿈이 그대로 반영된다
  badge       text not null default '',        -- 제목 위 작은 라벨 (예: NEW OPEN)
  image_url   text not null default '',        -- 업로드한 이미지 또는 외부 주소
  image_alt   text not null default '',        -- 대체 텍스트 (화면낭독기·이미지 차단 시)
  link_url    text not null default '',        -- 버튼이 향하는 주소
  link_label  text not null default '자세히 보기',
  active      boolean not null default false,  -- 꺼 두면 아무 데도 안 뜬다
  start_at    bigint not null default 0,       -- 노출 시작(ms). 0 = 제한 없음
  end_at      bigint not null default 0,       -- 노출 종료(ms). 0 = 제한 없음
  sort_order  int    not null default 0,       -- 여러 개가 겹치면 작은 것이 먼저
  created_at  bigint not null
);

create index if not exists banners_active_idx on banners (active, sort_order);

-- ---------- 2) RLS: 누구나 읽기, 쓰기는 관리자만 ----------
alter table banners enable row level security;

drop policy if exists "banners read"  on banners;
drop policy if exists "banners write" on banners;

create policy "banners read"  on banners for select using (true);
create policy "banners write" on banners for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- 3) 이미지 저장소 ----------
-- 관리자 콘솔에서 이미지 파일을 직접 올릴 수 있게 공개 버킷을 만든다.
-- 공개(public=true)로 두는 이유: 배너 이미지는 방문자 누구나 봐야 하고,
-- 서명 URL 은 만료돼 배너가 깨진 이미지로 남는다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('banners', 'banners', true, 5242880,
        array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml'];

drop policy if exists "banner images read"   on storage.objects;
drop policy if exists "banner images write"  on storage.objects;

-- 읽기는 누구나 (배너는 공개 사이트에 뜬다)
create policy "banner images read" on storage.objects
  for select using (bucket_id = 'banners');

-- 올리기·바꾸기·지우기는 관리자만
create policy "banner images write" on storage.objects
  for all to authenticated
  using      (bucket_id = 'banners' and is_admin())
  with check (bucket_id = 'banners' and is_admin());

-- ---------- 4) runiq space 오픈 배너 ----------
-- 바로 뜨도록 active = true 로 넣습니다.
-- 문구·이미지·노출 기간은 관리자 콘솔 > 📣 배너 관리에서 바꿀 수 있습니다.
insert into banners (id, title, body, badge, image_url, image_alt,
                     link_url, link_label, active, start_at, end_at, sort_order, created_at)
values (
  'runiq-open',
  'runiq space 오픈',
  '농축협 현장을 위한 AI 콘텐츠 스튜디오가 문을 열었습니다.
소재 하나로 기획서 · 뉴스레터 · 카드뉴스 · 30초 홍보영상 · 1분 뮤직비디오까지 —
외주 없이, 우리 손으로, 오늘 안에.',
  'NEW OPEN',
  'https://www.runiq.space/opengraph-image',
  'runiq space by tenai — 농축협을 위한 AI 콘텐츠 스튜디오',
  'https://www.runiq.space/',
  'runiq space 둘러보기',
  true, 0, 0, 10,
  (extract(epoch from now()) * 1000)::bigint
)
on conflict (id) do nothing;

-- ---------- 5) 결과 확인 ----------
select id as "배너",
       title as "제목",
       case when active then '노출 중' else '꺼짐' end as "상태",
       case when end_at = 0 then '기한 없음'
            else to_char(to_timestamp(end_at / 1000), 'YYYY-MM-DD') end as "종료일",
       case when image_url = '' then '없음' else '있음' end as "이미지"
from banners
order by sort_order, created_at;
