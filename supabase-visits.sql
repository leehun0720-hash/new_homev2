-- =====================================================================
-- TEN AI — 홈페이지 접속 통계
-- ---------------------------------------------------------------------
-- 실행 위치 (바로 열기):
--   https://supabase.com/dashboard/project/pjulgdlbgaobyvnfjzhe/sql/new
--   대시보드 > SQL Editor > New query > 아래 전체 붙여넣기 > Run
--
-- 실행 후 확인:
--   관리자 콘솔(/admin) > '접속 통계' 탭
--   기록은 개인정보 처리방침 시행일(2026-10-16)부터 쌓인다.
--
-- ---------------------------------------------------------------------
-- 이 스크립트가 데이터에 미치는 영향
--
--   구분                         | 영향
--   ---------------------------- | -----------------------------------
--   page_views 테이블            | 새로 생성 (없을 때만)
--   track_view() 함수            | 새로 생성 / 같은 이름이면 교체
--   admin_visit_stats() 함수     | 새로 생성 / 같은 이름이면 교체
--   기존 테이블 전부             | 건드리지 않음
--
--   여러 번 실행해도 안전합니다 (if not exists / create or replace).
--
-- ---------------------------------------------------------------------
-- 무엇을 기록하고, 무엇을 기록하지 않는가
--
--   기록한다   | 본 쪽 주소(/biz 등) · 들어온 사이트 이름(google.com 등)
--              | 기기 종류(모바일/태블릿/데스크톱) · 시각
--              | '오늘 처음 왔는가' · '이 탭에서 처음 연 쪽인가' (예/아니오)
--   기록 안 함 | IP 주소 · 이름 · 이메일 · 방문자를 구별하는 번호
--              | 검색어 · 들어온 주소의 나머지 부분
--
--   방문자를 구별하는 번호가 없으므로 이 표의 어느 줄도 사람과 이어지지
--   않는다. 하루 방문자 수는 '오늘 처음 왔다'고 표시된 줄의 수로 센다.
--   (국내 홈페이지의 TODAY / TOTAL 방문자 카운터와 같은 셈법)
--
--   다음 경우에는 아예 보내지 않는다 (site.js 에서 거른다):
--     · tenai.kr 이 아닌 주소 (배포 미리보기·로컬 개발)
--     · 자동화 브라우저 (검사 도구·크롤러)
--     · '추적 안 함(DNT)' 또는 GPC 를 켠 브라우저
--     · 개인정보 처리방침 시행일 전
--
-- ---------------------------------------------------------------------
-- 보안 구조
--
--   page_views 는 RLS 를 켜고 정책을 하나도 두지 않는다.
--   → 방문자(anon)도 로그인 회원(authenticated)도 표를 직접 못 읽고 못 쓴다.
--
--   쓰기는 track_view() 하나로만 한다. 값의 형식을 하나하나 검사하고,
--   어긋나면 아무것도 하지 않고 조용히 끝낸다. 사이트 전체로 1분에
--   600건을 넘기면 더 받지 않는다(일부러 퍼붓는 호출 방어).
--   1년이 지난 기록은 이 함수가 가끔(약 100번에 1번) 스스로 지운다 —
--   처리방침의 보유 기간(1년)을 따로 손대지 않아도 지키게 하려는 것이다.
--
--   읽기는 admin_visit_stats() 하나로만 한다. 맨 처음에 is_admin() 을
--   확인하고, 관리자가 아니면 오류로 끝낸다. 낱낱의 기록이 아니라
--   합계만 돌려준다.
--
--   is_admin() 은 이미 있는 것을 그대로 쓴다 (supabase-membership.sql).
--   여기서 다시 정의하지 않는 이유: 운영 DB 의 정의가 그 뒤에 바뀌었더라도
--   이 스크립트가 옛 정의로 덮어쓰지 않게 하려는 것이다.
-- =====================================================================

-- ---------- 1) 기록 테이블 ----------
create table if not exists page_views (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  path          text    not null,
  referrer_host text,
  device        text    not null,
  is_entry      boolean not null default false,   -- 이 탭에서 처음 연 쪽
  is_new        boolean not null default false,   -- 이 브라우저가 오늘 처음 온 것
  constraint page_views_path_chk   check (path ~ '^/[a-z0-9/_-]{0,80}$'),
  constraint page_views_ref_chk    check (referrer_host is null or referrer_host ~ '^[a-z0-9.-]{1,120}$'),
  constraint page_views_device_chk check (device in ('mobile', 'tablet', 'desktop'))
);

create index if not exists page_views_created_idx on page_views (created_at);

alter table page_views enable row level security;
revoke all on page_views from anon, authenticated;
-- 정책을 일부러 두지 않는다. 드나듦은 아래 두 함수로만 한다.

-- ---------- 2) 기록 함수 — 방문자 브라우저가 부른다 ----------
create or replace function track_view(
  p_path   text,
  p_ref    text,
  p_device text,
  p_entry  boolean default false,
  p_new    boolean default false
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  -- 형식이 어긋나면 오류 없이 버린다 (방문자 화면에 아무 영향도 주지 않게)
  if p_path   is null or p_path !~ '^/[a-z0-9/_-]{0,80}$' then return; end if;
  if p_device is null or p_device not in ('mobile', 'tablet', 'desktop') then return; end if;
  if p_ref is not null and p_ref !~ '^[a-z0-9.-]{1,120}$' then
    p_ref := null;
  end if;

  -- 사이트 전체로 1분에 600건을 넘기면 더 받지 않는다
  if (select count(*) from page_views
        where created_at > now() - interval '1 minute') >= 600 then
    return;
  end if;

  insert into page_views (path, referrer_host, device, is_entry, is_new)
  values (p_path, p_ref, p_device, coalesce(p_entry, false), coalesce(p_new, false));

  -- 보유 기간 1년: 약 100번에 1번, 지난 기록을 지운다
  if random() < 0.01 then
    delete from page_views where created_at < now() - interval '1 year';
  end if;
end;
$$;

revoke all on function track_view(text, text, text, boolean, boolean) from public;
grant execute on function track_view(text, text, text, boolean, boolean) to anon, authenticated;

-- ---------- 3) 통계 함수 — 관리자 콘솔이 부른다 ----------
-- 날짜는 한국 시간(Asia/Seoul) 자정 기준으로 자른다.
--   방문자   = '오늘 처음 왔다'고 표시된 줄 수 (하루 단위 순 방문자를 더한 값)
--   방문 수  = 탭을 새로 열고 들어온 횟수
--   페이지뷰 = 쪽을 연 횟수
create or replace function admin_visit_stats(p_days int default 30)
returns json
language plpgsql security definer stable
set search_path = public
as $$
declare
  n_days  int  := least(greatest(coalesce(p_days, 30), 1), 365);
  kst     text := 'Asia/Seoul';
  d_today date;
  d_since date;
  result  json;
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  d_today := (now() at time zone kst)::date;
  d_since := d_today - (n_days - 1);

  with v as (
    select (created_at at time zone kst)::date as d,
           path, referrer_host, device, is_entry, is_new
      from page_views
     where created_at >= (d_since::timestamp at time zone kst)
  )
  select json_build_object(
    'days',  n_days,
    'since', d_since,
    'today', d_today,
    'first', (select min(created_at at time zone kst)::date from page_views),
    'totals', json_build_object(
      'views',          (select count(*) from v),
      'visitors',       (select count(*) from v where is_new),
      'visits',         (select count(*) from v where is_entry),
      'today_views',    (select count(*) from v where d = d_today),
      'today_visitors', (select count(*) from v where d = d_today and is_new),
      'all_views',      (select count(*) from page_views),
      'all_visitors',   (select count(*) from page_views where is_new)
    ),
    'daily', (
      select coalesce(json_agg(json_build_object(
               'day',      g.day::date,
               'views',    coalesce(x.views, 0),
               'visitors', coalesce(x.visitors, 0)
             ) order by g.day), '[]'::json)
        from generate_series(d_since::timestamp, d_today::timestamp, interval '1 day') as g(day)
        left join (
          select d, count(*) as views, count(*) filter (where is_new) as visitors
            from v group by d
        ) x on x.d = g.day::date
    ),
    'pages', (
      select coalesce(json_agg(t), '[]'::json) from (
        select path, count(*) as views
          from v group by path
         order by views desc, path
         limit 10
      ) t
    ),
    'referrers', (
      select coalesce(json_agg(t), '[]'::json) from (
        select coalesce(referrer_host, '') as host, count(*) as visits
          from v where is_entry
         group by referrer_host
         order by visits desc, host
         limit 10
      ) t
    ),
    'devices', (
      select coalesce(json_agg(t), '[]'::json) from (
        select device,
               count(*) filter (where is_new) as visitors,
               count(*) as views
          from v group by device
         order by views desc, device
      ) t
    )
  ) into result;

  return result;
end;
$$;

revoke all on function admin_visit_stats(int) from public;
grant execute on function admin_visit_stats(int) to authenticated;

-- ---------- 4) 확인 ----------
-- 아래 결과에 세 줄(테이블 1 · 함수 2)이 보이면 끝.
select 'table'    as kind, 'page_views'        as name where to_regclass('public.page_views') is not null
union all
select 'function',          'track_view'        where exists (select 1 from pg_proc where proname = 'track_view')
union all
select 'function',          'admin_visit_stats' where exists (select 1 from pg_proc where proname = 'admin_visit_stats');
