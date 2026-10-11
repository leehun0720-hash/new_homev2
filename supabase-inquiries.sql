-- =====================================================================
-- TEN AI — 상담 신청서
-- ---------------------------------------------------------------------
-- 실행 위치 (바로 열기):
--   https://supabase.com/dashboard/project/pjulgdlbgaobyvnfjzhe/sql/new
--   대시보드 > SQL Editor > New query > 아래 전체 붙여넣기 > Run
--
-- 실행 후 확인:
--   관리자 콘솔(/admin) > '상담 신청' 탭
--   이 스크립트를 돌리기 전에는 사이트의 신청서가 '메일로 보내기'로 이어진다
--   (신청 내용이 담긴 메일 쓰기 화면) — 그러니 먼저 배포해도 문의가 사라지지 않는다.
--
-- ---------------------------------------------------------------------
-- 이 스크립트가 데이터에 미치는 영향
--
--   구분                          | 영향
--   ----------------------------- | -----------------------------------
--   inquiries 테이블              | 새로 생성 (없을 때만)
--   submit_inquiry() 함수         | 새로 생성 / 같은 이름이면 교체
--   admin_list_inquiries() 함수   | 새로 생성 / 같은 이름이면 교체
--   admin_set_inquiry_status()    | 새로 생성 / 같은 이름이면 교체
--   admin_delete_inquiry()        | 새로 생성 / 같은 이름이면 교체
--   기존 테이블 전부              | 건드리지 않음
--
--   여러 번 실행해도 안전합니다 (if not exists / create or replace).
--
-- ---------------------------------------------------------------------
-- 무엇을 받는가 (개인정보 처리방침 '상담 신청' 항목과 같다)
--
--   필수 | 이름 · 이메일 · 문의 내용 · 개인정보 수집·이용 동의
--   선택 | 소속(회사·기관) · 전화번호 · 문의 종류
--   함께 | 신청한 쪽 주소(/business 등) · 접수 시각
--   보유 | 접수일로부터 1년. 지난 신청은 이 함수가 가끔(약 20번에 1번) 스스로 지운다.
--
-- ---------------------------------------------------------------------
-- 보안 구조 (supabase-visits.sql 과 같은 방식)
--
--   inquiries 는 RLS 를 켜고 정책을 하나도 두지 않는다.
--   → 방문자(anon)도 로그인 회원(authenticated)도 표를 직접 못 읽고 못 쓴다.
--
--   쓰기는 submit_inquiry() 하나로만 한다. 값의 형식을 하나하나 검사하고,
--   어긋나면 'invalid' 를 돌려준다. 짧은 시간에 몰리면 'busy' 를 돌려준다.
--     · 사이트 전체로 10분에 20건
--     · 같은 이메일로 1시간에 3건
--
--   읽기·상태 바꾸기·지우기는 admin_* 함수로만 한다. 맨 처음에 is_admin() 을
--   확인하고, 관리자가 아니면 오류로 끝낸다.
--   is_admin() 은 이미 있는 것을 그대로 쓴다 (supabase-membership.sql).
-- =====================================================================

-- ---------- 1) 신청 테이블 ----------
create table if not exists inquiries (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  kind        text not null default 'etc',
  name        text not null,
  org         text,
  email       text not null,
  phone       text,
  message     text not null,
  page        text,
  status      text not null default 'new',      -- new 새 신청 · doing 진행 중 · done 끝남
  handled_at  timestamptz,
  constraint inquiries_kind_chk    check (kind in ('edu', 'ax', 'aidc', 'si', 'runiq', 'etc')),
  constraint inquiries_name_chk    check (char_length(name) between 1 and 40),
  constraint inquiries_org_chk     check (org is null or char_length(org) <= 80),
  constraint inquiries_email_chk   check (char_length(email) <= 120 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint inquiries_phone_chk   check (phone is null or phone ~ '^[0-9+() -]{7,20}$'),
  constraint inquiries_message_chk check (char_length(message) between 5 and 2000),
  constraint inquiries_page_chk    check (page is null or page ~ '^/[a-z0-9/_-]{0,80}$'),
  constraint inquiries_status_chk  check (status in ('new', 'doing', 'done'))
);

create index if not exists inquiries_created_idx on inquiries (created_at desc);
create index if not exists inquiries_email_idx   on inquiries (email, created_at);

alter table inquiries enable row level security;
revoke all on inquiries from anon, authenticated;
-- 정책을 일부러 두지 않는다. 드나듦은 아래 함수로만 한다.

-- ---------- 2) 신청 받기 — 방문자 브라우저가 부른다 ----------
create or replace function submit_inquiry(
  p_kind    text,
  p_name    text,
  p_org     text,
  p_email   text,
  p_phone   text,
  p_message text,
  p_page    text default null
) returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_name    text := btrim(coalesce(p_name, ''));
  v_org     text := nullif(btrim(coalesce(p_org, '')), '');
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_phone   text := nullif(btrim(coalesce(p_phone, '')), '');
  v_message text := btrim(coalesce(p_message, ''));
  v_kind    text := coalesce(nullif(btrim(coalesce(p_kind, '')), ''), 'etc');
  v_page    text := nullif(btrim(coalesce(p_page, '')), '');
begin
  -- 형식 검사 (어긋나면 'invalid' — 화면이 무엇을 고칠지 알려 준다)
  if v_kind not in ('edu', 'ax', 'aidc', 'si', 'runiq', 'etc') then v_kind := 'etc'; end if;
  if char_length(v_name) not between 1 and 40 then return 'invalid'; end if;
  if v_org is not null and char_length(v_org) > 80 then return 'invalid'; end if;
  if char_length(v_email) > 120 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then return 'invalid'; end if;
  if v_phone is not null and v_phone !~ '^[0-9+() -]{7,20}$' then return 'invalid'; end if;
  if char_length(v_message) not between 5 and 2000 then return 'invalid'; end if;
  if v_page is not null and v_page !~ '^/[a-z0-9/_-]{0,80}$' then v_page := null; end if;

  -- 몰림 막기
  if (select count(*) from inquiries where created_at > now() - interval '10 minutes') >= 20 then
    return 'busy';
  end if;
  if (select count(*) from inquiries where email = v_email and created_at > now() - interval '1 hour') >= 3 then
    return 'busy';
  end if;

  insert into inquiries (kind, name, org, email, phone, message, page)
  values (v_kind, v_name, v_org, v_email, v_phone, v_message, v_page);

  -- 보유 기간 1년: 약 20번에 1번, 지난 신청을 지운다
  if random() < 0.05 then
    delete from inquiries where created_at < now() - interval '1 year';
  end if;

  return 'ok';
end;
$$;

revoke all on function submit_inquiry(text, text, text, text, text, text, text) from public;
grant execute on function submit_inquiry(text, text, text, text, text, text, text) to anon, authenticated;

-- ---------- 3) 관리자 — 목록 ----------
create or replace function admin_list_inquiries(p_limit int default 300)
returns setof inquiries
language plpgsql security definer stable
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
    select * from inquiries
     order by created_at desc
     limit least(greatest(coalesce(p_limit, 300), 1), 1000);
end;
$$;

-- ---------- 4) 관리자 — 상태 바꾸기 ----------
create or replace function admin_set_inquiry_status(p_id bigint, p_status text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_status not in ('new', 'doing', 'done') then
    raise exception 'bad status' using errcode = '22023';
  end if;
  update inquiries
     set status = p_status,
         handled_at = case when p_status = 'done' then now() else null end
   where id = p_id;
end;
$$;

-- ---------- 5) 관리자 — 지우기 (삭제 요청을 받았을 때) ----------
create or replace function admin_delete_inquiry(p_id bigint)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  delete from inquiries where id = p_id;
end;
$$;

revoke all on function admin_list_inquiries(int)              from public, anon;
revoke all on function admin_set_inquiry_status(bigint, text) from public, anon;
revoke all on function admin_delete_inquiry(bigint)           from public, anon;
grant execute on function admin_list_inquiries(int)              to authenticated;
grant execute on function admin_set_inquiry_status(bigint, text) to authenticated;
grant execute on function admin_delete_inquiry(bigint)           to authenticated;

-- ---------- 6) 확인 ----------
-- 아래 결과에 다섯 줄(테이블 1 · 함수 4)이 보이면 끝.
select 'table'    as kind, 'inquiries'                as name where to_regclass('public.inquiries') is not null
union all
select 'function',          'submit_inquiry'           where exists (select 1 from pg_proc where proname = 'submit_inquiry')
union all
select 'function',          'admin_list_inquiries'     where exists (select 1 from pg_proc where proname = 'admin_list_inquiries')
union all
select 'function',          'admin_set_inquiry_status' where exists (select 1 from pg_proc where proname = 'admin_set_inquiry_status')
union all
select 'function',          'admin_delete_inquiry'     where exists (select 1 from pg_proc where proname = 'admin_delete_inquiry');
