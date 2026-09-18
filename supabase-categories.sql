-- =====================================================================
-- TEN AI — 분류(카테고리) 통합 관리
-- ---------------------------------------------------------------------
-- 실행 위치 (바로 열기):
--   https://supabase.com/dashboard/project/pjulgdlbgaobyvnfjzhe/sql/new
--   대시보드 > SQL Editor > New query > 아래 전체 붙여넣기 > Run
--
-- 실행 후 확인:
--   https://supabase.com/dashboard/project/pjulgdlbgaobyvnfjzhe/editor
--   Table Editor 에 categories 테이블이 새로 생깁니다.
--
-- ---------------------------------------------------------------------
-- 이 스크립트가 데이터에 미치는 영향
--
--   구분                            | 영향
--   ------------------------------- | --------------------------------
--   categories 테이블               | 새로 생성 (없을 때만)
--   qna.category 컬럼               | 추가, 기존 행은 빈 값 '' 로 채움
--   posts / lectures / handbooks    | 컬럼·값 모두 그대로. 읽기만 함
--   apps                            | 컬럼·값 모두 그대로. 읽기만 함
--   기존 분류 값                    | 하나도 바뀌지 않음
--
--   지금 콘텐츠에 들어 있는 분류 값을 읽어서 categories 행으로 만듭니다.
--   관리자 콘솔에서 타이핑해 둔 강의 분류처럼 제가 모르는 값이 있어도
--   자동으로 목록에 올라오므로, 실행 뒤 이름만 다듬으면 됩니다.
--
--   여러 번 실행해도 안전합니다 (create if not exists / on conflict do nothing).
-- =====================================================================

-- ---------- 1) 분류 테이블 ----------
create table if not exists categories (
  id         text primary key,                  -- 'app:esg' 형태 (scope:slug)
  scope      text not null,                     -- post | qna | handbook | lecture | app
  slug       text not null,                     -- 콘텐츠 행에 저장되는 값. 만든 뒤에는 바꾸지 않는다
  name       text not null,                     -- 화면에 보이는 이름. 자유롭게 수정 가능
  tone       text not null default 'tag-biz',   -- 배지 색: tag-vibe | tag-genai | tag-biz
  sort_order int  not null default 0,           -- 작을수록 앞. 10 단위로 매겨 사이 삽입이 쉽게
  created_at bigint not null default 0
);

alter table categories drop constraint if exists categories_scope_check;
alter table categories add constraint categories_scope_check
  check (scope in ('post', 'qna', 'handbook', 'lecture', 'app'));

alter table categories drop constraint if exists categories_tone_check;
alter table categories add constraint categories_tone_check
  check (tone in ('tag-vibe', 'tag-genai', 'tag-biz'));

-- 같은 영역 안에서 slug 는 겹칠 수 없다 (콘텐츠가 이 값으로 분류를 찾으므로)
create unique index if not exists categories_scope_slug_idx on categories (scope, slug);
create index        if not exists categories_scope_order_idx on categories (scope, sort_order);

-- ---------- 2) Q&A 에 분류 컬럼 추가 ----------
-- 기존 질문은 빈 값('미분류')으로 남고, 관리자 콘솔에서 하나씩 지정하면 됩니다.
alter table qna add column if not exists category text not null default '';
create index if not exists qna_category_idx on qna (category);

-- ---------- 3) RLS: 누구나 읽기, 쓰기는 관리자만 ----------
-- 분류는 공개 사이트의 필터에 쓰이므로 읽기는 열어 둡니다.
alter table categories enable row level security;

drop policy if exists "categories read"  on categories;
drop policy if exists "categories write" on categories;

create policy "categories read"  on categories for select using (true);
create policy "categories write" on categories for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- 4) 기본 분류 시딩 ----------
-- slug 는 콘텐츠에 이미 저장돼 있는 값과 같게 둡니다 (게시물의 '공지',
-- 핸드북의 'vibecoding', 앱의 'esg' 등). 그래야 기존 글이 그대로 분류됩니다.
insert into categories (id, scope, slug, name, tone, sort_order, created_at) values
  -- 게시물
  ('post:공지', 'post', '공지', '공지', 'tag-vibe',  10, 0),
  ('post:뉴스', 'post', '뉴스', '뉴스', 'tag-genai', 20, 0),
  ('post:교육', 'post', '교육', '교육', 'tag-biz',   30, 0),
  -- Q&A (새로 만드는 분류 — 기존 질문은 미분류로 남습니다)
  ('qna:course',     'qna', 'course',     '수강·교육',   'tag-vibe',  10, 0),
  ('qna:app',        'qna', 'app',        '앱·기술',     'tag-genai', 20, 0),
  ('qna:membership', 'qna', 'membership', '멤버십·계정', 'tag-biz',   30, 0),
  ('qna:etc',        'qna', 'etc',        '기타 문의',   'tag-biz',   40, 0),
  -- 핸드북 (과정 탭)
  ('handbook:vibecoding',  'handbook', 'vibecoding',  '바이브코딩',     'tag-vibe',  10, 0),
  ('handbook:genai',       'handbook', 'genai',       '생성형 AI 실무', 'tag-genai', 20, 0),
  ('handbook:ai_business', 'handbook', 'ai_business', 'AI 경영 전략',   'tag-biz',   30, 0),
  -- 강의
  ('lecture:ChatGPT 실무',        'lecture', 'ChatGPT 실무',        'ChatGPT 실무',        'tag-vibe',  10, 0),
  ('lecture:생성형 AI 가이드',    'lecture', '생성형 AI 가이드',    '생성형 AI 가이드',    'tag-genai', 20, 0),
  ('lecture:AI 경영 전략',        'lecture', 'AI 경영 전략',        'AI 경영 전략',        'tag-biz',   30, 0),
  ('lecture:프롬프트 엔지니어링', 'lecture', '프롬프트 엔지니어링', '프롬프트 엔지니어링', 'tag-vibe',  40, 0),
  -- AI 앱
  ('app:automation', 'app', 'automation', '업무 자동화',   'tag-vibe',  10, 0),
  ('app:document',   'app', 'document',   '문서·글쓰기',   'tag-biz',   20, 0),
  ('app:data',       'app', 'data',       '데이터·분석',   'tag-vibe',  30, 0),
  ('app:esg',        'app', 'esg',        '탄소·ESG',     'tag-genai', 40, 0),
  ('app:edu',        'app', 'edu',        '교육·학습',     'tag-genai', 50, 0),
  ('app:gov',        'app', 'gov',        '정부지원·공모', 'tag-biz',   60, 0),
  ('app:biz',        'app', 'biz',        '경영·금융',     'tag-biz',   70, 0),
  ('app:tool',       'app', 'tool',       '유틸리티',      'tag-vibe',  80, 0)
on conflict do nothing;

-- ---------- 5) 콘텐츠에 실제로 쓰인 값 자동 수집 ----------
-- 위 목록에 없는 분류가 콘텐츠에 들어 있으면 (관리자가 자유 입력으로 만든
-- 강의 분류 등) 여기서 자동으로 끌어올립니다. 그래야 마이그레이션 뒤에도
-- 기존 글이 '미분류'로 떨어지지 않습니다.
-- 색조는 3색을 돌려 가며 배정하고, 이름은 일단 값 그대로 둡니다.
-- 이름이 마음에 안 들면 관리자 콘솔 > 분류 관리에서 바꾸면 됩니다.

do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('post',     'posts',      'category'),
      ('lecture',  'lectures',   'category'),
      ('handbook', 'handbooks',  'course_tag'),
      ('app',      'apps',       'category'),
      ('qna',      'qna',        'category')
    ) as t(scope, tbl, col)
  loop
    execute format($f$
      insert into categories (id, scope, slug, name, tone, sort_order, created_at)
      select %1$L || ':' || v, %1$L, v, v,
             (array['tag-vibe','tag-genai','tag-biz'])[1 + (row_number() over (order by v))::int %% 3],
             1000 + (row_number() over (order by v))::int * 10,
             0
      from (select distinct %2$I::text as v from %3$I where coalesce(%2$I::text, '') <> '') s
      on conflict do nothing
    $f$, spec.scope, spec.col, spec.tbl);
  end loop;
end $$;

-- ---------- 6) 결과 확인 ----------
-- 실행 후 아래 결과가 함께 나옵니다. 영역별 분류 개수를 확인하세요.
select scope as "영역",
       count(*) as "분류 수",
       string_agg(name, ' · ' order by sort_order) as "분류 목록"
from categories
group by scope
order by array_position(array['post','qna','handbook','lecture','app'], scope);
