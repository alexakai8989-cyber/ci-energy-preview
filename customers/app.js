/* C&I Energy, Site A copy (customers only), from Page B v2.
   Plain JavaScript, no framework. Header compaction, scroll reveals and the swing dial. */
(() => {
  'use strict';

  document.documentElement.classList.add('js');

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, parent) => {
    const node = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  };
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => mq.matches;
  const dur = (ms) => (reduced() ? 0 : ms);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const fmtInt = (n) => Math.round(n).toLocaleString('en-US');
  const fmtUSD = (n) => '$' + fmtInt(n);
  const fmtMW = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(1));

  /* Generic time-based tween. onUpdate(p) gets eased progress 0..1. Returns a cancel function. */
  function tween(ms, onUpdate, onDone) {
    const total = dur(ms);
    if (total === 0) { onUpdate(1); if (onDone) onDone(); return () => {}; }
    let raf = 0; const t0 = performance.now();
    const frame = (now) => {
      const p = clamp((now - t0) / total, 0, 1);
      onUpdate(easeOut(p));
      if (p < 1) raf = requestAnimationFrame(frame); else if (onDone) onDone();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }

  /* A number that tweens toward a target and writes itself with a formatter. */
  class NumberTween {
    constructor(node, format, value) { this.node = node; this.format = format; this.shown = value; this.cancel = null; this.write(value); }
    write(v) { this.shown = v; this.node.textContent = this.format(v); }
    to(target, ms = 400) {
      if (this.cancel) this.cancel();
      const from = this.shown;
      if (from === target) return;
      this.cancel = tween(ms, (p) => this.write(from + (target - from) * p), () => { this.cancel = null; this.write(target); });
    }
  }

  const debounce = (fn, ms) => { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* ---------- Header: compact after about 200px of scroll ---------- */
  (() => {
    const header = $('#header'); if (!header) return;
    let compact = false, ticking = false;
    const check = () => {
      ticking = false;
      const y = window.scrollY;
      if (!compact && y > 200) { compact = true; header.classList.add('is-compact'); }
      else if (compact && y < 120) { compact = false; header.classList.remove('is-compact'); }
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
    check();
  })();

  /* ---------- Scroll reveals (opacity + 12px rise, once) ---------- */
  (() => {
    const items = $$('[data-reveal]');
    if (!items.length) return;
    if (reduced() || !('IntersectionObserver' in window)) { items.forEach((n) => n.classList.add('reveal', 'is-in')); return; }
    items.forEach((n) => n.classList.add('reveal'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    items.forEach((n) => io.observe(n));
  })();

  /* Run fn once when node first enters the viewport (for charts that grow in once). */
  function onFirstView(node, fn, threshold = 0.35) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
    }, { threshold });
    io.observe(node);
  }

  /* ---------- Segmented control: radiogroup with a sliding thumb ---------- */
  function segmented(root, onChange) {
    const btns = $$('[role="radio"]', root);
    const thumb = $('.seg__thumb', root);
    let idx = Math.max(0, btns.findIndex((b) => b.getAttribute('aria-checked') === 'true'));
    const place = () => {
      const b = btns[idx]; if (!thumb || !b) return;
      thumb.style.width = `${b.offsetWidth}px`;
      thumb.style.transform = `translateX(${b.offsetLeft}px)`;
    };
    const apply = (i, { focus = false, fire = true } = {}) => {
      idx = i;
      btns.forEach((b, j) => { b.setAttribute('aria-checked', String(j === i)); b.tabIndex = j === i ? 0 : -1; });
      place();
      if (focus) btns[i].focus();
      if (fire) onChange(btns[i], i);
    };
    if ('ResizeObserver' in window) new ResizeObserver(place).observe(root); else window.addEventListener('resize', place);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    btns.forEach((b, i) => {
      b.addEventListener('click', () => apply(i));
      b.addEventListener('keydown', (e) => {
        let n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (idx + 1) % btns.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (idx - 1 + btns.length) % btns.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = btns.length - 1;
        else if (e.key === ' ' || e.key === 'Enter') n = i;
        if (n === null) return;
        e.preventDefault();
        apply(n, { focus: true });
      });
    });
    apply(idx, { fire: false });
    return { get index() { return idx; }, button: (i) => btns[i] };
  }

  /* ---------- Tool 1: swing dial ---------- */
  (() => {
    const root = $('#dial'); if (!root) return;
    const svg = $('svg', root);
    const CX = 180, CY = 172, R = 128;
    const MIN = 1, MAX = 500, START = -135, SWEEP = 270;
    const HOURS = 8760, CF = 0.9;

    const tOf = (v) => Math.log(v / MIN) / Math.log(MAX / MIN);
    const angOf = (v) => START + SWEEP * tOf(v);
    const pt = (ang, r) => { const a = (ang * Math.PI) / 180; return [CX + r * Math.sin(a), CY - r * Math.cos(a)]; };
    const arcPath = (a0, a1, r) => {
      if (a1 - a0 < 0.01) return '';
      const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r);
      return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
    };

    /* Static drawing: track, ticks and labels */
    svgEl('path', { class: 'dial__track', d: arcPath(START, START + SWEEP, R) }, svg);
    const minor = [2, 3, 4, 6, 7, 8, 9, 30, 40, 60, 70, 80, 90, 200, 300, 400];
    const major = [1, 5, 10, 20, 50, 100, 500];
    const gTicks = svgEl('g', null, svg);
    minor.forEach((v) => {
      const a = angOf(v); const [x0, y0] = pt(a, R + 12), [x1, y1] = pt(a, R + 17);
      svgEl('line', { class: 'dial__tick', x1: x0.toFixed(2), y1: y0.toFixed(2), x2: x1.toFixed(2), y2: y1.toFixed(2) }, gTicks);
    });
    major.forEach((v) => {
      const a = angOf(v); const [x0, y0] = pt(a, R + 12), [x1, y1] = pt(a, R + 21);
      svgEl('line', { class: 'dial__tick dial__tick--major', x1: x0.toFixed(2), y1: y0.toFixed(2), x2: x1.toFixed(2), y2: y1.toFixed(2) }, gTicks);
      const [lx, ly] = pt(a, R + 36);
      const label = svgEl('text', { class: 'dial__label', x: lx.toFixed(2), y: ly.toFixed(2), 'text-anchor': 'middle', 'dominant-baseline': 'central' }, gTicks);
      label.textContent = String(v);
    });
    const arc = svgEl('path', { class: 'dial__arc', d: '' }, svg);
    const knob = svgEl('circle', { class: 'dial__knob', r: 10, cx: 0, cy: 0 }, svg);
    const knobDot = svgEl('circle', { class: 'dial__knob-dot', r: 3, cx: 0, cy: 0 }, svg);
    const tMw = svgEl('text', { class: 'dial__mw', x: CX, y: 136, 'text-anchor': 'middle' }, svg);
    const tResult = svgEl('text', { class: 'dial__result', x: CX, y: 194, 'text-anchor': 'middle' }, svg);
    const tUnit = svgEl('text', { class: 'dial__unit', x: CX, y: 226, 'text-anchor': 'middle' }, svg);
    tUnit.textContent = 'a year, up or down';

    const srMirror = $('#dial-sr');
    const live = $('#dial-live');
    const mwhNode = $('#dial-mwh');

    let value = 10, swing = 10;
    const mwh = (v) => v * HOURS * CF;
    const result = (v, s) => mwh(v) * s;

    const resultTween = new NumberTween(tResult, (n) => {
      const s = fmtUSD(n);
      tResult.setAttribute('font-size', s.length <= 8 ? 56 : s.length <= 10 ? 46 : 40);
      return s;
    }, result(value, swing));
    const mwhTween = new NumberTween(mwhNode, fmtInt, mwh(value));

    const snap = (v) => {
      v = clamp(v, MIN, MAX);
      const unit = v < 10 ? 0.5 : v < 100 ? 1 : 5;
      return clamp(Math.round(v / unit) * unit, MIN, MAX);
    };
    const stepFor = (v, dir) => (dir > 0 ? (v < 10 ? 0.5 : v < 100 ? 1 : 5) : (v <= 10 ? 0.5 : v <= 100 ? 1 : 5));

    const drawArc = (v) => {
      const a = angOf(v);
      arc.setAttribute('d', arcPath(START, a, R));
      const [kx, ky] = pt(a, R);
      knob.setAttribute('cx', kx.toFixed(2)); knob.setAttribute('cy', ky.toFixed(2));
      knobDot.setAttribute('cx', kx.toFixed(2)); knobDot.setAttribute('cy', ky.toFixed(2));
    };

    const announce = debounce(() => {
      live.textContent = `${fmtMW(value)} MW at $${swing} per MWh: ${fmtUSD(result(value, swing))} a year, up or down. About ${fmtInt(mwh(value))} MWh a year.`;
    }, 600);

    const update = ({ animate = true } = {}) => {
      drawArc(value);
      tMw.textContent = `${fmtMW(value)} MW`;
      root.setAttribute('aria-valuenow', String(value));
      root.setAttribute('aria-valuetext', `${fmtMW(value)} megawatts, ${fmtUSD(result(value, swing))} a year up or down`);
      resultTween.to(result(value, swing), animate ? 400 : 0);
      mwhTween.to(mwh(value), animate ? 400 : 0);
      srMirror.textContent = `${fmtMW(value)} MW: ${fmtUSD(result(value, swing))} a year, up or down.`;
      announce();
    };

    /* Pointer: drag anywhere on the dial */
    let dragging = false;
    const setFromPointer = (e) => {
      const rect = svg.getBoundingClientRect();
      const s = rect.width / 360;
      const x = (e.clientX - rect.left) / s, y = (e.clientY - rect.top) / s;
      let ang = (Math.atan2(x - CX, -(y - CY)) * 180) / Math.PI;
      if (ang > 135) ang = 135; else if (ang < -135) ang = -135;
      const t = (ang - START) / SWEEP;
      value = snap(MIN * Math.pow(MAX / MIN, t));
      update({ animate: false });
    };
    root.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true; root.classList.add('is-dragging');
      try { root.setPointerCapture(e.pointerId); } catch (err) { /* older engines */ }
      setFromPointer(e);
      root.focus({ preventScroll: true });
      e.preventDefault();
    });
    root.addEventListener('pointermove', (e) => { if (dragging) setFromPointer(e); });
    const stop = () => { dragging = false; root.classList.remove('is-dragging'); };
    root.addEventListener('pointerup', stop);
    root.addEventListener('pointercancel', stop);
    root.addEventListener('lostpointercapture', stop);

    /* Keyboard: a real slider */
    root.addEventListener('keydown', (e) => {
      let v = value;
      switch (e.key) {
        case 'ArrowRight': case 'ArrowUp': v = snap(value + stepFor(value, 1)); break;
        case 'ArrowLeft': case 'ArrowDown': v = snap(value - stepFor(value, -1)); break;
        case 'PageUp': v = snap(value * 2); break;
        case 'PageDown': v = snap(value / 2); break;
        case 'Home': v = MIN; break;
        case 'End': v = MAX; break;
        default: return;
      }
      e.preventDefault();
      value = v;
      update();
    });

    /* Swing pills */
    segmented($('#swing-seg'), (btn) => { swing = Number(btn.dataset.value); update(); });

    /* First paint: show defaults; sweep in once when the dial enters the viewport */
    drawArc(MIN);
    tMw.textContent = `${fmtMW(value)} MW`;
    resultTween.write(0);
    mwhTween.write(0);
    onFirstView(root, () => {
      const target = value;
      tween(600, (p) => { drawArc(MIN * Math.pow(target / MIN, p)); }, () => { drawArc(target); });
      update();
    });
  })();

})();
