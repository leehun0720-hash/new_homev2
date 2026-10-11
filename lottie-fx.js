/* =====================================================================
   Lottie 애니메이션
   ---------------------------------------------------------------------
   [data-lottie="이름"] 요소에 /lottie/<이름>.json 을 붙인다.
   애니메이션은 lottie-src/build_lottie.py 가 만든다 (Lottie Creator 로 열어 손볼 수 있는 표준 형식).

   data-lottie-mode
     once        화면에 들어오면 한 번 그린다 (기본)
     hover       한 번 그린 뒤, data-lottie-host 로 고른 상위 요소에 손을 대면 다시 그린다
     intro-loop  한 번 그린 뒤 data-lottie-loop-from 프레임부터 끝까지를 되풀이한다.
                 화면 밖으로 나가면 멈춘다 (배터리)
   data-lottie-rest   움직임 줄이기를 켠 사람에게 보여 줄 프레임 (기본: 마지막 프레임)

   라이브러리(lottie-web 의 SVG 전용 경량판)는 [data-lottie] 가 있는 쪽에서만,
   그것도 첫 애니메이션이 화면 가까이 왔을 때에야 내려받는다.
   모두 꾸밈이라 aria-hidden 이고, 실패해도 본문에는 영향이 없다.
   ===================================================================== */

const nodes = Array.from(document.querySelectorAll('[data-lottie]'));

if (nodes.length && 'IntersectionObserver' in window) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    /* CSS 로 그린 대체 장식(쪽 머리 고리 등)은 이 표시가 있을 때만 걷어 낸다 */
    const root = document.documentElement;
    root.classList.add('has-lottie');
    let lib = null;
    const loadLib = () => lib || (lib = import('lottie-web/build/player/esm/lottie_light.min.js')
        .then(m => m.default || m)
        .catch(e => { root.classList.remove('has-lottie'); throw e; }));

    const LOOPING = new Set(['intro-loop']);

    async function start(el) {
        let lottie;
        try { lottie = await loadLib(); } catch (e) { console.warn('Lottie 불러오기 실패', e); return; }
        const mode = el.dataset.lottieMode || 'once';
        const anim = lottie.loadAnimation({
            container: el,
            renderer: 'svg',
            loop: false,
            autoplay: false,
            path: `/lottie/${el.dataset.lottie}.json`,
            rendererSettings: { preserveAspectRatio: el.dataset.lottieAlign || 'xMidYMid meet', progressiveLoad: true }
        });
        el._lottie = anim;
        anim.addEventListener('data_failed', () => el.classList.add('lottie-failed'));

        anim.addEventListener('DOMLoaded', () => {
            el.classList.add('is-lottie');
            const last = Math.max(0, Math.floor(anim.totalFrames) - 1);
            const rest = el.dataset.lottieRest != null ? Number(el.dataset.lottieRest) : last;
            if (reduce.matches) { anim.goToAndStop(rest, true); return; }

            if (mode === 'intro-loop') {
                const from = Number(el.dataset.lottieLoopFrom || 0);
                let looping = false;
                anim.addEventListener('complete', () => {
                    if (looping) return;
                    looping = true;
                    anim.loop = true;
                    anim.playSegments([from, anim.totalFrames], true);
                });
            }
            if (mode === 'hover') {
                const host = el.closest(el.dataset.lottieHost || '*') || el;
                const replay = () => { if (anim.isPaused) anim.goToAndPlay(0, true); };
                host.addEventListener('mouseenter', replay);
                host.addEventListener('focusin', replay);
            }
            /* 그림이 도착했을 때 이미 화면 밖이면, 다시 들어올 때 그린다 */
            if (el._visible !== false) anim.play();
            else el._waiting = true;
        });
    }

    const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const el = entry.target;
            el._visible = entry.isIntersecting;
            if (entry.isIntersecting) {
                if (!el._lottie && !el._starting) { el._starting = true; start(el); }
                else if (el._lottie && (el._waiting || el._pausedOffscreen)) {
                    el._waiting = el._pausedOffscreen = false;
                    el._lottie.play();
                }
            } else if (el._lottie && LOOPING.has(el.dataset.lottieMode) && !el._lottie.isPaused) {
                el._pausedOffscreen = true;
                el._lottie.pause();
            }
        });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.15 });

    nodes.forEach(n => io.observe(n));

    /* 보던 중에 '움직임 줄이기'를 켜면 그 자리에서 멈춘다 */
    reduce.addEventListener && reduce.addEventListener('change', () => {
        if (!reduce.matches) return;
        nodes.forEach(n => {
            const a = n._lottie;
            if (!a) return;
            a.loop = false;
            const last = Math.max(0, Math.floor(a.totalFrames) - 1);
            a.goToAndStop(n.dataset.lottieRest != null ? Number(n.dataset.lottieRest) : last, true);
        });
    });
}
