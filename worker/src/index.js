/* Kids Health Shelf — checkout and giving.
   A tiny Cloudflare Worker with two doors, each turning a request into a Stripe
   Checkout Session and returning its URL. Stripe's hosted page shows Apple Pay,
   Google Pay and cards, so the website never touches card details.

     POST /checkout  a bag ({ items: [{ id, qty, size? }], delivery }) of stickers,
                     made-to-order merch and pre-order book drops
     POST /give      a donate-what-you-want gift ({ amount, fund, book? }); book
                     money goes to Children's Health Foundation, the rest prints books

   Prices and limits come from assets/data/products.json (bundled in at deploy
   time), never from the browser, so nobody can change a price in their dev tools.
   Every gift is tagged with its fund (and book) on the payment itself, so the
   treasurer can filter Stripe → Payments by metadata and send the right total on.

   Secrets / vars (see worker/README.md):
     STRIPE_SECRET_KEY  sk_test_… while testing, sk_live_… when the shop opens
     SITE_URL           https://kidshealthshelf.org
     ALLOWED_ORIGINS    comma-separated origins allowed to call this worker */
import catalog from "../../assets/data/products.json" with { type: "json" };

const MAX_QTY = 20;
const DAY = 86400000;
const byId = Object.fromEntries(catalog.products.map((p) => [p.id, p]));
// The free books on the shelf (slug → title), the only ones a book gift can name.
const BOOKS = {
  "rambutan-tree": "The Girl Under the Rambutan Tree",
  "nobody-looks-like-me": "Nobody Looks Like Me!",
  microville: "MicroVille"
};
const has = (obj, key) => typeof key === "string" && Object.prototype.hasOwnProperty.call(obj, key);
const dollars = (cents) => "$" + (cents % 100 ? (cents / 100).toFixed(2) : (cents / 100).toLocaleString("en-CA"));

function corsHeaders(origin, allowed) {
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

/* A pre-order is open until the end of its closing day. Toronto's day ends a few
   hours into the next UTC day, so closing at UTC midnight after it is close enough. */
function dropClosed(p, now) {
  return now >= Date.parse(`${p.drop.closes}T00:00:00Z`) + DAY;
}

/* Validate the bag. Returns { lines, delivery }; throws a message meant for the visitor.
   `now` is only there so the tests can move the clock past a pre-order's closing date. */
export function readBag(body, now = Date.now()) {
  if (!body || !Array.isArray(body.items) || body.items.length === 0) throw "Your bag is empty.";
  const merged = new Map();
  for (const it of body.items) {
    const p = it && has(byId, it.id) ? byId[it.id] : null;
    const qty = Number(it && it.qty);
    const size = it && it.size != null && it.size !== "" ? it.size : null;
    if (!p) throw "One of those things isn't in the shop any more. Please refresh the page.";
    if (p.draft) throw `${p.name} isn't on sale yet. Please refresh the page.`;
    if (!Number.isInteger(qty) || qty < 1) throw "Quantities must be whole numbers.";
    if (p.sizes && p.sizes.length) {
      if (size == null) throw `Please pick a size for the ${p.name}.`;
      if (!p.sizes.includes(size)) throw `The ${p.name} doesn't come in that size. Please pick another.`;
    } else if (size != null) throw `The ${p.name} doesn't come in sizes. Please refresh the page.`;
    if (p.kind === "preorder" && dropClosed(p, now)) throw `Pre-orders for ${p.name} have closed.`;
    const key = size ? `${p.id}|${size}` : p.id;
    const total = (merged.has(key) ? merged.get(key).qty : 0) + qty;
    // drop.limit caps one order, not the whole drop: the worker keeps no count of copies sold.
    const cap = Math.min(MAX_QTY, p.drop ? p.drop.limit : MAX_QTY);
    if (p.kind === "preorder" && total > cap) throw `You can pre-order up to ${cap} of ${p.name} at a time.`;
    merged.set(key, { product: p, size, qty: total });
  }
  const delivery = body.delivery === "mail" ? "mail" : "pickup";
  return { lines: [...merged.values()].map((l) => ({ ...l, qty: Math.min(MAX_QTY, l.qty) })), delivery };
}

/* Form body for POST https://api.stripe.com/v1/checkout/sessions */
export function sessionParams({ lines, delivery }, site) {
  const f = new URLSearchParams();
  f.set("mode", "payment");
  f.set("success_url", `${site}/shop.html?paid={CHECKOUT_SESSION_ID}`);
  f.set("cancel_url", `${site}/shop.html?bag=open`);
  lines.forEach(({ product, qty, size }, i) => {
    const kind = product.kind || "sticker";
    const note = kind === "preorder" ? `Pre-order · ships ${product.drop.ships}` : product.madeToOrder;
    f.set(`line_items[${i}][quantity]`, String(qty));
    f.set(`line_items[${i}][price_data][currency]`, catalog.currency);
    f.set(`line_items[${i}][price_data][unit_amount]`, String(product.price));
    f.set(`line_items[${i}][price_data][product_data][name]`, size ? `${product.name} (${size})` : product.name);
    f.set(`line_items[${i}][price_data][product_data][description]`, note ? `${product.spec} · ${note}` : product.spec);
    f.set(`line_items[${i}][price_data][product_data][metadata][product_id]`, product.id);
    if (size) f.set(`line_items[${i}][price_data][product_data][metadata][size]`, size);
    f.set(`line_items[${i}][price_data][product_data][metadata][kind]`, kind);
  });
  const d = catalog.delivery[delivery];
  if (delivery === "mail") f.set("shipping_address_collection[allowed_countries][0]", "CA");
  f.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
  f.set("shipping_options[0][shipping_rate_data][display_name]", d.label);
  f.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(d.price));
  f.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", catalog.currency);
  f.set("metadata[delivery]", delivery);
  const ships = [...new Set(lines.filter((l) => l.product.kind === "preorder").map((l) => l.product.drop.ships))];
  if (ships.length) f.set("metadata[has_preorder]", "yes");
  const notes = [delivery === "pickup"
    ? "We'll email you when your order is ready to pick up on campus."
    : "We'll mail your order within a week or two."];
  if (lines.some((l) => l.product.madeToOrder)) notes.push("Made-to-order merch is printed after you pay, so it takes about two weeks.");
  if (ships.length) notes.push(`Pre-orders are charged now and ship in ${ships.join(" / ")}; we'll email you when they're on the way.`);
  f.set("custom_text[submit][message]", notes.join(" "));
  return f;
}

/* Validate a gift. Returns { amount, fund, book }; throws a message meant for the visitor. */
export function readGift(body) {
  const { min, max } = catalog.give;
  const amount = body && body.amount;
  if (typeof amount !== "number" || !Number.isInteger(amount)) throw "Please give a whole number of cents.";
  if (amount < min) throw `Gifts start at ${dollars(min)}. Thank you for thinking of us!`;
  if (amount > max) throw `Online gifts top out at ${dollars(max)}. For more, please email the club.`;
  if (!has(catalog.funds, body.fund)) throw "That fund isn't one we collect for. Please refresh the page.";
  const book = body.book != null && body.book !== "" ? body.book : null;
  if (book != null && !has(BOOKS, book)) throw "That book isn't on our shelf. Please refresh the page.";
  // Book money always goes to Children's Health Foundation, so the treasurer's fund=chf total includes it.
  if (book != null && body.fund !== "chf") throw "That book gift didn't make sense. Please refresh the page.";
  return { amount, fund: body.fund, book };
}

/* Form body for a donate-what-you-want Checkout Session. */
export function giftParams({ amount, fund, book }, site) {
  const f = new URLSearchParams();
  const { label, note } = catalog.funds[fund];
  const name = book ? `Donation for ${BOOKS[book]}` : `Donation: ${label}`;
  f.set("mode", "payment");
  f.set("submit_type", "donate");
  f.set("success_url", book ? `${site}/books.html?gave=${book}&session={CHECKOUT_SESSION_ID}` : `${site}/involved.html?gave=1#donate`);
  f.set("cancel_url", book ? `${site}/books.html?read=${book}` : `${site}/involved.html#donate`);
  f.set("line_items[0][quantity]", "1");
  f.set("line_items[0][price_data][currency]", catalog.currency);
  f.set("line_items[0][price_data][unit_amount]", String(amount));
  f.set("line_items[0][price_data][product_data][name]", name);
  f.set("line_items[0][price_data][product_data][description]", note || label);
  // Tag both the session and the payment, so Stripe → Payments can be filtered by fund.
  for (const scope of ["metadata", "payment_intent_data[metadata]"]) {
    f.set(`${scope}[kind]`, "donation");
    f.set(`${scope}[fund]`, fund);
    if (book) f.set(`${scope}[book]`, book);
  }
  f.set("payment_intent_data[description]", name);
  f.set("custom_text[submit][message]", note || `Thank you for giving to ${label}.`);
  return f;
}

const ROUTES = {
  "/checkout": { read: readBag, params: sessionParams, oops: "That bag didn't make sense." },
  "/give": { read: readGift, params: giftParams, oops: "That gift didn't make sense." }
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedList = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const allowed = allowedList.includes(origin);
    const headers = corsHeaders(origin, allowed);
    const path = new URL(request.url).pathname;
    const route = has(ROUTES, path) ? ROUTES[path] : null;

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST" || !route) return json({ error: "Not found" }, 404, headers);
    if (!allowed) return json({ error: "This shop only takes orders from the Kids Health Shelf website." }, 403, headers);
    if (!env.STRIPE_SECRET_KEY) return json({ error: "The shop isn't connected to Stripe yet." }, 503, headers);

    let order;
    try { order = route.read(await request.json()); }
    catch (msg) { return json({ error: typeof msg === "string" ? msg : route.oops }, 400, headers); }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: route.params(order, (env.SITE_URL || "https://kidshealthshelf.org").replace(/\/$/, ""))
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      console.log("stripe error", res.status, data.error && data.error.message);
      return json({ error: "Checkout is having a nap. Please try again in a minute." }, 502, headers);
    }
    return json({ url: data.url }, 200, headers);
  }
};
