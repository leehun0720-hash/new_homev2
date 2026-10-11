/* =====================================================================
   첫 화면 설명선 (index.html .hero-art .co)
   ---------------------------------------------------------------------
   도면에 주석을 다는 모습을 그대로 보여 준다.
     1) 가리킬 곳에 점이 찍히고(파동) → 지시선이 받침선 모서리까지 뻗고
        → 받침선이 펴지고 → 제목이 한 글자씩, 부제가 스민다.
     2) 지시선 끝은 움직이는 연꽃(Lottie)을 따라간다.
     3) 몇 초마다 설명이 바뀐다. 지시선이 거둬졌다가 새 곳으로 다시 뻗는다.
        A  연화 머리초 ↔ 단청 회로(꽃잎을 도는 회로 신호를 쫓는다)
        B  TenOS-Ko 28B → 28B 파라미터 → 망분리 운영 (코어 · 코어 고리 · 도는 꽃술)
        C  오방색 다섯 — 丹 黃 靑 綠 白 을 차례로, 지금 그 색을 띤 꽃잎 겹을 찾아 가리킨다.
           지시선도 그 색으로 바뀌고 아래 색 칩이 커진다.

   연꽃의 움직임은 lottie-src/build_lottie.py 의 rosette() 시간표(ROS_*)를 그대로
   따라 계산한다 — 그쪽을 바꾸면 아래 ROS 도 같이 바꾼다.
   '움직임 줄이기'를 켠 분, 좁은 화면(설명선을 감추는 600px 이하)에서는 아무것도 하지 않는다.
   ===================================================================== */

const svg = document.querySelector('.home-hero .hero-art');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const narrow = window.matchMedia('(max-width: 600px)');

if (svg && !reduce.matches) init();

function init() {
    const NS = 'http://www.w3.org/2000/svg';
    const ROS = {
        L0: 170, LN: 1200,
        SPIN_OUT: 90, SPIN_IN: -90, SPIN_STAMEN: -60,
        STEP: 240, HOLD: 180, PHASE: 25,           // 큰 꽃잎 색: 白 丹 黃 靑 綠 (0~4)
        STEP_S: 400, HOLD_S: 320,                  // 작은 꽃잎 안쪽: 綠 靑 黃
        SEQ_S: [4, 3, 2]
    };
    const CX = 720, CY = 520, K = 0.72;            // 연꽃 중심과 배율 (도면 좌표)
    const COLORS = ['var(--on-night)', 'var(--jeok)', 'var(--hwang)', 'var(--cheong)', 'var(--nok)'];

    const rosEl = document.querySelector('.hero-rosette');
    const anim = () => (rosEl && rosEl._lottie && rosEl.classList.contains('is-lottie')) ? rosEl._lottie : null;
    /* 지금 연꽃이 몇 번째 장면인가 (되풀이 중이면 구간 시작을 더한다) */
    function frame() {
        const a = anim();
        if (!a) return null;
        return (a.firstFrame || 0) + (a.currentFrame || 0);
    }
    const spin = (f, deg) => (f == null || f < ROS.L0) ? 0 : deg * (((f - ROS.L0) % ROS.LN) / ROS.LN);
    const rot = ([x, y], deg) => {
        const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
        return [x * c - y * s, x * s + y * c];
    };
    const art = ([x, y]) => [CX + K * x, CY + K * y];
    const mod = (a, n) => ((a % n) + n) % n;

    /* 큰 꽃잎 겹 L(0 바깥 ~ 3 안)이 지금 띤 색 (0 白 · 1 丹 · 2 黃 · 3 靑 · 4 綠) */
    function bigColor(L, m, f) {
        if (f == null || f < ROS.L0) return L;
        const t = mod(f - ROS.L0 + ROS.PHASE * m, ROS.LN);
        const s = Math.floor(t / ROS.STEP), u = t - ROS.STEP * s;
        const k = u < ROS.HOLD + (ROS.STEP - ROS.HOLD) / 2 ? s : s + 1;
        return mod(L - k, 5);
    }
    function smallColor(m, f) {
        if (f == null || f < ROS.L0) return ROS.SEQ_S[0];
        const t = mod(f - ROS.L0 + ROS.PHASE * m, ROS.LN);
        const s = Math.floor(t / ROS.STEP_S), u = t - ROS.STEP_S * s;
        const k = u < ROS.HOLD_S + (ROS.STEP_S - ROS.HOLD_S) / 2 ? s : s + 1;
        return ROS.SEQ_S[mod(-k, 3)];
    }
    // 꽃잎 오른쪽 가장자리 한가운데 (겹마다 (0,-170) 기준 축소)
    const BIG_PT = [1, 0.78, 0.56, 0.34].map(k => [44.25 * k, -170 + 3.75 * k]);
    const SMALL_PT = [10.8, -83.55];

    // 회로 신호가 도는 꽃잎 바깥선 — 길이로 위치를 구하려고 보이지 않는 path 를 하나 둔다
    const probe = document.createElementNS(NS, 'path');
    probe.setAttribute('d', 'M0 -78 C 58 -118 60 -212 0 -262 C -60 -212 -58 -118 0 -78 Z');
    probe.setAttribute('fill', 'none');
    probe.setAttribute('visibility', 'hidden');
    (svg.querySelector('defs') || svg).appendChild(probe);
    const probeLen = probe.getTotalLength();
    /* 지금 가장 최근에 출발한 신호의 머리 (없으면 null) */
    function signalHead(f) {
        if (f == null || f < ROS.L0) return null;
        const lf = mod(f - ROS.L0, 300);
        if (lf >= 270) return null;                     // 여덟 장을 돈 뒤 쉬는 틈
        const m = Math.min(7, Math.floor(lf / 30));
        const q = Math.min(1, (lf - 30 * m) / 60 + 0.15);
        const pt = probe.getPointAtLength(q * probeLen);
        return art(rot([pt.x, pt.y], 45 * m + spin(f, ROS.SPIN_OUT)));
    }

    /* ---------- 설명들 ---------- */
    const STATES = {
        coA: [
            { title: '연화 머리초', sub: 'ROSETTE · Ø 1,200 · 8 PETALS',
              at: f => art(rot([0, -169], 315 + spin(f, ROS.SPIN_OUT))) },
            { title: '단청 회로', sub: 'SIGNAL · 꽃잎을 따라 흐르는 신호', follow: true,
              at: f => signalHead(f) }
        ],
        coB: [
            { title: 'TENOS-KO 28B', sub: 'CORE · ON-PREMISE', at: () => art([16, -8]) },
            { title: '28B 파라미터', sub: '자체 한국어 모델', at: () => art([21, -36.4]) },
            { title: '망분리 운영', sub: 'AIR-GAPPED · ON-PREMISE',
              at: f => art(rot([29, -50.2], spin(f, ROS.SPIN_STAMEN))) }
        ],
        coC: [1, 2, 3, 4, 0].map(c => ({ title: '오방색 다섯', color: c, at: f => colorTarget(c, f) }))
    };
    const HOLD_MS = { coA: 7200, coB: 6000, coC: 2800 };
    const START_MS = { coA: 0, coB: 450, coC: 900 };

    /* 그 색을 지금 띤 꽃잎 겹 가운데 받침선 모서리에서 가장 가까운 곳 */
    let lastC = null;
    function colorTarget(c, f) {
        const elbow = callouts.coC.elbow;
        let best = null, bd = Infinity;
        const consider = p => { const d = (p[0] - elbow[0]) ** 2 + (p[1] - elbow[1]) ** 2; if (d < bd) { bd = d; best = p; } };
        const so = spin(f, ROS.SPIN_OUT), si = spin(f, ROS.SPIN_IN);
        for (let m = 0; m < 8; m++) {
            for (let L = 0; L < 4; L++) if (bigColor(L, m, f) === c) consider(art(rot(BIG_PT[L], 45 * m + so)));
            if (smallColor(m, f) === c) consider(art(rot(SMALL_PT, 45 * m + 22.5 + si)));
        }
        if (best) lastC = best;
        return best || lastC;
    }

    /* ---------- 설명선 하나 ---------- */
    const lang = () => (window.TenI18n && window.TenI18n.lang) || 'ko';
    const tr = s => (lang() === 'en' && window.TenI18n ? window.TenI18n.t(s) : s);
    const pts = a => a.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const ease = t => 1 - Math.pow(1 - t, 3);
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

    function makeCallout(id) {
        const g = document.getElementById(id);
        if (!g) return null;
        const num = s => s.split(',').map(Number);
        const c = {
            id, g,
            shelf: g.querySelector('.co-shelf'), arm: g.querySelector('.co-arm'),
            dot: g.querySelector('.co-dot'), ring: g.querySelector('.co-ring'),
            title: g.querySelector('.co-title'), sub: g.querySelector('.co-sub'),
            chips: g.querySelector('.co-chips'),
            elbow: num(g.dataset.elbow), far: num(g.dataset.far),
            states: STATES[id], idx: 0,
            cur: null, shelfP: 0, armP: 0, dotS: 0, ringT: -1,
            phase: 'wait', t0: 0, typed: 1, subO: 0
        };
        // 처음에는 비워 둔다 (등장하며 그린다)
        c.arm.setAttribute('points', pts([c.elbow, c.elbow]));
        c.shelf.setAttribute('points', pts([c.elbow, c.elbow]));
        c.title.textContent = '';
        if (c.sub) c.sub.style.opacity = '0';
        if (c.chips) c.chips.style.opacity = '0';
        c.dot.setAttribute('r', '0');
        c.ring.setAttribute('r', '0');
        c.ring.style.opacity = '0';
        return c;
    }
    const callouts = {};
    ['coA', 'coB', 'coC'].forEach(id => { const c = makeCallout(id); if (c) callouts[id] = c; });
    if (!callouts.coA || !callouts.coB || !callouts.coC) return;
    svg.classList.add('js-co');                      // CSS 의 단순 나타나기를 끈다

    function setTexts(c, full) {
        const st = c.states[c.idx];
        const t = tr(st.title);
        const n = full ? t.length : Math.round(t.length * c.typed);
        c.title.textContent = t.slice(0, n);
        if (c.sub && st.sub != null) c.sub.textContent = tr(st.sub);
        if (c.chips) {
            c.chips.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', st.color != null && Number(x.dataset.c) === st.color));
        }
        if (st.color != null) {
            c.arm.style.stroke = COLORS[st.color];
            c.dot.style.fill = COLORS[st.color];
            c.ring.style.stroke = COLORS[st.color];
        }
    }

    /* 단계: wait → dot → arm → shelf → type → hold → erase → retract → (다음 설명) dot → arm → type → hold … */
    const DUR = { dot: 260, arm: 520, shelf: 280, type: 420, erase: 220, retract: 320 };
    function go(c, phase, now) { c.phase = phase; c.t0 = now; }

    function step(c, now, f) {
        const st = c.states[c.idx];
        const target = st.at(f) || c.cur || st.at(null) || c.elbow;
        // 지시선 끝: 처음에는 그 자리, 그 뒤로는 부드럽게 따라간다
        if (!c.cur) c.cur = target.slice();
        else c.cur = lerp(c.cur, target, st.follow ? 0.22 : 0.35);

        const k = Math.min(1, (now - c.t0) / (DUR[c.phase] || 1));
        switch (c.phase) {
            case 'wait': return;
            case 'dot':
                c.dotS = ease(k);
                if (k === 1) { c.ringT = now; go(c, 'arm', now); }
                break;
            case 'arm':
                c.armP = ease(k);
                if (k === 1) go(c, c.shelfP < 1 ? 'shelf' : 'type', now);
                break;
            case 'shelf':
                c.shelfP = ease(k);
                if (k === 1) go(c, 'type', now);
                break;
            case 'type':
                c.typed = k; c.subO = k;
                setTexts(c, false);
                if (k === 1) go(c, 'hold', now);
                break;
            case 'hold':
                if (c.states.length > 1 && now - c.t0 > HOLD_MS[c.id]) go(c, 'erase', now);
                break;
            case 'erase':
                c.subO = 1 - k; c.typed = 1 - k;
                setTexts(c, false);
                if (k === 1) go(c, 'retract', now);
                break;
            case 'retract':
                c.armP = 1 - ease(k); c.dotS = 1 - k;
                if (k === 1) {
                    c.idx = (c.idx + 1) % c.states.length;
                    c.cur = null;                        // 새 자리로 곧장
                    c.typed = 0; setTexts(c, false);
                    go(c, 'dot', now);
                }
                break;
        }
    }

    function paint(c, now) {
        const end = lerp(c.elbow, c.cur || c.elbow, c.armP);
        c.arm.setAttribute('points', pts([c.elbow, end]));
        c.shelf.setAttribute('points', pts([c.elbow, lerp(c.elbow, c.far, c.shelfP)]));
        const tip = c.cur || c.elbow;
        c.dot.setAttribute('cx', tip[0].toFixed(1)); c.dot.setAttribute('cy', tip[1].toFixed(1));
        c.dot.setAttribute('r', (3 * c.dotS).toFixed(2));
        if (c.sub) c.sub.style.opacity = String(c.subO);
        if (c.chips) c.chips.style.opacity = String(c.subO);
        // 점이 찍힐 때 한 번 퍼지는 고리
        const rk = c.ringT < 0 ? 1 : Math.min(1, (now - c.ringT) / 700);
        c.ring.setAttribute('cx', tip[0].toFixed(1)); c.ring.setAttribute('cy', tip[1].toFixed(1));
        c.ring.setAttribute('r', (3 + 13 * ease(rk)).toFixed(2));
        c.ring.style.opacity = rk >= 1 ? '0' : String(0.8 * (1 - rk));
    }

    /* ---------- 돌리기 ---------- */
    let raf = 0, running = false, visible = true, began = 0;
    const list = Object.values(callouts);
    function tick(now) {
        raf = 0;
        if (!running) return;
        const f = frame();
        if (!began) {
            // 연꽃이 꽃잎을 거의 다 그린 뒤 시작 (Lottie 가 없으면 1.6초 뒤)
            const ready = f != null ? f >= 64 : now - t0 > 1600;
            if (ready) { began = now; list.forEach(c => go(c, 'dot', now + START_MS[c.id])); }
        }
        if (!narrow.matches) {
            list.forEach(c => {
                if (c.phase === 'dot' && now < c.t0) return;          // 아직 차례가 아니다
                step(c, now, f);
                paint(c, now);
            });
        }
        raf = requestAnimationFrame(tick);
    }
    const t0 = performance.now();
    function run() {
        const want = visible && !document.hidden && !reduce.matches;
        if (want && !running) { running = true; raf = requestAnimationFrame(tick); }
        if (!want && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    }
    new IntersectionObserver(es => { visible = es[0].isIntersecting; run(); }, { threshold: 0.05 })
        .observe(document.querySelector('.home-hero'));
    document.addEventListener('visibilitychange', run);

    // 보는 중에 '움직임 줄이기'를 켜면: 멈추고 지금 설명을 다 보여 준다
    reduce.addEventListener && reduce.addEventListener('change', () => {
        if (!reduce.matches) { run(); return; }
        run();
        list.forEach(c => {
            c.phase = 'wait'; c.armP = 1; c.shelfP = 1; c.dotS = 1; c.subO = 1; c.typed = 1; c.ringT = -1;
            c.cur = c.states[c.idx].at(null); setTexts(c, true); paint(c, performance.now());
        });
    });
    // 언어를 바꾸면 지금 설명을 그 말로 다시 쓴다
    document.addEventListener('tenai:lang', () => list.forEach(c => { if (c.phase !== 'wait') setTexts(c, c.phase === 'hold'); }));
    run();
}
