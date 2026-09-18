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
    anonKey: "sb_publishable_VS76_GDWpXDWhvjA_S-O_A_cNujom4t",

    /* 구글 로그인 화면에 우리 도메인을 띄우기 위한 클라이언트 ID.
       ---------------------------------------------------------------
       비밀이 아닙니다. 구글이 로그인 요청마다 주소창에 실어 보내는
       공개 값이라 브라우저에 그대로 둡니다 (보안 비밀번호는 Supabase
       대시보드에만 있고 여기에는 없습니다).

       이 값이 있으면 구글이 발급한 ID 토큰을 브라우저에서 직접 받아
       동의 화면 제목이 'tenai.kr' 로 뜹니다. 값을 비우거나 구글
       콘솔의 '승인된 자바스크립트 원본' 에 이 사이트 주소가 없으면
       예전처럼 Supabase 를 거치는 이동 방식으로 자동 되돌아갑니다. */
    googleClientId: "214144894980-0digtof5slv08n9i6puo5hjsbba1g2fq.apps.googleusercontent.com",

    /* 구글 콘솔의 '승인된 자바스크립트 원본' 에 실제로 등록한 주소들.
       ---------------------------------------------------------------
       여기 없는 주소에서는 구글 버튼을 아예 시도하지 않는다.

       왜 목록이 필요한가
         등록되지 않은 주소에서 구글은 403 을 받고도 '겉보기에 똑같은'
         버튼을 그린다 — 로고도 글자도 다 있는데 눌러도 아무 일이 없다.
         DOM 으로도 높이로도 성공과 구분되지 않는다. 그런 버튼을 내거느니
         예전 방식 버튼을 그대로 두는 편이 낫다.

       콘솔에 주소를 추가했으면 여기에도 같이 적어 주세요. 두 곳이
       어긋나면 그냥 예전 방식으로 동작할 뿐, 로그인이 끊기지는 않습니다. */
    googleJsOrigins: [
        "https://deploy-preview-7--amazing-cactus-dfd8d4.netlify.app"
    ]
};
