// Motor de animação determinístico: render(t) desenha o quadro no instante t (s).
const E = (p) => 1 - Math.pow(1 - p, 3);            // easeOutCubic
const B = (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); }; // easeOutBack
const clamp = (x) => Math.max(0, Math.min(1, x));
const els = [...document.querySelectorAll('[data-in]')];
const parts = [];
(function(){ const box = document.getElementById('fx'); let s = 7;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 38; i++) { const d = document.createElement('div'); d.className = 'pt';
    const r = 3 + rnd() * 6; d.style.width = d.style.height = r + 'px'; box.appendChild(d);
    parts.push({ d, x: rnd() * 1080, y: rnd() * 1920, v: 12 + rnd() * 30, ph: rnd() * 6.28 }); } })();
window.render = function (t) {
  document.body.style.setProperty('--z', 1 + t * 0.004);
  for (const p of parts) { const y = (p.y - p.v * t + 1920 * 4) % 1920;
    p.d.style.transform = `translate(${p.x + Math.sin(t * .8 + p.ph) * 18}px,${y}px)`;
    p.d.style.opacity = .25 + .25 * Math.sin(t * 1.3 + p.ph); }
  let shake = 0;
  for (const el of els) {
    const a = +el.dataset.in, fx = el.dataset.fx || 'up', out = el.dataset.out ? +el.dataset.out : 1e9;
    const dur = fx === 'slam' ? .35 : fx === 'strike' ? .4 : .45;
    const p = clamp((t - a) / dur); const q = clamp((t - out) / .25);
    let op = p > 0 ? 1 : 0, tr = '';
    if (fx === 'up') { op = E(p); tr = `translateY(${(1 - E(p)) * 70}px)`; }
    if (fx === 'fade') { op = E(p); }
    if (fx === 'pop') { op = clamp(p * 3); tr = `scale(${.55 + .45 * B(p)})`; }
    if (fx === 'left') { op = E(p); tr = `translateX(${(1 - E(p)) * -140}px)`; }
    if (fx === 'right') { op = E(p); tr = `translateX(${(1 - E(p)) * 140}px)`; }
    if (fx === 'slam') { op = clamp(p * 4); tr = `scale(${2.3 - 1.3 * E(p)}) rotate(${(1 - E(p)) * -6}deg)`; if (t >= a && t < a + .45) shake = Math.max(shake, 1 - (t - a) / .45); }
    if (fx === 'drop') { op = clamp(p * 3); tr = `translateY(${(1 - B(p)) * -260}px) rotate(${-4 + (1 - p) * -14}deg)`; if (t >= a + .3 && t < a + .7) shake = Math.max(shake, .6 * (1 - (t - a - .3) / .4)); }
    if (fx === 'strike') { el.style.width = (E(p) * 100) + '%'; op = p > 0 ? 1 : 0; }
    if (el.dataset.pulse && t > a + .5) tr += ` scale(${1 + .035 * Math.sin((t - a) * 5)})`;
    if (el.dataset.bob) tr += ` translateY(${Math.sin(t * 2.2) * 10}px) rotate(${Math.sin(t * 1.6) * 2}deg)`;
    if (el.dataset.jolt && t >= a && t < a + .5) tr += ` translateX(${Math.sin((t - a) * 60) * 14 * (1 - (t - a) / .5)}px)`;
    op *= 1 - q;
    el.style.opacity = op; el.style.transform = tr;
    if (el.dataset.count) { const [f, to] = el.dataset.count.split(',').map(Number);
      const v = Math.round(f + (to - f) * E(clamp((t - a) / .7))); el.textContent = (el.dataset.sign && v > 0 ? '+' : '') + String(v).replace('-', '−'); }
  }
  const s = document.getElementById('stage');
  s.style.transform = shake ? `translate(${Math.sin(t * 90) * 16 * shake}px,${Math.cos(t * 70) * 12 * shake}px)` : '';
  const fl = document.getElementById('flash'); if (fl) { let f = 0; for (const x of (fl.dataset.at || '').split(',').filter(Boolean)) { const d = t - +x; if (d >= 0 && d < .35) f = Math.max(f, 1 - d / .35); } fl.style.opacity = f * .55; }
};
render(0);
