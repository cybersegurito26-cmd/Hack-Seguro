"""PDF certificate generation + QR."""
from __future__ import annotations

import io
from datetime import datetime

import qrcode
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader

from ..core.config import settings


def qr_png_bytes(url: str, size: int = 240) -> bytes:
    qr = qrcode.QRCode(border=1, box_size=8)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#00357a", back_color="white").convert("RGB")
    img = img.resize((size, size))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def draw_certificate(name: str, module_title: str, cert_id: str, when: datetime) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=landscape(A4))
    W, H = landscape(A4)

    navy = HexColor("#00357a")
    lime = HexColor("#d0e80b")
    ink = HexColor("#0F172A")
    muted = HexColor("#475569")

    c.setFillColor(navy); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(HexColor("#FFFFFF")); c.roundRect(1.5 * cm, 1.5 * cm, W - 3 * cm, H - 3 * cm, 20, fill=1, stroke=0)
    c.setFillColor(lime); c.roundRect(1.5 * cm, H - 4.5 * cm, W - 3 * cm, 1.6 * cm, 10, fill=1, stroke=0)

    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 26); c.drawCentredString(W / 2, H - 3.6 * cm, "HACK-SEGURO")

    c.setFillColor(navy); c.setFont("Helvetica-Bold", 40); c.drawCentredString(W / 2, H - 6.5 * cm, "Certificado de participación")
    c.setFillColor(muted); c.setFont("Helvetica", 14); c.drawCentredString(W / 2, H - 8 * cm, "Otorgado a")
    c.setFillColor(ink); c.setFont("Helvetica-Bold", 32); c.drawCentredString(W / 2, H - 10 * cm, name)
    c.setFillColor(muted); c.setFont("Helvetica", 14); c.drawCentredString(W / 2, H - 11.4 * cm, "por completar exitosamente el módulo")
    c.setFillColor(navy); c.setFont("Helvetica-Bold", 22); c.drawCentredString(W / 2, H - 13 * cm, module_title)
    c.setFillColor(muted); c.setFont("Helvetica", 11)
    c.drawCentredString(W / 2, H - 15.5 * cm, f"Emitido el {when.strftime('%d/%m/%Y')} · ID: {cert_id}")

    # QR code
    verify_url = f"{settings.PUBLIC_BASE_URL}/api/verify/{cert_id}"
    try:
        qr_png = qr_png_bytes(verify_url, 220)
        qr_img = ImageReader(io.BytesIO(qr_png))
        c.drawImage(qr_img, W - 5.5 * cm, 1.8 * cm, width=3.5 * cm, height=3.5 * cm, mask="auto")
        c.setFillColor(muted); c.setFont("Helvetica", 8)
        c.drawRightString(W - 1.8 * cm, 1.6 * cm, "Escanea para verificar")
    except Exception:
        pass

    c.setFont("Helvetica-Oblique", 10); c.setFillColor(muted)
    c.drawString(2 * cm, 1.8 * cm, "App educativa Hack-Seguro · Prevención de ciberdelitos en México")
    c.showPage(); c.save()
    return buf.getvalue()


VERIFY_HTML_TEMPLATE = """<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Verificar certificado · Hack-Seguro</title>
<style>
  :root {{ --navy:#00357a; --lime:#d0e80b; --ink:#0f172a; --muted:#475569; --white:#fff; --success:#16a34a; --danger:#ef4444; }}
  * {{ box-sizing: border-box }}
  body {{ margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:var(--navy); color:var(--ink); min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }}
  .card {{ background:var(--white); border-radius:24px; max-width:560px; width:100%; padding:32px; box-shadow:0 30px 80px rgba(0,0,0,0.35); }}
  .badge {{ display:inline-flex; align-items:center; gap:8px; padding:8px 14px; border-radius:999px; font-weight:800; font-size:14px; margin-bottom:20px; }}
  .badge.valid {{ background:#dcfce7; color:var(--success) }} .badge.invalid {{ background:#fee2e2; color:var(--danger) }}
  h1 {{ margin:0 0 8px 0; font-size:26px; color:var(--navy) }}
  h2 {{ margin:24px 0 8px 0; font-size:15px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; font-weight:800 }}
  .name {{ font-size:28px; font-weight:800; color:var(--ink); margin:4px 0 0 0 }}
  .row {{ margin:6px 0; color:var(--muted); font-size:15px }}
  .row strong {{ color:var(--ink) }}
  .footer {{ margin-top:32px; padding-top:20px; border-top:1px solid #e2e8f0; color:var(--muted); font-size:13px; }}
  .brand {{ display:flex; align-items:center; gap:12px; margin-bottom:24px }}
  .brand .logo {{ width:44px; height:44px; border-radius:22px; background:var(--lime); display:inline-flex; align-items:center; justify-content:center; color:var(--navy); font-weight:900; }}
  .brand span {{ color:var(--navy); font-weight:800; letter-spacing:0.5px }}
</style></head><body>
<div class="card">
  <div class="brand"><div class="logo">HS</div><span>Hack-Seguro</span></div>
  {content}
  <div class="footer">App educativa Hack-Seguro · Prevención de ciberdelitos en México · ID {cert_id}</div>
</div>
</body></html>"""


def render_verify_html(cert_id: str, data: dict) -> str:
    if not data.get("valid"):
        content = (
            '<span class="badge invalid">✗ Certificado no encontrado</span>'
            "<h1>Este certificado no existe en Hack-Seguro</h1>"
            "<p style=\"color:#475569;line-height:1.5\">Verifica el ID de nuevo o pídele a la persona un enlace fresco. "
            "Los certificados válidos siempre se emiten desde <strong>hackseguro.app</strong>.</p>"
        )
    else:
        school_line = ""
        if data.get("school"):
            s = data["school"]
            school_line = f'<div class="row">Escuela: <strong>{s.get("name")}</strong> · {s.get("city", "")} {s.get("state", "")}</div>'
        grade_line = ""
        if data.get("grade") or data.get("group"):
            grade_line = f'<div class="row">Grupo: <strong>{data.get("grade") or "?"} {data.get("group") or ""}</strong></div>'
        issued = (data.get("issued_at") or "")[:10]
        content = f"""
          <span class="badge valid">✓ Certificado válido</span>
          <h1>{data.get("module_title")}</h1>
          <h2>Otorgado a</h2>
          <div class="name">{data.get("student_name")}</div>
          {grade_line}
          {school_line}
          <div class="row">Emitido: <strong>{issued}</strong></div>
        """
    return VERIFY_HTML_TEMPLATE.format(content=content, cert_id=cert_id)
