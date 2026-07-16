-- =====================================================================
-- TEN AI 사이트 — Supabase 테이블 생성 스크립트
-- 실행 방법: Supabase 대시보드 > SQL Editor > 붙여넣기 > Run
-- =====================================================================

-- 1) 사이트 설정 (단일 행 jsonb)
create table if not exists site (
  id   text primary key,
  data jsonb not null default '{}'
);

-- 2) 게시물
create table if not exists posts (
  id         text primary key,
  title      text not null,
  category   text not null default '공지',
  content    text not null default '',
  pinned     boolean not null default false,
  created_at bigint not null
);

-- 3) Q&A
create table if not exists qna (
  id          text primary key,
  name        text not null default '익명',
  email       text not null default '',
  question    text not null,
  answer      text not null default '',
  status      text not null default 'pending',
  is_public   boolean not null default false,
  created_at  bigint not null,
  answered_at bigint
);

-- 4) RLS(행 수준 보안) 활성화 + 프로토타입용 정책
--    ※ 운영 시 반드시 강화: Supabase Auth로 관리자를 인증하고
--      쓰기(update/delete) 정책을 관리자 역할로 제한하세요.
alter table site  enable row level security;
alter table posts enable row level security;
alter table qna   enable row level security;

drop policy if exists "site read"   on site;
drop policy if exists "site write"  on site;
drop policy if exists "posts read"  on posts;
drop policy if exists "posts write" on posts;
drop policy if exists "qna read"    on qna;
drop policy if exists "qna write"   on qna;

create policy "site read"   on site  for select using (true);
create policy "site write"  on site  for all    using (true) with check (true);
create policy "posts read"  on posts for select using (true);
create policy "posts write" on posts for all    using (true) with check (true);
create policy "qna read"    on qna   for select using (true);
create policy "qna write"   on qna   for all    using (true) with check (true);

-- 5) 초기 예시 데이터 (선택)
insert into posts (id, title, category, content, pinned, created_at) values
  ('p1', 'TEN AI 웹사이트가 새롭게 리뉴얼되었습니다', '공지',
   E'과정별·레벨별 핸드북 탐색기, 대표님 강의 연동, TEN AI Apps 쇼케이스, 멤버십까지 — 새로워진 TEN AI 플랫폼을 소개합니다.\n\n앞으로 이 게시판을 통해 교육 일정과 새로운 소식을 빠르게 전해드리겠습니다.',
   true, (extract(epoch from now()) * 1000)::bigint)
on conflict (id) do nothing;

insert into qna (id, name, question, answer, status, is_public, created_at, answered_at) values
  ('q1', '김학습', '비개발자도 바이브코딩 과정을 따라갈 수 있나요?',
   '네, 가능합니다. 바이브코딩 Level 1은 코딩 경험이 전혀 없는 분을 기준으로 설계되어 있으며, 자연어로 AI와 대화하며 결과물을 만드는 방식이라 프로그래밍 문법을 몰라도 참여할 수 있습니다.',
   'answered', true,
   (extract(epoch from now()) * 1000)::bigint,
   (extract(epoch from now()) * 1000)::bigint)
on conflict (id) do nothing;
