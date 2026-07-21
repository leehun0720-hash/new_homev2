-- =====================================================================
-- TEN AI — 콘텐츠 관리 확장: 핸드북 / 강의 / 앱 테이블
-- 실행 방법: Supabase 대시보드 > SQL Editor > 새 쿼리 > 붙여넣기 > Run
-- (관리자 콘솔에서 핸드북·강의·TEN AI Apps 를 편집할 수 있게 됩니다)
-- =====================================================================

-- 안전장치: is_admin() 이 없는 환경 대비 (이미 있으면 그대로 유지)
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null default '',
  address    text not null default '',
  company    text not null default '',
  position   text not null default '',
  role       text not null default 'member',
  created_at timestamptz not null default now()
);
create or replace function is_admin() returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- 1) 핸드북 ----------
create table if not exists handbooks (
  id           text primary key,
  title        text not null,
  course_tag   text not null default 'vibecoding',   -- vibecoding | genai | ai_business
  level_tier   int  not null default 1,
  access_level text not null default 'public',       -- public | member | enrolled
  description  text not null default '',
  link_url     text not null default '',
  created_at   bigint not null
);

-- 기존 설치 환경에도 링크 컬럼을 안전하게 추가
alter table handbooks add column if not exists link_url text not null default '';

-- ---------- 2) 강의 ----------
create table if not exists lectures (
  id         text primary key,
  category   text not null default '',
  title      text not null,
  duration   text not null default '',
  video_id   text not null default '',               -- 유튜브 영상 ID (11자리)
  grad1      text not null default '#0e7490',
  grad2      text not null default '#164e63',
  created_at bigint not null
);

-- ---------- 3) TEN AI Apps ----------
create table if not exists apps (
  id         text primary key,
  name       text not null,
  badge      text not null default '',
  badge_cls  text not null default 'tag-vibe',       -- tag-vibe | tag-genai | tag-biz
  oneliner   text not null default '',
  how        text not null default '',
  launch_url text not null default '',
  github_url text not null default '',
  created_at bigint not null
);

-- ---------- RLS: 누구나 읽기, 쓰기는 관리자만 ----------
alter table handbooks enable row level security;
alter table lectures  enable row level security;
alter table apps      enable row level security;

drop policy if exists "handbooks read"  on handbooks;
drop policy if exists "handbooks write" on handbooks;
drop policy if exists "lectures read"   on lectures;
drop policy if exists "lectures write"  on lectures;
drop policy if exists "apps read"       on apps;
drop policy if exists "apps write"      on apps;

create policy "handbooks read"  on handbooks for select using (true);
create policy "handbooks write" on handbooks for all to authenticated using (is_admin()) with check (is_admin());
create policy "lectures read"   on lectures  for select using (true);
create policy "lectures write"  on lectures  for all to authenticated using (is_admin()) with check (is_admin());
create policy "apps read"       on apps      for select using (true);
create policy "apps write"      on apps      for all to authenticated using (is_admin()) with check (is_admin());

-- ---------- 초기 데이터 (현재 사이트의 예시 콘텐츠 이전) ----------
insert into handbooks (id, title, course_tag, level_tier, access_level, description, created_at) values
  ('h1',  '바이브코딩 입문 가이드',             'vibecoding',  1, 'public',   '비개발자를 위한 자연어 개발 기초와 프롬프트의 이해. 코딩 없이 아이디어를 앱으로 만드는 첫걸음.', 1),
  ('h2',  '무릎앱 만들기 기초 실습',            'vibecoding',  2, 'member',   '생각을 그대로 화면으로. 실습 중심의 무릎앱 제작 워크북으로 나만의 도구를 완성합니다.', 2),
  ('h3',  '바이브코딩 실무 실습서',             'vibecoding',  3, 'enrolled', '역참목조분검 프레임워크 기반의 실전 개발 프로세스와 무릎앱 고도화 전략.', 3),
  ('h4',  '디버깅 심화 & 함정 회피 가이드',     'vibecoding',  4, 'enrolled', 'AI 협업 개발에서 만나는 디버깅 함정과 해결 패턴. 실무자를 위한 심화 트러블슈팅.', 4),
  ('h5',  '실무 생산성 혁신 핸드북',            'genai',       1, 'public',   'ChatGPT · Claude · Gemini를 업무에 바로 적용하는 실전 비법. 일반인을 위한 생산성 가이드.', 5),
  ('h6',  '프롬프트 라이브러리 가이드',         'genai',       2, 'member',   '재사용 가능한 프롬프트 자산 구축법. 직무별 템플릿과 설계 패턴 모음.', 6),
  ('h7',  'API 연동 & 에이전틱 오케스트레이션', 'genai',       3, 'enrolled', 'LLM API 연동부터 멀티 에이전트 오케스트레이션까지, 전문가를 위한 심화 과정.', 7),
  ('h8',  'RAG 구축 실무 가이드',               'genai',       3, 'enrolled', '조직의 지식을 AI에 연결하는 검색증강생성(RAG) 파이프라인 설계와 구축 실무.', 8),
  ('h9',  '중소기업 AI 도입 로드맵',            'ai_business', 2, 'member',   '기업 임직원을 위한 단계별 AI 도입 전략. 진단부터 실행까지의 경영 로드맵.', 9),
  ('h10', '정부지원사업 가이드 v3',             'ai_business', 2, 'enrolled', 'AI를 활용한 정부지원사업 계획서 작성법. 선정률을 높이는 구조화 전략과 실전 템플릿.', 10),
  ('h11', '기술가치평가 핸드북',                'ai_business', 3, 'enrolled', '기술 기반 기업을 위한 가치평가 프레임워크와 AI 활용 분석 기법.', 11)
on conflict (id) do nothing;

insert into lectures (id, category, title, duration, video_id, grad1, grad2, created_at) values
  ('l1', 'ChatGPT 실무',        'ChatGPT 실무 활용법 — 업무 자동화의 시작',      '18:42', '', '#0e7490', '#164e63', 1),
  ('l2', '생성형 AI 가이드',    '생성형 AI 완벽 가이드 — 도구 선택부터 활용까지', '24:15', '', '#6d28d9', '#312e81', 2),
  ('l3', 'AI 경영 전략',        'AI 경영 전략 강의 — 우리 회사에 AI 심는 법',     '21:08', '', '#b45309', '#7c2d12', 3),
  ('l4', '프롬프트 엔지니어링', '프롬프트 엔지니어링 스킬업 — 좋은 질문의 기술',  '16:33', '', '#0f766e', '#134e4a', 4)
on conflict (id) do nothing;

insert into apps (id, name, badge, badge_cls, oneliner, how, launch_url, github_url, created_at) values
  ('a1', '서울LAW봇', 'Legal AI', 'tag-vibe',
   '판례와 법령을 이해하는 법률 특화 AI 챗봇',
   '한국 판례·법령 데이터를 RAG로 연결해, 일반인의 언어로 물어봐도 관련 법 조항과 판례를 근거와 함께 답변합니다.', '', '', 1),
  ('a2', '블록ESG', 'ESG Analytics', 'tag-genai',
   '기업 ESG 데이터를 자동 분석·리포팅하는 평가 도구',
   '공시 데이터를 수집·정규화하고 TenOS 모델이 ESG 리스크를 요약해 경영진용 리포트를 자동 생성합니다.', '', '', 2),
  ('a3', 'TEN AI Hub', 'Platform', 'tag-biz',
   '교육·툴킷·템플릿을 공유하는 실무형 AI 생태계 허브',
   '수강생과 실무자가 프롬프트 템플릿, 사례, 도구를 올리고 나누는 커뮤니티형 지식 플랫폼입니다.', '', '', 3),
  ('a4', 'Prompt Library', 'Toolkit', 'tag-vibe',
   '직무별 검증 프롬프트를 모아둔 템플릿 라이브러리',
   '기획·마케팅·개발 등 직무별로 검증된 프롬프트를 분류해 원클릭 복사로 바로 사용할 수 있습니다.', '', '', 4)
on conflict (id) do nothing;
