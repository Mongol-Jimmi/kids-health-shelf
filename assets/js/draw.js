/* Pick up the pencil: draw all over any page.
   Strokes live in one SVG laid over the whole document (page coordinates), so
   doodles stay stuck to the content when you scroll. By default they fade away
   15 seconds after you stop drawing; the "Keep" toggle makes them stay (for the
   browser session). A soft pencil-scratch sound follows how fast you draw. */
(function () {
  const KHS = window.KHS;
  if (!KHS) return;
  const gsap = window.gsap;
  const R = KHS.REDUCED;
  const html = document.documentElement;
  const NS = "http://www.w3.org/2000/svg";
  const KEY = "khs-doodles:" + location.pathname;
  const FADE_AFTER = 15000;
  const COLORS = [["ink", "#14161A"], ["red", "#F0453A"], ["blue", "#2F6BFF"], ["pink", "#FF8FB8"], ["yellow", "#FFE14D"], ["sage", "#B9D49A"]];
  const SIZES = [["thin", 4], ["medium", 9], ["chunky", 18]];
  let color = COLORS[1][1];
  let size = SIZES[1][1];
  let on = false;
  let keep = KHS.local.get("khs-draw-keep") === "on";
  let lastInk = Date.now();

  /* ---------------- the doodle layer ---------------- */
  const layer = document.createElementNS(NS, "svg");
  layer.setAttribute("class", "doodles");
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);
  const strokes = () => Array.from(layer.children).filter((p) => !p.dataset.leaving);

  function fitLayer() {
    layer.style.height = "0px";
    const w = html.clientWidth;
    const h = Math.max(document.body.scrollHeight, html.scrollHeight);
    layer.style.width = w + "px";
    layer.style.height = h + "px";
    layer.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }
  fitLayer();
  if (window.ResizeObserver) new ResizeObserver(() => fitLayer()).observe(document.body);
  window.addEventListener("load", fitLayer);

  /* ---------------- strokes ---------------- */
  const round = (n) => Math.round(n * 10) / 10;
  function pathData(pts) {
    if (pts.length === 1) return `M${pts[0][0]} ${pts[0][1]}l0.01 0`;
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i];
      const [nx, ny] = pts[i + 1];
      d += `Q${x} ${y} ${round((x + nx) / 2)} ${round((y + ny) / 2)}`;
    }
    const last = pts[pts.length - 1];
    return d + `L${last[0]} ${last[1]}`;
  }
  function makePath(d, c, s) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("stroke", c);
    p.setAttribute("stroke-width", s);
    layer.appendChild(p);
    return p;
  }

  // only kept drawings survive a page change; fading ones are meant to be fleeting
  function save() {
    if (keep) {
      const paths = strokes().map((p) => ({ d: p.getAttribute("d"), c: p.getAttribute("stroke"), s: p.getAttribute("stroke-width") }));
      KHS.session.set(KEY, JSON.stringify({ w: html.clientWidth, paths }));
    } else {
      KHS.session.del(KEY);
    }
    updateButtons();
  }
  function restore() {
    if (!keep) return;
    try {
      const saved = JSON.parse(KHS.session.get(KEY) || "null");
      // the page reflows at other widths, so old doodles would land in the wrong place
      if (!saved || Math.abs(saved.w - html.clientWidth) > 2) return;
      saved.paths.forEach((p) => makePath(p.d, p.c, p.s));
    } catch (e) {}
  }
  restore();

  /* ---------------- pencil-on-paper sound ---------------- */
  // Grainy noise through a band-pass filter, louder the faster the pencil moves.
  let scratch = null;
  let grain = null;
  function grainBuffer(a) {
    if (grain) return grain;
    const len = Math.floor(a.sampleRate * 1.5);
    grain = a.createBuffer(1, len, a.sampleRate);
    const d = grain.getChannelData(0);
    let amp = 1;
    for (let i = 0; i < len; i++) {
      if (i % 90 === 0) amp = 0.35 + Math.random() * 0.65; // paper tooth
      d[i] = (Math.random() * 2 - 1) * amp;
    }
    return grain;
  }
  function scratchStart() {
    const a = KHS.audio && KHS.audio();
    if (!a) return;
    const src = a.createBufferSource();
    src.buffer = grainBuffer(a);
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const hp = a.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 900;
    const bp = a.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 2600 + (18 - size) * 60; bp.Q.value = 0.9;
    const g = a.createGain();
    g.gain.value = 0;
    src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(a.destination);
    src.start();
    scratch = { a, src, g, bp };
  }
  function scratchSpeed(pxPerMs) {
    if (!scratch) return;
    const t = scratch.a.currentTime;
    const level = Math.min(0.09, pxPerMs * 0.045);
    scratch.g.gain.setTargetAtTime(level, t, 0.025);
    scratch.bp.frequency.setTargetAtTime(2300 + Math.min(1800, pxPerMs * 700), t, 0.05);
  }
  function scratchStop() {
    if (!scratch) return;
    const { a, src, g } = scratch;
    g.gain.setTargetAtTime(0, a.currentTime, 0.04);
    src.stop(a.currentTime + 0.25);
    scratch = null;
  }

  /* ---------------- drawing surface ---------------- */
  const surface = document.createElement("div");
  surface.className = "draw-surface";
  document.body.appendChild(surface);

  let pts = null;
  let live = null;
  let lastMove = 0;
  surface.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    surface.setPointerCapture(e.pointerId);
    pts = [[round(e.clientX + scrollX), round(e.clientY + scrollY)]];
    live = makePath(pathData(pts), color, size);
    lastMove = e.timeStamp;
    lastInk = Date.now();
    scratchStart();
  });
  surface.addEventListener("pointermove", (e) => {
    if (!pts) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    let moved = 0;
    (events.length ? events : [e]).forEach((ev) => {
      const x = round(ev.clientX + scrollX), y = round(ev.clientY + scrollY);
      const [lx, ly] = pts[pts.length - 1];
      const dist = Math.hypot(x - lx, y - ly);
      if (dist < 1.5) return;
      pts.push([x, y]);
      moved += dist;
    });
    live.setAttribute("d", pathData(pts));
    const dt = Math.max(8, e.timeStamp - lastMove);
    lastMove = e.timeStamp;
    scratchSpeed(moved / dt);
    lastInk = Date.now();
  });
  const end = () => {
    scratchStop();
    if (!pts) return;
    pts = null;
    live = null;
    lastInk = Date.now();
    save();
  };
  surface.addEventListener("pointerup", end);
  surface.addEventListener("pointercancel", end);
  surface.addEventListener("lostpointercapture", end);

  /* ---------------- toolbar ---------------- */
  const bar = document.createElement("div");
  bar.className = "draw-bar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Drawing tools");
  bar.innerHTML =
    '<span class="hand draw-bar__label">draw!</span>' +
    '<div class="draw-bar__group draw-bar__colours">' + COLORS.map(([n, c]) => `<button type="button" class="swatch swatch--${n}" data-colour="${c}" aria-label="${n === "ink" ? "black" : n} pencil" style="--c:${c}"></button>`).join("") + "</div>" +
    '<span class="draw-bar__rule" aria-hidden="true"></span>' +
    '<div class="draw-bar__group">' + SIZES.map(([n, s]) => `<button type="button" class="nib" data-size="${s}" aria-label="${n} line"><span style="width:${Math.max(5, s)}px;height:${Math.max(5, s)}px"></span></button>`).join("") + "</div>" +
    '<span class="draw-bar__rule" aria-hidden="true"></span>' +
    '<button type="button" class="draw-bar__keep" data-act="keep"><span class="draw-bar__timer" aria-hidden="true"></span><span class="draw-bar__keep-text"></span></button>' +
    '<button type="button" class="draw-bar__icon" data-act="undo" aria-label="Undo last line"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5L4 10l5 5"/><path d="M4 10h10a6 6 0 0 1 0 12h-3"/></svg></button>' +
    '<button type="button" class="draw-bar__text" data-act="wipe">Wipe</button>' +
    '<button type="button" class="draw-bar__done" data-act="done">Done</button>';
  document.body.appendChild(bar);

  /* a little "wipe" chip that stays on the page after you press Done */
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "doodle-chip";
  chip.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M8 20h12"/><path d="M4.5 15.5l9-9a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L12 18H7z" fill="var(--pink)"/></svg><span>Wipe drawings</span>';
  chip.addEventListener("click", () => wipe());
  document.body.appendChild(chip);

  function pencilCursor(c) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'><path d='M3 31l2-8L24 4a3 3 0 0 1 4 0l2 2a3 3 0 0 1 0 4L11 29z' fill='${c}' stroke='#14161A' stroke-width='2.4' stroke-linejoin='round'/><path d='M3 31l2-8 6 6z' fill='#F6D7A7' stroke='#14161A' stroke-width='2' stroke-linejoin='round'/><path d='M3 31l1-3.5 2.5 2.5z' fill='#14161A'/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 3 31, crosshair`;
  }

  function updateButtons() {
    bar.querySelectorAll("[data-colour]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.colour === color)));
    bar.querySelectorAll("[data-size]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.size) === size)));
    const empty = strokes().length === 0;
    bar.querySelector('[data-act="undo"]').disabled = empty;
    bar.querySelector('[data-act="wipe"]').disabled = empty;
    const k = bar.querySelector('[data-act="keep"]');
    k.setAttribute("aria-pressed", String(keep));
    k.setAttribute("aria-label", keep ? "Drawings stay. Tap to make them fade after 15 seconds" : "Drawings fade after 15 seconds. Tap to keep them");
    k.querySelector(".draw-bar__keep-text").textContent = keep ? "Keep" : "15s";
    chip.classList.toggle("is-shown", !on && !empty);
    surface.style.cursor = pencilCursor(color);
  }

  const canUndraw = () => !R && gsap && window.DrawSVGPlugin;
  function erase(paths, opts) {
    const o = opts || {};
    paths.forEach((p) => { p.dataset.leaving = "1"; });
    updateButtons();
    const done = () => { paths.forEach((p) => p.remove()); save(); };
    if (!paths.length) return;
    if (!gsap) return done();
    if (!canUndraw()) return gsap.to(paths, { opacity: 0, duration: 0.6, onComplete: done });
    gsap.to(paths.slice().reverse(), {
      drawSVG: o.fromStart ? "100% 100%" : "0% 0%",
      duration: o.duration || 0.45, ease: "power2.in",
      stagger: Math.min(0.06, 0.8 / paths.length),
      onComplete: done
    });
  }
  function undo() {
    const s = strokes();
    if (!s.length) return;
    KHS.popSound(0.7);
    erase([s[s.length - 1]], { duration: 0.35 });
  }
  function wipe() {
    const s = strokes();
    if (!s.length) return;
    KHS.popSound(0.6);
    erase(s, { fromStart: true, duration: 0.5 });
  }

  /* fade everything 15s after the last line, unless "Keep" is on */
  const timer = bar.querySelector(".draw-bar__timer");
  setInterval(() => {
    const has = strokes().length > 0;
    const idle = Date.now() - lastInk;
    const left = keep || pts || !has ? 1 : Math.max(0, 1 - idle / FADE_AFTER);
    timer.style.setProperty("--left", left.toFixed(3));
    if (!keep && !pts && has && idle >= FADE_AFTER) erase(strokes(), { fromStart: true, duration: 1.1 });
  }, 250);

  bar.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.colour) { color = b.dataset.colour; KHS.popSound(1.2); }
    if (b.dataset.size) { size = Number(b.dataset.size); KHS.popSound(0.9 + size / 20); }
    if (b.dataset.act === "keep") {
      keep = !keep;
      KHS.local.set("khs-draw-keep", keep ? "on" : "off");
      lastInk = Date.now(); // switching back to fading gives you a fresh 15 seconds
      KHS.popSound(keep ? 1.3 : 0.9);
      save();
    }
    if (b.dataset.act === "undo") undo();
    if (b.dataset.act === "wipe") wipe();
    if (b.dataset.act === "done") toggle(false);
    updateButtons();
  });

  /* ---------------- on / off ---------------- */
  const toggles = () => document.querySelectorAll(".draw-btn, [data-draw-toggle]");
  function hint() {
    if (KHS.session.get("khs-draw-hint")) return;
    KHS.session.set("khs-draw-hint", "1");
    const h = document.createElement("div");
    h.className = "bubble draw-hint";
    h.textContent = matchMedia("(pointer: coarse)").matches ? "Draw anywhere! Tap Done to scroll again." : "Draw anywhere! You can still scroll.";
    document.body.appendChild(h);
    if (R || !gsap) { setTimeout(() => h.remove(), 3200); return; }
    gsap.timeline({ onComplete: () => h.remove() })
      .from(h, { scale: 0, rotation: -10, duration: 0.5, ease: "back.out(2.4)" })
      .to(h, { autoAlpha: 0, y: -10, duration: 0.3 }, "+=2.6");
  }

  function toggle(next) {
    on = typeof next === "boolean" ? next : !on;
    html.classList.toggle("is-drawing", on);
    toggles().forEach((t) => t.setAttribute("aria-pressed", String(on)));
    updateButtons();
    if (on) {
      fitLayer();
      lastInk = Date.now();
      KHS.popSound(1.3);
      if (!R && gsap) gsap.fromTo(bar, { yPercent: 160, rotation: -4 }, { yPercent: 0, rotation: 0, duration: 0.6, ease: "back.out(1.6)" });
      hint();
    } else {
      scratchStop();
      KHS.popSound(0.8);
    }
  }
  KHS.draw = { toggle, isOn: () => on };

  document.addEventListener("click", (e) => {
    const t = e.target.closest(".draw-btn, [data-draw-toggle]");
    if (!t) return;
    e.preventDefault();
    toggle();
  });
  document.querySelectorAll("[data-draw-toggle]").forEach((el) => {
    el.setAttribute("aria-pressed", "false");
    if (el.matches("button, a")) return;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", "Pick up the pencil and draw on the page");
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
  });
  document.addEventListener("keydown", (e) => {
    if (!on) return;
    if (e.key === "Escape") toggle(false);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
  });
  updateButtons();
})();
