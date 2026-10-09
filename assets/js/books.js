/* Books page: books drop onto the shelf and spines lift on hover. Click a spine
   and the book slides off the shelf, turns to show its cover, swings open and
   becomes a flip-book of the real pages: drag or tap a page, use the arrow keys,
   or scrub through. Like buttons burst into hearts. */
(function () {
  const gsap = window.gsap;
  const KHS = window.KHS;
  if (!gsap || !KHS) return;
  const R = KHS.REDUCED;
  const rand = gsap.utils.random;

  /* slug: the PDF's name in assets/books/; its pages and spine are made by
     `python tools/build_books.py` (see the README). pages: how many pages it has. */
  const BOOKS = {
    rambutan: {
      slug: "rambutan-tree", pages: 24,
      num: "KHS BOOK 0001", title: "The Girl Under the Rambutan Tree", by: "by Nadith Ranasinghe",
      cta: ["See it on Instagram", "https://www.instagram.com/kids.health.shelf/"]
    },
    nobody: {
      slug: "nobody-looks-like-me", pages: 16,
      num: "KHS BOOK 0002", title: "Nobody Looks Like Me!", by: "by Emily Leha · pictures by Amy Shi & Sophie Smith",
      cta: ["See it on Instagram", "https://www.instagram.com/kids.health.shelf/"]
    },
    microville: {
      slug: "microville", pages: 24,
      num: "KHS BOOK 0003", title: "MicroVille", by: "by Bahareh Rahimi Shahmirzadi",
      cta: ["See it on Instagram", "https://www.instagram.com/kids.health.shelf/"]
    },
    soon: {
      slug: "", pages: 0,
      num: "KHS BOOK 0004", title: "This spot is saved", by: "by someone like you",
      cta: ["See open roles", "involved.html"],
      html: [
        `<div class="cover cover--pink"><span class="cover__title">This spot is saved</span><span class="cover__by">by someone like you</span><span class="cover__art">${KHS.stickers.question}</span></div>`,
        `<div class="leaf__art">${KHS.stickers.pencil}</div><span class="hand">a Kids Health Shelf book</span>`,
        `<span class="kicker">KHS BOOK 0004</span><h4>Your story could go on this page.</h4>
         <p>The next Kids Health Shelf book hasn't been written yet. We're looking for authors and illustrators on a rolling basis, and no experience is needed.</p>
         <div class="book-card__facts"><div class="fact"><b>Looking for:</b><span>writers &amp; artists</span></div><div class="fact"><b>Experience:</b><span>not required</span></div></div>
         <a class="btn btn--blue" href="involved.html">See open roles</a>`,
        `<div class="cover cover--pink" style="justify-content:center;text-align:center"><span class="hand" style="color:var(--ink)">psst… book four needs an author</span></div>`
      ]
    }
  };
  const RATIO = 612 / 792; // the books are US-letter portrait
  const pad2 = (n) => String(n).padStart(2, "0");
  const pageSrc = (b, i) => `assets/books/pages/${b.slug}/${pad2(i + 1)}.webp`;
  const spineSrc = (b) => `assets/books/spines/${b.slug}.webp`;

  /* ---------------- shelf ---------------- */
  const spines = gsap.utils.toArray(".spine");
  const shelfStickers = gsap.utils.toArray(".shelf-sticker, .book-stack");

  if (!R) {
    gsap.set(spines, { autoAlpha: 0 });
    gsap.set(shelfStickers, { scale: 0 });
    ScrollTrigger.create({
      trigger: ".bookshelf", start: "top 85%", once: true,
      onEnter() {
        gsap.fromTo(spines, { y: -520, rotation: () => rand(-25, 25), autoAlpha: 1 }, { y: 0, rotation: 0, duration: 1.1, ease: "bounce.out", stagger: 0.12 });
        gsap.to(shelfStickers, { scale: 1, rotation: 0, duration: 1, delay: 0.7, ease: "elastic.out(1, 0.5)", stagger: 0.15 });
        gsap.from(".shelf-hint", { autoAlpha: 0, y: 20, delay: 1.2, duration: 0.6 });
      }
    });
  }

  spines.forEach((s) => {
    s.addEventListener("pointerenter", () => {
      if (R || s.classList.contains("is-out")) return;
      gsap.to(s, { y: -26, rotation: rand(-4, 4), duration: 0.45, ease: "back.out(3)", overwrite: "auto" });
      KHS.popSound(rand(1, 1.5));
    });
    s.addEventListener("pointerleave", () => gsap.to(s, { y: 0, rotation: 0, duration: 0.8, ease: "elastic.out(1, 0.4)", overwrite: "auto" }));
    s.addEventListener("click", () => openBook(s.dataset.book, s));
  });

  // the "Read the book" buttons open the same reader, starting from that book's cover
  document.querySelectorAll("[data-read]").forEach((a) => {
    a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const art = a.closest(".highlight");
      openBook(a.dataset.read, (art && art.querySelector(".cover")) || a);
    });
  });

  /* ---------------- sound: a papery swish for each page ---------------- */
  let swishBuf = null;
  function flipSound(soft) {
    const a = KHS.audio && KHS.audio();
    if (!a) return;
    if (!swishBuf) {
      const len = Math.floor(a.sampleRate * 0.4);
      swishBuf = a.createBuffer(1, len, a.sampleRate);
      const d = swishBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = a.currentTime;
    const src = a.createBufferSource();
    src.buffer = swishBuf;
    src.playbackRate.value = rand(0.85, 1.15);
    const bp = a.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.exponentialRampToValueAtTime(3200, t + 0.18);
    bp.frequency.exponentialRampToValueAtTime(1400, t + 0.36);
    const g = a.createGain();
    const peak = soft ? 0.05 : 0.11;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.06);
    g.gain.exponentialRampToValueAtTime(peak * 0.5, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    src.connect(bp); bp.connect(g); g.connect(a.destination);
    src.start(t); src.stop(t + 0.4);
  }

  /* ---------------- reader ---------------- */
  const reader = document.querySelector(".reader");
  const stage = reader.querySelector(".reader__stage");
  const flipbook = reader.querySelector(".flipbook");
  const closed = reader.querySelector(".closed-book");
  const scrim = reader.querySelector(".reader__scrim");
  const head = reader.querySelector(".reader__head");
  const bar = reader.querySelector(".reader__bar");
  const tip = reader.querySelector(".reader__tip");
  const closeBtn = reader.querySelector(".reader__close");
  const field = (k) => reader.querySelector(`[data-b="${k}"]`);
  const scrub = field("scrub");
  const count = field("count");
  const prevBtn = reader.querySelector('[data-turn="-1"]');
  const nextBtn = reader.querySelector('[data-turn="1"]');
  count.setAttribute("aria-live", "polite");

  let book = null;      // the open BOOKS entry
  let pages = [];       // [{src} | {html}]
  let leaves = [];      // [{el, a}] a = angle, 0 (on the right) to -180 (turned over)
  let single = false;   // one page at a time on narrow screens
  let f = 0;            // how many leaves are turned
  let pw = 400, ph = 518;
  let opener = null;
  let open = false;
  let busy = false;     // opening / closing animation running
  let flipTl = null;
  let cast = { r: null, l: null };
  let bases = [];

  const maxF = () => (single ? pages.length - 1 : Math.floor(pages.length / 2));
  // closed at the front: the cover sits alone on the right, so slide the book left to centre it
  function bookX(n) {
    if (single) return 0;
    if (n <= 0) return -pw / 2;
    if (n >= maxF() && pages.length % 2 === 0) return pw / 2;
    return 0;
  }

  function layout() {
    single = innerWidth <= 720;
    reader.classList.toggle("is-single", single);
    const r = stage.getBoundingClientRect();
    const room = single ? r.width - 8 : r.width / 2 - 14;
    pw = Math.floor(Math.max(120, Math.min(room, (r.height - 6) * RATIO)));
    ph = Math.round(pw / RATIO);
    reader.style.setProperty("--pw", pw + "px");
    reader.style.setProperty("--ph", ph + "px");
  }

  function faceHTML(p, i) {
    if (!p) return "";
    if (p.html) return `<div class="leaf__html">${p.html}</div>`;
    return `<img data-src="${p.src}" alt="Page ${i + 1}" decoding="async" draggable="false">`;
  }

  function build() {
    flipbook.innerHTML =
      '<div class="flipbook__base flipbook__base--l"></div><div class="flipbook__base flipbook__base--r"></div>' +
      '<div class="flipbook__cast"></div><div class="flipbook__cast flipbook__cast--l"></div>' +
      '<div class="flipbook__hotspot flipbook__hotspot--prev" data-cursor="back"></div>' +
      '<div class="flipbook__hotspot flipbook__hotspot--next" data-cursor="turn!"></div>';
    cast = { r: flipbook.querySelector(".flipbook__cast:not(.flipbook__cast--l)"), l: flipbook.querySelector(".flipbook__cast--l") };
    bases = flipbook.querySelectorAll(".flipbook__base");
    if (single) bases[1].classList.add("is-on");
    leaves = [];
    const n = single ? pages.length : Math.ceil(pages.length / 2);
    for (let i = 0; i < n; i++) {
      const fi = single ? i : i * 2;
      const el = document.createElement("div");
      el.className = "leaf" + (i === 0 ? " is-cover" : "");
      el.innerHTML =
        `<div class="leaf__face leaf__face--front">${faceHTML(pages[fi], fi)}</div>` +
        `<div class="leaf__face leaf__face--back">${single ? "" : faceHTML(pages[fi + 1], fi + 1)}</div>`;
      flipbook.appendChild(el);
      leaves.push({ el, a: 0 });
    }
  }

  function load(from, to) {
    for (let i = Math.max(0, from); i <= Math.min(pages.length - 1, to); i++) {
      const li = single ? i : Math.floor(i / 2);
      const side = single || i % 2 === 0 ? "front" : "back";
      const img = leaves[li] && leaves[li].el.querySelector(`.leaf__face--${side} img[data-src]`);
      if (img) { img.src = img.dataset.src; img.removeAttribute("data-src"); }
    }
  }
  const loadAround = (n) => (single ? load(n - 2, n + 3) : load(n * 2 - 4, n * 2 + 5));

  /* put leaf i at angle a (0 = lying on the right, -180 = turned onto the left) */
  function setLeaf(i, a, moving) {
    const L = leaves[i];
    L.a = a;
    const p = -a / 180;
    const el = L.el;
    // a little give as the page rises, so it reads as paper rather than a flat card
    const bend = Math.sin(p * Math.PI);
    el.style.transform = `perspective(${pw * 6.5}px) rotateY(${a}deg) scaleX(${1 - bend * 0.035})`;
    el.style.setProperty("--shade-f", (Math.min(1, p * 2) * 0.85).toFixed(3));
    el.style.setProperty("--shade-b", (Math.min(1, (1 - p) * 2) * 0.85).toFixed(3));
    el.style.zIndex = moving ? 300 + i : p > 0.5 ? i + 1 : leaves.length - i;
    if (single) {
      el.style.visibility = p > 0.98 && !moving ? "hidden" : "visible";
      el.style.opacity = p > 0.75 ? Math.max(0, (1 - p) * 4).toFixed(3) : 1;
    }
    // the page block's edges show on whichever side has pages lying on it
    if (!single && i === 0) bases[0].classList.toggle("is-on", p > 0.5);
    if (!single && i === leaves.length - 1) bases[1].classList.toggle("is-on", p < 0.5);
    if (moving) {
      cast.r.style.opacity = ((p < 0.5 ? bend : bend * (1 - p) * 2) * (single ? 0.6 : 0.9)).toFixed(3);
      cast.l.style.opacity = single ? 0 : ((p > 0.5 ? bend : 0) * 0.9).toFixed(3);
    }
  }

  function settle() {
    leaves.forEach((L, i) => setLeaf(i, i < f ? -180 : 0));
    cast.r.style.opacity = 0;
    cast.l.style.opacity = 0;
    gsap.set(flipbook, { x: bookX(f) });
    ui();
  }

  function ui() {
    const m = maxF();
    prevBtn.disabled = f <= 0;
    nextBtn.disabled = f >= m;
    scrub.max = m;
    scrub.value = f;
    const n = pages.length;
    let label;
    if (single) label = f === 0 ? `Cover · 1 of ${n}` : `Page ${f + 1} of ${n}`;
    else if (f === 0) label = `Cover · ${n} pages`;
    else if (f === m && n % 2 === 0) label = `Back cover · page ${n} of ${n}`;
    else label = `Pages ${f * 2}–${Math.min(n, f * 2 + 1)} of ${n}`;
    count.textContent = label;
    flipbook.querySelector(".flipbook__hotspot--prev").hidden = f <= 0;
    flipbook.querySelector(".flipbook__hotspot--next").hidden = f >= m;
    // only links on the pages facing up can be reached with the keyboard
    leaves.forEach((L, i) => L.el.querySelectorAll("a").forEach((a) => a.setAttribute("tabindex", i === f || i === f - 1 ? "0" : "-1")));
  }

  /* turn to spread t; several leaves riffle over together */
  function flipTo(t, opts) {
    const o = opts || {};
    t = gsap.utils.clamp(0, maxF(), Math.round(t));
    if (flipTl) flipTl.progress(1);
    if (t === f) return;
    const fwd = t > f;
    const list = [];
    if (fwd) for (let i = f; i < t; i++) list.push(i);
    else for (let i = f - 1; i >= t; i--) list.push(i);
    const many = list.length > 1;
    const dur = o.duration || (many ? 0.62 : 0.95);
    const gap = many ? Math.min(0.09, 0.9 / list.length) : 0;
    f = t;
    loadAround(t);
    ui();
    if (R) { settle(); return; }
    flipTl = gsap.timeline({ onComplete: () => { flipTl = null; settle(); } });
    list.forEach((i, k) => {
      const st = { a: leaves[i].a };
      flipTl.to(st, {
        a: fwd ? -180 : 0, duration: dur, ease: "power2.inOut",
        onStart: () => { if (k < 5) flipSound(k > 0); },
        onUpdate: () => setLeaf(i, st.a, true),
        onComplete: () => setLeaf(i, st.a, false)
      }, k * gap);
    });
    flipTl.to(flipbook, { x: bookX(t), duration: dur + gap * (list.length - 1), ease: "power2.inOut" }, 0);
  }
  const turn = (d) => { if (!busy) flipTo(f + d); };

  /* ---------------- dragging a page ---------------- */
  let drag = null;
  flipbook.addEventListener("pointerdown", (e) => {
    if (busy || e.button !== 0 || e.target.closest("a, button")) return;
    if (flipTl) flipTl.progress(1);
    const r = flipbook.getBoundingClientRect();
    const fwd = e.clientX > r.left + r.width / 2;
    if (fwd ? f >= maxF() : f <= 0) return;
    drag = { x: e.clientX, t: e.timeStamp, fwd, i: fwd ? f : f - 1, moved: false, v: 0, p: fwd ? 0 : 1 };
    flipbook.setPointerCapture(e.pointerId);
  });
  flipbook.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 6) return;
    if (!drag.moved) { drag.moved = true; loadAround(drag.fwd ? f + 1 : f - 1); flipSound(true); }
    const span = single ? pw * 1.2 : pw * 1.6;
    const p = gsap.utils.clamp(0, 1, drag.fwd ? -dx / span : 1 - dx / span);
    drag.v = (e.clientX - (drag.lastX || drag.x)) / Math.max(8, e.timeStamp - (drag.lastT || drag.t));
    drag.lastX = e.clientX; drag.lastT = e.timeStamp;
    drag.p = p;
    setLeaf(drag.i, -180 * p, true);
    // the closed book slides to the middle as its cover opens (and back again)
    const a = bookX(drag.fwd ? f : f - 1), b = bookX(drag.fwd ? f + 1 : f);
    gsap.set(flipbook, { x: a + (b - a) * p });
  });
  const endDrag = (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.moved) {
      if (e.type === "pointerup") turn(d.fwd ? 1 : -1);
      return;
    }
    // a quick flick finishes the turn even if the page has not crossed the middle
    const flick = d.fwd ? d.v < -0.45 : d.v > 0.45;
    const turned = d.fwd ? d.p > 0.4 || flick : d.p < 0.6 || flick;
    // the leaf ends turned over (-180) or lying on the right (0)
    const over = d.fwd ? turned : !turned;
    f = d.fwd ? (turned ? f + 1 : f) : (turned ? f - 1 : f);
    const st = { a: leaves[d.i].a };
    const end = over ? -180 : 0;
    const dur = 0.25 + (Math.abs(end - st.a) / 180) * 0.55;
    loadAround(f);
    ui();
    flipTl = gsap.timeline({ onComplete: () => { flipTl = null; settle(); } })
      .to(st, { a: end, duration: dur, ease: "power2.out", onUpdate: () => setLeaf(d.i, st.a, true) })
      .to(flipbook, { x: bookX(f), duration: dur, ease: "power2.out" }, 0);
    if (turned) flipSound();
  };
  flipbook.addEventListener("pointerup", endDrag);
  flipbook.addEventListener("pointercancel", endDrag);

  prevBtn.addEventListener("click", () => turn(-1));
  nextBtn.addEventListener("click", () => turn(1));
  scrub.addEventListener("input", () => { if (!busy) flipTo(Number(scrub.value)); });

  /* ---------------- open / close ---------------- */
  function fill(id) {
    book = BOOKS[id];
    field("num").textContent = book.num;
    field("title").textContent = book.title;
    field("by").textContent = book.by;
    const cta = field("cta");
    cta.textContent = book.cta[0];
    cta.href = book.cta[1];
    if (/^https?:/.test(book.cta[1])) { cta.target = "_blank"; cta.rel = "noopener"; } else { cta.removeAttribute("target"); cta.removeAttribute("rel"); }
    const pdf = field("pdf");
    pdf.hidden = !book.slug;
    if (book.slug) { pdf.href = `assets/books/${book.slug}.pdf`; pdf.setAttribute("aria-label", `Download ${book.title} as a PDF`); }
    pages = book.html ? book.html.map((html) => ({ html })) : Array.from({ length: book.pages }, (_, i) => ({ src: pageSrc(book, i) }));
  }

  // the 3D closed book used for the trip from the shelf: cover, spine, page edges, back
  function dressClosedBook() {
    const face = (p) => (p.html ? `<div class="leaf__html">${p.html}</div>` : `<img src="${p.src}" alt="" draggable="false">`);
    closed.innerHTML =
      `<div class="closed-book__back">${face(pages[pages.length - 1])}</div>` +
      `<div class="closed-book__edge"></div>` +
      `<div class="closed-book__spine${book.slug ? "" : " closed-book__spine--ghost"}"${book.slug ? ` style="background-image:url(${spineSrc(book)})"` : ""}></div>` +
      `<div class="closed-book__front">${face(pages[0])}</div>`;
  }

  const ready = (src) => new Promise((res) => {
    if (!src) return res();
    const img = new Image();
    img.onload = img.onerror = () => res();
    img.src = src;
    setTimeout(res, 900);
  });

  async function openBook(id, from) {
    if (open || busy || !BOOKS[id]) return;
    open = true;
    busy = true;
    opener = from;
    fill(id);
    reader.classList.add("is-open");
    if (KHS.lenis) KHS.lenis.stop();
    document.documentElement.style.overflow = "hidden";
    layout();
    build();
    f = 0;
    loadAround(0);
    settle();
    KHS.popSound(0.9);

    if (R) {
      flipTo(Math.min(1, maxF()));
      busy = false;
      closeBtn.focus();
      return;
    }

    const isSpine = !!from && from.classList.contains("spine");
    const fr = from ? from.getBoundingClientRect() : null;
    const depth = isSpine ? Math.min(ph * 0.34, ph * (fr.width / fr.height)) : Math.max(14, ph * 0.035);
    reader.style.setProperty("--depth", depth + "px");
    dressClosedBook();
    gsap.set(flipbook, { autoAlpha: 0 });
    gsap.set([head, bar], { autoAlpha: 0 });
    await ready(pages[0].src);

    const sr = stage.getBoundingClientRect();
    const persp = pw * 5;
    // the front face sits depth/2 nearer the viewer, so shrink it to land exactly on the flat cover
    const land = (persp - depth / 2) / persp;
    const start = fr
      ? { x: fr.left + fr.width / 2 - (sr.left + sr.width / 2), y: fr.top + fr.height / 2 - (sr.top + sr.height / 2), scale: fr.height / ph, rotationY: isSpine ? 90 : -8, rotationZ: isSpine ? 0 : -4 }
      : { x: 0, y: 120, scale: 0.5, rotationY: 40, rotationZ: 0 };
    if (isSpine) { from.classList.add("is-out"); gsap.killTweensOf(from); gsap.set(from, { y: 0, rotation: 0 }); }

    gsap.set(closed, { visibility: "visible", transformPerspective: persp });
    gsap.timeline({ onComplete: () => { busy = false; closeBtn.focus(); hint(); } })
      .fromTo(scrim, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 })
      .fromTo(closed, { ...start, autoAlpha: 1 }, {
        keyframes: [
          // up off the shelf first…
          { y: start.y - 60, scale: start.scale * 1.05, duration: 0.3, ease: "power2.out" },
          // …then towards you, turning to show the cover
          { x: 0, y: 0, scale: land, rotationY: 0, rotationZ: 0, duration: 0.95, ease: "power3.inOut" }
        ]
      }, 0)
      .fromTo([head, bar], { autoAlpha: 0, y: (i) => (i ? 30 : -20) }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.08 }, 0.55)
      .add(() => {
        gsap.set(closed, { visibility: "hidden" });
        gsap.set(flipbook, { autoAlpha: 1 });
        flipTo(1, { duration: 1.15 });
      }, 1.3)
      .to({}, { duration: 1.15 });
  }

  function hint() {
    if (KHS.session.get("khs-reader-tip")) return;
    KHS.session.set("khs-reader-tip", "1");
    // pin the tip to the bottom-right corner of the right-hand page
    const b = flipbook.getBoundingClientRect();
    const rr = reader.getBoundingClientRect();
    const w = tip.offsetWidth;
    gsap.set(tip, { x: Math.min(b.right - rr.left - w * 0.7, rr.width - w - 12), y: b.bottom - rr.top - 34, rotation: -3 });
    gsap.timeline()
      .fromTo(tip, { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: "back.out(2.4)", delay: 0.3 })
      .to(tip, { autoAlpha: 0, y: "-=10", duration: 0.35 }, "+=3.2");
  }

  function closeBook() {
    if (!open || busy) return;
    busy = true;
    if (flipTl) flipTl.progress(1);
    const spineFrom = opener && opener.classList.contains("spine") ? opener : null;
    const done = () => {
      reader.classList.remove("is-open");
      gsap.set([closed, flipbook, scrim, head, bar, tip], { clearProps: "all" });
      flipbook.innerHTML = "";
      closed.innerHTML = "";
      document.documentElement.style.overflow = "";
      if (KHS.lenis) KHS.lenis.start();
      open = false;
      busy = false;
      if (spineFrom) {
        spineFrom.classList.remove("is-out");
        if (!R) gsap.fromTo(spineFrom, { y: -30 }, { y: 0, duration: 0.7, ease: "bounce.out" });
      }
      if (opener) opener.focus({ preventScroll: true });
    };
    if (R) { done(); return; }

    const sr = stage.getBoundingClientRect();
    const fr = opener ? opener.getBoundingClientRect() : null;
    const onScreen = fr && fr.bottom > 0 && fr.top < innerHeight && fr.width > 0;
    const persp = pw * 5;
    const depth = parseFloat(reader.style.getPropertyValue("--depth")) || 20;
    const land = (persp - depth / 2) / persp;
    const tl = gsap.timeline({ onComplete: done });
    // riffle back to the cover, then the closed book goes home
    const back = f;
    if (back > 0) {
      const dur = back > 1 ? 0.5 : 0.75;
      tl.add(() => flipTo(0, { duration: dur }));
      tl.to({}, { duration: dur + (back > 1 ? Math.min(0.09, 0.9 / back) * (back - 1) : 0) + 0.02 });
    }
    tl.add(() => {
      gsap.set(closed, { visibility: "visible", autoAlpha: 1, x: 0, y: 0, scale: land, rotationY: 0, rotationZ: 0, transformPerspective: persp });
      gsap.set(flipbook, { autoAlpha: 0 });
    });
    if (onScreen) {
      tl.to(closed, {
        x: fr.left + fr.width / 2 - (sr.left + sr.width / 2),
        y: fr.top + fr.height / 2 - (sr.top + sr.height / 2),
        scale: fr.height / ph, rotationY: spineFrom ? 90 : 0, duration: 0.85, ease: "power3.inOut"
      });
      if (!spineFrom) tl.to(closed, { autoAlpha: 0, duration: 0.2 }, "-=0.15");
    } else {
      tl.to(closed, { y: 160, scale: 0.5, rotationZ: 8, autoAlpha: 0, duration: 0.5, ease: "power2.in" });
    }
    tl.to([head, bar], { autoAlpha: 0, duration: 0.3 }, "<")
      .to(scrim, { autoAlpha: 0, duration: 0.45 }, "-=0.45");
  }

  reader.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeBook));
  document.addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "Escape") closeBook();
    if (e.target === scrub) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); turn(1); }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); turn(-1); }
    if (e.key === "Home") { e.preventDefault(); if (!busy) flipTo(0); }
    if (e.key === "End") { e.preventDefault(); if (!busy) flipTo(maxF()); }
    if (e.key === "Tab") {
      // keep focus inside the open book
      const fs = Array.from(reader.querySelectorAll("button:not(:disabled), a[href]:not([tabindex='-1']), input")).filter((el) => !el.hidden && el.offsetParent);
      const first = fs[0], last = fs[fs.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  let resizeT = 0;
  window.addEventListener("resize", () => {
    if (!open || busy) return;
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (flipTl) flipTl.progress(1);
      const was = single;
      // keep the same page in view when switching between single pages and spreads
      const page = single ? f : Math.max(0, f * 2 - 1);
      layout();
      if (was !== single) {
        build();
        f = gsap.utils.clamp(0, maxF(), single ? page : Math.ceil(page / 2));
      }
      loadAround(f);
      settle();
    }, 120);
  });

  // books.html?read=microville (the covers on the Team page) opens that book straight away
  const wanted = new URLSearchParams(location.search).get("read");
  if (BOOKS[wanted]) setTimeout(() => openBook(wanted, null), R ? 0 : 900);

  /* ---------------- likes ---------------- */
  gsap.utils.toArray(".like-btn").forEach((btn) => {
    const likes = btn.parentElement.querySelector("[data-likes]");
    let n = 0;
    btn.addEventListener("click", () => {
      n++;
      likes.textContent = n;
      btn.classList.add("is-liked");
      btn.setAttribute("aria-pressed", "true");
      gsap.fromTo(btn, { scale: 0.6 }, { scale: 1, duration: 0.8, ease: "elastic.out(1.4, 0.3)" });
      const r = btn.getBoundingClientRect();
      KHS.confetti(r.left + r.width / 2, r.top + r.height / 2, 8, 50);
      KHS.popSound(1 + Math.min(n, 10) * 0.08);
    });
  });

  /* posts tilt gently with the pointer */
  if (KHS.FINE && !R) {
    gsap.utils.toArray(".post").forEach((post) => {
      post.addEventListener("pointermove", (e) => {
        const r = post.getBoundingClientRect();
        gsap.to(post, { rotationY: ((e.clientX - r.left) / r.width - 0.5) * 10, rotationX: -((e.clientY - r.top) / r.height - 0.5) * 8, transformPerspective: 1100, duration: 0.5, ease: "power3" });
      });
      post.addEventListener("pointerleave", () => gsap.to(post, { rotationX: 0, rotationY: 0, duration: 0.9, ease: "elastic.out(1, 0.5)" }));
    });
  }
})();
