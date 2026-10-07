/* Sticker shop: product grid from assets/data/products.json, stickers you can
   drag straight into the bag, Flip-animated filters, and the thank-you note
   when Stripe sends the buyer back with ?paid=… */
(function () {
  const gsap = window.gsap;
  const KHS = window.KHS;
  if (!gsap || !KHS || !KHS.catalog) return;
  const R = KHS.REDUCED;
  const rand = gsap.utils.random;
  const grid = document.querySelector(".products");
  if (!grid) return;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function card(p) {
    return `<article class="product" data-id="${p.id}" data-tags="${p.tags.join(" ")}">
      <div class="product__tile tile--${p.bg}">
        ${p.badge ? `<span class="product__badge">${esc(p.badge)}</span>` : ""}
        <div class="product__art" data-cursor="drag me!">${KHS.productArt(p)}</div>
      </div>
      <div class="product__row">
        <div><h3 class="product__name">${esc(p.name)}</h3><span class="product__spec">${esc(p.spec)}</span></div>
        <span class="product__price">${KHS.money(p.price)}</span>
      </div>
      <button class="product__add" type="button" data-add="${p.id}">Add to bag +</button>
    </article>`;
  }

  function packCard(p, saving) {
    const art = [["goose", 34, 0, 40, -14], ["daisy", 0, 4, 32, 10], ["bee", 4, 48, 40, -6], ["apple", 42, 56, 26, 14], ["ladybug", 66, 30, 26, 18]]
      .map(([s, r, t, w, rot]) => `<span class="sticker" style="right:${r}%;top:${t}%;width:${w}%;aspect-ratio:1;rotate:${rot}deg">${KHS.stickers[s]}</span>`).join("");
    return `<article class="product product--pack" data-id="${p.id}" data-tags="${p.tags.join(" ")}">
      <div class="pack">
        <div class="pack__copy">
          <span class="kicker">The best deal on the shelf</span>
          <h2>${esc(p.name)}</h2>
          <p>${esc(p.spec.charAt(0).toUpperCase() + p.spec.slice(1))}, in one envelope.</p>
        </div>
        <div class="pack__cta">
          <button class="btn btn--yellow" type="button" data-add="${p.id}">Add pack · ${KHS.money(p.price)}</button>
          ${saving > 0 ? `<span class="hand">save ${KHS.money(saving)}!</span>` : ""}
        </div>
        <div class="pack__art product__art" aria-hidden="true">${art}</div>
      </div>
    </article>`;
  }

  KHS.catalog.then((cat) => {
    if (!cat) { grid.innerHTML = "<p class=\"lede\">The shop couldn't load. Please refresh the page.</p>"; return; }
    const singles = cat.products.filter((p) => !p.pack);
    const full = singles.reduce((a, p) => a + p.price, 0);
    grid.innerHTML = cat.products.map((p) => (p.pack ? packCard(p, full - p.price) : card(p))).join("");
    document.querySelector(".shop-soon").hidden = !!cat.checkoutUrl;
    syncButtons();
    initCards();
    initFilters();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  });

  /* ---------------- add to bag ---------------- */
  grid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]");
    if (!b) return;
    const art = b.closest(".product").querySelector(".product__art");
    KHS.bag.add(b.dataset.add, 1, art);
    if (!R) gsap.fromTo(b, { scale: 0.9 }, { scale: 1, duration: 0.6, ease: "elastic.out(1.2, 0.4)" });
  });

  function syncButtons() {
    const items = KHS.bag.get().items;
    grid.querySelectorAll(".product__add").forEach((b) => {
      const n = items[b.dataset.add] || 0;
      b.classList.toggle("in-bag", n > 0);
      b.textContent = n ? `In bag ✓ ${n} · add another` : "Add to bag +";
    });
  }

  /* mobile bag bar + button labels follow the bag */
  const bar = document.querySelector(".bagbar");
  async function syncBar(n) {
    const cat = await KHS.catalog;
    if (!bar || !cat) return;
    const items = KHS.bag.get().items;
    const total = Object.entries(items).reduce((a, [id, q]) => a + (cat.byId[id] ? cat.byId[id].price * q : 0), 0);
    bar.querySelector(".bagbar__sum").textContent = `Bag · ${n} sticker${n === 1 ? "" : "s"} · ${KHS.money(total)}`;
    document.body.classList.toggle("has-bag", n > 0);
  }
  document.addEventListener("khs:bag", (e) => { syncButtons(); syncBar(e.detail.count); });
  syncBar(KHS.bag.count());

  /* ---------------- cards: entrance, hover, drag into bag ---------------- */
  function initCards() {
    const cards = gsap.utils.toArray(".product", grid);
    if (!R) {
      gsap.set(cards, { autoAlpha: 0, y: 60, rotation: () => rand(-6, 6) });
      ScrollTrigger.batch(cards, {
        start: "top 92%", once: true,
        onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, rotation: 0, duration: 0.8, ease: "back.out(1.6)", stagger: 0.09 })
      });
      gsap.utils.toArray(".pack__art .sticker", grid).forEach((s) => KHS.float(s));
    }

    grid.querySelectorAll(".product:not(.product--pack) .product__art").forEach((art) => {
      const tile = art.parentElement;
      if (!R) {
        tile.addEventListener("pointerenter", () => {
          gsap.fromTo(art, { rotation: -10 }, { rotation: 0, scale: 1.06, duration: 0.8, ease: "elastic.out(1.2, 0.35)", overwrite: "auto" });
          KHS.popSound(rand(1.1, 1.5));
        });
        tile.addEventListener("pointerleave", () => gsap.to(art, { scale: 1, duration: 0.4, overwrite: "auto" }));
      }
      makeBagDraggable(art);
    });
  }

  function makeBagDraggable(art) {
    const id = art.closest(".product").dataset.id;
    const tile = art.closest(".product__tile");
    const product = art.closest(".product");
    const nav = document.querySelector(".nav");
    const target = () => Array.from(document.querySelectorAll(".cart-btn")).find((b) => b.offsetParent);
    const reset = () => { tile.style.overflow = ""; product.style.zIndex = ""; };
    Draggable.create(art, {
      type: "x,y",
      zIndexBoost: false,
      onPress() {
        tile.style.overflow = "visible";
        product.style.zIndex = 5;
        if (!R) gsap.to(art, { scale: 1.12, duration: 0.25, ease: "back.out(3)", overwrite: "auto" });
      },
      onDragStart() {
        if (nav) nav.classList.remove("is-hidden");
        KHS.popSound(0.7);
      },
      onDrag() {
        const t = target();
        if (t) t.classList.toggle("is-target", this.hitTest(t, 8));
        if (!R) gsap.to(art, { rotation: gsap.utils.clamp(-25, 25, this.deltaX * 1.6), duration: 0.3, overwrite: "auto" });
      },
      onRelease() {
        const t = target();
        const dropped = this.isDragging !== undefined && t && this.hitTest(t, 8);
        if (t) t.classList.remove("is-target");
        if (dropped) {
          KHS.bag.add(id, 1, null);
          const r = t.getBoundingClientRect();
          KHS.confetti(r.left + r.width / 2, r.top + r.height, 14, 70);
          gsap.timeline({ onComplete: reset })
            .to(art, { scale: 0, duration: 0.2, ease: "power2.in" })
            .set(art, { x: 0, y: 0, rotation: 0 })
            .to(art, { scale: 1, duration: 0.7, ease: "elastic.out(1, 0.45)" });
        } else {
          gsap.to(art, { x: 0, y: 0, rotation: 0, scale: 1, duration: R ? 0 : 0.8, ease: "elastic.out(1, 0.5)", onComplete: reset });
        }
      }
    });
  }

  /* ---------------- filters (Flip) ---------------- */
  function initFilters() {
    const buttons = document.querySelectorAll("[data-filter]");
    buttons.forEach((b) => b.addEventListener("click", () => {
      const f = b.dataset.filter;
      buttons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      const cards = gsap.utils.toArray(".product", grid);
      const state = Flip.getState(cards);
      cards.forEach((c) => { c.hidden = f !== "all" && !c.dataset.tags.split(" ").includes(f); });
      KHS.popSound(1.1);
      if (R) return;
      Flip.from(state, {
        duration: 0.6, ease: "power3.inOut", absolute: true, scale: true,
        onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: 0.6, rotation: () => rand(-10, 10) }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.6, ease: "back.out(1.6)" }),
        onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: 0.6, duration: 0.35 }),
        onComplete: () => ScrollTrigger.refresh()
      });
    }));
  }

  /* ---------------- back from Stripe ---------------- */
  if (new URLSearchParams(location.search).has("paid")) {
    const thanks = document.querySelector(".thanks");
    thanks.classList.add("is-shown");
    history.replaceState(null, "", location.pathname);
    setTimeout(() => {
      thanks.focus({ preventScroll: true });
      const r = thanks.getBoundingClientRect();
      KHS.confetti(r.left + r.width / 2, r.top + 40, 30, 90);
      if (!R) gsap.from(thanks, { scale: 0.7, rotation: -8, autoAlpha: 0, duration: 0.8, ease: "back.out(1.8)" });
    }, 500);
  }
})();
