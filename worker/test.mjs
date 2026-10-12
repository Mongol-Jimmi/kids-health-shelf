// Tests for the checkout worker with a fake Stripe. Run: node worker/test.mjs
import assert from "node:assert/strict";
import worker, { readBag, sessionParams, readGift } from "./src/index.js";
import catalog from "../assets/data/products.json" with { type: "json" };

// The sample merch ships as drafts; the tests open them up (same objects the worker reads).
const item = (id) => catalog.products.find((p) => p.id === id);
const onSale = (fn) => async () => {
  const drafts = catalog.products.filter((p) => p.draft);
  drafts.forEach((p) => { p.draft = false; });
  try { await fn(); } finally { drafts.forEach((p) => { p.draft = true; }); }
};
const BEFORE_CLOSE = Date.parse("2026-11-15T12:00:00Z");

const env = { STRIPE_SECRET_KEY: "sk_test_fake", SITE_URL: "https://kidshealthshelf.org", ALLOWED_ORIGINS: "https://kidshealthshelf.org,http://127.0.0.1:5517" };
const ORIGIN = "https://kidshealthshelf.org";
let sent = null;
const fakeStripe = async (url, init) => {
  sent = { url, init, form: new URLSearchParams(init.body.toString()) };
  return new Response(JSON.stringify({ id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" }), { status: 200 });
};
globalThis.fetch = fakeStripe;
const post = (body, origin = ORIGIN, e = env, path = "/checkout") =>
  worker.fetch(new Request(`https://khs-checkout.example.workers.dev${path}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }), e);
const give = (body, origin = ORIGIN) => post(body, origin, env, "/give");

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log("ok -", name); };

await test("bag validation merges duplicates and caps quantity", () => {
  const { lines, delivery } = readBag({ items: [{ id: "goose", qty: 2 }, { id: "goose", qty: 30 }, { id: "bee", qty: 1 }], delivery: "mail" });
  assert.equal(delivery, "mail");
  assert.deepEqual(lines.map((l) => [l.product.id, l.qty]), [["goose", 20], ["bee", 1]]);
});
await test("rejects empty bags, unknown stickers and bad quantities", () => {
  assert.throws(() => readBag({ items: [] }));
  assert.throws(() => readBag({ items: [{ id: "unicorn", qty: 1 }] }));
  assert.throws(() => readBag({ items: [{ id: "goose", qty: 0 }] }));
  assert.throws(() => readBag({ items: [{ id: "goose", qty: 1.5 }] }));
});
await test("prices come from the catalogue, not the browser", async () => {
  const res = await post({ items: [{ id: "goose", qty: 2, price: 1 }, { id: "pack", qty: 1 }], delivery: "pickup" });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).url, "https://checkout.stripe.com/c/pay/cs_test_123");
  assert.equal(sent.url, "https://api.stripe.com/v1/checkout/sessions");
  assert.equal(sent.init.headers.Authorization, "Bearer sk_test_fake");
  const f = sent.form;
  assert.equal(f.get("mode"), "payment");
  assert.equal(f.get("line_items[0][price_data][unit_amount]"), "300");
  assert.equal(f.get("line_items[0][quantity]"), "2");
  assert.equal(f.get("line_items[1][price_data][unit_amount]"), "1500");
  assert.equal(f.get("line_items[0][price_data][currency]"), "cad");
  assert.equal(f.get("shipping_options[0][shipping_rate_data][fixed_amount][amount]"), "0");
  assert.equal(f.get("shipping_address_collection[allowed_countries][0]"), null);
  assert.equal(f.get("success_url"), "https://kidshealthshelf.org/shop.html?paid={CHECKOUT_SESSION_ID}");
  assert.equal(f.get("cancel_url"), "https://kidshealthshelf.org/shop.html?bag=open");
});
await test("mail orders collect a Canadian address and add $2", async () => {
  await post({ items: [{ id: "bee", qty: 1 }], delivery: "mail" });
  assert.equal(sent.form.get("shipping_address_collection[allowed_countries][0]"), "CA");
  assert.equal(sent.form.get("shipping_options[0][shipping_rate_data][fixed_amount][amount]"), "200");
});
await test("refuses other websites", async () => {
  const res = await post({ items: [{ id: "bee", qty: 1 }] }, "https://evil.example");
  assert.equal(res.status, 403);
});
await test("CORS preflight answers for the site", async () => {
  const res = await worker.fetch(new Request("https://x/checkout", { method: "OPTIONS", headers: { Origin: ORIGIN } }), env);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
});
await test("bad bag gives a friendly 400", async () => {
  const res = await post({ items: [{ id: "unicorn", qty: 1 }] });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /isn't in the shop/);
});
await test("missing Stripe key gives a 503, not a crash", async () => {
  const res = await post({ items: [{ id: "bee", qty: 1 }] }, ORIGIN, { ...env, STRIPE_SECRET_KEY: "" });
  assert.equal(res.status, 503);
});
await test("Stripe errors don't leak to the visitor", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "Invalid API Key provided: sk_test_***" } }), { status: 401 });
  const res = await post({ items: [{ id: "bee", qty: 1 }] });
  assert.equal(res.status, 502);
  assert.doesNotMatch(JSON.stringify(await res.json()), /sk_test/);
  globalThis.fetch = fakeStripe;
});

// Merch and pre-order drops
await test("sample merch is a draft and can't be bought yet", async () => {
  assert.ok(item("tee").draft && item("tote").draft && item("rambutan-hardcover").draft);
  assert.throws(() => readBag({ items: [{ id: "tee", qty: 1, size: "M" }] }, BEFORE_CLOSE), /isn't on sale yet/);
  assert.throws(() => readBag({ items: [{ id: "tote", qty: 1 }] }, BEFORE_CLOSE), /isn't on sale yet/);
  const res = await post({ items: [{ id: "rambutan-hardcover", qty: 1 }] });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /isn't on sale yet/);
});
await test("sized merch keeps one line per size and names it", onSale(async () => {
  const { lines } = readBag({ items: [{ id: "tee", qty: 1, size: "M" }, { id: "tee", qty: 2, size: "L" }, { id: "tee", qty: 1, size: "M" }, { id: "tote", qty: 1 }] });
  assert.deepEqual(lines.map((l) => [l.product.id, l.size, l.qty]), [["tee", "M", 2], ["tee", "L", 2], ["tote", null, 1]]);
  const res = await post({ items: [{ id: "tee", qty: 1, size: "M" }, { id: "bee", qty: 1 }] });
  assert.equal(res.status, 200);
  const f = sent.form;
  assert.equal(f.get("line_items[0][price_data][product_data][name]"), `${item("tee").name} (M)`);
  assert.equal(f.get("line_items[0][price_data][unit_amount]"), String(item("tee").price));
  assert.equal(f.get("line_items[0][price_data][product_data][metadata][product_id]"), "tee");
  assert.equal(f.get("line_items[0][price_data][product_data][metadata][size]"), "M");
  assert.equal(f.get("line_items[0][price_data][product_data][metadata][kind]"), "merch");
  assert.equal(f.get("line_items[1][price_data][product_data][metadata][kind]"), "sticker");
  assert.equal(f.get("line_items[1][price_data][product_data][metadata][size]"), null);
  assert.equal(f.get("metadata[has_preorder]"), null);
}));
await test("rejects missing and made-up sizes, and sizes on unsized things", onSale(async () => {
  assert.throws(() => readBag({ items: [{ id: "tee", qty: 1 }] }), /pick a size/);
  assert.throws(() => readBag({ items: [{ id: "tee", qty: 1, size: "XXXL" }] }), /doesn't come in that size/);
  assert.throws(() => readBag({ items: [{ id: "tote", qty: 1, size: "M" }] }), /doesn't come in sizes/);
  assert.throws(() => readBag({ items: [{ id: "goose", qty: 1, size: "S" }] }), /doesn't come in sizes/);
  const res = await post({ items: [{ id: "tee", qty: 1, size: "XXXL" }] });
  assert.equal(res.status, 400);
}));
await test("pre-orders close after their closing day", onSale(() => {
  const bag = { items: [{ id: "rambutan-hardcover", qty: 1 }] };
  const closes = Date.parse(`${item("rambutan-hardcover").drop.closes}T00:00:00Z`);
  assert.equal(readBag(bag, closes + 23 * 3600000).lines.length, 1);
  assert.throws(() => readBag(bag, closes + 86400000), /have closed/);
  assert.throws(() => readBag(bag, Date.parse("2027-03-01T00:00:00Z")), /have closed/);
}));
await test("pre-orders can't go over the per-order limit", onSale(() => {
  const cap = Math.min(20, item("rambutan-hardcover").drop.limit);
  assert.equal(readBag({ items: [{ id: "rambutan-hardcover", qty: cap }] }, BEFORE_CLOSE).lines[0].qty, cap);
  assert.throws(() => readBag({ items: [{ id: "rambutan-hardcover", qty: cap + 1 }] }, BEFORE_CLOSE), /up to 20 .* at a time/);
  assert.throws(() => readBag({ items: [{ id: "rambutan-hardcover", qty: cap }, { id: "rambutan-hardcover", qty: 1 }] }, BEFORE_CLOSE), /up to 20/);
}));
await test("pre-orders tag the session and tell the buyer when they ship", onSale(() => {
  const f = sessionParams(readBag({ items: [{ id: "rambutan-hardcover", qty: 2 }, { id: "goose", qty: 1 }], delivery: "mail" }, BEFORE_CLOSE), "https://kidshealthshelf.org");
  assert.equal(f.get("metadata[has_preorder]"), "yes");
  assert.equal(f.get("metadata[delivery]"), "mail");
  assert.equal(f.get("line_items[0][price_data][product_data][metadata][kind]"), "preorder");
  assert.equal(f.get("line_items[0][price_data][product_data][metadata][product_id]"), "rambutan-hardcover");
  assert.equal(f.get("line_items[0][quantity]"), "2");
  assert.match(f.get("line_items[0][price_data][product_data][description]"), /Pre-order · ships January 2027/);
  assert.match(f.get("custom_text[submit][message]"), /ship in January 2027/);
}));

// Donate what you want
await test("gift validation: whole cents between the min and max", () => {
  const { min, max } = catalog.give;
  assert.deepEqual(readGift({ amount: 500, fund: "chf", book: "microville" }), { amount: 500, fund: "chf", book: "microville" });
  assert.deepEqual(readGift({ amount: min, fund: "shelf" }), { amount: min, fund: "shelf", book: null });
  assert.equal(readGift({ amount: max, fund: "shelf" }).amount, max);
  assert.throws(() => readGift({ amount: min - 1, fund: "chf" }), /start at \$1/);
  assert.throws(() => readGift({ amount: 0, fund: "chf" }), /start at/);
  assert.throws(() => readGift({ amount: max + 1, fund: "chf" }), /top out at \$1,000/);
  assert.throws(() => readGift({ amount: 250.5, fund: "chf" }), /whole number/);
  assert.throws(() => readGift({ amount: "500", fund: "chf" }), /whole number/);
  assert.throws(() => readGift({ fund: "chf" }), /whole number/);
});
await test("gift validation: only real funds and books", () => {
  assert.throws(() => readGift({ amount: 500, fund: "pizza" }), /fund/);
  assert.throws(() => readGift({ amount: 500, fund: "toString" }), /fund/);
  assert.throws(() => readGift({ amount: 500 }), /fund/);
  assert.throws(() => readGift({ amount: 500, fund: "chf", book: "harry-potter" }), /book/);
  assert.throws(() => readGift({ amount: 500, fund: "chf", book: "constructor" }), /book/);
  // book money always goes to Children's Health Foundation
  assert.throws(() => readGift({ amount: 500, fund: "shelf", book: "microville" }), /book gift/);
});
await test("a book gift is tagged on the session and the payment", async () => {
  const res = await give({ amount: 700, fund: "chf", book: "rambutan-tree", price: 1 });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).url, "https://checkout.stripe.com/c/pay/cs_test_123");
  const f = sent.form;
  assert.equal(sent.url, "https://api.stripe.com/v1/checkout/sessions");
  assert.equal(f.get("mode"), "payment");
  assert.equal(f.get("submit_type"), "donate");
  assert.equal(f.get("line_items[0][quantity]"), "1");
  assert.equal(f.get("line_items[0][price_data][unit_amount]"), "700");
  assert.equal(f.get("line_items[0][price_data][currency]"), "cad");
  assert.equal(f.get("line_items[0][price_data][product_data][name]"), "Donation for The Girl Under the Rambutan Tree");
  assert.equal(f.get("metadata[fund]"), "chf");
  assert.equal(f.get("metadata[book]"), "rambutan-tree");
  assert.equal(f.get("payment_intent_data[metadata][fund]"), "chf");
  assert.equal(f.get("payment_intent_data[metadata][book]"), "rambutan-tree");
  assert.equal(f.get("success_url"), "https://kidshealthshelf.org/books.html?gave=rambutan-tree&session={CHECKOUT_SESSION_ID}");
  assert.equal(f.get("cancel_url"), "https://kidshealthshelf.org/books.html?read=rambutan-tree");
  assert.match(f.get("custom_text[submit][message]"), /Children's Health Foundation each term/);
  assert.match(f.get("custom_text[submit][message]"), /can't issue tax receipts/);
});
await test("a general gift goes back to the donate box", async () => {
  const res = await give({ amount: 2500, fund: "shelf" });
  assert.equal(res.status, 200);
  const f = sent.form;
  assert.equal(f.get("line_items[0][price_data][product_data][name]"), "Donation: Printing the next books");
  assert.equal(f.get("metadata[fund]"), "shelf");
  assert.equal(f.get("metadata[book]"), null);
  assert.equal(f.get("payment_intent_data[metadata][fund]"), "shelf");
  assert.equal(f.get("payment_intent_data[metadata][book]"), null);
  assert.equal(f.get("success_url"), "https://kidshealthshelf.org/involved.html?gave=1#donate");
  assert.equal(f.get("cancel_url"), "https://kidshealthshelf.org/involved.html#donate");
});
await test("bad gifts get a friendly 400, other websites a 403", async () => {
  sent = null;
  for (const body of [{ amount: 50, fund: "chf" }, { amount: 100001, fund: "chf" }, { amount: 9.99, fund: "chf" }, { amount: 500, fund: "pizza" }, { amount: 500, fund: "chf", book: "nope" }, { amount: 500, fund: "shelf", book: "microville" }]) {
    const res = await give(body);
    assert.equal(res.status, 400);
    assert.equal(typeof (await res.json()).error, "string");
  }
  assert.equal(sent, null);
  assert.equal((await give({ amount: 500, fund: "chf" }, "https://evil.example")).status, 403);
  const pre = await worker.fetch(new Request("https://x/give", { method: "OPTIONS", headers: { Origin: ORIGIN } }), env);
  assert.equal(pre.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal((await post({ amount: 500, fund: "chf" }, ORIGIN, env, "/nope")).status, 404);
});
console.log(`\n${passed} passed`);
