-- =====================================================================
-- TEN AI — 관리자 콘솔 아이디 · 비밀번호 바꾸기
-- 실행 방법: Supabase 대시보드 > SQL Editor > 새 쿼리 > 붙여넣기 > Run
--
-- 관리자 콘솔(/admin)은 Supabase Auth 계정으로 로그인한다. Supabase 는 이메일로만
-- 로그인하므로, 콘솔은 '@' 가 없는 아이디를 '아이디@admin.tenai.kr' 로 바꿔 보낸다
-- (admin.html 의 toAdminEmail). 이 스크립트는 지금 쓰는 관리자 계정 하나의
--   ① 로그인 주소를 '새 아이디@admin.tenai.kr' 로
--   ② 비밀번호를 새 비밀번호로
--   ③ 이미 로그인해 둔 기기는 모두 로그아웃 (새 아이디로 다시 로그인)
-- 바꾼다. 관리자 권한(profiles.role = 'admin')은 계정 번호(id)에 붙어 있어 그대로다.
--
-- ※ 아래 v_login · v_password 두 값만 바꿔서 실행한다.
--   실제 비밀번호를 이 파일에 적어 커밋하지 않는다.
-- ※ '관리자 역할 + 비밀번호가 있는 계정'이 정확히 하나가 아니면 아무것도 바꾸지 않고
--   후보 이메일을 오류 메시지로 보여 준다. 그중 하나를 v_target 에 적어 다시 실행한다.
-- ※ 'admin.tenai.kr' 은 실제 메일함이 아닌 로그인용 이름이라 비밀번호 찾기 메일을
--   받을 수 없다. 비밀번호를 잊으면 이 스크립트로 다시 정한다.
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_login    text := '새아이디';        -- 새 아이디 (이메일을 그대로 써도 된다)
  v_password text := '새비밀번호';      -- 새 비밀번호 (8자 이상)
  v_target   text := '';               -- 바꿀 관리자 계정의 지금 이메일 (비우면 자동으로 찾는다)
  v_email    text;
  v_ids      uuid[];
  v_list     text;
  v_id       uuid;
begin
  v_email := lower(trim(v_login));
  if v_email = '' then raise exception '새 아이디를 적어 주세요.'; end if;
  if position('@' in v_email) = 0 then v_email := v_email || '@admin.tenai.kr'; end if;
  if length(v_password) < 8 then raise exception '비밀번호는 8자 이상이어야 합니다.'; end if;

  select array_agg(u.id), string_agg(u.email, ', ')
    into v_ids, v_list
    from auth.users u
    join public.profiles p on p.id = u.id
   where p.role = 'admin'
     and coalesce(u.encrypted_password, '') <> ''
     and (v_target = '' or lower(u.email) = lower(trim(v_target)));

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception '비밀번호로 로그인하는 관리자 계정을 찾지 못했습니다. (v_target = %)', v_target;
  elsif array_length(v_ids, 1) > 1 then
    raise exception '관리자 계정이 % 개입니다: % — 바꿀 계정의 이메일을 v_target 에 적어 다시 실행하세요.',
      array_length(v_ids, 1), v_list;
  end if;
  v_id := v_ids[1];

  if exists (select 1 from auth.users where lower(email) = v_email and id <> v_id) then
    raise exception '% 는 이미 다른 계정이 쓰고 있습니다.', v_email;
  end if;

  update auth.users
     set email              = v_email,
         encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf', 10)),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at         = now()
   where id = v_id;

  update auth.identities
     set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', v_email),
         updated_at    = now()
   where user_id = v_id and provider = 'email';

  update public.profiles set email = v_email where id = v_id;

  -- 예전 아이디로 로그인해 둔 브라우저를 모두 로그아웃
  delete from auth.refresh_tokens where user_id = v_id::text;
  delete from auth.sessions where user_id = v_id;

  raise notice '관리자 로그인 주소를 % 로, 비밀번호를 새 값으로 바꿨습니다.', v_email;
end $$;

-- 확인: 관리자 계정 (로그인 주소 · 마지막 로그인)
select u.email as "로그인 주소", p.role as "역할", u.last_sign_in_at as "마지막 로그인"
  from auth.users u
  join public.profiles p on p.id = u.id
 where p.role = 'admin';
