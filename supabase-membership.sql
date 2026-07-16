-- =====================================================================
-- TEN AI — 회원가입 기능 + 회원/관리자 역할 분리 스크립트
-- 실행 방법: Supabase 대시보드 > SQL Editor > 새 쿼리 > 붙여넣기 > Run
--
-- ★ 이 SQL 실행 후 대시보드에서 해야 할 일:
--   1) Authentication > Sign In / Providers > Email
--      - "Allow new users to sign up" 켜기 (회원가입 허용)
--      - "Confirm email" 끄기 (가입 즉시 로그인 — 원하면 켜도 됨)
--   ※ 기존 관리자 계정은 이 스크립트가 자동으로 admin 역할로 지정합니다.
--     반드시 회원가입을 켜기 전에 이 스크립트를 먼저 실행하세요.
-- =====================================================================

-- ---------- 1) 회원 프로필 테이블 ----------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null default '',
  address    text not null default '',
  company    text not null default '',
  position   text not null default '',
  role       text not null default 'member',   -- 'member' | 'admin'
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- ---------- 2) 관리자 판별 함수 (RLS에서 사용) ----------
create or replace function is_admin() returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- 3) profiles 정책: 본인 것만 조회/수정, 역할 변경 불가 ----------
drop policy if exists "profiles own read"   on profiles;
drop policy if exists "profiles own update" on profiles;
drop policy if exists "profiles admin read" on profiles;

create policy "profiles own read" on profiles
  for select using (auth.uid() = id or is_admin());
create policy "profiles own update" on profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from profiles where id = auth.uid()));

-- ---------- 4) 가입 시 프로필 자동 생성 트리거 ----------
-- 회원가입할 때 전달한 주소/회사/직급(user_metadata)을 profiles에 복사
create or replace function handle_new_user() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, address, company, position)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'address', ''),
    coalesce(new.raw_user_meta_data->>'company', ''),
    coalesce(new.raw_user_meta_data->>'position', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- 5) 기존 계정(현재 관리자)을 admin 역할로 지정 ----------
insert into profiles (id, email, role)
select id, coalesce(email, ''), 'admin' from auth.users
on conflict (id) do update set role = 'admin';

-- ---------- 6) 기존 정책을 '로그인 사용자' → '관리자 역할'로 교체 ----------
-- (이걸 안 하면 일반 회원도 게시물/설정을 수정할 수 있게 됩니다)
drop policy if exists "site admin write"  on site;
create policy "site admin write" on site
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "posts admin write" on posts;
create policy "posts admin write" on posts
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "qna public read"   on qna;
drop policy if exists "qna admin read"    on qna;
drop policy if exists "qna admin insert"  on qna;
drop policy if exists "qna admin update"  on qna;
drop policy if exists "qna admin delete"  on qna;

-- 공개 답변은 익명·회원 모두 조회 가능, 전체 조회는 관리자만
create policy "qna public read" on qna
  for select using ((is_public = true and status = 'answered') or is_admin());
create policy "qna member insert" on qna
  for insert with check (
    is_admin() or (status = 'pending' and is_public = false and answer = '')
  );
create policy "qna admin update" on qna
  for update to authenticated using (is_admin()) with check (is_admin());
create policy "qna admin delete" on qna
  for delete to authenticated using (is_admin());
