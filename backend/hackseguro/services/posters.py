"""School poster + public landing page renderer."""
from __future__ import annotations

import io
from PIL import Image, ImageDraw, ImageFont

from ..core.config import settings
from .certificates import qr_png_bytes


def _font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in candidates:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()


def generate_school_poster(school: dict, share_url: str) -> bytes:
    W, H = 1080, 1920
    img = Image.new("RGB", (W, H), "#00357a")
    d = ImageDraw.Draw(img)
    d.rectangle([(0, 0), (W, 12)], fill="#d0e80b")

    d.ellipse([(W // 2 - 130, 220), (W // 2 + 130, 480)], fill="#d0e80b")
    d.text((W // 2, 340), "HS", fill="#00357a", font=_font(120, True), anchor="mm")

    d.text((W // 2, 570), "HACK-SEGURO", fill="#FFFFFF", font=_font(72, True), anchor="mm")
    d.text((W // 2, 640), "Aprende ciberseguridad jugando", fill="#d0e80b", font=_font(36), anchor="mm")

    school_name = (school.get("name") or "")[:34]
    d.text((W // 2, 830), "Únete a mi escuela", fill="#FFFFFF", font=_font(42), anchor="mm")
    d.text((W // 2, 900), school_name, fill="#FFFFFF", font=_font(52, True), anchor="mm")

    card_top, card_bottom = 1000, 1240
    d.rounded_rectangle([(120, card_top), (W - 120, card_bottom)], radius=40, fill="#FFFFFF")
    d.text((W // 2, card_top + 60), "Código de escuela", fill="#475569", font=_font(30), anchor="mm")
    d.text((W // 2, card_top + 150), school.get("code", ""), fill="#00357a", font=_font(88, True), anchor="mm")

    qr_size = 480
    qr_img = Image.open(io.BytesIO(qr_png_bytes(share_url, qr_size))).convert("RGB")
    img.paste(qr_img, ((W - qr_size) // 2, 1310))
    d.text((W // 2, 1840), "Escanea para descargar Hack-Seguro", fill="#d0e80b", font=_font(32), anchor="mm")

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def render_join_landing_html(school: dict | None, code: str, ref: str | None) -> str:
    school_line = f"<h2>Únete a {school['name']}</h2><p>Código: <strong>{code}</strong></p>" if school else ""
    ref_line = f'<p style="color:#94a3b8;font-size:13px">Invitado por un embajador digital 🛡️</p>' if ref else ""
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Únete a Hack-Seguro</title>
    <style>body{{background:#00357a;color:#fff;font-family:sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}}
    .card{{background:#fff;color:#0f172a;padding:32px;border-radius:24px;max-width:500px}}
    h1{{color:#00357a}} .cta{{display:inline-block;margin-top:20px;padding:14px 28px;background:#d0e80b;color:#00357a;
    border-radius:999px;font-weight:800;text-decoration:none}}</style></head><body><div class="card">
    <h1>🛡️ Hack-Seguro</h1>{school_line}{ref_line}
    <p>Aprende ciberseguridad jugando cada día. Compite con tu escuela y gana insignias.</p>
    <a class="cta" href="{settings.PUBLIC_BASE_URL}">Abrir Hack-Seguro</a>
    </div></body></html>"""
