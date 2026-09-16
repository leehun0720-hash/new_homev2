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

const COURSE_META = {
    vibecoding:  { name: '바이브코딩',      tagClass: 'tag-vibe',  coverClass: 'cover-vibe',  deco: 'V' },
    genai:       { name: '생성형 AI 실무',  tagClass: 'tag-genai', coverClass: 'cover-genai', deco: 'G' },
    ai_business: { name: 'AI 경영 전략',    tagClass: 'tag-biz',   coverClass: 'cover-biz',   deco: 'B' },
};

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
const grid = document.getElementById('handbookGrid');
let curCourse = 'all', curLevel = 'all';

function renderHandbooks() {
    if (!grid) return;
    const items = limited(HANDBOOKS.filter(h =>
        (curCourse === 'all' || h.course_tag === curCourse) &&
        (curLevel === 'all' || h.level_tier === Number(curLevel))
    ), grid);
    if (!items.length) {
        grid.innerHTML = '<div class="handbook-empty">해당 과정·레벨의 핸드북이 아직 없습니다.<br>새 교재는 관리자 콘솔 업로드 즉시 이곳에 반영됩니다.</div>';
        return;
    }
    grid.innerHTML = items.map((h, i) => {
        const c = COURSE_META[h.course_tag] || COURSE_META.vibecoding;
        const a = ACCESS_META[h.access_level] || ACCESS_META.public;
        const unlocked = h.access_level === 'public';
        return `
        <article class="handbook-card" style="animation-delay:${i * 0.06}s">
            <div class="hb-cover ${c.coverClass}" data-deco="${c.deco}${h.level_tier}">
                <span class="hb-level outfit">LEVEL ${h.level_tier}</span>
            </div>
            <div class="hb-body">
                <div class="hb-meta">
                    <span class="hb-course-tag ${c.tagClass}">${c.name}</span>
                    <span class="hb-access ${a.cls}">${a.icon} ${a.label}</span>
                </div>
                <h3 class="hb-title">${escHtml(h.title)}</h3>
                <p class="hb-desc">${escHtml(h.desc)}</p>
                <button class="hb-open ${unlocked ? 'unlocked' : 'locked'}" data-hb="${h.id}">
                    ${unlocked ? '핸드북 열기 →' : (h.access_level === 'member' ? '로그인 후 열람' : '수강 등록 후 열람')}
                </button>
            </div>
        </article>`;
    }).join('');
}

document.querySelectorAll('.course-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.course-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        curCourse = tab.dataset.course;
        renderHandbooks();
    });
});
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
function renderLectures() {
    if (!lectureGrid) return;
    if (!LECTURES.length) {
        lectureGrid.innerHTML = '<div class="news-empty" style="grid-column:1/-1;">등록된 강의가 없습니다. 관리자 콘솔에서 강의를 추가해 주세요.</div>';
        return;
    }
    lectureGrid.innerHTML = limited(LECTURES, lectureGrid).map(v => {
        const youtubeUrl = youtubeWatchUrl(v.videoId);
        const tag = youtubeUrl ? 'a' : 'button';
        const attrs = youtubeUrl
            ? `href="${escHtml(youtubeUrl)}" target="_blank" rel="noopener noreferrer"`
            : 'type="button" data-missing-video="true"';
        const actionLabel = youtubeUrl ? 'YouTube에서 새 창으로 보기' : 'YouTube 링크 미등록';
        const thumb = ytThumbUrl(youtubeUrl);
        return `
        <${tag} class="lecture-card visible" ${attrs} aria-label="${escHtml(v.title)} - ${actionLabel}">
            <div class="lecture-thumb${thumb ? '' : ' is-blank'}">
                ${thumb
                    ? `<img class="lecture-shot" src="${thumb}" alt="" loading="lazy" decoding="async" width="480" height="360">`
                    : `<img class="thumb-mark" src="/brand/TenAI_cream.png" alt="" aria-hidden="true" loading="lazy" decoding="async" width="1040" height="440">
                       <span class="thumb-note">${escHtml(v.cat || 'TEN AI 강의')}</span>`}
                <div class="play"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
                ${v.dur ? `<span class="dur outfit">${escHtml(v.dur)}</span>` : ''}
            </div>
            <div class="lecture-body">
                <div class="lecture-cat">${escHtml(v.cat)}</div>
                <div class="lecture-title">${escHtml(v.title)}</div>
            </div>
        </${tag}>`;
    }).join('');
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
            <span class="app-badge ${APP_BADGE_CLS[a.badgeCls] || 'tag-vibe'}">${escHtml(a.badge)}</span>
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

/* ============ 앱 검색 ============
   앱은 계속 늘어난다. 눈으로 훑는 대신 이름·기능·키워드로 찾게 한다.

   검색 규칙
     - 띄어쓴 낱말은 모두 만족해야 한다 (AND). '탄소 계산' → 둘 다 든 앱
     - 대소문자를 가리지 않는다
     - 띄어쓰기를 무시한 비교도 함께 한다 ('탄소리서치' ↔ '탄소 리서치')
   검색 대상은 이름·한 줄 소개·작동 원리·배지·분류 이름·등록 키워드다. */
const APP_CATS = (window.TenStore && window.TenStore.APP_CATEGORIES) || [];
const catName = id => (APP_CATS.find(c => c.id === id) || {}).name || '';

// 쉼표·가운뎃점·괄호 같은 구분기호는 낱말 경계로 본다.
// '탄소, 배출량' 과 '탄소·ESG' 가 두 낱말로 쪼개져야 '탄소 ESG' 로도 찾힌다.
const SEP_RE = /[,·․‧/|\\()\[\]{}<>"'`~!?;:_\-–—+&]+/g;
const normQuery = v => String(v == null ? '' : v).toLowerCase()
    .replace(SEP_RE, ' ').replace(/\s+/g, ' ').trim();
const squash    = v => normQuery(v).replace(/ /g, '');

const appFields = a => [a.name, a.oneliner, a.how, a.badge, a.keywords, catName(a.category)].map(normQuery);

/* 붙여 쓴 한글 검색어('탄소리서치')가 띄어 쓴 데이터('탄소 리서치')에도 걸리게
   띄어쓰기를 지운 보조 비교를 함께 한다. 다만 두 가지를 지킨다.

   1. 필드마다 따로 본다. 전부 이어 붙이면 앞 필드 끝과 뒤 필드 앞이 붙어
      없던 낱말이 생긴다.
   2. 한글이 든 두 글자 이상 검색어에만 쓴다. 영문에 쓰면 낱말 사이가 붙어
      'festival carbon' → 'festivalcarbon' 이 되고 'lca' 가 걸린다.
      영문은 원래 비교(hay.includes)로 충분하다 — 'runiq' 는 'runiqzip' 에 걸린다. */
const HANGUL_RE = /[가-힣]/;
function appMatches(a, terms) {
    if (!terms.length) return true;
    const fields = appFields(a);
    const hay = fields.join(' ');
    const flat = fields.map(squash);
    return terms.every(t =>
        hay.includes(t) ||
        (HANGUL_RE.test(t) && t.length >= 2 && flat.some(f => f.includes(squash(t)))));
}

let appQuery = '', appCat = 'all';

function filteredApps() {
    const terms = normQuery(appQuery).split(' ').filter(Boolean);
    return APPS.filter(a =>
        (appCat === 'all' || (a.category || '') === appCat) && appMatches(a, terms));
}

/* 분류 칩은 실제로 앱이 있는 분류만 보여 준다 — 빈 칩을 눌러 헛걸음하지 않게 */
function renderAppCats() {
    const box = document.getElementById('appCats');
    if (!box) return;
    const counts = new Map();
    APPS.forEach(a => {
        const id = a.category || '';
        if (id) counts.set(id, (counts.get(id) || 0) + 1);
    });
    const chips = APP_CATS.filter(c => counts.has(c.id))
        .map(c => ({ id: c.id, name: c.name, n: counts.get(c.id) }));
    // 분류된 앱이 하나도 없으면 칩 줄을 통째로 숨긴다 (누를 것이 없는 '전체' 하나만 남으므로)
    if (!chips.length) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;

    const unfiled = APPS.filter(a => !a.category).length;
    chips.unshift({ id: 'all', name: '전체', n: APPS.length });
    if (unfiled) chips.push({ id: '', name: '미분류', n: unfiled });

    box.innerHTML = chips.map(c => `
        <button type="button" class="course-tab app-cat${c.id === appCat ? ' active' : ''}"
                data-cat="${escHtml(c.id)}" aria-pressed="${c.id === appCat}">
            ${escHtml(c.name)} <span class="app-cat-n">${c.n}</span>
        </button>`).join('');
}

/* 주소에 검색 상태를 남긴다 — 결과 화면을 그대로 공유·북마크할 수 있게 */
function syncAppUrl() {
    const u = new URL(location.href);
    appQuery ? u.searchParams.set('q', appQuery) : u.searchParams.delete('q');
    appCat !== 'all' ? u.searchParams.set('cat', appCat) : u.searchParams.delete('cat');
    history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
}

function initAppSearch() {
    const input = document.getElementById('appSearch');
    if (!input) return;
    const clear = document.getElementById('appSearchClear');
    const params = new URLSearchParams(location.search);

    appQuery = params.get('q') || '';
    const wantCat = params.get('cat');
    appCat = wantCat !== null && (wantCat === '' || APP_CATS.some(c => c.id === wantCat)) ? wantCat : 'all';
    input.value = appQuery;
    if (clear) clear.hidden = !appQuery;

    let timer;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            appQuery = input.value;
            if (clear) clear.hidden = !appQuery;
            syncAppUrl();
            renderApps();
        }, 150);
    });
    // 엔터로 폼이 제출되거나 esc 로 값만 비고 화면이 안 바뀌는 일이 없게
    input.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
    input.addEventListener('search', () => {
        appQuery = input.value;
        if (clear) clear.hidden = !appQuery;
        syncAppUrl();
        renderApps();
    });
    on(clear, 'click', () => {
        input.value = ''; appQuery = ''; clear.hidden = true;
        syncAppUrl(); renderApps(); input.focus();
    });
    onId('appCats', 'click', e => {
        const btn = e.target.closest('[data-cat]');
        if (!btn) return;
        appCat = btn.dataset.cat;
        syncAppUrl();
        renderApps();
    });
    onId('appsGrid', 'click', e => {
        if (!e.target.closest('[data-reset-search]')) return;
        input.value = ''; appQuery = ''; appCat = 'all';
        if (clear) clear.hidden = true;
        syncAppUrl(); renderApps();
    });
}

/* ============ 앱 쇼케이스 ============ */
function renderApps() {
    const grid = document.getElementById('appsGrid');
    if (!grid) return;
    if (!APPS.length) {
        grid.innerHTML = '<div class="news-empty" style="grid-column:1/-1;">등록된 앱이 없습니다. 관리자 콘솔에서 앱을 추가해 주세요.</div>';
        return;
    }

    const hasSearch = !!document.getElementById('appSearch');
    const items = limited(hasSearch ? filteredApps() : APPS, grid);
    renderAppCats();

    const countEl = document.getElementById('appsCount');
    if (countEl) {
        const narrowed = appQuery || appCat !== 'all';
        countEl.textContent = narrowed
            ? `전체 ${APPS.length}개 중 ${items.length}개`
            : `전체 ${APPS.length}개`;
    }

    if (!items.length) {
        grid.innerHTML = `<div class="news-empty" style="grid-column:1/-1;">
            '${escHtml(appQuery)}'에 해당하는 앱이 없습니다.<br>
            다른 낱말로 찾아보시거나 <button type="button" class="link-btn" data-reset-search>전체 목록 보기</button>를 눌러 주세요.
        </div>`;
        return;
    }

    grid.innerHTML = items.map(a => `
    <article class="app-card visible${isNewApp(a) ? ' is-new' : ''}">
        <div class="app-thumb tint-${APP_BADGE_CLS[a.badgeCls] || 'tag-vibe'}">
            ${isNewApp(a) ? NEW_FLAG_HTML : ''}
            <img class="thumb-mark" src="/brand/TenAI_ink.png" alt="" aria-hidden="true" loading="lazy" decoding="async" width="1040" height="440">
            <div class="app-overlay">${escHtml(a.how)}</div>
        </div>
        <div class="app-body">
            <div class="app-head">
                <h3 class="app-name">${escHtml(a.name)}</h3>
                <span class="app-badge ${APP_BADGE_CLS[a.badgeCls] || 'tag-vibe'}">${escHtml(a.badge)}</span>
            </div>
            ${catName(a.category) ? `<p class="app-cat-line">${escHtml(catName(a.category))}</p>` : ''}
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
    </article>
    `).join('');
}
// 배지 색상 클래스 화이트리스트 (임의 클래스/속성 주입 차단)
const APP_BADGE_CLS = { 'tag-vibe': 'tag-vibe', 'tag-genai': 'tag-genai', 'tag-biz': 'tag-biz' };

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
document.querySelectorAll('[data-social]').forEach(btn => {
    btn.addEventListener('click', () => {
        showToast(`${btn.dataset.social} 로그인은 Supabase Auth(OAuth) 연동 후 활성화됩니다.`);
    });
});
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
const CAT_CLS = { '공지': 'news-cat-notice', '뉴스': 'news-cat-news', '교육': 'news-cat-edu' };
let NEWS_CACHE = [];

async function renderNews() {
    const posts = await TenStore.listPosts();
    NEWS_CACHE = posts;
    const el = document.getElementById('newsGrid');
    if (!el) return;
    if (!posts.length) {
        el.innerHTML = '<div class="news-empty">등록된 소식이 없습니다.</div>';
        return;
    }
    el.innerHTML = limited(posts, el, 6).map(p => `
        <button class="news-card" data-post="${p.id}">
            <div class="news-meta">
                <span class="news-cat ${CAT_CLS[p.category] || 'news-cat-notice'}">${escHtml(p.category)}</span>
                ${p.pinned ? '<span class="news-pin">📌 고정</span>' : ''}
                <span class="news-date">${fmtDate(p.createdAt)}</span>
            </div>
            <div class="news-title">${escHtml(p.title)}</div>
            <p class="news-excerpt">${escHtml((p.content || '').slice(0, 90))}${(p.content || '').length > 90 ? '…' : ''}</p>
            <span class="news-more">자세히 보기 →</span>
        </button>
    `).join('');
}

const postModal = document.getElementById('postModal');
onId('newsGrid', 'click', e => {
    const card = e.target.closest('.news-card');
    if (!card) return;
    const p = NEWS_CACHE.find(x => x.id === card.dataset.post);
    if (!p) return;
    document.getElementById('postModalMeta').innerHTML =
        '<span class="news-cat ' + (CAT_CLS[p.category] || 'news-cat-notice') + '">' + escHtml(p.category) + '</span>' +
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
async function renderPublicQna() {
    const items = await TenStore.listQna({ publicOnly: true });
    const el = document.getElementById('qnaPublicList');
    if (!el) return;
    if (!items.length) {
        el.innerHTML = '<div class="qna-empty">아직 공개된 답변이 없습니다.<br>첫 질문을 남겨주세요!</div>';
        return;
    }
    el.innerHTML = items.map(q => `
        <div class="qna-item">
            <button class="qna-item-q" aria-expanded="false">
                <span class="q-mark">Q</span>
                <span class="q-text">${escHtml(q.question)}</span>
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
        </div>
    `).join('');
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
        const rows = [
            ['이메일', profile.email || '-'],
            ['주소', profile.address || '-'],
            ['회사', profile.company || '-'],
            ['직급', profile.position || '-'],
            ['등급', profile.role === 'admin' ? '관리자' : '일반 회원']
        ];
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

/* ----- 초기 로드 ----- */
(async function initDynamic() {
    try { await applySettings(); } catch (e) { console.warn('설정 적용 실패', e); }
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
    try { initAppSearch(); renderNewApps(); renderApps(); } catch (e) { console.warn('앱 렌더 실패', e); }
    try { await renderNews(); } catch (e) { console.warn('소식 로드 실패', e); }
    try { updatePromoMeta(); } catch (e) { console.warn('홍보 현황 갱신 실패', e); }
    try { await renderPublicQna(); } catch (e) { console.warn('Q&A 로드 실패', e); }
    try { await refreshMemberUI(); } catch (e) { console.warn('회원 상태 확인 실패', e); }
})();

// 외부 리더보드는 독립적으로 조회한다 — 지연되거나 실패해도 본문 로딩과 무관
renderTenosRank().catch(e => console.warn('K-AI 리더보드 순위 조회 실패', e));
