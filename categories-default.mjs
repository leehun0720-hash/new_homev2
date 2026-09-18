/* =====================================================================
   분류(카테고리) 기본값 — 게시물 · Q&A · 핸드북 · 강의 · 앱
   ---------------------------------------------------------------------
   분류는 Supabase 의 categories 테이블에서 관리한다(관리자 콘솔 > 분류 관리).
   이 파일은 그 테이블이 아직 없거나 조회에 실패했을 때 쓰는 폴백이며,
   supabase-categories.sql 의 초기 시딩 내용과 같은 값을 담는다.

   왜 한 파일에 모으는가
     같은 목록이 data-store.js(브라우저)와 prerender.mjs(빌드)에 따로
     적혀 있으면 한쪽만 고쳐 배지 이름이 갈린다. 실제로 앱 분류가 그랬다.
     양쪽이 이 파일 하나를 읽게 해 둔다.

   slug 는 콘텐츠 행에 저장되는 값이다 (posts.category, apps.category,
   handbooks.course_tag, lectures.category, qna.category).
   이미 저장된 데이터를 살리려고 게시물·핸드북·강의의 slug 는
   현재 운영 DB 에 들어 있는 값을 그대로 쓴다.

   tone 은 배지 색이다. 브랜드 3색만 쓴다 — 색은 리듬만 주고
   의미는 분류 '이름'이 진다. 색을 늘리면 편집형 색면이 흐트러진다.
   ===================================================================== */

/* 분류를 붙일 수 있는 콘텐츠 영역 */
export const CATEGORY_SCOPES = [
    { id: 'post',     name: '게시물',  where: "'소식' 목록의 분류 배지와 필터" },
    { id: 'qna',      name: 'Q&A',     where: 'Q&A 목록의 분류 필터' },
    { id: 'handbook', name: '핸드북',  where: '교육 핸드북 탐색기의 과정 탭' },
    { id: 'lecture',  name: '강의',    where: '강의 목록의 분류 필터' },
    { id: 'app',      name: 'AI 앱',   where: '앱 카드 배지와 쇼케이스 필터' }
];

export const SCOPE_IDS = CATEGORY_SCOPES.map(s => s.id);

/* 배지 색조 — styles.css 의 .tag-* 와 일대일 대응 */
export const CATEGORY_TONES = [
    { id: 'tag-vibe',  name: '오렌지' },
    { id: 'tag-genai', name: '라임'   },
    { id: 'tag-biz',   name: '샌드'   }
];

export const TONE_IDS = CATEGORY_TONES.map(t => t.id);
export const DEFAULT_TONE = 'tag-biz';

/* 알 수 없는 색조가 마크업에 끼어들지 못하게 화이트리스트로 거른다 */
export const safeTone = t => (TONE_IDS.includes(t) ? t : DEFAULT_TONE);

/* 색조에서 핸드북 표지 클래스를 끌어낸다 (표지도 같은 3색을 쓴다) */
export const COVER_OF = {
    'tag-vibe':  'cover-vibe',
    'tag-genai': 'cover-genai',
    'tag-biz':   'cover-biz'
};

/* 기본 분류 — scope 별 [slug, 이름, 색조] 순.
   순서가 곧 화면에 나오는 순서다(sort_order 는 여기서 10 단위로 매긴다). */
export const DEFAULT_CATEGORIES = {
    post: [
        { slug: '공지', name: '공지', tone: 'tag-vibe'  },
        { slug: '뉴스', name: '뉴스', tone: 'tag-genai' },
        { slug: '교육', name: '교육', tone: 'tag-biz'   }
    ],
    qna: [
        { slug: 'course',     name: '수강·교육',   tone: 'tag-vibe'  },
        { slug: 'app',        name: '앱·기술',     tone: 'tag-genai' },
        { slug: 'membership', name: '멤버십·계정', tone: 'tag-biz'   },
        { slug: 'etc',        name: '기타 문의',   tone: 'tag-biz'   }
    ],
    handbook: [
        { slug: 'vibecoding',  name: '바이브코딩',     tone: 'tag-vibe'  },
        { slug: 'genai',       name: '생성형 AI 실무', tone: 'tag-genai' },
        { slug: 'ai_business', name: 'AI 경영 전략',   tone: 'tag-biz'   }
    ],
    lecture: [
        { slug: 'ChatGPT 실무',        name: 'ChatGPT 실무',        tone: 'tag-vibe'  },
        { slug: '생성형 AI 가이드',    name: '생성형 AI 가이드',    tone: 'tag-genai' },
        { slug: 'AI 경영 전략',        name: 'AI 경영 전략',        tone: 'tag-biz'   },
        { slug: '프롬프트 엔지니어링', name: '프롬프트 엔지니어링', tone: 'tag-vibe'  }
    ],
    app: [
        { slug: 'automation', name: '업무 자동화',   tone: 'tag-vibe'  },
        { slug: 'document',   name: '문서·글쓰기',   tone: 'tag-biz'   },
        { slug: 'data',       name: '데이터·분석',   tone: 'tag-vibe'  },
        { slug: 'esg',        name: '탄소·ESG',     tone: 'tag-genai' },
        { slug: 'edu',        name: '교육·학습',     tone: 'tag-genai' },
        { slug: 'gov',        name: '정부지원·공모', tone: 'tag-biz'   },
        { slug: 'biz',        name: '경영·금융',     tone: 'tag-biz'   },
        { slug: 'tool',       name: '유틸리티',      tone: 'tag-vibe'  }
    ]
};

/* 기본값을 DB 행과 같은 모양으로 펴 준다 — 두 출처를 같은 코드로 다루려고 */
export function defaultRows(scope) {
    return (DEFAULT_CATEGORIES[scope] || []).map((c, i) => ({
        id: scope + ':' + c.slug,
        scope,
        slug: c.slug,
        name: c.name,
        tone: safeTone(c.tone),
        sortOrder: (i + 1) * 10
    }));
}

export function allDefaultRows() {
    return SCOPE_IDS.reduce((acc, s) => acc.concat(defaultRows(s)), []);
}
