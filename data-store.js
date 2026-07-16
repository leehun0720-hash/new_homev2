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
   - site (id='settings', data jsonb) : 사이트 설정 (로고, 문구, 연락처 등)
   - posts                            : 게시물 (공지/뉴스/교육)
   - qna                              : Q&A (질문/답변/공개 여부)
   ===================================================================== */
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SETTINGS = {
    logoIcon: '10',
    logoText: 'Ten',
    logoAccent: 'AI',
    logoTagline: 'AX HUB PLATFORM',
    logoImage: '',                    // data URL (로고 이미지 업로드 시)
    heroBadge: 'The 10th Intelligence for Human Progress',
    heroTitle1: 'AI를 배우는 시대에서,',
    heroTitle2: 'AI로 배우는 시대로',
    heroSubtitle: '인간의 지혜와 실천이 만나는 10번째 인공지능, TEN AI.\n과정별·레벨별 교육 핸드북부터 대표 강의, 실전 AI 앱까지 —\n실천형 인공지능 생태계를 한곳에서 만나보세요.',
    contactEmail: 'contact@tenai.kr',
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
        content: '비개발자를 위한 바이브코딩 코스(Level 1~2) 신규 기수를 모집합니다.\n\n- 대상: 코딩 경험이 없는 일반인/실무자\n- 방식: 온·오프라인 하이브리드\n- 문의: contact@tenai.kr',
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
    let url = '', key = '';
    try {
        const env = import.meta.env || {};
        url = env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
        key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
    } catch (e) { /* Vite 외 환경 */ }
    if (!url || !key) {
        const cfg = window.SUPABASE_CONFIG || {};
        if (cfg.url && !/^YOUR_/.test(cfg.url)) url = cfg.url;
        if (cfg.anonKey && !/^YOUR_/.test(cfg.anonKey)) key = cfg.anonKey;
    }
    return { url, key };
}

/* ---------- 모드 감지 (Supabase 또는 로컬) ---------- */
let sb = null;      // Supabase 클라이언트
let mode = 'local';
try {
    const { url, key } = resolveConfig();
    if (url && key) {
        sb = createClient(url, key);
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

/* 로그인된 사용자의 프로필(역할 포함) 조회 — 비로그인 시 null */
async function getMemberProfile() {
    if (mode !== 'supabase') return null;
    const session = await getAdminSession();
    if (!session) return null;
    try {
        const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        if (error) throw error;
        if (data) return data;
        // 트리거 이전 가입자 등 프로필이 없으면 최소 정보 반환
        return { id: session.user.id, email: session.user.email || '', address: '', company: '', position: '', role: 'member' };
    } catch (e) {
        console.warn('[TenStore] 프로필 조회 실패', e);
        return { id: session.user.id, email: session.user.email || '', address: '', company: '', position: '', role: 'member' };
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
    createdAt: Number(r.created_at),
    answeredAt: r.answered_at != null ? Number(r.answered_at) : null
});
const QNA_COL = {
    name: 'name', email: 'email', question: 'question', answer: 'answer',
    status: 'status', isPublic: 'is_public', createdAt: 'created_at', answeredAt: 'answered_at'
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
        try {
            // 관리자 : 전체 컬럼·전체 행 / 익명·일반 회원 : 공개 답변만, email 컬럼 제외 (RLS + 컬럼 권한)
            const admin = await isAdminUser();
            const query = admin
                ? sb.from('qna').select('*')
                : sb.from('qna').select('id,name,question,answer,status,is_public,created_at,answered_at')
                    .eq('is_public', true).eq('status', 'answered');
            const { data, error } = await query;
            if (error) throw error;
            items = (data || []).map(qnaFromRow);
        } catch (e) { console.warn('[TenStore] Q&A 로드 실패', e); items = []; }
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

/* ---------- 공개 API (index.html / admin.html 인라인 스크립트에서 사용) ---------- */
window.TenStore = {
    mode,
    modeLabel: mode === 'supabase' ? 'Supabase 연결됨' : '로컬 모드 (브라우저 저장)',
    DEFAULT_SETTINGS,
    getSettings, saveSettings,
    listPosts, savePost, deletePost,
    listQna, submitQuestion, updateQna, deleteQna,
    signInAdmin, signOutAdmin, getAdminSession,
    signUpMember, signInMember, signOutMember, getMemberProfile, isAdminUser
};

export default window.TenStore;
