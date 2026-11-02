/* Direction C: The Ledger. Plain JavaScript, no framework.
   Four instruments: swing dial, plan chart, funding ledger, earnings calculator. */
(function () {
  'use strict';

  var d = document;
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var dur = function (ms) { return reduced.matches ? 0 : ms; };
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
  var fmtInt = function (n) { return Math.round(n).toLocaleString('en-US'); };
  var fmtUSD = function (n) { return '$' + fmtInt(n); };
  var SVG = 'http://www.w3.org/2000/svg';
  var svgEl = function (tag, attrs, parent) {
    var el = d.createElementNS(SVG, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  };
  var lerp = function (a, b, p) { return a + (b - a) * p; };

  /* Generic tween with cancel. onFrame receives eased progress 0..1. */
  function tween(ms, onFrame, onDone) {
    if (ms <= 0) { onFrame(1); if (onDone) onDone(); return function () {}; }
    var raf, start;
    function step(now) {
      if (start === undefined) start = now;
      var p = Math.min(1, (now - start) / ms);
      onFrame(ease(p));
      if (p < 1) raf = requestAnimationFrame(step); else if (onDone) onDone();
    }
    raf = requestAnimationFrame(step);
    return function () { cancelAnimationFrame(raf); };
  }

  /* Tween the number shown in an element over 400ms (0ms under reduced motion). */
  function tweenNumber(el, to, fmt) {
    var from = el._val === undefined ? to : el._val;
    if (el._cancel) el._cancel();
    el._cancel = tween(dur(400), function (p) {
      var v = lerp(from, to, p);
      el._val = v;
      el.textContent = fmt(v);
    }, function () { el._val = to; el.textContent = fmt(to); });
  }

  /* Debounced polite announcer */
  function announcer(el, delay) {
    var t;
    return function (msg) {
      if (!el) return;
      clearTimeout(t);
      t = setTimeout(function () { el.textContent = ''; el.textContent = msg; }, delay || 600);
    };
  }

  /* Header compacts after about 200px */
  var head = $('.site-head');
  function onScroll() { if (head) head.classList.toggle('is-compact', window.scrollY > 200); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Reveals: opacity plus a 12px rise, once */
  var reveals = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduced.matches) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.02 });
    reveals.forEach(function (el) { revealIO.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* Underlined-value selector: role=radiogroup with roving tabindex and a sliding indicator */
  function selector(root, onChange) {
    if (!root) return null;
    var opts = $$('[role="radio"]', root);
    var ind = $('.selector__indicator', root);
    var current = 0;
    opts.forEach(function (o, i) { if (o.getAttribute('aria-checked') === 'true') current = i; });

    function place(animate) {
      var o = opts[current];
      if (!o || !ind) return;
      var rr = root.getBoundingClientRect(), r = o.getBoundingClientRect();
      if (!animate) ind.style.transitionDuration = '0ms';
      ind.style.width = r.width + 'px';
      ind.style.transform = 'translateX(' + (r.left - rr.left) + 'px)';
      if (!animate) { void ind.offsetWidth; ind.style.transitionDuration = ''; }
    }
    function select(i, focus) {
      i = (i + opts.length) % opts.length;
      var changed = i !== current;
      current = i;
      opts.forEach(function (o, k) {
        o.setAttribute('aria-checked', k === i ? 'true' : 'false');
        o.tabIndex = k === i ? 0 : -1;
      });
      if (focus) opts[i].focus();
      place(true);
      if (changed) onChange(opts[i]);
    }
    opts.forEach(function (o, i) {
      o.addEventListener('click', function () { select(i, false); });
      o.addEventListener('keydown', function (e) {
        var k = e.key;
        if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); select(i + 1, true); }
        else if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); select(i - 1, true); }
        else if (k === 'Home') { e.preventDefault(); select(0, true); }
        else if (k === 'End') { e.preventDefault(); select(opts.length - 1, true); }
        else if (k === ' ' || k === 'Enter') { e.preventDefault(); select(i, false); }
      });
    });
    place(false);
    window.addEventListener('resize', function () { place(false); });
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { place(false); });
    return { place: place };
  }

  /* Shared tooltip behaviour for SVG hit areas: hover, focus, click to pin, Escape or tap outside to dismiss */
  function tooltips(chart, tip) {
    var pinned = null;
    function show(hit) {
      if (!hit) return;
      tip.innerHTML = hit._tipHTML;
      tip.hidden = false;
      var w = chart.clientWidth, tw = tip.offsetWidth;
      var x = Math.max(tw / 2 + 2, Math.min(w - tw / 2 - 2, hit._tipX));
      tip.style.left = x + 'px';
      tip.style.top = Math.max(tip.offsetHeight + 2, hit._tipY) + 'px';
      if (chart._onShow) chart._onShow(hit);
    }
    function hide() {
      tip.hidden = true;
      if (chart._onHide) chart._onHide();
    }
    chart.addEventListener('pointerover', function (e) {
      var hit = e.target.closest ? e.target.closest('.hit') : null;
      if (hit && !pinned) show(hit);
    });
    chart.addEventListener('pointerout', function (e) {
      var hit = e.target.closest ? e.target.closest('.hit') : null;
      if (hit && !pinned) hide();
    });
    chart.addEventListener('focusin', function (e) {
      var hit = e.target.closest ? e.target.closest('.hit') : null;
      if (hit) { pinned = null; show(hit); }
    });
    chart.addEventListener('focusout', function (e) {
      if (!pinned) hide();
    });
    chart.addEventListener('click', function (e) {
      var hit = e.target.closest ? e.target.closest('.hit') : null;
      if (!hit) return;
      if (pinned === hit) { pinned = null; hide(); } else { pinned = hit; show(hit); }
    });
    chart.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { pinned = null; hide(); }
    });
    d.addEventListener('pointerdown', function (e) {
      if (pinned && !chart.contains(e.target)) { pinned = null; hide(); }
    });
    return { show: show, hide: hide, refresh: function () { if (pinned) show(pinned); }, reset: function () { pinned = null; hide(); } };
  }

  /* Grow-in once when an instrument enters view */
  var growIO = null;
  function onEnter(el, fn) {
    if (!('IntersectionObserver' in window) || reduced.matches) { fn(); return; }
    if (!growIO) {
      growIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && e.target._grow) { var f = e.target._grow; e.target._grow = null; growIO.unobserve(e.target); f(); }
        });
      }, { threshold: 0.25 });
    }
    el._grow = fn;
    growIO.observe(el);
  }

  /* ------------------------------------------------------------------ */
  /* Tool 1: swing dial                                                   */
  /* ------------------------------------------------------------------ */
  var GRID = (function () {
    var g = [];
    function push(from, to, step) { for (var v = from; v <= to + 1e-9; v += step) g.push(Math.round(v * 100) / 100); }
    push(1, 4.5, 0.5); push(5, 9, 1); push(10, 19, 1); push(20, 48, 2); push(50, 95, 5); push(100, 190, 10); push(200, 500, 20);
    return g;
  })();

  var dial = $('#dial');
  if (dial) {
    var LN500 = Math.log(500);
    var tOf = function (mw) { return Math.log(mw) / LN500; };
    var CX = 210, CY = 212, R = 160, A0 = 135, SPAN = 270;
    var pt = function (t, r) {
      r = r === undefined ? R : r;
      var a = (A0 + SPAN * t) * Math.PI / 180;
      return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
    };
    var arcPath = function (t0, t1) {
      var p0 = pt(t0), p1 = pt(t1);
      var large = SPAN * (t1 - t0) > 180 ? 1 : 0;
      return 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
    };
    var svg = $('#dial-svg');
    svg.setAttribute('viewBox', '0 0 420 384');
    $('#dial-track').setAttribute('d', arcPath(0, 1));
    var ticks = $('#dial-ticks');
    [5, 10, 20, 50, 100, 500].forEach(function (mw) {
      var t = tOf(mw), a = pt(t, R + 8), b = pt(t, R + 16), c = pt(t, R + 34);
      svgEl('line', { x1: a[0].toFixed(1), y1: a[1].toFixed(1), x2: b[0].toFixed(1), y2: b[1].toFixed(1) }, ticks);
      var tx = svgEl('text', { x: c[0].toFixed(1), y: (c[1] + 5).toFixed(1) }, ticks);
      tx.textContent = String(mw);
    });

    var idx = GRID.indexOf(10), swing = 10;
    var mwEl = $('#dial-mw'), resEl = $('#dial-result'), mwhEl = $('#dial-mwh'), mirror = $('#dial-mirror');
    var dialLive = announcer($('#dial-live'));
    var arcEl = $('#dial-arc'), knob = $('#dial-knob');
    var fmtMW = function (v) {
      var s = v < 10 ? String(Math.round(v * 2) / 2) : fmtInt(v);
      return s + ' MW';
    };
    function calc() {
      var mw = GRID[idx], mwh = mw * 8760 * 0.9;
      return { mw: mw, mwh: mwh, result: mwh * swing };
    }
    function render(announce) {
      var v = calc(), t = tOf(v.mw), k = pt(t);
      arcEl.setAttribute('d', arcPath(0, t));
      knob.setAttribute('cx', k[0].toFixed(2));
      knob.setAttribute('cy', k[1].toFixed(2));
      resEl.setAttribute('data-len', String(fmtUSD(v.result).length));
      tweenNumber(mwEl, v.mw, fmtMW);
      tweenNumber(resEl, v.result, fmtUSD);
      tweenNumber(mwhEl, v.mwh, fmtInt);
      var text = fmtMW(v.mw) + ': ' + fmtUSD(v.result) + ' a year, up or down, at a $' + swing + ' per MWh swing';
      dial.setAttribute('aria-valuenow', String(v.mw));
      dial.setAttribute('aria-valuetext', text);
      mirror.textContent = fmtMW(v.mw) + '. ' + fmtUSD(v.result) + ' a year, up or down. About ' + fmtInt(v.mwh) + ' MWh a year.';
      if (announce) dialLive(text + '. About ' + fmtInt(v.mwh) + ' MWh a year.');
    }
    function tFromEvent(e) {
      var r = svg.getBoundingClientRect(), s = 420 / r.width;
      var x = (e.clientX - r.left) * s - CX, y = (e.clientY - r.top) * s - CY;
      var a = Math.atan2(y, x) * 180 / Math.PI;
      if (a < 0) a += 360;
      var rel = a - A0;
      if (rel < 0) rel += 360;
      if (rel > SPAN) rel = (rel - SPAN) > (360 - SPAN) / 2 ? 0 : SPAN;
      return rel / SPAN;
    }
    function setFromT(t) {
      var best = 0, bd = Infinity;
      for (var i = 0; i < GRID.length; i++) { var dd = Math.abs(tOf(GRID[i]) - t); if (dd < bd) { bd = dd; best = i; } }
      if (best !== idx) { idx = best; render(true); }
    }
    var dragging = false;
    dial.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      try { dial.setPointerCapture(e.pointerId); } catch (err) { /* older engines */ }
      dial.focus({ preventScroll: true });
      setFromT(tFromEvent(e));
      e.preventDefault();
    });
    dial.addEventListener('pointermove', function (e) { if (dragging) setFromT(tFromEvent(e)); });
    var endDrag = function () { dragging = false; };
    dial.addEventListener('pointerup', endDrag);
    dial.addEventListener('pointercancel', endDrag);
    dial.addEventListener('lostpointercapture', endDrag);
    dial.addEventListener('keydown', function (e) {
      var k = e.key, n = idx;
      if (k === 'ArrowRight' || k === 'ArrowUp') n += 1;
      else if (k === 'ArrowLeft' || k === 'ArrowDown') n -= 1;
      else if (k === 'PageUp') n += 8;
      else if (k === 'PageDown') n -= 8;
      else if (k === 'Home') n = 0;
      else if (k === 'End') n = GRID.length - 1;
      else return;
      e.preventDefault();
      n = Math.max(0, Math.min(GRID.length - 1, n));
      if (n !== idx) { idx = n; render(true); }
    });
    selector($('#swing-sel'), function (btn) { swing = +btn.getAttribute('data-value'); render(true); });
    render(false);
  }

  /* ------------------------------------------------------------------ */
  /* Tool 2: plan chart                                                   */
  /* ------------------------------------------------------------------ */
  var PLAN = {
    margin: {
      series: [[1.6, 5.4, 13.5], [0.55, 3.5, 10.1]], max: 15, step: 5,
      fmt: function (v) { return v === 0 ? '$0' : '$' + v + 'M'; },
      legend: ['Gross margin, $M', 'EBITDA, $M'],
      note: 'Gross margin 8.4× from Year 1 to Year 3',
      tip: function (i) { return 'Year ' + (i + 1) + ': gross margin $' + PLAN.margin.series[0][i] + 'M, EBITDA $' + PLAN.margin.series[1][i] + 'M'; },
      tipHTML: function (i) { return 'Year ' + (i + 1) + ' &middot; Gross margin <span class="mono">$' + PLAN.margin.series[0][i] + 'M</span> &middot; EBITDA <span class="mono">$' + PLAN.margin.series[1][i] + 'M</span>'; }
    },
    contracts: {
      series: [[8, 22, 45]], max: 50, step: 10,
      fmt: function (v) { return String(v); },
      legend: ['Contracts at year end'],
      note: '5.6× the contracts by Year 3',
      tip: function (i) { return 'Year ' + (i + 1) + ': ' + PLAN.contracts.series[0][i] + ' contracts'; },
      tipHTML: function (i) { return 'Year ' + (i + 1) + ' &middot; <span class="mono">' + PLAN.contracts.series[0][i] + '</span> contracts'; }
    },
    volume: {
      series: [[320, 990, 2250]], max: 2500, step: 500,
      fmt: function (v) { return fmtInt(v); },
      legend: ['Volume, GWh a year'],
      note: '7× the volume by Year 3',
      tip: function (i) { return 'Year ' + (i + 1) + ': ' + fmtInt(PLAN.volume.series[0][i]) + ' GWh'; },
      tipHTML: function (i) { return 'Year ' + (i + 1) + ' &middot; <span class="mono">' + fmtInt(PLAN.volume.series[0][i]) + '</span> GWh'; }
    }
  };

  var planRoot = $('#plan-chart');
  if (planRoot) {
    var planTip = $('#plan-tip'), planLegend = $('#plan-legend'), planNote = $('#plan-note');
    var pm = { l: 60, r: 16, t: 24, b: 40 };
    var measure = 'margin', W = 0, H = 360;
    var psvg, gGrid, gLabels, gBars, gHits, barEls = [], hitEls = [], current = null, cancelBars = null, grown = false;
    var ptips = tooltips(planRoot, planTip);

    function planLayout(m) {
      var cfg = PLAN[m];
      var x0 = pm.l, x1 = W - pm.r, y0 = pm.t, y1 = H - pm.b, ph = y1 - y0;
      var gw = (x1 - x0) / 3, grouped = cfg.series.length > 1;
      var bw = Math.min(64, Math.max(20, gw * 0.3)), gap = 10, bars = [];
      for (var i = 0; i < 3; i++) {
        var cx = x0 + gw * (i + 0.5);
        for (var s = 0; s < 2; s++) {
          var has = !!cfg.series[s];
          var val = has ? cfg.series[s][i] : 0;
          var bh = ph * val / cfg.max;
          var x = grouped ? (s === 0 ? cx - bw - gap / 2 : cx + gap / 2) : cx - bw / 2;
          bars.push({ x: x, y: y1 - bh, w: bw, h: bh, op: has ? 1 : 0 });
        }
      }
      var ticks = [];
      for (var v = 0; v <= cfg.max + 1e-9; v += cfg.step) ticks.push({ y: y1 - ph * v / cfg.max, label: cfg.fmt(v) });
      return { bars: bars, ticks: ticks, x0: x0, x1: x1, y0: y0, y1: y1, gw: gw, cfg: cfg };
    }
    function barPath(b, closed) {
      var r = Math.max(0, Math.min(2, b.h / 2, b.w / 2));
      var x = b.x, y = b.y, w = b.w, bottom = b.y + b.h;
      if (b.h <= 0.01) return 'M' + x + ' ' + bottom + 'h' + w;
      var p = 'M' + x + ' ' + bottom + 'V' + (y + r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + (-r) + 'h' + (w - 2 * r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r + 'V' + bottom;
      return closed ? p + 'Z' : p;
    }
    function drawStatic(L) {
      gGrid.innerHTML = ''; gLabels.innerHTML = '';
      L.ticks.forEach(function (t) {
        svgEl('line', { x1: L.x0, x2: L.x1, y1: t.y, y2: t.y, 'class': Math.abs(t.y - L.y1) < 0.5 ? 'axis' : 'grid' }, gGrid);
        svgEl('text', { x: L.x0 - 10, y: t.y + 4, 'text-anchor': 'end' }, gLabels).textContent = t.label;
      });
      for (var i = 0; i < 3; i++) {
        svgEl('text', { x: L.x0 + L.gw * (i + 0.5), y: L.y1 + 26, 'text-anchor': 'middle' }, gLabels).textContent = 'Year ' + (i + 1);
        var hit = hitEls[i];
        hit.setAttribute('x', L.x0 + L.gw * i + 2); hit.setAttribute('y', L.y0);
        hit.setAttribute('width', Math.max(1, L.gw - 4)); hit.setAttribute('height', L.y1 - L.y0);
        hit.setAttribute('aria-label', L.cfg.tip(i));
        hit._tipHTML = L.cfg.tipHTML(i);
        hit._tipX = L.x0 + L.gw * (i + 0.5);
        var top = L.y1;
        L.bars.slice(i * 2, i * 2 + 2).forEach(function (b) { if (b.op > 0) top = Math.min(top, b.y); });
        hit._tipY = top - 10;
      }
    }
    function applyBars(bars) {
      barEls.forEach(function (el, k) {
        el.setAttribute('d', barPath(bars[k], k % 2 === 0));
        el.style.opacity = bars[k].op;
      });
    }
    function animateBars(target, ms) {
      var from = current ? current.map(function (b) { return { x: b.x, y: b.y, w: b.w, h: b.h, op: b.op }; })
        : target.map(function (b) { return { x: b.x, y: b.y + b.h, w: b.w, h: 0, op: b.op }; });
      if (cancelBars) cancelBars();
      cancelBars = tween(ms, function (p) {
        var cur = target.map(function (b, k) {
          var a = from[k];
          return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p), op: lerp(a.op, b.op, p) };
        });
        current = cur;
        applyBars(cur);
      });
    }
    function buildPlan() {
      W = Math.max(280, planRoot.clientWidth);
      H = W < 600 ? 300 : 360;
      if (psvg) psvg.remove();
      psvg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': 'Bar chart of the plan by year' });
      planRoot.insertBefore(psvg, planRoot.firstChild);
      gGrid = svgEl('g', {}, psvg); gBars = svgEl('g', {}, psvg); gLabels = svgEl('g', {}, psvg); gHits = svgEl('g', {}, psvg);
      barEls = []; hitEls = [];
      for (var k = 0; k < 6; k++) barEls.push(svgEl('path', { 'class': k % 2 === 0 ? 'bar bar--a' : 'bar bar--b' }, gBars));
      for (var i = 0; i < 3; i++) hitEls.push(svgEl('rect', { 'class': 'hit', tabindex: '0', role: 'img', rx: 2 }, gHits));
      var L = planLayout(measure);
      drawStatic(L);
      if (grown) { current = L.bars; applyBars(L.bars); }
      else applyBars(L.bars.map(function (b) { return { x: b.x, y: b.y + b.h, w: b.w, h: 0, op: b.op }; }));
      ptips.reset();
    }
    function setMeasure(m) {
      measure = m;
      var L = planLayout(m);
      drawStatic(L);
      animateBars(L.bars, dur(400));
      planLegend.innerHTML = L.cfg.legend.map(function (t, i) {
        return '<li><span class="swatch ' + (i === 0 ? 'swatch--fill' : 'swatch--hollow') + '" aria-hidden="true"></span>' + t + '</li>';
      }).join('');
      planNote.textContent = L.cfg.note;
      ptips.reset();
    }
    buildPlan();
    onEnter(planRoot, function () { grown = true; animateBars(planLayout(measure).bars, dur(600)); });
    selector($('#measure-sel'), function (btn) { setMeasure(btn.getAttribute('data-measure')); });
    var planResize;
    window.addEventListener('resize', function () {
      clearTimeout(planResize);
      planResize = setTimeout(function () { if (Math.abs(planRoot.clientWidth - W) > 1) { grown = grown || current !== null; buildPlan(); } }, 120);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Tool 3: funding composition                                          */
  /* ------------------------------------------------------------------ */
  var FUND = [
    { key: 'wc', name: 'Working capital', when: 'Months 1 to 12', lo: 300, hi: 500 },
    { key: 'coll', name: 'Wholesale collateral and credit reserve', when: 'Months 1 to 6', lo: 200, hi: 400 },
    { key: 'bd', name: 'Business development and sales', when: 'Months 3 to 12', lo: 150, hi: 300 },
    { key: 'reg', name: 'Regulatory and licensing', when: 'Months 1 to 6', lo: 100, hi: 200 },
    { key: 'cont', name: 'Contingency reserve', when: 'Ongoing', lo: 100, hi: 200 },
    { key: 'legal', name: 'Legal: contracts, structure, consultant agreements', when: 'Months 1 to 3', lo: 80, hi: 150 },
    { key: 'tech', name: 'Technology and systems', when: 'Months 1 to 3', lo: 30, hi: 60 }
  ];
  var fund = $('#fund');
  if (fund) {
    var mid = function (f) { return (f.lo + f.hi) / 2; };
    var TOTAL = FUND.reduce(function (s, f) { return s + mid(f); }, 0);
    var fmtK = function (v) { return '$' + fmtInt(v) + 'K'; };
    $('#fund-total').textContent = fmtK(TOTAL);
    var stack = $('#fund-stack'), rows = $('#fund-rows'), cap = $('#fund-caption');
    var IDLE = cap.textContent;
    FUND.forEach(function (f) {
      var share = Math.round(mid(f) / TOTAL * 100);
      var seg = d.createElement('button');
      seg.type = 'button'; seg.className = 'seg'; seg.setAttribute('data-key', f.key);
      seg.style.flex = mid(f) + ' 1 0px';
      seg.setAttribute('aria-label', f.name + ', midpoint ' + fmtK(mid(f)) + ', ' + share + '% of the total');
      stack.appendChild(seg);
      var li = d.createElement('li');
      li.className = 'frow'; li.setAttribute('data-key', f.key); li.tabIndex = -1;
      li.innerHTML = '<span class="frow__name">' + f.name + ' <span class="frow__when">' + f.when + '</span></span>' +
        '<span class="frow__track"><span class="frow__bar" style="left:' + (f.lo / 500 * 100) + '%;width:' + ((f.hi - f.lo) / 500 * 100) + '%"></span>' +
        '<span class="frow__mid" style="left:' + (mid(f) / 500 * 100) + '%"></span></span>' +
        '<span class="frow__amt mono">' + fmtK(f.lo) + ' to ' + fmtK(f.hi) + '</span>';
      rows.appendChild(li);
    });
    var pinnedKey = null;
    function setActive(key) {
      $$('.seg, .frow', fund).forEach(function (el) { el.classList.toggle('is-active', el.getAttribute('data-key') === key); });
      fund.classList.toggle('has-active', !!key);
      if (!key) { cap.textContent = IDLE; return; }
      var f = FUND.filter(function (x) { return x.key === key; })[0];
      var share = Math.round(mid(f) / TOTAL * 100);
      cap.textContent = f.name + ' (' + f.when + '): ' + fmtK(f.lo) + ' to ' + fmtK(f.hi) + '. Midpoint ' + fmtK(mid(f)) + ', ' + share + '% of the total.';
    }
    var target = function (e) { return e.target.closest ? e.target.closest('.seg, .frow') : null; };
    fund.addEventListener('pointerover', function (e) { var t = target(e); if (t && !pinnedKey) setActive(t.getAttribute('data-key')); });
    fund.addEventListener('pointerout', function (e) {
      var t = target(e);
      if (!t || pinnedKey) return;
      var to = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest('.seg, .frow') : null;
      if (!to) setActive(null);
    });
    fund.addEventListener('focusin', function (e) { var t = e.target.closest ? e.target.closest('.seg') : null; if (t && !pinnedKey) setActive(t.getAttribute('data-key')); });
    fund.addEventListener('focusout', function (e) {
      var leaving = !(e.relatedTarget && fund.contains(e.relatedTarget));
      if (leaving) { pinnedKey = null; setActive(null); }
      else if (!pinnedKey && !(e.relatedTarget.closest && e.relatedTarget.closest('.seg'))) setActive(null);
    });
    fund.addEventListener('click', function (e) {
      var t = target(e);
      if (!t) return;
      var key = t.getAttribute('data-key');
      if (pinnedKey === key) { pinnedKey = null; setActive(null); } else { pinnedKey = key; setActive(key); }
    });
    fund.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pinnedKey) { pinnedKey = null; setActive(null); } });
    d.addEventListener('pointerdown', function (e) { if (pinnedKey && !fund.contains(e.target)) { pinnedKey = null; setActive(null); } });
  }

  /* ------------------------------------------------------------------ */
  /* Tool 4: earnings calculator and band chart                           */
  /* ------------------------------------------------------------------ */
  var USES = [10000, 25000, 50000, 75000, 100000, 150000, 250000, 400000, 600000, 800000];
  var earn = $('#earn');
  if (earn) {
    var st = { contracts: 3, use: 2, term: 3 };
    var LIM = { contracts: [1, 12], use: [0, USES.length - 1], term: [1, 4] };
    var earnLive = announcer($('#earn-live'), 800);
    function values() {
      var c = st.contracts, u = USES[st.use], n = st.term, V = c * u;
      return { c: c, u: u, n: n, V: V, feeLo: V * 0.5, feeHi: V, trailLo: V * 0.25, trailHi: V * 0.5, totLo: V * (0.5 + 0.25 * n), totHi: V * (1 + 0.5 * n) };
    }

    /* Band chart */
    var bandRoot = $('#band-chart'), bandTip = $('#band-tip');
    var bm = { l: 64, r: 24, t: 24, b: 40 };
    var bW = 0, bH = 340, bsvg, bGrid, bLabels, bFill, bLow, bHigh, bPts, bHits, bCursor, bClip;
    var bState = null, bCancel = null, bGrown = false;
    var btips = tooltips(bandRoot, bandTip);
    bandRoot._onShow = function (hit) { if (bCursor) { bCursor.setAttribute('x1', hit._tipX); bCursor.setAttribute('x2', hit._tipX); bCursor.style.opacity = 1; } };
    bandRoot._onHide = function () { if (bCursor) bCursor.style.opacity = 0; };

    function axisFor(v) {
      var raw = Math.max(1, v / 4), p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p;
      var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
      return { step: step, max: Math.ceil(v / step - 1e-9) * step };
    }
    function fmtAxis(v) {
      if (v === 0) return '$0';
      if (v >= 1e6) { var m = Math.round(v / 1e5) / 10; return '$' + (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + 'M'; }
      var k = v / 1e3; return '$' + (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'K';
    }
    function stateFor(v) { var ax = axisFor(v.totHi); return { V: v.V, n: v.n, max: ax.max, step: ax.step }; }
    function geo() { return { x0: bm.l, x1: bW - bm.r, y0: bm.t, y1: bH - bm.b }; }
    function pointsFor(V, n, max, count) {
      var g = geo(), ph = g.y1 - g.y0, pts = [];
      for (var k = 0; k <= count; k++) {
        var x = g.x0 + (g.x1 - g.x0) * (n > 0 ? k / n : 0);
        pts.push({ x: x, lo: g.y1 - ph * (V * (0.5 + 0.25 * k)) / max, hi: g.y1 - ph * (V * (1 + 0.5 * k)) / max });
      }
      return pts;
    }
    function drawFrame(V, n, max, labelsFrom, labelsTo, p) {
      /* labelsFrom/labelsTo: {max, step, n}; p cross-fades axis label sets */
      var g = geo(), ph = g.y1 - g.y0;
      bGrid.innerHTML = ''; bLabels.innerHTML = '';
      svgEl('line', { x1: g.x0, x2: g.x1, y1: g.y1, y2: g.y1, 'class': 'axis' }, bGrid);
      function tickSet(set, op) {
        if (op <= 0.01) return;
        for (var v = set.step; v <= set.max + 1e-9; v += set.step) {
          var y = g.y1 - ph * v / max;
          if (y < g.y0 - 1) continue;
          svgEl('line', { x1: g.x0, x2: g.x1, y1: y, y2: y, 'class': 'grid', opacity: op }, bGrid);
          svgEl('text', { x: g.x0 - 10, y: y + 4, 'text-anchor': 'end', opacity: op }, bLabels).textContent = fmtAxis(v);
        }
      }
      svgEl('text', { x: g.x0 - 10, y: g.y1 + 4, 'text-anchor': 'end' }, bLabels).textContent = '$0';
      if (labelsFrom && labelsFrom.max !== labelsTo.max) { tickSet(labelsFrom, 1 - p); tickSet(labelsTo, p); } else tickSet(labelsTo, 1);
      var count = Math.max(labelsTo.n, labelsFrom ? labelsFrom.n : 0);
      var pts = pointsFor(V, n, max, count);
      var lowD = '', highD = '';
      pts.forEach(function (q, k) { lowD += (k ? 'L' : 'M') + q.x.toFixed(1) + ' ' + q.lo.toFixed(1); highD += (k ? 'L' : 'M') + q.x.toFixed(1) + ' ' + q.hi.toFixed(1); });
      var fillD = highD;
      for (var k = pts.length - 1; k >= 0; k--) fillD += 'L' + pts[k].x.toFixed(1) + ' ' + pts[k].lo.toFixed(1);
      bLow.setAttribute('d', lowD); bHigh.setAttribute('d', highD); bFill.setAttribute('d', fillD + 'Z');
      bPts.innerHTML = '';
      pts.forEach(function (q, k) {
        var op = k > labelsTo.n ? 1 - p : (labelsFrom && k > labelsFrom.n ? p : 1);
        if (q.x > g.x1 + 1) return;
        svgEl('circle', { cx: q.x.toFixed(1), cy: q.lo.toFixed(1), r: 3, 'class': 'pt--low', opacity: op }, bPts);
        svgEl('circle', { cx: q.x.toFixed(1), cy: q.hi.toFixed(1), r: 3, 'class': 'pt--high', opacity: op }, bPts);
        svgEl('text', { x: q.x.toFixed(1), y: g.y1 + 26, 'text-anchor': k === 0 ? 'start' : (k === count ? 'end' : 'middle'), opacity: op }, bLabels).textContent = k === 0 ? 'Signing' : 'Year ' + k;
      });
    }
    function drawHits(v) {
      bHits.innerHTML = '';
      var g = geo(), pts = pointsFor(v.V, v.n, stateFor(v).max, v.n);
      var half = v.n > 0 ? (g.x1 - g.x0) / v.n / 2 : (g.x1 - g.x0) / 2;
      pts.forEach(function (q, k) {
        var lo = v.V * (0.5 + 0.25 * k), hi = v.V * (1 + 0.5 * k);
        var label = (k === 0 ? 'Signing' : 'Year ' + k) + ': ' + fmtUSD(lo) + ' to ' + fmtUSD(hi) + (k === 0 ? '' : ' cumulative');
        var x = Math.max(g.x0, q.x - half), w = Math.min(g.x1, q.x + half) - x;
        var hit = svgEl('rect', { 'class': 'hit', tabindex: '0', role: 'img', x: x, y: g.y0, width: Math.max(1, w), height: g.y1 - g.y0, 'aria-label': label }, bHits);
        hit._tipHTML = (k === 0 ? 'Signing' : 'Year ' + k) + ' &middot; <span class="mono">' + fmtUSD(lo) + '</span> to <span class="mono">' + fmtUSD(hi) + '</span>';
        hit._tipX = q.x; hit._tipY = q.hi - 10;
      });
    }
    function buildBand() {
      bW = Math.max(280, bandRoot.clientWidth);
      bH = bW < 600 ? 280 : 340;
      if (bsvg) bsvg.remove();
      bsvg = svgEl('svg', { viewBox: '0 0 ' + bW + ' ' + bH, width: bW, height: bH, role: 'img', 'aria-label': 'Cumulative earnings from signing through the term, low and high' });
      bandRoot.insertBefore(bsvg, bandRoot.firstChild);
      var defs = svgEl('defs', {}, bsvg);
      var pat = svgEl('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
      svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: '#a85a17', 'stroke-width': 1, opacity: 0.75 }, pat);
      var g = geo();
      var clip = svgEl('clipPath', { id: 'band-clip' }, defs);
      svgEl('rect', { x: g.x0 - 4, y: 0, width: g.x1 - g.x0 + 8, height: bH }, clip);
      bGrid = svgEl('g', {}, bsvg);
      var plot = svgEl('g', { 'clip-path': 'url(#band-clip)' }, bsvg);
      bFill = svgEl('path', { 'class': 'fill--hatch' }, plot);
      bLow = svgEl('path', { 'class': 'line--low' }, plot);
      bHigh = svgEl('path', { 'class': 'line--high' }, plot);
      bPts = svgEl('g', {}, plot);
      bCursor = svgEl('line', { 'class': 'cursor', y1: g.y0, y2: g.y1, x1: 0, x2: 0, opacity: 0 }, bsvg);
      bLabels = svgEl('g', {}, bsvg);
      bHits = svgEl('g', {}, bsvg);
      var v = values(), s = stateFor(v);
      if (bGrown) { bState = s; drawFrame(s.V, s.n, s.max, null, s, 1); }
      else { bState = { V: 0, n: s.n, max: s.max, step: s.step }; drawFrame(0, s.n, s.max, null, s, 1); }
      drawHits(v);
      btips.reset();
    }
    function updateBand(v, ms) {
      var to = stateFor(v);
      var from = bState || { V: 0, n: to.n, max: to.max, step: to.step };
      if (bCancel) bCancel();
      bCancel = tween(ms, function (p) {
        var V = lerp(from.V, to.V, p), n = lerp(from.n, to.n, p), max = lerp(from.max, to.max, p);
        bState = { V: V, n: n, max: max, step: to.step };
        drawFrame(V, n, max, from, to, p);
      }, function () { bState = to; drawFrame(to.V, to.n, to.max, null, to, 1); });
      drawHits(v);
      btips.reset();
    }
    buildBand();
    onEnter(bandRoot, function () { bGrown = true; updateBand(values(), dur(600)); });
    var bandResize;
    window.addEventListener('resize', function () {
      clearTimeout(bandResize);
      bandResize = setTimeout(function () { if (Math.abs(bandRoot.clientWidth - bW) > 1) { bGrown = bGrown || (bState && bState.V > 0); buildBand(); } }, 120);
    });

    /* Steppers and results */
    var btns = $$('.stepper__btn', earn);
    function updateCalc(announce, pressed) {
      var v = values();
      $('#st-contracts').textContent = String(v.c);
      $('#st-use').textContent = fmtInt(v.u);
      $('#st-term').textContent = String(v.n);
      btns.forEach(function (b) {
        var k = b.getAttribute('data-stepper'), dir = +b.getAttribute('data-dir');
        var dis = dir < 0 ? st[k] <= LIM[k][0] : st[k] >= LIM[k][1];
        b.disabled = dis;
        if (dis && pressed === b) {
          var other = b.parentNode.querySelector('.stepper__btn[data-dir="' + (-dir) + '"]');
          if (other) other.focus();
        }
      });
      tweenNumber($('#r-fee-lo'), v.feeLo, fmtUSD); tweenNumber($('#r-fee-hi'), v.feeHi, fmtUSD);
      tweenNumber($('#r-trail-lo'), v.trailLo, fmtUSD); tweenNumber($('#r-trail-hi'), v.trailHi, fmtUSD);
      tweenNumber($('#r-total-lo'), v.totLo, fmtUSD); tweenNumber($('#r-total-hi'), v.totHi, fmtUSD);
      $('#r-total-cap').textContent = 'Referral fee plus ' + v.n + (v.n === 1 ? ' year' : ' years') + ' of trailing commission';
      if (bGrown) updateBand(v, dur(400));
      if (announce) earnLive(v.c + (v.c === 1 ? ' contract' : ' contracts') + ' at ' + fmtInt(v.u) + ' MWh each for ' + v.n + (v.n === 1 ? ' year' : ' years') + ': referral fee ' + fmtUSD(v.feeLo) + ' to ' + fmtUSD(v.feeHi) + ', trailing commission ' + fmtUSD(v.trailLo) + ' to ' + fmtUSD(v.trailHi) + ' a year, total ' + fmtUSD(v.totLo) + ' to ' + fmtUSD(v.totHi) + '.');
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-stepper'), dir = +b.getAttribute('data-dir');
        st[k] = Math.max(LIM[k][0], Math.min(LIM[k][1], st[k] + dir));
        updateCalc(true, b);
      });
    });
    updateCalc(false, null);
  }
})();
