# Recorte de productos opacos (vasos de papel, con color) desde una foto real sobre pared azul y tela.
# Conserva el color original. GrabCut con máscara desde un polígono, limpia la máscara, suaviza el borde
# y le quita al borde el reflejo azul de la pared.   Uso: python -I -X utf8 opaco.py config.json
import sys, json
import numpy as np, cv2
from PIL import Image

def recorta(ruta, poli, salida, nucleo=61, margen=45):
    im = np.array(Image.open(ruta).convert('RGB'))
    h, w = im.shape[:2]
    dentro = np.zeros((h, w), np.uint8); cv2.fillPoly(dentro, [np.array(poli, np.int32)], 1)
    m = np.full((h, w), cv2.GC_BGD, np.uint8)
    m[cv2.dilate(dentro, np.ones((margen, margen), np.uint8)) == 1] = cv2.GC_PR_BGD
    m[dentro == 1] = cv2.GC_PR_FGD
    m[cv2.erode(dentro, np.ones((nucleo, nucleo), np.uint8)) == 1] = cv2.GC_FGD
    bg, fg = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(cv2.cvtColor(im, cv2.COLOR_RGB2BGR), m, None, bg, fg, 6, cv2.GC_INIT_WITH_MASK)
    f = ((m == cv2.GC_FGD) | (m == cv2.GC_PR_FGD)).astype(np.uint8)
    f = cv2.morphologyEx(f, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    f = cv2.morphologyEx(f, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, et, st, _ = cv2.connectedComponentsWithStats(f)
    if n > 1: f = (et == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    # rellena agujeros (con 1 px de borde para que el relleno parta desde afuera)
    p = np.pad(f, 1); r = p.copy() * 255; cv2.floodFill(r, None, (0, 0), 128)
    f = np.maximum(f, (r[1:-1, 1:-1] == 0).astype(np.uint8))
    a = cv2.GaussianBlur(f.astype(np.float32) * 255, (0, 0), 1.3)
    rgb = im.astype(np.float32)
    borde = (a < 250) & (a > 0)
    tope = np.maximum(rgb[..., 0], rgb[..., 1]) + 4
    rgb[..., 2] = np.where(borde, np.minimum(rgb[..., 2], tope), rgb[..., 2])
    out = np.dstack([rgb.clip(0, 255).astype(np.uint8), a.clip(0, 255).astype(np.uint8)])
    ys, xs = np.where(a > 8)
    Image.fromarray(out[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA').save(salida)
    return xs.min(), ys.min(), xs.max(), ys.max()

if __name__ == '__main__':
    for k, c in json.load(open(sys.argv[1], encoding='utf-8')).items():
        print(k, recorta(c['foto'], c['poli'], c['salida'], c.get('nucleo', 61), c.get('margen', 45)))
