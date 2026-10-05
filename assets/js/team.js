/* Team page: a pinboard of polaroids you can drag around, throw, and flip. */
(function () {
  const gsap = window.gsap;
  const KHS = window.KHS;
  if (!gsap || !KHS) return;
  const R = KHS.REDUCED;
  const rand = gsap.utils.random;

  const board = document.querySelector(".board");
  if (!board) return;
  const cards = gsap.utils.toArray(".polaroid", board);
  const stickers = gsap.utils.toArray(".board-sticker", board);

  function place() {
    const narrow = board.clientWidth < 760;
    cards.forEach((c, i) => {
      const x = narrow ? (i % 2) * 50 + 3 : parseFloat(c.dataset.x);
      const y = narrow ? Math.floor(i / 2) * 31 + 7 : parseFloat(c.dataset.y);
      c.style.left = x + "%";
      c.style.top = y + "%";
    });
  }
  place();
  window.addEventListener("resize", () => { place(); gsap.set(cards, { x: 0, y: 0 }); });

  const restRot = (c) => parseFloat(c.dataset.rot) || 0;
  cards.forEach((c) => gsap.set(c, { rotation: restRot(c) }));

  let z = 20;
  cards.forEach((card) => {
    const inner = card.querySelector(".polaroid__inner");
    let flipped = false;
    function flip() {
      flipped = !flipped;
      KHS.popSound(flipped ? 1.2 : 0.9);
      gsap.to(inner, { rotationY: flipped ? 180 : 0, duration: R ? 0 : 0.8, ease: "back.out(1.4)" });
    }
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", card.querySelector(".polaroid__role").textContent + ", tap to flip");
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });

    Draggable.create(card, {
      type: "x,y",
      bounds: board,
      inertia: true,
      edgeResistance: 0.75,
      zIndexBoost: false,
      onPress() {
        card.style.zIndex = ++z;
        if (!R) gsap.to(card, { scale: 1.06, rotation: 0, duration: 0.3, ease: "back.out(2)" });
      },
      onDragStart() { KHS.popSound(0.7); },
      onDrag() { if (!R) gsap.to(card, { rotation: gsap.utils.clamp(-18, 18, this.deltaX * 1.4), duration: 0.3, overwrite: "auto" }); },
      onRelease() { if (!R) gsap.to(card, { scale: 1, rotation: restRot(card), duration: 0.9, ease: "elastic.out(1, 0.45)" }); },
      onClick: flip
    });
  });

  KHS.makeDraggable(stickers, board);

  if (R) return;
  gsap.set(cards, { autoAlpha: 0 });
  ScrollTrigger.create({
    trigger: board, start: "top 75%", once: true,
    onEnter() {
      gsap.fromTo(cards,
        { y: -400, rotation: () => rand(-40, 40), autoAlpha: 1 },
        { y: 0, rotation: (i) => restRot(cards[i]), duration: 1, ease: "back.out(1.3)", stagger: 0.12 });
      gsap.from(board.querySelectorAll(".polaroid__pin"), { scale: 0, duration: 0.6, ease: "elastic.out(1, 0.5)", stagger: 0.12, delay: 0.7 });
      gsap.from(".board__hint", { autoAlpha: 0, x: -20, duration: 0.6, delay: 1.3 });
    }
  });
})();
