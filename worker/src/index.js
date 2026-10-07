/* Kids Health Shelf — sticker checkout.
   A tiny Cloudflare Worker that turns a bag ({ items: [{ id, qty }], delivery })
   into a Stripe Checkout Session and returns its URL. Stripe's hosted page shows
   Apple Pay, Google Pay and cards, so the website never touches card details.

   Prices come from assets/data/products.json (bundled in at deploy time), never
   from the browser, so nobody can change a price in their dev tools.

   Secrets / vars (see worker/README.md):
     STRIPE_SECRET_KEY  sk_test_… while testing, sk_live_… when the shop opens
     SITE_URL           https://kidshealthshelf.org
     ALLOWED_ORIGINS    comma-separated origins allowed to call this worker */
import catalog from "../../assets/data/products.json" with { type: "json" };

const MAX_QTY = 20;
const byId = Object.fromEntries(catalog.products.map((p) => [p.id, p]));

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

/* Validate the bag. Returns { lines, delivery }; throws a message meant for the visitor. */
export function readBag(body) {
  if (!body || !Array.isArray(body.items) || body.items.length === 0) throw "Your bag is empty.";
  const merged = new Map();
  for (const it of body.items) {
    const p = it && byId[it.id];
    const qty = Number(it && it.qty);
    if (!p) throw "One of those stickers isn't in the shop any more. Please refresh the page.";
    if (!Number.isInteger(qty) || qty < 1) throw "Sticker quantities must be whole numbers.";
    merged.set(p.id, Math.min(MAX_QTY, (merged.get(p.id) || 0) + qty));
  }
  const delivery = body.delivery === "mail" ? "mail" : "pickup";
  return { lines: [...merged].map(([id, qty]) => ({ product: byId[id], qty })), delivery };
}

/* Form body for POST https://api.stripe.com/v1/checkout/sessions */
export function sessionParams({ lines, delivery }, site) {
  const f = new URLSearchParams();
  f.set("mode", "payment");
  f.set("success_url", `${site}/shop.html?paid={CHECKOUT_SESSION_ID}`);
  f.set("cancel_url", `${site}/shop.html?bag=open`);
  lines.forEach(({ product, qty }, i) => {
    f.set(`line_items[${i}][quantity]`, String(qty));
    f.set(`line_items[${i}][price_data][currency]`, catalog.currency);
    f.set(`line_items[${i}][price_data][unit_amount]`, String(product.price));
    f.set(`line_items[${i}][price_data][product_data][name]`, product.name);
    f.set(`line_items[${i}][price_data][product_data][description]`, product.spec);
    f.set(`line_items[${i}][price_data][product_data][metadata][sticker_id]`, product.id);
  });
  const d = catalog.delivery[delivery];
  if (delivery === "mail") f.set("shipping_address_collection[allowed_countries][0]", "CA");
  f.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
  f.set("shipping_options[0][shipping_rate_data][display_name]", d.label);
  f.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(d.price));
  f.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", catalog.currency);
  f.set("metadata[delivery]", delivery);
  f.set("custom_text[submit][message]", delivery === "pickup"
    ? "We'll email you when your stickers are ready to pick up on campus."
    : "We'll mail your stickers within a week or two.");
  return f;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedList = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const allowed = allowedList.includes(origin);
    const headers = corsHeaders(origin, allowed);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST" || new URL(request.url).pathname !== "/checkout") return json({ error: "Not found" }, 404, headers);
    if (!allowed) return json({ error: "This shop only takes orders from the Kids Health Shelf website." }, 403, headers);
    if (!env.STRIPE_SECRET_KEY) return json({ error: "The shop isn't connected to Stripe yet." }, 503, headers);

    let bag;
    try { bag = readBag(await request.json()); }
    catch (msg) { return json({ error: typeof msg === "string" ? msg : "That bag didn't make sense." }, 400, headers); }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: sessionParams(bag, (env.SITE_URL || "https://kidshealthshelf.org").replace(/\/$/, ""))
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      console.log("stripe error", res.status, data.error && data.error.message);
      return json({ error: "Checkout is having a nap. Please try again in a minute." }, 502, headers);
    }
    return json({ url: data.url }, 200, headers);
  }
};
