/* Home page: typewriter intro → headline → sticker burst, draggable stickers,
   poke-the-goose, click-to-stamp, velocity marquee, self-drawing numbers,
   swipeable book deck, typed mission, dropping flyers. */
(function () {
  const gsap = window.gsap;
  const KHS = window.KHS;
  if (!gsap || !KHS) return;
  const html = document.documentElement;
  const R = KHS.REDUCED;
  const rand = gsap.utils.random;

  const hero = document.querySelector(".hero");
  const stickers = gsap.utils.toArray(".hero .sticker");
  const goose = document.querySelector(".hero-goose");
  const poke = document.querySelector(".poke");
  const note = document.querySelector(".hand-note");

  stickers.forEach((s) => gsap.set(s, { rotation: parseFloat(s.dataset.rot) || 0 }));

  /* ---------------- hero intro ---------------- */
  function startIdle() {
    stickers.forEach(KHS.float);
    KHS.parallax(stickers);
    KHS.makeDraggable(stickers, hero);
  }

  function buildIntro(fast) {
    const title = hero.querySelector(".hero__title");
    const split = SplitText.create(title, { type: "words,chars" });
    const hl = title.querySelector(".hl");
    const kicker = hero.querySelector(".hero__kicker");
    const rest = hero.querySelectorAll(".hero__sub, .hero__ctas");
    const typeEl = hero.querySelector(".hero__type");
    const typed = hero.querySelector(".hero__typed");
    const caret = typeEl.querySelector(".caret");
    const text = "Changing perspectives, one page at a time.";

    // starting states (kept hidden by html.js-intro until the reveal)
    gsap.set(split.chars, { yPercent: 90, autoAlpha: 0, rotation: () => rand(-25, 25) });
    gsap.set(hl, { "--hl": 0 });
    gsap.set([kicker, ...rest], { autoAlpha: 0, y: 30 });
    gsap.set([poke, note], { autoAlpha: 0, scale: 0.4 });
    gsap.set(stickers, { scale: 0 });

    const blink = gsap.to(caret, { autoAlpha: 0, duration: 0.45, repeat: -1, yoyo: true, ease: "steps(1)" });
    const tl = gsap.timeline({ onComplete: startIdle });

    if (!fast) {
      const counter = { n: 0 };
      let last = 0;
      tl.to({}, { duration: 0.5 })
        .to(counter, {
          n: text.length, duration: text.length * 0.042, ease: "none",
          onUpdate() {
            const n = Math.round(counter.n);
            if (n !== last) { last = n; typed.textContent = text.slice(0, n); if (n % 2) KHS.tickSound(); }
          }
        })
        .to({}, { duration: 0.45 })
        .to(typeEl, { scale: 0.92, autoAlpha: 0, duration: 0.3, ease: "power2.in" });
    }

    tl.addLabel("reveal")
      .add(() => { blink.kill(); html.classList.remove("js-intro"); }, "reveal")
      .to(split.chars, {
        yPercent: 0, autoAlpha: 1, rotation: 0, duration: 0.8, ease: "back.out(2)",
        stagger: { each: 0.018, from: "start" }
      }, "reveal")
      .to(hl, { "--hl": 1, duration: 0.6, ease: "power3.inOut" }, "reveal+=0.45")
      .to(kicker, { autoAlpha: 1, y: 0, duration: 0.6, ease: "back.out(2)" }, "reveal+=0.2")
      .to(rest, { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.1 }, "reveal+=0.55");

    // sticker burst from the centre of the hero
    tl.add(() => {
      const hr = hero.getBoundingClientRect();
      const cx = hr.left + hr.width / 2;
      const cy = hr.top + hr.height / 2;
      stickers.forEach((s) => {
        const r = s.getBoundingClientRect();
        gsap.fromTo(s,
          { x: cx - (r.left + r.width / 2), y: cy - (r.top + r.height / 2), scale: 0, rotation: rand(-200, 200) },
          { x: 0, y: 0, scale: 1, rotation: parseFloat(s.dataset.rot) || 0, duration: rand(1, 1.4), ease: "elastic.out(1, 0.6)", delay: rand(0, 0.25) });
      });
      KHS.popSound(1.1);
    }, "reveal+=0.35");

    tl.to(poke, { autoAlpha: 1, scale: 1, rotation: -10, duration: 0.9, ease: "elastic.out(1, 0.45)" }, "reveal+=1.1")
      .to(note, { autoAlpha: 1, scale: 1, duration: 0.6, ease: "back.out(2)" }, "reveal+=1.25")
      .from(note.querySelector("path"), { drawSVG: 0, duration: 0.7, ease: "power2.inOut" }, "reveal+=1.4")
      .to({}, { duration: 0.6 });

    const skip = hero.querySelector(".skip-intro");
    const skipNow = () => {
      if (!html.classList.contains("js-intro")) return;
      tl.seek("reveal", false); // false = fire the callback that un-hides the hero
    };
    skip.addEventListener("click", skipNow);
    hero.addEventListener("pointerdown", (e) => { if (!e.target.closest(".skip-intro")) skipNow(); });
    return tl;
  }

  function initHero() {
    if (R) { html.classList.remove("js-intro"); return; }
    const seen = KHS.session.get("khs-intro-seen");
    KHS.session.set("khs-intro-seen", "1");
    KHS.fontsReady.then(() => buildIntro(!!seen));
  }

  /* ---- poke the goose ---- */
  const POKE_LINES = ["DON'T POKE<br>THE GOOSE", "HEY!", "told you.", "ok fine,<br>again?", "the goose<br>is reading"];
  let pokes = 0;
  function initPoke() {
    if (!poke) return;
    if (KHS.FINE && !R) {
      // the button shuffles away a little when the cursor gets close
      const xTo = gsap.quickTo(poke, "x", { duration: 0.5, ease: "power3" });
      const yTo = gsap.quickTo(poke, "y", { duration: 0.5, ease: "power3" });
      hero.addEventListener("pointermove", (e) => {
        const r = poke.getBoundingClientRect();
        const cx = r.left + r.width / 2 - gsap.getProperty(poke, "x");
        const cy = r.top + r.height / 2 - gsap.getProperty(poke, "y");
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 160) { xTo(-dx / d * (160 - d) * 0.3); yTo(-dy / d * (160 - d) * 0.3); }
        else { xTo(0); yTo(0); }
      });
    }
    poke.addEventListener("click", () => {
      pokes++;
      poke.innerHTML = POKE_LINES[pokes % POKE_LINES.length];
      KHS.honk(goose, { loud: true, text: pokes % 3 === 0 ? "HONK HONK HONK!" : "HONK!!" });
      if (R) return;
      gsap.fromTo(hero, { x: -10 }, { x: 0, duration: 0.6, ease: "elastic.out(2, 0.15)", clearProps: "x" });
      stickers.forEach((s, i) => {
        const f = s.querySelector(".sticker__float");
        gsap.timeline({ delay: i * 0.03 })
          .to(f, { y: -46, duration: 0.25, ease: "power2.out", overwrite: "auto" })
          .to(f, { y: 0, duration: 0.8, ease: "bounce.out" })
          .add(() => KHS.float(s));
      });
      gsap.fromTo(poke, { scale: 0.8 }, { scale: 1, duration: 0.8, ease: "elastic.out(1.2, 0.3)" });
    });
  }

  /* ---- click empty paper to stamp a sticker ---- */
  const STAMPS = ["star", "starPink", "starSage", "burst", "burstPink", "heart", "daisy"];
  function initStamps() {
    if (R) return;
    const stamps = [];
    hero.addEventListener("click", (e) => {
      if (html.classList.contains("js-intro")) return;
      if (e.target.closest("a, button, .sticker, h1, .hero__sub")) return;
      const hr = hero.getBoundingClientRect();
      const el = document.createElement("span");
      el.className = "stamp";
      el.innerHTML = KHS.stickers[STAMPS[Math.floor(Math.random() * STAMPS.length)]];
      hero.appendChild(el);
      gsap.set(el, { left: e.clientX - hr.left - 22, top: e.clientY - hr.top - 22 });
      gsap.fromTo(el, { scale: 0, rotation: rand(-90, 90) }, { scale: rand(0.8, 1.3), rotation: rand(-25, 25), duration: 0.7, ease: "elastic.out(1, 0.45)" });
      KHS.popSound();
      stamps.push(el);
      if (stamps.length > 24) {
        const old = stamps.shift();
        gsap.to(old, { scale: 0, duration: 0.3, onComplete: () => old.remove() });
      }
    });
  }

  /* ---------------- marquee that reacts to scroll speed ---------------- */
  function initMarquee() {
    const track = document.querySelector(".tape__track");
    if (!track) return;
    const group = track.querySelector(".tape__group");
    const clone = group.cloneNode(true);
    clone.querySelectorAll("[data-hydrated]").forEach((n) => n.removeAttribute("data-hydrated"));
    track.appendChild(clone);
    if (R) return;
    const loop = gsap.to(track, { xPercent: -50, duration: 26, ease: "none", repeat: -1 });
    gsap.to(".tape__star svg", { rotation: 360, duration: 6, ease: "none", repeat: -1, transformOrigin: "50% 50%" });
    ScrollTrigger.create({
      start: 0, end: "max",
      onUpdate(self) {
        const boost = gsap.utils.clamp(1, 6, 1 + Math.abs(self.getVelocity()) / 400);
        gsap.timeline({ overwrite: true })
          .to(loop, { timeScale: self.direction * boost, duration: 0.2 })
          .to(loop, { timeScale: self.direction, duration: 1.2 }, "+=0.15");
      }
    });
    gsap.fromTo(".tape__band", { rotation: -4 }, { rotation: 1, ease: "none", scrollTrigger: { trigger: ".tape", start: "top bottom", end: "bottom top", scrub: true } });
  }

  /* ---------------- hand-drawn numbers ---------------- */
  function initSteps() {
    const steps = gsap.utils.toArray(".step");
    if (!steps.length || R) return;
    steps.forEach((step, i) => {
      const paths = step.querySelectorAll(".handnum path");
      const sticker = step.querySelector(".step__sticker");
      const texts = step.querySelectorAll("h3, p");
      gsap.set(paths, { drawSVG: 0 });
      gsap.set(sticker, { scale: 0 });
      gsap.set(texts, { autoAlpha: 0, y: 24 });
      const tl = gsap.timeline({ scrollTrigger: { trigger: step, start: "top 82%", once: true }, delay: (i % 4) * 0.12 })
        .to(paths[0], { drawSVG: "100%", duration: 0.55, ease: "power2.inOut" })
        .to(paths[1], { drawSVG: "100%", duration: 0.5, ease: "power2.inOut" })
        .to(sticker, { scale: 1, rotation: rand(-20, 20), duration: 0.8, ease: "elastic.out(1, 0.45)" }, "-=0.2")
        .to(texts, { autoAlpha: 1, y: 0, stagger: 0.08, duration: 0.6, ease: "power3.out" }, "-=0.7");
      step.addEventListener("pointerenter", () => {
        if (tl.progress() < 1) return;
        gsap.fromTo(paths, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 0.6, stagger: 0.25, ease: "power2.inOut" });
        KHS.wiggle(sticker);
      });
    });
  }

  /* ---------------- book deck ---------------- */
  function initDeck() {
    const deck = document.querySelector(".deck");
    if (!deck) return;
    const cards = gsap.utils.toArray(".book-card", deck);
    const count = document.querySelector(".deck-count");
    let order = cards.slice();
    let busy = false;

    function slots() {
      const off = Math.min(deck.clientWidth * 0.27, 200);
      return [
        { x: 0, y: 0, rotation: 0, scale: 1 },
        { x: off, y: 36, rotation: 7, scale: 0.9 },
        { x: -off, y: 36, rotation: -7, scale: 0.9 }
      ];
    }
    function layout(dur) {
      const s = slots();
      order.forEach((c, i) => {
        c.style.zIndex = String(10 - i);
        c.setAttribute("aria-hidden", i === 0 ? "false" : "true");
        gsap.to(c, { ...s[Math.min(i, 2)], duration: dur === undefined ? 0.9 : dur, ease: "elastic.out(1, 0.75)", overwrite: "auto" });
      });
      if (count) count.textContent = String(cards.indexOf(order[0]) + 1).padStart(2, "0") + " / " + String(cards.length).padStart(2, "0");
    }
    function sendFrontToBack(dir) {
      if (busy) return;
      busy = true;
      const front = order[0];
      KHS.popSound(dir > 0 ? 1.2 : 0.9);
      gsap.to(front, {
        x: dir * (deck.clientWidth * 0.6 + 120), rotation: dir * 28, y: -30, duration: 0.38, ease: "power2.in", overwrite: "auto",
        onComplete() {
          order.push(order.shift());
          front.style.zIndex = "1";
          layout();
          gsap.delayedCall(0.25, () => { busy = false; });
        }
      });
    }
    function bringBackToFront() {
      if (busy) return;
      busy = true;
      const last = order[order.length - 1];
      order.unshift(order.pop());
      layout(0.6);
      last.style.zIndex = "20";
      KHS.popSound(0.9);
      gsap.fromTo(last, { x: -deck.clientWidth * 0.7, rotation: -28, y: -30 }, {
        x: 0, rotation: 0, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.4)", overwrite: "auto",
        onComplete() { layout(); busy = false; }
      });
    }

    document.querySelector('[data-deck="next"]').addEventListener("click", () => sendFrontToBack(1));
    document.querySelector('[data-deck="prev"]').addEventListener("click", bringBackToFront);

    Draggable.create(cards, {
      type: "x",
      zIndexBoost: false,
      minimumMovement: 6,
      onPress(e) { if (this.target !== order[0] || busy) this.endDrag(e); },
      onDrag() { gsap.set(this.target, { rotation: this.x / 14 }); },
      onRelease() {
        if (this.target !== order[0] || busy) return;
        if (Math.abs(this.x) > 110) sendFrontToBack(this.x > 0 ? 1 : -1);
        else layout();
      },
      onClick() {
        // clicking a card peeking out from behind brings it to the front
        const i = order.indexOf(this.target);
        if (i > 0 && !busy) { order = order.slice(i).concat(order.slice(0, i)); layout(); KHS.popSound(); }
      }
    });

    // 3D tilt on the front card
    if (KHS.FINE && !R) {
      deck.addEventListener("pointermove", (e) => {
        const front = order[0];
        const r = front.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        if (Math.abs(nx) > 0.7 || Math.abs(ny) > 0.7) return;
        gsap.to(front, { rotationY: nx * 16, rotationX: -ny * 12, transformPerspective: 1200, duration: 0.5, ease: "power3", overwrite: false });
      });
      deck.addEventListener("pointerleave", () => gsap.to(cards, { rotationX: 0, rotationY: 0, duration: 0.8, ease: "elastic.out(1, 0.5)", overwrite: false }));
    }

    // enter: cards start stacked and fan out
    order.forEach((c, i) => { c.style.zIndex = String(10 - i); });
    if (R) { layout(0); return; }
    gsap.set(cards, { x: 0, y: 120, rotation: 0, scale: 0.85, autoAlpha: 0 });
    ScrollTrigger.create({
      trigger: deck, start: "top 75%", once: true,
      onEnter() {
        gsap.to(cards, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power3.out" });
        gsap.delayedCall(0.35, () => layout(1.2));
      }
    });
    window.addEventListener("resize", () => layout(0.4));
  }

  /* ---------------- mission: typed on a notebook ---------------- */
  function initMission() {
    const nb = document.querySelector(".notebook");
    if (!nb || R) return;
    const p = nb.querySelector(".typed");
    const split = SplitText.create(p, { type: "words,chars" });
    const caret = document.createElement("span");
    caret.className = "caret";
    gsap.set(split.chars, { autoAlpha: 0 });
    split.chars[0].parentNode.insertBefore(caret, split.chars[0]);
    const blink = gsap.to(caret, { autoAlpha: 0, repeat: -1, yoyo: true, duration: 0.4, ease: "steps(1)" });

    gsap.fromTo(nb, { rotation: -9, y: 80 }, { rotation: -2, y: 0, ease: "none", scrollTrigger: { trigger: nb, start: "top bottom", end: "center center", scrub: 0.6 } });
    gsap.fromTo(nb.querySelector(".notebook__pencil"), { rotation: -50, x: 60 }, { rotation: -28, x: 0, ease: "none", scrollTrigger: { trigger: nb, start: "top bottom", end: "bottom center", scrub: 0.6 } });
    gsap.from(nb.querySelector(".notebook__star"), { scale: 0, rotation: -120, duration: 1, ease: "elastic.out(1, 0.5)", scrollTrigger: { trigger: nb, start: "top 70%", once: true } });

    ScrollTrigger.create({
      trigger: nb, start: "top 65%", once: true,
      onEnter() {
        blink.pause();
        gsap.set(caret, { autoAlpha: 1 });
        gsap.to(split.chars, {
          autoAlpha: 1, duration: 0.01, ease: "none",
          stagger: {
            each: 0.022,
            onStart() {
              this.targets()[0].after(caret);
              if (Math.random() > 0.6) KHS.tickSound();
            }
          },
          onComplete: () => blink.restart()
        });
      }
    });

    gsap.utils.toArray(".value").forEach((v, i) => {
      const badge = v.querySelector(".value__badge");
      gsap.from(v, { x: 60, autoAlpha: 0, duration: 0.8, delay: i * 0.12, ease: "power3.out", scrollTrigger: { trigger: v, start: "top 88%", once: true } });
      gsap.from(badge, { scale: 0, rotation: -180, duration: 1, delay: i * 0.12 + 0.15, ease: "elastic.out(1, 0.5)", scrollTrigger: { trigger: v, start: "top 88%", once: true } });
      v.addEventListener("pointerenter", () => KHS.wiggle(badge));
    });
  }

  /* ---------------- get involved flyers ---------------- */
  function initFlyers() {
    const flyers = gsap.utils.toArray(".flyer");
    if (!flyers.length) return;
    const squiggle = document.querySelector(".squiggle path");
    flyers.forEach((f) => gsap.set(f, { rotation: parseFloat(f.dataset.rot) || 0, y: parseFloat(f.dataset.y) || 0 }));
    if (R) return;
    if (squiggle) gsap.from(squiggle, { drawSVG: 0, duration: 1.2, ease: "power2.inOut", scrollTrigger: { trigger: squiggle, start: "top 85%", once: true } });

    flyers.forEach((f, i) => {
      const tape = f.querySelector(".flyer__tape");
      const rot = parseFloat(f.dataset.rot) || 0;
      const y = parseFloat(f.dataset.y) || 0;
      gsap.timeline({ scrollTrigger: { trigger: ".flyers", start: "top 80%", once: true }, delay: i * 0.15 })
        .fromTo(f, { y: y - 220, rotation: rand(-30, 30), autoAlpha: 0 }, { y: y, rotation: rot, autoAlpha: 1, duration: 0.9, ease: "back.out(1.6)" })
        .from(tape, { scaleX: 0, duration: 0.35, ease: "power2.out" }, "-=0.25");
      f.addEventListener("pointerenter", () => gsap.to(f, { rotation: 0, y: y - 12, scale: 1.03, boxShadow: "12px 12px 0px #14161A", duration: 0.4, ease: "back.out(2)", overwrite: "auto" }));
      f.addEventListener("pointerleave", () => gsap.to(f, { rotation: rot, y: y, scale: 1, boxShadow: "0px 0px 0px #14161A", duration: 0.7, ease: "elastic.out(1, 0.5)", overwrite: "auto" }));
    });

    const price = document.querySelector(".price");
    if (price) {
      price.addEventListener("pointerenter", () => { gsap.to(price, { rotation: "+=360", duration: 0.9, ease: "back.out(1.4)" }); KHS.popSound(1.3); });
      price.addEventListener("click", () => {
        const r = price.getBoundingClientRect();
        KHS.confetti(r.left + r.width / 2, r.top + r.height / 2, 14);
      });
    }
  }

  initHero();
  initPoke();
  initStamps();
  initMarquee();
  initSteps();
  initDeck();
  initFlyers();
  KHS.fontsReady.then(() => { initMission(); ScrollTrigger.refresh(); });
})();
