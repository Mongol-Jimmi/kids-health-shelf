// Tests for the checkout worker with a fake Stripe. Run: node worker/test.mjs
import assert from "node:assert/strict";
import worker, { readBag } from "./src/index.js";

const env = { STRIPE_SECRET_KEY: "sk_test_fake", SITE_URL: "https://kidshealthshelf.org", ALLOWED_ORIGINS: "https://kidshealthshelf.org,http://127.0.0.1:5517" };
const ORIGIN = "https://kidshealthshelf.org";
let sent = null;
const fakeStripe = async (url, init) => {
  sent = { url, init, form: new URLSearchParams(init.body.toString()) };
  return new Response(JSON.stringify({ id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" }), { status: 200 });
};
globalThis.fetch = fakeStripe;
const post = (body, origin = ORIGIN, e = env) =>
  worker.fetch(new Request("https://khs-checkout.example.workers.dev/checkout", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }), e);

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
console.log(`\n${passed} passed`);
