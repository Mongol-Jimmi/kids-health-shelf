/* Kids Health Shelf — shared behaviour for every page:
   smooth scroll, cursor, nav, menu, page-turn transitions, sound, goose honks,
   confetti, draggable stickers, split-text reveals and the footer. */
(function () {
  const gsap = window.gsap;
  const html = document.documentElement;
  if (!gsap) { html.classList.remove("js-intro", "is-arriving"); return; }

  gsap.registerPlugin(ScrollTrigger, SplitText, Draggable, InertiaPlugin, Physics2DPlugin, DrawSVGPlugin, Flip);

  const KHS = (window.KHS = window.KHS || {});
  // "calm" is decided in the <head> script: OS reduced-motion, unless the visitor opted back in.
  const REDUCED = html.classList.contains("calm");
  const FINE = matchMedia("(hover: hover) and (pointer: fine)").matches;
  KHS.REDUCED = REDUCED;
  KHS.FINE = FINE;

  const safe = (store) => ({
    get: (k) => { try { return store().getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { store().setItem(k, v); } catch (e) {} },
    del: (k) => { try { store().removeItem(k); } catch (e) {} }
  });
  KHS.local = safe(() => localStorage);
  KHS.session = safe(() => sessionStorage);
  const rand = gsap.utils.random;

  /* ---------------- sound (synthesised, no files) ---------------- */
  let actx = null;
  let soundOn = KHS.local.get("khs-sound") !== "off";
  // browsers only allow audio after the visitor has interacted with the page
  let gestured = false;
  ["pointerdown", "keydown", "touchstart"].forEach((t) => window.addEventListener(t, () => { gestured = true; }, { once: true, capture: true }));
  function audio() {
    if (!soundOn) return null;
    const active = navigator.userActivation ? navigator.userActivation.hasBeenActive : gestured;
    if (!active) return null;
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  KHS.audioReady = () => !!actx && actx.state === "running" && soundOn;
  KHS.audio = audio;

  KHS.honkSound = function (loud) {
    const a = audio(); if (!a) return;
    const t = a.currentTime;
    [0, 0.2].forEach((off, i) => {
      const base = i ? 290 : 340;
      const g = a.createGain();
      const f = a.createBiquadFilter();
      f.type = "bandpass"; f.frequency.value = 1050; f.Q.value = 1.3;
      [["sawtooth", 1], ["square", 1.012]].forEach(([type, detune]) => {
        const o = a.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(base * detune, t + off);
        o.frequency.exponentialRampToValueAtTime(base * 0.7 * detune, t + off + 0.17);
        o.connect(f); o.start(t + off); o.stop(t + off + 0.22);
      });
      g.gain.setValueAtTime(0.0001, t + off);
      g.gain.exponentialRampToValueAtTime(loud ? 0.5 : 0.3, t + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.2);
      f.connect(g); g.connect(a.destination);
    });
  };

  KHS.popSound = function (pitch) {
    const a = audio(); if (!a) return;
    const p = pitch || rand(0.85, 1.4);
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(520 * p, t);
    o.frequency.exponentialRampToValueAtTime(1150 * p, t + 0.07);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + 0.15);
  };

  KHS.tickSound = function () {
    if (!KHS.audioReady()) return;
    const a = actx, t = a.currentTime;
    const len = Math.floor(a.sampleRate * 0.02);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = a.createBufferSource();
    const f = a.createBiquadFilter();
    const g = a.createGain();
    src.buffer = buf; f.type = "highpass"; f.frequency.value = 1800; g.gain.value = 0.18;
    src.connect(f); f.connect(g); g.connect(a.destination); src.start(t);
  };

  /* ---------------- motion toggle + calm-mode notice ---------------- */
  function setMotion(on) {
    KHS.local.set("khs-motion", on ? "on" : "off");
    location.reload();
  }
  function initMotionToggle() {
    document.querySelectorAll(".motion-btn").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(!REDUCED));
      btn.addEventListener("click", () => { KHS.local.set("khs-motion-seen", "1"); setMotion(REDUCED); });
    });
    initMotionNudge();
    const osReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!REDUCED || !osReduced || KHS.local.get("khs-motion") === "off" || KHS.session.get("khs-toast-closed")) return;
    const toast = document.createElement("div");
    toast.className = "motion-toast";
    toast.setAttribute("role", "status");
    toast.innerHTML = '<span>Calm mode is on because your device asks for less motion.</span>' +
      '<button type="button" data-act="on">Turn animations on</button>' +
      '<button type="button" class="x" data-act="close" aria-label="Dismiss">✕</button>';
    document.body.appendChild(toast);
    toast.addEventListener("click", (e) => {
      const act = e.target.closest("button") && e.target.closest("button").dataset.act;
      if (act === "on") setMotion(true);
      if (act === "close") { KHS.session.set("khs-toast-closed", "1"); toast.remove(); }
    });
  }

  /* A hand-drawn arrow at the top of the page pointing at the animations switch,
     until the visitor has used it once. On phones the switch lives in the menu. */
  function initMotionNudge() {
    if (KHS.local.get("khs-motion-seen")) return;
    const btn = Array.from(document.querySelectorAll(".nav__tools .motion-btn")).find((b) => b.offsetParent);
    const target = btn || document.querySelector(".burger");
    if (!target || !target.offsetParent) return;
    const el = document.createElement("div");
    el.className = "motion-nudge hand";
    el.setAttribute("aria-hidden", "true");
    const words = !btn ? "animations on or off?<br>they're in here!"
      : REDUCED ? "want it all <b>animated</b>?<br>tap here!" : "animations on or <b>off</b>?<br>tap here!";
    el.innerHTML = '<svg viewBox="0 0 74 66"><path d="M10 62 C10 32 32 12 62 8"/><path d="M47 3 L63 8 L55 22"/></svg>' +
      `<span class="motion-nudge__text">${words}</span>`;
    document.body.appendChild(el);
    const place = () => {
      const r = target.getBoundingClientRect();
      // the arrow's tip is 21px in from the right edge of the note and 8px down from its top
      el.style.right = Math.max(8, innerWidth - (r.left + r.width / 2) - 21) + "px";
      el.style.top = r.bottom - 4 + "px";
    };
    place();
    window.addEventListener("resize", place);
    const arrow = el.querySelectorAll("path");
    let shown = false, bob = null;
    function show() {
      if (shown || !el.isConnected) return;
      shown = true;
      place();
      if (btn) btn.classList.add("is-nudged");
      if (REDUCED) { gsap.set(el, { autoAlpha: 1 }); return; }
      gsap.timeline()
        .fromTo(el, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "back.out(2)" })
        .fromTo(arrow, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.5, stagger: 0.3, ease: "power2.out" }, "<");
      // the arrow keeps poking at the button
      bob = gsap.to(el.querySelector("svg"), { x: 5, y: -6, duration: 0.55, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1 });
    }
    function hide(forever) {
      if (forever) { if (bob) bob.kill(); if (btn) btn.classList.remove("is-nudged"); }
      if (!shown) { if (forever) el.remove(); return; }
      shown = false;
      if (btn) btn.classList.remove("is-nudged");
      gsap.to(el, { autoAlpha: 0, y: -6, duration: 0.25, onComplete: () => { if (forever) el.remove(); } });
    }
    // only near the top of the page, where the nav (and the switch) is in view
    setTimeout(() => { if (scrollY < 80) show(); }, REDUCED ? 300 : 1500);
    window.addEventListener("scroll", () => { if (scrollY > 80) hide(); else if (el.isConnected) setTimeout(() => { if (scrollY <= 80) show(); }, 200); }, { passive: true });
    target.addEventListener("click", () => hide(true));
    target.addEventListener("pointerenter", () => { if (shown && !REDUCED) gsap.to(el, { scale: 1.06, duration: 0.2 }); });
    target.addEventListener("pointerleave", () => { if (shown && !REDUCED) gsap.to(el, { scale: 1, duration: 0.3 }); });
  }

  function initSoundToggle() {
    const SOUND = ".sound-btn:not(.motion-btn):not(.draw-btn)";
    document.querySelectorAll(SOUND).forEach((btn) => {
      btn.setAttribute("aria-pressed", String(soundOn));
      btn.addEventListener("click", () => {
        soundOn = !soundOn;
        KHS.local.set("khs-sound", soundOn ? "on" : "off");
        document.querySelectorAll(SOUND).forEach((b) => b.setAttribute("aria-pressed", String(soundOn)));
        if (soundOn) KHS.popSound(1.2);
      });
    });
  }

  /* ---------------- smooth scroll ---------------- */
  function initLenis() {
    if (REDUCED || !window.Lenis) return;
    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1 });
    KHS.lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  KHS.scrollTo = function (target) {
    if (KHS.lenis) KHS.lenis.scrollTo(target, { offset: -80, duration: 1.4 });
    else if (target === 0) window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" });
    else {
      const el = typeof target === "string" ? document.querySelector(target) : target;
      if (el) el.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" });
    }
  };

  /* ---------------- custom cursor (fine pointers only) ---------------- */
  function initCursor() {
    const c = document.querySelector(".cursor");
    if (!c || !FINE || REDUCED) return;
    html.classList.add("has-cursor");
    const label = c.querySelector(".cursor__label");
    gsap.set(c, { scale: 0.19, borderRadius: 21, autoAlpha: 0 });
    const xTo = gsap.quickTo(c, "x", { duration: 0.22, ease: "power3" });
    const yTo = gsap.quickTo(c, "y", { duration: 0.22, ease: "power3" });
    let shown = false;
    window.addEventListener("pointermove", (e) => {
      if (!shown) { gsap.set(c, { x: e.clientX, y: e.clientY }); gsap.to(c, { autoAlpha: 1, duration: 0.2 }); shown = true; }
      xTo(e.clientX); yTo(e.clientY);
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => { gsap.to(c, { autoAlpha: 0, duration: 0.2 }); shown = false; });

    let current = null;
    function setState(t) {
      gsap.killTweensOf(label);
      if (t && t.dataset.cursor) {
        label.textContent = t.dataset.cursor;
        gsap.to(c, { scale: 1, borderRadius: 42, backgroundColor: t.dataset.cursorColor || "#FFE14D", duration: 0.45, ease: "back.out(2)", overwrite: "auto" });
        gsap.to(label, { autoAlpha: 1, duration: 0.2, delay: 0.08 });
      } else if (t) {
        gsap.to(c, { scale: 0.5, borderRadius: 42, backgroundColor: "rgba(47,107,255,0.28)", duration: 0.3, ease: "power3", overwrite: "auto" });
        gsap.to(label, { autoAlpha: 0, duration: 0.1 });
      } else {
        gsap.to(c, { scale: 0.19, borderRadius: 21, backgroundColor: "#14161A", duration: 0.35, ease: "power3", overwrite: "auto" });
        gsap.to(label, { autoAlpha: 0, duration: 0.1 });
      }
    }
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest("[data-cursor], a, button, .spine");
      if (t === current) return;
      current = t;
      setState(t);
    });
    window.addEventListener("pointerdown", () => gsap.to(c, { scale: "*=0.8", duration: 0.15, overwrite: "auto" }));
    window.addEventListener("pointerup", () => setState(current));
  }

  /* ---------------- nav, menu, progress ---------------- */
  function initNav() {
    const nav = document.querySelector(".nav");
    if (!nav) return;
    ScrollTrigger.create({
      start: 0, end: "max",
      onUpdate(self) {
        const y = self.scroll();
        nav.classList.toggle("is-scrolled", y > 40);
        if (document.body.classList.contains("menu-open")) return;
        nav.classList.toggle("is-hidden", self.direction === 1 && y > 400);
      }
    });

    const prog = document.querySelector(".progress");
    if (prog) gsap.to(prog, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

    const burger = document.querySelector(".burger");
    const menu = document.querySelector(".menu");
    if (!burger || !menu) return;
    const links = menu.querySelectorAll("a");
    const tl = gsap.timeline({ paused: true })
      .set(menu, { visibility: "visible" })
      .to(menu, { clipPath: "circle(150% at calc(100% - 40px) 40px)", duration: 0.7, ease: "power3.inOut" })
      .from(links, { yPercent: 60, autoAlpha: 0, rotation: () => rand(-6, 6), stagger: 0.06, duration: 0.5, ease: "back.out(1.8)" }, "-=0.35");
    function toggle(open) {
      burger.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("menu-open", open);
      if (open) { tl.timeScale(1).play(); KHS.popSound(0.9); if (KHS.lenis) KHS.lenis.stop(); }
      else { tl.timeScale(1.6).reverse(); if (KHS.lenis) KHS.lenis.start(); }
    }
    burger.addEventListener("click", () => toggle(burger.getAttribute("aria-expanded") !== "true"));
    links.forEach((a) => a.addEventListener("click", () => toggle(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && burger.getAttribute("aria-expanded") === "true") toggle(false); });
  }

  /* ---------------- page-turn transitions ---------------- */
  function initTransitions() {
    const curtain = document.querySelector(".curtain");
    if (!curtain) return;
    const goose = curtain.querySelector(".curtain__goose");
    const word = curtain.querySelector(".curtain__word");
    const arriving = html.classList.contains("is-arriving");
    gsap.set(curtain, { y: 0, yPercent: arriving ? 0 : 100 });
    html.classList.remove("is-arriving");
    KHS.session.del("khs-nav");
    if (arriving) {
      gsap.timeline({ delay: 0.1 })
        .to(goose, { y: -30, duration: 0.25, ease: "power2.out" })
        .to(curtain, { yPercent: -100, duration: 0.85, ease: "power4.inOut" }, "<0.05")
        .set(curtain, { yPercent: 100 })
        .set(goose, { y: 0 });
    }

    const isIndex = (p) => p.endsWith("/") || /index\.html$/.test(p);
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a || e.defaultPrevented) return;
      if (a.target === "_blank" || a.hasAttribute("download") || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      const samePage = url.pathname === location.pathname || (isIndex(url.pathname) && isIndex(location.pathname));
      if (samePage) { e.preventDefault(); KHS.scrollTo(url.hash || 0); return; }
      e.preventDefault();
      KHS.session.set("khs-nav", "1");
      KHS.popSound(0.8);
      if (REDUCED) { location.href = a.href; return; }
      const lines = ["turning the page…", "honk honk!", "finding the book…", "grabbing a pencil…"];
      word.textContent = lines[Math.floor(Math.random() * lines.length)];
      gsap.timeline()
        .set(curtain, { yPercent: 100 })
        .to(curtain, { yPercent: 0, duration: 0.6, ease: "power4.inOut" })
        .fromTo(goose, { scale: 0, rotation: -25 }, { scale: 1, rotation: 0, duration: 0.45, ease: "back.out(2.2)" }, "-=0.2")
        .fromTo(word, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.25 }, "<")
        .add(() => { location.href = a.href; }, "+=0.1");
    });

    window.addEventListener("pageshow", (e) => { if (e.persisted) gsap.set(curtain, { yPercent: 100 }); });

    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target) setTimeout(() => KHS.scrollTo(target), 500);
    }
  }

  /* ---------------- stickers ---------------- */
  KHS.float = function (sticker) {
    if (REDUCED) return;
    const f = sticker.querySelector(".sticker__float") || sticker;
    gsap.killTweensOf(f);
    gsap.to(f, {
      y: rand(-16, -8), rotation: rand(-7, 7),
      duration: rand(2.2, 3.6), ease: "sine.inOut", yoyo: true, repeat: -1, delay: rand(0, 1.2)
    });
  };

  KHS.parallax = function (stickers) {
    if (REDUCED || !FINE) return;
    const items = stickers.map((s) => {
      const p = s.querySelector(".sticker__par") || s;
      return {
        depth: parseFloat(s.dataset.depth || "0.5"),
        x: gsap.quickTo(p, "x", { duration: 0.9, ease: "power3" }),
        y: gsap.quickTo(p, "y", { duration: 0.9, ease: "power3" })
      };
    });
    window.addEventListener("pointermove", (e) => {
      const nx = e.clientX / innerWidth - 0.5;
      const ny = e.clientY / innerHeight - 0.5;
      items.forEach((it) => { it.x(-nx * 60 * it.depth); it.y(-ny * 44 * it.depth); });
    }, { passive: true });
  };

  KHS.wiggle = function (el) {
    gsap.fromTo(el, { rotation: -16 }, { rotation: 0, duration: 1, ease: "elastic.out(1.2, 0.3)", overwrite: "auto" });
  };

  let topZ = 10;
  const restRot = (s) => parseFloat(s.dataset.rot) || 0;
  KHS.makeDraggable = function (stickers, bounds, opts) {
    const o = opts || {};
    return stickers.map((s) => Draggable.create(s, {
      type: "x,y",
      bounds: bounds,
      inertia: true,
      edgeResistance: 0.7,
      zIndexBoost: false,
      onPress() {
        s.style.zIndex = ++topZ;
        gsap.to(s, { scale: 1.12, duration: 0.25, ease: "back.out(3)" });
      },
      onRelease() { gsap.to(s, { scale: 1, duration: 0.7, ease: "elastic.out(1, 0.4)" }); },
      onDragStart() { KHS.popSound(0.7); },
      onDrag() { gsap.to(s, { rotation: restRot(s) + gsap.utils.clamp(-25, 25, this.deltaX * 1.6), duration: 0.3, overwrite: "auto" }); },
      onThrowComplete() { gsap.to(s, { rotation: restRot(s), duration: 1, ease: "elastic.out(1, 0.35)" }); },
      onDragEnd() { if (!this.tween) gsap.to(s, { rotation: restRot(s), duration: 1, ease: "elastic.out(1, 0.35)" }); },
      onClick() {
        if (o.onClick) o.onClick(s);
        else if (s.hasAttribute("data-honk")) KHS.honk(s);
        else { KHS.wiggle(s.querySelector(".sticker__float") || s); KHS.popSound(); }
      }
    })[0]);
  };

  /* ---------------- confetti + honk ---------------- */
  const CONFETTI = ["star", "starPink", "starSage", "burstPink", "burst", "heart"];
  KHS.confetti = function (x, y, count, spread) {
    if (REDUCED) return;
    const n = count || 16;
    const sp = spread || 70;
    for (let i = 0; i < n; i++) {
      const el = document.createElement("div");
      el.className = "confetti";
      el.innerHTML = KHS.stickers[CONFETTI[i % CONFETTI.length]];
      document.body.appendChild(el);
      const size = rand(14, 30);
      gsap.set(el, { x: x - size / 2, y: y - size / 2, width: size, height: size, rotation: rand(0, 360) });
      gsap.to(el, {
        duration: rand(1.1, 1.8),
        physics2D: { velocity: rand(320, 720), angle: rand(-90 - sp, -90 + sp), gravity: 1200 },
        rotation: "+=" + rand(-540, 540),
        ease: "none",
        onComplete: () => el.remove()
      });
      gsap.to(el, { autoAlpha: 0, duration: 0.4, delay: 0.9 });
    }
  };

  const HONKS = ["HONK!", "honk honk!", "HONK?!", "honk :)", "hi there!", "read a book!"];
  KHS.honk = function (gooseEl, opts) {
    const o = opts || {};
    KHS.honkSound(o.loud);
    const svg = gooseEl.querySelector("svg") || gooseEl;
    gsap.timeline()
      .to(svg, { scaleY: 0.82, scaleX: 1.12, transformOrigin: "50% 100%", duration: 0.12, ease: "power2.out" })
      .to(svg, { scaleY: 1, scaleX: 1, duration: 0.8, ease: "elastic.out(1.3, 0.3)" });
    const beak = svg.querySelector(".goose-beak");
    if (beak) gsap.fromTo(beak, { rotation: 0 }, { rotation: -22, svgOrigin: "88 33", duration: 0.09, yoyo: true, repeat: 3 });

    const r = gooseEl.getBoundingClientRect();
    const b = document.createElement("div");
    b.className = "bubble";
    b.textContent = o.text || HONKS[Math.floor(Math.random() * HONKS.length)];
    b.style.position = "fixed";
    document.body.appendChild(b);
    gsap.set(b, { left: Math.min(r.left + r.width * 0.45, innerWidth - 200), top: Math.max(r.top - 64, 10), transformOrigin: "20% 100%" });
    gsap.timeline({ onComplete: () => b.remove() })
      .from(b, { scale: 0, rotation: -12, duration: 0.45, ease: "back.out(2.6)" })
      .to(b, { y: -14, autoAlpha: 0, duration: 0.35, ease: "power2.in" }, "+=0.9");
    KHS.confetti(r.left + r.width * 0.6, r.top + r.height * 0.25, o.loud ? 26 : 12);
  };

  function initHonkers() {
    document.querySelectorAll("[data-honk]:not([data-drag])").forEach((el) => {
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", "Poke the goose");
      el.addEventListener("click", () => KHS.honk(el));
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); KHS.honk(el); } });
    });
  }

  /* Goose eyes follow the pointer. */
  function initEyes() {
    const geese = gsap.utils.toArray("[data-eyes]");
    if (!geese.length || !FINE) return;
    window.addEventListener("pointermove", (e) => {
      geese.forEach((g) => {
        const eye = g.querySelector(".goose-eye");
        const svg = g.querySelector("svg");
        if (!eye || !svg) return;
        const r = svg.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        const ex = r.left + (79 / 120) * r.width;
        const ey = r.top + (28 / 140) * r.height;
        const a = Math.atan2(e.clientY - ey, e.clientX - ex);
        gsap.to(eye, { attr: { cx: 79 + Math.cos(a) * 1.9, cy: 28 + Math.sin(a) * 1.9 }, duration: 0.25, overwrite: "auto" });
      });
    }, { passive: true });
  }

  /* ---------------- reveals ---------------- */
  function initReveals() {
    if (REDUCED) return;
    gsap.utils.toArray("[data-split]").forEach((el) => {
      const chars = el.dataset.split === "chars";
      SplitText.create(el, {
        type: chars ? "words,chars" : "lines",
        mask: chars ? undefined : "lines",
        autoSplit: !chars,
        onSplit(self) {
          return gsap.from(chars ? self.chars : self.lines, {
            yPercent: chars ? 80 : 110,
            autoAlpha: chars ? 0 : 1,
            rotation: chars ? () => rand(-18, 18) : 0,
            duration: chars ? 0.7 : 0.95,
            ease: chars ? "back.out(2.2)" : "power4.out",
            stagger: chars ? 0.025 : 0.09,
            scrollTrigger: { trigger: el, start: "top 86%", once: true }
          });
        }
      });
    });

    gsap.utils.toArray("[data-reveal]").forEach((el) => {
      gsap.from(el, {
        y: 46, autoAlpha: 0, duration: 0.9, ease: "power3.out",
        delay: parseFloat(el.dataset.delay || 0),
        scrollTrigger: { trigger: el, start: "top 90%", once: true }
      });
    });

    gsap.utils.toArray("[data-pop]").forEach((el) => {
      gsap.from(el, {
        scale: 0, rotation: rand(-50, 50), duration: 1, ease: "elastic.out(1, 0.5)",
        delay: parseFloat(el.dataset.delay || 0),
        scrollTrigger: { trigger: el, start: "top 92%", once: true }
      });
    });
  }

  /* ---------------- footer ---------------- */
  function initFooter() {
    const footer = document.querySelector(".footer");
    if (!footer) return;
    const goose = footer.querySelector(".footer__goose");
    if (goose && !REDUCED) {
      gsap.from(goose, { yPercent: 120, rotation: -20, duration: 1.2, ease: "elastic.out(1, 0.55)", scrollTrigger: { trigger: footer, start: "top 75%", once: true } });
      gsap.to(goose.querySelector("svg"), { rotation: 4, transformOrigin: "50% 100%", duration: 1.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
    }
    const mark = footer.querySelector(".wordmark");
    if (mark && !REDUCED) {
      const split = SplitText.create(mark, { type: "chars" });
      gsap.from(split.chars, {
        yPercent: 110, rotation: () => rand(-30, 30), autoAlpha: 0, duration: 1, ease: "elastic.out(1, 0.6)",
        stagger: { each: 0.035, from: "random" },
        scrollTrigger: { trigger: mark, start: "top 95%", once: true }
      });
      split.chars.forEach((ch) => {
        ch.addEventListener("pointerenter", () => {
          gsap.timeline()
            .to(ch, { yPercent: -18, color: "#FFE14D", rotation: rand(-10, 10), duration: 0.2, ease: "power2.out", overwrite: "auto" })
            .to(ch, { yPercent: 0, rotation: 0, color: "#FFFFFF", duration: 0.9, ease: "elastic.out(1.2, 0.35)" });
        });
      });
    }
    const year = footer.querySelector("[data-year]");
    if (year) year.textContent = new Date().getFullYear();
  }

  /* ---------------- boot ---------------- */
  initSoundToggle();
  initMotionToggle();
  initLenis();
  initCursor();
  initNav();
  initTransitions();
  initHonkers();
  initEyes();

  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  KHS.fontsReady = ready;
  ready.then(() => {
    initReveals();
    initFooter();
    ScrollTrigger.refresh();
  });
})();
