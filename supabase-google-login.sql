-- =====================================================================
-- TEN AI — 구글 로그인
-- ---------------------------------------------------------------------
-- 이 스크립트는 '데이터베이스 쪽' 준비만 합니다.
-- 구글 로그인을 켜려면 대시보드 설정 두 군데가 함께 필요합니다.
-- 아래 ★ 항목을 먼저 마친 뒤 이 SQL 을 실행하세요 (순서는 상관없습니다).
--
-- ★ 1) Google Cloud Console — OAuth 클라이언트 만들기
--      https://console.cloud.google.com/apis/credentials
--      · 사용자 인증 정보 만들기 > OAuth 클라이언트 ID > 웹 애플리케이션
--      · '승인된 리디렉션 URI' 에 아래 주소를 그대로 넣습니다
--          https://pjulgdlbgaobyvnfjzhe.supabase.co/auth/v1/callback
--      · 만들면 나오는 클라이언트 ID 와 보안 비밀번호를 복사합니다
--        (보안 비밀번호는 이 대화창에 붙여넣지 마세요 — 대시보드에만 넣습니다)
--
-- ★ 2) Supabase — 구글 제공자 켜기
--      https://supabase.com/dashboard/project/pjulgdlbgaobyvnfjzhe/auth/providers
--      · Google 을 켜고 위에서 복사한 ID·비밀번호를 붙여넣고 저장
--      https://supabase.com/dashboard/project/pjulgdlbgaobyvnfjzhe/auth/url-configuration
--      · Site URL        : https://tenai.kr
--      · Redirect URLs 에 아래 두 줄 추가
--          https://tenai.kr/**
--          https://*.netlify.app/**        (배포 미리보기에서도 시험하려면)
--
-- ★ 3) Google Cloud Console — 승인된 자바스크립트 원본 (로그인 화면 이름)
--      https://console.cloud.google.com/auth/clients
--      · 위에서 만든 OAuth 클라이언트를 열고
--        '승인된 자바스크립트 원본' 에 아래를 추가하고 저장
--          https://tenai.kr
--          https://www.tenai.kr
--
--      왜 필요한가
--        이 한 줄이 있어야 구글이 우리 페이지 안에서 곧바로 ID 토큰을
--        건네준다. 그러면 동의 화면 제목이
--            'pjulgdlbgaobyvnfjzhe.supabase.co 서비스로 로그인'  →
--            'tenai.kr(으)로 로그인'
--        으로 바뀐다. (앱 이름 'TEN AI' 는 구글이 제목에 쓰지 않는다.
--        구글의 새 로그인 화면은 '토큰을 받는 주소' 를 제목에 쓴다.)
--        등록 전까지는 예전처럼 Supabase 를 거치는 방식으로 자동
--        되돌아가므로, 저장 전후 어느 쪽이든 로그인은 끊기지 않는다.
--
-- ★ 4) Google Cloud Console — 앱 게시
--      https://console.cloud.google.com/auth/audience
--      · '테스트 중' 이면 등록한 테스트 사용자만 로그인할 수 있다.
--        '앱 게시' 를 눌러 '프로덕션' 으로 바꿔야 누구나 가입할 수 있다.
--      · 우리가 쓰는 범위(email·profile)는 민감 범위가 아니라서
--        구글 심사 없이 바로 게시된다.
--
-- ---------------------------------------------------------------------
-- 이 스크립트가 데이터에 미치는 영향
--
--   구분                          | 영향
--   ----------------------------- | ----------------------------------
--   profiles.name                 | 컬럼 추가, 기존 행은 빈 값 ''
--   profiles.avatar_url           | 컬럼 추가, 기존 행은 빈 값 ''
--   handle_new_user() 트리거      | 구글 이름·사진도 담도록 교체
--   기존 회원의 이메일·주소·회사  | 건드리지 않음
--   기존 관리자 권한              | 건드리지 않음
--
--   여러 번 실행해도 안전합니다.
-- =====================================================================

-- ---------- 1) 프로필에 이름·사진 컬럼 ----------
-- 구글로 들어온 회원은 주소·회사·직급을 입력하지 않는다. 대신 구글이
-- 이름과 프로필 사진을 준다 — 이메일만 덩그러니 남지 않도록 받아 둔다.
alter table profiles add column if not exists name       text not null default '';
alter table profiles add column if not exists avatar_url text not null default '';

-- ---------- 2) 가입 시 프로필 자동 생성 (구글 메타데이터 포함) ----------
-- 구글은 full_name / name / picture / avatar_url 중 일부만 채워 보낸다.
-- 어느 쪽이 와도 받도록 coalesce 로 훑는다.
-- 이메일·비밀번호 가입은 예전처럼 address / company / position 을 쓴다.
create or replace function handle_new_user() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, avatar_url, address, company, position)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url',
             new.raw_user_meta_data->>'picture', ''),
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

-- ---------- 3) 이미 가입한 계정의 이름·사진 채우기 ----------
-- 트리거는 '새로 가입할 때'만 돈다. 이미 있는 계정은 여기서 한 번 메운다.
-- 값이 이미 있으면 덮지 않는다 — 관리자가 손으로 고쳐 둔 이름을 지키려고.
update profiles p
set name = coalesce(u.raw_user_meta_data->>'full_name',
                    u.raw_user_meta_data->>'name', '')
from auth.users u
where u.id = p.id
  and p.name = ''
  and coalesce(u.raw_user_meta_data->>'full_name',
               u.raw_user_meta_data->>'name', '') <> '';

update profiles p
set avatar_url = coalesce(u.raw_user_meta_data->>'avatar_url',
                          u.raw_user_meta_data->>'picture', '')
from auth.users u
where u.id = p.id
  and p.avatar_url = ''
  and coalesce(u.raw_user_meta_data->>'avatar_url',
               u.raw_user_meta_data->>'picture', '') <> '';

-- 트리거 이전에 가입해 프로필 행 자체가 없는 계정도 만들어 준다
insert into profiles (id, email, name, avatar_url)
select u.id,
       coalesce(u.email, ''),
       coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
       coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture', '')
from auth.users u
on conflict (id) do nothing;

-- ---------- 4) 결과 확인 ----------
select count(*)                                              as "회원 수",
       count(*) filter (where name <> '')                    as "이름 있음",
       count(*) filter (where avatar_url <> '')              as "사진 있음",
       count(*) filter (where role = 'admin')                as "관리자"
from profiles;
