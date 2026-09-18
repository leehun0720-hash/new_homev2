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
import { SCOPE_IDS, safeTone, COVER_OF, allDefaultRows } from './categories-default.mjs';

/* 멀티페이지 — 섹션이 흩어져 있으므로 각 페이지에서 '있는 컨테이너'만 채운다.
   홈처럼 일부만 보여주는 자리는 컨테이너의 data-limit 을 그대로 따른다. */
const PAGES = ['index', 'about', 'business', 'education', 'apps', 'news', 'membership']
  .map(n => `dist/${n}.html`);
const TABLES = ['handbooks', 'lectures', 'apps', 'posts'];
/* 없어도 빌드를 막지 않는 테이블 — 마이그레이션(supabase-categories.sql) 전에
   배포되면 조회가 실패한다. 그때는 기본 분류로 심고 계속 간다. */
const OPTIONAL_TABLES = ['categories'];

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
  if (url && key) return { url, key };

  // 마지막 출처 — supabase-config.js 의 window.SUPABASE_CONFIG.
  // .env 는 저장소에 없으므로 Netlify 빌드에서는 실제로 여기서 읽힌다.
  if (existsSync('supabase-config.js')) {
    const src = readFileSync('supabase-config.js', 'utf8');
    const u = src.match(/url\s*:\s*["']([^"']+)["']/);
    const k = src.match(/anonKey\s*:\s*["']([^"']+)["']/);
    if (u && k && !/^YOUR_/.test(u[1]) && !/^YOUR_/.test(k[1])) {
      url = url || u[1];
      key = key || k[1];
    }
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

const ACCESS_META = {
  public:   { label: '전체 공개',   cls: 'access-public',   icon: '🌐' },
  member:   { label: '회원 공개',   cls: 'access-member',   icon: '👥' },
  enrolled: { label: '수강생 전용', cls: 'access-enrolled', icon: '🔒' },
};

/* 분류는 categories 테이블에서 온다(관리자 콘솔 > 분류 관리).
   테이블이 아직 없으면 categories-default.mjs 의 기본값으로 심는다 —
   브라우저가 나중에 다시 그리므로 사람과 크롤러가 보는 것은 여전히 같다. */
let CATS = {};                 // scope → slug → { name, tone }
function setCategories(rows) {
  CATS = {};
  SCOPE_IDS.forEach(sc => { CATS[sc] = {}; });
  const put = r => {
    if (!CATS[r.scope]) CATS[r.scope] = {};
    CATS[r.scope][r.slug] = { name: r.name, tone: safeTone(r.tone) };
  };
  // 기본값을 먼저 깔고 DB 행으로 덮는다 — DB 에 없는 분류도 이름이 나오게
  allDefaultRows().forEach(put);
  (rows || []).forEach(r => put({
    scope: r.scope, slug: r.slug, name: r.name, tone: r.tone
  }));
}
const catName = (scope, slug) => ((CATS[scope] || {})[slug] || {}).name || '';
const catTone = (scope, slug) => safeTone(((CATS[scope] || {})[slug] || {}).tone);

/* 핸드북 표지 — 이름·색은 분류에서, 워터마크 글자는 색조에서 */
const DECO_OF = { 'tag-vibe': 'V', 'tag-genai': 'G', 'tag-biz': 'B' };
function courseMeta(slug) {
  const tone = catTone('handbook', slug);
  return {
    name: catName('handbook', slug) || slug || '미분류',
    tagClass: tone,
    coverClass: COVER_OF[tone] || 'cover-biz',
    deco: DECO_OF[tone] || 'B'
  };
}

const fmtDate = ts => ts
  ? new Date(Number(ts)).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  : '';

const ytThumb = id => /^[A-Za-z0-9_-]{11}$/.test(String(id || ''))
  ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';

function handbookHtml(rows, limit) {
  return cut(rows, limit).map((h, i) => {
    const c = courseMeta(h.course_tag);
    const a = ACCESS_META[h.access_level] || ACCESS_META.public;
    const unlocked = h.access_level === 'public';
    return `
                <article class="handbook-card" style="animation-delay:${i * 0.06}s">
                    <div class="hb-cover ${c.coverClass}" data-deco="${c.deco}${Number(h.level_tier)}">
                        <span class="hb-level outfit">LEVEL ${Number(h.level_tier)}</span>
                    </div>
                    <div class="hb-body">
                        <div class="hb-meta">
                            <span class="hb-course-tag ${c.tagClass}">${esc(c.name)}</span>
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

function lectureHtml(rows, limit) {
  return cut(rows, limit).map(v => {
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
                               <span class="thumb-note">${esc(catName('lecture', v.category) || v.category || 'TEN AI 강의')}</span>`}
                        <div class="play"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
                        ${v.duration ? `<span class="dur outfit">${esc(v.duration)}</span>` : ''}
                    </div>
                    <div class="lecture-body">
                        <div class="lecture-cat">${esc(catName('lecture', v.category) || v.category || '')}</div>
                        <div class="lecture-title">${esc(v.title)}</div>
                    </div>
                </${tag}>`;
  }).join('');
}

/* index.html 의 isNewApp 과 같은 규칙 — is_new 지정 또는 최근 30일 공개 */
const NEW_APP_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const isNewApp = a => {
  if (a.is_new === true || a.is_new === 'true') return true;
  const at = Number(a.released_at) || 0;
  return at > 0 && Date.now() - at <= NEW_APP_WINDOW_MS;
};
const newAppOrder = (a, b) =>
  (Number(b.released_at) || 0) - (Number(a.released_at) || 0) ||
  (Number(b.created_at) || 0) - (Number(a.created_at) || 0);
const NEW_FLAG_HTML = '<span class="new-flag"><span class="new-flag-dot"></span>NEW</span>';

const appLinkUrl = u => {
  const s = String(u || '').trim();
  return /^https?:\/\//i.test(s) ? esc(s) : '/apps';
};

function newAppsHtml(rows, limit) {
  const items = rows.filter(isNewApp).sort(newAppOrder);
  if (!items.length) {
    return '<div class="board-empty">새 앱이 공개되면 이곳에 가장 먼저 안내됩니다.<br>지난 앱은 앱 쇼케이스에서 모두 확인하실 수 있습니다.</div>';
  }
  return cut(items, limit).map(a => `
            <article class="board-item">
                <span class="board-flag">${NEW_FLAG_HTML}</span>
                <div class="board-item-head">
                    <h4 class="board-item-name">${esc(a.name)}</h4>
                    ${catName('app', a.category) ? `<span class="app-badge ${catTone('app', a.category)}">${esc(catName('app', a.category))}</span>` : ''}
                </div>
                <p class="board-item-desc">${esc(a.oneliner)}</p>
                <p class="board-item-date">${Number(a.released_at) ? '공개일 · ' + fmtDate(a.released_at) : '공개 준비 중'}</p>
                <div class="board-item-actions">
                    <a class="app-btn launch" href="${appLinkUrl(a.launch_url)}" ${a.launch_url ? 'target="_blank" rel="noopener"' : 'data-nolink="launch"'}>⚡ 바로 실행</a>
                    <a class="app-btn gh" href="${appLinkUrl(a.github_url)}" ${a.github_url ? 'target="_blank" rel="noopener"' : 'data-nolink="github"'}>GitHub 보러가기</a>
                </div>
            </article>`).join('');
}

function appHtml(rows, limit) {
  const safeUrl = u => {
    const s = String(u || '').trim();
    return /^https?:\/\//i.test(s) ? esc(s) : 'javascript:void(0)';
  };
  return cut(rows, limit).map(a => `
            <article class="app-card visible${isNewApp(a) ? ' is-new' : ''}">
                <div class="app-thumb tint-${catTone('app', a.category)}">
                    ${isNewApp(a) ? NEW_FLAG_HTML : ''}
                    <img class="thumb-mark" src="/brand/TenAI_ink.png" alt="" aria-hidden="true" loading="lazy" decoding="async" width="1040" height="440">
                    <div class="app-overlay">${esc(a.how)}</div>
                </div>
                <div class="app-body">
                    <div class="app-head">
                        <h3 class="app-name">${esc(a.name)}</h3>
                        ${catName('app', a.category) ? `<span class="app-badge ${catTone('app', a.category)}">${esc(catName('app', a.category))}</span>` : ''}
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

function newsHtml(rows, limit) {
  return cut(rows, limit || 6).map(p => `
                <button class="news-card" data-post="${esc(p.id)}">
                    <div class="news-meta">
                        ${catName('post', p.category) ? `<span class="news-cat ${catTone('post', p.category)}">${esc(catName('post', p.category))}</span>` : ''}
                        ${p.pinned ? '<span class="news-pin">📌 고정</span>' : ''}
                        <span class="news-date">${fmtDate(p.created_at)}</span>
                    </div>
                    <div class="news-title">${esc(p.title)}</div>
                    <p class="news-excerpt">${esc((p.content || '').slice(0, 90))}${(p.content || '').length > 90 ? '…' : ''}</p>
                    <span class="news-more">자세히 보기 →</span>
                </button>`).join('');
}

/* ---------- data-limit: 홈의 요약 카드처럼 일부만 심을 때 ---------- */
const cut = (rows, limit) => (limit > 0 ? rows.slice(0, limit) : rows);

/* 컨테이너가 이 페이지에 없으면 undefined, 있으면 data-limit 값(없으면 0) */
function readLimit(html, id) {
  const m = html.match(new RegExp(`<[^>]*\\bid="${id}"[^>]*>`));
  if (!m) return undefined;
  const d = m[0].match(/\bdata-limit="(\d+)"/);
  return d ? Number(d[1]) : 0;
}

/* ---------- 텍스트 한 줄짜리 요소(카운터·요약)를 갈아끼운다 ---------- */
function setText(html, id, text) {
  const re = new RegExp(`(<(\\w+)[^>]*\\bid="${id}"[^>]*>)([^<]*)(</\\2>)`);
  return re.test(html) ? html.replace(re, (_, open, _tag, _old, close) => open + esc(text) + close) : html;
}

/* ---------- hidden 속성을 떼어 낸다 (JS 없이도 보이게) ---------- */
function unhide(html, id) {
  const re = new RegExp(`(<\\w+[^>]*\\bid="${id}"[^>]*?)\\s+hidden(\\s|>)`);
  return html.replace(re, '$1$2');
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

if (!PAGES.some(existsSync)) bail('빌드 결과(dist/*.html) 없음');
const { url, key } = readEnv();
if (!url || !key) bail('Supabase 접속 정보 없음 (env·supabase-config.js 모두 미확인)');
console.log('[prerender] 접속 대상 ' + url.replace(/^(https:\/\/[a-z0-9]{6})[a-z0-9]*/, '$1***'));

let data;
try {
  const res = await Promise.all(TABLES.map(t => fetchTable(url, key, t)));
  data = Object.fromEntries(TABLES.map((t, i) => [t, res[i]]));
} catch (e) {
  bail(`데이터 조회 실패 — ${e.message}`);
}
for (const t of OPTIONAL_TABLES) {
  try {
    data[t] = await fetchTable(url, key, t);
  } catch (e) {
    console.log(`[prerender] ${t} 조회 실패 — 기본값으로 진행합니다 (${e.message})`);
    data[t] = [];
  }
}

/* 분류를 먼저 세운다 — 배지 이름과 과정 탭이 여기서 나온다 */
setCategories(data.categories);

const byCreated = (a, b) => Number(a.created_at) - Number(b.created_at);
const handbooks = (data.handbooks || []).sort(byCreated);
const lectures  = (data.lectures  || []).sort(byCreated);
const apps      = (data.apps      || []).sort(byCreated);
const posts     = (data.posts     || []).sort((a, b) => Number(b.created_at) - Number(a.created_at));

const TARGETS = [
  ['handbookGrid', handbooks, handbookHtml],
  ['lectureGrid',  lectures,  lectureHtml],
  ['newAppsBoard', apps,      newAppsHtml],
  ['appsGrid',     apps,      appHtml],
  ['newsGrid',     posts,     newsHtml],
];

/* 이 수치들은 페이지마다 같은 값이므로 한 번만 계산한다 */
const freshCount = apps.filter(isNewApp).length;
const playable   = lectures.filter(v => ytThumb(v.video_id)).length;
const openHb     = handbooks.filter(h => h.access_level === 'public').length;

for (const file of PAGES) {
  if (!existsSync(file)) continue;
  let html = readFileSync(file, 'utf8');
  const done = [];

  for (const [id, rows, render] of TARGETS) {
    const limit = readLimit(html, id);
    if (limit === undefined) continue;            // 이 페이지에 없는 섹션
    if (!rows.length) { done.push(`${id}: 데이터 없음`); continue; }
    const shown = id === 'newAppsBoard'
      ? cut(rows.filter(isNewApp), limit).length
      : cut(rows, id === 'newsGrid' ? (limit || 6) : limit).length;
    const out = injectInto(html, id, render(rows, limit));
    html = out.html;
    done.push(`${id}: ${out.ok ? shown + '건' : '컨테이너 미발견'}`);
  }

  /* 요약 문구도 실제 데이터로 맞춘다 (JS 없이 보는 경우) */
  html = setText(html, 'newAppsCount', freshCount
    ? `새로 공개된 앱 ${freshCount}개 · 최근 30일 기준`
    : '현재 새로 공개된 앱이 없습니다');
  if (freshCount) html = unhide(html, 'promoNewFlag');

  html = setText(html, 'promoLectureMeta', lectures.length
    ? `강의 ${lectures.length}편${playable ? ` · 바로 시청 ${playable}편` : ''}`
    : '채널 강의 업데이트 중');
  html = setText(html, 'promoHandbookMeta', handbooks.length
    ? `핸드북 ${handbooks.length}권${openHb ? ` · 공개 교재 ${openHb}권` : ''}`
    : '핸드북 목록 준비 중');
  html = setText(html, 'promoAppMeta', freshCount
    ? `신규 공개 ${freshCount}개 · 전체 ${apps.length}개`
    : (apps.length ? `공개된 앱 ${apps.length}개` : '신규앱 준비 중'));

  writeFileSync(file, html, 'utf8');
  if (done.length) console.log(`[prerender] ${file.replace('dist/', '')} — ${done.join(' · ')}`);
}
