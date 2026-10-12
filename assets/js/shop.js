/* The shop: product grid from assets/data/products.json, stickers you can
   drag straight into the bag, made-to-order merch with a size picker, limited
   book drops on pre-order, Flip-animated filters, and the thank-you note
   when Stripe sends the buyer back with ?paid=…
   A product with "draft": true shows as "coming soon" and can't be bought. */
(function () {
  const gsap = window.gsap;
  const KHS = window.KHS;
  if (!gsap || !KHS || !KHS.catalog) return;
  const R = KHS.REDUCED;
  const rand = gsap.utils.random;
  const grid = document.querySelector(".products");
  if (!grid) return;
  let cat = null;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const sizesOf = (p) => (p && p.sizes && p.sizes.length ? p.sizes : null);
  // "2026-12-01" -> "December 1" (read as a plain date, never shifted by time zone)
  const day = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-CA", { month: "long", day: "numeric", timeZone: "UTC" });
  const tagsOf = (p) => [...new Set([...(p.tags || []), KHS.kind(p)])].join(" ");

  function card(p) {
    return `<article class="product" data-id="${p.id}" data-tags="${tagsOf(p)}">
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

  /* merch and book drops: kind badge, size picker, made-to-order or drop details,
     and a "coming soon" ribbon while the club is still deciding (draft) */
  function goodsCard(p) {
    const kind = KHS.kind(p);
    const why = KHS.unbuyable(p);
    const sizes = sizesOf(p);
    const d = p.drop;
    const label = why === "draft" ? "Coming soon" : why === "closed" ? "Pre-orders closed" : kind === "preorder" ? "Pre-order +" : "Add to bag +";
    const details = kind === "preorder" && d
      ? `<ul class="product__drop">
          <li><b>Pre-order</b> · ships ${esc(d.ships)}</li>
          <li>${why === "closed" ? "closed" : "closes"} ${esc(day(d.closes))}</li>
          <li>limited run · up to ${Math.min(20, d.limit)} per order</li>
        </ul>`
      : p.madeToOrder ? `<p class="product__made">${esc(p.madeToOrder)}</p>` : "";
    const picker = sizes
      ? `<div class="sizes" role="radiogroup" aria-label="Size for ${esc(p.name)}">
          ${sizes.map((s) => `<button type="button" role="radio" aria-checked="false" data-size="${esc(s)}"${why ? " disabled" : ""}>${esc(s)}</button>`).join("")}
        </div>`
      : "";
    return `<article class="product product--${kind}${why ? ` is-${why}` : ""}" data-id="${p.id}" data-tags="${tagsOf(p)}">
      <div class="product__tile tile--${p.bg}">
        ${p.badge ? `<span class="product__badge">${esc(p.badge)}</span>` : ""}
        <span class="product__kind">${kind === "preorder" ? "Pre-order" : "Merch"}</span>
        ${why === "draft" ? '<span class="ribbon" aria-hidden="true">coming soon</span>' : ""}
        <div class="product__art" data-cursor="${why === "draft" ? "coming soon!" : why ? "closed" : "drag me!"}">${KHS.productArt(p)}</div>
      </div>
      <div class="product__row">
        <div><h3 class="product__name">${esc(p.name)}</h3><span class="product__spec">${esc(p.spec)}</span></div>
        <span class="product__price">${KHS.money(p.price)}</span>
      </div>
      ${details}
      ${picker}
      <span class="hand sizes__hint" role="status"></span>
      <button class="product__add" type="button" data-add="${p.id}" data-label="${label}"${why ? " disabled" : ""}>${label}</button>
    </article>`;
  }

  function packCard(p, saving) {
    const art = [["goose", 34, 0, 40, -14], ["daisy", 0, 4, 32, 10], ["bee", 4, 48, 40, -6], ["apple", 42, 56, 26, 14], ["ladybug", 66, 30, 26, 18]]
      .map(([s, r, t, w, rot]) => `<span class="sticker" style="right:${r}%;top:${t}%;width:${w}%;aspect-ratio:1;rotate:${rot}deg">${KHS.stickers[s]}</span>`).join("");
    return `<article class="product product--pack" data-id="${p.id}" data-tags="${tagsOf(p)}">
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

  KHS.catalog.then((c) => {
    if (!c) { grid.innerHTML = "<p class=\"lede\">The shop couldn't load. Please refresh the page.</p>"; return; }
    cat = c;
    // the pack's saving is against the single stickers only, never the merch
    const singles = cat.products.filter((p) => !p.pack && KHS.kind(p) === "sticker");
    const full = singles.reduce((a, p) => a + p.price, 0);
    grid.innerHTML = cat.products.map((p) => (p.pack ? packCard(p, full - p.price) : KHS.kind(p) === "sticker" ? card(p) : goodsCard(p))).join("");
    document.querySelector(".shop-soon").hidden = !!cat.checkoutUrl;
    syncButtons();
    initCards();
    initFilters();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  });

  /* ---------------- sizes ---------------- */
  /* The line key for a card: plain id, or "id|size" once a size is picked.
     null means it needs a size first. */
  function keyFor(product) {
    const id = product.dataset.id;
    if (!sizesOf(cat && cat.byId[id])) return id;
    return product.dataset.picked ? KHS.lineKey(id, product.dataset.picked) : null;
  }

  function pickSize(btn) {
    const product = btn.closest(".product");
    product.dataset.picked = btn.dataset.size;
    btn.parentElement.querySelectorAll("[data-size]").forEach((b) => b.setAttribute("aria-checked", String(b === btn)));
    product.querySelector(".sizes__hint").textContent = "";
    KHS.popSound(1.2);
    if (!R) gsap.fromTo(btn, { scale: 0.8 }, { scale: 1, duration: 0.5, ease: "back.out(3)" });
    syncButtons();
  }

  /* no size yet: wiggle the picker and say so */
  function askSize(product) {
    const sizes = product.querySelector(".sizes");
    product.querySelector(".sizes__hint").textContent = "pick a size first!";
    KHS.popSound(0.6);
    if (!R) gsap.fromTo(sizes, { x: -10 }, { x: 0, duration: 0.7, ease: "elastic.out(1.2, 0.25)" });
    const first = sizes.querySelector("[data-size]");
    if (first) first.focus({ preventScroll: true });
  }

  /* ---------------- add to bag ---------------- */
  grid.addEventListener("click", (e) => {
    const s = e.target.closest("[data-size]");
    if (s && !s.disabled) return pickSize(s);
    const b = e.target.closest("[data-add]");
    if (!b || b.disabled) return;
    const product = b.closest(".product");
    const key = keyFor(product);
    if (!key) return askSize(product);
    const art = product.querySelector(".product__art");
    KHS.bag.add(key, 1, art);
    if (!R) gsap.fromTo(b, { scale: 0.9 }, { scale: 1, duration: 0.6, ease: "elastic.out(1.2, 0.4)" });
  });

  /* arrow keys move between sizes, like any radio group */
  grid.addEventListener("keydown", (e) => {
    const s = e.target.closest("[data-size]");
    if (!s || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
    e.preventDefault();
    const all = Array.from(s.parentElement.querySelectorAll("[data-size]"));
    const next = all[(all.indexOf(s) + (/Right|Down/.test(e.key) ? 1 : -1) + all.length) % all.length];
    next.focus();
    pickSize(next);
  });

  function syncButtons() {
    const items = KHS.bag.get().items;
    grid.querySelectorAll(".product__add").forEach((b) => {
      if (b.disabled) return;
      const key = keyFor(b.closest(".product"));
      const n = (key && items[key]) || 0;
      b.classList.toggle("in-bag", n > 0);
      b.textContent = n ? `In bag ✓ ${n} · add another` : b.dataset.label || "Add to bag +";
    });
  }

  /* mobile bag bar + button labels follow the bag */
  const bar = document.querySelector(".bagbar");
  async function syncBar(n) {
    const c = await KHS.catalog;
    if (!bar || !c) return;
    const items = KHS.bag.get().items;
    const total = Object.entries(items).reduce((a, [key, q]) => { const p = c.byId[KHS.parseLine(key).id]; return a + (p ? p.price * q : 0); }, 0);
    bar.querySelector(".bagbar__sum").textContent = `Bag · ${n} item${n === 1 ? "" : "s"} · ${KHS.money(total)}`;
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
      // drafts and closed drops stay put: nothing to drag into the bag
      if (!KHS.unbuyable(cat.byId[art.closest(".product").dataset.id])) makeBagDraggable(art);
    });
  }

  function makeBagDraggable(art) {
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
        const key = keyFor(product);
        if (t) t.classList.remove("is-target");
        if (dropped && key && KHS.bag.add(key, 1, null)) {
          const r = t.getBoundingClientRect();
          KHS.confetti(r.left + r.width / 2, r.top + r.height, 14, 70);
          gsap.timeline({ onComplete: reset })
            .to(art, { scale: 0, duration: 0.2, ease: "power2.in" })
            .set(art, { x: 0, y: 0, rotation: 0 })
            .to(art, { scale: 1, duration: 0.7, ease: "elastic.out(1, 0.45)" });
        } else {
          gsap.to(art, { x: 0, y: 0, rotation: 0, scale: 1, duration: R ? 0 : 0.8, ease: "elastic.out(1, 0.5)", onComplete: reset });
          if (dropped && !key) askSize(product);
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
