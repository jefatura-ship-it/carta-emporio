# Recorte de productos opacos (vasos de papel, con color) desde una foto real sobre pared azul y tela.
# Conserva el color original. GrabCut con máscara desde un polígono, limpia la máscara, suaviza el borde
# y le quita al borde el reflejo azul de la pared.
# Si la config trae «linea», «base» y «razon», bajo la línea donde empieza la tela el contorno se dibuja:
# rectas ajustadas a los lados (medidos contra la pared) y media elipse en la base (la tela clara confunde a GrabCut).
#   soloPoligono: true usa el polígono tal cual, sin GrabCut.
#   soloDentro: true recorta además al polígono (paquetes de bordes rectos).
#   filas: cuántas filas sobre la línea se usan para ajustar los lados; desde: y donde empieza el contorno dibujado (por omisión, la línea).
#   linea: y donde la tela empieza a quedar detrás de los lados; base: y del punto más bajo; razon: alto/ancho de la elipse de la base.
# Uso: python -I -X utf8 opaco.py config.json
import sys, json
import numpy as np, cv2
from PIL import Image

def mascara(im, poli, nucleo=61, margen=45):
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
    p = np.pad(f, 1); r = p.copy() * 255; cv2.floodFill(r, None, (0, 0), 128)
    return np.maximum(f, (r[1:-1, 1:-1] == 0).astype(np.uint8))

def recta(pts):
    y, x = np.array(pts, np.float64).T
    c = np.polyfit(y, x, 1)
    ok = np.abs(np.polyval(c, y) - x) < 6
    return np.polyfit(y[ok], x[ok], 1) if ok.sum() > 5 else c

def baseDibujada(f, linea, base, razon, filas=150, desde=None):
    izq, der = [], []
    for y in range(linea - filas, linea - 8, 3):
        xs = np.where(f[y])[0]
        if len(xs): izq.append((y, xs.min())); der.append((y, xs.max()))
    ci, cd = recta(izq), recta(der)
    I = lambda y: np.polyval(ci, y); D = lambda y: np.polyval(cd, y)
    yc = base - 40.0
    for _ in range(10): yc = base - razon * (D(yc) - I(yc)) / 2
    a, cx, b = (D(yc) - I(yc)) / 2, (D(yc) + I(yc)) / 2, base - yc
    y0 = desde or linea - 8
    pts = [(I(y0), y0), (D(y0), y0), (D(yc), yc)] + [(cx + a * np.cos(t), yc + b * np.sin(t)) for t in np.linspace(0, np.pi, 120)] + [(I(yc), yc)]
    g = np.zeros_like(f); cv2.fillPoly(g, [np.round(np.array(pts)).astype(np.int32)], 1)
    f = f.copy(); f[y0:] = 0
    return np.maximum(f, g), (round(I(y0)), round(D(y0)), round(yc), round(a), round(b))

def guarda(im, f, salida):
    a = cv2.GaussianBlur(f.astype(np.float32) * 255, (0, 0), 1.3)
    rgb = im.astype(np.float32)
    borde = (a < 250) & (a > 0)
    tope = np.maximum(rgb[..., 0], rgb[..., 1]) + 4
    rgb[..., 2] = np.where(borde, np.minimum(rgb[..., 2], tope), rgb[..., 2])
    out = np.dstack([rgb.clip(0, 255).astype(np.uint8), a.clip(0, 255).astype(np.uint8)])
    ys, xs = np.where(a > 8)
    Image.fromarray(out[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA').save(salida)
    return xs.min(), ys.min(), xs.max(), ys.max()

def recorta(c):
    im = np.array(Image.open(c['foto']).convert('RGB'))
    if c.get('soloPoligono'):   # contorno medido a mano: sin GrabCut (producto blanco sobre la tela clara)
        k = 4; g = np.zeros((im.shape[0] * k, im.shape[1] * k), np.uint8)
        cv2.fillPoly(g, [np.round(np.array(c['poli']) * k).astype(np.int32)], 1)
        f = (cv2.resize(g.astype(np.float32), (im.shape[1], im.shape[0]), interpolation=cv2.INTER_AREA) > 0.5).astype(np.uint8); info = ''
    else: f = mascara(im, c['poli'], c.get('nucleo', 61), c.get('margen', 45)); info = ''
    if c.get('soloDentro'):   # no sale del polígono (bordes rectos de un paquete sobre la tela)
        d = np.zeros_like(f); cv2.fillPoly(d, [np.array(c['poli'], np.int32)], 1); f = f & d
    if 'linea' in c: f, info = baseDibujada(f, c['linea'], c['base'], c['razon'], c.get('filas', 150), c.get('desde'))
    return guarda(im, f, c['salida']), info

if __name__ == '__main__':
    for k, c in json.load(open(sys.argv[1], encoding='utf-8')).items():
        print(k, *recorta(c))
