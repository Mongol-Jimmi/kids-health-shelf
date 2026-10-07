/* Books page: books drop onto the shelf, spines lift on hover, a click pulls
   the book out and its cover swings open; like buttons burst into hearts. */
(function () {
  const gsap = window.gsap;
  const KHS = window.KHS;
  if (!gsap || !KHS) return;
  const R = KHS.REDUCED;
  const rand = gsap.utils.random;

  /* pdf: drop the file in assets/books/ and put its path here, e.g.
     "assets/books/rambutan-tree.pdf". Leave it "" and the button stays hidden. */
  const BOOKS = {
    rambutan: {
      pdf: "",
      num: "KHS BOOK 0001", title: "The Girl Under the Rambutan Tree", by: "by Nadith Ranasinghe",
      blurb: "A young girl with big dreams learns to embrace her uniqueness despite not fitting in. A heartfelt story about resilience, self-worth, and finding strength in who you are.",
      facts: [["Themes", "resilience, self-worth"], ["Made by", "Western students"]],
      cover: "cover--sage", art: "tree", cta: ["See it on Instagram", "https://www.instagram.com/kids.health.shelf/"]
    },
    nobody: {
      pdf: "",
      num: "KHS BOOK 0002", title: "Nobody Looks Like Me!", by: "by Emily Leha",
      blurb: "A story about friendship, families, and appreciating the differences that make each of us who we are, instead of letting them get in the way of what really matters.",
      facts: [["Themes", "difference, family"], ["Made by", "Western students"]],
      cover: "cover--yellow", art: "face", cta: ["See it on Instagram", "https://www.instagram.com/kids.health.shelf/"]
    },
    soon: {
      num: "KHS BOOK 000?", title: "This spot is saved", by: "by someone like you",
      blurb: "The next Kids Health Shelf book hasn't been written yet. We're hiring authors and illustrators on a rolling basis, and no experience is needed.",
      facts: [["Looking for", "writers & artists"], ["Experience", "not required"]],
      cover: "cover--pink", art: "question", cta: ["See open roles", "involved.html"]
    }
  };

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
      if (R) return;
      gsap.to(s, { y: -26, rotation: rand(-4, 4), duration: 0.45, ease: "back.out(3)", overwrite: "auto" });
      KHS.popSound(rand(1, 1.5));
    });
    s.addEventListener("pointerleave", () => gsap.to(s, { y: 0, rotation: 0, duration: 0.8, ease: "elastic.out(1, 0.4)", overwrite: "auto" }));
    s.addEventListener("click", () => openBook(s.dataset.book, s));
  });

  /* ---------------- open-book modal ---------------- */
  const modal = document.querySelector(".book-modal");
  const book = modal.querySelector(".open-book");
  const cover = modal.querySelector(".open-book__cover");
  const front = cover.querySelector(".face--front");
  const back = cover.querySelector(".face--back");
  const rightBits = modal.querySelectorAll(".open-book__right > *");
  const scrim = modal.querySelector(".book-modal__scrim");
  const closeBtn = modal.querySelector(".open-book__close");
  const field = (k) => modal.querySelector(`[data-b="${k}"]`);
  let opener = null;
  let open = false;

  function fill(id) {
    const b = BOOKS[id];
    field("num").textContent = b.num;
    field("title").textContent = b.title;
    field("by").textContent = b.by;
    field("blurb").textContent = b.blurb;
    field("facts").innerHTML = b.facts.map(([k, v]) => `<div class="fact"><b>${k}:</b><span>${v}</span></div>`).join("");
    const cta = field("cta");
    cta.textContent = b.cta[0];
    cta.href = b.cta[1];
    if (/^https?:/.test(b.cta[1])) { cta.target = "_blank"; cta.rel = "noopener"; } else { cta.removeAttribute("target"); cta.removeAttribute("rel"); }
    const pdf = field("pdf");
    pdf.hidden = !b.pdf;
    if (b.pdf) pdf.href = b.pdf; else pdf.removeAttribute("href");
    cta.classList.toggle("btn--blue", !b.pdf);
    front.className = "face face--front cover " + b.cover;
    field("ctitle").textContent = b.title;
    field("cby").textContent = b.by;
    field("cart").innerHTML = KHS.stickers[b.art];
    // the illustration lives on the inside of the cover, which lands on the left page
    back.innerHTML = `<div class="open-book__art">${KHS.stickers[b.art]}</div><span class="hand">a Kids Health Shelf book</span>`;
  }

  function openBook(id, from) {
    if (open || !BOOKS[id]) return;
    open = true;
    opener = from;
    fill(id);
    modal.classList.add("is-open");
    if (KHS.lenis) KHS.lenis.stop();
    KHS.popSound(0.9);
    if (R) { gsap.set(cover, { autoAlpha: 0 }); closeBtn.focus(); return; }
    const narrow = innerWidth <= 640;
    gsap.timeline({ onComplete: () => closeBtn.focus() })
      .fromTo(scrim, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 })
      .fromTo(book, { y: 160, scale: 0.55, rotation: -8, autoAlpha: 0 }, { y: 0, scale: 1, rotation: 0, autoAlpha: 1, duration: 0.7, ease: "back.out(1.5)" }, "<")
      .fromTo(cover, { rotationY: 0 }, { rotationY: narrow ? -100 : -180, duration: 1.1, ease: "power3.inOut", transformPerspective: 2200 }, "-=0.1")
      .add(() => { if (narrow) gsap.set(cover, { autoAlpha: 0 }); })
      .from(rightBits, { autoAlpha: 0, y: 18, stagger: 0.07, duration: 0.45, ease: "power2.out" }, "-=0.45")
      .from(back.querySelector(".open-book__art"), { scale: 0.4, rotation: -15, duration: 0.8, ease: "elastic.out(1, 0.5)" }, "-=0.6");
  }

  function closeBook() {
    if (!open) return;
    const done = () => {
      modal.classList.remove("is-open");
      gsap.set([cover, book, scrim, ...rightBits], { clearProps: "all" });
      open = false;
      if (KHS.lenis) KHS.lenis.start();
      if (opener) opener.focus();
    };
    if (R) { done(); return; }
    gsap.timeline({ onComplete: done })
      .set(cover, { autoAlpha: 1 })
      .to(cover, { rotationY: 0, duration: 0.55, ease: "power2.in" })
      .to(book, { y: 120, scale: 0.6, rotation: 6, autoAlpha: 0, duration: 0.4, ease: "power2.in" })
      .to(scrim, { autoAlpha: 0, duration: 0.3 }, "<");
  }

  modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeBook));
  document.addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "Escape") closeBook();
    if (e.key === "Tab") {
      // keep focus inside the open book
      const f = Array.from(modal.querySelectorAll("button, a[href]"));
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------------- likes ---------------- */
  gsap.utils.toArray(".like-btn").forEach((btn) => {
    const count = btn.parentElement.querySelector("[data-likes]");
    let n = 0;
    btn.addEventListener("click", () => {
      n++;
      count.textContent = n;
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
