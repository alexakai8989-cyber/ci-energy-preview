/* Direction B: Balance Sheet. Plain JavaScript, no dependencies, no build step.
   Header, reveals, the swing dial, the plan chart, the funding composition and
   the earnings calculator with its band chart. Everything respects reduced motion. */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  var fmtInt = function (n) { return nf0.format(Math.round(n)); };
  var money = function (n) { return '$' + fmtInt(n); };
  var rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var motionOK = function () { return !rmq.matches; };
  var DUR_NUM = 400;
  var DUR_GROW = 700;
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var SVG = 'http://www.w3.org/2000/svg';

  function tween(from, to, dur, step, done) {
    if (!motionOK() || dur <= 0 || from === to) { step(to, 1); if (done) done(); return function () {}; }
    var raf = 0, t0 = performance.now();
    function frame(now) {
      var t = Math.min(1, (now - t0) / dur);
      step(from + (to - from) * easeOut(t), t);
      if (t < 1) raf = requestAnimationFrame(frame); else if (done) done();
    }
    raf = requestAnimationFrame(frame);
    return function () { cancelAnimationFrame(raf); };
  }

  function tweenEl(node, to, fmt, animate) {
    if (node._cancel) node._cancel();
    var from = typeof node._v === 'number' ? node._v : to;
    if (!animate) { node._v = to; node.textContent = fmt(to); return; }
    node._cancel = tween(from, to, DUR_NUM, function (v) { node._v = v; node.textContent = fmt(v); });
  }

  function svgEl(name, attrs, parent) {
    var n = document.createElementNS(SVG, name);
    if (attrs) { for (var k in attrs) { if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]); } }
    if (parent) parent.appendChild(n);
    return n;
  }

  function debounce(fn, ms) {
    var t;
    return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); };
  }

  function onceInView(node, cb, threshold) {
    if (!('IntersectionObserver' in window)) { cb(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); cb(); } });
    }, { threshold: threshold || 0.3 });
    io.observe(node);
  }

  function observeSize(node, cb) {
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(debounce(cb, 60));
      ro.observe(node);
    } else {
      window.addEventListener('resize', debounce(cb, 120));
    }
  }

  /* ---------- Header: compact after 200px ---------- */
  (function header() {
    var site = $('.site');
    if (!site) return;
    var ticking = false;
    function update() { site.classList.toggle('is-compact', window.scrollY > 200); ticking = false; }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  })();

  /* ---------- Reveals: opacity plus a 12px rise, once ---------- */
  (function reveals() {
    var targets = $$('.hero__text, .doors > li, .section .wrap > :not(.tiles):not(.steps), .tiles > li, .steps > li');
    if (!targets.length) return;
    var groups = {};
    targets.forEach(function (t) {
      t.classList.add('reveal');
      var p = t.parentNode;
      if (p && p.matches && p.matches('.tiles, .steps, .doors')) {
        var i = Array.prototype.indexOf.call(p.children, t);
        if (i > 0) t.style.transitionDelay = Math.min(i, 5) * 70 + 'ms';
      }
    });
    if (!('IntersectionObserver' in window)) { targets.forEach(function (t) { t.classList.add('is-in'); }); return; }
    var pending = targets.slice();
    function reveal(t) { t.classList.add('is-in'); io.unobserve(t); var i = pending.indexOf(t); if (i > -1) pending.splice(i, 1); }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) reveal(e.target); });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function (t) { io.observe(t); });
    /* A jump past a block (anchor link, End key) must not leave it hidden above the viewport */
    var ticking = false;
    function sweep() {
      ticking = false;
      pending.slice().forEach(function (t) { if (t.getBoundingClientRect().bottom < 0) reveal(t); });
    }
    window.addEventListener('scroll', function () { if (pending.length && !ticking) { ticking = true; requestAnimationFrame(sweep); } }, { passive: true });
  })();

  /* ---------- Segmented control: radiogroup with a sliding thumb ---------- */
  function initSeg(seg, onChange) {
    if (!seg) return null;
    var btns = $$('[role="radio"]', seg), thumb = $('.seg__thumb', seg);
    function activeIndex() {
      for (var i = 0; i < btns.length; i++) { if (btns[i].getAttribute('aria-checked') === 'true') return i; }
      return 0;
    }
    function place() {
      var b = btns[activeIndex()];
      if (!b || !thumb) return;
      thumb.style.width = b.offsetWidth + 'px';
      thumb.style.height = b.offsetHeight + 'px';
      thumb.style.transform = 'translate(' + b.offsetLeft + 'px, ' + b.offsetTop + 'px)';
    }
    function select(i, focus) {
      btns.forEach(function (b, j) {
        var on = i === j;
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
      place();
      if (focus) btns[i].focus();
      if (onChange) onChange(btns[i].getAttribute('data-value'));
    }
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { if (activeIndex() !== i) select(i, false); });
      b.addEventListener('keydown', function (e) {
        var n = null, L = btns.length;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % L;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + L) % L;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = L - 1;
        if (n !== null) { e.preventDefault(); if (n !== i) select(n, true); else btns[n].focus(); }
      });
    });
    if (thumb) {
      thumb.style.transition = 'none';
      place();
      requestAnimationFrame(function () { requestAnimationFrame(function () { thumb.style.transition = ''; }); });
    }
    window.addEventListener('resize', debounce(place, 60));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    return { value: function () { return btns[activeIndex()].getAttribute('data-value'); }, place: place };
  }

  /* ---------- Tooltips: hover, focus, and pin on click or tap ---------- */
  function makeTip(chart) {
    var tip = $('.tooltip', chart);
    var pinned = false, cur = null;
    function position(x, y) {
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
      var r = tip.getBoundingClientRect(), c = chart.getBoundingClientRect(), dx = 0;
      if (r.left < c.left) dx = c.left - r.left; else if (r.right > c.right) dx = c.right - r.right;
      if (dx) tip.style.left = (x + dx) + 'px';
    }
    function show(content) {
      tip.innerHTML = content.html;
      tip.classList.add('is-on');
      position(content.x, content.y);
    }
    function hide(force) {
      if (pinned && !force) return;
      if (force) pinned = false;
      tip.classList.remove('is-on');
      cur = null;
    }
    function bind(target, getContent) {
      target.addEventListener('pointerenter', function () { if (!pinned) { cur = target; show(getContent()); } });
      target.addEventListener('pointerleave', function () { if (!pinned) hide(false); });
      target.addEventListener('focus', function () { pinned = false; cur = target; show(getContent()); });
      target.addEventListener('blur', function () { if (!pinned) hide(false); });
      target.addEventListener('click', function () {
        if (pinned && cur === target) { hide(true); } else { pinned = true; cur = target; show(getContent()); }
      });
      target.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(true); });
    }
    document.addEventListener('pointerdown', function (e) { if (!chart.contains(e.target)) hide(true); });
    return { bind: bind, hide: function () { hide(true); } };
  }

  /* ---------- Tool 1: swing dial ---------- */
  (function dial() {
    var root = $('#dial');
    if (!root) return;
    var svg = $('.dial__svg', root), track = $('.dial__track', root), fill = $('.dial__fill', root);
    var ticks = $('.dial__ticks', root), knob = $('.dial__knob', root);
    var mwEl = $('[data-mw]', root), resEl = $('[data-result]', root), mwhEl = $('[data-mwh]'), live = $('#dial-live');
    var CX = 210, CY = 210, R = 170, START = 135, SWEEP = 270, MIN = 1, MAX = 500, LOG = Math.log10(MAX);
    var toRad = function (d) { return d * Math.PI / 180; };
    var pt = function (deg, r) { return [CX + r * Math.cos(toRad(deg)), CY + r * Math.sin(toRad(deg))]; };
    function arc(a, b) {
      if (b - a < 0.01) return '';
      var p1 = pt(a, R), p2 = pt(b, R);
      return 'M' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) + ' A' + R + ' ' + R + ' 0 ' + (b - a > 180 ? 1 : 0) + ' 1 ' + p2[0].toFixed(2) + ' ' + p2[1].toFixed(2);
    }
    var posOf = function (m) { return Math.log10(m) / LOG; };
    var angOf = function (m) { return START + SWEEP * posOf(m); };
    var MWH = function (m) { return m * 8760 * 0.9; };

    track.setAttribute('d', arc(START, START + SWEEP));
    var labels = document.createElement('div');
    labels.className = 'dial__labels';
    labels.setAttribute('aria-hidden', 'true');
    [5, 10, 20, 50, 100, 500].forEach(function (v) {
      var a = angOf(v), p1 = pt(a, R + 8), p2 = pt(a, R + 18), p3 = pt(a, R + 36);
      svgEl('line', { x1: p1[0].toFixed(2), y1: p1[1].toFixed(2), x2: p2[0].toFixed(2), y2: p2[1].toFixed(2) }, ticks);
      var span = document.createElement('span');
      span.textContent = String(v);
      span.style.left = (p3[0] / 420 * 100).toFixed(2) + '%';
      span.style.top = (p3[1] / 420 * 100).toFixed(2) + '%';
      labels.appendChild(span);
    });
    svg.parentNode.insertBefore(labels, svg.nextSibling);

    var mw = 10, swing = 10, dragging = false, cancelGrow = null;
    var result = function () { return MWH(mw) * swing; };
    function sizeFor(str) { return str.length > 10 ? 's' : str.length > 8 ? 'm' : 'l'; }
    function drawArc(m) {
      var a = angOf(m), k = pt(a, R);
      fill.setAttribute('d', arc(START, a));
      knob.setAttribute('transform', 'translate(' + k[0].toFixed(2) + ' ' + k[1].toFixed(2) + ') rotate(' + a.toFixed(2) + ') translate(-9 -9)');
    }
    function render(animate) {
      if (cancelGrow) { cancelGrow(); cancelGrow = null; }
      drawArc(mw);
      tweenEl(mwEl, mw, fmtInt, animate);
      tweenEl(resEl, result(), money, animate);
      tweenEl(mwhEl, MWH(mw), fmtInt, animate);
      resEl.setAttribute('data-size', sizeFor(money(result())));
      root.setAttribute('aria-valuenow', String(mw));
      root.setAttribute('aria-valuetext', mw + ' MW: ' + money(result()) + ' a year, up or down');
    }
    var announce = debounce(function () {
      live.textContent = money(result()) + ' a year, up or down, for ' + mw + ' MW at $' + swing + ' per MWh. That load uses about ' + fmtInt(MWH(mw)) + ' MWh a year.';
    }, 600);

    function angleFromEvent(e) {
      var r = svg.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var a = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
      if (a < 0) a += 360;
      if (a >= START) return a;
      if (a <= START + SWEEP - 360) return a + 360;
      return a < 90 ? START + SWEEP : START;
    }
    function setFromAngle(a) {
      var p = Math.min(1, Math.max(0, (a - START) / SWEEP));
      var m = Math.min(MAX, Math.max(MIN, Math.round(Math.pow(10, LOG * p))));
      if (m !== mw) { mw = m; render(false); }
    }
    root.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      root.classList.add('is-dragging');
      try { root.setPointerCapture(e.pointerId); } catch (_) {}
      root.focus({ preventScroll: true });
      setFromAngle(angleFromEvent(e));
      e.preventDefault();
    });
    root.addEventListener('pointermove', function (e) { if (dragging) setFromAngle(angleFromEvent(e)); });
    function end(e) {
      if (!dragging) return;
      dragging = false;
      root.classList.remove('is-dragging');
      try { root.releasePointerCapture(e.pointerId); } catch (_) {}
      announce();
    }
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);

    function stepUp(m) { var s = m < 20 ? 1 : m < 100 ? 5 : 10; return Math.min(MAX, Math.floor(m / s) * s + s); }
    function stepDown(m) { var s = m <= 20 ? 1 : m <= 100 ? 5 : 10; return Math.max(MIN, Math.ceil(m / s) * s - s); }
    root.addEventListener('keydown', function (e) {
      var m = mw;
      switch (e.key) {
        case 'ArrowRight': case 'ArrowUp': m = stepUp(mw); break;
        case 'ArrowLeft': case 'ArrowDown': m = stepDown(mw); break;
        case 'PageUp': m = Math.min(MAX, Math.round(mw * 2)); break;
        case 'PageDown': m = Math.max(MIN, Math.round(mw / 2)); break;
        case 'Home': m = MIN; break;
        case 'End': m = MAX; break;
        default: return;
      }
      e.preventDefault();
      if (m !== mw) { mw = m; render(true); }
    });

    initSeg($('[data-seg="swing"]'), function (v) { swing = Number(v); render(true); announce(); });

    mwEl._v = mw; resEl._v = result(); mwhEl._v = MWH(mw);
    render(false);
    onceInView(root, function () {
      if (!motionOK()) return;
      var target = mw;
      cancelGrow = tween(0, 1, DUR_GROW, function (t) {
        var m = Math.pow(10, LOG * posOf(target) * t);
        drawArc(m);
        mwEl.textContent = fmtInt(m);
        resEl.textContent = money(MWH(m) * swing);
        mwhEl.textContent = fmtInt(MWH(m));
      }, function () { cancelGrow = null; if (mw === target) render(false); });
    }, 0.4);
  })();

  /* ---------- Tool 2: the plan, year by year ---------- */
  (function plan() {
    var chart = $('#plan-chart');
    if (!chart) return;
    var svg = $('.chart__svg', chart), note = $('#plan-note'), legend = $('#plan-legend');
    var tip = makeTip(chart);
    var YEARS = ['Year 1', 'Year 2', 'Year 3'];
    var mFmt = function (v) { return '$' + (Math.round(v * 100) % 10 === 0 ? v.toFixed(1) : v.toFixed(2)) + 'M'; };
    var MEASURES = {
      margin: {
        series: [{ name: 'Gross margin', vals: [1.6, 5.4, 13.5], kind: 'fill' }, { name: 'EBITDA', vals: [0.55, 3.5, 10.1], kind: 'hollow' }],
        max: 15, ticks: [0, 5, 10, 15], fmt: mFmt, tick: function (v) { return v === 0 ? '$0' : '$' + v + 'M'; },
        note: 'Gross margin 8.4× from Year 1 to Year 3', left: 52
      },
      contracts: {
        series: [{ name: 'Contracts', vals: [8, 22, 45], kind: 'fill' }],
        max: 50, ticks: [0, 10, 20, 30, 40, 50], fmt: fmtInt, tick: function (v) { return String(v); },
        note: '5.6× the contracts by Year 3', left: 40
      },
      volume: {
        series: [{ name: 'Volume', vals: [320, 990, 2250], kind: 'fill' }],
        max: 2500, ticks: [0, 500, 1000, 1500, 2000, 2500], fmt: function (v) { return fmtInt(v) + ' GWh'; },
        tick: function (v) { return v === 0 ? '0' : fmtInt(v) + ' GWh'; },
        note: '7× the volume by Year 3', left: 82
      }
    };
    var M = { top: 20, right: 16, bottom: 36 };
    var gGrid = svgEl('g', { 'class': 'grid' }, svg);
    var gBars = svgEl('g', { 'class': 'bars' }, svg);
    var gY = svgEl('g', { 'class': 'ylabels' }, svg);
    var gX = svgEl('g', { 'class': 'xlabels' }, svg);
    var gHits = svgEl('g', { 'class': 'hits' }, svg);
    var rects = [], hits = [], i;
    for (i = 0; i < 6; i++) rects.push(svgEl('rect', { 'class': i % 2 ? 'bar bar--hollow' : 'bar bar--fill', x: 0, y: 0, width: 0, height: 0 }, gBars));
    for (i = 0; i < 3; i++) hits.push(svgEl('rect', { 'class': 'hit', tabindex: 0, role: 'img', x: 0, y: 0, width: 0, height: 0 }, gHits));
    var cur = 'margin', W = 0, H = 0, grown = !motionOK(), cancel = null, L = null;
    var state = rects.map(function () { return { x: 0, y: 0, w: 0, h: 0, o: 1 }; });

    function layout(measure) {
      var m = MEASURES[measure], left = m.left, plotW = W - left - M.right, plotH = H - M.top - M.bottom;
      var gw = plotW / 3, n = m.series.length;
      var bw = n === 2 ? Math.min(56, gw * 0.3) : Math.min(80, gw * 0.42), gap = n === 2 ? 10 : 0;
      var targets = [];
      for (var yi = 0; yi < 3; yi++) {
        var cx = left + gw * yi + gw / 2;
        for (var si = 0; si < 2; si++) {
          var s = m.series[si];
          if (s) {
            var total = n * bw + (n - 1) * gap, x = cx - total / 2 + si * (bw + gap), h = plotH * s.vals[yi] / m.max;
            targets.push({ x: x, y: M.top + plotH - h, w: bw, h: h, o: 1 });
          } else {
            targets.push({ x: cx - bw / 2, y: M.top + plotH, w: bw, h: 0, o: 0 });
          }
        }
      }
      return { m: m, left: left, plotW: plotW, plotH: plotH, gw: gw, targets: targets };
    }
    function labelFor(m, yi) {
      return YEARS[yi] + ': ' + m.series.map(function (s) { return s.name + ' ' + m.fmt(s.vals[yi]); }).join(', ');
    }
    function drawAxes(Lx) {
      gGrid.innerHTML = ''; gY.innerHTML = ''; gX.innerHTML = '';
      Lx.m.ticks.forEach(function (t) {
        var y = (M.top + Lx.plotH - Lx.plotH * t / Lx.m.max).toFixed(1);
        svgEl('line', { x1: Lx.left, x2: W - M.right, y1: y, y2: y, 'class': t === 0 ? 'baseline' : '' }, gGrid);
        var txt = svgEl('text', { x: Lx.left - 10, y: y, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, gY);
        txt.textContent = Lx.m.tick(t);
      });
      YEARS.forEach(function (lab, yi) {
        var t = svgEl('text', { x: (Lx.left + Lx.gw * yi + Lx.gw / 2).toFixed(1), y: H - 10, 'text-anchor': 'middle' }, gX);
        t.textContent = lab;
      });
      hits.forEach(function (h, yi) {
        h.setAttribute('x', (Lx.left + Lx.gw * yi).toFixed(1));
        h.setAttribute('y', M.top);
        h.setAttribute('width', Lx.gw.toFixed(1));
        h.setAttribute('height', Lx.plotH.toFixed(1));
        h.setAttribute('aria-label', labelFor(Lx.m, yi));
      });
    }
    function applyState() {
      state.forEach(function (s, k) {
        var r = rects[k];
        r.setAttribute('x', s.x.toFixed(1)); r.setAttribute('y', s.y.toFixed(1));
        r.setAttribute('width', s.w.toFixed(1)); r.setAttribute('height', Math.max(0, s.h).toFixed(1));
        r.setAttribute('opacity', s.o.toFixed(2));
      });
    }
    function animateTo(targets, dur) {
      if (cancel) cancel();
      var from = state.map(function (s) { return { x: s.x, y: s.y, w: s.w, h: s.h, o: s.o }; });
      cancel = tween(0, 1, dur, function (t) {
        state = from.map(function (f, k) {
          var g = targets[k];
          return { x: f.x + (g.x - f.x) * t, y: f.y + (g.y - f.y) * t, w: f.w + (g.w - f.w) * t, h: f.h + (g.h - f.h) * t, o: f.o + (g.o - f.o) * t };
        });
        applyState();
      });
    }
    function tipFor(yi) {
      return function () {
        var m = L.m, top = Infinity;
        for (var si = 0; si < m.series.length; si++) top = Math.min(top, state[yi * 2 + si].y);
        return {
          html: '<strong>' + YEARS[yi] + '</strong>' + m.series.map(function (s) { return s.name + ' ' + m.fmt(s.vals[yi]); }).join('<br>'),
          x: L.left + L.gw * yi + L.gw / 2, y: top
        };
      };
    }
    hits.forEach(function (h, yi) { tip.bind(h, tipFor(yi)); });

    function resize() {
      W = chart.clientWidth; H = svg.getBoundingClientRect().height || 320;
      if (W < 10) return;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      L = layout(cur); drawAxes(L);
      state = L.targets.map(function (t) { return grown ? { x: t.x, y: t.y, w: t.w, h: t.h, o: t.o } : { x: t.x, y: M.top + L.plotH, w: t.w, h: 0, o: t.o }; });
      applyState();
      tip.hide();
    }
    function setMeasure(v) {
      cur = v; L = layout(cur); drawAxes(L);
      if (grown) animateTo(L.targets, DUR_NUM);
      note.textContent = L.m.note;
      legend.innerHTML = L.m.series.map(function (s) { return '<li><span class="swatch swatch--' + s.kind + '" aria-hidden="true"></span>' + s.name + '</li>'; }).join('');
      tip.hide();
    }
    initSeg($('[data-seg="plan"]'), setMeasure);
    resize();
    observeSize(chart, resize);
    if (!grown) onceInView(chart, function () { grown = true; L = layout(cur); animateTo(L.targets, DUR_GROW); }, 0.3);
  })();

  /* ---------- Tool 3: funding composition ---------- */
  (function funding() {
    var root = $('.funding');
    if (!root) return;
    var segs = $$('.stack__seg', root), rows = $$('.range', root), cap = $('#funding-caption');
    var DATA = [
      { name: 'Working capital', when: 'Months 1 to 12', lo: 300, hi: 500 },
      { name: 'Wholesale collateral and credit reserve', when: 'Months 1 to 6', lo: 200, hi: 400 },
      { name: 'Business development and sales', when: 'Months 3 to 12', lo: 150, hi: 300 },
      { name: 'Regulatory and licensing', when: 'Months 1 to 6', lo: 100, hi: 200 },
      { name: 'Contingency reserve', when: 'Ongoing', lo: 100, hi: 200 },
      { name: 'Legal: contracts, structure, consultant agreements', when: 'Months 1 to 3', lo: 80, hi: 150 },
      { name: 'Technology and systems', when: 'Months 1 to 3', lo: 30, hi: 60 }
    ];
    var total = DATA.reduce(function (a, d) { return a + (d.lo + d.hi) / 2; }, 0);
    var idle = cap.textContent, active = -1, pinned = false;
    function text(i) {
      var d = DATA[i], mid = (d.lo + d.hi) / 2;
      return d.name + ' (' + d.when + '): $' + d.lo + 'K to $' + d.hi + 'K, midpoint $' + mid + 'K, ' + Math.round(mid / total * 100) + '% of the total.';
    }
    function set(i) {
      active = i;
      segs.forEach(function (s, j) { s.classList.toggle('is-active', j === i); s.setAttribute('aria-pressed', pinned && j === i ? 'true' : 'false'); });
      rows.forEach(function (r, j) { r.classList.toggle('is-active', j === i); });
      cap.textContent = i < 0 ? idle : text(i);
    }
    function hover(i) { if (!pinned) set(i); }
    function leave() { if (!pinned) set(-1); }
    function click(i) { if (pinned && active === i) { pinned = false; set(-1); } else { pinned = true; set(i); } }
    segs.forEach(function (s, i) {
      s.setAttribute('aria-pressed', 'false');
      s.addEventListener('pointerenter', function () { hover(i); });
      s.addEventListener('pointerleave', leave);
      s.addEventListener('focus', function () { pinned = false; set(i); });
      s.addEventListener('blur', function () { if (!pinned) set(-1); });
      s.addEventListener('click', function () { click(i); });
    });
    rows.forEach(function (r, i) {
      r.addEventListener('pointerenter', function () { hover(i); });
      r.addEventListener('pointerleave', leave);
      r.addEventListener('click', function () { click(i); });
    });
    document.addEventListener('pointerdown', function (e) { if (pinned && !root.contains(e.target)) { pinned = false; set(-1); } });
  })();

  /* ---------- Tool 4: earnings calculator and band chart ---------- */
  (function calc() {
    var panel = $('.calc');
    if (!panel) return;
    var USES = [10000, 25000, 50000, 75000, 100000, 150000, 250000, 400000, 600000, 800000];
    var st = { contracts: 3, use: 2, term: 3 };
    var LIM = { contracts: [1, 12], use: [0, USES.length - 1], term: [1, 4] };
    var outs = { contracts: $('#st-contracts'), use: $('#st-use'), term: $('#st-term') };
    var fmtOut = {
      contracts: function (v) { return String(v); },
      use: function (i) { return fmtInt(USES[i]) + ' MWh'; },
      term: function (v) { return v + (v === 1 ? ' year' : ' years'); }
    };
    var res = { fee: $('[data-res="fee"]'), trail: $('[data-res="trail"]'), total: $('[data-res="total"]') };
    var live = $('#calc-live');
    var V = function () { return st.contracts * USES[st.use]; };
    function ranges() {
      var v = V(), n = st.term;
      return { fee: [v * 0.5, v * 1], trail: [v * 0.25, v * 0.5], total: [v * (0.5 + 0.25 * n), v * (1 + 0.5 * n)] };
    }
    function fit(node) {
      /* Step the size down until the final text fits its column on one line */
      var sizes = ['l', 'm', 's'];
      for (var i = 0; i < sizes.length; i++) {
        node.setAttribute('data-size', sizes[i]);
        if (node.scrollWidth <= node.clientWidth + 1) break;
      }
    }
    function renderRange(node, lo, hi, animate) {
      if (node._cancel) node._cancel();
      var fl = typeof node._lo === 'number' ? node._lo : lo, fh = typeof node._hi === 'number' ? node._hi : hi;
      var draw = function (a, b) { node.textContent = money(a) + ' to ' + money(b); };
      draw(lo, hi); fit(node);
      if (!animate) { node._lo = lo; node._hi = hi; return; }
      node._cancel = tween(0, 1, DUR_NUM, function (t) {
        node._lo = fl + (lo - fl) * t; node._hi = fh + (hi - fh) * t; draw(node._lo, node._hi);
      });
    }

    /* Band chart */
    var chart = $('#band-chart'), svg = $('.chart__svg', chart), tip = makeTip(chart);
    var M = { top: 16, right: 24, bottom: 36 }, LEFT = 64;
    var gGrid = svgEl('g', { 'class': 'grid' }, svg);
    var bandPath = svgEl('path', { 'class': 'band' }, svg);
    var lowPath = svgEl('path', { 'class': 'line line--low' }, svg);
    var highPath = svgEl('path', { 'class': 'line line--high' }, svg);
    var gPts = svgEl('g', { 'class': 'pts' }, svg);
    var gY = svgEl('g', { 'class': 'ylabels' }, svg);
    var gX = svgEl('g', { 'class': 'xlabels' }, svg);
    var gHits = svgEl('g', { 'class': 'hits' }, svg);
    var W = 0, H = 0, grown = !motionOK(), cancel = null, shown = null;

    function points() {
      var v = V(), n = st.term, pts = [];
      for (var k = 0; k <= n; k++) pts.push({ lo: v * 0.5 + k * v * 0.25, hi: v * 1 + k * v * 0.5 });
      return pts;
    }
    function niceMax(raw) {
      var mag = Math.pow(10, Math.floor(Math.log10(raw)));
      var steps = [1, 2, 2.5, 5, 10];
      for (var i = 0; i < steps.length; i++) {
        var s = steps[i] * mag;
        if (raw / s <= 5) return { max: Math.ceil(raw / s) * s, step: s };
      }
      return { max: Math.ceil(raw / (10 * mag)) * 10 * mag, step: 10 * mag };
    }
    function trim(x) { return String(Math.round(x * 100) / 100); }
    function tickFmt(v) { return v === 0 ? '$0' : v >= 1e6 ? '$' + trim(v / 1e6) + 'M' : '$' + trim(v / 1e3) + 'K'; }
    function leftFor(T) {
      var longest = 0;
      for (var v = 0; v <= T.max + 1e-9; v += T.step) longest = Math.max(longest, tickFmt(v).length);
      return Math.max(44, Math.round(longest * 8.4) + 14);
    }
    var xOf = function (k, n) { return LEFT + (W - LEFT - M.right) * (n === 0 ? 0 : k / n); };
    var yOf = function (v, max) { var ph = H - M.top - M.bottom; return M.top + ph - ph * v / max; };
    var xLabel = function (k) { return k === 0 ? 'Signing' : 'Year ' + k; };

    function draw(pts, scaleMax, T) {
      var n = pts.length - 1;
      gGrid.innerHTML = ''; gY.innerHTML = ''; gX.innerHTML = ''; gPts.innerHTML = '';
      for (var v = 0; v <= T.max + 1e-9; v += T.step) {
        var y = yOf(v, scaleMax);
        if (y < M.top - 1) continue;
        var ys = y.toFixed(1);
        svgEl('line', { x1: LEFT, x2: W - M.right, y1: ys, y2: ys, 'class': v === 0 ? 'baseline' : '' }, gGrid);
        var t = svgEl('text', { x: LEFT - 10, y: ys, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, gY);
        t.textContent = tickFmt(v);
      }
      pts.forEach(function (p, k) {
        var tx = svgEl('text', { x: xOf(k, n).toFixed(1), y: H - 10, 'text-anchor': k === 0 ? 'start' : k === n ? 'end' : 'middle' }, gX);
        tx.textContent = xLabel(k);
      });
      var lo = pts.map(function (p, k) { return [xOf(k, n), yOf(p.lo, scaleMax)]; });
      var hi = pts.map(function (p, k) { return [xOf(k, n), yOf(p.hi, scaleMax)]; });
      var line = function (arr) { return arr.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(''); };
      var back = lo.slice().reverse().map(function (p) { return 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
      lowPath.setAttribute('d', line(lo));
      highPath.setAttribute('d', line(hi));
      bandPath.setAttribute('d', line(hi) + back + 'Z');
      lo.forEach(function (p) { svgEl('rect', { 'class': 'pt pt--low', x: (p[0] - 3).toFixed(1), y: (p[1] - 3).toFixed(1), width: 6, height: 6 }, gPts); });
      hi.forEach(function (p) { svgEl('rect', { 'class': 'pt pt--high', x: (p[0] - 3).toFixed(1), y: (p[1] - 3).toFixed(1), width: 6, height: 6 }, gPts); });
    }
    function drawHits(T) {
      gHits.innerHTML = '';
      var n = T.pts.length - 1, pw = (W - LEFT - M.right) / Math.max(1, n);
      T.pts.forEach(function (p, k) {
        var cx = xOf(k, n), x = k === 0 ? LEFT : cx - pw / 2, w = (k === 0 || k === n) ? pw / 2 : pw;
        var h = svgEl('rect', {
          'class': 'hit', tabindex: 0, role: 'img',
          'aria-label': xLabel(k) + ': ' + money(p.lo) + ' to ' + money(p.hi) + ' cumulative',
          x: x.toFixed(1), y: M.top, width: w.toFixed(1), height: (H - M.top - M.bottom).toFixed(1)
        }, gHits);
        tip.bind(h, function () {
          return { html: '<strong>' + (k === 0 ? 'At signing' : 'By Year ' + k) + '</strong>' + money(p.lo) + ' to ' + money(p.hi), x: cx, y: yOf(p.hi, T.max) };
        });
      });
    }
    function target() {
      var pts = points(), nm = niceMax(pts[pts.length - 1].hi);
      return { pts: pts, max: nm.max, step: nm.step };
    }
    function update(animate, dur) {
      var T = target();
      LEFT = leftFor(T);
      if (cancel) cancel();
      tip.hide();
      if (!shown || !animate || !motionOK()) { shown = T; draw(T.pts, T.max, T); drawHits(T); return; }
      var from = shown;
      cancel = tween(0, 1, dur || DUR_NUM, function (t) {
        var cur = T.pts.map(function (p, k) {
          var f = from.pts[Math.min(k, from.pts.length - 1)];
          return { lo: f.lo + (p.lo - f.lo) * t, hi: f.hi + (p.hi - f.hi) * t };
        });
        draw(cur, from.max + (T.max - from.max) * t, T);
      }, function () { shown = T; draw(T.pts, T.max, T); drawHits(T); });
    }
    function resize() {
      W = chart.clientWidth; H = svg.getBoundingClientRect().height || 300;
      if (W < 10) return;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      if (!grown) {
        var T = target(); LEFT = leftFor(T);
        shown = { pts: T.pts.map(function () { return { lo: 0, hi: 0 }; }), max: T.max, step: T.step };
        draw(shown.pts, shown.max, T); drawHits(T);
      } else {
        update(false);
      }
    }

    /* Steppers */
    var btns = $$('.stepper__btn', panel);
    function updateButtons() {
      btns.forEach(function (b) {
        var k = b.getAttribute('data-stepper'), d = Number(b.getAttribute('data-dir')), v = st[k];
        b.disabled = d < 0 ? v <= LIM[k][0] : v >= LIM[k][1];
      });
    }
    var announce = debounce(function () {
      var r = ranges();
      live.textContent = 'Referral fee ' + money(r.fee[0]) + ' to ' + money(r.fee[1]) + '. Trailing commission ' + money(r.trail[0]) + ' to ' + money(r.trail[1]) + ' a year. Total over the term ' + money(r.total[0]) + ' to ' + money(r.total[1]) + '.';
    }, 600);
    function render(animate) {
      var r = ranges();
      renderRange(res.fee, r.fee[0], r.fee[1], animate);
      renderRange(res.trail, r.trail[0], r.trail[1], animate);
      renderRange(res.total, r.total[0], r.total[1], animate);
      if (grown) update(animate);
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-stepper'), d = Number(b.getAttribute('data-dir'));
        var nv = Math.min(LIM[k][1], Math.max(LIM[k][0], st[k] + d));
        if (nv === st[k]) return;
        st[k] = nv;
        outs[k].textContent = fmtOut[k](nv);
        updateButtons();
        if (b.disabled) { var sib = b.parentNode.querySelector('.stepper__btn:not(:disabled)'); if (sib) sib.focus(); }
        render(true);
        announce();
      });
    });

    updateButtons();
    render(false);
    resize();
    observeSize(chart, resize);
    if (!grown) onceInView(chart, function () { grown = true; update(true, DUR_GROW); }, 0.3);
    window.addEventListener('resize', debounce(function () { [res.fee, res.trail, res.total].forEach(fit); }, 60));
  })();
})();
