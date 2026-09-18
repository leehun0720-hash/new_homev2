/* =====================================================================
   TenStore — TEN AI 사이트 공용 데이터 계층 (Supabase 버전)
   ---------------------------------------------------------------------
   Supabase 접속 정보 우선순위:
   1) .env.local 의 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      (Vite 개발서버 `npm run dev` 또는 빌드 시 주입)
   2) supabase-config.js 의 window.SUPABASE_CONFIG (선택적 폴백)

   설정이 없으면 브라우저 localStorage(로컬 모드)로 동작합니다.
   index.html(공개 사이트)과 admin.html(관리자 콘솔)이 공유합니다.

   테이블 구조 (생성 SQL은 supabase-config.js 주석 참고):
   - site (id='settings', data jsonb) : 사이트 설정 (문구, 연락처 등)
   - posts                            : 게시물 (공지/뉴스/교육)
   - qna                              : Q&A (질문/답변/공개 여부)
   ===================================================================== */
import './supabase-config.js';   // window.SUPABASE_CONFIG (env 미설정 시 폴백)
import { createClient } from '@supabase/supabase-js';
import {
    CATEGORY_SCOPES, SCOPE_IDS, CATEGORY_TONES, DEFAULT_TONE,
    safeTone, COVER_OF, defaultRows
} from './categories-default.mjs';

const DEFAULT_SETTINGS = {
    heroBadge: 'The 10th Intelligence for Human Progress',
    heroTitle1: 'AI를 배우는 시대에서,',
    heroTitle2: 'AI로 배우는 시대로',
    heroSubtitle: '인간의 지혜와 실천이 만나는 10번째 인공지능, TEN AI.\n과정별·레벨별 교육 핸드북부터 대표 강의, 실전 AI 앱까지 —\n실천형 인공지능 생태계를 한곳에서 만나보세요.',
    contactEmail: 'leesh@tenai.kr',
    address: '서울시 서초구 서초동 1604-19 (대호프레조빌 202호)',
    youtubeUrl: 'https://www.youtube.com/@smauelchung',
    footerSlogan: 'AI를 배우다, AI로 실천하다',
    adminPass: 'tenai2026'            // 관리자 콘솔 접속 암호 (설정 탭에서 변경)
};

const SEED_POSTS = [
    {
        id: 'p1', title: 'TEN AI 웹사이트가 새롭게 리뉴얼되었습니다', category: '공지', pinned: true,
        content: '과정별·레벨별 핸드북 탐색기, 대표님 강의 연동, TEN AI Apps 쇼케이스, 멤버십까지 — 새로워진 TEN AI 플랫폼을 소개합니다.\n\n앞으로 이 게시판을 통해 교육 일정과 새로운 소식을 빠르게 전해드리겠습니다.',
        createdAt: Date.now() - 86400000 * 2
    },
    {
        id: 'p2', title: '바이브코딩 코스 신규 기수 모집 안내', category: '교육', pinned: false,
        content: '비개발자를 위한 바이브코딩 코스(Level 1~2) 신규 기수를 모집합니다.\n\n- 대상: 코딩 경험이 없는 일반인/실무자\n- 방식: 온·오프라인 하이브리드\n- 문의: leesh@tenai.kr',
        createdAt: Date.now() - 86400000 * 5
    },
    {
        id: 'p3', title: 'TenOS-Ko-28B 성능 업데이트 소식', category: '뉴스', pinned: false,
        content: '한국어 특화 LLM TenOS-Ko-28B의 RAG 최적화 업데이트가 적용되었습니다. 교육·컨설팅 전 영역의 데모 환경에 순차 반영됩니다.',
        createdAt: Date.now() - 86400000 * 9
    }
];

const SEED_QNA = [
    {
        id: 'q1', name: '김학습', email: '', question: '비개발자도 바이브코딩 과정을 따라갈 수 있나요?',
        answer: '네, 가능합니다. 바이브코딩 Level 1은 코딩 경험이 전혀 없는 분을 기준으로 설계되어 있으며, 자연어로 AI와 대화하며 결과물을 만드는 방식이라 프로그래밍 문법을 몰라도 참여할 수 있습니다.',
        status: 'answered', isPublic: true,
        createdAt: Date.now() - 86400000 * 6, answeredAt: Date.now() - 86400000 * 5
    },
    {
        id: 'q2', name: '이수강', email: '', question: '수강생 전용 핸드북은 어떻게 열람하나요?',
        answer: '유료 과정 등록 후 관리자가 회원 계정에 과정 권한을 부여하면, 로그인 상태에서 해당 핸드북이 자동으로 활성화됩니다. 권한 부여는 등록 당일 처리됩니다.',
        status: 'answered', isPublic: true,
        createdAt: Date.now() - 86400000 * 4, answeredAt: Date.now() - 86400000 * 3
    }
];

/* ---------- 접속 정보 결정: env(.env.local) → window.SUPABASE_CONFIG ---------- */
function resolveConfig() {
    let url = '', key = '', googleId = '';
    try {
        const env = import.meta.env || {};
        url = env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
        key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
        googleId = env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID || '';
    } catch (e) { /* Vite 외 환경 */ }
    const cfg = window.SUPABASE_CONFIG || {};
    if (!url || !key) {
        if (cfg.url && !/^YOUR_/.test(cfg.url)) url = cfg.url;
        if (cfg.anonKey && !/^YOUR_/.test(cfg.anonKey)) key = cfg.anonKey;
    }
    if (!googleId && cfg.googleClientId && !/^YOUR_/.test(cfg.googleClientId)) {
        googleId = cfg.googleClientId;
    }
    const origins = Array.isArray(cfg.googleJsOrigins) ? cfg.googleJsOrigins : [];
    return { url, key, googleId, origins };
}

/* ---------- 모드 감지 (Supabase 또는 로컬) ---------- */
let sb = null;      // Supabase 클라이언트
let mode = 'local';
let sbUrl = '', sbKey = '';   // OAuth 제공자 확인처럼 REST 로 직접 물을 때 쓴다
let googleClientId = '';      // 구글이 브라우저에 바로 ID 토큰을 줄 때 쓰는 공개 값
let googleJsOrigins = [];     // 구글 콘솔에 실제로 등록한 주소들
try {
    const { url, key, googleId, origins } = resolveConfig();
    googleClientId = googleId || '';
    googleJsOrigins = origins;
    if (url && key) {
        sb = createClient(url, key);
        sbUrl = url; sbKey = key;
        mode = 'supabase';
    }
} catch (e) {
    console.warn('[TenStore] Supabase 초기화 실패 — 로컬 모드로 전환합니다.', e);
    sb = null;
    mode = 'local';
}

/* ---------- 관리자 인증 (Supabase Auth) ----------
   supabase 모드: 이메일/비밀번호 로그인 (계정은 대시보드에서 생성)
   로컬 모드   : 기존 접속 암호(adminPass) 방식 유지 */
async function signInAdmin(email, password) {
    if (mode !== 'supabase') throw new Error('Supabase 모드에서만 사용할 수 있습니다.');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
}

async function signOutAdmin() {
    if (mode === 'supabase') {
        try { await sb.auth.signOut(); } catch (e) { console.warn('[TenStore] 로그아웃 실패', e); }
    }
}

async function getAdminSession() {
    if (mode !== 'supabase') return null;
    try {
        const { data } = await sb.auth.getSession();
        return data.session || null;
    } catch (e) { return null; }
}

/* ---------- 회원(멤버십) 인증 ----------
   회원가입 항목: 이메일, 비밀번호, 주소, 회사, 직급
   주소/회사/직급은 user_metadata로 전달 → DB 트리거가 profiles 테이블에 자동 저장 */
async function signUpMember({ email, password, address, company, position }) {
    if (mode !== 'supabase') throw new Error('Supabase 연결 시 사용할 수 있습니다.');
    const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
            data: {
                address: (address || '').slice(0, 200),
                company: (company || '').slice(0, 100),
                position: (position || '').slice(0, 60)
            }
        }
    });
    if (error) throw error;
    // Confirm email 이 켜져 있으면 session 이 null → 이메일 인증 필요
    return { user: data.user, needsEmailConfirm: !data.session };
}

async function signInMember(email, password) {
    if (mode !== 'supabase') throw new Error('Supabase 연결 시 사용할 수 있습니다.');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
}

const signOutMember = signOutAdmin;

/* ---------- 구글 로그인 (Supabase Auth OAuth) ----------
   대시보드에서 Google 제공자를 켜 두어야 동작한다
   (supabase-google-login.sql 머리말의 ★ 두 단계 참고).

   redirectTo 를 멤버십 화면으로 주는 이유
     구글이 돌려보내는 주소는 Supabase 의 Redirect URLs 목록에 있어야 한다.
     어느 페이지에서 눌렀든 '내 정보' 가 있는 곳으로 돌아오게 해 두면
     로그인 직후 무엇이 달라졌는지 바로 보인다. */
/* 구글 제공자가 켜져 있는지 미리 확인한다.

   왜 미리 보는가
     signInWithOAuth 는 서버에 묻지 않고 곧장 주소창을 옮긴다. 제공자가
     꺼져 있으면 사용자는 Supabase 가 뱉은 날것의 JSON 오류 화면을 본다.
     먼저 물어보면 우리 화면에서 우리 말로 안내할 수 있다.

   확실할 때만 막는다 — 조회에 실패하면(null) 그대로 진행한다.
   확인이 안 된다고 로그인을 못 하게 하는 편이 더 나쁘다. */
async function googleProviderEnabled() {
    if (!sbUrl || !sbKey) return null;
    try {
        const res = await fetch(sbUrl.replace(/\/$/, '') + '/auth/v1/settings', {
            headers: { apikey: sbKey }
        });
        if (!res.ok) return null;
        const s = await res.json();
        if (!s || !s.external || typeof s.external.google === 'undefined') return null;
        return !!s.external.google;
    } catch (e) { return null; }
}

async function signInWithGoogle(redirectTo) {
    if (mode !== 'supabase') throw new Error('Supabase 연결 시 사용할 수 있습니다.');
    if ((await googleProviderEnabled()) === false) {
        throw new Error('구글 로그인이 아직 켜져 있지 않습니다. 잠시 후 다시 시도하시거나 이메일로 로그인해 주세요.');
    }
    const back = redirectTo || (location.origin + '/membership');
    const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: back,
            // 계정을 고를 수 있게 한다 — 여러 구글 계정을 쓰는 사람이
            // 지난번 계정으로 조용히 들어가 버리지 않도록
            queryParams: { prompt: 'select_account' }
        }
    });
    if (error) {
        // 제공자가 꺼져 있으면 Supabase 가 'provider is not enabled' 로 답한다
        if (/provider.*not enabled|unsupported provider/i.test(error.message || '')) {
            throw new Error('구글 로그인이 아직 켜져 있지 않습니다. Supabase 대시보드에서 Google 제공자를 활성화해 주세요.');
        }
        throw error;
    }
    return data;
}

/* ---- 구글이 브라우저에 바로 준 ID 토큰으로 로그인 ----

   위의 signInWithGoogle 과 무엇이 다른가
     signInWithGoogle 은 주소창을 Supabase → 구글 → 다시 우리 사이트로
     옮긴다. 이때 토큰을 받는 주소가 Supabase 이므로 구글 동의 화면
     제목에 'xxxx.supabase.co' 가 박힌다.
     이 함수는 구글이 우리 페이지 안에서 곧바로 ID 토큰을 건네주는
     방식이라, 토큰을 받는 쪽이 우리 도메인이고 제목도 'tenai.kr' 이 된다.

   nonce 를 왜 같이 보내나
     구글에는 '해시한 nonce' 를, Supabase 에는 '원본 nonce' 를 준다.
     Supabase 가 원본을 해시해 토큰 안의 값과 맞춰 보므로, 남의
     화면에서 가로챈 토큰을 그대로 되쓰는 일을 막는다. */
async function signInWithGoogleIdToken(token, nonce) {
    if (mode !== 'supabase') throw new Error('Supabase 연결 시 사용할 수 있습니다.');
    if (!token) throw new Error('구글에서 로그인 정보를 받지 못했습니다.');
    const { data, error } = await sb.auth.signInWithIdToken({
        provider: 'google', token, nonce
    });
    if (error) {
        if (/provider.*not enabled|unsupported provider/i.test(error.message || '')) {
            throw new Error('구글 로그인이 아직 켜져 있지 않습니다. Supabase 대시보드에서 Google 제공자를 활성화해 주세요.');
        }
        throw error;
    }
    return data;
}

/* 로그인된 사용자의 프로필(역할 포함) 조회 — 비로그인 시 null */
async function getMemberProfile() {
    if (mode !== 'supabase') return null;
    const session = await getAdminSession();
    if (!session) return null;
    /* 구글 로그인은 이름·사진을 auth 쪽 메타데이터로 준다.
       supabase-google-login.sql 을 실행하면 profiles 에도 들어오지만,
       실행 전이거나 트리거보다 먼저 만들어진 계정은 비어 있다.
       그럴 때 메타데이터에서 끌어와 '이메일만 덩그러니' 를 면한다. */
    const meta = (session.user && session.user.user_metadata) || {};
    const metaName   = meta.full_name || meta.name || '';
    const metaAvatar = meta.avatar_url || meta.picture || '';
    const base = {
        id: session.user.id,
        email: session.user.email || '',
        name: metaName, avatar_url: metaAvatar,
        address: '', company: '', position: '', role: 'member'
    };
    try {
        const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        if (error) throw error;
        if (data) {
            return Object.assign({}, base, data, {
                // 컬럼이 아직 없거나 비어 있으면 메타데이터 쪽을 쓴다
                name: data.name || metaName,
                avatar_url: data.avatar_url || metaAvatar
            });
        }
        return base;   // 트리거 이전 가입자 등 프로필 행이 없는 경우
    } catch (e) {
        console.warn('[TenStore] 프로필 조회 실패', e);
        return base;
    }
}

/* 관리자 여부 (profiles.role === 'admin') */
async function isAdminUser() {
    const p = await getMemberProfile();
    return !!(p && p.role === 'admin');
}

/* ---------- localStorage 헬퍼 ---------- */
const LS = {
    read(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) { return fallback; }
    },
    write(key, val) {
        localStorage.setItem(key, JSON.stringify(val));
    }
};
function localList(key, seed) {
    let items = LS.read(key, null);
    if (!items) { items = seed.slice(); LS.write(key, items); }
    return items;
}

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- DB row ↔ JS 객체 매핑 (snake_case ↔ camelCase) ---------- */
const postFromRow = r => ({
    id: r.id, title: r.title, category: r.category,
    content: r.content, pinned: !!r.pinned, createdAt: Number(r.created_at)
});
const qnaFromRow = r => ({
    id: r.id, name: r.name, email: r.email, question: r.question,
    answer: r.answer, status: r.status, isPublic: !!r.is_public,
    // 마이그레이션 전에는 컬럼이 없어 undefined 가 온다 — 빈 값(미분류)으로 맞춘다
    category: r.category == null ? '' : String(r.category),
    createdAt: Number(r.created_at),
    answeredAt: r.answered_at != null ? Number(r.answered_at) : null
});
const QNA_COL = {
    name: 'name', email: 'email', question: 'question', answer: 'answer',
    status: 'status', isPublic: 'is_public', category: 'category',
    createdAt: 'created_at', answeredAt: 'answered_at'
};
function qnaToRow(patch) {
    const row = {};
    Object.keys(patch).forEach(k => { if (QNA_COL[k]) row[QNA_COL[k]] = patch[k]; });
    return row;
}

/* ---------- Settings ---------- */
async function getSettings() {
    if (mode === 'supabase') {
        try {
            const { data, error } = await sb.from('site').select('data').eq('id', 'settings').maybeSingle();
            if (error) throw error;
            return Object.assign({}, DEFAULT_SETTINGS, data ? data.data : {});
        } catch (e) {
            console.warn('[TenStore] 설정 로드 실패 (테이블 생성 SQL은 supabase-config.js 참고)', e);
            return Object.assign({}, DEFAULT_SETTINGS);
        }
    }
    return Object.assign({}, DEFAULT_SETTINGS, LS.read('tenai_settings', {}));
}

async function saveSettings(patch) {
    if (mode === 'supabase') {
        const { data, error: readErr } = await sb.from('site').select('data').eq('id', 'settings').maybeSingle();
        if (readErr) throw readErr;
        const merged = Object.assign({}, data ? data.data : {}, patch);
        // 보안: 접속 암호는 Supabase Auth로 대체 — 공개 조회되는 설정에 절대 저장하지 않음
        delete merged.adminPass;
        const { error } = await sb.from('site').upsert({ id: 'settings', data: merged });
        if (error) throw error;
        return;
    }
    const cur = LS.read('tenai_settings', {});
    LS.write('tenai_settings', Object.assign(cur, patch));
}

/* ---------- Posts ---------- */
async function listPosts() {
    let items;
    if (mode === 'supabase') {
        try {
            const { data, error } = await sb.from('posts').select('*');
            if (error) throw error;
            items = (data || []).map(postFromRow);
        } catch (e) { console.warn('[TenStore] 게시물 로드 실패', e); items = []; }
    } else {
        items = localList('tenai_posts', SEED_POSTS);
    }
    return items.sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt));
}

async function savePost(post) {
    const isNew = !post.id;
    const data = {
        title: post.title || '(제목 없음)',
        category: post.category || '공지',
        content: post.content || '',
        pinned: !!post.pinned,
        createdAt: post.createdAt || Date.now()
    };
    if (mode === 'supabase') {
        const id = post.id || genId();
        const { error } = await sb.from('posts').upsert({
            id,
            title: data.title,
            category: data.category,
            content: data.content,
            pinned: data.pinned,
            created_at: data.createdAt
        });
        if (error) throw error;
        return id;
    }
    const items = localList('tenai_posts', SEED_POSTS);
    if (isNew) {
        data.id = genId();
        items.unshift(data);
    } else {
        const idx = items.findIndex(p => p.id === post.id);
        if (idx >= 0) items[idx] = Object.assign({}, items[idx], data, { id: post.id });
    }
    LS.write('tenai_posts', items);
    return post.id || data.id;
}

async function deletePost(id) {
    if (mode === 'supabase') {
        const { error } = await sb.from('posts').delete().eq('id', id);
        if (error) throw error;
        return;
    }
    LS.write('tenai_posts', localList('tenai_posts', SEED_POSTS).filter(p => p.id !== id));
}

/* ---------- Q&A ---------- */
async function listQna(opts) {
    opts = opts || {};
    let items;
    if (mode === 'supabase') {
        // 관리자 : 전체 컬럼·전체 행 / 익명·일반 회원 : 공개 답변만, email 컬럼 제외 (RLS + 컬럼 권한)
        const admin = await isAdminUser().catch(() => false);
        // 분류 컬럼은 supabase-categories.sql 실행 후에 생긴다. 아직 없으면
        // 컬럼을 콕 집어 고른 쿼리가 통째로 실패하므로, 빼고 한 번 더 시도한다.
        const cols = withCat => admin ? '*'
            : 'id,name,question,answer,status,is_public,' + (withCat ? 'category,' : '') + 'created_at,answered_at';
        const run = async withCat => {
            let q = sb.from('qna').select(cols(withCat));
            if (!admin) q = q.eq('is_public', true).eq('status', 'answered');
            const { data, error } = await q;
            if (error) throw error;
            return (data || []).map(qnaFromRow);
        };
        try {
            items = await run(true);
        } catch (e) {
            try {
                items = await run(false);
                console.info('[TenStore] Q&A 분류 컬럼이 아직 없습니다 — supabase-categories.sql 을 실행하면 분류 필터가 켜집니다.');
            } catch (e2) { console.warn('[TenStore] Q&A 로드 실패', e2); items = []; }
        }
    } else {
        items = localList('tenai_qna', SEED_QNA);
    }
    if (opts.publicOnly) {
        items = items.filter(q => q.status === 'answered' && q.isPublic);
    }
    return items.sort((a, b) => b.createdAt - a.createdAt);
}

async function submitQuestion(payload) {
    const data = {
        name: (payload.name || '익명').slice(0, 40),
        email: (payload.email || '').slice(0, 80),
        question: (payload.question || '').slice(0, 2000),
        answer: '',
        status: 'pending',
        isPublic: false,
        createdAt: Date.now(),
        answeredAt: null
    };
    if (!data.question.trim()) throw new Error('질문 내용이 비어 있습니다.');
    if (mode === 'supabase') {
        const id = genId();
        const row = qnaToRow(data);
        row.id = id;
        const { error } = await sb.from('qna').insert(row);
        if (error) throw error;
        return id;
    }
    const items = localList('tenai_qna', SEED_QNA);
    data.id = genId();
    items.unshift(data);
    LS.write('tenai_qna', items);
    return data.id;
}

async function updateQna(id, patch) {
    if (mode === 'supabase') {
        const { error } = await sb.from('qna').update(qnaToRow(patch)).eq('id', id);
        if (error) throw error;
        return;
    }
    const items = localList('tenai_qna', SEED_QNA);
    const idx = items.findIndex(q => q.id === id);
    if (idx >= 0) { items[idx] = Object.assign({}, items[idx], patch); LS.write('tenai_qna', items); }
}

async function deleteQna(id) {
    if (mode === 'supabase') {
        const { error } = await sb.from('qna').delete().eq('id', id);
        if (error) throw error;
        return;
    }
    LS.write('tenai_qna', localList('tenai_qna', SEED_QNA).filter(q => q.id !== id));
}

/* =====================================================================
   콘텐츠 관리: 핸드북 / 강의 / TEN AI Apps
   — 관리자 콘솔에서 편집, 사이트에 실시간 반영
   ===================================================================== */
const SEED_HANDBOOKS = [
    { id: 'h1',  title: '바이브코딩 입문 가이드',             course_tag: 'vibecoding',  level_tier: 1, access_level: 'public',   desc: '비개발자를 위한 자연어 개발 기초와 프롬프트의 이해. 코딩 없이 아이디어를 앱으로 만드는 첫걸음.', createdAt: 1 },
    { id: 'h2',  title: '무릎앱 만들기 기초 실습',            course_tag: 'vibecoding',  level_tier: 2, access_level: 'member',   desc: '생각을 그대로 화면으로. 실습 중심의 무릎앱 제작 워크북으로 나만의 도구를 완성합니다.', createdAt: 2 },
    { id: 'h3',  title: '바이브코딩 실무 실습서',             course_tag: 'vibecoding',  level_tier: 3, access_level: 'enrolled', desc: '역참목조분검 프레임워크 기반의 실전 개발 프로세스와 무릎앱 고도화 전략.', createdAt: 3 },
    { id: 'h4',  title: '디버깅 심화 & 함정 회피 가이드',     course_tag: 'vibecoding',  level_tier: 4, access_level: 'enrolled', desc: 'AI 협업 개발에서 만나는 디버깅 함정과 해결 패턴. 실무자를 위한 심화 트러블슈팅.', createdAt: 4 },
    { id: 'h5',  title: '실무 생산성 혁신 핸드북',            course_tag: 'genai',       level_tier: 1, access_level: 'public',   desc: 'ChatGPT · Claude · Gemini를 업무에 바로 적용하는 실전 비법. 일반인을 위한 생산성 가이드.', createdAt: 5 },
    { id: 'h6',  title: '프롬프트 라이브러리 가이드',         course_tag: 'genai',       level_tier: 2, access_level: 'member',   desc: '재사용 가능한 프롬프트 자산 구축법. 직무별 템플릿과 설계 패턴 모음.', createdAt: 6 },
    { id: 'h7',  title: 'API 연동 & 에이전틱 오케스트레이션', course_tag: 'genai',       level_tier: 3, access_level: 'enrolled', desc: 'LLM API 연동부터 멀티 에이전트 오케스트레이션까지, 전문가를 위한 심화 과정.', createdAt: 7 },
    { id: 'h8',  title: 'RAG 구축 실무 가이드',               course_tag: 'genai',       level_tier: 3, access_level: 'enrolled', desc: '조직의 지식을 AI에 연결하는 검색증강생성(RAG) 파이프라인 설계와 구축 실무.', createdAt: 8 },
    { id: 'h9',  title: '중소기업 AI 도입 로드맵',            course_tag: 'ai_business', level_tier: 2, access_level: 'member',   desc: '기업 임직원을 위한 단계별 AI 도입 전략. 진단부터 실행까지의 경영 로드맵.', createdAt: 9 },
    { id: 'h10', title: '정부지원사업 가이드 v3',             course_tag: 'ai_business', level_tier: 2, access_level: 'enrolled', desc: 'AI를 활용한 정부지원사업 계획서 작성법. 선정률을 높이는 구조화 전략과 실전 템플릿.', createdAt: 10 },
    { id: 'h11', title: '기술가치평가 핸드북',                course_tag: 'ai_business', level_tier: 3, access_level: 'enrolled', desc: '기술 기반 기업을 위한 가치평가 프레임워크와 AI 활용 분석 기법.', createdAt: 11 }
];
const SEED_LECTURES = [
    { id: 'l1', cat: 'ChatGPT 실무',        title: 'ChatGPT 실무 활용법 — 업무 자동화의 시작',      dur: '18:42', videoId: '', grad1: '#0e7490', grad2: '#164e63', createdAt: 1 },
    { id: 'l2', cat: '생성형 AI 가이드',    title: '생성형 AI 완벽 가이드 — 도구 선택부터 활용까지', dur: '24:15', videoId: '', grad1: '#6d28d9', grad2: '#312e81', createdAt: 2 },
    { id: 'l3', cat: 'AI 경영 전략',        title: 'AI 경영 전략 강의 — 우리 회사에 AI 심는 법',     dur: '21:08', videoId: '', grad1: '#b45309', grad2: '#7c2d12', createdAt: 3 },
    { id: 'l4', cat: '프롬프트 엔지니어링', title: '프롬프트 엔지니어링 스킬업 — 좋은 질문의 기술',  dur: '16:33', videoId: '', grad1: '#0f766e', grad2: '#134e4a', createdAt: 4 }
];
/* 앱 분류 — 이제 categories 테이블(관리자 콘솔 > 분류 관리)에서 관리한다.
   이 상수는 분류 테이블을 아직 읽지 못한 시점에 쓰는 폴백이며,
   정의는 categories-default.mjs 한 곳에만 둔다.
   {id} 는 앱 행의 category 값(slug)과 같아야 한다 — 기존 호출부 호환. */
const APP_CATEGORIES = defaultRows('app').map(c => ({ id: c.slug, name: c.name, tone: c.tone }));

const SEED_APPS = [
    { id: 'a1', name: '서울LAW봇',      badge: 'Legal AI',      badgeCls: 'tag-vibe',  oneliner: '판례와 법령을 이해하는 법률 특화 AI 챗봇', how: '한국 판례·법령 데이터를 RAG로 연결해, 일반인의 언어로 물어봐도 관련 법 조항과 판례를 근거와 함께 답변합니다.', launch: '', github: '', category: 'gov',      keywords: '법률, 판례, 법령, 변호사, 리걸, legal', isNew: false, releasedAt: 0, createdAt: 1 },
    { id: 'a2', name: '블록ESG',        badge: 'ESG Analytics', badgeCls: 'tag-genai', oneliner: '기업 ESG 데이터를 자동 분석·리포팅하는 평가 도구', how: '공시 데이터를 수집·정규화하고 TenOS 모델이 ESG 리스크를 요약해 경영진용 리포트를 자동 생성합니다.', launch: '', github: '', category: 'esg',      keywords: 'ESG, 지속가능경영, 공시, 탄소, 리포트', isNew: false, releasedAt: 0, createdAt: 2 },
    { id: 'a3', name: 'TEN AI Hub',     badge: 'Platform',      badgeCls: 'tag-biz',   oneliner: '교육·툴킷·템플릿을 공유하는 실무형 AI 생태계 허브', how: '수강생과 실무자가 프롬프트 템플릿, 사례, 도구를 올리고 나누는 커뮤니티형 지식 플랫폼입니다.', launch: '', github: '', category: 'edu',      keywords: '허브, 커뮤니티, 템플릿, 툴킷, 교육', isNew: true,  releasedAt: Date.now() - 86400000 * 3,  createdAt: 3 },
    { id: 'a4', name: 'Prompt Library', badge: 'Toolkit',       badgeCls: 'tag-vibe',  oneliner: '직무별 검증 프롬프트를 모아둔 템플릿 라이브러리', how: '기획·마케팅·개발 등 직무별로 검증된 프롬프트를 분류해 원클릭 복사로 바로 사용할 수 있습니다.', launch: '', github: '', category: 'document', keywords: '프롬프트, 템플릿, 라이브러리, 글쓰기', isNew: true,  releasedAt: Date.now() - 86400000 * 12, createdAt: 4 }
];

/* row ↔ JS 매핑 정의: [JS키, DB컬럼] */
const HB_MAP  = [['title','title'],['course_tag','course_tag'],['level_tier','level_tier'],['access_level','access_level'],['desc','description'],['link','link_url'],['linkTarget','link_target'],['createdAt','created_at']];
const LEC_MAP = [['cat','category'],['title','title'],['dur','duration'],['videoId','video_id'],['grad1','grad1'],['grad2','grad2'],['createdAt','created_at']];
const APP_MAP = [['name','name'],['badge','badge'],['badgeCls','badge_cls'],['oneliner','oneliner'],['how','how'],['launch','launch_url'],['github','github_url'],['isNew','is_new'],['releasedAt','released_at'],['category','category'],['keywords','keywords'],['createdAt','created_at']];

function makeContentApi(table, lsKey, seed, map) {
    // 숫자·불리언 컬럼은 DB 표현이 흔들려도(문자열 'true', null 등) 같은 타입으로 맞춘다
    const NUM_COLS  = ['created_at', 'level_tier', 'released_at'];
    const BOOL_COLS = ['is_new'];
    // 마이그레이션 전에는 컬럼이 없어 undefined 가 온다 — 빈 문자열로 맞춰 둔다
    const TEXT_COLS = ['category', 'keywords'];
    const fromRow = r => {
        const o = { id: r.id };
        map.forEach(([js, col]) => {
            const v = r[col];
            if (NUM_COLS.includes(col))       o[js] = Number(v) || 0;
            else if (BOOL_COLS.includes(col)) o[js] = v === true || v === 'true';
            else if (TEXT_COLS.includes(col)) o[js] = v == null ? '' : String(v);
            else                              o[js] = v;
        });
        return o;
    };
    const toRow = item => {
        const row = {};
        map.forEach(([js, col]) => { if (js in item) row[col] = item[js]; });
        return row;
    };
    return {
        async list() {
            let items;
            if (mode === 'supabase') {
                try {
                    const { data, error } = await sb.from(table).select('*');
                    if (error) throw error;
                    items = (data || []).map(fromRow);
                    // 테이블은 있지만 비어 있으면 그대로 빈 목록 (관리자가 채움)
                } catch (e) {
                    console.warn('[TenStore] ' + table + ' 로드 실패 — supabase-content.sql 실행 여부를 확인하세요.', e);
                    items = seed.slice();   // 테이블 미생성 시 예시 데이터로 표시
                }
            } else {
                items = localList(lsKey, seed);
            }
            return items.sort((a, b) => a.createdAt - b.createdAt);
        },
        async save(item) {
            const isNew = !item.id;
            const data = Object.assign({}, item, { createdAt: item.createdAt || Date.now() });
            if (mode === 'supabase') {
                const id = item.id || genId();
                const row = toRow(data);
                row.id = id;
                const { error } = await sb.from(table).upsert(row);
                if (error) throw error;
                return id;
            }
            const items = localList(lsKey, seed);
            if (isNew) {
                data.id = genId();
                items.push(data);
            } else {
                const idx = items.findIndex(x => x.id === item.id);
                if (idx >= 0) items[idx] = Object.assign({}, items[idx], data, { id: item.id });
            }
            LS.write(lsKey, items);
            return item.id || data.id;
        },
        async remove(id) {
            if (mode === 'supabase') {
                const { error } = await sb.from(table).delete().eq('id', id);
                if (error) throw error;
                return;
            }
            LS.write(lsKey, localList(lsKey, seed).filter(x => x.id !== id));
        }
    };
}

const handbookApi = makeContentApi('handbooks', 'tenai_handbooks', SEED_HANDBOOKS, HB_MAP);
const lectureApi  = makeContentApi('lectures',  'tenai_lectures',  SEED_LECTURES,  LEC_MAP);
const appApi      = makeContentApi('apps',      'tenai_apps',      SEED_APPS,      APP_MAP);

/* =====================================================================
   홍보 팝업 배너
   ---------------------------------------------------------------------
   관리자 콘솔 > 배너 관리에서 만들고, 공개 사이트에 팝업으로 뜬다.
   테이블이 아직 없으면(= supabase-banners.sql 미실행) 조용히 빈 목록을
   돌려준다 — 배너는 없어도 사이트가 돌아가야 하는 부가 기능이다.

   이미지는 Supabase Storage 의 'banners' 버킷에 올린다. 공개 버킷이라
   서명 URL 이 만료돼 배너가 깨지는 일이 없다.
   ===================================================================== */
const BANNER_BUCKET = 'banners';
const BANNER_MAX_BYTES = 5 * 1024 * 1024;         // 버킷 설정과 같은 값
const BANNER_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];

const SEED_BANNERS = [];   // 기본 배너는 두지 않는다 — 관리자가 만든 것만 뜬다

const bannerFromRow = r => ({
    id: r.id,
    title: r.title == null ? '' : String(r.title),
    body: r.body == null ? '' : String(r.body),
    badge: r.badge == null ? '' : String(r.badge),
    imageUrl: r.image_url == null ? '' : String(r.image_url),
    imageAlt: r.image_alt == null ? '' : String(r.image_alt),
    linkUrl: r.link_url == null ? '' : String(r.link_url),
    linkLabel: r.link_label == null ? '' : String(r.link_label),
    active: r.active === true || r.active === 'true',
    startAt: Number(r.start_at) || 0,
    endAt: Number(r.end_at) || 0,
    sortOrder: Number(r.sort_order) || 0,
    createdAt: Number(r.created_at) || 0
});
const bannerToRow = b => ({
    id: b.id,
    title: b.title || '',
    body: b.body || '',
    badge: b.badge || '',
    image_url: b.imageUrl || '',
    image_alt: b.imageAlt || '',
    link_url: b.linkUrl || '',
    link_label: b.linkLabel || '',
    active: !!b.active,
    start_at: Number(b.startAt) || 0,
    end_at: Number(b.endAt) || 0,
    sort_order: Number(b.sortOrder) || 0,
    created_at: Number(b.createdAt) || Date.now()
});

const bannerOrder = (a, b) => (a.sortOrder - b.sortOrder) || (a.createdAt - b.createdAt);

async function listBanners() {
    if (mode === 'supabase') {
        try {
            const { data, error } = await sb.from('banners').select('*');
            if (error) throw error;
            return (data || []).map(bannerFromRow).sort(bannerOrder);
        } catch (e) {
            console.info('[TenStore] 배너 테이블이 아직 없습니다 — supabase-banners.sql 을 실행하면 켜집니다.');
            return [];
        }
    }
    return localList('tenai_banners', SEED_BANNERS).map(bannerFromRow).sort(bannerOrder);
}

/* 지금 이 순간 띄울 배너를 고른다.
   활성 + 노출 기간 안에 든 것 중 sort_order 가 가장 앞선 하나. */
function pickLiveBanner(items, now) {
    const t = Number(now) || Date.now();
    return (items || []).filter(b =>
        b.active &&
        (!b.startAt || t >= b.startAt) &&
        (!b.endAt   || t <= b.endAt)
    ).sort(bannerOrder)[0] || null;
}

async function saveBanner(banner) {
    const data = Object.assign({}, banner, {
        id: banner.id || genId(),
        createdAt: banner.createdAt || Date.now()
    });
    if (!String(data.title || '').trim() && !String(data.imageUrl || '').trim()) {
        throw new Error('제목이나 이미지 중 하나는 있어야 합니다.');
    }
    if (mode === 'supabase') {
        const { error } = await sb.from('banners').upsert(bannerToRow(data));
        if (error) throw error;
        return data.id;
    }
    const items = localList('tenai_banners', SEED_BANNERS);
    const idx = items.findIndex(x => x.id === data.id);
    const row = bannerToRow(data);
    if (idx >= 0) items[idx] = row; else items.push(row);
    LS.write('tenai_banners', items);
    return data.id;
}

async function deleteBanner(id) {
    // 올려 둔 이미지도 함께 지운다 — 배너를 지웠는데 저장소만 차오르지 않게
    try {
        const items = await listBanners();
        const hit = items.find(b => b.id === id);
        if (hit && hit.imageUrl) await deleteBannerImage(hit.imageUrl);
    } catch (e) { /* 이미지 정리는 실패해도 배너 삭제는 진행한다 */ }

    if (mode === 'supabase') {
        const { error } = await sb.from('banners').delete().eq('id', id);
        if (error) throw error;
        return;
    }
    LS.write('tenai_banners', localList('tenai_banners', SEED_BANNERS).filter(x => x.id !== id));
}

/* ---------- 이미지 업로드 ---------- */
function checkImageFile(file) {
    if (!file) throw new Error('이미지 파일을 선택해 주세요.');
    if (!BANNER_MIME.includes(file.type)) {
        throw new Error('PNG · JPG · WebP · GIF · SVG 형식만 올릴 수 있습니다.');
    }
    if (file.size > BANNER_MAX_BYTES) {
        throw new Error(`이미지가 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB). 5MB 이하로 줄여 주세요.`);
    }
}

/* 파일 이름은 새로 짓는다 — 한글·공백·특수문자가 든 이름은 저장소 키로 쓸 수 없고,
   같은 이름을 다시 올렸을 때 옛 이미지가 캐시에 남는 일도 막는다. */
function bannerObjectPath(file) {
    const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
                   'image/gif': 'gif', 'image/svg+xml': 'svg' })[file.type] || 'png';
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

async function uploadBannerImage(file) {
    checkImageFile(file);
    if (mode !== 'supabase') {
        // 로컬 모드에는 저장소가 없으므로 data URL 로 품는다 (미리보기·테스트용)
        return await new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result));
            fr.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
            fr.readAsDataURL(file);
        });
    }
    const path = bannerObjectPath(file);
    const { error } = await sb.storage.from(BANNER_BUCKET)
        .upload(path, file, { cacheControl: '31536000', contentType: file.type, upsert: false });
    if (error) {
        if (/bucket/i.test(error.message || '')) {
            throw new Error('이미지 저장소가 아직 없습니다. supabase-banners.sql 을 실행해 주세요.');
        }
        throw error;
    }
    const { data } = sb.storage.from(BANNER_BUCKET).getPublicUrl(path);
    return (data && data.publicUrl) || '';
}

/* 우리 버킷에 올린 이미지일 때만 지운다. 외부 주소를 붙여 넣은 경우는 건드리지 않는다. */
async function deleteBannerImage(url) {
    if (mode !== 'supabase') return;
    const m = String(url || '').match(new RegExp('/storage/v1/object/public/' + BANNER_BUCKET + '/(.+)$'));
    if (!m) return;
    const path = decodeURIComponent(m[1].split('?')[0]);
    const { error } = await sb.storage.from(BANNER_BUCKET).remove([path]);
    if (error) console.warn('[TenStore] 배너 이미지 삭제 실패', error);
}

/* =====================================================================
   분류(카테고리) — 게시물 · Q&A · 핸드북 · 강의 · 앱 공통
   ---------------------------------------------------------------------
   categories 테이블 하나가 다섯 영역의 분류를 모두 담는다(scope 로 구분).
   관리자 콘솔 > 분류 관리에서 편집하면 공개 사이트의 필터가 함께 바뀐다.

   테이블이 아직 없으면(= supabase-categories.sql 미실행) categories-default.mjs
   의 기본값으로 동작한다. 마이그레이션 전에도 사이트가 멀쩡히 돈다.

   slug 는 콘텐츠 행에 저장되는 값이라 만든 뒤에는 바꾸지 않는다.
   이름(name)은 언제든 바꿔도 콘텐츠와의 연결이 끊기지 않는다.
   ===================================================================== */

/* 영역별로 분류 값이 실제로 저장되는 곳 — 사용 건수 집계와 삭제 시 이동에 쓴다 */
const SCOPE_CONTENT = {
    post:     { table: 'posts',     col: 'category',   lsKey: 'tenai_posts',     seed: SEED_POSTS,      jsKey: 'category' },
    qna:      { table: 'qna',       col: 'category',   lsKey: 'tenai_qna',       seed: SEED_QNA,        jsKey: 'category' },
    handbook: { table: 'handbooks', col: 'course_tag', lsKey: 'tenai_handbooks', seed: SEED_HANDBOOKS,  jsKey: 'course_tag' },
    lecture:  { table: 'lectures',  col: 'category',   lsKey: 'tenai_lectures',  seed: SEED_LECTURES,   jsKey: 'cat' },
    app:      { table: 'apps',      col: 'category',   lsKey: 'tenai_apps',      seed: SEED_APPS,       jsKey: 'category' }
};

const catFromRow = r => ({
    id: r.id,
    scope: r.scope,
    slug: r.slug == null ? '' : String(r.slug),
    name: r.name == null ? '' : String(r.name),
    tone: safeTone(r.tone),
    sortOrder: Number(r.sort_order) || 0,
    createdAt: Number(r.created_at) || 0
});
const catToRow = c => ({
    id: c.id, scope: c.scope, slug: c.slug, name: c.name,
    tone: safeTone(c.tone), sort_order: Number(c.sortOrder) || 0,
    created_at: Number(c.createdAt) || 0
});

const byOrder = (a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name, 'ko');

let CAT_CACHE = null;          // scope → 정렬된 분류 배열
let CAT_SOURCE = 'default';    // 'db' | 'local' | 'default' — 어디서 읽었는지

function groupByScope(rows) {
    const out = {};
    SCOPE_IDS.forEach(s => { out[s] = []; });
    rows.forEach(r => { if (out[r.scope]) out[r.scope].push(r); });
    SCOPE_IDS.forEach(s => out[s].sort(byOrder));
    return out;
}

function defaultGrouped() {
    return groupByScope(SCOPE_IDS.reduce((acc, s) => acc.concat(defaultRows(s)), []));
}

/* 분류 목록을 불러와 캐시한다. 한 번 읽으면 페이지가 살아 있는 동안 재사용하고,
   관리자 콘솔에서 편집한 뒤에는 {reload:true} 로 다시 읽는다. */
async function listCategories(opts) {
    opts = opts || {};
    if (CAT_CACHE && !opts.reload) return CAT_CACHE;

    if (mode === 'supabase') {
        try {
            const { data, error } = await sb.from('categories').select('*');
            if (error) throw error;
            const rows = (data || []).map(catFromRow);
            // 테이블은 있는데 비어 있으면 기본값으로 둔다 (빈 필터를 내보내지 않게)
            CAT_CACHE = rows.length ? groupByScope(rows) : defaultGrouped();
            CAT_SOURCE = rows.length ? 'db' : 'default';
        } catch (e) {
            console.info('[TenStore] 분류 테이블을 읽지 못했습니다 — 기본 분류로 표시합니다. ' +
                         'supabase-categories.sql 을 실행하면 관리자 콘솔에서 편집할 수 있습니다.');
            CAT_CACHE = defaultGrouped();
            CAT_SOURCE = 'default';
        }
    } else {
        const rows = LS.read('tenai_categories', null);
        CAT_CACHE = rows && rows.length ? groupByScope(rows.map(catFromRow)) : defaultGrouped();
        CAT_SOURCE = 'local';
    }
    return CAT_CACHE;
}

/* 이미 불러온 분류를 동기적으로 꺼낸다 — 렌더 함수에서 쓰기 편하게.
   listCategories() 를 한 번도 부르지 않았다면 기본값을 돌려준다. */
function categoriesOf(scope) {
    const all = CAT_CACHE || defaultGrouped();
    return (all[scope] || []).slice();
}

function categorySource() { return CAT_SOURCE; }

/* 이름에서 slug 를 만든다. 한글 이름은 그대로 쓴다 — 억지로 로마자로 바꾸면
   읽을 수 없는 문자열이 되고, 어차피 주소에서는 인코딩되어 나간다.
   같은 영역에 겹치는 값이 있으면 뒤에 번호를 붙인다. */
function makeSlug(scope, name, existing) {
    const base = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40) || 'cat';
    const taken = new Set((existing || categoriesOf(scope)).map(c => c.slug));
    if (!taken.has(base)) return base;
    for (let i = 2; i < 100; i++) {
        const t = base + '-' + i;
        if (!taken.has(t)) return t;
    }
    return base + '-' + genId();
}

/* 로컬 모드도 DB 와 같은 행 모양(snake_case)으로 저장한다.
   JS 모양 그대로 쓰면 다시 읽을 때 catFromRow 가 sort_order 를 못 찾아
   순서가 전부 0 이 되고 목록이 가나다순으로 튄다. */
function writeLocalCategories(grouped) {
    LS.write('tenai_categories',
        SCOPE_IDS.reduce((acc, s) => acc.concat(grouped[s] || []), []).map(catToRow));
}

/* 분류 저장 — id 가 있으면 수정(이름·색조·순서), 없으면 새로 만든다.
   slug 는 새로 만들 때만 정해지고 이후에는 바뀌지 않는다. */
async function saveCategory(cat) {
    const all = await listCategories();
    const scope = cat.scope;
    if (!SCOPE_IDS.includes(scope)) throw new Error('알 수 없는 분류 영역입니다: ' + scope);

    const name = String(cat.name || '').trim();
    if (!name) throw new Error('분류 이름을 입력해 주세요.');

    const list = all[scope] || [];
    const prev = cat.id ? list.find(c => c.id === cat.id) : null;
    if (cat.id && !prev) throw new Error('수정할 분류를 찾지 못했습니다.');

    // 같은 영역에서 이름이 겹치면 목록에서 구분이 안 된다
    if (list.some(c => c.id !== cat.id && c.name === name)) {
        throw new Error('같은 이름의 분류가 이미 있습니다: ' + name);
    }

    const slug = prev ? prev.slug : makeSlug(scope, name, list);
    const row = {
        id: prev ? prev.id : scope + ':' + slug,
        scope, slug, name,
        tone: safeTone(cat.tone),
        sortOrder: cat.sortOrder != null ? Number(cat.sortOrder)
                 : prev ? prev.sortOrder
                 : (list.length ? Math.max.apply(null, list.map(c => c.sortOrder)) + 10 : 10),
        createdAt: prev ? prev.createdAt : Date.now()
    };

    if (mode === 'supabase') {
        const { error } = await sb.from('categories').upsert(catToRow(row));
        if (error) throw error;
    } else {
        const next = Object.assign({}, all);
        next[scope] = list.filter(c => c.id !== row.id).concat(row).sort(byOrder);
        writeLocalCategories(next);
    }
    await listCategories({ reload: true });
    return row.id;
}

/* 이 분류를 쓰고 있는 콘텐츠가 몇 건인지 센다 (삭제 전에 물어보려고) */
async function countCategoryUsage(scope, slug) {
    const spec = SCOPE_CONTENT[scope];
    if (!spec || !slug) return 0;
    if (mode === 'supabase') {
        try {
            const { count, error } = await sb.from(spec.table)
                .select('id', { count: 'exact', head: true }).eq(spec.col, slug);
            if (error) throw error;
            return Number(count) || 0;
        } catch (e) {
            console.warn('[TenStore] 사용 건수 확인 실패 — ' + spec.table, e);
            return 0;
        }
    }
    return localList(spec.lsKey, spec.seed).filter(x => String(x[spec.jsKey] || '') === slug).length;
}

/* 분류 삭제. 쓰고 있는 콘텐츠가 있으면 moveToSlug 로 옮긴 뒤 지운다.
   moveToSlug 를 비우면 그 콘텐츠는 '미분류'가 된다. */
async function deleteCategory(id, moveToSlug) {
    const all = await listCategories();
    let target = null, scope = null;
    for (const s of SCOPE_IDS) {
        const hit = (all[s] || []).find(c => c.id === id);
        if (hit) { target = hit; scope = s; break; }
    }
    if (!target) throw new Error('삭제할 분류를 찾지 못했습니다.');

    const spec = SCOPE_CONTENT[scope];
    const used = await countCategoryUsage(scope, target.slug);
    const moveTo = String(moveToSlug == null ? '' : moveToSlug);

    if (used > 0 && spec) {
        if (mode === 'supabase') {
            const patch = {};
            patch[spec.col] = moveTo;
            const { error } = await sb.from(spec.table).update(patch).eq(spec.col, target.slug);
            if (error) throw error;
        } else {
            const items = localList(spec.lsKey, spec.seed);
            items.forEach(x => { if (String(x[spec.jsKey] || '') === target.slug) x[spec.jsKey] = moveTo; });
            LS.write(spec.lsKey, items);
        }
    }

    if (mode === 'supabase') {
        const { error } = await sb.from('categories').delete().eq('id', id);
        if (error) throw error;
    } else {
        const next = Object.assign({}, all);
        next[scope] = (all[scope] || []).filter(c => c.id !== id);
        writeLocalCategories(next);
    }
    await listCategories({ reload: true });
    return { moved: used, movedTo: moveTo };
}

/* 순서 바꾸기 — 화면에 보이는 순서대로 id 를 넘기면 10 단위로 다시 매긴다 */
async function reorderCategories(scope, orderedIds) {
    const all = await listCategories();
    const list = all[scope] || [];
    const rows = orderedIds
        .map((id, i) => {
            const c = list.find(x => x.id === id);
            return c ? Object.assign({}, c, { sortOrder: (i + 1) * 10 }) : null;
        })
        .filter(Boolean);
    if (!rows.length) return;

    if (mode === 'supabase') {
        const { error } = await sb.from('categories').upsert(rows.map(catToRow));
        if (error) throw error;
    } else {
        const next = Object.assign({}, all);
        next[scope] = rows.slice().sort(byOrder);
        writeLocalCategories(next);
    }
    await listCategories({ reload: true });
}

/* ---------- 공개 API (index.html / admin.html 인라인 스크립트에서 사용) ---------- */
window.TenStore = {
    mode,
    modeLabel: mode === 'supabase' ? 'Supabase 연결됨' : '로컬 모드 (브라우저 저장)',
    DEFAULT_SETTINGS,
    APP_CATEGORIES,
    /* 분류 관리 */
    CATEGORY_SCOPES, CATEGORY_TONES, DEFAULT_TONE, COVER_OF,
    listCategories, categoriesOf, categorySource,
    saveCategory, deleteCategory, reorderCategories, countCategoryUsage,
    /* 홍보 배너 */
    listBanners, pickLiveBanner, saveBanner, deleteBanner,
    uploadBannerImage, deleteBannerImage,
    getSettings, saveSettings,
    listPosts, savePost, deletePost,
    listQna, submitQuestion, updateQna, deleteQna,
    signInAdmin, signOutAdmin, getAdminSession,
    signUpMember, signInMember, signOutMember, signInWithGoogle, signInWithGoogleIdToken,
    getMemberProfile, isAdminUser,
    /* 구글이 브라우저에 직접 ID 토큰을 줄 수 있는 자리인지.
       Supabase 모드이고, 클라이언트 ID 가 있고, 지금 주소가 구글 콘솔에
       등록된 주소일 때만 참이다. 셋 중 하나라도 어긋나면 예전 방식으로 간다. */
    get googleClientId() {
        if (mode !== 'supabase' || !googleClientId) return '';
        const here = (typeof location !== 'undefined' && location.origin) || '';
        return googleJsOrigins.indexOf(here) >= 0 ? googleClientId : '';
    },
    listHandbooks: handbookApi.list, saveHandbook: handbookApi.save, deleteHandbook: handbookApi.remove,
    listLectures: lectureApi.list,  saveLecture: lectureApi.save,   deleteLecture: lectureApi.remove,
    listApps: appApi.list,          saveApp: appApi.save,           deleteApp: appApi.remove
};

export default window.TenStore;
