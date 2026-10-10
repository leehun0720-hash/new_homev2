/* =====================================================================
   한/영 전환 (i18n)
   ---------------------------------------------------------------------
   한국어가 원문이다. 페이지는 늘 한국어로 그려지고, 영어를 고르면
   화면의 글자를 영어 사전으로 바꿔 끼운다.

   왜 키(key) 대신 원문으로 찾는가
     site.js 가 그리는 카드·필터·안내 문구까지 한 번에 옮기려면
     그 코드를 하나하나 고치지 않아도 되는 쪽이 안전하다.
     사전은 '한국어 문장 → 영어 문장' 이다. 화면에 새 글자가 붙으면
     (MutationObserver) 그 자리에서 사전을 찾아 바꾼다.

   사전 파일
     /i18n/en/common.json   내비·바닥글·공통 단추
     /i18n/en/<쪽>.json     쪽마다 (home, biz, learn, about …)
     형식: { "text": { "한국어": "English" },
             "html": { "키": "<b>English</b> with markup" },
             "patterns": [["^총 (\\d+)개$", "$1 in total"]] }
     문장 안에 <strong>·<a> 같은 꾸밈이 섞인 곳은 data-i18n="키" 를 달고
     html 사전으로 통째 바꾼다.

   번역하지 않는 곳: translate="no", data-i18n-skip, script·style·code
   언어 기억: localStorage 'tenai_lang' (없으면 한국어). 주소 ?lang=en 도 받는다.
   검색엔진이 영어판을 한국어 대신 색인하지 않도록, 브라우저 언어로
   저절로 바꾸지는 않는다.
   ===================================================================== */

const STORE_KEY = 'tenai_lang';
const LANGS = ['ko', 'en'];
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA']);
const HAS_HANGUL = /[가-힣]/;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* 사전에 넣기 어려운 모양: 날짜 */
const BUILTIN = [
    [/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/, (m, y, mo, d) => `${MONTHS[+mo - 1]} ${+d}, ${y}`],
    [/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/, (m, y, mo, d) => `${MONTHS[+mo - 1]} ${+d}, ${y}`],
    [/^(\d{4})년\s*(\d{1,2})월$/, (m, y, mo) => `${MONTHS[+mo - 1]} ${y}`]
];

/* 문장 속에 끼어 있는 한국어 날짜도 영어 날짜로 ('공개일 · 2026년 9월 15일') */
const enDates = s => s.replace(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g, (m, y, mo, d) => `${MONTHS[+mo - 1]} ${+d}, ${y}`);

const pageId = (() => {
    const p = location.pathname.replace(/\/+$/, '').replace(/\.html$/, '').split('/').pop();
    return p && p !== 'index' ? p : 'home';
})();

const state = {
    lang: 'ko',
    text: new Map(),     // 한국어 → 영어
    html: new Map(),     // data-i18n 키 → 영어 HTML
    patterns: [],        // [RegExp, 바꿀 글]
    loaded: null,        // 사전을 읽는 Promise
    textNodes: new Map(),   // 바꾼 글자 마디 → 원래 한국어
    attrNodes: new Map(),   // 바꾼 요소 → { 속성: 원래 값 }
    htmlNodes: new Map(),   // 통째로 바꾼 요소 → 원래 innerHTML
    title: null,
    observer: null
};

const norm = s => s.replace(/\s+/g, ' ').trim();

function readStored() {
    try {
        const q = new URLSearchParams(location.search).get('lang');
        if (LANGS.includes(q)) return q;
        const v = localStorage.getItem(STORE_KEY);
        return LANGS.includes(v) ? v : 'ko';
    } catch (e) { return 'ko'; }
}

function translate(ko) {
    const key = norm(ko);
    if (!key || !HAS_HANGUL.test(key)) return null;
    if (state.text.has(key)) return state.text.get(key);
    for (const [re, to] of state.patterns) {
        if (re.test(key)) return enDates(key.replace(re, to));
    }
    for (const [re, fn] of BUILTIN) {
        const m = key.match(re);
        if (m) return fn(...m);
    }
    return null;
}

/* 앞뒤 빈칸은 원문 그대로 둔다 — 줄바꿈 들여쓰기가 글자 사이 간격이 되므로 */
function keepSpace(orig, en) {
    const lead = orig.match(/^\s*/)[0];
    const tail = orig.match(/\s*$/)[0];
    return (lead ? ' ' : '') + en + (tail ? ' ' : '');
}

function skipped(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        if (SKIP_TAGS.has(n.tagName.toUpperCase())) return true;
        if (n.hasAttribute('data-i18n-skip') || n.getAttribute('translate') === 'no') return true;
    }
    return false;
}

function doText(node) {
    if (state.textNodes.has(node)) return;
    const parent = node.parentElement;
    if (!parent || skipped(parent) || parent.closest('[data-i18n]')) return;
    const en = translate(node.nodeValue);
    if (en == null) return;
    state.textNodes.set(node, node.nodeValue);
    node.nodeValue = keepSpace(node.nodeValue, en);
}

function doAttrs(el) {
    if (skipped(el)) return;
    for (const a of ATTRS) {
        if (!el.hasAttribute(a)) continue;
        const saved = state.attrNodes.get(el);
        if (saved && a in saved) continue;
        const en = translate(el.getAttribute(a));
        if (en == null) continue;
        const rec = saved || {};
        rec[a] = el.getAttribute(a);
        state.attrNodes.set(el, rec);
        el.setAttribute(a, en);
    }
}

function doHtml(el) {
    if (state.htmlNodes.has(el)) return;
    const en = state.html.get(el.getAttribute('data-i18n'));
    if (en == null) return;
    state.htmlNodes.set(el, el.innerHTML);
    el.innerHTML = en;
}

function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    if (root.hasAttribute('data-i18n')) doHtml(root);
    root.querySelectorAll('[data-i18n]').forEach(doHtml);
    doAttrs(root);
    root.querySelectorAll('[placeholder],[aria-label],[title],img[alt]').forEach(doAttrs);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) doText(n);
}

function restore() {
    state.htmlNodes.forEach((html, el) => { el.innerHTML = html; });
    state.textNodes.forEach((ko, node) => { node.nodeValue = ko; });
    state.attrNodes.forEach((rec, el) => { for (const a in rec) el.setAttribute(a, rec[a]); });
    state.htmlNodes.clear(); state.textNodes.clear(); state.attrNodes.clear();
    if (state.title != null) { document.title = state.title; state.title = null; }
}

function translateTitle() {
    if (state.title != null) return;
    const en = translate(document.title);
    if (en == null) return;
    state.title = document.title;
    document.title = en;
}

/* 우리가 바꾼 글자가 다시 감지되지 않게, 바꾸는 동안은 관찰을 멈춘다 */
function quietly(fn) {
    const ob = state.observer;
    if (ob) ob.disconnect();
    try { fn(); } finally {
        if (ob) { ob.takeRecords(); observe(); }
    }
}

function observe() {
    if (!state.observer) {
        state.observer = new MutationObserver(records => {
            if (state.lang !== 'en') return;
            quietly(() => {
                for (const r of records) {
                    if (r.type === 'childList') r.addedNodes.forEach(walk);
                    else if (r.type === 'characterData') { state.textNodes.delete(r.target); doText(r.target); }
                    else if (r.type === 'attributes') {
                        const rec = state.attrNodes.get(r.target);
                        if (rec) delete rec[r.attributeName];
                        doAttrs(r.target);
                    }
                }
            });
        });
    }
    state.observer.observe(document.body, {
        subtree: true, childList: true, characterData: true,
        attributes: true, attributeFilter: ATTRS
    });
}

async function fetchJson(url) {
    try {
        const res = await fetch(url);
        return res.ok ? await res.json() : {};
    } catch (e) { return {}; }
}

function loadDict() {
    if (state.loaded) return state.loaded;
    state.loaded = Promise.all([fetchJson('/i18n/en/common.json'), fetchJson(`/i18n/en/${pageId}.json`)])
        .then(parts => {
            for (const d of parts) {
                for (const [ko, en] of Object.entries(d.text || {})) state.text.set(norm(ko), en);
                for (const [k, en] of Object.entries(d.html || {})) state.html.set(k, en);
                for (const [re, to] of d.patterns || []) {
                    try { state.patterns.push([new RegExp(re), to]); } catch (e) { /* 잘못된 패턴은 건너뛴다 */ }
                }
            }
        });
    return state.loaded;
}

function markToggles() {
    document.querySelectorAll('[data-set-lang]').forEach(b => {
        const on = b.dataset.setLang === state.lang;
        b.setAttribute('aria-pressed', String(on));
        b.classList.toggle('is-on', on);
    });
}

async function setLang(lang, { save = true } = {}) {
    if (!LANGS.includes(lang)) return;
    state.lang = lang;
    if (save) { try { localStorage.setItem(STORE_KEY, lang); } catch (e) { /* 저장 막힘 */ } }
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
    markToggles();

    if (lang === 'en') {
        await loadDict();
        if (state.lang !== 'en') return;          // 기다리는 사이에 다시 바뀌었다
        quietly(() => { walk(document.body); translateTitle(); });
    } else {
        quietly(restore);
    }
    document.documentElement.classList.remove('i18n-pending');
    document.dispatchEvent(new CustomEvent('tenai:lang', { detail: { lang } }));
}

/* 코드에서 쓰는 짧은 번역: TenI18n.t('복사했습니다') */
function t(ko) {
    if (state.lang !== 'en') return ko;
    const en = translate(ko);
    return en == null ? ko : en;
}

window.TenI18n = {
    get lang() { return state.lang; },
    set: setLang,
    t,
    ready: () => state.loaded || Promise.resolve()
};

document.addEventListener('click', e => {
    const b = e.target.closest('[data-set-lang]');
    if (!b) return;
    e.preventDefault();
    setLang(b.dataset.setLang);
});

observe();
const first = readStored();
if (first === 'en') setLang('en', { save: false });
else { markToggles(); document.documentElement.classList.remove('i18n-pending'); }
