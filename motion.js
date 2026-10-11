/* =====================================================================
   움직임 켜기 · 멈춤
   ---------------------------------------------------------------------
   기본은 기기 설정을 따른다 — '움직임 줄이기'(prefers-reduced-motion)가 켜진
   기기에서는 애니메이션을 멈춘 장면으로 보여 준다.
   하지만 Windows 의 '애니메이션 효과 끄기', 성능 우선 설정, 원격 데스크톱처럼
   본인도 모르게 켜져 있는 경우가 많다. 그래서 사이트에서 직접 켜고 끌 수 있게 한다.
     [data-motion-toggle] 단추 → 누르면 반대로. 고른 값은 이 브라우저에 기억한다.
   자동으로 움직이는 내용을 멈출 수 있게 하는 것은 웹 접근성 지침(KWCAG '정지 기능 제공')
   에도 맞는다.

   쓰는 곳: lottie-fx.js (모든 Lottie), hero-callouts.js (첫 화면 설명선)
     motion.reduced        지금 멈춰야 하는가
     motion.onChange(fn)   바뀌면 fn(reduced)
   ===================================================================== */

const KEY = 'tenai_motion';                       // 'on' · 'off' · 없음(기기 설정을 따름)
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
const read = () => {
    try { const v = localStorage.getItem(KEY); return v === 'on' || v === 'off' ? v : null; }
    catch (e) { return null; }
};
let pref = read();
const listeners = new Set();

export const motion = {
    get reduced() { return pref === 'off' || (pref !== 'on' && mq.matches); },
    get pref() { return pref; },
    get osReduced() { return mq.matches; },
    set(v) {
        pref = v === 'on' || v === 'off' ? v : null;
        try { pref ? localStorage.setItem(KEY, pref) : localStorage.removeItem(KEY); } catch (e) { /* 저장 막힘 */ }
        emit();
    },
    onChange(fn) { listeners.add(fn); }
};

function paintToggles() {
    const off = motion.reduced;
    document.documentElement.classList.toggle('motion-reduced', off);
    document.querySelectorAll('[data-motion-toggle]').forEach(b => {
        b.setAttribute('aria-pressed', String(!off));
        b.dataset.state = off ? 'off' : 'on';
        const label = b.querySelector('.motion-toggle-label');
        const ko = off ? '움직임 켜기' : '움직임 멈춤';
        if (label) label.textContent = window.TenI18n ? window.TenI18n.t(ko) : ko;
    });
}
function emit() {
    paintToggles();
    listeners.forEach(fn => { try { fn(motion.reduced); } catch (e) { console.warn(e); } });
}

if (mq.addEventListener) mq.addEventListener('change', () => { if (pref == null) emit(); });
document.addEventListener('click', e => {
    const b = e.target.closest('[data-motion-toggle]');
    if (!b) return;
    motion.set(motion.reduced ? 'on' : 'off');
});
document.addEventListener('tenai:lang', paintToggles);
paintToggles();
window.TenMotion = motion;
