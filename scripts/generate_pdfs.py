"""
Genera PDFs de recibos de prueba para el prototipo Voxoy.

Tres grupos:
- A: legítimos (precio real coincide con mercado)
- B: alterados (precio bajado de forma sospechosa)
- C: ambiguos (precios bajos pero potencialmente justificados)

Productos y precios reales (validados a 2026-05-01).
"""

import os
from datetime import date
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

OUT_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..",
    "..",
    "01_INPUT",
    "recibos-prueba",
)
os.makedirs(OUT_DIR, exist_ok=True)

# (filename, store_name, store_color, order_num, product, price_usd, qty, ship_addr, notes)
RECIBOS = [
    # GRUPO A - LEGITIMOS (5)
    {
        "file": "A1-apple-iphone15pro-LEGIT.pdf",
        "store": "Apple Store",
        "color": "#000000",
        "order": "W123456789",
        "product": "iPhone 15 Pro 256GB - Natural Titanium",
        "price": 1199.00,
        "qty": 1,
        "addr": "1234 P.O. Box Voxoy, Suite 311, McAllen TX 78501",
        "notes": "Free shipping on orders over $35",
    },
    {
        "file": "A2-bestbuy-macbook-LEGIT.pdf",
        "store": "Best Buy",
        "color": "#0046BE",
        "order": "BBY01-806-46-2944782",
        "product": 'MacBook Air 13" M3 8GB 256GB - Midnight',
        "price": 1099.00,
        "qty": 1,
        "addr": "1234 P.O. Box Voxoy, Suite 311, McAllen TX 78501",
        "notes": "In-Stock - Ships in 1-2 business days",
    },
    {
        "file": "A3-amazon-sony-headphones-LEGIT.pdf",
        "store": "Amazon.com",
        "color": "#FF9900",
        "order": "112-9384756-2837461",
        "product": "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
        "price": 348.00,
        "qty": 1,
        "addr": "1234 P.O. Box Voxoy, Suite 311, McAllen TX 78501",
        "notes": "Sold by Amazon.com Services LLC",
    },
    {
        "file": "A4-sephora-makeup-LEGIT.pdf",
        "store": "Sephora",
        "color": "#000000",
        "order": "SEP-66128443",
        "product": "Charlotte Tilbury Pillow Talk Lipstick + Liner Set",
        "price": 65.00,
        "qty": 1,
        "addr": "1234 P.O. Box Voxoy, Suite 311, McAllen TX 78501",
        "notes": "Beauty Insider points earned: 65",
    },
    {
        "file": "A5-target-instantpot-LEGIT.pdf",
        "store": "Target",
        "color": "#CC0000",
        "order": "102-1846-3729",
        "product": "Instant Pot Duo 7-in-1 Electric Pressure Cooker 6 qt",
        "price": 99.99,
        "qty": 1,
        "addr": "1234 P.O. Box Voxoy, Suite 311, McAllen TX 78501",
        "notes": "Order Pickup or Same Day Delivery available",
    },
    # GRUPO B - ALTERADOS (4)
    {
        "file": "B1-bestbuy-macbookpro-ALTERED.pdf",
        "store": "Best Buy",
        "color": "#0046BE",
        "order": "BBY01-806-46-3017284",
        "product": 'MacBook Pro 14" M3 Pro 18GB 1TB - Space Black',
        "price": 380.00,  # PRECIO REAL: $2,399 - $2,499
        "qty": 1,
        "addr": "1234 P.O. Box Voxoy, Suite 311, McAllen TX 78501",
        "notes": "Promotion code applied",
    },
    {
        "file": "B2-apple-iphone15promax-ALTERED.pdf",
        "store": "Apple Store",
        "color": "#000000",
        "order": "W987654321",
        "product": "iPhone 15 Pro Max 512GB - Blue Titanium",
        "price": 250.00,  # PRECIO REAL: $1,399
        "qty": 1,
        "addr": "1234 P.O. Box Voxoy, Suite 311, McAllen TX 78501",
        "notes": "Special pricing applied",
    },
    {
        "file": "B3-bh-canon-camera-ALTERED.pdf",
        "store": "B&H Photo Video",
        "color": "#1A4789",
        "order": "BH-7382014",
        "product": "Canon EOS R5 Mirrorless Camera Body",
        "price": 120.00,  # PRECIO REAL: $3,899
        "qty": 1,
        "addr": "1234 P.O. Box Voxoy, Suite 311, McAllen TX 78501",
        "notes": "Free expedited shipping",
    },
    {
        "file": "B4-saks-louisvuitton-ALTERED.pdf",
        "store": "Saks Fifth Avenue",
        "color": "#000000",
        "order": "SFA-2026-0428193",
        "product": "Louis Vuitton Neverfull MM Tote - Monogram",
        "price": 175.00,  # PRECIO REAL: $2,030
        "qty": 1,
        "addr": "1234 P.O. Box Voxoy, Suite 311, McAllen TX 78501",
        "notes": "Authentic - includes dust bag and certificate",
    },
    # GRUPO C - AMBIGUOS (3)
    {
        "file": "C1-bestbuy-tv-blackfriday-AMBIGUO.pdf",
        "store": "Best Buy",
        "color": "#0046BE",
        "order": "BBY01-806-46-9912847",
        "product": 'TCL 55" 4K UHD Roku Smart TV (Open Box - Excellent)',
        "price": 199.00,  # bajo pero open-box realista
        "qty": 1,
        "addr": "1234 P.O. Box Voxoy, Suite 311, McAllen TX 78501",
        "notes": "Open Box - Excellent condition - 30 day return",
    },
    {
        "file": "C2-apple-refurbished-ipad-AMBIGUO.pdf",
        "store": "Apple Refurbished",
        "color": "#000000",
        "order": "W778899002",
        "product": "Refurbished iPad Air 11-inch (M2) Wi-Fi 256GB",
        "price": 539.00,  # apple ref store legítimo, ~25% menos que MSRP
        "qty": 1,
        "addr": "1234 P.O. Box Voxoy, Suite 311, McAllen TX 78501",
        "notes": "Certified Refurbished - 1 year warranty",
    },
    {
        "file": "C3-etsy-handmade-AMBIGUO.pdf",
        "store": "Etsy",
        "color": "#F1641E",
        "order": "2718-4839201",
        "product": "Handmade Ceramic Vase Set (3) - Artisan ChicagoStudio",
        "price": 85.00,  # producto sin precio de mercado claro
        "qty": 1,
        "addr": "1234 P.O. Box Voxoy, Suite 311, McAllen TX 78501",
        "notes": "Made to order - Ships in 5-7 business days",
    },
]


def render_receipt(c: canvas.Canvas, r: dict):
    width, height = LETTER

    # Header con nombre de tienda
    color = HexColor(r["color"])
    c.setFillColor(color)
    c.rect(0, height - 1.0 * inch, width, 1.0 * inch, fill=1, stroke=0)
    c.setFillColor("#FFFFFF")
    c.setFont("Helvetica-Bold", 22)
    c.drawString(0.6 * inch, height - 0.6 * inch, r["store"])
    c.setFont("Helvetica", 10)
    c.drawString(0.6 * inch, height - 0.85 * inch, "Order Confirmation / Receipt")

    # Order info
    c.setFillColor("#000000")
    y = height - 1.4 * inch
    c.setFont("Helvetica-Bold", 11)
    c.drawString(0.6 * inch, y, f"Order #: {r['order']}")
    y -= 0.22 * inch
    c.setFont("Helvetica", 10)
    c.drawString(0.6 * inch, y, f"Date: {date(2026, 4, 22).isoformat()}")
    y -= 0.22 * inch
    c.drawString(0.6 * inch, y, "Customer: Voxoy Member #311")

    # Shipping
    y -= 0.45 * inch
    c.setFont("Helvetica-Bold", 11)
    c.drawString(0.6 * inch, y, "Ship to:")
    y -= 0.22 * inch
    c.setFont("Helvetica", 10)
    for line in r["addr"].split(", "):
        c.drawString(0.6 * inch, y, line)
        y -= 0.18 * inch

    # Item table
    y -= 0.4 * inch
    c.setFillColor("#F0F0F0")
    c.rect(0.5 * inch, y - 0.05 * inch, width - 1.0 * inch, 0.3 * inch, fill=1, stroke=0)
    c.setFillColor("#000000")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.6 * inch, y + 0.05 * inch, "ITEM")
    c.drawRightString(width - 1.5 * inch, y + 0.05 * inch, "QTY")
    c.drawRightString(width - 0.6 * inch, y + 0.05 * inch, "PRICE")

    y -= 0.4 * inch
    c.setFont("Helvetica", 10)
    # Wrap product if long
    product = r["product"]
    if len(product) > 55:
        words = product.split(" ")
        line1, line2 = "", ""
        for w in words:
            if len(line1) + len(w) < 55:
                line1 += w + " "
            else:
                line2 += w + " "
        c.drawString(0.6 * inch, y, line1.strip())
        c.drawString(0.6 * inch, y - 0.18 * inch, line2.strip())
        y -= 0.18 * inch
    else:
        c.drawString(0.6 * inch, y, product)

    c.drawRightString(width - 1.5 * inch, y, str(r["qty"]))
    c.drawRightString(width - 0.6 * inch, y, f"${r['price']:.2f}")

    y -= 0.5 * inch
    # Subtotal / Tax / Total
    subtotal = r["price"] * r["qty"]
    tax = subtotal * 0.0825
    total = subtotal + tax

    c.line(width / 2, y + 0.2 * inch, width - 0.6 * inch, y + 0.2 * inch)
    c.setFont("Helvetica", 10)
    c.drawRightString(width - 1.5 * inch, y, "Subtotal:")
    c.drawRightString(width - 0.6 * inch, y, f"${subtotal:.2f}")
    y -= 0.22 * inch
    c.drawRightString(width - 1.5 * inch, y, "Tax (8.25%):")
    c.drawRightString(width - 0.6 * inch, y, f"${tax:.2f}")
    y -= 0.32 * inch
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(width - 1.5 * inch, y, "TOTAL:")
    c.drawRightString(width - 0.6 * inch, y, f"${total:.2f}")

    # Notes
    if r["notes"]:
        y -= 0.6 * inch
        c.setFont("Helvetica-Oblique", 9)
        c.setFillColor("#666666")
        c.drawString(0.6 * inch, y, r["notes"])

    # Footer
    c.setFont("Helvetica", 8)
    c.setFillColor("#999999")
    c.drawCentredString(
        width / 2,
        0.5 * inch,
        f"Thank you for shopping at {r['store']}. Visit us at {r['store'].lower().replace(' ', '')}.com",
    )


def main():
    for r in RECIBOS:
        path = os.path.join(OUT_DIR, r["file"])
        c = canvas.Canvas(path, pagesize=LETTER)
        render_receipt(c, r)
        c.save()
        print(f"  generated {r['file']}  (${r['price']:.2f})")
    print(f"\n{len(RECIBOS)} PDFs en: {OUT_DIR}")


if __name__ == "__main__":
    main()
