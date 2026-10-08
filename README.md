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
