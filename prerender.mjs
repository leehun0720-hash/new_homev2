/* =====================================================================
   빌드 후 프리렌더 — 동적 콘텐츠를 정적 HTML 에 심는다
   ---------------------------------------------------------------------
   왜 필요한가
     핸드북·강의·앱·소식은 Supabase 에서 런타임에 불러온다. 크롤러가
     JS 를 실행하기는 하지만 2차 크롤링이라 지연·누락 위험이 있다.
     빌드 시점에 같은 마크업을 만들어 dist/index.html 에 넣어 둔다.

   클로킹이 아닌 이유
     심는 내용은 브라우저가 렌더한 결과와 같다. 페이지가 열리면 JS 가
     최신 데이터로 다시 그린다. 사람과 크롤러가 같은 것을 본다.
     JS 를 끈 사용자도 콘텐츠를 볼 수 있게 되므로 접근성도 나아진다.

   실패해도 빌드는 통과시킨다 — 데이터가 없으면 기존 동작(JS 렌더)으로
   돌아갈 뿐이다.
   ===================================================================== */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DIST = 'dist/index.html';
const TABLES = ['handbooks', 'lectures', 'apps', 'posts'];

/* ---------- 접속 정보: 환경변수 → .env 파일 ---------- */
function readEnv() {
  const pick = o =>
    o.NEXT_PUBLIC_SUPABASE_URL || o.VITE_SUPABASE_URL || '';
  const pickKey = o =>
    o.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    o.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    o.VITE_SUPABASE_ANON_KEY || '';

  let url = pick(process.env), key = pickKey(process.env);
  if (url && key) return { url, key };

  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue;
    const o = {};
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    url = url || pick(o);
    key = key || pickKey(o);
    if (url && key) break;
  }
  return { url, key };
}

async function fetchTable(url, key, table) {
  const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${table}?select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) throw new Error(`${table}: HTTP ${r.status}`);
  return r.json();
}

/* ---------- index.html 의 클라이언트 렌더와 같은 규칙 ---------- */
const esc = v => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const COURSE_META = {
  vibecoding:  { name: '바이브코딩',     tagClass: 'tag-vibe',  coverClass: 'cover-vibe',  deco: 'V' },
  genai:       { name: '생성형 AI 실무', tagClass: 'tag-genai', coverClass: 'cover-genai', deco: 'G' },
  ai_business: { name: 'AI 경영 전략',   tagClass: 'tag-biz',   coverClass: 'cover-biz',   deco: 'B' },
};
const ACCESS_META = {
  public:   { label: '전체 공개',   cls: 'access-public',   icon: '🌐' },
  member:   { label: '회원 공개',   cls: 'access-member',   icon: '👥' },
  enrolled: { label: '수강생 전용', cls: 'access-enrolled', icon: '🔒' },
};
const CAT_CLS = { '공지': 'news-cat-notice', '뉴스': 'news-cat-news', '교육': 'news-cat-edu' };
const APP_BADGE_CLS = { 'tag-vibe': 'tag-vibe', 'tag-genai': 'tag-genai', 'tag-biz': 'tag-biz' };

const fmtDate = ts => ts
  ? new Date(Number(ts)).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  : '';

const ytThumb = id => /^[A-Za-z0-9_-]{11}$/.test(String(id || ''))
  ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';

function handbookHtml(rows) {
  return rows.map((h, i) => {
    const c = COURSE_META[h.course_tag] || COURSE_META.vibecoding;
    const a = ACCESS_META[h.access_level] || ACCESS_META.public;
    const unlocked = h.access_level === 'public';
    return `
                <article class="handbook-card" style="animation-delay:${i * 0.06}s">
                    <div class="hb-cover ${c.coverClass}" data-deco="${c.deco}${Number(h.level_tier)}">
                        <span class="hb-level outfit">LEVEL ${Number(h.level_tier)}</span>
                    </div>
                    <div class="hb-body">
                        <div class="hb-meta">
                            <span class="hb-course-tag ${c.tagClass}">${c.name}</span>
                            <span class="hb-access ${a.cls}">${a.icon} ${a.label}</span>
                        </div>
                        <h3 class="hb-title">${esc(h.title)}</h3>
                        <p class="hb-desc">${esc(h.description)}</p>
                        <button class="hb-open ${unlocked ? 'unlocked' : 'locked'}" data-hb="${esc(h.id)}">
                            ${unlocked ? '핸드북 열기 →' : (h.access_level === 'member' ? '로그인 후 열람' : '수강 등록 후 열람')}
                        </button>
                    </div>
                </article>`;
  }).join('');
}

function lectureHtml(rows) {
  return rows.map(v => {
    const id = /^[A-Za-z0-9_-]{11}$/.test(String(v.video_id || '')) ? v.video_id : '';
    const href = id ? `https://www.youtube.com/watch?v=${id}` : '';
    const tag = href ? 'a' : 'button';
    const attrs = href
      ? `href="${esc(href)}" target="_blank" rel="noopener noreferrer"`
      : 'type="button" data-missing-video="true"';
    const label = href ? 'YouTube에서 새 창으로 보기' : 'YouTube 링크 미등록';
    const thumb = ytThumb(id);
    return `
                <${tag} class="lecture-card visible" ${attrs} aria-label="${esc(v.title)} - ${label}">
                    <div class="lecture-thumb${thumb ? '' : ' is-blank'}">
                        ${thumb
                          ? `<img class="lecture-shot" src="${thumb}" alt="" loading="lazy" decoding="async" width="480" height="360">`
                          : `<img class="thumb-mark" src="/brand/TenAI_cream.png" alt="" aria-hidden="true" loading="lazy" decoding="async" width="1040" height="440">
                               <span class="thumb-note">${esc(v.category || 'TEN AI 강의')}</span>`}
                        <div class="play"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
                        ${v.duration ? `<span class="dur outfit">${esc(v.duration)}</span>` : ''}
                    </div>
                    <div class="lecture-body">
                        <div class="lecture-cat">${esc(v.category)}</div>
                        <div class="lecture-title">${esc(v.title)}</div>
                    </div>
                </${tag}>`;
  }).join('');
}

function appHtml(rows) {
  const safeUrl = u => {
    const s = String(u || '').trim();
    return /^https?:\/\//i.test(s) ? esc(s) : 'javascript:void(0)';
  };
  return rows.map(a => `
            <article class="app-card visible">
                <div class="app-thumb tint-${APP_BADGE_CLS[a.badge_cls] || 'tag-vibe'}">
                    <img class="thumb-mark" src="/brand/TenAI_ink.png" alt="" aria-hidden="true" loading="lazy" decoding="async" width="1040" height="440">
                    <div class="app-overlay">${esc(a.how)}</div>
                </div>
                <div class="app-body">
                    <div class="app-head">
                        <h3 class="app-name">${esc(a.name)}</h3>
                        <span class="app-badge ${APP_BADGE_CLS[a.badge_cls] || 'tag-vibe'}">${esc(a.badge)}</span>
                    </div>
                    <p class="app-oneliner">${esc(a.oneliner)}</p>
                    <div class="app-actions">
                        <a class="app-btn launch" href="${safeUrl(a.launch_url)}" ${a.launch_url ? 'target="_blank" rel="noopener"' : 'data-nolink="launch"'}>
                            ⚡ App Launch
                        </a>
                        <a class="app-btn gh" href="${safeUrl(a.github_url)}" ${a.github_url ? 'target="_blank" rel="noopener"' : 'data-nolink="github"'}>GitHub 보러가기</a>
                    </div>
                </div>
            </article>`).join('');
}

function newsHtml(rows) {
  return rows.slice(0, 6).map(p => `
                <button class="news-card" data-post="${esc(p.id)}">
                    <div class="news-meta">
                        <span class="news-cat ${CAT_CLS[p.category] || 'news-cat-notice'}">${esc(p.category)}</span>
                        ${p.pinned ? '<span class="news-pin">📌 고정</span>' : ''}
                        <span class="news-date">${fmtDate(p.created_at)}</span>
                    </div>
                    <div class="news-title">${esc(p.title)}</div>
                    <p class="news-excerpt">${esc((p.content || '').slice(0, 90))}${(p.content || '').length > 90 ? '…' : ''}</p>
                    <span class="news-more">자세히 보기 →</span>
                </button>`).join('');
}

/* ---------- 컨테이너 안쪽만 갈아끼운다 ---------- */
function injectInto(html, id, inner) {
  const open = new RegExp(`(<div[^>]*\\bid="${id}"[^>]*>)`);
  const m = html.match(open);
  if (!m) return { html, ok: false };
  const start = m.index + m[0].length;

  // 여는 태그부터 짝이 맞는 </div> 를 찾는다
  let depth = 1, i = start;
  const re = /<\/?div\b[^>]*>/g;
  re.lastIndex = start;
  let t;
  while ((t = re.exec(html))) {
    depth += t[0][1] === '/' ? -1 : 1;
    if (depth === 0) { i = t.index; break; }
  }
  if (depth !== 0) return { html, ok: false };
  return { html: html.slice(0, start) + inner + '\n            ' + html.slice(i), ok: true };
}

/* ---------- 실행 ---------- */
const bail = msg => { console.log(`[prerender] 건너뜀 — ${msg}`); process.exit(0); };

if (!existsSync(DIST)) bail(`${DIST} 없음`);
const { url, key } = readEnv();
if (!url || !key) bail('Supabase 접속 정보 없음 (환경변수 미설정)');

let data;
try {
  const res = await Promise.all(TABLES.map(t => fetchTable(url, key, t)));
  data = Object.fromEntries(TABLES.map((t, i) => [t, res[i]]));
} catch (e) {
  bail(`데이터 조회 실패 — ${e.message}`);
}

const byCreated = (a, b) => Number(a.created_at) - Number(b.created_at);
const handbooks = (data.handbooks || []).sort(byCreated);
const lectures  = (data.lectures  || []).sort(byCreated);
const apps      = (data.apps      || []).sort(byCreated);
const posts     = (data.posts     || []).sort((a, b) => Number(b.created_at) - Number(a.created_at));

let html = readFileSync(DIST, 'utf8');
const report = [];
for (const [id, rows, render] of [
  ['handbookGrid', handbooks, handbookHtml],
  ['lectureGrid',  lectures,  lectureHtml],
  ['appsGrid',     apps,      appHtml],
  ['newsGrid',     posts,     newsHtml],
]) {
  if (!rows.length) { report.push(`${id}: 데이터 없음`); continue; }
  const out = injectInto(html, id, render(rows));
  html = out.html;
  report.push(`${id}: ${out.ok ? rows.length + '건 삽입' : '컨테이너 미발견'}`);
}

writeFileSync(DIST, html, 'utf8');
console.log('[prerender] ' + report.join(' · '));
