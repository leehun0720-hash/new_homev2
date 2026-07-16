/* =====================================================================
   Supabase 설정 파일
   ---------------------------------------------------------------------
   1) https://supabase.com 에서 프로젝트 생성
   2) [Project Settings > API] 에서 Project URL 과 anon public key 복사
      → 아래 값에 붙여넣기
   3) [SQL Editor] 에서 아래 테이블 생성 SQL 실행:

      -- 사이트 설정 (단일 행 jsonb)
      create table if not exists site (
        id   text primary key,
        data jsonb not null default '{}'
      );

      -- 게시물
      create table if not exists posts (
        id         text primary key,
        title      text not null,
        category   text not null default '공지',
        content    text not null default '',
        pinned     boolean not null default false,
        created_at bigint not null
      );

      -- Q&A
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

      -- RLS(행 수준 보안) 활성화 + 프로토타입용 정책 (운영 시 반드시 강화!)
      alter table site  enable row level security;
      alter table posts enable row level security;
      alter table qna   enable row level security;

      create policy "site read"   on site  for select using (true);
      create policy "site write"  on site  for all    using (true) with check (true);
      create policy "posts read"  on posts for select using (true);
      create policy "posts write" on posts for all    using (true) with check (true);
      create policy "qna read"    on qna   for select using (true);
      create policy "qna write"   on qna   for all    using (true) with check (true);

   ※ 운영 배포 시에는 Supabase Auth 로 관리자를 인증하고,
     쓰기(write) 정책을 관리자 역할로 제한하세요.

   ※ 아래 값이 placeholder(YOUR_...) 상태이면 사이트는 자동으로
     "로컬 모드"(브라우저 localStorage 저장)로 동작합니다.
   ===================================================================== */
window.SUPABASE_CONFIG = {
    url: "https://pjulgdlbgaobyvnfjzhe.supabase.co",
    anonKey: "sb_publishable_VS76_GDWpXDWhvjA_S-O_A_cNujom4t"
};
