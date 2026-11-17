"""Pasa fotos de producto con etiqueta al fondo LISO blanco hueso de la carta (#FBF6EC).

David pidió el 17/11/2026 que las fotos tengan fondo plano blanco hueso, sin el halo amarillo ni el piso más oscuro
del diseño de etiquetar.py. Este script corrige fotos YA TERMINADAS con ese diseño (900 o 2000 px), sin necesitar
el recorte: calcula el fondo antiguo, que es siempre el mismo, y lo reemplaza por el liso; la sombra del producto
se rehace sobre el color nuevo y el producto y la etiqueta quedan iguales.

Uso:  python fondoLiso.py <carpeta o foto> [más…]     → escribe cada foto como «<nombre> liso.webp» al lado
      python fondoLiso.py --reemplazar <carpeta>       → sobrescribe las fotos (para fotos_900 antes de galeria.py)
Necesita: pip install pillow numpy
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

FONDO = (251, 246, 236)          # #FBF6EC: el mismo color del recuadro de la foto en la carta y en la galería
SOMBRA = (70, 52, 25)

def fondoHalo(n):
    """El fondo antiguo de etiquetar.py (color masa, halo amarillo trigo y piso), generado a 2000 px y llevado a n."""
    N = 2000
    y, x = np.mgrid[0:N, 0:N].astype(np.float32) / N
    base, halo, piso = (np.array(c, np.float32) for c in ([251, 246, 236], [255, 233, 160], [238, 228, 208]))
    r = np.sqrt((x - 0.5) ** 2 + ((y - 0.45) * 1.1) ** 2)
    wh = 0.62 * np.exp(-(r / 0.36) ** 2)
    wp = np.clip((y - 0.72) / 0.28, 0, 1) ** 1.4 * 0.75
    img = base * (1 - wh[..., None]) + halo * wh[..., None]
    img = img * (1 - wp[..., None]) + piso * wp[..., None]
    img += np.random.default_rng(3).normal(0, 0.6, img.shape)
    img = np.clip(img, 0, 255)
    if n != N:
        img = np.asarray(Image.fromarray(img.astype(np.uint8)).resize((n, n), Image.LANCZOS)).astype(np.float32)
    return img

def sinHalo(im):
    """Cada pixel se explica como fondo antiguo oscurecido por la sombra. Si calza, es fondo o sombra y se rehace igual
    sobre el fondo liso; si no calza (producto o etiqueta), se deja como está; en los bordes se mezcla."""
    a = np.asarray(im.convert('RGB')).astype(np.float32); n = a.shape[0]
    assert a.shape[0] == a.shape[1], 'la foto debe ser cuadrada'
    viejo = fondoHalo(n); nuevo = np.array(FONDO, np.float32); sc = np.array(SOMBRA, np.float32)
    lum = lambda c: c[..., 0] * .299 + c[..., 1] * .587 + c[..., 2] * .114
    s = np.clip((lum(viejo) - lum(a)) / (lum(viejo) - lum(sc)), 0, 1)
    s = np.where(s < 0.025, 0, s)[..., None]
    res = np.abs(a - (viejo * (1 - s) + sc * s)).max(axis=2)
    res = np.asarray(Image.fromarray(np.clip(res, 0, 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(3))).astype(np.float32)
    w = np.clip((res - 9) / 16, 0, 1)
    w = np.asarray(Image.fromarray((w * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.8 * n / 2000 + 0.3))).astype(np.float32)[..., None] / 255
    out = a * w + (nuevo * (1 - s) + sc * s) * (1 - w)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB')

def fotos(rutas):
    for r in rutas:
        if os.path.isdir(r):
            yield from (os.path.join(r, f) for f in sorted(os.listdir(r)) if f.lower().endswith(('.webp', '.jpg', '.png')) and ' liso.' not in f)
        else:
            yield r

if __name__ == '__main__':
    args = sys.argv[1:]; reemplazar = '--reemplazar' in args; args = [a for a in args if a != '--reemplazar']
    if not args: print(__doc__); sys.exit(1)
    for f in fotos(args):
        im = Image.open(f); nuevo = sinHalo(im)
        destino = f if reemplazar else os.path.splitext(f)[0] + ' liso.webp'
        if destino.lower().endswith('.webp'): nuevo.save(destino, quality=88, method=6)
        else: nuevo.save(destino, quality=92)
        print('listo', destino)
