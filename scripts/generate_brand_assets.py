"""Generate the platform branding assets from brand-assets/ (one-off build step).

Outputs:
  user-ui/public/branding/logo.png            header/footer wordmark (transparent)
  user-ui/public/branding/logo-white.png      white wordmark for dark backgrounds
  user-ui/public/branding/favicon-32.png      browser tab icon
  user-ui/public/branding/icon-192.png        PWA / Android
  user-ui/public/branding/icon-512.png        PWA / Android
  user-ui/public/branding/apple-touch-icon.png
  user-ui/public/app-icon.png                 app icon (replaces the old one)
  user-ui/public/partners/unit-logo.png       unit logo used on the home page
  admin-ui/public/branding/...                same set for the admin dashboard
  admin-ui/app/icon.png                       Next.js app icon
  backend/src/config/brandLogo.ts             default logo data URL for documents
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "brand-assets" / "logo.png"
SRC_WHITE = ROOT / "brand-assets" / "logo-white.png"

USER_PUBLIC = ROOT / "user-ui" / "public"
ADMIN_PUBLIC = ROOT / "admin-ui" / "public"
BACKEND_CONFIG = ROOT / "backend" / "src" / "config"

# Brand blue sampled from the logo — used behind the square app icons.
BRAND_BG = (255, 255, 255, 255)


def fit(img: Image.Image, box: tuple[int, int]) -> Image.Image:
    copy = img.copy()
    copy.thumbnail(box, Image.LANCZOS)
    return copy


def square_icon(logo: Image.Image, size: int, padding: float = 0.10) -> Image.Image:
    """Logo centred on a white square, used for favicons and app icons."""
    canvas = Image.new("RGBA", (size, size), BRAND_BG)
    inner = int(size * (1 - padding * 2))
    art = fit(logo, (inner, inner))
    canvas.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return canvas


def transparent_logo(logo: Image.Image, box: tuple[int, int]) -> Image.Image:
    art = fit(logo, box)
    canvas = Image.new("RGBA", art.size, (255, 255, 255, 0))
    canvas.alpha_composite(art, (0, 0))
    return canvas


def compact(logo: Image.Image, width: int = 360) -> Image.Image:
    """Palette-quantised wordmark (~18KB instead of ~75KB at the same size)."""
    height = max(1, round(width * logo.height / logo.width))
    art = logo.resize((width, height), Image.LANCZOS)
    canvas = Image.new("RGBA", art.size, (255, 255, 255, 0))
    canvas.alpha_composite(art)
    return canvas.quantize(colors=256, method=Image.FASTOCTREE)


def main() -> None:
    logo = Image.open(SRC).convert("RGBA")
    logo_white = Image.open(SRC_WHITE).convert("RGBA")

    for base in (USER_PUBLIC, ADMIN_PUBLIC):
        branding = base / "branding"
        branding.mkdir(parents=True, exist_ok=True)

        compact(logo).save(branding / "logo.png", optimize=True)
        compact(logo_white, 400).save(branding / "logo-white.png", optimize=True)

        square_icon(logo, 32).save(branding / "favicon-32.png", optimize=True)
        square_icon(logo, 192).save(branding / "icon-192.png", optimize=True)
        square_icon(logo, 512).save(branding / "icon-512.png", optimize=True)
        square_icon(logo, 180).save(branding / "apple-touch-icon.png", optimize=True)

        # Partners strip + installable app icon keep the old file names.
        if base == USER_PUBLIC:
            compact(logo).save(base / "partners" / "unit-logo.png", optimize=True)
            square_icon(logo, 512).save(base / "app-icon.png", optimize=True)

    # Next.js app icon (admin dashboard) — replaces app/icon.svg.
    square_icon(logo, 512).save(ROOT / "admin-ui" / "app" / "icon.png", optimize=True)

    # Default branding logo stored in the DB (certificates, Excel, email HTML).
    doc_logo = compact(logo)
    doc_logo.save(BACKEND_CONFIG / "_logo-default.png", optimize=True)
    import base64

    encoded = base64.b64encode((BACKEND_CONFIG / "_logo-default.png").read_bytes()).decode()
    print("doc logo bytes:", (BACKEND_CONFIG / "_logo-default.png").stat().st_size)
    (BACKEND_CONFIG / "_logo-default.png").unlink()

    ts = (
        "// Default platform logo (transparent PNG data URL).\n"
        "//\n"
        "// Generated from `brand-assets/logo.png` and used only as the DEFAULT\n"
        "// `branding.logoHeader` / `logoFooter` value seed — certificates, Excel\n"
        "// exports and anything else that embeds the logo can render it without a\n"
        "// network request. The live value is stored in `system_settings.branding`\n"
        "// and can be replaced by uploading a new logo in the admin settings.\n"
        f"export const DEFAULT_LOGO_DATA_URL =\n  'data:image/png;base64,{encoded}';\n"
    )
    BACKEND_CONFIG.mkdir(parents=True, exist_ok=True)
    (BACKEND_CONFIG / "brandLogo.ts").write_text(ts, encoding="utf-8")

    print("logo bytes:", (USER_PUBLIC / 'branding' / 'logo.png').stat().st_size)
    print("data url bytes:", len(encoded))
    print("done")


if __name__ == "__main__":
    main()
