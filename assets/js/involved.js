/* Get Involved page: tickets that deal themselves out, a sticker sheet you can
   peel and stick anywhere, a confetti donate button and an animated FAQ. */
(function () {
  const gsap = window.gsap;
  const KHS = window.KHS;
  if (!gsap || !KHS) return;
  const R = KHS.REDUCED;
  const rand = gsap.utils.random;

  /* ---- writing pencil in the header ---- */
  const pencil = document.querySelector(".head-pencil");
  if (pencil) {
    gsap.set(pencil, { rotation: -18 });
    if (!R) {
      gsap.from(pencil, { x: 300, rotation: 40, autoAlpha: 0, duration: 1.2, ease: "back.out(1.4)", delay: 0.3 });
      gsap.to(pencil, { x: "+=14", y: "-=6", rotation: -14, duration: 0.35, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.5 });
    }
  }

  /* ---- tickets ---- */
  const tickets = gsap.utils.toArray(".ticket");
  tickets.forEach((t) => {
    const rot = parseFloat(t.dataset.rot) || 0;
    gsap.set(t, { rotation: rot });
    if (R) return;
    t.addEventListener("pointerenter", () => gsap.to(t, { rotation: 0, y: -10, scale: 1.02, boxShadow: "8px 8px 0px #14161A", duration: 0.35, ease: "back.out(2)", overwrite: "auto" }));
    t.addEventListener("pointerleave", () => gsap.to(t, { rotation: rot, y: 0, scale: 1, boxShadow: "0px 0px 0px #14161A", duration: 0.7, ease: "elastic.out(1, 0.5)", overwrite: "auto" }));
  });
  if (!R && tickets.length) {
    gsap.set(tickets, { autoAlpha: 0 });
    ScrollTrigger.batch(tickets, {
      start: "top 88%", once: true,
      onEnter: (batch) => gsap.fromTo(batch,
        { autoAlpha: 0, y: 120, rotation: () => rand(-20, 20), scale: 0.9 },
        { autoAlpha: 1, y: 0, scale: 1, rotation: (i, el) => parseFloat(el.dataset.rot) || 0, duration: 0.9, ease: "back.out(1.5)", stagger: 0.1 })
    });
  }

  /* ---- peelable stickers ---- */
  const peels = gsap.utils.toArray(".peel");
  let z = 40;
  peels.forEach((p) => {
    const svg = p.querySelector("svg");
    Draggable.create(p, {
      type: "x,y",
      zIndexBoost: false,
      inertia: !R,
      onPress() {
        p.style.zIndex = ++z;
        p.closest(".sheet__slot").style.zIndex = z;
        if (R) return;
        gsap.to(p, { scale: 1.18, rotation: rand(-18, 18), duration: 0.25, ease: "back.out(3)" });
        gsap.to(svg, { filter: "drop-shadow(0 18px 14px rgba(20,22,26,0.28))", duration: 0.25 });
      },
      onDragStart() { KHS.popSound(0.6); },
      onRelease() {
        if (R) return;
        gsap.timeline()
          .to(p, { scale: 0.92, duration: 0.12, ease: "power2.out" })
          .to(p, { scale: 1, duration: 0.6, ease: "elastic.out(1.2, 0.4)" });
        gsap.to(svg, { filter: "drop-shadow(0 4px 4px rgba(20,22,26,0.18))", duration: 0.4 });
      },
      onDragEnd() { KHS.popSound(1.3); },
      onClick() { KHS.wiggle(p); KHS.popSound(); }
    });
  });
  if (!R && peels.length) {
    gsap.set(peels, { scale: 0 });
    ScrollTrigger.create({
      trigger: ".sheet", start: "top 80%", once: true,
      onEnter: () => gsap.to(peels, { scale: 1, rotation: () => rand(-10, 10), duration: 0.9, ease: "elastic.out(1, 0.5)", stagger: { each: 0.06, from: "random" } })
    });
  }

  const price = document.querySelector(".price");
  if (price && !R) {
    price.addEventListener("pointerenter", () => { gsap.to(price, { rotation: "+=360", duration: 0.9, ease: "back.out(1.4)" }); KHS.popSound(1.3); });
  }

  /* ---- donate ---- */
  const donate = document.querySelector(".donate-btn");
  if (donate) {
    donate.addEventListener("pointerenter", () => {
      const r = donate.getBoundingClientRect();
      KHS.confetti(r.left + r.width / 2, r.top, 10, 60);
    });
  }

  /* ---- FAQ ---- */
  gsap.utils.toArray(".faq__item").forEach((item) => {
    const q = item.querySelector(".faq__q");
    const a = item.querySelector(".faq__a");
    q.addEventListener("click", () => {
      const open = !item.classList.contains("is-open");
      item.classList.toggle("is-open", open);
      q.setAttribute("aria-expanded", String(open));
      gsap.to(a, { height: open ? "auto" : 0, duration: R ? 0 : 0.5, ease: open ? "power3.out" : "power3.inOut", onComplete: () => ScrollTrigger.refresh() });
      if (open) { KHS.popSound(1.1); if (!R) gsap.from(a.querySelector("p"), { y: -10, autoAlpha: 0, duration: 0.4, delay: 0.1 }); }
    });
  });
})();
