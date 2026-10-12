/* The bag, on every page: the cart button in the nav, the slide-out bag,
   and the hand-off to Stripe Checkout (Apple Pay, Google Pay, cards).
   The bag lives in localStorage so it follows you from page to page.
   Each line is keyed by product id, or "id|size" for sized merch ("tee|M"),
   so bags saved before merch existed still load as they are. */
(function () {
  const KHS = window.KHS;
  const gsap = window.gsap;
  if (!KHS || !gsap) return;
  const R = KHS.REDUCED;
  const KEY = "khs-bag";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /* ---------------- catalogue ---------------- */
  let catNow = null; // the catalogue once it has loaded, for the quick checks in add/set
  KHS.catalog = fetch("assets/data/products.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((c) => { c.byId = Object.fromEntries(c.products.map((p) => [p.id, p])); return (catNow = c); })
    .catch(() => null);

  KHS.money = (cents, always) => "$" + (cents % 100 || always ? (cents / 100).toFixed(2) : String(cents / 100));

  /* line keys: "goose" or "tee|M" */
  KHS.lineKey = (id, size) => (size ? `${id}|${size}` : id);
  KHS.parseLine = (key) => { const i = key.indexOf("|"); return i < 0 ? { id: key, size: null } : { id: key.slice(0, i), size: key.slice(i + 1) }; };
  KHS.kind = (p) => p.kind || "sticker";

  /* A pre-order stays open until the end of its closing day. Same rule as the worker:
     UTC midnight after it, a few hours after Toronto's day ends. */
  KHS.dropClosed = (p) => KHS.kind(p) === "preorder" && !!p.drop && Date.now() >= Date.parse(`${p.drop.closes}T00:00:00Z`) + 864e5;
  /* "" when it can go in the bag, otherwise why not */
  KHS.unbuyable = (p) => (!p ? "gone" : p.draft ? "draft" : KHS.dropClosed(p) ? "closed" : "");
  const maxQty = (p) => Math.min(20, (p && p.drop && p.drop.limit) || 20);

  /* Sticker art for a product; the pack is a little pile of three. Merch wears its
     sticker on a tee (sized things) or a tote, and a book drop on a little cover. */
  const SHAPES = {
    tee: '<path d="M36 14 L22 18 L6 34 L18 48 L26 42 L26 92 L74 92 L74 42 L82 48 L94 34 L78 18 L64 14 C61 22 39 22 36 14 Z"/>',
    tote: '<path d="M36 36 C36 10 64 10 64 36" fill="none" stroke-width="5"/><path d="M16 34 L84 34 L80 94 L20 94 Z"/>',
    book: '<path d="M20 6 L84 6 L84 94 L20 94 Z"/><path d="M29 6 L29 94" fill="none"/>'
  };
  KHS.productArt = function (p) {
    if (p.pack) return '<span class="pile">' + ["goose", "daisy", "bee"].map((s) => `<span class="pile__s pile__s--${s}">${KHS.stickers[s]}</span>`).join("") + "</span>";
    const art = KHS.stickers[p.art] || "";
    const kind = KHS.kind(p);
    if (kind === "sticker") return art;
    const shape = kind === "preorder" ? "book" : p.sizes && p.sizes.length ? "tee" : "tote";
    return `<span class="wear wear--${shape}"><svg viewBox="0 0 100 100" aria-hidden="true" fill="#fff" stroke="#14161A" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">${SHAPES[shape]}</svg><span class="wear__print">${art}</span></span>`;
  };

  /* ---------------- state ---------------- */
  function load() {
    try {
      const b = JSON.parse(KHS.local.get(KEY) || "{}");
      return { items: b.items && typeof b.items === "object" ? b.items : {}, delivery: b.delivery === "mail" ? "mail" : "pickup" };
    } catch (e) { return { items: {}, delivery: "pickup" }; }
  }
  let bag = load();
  const save = () => KHS.local.set(KEY, JSON.stringify(bag));
  const count = () => Object.values(bag.items).reduce((a, b) => a + b, 0);
  const items = (n) => `${n} item${n === 1 ? "" : "s"}`;

  /* ---------------- drawer markup ---------------- */
  const drawer = document.createElement("div");
  drawer.className = "bag";
  drawer.innerHTML = `
    <div class="bag__scrim" data-bag-close></div>
    <aside class="bag__panel" role="dialog" aria-modal="true" aria-labelledby="bag-title">
      <div class="bag__head">
        <h2 id="bag-title" class="bag__title">Your bag</h2>
        <span class="hand bag__count"></span>
        <button class="bag__x" type="button" aria-label="Close bag" data-bag-close><svg viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
      </div>
      <ul class="bag__items" aria-live="polite"></ul>
      <div class="bag__empty">
        <div class="bag__empty-goose" data-sticker="goose"></div>
        <p class="hand">Your bag is empty. The goose is sad.</p>
        <a class="btn btn--yellow" href="shop.html">Visit the shop</a>
      </div>
      <div class="bag__foot">
        <p class="bag__note" hidden></p>
        <div class="bag__delivery" role="radiogroup" aria-label="Delivery">
          <button type="button" role="radio" data-delivery="pickup">Pick up on campus · free</button>
          <button type="button" role="radio" data-delivery="mail">Mail it · $2</button>
        </div>
        <div class="bag__total"><span class="kicker">Total</span><strong data-total>$0.00</strong></div>
        <button class="bag__checkout" type="button">Check out <span aria-hidden="true">→</span></button>
        <p class="bag__msg" role="status"></p>
        <div class="bag__marks" aria-label="Accepted payments"><span class="mark mark--ink">Apple Pay</span><span class="mark">Google Pay</span><span class="mark">Card</span></div>
        <p class="bag__fine">Secure checkout by Stripe · prices in CAD</p>
      </div>
    </aside>`;
  document.body.appendChild(drawer);
  KHS.hydrateStickers(drawer);

  const panel = drawer.querySelector(".bag__panel");
  const scrim = drawer.querySelector(".bag__scrim");
  const list = drawer.querySelector(".bag__items");
  const msg = drawer.querySelector(".bag__msg");
  const note = drawer.querySelector(".bag__note");
  const checkoutBtn = drawer.querySelector(".bag__checkout");
  const buttons = () => document.querySelectorAll(".cart-btn");

  /* ---------------- render ---------------- */
  /* Drop lines the shop can't sell any more (gone, back to draft, a size it no
     longer comes in, a closed pre-order) and keep pre-orders under their limit.
     Returns the names of closed pre-orders so the bag can say why they left. */
  function tidy(cat) {
    const closed = [];
    let changed = false;
    Object.keys(bag.items).forEach((key) => {
      const { id, size } = KHS.parseLine(key);
      const p = cat.byId[id];
      const why = KHS.unbuyable(p);
      const sized = !!(p && p.sizes && p.sizes.length);
      if (why || (sized ? !p.sizes.includes(size) : size != null)) {
        if (why === "closed") closed.push(p.name);
        delete bag.items[key];
        changed = true;
      } else if (bag.items[key] > maxQty(p)) { bag.items[key] = maxQty(p); changed = true; }
    });
    if (changed) save();
    return closed;
  }

  function badge(n) {
    buttons().forEach((b) => {
      const c = b.querySelector(".cart-btn__count");
      if (c) c.textContent = n;
      b.classList.toggle("has-items", n > 0);
      b.setAttribute("aria-label", `Open your bag, ${items(n)}`);
    });
    document.dispatchEvent(new CustomEvent("khs:bag", { detail: { count: n } }));
  }

  async function render() {
    let n = count();
    badge(n);
    const cat = await KHS.catalog;
    const closed = cat ? tidy(cat) : [];
    if (count() !== n) badge((n = count()));
    drawer.classList.toggle("is-empty", n === 0);
    drawer.querySelector(".bag__count").textContent = n ? items(n) : "";
    drawer.querySelectorAll("[data-delivery]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.delivery === bag.delivery)));
    if (!cat) { msg.textContent = "Couldn't load the shop. Please refresh."; return; }
    if (closed.length) msg.textContent = `Pre-orders for ${closed.join(" and ")} have closed, so we took ${closed.length === 1 ? "it" : "them"} out of your bag.`;
    const lines = Object.entries(bag.items).map(([key, qty]) => ({ key, qty, ...KHS.parseLine(key) }));
    list.innerHTML = lines.map(({ key, qty, id, size }) => {
      const p = cat.byId[id];
      const name = size ? `${p.name} (${size})` : p.name;
      return `<li class="bag-row" data-key="${esc(key)}">
        <span class="bag-row__art tile--${p.bg}">${KHS.productArt(p)}</span>
        <span class="bag-row__info"><span class="hand bag-row__name">${esc(name)}</span><span class="bag-row__each">${KHS.money(p.price)} each${KHS.kind(p) === "preorder" ? " · pre-order" : ""}</span></span>
        <span class="stepper"><button type="button" data-step="-1" aria-label="One fewer ${esc(name)}">−</button><span>${qty}</span><button type="button" data-step="1" aria-label="One more ${esc(name)}"${qty >= maxQty(p) ? " disabled" : ""}>+</button></span>
        <strong class="bag-row__sum">${KHS.money(p.price * qty)}</strong>
      </li>`;
    }).join("");
    // pre-orders are charged today but ship later, so say when
    const ships = [...new Set(lines.map(({ id }) => cat.byId[id]).filter((p) => KHS.kind(p) === "preorder" && p.drop).map((p) => p.drop.ships))];
    note.hidden = !ships.length;
    note.textContent = ships.length ? `Pre-order items are charged now and ship ${ships.join(" or ")}. Everything else comes as usual.` : "";
    const sub = lines.reduce((a, { id, qty }) => a + cat.byId[id].price * qty, 0);
    const ship = n ? cat.delivery[bag.delivery].price : 0;
    drawer.querySelector("[data-total]").textContent = KHS.money(sub + ship, true);
  }

  /* ---------------- open / close ---------------- */
  let isOpen = false;
  let opener = null;
  function open() {
    if (isOpen) return;
    isOpen = true;
    opener = document.activeElement;
    msg.textContent = "";
    drawer.classList.add("is-open");
    document.body.classList.add("bag-open");
    if (KHS.lenis) KHS.lenis.stop();
    render().then(() => {
      if (!R) gsap.from(list.children, { x: 60, autoAlpha: 0, stagger: 0.05, duration: 0.45, delay: 0.1, ease: "back.out(1.6)" });
    });
    KHS.popSound(0.9);
    if (!R) {
      gsap.fromTo(scrim, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 });
      gsap.fromTo(panel, { xPercent: 105, rotation: 3 }, { xPercent: 0, rotation: 0, duration: 0.6, ease: "back.out(1.1)" });
    }
    setTimeout(() => drawer.querySelector(".bag__x").focus(), R ? 0 : 300);
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    const done = () => {
      drawer.classList.remove("is-open");
      document.body.classList.remove("bag-open");
      gsap.set([panel, scrim], { clearProps: "all" });
      if (KHS.lenis) KHS.lenis.start();
      if (opener && opener.focus) opener.focus();
    };
    if (R) return done();
    gsap.to(scrim, { autoAlpha: 0, duration: 0.25 });
    gsap.to(panel, { xPercent: 105, duration: 0.4, ease: "power3.in", onComplete: done });
  }

  drawer.addEventListener("click", (e) => {
    if (e.target.closest("[data-bag-close]")) return close();
    const step = e.target.closest("[data-step]");
    if (step) {
      const key = step.closest(".bag-row").dataset.key;
      set(key, (bag.items[key] || 0) + Number(step.dataset.step));
      KHS.popSound(step.dataset.step > 0 ? 1.3 : 0.8);
      return;
    }
    const d = e.target.closest("[data-delivery]");
    if (d) { bag.delivery = d.dataset.delivery; save(); render(); KHS.popSound(1.1); }
  });
  document.addEventListener("keydown", (e) => {
    if (!isOpen) return;
    if (e.key === "Escape") close();
    if (e.key === "Tab") {
      const f = Array.from(panel.querySelectorAll("button:not(:disabled), a[href]")).filter((el) => el.offsetParent);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".cart-btn, [data-bag-open]");
    if (b) { e.preventDefault(); open(); }
  });

  /* ---------------- mutations ---------------- */
  /* key is a product id, or "id|size" for sized merch */
  function set(key, qty) {
    const p = catNow && catNow.byId[KHS.parseLine(key).id];
    if (qty <= 0) delete bag.items[key];
    else bag.items[key] = Math.min(maxQty(p), qty);
    save();
    render();
  }

  function bump() {
    buttons().forEach((b) => {
      if (!b.offsetParent || R) return;
      gsap.fromTo(b, { scale: 1.25, rotation: -8 }, { scale: 1, rotation: 0, duration: 0.7, ease: "elastic.out(1.2, 0.4)", overwrite: "auto" });
      const c = b.querySelector(".cart-btn__count");
      if (c) gsap.fromTo(c, { scale: 0.2 }, { scale: 1, duration: 0.6, ease: "back.out(3)" });
    });
  }

  /* Fly a copy of the sticker into the bag button, then add it.
     Drafts and closed pre-orders never get in, whoever asks. Returns whether it went in. */
  function add(key, n, fromEl) {
    if (catNow && KHS.unbuyable(catNow.byId[KHS.parseLine(key).id])) return false;
    set(key, (bag.items[key] || 0) + (n || 1));
    KHS.popSound(1.25);
    const target = Array.from(buttons()).find((b) => b.offsetParent);
    if (R || !fromEl || !target) { bump(); return true; }
    const a = fromEl.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const ghost = document.createElement("div");
    ghost.className = "fly-sticker";
    ghost.innerHTML = fromEl.innerHTML;
    document.body.appendChild(ghost);
    const size = Math.min(a.width, 160);
    gsap.set(ghost, { left: a.left + a.width / 2 - size / 2, top: a.top + a.height / 2 - size / 2, width: size, height: size });
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    gsap.timeline({ onComplete: () => { ghost.remove(); bump(); KHS.confetti(b.left + b.width / 2, b.top + b.height, 8, 60); } })
      .to(ghost, { x: dx, duration: 0.75, ease: "power1.inOut" }, 0)
      .to(ghost, { y: dy, duration: 0.75, ease: "back.in(1.6)" }, 0)
      .to(ghost, { scale: 0.18, rotation: gsap.utils.random(-200, 200), duration: 0.75, ease: "power2.in" }, 0);
    return true;
  }

  KHS.bag = { add, set, open, close, count, get: () => ({ ...bag, items: { ...bag.items } }), clear() { bag.items = {}; save(); render(); } };

  /* ---------------- checkout ---------------- */
  checkoutBtn.addEventListener("click", async () => {
    const cat = await KHS.catalog;
    if (!count() || !cat) return;
    if (!cat.checkoutUrl) {
      msg.textContent = "The till opens soon! Checkout switches on as soon as the stickers are printed.";
      KHS.honkSound();
      return;
    }
    checkoutBtn.disabled = true;
    checkoutBtn.classList.add("is-busy");
    msg.textContent = "Opening secure checkout…";
    try {
      const res = await fetch(cat.checkoutUrl.replace(/\/$/, "") + "/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: Object.entries(bag.items).map(([key, qty]) => {
            const { id, size } = KHS.parseLine(key);
            return size ? { id, qty, size } : { id, qty };
          }),
          delivery: bag.delivery
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout didn't open. Please try again.");
      location.href = data.url;
    } catch (err) {
      msg.textContent = err instanceof TypeError ? "Couldn't reach checkout. Check your connection and try again." : err.message;
      checkoutBtn.disabled = false;
      checkoutBtn.classList.remove("is-busy");
    }
  });

  /* back from Stripe: ?paid=… clears the bag; ?bag=open reopens it */
  const q = new URLSearchParams(location.search);
  if (q.has("paid")) { bag.items = {}; save(); }
  render();
  if (q.get("bag") === "open") setTimeout(open, 400);

  // keep other tabs in sync
  window.addEventListener("storage", (e) => { if (e.key === KEY) { bag = load(); render(); } });
})();
