/* C&I Energy Retail & Procurement Company, Page B v2.
   Plain JavaScript, no framework. Header compaction, scroll reveals, and the four tools:
   swing dial, plan chart, funding composition, earnings calculator. */
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
  const fmtShort = (v) => {
    if (v >= 1e6) return '$' + String(+(v / 1e6).toFixed(2)) + 'M';
    if (v >= 1e3) return '$' + Math.round(v / 1e3) + 'K';
    return '$' + Math.round(v);
  };
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

  /* ---------- Shared chart helpers ---------- */
  const barPath = (x, yTop, w, h, r) => {
    if (h <= 0.01 || w <= 0.01) return '';
    r = Math.min(r, w / 2, h);
    const yBase = yTop + h;
    return `M${x.toFixed(2)},${yBase.toFixed(2)} V${(yTop + r).toFixed(2)} Q${x.toFixed(2)},${yTop.toFixed(2)} ${(x + r).toFixed(2)},${yTop.toFixed(2)} H${(x + w - r).toFixed(2)} Q${(x + w).toFixed(2)},${yTop.toFixed(2)} ${(x + w).toFixed(2)},${(yTop + r).toFixed(2)} V${yBase.toFixed(2)} Z`;
  };
  const niceScale = (maxRaw, targetTicks = 5) => {
    if (maxRaw <= 0) return { max: 1, step: 1 };
    const raw = maxRaw / targetTicks;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((c) => c * p).find((s) => s >= raw);
    return { max: Math.ceil(maxRaw / step - 1e-9) * step, step };
  };
  const clearNode = (n) => { while (n.firstChild) n.removeChild(n.firstChild); };
  function tipController(wrap) {
    const tip = $('.chart__tip', wrap);
    return {
      show(html, x, y) { tip.innerHTML = html; tip.hidden = false; tip.style.left = `${x}px`; tip.style.top = `${y}px`; },
      hide() { tip.hidden = true; },
    };
  }

  /* ---------- Tool 2: plan chart ---------- */
  (() => {
    const wrap = $('#plan-chart'); if (!wrap) return;
    const svg = $('svg', wrap);
    const tip = tipController(wrap);
    const noteNode = $('#plan-note'), legendNode = $('#plan-legend'), unitNode = $('#plan-unit');
    const M = { top: 32, right: 12, bottom: 40, left: 56 };
    const H = 360;
    const MEASURES = {
      margin: {
        unit: '$M', label: 'Gross margin and EBITDA, $M a year', max: 15, step: 5,
        series: [
          { cls: 'fill', name: 'Gross margin', values: [1.6, 5.4, 13.5], fmt: (v) => `~$${v}M` },
          { cls: 'hollow', name: 'EBITDA', values: [0.55, 3.5, 10.1], fmt: (v) => `~$${v}M` },
        ],
        note: 'Gross margin 8.4× from Year 1 to Year 3',
        tick: (v) => String(v),
      },
      contracts: {
        unit: 'Contracts', label: 'Active contracts at year end', max: 50, step: 10,
        series: [{ cls: 'fill', name: 'Active contracts', values: [8, 22, 45], fmt: (v) => `${v} contracts` }],
        note: '5.6× the contracts by Year 3',
        tick: (v) => String(v),
      },
      volume: {
        unit: 'GWh', label: 'Annual volume, GWh', max: 2500, step: 500,
        series: [{ cls: 'fill', name: 'Annual volume, GWh', values: [320, 990, 2250], fmt: (v) => `${fmtInt(v)} GWh` }],
        note: '7× the volume by Year 3',
        tick: (v) => fmtInt(v),
      },
    };
    let measure = 'margin';
    let W = 0;
    let cancelAnim = null;
    let grown = false;

    const gGrid = svgEl('g', null, svg);
    const gBars = svgEl('g', null, svg);
    const gAxis = svgEl('g', null, svg);
    const gHits = svgEl('g', null, svg);
    const bars = [0, 1, 2].map(() => ({ fill: svgEl('path', { class: 'bar--fill' }, gBars), hollow: svgEl('path', { class: 'bar--hollow' }, gBars) }));
    const hits = [0, 1, 2].map((i) => svgEl('rect', { class: 'hit', tabindex: 0, role: 'img', 'data-i': i }, gHits));

    const plotH = () => H - M.top - M.bottom;
    const plotW = () => W - M.left - M.right;
    const baseline = () => H - M.bottom;
    const yOf = (v, max) => baseline() - (v / max) * plotH();

    /* Geometry for a measure at the current width, optionally with zero heights */
    const layout = (m, flat = false) => {
      const def = MEASURES[m];
      const slot = plotW() / 3;
      const grouped = def.series.length === 2;
      const barW = grouped ? Math.min(72, slot * 0.28) : Math.min(120, slot * 0.46);
      const gap = 10;
      return [0, 1, 2].map((i) => {
        const cx = M.left + slot * (i + 0.5);
        const vF = flat ? 0 : def.series[0].values[i];
        const vH = flat || !grouped ? 0 : def.series[1].values[i];
        const hF = (vF / def.max) * plotH();
        const hH = (vH / def.max) * plotH();
        return grouped
          ? { fx: cx - barW - gap / 2, fw: barW, fh: hF, hx: cx + gap / 2, hw: barW, hh: hH, ho: 1 }
          : { fx: cx - barW / 2, fw: barW, fh: hF, hx: cx, hw: 0, hh: 0, ho: 0 };
      });
    };
    let cur = null;

    const render = (geom) => {
      const base = baseline();
      geom.forEach((g, i) => {
        bars[i].fill.setAttribute('d', barPath(g.fx, base - g.fh, g.fw, g.fh, 4));
        bars[i].hollow.setAttribute('d', barPath(g.hx, base - g.hh, g.hw, g.hh, 4));
        bars[i].hollow.setAttribute('opacity', g.ho.toFixed(3));
      });
    };
    const lerpGeom = (a, b, p) => a.map((ga, i) => { const gb = b[i]; const o = {}; for (const k in ga) o[k] = ga[k] + (gb[k] - ga[k]) * p; return o; });

    const drawAxes = (m) => {
      const def = MEASURES[m];
      clearNode(gGrid); clearNode(gAxis);
      for (let v = 0; v <= def.max + 1e-9; v += def.step) {
        const y = yOf(v, def.max);
        svgEl('line', { class: v === 0 ? 'axis' : 'grid', x1: M.left, x2: W - M.right, y1: y.toFixed(2), y2: y.toFixed(2) }, gGrid);
        const t = svgEl('text', { class: 'tick', x: M.left - 10, y: y.toFixed(2), 'text-anchor': 'end', 'dominant-baseline': 'central' }, gAxis);
        t.textContent = def.tick(v);
      }
      const unit = svgEl('text', { class: 'tick', x: M.left, y: 14, 'text-anchor': 'start' }, gAxis);
      unit.textContent = def.unit;
      const slot = plotW() / 3;
      [0, 1, 2].forEach((i) => {
        const x = M.left + slot * (i + 0.5);
        const t = svgEl('text', { class: 'tick tick--x', x: x.toFixed(2), y: H - 12, 'text-anchor': 'middle' }, gAxis);
        t.textContent = `Year ${i + 1}`;
        hits[i].setAttribute('x', (x - slot / 2 + 4).toFixed(2));
        hits[i].setAttribute('width', Math.max(0, slot - 8).toFixed(2));
        hits[i].setAttribute('y', M.top);
        hits[i].setAttribute('height', plotH());
        hits[i].setAttribute('aria-label', `Year ${i + 1}. ` + def.series.map((s) => `${s.name} ${s.fmt(s.values[i])}.`).join(' '));
      });
    };

    const drawSide = (m) => {
      const def = MEASURES[m];
      noteNode.textContent = def.note;
      unitNode.textContent = def.label;
      clearNode(legendNode);
      def.series.forEach((s) => {
        const li = document.createElement('li');
        const sw = document.createElement('span'); sw.className = `swatch swatch--${s.cls}`; sw.setAttribute('aria-hidden', 'true');
        li.appendChild(sw); li.appendChild(document.createTextNode(s.name));
        legendNode.appendChild(li);
      });
    };

    const showTip = (i) => {
      const def = MEASURES[measure];
      const slot = plotW() / 3;
      const x = M.left + slot * (i + 0.5);
      const top = Math.min(...def.series.map((s) => yOf(s.values[i], def.max)));
      const lines = def.series.map((s) => `${s.name} ${s.fmt(s.values[i])}`).join('<br>');
      tip.show(`<strong>Year ${i + 1}</strong>${lines}`, x, top);
      hits.forEach((h, j) => h.classList.toggle('is-on', j === i));
    };
    const hideTip = () => { tip.hide(); hits.forEach((h) => h.classList.remove('is-on')); };
    hits.forEach((h, i) => {
      h.addEventListener('pointerenter', () => showTip(i));
      h.addEventListener('pointerleave', hideTip);
      h.addEventListener('click', () => showTip(i)); /* a tap fires pointerleave at once; click keeps the tip up */
      h.addEventListener('focus', () => showTip(i));
      h.addEventListener('blur', hideTip);
      h.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hideTip(); } });
    });
    document.addEventListener('pointerdown', (e) => { if (!wrap.contains(e.target)) hideTip(); });

    const setMeasure = (m, { animate = true } = {}) => {
      measure = m;
      hideTip();
      drawAxes(m); drawSide(m);
      const target = layout(m, !grown);
      if (cancelAnim) cancelAnim();
      if (!animate || !cur) { cur = target; render(cur); return; }
      const from = cur;
      cancelAnim = tween(600, (p) => { cur = lerpGeom(from, target, p); render(cur); }, () => { cur = target; render(cur); cancelAnim = null; });
    };

    const resize = () => {
      const w = Math.max(280, Math.round(wrap.getBoundingClientRect().width));
      if (w === W) return;
      W = w;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      if (cancelAnim) { cancelAnim(); cancelAnim = null; }
      drawAxes(measure);
      cur = layout(measure, !grown);
      render(cur);
    };
    resize();
    drawSide(measure);
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(wrap); else window.addEventListener('resize', resize);

    segmented($('#plan-seg'), (btn) => setMeasure(btn.dataset.measure));

    onFirstView(wrap, () => { grown = true; setMeasure(measure); });
  })();

  /* ---------- Tool 3: funding composition ---------- */
  (() => {
    const tool = $('#funding-tool'); if (!tool) return;
    const PARTS = [
      { name: 'Working capital', when: 'Months 1 to 12', lo: 300, hi: 500 },
      { name: 'Wholesale collateral and credit reserve', when: 'Months 1 to 6', lo: 200, hi: 400 },
      { name: 'Business development and sales', when: 'Months 3 to 12', lo: 150, hi: 300 },
      { name: 'Regulatory and licensing', when: 'Months 1 to 6', lo: 100, hi: 200 },
      { name: 'Contingency reserve', when: 'Ongoing', lo: 100, hi: 200 },
      { name: 'Legal: contracts, structure, consultant agreements', when: 'Months 1 to 3', lo: 80, hi: 150 },
      { name: 'Technology and systems', when: 'Months 1 to 3', lo: 30, hi: 60 },
    ];
    const total = PARTS.reduce((s, p) => s + (p.lo + p.hi) / 2, 0);
    const segs = $$('.stack__seg', tool);
    const rows = $$('.frow', tool);
    const caption = $('#funding-caption');
    const IDLE = caption.textContent;
    let pinned = -1, hovered = -1;

    const paint = () => {
      const active = hovered >= 0 ? hovered : pinned;
      segs.forEach((s, i) => s.classList.toggle('is-active', i === active));
      rows.forEach((r, i) => r.classList.toggle('is-active', i === active));
      if (active < 0) { caption.textContent = IDLE; return; }
      const p = PARTS[active]; const mid = (p.lo + p.hi) / 2;
      caption.textContent = `${p.name} (${p.when}): $${p.lo}K to $${p.hi}K. The midpoint of $${mid}K is ${Math.round((mid / total) * 100)}% of the $${fmtInt(total)}K total.`;
    };
    const wire = (list) => list.forEach((node) => {
      const i = Number(node.dataset.i);
      node.addEventListener('pointerenter', () => { hovered = i; paint(); });
      node.addEventListener('pointerleave', () => { hovered = -1; paint(); });
      node.addEventListener('focus', () => { hovered = i; paint(); });
      node.addEventListener('blur', () => { hovered = -1; paint(); });
      node.addEventListener('click', () => { pinned = pinned === i ? -1 : i; hovered = -1; paint(); });
    });
    wire(segs); wire(rows);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pinned >= 0) { pinned = -1; paint(); } });

    onFirstView(tool, () => tool.classList.add('is-grown'), 0);
  })();

  /* ---------- Tool 4: earnings calculator and band chart ---------- */
  (() => {
    const tool = $('#calc-tool'); if (!tool) return;
    const USES = [10000, 25000, 50000, 75000, 100000, 150000, 250000, 400000, 600000, 800000];
    const state = { contracts: 3, use: 2, term: 3 };
    const DEFS = {
      contracts: { min: 1, max: 12, text: (v) => String(v) },
      use: { min: 0, max: USES.length - 1, text: (i) => fmtInt(USES[i]) },
      term: { min: 1, max: 4, text: (v) => String(v) },
    };
    const compute = () => {
      const V = state.contracts * USES[state.use], N = state.term;
      return { V, N, feeLo: V * 0.5, feeHi: V * 1, trailLo: V * 0.25, trailHi: V * 0.5, totLo: V * (0.5 + 0.25 * N), totHi: V * (1 + 0.5 * N) };
    };
    let r = compute();
    const out = {
      feeLo: new NumberTween($('#r-fee-lo'), fmtUSD, r.feeLo), feeHi: new NumberTween($('#r-fee-hi'), fmtUSD, r.feeHi),
      trailLo: new NumberTween($('#r-trail-lo'), fmtUSD, r.trailLo), trailHi: new NumberTween($('#r-trail-hi'), fmtUSD, r.trailHi),
      totLo: new NumberTween($('#r-tot-lo'), fmtUSD, r.totLo), totHi: new NumberTween($('#r-tot-hi'), fmtUSD, r.totHi),
    };
    const live = $('#calc-live');
    const announce = debounce(() => {
      live.textContent = `${state.contracts} contract${state.contracts === 1 ? '' : 's'} a year at ${fmtInt(USES[state.use])} MWh each over ${state.term} year${state.term === 1 ? '' : 's'}: referral fee ${fmtUSD(r.feeLo)} to ${fmtUSD(r.feeHi)}, trailing commission ${fmtUSD(r.trailLo)} to ${fmtUSD(r.trailHi)} a year, total ${fmtUSD(r.totLo)} to ${fmtUSD(r.totHi)}.`;
    }, 600);

    /* Band chart */
    const wrap = $('#band-chart'); const svg = $('svg', wrap); const tip = tipController(wrap);
    const M = { top: 24, right: 20, bottom: 36, left: 64 };
    const H = 300;
    let W = 0;
    const gGrid = svgEl('g', null, svg), gBand = svgEl('g', null, svg), gAxis = svgEl('g', null, svg), gDots = svgEl('g', null, svg), gHits = svgEl('g', null, svg);
    const band = svgEl('path', { class: 'band-fill' }, gBand);
    const lineLo = svgEl('path', { class: 'line--lo' }, gBand);
    const lineHi = svgEl('path', { class: 'line--hi' }, gBand);
    const cursor = svgEl('line', { class: 'cursor', opacity: 0 }, gBand);
    const plotW = () => W - M.left - M.right, plotH = () => H - M.top - M.bottom, baseline = () => H - M.bottom;
    const lo = (V, k) => V * (0.5 + 0.25 * k), hi = (V, k) => V * (1 + 0.5 * k);
    let shown = { V: 0, N: r.N, max: niceScale(r.totHi).max };
    let cancelAnim = null, grown = false;

    const drawAxes = (max) => {
      clearNode(gGrid); clearNode(gAxis);
      const { step } = niceScale(max);
      for (let v = 0; v <= max + 1e-9; v += step) {
        const y = baseline() - (v / max) * plotH();
        svgEl('line', { class: v === 0 ? 'axis' : 'grid', x1: M.left, x2: W - M.right, y1: y.toFixed(2), y2: y.toFixed(2) }, gGrid);
        const t = svgEl('text', { class: 'tick', x: M.left - 10, y: y.toFixed(2), 'text-anchor': 'end', 'dominant-baseline': 'central' }, gAxis);
        t.textContent = fmtShort(v);
      }
    };
    const drawXLabels = (N) => {
      for (let k = 0; k <= N; k++) {
        const x = M.left + (plotW() * k) / N;
        const t = svgEl('text', { class: 'tick tick--x', x: x.toFixed(2), y: H - 12, 'text-anchor': k === 0 ? 'start' : k === N ? 'end' : 'middle' }, gAxis);
        t.textContent = k === 0 ? 'Signing' : `Year ${k}`;
      }
    };
    const draw = (V, N, max) => {
      const xs = (k) => M.left + (plotW() * k) / N;
      const ys = (v) => baseline() - (v / max) * plotH();
      const K = Math.ceil(N - 1e-9);
      const ptsLo = [], ptsHi = [];
      for (let k = 0; k <= K; k++) { const kk = Math.min(k, N); ptsLo.push([xs(kk), ys(lo(V, kk))]); ptsHi.push([xs(kk), ys(hi(V, kk))]); }
      const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('');
      lineLo.setAttribute('d', path(ptsLo));
      lineHi.setAttribute('d', path(ptsHi));
      band.setAttribute('d', path(ptsLo) + ptsHi.slice().reverse().map((p) => `L${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('') + 'Z');
      clearNode(gDots);
      for (let k = 0; k <= K; k++) {
        svgEl('circle', { class: 'dot--lo', r: 4, cx: ptsLo[k][0].toFixed(2), cy: ptsLo[k][1].toFixed(2) }, gDots);
        svgEl('circle', { class: 'dot--hi', r: 4, cx: ptsHi[k][0].toFixed(2), cy: ptsHi[k][1].toFixed(2) }, gDots);
      }
    };
    const buildHits = () => {
      clearNode(gHits);
      const { V, N } = r; const max = shown.max;
      const slot = plotW() / N;
      for (let k = 0; k <= N; k++) {
        const x = M.left + slot * k;
        const x0 = Math.max(M.left, x - slot / 2), x1 = Math.min(W - M.right, x + slot / 2);
        const hit = svgEl('rect', { class: 'hit', tabindex: 0, role: 'img', x: x0.toFixed(2), width: (x1 - x0).toFixed(2), y: M.top, height: plotH() }, gHits);
        const label = k === 0 ? 'At signing' : `Year ${k}`;
        hit.setAttribute('aria-label', `${label}: ${fmtUSD(lo(V, k))} to ${fmtUSD(hi(V, k))} cumulative`);
        const show = () => {
          const yTop = baseline() - (hi(V, k) / max) * plotH();
          tip.show(`<strong>${label}</strong>${fmtUSD(lo(V, k))} to ${fmtUSD(hi(V, k))}`, x, yTop);
          cursor.setAttribute('x1', x.toFixed(2)); cursor.setAttribute('x2', x.toFixed(2)); cursor.setAttribute('y1', M.top); cursor.setAttribute('y2', baseline()); cursor.setAttribute('opacity', 1);
          $$('.hit', gHits).forEach((h) => h.classList.toggle('is-on', h === hit));
        };
        const hide = () => { tip.hide(); cursor.setAttribute('opacity', 0); hit.classList.remove('is-on'); };
        hit.addEventListener('pointerenter', show); hit.addEventListener('pointerleave', hide);
        hit.addEventListener('click', show);
        hit.addEventListener('focus', show); hit.addEventListener('blur', hide);
        hit.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
      }
    };
    const hideAll = () => { tip.hide(); cursor.setAttribute('opacity', 0); $$('.hit', gHits).forEach((h) => h.classList.remove('is-on')); };
    document.addEventListener('pointerdown', (e) => { if (!wrap.contains(e.target)) hideAll(); });
    const redraw = ({ animate = true } = {}) => {
      const target = { V: grown ? r.V : 0, N: r.N, max: niceScale(r.totHi).max };
      if (cancelAnim) { cancelAnim(); cancelAnim = null; }
      tip.hide(); cursor.setAttribute('opacity', 0);
      clearNode(gHits);
      drawAxes(target.max); drawXLabels(target.N);
      const from = { ...shown };
      const finish = () => { shown = target; draw(target.V, target.N, target.max); buildHits(); cancelAnim = null; };
      if (!animate) { finish(); return; }
      cancelAnim = tween(400, (p) => {
        shown = { V: from.V + (target.V - from.V) * p, N: from.N + (target.N - from.N) * p, max: from.max + (target.max - from.max) * p };
        draw(shown.V, shown.N, shown.max);
      }, finish);
    };
    const resize = () => {
      const w = Math.max(260, Math.round(wrap.getBoundingClientRect().width));
      if (w === W) return;
      W = w;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      redraw({ animate: false });
    };
    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(wrap); else window.addEventListener('resize', resize);

    /* Steppers */
    const update = () => {
      r = compute();
      for (const k in out) out[k].to(r[k], 400);
      redraw();
      announce();
    };
    $$('.stepper', tool).forEach((st) => {
      const key = st.dataset.stepper; const def = DEFS[key];
      const minus = $('[data-dir="-1"]', st), plus = $('[data-dir="1"]', st), val = $('.stepper__val', st);
      const paint = () => {
        val.textContent = def.text(state[key]);
        minus.disabled = state[key] <= def.min;
        plus.disabled = state[key] >= def.max;
      };
      const step = (dir) => {
        const next = clamp(state[key] + dir, def.min, def.max);
        if (next === state[key]) return;
        state[key] = next;
        paint();
        const pressed = dir > 0 ? plus : minus, other = dir > 0 ? minus : plus;
        if (pressed.disabled && document.activeElement === pressed) other.focus();
        update();
      };
      minus.addEventListener('click', () => step(-1));
      plus.addEventListener('click', () => step(1));
      st.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); step(1); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      });
      paint();
    });

    onFirstView(wrap, () => { grown = true; redraw(); }, 0.3);
  })();
})();
