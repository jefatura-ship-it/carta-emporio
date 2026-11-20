"""Ficha de producto (fondo liso #FBF6EC, etiqueta verde y naranja) desde una foto de tienda con fondo BLANCO.

Pedido de David (20/11/2026): las bebidas se sacan de internet. Las fotos de la tienda oficial (miCoca-Cola.cl) traen
el producto sobre blanco y una franja de color a la derecha; aquí se corta la franja, se encuadra el producto y se
pone sobre la ficha MULTIPLICANDO (blanco × crema = crema): no hay que recortar el contorno, así que las botellas
transparentes quedan transparentes y sin borde serruchado.

Uso:  python -I fotoWeb.py <config.json> <carpeta de salida>
config = {"BEB001": {"foto": "ruta.png", "nombre": "Agua Vital con gas", "contenido": "600 cc",
                     "hasta": 0.74,              # opcional: fracción del ancho donde empieza la franja (se ignora lo que sigue)
                     "caja": [x0, y0, x1, y1],   # opcional: encuadre a mano, en pixeles de la foto
                     "recorte": true,            # opcional: la foto ya es un recorte PNG con transparencia
                     "archivo": "BEB001-2"}}     # opcional: nombre del archivo (para la 2.ª, 3.ª foto…)
Deja <salida>/<CÓDIGO>.webp de 600 px (igual que las demás fotos de img/productos/fotos/).
Necesita: pip install pillow numpy · la fuente InterDisplay-ExtraBold.otf de la carpeta de etiquetar.py de David
(o la variable de entorno FUENTE_FICHA con otra ruta).
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FUENTE = os.environ.get("FUENTE_FICHA", os.path.expanduser(r"~\Downloads\fotos-productos-emporio\fuente\InterDisplay-ExtraBold.otf"))
FONDO = (251, 246, 236)                       # #FBF6EC, el mismo del recuadro de la foto en la carta
VERDE, NARANJO = (29, 92, 54), (200, 86, 15)  # #1d5c36 y #c8560f, como etiquetar.py
SOMBRA = (70, 52, 25)

def lineas(nombre):
    p = nombre.split()
    if len(p) == 1:
        return [nombre]
    mejor = None
    for i in range(1, len(p)):
        a, b = " ".join(p[:i]), " ".join(p[i:])
        if mejor is None or abs(len(a) - len(b)) < mejor[0]:
            mejor = (abs(len(a) - len(b)), [a, b])
    return mejor[1]

def texto(lns, ancho_max, alto_max):
    for size in range(260, 20, -4):
        f = ImageFont.truetype(FUENTE, size)
        anchos = [f.getbbox(t)[2] - f.getbbox(t)[0] for t in lns]
        alto_linea = int(size * 1.02)
        if max(anchos) <= ancho_max and alto_linea * len(lns) <= alto_max:
            break
    img = Image.new("RGBA", (max(anchos) + 20, alto_linea * len(lns) + int(size * 0.3)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    y = 0
    for t, w in zip(lns, anchos):
        bb = f.getbbox(t)
        d.text(((img.width - w) / 2 - bb[0], y - int(size * 0.12)), t, font=f, fill=(255, 255, 255))
        y += alto_linea
    texto.ultimo = size
    return img.crop(img.getbbox())

def producto(ruta, hasta=0.74, caja=None):
    """Encuadra el producto (lo que no es blanco) a la izquierda de la franja; el blanco queda en 255 exacto."""
    a = np.asarray(Image.open(ruta).convert("RGB")).astype(np.float32)
    h, w, _ = a.shape
    if caja:
        x0, y0, x1, y1 = caja
    else:
        lim = int(w * hasta)
        m = a[:, :lim].min(axis=2) < 244
        m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5))) > 0
        ys, xs = np.nonzero(m)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        if x1 >= lim - 2:
            print("  OJO: el producto toca la franja; revisar o dar «caja» a mano")
        x0, y0, x1, y1 = max(0, x0 - 4), max(0, y0 - 4), min(lim, x1 + 4), min(h, y1 + 4)
    c = a[y0:y1, x0:x1]
    blanco = np.median(np.concatenate([c[0], c[-1], c[:, 0], c[:, -1]]), axis=0)   # fondo de la foto (casi 255)
    c = np.clip(c * (255.0 / np.maximum(blanco, 1)), 0, 255)
    c[c.min(axis=2) > 251] = 255
    return Image.fromarray(c.astype(np.uint8), "RGB"), (x0, y0, x1, y1)

def ficha(prod, nombre, contenido, N=2000):
    bg = Image.new("RGB", (N, N), FONDO).convert("RGBA")
    x0, x1 = int(N * 0.745), int(N * 0.94)
    yA0, yA1, yB0, yB1 = int(N * 0.06), int(N * 0.73), int(N * 0.745), int(N * 0.94)
    d = ImageDraw.Draw(bg)
    d.rounded_rectangle([x0, yA0, x1, yA1], int(N * 0.02), fill=VERDE + (255,))
    d.rounded_rectangle([x0, yB0, x1, yB1], int(N * 0.02), fill=NARANJO + (255,))
    t = texto(lineas(nombre), (yA1 - yA0) - 2 * int(N * 0.035), (x1 - x0) - 2 * int(N * 0.028)).rotate(90, expand=True)
    bg.alpha_composite(t, (x0 + (x1 - x0 - t.width) // 2, yA0 + (yA1 - yA0 - t.height) // 2))
    aw, ah = (x1 - x0) - 2 * int(N * 0.016), int((yB1 - yB0) * 0.42)
    s = texto([contenido], aw, ah); t1 = texto.ultimo
    if " " in contenido:
        s2 = texto(lineas(contenido), aw, int((yB1 - yB0) * 0.70))
        if texto.ultimo > t1 * 1.15: s = s2
    bg.alpha_composite(s, (x0 + (x1 - x0 - s.width) // 2, yB0 + (yB1 - yB0 - s.height) // 2))
    zx0, zx1 = int(N * 0.04), int(N * 0.715)
    rec = prod.mode == "RGBA"     # recorte con transparencia (transparente.py, opaco.py): mismo encuadre que etiquetar.py
    r = min((zx1 - zx0) / prod.width, (N * (0.70 if rec else 0.80)) / prod.height)
    c = prod.resize((max(1, round(prod.width * r)), max(1, round(prod.height * r))), Image.LANCZOS)
    px = zx0 + (zx1 - zx0 - c.width) // 2
    py = int(min(N * 0.86 - c.height, N * 0.56 - c.height / 2)) if rec else int(min(N * 0.90 - c.height, N * 0.50 - c.height / 2))
    sh = Image.new("L", (N, N), 0)
    ds = ImageDraw.Draw(sh)
    sw, shh = c.width * 0.86, max(N * 0.022, c.width * 0.055)
    cx, cy = px + c.width / 2, py + c.height - shh * 0.15
    ds.ellipse([cx - sw / 2, cy - shh / 2, cx + sw / 2, cy + shh / 2], fill=120)
    sh = sh.filter(ImageFilter.GaussianBlur(N * 0.018))
    sombra = Image.new("RGBA", (N, N), SOMBRA + (0,)); sombra.putalpha(sh)
    bg.alpha_composite(sombra)
    if rec:
        bg.alpha_composite(c, (px, py))
        return bg.convert("RGB")
    out = np.asarray(bg.convert("RGB")).astype(np.float32)
    zona = out[py:py + c.height, px:px + c.width]
    out[py:py + c.height, px:px + c.width] = zona * np.asarray(c).astype(np.float32) / 255.0   # multiplicar
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")

if __name__ == "__main__":
    if len(sys.argv) < 3: print(__doc__); sys.exit(1)
    cfg = json.load(open(sys.argv[1], encoding="utf-8")); sal = sys.argv[2]
    os.makedirs(sal, exist_ok=True)
    for cod, p in cfg.items():
        if p.get("recorte"):   # ya viene recortado, con transparencia
            prod, caja = Image.open(p["foto"]).convert("RGBA"), "recorte"
        else:
            prod, caja = producto(p["foto"], p.get("hasta", 0.74), p.get("caja"))
        f = ficha(prod, p["nombre"], p["contenido"])
        f.resize((600, 600), Image.LANCZOS).save(os.path.join(sal, p.get("archivo", cod) + ".webp"), quality=84, method=6)
        print("listo", cod, p["nombre"], p["contenido"], "encuadre", caja)
