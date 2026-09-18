/* =====================================================================
   TEN AI — 사이트 공용 스크립트
   ---------------------------------------------------------------------
   모든 페이지가 이 한 장을 공유한다. 페이지마다 있는 섹션이 다르므로
   DOM 을 건드리기 전에 반드시 존재를 확인한다 — 없는 섹션은 조용히
   건너뛰고, 있는 섹션만 그린다.
   원래는 index.html 안의 <script type="module"> 였고,
   멀티페이지 전환에서 분리했다.
   ===================================================================== */

/* 이 페이지에 없는 요소에는 손대지 않는다 */
const onId = (id, ev, fn, opt) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(ev, fn, opt);
};
const on = (el, ev, fn, opt) => { if (el) el.addEventListener(ev, fn, opt); };

/* 홈의 요약 카드처럼 일부만 보여줄 때 — 컨테이너의 data-limit 로 개수를 정한다 */
const limited = (items, el, fallback) => {
    const n = Number(el && el.dataset && el.dataset.limit) || Number(fallback) || 0;
    return n > 0 ? items.slice(0, n) : items;
};

/* 멤버십은 별도 페이지다. 그 페이지 안에서는 스크롤, 밖에서는 이동. */
function goMembership() {
    const el = document.getElementById('membership');
    if (el) { el.scrollIntoView({ behavior: 'smooth' }); return; }
    location.href = '/membership';
}

/* =====================================================
   콘텐츠 데이터 — TenStore(DB)에서 로드
   관리자 콘솔에서 편집하면 사이트에 실시간 반영됩니다.
   ===================================================== */
let HANDBOOKS = [];

/* 핸드북 과정 표시 — 이름·색은 분류 관리(categories)에서 온다.
   표지 워터마크 글자만 색조에서 끌어내 예전 모양을 유지한다. */
const DECO_OF = { 'tag-vibe': 'V', 'tag-genai': 'G', 'tag-biz': 'B' };
function courseMeta(slug) {
    const c = catOf('handbook', slug);
    const tone = catTone('handbook', slug);
    return {
        name: c ? c.name : (slug || '미분류'),
        tagClass: tone,
        coverClass: (TenStore.COVER_OF || {})[tone] || 'cover-biz',
        deco: DECO_OF[tone] || 'B'
    };
}

const ACCESS_META = {
    public:   { label: '전체 공개',   cls: 'access-public',   icon: '🌐' },
    member:   { label: '회원 공개',   cls: 'access-member',   icon: '👥' },
    enrolled: { label: '수강생 전용', cls: 'access-enrolled', icon: '🔒' },
};

/* 강의 데이터 — 관리자 콘솔에서 등록. videoId를 채우면 팝업 플레이어에서 즉시 재생. */
let LECTURES = [];

/* 앱 쇼케이스 — 관리자 콘솔에서 등록 */
let APPS = [];

/* ============ 핸드북 탐색기 ============ */
/* 과정(분류)과 레벨 두 축으로 좁히고, 제목·소개로 검색한다. */
const grid = document.getElementById('handbookGrid');
let curLevel = 'all';
let hbFilter = null;

function handbookCardHtml(h, i) {
    const c = courseMeta(h.course_tag);
    const a = ACCESS_META[h.access_level] || ACCESS_META.public;
    const unlocked = h.access_level === 'public';
    return `
        <article class="handbook-card" style="animation-delay:${i * 0.06}s">
            <div class="hb-cover ${c.coverClass}" data-deco="${c.deco}${h.level_tier}">
                <span class="hb-level outfit">LEVEL ${h.level_tier}</span>
            </div>
            <div class="hb-body">
                <div class="hb-meta">
                    <span class="hb-course-tag ${c.tagClass}">${escHtml(c.name)}</span>
                    <span class="hb-access ${a.cls}">${a.icon} ${a.label}</span>
                </div>
                <h3 class="hb-title">${escHtml(h.title)}</h3>
                <p class="hb-desc">${escHtml(h.desc)}</p>
                <button class="hb-open ${unlocked ? 'unlocked' : 'locked'}" data-hb="${h.id}">
                    ${unlocked ? '핸드북 열기 →' : (h.access_level === 'member' ? '로그인 후 열람' : '수강 등록 후 열람')}
                </button>
            </div>
        </article>`;
}

function initHandbookFilter() {
    hbFilter = createFilter({
        scope: 'handbook',
        unit: '권',
        els: { search: 'hbSearch', clear: 'hbSearchClear', cats: 'hbCats', count: 'hbCount', grid: 'handbookGrid' },
        params: { q: 'q', cat: 'course' },
        getItems: () => HANDBOOKS,
        getCat: h => h.course_tag,
        getFields: h => [h.title, h.desc, catName('handbook', h.course_tag)],
        extra: h => curLevel === 'all' || h.level_tier === Number(curLevel),
        renderEmpty: g => {
            g.innerHTML = '<div class="handbook-empty">등록된 핸드북이 없습니다.<br>새 교재는 관리자 콘솔 업로드 즉시 이곳에 반영됩니다.</div>';
        },
        render: (items, g) => { g.innerHTML = items.map(handbookCardHtml).join(''); }
    });
}

function renderHandbooks() {
    if (hbFilter) { hbFilter.draw(); return; }
    if (!grid) return;
    const items = limited(HANDBOOKS.filter(h => curLevel === 'all' || h.level_tier === Number(curLevel)), grid);
    grid.innerHTML = items.length
        ? items.map(handbookCardHtml).join('')
        : '<div class="handbook-empty">해당 레벨의 핸드북이 아직 없습니다.<br>새 교재는 관리자 콘솔 업로드 즉시 이곳에 반영됩니다.</div>';
}

/* 레벨은 분류와는 다른 축이라 칩 줄을 따로 둔다 */
document.querySelectorAll('.level-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.level-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        curLevel = chip.dataset.level;
        renderHandbooks();
    });
});

on(grid, 'click', async e => {
    const btn = e.target.closest('.hb-open');
    if (!btn) return;
    const hb = HANDBOOKS.find(h => String(h.id) === String(btn.dataset.hb));
    if (!hb) return;

    // 접근 권한 확인 — 회원 전용은 로그인 필요
    if (hb.access_level === 'member') {
        let profile = null;
        try { profile = await TenStore.getMemberProfile(); } catch (_) {}
        if (!profile) {
            showToast('회원 전용 핸드북입니다. 로그인 후 이용해 주세요.');
            goMembership();
            return;
        }
    }

    // 수강생 전용 권한은 별도 수강권한 관리 기능이 연결된 뒤에만 열람
    if (hb.access_level === 'enrolled') {
        showToast('수강생 전용 핸드북입니다. 과정 등록 및 수강 권한 부여 후 이용할 수 있습니다.');
        return;
    }

    // 연결 링크가 있으면 새 탭으로 이동 (http/https 만 허용)
    const link = String(hb.link || '').trim();
    if (/^https?:\/\//i.test(link)) {
        if (hb.linkTarget === '_self') {
            window.location.assign(link);
        } else {
            window.open(link, '_blank', 'noopener');
        }
    } else {
        showToast(`『${hb.title}』 연결 링크가 아직 등록되지 않았습니다. 관리자 콘솔에서 링크를 입력해 주세요.`);
    }
});

renderHandbooks();

/* ============ 강의 카드 & YouTube 새 창 연결 ============ */
const lectureGrid = document.getElementById('lectureGrid');
let lecFilter = null;

function lectureCardHtml(v) {
    const youtubeUrl = youtubeWatchUrl(v.videoId);
    const tag = youtubeUrl ? 'a' : 'button';
    const attrs = youtubeUrl
        ? `href="${escHtml(youtubeUrl)}" target="_blank" rel="noopener noreferrer"`
        : 'type="button" data-missing-video="true"';
    const actionLabel = youtubeUrl ? 'YouTube에서 새 창으로 보기' : 'YouTube 링크 미등록';
    const thumb = ytThumbUrl(youtubeUrl);
    const label = catName('lecture', v.cat) || v.cat || '';
    return `
        <${tag} class="lecture-card visible" ${attrs} aria-label="${escHtml(v.title)} - ${actionLabel}">
            <div class="lecture-thumb${thumb ? '' : ' is-blank'}">
                ${thumb
                    ? `<img class="lecture-shot" src="${thumb}" alt="" loading="lazy" decoding="async" width="480" height="360">`
                    : `<img class="thumb-mark" src="/brand/TenAI_cream.png" alt="" aria-hidden="true" loading="lazy" decoding="async" width="1040" height="440">
                       <span class="thumb-note">${escHtml(label || 'TEN AI 강의')}</span>`}
                <div class="play"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
                ${v.dur ? `<span class="dur outfit">${escHtml(v.dur)}</span>` : ''}
            </div>
            <div class="lecture-body">
                <div class="lecture-cat">${escHtml(label)}</div>
                <div class="lecture-title">${escHtml(v.title)}</div>
            </div>
        </${tag}>`;
}

function initLectureFilter() {
    lecFilter = createFilter({
        scope: 'lecture',
        unit: '편',
        els: { search: 'lecSearch', clear: 'lecSearchClear', cats: 'lecCats', count: 'lecCount', grid: 'lectureGrid' },
        params: { q: 'lq', cat: 'lcat' },
        getItems: () => LECTURES,
        getCat: v => v.cat,
        getFields: v => [v.title, catName('lecture', v.cat), v.cat],
        renderEmpty: g => {
            g.innerHTML = '<div class="news-empty" style="grid-column:1/-1;">등록된 강의가 없습니다. 관리자 콘솔에서 강의를 추가해 주세요.</div>';
        },
        render: (items, g) => { g.innerHTML = items.map(lectureCardHtml).join(''); }
    });
}

function renderLectures() {
    if (lecFilter) { lecFilter.draw(); return; }
    if (!lectureGrid) return;
    lectureGrid.innerHTML = LECTURES.length
        ? limited(LECTURES, lectureGrid).map(lectureCardHtml).join('')
        : '<div class="news-empty" style="grid-column:1/-1;">등록된 강의가 없습니다. 관리자 콘솔에서 강의를 추가해 주세요.</div>';
}

on(lectureGrid, 'click', e => {
    const card = e.target.closest('.lecture-card[data-missing-video]');
    if (card) showToast('이 강의의 YouTube 링크가 아직 등록되지 않았습니다.');
});

/* ============ 뉴스 & 홍보 — 세 창구 현황 ============
   유튜브·핸드북·신규앱 카드의 수치를 실제 데이터로 맞춘다.
   데이터가 아직 없으면 숫자 대신 안내 문구를 남긴다. */
function updatePromoMeta() {
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

    const playable = LECTURES.filter(v => youtubeWatchUrl(v.videoId)).length;
    set('promoLectureMeta', LECTURES.length
        ? `강의 ${LECTURES.length}편${playable ? ` · 바로 시청 ${playable}편` : ''}`
        : '채널 강의 업데이트 중');

    const openHb = HANDBOOKS.filter(h => h.access_level === 'public').length;
    set('promoHandbookMeta', HANDBOOKS.length
        ? `핸드북 ${HANDBOOKS.length}권${openHb ? ` · 공개 교재 ${openHb}권` : ''}`
        : '핸드북 목록 준비 중');

    const fresh = APPS.filter(isNewApp).length;
    set('promoAppMeta', fresh
        ? `신규 공개 ${fresh}개 · 전체 ${APPS.length}개`
        : (APPS.length ? `공개된 앱 ${APPS.length}개` : '신규앱 준비 중'));
}

/* ============ 신규앱 판정 ============
   관리자가 NEW 로 지정했거나(isNew), 공개일이 최근 30일 이내면 신규로 본다.
   담당자가 배지를 내리는 것을 잊어도 안내판이 자동으로 정리된다. */
const NEW_APP_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const isNewApp = a => {
    if (a.isNew === true) return true;
    const at = Number(a.releasedAt) || 0;
    return at > 0 && Date.now() - at <= NEW_APP_WINDOW_MS;
};
// 안내판 정렬: 공개일이 최신인 순, 공개일이 없으면 등록 역순
const newAppOrder = (a, b) =>
    (Number(b.releasedAt) || 0) - (Number(a.releasedAt) || 0) ||
    (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
const NEW_FLAG_HTML = '<span class="new-flag"><span class="new-flag-dot"></span>NEW</span>';

/* ============ 신규앱 안내판 ============ */
function renderNewApps() {
    const board = document.getElementById('newAppsBoard');
    const count = document.getElementById('newAppsCount');
    const items = APPS.filter(isNewApp).sort(newAppOrder);

    if (count) count.textContent = items.length
        ? `새로 공개된 앱 ${items.length}개 · 최근 30일 기준`
        : '현재 새로 공개된 앱이 없습니다';

    // 내비게이션 점과 홍보 카드의 NEW 표식을 같은 판정으로 켠다
    document.querySelectorAll('.nav-new').forEach(el => el.classList.toggle('has-new', items.length > 0));
    const promoFlag = document.getElementById('promoNewFlag');
    if (promoFlag) promoFlag.hidden = items.length === 0;

    if (!board) return;
    if (!items.length) {
        board.innerHTML = '<div class="board-empty">새 앱이 공개되면 이곳에 가장 먼저 안내됩니다.<br>지난 앱은 앱 쇼케이스에서 모두 확인하실 수 있습니다.</div>';
        return;
    }

    board.innerHTML = limited(items, board).map(a => `
    <article class="board-item">
        <span class="board-flag">${NEW_FLAG_HTML}</span>
        <div class="board-item-head">
            <h4 class="board-item-name">${escHtml(a.name)}</h4>
            ${catName(a.category) ? `<span class="app-badge ${catTone(a.category)}">${escHtml(catName(a.category))}</span>` : ''}
        </div>
        <p class="board-item-desc">${escHtml(a.oneliner)}</p>
        <p class="board-item-date">${a.releasedAt ? '공개일 · ' + fmtDate(a.releasedAt) : '공개 준비 중'}</p>
        <div class="board-item-actions">
            <a class="app-btn launch" href="${safeUrl(a.launch, '/apps')}" ${a.launch ? 'target="_blank" rel="noopener"' : 'data-nolink="launch"'}>
                ⚡ 바로 실행
            </a>
            <a class="app-btn gh" href="${safeUrl(a.github, '/apps')}" ${a.github ? 'target="_blank" rel="noopener"' : 'data-nolink="github"'}>
                GitHub 보러가기
            </a>
        </div>
    </article>
    `).join('');
}

// 링크 미설정 앱 안내 — 안내판에도 쇼케이스와 같은 위임 처리를 건다
onId('newAppsBoard', 'click', e => {
    const btn = e.target.closest('[data-nolink]');
    if (!btn) return;
    e.preventDefault();
    showToast(btn.dataset.nolink === 'launch'
        ? '해당 앱은 정식 배포 후 실행 링크가 연결됩니다.'
        : 'GitHub 저장소는 오픈소스 공개 후 연결됩니다.');
});

/* =====================================================================
   분류 필터 + 검색 — 소식 · Q&A · 핸드북 · 강의 · 앱 공통
   ---------------------------------------------------------------------
   콘텐츠가 계속 늘어난다. 눈으로 훑는 대신 분류로 좁히고 낱말로 찾게 한다.
   다섯 목록이 같은 규칙을 쓰도록 여기 한 군데에 두었다.

   검색 규칙
     - 띄어쓴 낱말은 모두 만족해야 한다 (AND). '탄소 계산' → 둘 다 든 것
     - 대소문자를 가리지 않는다
     - 쉼표·가운뎃점·괄호는 낱말 경계로 본다 ('탄소·ESG' → '탄소 ESG')
     - 붙여 쓴 한글도 띄어 쓴 데이터에 걸린다 ('탄소리서치' ↔ '탄소 리서치')
   ===================================================================== */

const SEP_RE = /[,·․‧/|\\()\[\]{}<>"'`~!?;:_\-–—+&]+/g;
const normQuery = v => String(v == null ? '' : v).toLowerCase()
    .replace(SEP_RE, ' ').replace(/\s+/g, ' ').trim();
const squash = v => normQuery(v).replace(/ /g, '');

/* 붙여 쓴 한글 검색어가 띄어 쓴 데이터에도 걸리게 보조 비교를 함께 한다. 다만

   1. 필드마다 따로 본다. 전부 이어 붙이면 앞 필드 끝과 뒤 필드 앞이 붙어
      없던 낱말이 생긴다.
   2. 한글이 든 두 글자 이상 검색어에만 쓴다. 영문에 쓰면 낱말 사이가 붙어
      'festival carbon' → 'festivalcarbon' 이 되고 'lca' 가 걸린다.
      영문은 원래 비교로 충분하다 — 'runiq' 는 'runiqzip' 에 걸린다. */
const HANGUL_RE = /[가-힣]/;
function matchesTerms(fields, terms) {
    if (!terms.length) return true;
    const norm = fields.map(normQuery);
    const hay = norm.join(' ');
    const flat = norm.map(squash);
    return terms.every(t =>
        hay.includes(t) ||
        (HANGUL_RE.test(t) && t.length >= 2 && flat.some(f => f.includes(squash(t)))));
}

/* ---------- 분류 조회 ---------- */
/* 관리자 콘솔 > 분류 관리에서 편집한 목록. 아직 못 읽었으면 기본값이 온다. */
const catList = scope => (TenStore.categoriesOf ? TenStore.categoriesOf(scope) : []);
const catOf   = (scope, slug) => catList(scope).find(c => c.slug === slug) || null;
const catName = (scope, slug) => (catOf(scope, slug) || {}).name || '';
// 배지 색은 분류에서 나온다. 화이트리스트라 임의 클래스가 끼어들 수 없다.
const CAT_TONE = { 'tag-vibe': 'tag-vibe', 'tag-genai': 'tag-genai', 'tag-biz': 'tag-biz' };
const catTone = (scope, slug) => CAT_TONE[(catOf(scope, slug) || {}).tone] || 'tag-biz';

/* ---------- 필터 하나를 만든다 ----------
   목록마다 이 함수를 한 번 불러 검색창·분류 칩·결과 수를 붙인다.
   해당 페이지에 컨테이너가 없으면 아무 일도 하지 않는다(홈의 요약 목록 등). */
function createFilter(opts) {
    const els = opts.els || {};
    const grid = document.getElementById(els.grid);
    if (!grid) return null;                      // 이 페이지에 목록이 없다

    const input  = els.search ? document.getElementById(els.search) : null;
    const clear  = els.clear  ? document.getElementById(els.clear)  : null;
    const catBox = els.cats   ? document.getElementById(els.cats)   : null;
    const countEl = els.count ? document.getElementById(els.count)  : null;
    const scope  = opts.scope;
    const pq = (opts.params && opts.params.q) || 'q';
    const pc = (opts.params && opts.params.cat) || 'cat';
    const unit = opts.unit || '건';

    const state = { q: '', cat: 'all' };

    const slugOf = item => String(opts.getCat(item) || '');

    function selected() {
        const terms = normQuery(state.q).split(' ').filter(Boolean);
        return opts.getItems().filter(item =>
            (state.cat === 'all' || slugOf(item) === state.cat) &&
            (!opts.extra || opts.extra(item)) &&
            matchesTerms(opts.getFields(item), terms));
    }

    /* 분류 칩은 실제로 콘텐츠가 있는 분류만 보여 준다 — 빈 칩을 눌러 헛걸음하지 않게 */
    function renderCats() {
        if (!catBox) return;
        const all = opts.getItems();
        const counts = new Map();
        all.forEach(item => {
            const s = slugOf(item);
            if (s) counts.set(s, (counts.get(s) || 0) + 1);
        });
        const chips = catList(scope).filter(c => counts.has(c.slug))
            .map(c => ({ slug: c.slug, name: c.name, n: counts.get(c.slug) }));
        const unfiled = all.filter(item => !slugOf(item)).length;
        // 누를 이유가 없으면 칩 줄을 통째로 숨긴다 —
        //   분류된 것이 하나도 없거나('전체'만 남음),
        //   전부 같은 분류 하나뿐이거나('전체'와 그 분류가 같은 결과)
        if (!chips.length || (chips.length === 1 && !unfiled)) {
            catBox.innerHTML = ''; catBox.hidden = true; return;
        }
        catBox.hidden = false;
        chips.unshift({ slug: 'all', name: '전체', n: all.length });
        if (unfiled) chips.push({ slug: '', name: '미분류', n: unfiled });

        catBox.innerHTML = chips.map(c => `
            <button type="button" class="course-tab cat-chip${c.slug === state.cat ? ' active' : ''}"
                    data-cat="${escHtml(c.slug)}" aria-pressed="${c.slug === state.cat}">
                ${escHtml(c.name)} <span class="cat-chip-n">${c.n}</span>
            </button>`).join('');
    }

    /* 주소에 검색 상태를 남긴다 — 결과 화면을 그대로 공유·북마크할 수 있게 */
    function syncUrl() {
        const u = new URL(location.href);
        state.q ? u.searchParams.set(pq, state.q) : u.searchParams.delete(pq);
        state.cat !== 'all' ? u.searchParams.set(pc, state.cat) : u.searchParams.delete(pc);
        history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
    }

    const narrowed = () => !!state.q || state.cat !== 'all';

    function draw() {
        const all = opts.getItems();
        renderCats();

        if (!all.length) {
            if (countEl) countEl.textContent = '';
            opts.renderEmpty ? opts.renderEmpty(grid) : (grid.innerHTML = '');
            return;
        }

        const items = limited(selected(), grid);
        if (countEl) {
            countEl.textContent = narrowed()
                ? `전체 ${all.length}${unit} 중 ${items.length}${unit}`
                : `전체 ${all.length}${unit}`;
        }

        if (!items.length && narrowed()) {
            grid.innerHTML = `<div class="filter-empty">
                ${state.q ? `'${escHtml(state.q)}'에 해당하는 결과가 없습니다.` : '이 분류에 해당하는 결과가 없습니다.'}<br>
                다른 낱말로 찾아보시거나 <button type="button" class="link-btn" data-reset-filter>전체 목록 보기</button>를 눌러 주세요.
            </div>`;
            return;
        }
        opts.render(items, grid);
    }

    function reset() {
        state.q = ''; state.cat = 'all';
        if (input) input.value = '';
        if (clear) clear.hidden = true;
        syncUrl(); draw();
    }

    /* ---- 주소에 담겨 온 상태를 먼저 읽는다 ---- */
    const params = new URLSearchParams(location.search);
    state.q = params.get(pq) || '';
    const wantCat = params.get(pc);
    // 빈 문자열은 '미분류' 라는 뜻이므로 유효한 값이다
    state.cat = wantCat !== null && (wantCat === '' || catList(scope).some(c => c.slug === wantCat))
        ? wantCat : 'all';
    if (input) input.value = state.q;
    if (clear) clear.hidden = !state.q;

    /* ---- 이벤트 ---- */
    if (input) {
        let timer;
        const commit = () => {
            state.q = input.value;
            if (clear) clear.hidden = !state.q;
            syncUrl(); draw();
        };
        input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(commit, 150); });
        // 엔터로 폼이 제출되거나 esc 로 값만 비고 화면이 안 바뀌는 일이 없게
        input.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
        input.addEventListener('search', commit);
    }
    on(clear, 'click', () => { reset(); if (input) input.focus(); });
    on(catBox, 'click', e => {
        const btn = e.target.closest('[data-cat]');
        if (!btn) return;
        state.cat = btn.dataset.cat;
        syncUrl(); draw();
    });
    on(grid, 'click', e => { if (e.target.closest('[data-reset-filter]')) reset(); });

    return { draw, reset, state };
}

/* ============ 앱 검색 ============ */
let appFilter = null;

function initAppFilter() {
    appFilter = createFilter({
        scope: 'app',
        unit: '개',
        els: { search: 'appSearch', clear: 'appSearchClear', cats: 'appCats', count: 'appsCount', grid: 'appsGrid' },
        params: { q: 'q', cat: 'cat' },
        getItems: () => APPS,
        getCat: a => a.category,
        getFields: a => [a.name, a.oneliner, a.how, a.keywords, catName('app', a.category)],
        renderEmpty: grid => {
            grid.innerHTML = '<div class="news-empty" style="grid-column:1/-1;">등록된 앱이 없습니다. 관리자 콘솔에서 앱을 추가해 주세요.</div>';
        },
        render: (items, grid) => { grid.innerHTML = items.map(appCardHtml).join(''); }
    });
}

/* ============ 앱 쇼케이스 ============ */
function appCardHtml(a) {
    const tone = catTone('app', a.category);
    const name = catName('app', a.category);
    return `
    <article class="app-card visible${isNewApp(a) ? ' is-new' : ''}">
        <div class="app-thumb tint-${tone}">
            ${isNewApp(a) ? NEW_FLAG_HTML : ''}
            <img class="thumb-mark" src="/brand/TenAI_ink.png" alt="" aria-hidden="true" loading="lazy" decoding="async" width="1040" height="440">
            <div class="app-overlay">${escHtml(a.how)}</div>
        </div>
        <div class="app-body">
            <div class="app-head">
                <h3 class="app-name">${escHtml(a.name)}</h3>
                ${name ? `<span class="app-badge ${tone}">${escHtml(name)}</span>` : ''}
            </div>
            <p class="app-oneliner">${escHtml(a.oneliner)}</p>
            <div class="app-actions">
                <a class="app-btn launch" href="${safeUrl(a.launch)}" ${a.launch ? 'target="_blank" rel="noopener"' : 'data-nolink="launch"'}>
                    ⚡ App Launch
                </a>
                <a class="app-btn gh" href="${safeUrl(a.github)}" ${a.github ? 'target="_blank" rel="noopener"' : 'data-nolink="github"'}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.4.6.1.83-.26.83-.58v-2.03c-3.34.73-4.04-1.6-4.04-1.6-.55-1.4-1.34-1.76-1.34-1.76-1.08-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.5 1 .1-.78.42-1.31.76-1.6-2.66-.31-5.47-1.34-5.47-5.93 0-1.32.47-2.39 1.24-3.23-.13-.3-.54-1.53.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 016 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.65.24 2.88.12 3.18.77.84 1.23 1.9 1.23 3.23 0 4.6-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.23v3.3c0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>
                    GitHub 보러가기
                </a>
            </div>
        </div>
    </article>`;
}

function renderApps() {
    if (appFilter) { appFilter.draw(); return; }
    // 필터가 아직 붙기 전(초기 로드)에도 목록은 그린다
    const grid = document.getElementById('appsGrid');
    if (!grid) return;
    grid.innerHTML = APPS.length
        ? limited(APPS, grid).map(appCardHtml).join('')
        : '<div class="news-empty" style="grid-column:1/-1;">등록된 앱이 없습니다. 관리자 콘솔에서 앱을 추가해 주세요.</div>';
}

// 실행/GitHub 링크 미설정 앱: 인라인 onclick 대신 이벤트 위임 (JS 인젝션 차단)
onId('appsGrid', 'click', e => {
    const btn = e.target.closest('[data-nolink]');
    if (!btn) return;
    e.preventDefault();
    showToast(btn.dataset.nolink === 'launch'
        ? '해당 앱은 정식 배포 후 실행 링크가 연결됩니다.'
        : 'GitHub 저장소는 오픈소스 공개 후 연결됩니다.');
});

/* ============ 소셜 로그인 (데모) ============ */
/* 프로필 사진 주소 — https 만 받는다. 구글이 주는 주소는 항상 https 다. */
const safeImg = u => {
    const v = String(u || '').trim();
    return /^https:\/\//i.test(v) ? v : '';
};

/* ============ 구글 로그인 ============

   길이 둘 있다. 둘 다 같은 구글 계정으로, 같은 회원 정보에 닿는다.

     (가) 구글이 그린 버튼  — 구글 스크립트가 페이지 안에서 ID 토큰을 바로
          건네준다. 받는 쪽이 우리 도메인이라 동의 화면 제목이 'tenai.kr'.
     (나) 우리 버튼        — 주소창을 Supabase → 구글 → 우리 사이트로 옮긴다.
          토큰을 Supabase 가 받으므로 제목에 'xxxx.supabase.co' 가 뜬다.

   (가)가 뜨면 (나)는 숨긴다. 구글 스크립트가 막히거나 이 도메인이 구글
   콘솔의 '승인된 자바스크립트 원본' 에 없으면 (가)는 아예 그려지지 않으므로
   (나)가 그대로 남는다 — 어느 쪽이든 로그인은 끊기지 않는다. */

/* nonce 한 쌍을 만든다. 구글에는 해시한 값을, Supabase 에는 원본을 준다.
   (Supabase 가 원본을 해시해 토큰 속 값과 맞춰 본다) */
async function makeGoogleNonce() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const raw = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const hashed = Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    return { raw, hashed };
}

/* 구글 스크립트를 한 번만 불러온다 */
let gsiLoading = null;
function loadGsiScript() {
    if (window.google && window.google.accounts && window.google.accounts.id) {
        return Promise.resolve(true);
    }
    if (gsiLoading) return gsiLoading;
    gsiLoading = new Promise(resolve => {
        const el = document.createElement('script');
        el.src = 'https://accounts.google.com/gsi/client';
        el.async = true;
        el.defer = true;
        el.onload = () => resolve(!!(window.google && window.google.accounts && window.google.accounts.id));
        el.onerror = () => resolve(false);
        document.head.appendChild(el);
        // 네트워크가 막힌 곳(사내망 등)에서 onerror 가 오래 걸릴 수 있다
        setTimeout(() => resolve(!!(window.google && window.google.accounts && window.google.accounts.id)), 8000);
    });
    return gsiLoading;
}

/* 구글이 이 주소를 승인했는지 확인한다.

   왜 눈으로 못 고르나
     '승인된 자바스크립트 원본' 에 이 주소가 없으면 구글은 403 을 받고도
     겉보기에 똑같은 버튼을 그린다 — 로고도 글자도 다 있는데 눌러도
     아무 일이 없다. 높이도 DOM 도 성공했을 때와 구분되지 않는다.
     (배포 미리보기에서 실제로 확인했다: 40px, role=button, 구글 로고,
      'Continue with Google' 까지 똑같다.)

   그래서 구글이 직접 뱉는 말을 듣는다
     이때 구글은 console.error 로 '[GSI_LOGGER]: The given origin is not
     allowed for the given client ID.' 를 남긴다. 페이지에서 잡을 수 있는
     신호는 이것뿐이다 — 403 은 iframe 이라 performance 에 안 잡히고,
     교차 출처라 responseStatus 도 0 으로 가려진다.

   왜 이 파일이 뜨자마자 설치하나
     구글 스크립트는 불러오는 순간 console.error 를 자기 안에 붙잡아
     둔다. 스크립트를 부른 '뒤에' 감싸면 우리 손을 거치지 않는다.
     (이 실수로 한 번 놓쳤다 — 미리보기에서 오류가 두 번 났는데도
      감지하지 못했다.) 그래서 무조건 먼저 건다.

   원래 함수는 항상 그대로 불러 준다 — 로그를 삼키지 않는다. */
let gsiComplained = false;
(function watchGsiErrors() {
    if (typeof console === 'undefined' || typeof console.error !== 'function') return;
    const original = console.error;
    console.error = function (...args) {
        try {
            if (args.map(a => String(a)).join(' ').includes('GSI_LOGGER')) gsiComplained = true;
        } catch (e) { /* 무슨 일이 있어도 원래 로그는 막지 않는다 */ }
        return original.apply(this, args);
    };
})();

const GSI_BTN_OPTS = {
    type: 'standard', theme: 'outline', size: 'large',
    text: 'continue_with', shape: 'rectangular',
    logo_alignment: 'center', locale: 'ko'
};

async function initGoogleButton() {
    const slot = document.getElementById('googleGsiSlot');
    const ours = document.getElementById('googleLoginBtn');
    if (!slot || !ours) return;

    const clientId = (window.TenStore && TenStore.googleClientId) || '';
    if (!clientId) return;                       // 로컬 모드이거나 ID 미설정 — 우리 버튼으로 간다
    if (!(window.crypto && crypto.subtle)) return;   // 구형 브라우저

    if (!(await loadGsiScript())) return;

    let nonce;
    try { nonce = await makeGoogleNonce(); } catch (e) { return; }

    /* 버튼이 들어갈 실제 폭. 슬롯이 아직 숨겨져 있으므로 부모에서 잰다. */
    const room = Math.round((slot.parentElement || slot).getBoundingClientRect().width)
        || Math.round(slot.getBoundingClientRect().width) || 320;
    const width = Math.min(400, Math.max(200, room));

    /* 먼저 화면 밖에서 시험 삼아 한 번 그려 본다.
       여기서 판정이 끝날 때까지 우리 버튼은 그대로 둔다 — 멀쩡한 버튼을
       치워 놓고 나중에 되돌리는 일이 없도록. */
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;left:-9999px;top:0;width:' + width + 'px;pointer-events:none;';
    document.body.appendChild(probe);

    const cleanUp = () => { probe.remove(); };

    try {
        google.accounts.id.initialize({
            client_id: clientId,
            nonce: nonce.hashed,
            auto_select: false,          // 묻지 않고 조용히 들어가지 않는다
            cancel_on_tap_outside: true,
            itp_support: true,
            callback: async (res) => {
                try {
                    await TenStore.signInWithGoogleIdToken(res && res.credential, nonce.raw);
                    const profile = await TenStore.getMemberProfile();
                    await refreshMemberUI();
                    showToast(`${(profile && (profile.name || profile.email)) || '회원'}님, 환영합니다.`);
                } catch (e) {
                    showToast(e.message || '구글 로그인을 마치지 못했습니다.');
                }
            }
        });
        google.accounts.id.renderButton(probe, Object.assign({ width }, GSI_BTN_OPTS));
    } catch (e) {
        cleanUp();
        return;                                  // 무슨 일이 있어도 우리 버튼은 남는다
    }

    /* 버튼이 그려지고 나서도 한참 더 듣는다.
       구글의 거부(403)와 그에 따른 오류 기록은 버튼이 그려진 '뒤에'
       도착한다. 서둘러 판정하면 죽은 버튼을 진짜인 줄 알고 내건다.
       시험용 자리는 화면 밖이라 기다리는 동안에도 우리 버튼이 그대로
       보인다 — 늦어서 손해 보는 것은 없다. */
    const QUIET_MS = 2400;                               // 이만큼 조용해야 받아들인다
    const started = Date.now();
    let drawn = false;
    while (Date.now() - started < 5000) {
        if (gsiComplained) { cleanUp(); return; }        // 구글이 거부했다
        if (!drawn && probe.getBoundingClientRect().height > 0) drawn = true;
        if (drawn && Date.now() - started >= QUIET_MS) break;
        await new Promise(r => setTimeout(r, 120));
    }
    if (!drawn || gsiComplained) { cleanUp(); return; }

    /* 폭이 맞는지도 시험 자리에서 본다.
       구글 버튼은 min-width 가 내용 길이로 잡혀 있어, 폭을 작게 달라고
       해도 글자가 길면 그만큼 삐져나온다. 잘라 붙이거나 축소하느니
       안 쓰는 편이 낫다 — 예전 버튼은 어느 폭에서도 멀쩡하다. */
    const inner = probe.querySelector('[role="button"]');
    const drawnW = inner ? Math.ceil(inner.getBoundingClientRect().width) : 0;
    if (!drawnW || drawnW > room) { cleanUp(); return; }

    cleanUp();

    // 여기까지 왔으면 구글이 이 주소를 받아 주고 폭도 맞는다. 진짜 자리에 건다.
    slot.hidden = false;
    try {
        google.accounts.id.renderButton(slot, Object.assign({ width }, GSI_BTN_OPTS));
    } catch (e) {
        slot.hidden = true;
        return;
    }
    for (let i = 0; i < 20; i++) {
        if (!gsiComplained && slot.getBoundingClientRect().height > 0) {
            slot.classList.add('is-ready');
            ours.hidden = true;
            return;
        }
        if (gsiComplained) break;
        await new Promise(r => setTimeout(r, 100));
    }
    slot.hidden = true;                          // 끝내 안 그려졌다 — 우리 버튼으로 간다
}

onId('googleLoginBtn', 'click', async () => {
    const btn = document.getElementById('googleLoginBtn');
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '구글로 이동 중…';
    try {
        await TenStore.signInWithGoogle(location.origin + '/membership');
        // 여기서 페이지가 구글로 넘어간다. 돌아오지 않으면 아래는 실행되지 않는다.
    } catch (e) {
        btn.disabled = false;
        btn.innerHTML = label;
        showToast(e.message || '구글 로그인을 시작하지 못했습니다.');
    }
});

/* 아직 안 붙인 제공자(카카오)는 눌러도 안내만 */
document.querySelectorAll('[data-social]').forEach(btn => {
    btn.addEventListener('click', () => {
        showToast(`${btn.dataset.social} 로그인은 준비 중입니다. 지금은 구글 또는 이메일로 이용해 주세요.`);
    });
});

/* ---- 구글에서 돌아왔을 때 ----
   supabase-js 가 주소에 실려 온 인증 정보를 알아서 세션으로 바꾼다.
   여기서는 두 가지만 한다 — 결과를 알려 주고, 주소를 깨끗이 한다.

   주소를 지우는 이유
     인증 흔적(#access_token=… 또는 ?code=…)이 주소창에 남으면 사용자가
     그대로 복사해 공유할 수 있고, 새로고침할 때마다 처리되려 한다. */
function oauthErrorText(params) {
    const code = params.get('error_code') || '';
    const desc = params.get('error_description') || params.get('error') || '';
    if (/provider.*not enabled|unsupported/i.test(desc)) {
        return '구글 로그인이 아직 켜져 있지 않습니다. 관리자에게 알려 주세요.';
    }
    if (/redirect|redirect_uri/i.test(desc + code)) {
        return '로그인 후 돌아올 주소가 등록되지 않았습니다. 관리자에게 알려 주세요.';
    }
    return desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : '구글 로그인이 완료되지 않았습니다.';
}

async function handleOAuthReturn() {
    const hash = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
    const query = new URLSearchParams(location.search);
    const hasError = hash.get('error') || query.get('error');
    const hasAuth  = hash.get('access_token') || query.get('code');
    if (!hasError && !hasAuth) return;

    const clean = () => history.replaceState(null, '', location.pathname);

    if (hasError) {
        clean();
        showToast(oauthErrorText(hash.get('error') ? hash : query));
        return;
    }

    // supabase-js 가 세션을 세우기까지 잠깐 걸린다
    let profile = null;
    for (let i = 0; i < 20 && !profile; i++) {
        try { profile = await TenStore.getMemberProfile(); } catch (_) {}
        if (!profile) await new Promise(r => setTimeout(r, 150));
    }
    clean();
    if (profile) {
        await refreshMemberUI();
        showToast(`${profile.name || profile.email || '회원'}님, 환영합니다.`);
    } else {
        showToast('로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요.');
    }
}
document.querySelectorAll('[data-login]').forEach(btn => {
    btn.addEventListener('click', () => {
        closeMobileMenu();
        goMembership();
    });
});

/* ============ Toast ============ */
const toast = document.getElementById('toast');
let toastTimer;
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

/* ============ 내비게이션 동작 ============ */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

// 모바일 메뉴
const menuBtn = document.getElementById('menuBtn');
const mobileMenu = document.getElementById('mobileMenu');
/* =====================================================
   키보드 전용 흐름 — 오버레이 포커스 관리
   오버레이가 열리면 포커스를 안으로 옮기고 Tab 을 가둔다.
   닫으면 원래 있던 곳으로 되돌린다. 뒤 배경은 inert 로 잠근다.
   ===================================================== */
const FOCUSABLE_SEL = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
let fxLastFocused = null;

function openOverlay(container) {
    fxLastFocused = document.activeElement;
    const main = document.getElementById('main');
    if (main && 'inert' in HTMLElement.prototype) main.inert = true;

    /* 오버레이는 visibility 전환이 끝나야 포커스를 받을 수 있다.
       전환 종료 신호를 기다리되, 놓칠 경우를 대비해 타임아웃도 둔다. */
    const focusFirst = () => {
        if (container.contains(document.activeElement)) return true;
        const items = Array.from(container.querySelectorAll(FOCUSABLE_SEL))
            .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
        if (!items.length) return false;
        items[0].focus();
        return container.contains(document.activeElement);
    };
    if (!focusFirst()) {
        const onEnd = () => { if (focusFirst()) container.removeEventListener('transitionend', onEnd); };
        container.addEventListener('transitionend', onEnd);
        setTimeout(() => { focusFirst(); container.removeEventListener('transitionend', onEnd); }, 450);
    }

    container._fxTrap = e => {
        if (e.key !== 'Tab') return;
        const list = Array.from(container.querySelectorAll(FOCUSABLE_SEL)).filter(el => el.offsetParent !== null);
        if (!list.length) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    container.addEventListener('keydown', container._fxTrap);
}

function closeOverlay(container) {
    if (container._fxTrap) { container.removeEventListener('keydown', container._fxTrap); container._fxTrap = null; }
    const main = document.getElementById('main');
    if (main && 'inert' in HTMLElement.prototype) main.inert = false;
    if (fxLastFocused && document.contains(fxLastFocused)) { try { fxLastFocused.focus(); } catch (e) {} }
    fxLastFocused = null;
}

function closeMobileMenu() {
    menuBtn.classList.remove('open');
    mobileMenu.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    closeOverlay(mobileMenu);
}
menuBtn.addEventListener('click', () => {
    const opening = !mobileMenu.classList.contains('open');
    menuBtn.classList.toggle('open', opening);
    mobileMenu.classList.toggle('open', opening);
    menuBtn.setAttribute('aria-expanded', String(opening));
    document.body.style.overflow = opening ? 'hidden' : '';
    if (opening) openOverlay(mobileMenu); else closeOverlay(mobileMenu);
});
mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMobileMenu));

/* ============ 현재 페이지 메뉴 표시 ============
   멀티페이지이므로 스크롤 위치가 아니라 주소로 활성 메뉴를 정한다.
   /apps, /apps/, /apps.html 이 모두 같은 곳을 가리키도록 맞춘다. */
(function markActiveNav() {
    const norm = p => {
        const s = String(p || '').split('#')[0].split('?')[0].replace(/\.html$/, '').replace(/\/index$/, '/');
        const t = s.length > 1 && s.endsWith('/') ? s.slice(0, -1) : s;
        return t || '/';
    };
    const here = norm(location.pathname);
    document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(a => {
        const href = a.getAttribute('href') || '';
        if (!href || href.startsWith('#') || /^[a-z]+:/i.test(href)) return;
        const active = norm(href) === here;
        a.classList.toggle('active', active);
        if (active) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
    });
})();

/* ============ 스크롤 등장 애니메이션 ============
   motion-fx.js 가 부팅되면(fx-ready) 등장 연출을 그쪽이 전담한다.
   아래 코드는 모션 레이어가 없을 때를 위한 기본 폴백. */
if (!document.documentElement.classList.contains('fx-ready')) {
    const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll('.animate-on-scroll').forEach(el => revealObserver.observe(el));

    // 스태거(순차) 등장
    document.querySelectorAll('.stagger').forEach(parent => {
        Array.from(parent.children).forEach((child, i) => {
            child.style.transitionDelay = `${i * 0.08}s`;
        });
    });
}

/* ============ 카운터 애니메이션 ============ */
const counterObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const suffix = el.dataset.suffix || '+';
        const dur = 1400;
        const start = performance.now();
        (function tick(now) {
            const p = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            // 매 프레임 최신 목표값 사용 — 데이터 로드로 숫자가 바뀌어도 반영
            const target = Number(el.dataset.counter);
            el.textContent = Math.round(target * eased) + (p === 1 ? suffix : '');
            if (p < 1) requestAnimationFrame(tick);
        })(start);
        counterObserver.unobserve(el);
    });
}, { threshold: 0.6 });
document.querySelectorAll('[data-counter]').forEach(el => counterObserver.observe(el));

/* ============ 마퀴 무한 루프 복제 ============ */
const track = document.getElementById('marqueeTrack');
if (track) track.innerHTML += track.innerHTML;

/* =====================================================
   동적 콘텐츠 — TenStore (Supabase 또는 로컬 모드) 연동
   관리자 콘솔(admin.html)에서 수정한 내용이 반영됩니다.
   ===================================================== */
const escHtml = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
// URL 안전 검증: http/https(및 내부 앵커)만 허용 — javascript:, data: 등 스킴 차단
const safeUrl = (u, fallback) => {
    fallback = fallback || '/apps';
    const s = String(u || '').trim();
    if (!s) return fallback;
    if (s[0] === '#' || s[0] === '/') return escHtml(s);
    return /^https?:\/\//i.test(s) ? escHtml(s) : fallback;
};
// 유튜브 영상 ID 안전 검증: 표준 11자 [A-Za-z0-9_-] 만 허용
const safeVideoId = v => /^[A-Za-z0-9_-]{11}$/.test(String(v || '')) ? v : '';
// YouTube 전체 주소와 영상 ID를 공식 YouTube 시청 주소로 정규화
const youtubeWatchUrl = value => {
    const raw = String(value || '').trim();
    const directId = safeVideoId(raw);
    if (directId) return `https://www.youtube.com/watch?v=${directId}`;
    const legacyWatch = raw.match(/^\/?watch\?v=([A-Za-z0-9_-]{11})(?:[&#]|$)/);
    if (legacyWatch) return `https://www.youtube.com/watch?v=${legacyWatch[1]}`;

    const candidate = /^(?:www\.|m\.|music\.)?youtube\.com\/|^youtu\.be\//i.test(raw)
        ? `https://${raw}`
        : raw;
    try {
        const url = new URL(candidate);
        const host = url.hostname.toLowerCase().replace(/^www\./, '');
        let videoId = '';
        if (host === 'youtu.be') {
            videoId = url.pathname.split('/').filter(Boolean)[0] || '';
        } else if (['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
            if (url.pathname === '/watch') {
                videoId = url.searchParams.get('v') || '';
            } else {
                const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/);
                videoId = match ? match[1] : '';
            }
        }
        const safeId = safeVideoId(videoId);
        return safeId ? `https://www.youtube.com/watch?v=${safeId}` : '';
    } catch {
        return '';
    }
};
// 검증을 마친 watch URL 에서 영상 ID 만 다시 꺼낸다 (썸네일 주소용)
const ytThumbUrl = watchUrl => {
    const m = watchUrl && watchUrl.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : '';
};
const fmtDate = ts => ts ? new Date(ts).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
window.SITE_SETTINGS = null;

/* ----- 설정 반영 (문구, 연락처) ----- */
async function applySettings() {
    const s = await TenStore.getSettings();
    window.SITE_SETTINGS = s;

    // 문구류 (data-set 훅)
    document.querySelectorAll('[data-set]').forEach(el => {
        const key = el.dataset.set;
        if (!(key in s) || s[key] == null || s[key] === '') return;
        // 값이 그대로면 손대지 않는다 — 모션 레이어(motion-fx.js)가 분할해 둔 글자 구조를 지키기 위함.
        // 분할된 요소는 textContent 가 중복되므로 원본 텍스트를 data-fx-text 에서 읽는다.
        const current = el.dataset.fxText != null ? el.dataset.fxText : el.textContent;
        if (key !== 'heroSubtitle' && current === String(s[key])) return;
        delete el.dataset.fxText;
        if (key === 'heroSubtitle') {
            el.innerHTML = escHtml(s[key]).replace(/\n/g, '<br>');
        } else {
            el.textContent = s[key];
        }
    });

    // 링크류
    document.querySelectorAll('[data-mail]').forEach(a => { a.href = 'mailto:' + s.contactEmail; });
    document.querySelectorAll('[data-mail]:not(.btn-primary)').forEach(a => { a.textContent = s.contactEmail; });
    document.querySelectorAll('[data-yt]').forEach(a => { a.href = s.youtubeUrl; });
}

/* ----- 소식 (게시물) ----- */
let NEWS_CACHE = [];
let newsFilter = null;

function newsCardHtml(p) {
    const tone = catTone('post', p.category);
    const label = catName('post', p.category) || p.category || '';
    return `
        <button class="news-card" data-post="${p.id}">
            <div class="news-meta">
                ${label ? `<span class="news-cat ${tone}">${escHtml(label)}</span>` : ''}
                ${p.pinned ? '<span class="news-pin">📌 고정</span>' : ''}
                <span class="news-date">${fmtDate(p.createdAt)}</span>
            </div>
            <div class="news-title">${escHtml(p.title)}</div>
            <p class="news-excerpt">${escHtml((p.content || '').slice(0, 90))}${(p.content || '').length > 90 ? '…' : ''}</p>
            <span class="news-more">자세히 보기 →</span>
        </button>`;
}

function initNewsFilter() {
    newsFilter = createFilter({
        scope: 'post',
        unit: '건',
        els: { search: 'newsSearch', clear: 'newsSearchClear', cats: 'newsCats', count: 'newsCount', grid: 'newsGrid' },
        params: { q: 'q', cat: 'cat' },
        getItems: () => NEWS_CACHE,
        getCat: p => p.category,
        getFields: p => [p.title, p.content, catName('post', p.category), p.category],
        renderEmpty: g => { g.innerHTML = '<div class="news-empty">등록된 소식이 없습니다.</div>'; },
        render: (items, g) => { g.innerHTML = items.map(newsCardHtml).join(''); }
    });
}

async function renderNews() {
    NEWS_CACHE = await TenStore.listPosts();
    const el = document.getElementById('newsGrid');
    if (!el) return;
    if (newsFilter) { newsFilter.draw(); return; }
    el.innerHTML = NEWS_CACHE.length
        ? limited(NEWS_CACHE, el, 6).map(newsCardHtml).join('')
        : '<div class="news-empty">등록된 소식이 없습니다.</div>';
}

const postModal = document.getElementById('postModal');
onId('newsGrid', 'click', e => {
    const card = e.target.closest('.news-card');
    if (!card) return;
    const p = NEWS_CACHE.find(x => x.id === card.dataset.post);
    if (!p) return;
    const mLabel = catName('post', p.category) || p.category || '';
    document.getElementById('postModalMeta').innerHTML =
        (mLabel ? '<span class="news-cat ' + catTone('post', p.category) + '">' + escHtml(mLabel) + '</span>' : '') +
        '<span class="news-date">' + fmtDate(p.createdAt) + '</span>';
    document.getElementById('postModalTitle').textContent = p.title;
    document.getElementById('postModalContent').textContent = p.content || '';
    postModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    openOverlay(postModal);
});
function closePostModal() {
    if (!postModal || !postModal.classList.contains('open')) return;
    postModal.classList.remove('open');
    document.body.style.overflow = '';
    closeOverlay(postModal);
}
onId('postModalClose', 'click', closePostModal);
on(postModal, 'click', e => { if (e.target === postModal) closePostModal(); });
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closePostModal();
    if (mobileMenu && mobileMenu.classList.contains('open')) closeMobileMenu();
});

/* ----- Q&A ----- */
let QNA_CACHE = [];
let qnaFilter = null;

function qnaItemHtml(q) {
    const label = catName('qna', q.category);
    return `
        <div class="qna-item">
            <button class="qna-item-q" aria-expanded="false">
                <span class="q-mark">Q</span>
                <span class="q-text">${escHtml(q.question)}</span>
                ${label ? `<span class="qna-cat ${catTone('qna', q.category)}">${escHtml(label)}</span>` : ''}
                <svg class="q-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="qna-item-a">
                <div class="qna-item-a-inner">
                    <span class="a-mark">A</span>
                    <div>
                        <div class="a-body">${escHtml(q.answer)}</div>
                        <div class="a-by">${escHtml(q.name)} 님의 질문 · ${fmtDate(q.answeredAt || q.createdAt)} 답변</div>
                    </div>
                </div>
            </div>
        </div>`;
}

function initQnaFilter() {
    qnaFilter = createFilter({
        scope: 'qna',
        unit: '건',
        els: { search: 'qnaSearch', clear: 'qnaSearchClear', cats: 'qnaCats', count: 'qnaCount', grid: 'qnaPublicList' },
        params: { q: 'qq', cat: 'qcat' },
        getItems: () => QNA_CACHE,
        getCat: q => q.category,
        getFields: q => [q.question, q.answer, catName('qna', q.category)],
        renderEmpty: g => {
            g.innerHTML = '<div class="qna-empty">아직 공개된 답변이 없습니다.<br>첫 질문을 남겨주세요!</div>';
        },
        render: (items, g) => { g.innerHTML = items.map(qnaItemHtml).join(''); }
    });
}

async function renderPublicQna() {
    QNA_CACHE = await TenStore.listQna({ publicOnly: true });
    const el = document.getElementById('qnaPublicList');
    if (!el) return;
    if (qnaFilter) { qnaFilter.draw(); return; }
    el.innerHTML = QNA_CACHE.length
        ? QNA_CACHE.map(qnaItemHtml).join('')
        : '<div class="qna-empty">아직 공개된 답변이 없습니다.<br>첫 질문을 남겨주세요!</div>';
}


onId('qnaPublicList', 'click', e => {
    const btn = e.target.closest('.qna-item-q');
    if (!btn) return;
    const item = btn.closest('.qna-item');
    const open = item.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
});

onId('qnaForm', 'submit', async e => {
    e.preventDefault();
    const question = document.getElementById('qQuestion').value.trim();
    if (!question) { showToast('질문 내용을 입력해 주세요.'); return; }
    try {
        await TenStore.submitQuestion({
            name: document.getElementById('qName').value.trim() || '익명',
            email: document.getElementById('qEmail').value.trim(),
            question
        });
        e.target.reset();
        showToast('질문이 등록되었습니다. 관리자 답변 후 공개됩니다. 감사합니다!');
    } catch (err) {
        console.error(err);
        showToast('등록에 실패했습니다: ' + err.message);
    }
});

/* ----- 멤버십: 로그인 / 회원가입 / 내 정보 ----- */
const authView = document.getElementById('memberAuthView');
const profileView = document.getElementById('memberProfileView');

// 로그인/회원가입 탭 전환
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        const isLogin = tab.dataset.authTab === 'login';
        const loginForm = document.getElementById('memberLoginForm');
        const signupForm = document.getElementById('memberSignupForm');
        if (loginForm) loginForm.hidden = !isLogin;
        if (signupForm) signupForm.hidden = isLogin;
    });
});

// 로그인 상태에 따라 패널/네비 갱신
async function refreshMemberUI() {
    const navLoginBtns = document.querySelectorAll('.nav-login');
    let profile = null;
    try { profile = await TenStore.getMemberProfile(); } catch (e) { console.warn(e); }
    if (profile) {
        if (authView) authView.hidden = true;
        if (profileView) profileView.hidden = false;

        /* 구글로 들어온 회원은 이름·사진이 있고 주소·회사·직급이 없다.
           빈 줄을 '-' 로 늘어놓는 대신 아예 빼서 화면을 가볍게 둔다. */
        const rows = [
            ['이름', profile.name],
            ['이메일', profile.email],
            ['주소', profile.address],
            ['회사', profile.company],
            ['직급', profile.position]
        ].filter(([, v]) => v && String(v).trim());
        rows.push(['등급', profile.role === 'admin' ? '관리자' : '일반 회원']);

        const head = document.getElementById('profileHead');
        if (head) {
            const avatar = safeImg(profile.avatar_url);
            head.innerHTML = avatar
                ? '<img class="profile-avatar" src="' + escHtml(avatar) + '" alt="" width="52" height="52" referrerpolicy="no-referrer">'
                : '';
            head.hidden = !avatar;
        }

        const rowsEl = document.getElementById('profileRows');
        if (rowsEl) rowsEl.innerHTML = rows.map(([k, v]) =>
            '<div class="profile-row"><span class="k">' + k + '</span><span class="v' +
            (k === '등급' && profile.role === 'admin' ? ' role-admin' : '') + '">' + escHtml(v) + '</span></div>'
        ).join('');
        navLoginBtns.forEach(b => { b.innerHTML = '👤 내 정보'; });
    } else {
        if (authView) authView.hidden = false;
        if (profileView) profileView.hidden = true;
        navLoginBtns.forEach(b => {
            b.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> 로그인';
        });
    }
}

// 로그인
onId('memberLoginForm', 'submit', async e => {
    e.preventDefault();
    try {
        await TenStore.signInMember(
            document.getElementById('mlEmail').value.trim(),
            document.getElementById('mlPass').value
        );
        e.target.reset();
        await refreshMemberUI();
        showToast('로그인되었습니다. 환영합니다!');
    } catch (err) {
        console.warn(err);
        showToast(TenStore.mode === 'supabase'
            ? '로그인 실패: 이메일 또는 비밀번호를 확인해 주세요.'
            : '로컬 모드에서는 회원 기능을 사용할 수 없습니다.');
    }
});

// 회원가입 (이메일, 비밀번호, 주소, 회사, 직급)
onId('memberSignupForm', 'submit', async e => {
    e.preventDefault();
    try {
        const result = await TenStore.signUpMember({
            email: document.getElementById('msEmail').value.trim(),
            password: document.getElementById('msPass').value,
            address: document.getElementById('msAddress').value.trim(),
            company: document.getElementById('msCompany').value.trim(),
            position: document.getElementById('msPosition').value.trim()
        });
        e.target.reset();
        if (result.needsEmailConfirm) {
            showToast('가입 완료! 이메일로 발송된 인증 링크를 확인한 뒤 로그인해 주세요.');
            const loginTab = document.querySelector('[data-auth-tab="login"]');
                if (loginTab) loginTab.click();
        } else {
            await refreshMemberUI();
            showToast('회원가입이 완료되었습니다. 환영합니다!');
        }
    } catch (err) {
        console.warn(err);
        const msg = String(err.message || '');
        if (/already registered|already been registered/i.test(msg)) {
            showToast('이미 가입된 이메일입니다. 로그인 탭을 이용해 주세요.');
        } else if (/at least 6|password/i.test(msg)) {
            showToast('비밀번호는 6자 이상이어야 합니다.');
        } else if (/signup.*disabled|not allowed/i.test(msg)) {
            showToast('현재 회원가입이 비활성화되어 있습니다. 관리자에게 문의해 주세요.');
        } else {
            showToast('가입 실패: ' + (msg || '잠시 후 다시 시도해 주세요.'));
        }
    }
});

// 로그아웃
onId('memberLogoutBtn', 'click', async () => {
    // 구글이 기억해 둔 계정을 지운다 — 로그아웃했는데 다시 들어가지는 일을 막는다
    try { google.accounts.id.disableAutoSelect(); } catch (e) { /* 구글 스크립트가 없을 수도 있다 */ }
    await TenStore.signOutMember();
    await refreshMemberUI();
    showToast('로그아웃되었습니다.');
});

/* ----- 상단 통계 자동 연동 (핸드북 수 · 과정 수) ----- */
function updateHeroStats() {
    const counters = document.querySelectorAll('.hero-stats [data-counter]');
    if (counters.length < 2) return;
    const hbCount = HANDBOOKS.length;
    const courseCount = new Set(HANDBOOKS.map(h => h.course_tag)).size;
    counters[0].textContent = hbCount + '+';
    counters[0].dataset.counter = hbCount;
    counters[1].textContent = courseCount + '+';
    counters[1].dataset.counter = courseCount;
}

/* =====================================================
   K-AI 리더보드 실시간 순위 (과기정통부·NIA / leaderboard.aihub.or.kr)
   — 공개 API 가 CORS 허용(Access-Control-Allow-Origin: *)이라
     브라우저에서 직접 조회한다. 실패하면 패널을 감춘 채 둔다.
   ===================================================== */
const KAI_LEADERBOARD_API = 'https://leaderboard.aihub.or.kr/proxy/api/leaderboard?size=200';
const KAI_MODEL_MATCH = /honey90\/TenOS-Ko-28B|^TenOS-Ko/i;

async function renderTenosRank() {
    const panel = document.getElementById('tenosRank');
    if (!panel) return;

    const res = await fetch(KAI_LEADERBOARD_API, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
    });
    if (!res.ok) throw new Error('leaderboard HTTP ' + res.status);
    const data = await res.json();

    const rows = Array.isArray(data.rows) ? data.rows : [];
    const names = (data.benchmarks || []).map(b => b.name);
    if (!rows.length) throw new Error('leaderboard 응답에 순위 데이터 없음');

    const mine = rows.find(r => KAI_MODEL_MATCH.test(r.modelUrl || '') || KAI_MODEL_MATCH.test(r.mdlNm || ''));
    if (!mine) throw new Error('TenOS 모델이 리더보드에 없음');

    document.getElementById('tenosRankNum').textContent = mine.rank;
    document.getElementById('tenosRankTotal').textContent = rows.length;
    document.getElementById('tenosRankScore').textContent = Number(mine.totalScore).toFixed(3);
    document.getElementById('tenosRankModel').textContent = mine.mdlNm || 'TenOS-Ko-28B';

    const scores = mine.benchmarkScores || [];
    const bench = document.getElementById('tenosBench');
    bench.innerHTML = scores.map((v, i) => {
        const pct = Math.max(0, Math.min(1, Number(v) || 0)) * 100;
        return '<div class="bench-item">' +
               '<span class="bench-name">' + escHtml(names[i] || ('평가 ' + (i + 1))) + '</span>' +
               '<span class="bench-bar"><span class="bench-fill" data-w="' + pct.toFixed(1) + '"></span></span>' +
               '<span class="bench-score">' + Number(v).toFixed(3) + '</span>' +
               '</div>';
    }).join('');

    panel.hidden = false;
    // 막대는 패널이 보이는 시점에 채운다 (감속 모드에서는 즉시)
    const fill = () => bench.querySelectorAll('.bench-fill').forEach(el => { el.style.width = el.dataset.w + '%'; });
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) fill();
    else requestAnimationFrame(() => requestAnimationFrame(fill));
}

/* =====================================================================
   홍보 팝업 배너
   ---------------------------------------------------------------------
   관리자 콘솔 > 배너 관리에서 만든 배너를 팝업으로 띄운다.

   마크업을 7개 페이지에 복사하지 않고 여기서 만들어 넣는 이유
     - 페이지마다 조금씩 어긋날 일이 없다
     - 팝업 내용은 정적 HTML 에 있으면 안 된다. 크롤러가 본문으로 읽고,
       JS 를 끈 사용자에게는 닫을 수 없는 덩어리로 남는다

   다시 보여 주는 규칙
     '오늘 하루 보지 않기' 를 누르면 그 배너는 날짜가 바뀔 때까지 안 뜬다.
     그냥 닫으면 이 방문(탭)에서만 안 뜬다 — 다음 방문에는 다시 보인다.
     배너를 고쳐 다시 올리면 저장 시각이 바뀌므로 닫아 둔 사람에게도 다시 뜬다.
   ===================================================================== */
const BANNER_DAY_KEY = 'tenai_banner_hidden';     // { [키]: 'YYYY-MM-DD' }
const BANNER_SESSION_KEY = 'tenai_banner_closed'; // 이 탭에서 닫은 배너 키

/* 내용이 바뀌면 키도 바뀐다 — 닫아 둔 사람도 새 소식은 보게 */
const bannerKey = b => `${b.id}:${b.createdAt || 0}`;

const todayStamp = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* 저장소는 사생활 보호 모드나 차단 설정에서 던질 수 있다.
   배너 하나 때문에 페이지가 죽지 않도록 전부 감싼다. */
function bannerHidden(key) {
    try {
        if (sessionStorage.getItem(BANNER_SESSION_KEY) === key) return true;
        const map = JSON.parse(localStorage.getItem(BANNER_DAY_KEY) || '{}');
        return map[key] === todayStamp();
    } catch (e) { return false; }
}
function hideBannerToday(key) {
    try {
        const map = JSON.parse(localStorage.getItem(BANNER_DAY_KEY) || '{}');
        // 지난 날짜 기록은 버린다 — 저장소에 옛 배너 키가 쌓이지 않게
        const today = todayStamp();
        const next = {};
        Object.keys(map).forEach(k => { if (map[k] === today) next[k] = map[k]; });
        next[key] = today;
        localStorage.setItem(BANNER_DAY_KEY, JSON.stringify(next));
    } catch (e) { /* 저장 못 해도 닫히기는 한다 */ }
}
function hideBannerThisVisit(key) {
    try { sessionStorage.setItem(BANNER_SESSION_KEY, key); } catch (e) { /* 무시 */ }
}

/* 배너 주소 검사 — safeUrl 은 빈 값을 '/apps' 로 바꾸므로 여기선 쓸 수 없다.
   이미지가 없으면 빈 문자열이어야 <img> 를 아예 안 만든다. */
const bannerImgUrl = u => {
    const v = String(u || '').trim();
    if (!v) return '';
    // 로컬 모드 업로드는 data URL 로 들어온다. <img> 로 읽는 이미지 data URL 은
    // 스크립트가 실행되지 않으므로(SVG 포함) 허용해도 안전하다.
    if (/^data:image\//i.test(v)) return v;
    if (v[0] === '/') return v;
    return /^https?:\/\//i.test(v) ? v : '';
};
/* 링크는 더 좁게 — data:·javascript: 가 버튼에 실리면 안 된다 */
const bannerLinkUrl = u => {
    const v = String(u || '').trim();
    if (!v) return '';
    if (v[0] === '/' || v[0] === '#') return v;
    return /^https?:\/\//i.test(v) ? v : '';
};

let bannerEl = null;
let bannerEsc = null;

function closePromoBanner(key, forToday) {
    if (!bannerEl) return;
    if (forToday) hideBannerToday(key); else hideBannerThisVisit(key);
    if (bannerEsc) { document.removeEventListener('keydown', bannerEsc); bannerEsc = null; }
    bannerEl.classList.remove('open');
    document.body.style.overflow = '';
    closeOverlay(bannerEl);
    // 전환이 끝난 뒤 치운다 — 닫히는 모습이 보이게
    setTimeout(() => { if (bannerEl) { bannerEl.remove(); bannerEl = null; } }, 300);
}

function buildPromoBanner(b) {
    const key = bannerKey(b);
    const img = bannerImgUrl(b.imageUrl);
    const link = bannerLinkUrl(b.linkUrl);
    const label = String(b.linkLabel || '자세히 보기').trim() || '자세히 보기';

    const el = document.createElement('div');
    el.className = 'promo-pop';
    el.id = 'promoPop';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'promoPopTitle');
    el.innerHTML = `
        <div class="promo-pop-box">
            ${img ? `<div class="promo-pop-figure">
                <img src="${escHtml(img)}" alt="${escHtml(b.imageAlt || '')}" loading="eager" decoding="async">
            </div>` : ''}
            <div class="promo-pop-body">
                ${b.badge ? `<span class="promo-pop-badge">${escHtml(b.badge)}</span>` : ''}
                <h2 class="promo-pop-title" id="promoPopTitle">${escHtml(b.title)}</h2>
                ${b.body ? `<p class="promo-pop-text">${escHtml(b.body)}</p>` : ''}
                ${link ? `<a class="promo-pop-cta" href="${escHtml(link)}" target="_blank" rel="noopener">
                    ${escHtml(label)}
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </a>` : ''}
            </div>
            <div class="promo-pop-foot">
                <button type="button" class="promo-pop-today" data-close-today>오늘 하루 보지 않기</button>
                <button type="button" class="promo-pop-close" data-close aria-label="배너 닫기">닫기 ✕</button>
            </div>
        </div>`;

    on(el, 'click', e => {
        if (e.target === el) { closePromoBanner(key, false); return; }          // 배경 클릭
        if (e.target.closest('[data-close-today]')) { closePromoBanner(key, true); return; }
        if (e.target.closest('[data-close]')) { closePromoBanner(key, false); return; }
        // 링크를 눌러 나가는 경우도 이 방문에서는 그만 보여 준다
        if (e.target.closest('.promo-pop-cta')) hideBannerThisVisit(key);
    });
    bannerEsc = e => { if (e.key === 'Escape' && bannerEl) closePromoBanner(key, false); };
    document.addEventListener('keydown', bannerEsc);
    return el;
}

async function initPromoBanner() {
    let items = [];
    try { items = await TenStore.listBanners(); } catch (e) { return; }
    const b = TenStore.pickLiveBanner(items, Date.now());
    if (!b) return;
    if (bannerHidden(bannerKey(b))) return;

    bannerEl = buildPromoBanner(b);
    document.body.appendChild(bannerEl);

    // 페이지가 자리를 잡은 뒤 띄운다 — 로딩 중에 끼어들면 닫기 버튼을 헛누른다
    setTimeout(() => {
        if (!bannerEl) return;
        bannerEl.classList.add('open');
        document.body.style.overflow = 'hidden';
        openOverlay(bannerEl);
    }, 700);
}

/* ----- 초기 로드 ----- */
(async function initDynamic() {
    // 분류를 가장 먼저 읽는다 — 배지 이름과 필터 칩이 여기서 나온다.
    // 실패해도 기본 분류로 계속 간다 (categories-default.mjs).
    try { await TenStore.listCategories(); } catch (e) { console.warn('분류 로드 실패', e); }

    // 필터는 데이터보다 먼저 붙인다. 주소에 담겨 온 검색 상태(?q=, ?cat=)를
    // 읽어 두어야 첫 렌더부터 걸러진 결과가 나온다.
    try {
        initHandbookFilter(); initLectureFilter();
        initNewsFilter(); initQnaFilter(); initAppFilter();
    } catch (e) { console.warn('필터 초기화 실패', e); }

    try {
        HANDBOOKS = await TenStore.listHandbooks();
        renderHandbooks();
        updateHeroStats();
        updatePromoMeta();
    } catch (e) { console.warn('핸드북 로드 실패', e); }
    try {
        LECTURES = await TenStore.listLectures();
        renderLectures();
    } catch (e) { console.warn('강의 로드 실패', e); }
    try {
        APPS = await TenStore.listApps();
    } catch (e) { console.warn('앱 로드 실패', e); }
    // 조회가 실패해도 그려 준다 — 안내판이 '불러오는 중'에 멈춰 있지 않게
    try { renderNewApps(); renderApps(); } catch (e) { console.warn('앱 렌더 실패', e); }
    try { await renderNews(); } catch (e) { console.warn('소식 로드 실패', e); }
    try { updatePromoMeta(); } catch (e) { console.warn('홍보 현황 갱신 실패', e); }
    try { await renderPublicQna(); } catch (e) { console.warn('Q&A 로드 실패', e); }
    try { await refreshMemberUI(); } catch (e) { console.warn('회원 상태 확인 실패', e); }
    try { await handleOAuthReturn(); } catch (e) { console.warn('구글 로그인 복귀 처리 실패', e); }
    // 팝업은 본문이 다 그려진 뒤에 올린다
    try { await initPromoBanner(); } catch (e) { console.warn('홍보 배너 표시 실패', e); }
})();

/* 구글 버튼도 위 줄에 세우지 않는다.
   이 일은 사이트 데이터와 아무 상관이 없는데, 줄 끝에 세워 두면 분류·핸드북·
   강의·앱·소식·Q&A 조회가 다 끝난 뒤에야 시작한다. 그러면 느린 회선에서
   사용자가 버튼을 누르려는 순간에 버튼이 바뀐다 — 가장 나쁜 때다.
   따로 떼어 처음부터 나란히 달리게 한다. */
initGoogleButton().catch(e => console.warn('구글 버튼 준비 실패', e));

// 외부 리더보드는 독립적으로 조회한다 — 지연되거나 실패해도 본문 로딩과 무관
renderTenosRank().catch(e => console.warn('K-AI 리더보드 순위 조회 실패', e));
