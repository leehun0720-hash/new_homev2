/* =====================================================================
   TenStore — TEN AI 사이트 공용 데이터 계층
   ---------------------------------------------------------------------
   firebase-config.js 에 실제 Firebase 설정이 있으면 Firestore를 사용하고,
   없으면 브라우저 localStorage(로컬 모드)로 동작합니다.
   index.html(공개 사이트)과 admin.html(관리자 콘솔)이 공유합니다.

   컬렉션 구조 (Firestore / localStorage 동일):
   - site/settings : 사이트 설정 (로고, 히어로 문구, 연락처 등)
   - posts         : 게시물 (공지/뉴스/교육)
   - qna           : Q&A (질문/답변/공개 여부)
   ===================================================================== */
(function () {
    'use strict';

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

    /* ---------- 모드 감지 ---------- */
    let db = null;
    let mode = 'local';
    try {
        const cfg = window.FIREBASE_CONFIG;
        const configured = cfg && cfg.apiKey && !/^YOUR_/.test(cfg.apiKey) && !/^YOUR_/.test(cfg.projectId || 'YOUR_');
        if (configured && typeof firebase !== 'undefined' && firebase.initializeApp) {
            firebase.initializeApp(cfg);
            db = firebase.firestore();
            mode = 'firebase';
        }
    } catch (e) {
        console.warn('[TenStore] Firebase 초기화 실패 — 로컬 모드로 전환합니다.', e);
        db = null;
        mode = 'local';
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

    /* ---------- Settings ---------- */
    async function getSettings() {
        if (mode === 'firebase') {
            try {
                const snap = await db.collection('site').doc('settings').get();
                return Object.assign({}, DEFAULT_SETTINGS, snap.exists ? snap.data() : {});
            } catch (e) {
                console.warn('[TenStore] 설정 로드 실패', e);
                return Object.assign({}, DEFAULT_SETTINGS);
            }
        }
        return Object.assign({}, DEFAULT_SETTINGS, LS.read('tenai_settings', {}));
    }

    async function saveSettings(patch) {
        if (mode === 'firebase') {
            await db.collection('site').doc('settings').set(patch, { merge: true });
            return;
        }
        const cur = LS.read('tenai_settings', {});
        LS.write('tenai_settings', Object.assign(cur, patch));
    }

    /* ---------- Posts ---------- */
    async function listPosts() {
        let items;
        if (mode === 'firebase') {
            try {
                const snap = await db.collection('posts').get();
                items = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
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
        if (mode === 'firebase') {
            const id = post.id || genId();
            await db.collection('posts').doc(id).set(data);
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
        if (mode === 'firebase') {
            await db.collection('posts').doc(id).delete();
            return;
        }
        LS.write('tenai_posts', localList('tenai_posts', SEED_POSTS).filter(p => p.id !== id));
    }

    /* ---------- Q&A ---------- */
    async function listQna(opts) {
        opts = opts || {};
        let items;
        if (mode === 'firebase') {
            try {
                const snap = await db.collection('qna').get();
                items = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
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
        if (mode === 'firebase') {
            const id = genId();
            await db.collection('qna').doc(id).set(data);
            return id;
        }
        const items = localList('tenai_qna', SEED_QNA);
        data.id = genId();
        items.unshift(data);
        LS.write('tenai_qna', items);
        return data.id;
    }

    async function updateQna(id, patch) {
        if (mode === 'firebase') {
            await db.collection('qna').doc(id).set(patch, { merge: true });
            return;
        }
        const items = localList('tenai_qna', SEED_QNA);
        const idx = items.findIndex(q => q.id === id);
        if (idx >= 0) { items[idx] = Object.assign({}, items[idx], patch); LS.write('tenai_qna', items); }
    }

    async function deleteQna(id) {
        if (mode === 'firebase') {
            await db.collection('qna').doc(id).delete();
            return;
        }
        LS.write('tenai_qna', localList('tenai_qna', SEED_QNA).filter(q => q.id !== id));
    }

    /* ---------- 공개 API ---------- */
    window.TenStore = {
        mode,
        modeLabel: mode === 'firebase' ? 'Firebase 연결됨' : '로컬 모드 (브라우저 저장)',
        DEFAULT_SETTINGS,
        getSettings, saveSettings,
        listPosts, savePost, deletePost,
        listQna, submitQuestion, updateQna, deleteQna
    };
})();
