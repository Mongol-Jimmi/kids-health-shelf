/* In the news: press clippings from assets/data/press.json, newest first,
   taped to the page and dropped in like the flyers on the home page.

   To add an article, add one object to "articles" in press.json (order doesn't
   matter, the page sorts by date). Write the summary in your own words and never
   copy the outlet's photos or logo:

     {
       "outlet": "London Free Press",
       "date": "2026-11-03",
       "title": "The headline, exactly as the outlet wrote it",
       "url": "https://…",
       "summary": "One or two sentences about what the story says.",
       "byline": "Reporter's name",      (optional)
       "read": "Read on the Free Press",  (optional, button text; default "Read on <outlet>")
       "tint": "yellow"                   (optional: yellow, sky, sage, pink, blue)
     }

   Once a story is out, delete the "Coming soon" entry from "upcoming". */
(function () {
  const list = document.querySelector(".clips");
  if (!list) return;
  const gsap = window.gsap;
  const KHS = window.KHS || {};
  const R = !gsap || KHS.REDUCED;
  const TINTS = ["yellow", "sky", "sage", "pink", "blue"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  // "2025-07-06" → "July 6, 2025", read as a calendar date so no time zone can shift it a day
  function longDate(iso) {
    const [y, m, d] = String(iso).split("-").map(Number);
    return y && m && d ? `${MONTHS[m - 1]} ${d}, ${y}` : "";
  }
  const ARROW = '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M5 13 L13 5 M7 5 H13 V11" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function clip(a, i) {
    const tint = TINTS.includes(a.tint) ? a.tint : TINTS[i % TINTS.length];
    const read = a.read || `Read on ${a.outlet}`;
    return `<li class="clip clip--${tint}" style="--rot:${i % 2 ? 1.6 : -1.8}deg">
      <span class="clip__tape" aria-hidden="true"></span>
      <article>
        <header class="clip__mast">
          <span class="clip__outlet">${esc(a.outlet)}</span>
          <time class="clip__date" datetime="${esc(a.date)}">${longDate(a.date)}</time>
        </header>
        <h2 class="clip__title">${esc(a.title)}</h2>
        ${a.byline ? `<p class="clip__byline">By ${esc(a.byline)}</p>` : ""}
        <p class="clip__summary">${esc(a.summary)}</p>
        <a class="btn clip__read" href="${esc(a.url)}" target="_blank" rel="noopener" data-cursor="read it"
           aria-label="${esc(read)}: ${esc(a.title)} (opens in a new tab)">${esc(read)} ${ARROW}</a>
      </article>
    </li>`;
  }

  function soon(u) {
    return `<li class="clip clip--soon" style="--rot:-1deg">
      <span class="clip__goose" data-sticker="goose" aria-hidden="true"></span>
      <span class="clip__outlet">${esc(u.outlet || "Coming soon")}</span>
      <p class="clip__summary">${esc(u.note || "")}</p>
      <span class="hand clip__psst">writing about us? DM <a href="https://www.instagram.com/kids.health.shelf/" target="_blank" rel="noopener">@kids.health.shelf</a></span>
    </li>`;
  }

  fetch("assets/data/press.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((press) => {
      const articles = (press.articles || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
      list.innerHTML = articles.map(clip).join("") + (press.upcoming || []).map(soon).join("");
      if (KHS.hydrateStickers) KHS.hydrateStickers(list);
      list.setAttribute("aria-busy", "false");
      animate();
    })
    .catch(() => {
      list.innerHTML = '<li class="lede">The clippings couldn\'t load. Please refresh the page.</li>';
      list.setAttribute("aria-busy", "false");
    });

  function animate() {
    if (R) return;
    const clips = gsap.utils.toArray(".clip", list);
    clips.forEach((c, i) => {
      const tape = c.querySelector(".clip__tape");
      const tl = gsap.timeline({ scrollTrigger: { trigger: c, start: "top 88%", once: true }, delay: (i % 3) * 0.14 })
        .from(c, { y: -120, rotation: gsap.utils.random(-14, 14), autoAlpha: 0, duration: 0.9, ease: "back.out(1.4)", clearProps: "transform" });
      if (tape) tl.from(tape, { scaleX: 0, duration: 0.35, ease: "power2.out" }, "-=0.35");
      const goose = c.querySelector(".clip__goose");
      if (goose) tl.from(goose, { scale: 0, rotation: -40, duration: 0.9, ease: "elastic.out(1, 0.5)" }, "-=0.2");
    });
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
})();
