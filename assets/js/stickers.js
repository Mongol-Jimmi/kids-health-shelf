/* Kids Health Shelf — sticker library.
   Same drawings as the Paper "Stickers & Components" sheet. Any element with
   data-sticker="name" gets the matching SVG injected. */
(function () {
  const INK = "var(--ink)";
  const S = {
    goose: `<svg viewBox="0 0 120 140" fill="none" aria-hidden="true">
      <g class="goose-feet"><path d="M86 128 L80 136 L92 136 Z M60 128 L54 136 L66 136 Z" fill="#FFA23A" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></g>
      <path class="goose-body" d="M30 126 C8 122 6 92 24 80 C34 73 48 72 52 64 L52 38 C52 20 66 12 78 16 C90 20 92 34 86 42 C80 50 74 54 74 64 C90 70 106 84 104 104 C102 122 82 128 60 128 Z" fill="#FFFFFF" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path class="goose-beak" d="M88 28 L104 33 L88 39 Z" fill="#FFA23A" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="79" cy="28" r="5.2" fill="#FFFFFF"/>
      <circle class="goose-eye" cx="79" cy="28" r="3.2" fill="${INK}"/>
      <circle cx="73" cy="36" r="3" fill="var(--pink)" opacity="0.75"/>
      <g class="goose-book" transform="rotate(-10 58 96)"><rect x="38" y="82" width="42" height="30" rx="3" fill="var(--pink)" stroke="${INK}" stroke-width="3"/><path d="M59 82 L59 112" stroke="${INK}" stroke-width="2.5"/><path d="M44 90 L54 90 M44 96 L54 96 M64 90 L74 90 M64 96 L74 96" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/></g>
    </svg>`,
    burst: `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="var(--blue)"><rect x="40" y="4" width="20" height="92" rx="10"/><rect x="40" y="4" width="20" height="92" rx="10" transform="rotate(45 50 50)"/><rect x="40" y="4" width="20" height="92" rx="10" transform="rotate(90 50 50)"/><rect x="40" y="4" width="20" height="92" rx="10" transform="rotate(135 50 50)"/></g></svg>`,
    burstPink: `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="var(--pink)"><rect x="40" y="4" width="20" height="92" rx="10"/><rect x="40" y="4" width="20" height="92" rx="10" transform="rotate(60 50 50)"/><rect x="40" y="4" width="20" height="92" rx="10" transform="rotate(120 50 50)"/></g></svg>`,
    burstYellow: `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="var(--yellow)"><rect x="40" y="4" width="20" height="92" rx="10"/><rect x="40" y="4" width="20" height="92" rx="10" transform="rotate(45 50 50)"/><rect x="40" y="4" width="20" height="92" rx="10" transform="rotate(90 50 50)"/><rect x="40" y="4" width="20" height="92" rx="10" transform="rotate(135 50 50)"/></g></svg>`,
    daisy: `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="var(--pink)" stroke="${INK}" stroke-width="2.5"><circle cx="50" cy="24" r="17"/><circle cx="72.5" cy="37" r="17"/><circle cx="72.5" cy="63" r="17"/><circle cx="50" cy="76" r="17"/><circle cx="27.5" cy="63" r="17"/><circle cx="27.5" cy="37" r="17"/></g><circle cx="50" cy="50" r="14" fill="var(--yellow)" stroke="${INK}" stroke-width="2.5"/></svg>`,
    apple: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 30 C30 16 6 28 9 56 C12 84 32 98 50 89 C68 98 88 84 91 56 C94 28 70 16 50 30 Z" fill="var(--red)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M50 30 C50 22 52 15 57 9" stroke="${INK}" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M55 20 C62 7 78 8 82 13 C73 24 61 25 55 20 Z" fill="var(--sage)" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="28" cy="48" rx="6" ry="10" fill="#FFFFFF" opacity="0.55" transform="rotate(20 28 48)"/></svg>`,
    ladybug: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M40 14 C36 6 30 4 26 6 M60 14 C64 6 70 4 74 6" stroke="${INK}" stroke-width="3" stroke-linecap="round" fill="none"/><circle cx="50" cy="24" r="14" fill="${INK}"/><circle cx="50" cy="58" r="34" fill="var(--red)" stroke="${INK}" stroke-width="3"/><path d="M50 26 L50 92" stroke="${INK}" stroke-width="3"/><g fill="${INK}"><circle cx="34" cy="48" r="6"/><circle cx="66" cy="48" r="6"/><circle cx="30" cy="70" r="5"/><circle cx="70" cy="70" r="5"/></g></svg>`,
    bee: `<svg viewBox="0 0 110 95" aria-hidden="true"><g class="bee-wings"><ellipse cx="46" cy="26" rx="14" ry="20" fill="var(--sky)" stroke="${INK}" stroke-width="2.5" transform="rotate(-20 46 26)"/><ellipse cx="66" cy="24" rx="13" ry="19" fill="var(--sky)" stroke="${INK}" stroke-width="2.5" transform="rotate(18 66 24)"/></g><path d="M18 58 L6 62 L18 66 Z" fill="${INK}"/><ellipse cx="54" cy="60" rx="38" ry="27" fill="var(--yellow)" stroke="${INK}" stroke-width="3"/><path d="M44 35 Q38 60 44 85 M62 35 Q56 60 62 85" stroke="${INK}" stroke-width="8" fill="none"/><circle cx="80" cy="54" r="3.5" fill="${INK}"/><path d="M78 66 Q83 70 88 65" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`,
    star: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8 L61.2 34.6 L89.9 37 L68.1 55.9 L74.7 84 L50 69 L25.3 84 L31.9 55.9 L10.1 37 L38.8 34.6 Z" fill="var(--yellow)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/></svg>`,
    starPink: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8 L61.2 34.6 L89.9 37 L68.1 55.9 L74.7 84 L50 69 L25.3 84 L31.9 55.9 L10.1 37 L38.8 34.6 Z" fill="var(--pink)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/></svg>`,
    starSage: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8 L61.2 34.6 L89.9 37 L68.1 55.9 L74.7 84 L50 69 L25.3 84 L31.9 55.9 L10.1 37 L38.8 34.6 Z" fill="var(--sage)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/></svg>`,
    heart: `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 86 C20 64 8 48 10 32 C12 18 26 10 38 14 C44 16 48 20 50 26 C52 20 56 16 62 14 C74 10 88 18 90 32 C92 48 80 64 50 86 Z" fill="var(--pink)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/></svg>`,
    pencil: `<svg viewBox="0 0 160 40" aria-hidden="true"><path d="M30 8 H138 V32 H30 Z" fill="var(--yellow)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M138 8 H152 V32 H138 Z" fill="var(--pink)" stroke="${INK}" stroke-width="3"/><path d="M30 8 L6 20 L30 32 Z" fill="#F6D7A7" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M6 20 L14 16 L14 24 Z" fill="${INK}"/><path d="M30 20 H138" stroke="${INK}" stroke-width="2" opacity=".35"/></svg>`,
    tree: `<svg viewBox="0 0 200 180" aria-hidden="true"><path d="M86 178 L114 178 L110 96 L90 96 Z" fill="#8A5A3B" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M30 92 C10 70 24 36 54 38 C60 14 96 6 112 26 C134 12 172 24 168 54 C192 66 186 104 158 106 C150 124 116 124 104 110 C90 124 52 122 46 104 C34 104 26 98 30 92 Z" fill="#7FB069" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><g fill="var(--red)" stroke="${INK}" stroke-width="2"><circle cx="58" cy="62" r="6"/><circle cx="96" cy="44" r="6"/><circle cx="134" cy="58" r="6"/><circle cx="150" cy="86" r="6"/><circle cx="76" cy="92" r="6"/><circle cx="116" cy="88" r="6"/></g></svg>`,
    face: `<svg viewBox="0 0 160 160" aria-hidden="true"><path d="M30 80 C30 34 130 34 130 80 C130 130 30 130 30 80 Z" fill="#F6D7A7" stroke="${INK}" stroke-width="3.5"/><path d="M26 76 C24 30 70 14 96 26 C120 34 140 52 134 86 C120 64 96 52 66 50 C52 60 40 70 26 76 Z" fill="#7A4A2A" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><circle cx="62" cy="88" r="9" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/><circle cx="64" cy="89" r="4.5" fill="#2F8F5B"/><circle cx="100" cy="88" r="9" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/><circle cx="102" cy="89" r="4.5" fill="#2F8F5B"/><path d="M68 112 Q81 120 94 112" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="48" cy="104" r="7" fill="var(--pink)" opacity=".7"/><circle cx="114" cy="104" r="7" fill="var(--pink)" opacity=".7"/></svg>`,
    question: `<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M40 42 C40 22 80 18 82 42 C84 58 60 60 60 78" stroke="${INK}" stroke-width="10" fill="none" stroke-linecap="round"/><circle cx="60" cy="98" r="7" fill="${INK}"/></svg>`
  };

  /* Hand-drawn numbers 01–04 (single strokes, drawn on scroll with DrawSVG). */
  const zero = "M32 16 C14 16 8 42 10 58 C12 78 22 88 34 86 C48 84 54 64 52 44 C50 26 44 15 31 17";
  const DIGITS = {
    1: "M78 28 L92 14 L90 86 M76 86 L104 85",
    2: "M70 32 C72 14 98 12 102 28 C106 42 88 60 70 86 L108 84",
    3: "M72 24 C84 10 104 16 100 32 C98 44 86 48 80 48 C94 48 106 58 102 72 C98 88 76 90 70 78",
    4: "M96 86 L94 14 L68 64 L110 62"
  };

  function numberSVG(n) {
    return `<svg viewBox="0 0 120 100" class="handnum" aria-hidden="true"><path d="${zero}"/><path d="${DIGITS[n]}"/></svg>`;
  }

  function hydrate(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-sticker]").forEach((el) => {
      if (el.dataset.hydrated) return;
      const svg = S[el.dataset.sticker];
      if (!svg) return;
      el.insertAdjacentHTML("beforeend", svg);
      el.dataset.hydrated = "1";
    });
    scope.querySelectorAll("[data-handnum]").forEach((el) => {
      if (el.dataset.hydrated) return;
      el.innerHTML = numberSVG(el.dataset.handnum);
      el.dataset.hydrated = "1";
    });
  }

  window.KHS = window.KHS || {};
  window.KHS.stickers = S;
  window.KHS.hydrateStickers = hydrate;
  hydrate();
})();
