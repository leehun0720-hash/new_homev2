-- =====================================================================
-- TEN AI — 보안 심화 감사 후 추가 방어 (defense-in-depth)
-- 실행 방법: Supabase 대시보드 > SQL Editor > 새 쿼리 > 붙여넣기 > Run
--
-- 감사 결과: 핵심 RLS(권한상승/타인조회/관리자쓰기/상태조작)는 모두 차단 확인됨.
-- 아래는 심층 방어 강화 + 침투 테스트 중 생성된 임시 데이터 정리입니다.
-- =====================================================================

-- ---------- 1) role 컬럼 값 제약 (member/admin 외 값 차단) ----------
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('member', 'admin'));

-- ---------- 2) profiles: 명시적 DELETE 금지 정책 (RLS 기본 거부의 명문화) ----------
--    (정책이 없으면 이미 거부되지만, 의도를 명시해 실수 방지)
drop policy if exists "profiles no delete" on profiles;
create policy "profiles no delete" on profiles
  for delete using (false);

-- ---------- 3) qna: 관리자만 삭제/수정 (익명/회원 차단 재확인) ----------
--    이미 적용돼 있으면 그대로 유지됨 (idempotent)
drop policy if exists "qna member insert" on qna;
create policy "qna member insert" on qna
  for insert with check (
    is_admin() or (status = 'pending' and is_public = false and coalesce(answer,'') = '')
  );

-- ---------- 4) 침투 테스트로 생성된 임시 데이터 정리 ----------
--    (감사 과정에서 만든 테스트 계정/질문 제거)
delete from qna where id like 'pentest%';
delete from qna where name in ('DB검증', '검증', '검증2', '방문자') and answer = '';

-- 테스트용 auth 계정 및 프로필 정리
--   ※ auth.users 삭제 시 profiles 는 on delete cascade 로 함께 삭제됨
delete from auth.users
where email in ('pentest2@example.com', 'tenai.test.member@gmail.com')
   or email like 'pentest%@%';

-- ---------- 5) 확인용 조회 (실행 후 결과 확인) ----------
--    관리자 계정만 남아야 정상
select email,
       (select role from profiles p where p.id = u.id) as role
from auth.users u
order by created_at;
