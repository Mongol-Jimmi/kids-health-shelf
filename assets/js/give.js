/* Donate what you want: one little box, used two ways.
   KHS.give({ fund, book?, title?, download?, fromEl? }) pops it up as a modal
   (the books' "Download PDF" links), and any [data-give-box] on the page gets the
   same box inline (the donate band on Get Involved).

   Money goes to the club's Stripe through the worker's /give door, tagged with its
   fund (and book) so the treasurer can see exactly what to send on. Book money goes
   to Children's Health Foundation each term; the "shelf" fund prints more books.
   $0 is fine for a book: the PDF just downloads. Needs cart.js (KHS.catalog, KHS.money). */
(function () {
  const KHS = window.KHS;
  const gsap = window.gsap;
  if (!KHS || !gsap) return;
  const R = KHS.REDUCED;

  // used until products.json has its own "funds" and "give" (amounts in cents)
  const FUNDS = { chf: { label: "Children's Health Foundation" }, shelf: { label: "Printing the next books" } };
  const GIVE = { min: 100, max: 100000, presets: [500, 1000, 2500] };
  const WHERE = {
    chf: 'Every dollar you give for a book (after Stripe\'s card fee) goes to <a href="https://childhealth.ca/" target="_blank" rel="noopener">Children\'s Health Foundation</a>, for Children\'s Hospital at LHSC. We send it each term.',
    shelf: "Every dollar (after Stripe's card fee) prints our books for elementary schools and libraries."
  };
  const settings = () => (KHS.catalog || Promise.resolve(null)).then((c) => ({
    url: (c && c.checkoutUrl) || "",
    funds: (c && c.funds) || FUNDS,
    give: Object.assign({}, GIVE, (c && c.give) || {})
  }));
  // $5, $7.50, $1,000
  const cad = (c) => (c % 100 ? KHS.money(c) : "$" + (c / 100).toLocaleString("en-CA"));
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const arrow = '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9 H15 M10 4 L15 9 L10 14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* "15", "15.5" or "$15.50" → 1550; anything else → NaN */
  function toCents(text) {
    const t = String(text).replace(/[\s$,]/g, "");
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(t)) return NaN;
    return Math.round(parseFloat(t) * 100);
  }

  /* Save a file without leaving the page. */
  function download(url) {
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", "");
    a.hidden = true;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------------- the form (shared by the modal and the inline box) ---------------- */
  let uid = 0;
  function makeForm(o, cfg) {
    const id = "give" + ++uid;
    const fund = cfg.funds[o.fund] ? o.fund : "shelf";
    const label = cfg.funds[fund].label;
    const free = !!o.download;
    const chips = (free ? [0] : []).concat(cfg.give.presets);
    // a book download starts on $0; a plain gift starts on the middle preset
    const start = free ? 0 : cfg.give.presets[Math.floor(cfg.give.presets.length / 2)];
    const form = document.createElement("form");
    form.className = "give__form";
    form.noValidate = true;
    form.innerHTML = `
      <fieldset class="give__amounts">
        <legend class="sr-only">How much would you like to give?</legend>
        ${chips.map((c) => `<label class="give__chip${c === 0 ? " give__chip--free" : ""}"><input type="radio" name="${id}-amt" value="${c}"${c === start ? " checked" : ""}><span>${c === 0 ? "$0 · just download" : cad(c)}</span></label>`).join("")}
        <label class="give__chip"><input type="radio" name="${id}-amt" value="other"><span>Other</span></label>
      </fieldset>
      <div class="give__other" hidden>
        <label class="sr-only" for="${id}-other">Your amount in Canadian dollars</label>
        <span class="give__cur" aria-hidden="true">$</span>
        <input id="${id}-other" type="text" inputmode="decimal" autocomplete="off" placeholder="${cfg.give.presets[cfg.give.presets.length - 1] / 100 * 2}" aria-describedby="${id}-range">
        <span class="give__cad mono" id="${id}-range">CAD · ${cad(cfg.give.min)} to ${cad(cfg.give.max)}</span>
      </div>
      <p class="give__where"><span class="kicker">Where it goes</span><b>${esc(label)}</b><span>${WHERE[fund]}</span></p>
      <button class="give__go" type="submit"></button>
      <p class="give__msg" role="status"></p>
      <p class="give__fine">Paid to Kids Health Shelf by Stripe · CAD · we're a student club, so no tax receipts</p>`;

    const go = form.querySelector(".give__go");
    const msg = form.querySelector(".give__msg");
    const other = form.querySelector(".give__other");
    const input = other.querySelector("input");
    const picked = () => form.querySelector("input[type=radio]:checked").value;
    const amount = () => (picked() === "other" ? toCents(input.value) : Number(picked()));

    function relabel() {
      const a = amount();
      if (a === 0) go.innerHTML = `Download free ${arrow}`;
      else go.innerHTML = `Donate${Number.isFinite(a) && a > 0 ? " " + cad(a) : ""} ${arrow}`;
    }
    form.addEventListener("change", (e) => {
      if (e.target.type !== "radio") return;
      const isOther = e.target.value === "other";
      other.hidden = !isOther;
      if (isOther) input.focus();
      msg.textContent = "";
      relabel();
      KHS.popSound(e.target.value === "0" ? 0.9 : 1.1 + chips.indexOf(Number(e.target.value)) * 0.12);
      if (!R) gsap.fromTo(e.target.nextElementSibling, { scale: 0.86, rotation: -4 }, { scale: 1, rotation: 0, duration: 0.6, ease: "elastic.out(1.3, 0.4)" });
    });
    input.addEventListener("input", () => { msg.textContent = ""; relabel(); });
    relabel();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const a = amount();
      if (a === 0 && free) {
        download(o.download);
        msg.textContent = "Your PDF is downloading. Happy reading!";
        const r = go.getBoundingClientRect();
        KHS.confetti(r.left + r.width / 2, r.top, 12, 60);
        KHS.popSound(1.3);
        if (o.onDone) setTimeout(o.onDone, R ? 600 : 1100);
        return;
      }
      if (!Number.isFinite(a)) { msg.textContent = "Type an amount in dollars, like 15 or 7.50."; input.focus(); return; }
      if (a < cfg.give.min || a > cfg.give.max) { msg.textContent = `Pick an amount from ${cad(cfg.give.min)} to ${cad(cfg.give.max)}.`; input.focus(); return; }
      if (!cfg.url) {
        msg.innerHTML = "Donations open soon! The club's till switches on as soon as it's set up." +
          (free ? ` In the meantime the book is free: <a class="give__dl" href="${esc(o.download)}" download>download the PDF</a>.` : "");
        KHS.honkSound();
        return;
      }
      go.disabled = true;
      go.classList.add("is-busy");
      msg.textContent = "Opening secure checkout…";
      try {
        const body = { amount: a, fund };
        if (o.book) body.book = o.book;
        const res = await fetch(cfg.url.replace(/\/$/, "") + "/give", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) throw new Error(data.error || "Checkout didn't open. Please try again.");
        location.href = data.url;
      } catch (err) {
        msg.textContent = err instanceof TypeError ? "Couldn't reach checkout. Check your connection and try again." : err.message;
        go.disabled = false;
        go.classList.remove("is-busy");
      }
    });
    return form;
  }

  /* ---------------- modal ---------------- */
  const modal = document.createElement("div");
  modal.className = "give";
  modal.innerHTML = `
    <div class="give__scrim" data-give-close></div>
    <div class="give__panel" role="dialog" aria-modal="true" aria-labelledby="give-title" data-lenis-prevent>
      <div class="give__head">
        <div>
          <span class="hand give__kicker">donate what you want</span>
          <h2 id="give-title" class="give__title"></h2>
        </div>
        <button class="give__x" type="button" aria-label="Close" data-give-close data-cursor="close"><svg viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
      </div>
      <div class="give__body"></div>
    </div>`;
  document.body.appendChild(modal);
  const panel = modal.querySelector(".give__panel");
  const scrim = modal.querySelector(".give__scrim");
  const body = modal.querySelector(".give__body");
  const titleEl = modal.querySelector(".give__title");
  let isOpen = false;
  let opener = null;
  let lenisWasStopped = false;
  let overflowWas = "";

  async function open(options) {
    const o = options || {};
    if (isOpen) return;
    isOpen = true;
    opener = o.fromEl || document.activeElement;
    const cfg = await settings();
    titleEl.textContent = o.download ? (o.title ? `Download ${o.title}` : "Download the PDF") : o.title || "Help print the next books";
    body.innerHTML = "";
    body.appendChild(makeForm({ ...o, onDone: close }, cfg));
    modal.classList.add("is-open");
    document.documentElement.classList.add("give-open");
    lenisWasStopped = !KHS.lenis || KHS.lenis.isStopped;
    if (KHS.lenis) KHS.lenis.stop();
    overflowWas = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    KHS.popSound(0.9);
    const first = body.querySelector("input:checked") || body.querySelector("input");
    if (R) { first.focus(); return; }
    gsap.fromTo(scrim, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 });
    gsap.fromTo(panel, { y: 60, scale: 0.9, rotation: -3, autoAlpha: 0 }, { y: 0, scale: 1, rotation: 0, autoAlpha: 1, duration: 0.6, ease: "back.out(1.5)" });
    gsap.from(body.querySelectorAll(".give__chip"), { scale: 0, rotation: () => gsap.utils.random(-14, 14), duration: 0.6, delay: 0.15, ease: "elastic.out(1, 0.5)", stagger: 0.05 });
    setTimeout(() => first.focus({ preventScroll: true }), 250);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    const done = () => {
      modal.classList.remove("is-open");
      document.documentElement.classList.remove("give-open");
      gsap.set([panel, scrim], { clearProps: "all" });
      body.innerHTML = "";
      document.documentElement.style.overflow = overflowWas;
      if (KHS.lenis && !lenisWasStopped) KHS.lenis.start();
      if (opener && opener.focus) opener.focus({ preventScroll: true });
    };
    if (R) return done();
    gsap.to(scrim, { autoAlpha: 0, duration: 0.25 });
    gsap.to(panel, { y: 40, scale: 0.94, autoAlpha: 0, duration: 0.3, ease: "power3.in", onComplete: done });
  }

  modal.addEventListener("click", (e) => { if (e.target.closest("[data-give-close]")) close(); });
  // registered before books.js, so while the box is open it owns Escape, Tab and the arrow keys
  document.addEventListener("keydown", (e) => {
    if (!isOpen) return;
    e.stopImmediatePropagation();
    if (e.key === "Escape") { close(); return; }
    if (e.key === "Tab") {
      const f = Array.from(panel.querySelectorAll("button:not(:disabled), a[href], input:not([type=radio]), input[type=radio]:checked")).filter((el) => el.offsetParent);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* Links that carry data-give open the box instead of going straight to their href
     (which stays a real PDF link for anyone without JavaScript). */
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-give]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    open({ fund: a.dataset.give || "chf", book: a.dataset.book || undefined, title: a.dataset.title || undefined, download: a.getAttribute("href"), fromEl: a });
  }, true);

  /* ---------------- inline boxes ---------------- */
  settings().then((cfg) => {
    document.querySelectorAll("[data-give-box]").forEach((box) => {
      box.innerHTML = "";
      box.appendChild(makeForm({ fund: box.dataset.giveBox || "shelf" }, cfg));
      box.classList.add("is-ready");
    });
  });

  /* ---------------- back from Stripe: ?gave=<book slug> or ?gave=1 ---------------- */
  const q = new URLSearchParams(location.search);
  const gave = q.get("gave");
  if (gave) {
    // tidy the address bar so a refresh doesn't say thank you twice
    q.delete("gave"); q.delete("session");
    try { history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash); } catch (e) {}
    const link = gave !== "1" && document.querySelector(`a[data-give][data-book="${CSS.escape(gave)}"]`);
    const title = link ? link.dataset.title : "";
    const toast = document.createElement("div");
    toast.className = "give-thanks";
    toast.setAttribute("role", "status");
    toast.innerHTML = `
      <span class="give-thanks__goose" data-sticker="goose" aria-hidden="true"></span>
      <div class="give-thanks__copy">
        <b class="hand">thank you!</b>
        <p>${link
          ? `Your gift for <i>${esc(title)}</i> is in. Every book dollar (after Stripe's card fee) goes to Children's Health Foundation; we send it each term.`
          : "Your gift is in, and it goes into printing books for elementary schools and libraries."}</p>
        ${link ? `<a class="btn btn--yellow give-thanks__dl" href="${esc(link.getAttribute("href"))}" download>Download the PDF ${arrow}</a>` : ""}
      </div>
      <button class="give-thanks__x" type="button" aria-label="Dismiss">✕</button>`;
    document.body.appendChild(toast);
    if (KHS.hydrateStickers) KHS.hydrateStickers(toast);
    toast.querySelector(".give-thanks__x").addEventListener("click", () => {
      if (R) return toast.remove();
      gsap.to(toast, { y: 30, autoAlpha: 0, duration: 0.3, ease: "power2.in", onComplete: () => toast.remove() });
    });
    const party = () => {
      const r = toast.getBoundingClientRect();
      KHS.confetti(r.left + r.width / 2, r.top + 10, 26, 80);
      KHS.honkSound();
    };
    if (R) party();
    else gsap.fromTo(toast, { y: 120, rotation: 4, autoAlpha: 0 }, { y: 0, rotation: -1, autoAlpha: 1, duration: 0.8, delay: 0.6, ease: "back.out(1.6)", onComplete: party });
  }

  KHS.give = open;
  KHS.give.close = close;
})();
