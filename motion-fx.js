/* =====================================================
   motion-fx.js — TEN AI 홈페이지 모션 레이어
   ---------------------------------------------------
   · anime.js v4   (https://animejs.com)  — 타임라인 / 텍스트 분할 / 관성 추적
   · Motion        (https://motion.dev)   — 스크롤 연동 / 뷰포트 감지 / 스프링 제스처
   ---------------------------------------------------
   이 파일은 index.html 의 다른 모듈보다 "먼저" 로드됩니다.
   부팅에 성공하면 <html> 에 fx-ready 가 붙고, index.html 안의
   기본 IntersectionObserver 등장 효과는 스스로 비활성화됩니다.
   실패하면 fx-fallback 이 붙어 모든 콘텐츠가 즉시 보이도록 복구합니다.

   모션 강도는 두 단계입니다.
   · full : 전체 연출
   · soft : prefers-reduced-motion — "끄는" 게 아니라 "줄인다".
            이동 폭(최대 16px) · 진폭 · 속도를 낮춰 대부분의 연출을 유지하되,
            어지럼증 유발이 큰 넷은 제외한다 —
            히어로 패럴랙스 / 커서 추적 3D / 카드 틸트 · 마그네틱 버튼 /
            내비 자동 숨김 · 타임라인 자동 가로 스크롤.
            회전(rotate)은 soft 에서 항상 0 이다.
   ===================================================== */

import { animate as mAnimate, scroll, inView, hover, press } from 'motion';
import { animate, createTimeline, createAnimatable, stagger, splitText, utils } from 'animejs';

const root = document.documentElement;
const soft = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $  = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const $1 = (sel, ctx = document) => ctx.querySelector(sel);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/* soft 모드에서는 폭을 줄이되 0 으로 만들지는 않는다.
   움직임이 완전히 사라지면 "정적인 페이지"가 되어 버리므로,
   시선이 따라갈 만큼은 남기고 진폭만 낮춘다. */
const mv  = v => (soft ? Math.sign(v) * Math.min(Math.abs(v) * 0.35, 16) : v);  // 이동량 (최대 16px)
const rot = v => (soft ? 0 : v);                                                // 회전은 soft 에서 제외
const sc  = v => (soft ? 1 - (1 - v) * 0.3 : v);                                // 배율 변화 폭
const amp = v => (soft ? v * 0.45 : v);                                         // 상시 모션 진폭
const dur = v => Math.round(v * (soft ? 0.85 : 1));

/* 섹션 머리말로 취급할 블록과, 그 안에서 글자 단위로 조립할 제목 */
const HEADER_SEL = '.section-header, .partners-head, .lectures-head';
const HEADER_TITLE_SEL = '.section-title, h2, h3';

/* 모션을 끄고 콘텐츠만 드러내는 안전망 */
function bailOut() {
    root.classList.remove('fx-on', 'fx-soft');
    root.classList.add('fx-fallback');
}

try {
    root.classList.add('fx-on');
    if (soft) root.classList.add('fx-soft');
    boot();
    root.classList.add('fx-ready');
} catch (err) {
    console.error('[motion-fx] 초기화 실패 — 정적 모드로 복구합니다.', err);
    bailOut();
}

function boot() {
    /* 두 모드 공통 — 등장 연출과 잔잔한 상시 모션 (soft 는 진폭만 낮춘다) */
    scrollProgressBar();
    heroIntro();
    heroAmbient();
    liveMarquee();
    revealSystem();
    evolutionTimeline();
    dynamicCardEntrance();
    overlayMotion();

    /* full 모드 전용 — 어지럼증 유발이 큰 연출 */
    if (soft) return;
    heroScrollParallax();   // 큰 폭의 패럴랙스
    navAutoHide();          // 고정 요소가 화면 밖으로 미끄러짐
    magneticButtons();      // 커서 추적
    cardTilt();             // 3D 기울기
}

/* =====================================================
   1. 상단 스크롤 진행 바 — 문서 진행도에 직결
   ===================================================== */
function scrollProgressBar() {
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    /* 애니메이션을 물리는 대신 진행도를 직접 쓴다 — 브라우저의 스크롤 타임라인 지원 편차를 타지 않도록 */
    scroll(p => { bar.style.transform = `scaleX(${clamp(p, 0, 1).toFixed(4)})`; });
}

/* =====================================================
   2. 히어로 진입 시퀀스 — anime.js 타임라인 + 텍스트 분할
   ===================================================== */
function heroIntro() {
    const hero = $1('.hero');
    if (!hero) return;

    const badge    = $1('.hero-badge');
    const title    = $1('.hero h1');
    const subtitle = $1('.hero-subtitle');
    const ctaGroup = $1('.hero-cta-group');
    const statGrp  = $1('.hero-stats');
    const visual   = $1('.hero-visual');

    /* 제목을 단어 단위로 쪼개 물결처럼 올라오게 한다.
       단, 그라디언트 텍스트(.highlight)는 background-clip:text 가 깨지므로
       쪼개지 않고 한 덩어리로 다루면서 그라디언트를 흐르게 한다. */
    let titleParts = [];
    let highlight = null;
    if (title) {
        highlight = $1('.highlight', title);
        const plain = $('span', title).filter(s => s !== highlight && !highlight?.contains(s));
        const sources = plain.length ? plain : (highlight ? [] : [title]);

        sources.forEach(el => {
            // 분할 전 원본 텍스트를 남겨둔다 — 콘텐츠 갱신 로직이 구조를 덮어쓰지 않도록
            el.dataset.fxText = el.textContent.trim();
            try {
                const split = splitText(el, { words: true, chars: false, lines: false });
                if (split.words && split.words.length) titleParts.push(...split.words);
                else titleParts.push(el);
            } catch { titleParts.push(el); }
        });
        if (highlight) titleParts.push(highlight);
        if (!titleParts.length) titleParts = [title];
        utils.set(title, { opacity: 1 });
    }

    const ctaKids  = ctaGroup ? Array.from(ctaGroup.children) : [];
    const statKids = statGrp  ? Array.from(statGrp.children)  : [];
    const floats   = $('.hb-float');
    const chip     = $1('.hero-chip');

    if (ctaGroup) utils.set(ctaGroup, { opacity: 1 });
    if (statGrp)  utils.set(statGrp,  { opacity: 1 });
    if (visual)   utils.set(visual,   { opacity: 1 });

    utils.set(titleParts, { opacity: 0 });
    utils.set(ctaKids,    { opacity: 0 });
    utils.set(statKids,   { opacity: 0 });
    utils.set(floats,     { opacity: 0 });
    if (chip) utils.set(chip, { opacity: 0 });

    const tl = createTimeline({ defaults: { ease: 'out(3)', duration: dur(900) } });

    if (badge) tl.add(badge, { opacity: [0, 1], translateY: [mv(18), 0], scale: [sc(0.9), 1], duration: dur(700) }, dur(120));

    if (titleParts.length) {
        tl.add(titleParts, {
            opacity: [0, 1],
            translateY: [mv(48), 0],
            duration: dur(1000),
            delay: stagger(dur(52)),
        }, dur(230));
    }

    if (floats.length) {
        tl.add(floats, {
            opacity: [0, 1],
            translateY: [mv(56), 0],
            translateX: (el, i) => [mv(i % 2 ? 34 : -34), 0],
            rotateZ: (el, i) => [rot(i % 2 ? 4 : -4), 0],
            duration: dur(1100),
            delay: stagger(dur(140)),
        }, dur(420));
    }

    if (subtitle) tl.add(subtitle, { opacity: [0, 1], translateY: [mv(24), 0] }, dur(640));
    if (ctaKids.length)  tl.add(ctaKids,  { opacity: [0, 1], translateY: [mv(22), 0], scale: [sc(0.95), 1], delay: stagger(dur(95)) }, dur(800));
    if (statKids.length) tl.add(statKids, { opacity: [0, 1], translateY: [mv(20), 0], delay: stagger(dur(110)) }, dur(950));
    if (chip) tl.add(chip, { opacity: [0, 1], scale: [sc(0.6), 1], ease: soft ? 'out(3)' : 'outBack(2)', duration: dur(800) }, dur(1180));

    /* 그라디언트 문구는 천천히 흐른다 — 정지된 화면에서도 살아있는 느낌.
       위치 이동이 아니라 색 변화라 soft 모드에서도 유지한다. */
    if (highlight) {
        animate(highlight, {
            backgroundPositionX: ['0%', '200%'],
            duration: soft ? 14000 : 9000,
            ease: 'linear',
            loop: true,
        });
    }
}

/* =====================================================
   3. 히어로 상시 모션 — 오브 부유, 카드 호흡 (soft 는 진폭 축소),
      커서 패럴랙스 (full 전용)
   ===================================================== */
function heroAmbient() {
    const hero = $1('.hero');
    if (!hero) return;

    const slow = soft ? 1.5 : 1;   // soft 에서는 더 느리게

    const orb1 = $1('.hero-orb-1');
    const orb2 = $1('.hero-orb-2');
    if (orb1) animate(orb1, { translateX: [0, amp(70)], translateY: [0, amp(46)], scale: [1, sc(1.14)], duration: 9000 * slow, ease: 'inOutSine', loop: true, alternate: true });
    if (orb2) animate(orb2, { translateX: [0, amp(-58)], translateY: [0, amp(-40)], scale: [1, sc(1.18)], duration: 11500 * slow, ease: 'inOutSine', loop: true, alternate: true });

    /* 핸드북 카드 각각의 호흡 — 진입 시퀀스가 끝난 뒤 시작 */
    const floats = $('.hb-float');
    setTimeout(() => {
        floats.forEach((el, i) => {
            animate(el, {
                translateY: [0, amp(i % 2 ? -15 : -9)],
                rotateZ: [0, rot(i % 2 ? 0.9 : -0.9)],
                duration: (3200 + i * 520) * slow,
                ease: 'inOutSine',
                loop: true,
                alternate: true,
            });
        });
        const chip = $1('.hero-chip');
        if (chip) animate(chip, { translateY: [0, amp(-8)], duration: 2600 * slow, ease: 'inOutSine', loop: true, alternate: true });
    }, 1900);

    /* 커서를 따라 기울어지는 3D 무대 (스택 전체를 움직여 카드 호흡과 충돌하지 않게) */
    const visual = $1('.hero-visual');
    if (soft || !visual || !window.matchMedia('(hover: hover)').matches) return;

    const stage = createAnimatable(visual, {
        x: 760, y: 760, rotateX: 900, rotateY: 900,
        ease: 'out(3)',
    });

    hero.addEventListener('pointermove', e => {
        const r = hero.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width  - 0.5;
        const ny = (e.clientY - r.top)  / r.height - 0.5;
        stage.x(nx * 36).y(ny * 26).rotateY(nx * 8).rotateX(-ny * 8);
    }, { passive: true });

    hero.addEventListener('pointerleave', () => {
        stage.x(0).y(0).rotateY(0).rotateX(0);
    });
}

/* =====================================================
   4. 히어로 스크롤 패럴랙스 — Motion 의 scroll() 로 진행도 연결 (full 전용)
   ===================================================== */
function heroScrollParallax() {
    const hero = $1('.hero');
    if (!hero) return;

    const bg = $1('.hero-bg');
    const inner = $1('.hero-inner');
    if (!bg && !inner) return;

    scroll(progress => {
        const p = clamp(progress, 0, 1);
        if (bg) {
            bg.style.transform = `translate3d(0,${(p * 170).toFixed(1)}px,0) scale(${(1 + p * 0.12).toFixed(4)})`;
            bg.style.opacity = (1 - p * 0.75).toFixed(3);
        }
        if (inner) {
            inner.style.transform = `translate3d(0,${(p * 96).toFixed(1)}px,0)`;
            inner.style.opacity = (1 - p).toFixed(3);
        }
    }, { target: hero, offset: ['start start', 'end start'] });
}

/* =====================================================
   5. 내비게이션 — 아래로 내리면 숨고, 올리면 즉시 복귀 (full 전용)
   ===================================================== */
function navAutoHide() {
    const nav = $1('#nav');
    const mobileMenu = $1('#mobileMenu');
    if (!nav) return;

    scroll((progress, info) => {
        const y = info.y.current;
        const v = info.y.velocity;
        const menuOpen = mobileMenu && mobileMenu.classList.contains('open');
        if (menuOpen || y < 420) { nav.classList.remove('nav-hidden'); return; }
        if (v > 260) nav.classList.add('nav-hidden');
        else if (v < -60) nav.classList.remove('nav-hidden');
    });
}

/* =====================================================
   6. 마퀴 — 항상 흐른다. full 모드에서는 스크롤 속도/방향에도 반응한다.
   ===================================================== */
function liveMarquee() {
    const track = $1('#marqueeTrack');
    if (!track) return;

    let offset = 0;
    let boost = 0;
    let onScreen = true;
    const BASE = soft ? 0.28 : 0.5; // px / frame

    /* 스크롤 속도 연동은 예측하기 어려운 움직임이라 soft 에서는 뺀다 */
    if (!soft) {
        scroll((progress, info) => {
            boost = clamp(info.y.velocity / 110, -26, 26);
        });
    }

    /* 화면 밖에서는 계산만 하고 DOM 은 건드리지 않는다 */
    const strip = track.closest('.marquee') || track;
    inView(strip, () => { onScreen = true; return () => { onScreen = false; }; });

    let last = performance.now();
    (function tick(now) {
        const dt = clamp((now - last) / 16.667, 0, 3);
        last = now;
        const half = track.scrollWidth / 2;
        if (onScreen && half > 0) {
            offset -= (BASE + boost * 0.4) * dt;
            if (offset <= -half) offset += half;
            if (offset > 0) offset -= half;
            track.style.transform = `translate3d(${offset.toFixed(2)}px,0,0)`;
        }
        boost *= 0.92;
        requestAnimationFrame(tick);
    })(last);
}

/* =====================================================
   7. 스크롤 등장 시스템 — 섹션 헤더는 글자 단위로 조립
   ===================================================== */
function revealSystem() {
    /* 섹션 제목을 글자 단위로 미리 분할 */
    const splits = new Map();
    $(HEADER_SEL).forEach(header => {
        const el = $1(HEADER_TITLE_SEL, header);
        if (!el) return;
        try {
            const s = splitText(el, { chars: true, words: false, lines: false });
            if (s.chars && s.chars.length) splits.set(el, s.chars);
        } catch { /* 분할 실패 시 통째로 등장 */ }
    });

    $('.animate-on-scroll').forEach(el => {
        const isHeader = el.matches(HEADER_SEL);
        /* 스태거 대상은 미리 숨겨 둔다 — 부모가 드러나는 순간의 깜빡임 방지 */
        if (!isHeader && el.dataset.fxStagger) utils.set($(el.dataset.fxStagger, el), { opacity: 0 });

        inView(el, () => {
            el.classList.add('visible');
            if (isHeader) revealHeader(el, splits);
            else revealBlock(el);
        }, { amount: 0.15, margin: '0px 0px -60px 0px' });
    });
}

function revealHeader(el, splits) {
    utils.set(el, { opacity: 1, translateY: 0 });

    const label = $1('.section-label', el);
    const title = $1(HEADER_TITLE_SEL, el);
    const desc  = $1('.section-desc', el) || $1('p:not(.section-label)', el);
    const chars = title ? splits.get(title) : null;

    const tl = createTimeline({ defaults: { ease: 'out(3)' } });

    if (label) {
        utils.set(label, { opacity: 0 });
        tl.add(label, {
            opacity: [0, 1],
            translateY: [mv(14), 0],
            letterSpacing: [soft ? '0.26em' : '0.4em', '0.18em'],
            duration: dur(750),
        }, 0);
    }
    if (chars) {
        utils.set(chars, { opacity: 0 });
        tl.add(chars, { opacity: [0, 1], translateY: [mv(30), 0], scale: [sc(0.86), 1], duration: dur(780), delay: stagger(dur(18)) }, dur(90));
    } else if (title) {
        utils.set(title, { opacity: 0 });
        tl.add(title, { opacity: [0, 1], translateY: [mv(26), 0], duration: dur(800) }, dur(90));
    }
    if (desc && desc !== label) {
        utils.set(desc, { opacity: 0 });
        tl.add(desc, { opacity: [0, 1], translateY: [mv(16), 0], duration: dur(720) }, dur(320));
    }
}

function revealBlock(el) {
    const sel = el.dataset.fxStagger;
    let kids = null;
    if (sel) kids = $(sel, el);
    else if (el.classList.contains('stagger')) kids = Array.from(el.children);

    if (kids && kids.length) {
        utils.set(el, { opacity: 1, translateY: 0 });
        animate(kids, {
            opacity: [0, 1],
            translateY: [mv(38), 0],
            scale: [sc(0.965), 1],
            duration: dur(850),
            ease: 'out(3)',
            delay: stagger(dur(80)),
        });
        return;
    }

    // visible 클래스가 먼저 붙으므로, 시작값을 동기적으로 못 박아 한 프레임 깜빡임을 막는다
    utils.set(el, { opacity: 0, translateY: mv(34) });
    animate(el, { opacity: 1, translateY: 0, duration: dur(850), ease: 'out(3)' });
}

/* =====================================================
   8. AI 진화 타임라인 — 스크롤에 물린 가로 이동 + 드래그 + 진행 레일
   (자동 가로 이동은 full 모드 전용, 드래그·레일은 두 모드 공통)
   ===================================================== */
function evolutionTimeline() {
    const scroller = $1('.evolution-scroller');
    const section  = $1('.evolution');
    if (!scroller) return;

    const fill = $1('.evo-rail-fill');
    const maxScroll = () => Math.max(1, scroller.scrollWidth - scroller.clientWidth);

    function syncRail() {
        if (!fill) return;
        const p = clamp(scroller.scrollLeft / maxScroll(), 0, 1);
        const travel = fill.parentElement.clientWidth - fill.clientWidth;
        fill.style.transform = `translate3d(${(travel * p).toFixed(1)}px,0,0)`;
    }
    scroller.addEventListener('scroll', syncRail, { passive: true });
    syncRail();

    /* 손으로 만진 직후에는 스크롤 연동을 잠시 양보한다 */
    let manualUntil = 0;
    const yieldToUser = () => { manualUntil = performance.now() + 2600; };
    ['wheel', 'touchstart', 'keydown'].forEach(t => scroller.addEventListener(t, yieldToUser, { passive: true }));

    if (section && !soft) {
        scroll(progress => {
            if (performance.now() < manualUntil) return;
            const p = clamp((progress - 0.2) / 0.55, 0, 1);
            scroller.scrollLeft = maxScroll() * p;
        }, { target: section, offset: ['start end', 'end start'] });
    }

    /* 마우스로 끌어서 훑어보기 */
    let dragging = false, startX = 0, startLeft = 0;
    scroller.addEventListener('pointerdown', e => {
        if (e.pointerType === 'touch') return;
        dragging = true;
        startX = e.clientX; startLeft = scroller.scrollLeft;
        yieldToUser();
        scroller.classList.add('is-dragging');
        scroller.setPointerCapture(e.pointerId);
    });
    scroller.addEventListener('pointermove', e => {
        if (!dragging) return;
        scroller.scrollLeft = startLeft - (e.clientX - startX);
        yieldToUser();
    });
    const endDrag = e => {
        if (!dragging) return;
        dragging = false;
        scroller.classList.remove('is-dragging');
        try { scroller.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    };
    scroller.addEventListener('pointerup', endDrag);
    scroller.addEventListener('pointercancel', endDrag);

    /* 카드가 화면에 들어올 때 한 장씩 세워지듯 등장 */
    const cards = $('.evo-card', scroller);
    if (cards.length) {
        utils.set(cards, { opacity: 0 });
        inView(scroller, () => {
            animate(cards, {
                opacity: [0, 1],
                translateY: [mv(44), 0],
                rotateY: [rot(-24), 0],
                duration: dur(900),
                ease: 'out(3)',
                delay: stagger(dur(65)),
            });
        }, { amount: 0.2 });
    }
}

/* =====================================================
   9. 마그네틱 버튼 — Motion 의 hover / press + 스프링 (full 전용)
   ===================================================== */
function magneticButtons() {
    if (!window.matchMedia('(hover: hover)').matches) return;

    $('.btn-primary, .btn-secondary').forEach(btn => {
        hover(btn, () => {
            const onMove = e => {
                const r = btn.getBoundingClientRect();
                const dx = e.clientX - (r.left + r.width / 2);
                const dy = e.clientY - (r.top + r.height / 2);
                mAnimate(btn, { x: dx * 0.24, y: dy * 0.34 - 3 }, { type: 'spring', stiffness: 280, damping: 24, mass: 0.6 });
            };
            btn.addEventListener('pointermove', onMove, { passive: true });
            return () => {
                btn.removeEventListener('pointermove', onMove);
                mAnimate(btn, { x: 0, y: 0 }, { type: 'spring', stiffness: 220, damping: 18 });
            };
        });

        press(btn, () => {
            mAnimate(btn, { scale: 0.95 }, { duration: 0.14 });
            return () => mAnimate(btn, { scale: 1 }, { type: 'spring', stiffness: 420, damping: 15 });
        });
    });
}

/* =====================================================
   10. 카드 3D 틸트 — anime.js createAnimatable 로 관성 있게 (full 전용)
   ===================================================== */
function cardTilt() {
    if (!window.matchMedia('(hover: hover)').matches) return;

    $('.biz-card, .partner-card').forEach(card => {
        const t = createAnimatable(card, {
            rotateX: 420, rotateY: 420, translateY: 420, scale: 420,
            ease: 'out(3)',
        });
        card.addEventListener('pointermove', e => {
            const r = card.getBoundingClientRect();
            const nx = (e.clientX - r.left) / r.width  - 0.5;
            const ny = (e.clientY - r.top)  / r.height - 0.5;
            t.rotateY(nx * 9).rotateX(-ny * 9).translateY(-8).scale(1.015);
        }, { passive: true });
        card.addEventListener('pointerleave', () => {
            t.rotateY(0).rotateX(0).translateY(0).scale(1);
        });
    });
}

/* =====================================================
   11. 동적 카드(핸드북·강의·앱·소식·Q&A) 등장 스태거
   ===================================================== */
function dynamicCardEntrance() {
    ['#handbookGrid', '#lectureGrid', '#appsGrid', '#newsGrid', '#qnaPublicList'].forEach(sel => {
        const grid = $1(sel);
        if (!grid) return;
        new MutationObserver(records => {
            const added = [];
            records.forEach(r => r.addedNodes.forEach(n => { if (n.nodeType === 1) added.push(n); }));
            if (!added.length) return;
            utils.set(added, { opacity: 0 });
            animate(added, {
                opacity: [0, 1],
                translateY: [mv(30), 0],
                scale: [sc(0.96), 1],
                duration: dur(720),
                ease: 'out(3)',
                delay: stagger(dur(55)),
            });
        }).observe(grid, { childList: true });
    });
}

/* =====================================================
   12. 오버레이 — 모바일 메뉴 / 모달 열림 모션
   ===================================================== */
function overlayMotion() {
    const menu = $1('#mobileMenu');
    if (menu) {
        new MutationObserver(() => {
            if (!menu.classList.contains('open')) return;
            const items = Array.from(menu.children);
            if (!items.length) return;
            utils.set(items, { opacity: 0 });
            animate(items, {
                opacity: [0, 1],
                translateY: [mv(30), 0],
                duration: dur(620),
                ease: 'out(3)',
                delay: stagger(dur(70)),
            });
        }).observe(menu, { attributes: true, attributeFilter: ['class'] });
    }

    $('.video-modal').forEach(modal => {
        const box = $1('.video-modal-box', modal);
        if (!box) return;
        new MutationObserver(() => {
            if (!modal.classList.contains('open')) return;
            animate(box, {
                opacity: [0, 1],
                translateY: [mv(42), 0],
                scale: soft ? [0.97, 1] : [0.92, 1.012, 1],
                duration: dur(700),
                ease: 'out(3)',
            });
        }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    });
}
