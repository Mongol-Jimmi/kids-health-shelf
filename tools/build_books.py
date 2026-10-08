"""Build the flip-book pages and shelf spines from the book PDFs.

    python tools/build_books.py            (all books)
    python tools/build_books.py microville (one book)

For every book in BOOKS it writes
  assets/books/pages/<slug>/NN.webp   one image per PDF page (the flip-book reads these)
  assets/books/spines/<slug>.webp     a spine made from the book's own cover art and fonts

The spine fonts are the ones embedded in each PDF, so the lettering matches the cover.
Re-run after replacing a PDF, then update that book's `pages` count in assets/js/books.js.
Needs PyMuPDF, Pillow and numpy.
"""
import io
import os
import sys

import fitz
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOKS_DIR = os.path.join(ROOT, "assets", "books")
PAGE_H = 1400            # px height of each page image
SPINE_H = 1000           # px height of each spine image (shown ~340px tall)
fitz.TOOLS.mupdf_display_errors(False)


def render_pages(slug):
    doc = fitz.open(os.path.join(BOOKS_DIR, slug + ".pdf"))
    out = os.path.join(BOOKS_DIR, "pages", slug)
    os.makedirs(out, exist_ok=True)
    for old in os.listdir(out):
        os.remove(os.path.join(out, old))
    for i, page in enumerate(doc):
        zoom = PAGE_H / page.rect.height
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        img.save(os.path.join(out, f"{i + 1:02d}.webp"), "WEBP", quality=80, method=6)
    return doc.page_count


def cover(slug, zoom=4.0):
    page = fitz.open(os.path.join(BOOKS_DIR, slug + ".pdf"))[0]
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples), zoom


def embedded_font(slug, name_part, size):
    doc = fitz.open(os.path.join(BOOKS_DIR, slug + ".pdf"))
    for f in doc[0].get_fonts():
        if name_part in f[3]:
            buf = doc.extract_font(f[0])[3]
            return ImageFont.truetype(io.BytesIO(buf), size)
    raise SystemExit(f"{slug}: no embedded font like {name_part}")


def key_out(img, keep, open_px=0):
    """Return an RGBA copy where only pixels passing keep(rgb array) stay opaque.
    open_px drops thin strokes (string-light wires) narrower than about that many pixels."""
    a = np.asarray(img.convert("RGB")).astype(np.int16)
    mask = keep(a).astype(np.uint8) * 255
    m = Image.fromarray(mask)
    if open_px:
        m = m.filter(ImageFilter.MinFilter(open_px)).filter(ImageFilter.MaxFilter(open_px))
    m = m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = img.convert("RGBA")
    out.putalpha(m)
    return out.crop(out.getbbox())


def grain(img, amount=10, seed=1):
    rng = np.random.default_rng(seed)
    a = np.asarray(img).astype(np.int16)
    n = rng.normal(0, amount, a.shape[:2])[..., None]
    a[..., :3] = np.clip(a[..., :3] + n, 0, 255)
    return Image.fromarray(a.astype(np.uint8), img.mode)


def logo(cov, zoom, box_pt):
    """Crop the round Kids Health Shelf badge from a cover (box in PDF points)."""
    x0, y0, x1, y1 = [round(v * zoom) for v in box_pt]
    c = cov.crop((x0, y0, x1, y1)).convert("RGBA")
    m = Image.new("L", c.size, 0)
    ImageDraw.Draw(m).ellipse((2, 2, c.width - 3, c.height - 3), fill=255)
    c.putalpha(m)
    return c


def fit(img, w=None, h=None):
    """Scale to width w, or height h, or the largest size inside w x h."""
    if w and h:
        s = min(w / img.width, h / img.height)
    elif w:
        s = w / img.width
    else:
        s = h / img.height
    return img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)


def strip(parts, length, thick, gap):
    """Lay RGBA parts end to end along a horizontal strip (the spine before it is turned)."""
    s = Image.new("RGBA", (round(length), round(thick)), (0, 0, 0, 0))
    total = sum(p.width for p in parts) + gap * (len(parts) - 1)
    x = (s.width - total) / 2
    for p in parts:
        s.alpha_composite(p, (round(x), round((s.height - p.height) / 2)))
        x += p.width + gap
    return s


def text_img(text, font, fill, shadow=None, offset=(0, 0)):
    bb = font.getbbox(text)
    pad = 12 + max(abs(offset[0]), abs(offset[1]))
    im = Image.new("RGBA", (bb[2] - bb[0] + pad * 2, bb[3] - bb[1] + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    o = (pad - bb[0], pad - bb[1])
    if shadow:
        d.text((o[0] + offset[0], o[1] + offset[1]), text, font=font, fill=shadow)
    d.text(o, text, font=font, fill=fill)
    return im.crop(im.getbbox())


def turn(s):
    """Spines read top to bottom: the left end of the strip becomes the top."""
    return s.rotate(-90, expand=True)


def shade(spine):
    """Round the spine a little: soft light down the middle, darker at both edges."""
    w, h = spine.size
    x = np.linspace(-1, 1, w)
    light = (1 - 0.16 * x ** 4 - 0.05 * x ** 2)[None, :, None]
    a = np.asarray(spine).astype(np.float32)
    a[..., :3] = np.clip(a[..., :3] * light, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def gradient(w, h, top, bottom):
    t = np.linspace(0, 1, h)[:, None, None]
    g = np.array(top, float) * (1 - t) + np.array(bottom, float) * t
    return Image.fromarray(np.repeat(g, w, axis=1).astype(np.uint8)).convert("RGBA")


# ---------------------------------------------------------------- spines

def spine_rambutan(slug, W):
    cov, z = cover(slug)
    H = SPINE_H
    px = lambda x, y: cov.getpixel((round(x * z), round(y * z)))
    # the cover from top to bottom: rambutan canopy, sky, grassy hill
    bg = gradient(W, H, px(300, 300), px(20, 420))
    d = ImageDraw.Draw(bg)
    leaf, dark = px(17, 40), px(300, 250)
    canopy = H * 0.13
    d.rectangle((0, 0, W, canopy), fill=leaf)
    for i in range(4):
        cx = W * (i / 3)
        d.ellipse((cx - W * 0.24, canopy - W * 0.2, cx + W * 0.24, canopy + W * 0.16), fill=leaf, outline=dark, width=5)
    d.rectangle((0, 0, W, canopy - W * 0.06), fill=leaf)
    for cx, cy in ((0.22, 0.035), (0.74, 0.07)):
        for dx, dy in ((0, 0), (0.07, 0.025), (-0.06, 0.03), (0.01, 0.05)):
            x, y = W * (cx + dx), H * cy + W * dy * 1.6
            d.ellipse((x - 15, y - 15, x + 15, y + 15), fill=(214, 34, 40), outline=(120, 14, 18), width=3)
    hill = H * 0.8
    d.polygon([(0, hill + 40), (W * 0.5, hill - 10), (W, hill + 20), (W, H), (0, H)], fill=px(30, 640))
    bg = grain(bg, 6)

    title = embedded_font(slug, "Lazydog", 140)
    author = embedded_font(slug, "Gaegu", 110)
    yellow, shadow = (0xFD, 0xD0, 0x5B), (58, 36, 22)
    l1 = text_img("The Girl Under The", title, yellow, shadow=shadow, offset=(6, 6))
    l2 = text_img("Rambutan Tree", title, yellow, shadow=shadow, offset=(6, 6))
    l1 = fit(l1, h=l2.height * 0.72)
    block = Image.new("RGBA", (max(l1.width, l2.width), l1.height + l2.height + 14), (0, 0, 0, 0))
    block.alpha_composite(l1, ((block.width - l1.width) // 2, 0))
    block.alpha_composite(l2, ((block.width - l2.width) // 2, l1.height + 14))
    block = fit(block, w=H * 0.41, h=W * 0.8)
    name = fit(text_img("Ranasinghe", author, (255, 255, 255), shadow=shadow, offset=(3, 3)), w=H * 0.13, h=W * 0.34)
    run = strip([block, name], H * 0.59, W, round(H * 0.03))
    bg.alpha_composite(turn(run), (0, round(H * 0.155)))
    badge = fit(logo(cov, z, (512, 44, 592, 124)), w=W * 0.68)
    bg.alpha_composite(badge, (round((W - badge.width) / 2), round(H - badge.height - W * 0.16)))
    return bg


def spine_nobody(slug, W):
    cov, z = cover(slug)
    H = SPINE_H
    px = lambda x, y: cov.getpixel((round(x * z), round(y * z)))
    counter = px(30, 735)
    bg = Image.new("RGBA", (W, H), px(30, 120))
    d = ImageDraw.Draw(bg)
    band = H * 0.84
    d.rectangle((0, band, W, H), fill=counter)
    d.rectangle((0, band - 6, W, band), fill=tuple(max(0, c - 30) for c in counter))
    bg = grain(bg, 9)

    brown = lambda a: (a[..., 0] < 140) & (a[..., 1] < 105) & (a[..., 2] < 95) & (a[..., 0] > a[..., 2])
    crop = lambda x0, y0, x1, y1: cov.crop((round(x0 * z), round(y0 * z), round(x1 * z), round(y1 * z)))
    nobody = key_out(crop(95, 10, 500, 130), brown, 9)
    looks = key_out(crop(50, 130, 570, 260), brown, 9)
    red = lambda a: (a[..., 0] > 200) & (a[..., 1] < 140) & (a[..., 2] < 110)
    me = key_out(crop(180, 460, 460, 640), red)
    # the cover outlines ME! in white; redraw that outline around the keyed letters
    solid = me.getchannel("A").filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))
    me.putalpha(solid)
    pad = Image.new("RGBA", (me.width + 60, me.height + 60), (0, 0, 0, 0))
    pad.alpha_composite(me, (30, 30))
    halo = Image.new("RGBA", pad.size, (255, 248, 240, 0))
    halo.putalpha(pad.getchannel("A").filter(ImageFilter.MaxFilter(29)).filter(ImageFilter.GaussianBlur(2)))
    halo.alpha_composite(pad)
    me = halo.crop(halo.getbbox())

    th = W * 0.66
    parts = [fit(nobody, h=th), fit(looks, h=th), fit(me, h=th * 1.05)]
    gap = W * 0.14
    room = band - H * 0.04
    total = sum(p.width for p in parts) + gap * 2
    if total > room:
        s = room / total
        parts = [p.resize((round(p.width * s), round(p.height * s)), Image.LANCZOS) for p in parts]
        gap *= s
    run = strip(parts, room, W, round(gap))
    bg.alpha_composite(turn(run), (0, round(H * 0.02)))
    badge = fit(logo(cov, z, (478, 646, 566, 734)), w=W * 0.74)
    bg.alpha_composite(badge, (round((W - badge.width) / 2), round(band + (H - band - badge.height) / 2)))
    return bg


def spine_microville(slug, W):
    cov, z = cover(slug)
    H = SPINE_H
    px = lambda x, y: cov.getpixel((round(x * z), round(y * z)))
    sky = px(40, 60)
    bg = Image.new("RGBA", (W, H), px(4, 400))
    inner = round(W * 0.09)
    d = ImageDraw.Draw(bg)
    d.rectangle((inner, inner, W - inner - 1, H - inner - 1), fill=sky)
    d.polygon([(inner, H * 0.76), (W * 0.5, H * 0.72), (W - inner, H * 0.77), (W - inner, H - inner), (inner, H - inner)], fill=px(40, 500))
    bg = grain(bg, 5)

    # the "Welcome to MICROVILLE" banner, keyed out of the sky behind it
    sk = np.array(sky, np.int16)
    banner = key_out(cov.crop((round(55 * z), round(100 * z), round(560 * z), round(225 * z))),
                     lambda a: np.abs(a - sk).sum(axis=2) > 46)
    banner = turn(fit(banner, w=H * 0.68, h=W * 0.86))
    bg.alpha_composite(banner, (round((W - banner.width) / 2), round(H * 0.035)))
    badge = fit(logo(cov, z, (520, 10, 600, 90)), w=W * 0.62)
    bg.alpha_composite(badge, (round((W - badge.width) / 2), round(H - badge.height - W * 0.22)))
    return bg


BOOKS = {
    # slug: (spine builder, spine width in px at SPINE_H; 24-page books are wider than the 16-page one)
    "rambutan-tree": (spine_rambutan, 290),
    "nobody-looks-like-me": (spine_nobody, 240),
    "microville": (spine_microville, 290),
}


def main(only):
    os.makedirs(os.path.join(BOOKS_DIR, "spines"), exist_ok=True)
    for slug, (build, width) in BOOKS.items():
        if only and slug not in only:
            continue
        spine = shade(build(slug, width))
        spine.convert("RGB").save(os.path.join(BOOKS_DIR, "spines", slug + ".webp"), "WEBP", quality=90, method=6)
        n = render_pages(slug) if "--spines" not in sys.argv else "skipped"
        print(f"{slug}: spine {spine.size[0]}x{spine.size[1]}, pages {n}")


if __name__ == "__main__":
    main([a for a in sys.argv[1:] if not a.startswith("--")])
