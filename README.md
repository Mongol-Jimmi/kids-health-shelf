# Kids Health Shelf website

Static site (no build step) served by GitHub Pages at https://kidshealthshelf.org.
Design source: the Paper file "Kids Health Shelf — Website".

To preview locally: `python -m http.server 5517` in this folder, then open http://127.0.0.1:5517.

## Sticker shop

How it works:

1. Visitors fill a bag on any page (it lives in their browser).
2. **Check out** sends the bag to a tiny Cloudflare Worker (`worker/`).
3. The worker asks Stripe for a checkout page using the prices in `assets/data/products.json`.
4. Stripe's page shows **Apple Pay, Google Pay and cards**, takes the payment, emails a receipt, and sends the buyer back to `shop.html?paid=…`.

The website never sees card details, and nobody can change a price from their browser.

Until `checkoutUrl` in `assets/data/products.json` is filled in, the shop works but checkout says "opens soon".

### Switching the till on (one time, ~20 minutes)

1. **Stripe account.** Sign up at https://dashboard.stripe.com as the club. Check with the club treasurer / USC first about whose bank account payouts go to.
2. **Test key.** Stay in **Test mode** and copy the *Secret key* (`sk_test_…`) from Developers → API keys. Never paste it into the website or GitHub.
3. **Deploy the worker** from this folder:
   ```
   cd worker
   npx wrangler login                        # opens the browser, log in to the club's Cloudflare
   npx wrangler secret put STRIPE_SECRET_KEY  # paste the sk_test_… key
   npx wrangler deploy                       # prints https://khs-checkout.<name>.workers.dev
   ```
4. **Connect the site.** Put that URL in `assets/data/products.json` as `"checkoutUrl"`, then commit and push.
5. **Test a purchase.** Use card `4242 4242 4242 4242`, any future date, any CVC. Apple Pay shows in Safari on an iPhone or Mac that has a card in Wallet; Google Pay shows in Chrome when a card is saved. Orders appear in Stripe → Payments.
6. **Go live.** Activate the Stripe account, then run `npx wrangler secret put STRIPE_SECRET_KEY` again with the live `sk_live_…` key.

Stripe charges about 2.9% + 30¢ per card payment in Canada, so the pack and multi-sticker orders keep more money for the club than single $3 orders.

Run the checkout tests any time with `node worker/test.mjs`.

### Changing stickers or prices

Edit `assets/data/products.json`:

- Prices are in cents (`300` = $3).
- `art` is a sticker name from `assets/js/stickers.js`.
- `bg` is one of: yellow, sky, sage, pink, wash, blue.
- `tags` drive the filter buttons.

Then push **and** run `npx wrangler deploy` in `worker/` again. The worker keeps its own copy of the prices, so this step is needed every time prices change.

## Merch and pre-orders

The shop also sells made-to-order merch (a tee, a tote) and limited book drops sold on pre-order. They live in the same `products` list in `assets/data/products.json`, with a few extra fields:

| Field | Used for | Example |
|---|---|---|
| `kind` | `"sticker"` (the default when missing), `"merch"` or `"preorder"` | `"merch"` |
| `sizes` | merch that comes in sizes; the buyer has to pick one | `["S", "M", "L", "XL"]` |
| `madeToOrder` | the line under a merch item, also shown in Stripe | `"Printed when you order · ships in about 2 weeks"` |
| `drop.closes` | last day to pre-order (Toronto time); after it the button reads "Pre-orders closed" | `"2026-12-01"` |
| `drop.ships` | when pre-orders ship, in words; Stripe tells the buyer this too | `"January 2027"` |
| `drop.limit` | the most copies one order can take (never more than 20, the worker's cap on any line) | `100` |
| `draft` | `true` shows the item as "Coming soon" and nobody can buy it | `true` |

The tee, tote and hardcover in the file now are **samples** (made-up prices, "(sample)" in the name) with `"draft": true`. To sell one for real:

1. Set the real name, price, `spec` and sizes, and take "(sample)" and `"badge": "Sample"` out.
2. For a pre-order, set the real `drop.closes`, `drop.ships` and `drop.limit`.
3. Change `"draft": true` to `"draft": false` (or delete it).
4. Push **and** run `npx wrangler deploy` in `worker/` again. The worker reads its own copy of `products.json`, so until it is re-deployed the item stays unbuyable (or keeps its old price).

Things to know:

- **Pre-orders are charged straight away** and ship later. The bag and Stripe's page both say when.
- **The limit is per order, not overall.** The worker has no storage, so it can't count copies across all buyers. Watch Stripe → Payments and set the item back to `"draft": true` (then re-deploy) once the drop sells out.
- **Fulfilment is manual**, or through a print-on-demand service the merch lead picks. Each order's lines carry `product_id`, `size` and `kind` in Stripe, and orders with a pre-order carry `has_preorder: yes`, so the merch lead can export them and print or place the order.

## Donations and book money

Reading the books is free. **Download PDF** on the Books page opens a "donate what you want" box: $0 just downloads the file, anything else goes through Stripe. There is also a general donation box on `involved.html#donate`. Both are drawn by `assets/js/give.js` and paid through the worker's `POST /give` endpoint (`{ amount, fund, book? }`, amount in cents). Until `checkoutUrl` is set, the boxes say donations open soon, and the $0 download still works.

The money goes to one of two funds, set in `"funds"` in `products.json`:

| Fund | Comes from | Goes to |
|---|---|---|
| `chf` | a donation for a book PDF | **Children's Health Foundation** (London, Ontario; supports Children's Hospital at LHSC), sent on by the club each term |
| `shelf` | the general box on Get involved | printing the next books for schools and libraries |

The amount limits and preset buttons are in `"give"`, in cents: `min` 100 ($1), `max` 100000 ($1,000), `presets` $5 / $10 / $25.

All of it is paid **to the club's Stripe account** first, so there is one clear record. The site promises that every dollar given for a book (after Stripe's card fee) goes to the Foundation each term, and never claims tax receipts (a student club can't issue them). Keep it that way when editing the copy.

**For the treasurer (VP Finance), each term:**

1. In Stripe → Payments, search `metadata["fund"]:"chf"` and set the date range to the term. `metadata["fund"]:"shelf"` shows the printing money, and `metadata["kind"]:"donation"` shows every gift. Book gifts also carry `book` (for example `rambutan-tree`). The same tags are on the Checkout session.
2. Export that list as CSV and add up the **Net** column (the amount after Stripe's fee).
3. Send that total to Children's Health Foundation (https://childhealth.ca/), and keep the export and their confirmation with the club's records.

**Before going live**, confirm the arrangement with Children's Health Foundation (that they're happy to be named, and how they want the money sent) and with the USC (that the club may collect money for another charity, and which bank account Stripe pays out to).

A new book can be named in a gift only once it is added to `BOOKS` near the top of `worker/src/index.js` as well as to `books.js`, and the worker is re-deployed.

## News

`news.html` and the "As seen in" strip on the home page show press clippings. The clippings come from `assets/data/press.json`. To add one, add an object to `"articles"` (the page sorts them newest first):

```json
{
  "outlet": "London Free Press",
  "date": "2026-11-03",
  "title": "The headline, exactly as the outlet wrote it",
  "url": "https://…",
  "summary": "One or two sentences, in our own words, about what the story says.",
  "byline": "Reporter's name",
  "read": "Read on the Free Press",
  "tint": "yellow"
}
```

`byline`, `read` (the button text, "Read on <outlet>" by default) and `tint` (yellow, sky, sage, pink or blue) are optional. Don't copy the outlet's photos or logo. Once a new story is out, delete the "Coming soon" entry from `"upcoming"`. The home-page strip is plain HTML in `index.html` (search for "AS SEEN IN"), so add the outlet there too if it should show on the home page.

## Books (the shelf and the flip-book reader)

Each book on the Books page has a spine made from its own cover, and opens into a flip-book of its real pages (drag or tap a page, arrow keys, or the slider). The PDF is still offered as a download.

To add or replace a book:

1. Put the PDF in `assets/books/` (for example `assets/books/rambutan-tree.pdf`).
2. Run `python tools/build_books.py` (needs `pip install pymupdf pillow numpy`). It writes one image per page to `assets/books/pages/<name>/` and the spine to `assets/books/spines/<name>.webp`. A brand-new book also needs a spine recipe in `BOOKS` at the bottom of that script (copy one of the three and adjust the crop boxes).
3. In `assets/js/books.js`, set that book's `slug` (the PDF name) and `pages` (its page count).
4. In `books.html`, give the book a `spine spine--real` button on the shelf pointing at its spine image.

## Team photos

1. Put a portrait photo (about 600×700px, JPG) in `assets/team/`.
2. In `team.html`, replace the initials inside that person's `polaroid__photo` with an image tag. There is an example in the comment above the polaroids.
3. Update the name, role and fun fact on the same card.

## Pencil (draw mode)

The pencil button in the nav, and the "Pick up a pencil" buttons, toggle `assets/js/draw.js` on every page. Drawings stay for the visitor's browser session and are never uploaded anywhere.
