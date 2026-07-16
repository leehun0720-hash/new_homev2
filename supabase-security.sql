-- =====================================================================
-- TEN AI 사이트 — 보안 강화 스크립트 (supabase-setup.sql 실행 후 적용)
-- 실행 방법: Supabase 대시보드 > SQL Editor > 붙여넣기 > Run
--
-- ★ 실행 전 필수 준비:
--   1) Supabase 대시보드 > Authentication > Users > "Add user"
--      → 관리자 이메일/비밀번호 계정 생성 (Auto Confirm 체크)
--   2) Authentication > Sign In / Providers 에서
--      "Allow new users to sign up" 을 반드시 꺼두세요.
--      (켜져 있으면 아무나 가입해서 관리자 권한을 얻게 됩니다)
-- =====================================================================

-- ---------- 기존 프로토타입 정책 제거 ----------
drop policy if exists "site read"   on site;
drop policy if exists "site write"  on site;
drop policy if exists "posts read"  on posts;
drop policy if exists "posts write" on posts;
drop policy if exists "qna read"    on qna;
drop policy if exists "qna write"   on qna;

-- ---------- site: 누구나 읽기, 쓰기는 로그인(관리자)만 ----------
create policy "site public read" on site
  for select using (true);
create policy "site admin write" on site
  for all to authenticated using (true) with check (true);

-- ---------- posts: 누구나 읽기, 쓰기는 로그인(관리자)만 ----------
create policy "posts public read" on posts
  for select using (true);
create policy "posts admin write" on posts
  for all to authenticated using (true) with check (true);

-- ---------- qna ----------
-- 익명 방문자: '답변 완료 + 공개' 질문만 조회 가능
create policy "qna public read" on qna
  for select to anon using (is_public = true and status = 'answered');
-- 관리자: 전체 조회
create policy "qna admin read" on qna
  for select to authenticated using (true);
-- 익명 방문자: 질문 등록만 가능 (대기/비공개/답변없음 상태 강제)
create policy "qna public insert" on qna
  for insert to anon
  with check (status = 'pending' and is_public = false and answer = '');
-- 관리자: 등록/수정/삭제 전체 허용
create policy "qna admin insert" on qna
  for insert to authenticated with check (true);
create policy "qna admin update" on qna
  for update to authenticated using (true) with check (true);
create policy "qna admin delete" on qna
  for delete to authenticated using (true);

-- ---------- 방문자 이메일 보호: 익명 역할은 email 컬럼 조회 불가 ----------
revoke select (email) on qna from anon;

-- ---------- 과거에 site.data 에 저장됐을 수 있는 관리자 암호 제거 ----------
update site set data = data - 'adminPass' where id = 'settings';
