# Producto negro (con tapa transparente) en foto borrosa: máscara por luminancia contra la luz del fondo
# (pared o tela, estimada con inpaint), limitada a un polígono holgado; color en gris neutro (sin el azul de la pared).
# Uso: python -I -X utf8 negro.py foto.webp config.json clave salida.png
import sys, json
import numpy as np, cv2
from PIL import Image
foto, cfg, clave, salida = sys.argv[1:]
C = json.load(open(cfg))[clave]; poli = np.array(C['poli'], np.int32)
im = np.asarray(Image.open(foto).convert('RGB')).astype(np.float32); H, W = im.shape[:2]
L = im @ np.array([0.299, 0.587, 0.114], np.float32)
dentro = np.zeros((H, W), np.uint8); cv2.fillPoly(dentro, [poli], 1)
zona = cv2.dilate(dentro, np.ones((61, 61), np.uint8)); limite = cv2.dilate(dentro, np.ones((21, 21), np.uint8))
q = 8; Lc = cv2.resize(L, (W // q, H // q), interpolation=cv2.INTER_AREA)
hueco = cv2.resize(zona, (W // q, H // q), interpolation=cv2.INTER_NEAREST)
Lbg = cv2.inpaint(np.clip(Lc, 0, 255).astype(np.uint8), hueco, 25, cv2.INPAINT_TELEA).astype(np.float32)
Lbg = cv2.GaussianBlur(cv2.resize(Lbg, (W, H), interpolation=cv2.INTER_CUBIC), (0, 0), 15)
k = ((L < (Lbg + 38) / 2) & (zona == 1)).astype(np.uint8)
k = cv2.morphologyEx(k, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)); k = cv2.morphologyEx(k, cv2.MORPH_CLOSE, np.ones((41, 41), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(k); k = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
inv = np.pad(1 - k, 1, constant_values=1); cv2.floodFill(inv, None, (0, 0), 2); k = np.where(inv[1:-1, 1:-1] == 2, 0, 1).astype(np.uint8)
# perilla blanca de la tapa: lo claro que queda dentro del polígono justo encima de la máscara
arriba = (dentro == 1) & (k == 0) & (L > Lbg + 40)
k = np.maximum(k, cv2.morphologyEx(arriba.astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8)))
k = np.maximum(k, cv2.erode(dentro, np.ones((41, 41), np.uint8))) & limite
if 'cuerpo' in C:
    cu = np.array(C['cuerpo'], np.int32); g = np.zeros((H, W), np.uint8); cv2.fillPoly(g, [cu], 1)
    k[cu[:, 1].min() + 30:] = 0; k = np.maximum(k, g)
k = (cv2.GaussianBlur(k.astype(np.float32), (0, 0), 5) > 0.5).astype(np.uint8)
a = cv2.GaussianBlur(k.astype(np.float32), (0, 0), 2.5)
g = np.clip(L, 0, 255); rgb = np.dstack([g * 1.0, g * 0.99, g * 0.97])
x, y, w, h = cv2.boundingRect((a > 0.03).astype(np.uint8))
Image.fromarray(np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8)[y:y + h, x:x + w], 'RGBA').save(salida)
print(clave, x, y, w, h)
